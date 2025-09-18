import { Controller, Get, Post, Param, Body, HttpStatus, Logger, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNumber } from 'class-validator';
import { MinutesService, MinutesSession, SessionVoteRecord, SessionResults, VotingResult, AuditChainEntry } from './minutes.service';
import type { Response } from 'express';

class UpsertSessionDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

class AddVoteDto {
  @IsString()
  id: string;

  @IsString()
  agentId: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  decision?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
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
  async listSessions(@Res() res: Response) {
    const data = await this.minutesService.listSessions();
    res.status(HttpStatus.OK).json(data);
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
  async listVotes(@Param('id') id: string, @Res() res: Response) {
    const data = await this.minutesService.listSessionVotes(id);
    res.status(HttpStatus.OK).json(data);
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

  @Get('sessions/:id/results')
  @ApiOperation({ summary: 'Get comprehensive session results including voting results and audit chain' })
  @ApiResponse({ status: HttpStatus.OK, type: Object })
  async getSessionResults(@Param('id') id: string, @Res() res: Response) {
    const data = await this.minutesService.getSessionResults(id);
    if (!data) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'Session not found' });
      return;
    }
    res.status(HttpStatus.OK).json(data);
  }

  @Get('sessions/:sessionId/proposals/:proposalRef/results')
  @ApiOperation({ summary: 'Get voting results for a specific proposal in a session' })
  @ApiResponse({ status: HttpStatus.OK, type: Object })
  async getProposalResults(
    @Param('sessionId') sessionId: string,
    @Param('proposalRef') proposalRef: string,
    @Res() res: Response
  ) {
    const data = await this.minutesService.getProposalResults(sessionId, proposalRef);
    if (!data) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'Proposal results not found' });
      return;
    }
    res.status(HttpStatus.OK).json(data);
  }

  @Get('sessions/:id/audit-chain')
  @ApiOperation({ summary: 'Get audit chain for a session' })
  @ApiResponse({ status: HttpStatus.OK, type: [Object] })
  async getAuditChain(@Param('id') id: string, @Res() res: Response) {
    const data = await this.minutesService.getAuditChain(id);
    res.status(HttpStatus.OK).json(data);
  }

  @Get('sessions/:id/results/summary')
  @ApiOperation({ summary: 'Get a summary of session results' })
  @ApiResponse({ status: HttpStatus.OK, type: Object })
  async getSessionResultsSummary(@Param('id') id: string, @Res() res: Response) {
    const fullResults = await this.minutesService.getSessionResults(id);
    if (!fullResults) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'Session not found' });
      return;
    }

    const summary = {
      sessionId: fullResults.sessionId,
      sessionTitle: fullResults.session.title,
      totalVotes: fullResults.totalVotes,
      totalAgents: fullResults.totalAgents,
      participationRate: Math.round(fullResults.participationRate * 100) / 100,
      proposalsCount: fullResults.resultsByProposal.length,
      proposals: fullResults.resultsByProposal.map(result => ({
        proposalRef: result.proposalRef,
        totalVotes: result.totalVotes,
        consensusPercentage: Math.round(result.consensusPercentage * 100) / 100,
        result: result.result,
        quorumMet: result.quorumMet,
        consensusMet: result.consensusMet,
      })),
      auditChainLength: fullResults.auditChain.length,
      lastUpdated: new Date(),
    };

    res.status(HttpStatus.OK).json(summary);
  }
}


