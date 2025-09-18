import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import { 
  IDiscussion, 
  IComment, 
  DiscussionStatus, 
  CommentType,
  ReactionType,
  DiscussionSettings,
  DiscussionSummary,
  CreateDiscussionRequest,
  UpdateDiscussionRequest,
  CreateCommentRequest,
  UpdateCommentRequest,
  DiscussionSearchFilters,
  CommentSearchFilters,
  DiscussionAnalytics
} from './interfaces/discussion.interface';

@Injectable()
export class DiscussionsService {
  private readonly logger = new Logger(DiscussionsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Create a new discussion
   */
  async createDiscussion(createRequest: CreateDiscussionRequest): Promise<IDiscussion> {
    this.logger.debug(`Creating discussion for proposal: ${createRequest.proposalId}`);

    // Check if proposal exists
    const db = this.databaseService.getDatabase();
    const proposal = db.prepare('SELECT * FROM proposals WHERE id = ?').get(createRequest.proposalId);
    
    if (!proposal) {
      throw new NotFoundException(`Proposal ${createRequest.proposalId} not found`);
    }

    // Check if discussion already exists for this proposal
    const existingDiscussion = db.prepare(
      'SELECT * FROM discussions WHERE proposal_id = ? AND status != ?'
    ).get(createRequest.proposalId, DiscussionStatus.ARCHIVED);

    if (existingDiscussion) {
      throw new BadRequestException(`Active discussion already exists for proposal ${createRequest.proposalId}`);
    }

    const discussionId = uuidv4();
    const now = new Date();

    // Default settings
    const defaultSettings: DiscussionSettings = {
      maxDurationMinutes: 60,
      allowAnonymousComments: false,
      requireModeration: false,
      maxCommentsPerAgent: 10,
      allowThreading: true,
      autoClose: true,
      minParticipants: 3,
      maxParticipants: 20
    };

    const settings = { ...defaultSettings, ...createRequest.settings };
    const timeoutAt = new Date(now.getTime() + settings.maxDurationMinutes * 60 * 1000);

    const discussion: IDiscussion = {
      id: discussionId,
      proposalId: createRequest.proposalId,
      status: DiscussionStatus.ACTIVE,
      title: createRequest.title,
      description: createRequest.description,
      participants: [],
      moderators: createRequest.moderators || [],
      createdAt: now,
      updatedAt: now,
      timeoutAt,
      settings,
      metadata: createRequest.metadata || {}
    };

    // Insert into database
    db.prepare(`
      INSERT INTO discussions (
        id, proposal_id, status, participants, summary, 
        created_at, closed_at, timeout_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      discussion.id,
      discussion.proposalId,
      discussion.status,
      JSON.stringify(discussion.participants),
      JSON.stringify({
        title: discussion.title,
        description: discussion.description,
        moderators: discussion.moderators,
        settings: discussion.settings,
        metadata: discussion.metadata
      }),
      discussion.createdAt.toISOString(),
      null,
      discussion.timeoutAt?.toISOString()
    );

    this.eventEmitter.emit('discussion.created', discussion);
    this.logger.log(`✅ Discussion created: ${discussionId} for proposal ${createRequest.proposalId}`);

    return discussion;
  }

  /**
   * Get discussion by ID
   */
  async getDiscussion(discussionId: string): Promise<IDiscussion> {
    const db = this.databaseService.getDatabase();
    const row = db.prepare('SELECT * FROM discussions WHERE id = ?').get(discussionId);

    if (!row) {
      throw new NotFoundException(`Discussion ${discussionId} not found`);
    }

    return this.mapRowToDiscussion(row);
  }

  /**
   * List discussions with filters
   */
  async listDiscussions(
    filters: DiscussionSearchFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    items: IDiscussion[];
    total: number;
    page: number;
    limit: number;
  }> {
    const db = this.databaseService.getDatabase();
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.proposalId) {
      conditions.push('proposal_id = ?');
      params.push(filters.proposalId);
    }

    if (filters.status?.length) {
      const placeholders = filters.status.map(() => '?').join(',');
      conditions.push(`status IN (${placeholders})`);
      params.push(...filters.status);
    }

    if (filters.createdAfter) {
      conditions.push('created_at >= ?');
      params.push(filters.createdAfter.toISOString());
    }

    if (filters.createdBefore) {
      conditions.push('created_at <= ?');
      params.push(filters.createdBefore.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM discussions ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params) as { total: number };

    // Get paginated results
    const dataQuery = `
      SELECT * FROM discussions ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(dataQuery).all(...params, limit, offset);

    const items = rows.map(row => this.mapRowToDiscussion(row));

    return {
      items,
      total: countResult.total,
      page,
      limit
    };
  }

  /**
   * Add comment to discussion
   */
  async addComment(createRequest: CreateCommentRequest): Promise<IComment> {
    this.logger.debug(`Adding comment to discussion: ${createRequest.discussionId}`);

    const discussion = await this.getDiscussion(createRequest.discussionId);

    // Check if discussion is active
    if (discussion.status !== DiscussionStatus.ACTIVE) {
      throw new BadRequestException('Cannot add comments to inactive discussions');
    }

    const commentId = uuidv4();
    const now = new Date();

    const comment: IComment = {
      id: commentId,
      discussionId: createRequest.discussionId,
      authorId: createRequest.authorId,
      parentId: createRequest.parentId,
      type: createRequest.type,
      content: createRequest.content,
      references: createRequest.references || [],
      reactions: {} as Record<ReactionType, string[]>,
      isModerated: false,
      createdAt: now,
      updatedAt: now,
      metadata: createRequest.metadata || {}
    };

    // Insert into database
    const db = this.databaseService.getDatabase();
    db.prepare(`
      INSERT INTO comments (
        id, discussion_id, author_id, content, type, 
        parent_id, created_at, reactions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      comment.id,
      comment.discussionId,
      comment.authorId,
      comment.content,
      comment.type,
      comment.parentId,
      comment.createdAt.toISOString(),
      JSON.stringify({
        references: comment.references,
        metadata: comment.metadata,
        reactions: comment.reactions
      })
    );

    this.eventEmitter.emit('comment.created', comment);
    this.logger.log(`✅ Comment added: ${commentId} by ${createRequest.authorId}`);

    return comment;
  }

  /**
   * Get comments for discussion
   */
  async getDiscussionComments(
    discussionId: string,
    filters: CommentSearchFilters = {}
  ): Promise<IComment[]> {
    const db = this.databaseService.getDatabase();
    
    const conditions: string[] = ['discussion_id = ?'];
    const params: any[] = [discussionId];

    if (filters.authorId) {
      conditions.push('author_id = ?');
      params.push(filters.authorId);
    }

    if (filters.type?.length) {
      const placeholders = filters.type.map(() => '?').join(',');
      conditions.push(`type IN (${placeholders})`);
      params.push(...filters.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const query = `SELECT * FROM comments ${whereClause} ORDER BY created_at ASC`;
    
    const rows = db.prepare(query).all(...params);
    return rows.map(row => this.mapRowToComment(row));
  }

  /**
   * Generate discussion summary
   */
  async generateSummary(discussionId: string): Promise<DiscussionSummary> {
    const discussion = await this.getDiscussion(discussionId);
    const comments = await this.getDiscussionComments(discussionId);

    // Basic summary generation (placeholder for AI integration)
    const keyPoints = this.extractKeyPoints(comments);
    const actionItems = this.extractActionItems(comments);
    const consensusAreas = this.identifyConsensusAreas(comments);
    const concerns = this.identifyConcerns(comments);

    const participantStats = discussion.participants.map(agentId => {
      const agentComments = comments.filter(c => c.authorId === agentId);
      return {
        id: agentId,
        contributionCount: agentComments.length,
        engagementScore: this.calculateEngagementScore(agentComments)
      };
    });

    const sentiment = this.analyzeSentiment(comments);

    const summary: DiscussionSummary = {
      keyPoints,
      actionItems,
      consensusAreas,
      concerns,
      participants: participantStats,
      sentiment,
      generatedAt: new Date(),
      generatedBy: 'system'
    };

    this.logger.log(`✅ Summary generated for discussion: ${discussionId}`);
    return summary;
  }

  // Private helper methods
  private extractKeyPoints(comments: IComment[]): string[] {
    const suggestions = comments.filter(c => c.type === CommentType.SUGGESTION);
    return suggestions.slice(0, 5).map(c => c.content.substring(0, 100) + '...');
  }

  private extractActionItems(comments: IComment[]): string[] {
    const actionWords = ['should', 'must', 'need to', 'recommend'];
    return comments
      .filter(c => actionWords.some(word => c.content.toLowerCase().includes(word)))
      .slice(0, 3)
      .map(c => c.content.substring(0, 100) + '...');
  }

  private identifyConsensusAreas(comments: IComment[]): string[] {
    const supportComments = comments.filter(c => c.type === CommentType.SUPPORT);
    return supportComments.slice(0, 3).map(c => c.content.substring(0, 100) + '...');
  }

  private identifyConcerns(comments: IComment[]): string[] {
    const objections = comments.filter(c => c.type === CommentType.OBJECTION);
    return objections.slice(0, 3).map(c => c.content.substring(0, 100) + '...');
  }

  private calculateEngagementScore(comments: IComment[]): number {
    return Math.min(comments.length * 0.2, 1.0);
  }

  private analyzeSentiment(comments: IComment[]): DiscussionSummary['sentiment'] {
    const supportCount = comments.filter(c => c.type === CommentType.SUPPORT).length;
    const objectionCount = comments.filter(c => c.type === CommentType.OBJECTION).length;
    const total = comments.length;

    if (total === 0) {
      return { overall: 'neutral', breakdown: {} };
    }

    const positiveRatio = supportCount / total;
    const negativeRatio = objectionCount / total;

    let overall: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveRatio > 0.6) overall = 'positive';
    else if (negativeRatio > 0.4) overall = 'negative';

    return {
      overall,
      breakdown: {
        positive: positiveRatio,
        negative: negativeRatio,
        neutral: 1 - positiveRatio - negativeRatio
      }
    };
  }

  private mapRowToDiscussion(row: any): IDiscussion {
    const summaryData = JSON.parse(row.summary || '{}');
    
    return {
      id: row.id,
      proposalId: row.proposal_id,
      status: row.status as DiscussionStatus,
      title: summaryData.title,
      description: summaryData.description,
      participants: JSON.parse(row.participants || '[]'),
      moderators: summaryData.moderators || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at),
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
      timeoutAt: row.timeout_at ? new Date(row.timeout_at) : undefined,
      settings: summaryData.settings || {},
      summary: summaryData.summary,
      metadata: summaryData.metadata || {}
    };
  }

  /**
   * Update discussion
   */
  async updateDiscussion(discussionId: string, updateRequest: UpdateDiscussionRequest, agentId: string): Promise<IDiscussion> {
    const discussion = await this.getDiscussion(discussionId);

    // Check if agent has permission to update (must be moderator)
    if (!discussion.moderators.includes(agentId)) {
      throw new ForbiddenException('Only moderators can update discussions');
    }

    const now = new Date();
    const updatedDiscussion = {
      ...discussion,
      title: updateRequest.title !== undefined ? updateRequest.title : discussion.title,
      description: updateRequest.description !== undefined ? updateRequest.description : discussion.description,
      status: updateRequest.status || discussion.status,
      moderators: updateRequest.moderators || discussion.moderators,
      settings: updateRequest.settings ? { ...discussion.settings, ...updateRequest.settings } : discussion.settings,
      metadata: updateRequest.metadata ? { ...discussion.metadata, ...updateRequest.metadata } : discussion.metadata,
      updatedAt: now,
      closedAt: updateRequest.status === DiscussionStatus.CLOSED ? now : discussion.closedAt
    };

    // Update in database
    const db = this.databaseService.getDatabase();
    db.prepare(`
      UPDATE discussions 
      SET status = ?, summary = ?, closed_at = ?
      WHERE id = ?
    `).run(
      updatedDiscussion.status,
      JSON.stringify({
        title: updatedDiscussion.title,
        description: updatedDiscussion.description,
        moderators: updatedDiscussion.moderators,
        settings: updatedDiscussion.settings,
        metadata: updatedDiscussion.metadata
      }),
      updatedDiscussion.closedAt?.toISOString(),
      discussionId
    );

    this.eventEmitter.emit('discussion.updated', { discussion: updatedDiscussion, updatedBy: agentId });
    this.logger.log(`✅ Discussion updated: ${discussionId} by ${agentId}`);

    return updatedDiscussion;
  }

  /**
   * React to comment
   */
  async reactToComment(commentId: string, agentId: string, reaction: ReactionType): Promise<IComment> {
    const comment = await this.getComment(commentId);
    
    // Initialize reactions object if needed
    if (!comment.reactions) {
      comment.reactions = {} as Record<ReactionType, string[]>;
    }

    // Remove agent from all reaction types first
    Object.keys(comment.reactions).forEach(reactionType => {
      const agents = comment.reactions[reactionType as ReactionType];
      if (agents) {
        const index = agents.indexOf(agentId);
        if (index > -1) {
          agents.splice(index, 1);
        }
      }
    });

    // Add agent to new reaction type
    if (!comment.reactions[reaction]) {
      comment.reactions[reaction] = [];
    }
    comment.reactions[reaction].push(agentId);

    // Update in database
    const db = this.databaseService.getDatabase();
    db.prepare(`
      UPDATE comments 
      SET reactions = ?
      WHERE id = ?
    `).run(
      JSON.stringify({
        references: comment.references,
        metadata: comment.metadata,
        reactions: comment.reactions
      }),
      commentId
    );

    this.eventEmitter.emit('comment.reaction', { comment, agentId, reaction });
    this.logger.debug(`Reaction added: ${agentId} -> ${reaction} on comment ${commentId}`);

    return comment;
  }

  /**
   * Get comment by ID
   */
  async getComment(commentId: string): Promise<IComment> {
    const db = this.databaseService.getDatabase();
    const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);

    if (!row) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    return this.mapRowToComment(row);
  }

  private mapRowToComment(row: any): IComment {
    const reactionsData = JSON.parse(row.reactions || '{}');
    
    return {
      id: row.id,
      discussionId: row.discussion_id,
      authorId: row.author_id,
      parentId: row.parent_id,
      type: row.type as CommentType,
      content: row.content,
      references: reactionsData.references || [],
      reactions: reactionsData.reactions || {},
      isModerated: false,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at),
      metadata: reactionsData.metadata || {}
    };
  }
}
