import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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

  /**
   * Enhanced voting with mandatory justifications (Phase 3 feature)
   */
  async castVoteWithJustification(
    sessionId: string,
    agentId: string,
    decision: VoteDecision,
    justification: string,
    metadata?: Record<string, any>
  ): Promise<VoteCast> {
    this.logger.log(`🗳️ Casting justified vote: ${agentId} -> ${decision}`);

    // Validate justification
    if (!justification || justification.trim().length < 10) {
      throw new BadRequestException('Vote justification must be at least 10 characters long');
    }

    // Check for inappropriate content (basic validation)
    if (this.containsInappropriateContent(justification)) {
      throw new BadRequestException('Vote justification contains inappropriate content');
    }

    // Create enhanced vote with justification
    const vote: VoteCast = {
      id: uuidv4(),
      sessionId,
      agentId,
      decision,
      justification: justification.trim(),
      weight: 1.0, // Default weight, could be calculated based on agent expertise
      castAt: new Date(),
      metadata: {
        ...metadata,
        justificationLength: justification.trim().length,
        hasReferences: this.extractReferences(justification).length > 0,
        sentimentScore: this.calculateJustificationSentiment(justification)
      }
    };

    // Store vote with enhanced metadata
    await this.storeVote(vote);

    this.logger.log(`✅ Justified vote recorded: ${agentId} -> ${decision} (${justification.length} chars)`);
    return vote;
  }

  /**
   * Validate vote justification quality
   */
  async validateJustification(justification: string): Promise<{
    isValid: boolean;
    score: number;
    feedback: string[];
    suggestions: string[];
  }> {
    const feedback: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Length check
    if (justification.length < 10) {
      feedback.push('Justification too short');
    } else if (justification.length > 1000) {
      feedback.push('Justification too long');
      suggestions.push('Consider summarizing key points');
    } else {
      score += 20;
    }

    // Content quality checks
    const hasReferences = this.extractReferences(justification).length > 0;
    if (hasReferences) {
      score += 30;
      feedback.push('Good use of references');
    } else {
      suggestions.push('Consider adding references to support your reasoning');
    }

    // Technical reasoning check
    const hasTechnicalTerms = this.containsTechnicalReasoning(justification);
    if (hasTechnicalTerms) {
      score += 25;
      feedback.push('Contains technical reasoning');
    } else {
      suggestions.push('Consider adding technical analysis');
    }

    // Constructive tone check
    const isConstructive = this.hasConstructiveTone(justification);
    if (isConstructive) {
      score += 25;
      feedback.push('Constructive and professional tone');
    } else {
      suggestions.push('Use more constructive language');
    }

    const isValid = score >= 50 && feedback.length > 0;

    return {
      isValid,
      score,
      feedback,
      suggestions
    };
  }

  /**
   * Get voting session with enhanced analytics
   */
  async getEnhancedVotingResults(sessionId: string): Promise<{
    results: VotingResults;
    justificationAnalysis: {
      averageLength: number;
      sentimentDistribution: Record<string, number>;
      qualityScores: number[];
      topReferences: string[];
    };
    participationMetrics: {
      totalEligible: number;
      totalParticipated: number;
      participationRate: number;
      roleDistribution: Record<string, number>;
    };
  }> {
    const results = await this.getVotingResults(sessionId);
    
    // Get all votes with justifications
    const db = this.databaseService.getDatabase();
    const votes = db.prepare(`
      SELECT * FROM votes 
      WHERE proposal_id = (
        SELECT proposal_id FROM voting_sessions WHERE id = ?
      )
    `).all(sessionId);

    // Analyze justifications
    const justifications = votes
      .filter((v: any) => v.justification)
      .map((v: any) => v.justification);

    const justificationAnalysis = {
      averageLength: justifications.length > 0 
        ? justifications.reduce((sum: number, j: string) => sum + j.length, 0) / justifications.length 
        : 0,
      sentimentDistribution: this.analyzeJustificationSentiments(justifications),
      qualityScores: justifications.map((j: string) => this.calculateJustificationQuality(j)),
      topReferences: this.extractTopReferences(justifications)
    };

    // Analyze participation
    const eligibleAgents = await this.getEligibleVotersFromSession(sessionId);
    const participationMetrics = {
      totalEligible: eligibleAgents.length,
      totalParticipated: votes.length,
      participationRate: votes.length / Math.max(eligibleAgents.length, 1),
      roleDistribution: this.calculateRoleDistribution(votes, eligibleAgents)
    };

    return {
      results,
      justificationAnalysis,
      participationMetrics
    };
  }

  // Private helper methods for justification analysis

  private containsInappropriateContent(text: string): boolean {
    // Basic inappropriate content detection
    const inappropriateWords = ['spam', 'scam', 'attack', 'malicious'];
    return inappropriateWords.some(word => text.toLowerCase().includes(word));
  }

  private extractReferences(text: string): string[] {
    // Extract references like "Section 3.2", "BIP-05", etc.
    const referencePatterns = [
      /(?:section|sec\.?)\s*(\d+(?:\.\d+)*)/gi,
      /BIP-(\d+)/gi,
      /(?:proposal|prop\.?)\s*([A-Z0-9-]+)/gi
    ];

    const references: string[] = [];
    referencePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        references.push(...matches);
      }
    });

    return [...new Set(references)]; // Remove duplicates
  }

  private calculateJustificationSentiment(text: string): number {
    // Simple sentiment scoring (-1 to 1)
    const positiveWords = ['good', 'excellent', 'approve', 'support', 'beneficial'];
    const negativeWords = ['bad', 'poor', 'reject', 'oppose', 'harmful'];

    let score = 0;
    const words = text.toLowerCase().split(/\s+/);

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });

    return Math.max(-1, Math.min(1, score / words.length));
  }

  private containsTechnicalReasoning(text: string): boolean {
    const technicalTerms = [
      'performance', 'scalability', 'security', 'implementation', 'algorithm',
      'architecture', 'database', 'api', 'interface', 'protocol', 'framework'
    ];
    
    const lowerText = text.toLowerCase();
    return technicalTerms.some(term => lowerText.includes(term));
  }

  private hasConstructiveTone(text: string): boolean {
    const constructiveIndicators = [
      'suggest', 'recommend', 'consider', 'improve', 'enhance',
      'alternative', 'solution', 'approach', 'benefit'
    ];
    
    const destructiveIndicators = [
      'terrible', 'stupid', 'waste', 'pointless', 'useless'
    ];

    const lowerText = text.toLowerCase();
    const constructiveCount = constructiveIndicators.filter(word => lowerText.includes(word)).length;
    const destructiveCount = destructiveIndicators.filter(word => lowerText.includes(word)).length;

    return constructiveCount > destructiveCount;
  }

  private analyzeJustificationSentiments(justifications: string[]): Record<string, number> {
    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    
    justifications.forEach(justification => {
      const sentiment = this.calculateJustificationSentiment(justification);
      if (sentiment > 0.1) sentiments.positive++;
      else if (sentiment < -0.1) sentiments.negative++;
      else sentiments.neutral++;
    });

    return sentiments;
  }

  private calculateJustificationQuality(justification: string): number {
    let score = 0;
    
    // Length score (0-25 points)
    const length = justification.length;
    if (length >= 50 && length <= 500) score += 25;
    else if (length >= 20) score += 15;

    // Reference score (0-25 points)
    const references = this.extractReferences(justification);
    score += Math.min(references.length * 10, 25);

    // Technical reasoning score (0-25 points)
    if (this.containsTechnicalReasoning(justification)) score += 25;

    // Constructive tone score (0-25 points)
    if (this.hasConstructiveTone(justification)) score += 25;

    return Math.min(score, 100);
  }

  private extractTopReferences(justifications: string[]): string[] {
    const allReferences: string[] = [];
    justifications.forEach(j => {
      allReferences.push(...this.extractReferences(j));
    });

    // Count occurrences
    const refCounts: Record<string, number> = {};
    allReferences.forEach(ref => {
      refCounts[ref] = (refCounts[ref] || 0) + 1;
    });

    // Return top 5 most referenced
    return Object.entries(refCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([ref]) => ref);
  }

  private async getEligibleVotersFromSession(sessionId: string): Promise<any[]> {
    // Get voting session to find eligible agents
    const db = this.databaseService.getDatabase();
    const session = db.prepare('SELECT * FROM voting_sessions WHERE id = ?').get(sessionId) as any;
    
    if (!session) {
      return [];
    }

    const eligibleAgents = JSON.parse(session.eligible_agents || '[]');
    return eligibleAgents;
  }

  private calculateRoleDistribution(votes: any[], eligibleAgents: any[]): Record<string, number> {
    // This would require agent role information - simplified for now
    return {
      'proposer': votes.filter((v: any) => v.agent_id.includes('proposer')).length,
      'reviewer': votes.filter((v: any) => v.agent_id.includes('reviewer')).length,
      'mediator': votes.filter((v: any) => v.agent_id.includes('mediator')).length,
      'other': votes.length - votes.filter((v: any) => 
        v.agent_id.includes('proposer') || 
        v.agent_id.includes('reviewer') || 
        v.agent_id.includes('mediator')
      ).length
    };
  }
}