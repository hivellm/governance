import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // Core governance orchestration methods
  // This coordinates the entire governance pipeline

  async getSystemStatus(): Promise<{
    status: string;
    phase: string;
    modules: {
      proposals: string;
      agents: string;
      discussions: string;
      voting: string;
      execution: string;
      analytics: string;
    };
    database: {
      healthy: boolean;
      path: string;
    };
  }> {
    this.logger.log('Getting governance system status');
    
    const databaseHealthy = this.databaseService.isHealthy();
    
    return {
      status: 'operational',
      phase: 'Phase 1 - Core Infrastructure Complete',
      modules: {
        proposals: 'active',
        agents: 'active',
        discussions: 'ready (Phase 2)',
        voting: 'ready (Phase 3)',
        execution: 'ready (Phase 3)',
        analytics: 'ready (Phase 3)',
      },
      database: {
        healthy: databaseHealthy,
        path: 'governance.db (SQLite)',
      },
    };
  }
}
