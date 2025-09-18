import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExecutionService } from './execution.service';

@ApiTags('execution')
@Controller('api/execution')
export class ExecutionController {
  private readonly logger = new Logger(ExecutionController.name);

  constructor(private readonly executionService: ExecutionService) {}

  @Get('status')
  @ApiOperation({ 
    summary: 'Get execution module status',
    description: 'Returns the current status of the execution module (Phase 3 implementation)'
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        phase: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  async getStatus() {
    this.logger.log('Getting execution module status');
    
    return {
      status: 'ready',
      phase: 'Phase 3 - Advanced Features',
      message: await this.executionService.placeholder()
    };
  }
}
