import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';

@ApiTags('discussions')
@Controller('api/discussions')
export class DiscussionsController {
  private readonly logger = new Logger(DiscussionsController.name);

  constructor(private readonly discussionsService: DiscussionsService) {}

  @Get('status')
  @ApiOperation({ 
    summary: 'Get discussions module status',
    description: 'Returns the current status of the discussions module (Phase 2 implementation)'
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
    this.logger.log('Getting discussions module status');
    
    return {
      status: 'ready',
      phase: 'Phase 2 - Discussion Framework',
      message: await this.discussionsService.placeholder()
    };
  }
}
