import { Injectable } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class ConfigService {
  // Database configuration
  get database() {
    return {
      path: process.env.DATABASE_PATH || join(process.cwd(), 'governance.db'),
      options: {
        // SQLite performance optimizations
        pragma: {
          journal_mode: 'WAL',     // Write-Ahead Logging for better concurrency
          synchronous: 'NORMAL',   // Balance between safety and performance
          cache_size: 10000,       // 10MB cache
          temp_store: 'memory',    // Temporary tables in memory
          mmap_size: 268435456,    // 256MB memory mapping
          foreign_keys: 'ON',      // Enable foreign key constraints
        },
        verbose: process.env.NODE_ENV === 'development',
      },
    };
  }

  // Application configuration
  get app() {
    return {
      port: parseInt(process.env.PORT, 10) || 3000,
      environment: process.env.NODE_ENV || 'development',
      corsOrigin: process.env.CORS_ORIGIN || true,
    };
  }

  // JWT configuration for agent authentication
  get jwt() {
    return {
      secret: process.env.JWT_SECRET || 'hivellm-governance-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    };
  }

  // Governance system configuration
  get governance() {
    return {
      // Phase timeouts (in minutes)
      phaseTimeouts: {
        discussion: parseInt(process.env.DISCUSSION_TIMEOUT, 10) || 45,
        revision: parseInt(process.env.REVISION_TIMEOUT, 10) || 30,
        voting: parseInt(process.env.VOTING_TIMEOUT, 10) || 60,
      },
      
      // Voting thresholds
      votingThresholds: {
        quorum: parseInt(process.env.VOTING_QUORUM, 10) || 3,
        consensus: parseFloat(process.env.CONSENSUS_THRESHOLD) || 0.67, // 67%
        veto: parseFloat(process.env.VETO_THRESHOLD) || 0.5, // 50%
      },
      
      // Agent role configuration
      roles: {
        maxProposalsPerAgent: parseInt(process.env.MAX_PROPOSALS_PER_AGENT, 10) || 5,
        maxDiscussionsPerAgent: parseInt(process.env.MAX_DISCUSSIONS_PER_AGENT, 10) || 10,
        maxVotesPerSession: parseInt(process.env.MAX_VOTES_PER_SESSION, 10) || 1,
      },
    };
  }

  // OpenAI configuration for AI features (optional)
  get openai() {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 500,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
    };
  }

  // WebSocket configuration for real-time features
  get websocket() {
    return {
      cors: {
        origin: process.env.WS_CORS_ORIGIN || '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    };
  }

  // Get configuration by key
  get(key: string): any {
    return process.env[key];
  }

  // Check if feature is enabled
  isFeatureEnabled(feature: string): boolean {
    const value = process.env[`FEATURE_${feature.toUpperCase()}_ENABLED`];
    return value === 'true' || value === '1';
  }
}
