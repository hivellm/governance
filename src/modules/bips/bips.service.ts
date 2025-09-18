import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface BipRecord {
  id: string;
  title: string;
  status?: string;
  content?: any;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class BipsService {
  private readonly logger = new Logger(BipsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async list(): Promise<BipRecord[]> {
    try {
      const db = this.databaseService.getDatabase();
      const rows = db.prepare('SELECT * FROM bips ORDER BY id ASC').all();
      return rows.map((row: any) => this.mapRow(row));
    } catch (error) {
      this.logger.error(`Failed to list BIPs: ${error.message}`);
      throw new BadRequestException('Failed to list BIPs');
    }
  }

  async get(id: string): Promise<BipRecord | null> {
    try {
      const db = this.databaseService.getDatabase();
      const row = db.prepare('SELECT * FROM bips WHERE id = ?').get(id);
      return row ? this.mapRow(row) : null;
    } catch (error) {
      this.logger.error(`Failed to get BIP ${id}: ${error.message}`);
      throw new BadRequestException('Failed to get BIP');
    }
  }

  async upsert(bip: BipRecord): Promise<BipRecord> {
    const db = this.databaseService.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO bips (id, title, status, content, metadata)
      VALUES (@id, @title, @status, @content, @metadata)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        content = excluded.content,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);
    const payload = {
      id: bip.id,
      title: bip.title,
      status: bip.status || null,
      content: JSON.stringify(bip.content ?? null),
      metadata: JSON.stringify(bip.metadata ?? {}),
    };
    stmt.run(payload);
    return this.get(bip.id) as Promise<BipRecord>;
  }

  private mapRow(row: any): BipRecord {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      content: this.safeParse(row.content),
      metadata: this.safeParse(row.metadata),
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  private safeParse(value: any) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}


