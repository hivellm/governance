import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { ConfigService } from '../config/config.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private database: Database.Database;
  private statements: Map<string, Database.Statement> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
    await this.initializeSchema();
    this.prepareStatements();
    this.logger.log('✅ Database initialized successfully');
  }

  async onModuleDestroy() {
    if (this.database) {
      this.database.close();
      this.logger.log('📁 Database connection closed');
    }
  }

  private async connect() {
    const dbConfig = this.configService.database;
    
    this.database = new Database(dbConfig.path, {
      verbose: dbConfig.options.verbose ? this.logger.debug.bind(this.logger) : null,
    });

    // Apply SQLite optimizations
    const pragmas = dbConfig.options.pragma;
    Object.entries(pragmas).forEach(([key, value]) => {
      this.database.pragma(`${key} = ${value}`);
      this.logger.debug(`Applied pragma: ${key} = ${value}`);
    });

    this.logger.log(`📁 Connected to SQLite database: ${dbConfig.path}`);
  }

  private async initializeSchema() {
    const schemaPath = join(__dirname, 'schema.sql');
    
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf-8');
      this.database.exec(schema);
      this.logger.log('📋 Database schema initialized');
    } else {
      this.logger.warn('⚠️ Schema file not found, creating basic tables...');
      await this.createBasicTables();
    }
  }

  private createBasicTables() {
    const basicSchema = `
      -- Basic tables for BIP-06 governance system
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'discussion', 'revision', 'voting', 'approved', 'rejected', 'executed')),
        phase TEXT NOT NULL CHECK (phase IN ('proposal', 'discussion', 'revision', 'voting', 'resolution', 'execution')),
        type TEXT NOT NULL CHECK (type IN ('standards', 'informational', 'process')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        voting_deadline DATETIME,
        execution_data TEXT
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        organization TEXT,
        roles TEXT NOT NULL DEFAULT '[]', -- JSON array
        permissions TEXT DEFAULT '{}', -- JSON object
        performance_metrics TEXT DEFAULT '{}', -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS discussions (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'archived')),
        participants TEXT DEFAULT '[]', -- JSON array of agent IDs
        summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        timeout_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES agents(id),
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('comment', 'suggestion', 'objection', 'support')),
        parent_id TEXT REFERENCES comments(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reactions TEXT DEFAULT '{}' -- JSON object
      );

      CREATE TABLE IF NOT EXISTS votes (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain')),
        justification TEXT,
        weight REAL DEFAULT 1.0,
        cast_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(proposal_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS execution_logs (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL REFERENCES proposals(id),
        executor_id TEXT REFERENCES agents(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
        actions TEXT NOT NULL, -- JSON array of actions
        results TEXT, -- JSON object of results
        error_message TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
      CREATE INDEX IF NOT EXISTS idx_proposals_phase ON proposals(phase);
      CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals(author_id);
      CREATE INDEX IF NOT EXISTS idx_discussions_proposal ON discussions(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_comments_discussion ON comments(discussion_id);
      CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_votes_agent ON votes(agent_id);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_proposal ON execution_logs(proposal_id);

      -- Full-text search for proposals and discussions
      CREATE VIRTUAL TABLE IF NOT EXISTS proposals_fts USING fts5(id, title, content);
      CREATE VIRTUAL TABLE IF NOT EXISTS discussions_fts USING fts5(id, summary);
      CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(id, content);

      -- Triggers to keep FTS tables in sync
      CREATE TRIGGER IF NOT EXISTS proposals_fts_insert AFTER INSERT ON proposals BEGIN
        INSERT INTO proposals_fts(id, title, content) VALUES (new.id, new.title, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS proposals_fts_update AFTER UPDATE ON proposals BEGIN
        UPDATE proposals_fts SET title = new.title, content = new.content WHERE id = new.id;
      END;

      CREATE TRIGGER IF NOT EXISTS proposals_fts_delete AFTER DELETE ON proposals BEGIN
        DELETE FROM proposals_fts WHERE id = old.id;
      END;
    `;

    this.database.exec(basicSchema);
    this.logger.log('📋 Basic tables created successfully');
  }

  private prepareStatements() {
    // Prepared statements for better performance
    const statements = {
      // Proposals
      insertProposal: `
        INSERT INTO proposals (id, title, author_id, status, phase, type, content, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      getProposal: 'SELECT * FROM proposals WHERE id = ?',
      updateProposalStatus: 'UPDATE proposals SET status = ?, phase = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      listProposals: 'SELECT * FROM proposals ORDER BY created_at DESC LIMIT ? OFFSET ?',

      // Discussions
      insertDiscussion: `
        INSERT INTO discussions (id, proposal_id, status, participants, timeout_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      getDiscussion: 'SELECT * FROM discussions WHERE id = ?',
      updateDiscussionSummary: 'UPDATE discussions SET summary = ? WHERE id = ?',

      // Comments
      insertComment: `
        INSERT INTO comments (id, discussion_id, author_id, content, type, parent_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      getCommentsByDiscussion: 'SELECT * FROM comments WHERE discussion_id = ? ORDER BY created_at ASC',

      // Votes
      insertVote: `
        INSERT OR REPLACE INTO votes (id, proposal_id, agent_id, decision, justification, weight)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      getVotesByProposal: 'SELECT * FROM votes WHERE proposal_id = ?',
      getVoteByAgent: 'SELECT * FROM votes WHERE proposal_id = ? AND agent_id = ?',

      // Agents
      insertAgent: `
        INSERT OR REPLACE INTO agents (id, name, organization, roles, permissions)
        VALUES (?, ?, ?, ?, ?)
      `,
      getAgent: 'SELECT * FROM agents WHERE id = ?',
      updateAgentActivity: 'UPDATE agents SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
    };

    // Prepare all statements
    Object.entries(statements).forEach(([key, sql]) => {
      try {
        this.statements.set(key, this.database.prepare(sql));
      } catch (error) {
        this.logger.error(`Failed to prepare statement ${key}: ${error.message}`);
      }
    });

    this.logger.log(`📋 Prepared ${this.statements.size} database statements`);
  }

  // Public methods to access prepared statements
  getStatement(name: string): Database.Statement {
    const statement = this.statements.get(name);
    if (!statement) {
      throw new Error(`Statement '${name}' not found`);
    }
    return statement;
  }

  // Execute raw SQL (use with caution)
  exec(sql: string): void {
    return this.database.exec(sql);
  }

  // Run a transaction
  transaction<T>(fn: () => T): T {
    return this.database.transaction(fn)();
  }

  // Get database instance (for advanced usage)
  getDatabase(): Database.Database {
    return this.database;
  }

  // Health check
  isHealthy(): boolean {
    try {
      this.database.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}
