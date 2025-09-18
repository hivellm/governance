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
    const rows = db.prepare('SELECT * FROM session_votes WHERE session_id = ?').all(sessionId);
    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.session_id,
      agentId: r.agent_id,
      weight: r.weight,
      decision: r.decision,
      comment: r.comment,
      proposalRef: r.proposal_ref,
    }));
  }

  private safeParse(value: any) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}


