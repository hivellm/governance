import { Controller, Get, Post, Body, Sse, MessageEvent, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { Request, Response } from 'express';
import { GovernanceTool } from './governance.tool';

interface McpRequest {
  method: string;
  params?: any;
}

interface McpResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

@ApiTags('mcp')
@Controller('mcp')
export class McpHttpController {
  private readonly sseClients: Map<string, Subject<MessageEvent>> = new Map();

  constructor(private readonly governanceTool: GovernanceTool) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for MCP server' })
  @ApiResponse({ status: 200, description: 'Server is healthy' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'hivellm-governance-mcp',
      version: '1.0.0'
    };
  }

  @Sse('sse')
  sse(@Req() req: Request, @Res() res: Response): Observable<MessageEvent> {
    const sessionId = req.headers['x-mcp-session-id'] as string || `sse-${Date.now()}`;
    const client = new Subject<MessageEvent>();
    this.sseClients.set(sessionId, client);

    console.log(`MCP SSE client connected: ${sessionId}`);

    req.on('close', () => {
      this.sseClients.delete(sessionId);
      console.log(`MCP SSE client disconnected: ${sessionId}`);
      client.complete();
    });

    return client.asObservable();
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute an MCP tool via HTTP' })
  @ApiBody({ schema: { example: { method: 'governance-health-check', params: {} } } })
  @ApiResponse({ status: 200, description: 'Tool execution result' })
  async executeTool(@Body() request: { method: string; params?: any }): Promise<any> {
    try {
      const { method, params = {} } = request;

      // Create a mock context for HTTP requests
      const context = {
        reportProgress: async (progress: { progress: number; total: number; message?: string }) => {
          // For HTTP, we can't report progress in real-time via this endpoint, so we'll just log it
          console.log(`[MCP Progress - ${method}] ${progress.progress}/${progress.total}: ${progress.message || ''}`);
        },
        log: (message: string) => console.log(`[MCP Tool Log - ${method}] ${message}`),
        mcpServer: null as any, // Not directly used in HTTP context
        mcpRequest: null as any, // Not directly used in HTTP context
      };

      let result: any;

      switch (method) {
        case 'governance-health-check':
          result = await this.governanceTool.healthCheck(params, context);
          break;
        
        case 'list-proposals':
          result = await this.governanceTool.listProposals(params, context);
          break;
        
        case 'get-proposal':
          result = await this.governanceTool.getProposal(params, context);
          break;
        
        case 'list-discussions':
          result = await this.governanceTool.listDiscussions(params, context);
          break;
        
        case 'get-discussion':
          result = await this.governanceTool.getDiscussion(params, context);
          break;
        
        case 'create-discussion':
          result = await this.governanceTool.createDiscussion(params, context);
          break;
        
        case 'list-agents':
          result = await this.governanceTool.listAgents(params, context);
          break;
        
        case 'get-agent':
          result = await this.governanceTool.getAgent(params, context);
          break;
        
        case 'get-governance-status':
          result = await this.governanceTool.getGovernanceStatus(params, context);
          break;
        
        case 'finalize-discussion':
          result = await this.governanceTool.finalizeDiscussion(params, context);
          break;
        
        default:
          throw new Error(`Unknown MCP method: ${method}`);
      }

      return { success: true, result };
    } catch (error) {
      console.error(`Error executing MCP tool ${request.method}:`, error);
      return { success: false, error: error.message };
    }
  }

  @Get('tools')
  @ApiOperation({ summary: 'List available MCP tools' })
  @ApiResponse({ status: 200, description: 'List of available tools' })
  listTools() {
    return {
      tools: [
        {
          name: 'governance-health-check',
          description: 'Check if the governance system is operational',
          parameters: {}
        },
        {
          name: 'list-proposals',
          description: 'List all governance proposals with optional filters',
          parameters: {
            status: { type: 'string', optional: true, description: 'Filter by proposal status' },
            phase: { type: 'string', optional: true, description: 'Filter by governance phase' },
            limit: { type: 'number', optional: true, default: 10, description: 'Maximum number of proposals to return' }
          }
        },
        {
          name: 'get-proposal',
          description: 'Get detailed information about a specific proposal',
          parameters: {
            proposalId: { type: 'string', required: true, description: 'The proposal ID (e.g., P001, P002)' }
          }
        },
        {
          name: 'list-discussions',
          description: 'List active discussions with optional filters',
          parameters: {
            status: { type: 'string', optional: true, description: 'Filter by discussion status' },
            proposalId: { type: 'string', optional: true, description: 'Filter by proposal ID' },
            limit: { type: 'number', optional: true, default: 10, description: 'Maximum number of discussions to return' }
          }
        },
        {
          name: 'get-discussion',
          description: 'Get detailed information about a discussion including comments',
          parameters: {
            discussionId: { type: 'string', required: true, description: 'The discussion ID' }
          }
        },
        {
          name: 'create-discussion',
          description: 'Create a new discussion for a proposal',
          parameters: {
            proposalId: { type: 'string', required: true, description: 'The proposal ID to discuss' },
            title: { type: 'string', required: true, description: 'Discussion title' },
            description: { type: 'string', optional: true, description: 'Discussion description' },
            maxDurationMinutes: { type: 'number', optional: true, description: 'Maximum duration in minutes' },
            maxCommentsPerAgent: { type: 'number', optional: true, description: 'Maximum comments per agent' }
          }
        },
        {
          name: 'list-agents',
          description: 'List all registered agents in the governance system',
          parameters: {
            limit: { type: 'number', optional: true, default: 20, description: 'Maximum number of agents to return' }
          }
        },
        {
          name: 'get-agent',
          description: 'Get detailed information about a specific agent',
          parameters: {
            agentId: { type: 'string', required: true, description: 'The agent ID' }
          }
        },
        {
          name: 'get-governance-status',
          description: 'Get overall governance system status and statistics',
          parameters: {}
        },
        {
          name: 'finalize-discussion',
          description: 'Manually finalize a discussion',
          parameters: {
            discussionId: { type: 'string', required: true, description: 'The discussion ID to finalize' }
          }
        }
      ]
    };
  }
}
