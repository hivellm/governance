import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Delete,
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
  ApiBody
} from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { DiscussionOrchestratorService } from './services/discussion-orchestrator.service';
import { 
  CreateDiscussionDto, 
  CreateCommentDto, 
  UpdateDiscussionDto,
  ListDiscussionsDto,
  ReactToCommentDto
} from './dto';
import { 
  IDiscussion, 
  IComment, 
  DiscussionSummary,
  DiscussionStatus,
  CommentType
} from './interfaces/discussion.interface';

@ApiTags('discussions')
@Controller('api/discussions')
export class DiscussionsController {
  private readonly logger = new Logger(DiscussionsController.name);

  constructor(
    private readonly discussionsService: DiscussionsService,
    private readonly discussionOrchestrator: DiscussionOrchestratorService
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create new discussion',
    description: 'Create a new discussion thread for a proposal'
  })
  @ApiBody({ type: CreateDiscussionDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Discussion created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        proposalId: { type: 'string' },
        status: { type: 'string', enum: Object.values(DiscussionStatus) },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input or discussion already exists' 
  })
  async createDiscussion(@Body() createDiscussionDto: CreateDiscussionDto): Promise<IDiscussion> {
    this.logger.log(`🆕 Creating discussion for proposal: ${createDiscussionDto.proposalId}`);
    
    const discussion = await this.discussionsService.createDiscussion({
      proposalId: createDiscussionDto.proposalId,
      title: createDiscussionDto.title,
      description: createDiscussionDto.description,
      moderators: createDiscussionDto.moderators,
      settings: createDiscussionDto.settings,
      metadata: createDiscussionDto.metadata
    });

    this.logger.log(`✅ Discussion created: ${discussion.id}`);
    return discussion;
  }

  @Get()
  @ApiOperation({ 
    summary: 'List discussions',
    description: 'Retrieve discussions with optional filtering and pagination'
  })
  @ApiQuery({ name: 'proposalId', required: false, description: 'Filter by proposal ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status', enum: DiscussionStatus })
  @ApiQuery({ name: 'participantId', required: false, description: 'Filter by participant agent ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Discussions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' }
      }
    }
  })
  async listDiscussions(@Query() query: ListDiscussionsDto): Promise<{
    items: IDiscussion[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.debug(`Listing discussions with filters: ${JSON.stringify(query)}`);

    const filters = {
      proposalId: query.proposalId,
      status: query.status ? [query.status as unknown as DiscussionStatus] : undefined,
      participantId: query.participantId,
      createdAfter: query.createdAfter ? new Date(query.createdAfter) : undefined,
      createdBefore: query.createdBefore ? new Date(query.createdBefore) : undefined,
      hasActiveSummary: query.hasActiveSummary
    };

    return this.discussionsService.listDiscussions(filters, query.page || 1, query.limit || 20);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get discussion by ID',
    description: 'Retrieve a specific discussion with all details'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Discussion retrieved successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Discussion not found' 
  })
  async getDiscussion(@Param('id') id: string): Promise<IDiscussion> {
    this.logger.debug(`Getting discussion: ${id}`);
    return this.discussionsService.getDiscussion(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update discussion',
    description: 'Update discussion details (moderators only)'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiBody({ type: UpdateDiscussionDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Discussion updated successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Only moderators can update discussions' 
  })
  async updateDiscussion(
    @Param('id') id: string,
    @Body() updateDiscussionDto: UpdateDiscussionDto
  ): Promise<IDiscussion> {
    this.logger.log(`📝 Updating discussion: ${id}`);
    
    // In a real implementation, we'd get the agent ID from authentication
    const agentId = 'system'; // Placeholder
    
    const discussion = await this.discussionsService.updateDiscussion(id, {
      title: updateDiscussionDto.title,
      description: updateDiscussionDto.description,
      status: updateDiscussionDto.status,
      moderators: updateDiscussionDto.moderators,
      settings: updateDiscussionDto.settings,
      metadata: updateDiscussionDto.metadata
    }, agentId);

    this.logger.log(`✅ Discussion updated: ${id}`);
    return discussion;
  }

  @Get(':id/comments')
  @ApiOperation({ 
    summary: 'Get discussion comments',
    description: 'Retrieve all comments for a discussion with optional filtering'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiQuery({ name: 'authorId', required: false, description: 'Filter by comment author' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by comment type', enum: CommentType })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter by parent comment ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Comments retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          authorId: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', enum: Object.values(CommentType) },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  async getDiscussionComments(
    @Param('id') id: string,
    @Query('authorId') authorId?: string,
    @Query('type') type?: CommentType,
    @Query('parentId') parentId?: string
  ): Promise<IComment[]> {
    this.logger.debug(`Getting comments for discussion: ${id}`);

    const filters = {
      authorId,
      type: type ? [type] : undefined,
      parentId
    };

    return this.discussionsService.getDiscussionComments(id, filters);
  }

  @Post(':id/comments')
  @ApiOperation({ 
    summary: 'Add comment to discussion',
    description: 'Add a new comment to an active discussion'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Comment added successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Discussion not active or comment limits exceeded' 
  })
  async addComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto
  ): Promise<IComment> {
    this.logger.log(`💬 Adding comment to discussion: ${id}`);

    const comment = await this.discussionsService.addComment({
      discussionId: id,
      authorId: createCommentDto.authorId,
      parentId: createCommentDto.parentId,
      type: createCommentDto.type,
      content: createCommentDto.content,
      references: createCommentDto.references,
      metadata: createCommentDto.metadata
    });

    this.logger.log(`✅ Comment added: ${comment.id} by ${createCommentDto.authorId}`);
    return comment;
  }

  @Post(':id/comments/:commentId/react')
  @ApiOperation({ 
    summary: 'React to comment',
    description: 'Add or update a reaction to a comment'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  @ApiBody({ type: ReactToCommentDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Reaction added successfully'
  })
  async reactToComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() reactDto: ReactToCommentDto
  ): Promise<IComment> {
    this.logger.debug(`👍 Adding reaction to comment: ${commentId}`);

    // Note: We should validate that the comment belongs to the discussion
    return this.discussionsService.reactToComment(commentId, reactDto.agentId, reactDto.reaction);
  }

  @Post(':id/summary')
  @ApiOperation({ 
    summary: 'Generate discussion summary',
    description: 'Generate an AI-powered summary of the discussion'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Summary generated successfully',
    schema: {
      type: 'object',
      properties: {
        keyPoints: { type: 'array', items: { type: 'string' } },
        actionItems: { type: 'array', items: { type: 'string' } },
        consensusAreas: { type: 'array', items: { type: 'string' } },
        concerns: { type: 'array', items: { type: 'string' } },
        sentiment: { 
          type: 'object',
          properties: {
            overall: { type: 'string', enum: ['positive', 'neutral', 'negative'] }
          }
        }
      }
    }
  })
  async generateSummary(@Param('id') id: string): Promise<DiscussionSummary> {
    this.logger.log(`📊 Generating summary for discussion: ${id}`);
    
    const summary = await this.discussionsService.generateSummary(id);
    
    this.logger.log(`✅ Summary generated for discussion: ${id}`);
    return summary;
  }

  @Post(':id/orchestrate')
  @ApiOperation({ 
    summary: 'Manually trigger AI orchestration',
    description: 'Manually trigger AI models to comment on the discussion'
  })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'AI orchestration triggered successfully'
  })
  async triggerOrchestration(@Param('id') id: string): Promise<{ message: string; status: string; discussionId?: string; proposalId?: string }> {
    this.logger.log(`🎭 Manually triggering AI orchestration for discussion: ${id}`);
    
    try {
      // Get discussion details
      const discussion = await this.discussionsService.getDiscussion(id);
      
      // Trigger orchestration manually
      await this.discussionOrchestrator.handleDiscussionCreated(discussion);
      
      return {
        message: `AI orchestration triggered for discussion ${id}`,
        status: 'orchestrating',
        discussionId: id,
        proposalId: discussion.proposalId
      };
    } catch (error) {
      this.logger.error(`Error triggering orchestration: ${error.message}`);
      throw error;
    }
  }

  @Post('recalculate-participants')
  @ApiOperation({ summary: 'Recalculate participants for all discussions' })
  @ApiResponse({ status: 200, description: 'Participants recalculated successfully' })
  async recalculateParticipants() {
    this.logger.log('Manual recalculation of participants triggered');
    
    try {
      await this.discussionsService.recalculateAllParticipants();
      
      return {
        success: true,
        message: 'Participants recalculated successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to recalculate participants: ${error.message}`);
      throw new BadRequestException(`Failed to recalculate participants: ${error.message}`);
    }
  }

  @Post('check-timeouts')
  @ApiOperation({ summary: 'Check and finalize discussions that have exceeded timeout' })
  @ApiResponse({ status: 200, description: 'Timeout check completed' })
  async checkTimeouts() {
    this.logger.log('Manual timeout check triggered');
    
    try {
      const result = await this.discussionsService.checkAndFinalizeTimeoutDiscussions();
      
      return {
        success: true,
        message: `Checked ${result.checked} discussions, finalized ${result.finalized.length}`,
        ...result
      };
    } catch (error) {
      this.logger.error(`Failed to check timeouts: ${error.message}`);
      throw new BadRequestException(`Failed to check timeouts: ${error.message}`);
    }
  }

  @Post(':id/finalize-timeout')
  @ApiOperation({ summary: 'Finalize a specific discussion due to timeout' })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ status: 200, description: 'Discussion finalized successfully' })
  async finalizeTimeout(@Param('id') discussionId: string) {
    this.logger.log(`Manual timeout finalization for discussion: ${discussionId}`);
    
    try {
      await this.discussionsService.finalizeDiscussion(discussionId, 'timeout');
      
      return {
        success: true,
        message: `Discussion ${discussionId} finalized due to timeout`,
        discussionId
      };
    } catch (error) {
      this.logger.error(`Failed to finalize discussion ${discussionId}: ${error.message}`);
      throw new BadRequestException(`Failed to finalize discussion: ${error.message}`);
    }
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Restart AI orchestration for a discussion' })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ status: 200, description: 'Discussion restarted successfully' })
  async restartDiscussion(@Param('id') discussionId: string) {
    this.logger.log(`Manual restart for discussion: ${discussionId}`);
    
    try {
      // Get discussion details
      const discussion = await this.discussionsService.getDiscussion(discussionId);
      
      // Check if discussion is still active
      if (discussion.status !== 'active') {
        throw new BadRequestException('Only active discussions can be restarted');
      }
      
      // Check if discussion has not timed out
      if (discussion.timeoutAt && new Date() > new Date(discussion.timeoutAt)) {
        throw new BadRequestException('Discussion has timed out and cannot be restarted');
      }
      
      // Trigger AI orchestration
      await this.discussionOrchestrator.handleDiscussionCreated(discussion);
      
      return {
        success: true,
        message: `Discussion ${discussionId} restarted successfully`,
        discussionId,
        status: 'restarted'
      };
    } catch (error) {
      this.logger.error(`Failed to restart discussion ${discussionId}: ${error.message}`);
      throw new BadRequestException(`Failed to restart discussion: ${error.message}`);
    }
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Manually finalize a discussion' })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ status: 200, description: 'Discussion finalized successfully' })
  async finalizeDiscussion(@Param('id') discussionId: string) {
    this.logger.log(`Manual finalization for discussion: ${discussionId}`);
    
    try {
      await this.discussionsService.finalizeDiscussion(discussionId, 'manual');
      
      return {
        success: true,
        message: `Discussion ${discussionId} finalized successfully`,
        discussionId
      };
    } catch (error) {
      this.logger.error(`Failed to finalize discussion ${discussionId}: ${error.message}`);
      throw new BadRequestException(`Failed to finalize discussion: ${error.message}`);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a discussion and all its comments' })
  @ApiParam({ name: 'id', description: 'Discussion ID' })
  @ApiResponse({ status: 200, description: 'Discussion deleted successfully' })
  async deleteDiscussion(@Param('id') discussionId: string) {
    this.logger.log(`Deleting discussion: ${discussionId}`);
    
    try {
      await this.discussionsService.deleteDiscussion(discussionId);
      
      return {
        success: true,
        message: `Discussion ${discussionId} deleted successfully`,
        discussionId
      };
    } catch (error) {
      this.logger.error(`Failed to delete discussion ${discussionId}: ${error.message}`);
      throw new BadRequestException(`Failed to delete discussion: ${error.message}`);
    }
  }
}