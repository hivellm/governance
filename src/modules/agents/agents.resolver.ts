import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Logger, BadRequestException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { 
  IAgent,
  AgentRole,
  PermissionLevel,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentSearchFilters,
  AgentPerformanceMetrics
} from './interfaces/agent.interface';

// GraphQL Types
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';

// Register enums for GraphQL
registerEnumType(AgentRole, {
  name: 'AgentRole',
  description: 'Available agent roles in the governance system',
});

registerEnumType(PermissionLevel, {
  name: 'PermissionLevel',
  description: 'Permission levels for agents',
});

@ObjectType()
class Agent implements IAgent {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  organization?: string;

  @Field(() => [AgentRole])
  roles: AgentRole[];

  @Field()
  permissions: any; // JSON object

  @Field()
  performanceMetrics: any; // JSON object

  @Field()
  createdAt: Date;

  @Field()
  lastActive: Date;

  @Field()
  isActive: boolean;
}

@ObjectType()
class AgentListResponse {
  @Field(() => [Agent])
  items: Agent[];

  @Field()
  total: number;

  @Field()
  page: number;

  @Field()
  limit: number;
}

@ObjectType()
class AgentStatistics {
  @Field()
  total: number;

  @Field()
  active: number;

  @Field()
  byRole: any; // JSON object

  @Field()
  byOrganization: any; // JSON object

  @Field()
  byPermissionLevel: any; // JSON object
}

@ObjectType()
class PermissionCheck {
  @Field()
  agentId: string;

  @Field()
  permission: string;

  @Field()
  hasPermission: boolean;
}

@ObjectType()
class RoleCheck {
  @Field()
  agentId: string;

  @Field(() => AgentRole)
  role: AgentRole;

  @Field()
  hasRole: boolean;
}

@ObjectType()
class AvailableRoles {
  @Field(() => [AgentRole])
  roles: AgentRole[];

  @Field()
  descriptions: any; // JSON object with role descriptions
}

// Input Types
@InputType()
class CreateAgentInput {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  organization?: string;

  @Field(() => [AgentRole])
  roles: AgentRole[];

  @Field({ nullable: true })
  initialPermissions?: any; // JSON object
}

@InputType()
class UpdateAgentInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  organization?: string;

  @Field(() => [AgentRole], { nullable: true })
  roles?: AgentRole[];

  @Field({ nullable: true })
  permissions?: any; // JSON object

  @Field({ nullable: true })
  isActive?: boolean;
}

@InputType()
class AgentFiltersInput {
  @Field(() => [AgentRole], { nullable: true })
  roles?: AgentRole[];

  @Field({ nullable: true })
  organization?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  minQualityScore?: number;

  @Field({ nullable: true })
  minConsensusScore?: number;
}

@InputType()
class UpdateMetricsInput {
  @Field({ nullable: true })
  totalProposals?: number;

  @Field({ nullable: true })
  approvedProposals?: number;

  @Field({ nullable: true })
  totalVotes?: number;

  @Field({ nullable: true })
  totalDiscussions?: number;

  @Field({ nullable: true })
  totalComments?: number;

  @Field({ nullable: true })
  consensusScore?: number;

  @Field({ nullable: true })
  participationRate?: number;

  @Field({ nullable: true })
  responseTime?: number;

  @Field({ nullable: true })
  qualityScore?: number;
}

@Resolver(() => Agent)
export class AgentsResolver {
  private readonly logger = new Logger(AgentsResolver.name);

  constructor(private readonly agentsService: AgentsService) {}

  // === QUERIES ===

  @Query(() => Agent, { description: 'Get an agent by their ID' })
  async agent(@Args('id', { type: () => ID }) id: string): Promise<Agent> {
    this.logger.log(`GraphQL: Finding agent ${id}`);
    return this.agentsService.findById(id) as Promise<Agent>;
  }

  @Query(() => AgentListResponse, { description: 'List agents with filtering and pagination' })
  async agents(
    @Args('page', { type: () => Number, nullable: true, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 50 }) limit: number,
    @Args('filters', { type: () => AgentFiltersInput, nullable: true }) 
    filters: AgentFiltersInput = {}
  ): Promise<AgentListResponse> {
    this.logger.log('GraphQL: Listing agents', JSON.stringify({ page, limit, filters }));
    
    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedPage = Math.max(1, page);
    
    // Convert GraphQL input to service format
    const searchFilters: AgentSearchFilters = {
      roles: filters.roles,
      organization: filters.organization,
      isActive: filters.isActive,
      minQualityScore: filters.minQualityScore,
      minConsensusScore: filters.minConsensusScore,
    };
    
    return this.agentsService.findAll(searchFilters, validatedPage, validatedLimit) as Promise<AgentListResponse>;
  }

  @Query(() => [Agent], { description: 'Get agents by role' })
  async agentsByRole(
    @Args('role', { type: () => AgentRole }) role: AgentRole,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 20 }) limit: number
  ): Promise<Agent[]> {
    this.logger.log(`GraphQL: Getting agents by role ${role}`);
    
    const filters: AgentSearchFilters = { roles: [role] };
    const result = await this.agentsService.findAll(filters, 1, limit);
    return result.items as Agent[];
  }

  @Query(() => [Agent], { description: 'Get agents by organization' })
  async agentsByOrganization(
    @Args('organization') organization: string,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 20 }) limit: number
  ): Promise<Agent[]> {
    this.logger.log(`GraphQL: Getting agents by organization ${organization}`);
    
    const filters: AgentSearchFilters = { organization };
    const result = await this.agentsService.findAll(filters, 1, limit);
    return result.items as Agent[];
  }

  @Query(() => [Agent], { description: 'Get active agents' })
  async activeAgents(
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 50 }) limit: number
  ): Promise<Agent[]> {
    this.logger.log('GraphQL: Getting active agents');
    
    const filters: AgentSearchFilters = { isActive: true };
    const result = await this.agentsService.findAll(filters, 1, limit);
    return result.items as Agent[];
  }

  @Query(() => AgentStatistics, { description: 'Get agent statistics and metrics' })
  async agentStatistics(): Promise<AgentStatistics> {
    this.logger.log('GraphQL: Getting agent statistics');
    return this.agentsService.getAgentStatistics() as Promise<AgentStatistics>;
  }

  @Query(() => PermissionCheck, { description: 'Check if agent has specific permission' })
  async checkAgentPermission(
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('permission') permission: string
  ): Promise<PermissionCheck> {
    this.logger.log(`GraphQL: Checking permission ${permission} for agent ${agentId}`);
    
    const hasPermission = await this.agentsService.hasPermission(agentId, permission as any);
    
    return {
      agentId,
      permission,
      hasPermission,
    };
  }

  @Query(() => RoleCheck, { description: 'Check if agent has specific role' })
  async checkAgentRole(
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('role', { type: () => AgentRole }) role: AgentRole
  ): Promise<RoleCheck> {
    this.logger.log(`GraphQL: Checking role ${role} for agent ${agentId}`);
    
    const hasRole = await this.agentsService.hasRole(agentId, [role]);
    
    return {
      agentId,
      role,
      hasRole,
    };
  }

  @Query(() => AvailableRoles, { description: 'Get available agent roles' })
  async availableAgentRoles(): Promise<AvailableRoles> {
    this.logger.log('GraphQL: Getting available agent roles');
    
    const roleDescriptions = {
      [AgentRole.PROPOSER]: { 
        description: 'Can submit new proposals and respond to feedback', 
        level: 2,
        permissions: ['canPropose', 'canDiscuss']
      },
      [AgentRole.DISCUSSANT]: { 
        description: 'Can participate in technical debates and discussions', 
        level: 1,
        permissions: ['canDiscuss']
      },
      [AgentRole.REVIEWER]: { 
        description: 'Can perform technical feasibility analysis and security reviews', 
        level: 3,
        permissions: ['canReview', 'canDiscuss']
      },
      [AgentRole.MEDIATOR]: { 
        description: 'Can manage phase transitions and enforce protocols', 
        level: 4,
        permissions: ['canMediate', 'canDiscuss', 'canReview']
      },
      [AgentRole.VOTER]: { 
        description: 'Can cast justified votes on proposals', 
        level: 2,
        permissions: ['canVote', 'canDiscuss']
      },
      [AgentRole.EXECUTOR]: { 
        description: 'Can implement approved proposals', 
        level: 3,
        permissions: ['canExecute', 'canDiscuss']
      },
      [AgentRole.SUMMARIZER]: { 
        description: 'Can generate discussion summaries and documentation', 
        level: 2,
        permissions: ['canSummarize', 'canDiscuss']
      },
    };
    
    return {
      roles: Object.values(AgentRole),
      descriptions: roleDescriptions,
    };
  }

  // === MUTATIONS ===

  @Mutation(() => Agent, { description: 'Register a new agent' })
  async registerAgent(
    @Args('input', { type: () => CreateAgentInput }) input: CreateAgentInput
  ): Promise<Agent> {
    this.logger.log(`GraphQL: Creating agent ${input.id} - "${input.name}"`);
    
    const createAgentRequest: CreateAgentRequest = {
      id: input.id,
      name: input.name,
      organization: input.organization,
      roles: input.roles,
      initialPermissions: input.initialPermissions,
    };
    
    return this.agentsService.createAgent(createAgentRequest) as Promise<Agent>;
  }

  @Mutation(() => Agent, { description: 'Update agent information' })
  async updateAgent(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateAgentInput }) input: UpdateAgentInput
  ): Promise<Agent> {
    this.logger.log(`GraphQL: Updating agent ${id}`);
    
    const updateAgentRequest: UpdateAgentRequest = {
      name: input.name,
      organization: input.organization,
      roles: input.roles,
      permissions: input.permissions,
      isActive: input.isActive,
    };
    
    return this.agentsService.updateAgent(id, updateAgentRequest) as Promise<Agent>;
  }

  @Mutation(() => Agent, { description: 'Deactivate agent' })
  async deactivateAgent(@Args('id', { type: () => ID }) id: string): Promise<Agent> {
    this.logger.log(`GraphQL: Deactivating agent ${id}`);
    return this.agentsService.deactivateAgent(id) as Promise<Agent>;
  }

  @Mutation(() => Agent, { description: 'Reactivate agent' })
  async reactivateAgent(@Args('id', { type: () => ID }) id: string): Promise<Agent> {
    this.logger.log(`GraphQL: Reactivating agent ${id}`);
    return this.agentsService.reactivateAgent(id) as Promise<Agent>;
  }

  @Mutation(() => Agent, { description: 'Update agent performance metrics' })
  async updateAgentMetrics(
    @Args('id', { type: () => ID }) id: string,
    @Args('metrics', { type: () => UpdateMetricsInput }) metrics: UpdateMetricsInput
  ): Promise<Agent> {
    this.logger.log(`GraphQL: Updating performance metrics for agent ${id}`);
    
    // Convert GraphQL input to service format
    const metricsUpdate: Partial<AgentPerformanceMetrics> = {
      totalProposals: metrics.totalProposals,
      approvedProposals: metrics.approvedProposals,
      totalVotes: metrics.totalVotes,
      totalDiscussions: metrics.totalDiscussions,
      totalComments: metrics.totalComments,
      consensusScore: metrics.consensusScore,
      participationRate: metrics.participationRate,
      responseTime: metrics.responseTime,
      qualityScore: metrics.qualityScore,
    };
    
    return this.agentsService.updatePerformanceMetrics(id, metricsUpdate) as Promise<Agent>;
  }

  @Mutation(() => Boolean, { description: 'Update agent activity timestamp' })
  async updateAgentActivity(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    this.logger.log(`GraphQL: Updating activity for agent ${id}`);
    
    await this.agentsService.updateActivity(id);
    return true;
  }

  // === FIELD RESOLVERS (for computed fields) ===

  // TODO: Add field resolvers for complex computed fields
  
  /*
  @ResolveField('proposalCount', () => Number)
  async getProposalCount(@Parent() agent: Agent) {
    // Get proposal count from ProposalsService
    return this.proposalsService.getProposalCountByAuthor(agent.id);
  }

  @ResolveField('activeDiscussions', () => Number)
  async getActiveDiscussions(@Parent() agent: Agent) {
    // Get active discussion count from DiscussionsService
    return this.discussionsService.getActiveDiscussionsByAgent(agent.id);
  }

  @ResolveField('recentVotes', () => Number)
  async getRecentVotes(@Parent() agent: Agent) {
    // Get recent vote count from VotingService
    return this.votingService.getRecentVotesByAgent(agent.id);
  }
  */
}
