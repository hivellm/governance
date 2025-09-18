import { Controller, Get, Post, Param, Body, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MinutesService, MinutesSession, SessionVoteRecord } from './minutes.service';

class UpsertSessionDto {
  id: string;
  title?: string;
  date?: string;
  summary?: string;
  metadata?: any;
}

class AddVoteDto {
  id: string;
  agentId: string;
  weight?: number;
  decision?: string;
  comment?: string;
  proposalRef?: string;
}

@ApiTags('minutes')
@Controller('api/minutes')
export class MinutesController {
  private readonly logger = new Logger(MinutesController.name);

  constructor(private readonly minutesService: MinutesService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List minutes sessions' })
  @ApiResponse({ status: HttpStatus.OK })
  async listSessions(): Promise<MinutesSession[]> {
    return this.minutesService.listSessions();
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create or update a minutes session' })
  @ApiBody({ type: UpsertSessionDto })
  @ApiResponse({ status: HttpStatus.CREATED })
  async upsertSession(@Body() dto: UpsertSessionDto): Promise<MinutesSession> {
    this.logger.log(`Upserting minutes session ${dto.id}`);
    return this.minutesService.upsertSession(dto);
  }

  @Get('sessions/:id/votes')
  @ApiOperation({ summary: 'List votes for a session' })
  @ApiResponse({ status: HttpStatus.OK })
  async listVotes(@Param('id') id: string): Promise<SessionVoteRecord[]> {
    return this.minutesService.listSessionVotes(id);
  }

  @Post('sessions/:id/votes')
  @ApiOperation({ summary: 'Add or update a vote for a session' })
  @ApiBody({ type: AddVoteDto })
  @ApiResponse({ status: HttpStatus.CREATED })
  async addVote(@Param('id') id: string, @Body() dto: AddVoteDto): Promise<SessionVoteRecord> {
    return this.minutesService.addSessionVote({
      id: dto.id,
      sessionId: id,
      agentId: dto.agentId,
      weight: dto.weight,
      decision: dto.decision,
      comment: dto.comment,
      proposalRef: dto.proposalRef,
    });
  }
}


