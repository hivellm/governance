import { Resolver, Query, Mutation, Args, ID, Subscription, Context, Info } from '@nestjs/graphql';
import { Logger, UseGuards, BadRequestException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { Proposal, ProposalListResponse } from './entities/proposal.entity';
import { CreateProposalDto, UpdateProposalDto, ListProposalsDto } from './dto';
import { 
  ProposalStatus, 
  GovernancePhase, 
  ProposalType,
  ProposalVotingResult 
} from './interfaces/proposal.interface';

// GraphQL Input Types
import { InputType, Field } from '@nestjs/graphql';

@InputType()
class CreateProposalInput {
  @Field()
  title: string;

  @Field(() => ProposalType)
  type: ProposalType;

  @Field()
  content: any; // JSON content - will be handled as scalar

  @Field({ nullable: true })
  metadata?: any; // JSON metadata - will be handled as scalar
}

@InputType()
class UpdateProposalInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  content?: any; // JSON content

  @Field({ nullable: true })
  metadata?: any; // JSON metadata
}

@InputType()
class ListProposalsInput {
  @Field({ nullable: true, defaultValue: 1 })
  page?: number;

  @Field({ nullable: true, defaultValue: 20 })
  limit?: number;

  @Field({ nullable: true, defaultValue: 'created_at' })
  sortBy?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  sortOrder?: string;

  @Field(() => [ProposalStatus], { nullable: true })
  status?: ProposalStatus[];

  @Field(() => [GovernancePhase], { nullable: true })
  phase?: GovernancePhase[];

  @Field(() => [ProposalType], { nullable: true })
  type?: ProposalType[];

  @Field({ nullable: true })
  author?: string;

  @Field({ nullable: true })
  dateFrom?: string;

  @Field({ nullable: true })
  dateTo?: string;

  @Field({ nullable: true })
  searchText?: string;
}

@InputType()
class VotingDeadlineInput {
  @Field()
  votingDeadline: string; // ISO date string
}

@InputType()
class ExecutionDataInput {
  @Field({ nullable: true })
  executionData?: any; // JSON execution data
}

// GraphQL Response Types
import { ObjectType } from '@nestjs/graphql';

@ObjectType()
class VotingResultType {
  @Field()
  proposalId: string;

  @Field()
  totalVotes: number;

  @Field()
  approveVotes: number;

  @Field()
  rejectVotes: number;

  @Field()
  abstainVotes: number;

  @Field()
  consensusPercentage: number;

  @Field()
  quorumMet: boolean;

  @Field()
  result: string; // 'approved' | 'rejected' | 'pending'

  @Field()
  votingClosed: boolean;
}

@ObjectType()
class ProposalStatistics {
  @Field()
  total: number;

  @Field()
  byStatus: any; // JSON object

  @Field()
  byType: any; // JSON object

  @Field()
  byPhase: any; // JSON object

  @Field()
  recent: number;
}

@Resolver(() => Proposal)
export class ProposalsResolver {
  private readonly logger = new Logger(ProposalsResolver.name);

  constructor(private readonly proposalsService: ProposalsService) {}

  // === QUERIES ===

  @Query(() => Proposal, { description: 'Get a proposal by its ID' })
  async proposal(@Args('id', { type: () => ID }) id: string): Promise<Proposal> {
    this.logger.log(`GraphQL: Finding proposal ${id}`);
    return this.proposalsService.findById(id) as Promise<Proposal>;
  }

  @Query(() => ProposalListResponse, { description: 'List proposals with filtering and pagination' })
  async proposals(
    @Args('input', { type: () => ListProposalsInput, nullable: true }) 
    input: ListProposalsInput = {}
  ): Promise<ProposalListResponse> {
    this.logger.log('GraphQL: Listing proposals', JSON.stringify(input));
    
    // Convert GraphQL input to DTO format
    const listProposalsDto: ListProposalsDto = {
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy as any,
      sortOrder: input.sortOrder as any,
      status: input.status,
      phase: input.phase,
      type: input.type,
      author: input.author,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      searchText: input.searchText,
    };

    return this.proposalsService.findAll(listProposalsDto) as Promise<ProposalListResponse>;
  }

  @Query(() => [Proposal], { description: 'Search proposals using full-text search' })
  async searchProposals(
    @Args('searchText') searchText: string,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 20 }) limit: number
  ): Promise<Proposal[]> {
    this.logger.log(`GraphQL: Searching proposals: "${searchText}"`);
    return this.proposalsService.searchProposals(searchText, limit) as Promise<Proposal[]>;
  }

  @Query(() => VotingResultType, { description: 'Get voting results for a proposal' })
  async proposalVotingResults(
    @Args('id', { type: () => ID }) id: string
  ): Promise<VotingResultType> {
    this.logger.log(`GraphQL: Getting voting results for ${id}`);
    const results = await this.proposalsService.getVotingResults(id);
    return results as VotingResultType;
  }

  @Query(() => ProposalStatistics, { description: 'Get proposal statistics and metrics' })
  async proposalStatistics(): Promise<ProposalStatistics> {
    this.logger.log('GraphQL: Getting proposal statistics');
    return this.proposalsService.getProposalStatistics() as Promise<ProposalStatistics>;
  }

  @Query(() => [Proposal], { description: 'Get proposals by author' })
  async proposalsByAuthor(
    @Args('authorId') authorId: string,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 20 }) limit: number
  ): Promise<Proposal[]> {
    this.logger.log(`GraphQL: Getting proposals by author ${authorId}`);
    
    const listDto: ListProposalsDto = {
      author: authorId,
      limit: limit,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    
    const result = await this.proposalsService.findAll(listDto);
    return result.items as Proposal[];
  }

  @Query(() => [Proposal], { description: 'Get proposals by status' })
  async proposalsByStatus(
    @Args('status', { type: () => ProposalStatus }) status: ProposalStatus,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 20 }) limit: number
  ): Promise<Proposal[]> {
    this.logger.log(`GraphQL: Getting proposals by status ${status}`);
    
    const listDto: ListProposalsDto = {
      status: [status],
      limit: limit,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };
    
    const result = await this.proposalsService.findAll(listDto);
    return result.items as Proposal[];
  }

  // === MUTATIONS ===

  @Mutation(() => Proposal, { description: 'Create a new proposal' })
  async createProposal(
    @Args('input', { type: () => CreateProposalInput }) input: CreateProposalInput,
    @Context() context: any // TODO: Replace with proper auth context
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Creating proposal "${input.title}"`);
    
    // TODO: Extract agent ID from authentication context
    const authorId = context.user?.id || 'temp-agent-id';
    
    // Convert GraphQL input to DTO
    const createProposalDto: CreateProposalDto = {
      title: input.title,
      type: input.type,
      content: input.content,
      metadata: input.metadata,
    };
    
    return this.proposalsService.createProposal(authorId, createProposalDto) as Promise<Proposal>;
  }

  @Mutation(() => Proposal, { description: 'Update an existing proposal' })
  async updateProposal(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateProposalInput }) input: UpdateProposalInput
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Updating proposal ${id}`);
    
    // Convert GraphQL input to DTO
    const updateProposalDto: UpdateProposalDto = {
      title: input.title,
      content: input.content,
      metadata: input.metadata,
    };
    
    return this.proposalsService.updateProposal(id, updateProposalDto) as Promise<Proposal>;
  }

  @Mutation(() => Boolean, { description: 'Delete a proposal (only drafts)' })
  async deleteProposal(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    this.logger.log(`GraphQL: Deleting proposal ${id}`);
    
    await this.proposalsService.deleteProposal(id);
    return true;
  }

  @Mutation(() => Proposal, { description: 'Submit proposal for discussion' })
  async submitProposalForDiscussion(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Submitting proposal for discussion ${id}`);
    return this.proposalsService.submitForDiscussion(id) as Promise<Proposal>;
  }

  @Mutation(() => Proposal, { description: 'Move proposal to revision phase' })
  async moveProposalToRevision(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Moving proposal to revision ${id}`);
    return this.proposalsService.moveToRevision(id) as Promise<Proposal>;
  }

  @Mutation(() => Proposal, { description: 'Move proposal to voting phase' })
  async moveProposalToVoting(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => VotingDeadlineInput }) input: VotingDeadlineInput
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Moving proposal to voting ${id} (deadline: ${input.votingDeadline})`);
    
    const votingDeadline = new Date(input.votingDeadline);
    
    if (votingDeadline <= new Date()) {
      throw new BadRequestException('Voting deadline must be in the future');
    }
    
    return this.proposalsService.moveToVoting(id, votingDeadline) as Promise<Proposal>;
  }

  @Mutation(() => Proposal, { description: 'Finalize voting on a proposal' })
  async finalizeProposalVoting(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Finalizing voting for proposal ${id}`);
    return this.proposalsService.finalizeVoting(id) as Promise<Proposal>;
  }

  @Mutation(() => Proposal, { description: 'Mark proposal as executed' })
  async markProposalAsExecuted(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ExecutionDataInput, nullable: true }) 
    input?: ExecutionDataInput
  ): Promise<Proposal> {
    this.logger.log(`GraphQL: Marking proposal as executed ${id}`);
    return this.proposalsService.markAsExecuted(id, input?.executionData) as Promise<Proposal>;
  }

  // === SUBSCRIPTIONS (Real-time updates) ===

  @Subscription(() => Proposal, {
    description: 'Subscribe to proposal updates',
    filter: (payload, variables) => {
      // Filter subscription based on proposal ID if provided
      return !variables.proposalId || payload.proposalUpdated.id === variables.proposalId;
    }
  })
  proposalUpdated(
    @Args('proposalId', { type: () => ID, nullable: true }) proposalId?: string
  ) {
    this.logger.log(`GraphQL: Subscription to proposal updates ${proposalId || 'all'}`);
    // TODO: Implement real-time subscription using PubSub
    // This would integrate with WebSocket gateway for live updates
    return 'proposalUpdated'; // PubSub trigger name
  }

  @Subscription(() => Proposal, {
    description: 'Subscribe to new proposals',
  })
  proposalCreated() {
    this.logger.log('GraphQL: Subscription to new proposals');
    // TODO: Implement real-time subscription
    return 'proposalCreated';
  }

  @Subscription(() => String, {
    description: 'Subscribe to proposal status changes',
    filter: (payload, variables) => {
      return !variables.proposalId || payload.proposalStatusChanged.id === variables.proposalId;
    }
  })
  proposalStatusChanged(
    @Args('proposalId', { type: () => ID, nullable: true }) proposalId?: string
  ) {
    this.logger.log(`GraphQL: Subscription to status changes ${proposalId || 'all'}`);
    // TODO: Implement real-time subscription
    return 'proposalStatusChanged';
  }

  @Subscription(() => VotingResultType, {
    description: 'Subscribe to voting updates',
  })
  votingUpdated(
    @Args('proposalId', { type: () => ID }) proposalId: string
  ) {
    this.logger.log(`GraphQL: Subscription to voting updates for ${proposalId}`);
    // TODO: Implement real-time subscription
    return 'votingUpdated';
  }

  // === FIELD RESOLVERS (for complex fields) ===

  // TODO: Add field resolvers for related data
  // Example: Resolve author information, vote counts, discussion data, etc.
  
  /*
  @ResolveField('author', () => Agent)
  async getAuthor(@Parent() proposal: Proposal) {
    // Resolve author information from AgentsService
    return this.agentsService.findById(proposal.authorId);
  }

  @ResolveField('discussionCount', () => Number)
  async getDiscussionCount(@Parent() proposal: Proposal) {
    // Count discussions for this proposal
    return this.discussionsService.getDiscussionCount(proposal.id);
  }

  @ResolveField('voteCount', () => Number)
  async getVoteCount(@Parent() proposal: Proposal) {
    // Count votes for this proposal
    return this.votingService.getVoteCount(proposal.id);
  }
  */
}
