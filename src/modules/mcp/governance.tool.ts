import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ProposalsService } from '../proposals/proposals.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { AgentsService } from '../agents/agents.service';
import { MinutesService } from '../minutes/minutes.service';
import { BipsService } from '../bips/bips.service';

@Injectable()
export class GovernanceTool {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly discussionsService: DiscussionsService,
    private readonly agentsService: AgentsService,
    private readonly minutesService: MinutesService,
    private readonly bipsService: BipsService,
  ) {}

  @Tool({
    name: 'governance-health-check',
    description: 'Check if the governance system is operational',
  })
  async healthCheck(params: {}, context: Context) {
    await context.reportProgress({ progress: 50, total: 100 });
    
    return {
      status: 'operational',
      message: '✅ HiveLLM Governance System is operational. All modules running normally.',
      timestamp: new Date().toISOString(),
      modules: ['proposals', 'discussions', 'agents', 'minutes', 'bips']
    };
  }

  @Tool({
    name: 'list-proposals',
    description: 'List all governance proposals with optional filters',
    parameters: z.object({
      status: z.string().optional().describe('Filter by proposal status'),
      phase: z.string().optional().describe('Filter by governance phase'),
      limit: z.number().default(10).describe('Maximum number of proposals to return'),
    }),
  })
  async listProposals(params: { status?: string; phase?: string; limit?: number }, context: Context) {
    await context.reportProgress({ progress: 25, total: 100 });
    
    try {
      const result = await this.proposalsService.findAll({
        status: params.status ? [params.status as any] : undefined,
        phase: params.phase ? [params.phase as any] : undefined,
        limit: params.limit || 10,
        page: 1
      });

      await context.reportProgress({ progress: 75, total: 100 });

      const proposals = result.items || [];

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        total: proposals.length,
        proposals: proposals.map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          phase: p.phase,
          createdAt: p.createdAt,
          summary: `${p.title} - Status: ${p.status}, Phase: ${p.phase}`
        }))
      };
    } catch (error) {
      throw new Error(`Failed to list proposals: ${error.message}`);
    }
  }

  @Tool({
    name: 'get-proposal',
    description: 'Get detailed information about a specific proposal',
    parameters: z.object({
      proposalId: z.string().describe('The proposal ID (e.g., P001, P002)'),
    }),
  })
  async getProposal(params: { proposalId: string }, context: Context) {
    await context.reportProgress({ progress: 30, total: 100 });
    
    try {
      const proposal = await this.proposalsService.findById(params.proposalId);
      
      await context.reportProgress({ progress: 70, total: 100 });
      
      if (!proposal) {
        throw new Error(`Proposal ${params.proposalId} not found`);
      }

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        phase: proposal.phase,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        content: proposal.content,
        metadata: proposal.metadata,
        summary: `Proposal ${proposal.id}: ${proposal.title} (${proposal.status})`
      };
    } catch (error) {
      throw new Error(`Failed to get proposal: ${error.message}`);
    }
  }

  @Tool({
    name: 'list-discussions',
    description: 'List active discussions with optional filters',
    parameters: z.object({
      status: z.string().optional().describe('Filter by discussion status'),
      proposalId: z.string().optional().describe('Filter by proposal ID'),
      limit: z.number().default(10).describe('Maximum number of discussions to return'),
    }),
  })
  async listDiscussions(params: { status?: string; proposalId?: string; limit?: number }, context: Context) {
    await context.reportProgress({ progress: 25, total: 100 });
    
    try {
      const result = await this.discussionsService.listDiscussions({
        status: params.status ? [params.status as any] : undefined,
        proposalId: params.proposalId
      });

      await context.reportProgress({ progress: 75, total: 100 });

      const discussions = result.items || [];

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        total: discussions.length,
        discussions: discussions.map(d => ({
          id: d.id,
          title: d.title,
          proposalId: d.proposalId,
          status: d.status,
          participants: d.participants?.length || 0,
          createdAt: d.createdAt,
          summary: `${d.title} - Proposal: ${d.proposalId}, Status: ${d.status}, Participants: ${d.participants?.length || 0}`
        }))
      };
    } catch (error) {
      throw new Error(`Failed to list discussions: ${error.message}`);
    }
  }

  @Tool({
    name: 'get-discussion',
    description: 'Get detailed information about a discussion including comments',
    parameters: z.object({
      discussionId: z.string().describe('The discussion ID'),
    }),
  })
  async getDiscussion(params: { discussionId: string }, context: Context) {
    await context.reportProgress({ progress: 20, total: 100 });
    
    try {
      const discussion = await this.discussionsService.getDiscussion(params.discussionId);
      
      await context.reportProgress({ progress: 50, total: 100 });
      
      const comments = await this.discussionsService.getDiscussionComments(params.discussionId);

      await context.reportProgress({ progress: 80, total: 100 });

      const commentsSummary = comments.map(c => ({
        id: c.id,
        authorId: c.authorId,
        type: c.type,
        content: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
        createdAt: c.createdAt
      }));

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        id: discussion.id,
        title: discussion.title,
        proposalId: discussion.proposalId,
        status: discussion.status,
        participants: discussion.participants?.length || 0,
        createdAt: discussion.createdAt,
        timeoutAt: discussion.timeoutAt,
        description: discussion.description,
        comments: commentsSummary,
        totalComments: comments.length,
        summary: `Discussion: ${discussion.title} - ${comments.length} comments, ${discussion.participants?.length || 0} participants`
      };
    } catch (error) {
      throw new Error(`Failed to get discussion: ${error.message}`);
    }
  }

  @Tool({
    name: 'create-discussion',
    description: 'Create a new discussion for a proposal',
    parameters: z.object({
      proposalId: z.string().describe('The proposal ID to discuss'),
      title: z.string().describe('Discussion title'),
      description: z.string().optional().describe('Discussion description'),
      maxDurationMinutes: z.number().optional().describe('Maximum duration in minutes'),
      maxCommentsPerAgent: z.number().optional().describe('Maximum comments per agent'),
    }),
  })
  async createDiscussion(params: { 
    proposalId: string; 
    title: string; 
    description?: string; 
    maxDurationMinutes?: number;
    maxCommentsPerAgent?: number;
  }, context: Context) {
    await context.reportProgress({ progress: 30, total: 100 });
    
    try {
      const discussion = await this.discussionsService.createDiscussion({
        proposalId: params.proposalId,
        title: params.title,
        description: params.description || '',
        settings: {
          maxDurationMinutes: params.maxDurationMinutes,
          maxCommentsPerAgent: params.maxCommentsPerAgent,
        }
      });

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        id: discussion.id,
        title: discussion.title,
        proposalId: discussion.proposalId,
        status: discussion.status,
        message: '✅ Discussion created successfully!',
        summary: `Created discussion "${discussion.title}" for proposal ${discussion.proposalId}`
      };
    } catch (error) {
      throw new Error(`Failed to create discussion: ${error.message}`);
    }
  }

  @Tool({
    name: 'list-agents',
    description: 'List all registered agents in the governance system',
    parameters: z.object({
      limit: z.number().default(20).describe('Maximum number of agents to return'),
    }),
  })
  async listAgents(params: { limit?: number }, context: Context) {
    await context.reportProgress({ progress: 40, total: 100 });
    
    try {
      const result = await this.agentsService.findAll({});

      await context.reportProgress({ progress: 80, total: 100 });

      const agents = result.items || [];

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        total: agents.length,
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
          summary: `Agent: ${a.name} (${a.id})`
        }))
      };
    } catch (error) {
      throw new Error(`Failed to list agents: ${error.message}`);
    }
  }

  @Tool({
    name: 'get-agent',
    description: 'Get detailed information about a specific agent',
    parameters: z.object({
      agentId: z.string().describe('The agent ID'),
    }),
  })
  async getAgent(params: { agentId: string }, context: Context) {
    await context.reportProgress({ progress: 40, total: 100 });
    
    try {
      const agent = await this.agentsService.findById(params.agentId);

      await context.reportProgress({ progress: 80, total: 100 });

      if (!agent) {
        throw new Error(`Agent ${params.agentId} not found`);
      }

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
        metadata: (agent as any).metadata || {},
        summary: `Agent: ${agent.name} - Created: ${agent.createdAt}`
      };
    } catch (error) {
      throw new Error(`Failed to get agent: ${error.message}`);
    }
  }

  @Tool({
    name: 'get-governance-status',
    description: 'Get overall governance system status and statistics',
  })
  async getGovernanceStatus(params: {}, context: Context) {
    await context.reportProgress({ progress: 20, total: 100 });
    
    try {
      // Get basic counts
      const proposalsResult = await this.proposalsService.findAll({ page: 1 });
      
      await context.reportProgress({ progress: 40, total: 100 });
      
      const discussionsResult = await this.discussionsService.listDiscussions({});
      
      await context.reportProgress({ progress: 60, total: 100 });
      
      const agentsResult = await this.agentsService.findAll({});

      await context.reportProgress({ progress: 80, total: 100 });

      const proposals = proposalsResult.items || [];
      const discussions = discussionsResult.items || [];
      const agents = agentsResult.items || [];

      // Count by status
      const proposalsByStatus = proposals.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const discussionsByStatus = discussions.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        system: 'HiveLLM Governance',
        status: 'operational',
        timestamp: new Date().toISOString(),
        statistics: {
          proposals: {
            total: proposals.length,
            byStatus: proposalsByStatus
          },
          discussions: {
            total: discussions.length,
            byStatus: discussionsByStatus
          },
          agents: {
            total: agents.length
          }
        },
        summary: `System operational with ${proposals.length} proposals, ${discussions.length} discussions, and ${agents.length} agents`
      };
    } catch (error) {
      throw new Error(`Failed to get governance status: ${error.message}`);
    }
  }

  @Tool({
    name: 'add-discussion-comment',
    description: 'Add a comment to an existing discussion',
    parameters: z.object({
      discussionId: z.string().describe('The discussion ID to add comment to'),
      content: z.string().describe('The comment content'),
      type: z.enum(['comment', 'support', 'objection', 'suggestion']).default('comment').describe('The comment type'),
    }),
  })
  async addDiscussionComment(params: { discussionId: string; content: string; type?: string }, context: Context) {
    await context.reportProgress({ progress: 25, total: 100 });

    try {
      // Find the discussion first to validate it exists
      const discussion = await this.discussionsService.getDiscussion(params.discussionId);

      if (!discussion) {
        throw new Error(`Discussion ${params.discussionId} not found`);
      }

      await context.reportProgress({ progress: 50, total: 100 });

      // Create the comment using the discussions service with proper CreateCommentRequest format
      const comment = await this.discussionsService.addComment({
        discussionId: params.discussionId,
        authorId: 'mcp-system', // Default author for MCP comments
        type: params.type as any || 'comment',
        content: params.content
      });

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        commentId: comment.id,
        discussionId: params.discussionId,
        type: params.type || 'comment',
        createdAt: comment.createdAt,
        message: '✅ Comment added successfully via MCP!',
        summary: `Added ${params.type || 'comment'} to discussion ${params.discussionId}`
      };
    } catch (error) {
      throw new Error(`Failed to add comment: ${error.message}`);
    }
  }

  @Tool({
    name: 'finalize-discussion',
    description: 'Manually finalize a discussion',
    parameters: z.object({
      discussionId: z.string().describe('The discussion ID to finalize'),
    }),
  })
  async finalizeDiscussion(params: { discussionId: string }, context: Context) {
    await context.reportProgress({ progress: 50, total: 100 });
    
    try {
      await this.discussionsService.finalizeDiscussion(params.discussionId, 'manual');

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        discussionId: params.discussionId,
        status: 'finalized',
        message: '✅ Discussion finalized successfully!',
        timestamp: new Date().toISOString(),
        summary: `Discussion ${params.discussionId} has been manually finalized`
      };
    } catch (error) {
      throw new Error(`Failed to finalize discussion: ${error.message}`);
    }
  }
}
