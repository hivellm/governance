import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
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
  ApiBearerAuth,
  ApiBody,
  ApiProperty,
  ApiPropertyOptional
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { 
  IAgent,
  AgentRole,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentSearchFilters,
  AgentPerformanceMetrics
} from './interfaces/agent.interface';

// Additional imports for validation
import { IsString, IsEnum, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';

class CreateAgentDto {
  @ApiProperty({ description: 'Unique agent identifier' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Agent display name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Agent organization/provider' })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiProperty({ description: 'Agent roles', enum: AgentRole, isArray: true })
  @IsArray()
  @IsEnum(AgentRole, { each: true })
  roles: AgentRole[];

  @ApiPropertyOptional({ description: 'Initial permissions override' })
  @IsOptional()
  @IsObject()
  initialPermissions?: any;
}

class UpdateAgentDto {
  @ApiPropertyOptional({ description: 'Agent display name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Agent organization/provider' })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiPropertyOptional({ description: 'Agent roles', enum: AgentRole, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AgentRole, { each: true })
  roles?: AgentRole[];

  @ApiPropertyOptional({ description: 'Agent permissions' })
  @IsOptional()
  @IsObject()
  permissions?: any;

  @ApiPropertyOptional({ description: 'Agent active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class AgentListResponse {
  items: IAgent[];
  total: number;
  page: number;
  limit: number;
}

@ApiTags('agents')
@Controller('api/agents')
@ApiBearerAuth()
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Register a new agent',
    description: 'Registers a new agent in the governance system with specified roles and permissions. Agent ID must be unique.'
  })
  @ApiBody({ type: CreateAgentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Agent registered successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        organization: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'object' },
        performanceMetrics: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        lastActive: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid agent data or agent ID already exists',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Agent with this ID already exists',
  })
  async createAgent(@Body() createAgentDto: CreateAgentDto): Promise<IAgent> {
    this.logger.log(`Creating agent: ${createAgentDto.id} - "${createAgentDto.name}"`);
    
    const createAgentRequest: CreateAgentRequest = {
      id: createAgentDto.id,
      name: createAgentDto.name,
      organization: createAgentDto.organization,
      roles: createAgentDto.roles,
      initialPermissions: createAgentDto.initialPermissions,
    };
    
    return this.agentsService.createAgent(createAgentRequest);
  }

  @Get()
  @ApiOperation({ 
    summary: 'List agents with filtering',
    description: 'Retrieves a paginated list of agents with optional filtering by roles, organization, and activity status.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'roles', required: false, type: [String], description: 'Filter by agent roles' })
  @ApiQuery({ name: 'organization', required: false, type: String, description: 'Filter by organization' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by activity status' })
  @ApiQuery({ name: 'minQualityScore', required: false, type: Number, description: 'Minimum quality score' })
  @ApiQuery({ name: 'minConsensusScore', required: false, type: Number, description: 'Minimum consensus score' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agents retrieved successfully',
    type: AgentListResponse,
  })
  async findAllAgents(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('roles') roles?: string | string[],
    @Query('organization') organization?: string,
    @Query('isActive') isActive?: boolean,
    @Query('minQualityScore') minQualityScore?: number,
    @Query('minConsensusScore') minConsensusScore?: number
  ): Promise<AgentListResponse> {
    this.logger.log('Listing agents with filters');
    
    // Validate and convert parameters
    const validatedLimit = Math.min(Math.max(1, limit || 50), 100);
    const validatedPage = Math.max(1, page || 1);
    
    // Process roles parameter
    let processedRoles: AgentRole[] | undefined;
    if (roles) {
      const roleArray = Array.isArray(roles) ? roles : [roles];
      processedRoles = roleArray.filter(role => 
        Object.values(AgentRole).includes(role as AgentRole)
      ) as AgentRole[];
    }
    
    const filters: AgentSearchFilters = {
      roles: processedRoles,
      organization,
      isActive,
      minQualityScore: (minQualityScore && !isNaN(minQualityScore)) ? minQualityScore : undefined,
      minConsensusScore: (minConsensusScore && !isNaN(minConsensusScore)) ? minConsensusScore : undefined,
    };
    
    return this.agentsService.findAll(filters, validatedPage, validatedLimit);
  }

  @Get('statistics')
  @ApiOperation({ 
    summary: 'Get agent statistics',
    description: 'Retrieves aggregate statistics for agents including counts by role, organization, and permission level.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total number of agents' },
        active: { type: 'number', description: 'Number of active agents' },
        byRole: { type: 'object', description: 'Count of agents by role' },
        byOrganization: { type: 'object', description: 'Count of agents by organization' },
        byPermissionLevel: { type: 'object', description: 'Count of agents by permission level' }
      }
    }
  })
  async getStatistics() {
    this.logger.log('Getting agent statistics');
    
    return this.agentsService.getAgentStatistics();
  }

  @Get('roles/available')
  @ApiOperation({ 
    summary: 'Get available agent roles',
    description: 'Returns the list of available agent roles in the governance system.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available roles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        roles: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'List of available agent roles'
        },
        descriptions: {
          type: 'object',
          description: 'Role descriptions and permission levels'
        }
      }
    }
  })
  async getAvailableRoles() {
    this.logger.log('Getting available agent roles');
    
    const roleDescriptions = {
      [AgentRole.PROPOSER]: { 
        description: 'Can submit new proposals and respond to feedback', 
        level: 2 
      },
      [AgentRole.DISCUSSANT]: { 
        description: 'Can participate in technical debates and discussions', 
        level: 1 
      },
      [AgentRole.REVIEWER]: { 
        description: 'Can perform technical feasibility analysis and security reviews', 
        level: 3 
      },
      [AgentRole.MEDIATOR]: { 
        description: 'Can manage phase transitions and enforce protocols', 
        level: 4 
      },
      [AgentRole.VOTER]: { 
        description: 'Can cast justified votes on proposals', 
        level: 2 
      },
      [AgentRole.EXECUTOR]: { 
        description: 'Can implement approved proposals', 
        level: 3 
      },
      [AgentRole.SUMMARIZER]: { 
        description: 'Can generate discussion summaries and documentation', 
        level: 2 
      },
    };
    
    return {
      roles: Object.values(AgentRole),
      descriptions: roleDescriptions,
    };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get agent by ID',
    description: 'Retrieves a specific agent by their unique identifier including roles, permissions, and performance metrics.'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        organization: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'object' },
        performanceMetrics: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        lastActive: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async findAgent(@Param('id') id: string): Promise<IAgent> {
    this.logger.log(`Retrieving agent: ${id}`);
    
    return this.agentsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update agent information',
    description: 'Updates an existing agent\'s name, organization, roles, permissions, or activity status.'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiBody({ type: UpdateAgentDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        organization: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'object' },
        performanceMetrics: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        lastActive: { type: 'string', format: 'date-time' },
        isActive: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid agent data provided',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async updateAgent(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto
  ): Promise<IAgent> {
    this.logger.log(`Updating agent: ${id}`);
    
    const updateAgentRequest: UpdateAgentRequest = {
      name: updateAgentDto.name,
      organization: updateAgentDto.organization,
      roles: updateAgentDto.roles,
      permissions: updateAgentDto.permissions,
      isActive: updateAgentDto.isActive,
    };
    
    return this.agentsService.updateAgent(id, updateAgentRequest);
  }

  @Post(':id/deactivate')
  @ApiOperation({ 
    summary: 'Deactivate agent',
    description: 'Deactivates an agent, preventing them from participating in governance activities.'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent deactivated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        isActive: { type: 'boolean', example: false }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async deactivateAgent(@Param('id') id: string): Promise<IAgent> {
    this.logger.log(`Deactivating agent: ${id}`);
    
    return this.agentsService.deactivateAgent(id);
  }

  @Post(':id/reactivate')
  @ApiOperation({ 
    summary: 'Reactivate agent',
    description: 'Reactivates a previously deactivated agent, restoring their governance participation rights.'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Agent reactivated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        isActive: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async reactivateAgent(@Param('id') id: string): Promise<IAgent> {
    this.logger.log(`Reactivating agent: ${id}`);
    
    return this.agentsService.reactivateAgent(id);
  }

  @Post(':id/update-metrics')
  @ApiOperation({ 
    summary: 'Update agent performance metrics',
    description: 'Updates performance metrics for an agent including quality scores, participation rates, and response times.'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        totalProposals: { type: 'number' },
        approvedProposals: { type: 'number' },
        totalVotes: { type: 'number' },
        totalDiscussions: { type: 'number' },
        totalComments: { type: 'number' },
        consensusScore: { type: 'number', minimum: 0, maximum: 100 },
        participationRate: { type: 'number', minimum: 0, maximum: 100 },
        responseTime: { type: 'number', minimum: 0 },
        qualityScore: { type: 'number', minimum: 0, maximum: 100 }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Performance metrics updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        performanceMetrics: { type: 'object' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async updateMetrics(
    @Param('id') id: string,
    @Body() metrics: Partial<AgentPerformanceMetrics>
  ): Promise<IAgent> {
    this.logger.log(`Updating performance metrics for agent: ${id}`);
    
    return this.agentsService.updatePerformanceMetrics(id, metrics);
  }

  @Get(':id/permissions/:permission')
  @ApiOperation({ 
    summary: 'Check agent permission',
    description: 'Checks if an agent has a specific permission (e.g., canPropose, canVote, canExecute).'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiParam({ name: 'permission', description: 'Permission to check (e.g., canPropose, canVote)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission check result',
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        permission: { type: 'string' },
        hasPermission: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async checkPermission(
    @Param('id') id: string,
    @Param('permission') permission: string
  ): Promise<{ agentId: string; permission: string; hasPermission: boolean }> {
    this.logger.log(`Checking permission ${permission} for agent: ${id}`);
    
    const hasPermission = await this.agentsService.hasPermission(id, permission as any);
    
    return {
      agentId: id,
      permission,
      hasPermission,
    };
  }

  @Get(':id/roles/:role')
  @ApiOperation({ 
    summary: 'Check agent role',
    description: 'Checks if an agent has a specific role (e.g., proposer, voter, reviewer).'
  })
  @ApiParam({ name: 'id', description: 'Unique agent identifier' })
  @ApiParam({ name: 'role', description: 'Role to check', enum: Object.values(AgentRole) })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role check result',
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        role: { type: 'string' },
        hasRole: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Agent not found',
  })
  async checkRole(
    @Param('id') id: string,
    @Param('role') role: string
  ): Promise<{ agentId: string; role: string; hasRole: boolean }> {
    this.logger.log(`Checking role ${role} for agent: ${id}`);
    
    // Validate role
    if (!Object.values(AgentRole).includes(role as AgentRole)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    
    const hasRole = await this.agentsService.hasRole(id, [role as AgentRole]);
    
    return {
      agentId: id,
      role,
      hasRole,
    };
  }

}
