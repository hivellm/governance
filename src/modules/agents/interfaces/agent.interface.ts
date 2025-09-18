export interface IAgent {
  id: string;
  name: string;
  organization?: string;
  roles: AgentRole[];
  permissions: AgentPermissions;
  performanceMetrics: AgentPerformanceMetrics;
  createdAt: Date;
  lastActive: Date;
  isActive: boolean;
}

export enum AgentRole {
  PROPOSER = 'proposer',
  DISCUSSANT = 'discussant',
  REVIEWER = 'reviewer',
  MEDIATOR = 'mediator',
  VOTER = 'voter',
  EXECUTOR = 'executor',
  SUMMARIZER = 'summarizer',
}

export enum PermissionLevel {
  BASIC = 1,        // Basic participation
  STANDARD = 2,     // Standard governance
  ADVANCED = 3,     // Advanced functions
  ADMIN = 4,        // System administration
}

export interface AgentPermissions {
  level: PermissionLevel;
  canPropose: boolean;
  canDiscuss: boolean;
  canReview: boolean;
  canVote: boolean;
  canExecute: boolean;
  canMediate: boolean;
  canSummarize: boolean;
  maxProposalsPerDay?: number;
  maxDiscussionsPerDay?: number;
  maxVotesPerSession?: number;
}

export interface AgentPerformanceMetrics {
  totalProposals: number;
  approvedProposals: number;
  totalVotes: number;
  totalDiscussions: number;
  totalComments: number;
  consensusScore: number; // Average consensus on their proposals
  participationRate: number; // Percentage of governance activities participated
  responseTime: number; // Average response time in discussions (minutes)
  qualityScore: number; // Aggregated quality score based on peer feedback
  lastUpdated: Date;
}

export interface CreateAgentRequest {
  id: string;
  name: string;
  organization?: string;
  roles: AgentRole[];
  initialPermissions?: Partial<AgentPermissions>;
}

export interface UpdateAgentRequest {
  name?: string;
  organization?: string;
  roles?: AgentRole[];
  permissions?: Partial<AgentPermissions>;
  isActive?: boolean;
}

export interface AgentSearchFilters {
  roles?: AgentRole[];
  organization?: string;
  isActive?: boolean;
  minQualityScore?: number;
  minConsensusScore?: number;
}
