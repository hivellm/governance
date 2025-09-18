import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../../../database/database.service';
import {
  GovernancePhase,
  ProposalStatus,
  PhaseTransitionRule,
  PhaseCondition,
  PhaseContext,
  PhaseTransitionEvent,
  PhaseConfiguration,
  PhaseManagerOptions
} from '../interfaces/phase-management.interface';

@Injectable()
export class PhaseManagementService {
  private readonly logger = new Logger(PhaseManagementService.name);
  private transitionRules: PhaseTransitionRule[] = [];
  private phaseConfigurations: Map<GovernancePhase, PhaseConfiguration> = new Map();
  private options: PhaseManagerOptions;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeDefaultConfiguration();
  }

  private initializeDefaultConfiguration() {
    // Default phase configurations
    const defaultConfigurations: PhaseConfiguration[] = [
      {
        phase: GovernancePhase.PROPOSAL,
        defaultDuration: 24 * 60 * 60 * 1000, // 24 hours
        requiresManualProgression: false,
        allowedExtensions: 2,
        extensionDuration: 12 * 60 * 60 * 1000, // 12 hours
        participationRequirements: {
          minParticipants: 1,
          requiredRoles: ['proposer']
        }
      },
      {
        phase: GovernancePhase.DISCUSSION,
        defaultDuration: 48 * 60 * 60 * 1000, // 48 hours
        requiresManualProgression: false,
        allowedExtensions: 3,
        extensionDuration: 24 * 60 * 60 * 1000, // 24 hours
        participationRequirements: {
          minParticipants: 3,
          consensusThreshold: 0.6
        }
      },
      {
        phase: GovernancePhase.REVISION,
        defaultDuration: 24 * 60 * 60 * 1000, // 24 hours
        requiresManualProgression: true,
        allowedExtensions: 2,
        extensionDuration: 12 * 60 * 60 * 1000
      },
      {
        phase: GovernancePhase.VOTING,
        defaultDuration: 72 * 60 * 60 * 1000, // 72 hours
        requiresManualProgression: false,
        allowedExtensions: 1,
        extensionDuration: 24 * 60 * 60 * 1000,
        participationRequirements: {
          minParticipants: 5,
          consensusThreshold: 0.67,
          requiredRoles: ['voter']
        }
      },
      {
        phase: GovernancePhase.RESOLUTION,
        defaultDuration: 12 * 60 * 60 * 1000, // 12 hours
        requiresManualProgression: false,
        allowedExtensions: 0,
        extensionDuration: 0
      },
      {
        phase: GovernancePhase.EXECUTION,
        defaultDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        requiresManualProgression: true,
        allowedExtensions: 5,
        extensionDuration: 24 * 60 * 60 * 1000
      }
    ];

    defaultConfigurations.forEach(config => {
      this.phaseConfigurations.set(config.phase, config);
    });

    // Default transition rules
    this.transitionRules = [
      {
        from: GovernancePhase.PROPOSAL,
        to: GovernancePhase.DISCUSSION,
        requiredConditions: [
          {
            type: 'manual',
            description: 'Proposal submitted and validated',
            validator: async (context) => {
              return context.proposal && context.proposal.status === ProposalStatus.DRAFT;
            }
          }
        ],
        automaticTransition: false,
        allowedRoles: ['proposer', 'mediator']
      },
      {
        from: GovernancePhase.DISCUSSION,
        to: GovernancePhase.REVISION,
        requiredConditions: [
          {
            type: 'participation',
            description: 'Sufficient discussion participation',
            validator: async (context) => {
              const config = this.phaseConfigurations.get(GovernancePhase.DISCUSSION);
              return context.participants.length >= (config?.participationRequirements?.minParticipants || 3);
            }
          },
          {
            type: 'time',
            description: 'Minimum discussion time met',
            validator: async (context) => {
              const minTime = 12 * 60 * 60 * 1000; // 12 hours minimum
              return context.timeInPhase >= minTime;
            }
          }
        ],
        automaticTransition: true,
        timeoutDuration: 48 * 60 * 60 * 1000
      },
      {
        from: GovernancePhase.REVISION,
        to: GovernancePhase.VOTING,
        requiredConditions: [
          {
            type: 'manual',
            description: 'Revisions completed and approved',
            validator: async (context) => {
              return context.proposal.status === ProposalStatus.REVISION;
            }
          }
        ],
        automaticTransition: false,
        allowedRoles: ['proposer', 'mediator']
      },
      {
        from: GovernancePhase.VOTING,
        to: GovernancePhase.RESOLUTION,
        requiredConditions: [
          {
            type: 'consensus',
            description: 'Voting period completed',
            validator: async (context) => {
              const config = this.phaseConfigurations.get(GovernancePhase.VOTING);
              const hasEnoughVotes = context.votes && context.votes.length >= (config?.participationRequirements?.minParticipants || 5);
              const votingPeriodEnded = context.timeInPhase >= (config?.defaultDuration || 72 * 60 * 60 * 1000);
              return hasEnoughVotes && votingPeriodEnded;
            }
          }
        ],
        automaticTransition: true,
        timeoutDuration: 72 * 60 * 60 * 1000
      },
      {
        from: GovernancePhase.RESOLUTION,
        to: GovernancePhase.EXECUTION,
        requiredConditions: [
          {
            type: 'consensus',
            description: 'Proposal approved by voting',
            validator: async (context) => {
              return context.proposal.status === ProposalStatus.APPROVED;
            }
          }
        ],
        automaticTransition: true,
        timeoutDuration: 12 * 60 * 60 * 1000
      }
    ];

    this.options = {
      enableAutomaticTransitions: true,
      defaultPhaseDurations: {
        [GovernancePhase.PROPOSAL]: 24 * 60 * 60 * 1000,
        [GovernancePhase.DISCUSSION]: 48 * 60 * 60 * 1000,
        [GovernancePhase.REVISION]: 24 * 60 * 60 * 1000,
        [GovernancePhase.VOTING]: 72 * 60 * 60 * 1000,
        [GovernancePhase.RESOLUTION]: 12 * 60 * 60 * 1000,
        [GovernancePhase.EXECUTION]: 7 * 24 * 60 * 60 * 1000
      },
      transitionRules: this.transitionRules,
      phaseConfigurations: Array.from(this.phaseConfigurations.values()),
      notificationEnabled: true,
      auditEnabled: true
    };
  }

  /**
   * Transition a proposal to the next phase
   */
  async transitionPhase(
    proposalId: string,
    toPhase: GovernancePhase,
    triggeredBy: string,
    reason?: string
  ): Promise<PhaseTransitionEvent> {
    this.logger.debug(`Attempting to transition proposal ${proposalId} to phase ${toPhase}`);

    // Get current proposal context
    const context = await this.getPhaseContext(proposalId);
    
    // Find applicable transition rule
    const rule = this.transitionRules.find(r => 
      r.from === context.currentPhase && r.to === toPhase
    );

    if (!rule) {
      throw new BadRequestException(
        `No transition rule found from ${context.currentPhase} to ${toPhase}`
      );
    }

    // Validate conditions
    const conditionResults = await Promise.all(
      rule.requiredConditions.map(async condition => {
        try {
          const result = await condition.validator(context);
          this.logger.debug(`Condition "${condition.description}": ${result}`);
          return result;
        } catch (error) {
          this.logger.error(`Error validating condition "${condition.description}": ${error.message}`);
          return false;
        }
      })
    );

    const allConditionsMet = conditionResults.every(result => result === true);
    
    if (!allConditionsMet) {
      const failedConditions = rule.requiredConditions
        .filter((_, index) => !conditionResults[index])
        .map(c => c.description);
      
      throw new BadRequestException(
        `Transition conditions not met: ${failedConditions.join(', ')}`
      );
    }

    // Execute transition
    const transitionEvent = await this.executeTransition(
      proposalId,
      context.currentPhase,
      toPhase,
      context.currentStatus,
      this.getStatusForPhase(toPhase),
      triggeredBy,
      reason || `Automatic transition from ${context.currentPhase} to ${toPhase}`
    );

    this.logger.log(`✅ Proposal ${proposalId} transitioned from ${context.currentPhase} to ${toPhase}`);
    return transitionEvent;
  }

  /**
   * Check if a proposal can transition to a specific phase
   */
  async canTransition(proposalId: string, toPhase: GovernancePhase): Promise<{
    canTransition: boolean;
    reasons: string[];
  }> {
    const context = await this.getPhaseContext(proposalId);
    
    const rule = this.transitionRules.find(r => 
      r.from === context.currentPhase && r.to === toPhase
    );

    if (!rule) {
      return {
        canTransition: false,
        reasons: [`No transition rule from ${context.currentPhase} to ${toPhase}`]
      };
    }

    const conditionResults = await Promise.all(
      rule.requiredConditions.map(async condition => {
        try {
          return await condition.validator(context);
        } catch (error) {
          this.logger.error(`Error checking condition "${condition.description}": ${error.message}`);
          return false;
        }
      })
    );

    const failedConditions = rule.requiredConditions
      .filter((_, index) => !conditionResults[index])
      .map(c => c.description);

    return {
      canTransition: failedConditions.length === 0,
      reasons: failedConditions
    };
  }

  /**
   * Get the current phase context for a proposal
   */
  private async getPhaseContext(proposalId: string): Promise<PhaseContext> {
    const db = this.databaseService.getDatabase();
    
    // Get proposal
    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(proposalId) as any;
    if (!proposal) {
      throw new BadRequestException(`Proposal ${proposalId} not found`);
    }

    // Get discussions
    const discussions = db.prepare(
      'SELECT * FROM discussions WHERE proposal_id = ?'
    ).all(proposalId);

    // Get votes
    const votes = db.prepare(
      'SELECT * FROM votes WHERE proposal_id = ?'
    ).all(proposalId);

    // Get participants (from discussions and votes)
    const participantIds = new Set([
      proposal.author_id,
      ...discussions.flatMap((d: any) => JSON.parse(d.participants || '[]')),
      ...votes.map((v: any) => v.agent_id)
    ]);

    const phaseStartedAt = new Date(proposal.updated_at);
    const now = new Date();
    const timeInPhase = now.getTime() - phaseStartedAt.getTime();

    return {
      proposalId: proposal.id,
      currentPhase: proposal.phase as GovernancePhase,
      currentStatus: proposal.status as ProposalStatus,
      proposal,
      participants: Array.from(participantIds),
      votes,
      discussions,
      timeInPhase,
      phaseStartedAt,
      deadline: proposal.voting_deadline ? new Date(proposal.voting_deadline) : undefined,
      metadata: JSON.parse(proposal.metadata || '{}')
    };
  }

  /**
   * Execute the actual phase transition
   */
  private async executeTransition(
    proposalId: string,
    fromPhase: GovernancePhase,
    toPhase: GovernancePhase,
    fromStatus: ProposalStatus,
    toStatus: ProposalStatus,
    triggeredBy: string,
    reason: string
  ): Promise<PhaseTransitionEvent> {
    const db = this.databaseService.getDatabase();
    const now = new Date();

    // Update proposal phase and status
    db.prepare(`
      UPDATE proposals 
      SET phase = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(toPhase, toStatus, now.toISOString(), proposalId);

    // Set deadline for new phase if applicable
    const config = this.phaseConfigurations.get(toPhase);
    if (config && config.defaultDuration > 0) {
      const deadline = new Date(now.getTime() + config.defaultDuration);
      db.prepare(`
        UPDATE proposals 
        SET voting_deadline = ?
        WHERE id = ?
      `).run(deadline.toISOString(), proposalId);
    }

    // Create transition event
    const transitionEvent: PhaseTransitionEvent = {
      proposalId,
      fromPhase,
      toPhase,
      fromStatus,
      toStatus,
      triggeredBy,
      triggeredAt: now,
      reason
    };

    // Emit event for other services
    if (this.options.notificationEnabled) {
      this.eventEmitter.emit('phase.transitioned', transitionEvent);
    }

    // Log audit trail
    if (this.options.auditEnabled) {
      this.logger.log(`Phase transition: ${proposalId} ${fromPhase}->${toPhase} by ${triggeredBy}: ${reason}`);
    }

    return transitionEvent;
  }

  /**
   * Get appropriate status for a phase
   */
  private getStatusForPhase(phase: GovernancePhase): ProposalStatus {
    const phaseStatusMap: Record<GovernancePhase, ProposalStatus> = {
      [GovernancePhase.PROPOSAL]: ProposalStatus.DRAFT,
      [GovernancePhase.DISCUSSION]: ProposalStatus.DISCUSSION,
      [GovernancePhase.REVISION]: ProposalStatus.REVISION,
      [GovernancePhase.VOTING]: ProposalStatus.VOTING,
      [GovernancePhase.RESOLUTION]: ProposalStatus.APPROVED, // Will be determined by voting results
      [GovernancePhase.EXECUTION]: ProposalStatus.EXECUTED
    };

    return phaseStatusMap[phase];
  }

  /**
   * Process automatic transitions for all active proposals
   */
  async processAutomaticTransitions(): Promise<void> {
    if (!this.options.enableAutomaticTransitions) {
      return;
    }

    this.logger.debug('Processing automatic transitions...');

    const db = this.databaseService.getDatabase();
    const activeProposals = db.prepare(`
      SELECT * FROM proposals 
      WHERE status NOT IN ('approved', 'rejected', 'executed')
    `).all() as any[];

    for (const proposal of activeProposals) {
      try {
        const context = await this.getPhaseContext(proposal.id);
        
        // Find automatic transition rules for current phase
        const automaticRules = this.transitionRules.filter(rule => 
          rule.from === context.currentPhase && 
          rule.automaticTransition &&
          rule.timeoutDuration && 
          context.timeInPhase >= rule.timeoutDuration
        );

        for (const rule of automaticRules) {
          const canTransition = await this.canTransition(proposal.id, rule.to);
          if (canTransition.canTransition) {
            await this.transitionPhase(
              proposal.id,
              rule.to,
              'system',
              'Automatic transition due to timeout'
            );
            break; // Only one transition per cycle
          }
        }
      } catch (error) {
        this.logger.error(`Error processing automatic transition for proposal ${proposal.id}: ${error.message}`);
      }
    }
  }

  /**
   * Get phase configuration
   */
  getPhaseConfiguration(phase: GovernancePhase): PhaseConfiguration | undefined {
    return this.phaseConfigurations.get(phase);
  }

  /**
   * Get all transition rules
   */
  getTransitionRules(): PhaseTransitionRule[] {
    return this.transitionRules;
  }

  /**
   * Update phase configuration
   */
  updatePhaseConfiguration(phase: GovernancePhase, config: Partial<PhaseConfiguration>): void {
    const existing = this.phaseConfigurations.get(phase);
    if (existing) {
      this.phaseConfigurations.set(phase, { ...existing, ...config });
      this.logger.log(`Updated configuration for phase ${phase}`);
    }
  }
}
