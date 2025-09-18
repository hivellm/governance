import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@Controller('api/governance')
export class GovernanceController {
  private readonly logger = new Logger(GovernanceController.name);

  constructor(private readonly governanceService: GovernanceService) {}

  @Get('status')
  @ApiOperation({ 
    summary: 'Get system status',
    description: 'Returns the overall status of the governance system including all modules and database health.'
  })
  @ApiResponse({
    status: 200,
    description: 'System status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        phase: { type: 'string' },
        modules: {
          type: 'object',
          properties: {
            proposals: { type: 'string' },
            agents: { type: 'string' },
            discussions: { type: 'string' },
            voting: { type: 'string' },
            execution: { type: 'string' },
            analytics: { type: 'string' }
          }
        },
        database: {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            path: { type: 'string' }
          }
        }
      }
    }
  })
  async getSystemStatus() {
    this.logger.log('Getting governance system status');
    return this.governanceService.getSystemStatus();
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Health check endpoint',
    description: 'Simple health check for monitoring and load balancers.'
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number' }
      }
    }
  })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
