import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  Query,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PhaseManagementService } from '../services/phase-management.service';
import { GovernancePhase, PhaseTransitionEvent } from '../interfaces/phase-management.interface';

class TransitionPhaseDto {
  toPhase: GovernancePhase;
  triggeredBy: string;
  reason?: string;
}

@ApiTags('governance')
@Controller('governance/phases')
export class PhaseManagementController {
  private readonly logger = new Logger(PhaseManagementController.name);

  constructor(private readonly phaseManagementService: PhaseManagementService) {}

  @Post(':proposalId/transition')
  @ApiOperation({ 
    summary: 'Transition proposal to next phase',
    description: 'Manually trigger a phase transition for a proposal'
  })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Phase transition successful',
    type: Object
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid transition or conditions not met' 
  })
  async transitionPhase(
    @Param('proposalId') proposalId: string,
    @Body() transitionDto: TransitionPhaseDto
  ): Promise<PhaseTransitionEvent> {
    this.logger.log(`🔄 Transitioning proposal ${proposalId} to phase ${transitionDto.toPhase}`);
    
    try {
      const result = await this.phaseManagementService.transitionPhase(
        proposalId,
        transitionDto.toPhase,
        transitionDto.triggeredBy,
        transitionDto.reason
      );

      this.logger.log(`✅ Phase transition completed: ${proposalId} -> ${transitionDto.toPhase}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Phase transition failed for ${proposalId}: ${error.message}`);
      throw error;
    }
  }

  @Get(':proposalId/can-transition')
  @ApiOperation({ 
    summary: 'Check if proposal can transition to phase',
    description: 'Validate if a proposal meets the conditions to transition to a specific phase'
  })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiQuery({ name: 'toPhase', enum: GovernancePhase, description: 'Target phase' })
  @ApiResponse({ 
    status: 200, 
    description: 'Transition validation result',
    schema: {
      type: 'object',
      properties: {
        canTransition: { type: 'boolean' },
        reasons: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async canTransition(
    @Param('proposalId') proposalId: string,
    @Query('toPhase') toPhase: GovernancePhase
  ): Promise<{ canTransition: boolean; reasons: string[] }> {
    if (!toPhase || !Object.values(GovernancePhase).includes(toPhase)) {
      throw new BadRequestException('Valid toPhase query parameter is required');
    }

    this.logger.debug(`Checking transition eligibility: ${proposalId} -> ${toPhase}`);
    
    const result = await this.phaseManagementService.canTransition(proposalId, toPhase);
    
    this.logger.debug(`Transition check result: ${JSON.stringify(result)}`);
    return result;
  }

  @Get('configurations')
  @ApiOperation({ 
    summary: 'Get phase configurations',
    description: 'Retrieve all phase configurations and rules'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Phase configurations',
    schema: {
      type: 'object',
      properties: {
        configurations: { type: 'array' },
        transitionRules: { type: 'array' }
      }
    }
  })
  async getConfigurations(): Promise<{
    configurations: any[];
    transitionRules: any[];
  }> {
    const configurations = Object.values(GovernancePhase).map(phase => 
      this.phaseManagementService.getPhaseConfiguration(phase)
    ).filter(Boolean);
    
    const transitionRules = this.phaseManagementService.getTransitionRules();

    return {
      configurations,
      transitionRules
    };
  }

  @Get(':proposalId/status')
  @ApiOperation({ 
    summary: 'Get proposal phase status',
    description: 'Get detailed phase and transition status for a proposal'
  })
  @ApiParam({ name: 'proposalId', description: 'Proposal ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Proposal phase status',
    schema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        currentPhase: { type: 'string' },
        currentStatus: { type: 'string' },
        timeInPhase: { type: 'number' },
        possibleTransitions: { type: 'array' },
        nextAutomaticTransition: { type: 'object' }
      }
    }
  })
  async getProposalPhaseStatus(@Param('proposalId') proposalId: string): Promise<{
    proposalId: string;
    currentPhase: GovernancePhase;
    currentStatus: string;
    timeInPhase: number;
    phaseStartedAt: Date;
    deadline?: Date;
    possibleTransitions: Array<{
      toPhase: GovernancePhase;
      canTransition: boolean;
      reasons: string[];
    }>;
    configuration: any;
  }> {
    this.logger.debug(`Getting phase status for proposal ${proposalId}`);

    // Get current context (we'll need to expose this method or create a public version)
    const context = await (this.phaseManagementService as any).getPhaseContext(proposalId);
    
    // Check all possible transitions
    const allPhases = Object.values(GovernancePhase);
    const possibleTransitions = await Promise.all(
      allPhases.map(async (phase) => {
        if (phase === context.currentPhase) return null;
        
        const canTransition = await this.phaseManagementService.canTransition(proposalId, phase);
        return {
          toPhase: phase,
          ...canTransition
        };
      })
    );

    const configuration = this.phaseManagementService.getPhaseConfiguration(context.currentPhase);

    return {
      proposalId: context.proposalId,
      currentPhase: context.currentPhase,
      currentStatus: context.currentStatus,
      timeInPhase: context.timeInPhase,
      phaseStartedAt: context.phaseStartedAt,
      deadline: context.deadline,
      possibleTransitions: possibleTransitions.filter(Boolean) as any[],
      configuration
    };
  }

  @Post('process-automatic')
  @ApiOperation({ 
    summary: 'Process automatic transitions',
    description: 'Manually trigger processing of automatic phase transitions for all eligible proposals'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Automatic transitions processed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        processedAt: { type: 'string' }
      }
    }
  })
  async processAutomaticTransitions(): Promise<{
    message: string;
    processedAt: Date;
  }> {
    this.logger.log('🔄 Processing automatic transitions...');
    
    await this.phaseManagementService.processAutomaticTransitions();
    
    const result = {
      message: 'Automatic transitions processed successfully',
      processedAt: new Date()
    };

    this.logger.log(`✅ Automatic transitions completed at ${result.processedAt}`);
    return result;
  }
}
