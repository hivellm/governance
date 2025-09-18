import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AgentsService } from '../agents/agents.service';
import { IAgent, AgentRole } from '../agents/interfaces/agent.interface';

export interface JwtPayload {
  sub: string; // Agent ID
  agentId: string;
  name: string;
  roles: AgentRole[];
  iat?: number;
  exp?: number;
}

export interface LoginDto {
  agentId: string;
  password?: string;
  apiKey?: string;
}

export interface RegisterDto {
  agentId: string;
  name: string;
  password?: string;
  roles?: AgentRole[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly agentsService: AgentsService,
  ) {}

  /**
   * Register a new agent
   */
  async register(registerDto: RegisterDto): Promise<{ agent: IAgent; token: string }> {
    const { agentId, name, roles = [AgentRole.DISCUSSANT] } = registerDto;

    // Check if agent already exists
    const existingAgent = await this.agentsService.findByIdSafe(agentId);
    if (existingAgent) {
      throw new BadRequestException(`Agent with ID '${agentId}' already exists`);
    }

    // Create agent
    const agent = await this.agentsService.createAgent({
      id: agentId,
      name,
      roles,
    });

    // Generate JWT token
    const token = await this.generateToken(agent);

    return { agent, token };
  }

  /**
   * Login with agent credentials
   */
  async login(loginDto: LoginDto): Promise<{ agent: IAgent; token: string }> {
    const { agentId } = loginDto;

    // Find agent
    const agent = await this.agentsService.findByIdSafe(agentId);
    if (!agent) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // For now, allow login without password (simplified auth)
    // In production, you would validate credentials here

    // Generate JWT token
    const token = await this.generateToken(agent);

    return { agent, token };
  }

  /**
   * Validate JWT token and return agent
   */
  async validateToken(payload: JwtPayload): Promise<IAgent> {
    const agent = await this.agentsService.findByIdSafe(payload.agentId);
    if (!agent) {
      throw new UnauthorizedException('Agent not found');
    }

    return agent;
  }

  /**
   * Generate JWT token for agent
   */
  private async generateToken(agent: IAgent): Promise<string> {
    const payload: JwtPayload = {
      sub: agent.id,
      agentId: agent.id,
      name: agent.name,
      roles: agent.roles || [],
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate API key for agent (simplified)
   */
  async generateApiKey(agentId: string): Promise<string> {
    const agent = await this.agentsService.findByIdSafe(agentId);
    if (!agent) {
      throw new BadRequestException('Agent not found');
    }

    // Generate a simple API key
    const apiKey = `hive_${agentId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // In a real implementation, you would store this in the database
    return apiKey;
  }

  /**
   * Revoke API key for agent (simplified)
   */
  async revokeApiKey(agentId: string): Promise<void> {
    const agent = await this.agentsService.findByIdSafe(agentId);
    if (!agent) {
      throw new BadRequestException('Agent not found');
    }

    // In a real implementation, you would remove the API key from the database
  }
}