import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AgentsService } from '../agents/agents.service';
import { ProposalsService } from '../proposals/proposals.service';
import { 
  VoteDecision, 
  VotingSession, 
  VoteCast, 
  VotingResults,
  VotingRule,
  AutomatedVotingConfig 
} from './interfaces/voting.interface';

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly agentsService: AgentsService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Automated Voting System - Core BIP-06 Feature
   */
  async initiateAutomatedVoting(proposalId: string, config?: AutomatedVotingConfig): Promise<VotingSession> {
    this.logger.log(`🗳️ Initiating automated voting for proposal: ${proposalId}`);

    const proposal = await this.proposalsService.findById(proposalId);
    if (proposal.status !== 'discussion') {
      throw new BadRequestException(`Proposal must be in discussion phase. Current: ${proposal.status}`);
    }

    // Default voting configuration
    const votingConfig: AutomatedVotingConfig = {
      duration: config?.duration || 48, // 2 days default
      quorumThreshold: config?.quorumThreshold || 0.6,
      consensusThreshold: config?.consensusThreshold || 0.7,
      autoFinalize: config?.autoFinalize ?? true,
      allowedRoles: config?.allowedRoles || ['voter', 'reviewer', 'mediator'],
      votingRules: config?.votingRules || [],
      timeoutBehavior: config?.timeoutBehavior || 'extend_once',
      ...config
    };

    // Calculate voting deadline
    const votingDeadline = new Date();
    votingDeadline.setHours(votingDeadline.getHours() + votingConfig.duration);

    // Move proposal to voting phase
    await this.proposalsService.moveToVoting(proposalId, votingDeadline);

    // Create voting session
    const sessionId = `vs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: VotingSession = {
      id: sessionId,
      proposalId,
      status: 'active',
      config: votingConfig,
      startedAt: new Date(),
      deadline: votingDeadline,
      eligibleAgents: await this.getEligibleVoters(votingConfig.allowedRoles),
      votes: [],
      results: null,
    };

    await this.storeVotingSession(session);
    this.logger.log(`✅ Automated voting session created: ${sessionId}`);
    return session;
  }

  /**
   * Cast a vote with justification and weight calculation
   */
  async castVote(
    sessionId: string, 
    agentId: string, 
    decision: VoteDecision, 
    justification?: string
  ): Promise<VoteCast> {
    this.logger.log(`🗳️ Casting vote: ${agentId} -> ${decision}`);

    const session = await this.getVotingSession(sessionId);
    if (session.status !== 'active') {
      throw new BadRequestException(`Voting session is ${session.status}`);
    }

    if (new Date() > session.deadline) {
      throw new BadRequestException('Voting deadline has passed');
    }

    // Verify agent eligibility
    const agent = await this.agentsService.findById(agentId);
    if (!session.eligibleAgents.includes(agentId)) {
      throw new BadRequestException('Agent is not eligible to vote');
    }

    // Check for duplicate vote
    if (session.votes.find(v => v.agentId === agentId)) {
      throw new BadRequestException('Agent has already voted');
    }

    // Calculate vote weight
    const weight = await this.calculateVoteWeight(agent, session);

    const vote: VoteCast = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      agentId,
      decision,
      justification: justification || '',
      weight,
      castAt: new Date(),
    };

    await this.storeVote(vote);
    session.votes.push(vote);
    await this.updateVotingSession(session);

    return vote;
  }

  /**
   * Get real-time voting results
   */
  async getVotingResults(sessionId: string): Promise<VotingResults> {
    this.logger.log(`📊 Getting voting results for: ${sessionId}`);

    const session = await this.getVotingSession(sessionId);
    
    const totalEligible = session.eligibleAgents.length;
    const totalVotes = session.votes.length;
    const participationRate = totalVotes / totalEligible;

    const approveVotes = session.votes.filter(v => v.decision === 'approve');
    const rejectVotes = session.votes.filter(v => v.decision === 'reject');
    const abstainVotes = session.votes.filter(v => v.decision === 'abstain');

    const totalWeight = session.votes.reduce((sum, vote) => sum + vote.weight, 0);
    const approveWeight = approveVotes.reduce((sum, vote) => sum + vote.weight, 0);

    const consensusPercentage = totalWeight > 0 ? (approveWeight / totalWeight) * 100 : 0;
    const quorumMet = participationRate >= session.config.quorumThreshold;
    const consensusMet = consensusPercentage >= (session.config.consensusThreshold * 100);

    return {
      sessionId,
      proposalId: session.proposalId,
      status: session.status,
      totalEligible,
      totalVotes,
      participationRate,
      quorumMet,
      quorumThreshold: session.config.quorumThreshold,
      votes: {
        approve: { count: approveVotes.length, weight: approveWeight },
        reject: { count: rejectVotes.length, weight: rejectVotes.reduce((s, v) => s + v.weight, 0) },
        abstain: { count: abstainVotes.length, weight: abstainVotes.reduce((s, v) => s + v.weight, 0) },
      },
      consensus: {
        percentage: consensusPercentage,
        threshold: session.config.consensusThreshold * 100,
        met: consensusMet,
      },
      result: session.status === 'finalized' ? (quorumMet && consensusMet ? 'approved' : 'rejected') : 'pending',
      deadline: session.deadline,
      timeRemaining: session.deadline.getTime() - Date.now(),
      finalizedAt: session.finalizedAt || null,
    };
  }

  /**
   * Finalize voting session
   */
  async finalizeVoting(sessionId: string): Promise<VotingResults> {
    this.logger.log(`🏁 Finalizing voting: ${sessionId}`);

    const session = await this.getVotingSession(sessionId);
    if (session.status === 'finalized') {
      throw new BadRequestException('Already finalized');
    }

    session.status = 'finalized';
    session.finalizedAt = new Date();

    const results = await this.getVotingResults(sessionId);
    const newStatus = results.result === 'approved' ? 'approved' : 'rejected';
    
    await this.proposalsService.updateProposalStatusPublic(session.proposalId, newStatus);
    await this.updateVotingSession(session);

    return results;
  }

  // Private helper methods
  private async getEligibleVoters(allowedRoles: string[]): Promise<string[]> {
    // For now, get all active agents - proper role filtering would need type conversion
    const agents = await this.agentsService.findAll({ isActive: true }, 1, 1000);
    return agents.items.map(agent => agent.id);
  }

  private async calculateVoteWeight(agent: any, session: VotingSession): Promise<number> {
    let weight = 1.0;
    
    const metrics = agent.performanceMetrics || {};
    const qualityScore = metrics.qualityScore || 0.5;
    const consensusScore = metrics.consensusScore || 0.5;
    
    weight += ((qualityScore + consensusScore) / 2) * 0.3;
    
    if (agent.roles.includes('reviewer')) weight *= 1.2;
    if (agent.roles.includes('mediator')) weight *= 1.1;
    
    return Math.max(0.1, Math.min(2.0, weight));
  }

  // Database operations
  private async storeVotingSession(session: VotingSession): Promise<void> {
    const statement = this.databaseService.getDatabase().prepare(`
      INSERT OR REPLACE INTO voting_sessions (
        id, proposal_id, status, config, started_at, deadline, eligible_agents, votes, results
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run([
      session.id,
      session.proposalId,
      session.status,
      JSON.stringify(session.config),
      session.startedAt.toISOString(),
      session.deadline.toISOString(),
      JSON.stringify(session.eligibleAgents),
      JSON.stringify(session.votes),
      JSON.stringify(session.results),
    ]);
  }

  private async getVotingSession(sessionId: string): Promise<VotingSession> {
    const statement = this.databaseService.getDatabase().prepare(`SELECT * FROM voting_sessions WHERE id = ?`);
    const row = statement.get([sessionId]) as any;

    if (!row) {
      throw new NotFoundException(`Voting session not found: ${sessionId}`);
    }

    return {
      id: row.id,
      proposalId: row.proposal_id,
      status: row.status,
      config: JSON.parse(row.config),
      startedAt: new Date(row.started_at),
      deadline: new Date(row.deadline),
      eligibleAgents: JSON.parse(row.eligible_agents),
      votes: JSON.parse(row.votes),
      results: row.results ? JSON.parse(row.results) : null,
      finalizedAt: row.finalized_at ? new Date(row.finalized_at) : undefined,
    };
  }

  private async updateVotingSession(session: VotingSession): Promise<void> {
    const statement = this.databaseService.getDatabase().prepare(`
      UPDATE voting_sessions SET 
        status = ?, votes = ?, results = ?, finalized_at = ?, updated_at = ?
      WHERE id = ?
    `);

    statement.run([
      session.status,
      JSON.stringify(session.votes),
      JSON.stringify(session.results),
      session.finalizedAt?.toISOString() || null,
      new Date().toISOString(),
      session.id,
    ]);
  }

  private async storeVote(vote: VoteCast): Promise<void> {
    const statement = this.databaseService.getDatabase().prepare(`
      INSERT INTO votes (
        id, proposal_id, agent_id, decision, justification, weight, cast_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run([
      vote.id,
      vote.sessionId,
      vote.agentId,
      vote.decision,
      vote.justification,
      vote.weight,
      vote.castAt.toISOString(),
    ]);
  }
}