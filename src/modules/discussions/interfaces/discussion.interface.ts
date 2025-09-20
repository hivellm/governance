export enum DiscussionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CLOSED = 'closed',
  ARCHIVED = 'archived'
}

export enum CommentType {
  COMMENT = 'comment',
  SUGGESTION = 'suggestion',
  OBJECTION = 'objection',
  SUPPORT = 'support',
  QUESTION = 'question',
  CLARIFICATION = 'clarification'
}

export enum ReactionType {
  SUPPORT = 'support',
  NEUTRAL = 'neutral',
  CONCERN = 'concern',
  AGREE = 'agree',
  DISAGREE = 'disagree'
}

export interface IDiscussion {
  id: string;
  proposalId: string;
  status: DiscussionStatus;
  title?: string;
  description?: string;
  participants: string[]; // Agent IDs
  moderators: string[]; // Agent IDs with moderation rights
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  timeoutAt?: Date;
  settings: DiscussionSettings;
  summary?: DiscussionSummary;
  metadata: Record<string, any>;
}

export interface DiscussionSettings {
  maxDurationMinutes: number;
  allowAnonymousComments: boolean;
  requireModeration: boolean;
  maxCommentsPerAgent: number;
  allowThreading: boolean;
  autoClose: boolean;
  minParticipants?: number;
  maxParticipants?: number;
}

export interface IComment {
  id: string;
  discussionId: string;
  authorId: string;
  parentId?: string; // For threading
  type: CommentType;
  content: string;
  references: string[]; // Referenced sections, other comments, etc.
  reactions: Record<ReactionType, string[]>; // Agent IDs who reacted
  isModerated: boolean;
  moderationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface DiscussionSummary {
  keyPoints: string[];
  actionItems: string[];
  consensusAreas: string[];
  concerns: string[];
  participants: {
    id: string;
    contributionCount: number;
    engagementScore: number;
  }[];
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    breakdown: Record<string, number>;
  };
  generatedAt: Date;
  generatedBy: string; // Agent ID or 'system'
}

export interface CreateDiscussionRequest {
  proposalId: string;
  title?: string;
  description?: string;
  moderators?: string[];
  settings?: Partial<DiscussionSettings>;
  metadata?: Record<string, any>;
}

export interface UpdateDiscussionRequest {
  title?: string;
  description?: string;
  status?: DiscussionStatus;
  moderators?: string[];
  settings?: Partial<DiscussionSettings>;
  metadata?: Record<string, any>;
}

export interface CreateCommentRequest {
  discussionId: string;
  authorId: string;
  parentId?: string;
  type: CommentType;
  content: string;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateCommentRequest {
  content?: string;
  type?: CommentType;
  references?: string[];
  metadata?: Record<string, any>;
}

export interface DiscussionSearchFilters {
  proposalId?: string;
  status?: DiscussionStatus[];
  participantId?: string;
  moderatorId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  hasActiveSummary?: boolean;
}

export interface CommentSearchFilters {
  discussionId?: string;
  authorId?: string;
  type?: CommentType[];
  parentId?: string;
  hasReactions?: boolean;
  isModerated?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface DiscussionAnalytics {
  totalDiscussions: number;
  activeDiscussions: number;
  averageDuration: number;
  averageParticipants: number;
  totalComments: number;
  engagementMetrics: {
    averageCommentsPerParticipant: number;
    participationRate: number;
    moderationRate: number;
  };
  sentimentAnalysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

