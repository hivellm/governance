import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface TeamRecord {
  id: string;
  name: string;
  members: string[]; // agent IDs or names
  metadata?: any;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async list(): Promise<TeamRecord[]> {
    try {
      const db = this.databaseService.getDatabase();
      const rows = db.prepare('SELECT * FROM teams ORDER BY name ASC').all();
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        members: this.safeParse(r.members) || [],
        metadata: this.safeParse(r.metadata) || {},
      }));
    } catch (error) {
      this.logger.error(`Failed to list teams: ${error.message}`);
      throw new BadRequestException('Failed to list teams');
    }
  }

  async upsert(team: TeamRecord): Promise<TeamRecord> {
    const db = this.databaseService.getDatabase();
    db.prepare(`
      INSERT INTO teams (id, name, members, metadata)
      VALUES (@id, @name, @members, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        members = excluded.members,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `).run({
      id: team.id,
      name: team.name,
      members: JSON.stringify(team.members || []),
      metadata: JSON.stringify(team.metadata || {}),
    });
    return (await this.get(team.id))!;
  }

  async get(id: string): Promise<TeamRecord | null> {
    const db = this.databaseService.getDatabase();
    const r = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as any;
    return r ? { id: r.id as string, name: r.name as string, members: this.safeParse(r.members) || [], metadata: this.safeParse(r.metadata) || {} } : null;
  }

  private safeParse(value: any) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}


