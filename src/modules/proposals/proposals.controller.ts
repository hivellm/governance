import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  HttpStatus, 
  UseGuards,
  Req,
  Logger
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
import { ProposalsService } from './proposals.service';
import { CreateProposalDto, UpdateProposalDto, ListProposalsDto } from './dto';
import { Proposal, ProposalListResponse } from './entities/proposal.entity';

@ApiTags('proposals')
@Controller('api/proposals')
@ApiBearerAuth()
export class ProposalsController {
  private readonly logger = new Logger(ProposalsController.name);

  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new proposal',
    description: 'Creates a new governance proposal in draft status. The proposal will need to be submitted for discussion before entering the governance pipeline.'
  })
  @ApiBody({ type: CreateProposalDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Proposal created successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid proposal data provided',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async createProposal(
    @Body() createProposalDto: CreateProposalDto,
    @Req() request: any // TODO: Replace with proper auth guard
  ): Promise<Proposal> {
    this.logger.log(`Creating proposal: "${createProposalDto.title}"`);
    
    // TODO: Extract agent ID from JWT token via auth guard
    const authorId = request.user?.id || 'temp-agent-id';
    
    const proposal = await this.proposalsService.createProposal(authorId, createProposalDto);
    return proposal as Proposal;
  }

  @Get()
  @ApiOperation({ 
    summary: 'List proposals with filtering and pagination',
    description: 'Retrieves a paginated list of proposals with optional filtering by status, phase, type, author, date range, and full-text search.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['created_at', 'updated_at', 'title', 'status'], description: 'Field to sort by (default: created_at)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
  @ApiQuery({ name: 'status', required: false, type: [String], description: 'Filter by proposal status' })
  @ApiQuery({ name: 'phase', required: false, type: [String], description: 'Filter by governance phase' })
  @ApiQuery({ name: 'type', required: false, type: [String], description: 'Filter by proposal type' })
  @ApiQuery({ name: 'author', required: false, type: String, description: 'Filter by author ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Filter proposals created after this date (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Filter proposals created before this date (ISO string)' })
  @ApiQuery({ name: 'searchText', required: false, type: String, description: 'Full-text search in title and content' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposals retrieved successfully',
    type: ProposalListResponse,
  })
  async findAllProposals(@Query() listProposalsDto: ListProposalsDto): Promise<ProposalListResponse> {
    this.logger.log('Listing proposals with filters', JSON.stringify(listProposalsDto));
    
    const result = await this.proposalsService.findAll(listProposalsDto);
    return result as ProposalListResponse;
  }

  @Get('search')
  @ApiOperation({ 
    summary: 'Search proposals using full-text search',
    description: 'Performs full-text search across proposal titles and content using SQLite FTS5.'
  })
  @ApiQuery({ name: 'q', type: String, description: 'Search query text' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of results (default: 20)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    type: [Proposal],
  })
  async searchProposals(
    @Query('q') searchText: string,
    @Query('limit') limit: number = 20
  ): Promise<Proposal[]> {
    this.logger.log(`Searching proposals: "${searchText}"`);
    
    const results = await this.proposalsService.searchProposals(searchText, limit);
    return results as Proposal[];
  }

  @Get('statistics')
  @ApiOperation({ 
    summary: 'Get proposal statistics',
    description: 'Retrieves aggregate statistics for proposals including counts by status, type, phase, and recent activity.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total number of proposals' },
        byStatus: { type: 'object', description: 'Count of proposals by status' },
        byType: { type: 'object', description: 'Count of proposals by type' },
        byPhase: { type: 'object', description: 'Count of proposals by governance phase' },
        recent: { type: 'number', description: 'Number of proposals created in last 7 days' }
      }
    }
  })
  async getStatistics() {
    this.logger.log('Getting proposal statistics');
    
    const statistics = await this.proposalsService.getProposalStatistics();
    return statistics;
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get proposal by ID',
    description: 'Retrieves a specific proposal by its unique identifier including all content, metadata, and current status.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal retrieved successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async findProposal(@Param('id') id: string): Promise<Proposal> {
    this.logger.log(`Retrieving proposal: ${id}`);
    
    const proposal = await this.proposalsService.findById(id);
    return proposal as Proposal;
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update proposal',
    description: 'Updates an existing proposal. Only proposals in draft or revision status can be updated.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiBody({ type: UpdateProposalDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal updated successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid proposal data or proposal cannot be updated in current status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async updateProposal(
    @Param('id') id: string,
    @Body() updateProposalDto: UpdateProposalDto
  ): Promise<Proposal> {
    this.logger.log(`Updating proposal: ${id}`);
    
    const proposal = await this.proposalsService.updateProposal(id, updateProposalDto);
    return proposal as Proposal;
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete proposal',
    description: 'Deletes a proposal. Only draft proposals can be deleted.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Proposal deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Proposal cannot be deleted in current status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async deleteProposal(@Param('id') id: string): Promise<void> {
    this.logger.log(`Deleting proposal: ${id}`);
    
    await this.proposalsService.deleteProposal(id);
  }

  @Post(':id/submit')
  @ApiOperation({ 
    summary: 'Submit proposal for discussion',
    description: 'Moves a draft proposal to discussion phase, making it available for community debate and feedback.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal submitted for discussion successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Proposal cannot be submitted in current status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async submitForDiscussion(@Param('id') id: string): Promise<Proposal> {
    this.logger.log(`Submitting proposal for discussion: ${id}`);
    
    const proposal = await this.proposalsService.submitForDiscussion(id);
    return proposal as Proposal;
  }

  @Post(':id/revision')
  @ApiOperation({ 
    summary: 'Move proposal to revision phase',
    description: 'Moves a proposal from discussion to revision phase, allowing the author to make amendments based on feedback.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal moved to revision phase successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Proposal cannot be moved to revision in current status',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async moveToRevision(@Param('id') id: string): Promise<Proposal> {
    this.logger.log(`Moving proposal to revision: ${id}`);
    
    const proposal = await this.proposalsService.moveToRevision(id);
    return proposal as Proposal;
  }

  @Post(':id/voting')
  @ApiOperation({ 
    summary: 'Move proposal to voting phase',
    description: 'Moves a proposal to voting phase with a specified deadline. Agents can then cast their votes on the proposal.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        votingDeadline: {
          type: 'string',
          format: 'date-time',
          description: 'ISO date string for voting deadline'
        }
      },
      required: ['votingDeadline']
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal moved to voting phase successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Proposal cannot be moved to voting in current status or invalid deadline',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async moveToVoting(
    @Param('id') id: string,
    @Body() body: { votingDeadline: string }
  ): Promise<Proposal> {
    this.logger.log(`Moving proposal to voting: ${id} (deadline: ${body.votingDeadline})`);
    
    const votingDeadline = new Date(body.votingDeadline);
    
    if (votingDeadline <= new Date()) {
      throw new Error('Voting deadline must be in the future');
    }
    
    const proposal = await this.proposalsService.moveToVoting(id, votingDeadline);
    return proposal as Proposal;
  }

  @Get(':id/voting-results')
  @ApiOperation({ 
    summary: 'Get voting results',
    description: 'Retrieves current voting results for a proposal including vote counts, consensus percentage, and final result.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting results retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        proposalId: { type: 'string' },
        totalVotes: { type: 'number' },
        approveVotes: { type: 'number' },
        rejectVotes: { type: 'number' },
        abstainVotes: { type: 'number' },
        consensusPercentage: { type: 'number' },
        quorumMet: { type: 'boolean' },
        result: { type: 'string', enum: ['approved', 'rejected', 'pending'] },
        votingClosed: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async getVotingResults(@Param('id') id: string) {
    this.logger.log(`Getting voting results for proposal: ${id}`);
    
    const results = await this.proposalsService.getVotingResults(id);
    return results;
  }

  @Post(':id/finalize-voting')
  @ApiOperation({ 
    summary: 'Finalize proposal voting',
    description: 'Finalizes the voting process and updates proposal status to approved or rejected based on the voting results.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Voting finalized successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Voting cannot be finalized (insufficient votes or quorum not met)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async finalizeVoting(@Param('id') id: string): Promise<Proposal> {
    this.logger.log(`Finalizing voting for proposal: ${id}`);
    
    const proposal = await this.proposalsService.finalizeVoting(id);
    return proposal as Proposal;
  }

  @Post(':id/execute')
  @ApiOperation({ 
    summary: 'Mark proposal as executed',
    description: 'Marks an approved proposal as executed, optionally storing execution details.'
  })
  @ApiParam({ name: 'id', description: 'Unique proposal identifier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        executionData: {
          type: 'object',
          description: 'Optional execution details and results'
        }
      }
    },
    required: false
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proposal marked as executed successfully',
    type: Proposal,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Proposal must be approved before execution',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proposal not found',
  })
  async markAsExecuted(
    @Param('id') id: string,
    @Body() body?: { executionData?: any }
  ): Promise<Proposal> {
    this.logger.log(`Marking proposal as executed: ${id}`);
    
    const proposal = await this.proposalsService.markAsExecuted(id, body?.executionData);
    return proposal as Proposal;
  }

}
