import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { 
  IAgent, 
  AgentRole, 
  PermissionLevel,
  AgentPermissions,
  AgentPerformanceMetrics,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentSearchFilters
} from './interfaces/agent.interface';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new agent
   */
  async createAgent(createAgentRequest: CreateAgentRequest): Promise<IAgent> {
    this.logger.debug(`Creating new agent: ${createAgentRequest.id} - ${createAgentRequest.name}`);

    // Check if agent already exists
    const existingAgent = await this.findByIdSafe(createAgentRequest.id);
    if (existingAgent) {
      throw new ConflictException(`Agent with ID ${createAgentRequest.id} already exists`);
    }

    // Generate default permissions based on roles
    const permissions = this.generatePermissionsFromRoles(
      createAgentRequest.roles, 
      createAgentRequest.initialPermissions
    );

    // Initialize performance metrics
    const performanceMetrics: AgentPerformanceMetrics = {
      totalProposals: 0,
      approvedProposals: 0,
      totalVotes: 0,
      totalDiscussions: 0,
      totalComments: 0,
      consensusScore: 0,
      participationRate: 0,
      responseTime: 0,
      qualityScore: 0,
      lastUpdated: new Date(),
    };

    const agent: IAgent = {
      id: createAgentRequest.id,
      name: createAgentRequest.name,
      organization: createAgentRequest.organization,
      roles: createAgentRequest.roles,
      permissions,
      performanceMetrics,
      createdAt: new Date(),
      lastActive: new Date(),
      isActive: true,
    };

    try {
      const insertStatement = this.databaseService.getStatement('insertAgent');
      insertStatement.run(
        agent.id,
        agent.name,
        agent.organization || null,
        JSON.stringify(agent.roles),
        JSON.stringify(agent.permissions)
      );

      this.logger.log(`✅ Agent created: ${agent.id} - "${agent.name}" (roles: ${agent.roles.join(', ')})`);
      return agent;
    } catch (error) {
      this.logger.error(`❌ Failed to create agent ${createAgentRequest.id}: ${error.message}`);
      throw new BadRequestException('Failed to create agent');
    }
  }

  /**
   * Find agent by ID
   */
  async findById(id: string): Promise<IAgent> {
    this.logger.debug(`Finding agent: ${id}`);

    const agent = await this.findByIdSafe(id);
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${id}`);
    }

    return agent;
  }

  /**
   * Find agent by ID without throwing exception
   */
  async findByIdSafe(id: string): Promise<IAgent | null> {
    try {
      const getStatement = this.databaseService.getStatement('getAgent');
      const row = getStatement.get(id);

      if (!row) {
        return null;
      }

      return this.mapRowToAgent(row);
    } catch (error) {
      this.logger.error(`❌ Failed to find agent ${id}: ${error.message}`);
      throw new BadRequestException('Failed to retrieve agent');
    }
  }

  /**
   * List all agents with filtering
   */
  async findAll(filters: AgentSearchFilters = {}, page: number = 1, limit: number = 50): Promise<{
    items: IAgent[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.debug('Listing agents with filters', JSON.stringify(filters));

    const offset = (page - 1) * limit;

    // Build dynamic query
    let query = 'SELECT * FROM agents';
    let countQuery = 'SELECT COUNT(*) as total FROM agents';
    const conditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (filters.roles?.length) {
      // Check if agent has any of the specified roles
      const roleConditions = filters.roles.map(() => 'roles LIKE ?').join(' OR ');
      conditions.push(`(${roleConditions})`);
      filters.roles.forEach(role => {
        params.push(`%"${role}"%`);
      });
    }

    if (filters.organization) {
      conditions.push('organization = ?');
      params.push(filters.organization);
    }

    if (filters.isActive !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }

    // Add sorting and pagination
    query += ` ORDER BY last_active DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      // Get total count
      const countStatement = this.databaseService.getDatabase().prepare(countQuery);
      const countResult = countStatement.get(...params.slice(0, -2)) as { total: number };
      const total = countResult.total;

      // Get paginated results
      const listStatement = this.databaseService.getDatabase().prepare(query);
      const rows = listStatement.all(...params);

      const items = rows.map(row => this.mapRowToAgent(row));

      // Apply additional filters that require parsed data
      let filteredItems = items;
      
      if (filters.minQualityScore !== undefined && filters.minQualityScore !== null) {
        filteredItems = filteredItems.filter(agent => 
          agent.performanceMetrics.qualityScore >= filters.minQualityScore!
        );
      }

      if (filters.minConsensusScore !== undefined && filters.minConsensusScore !== null) {
        filteredItems = filteredItems.filter(agent => 
          agent.performanceMetrics.consensusScore >= filters.minConsensusScore!
        );
      }

      const result = {
        items: filteredItems.slice(0, limit), // Re-apply limit after filtering
        total: total, // Use the total from database, not filtered items
        page,
        limit,
      };

      this.logger.debug(`✅ Listed ${items.length} agents (${total} total)`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Failed to list agents: ${error.message}`);
      throw new BadRequestException('Failed to list agents');
    }
  }

  /**
   * Update agent information
   */
  async updateAgent(id: string, updateAgentRequest: UpdateAgentRequest): Promise<IAgent> {
    this.logger.debug(`Updating agent: ${id}`);

    const existingAgent = await this.findById(id);

    // Update permissions if roles changed
    let updatedPermissions = existingAgent.permissions;
    if (updateAgentRequest.roles) {
      updatedPermissions = this.generatePermissionsFromRoles(
        updateAgentRequest.roles, 
        updateAgentRequest.permissions
      );
    } else if (updateAgentRequest.permissions) {
      updatedPermissions = { ...existingAgent.permissions, ...updateAgentRequest.permissions };
    }

    const updatedAgent: IAgent = {
      ...existingAgent,
      name: updateAgentRequest.name || existingAgent.name,
      organization: updateAgentRequest.organization !== undefined ? updateAgentRequest.organization : existingAgent.organization,
      roles: updateAgentRequest.roles || existingAgent.roles,
      permissions: updatedPermissions,
      isActive: updateAgentRequest.isActive !== undefined ? updateAgentRequest.isActive : existingAgent.isActive,
      lastActive: new Date(), // Update activity timestamp
    };

    try {
      const updateQuery = `
        UPDATE agents 
        SET name = ?, organization = ?, roles = ?, permissions = ?, is_active = ?, last_active = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const updateStatement = this.databaseService.getDatabase().prepare(updateQuery);
      updateStatement.run(
        updatedAgent.name,
        updatedAgent.organization || null,
        JSON.stringify(updatedAgent.roles),
        JSON.stringify(updatedAgent.permissions),
        updatedAgent.isActive ? 1 : 0,
        id
      );

      this.logger.log(`✅ Agent updated: ${id} - "${updatedAgent.name}"`);
      return updatedAgent;
    } catch (error) {
      this.logger.error(`❌ Failed to update agent ${id}: ${error.message}`);
      throw new BadRequestException('Failed to update agent');
    }
  }

  /**
   * Deactivate agent (soft delete)
   */
  async deactivateAgent(id: string): Promise<IAgent> {
    this.logger.debug(`Deactivating agent: ${id}`);

    return this.updateAgent(id, { isActive: false });
  }

  /**
   * Reactivate agent
   */
  async reactivateAgent(id: string): Promise<IAgent> {
    this.logger.debug(`Reactivating agent: ${id}`);

    return this.updateAgent(id, { isActive: true });
  }

  /**
   * Update agent activity timestamp
   */
  async updateActivity(id: string): Promise<void> {
    this.logger.debug(`Updating activity for agent: ${id}`);

    try {
      const updateStatement = this.databaseService.getStatement('updateAgentActivity');
      updateStatement.run(id);
    } catch (error) {
      this.logger.warn(`Failed to update activity for agent ${id}: ${error.message}`);
      // Don't throw error for activity updates to avoid breaking main operations
    }
  }

  /**
   * Update agent performance metrics
   */
  async updatePerformanceMetrics(id: string, metrics: Partial<AgentPerformanceMetrics>): Promise<IAgent> {
    this.logger.debug(`Updating performance metrics for agent: ${id}`);

    const agent = await this.findById(id);
    
    const updatedMetrics: AgentPerformanceMetrics = {
      ...agent.performanceMetrics,
      ...metrics,
      lastUpdated: new Date(),
    };

    try {
      const updateQuery = `
        UPDATE agents 
        SET performance_metrics = ?, last_active = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const updateStatement = this.databaseService.getDatabase().prepare(updateQuery);
      updateStatement.run(JSON.stringify(updatedMetrics), id);

      const updatedAgent = await this.findById(id);
      this.logger.log(`✅ Performance metrics updated for agent: ${id}`);
      return updatedAgent;
    } catch (error) {
      this.logger.error(`❌ Failed to update performance metrics for agent ${id}: ${error.message}`);
      throw new BadRequestException('Failed to update performance metrics');
    }
  }

  /**
   * Check if agent has specific permission
   */
  async hasPermission(id: string, permission: keyof AgentPermissions): Promise<boolean> {
    try {
      const agent = await this.findById(id);
      return agent.permissions[permission] as boolean;
    } catch (error) {
      this.logger.warn(`Failed to check permission ${permission} for agent ${id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if agent has any of the specified roles
   */
  async hasRole(id: string, roles: AgentRole[]): Promise<boolean> {
    try {
      const agent = await this.findById(id);
      return roles.some(role => agent.roles.includes(role));
    } catch (error) {
      this.logger.warn(`Failed to check roles for agent ${id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get agent statistics
   */
  async getAgentStatistics(): Promise<{
    total: number;
    active: number;
    byRole: Record<string, number>;
    byOrganization: Record<string, number>;
    byPermissionLevel: Record<string, number>;
  }> {
    this.logger.debug('Getting agent statistics');

    try {
      // Total and active count
      const totalQuery = 'SELECT COUNT(*) as total, SUM(is_active) as active FROM agents';
      const totalResult = this.databaseService.getDatabase().prepare(totalQuery).get() as { total: number; active: number };

      // Get all agents for role and organization stats
      const allAgents = await this.findAll({}, 1, 1000); // Get up to 1000 agents

      // Count by roles (agents can have multiple roles)
      const byRole: Record<string, number> = {};
      const byOrganization: Record<string, number> = {};
      const byPermissionLevel: Record<string, number> = {};

      allAgents.items.forEach(agent => {
        // Count roles
        agent.roles.forEach(role => {
          byRole[role] = (byRole[role] || 0) + 1;
        });

        // Count organizations
        const org = agent.organization || 'Unknown';
        byOrganization[org] = (byOrganization[org] || 0) + 1;

        // Count permission levels
        const level = `Level ${agent.permissions.level}`;
        byPermissionLevel[level] = (byPermissionLevel[level] || 0) + 1;
      });

      const statistics = {
        total: totalResult.total,
        active: totalResult.active,
        byRole,
        byOrganization,
        byPermissionLevel,
      };

      this.logger.debug(`✅ Agent statistics calculated: ${JSON.stringify(statistics)}`);
      return statistics;
    } catch (error) {
      this.logger.error(`❌ Failed to get agent statistics: ${error.message}`);
      throw new BadRequestException('Failed to get agent statistics');
    }
  }

  // Private helper methods

  private generatePermissionsFromRoles(
    roles: AgentRole[], 
    overrides?: Partial<AgentPermissions>
  ): AgentPermissions {
    // Determine the highest permission level based on roles
    let level = PermissionLevel.BASIC;
    
    if (roles.includes(AgentRole.MEDIATOR)) {
      level = PermissionLevel.ADMIN;
    } else if (roles.includes(AgentRole.REVIEWER) || roles.includes(AgentRole.EXECUTOR)) {
      level = PermissionLevel.ADVANCED;
    } else if (roles.includes(AgentRole.PROPOSER) || roles.includes(AgentRole.VOTER) || roles.includes(AgentRole.SUMMARIZER)) {
      level = PermissionLevel.STANDARD;
    }

    // Generate base permissions
    const permissions: AgentPermissions = {
      level,
      canPropose: roles.includes(AgentRole.PROPOSER),
      canDiscuss: roles.includes(AgentRole.DISCUSSANT) || roles.length > 0, // All roles can discuss
      canReview: roles.includes(AgentRole.REVIEWER),
      canVote: roles.includes(AgentRole.VOTER),
      canExecute: roles.includes(AgentRole.EXECUTOR),
      canMediate: roles.includes(AgentRole.MEDIATOR),
      canSummarize: roles.includes(AgentRole.SUMMARIZER),
      maxProposalsPerDay: this.getMaxProposalsPerDay(level),
      maxDiscussionsPerDay: this.getMaxDiscussionsPerDay(level),
      maxVotesPerSession: 1, // Standard for all agents
    };

    // Apply overrides
    return { ...permissions, ...overrides };
  }

  private getMaxProposalsPerDay(level: PermissionLevel): number {
    switch (level) {
      case PermissionLevel.BASIC: return 1;
      case PermissionLevel.STANDARD: return 3;
      case PermissionLevel.ADVANCED: return 5;
      case PermissionLevel.ADMIN: return 10;
      default: return 1;
    }
  }

  private getMaxDiscussionsPerDay(level: PermissionLevel): number {
    switch (level) {
      case PermissionLevel.BASIC: return 5;
      case PermissionLevel.STANDARD: return 10;
      case PermissionLevel.ADVANCED: return 20;
      case PermissionLevel.ADMIN: return 50;
      default: return 5;
    }
  }

  private mapRowToAgent(row: any): IAgent {
    return {
      id: row.id,
      name: row.name,
      organization: row.organization,
      roles: JSON.parse(row.roles || '[]'),
      permissions: JSON.parse(row.permissions || '{}'),
      performanceMetrics: JSON.parse(row.performance_metrics || '{}'),
      createdAt: new Date(row.created_at),
      lastActive: new Date(row.last_active),
      isActive: Boolean(row.is_active),
    };
  }
}
