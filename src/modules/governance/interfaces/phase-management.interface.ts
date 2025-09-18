export enum GovernancePhase {
  PROPOSAL = 'proposal',
  DISCUSSION = 'discussion', 
  REVISION = 'revision',
  VOTING = 'voting',
  RESOLUTION = 'resolution',
  EXECUTION = 'execution'
}

export enum ProposalStatus {
  DRAFT = 'draft',
  DISCUSSION = 'discussion',
  REVISION = 'revision', 
  VOTING = 'voting',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed'
}

export interface PhaseTransitionRule {
  from: GovernancePhase;
  to: GovernancePhase;
  requiredConditions: PhaseCondition[];
  automaticTransition?: boolean;
  timeoutDuration?: number; // in milliseconds
  allowedRoles?: string[];
}

export interface PhaseCondition {
  type: 'time' | 'participation' | 'consensus' | 'manual' | 'agent_action';
  description: string;
  validator: (context: PhaseContext) => Promise<boolean>;
  metadata?: any;
}

export interface PhaseContext {
  proposalId: string;
  currentPhase: GovernancePhase;
  currentStatus: ProposalStatus;
  proposal: any;
  participants: string[];
  votes?: any[];
  discussions?: any[];
  timeInPhase: number;
  phaseStartedAt: Date;
  deadline?: Date;
  metadata: Record<string, any>;
}

export interface PhaseTransitionEvent {
  proposalId: string;
  fromPhase: GovernancePhase;
  toPhase: GovernancePhase;
  fromStatus: ProposalStatus;
  toStatus: ProposalStatus;
  triggeredBy: string; // agent ID or 'system'
  triggeredAt: Date;
  reason: string;
  metadata?: Record<string, any>;
}

export interface PhaseConfiguration {
  phase: GovernancePhase;
  defaultDuration: number; // in milliseconds
  minDuration?: number;
  maxDuration?: number;
  requiresManualProgression: boolean;
  allowedExtensions: number;
  extensionDuration: number;
  participationRequirements?: {
    minParticipants?: number;
    requiredRoles?: string[];
    consensusThreshold?: number;
  };
}

export interface PhaseManagerOptions {
  enableAutomaticTransitions: boolean;
  defaultPhaseDurations: Record<GovernancePhase, number>;
  transitionRules: PhaseTransitionRule[];
  phaseConfigurations: PhaseConfiguration[];
  notificationEnabled: boolean;
  auditEnabled: boolean;
}
