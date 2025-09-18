import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface MinutesSession {
  id: string; // e.g., '0005'
  title?: string;
  date?: string;
  summary?: string;
  metadata?: any;
}

export interface SessionVoteRecord {
  id: string;
  sessionId: string;
  agentId: string;
  weight?: number;
  decision?: string;
  comment?: string;
  proposalRef?: string;
  castAt?: Date;
}

export interface VotingResult {
  proposalRef: string;
  totalVotes: number;
  totalWeight: number;
  approveCount: number;
  approveWeight: number;
  rejectCount: number;
  rejectWeight: number;
  abstainCount: number;
  abstainWeight: number;
  consensusPercentage: number;
  quorumMet: boolean;
  consensusMet: boolean;
  result: 'approved' | 'rejected' | 'pending';
}

export interface AuditChainEntry {
  id: string;
  type: 'vote' | 'session' | 'result';
  timestamp: Date;
  agentId?: string;
  proposalRef?: string;
  decision?: string;
  weight?: number;
  hash: string;
  previousHash: string;
  data: any;
}

export interface SessionResults {
  sessionId: string;
  session: MinutesSession;
  totalVotes: number;
  totalAgents: number;
  participationRate: number;
  resultsByProposal: VotingResult[];
  auditChain: AuditChainEntry[];
  finalizedAt?: Date;
}

@Injectable()
export class MinutesService {
  private readonly logger = new Logger(MinutesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async listSessions(): Promise<MinutesSession[]> {
    try {
      const db = this.databaseService.getDatabase();
      const rows = db.prepare('SELECT * FROM minutes_sessions ORDER BY id ASC').all();
      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        summary: r.summary,
        metadata: this.safeParse(r.metadata),
      }));
    } catch (error) {
      this.logger.error(`Failed to list sessions: ${error.message}`);
      throw new BadRequestException('Failed to list sessions');
    }
  }

  async upsertSession(session: MinutesSession): Promise<MinutesSession> {
    const db = this.databaseService.getDatabase();
    db.prepare(`
      INSERT INTO minutes_sessions (id, title, date, summary, metadata)
      VALUES (@id, @title, @date, @summary, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        date = excluded.date,
        summary = excluded.summary,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      id: session.id,
      title: session.title || null,
      date: session.date || null,
      summary: session.summary || null,
      metadata: JSON.stringify(session.metadata ?? {}),
    });
    return (await this.getSession(session.id))!;
  }

  async getSession(id: string): Promise<MinutesSession | null> {
    const db = this.databaseService.getDatabase();
    const r = db.prepare('SELECT * FROM minutes_sessions WHERE id = ?').get(id) as any;
    return r ? { id: r.id as string, title: r.title as string, date: r.date as string, summary: r.summary as string, metadata: this.safeParse(r.metadata) } : null;
  }

  async addSessionVote(vote: SessionVoteRecord): Promise<SessionVoteRecord> {
    const db = this.databaseService.getDatabase();
    db.prepare(`
      INSERT INTO session_votes (id, session_id, agent_id, weight, decision, comment, proposal_ref)
      VALUES (@id, @sessionId, @agentId, @weight, @decision, @comment, @proposalRef)
      ON CONFLICT(id) DO UPDATE SET
        weight = excluded.weight,
        decision = excluded.decision,
        comment = excluded.comment,
        proposal_ref = excluded.proposal_ref
    `).run(vote as any);
    return vote;
  }

  async listSessionVotes(sessionId: string): Promise<SessionVoteRecord[]> {
    const db = this.databaseService.getDatabase();
    const rows = db.prepare('SELECT * FROM session_votes WHERE session_id = ? ORDER BY cast_at ASC').all(sessionId);
    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      agentId: r.agent_id,
      weight: r.weight,
      decision: r.decision,
      comment: r.comment,
      proposalRef: r.proposal_ref,
      castAt: r.cast_at ? new Date(r.cast_at) : undefined,
    }));
  }

  /**
   * Get comprehensive session results including voting results and audit chain
   */
  async getSessionResults(sessionId: string): Promise<SessionResults | null> {
    try {
      this.logger.log(`Getting session results for: ${sessionId}`);

      const session = await this.getSession(sessionId);
      if (!session) {
        return null;
      }

      const votes = await this.listSessionVotes(sessionId);

      // Group votes by proposal
      const votesByProposal = new Map<string, SessionVoteRecord[]>();
      votes.forEach(vote => {
        const proposalRef = vote.proposalRef || 'general';
        if (!votesByProposal.has(proposalRef)) {
          votesByProposal.set(proposalRef, []);
        }
        votesByProposal.get(proposalRef)!.push(vote);
      });

      // Calculate results for each proposal
      const resultsByProposal: VotingResult[] = [];
      for (const [proposalRef, proposalVotes] of votesByProposal.entries()) {
        const result = this.calculateVotingResult(proposalRef, proposalVotes);
        resultsByProposal.push(result);
      }

      // Count unique agents (for participation rate)
      const uniqueAgents = new Set(votes.map(v => v.agentId));

      // Generate audit chain
      const auditChain = await this.generateAuditChain(sessionId, votes);

      return {
        sessionId,
        session,
        totalVotes: votes.length,
        totalAgents: uniqueAgents.size,
        participationRate: uniqueAgents.size > 0 ? votes.length / uniqueAgents.size : 0,
        resultsByProposal,
        auditChain,
      };
    } catch (error) {
      this.logger.error(`Failed to get session results for ${sessionId}: ${error.message}`);
      throw new BadRequestException('Failed to get session results');
    }
  }

  /**
   * Get voting results for a specific proposal in a session
   */
  async getProposalResults(sessionId: string, proposalRef: string): Promise<VotingResult | null> {
    try {
      const votes = await this.listSessionVotes(sessionId);
      const proposalVotes = votes.filter(v => v.proposalRef === proposalRef);

      if (proposalVotes.length === 0) {
        return null;
      }

      return this.calculateVotingResult(proposalRef, proposalVotes);
    } catch (error) {
      this.logger.error(`Failed to get proposal results for ${sessionId}/${proposalRef}: ${error.message}`);
      throw new BadRequestException('Failed to get proposal results');
    }
  }

  /**
   * Get audit chain for a session
   */
  async getAuditChain(sessionId: string): Promise<AuditChainEntry[]> {
    try {
      const votes = await this.listSessionVotes(sessionId);
      return await this.generateAuditChain(sessionId, votes);
    } catch (error) {
      this.logger.error(`Failed to get audit chain for ${sessionId}: ${error.message}`);
      throw new BadRequestException('Failed to get audit chain');
    }
  }

  /**
   * Calculate voting result for a proposal
   */
  private calculateVotingResult(proposalRef: string, votes: SessionVoteRecord[]): VotingResult {
    const approveVotes = votes.filter(v => v.decision === 'approve');
    const rejectVotes = votes.filter(v => v.decision === 'reject');
    const abstainVotes = votes.filter(v => v.decision === 'abstain');

    const totalWeight = votes.reduce((sum, vote) => sum + (vote.weight || 0), 0);
    const approveWeight = approveVotes.reduce((sum, vote) => sum + (vote.weight || 0), 0);

    const consensusPercentage = totalWeight > 0 ? (approveWeight / totalWeight) * 100 : 0;

    // Simple quorum and consensus thresholds (can be made configurable)
    const quorumThreshold = 0.5; // 50% participation
    const consensusThreshold = 0.7; // 70% approval

    const quorumMet = votes.length >= Math.ceil(votes.length * quorumThreshold);
    const consensusMet = consensusPercentage >= (consensusThreshold * 100);

    let result: 'approved' | 'rejected' | 'pending' = 'pending';
    if (quorumMet) {
      result = consensusMet ? 'approved' : 'rejected';
    }

    return {
      proposalRef,
      totalVotes: votes.length,
      totalWeight,
      approveCount: approveVotes.length,
      approveWeight,
      rejectCount: rejectVotes.length,
      rejectWeight: rejectVotes.reduce((sum, vote) => sum + (vote.weight || 0), 0),
      abstainCount: abstainVotes.length,
      abstainWeight: abstainVotes.reduce((sum, vote) => sum + (vote.weight || 0), 0),
      consensusPercentage,
      quorumMet,
      consensusMet,
      result,
    };
  }

  /**
   * Generate audit chain for a session
   */
  private async generateAuditChain(sessionId: string, votes: SessionVoteRecord[]): Promise<AuditChainEntry[]> {
    const chain: AuditChainEntry[] = [];
    let previousHash = '0'.repeat(64); // Genesis hash

    // Session creation entry
    const session = await this.getSession(sessionId);
    if (session) {
      const sessionData = JSON.stringify({
        id: session.id,
        title: session.title,
        date: session.date,
        summary: session.summary,
      });
      const sessionHash = this.generateHash(sessionData);

      chain.push({
        id: `session-${sessionId}`,
        type: 'session',
        timestamp: new Date(),
        hash: sessionHash,
        previousHash,
        data: session,
      });

      previousHash = sessionHash;
    }

    // Vote entries in chronological order
    for (const vote of votes) {
      const voteData = JSON.stringify({
        id: vote.id,
        sessionId: vote.sessionId,
        agentId: vote.agentId,
        proposalRef: vote.proposalRef,
        decision: vote.decision,
        weight: vote.weight,
        comment: vote.comment,
        castAt: vote.castAt,
      });

      const voteHash = this.generateHash(voteData + previousHash);

      chain.push({
        id: vote.id,
        type: 'vote',
        timestamp: vote.castAt || new Date(),
        agentId: vote.agentId,
        proposalRef: vote.proposalRef,
        decision: vote.decision,
        weight: vote.weight,
        hash: voteHash,
        previousHash,
        data: vote,
      });

      previousHash = voteHash;
    }

    return chain;
  }

  /**
   * Generate a simple hash for audit chain (in production, use crypto.hash)
   */
  private generateHash(data: string): string {
    // Simple hash function for demonstration (use crypto.createHash in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private safeParse(value: any) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}


