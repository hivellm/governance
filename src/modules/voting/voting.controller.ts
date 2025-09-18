import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  HttpStatus, 
  Logger,
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
  ApiBearerAuth,
  ApiBody
} from '@nestjs/swagger';
import { VotingService } from './voting.service';
import { 
  VoteDecision, 
  VotingSession, 
  VoteCast, 
  VotingResults,
  AutomatedVotingConfig 
} from './interfaces/voting.interface';

// DTOs for API documentation
class InitiateVotingDto {
  proposalId: string;
  config?: Partial<AutomatedVotingConfig>;
}

class CastVoteDto {
  agentId: string;
  decision: VoteDecision;
  justification?: string;
}

class VotingSessionResponse {
  id: string;
  proposalId: string;
  status: string;
  startedAt: string;
  deadline: string;
  totalEligible: number;
  totalVotes: number;
  config: any;
}

@ApiTags('voting')
@Controller('api/voting')
@ApiBearerAuth()
export class VotingController {
  private readonly logger = new Logger(VotingController.name);

  constructor(private readonly votingService: VotingService) {}

  @Post('initiate')
  @ApiOperation({ 
    summary: 'Initiate automated voting session',
    description: 'BIP-06 Core Feature: Automatically initiates a voting session for a proposal with intelligent configuration based on proposal type and complexity.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string', description: 'ID of proposal to vote on' },
        config: {
          type: 'object',
          description: 'Optional voting configuration override',
          properties: {
            duration: { type: 'number', description: 'Voting duration in hours' },
            quorumThreshold: { type: 'number', description: 'Required participation rate (0-1)' },
            consensusThreshold: { type: 'number', description: 'Required approval rate (0-1)' },
            autoFinalize: { type: 'boolean', description: 'Auto-finalize when conditions met' },
            allowedRoles: { type: 'array', items: { type: 'string' }, description: 'Roles allowed to vote' }
          }
        }
      },
      required: ['proposalId']
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Voting session initiated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        proposalId: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        deadline: { type: 'string', format: 'date-time' },
        totalEligible: { type: 'number' },
        config: { type: 'object' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid proposal state or configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async initiateVoting(@Body() body: InitiateVotingDto): Promise<VotingSessionResponse> {
    this.logger.log(`🗳️ Initiating automated voting for proposal: ${body.proposalId}`);
    
    const session = await this.votingService.initiateAutomatedVoting(
      body.proposalId, 
      body.config as AutomatedVotingConfig
    );

    return {
      id: session.id,
      proposalId: session.proposalId,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      deadline: session.deadline.toISOString(),
      totalEligible: session.eligibleAgents.length,
      totalVotes: session.votes.length,
      config: session.config,
    };
  }

  @Post(':sessionId/vote')
  @ApiOperation({ 
    summary: 'Cast a vote in an active session',
    description: 'Cast a weighted vote with justification. Vote weight is automatically calculated based on agent performance and role.'
  })
  @ApiParam({ name: 'sessionId', description: 'Voting session ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the voting agent' },
        decision: { 
          type: 'string', 
          enum: ['approve', 'reject', 'abstain'],
          description: 'Vote decision' 
        },
        justification: { 
          type: 'string', 
          description: 'Optional justification for the vote' 
        }
      },
      required: ['agentId', 'decision']
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Vote cast successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        agentId: { type: 'string' },
        decision: { type: 'string' },
        weight: { type: 'number' },
        castAt: { type: 'string', format: 'date-time' },
        justification: { type: 'string' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid vote (already voted, session closed, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Voting session or agent not found',
  })
  async castVote(
    @Param('sessionId') sessionId: string,
    @Body() body: CastVoteDto
  ): Promise<VoteCast> {
    this.logger.log(`🗳️ Casting vote: ${body.agentId} -> ${body.decision} on ${sessionId}`);

    const vote = await this.votingService.castVote(
      sessionId,
      body.agentId,
      body.decision,
      body.justification
    );

    return vote;
  }

  @Get(':sessionId/results')
  @ApiOperation({ 
    summary: 'Get real-time voting results',
    description: 'Retrieves current voting results including participation rate, consensus percentage, and weighted vote counts.'
  })
  @ApiParam({ name: 'sessionId', description: 'Voting session ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        proposalId: { type: 'string' },
        status: { type: 'string' },
        totalEligible: { type: 'number' },
        totalVotes: { type: 'number' },
        participationRate: { type: 'number' },
        quorumMet: { type: 'boolean' },
        votes: {
          type: 'object',
          properties: {
            approve: { type: 'object', properties: { count: { type: 'number' }, weight: { type: 'number' } } },
            reject: { type: 'object', properties: { count: { type: 'number' }, weight: { type: 'number' } } },
            abstain: { type: 'object', properties: { count: { type: 'number' }, weight: { type: 'number' } } }
          }
        },
        consensus: {
          type: 'object',
          properties: {
            percentage: { type: 'number' },
            threshold: { type: 'number' },
            met: { type: 'boolean' }
          }
        },
        result: { type: 'string', enum: ['approved', 'rejected', 'pending'] },
        deadline: { type: 'string', format: 'date-time' },
        timeRemaining: { type: 'number' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Voting session not found',
  })
  async getVotingResults(@Param('sessionId') sessionId: string): Promise<VotingResults> {
    this.logger.log(`📊 Getting voting results for session: ${sessionId}`);
    
    return this.votingService.getVotingResults(sessionId);
  }

  @Post(':sessionId/finalize')
  @ApiOperation({ 
    summary: 'Manually finalize voting session',
    description: 'Manually finalizes an active voting session and updates the proposal status. Usually handled automatically.'
  })
  @ApiParam({ name: 'sessionId', description: 'Voting session ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting session finalized successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Session cannot be finalized (already finalized, insufficient votes, etc.)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Voting session not found',
  })
  async finalizeVoting(@Param('sessionId') sessionId: string): Promise<VotingResults> {
    this.logger.log(`🏁 Manually finalizing voting session: ${sessionId}`);
    
    return this.votingService.finalizeVoting(sessionId);
  }

  @Get('sessions')
  @ApiOperation({ 
    summary: 'List voting sessions',
    description: 'Lists voting sessions with optional filtering by status, proposal, or time range.'
  })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'finalized', 'cancelled'] })
  @ApiQuery({ name: 'proposalId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting sessions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              proposalId: { type: 'string' },
              status: { type: 'string' },
              startedAt: { type: 'string', format: 'date-time' },
              deadline: { type: 'string', format: 'date-time' },
              totalEligible: { type: 'number' },
              totalVotes: { type: 'number' },
              participationRate: { type: 'number' }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  })
  async listVotingSessions(
    @Query('status') status?: string,
    @Query('proposalId') proposalId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ): Promise<any> {
    this.logger.log(`📋 Listing voting sessions (status: ${status}, proposal: ${proposalId})`);
    
    // Mock implementation for now
    return {
      items: [],
      total: 0,
      page,
      limit
    };
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Get voting system status',
    description: 'Returns overall voting system status and statistics.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting system status retrieved successfully',
  })
  async getVotingSystemStatus(): Promise<any> {
    this.logger.log('📊 Getting voting system status');
    
    return {
      status: 'active',
      version: '1.0.0-bip06',
      features: {
        automatedVoting: true,
        weightedVotes: true,
        realTimeResults: true,
        autoFinalization: true,
      },
      activeSessions: 0,
      completedSessions: 0,
      uptime: Math.floor(process.uptime()),
      message: 'BIP-06 Automated Voting System is operational'
    };
  }
}