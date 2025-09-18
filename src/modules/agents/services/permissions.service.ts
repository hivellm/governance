import { Injectable, Logger } from '@nestjs/common';
import { AgentRole, PermissionLevel, AgentPermissions } from '../interfaces/agent.interface';

export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface RolePermissionMatrix {
  role: AgentRole;
  permissions: Permission[];
  level: PermissionLevel;
  inherits?: AgentRole[];
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private readonly roleMatrix: Map<AgentRole, RolePermissionMatrix> = new Map();

  constructor() {
    this.initializeRoleMatrix();
  }

  private initializeRoleMatrix() {
    // Basic permissions for all roles
    const basePermissions: Permission[] = [
      { action: 'read', resource: 'proposals' },
      { action: 'read', resource: 'discussions' },
      { action: 'read', resource: 'agents' }
    ];

    // Define role hierarchy and permissions
    const roles: RolePermissionMatrix[] = [
      {
        role: AgentRole.PROPOSER,
        level: PermissionLevel.STANDARD,
        permissions: [
          ...basePermissions,
          { action: 'create', resource: 'proposals' },
          { action: 'update', resource: 'proposals', conditions: { author: 'self' } },
          { action: 'advance', resource: 'proposals', conditions: { phase: 'discussion' } },
          { action: 'participate', resource: 'discussions' }
        ]
      },
      {
        role: AgentRole.VOTER,
        level: PermissionLevel.STANDARD,
        permissions: [
          ...basePermissions,
          { action: 'vote', resource: 'proposals' },
          { action: 'create', resource: 'votes' },
          { action: 'update', resource: 'votes', conditions: { author: 'self' } },
          { action: 'participate', resource: 'discussions' }
        ]
      },
      {
        role: AgentRole.REVIEWER,
        level: PermissionLevel.ADVANCED,
        permissions: [
          ...basePermissions,
          { action: 'review', resource: 'proposals' },
          { action: 'comment', resource: 'discussions' },
          { action: 'moderate', resource: 'discussions' },
          { action: 'suggest', resource: 'revisions' },
          { action: 'vote', resource: 'proposals' }
        ]
      },
      {
        role: AgentRole.MEDIATOR,
        level: PermissionLevel.ADVANCED,
        permissions: [
          ...basePermissions,
          { action: 'moderate', resource: 'discussions' },
          { action: 'resolve', resource: 'conflicts' },
          { action: 'advance', resource: 'proposals' },
          { action: 'extend', resource: 'deadlines' },
          { action: 'escalate', resource: 'issues' },
          { action: 'override', resource: 'phases', conditions: { emergency: true } }
        ]
      },
      {
        role: AgentRole.EXECUTOR,
        level: PermissionLevel.ADVANCED,
        permissions: [
          ...basePermissions,
          { action: 'execute', resource: 'proposals' },
          { action: 'deploy', resource: 'changes' },
          { action: 'rollback', resource: 'changes' },
          { action: 'monitor', resource: 'execution' },
          { action: 'report', resource: 'status' }
        ]
      },
      {
        role: AgentRole.VALIDATOR,
        level: PermissionLevel.ADVANCED,
        permissions: [
          ...basePermissions,
          { action: 'validate', resource: 'proposals' },
          { action: 'verify', resource: 'implementations' },
          { action: 'audit', resource: 'changes' },
          { action: 'certify', resource: 'quality' },
          { action: 'block', resource: 'proposals', conditions: { quality: 'insufficient' } }
        ]
      },
      {
        role: AgentRole.SUMMARIZER,
        level: PermissionLevel.STANDARD,
        permissions: [
          ...basePermissions,
          { action: 'summarize', resource: 'discussions' },
          { action: 'extract', resource: 'key_points' },
          { action: 'generate', resource: 'reports' },
          { action: 'analyze', resource: 'sentiment' }
        ]
      }
    ];

    // Store in matrix
    roles.forEach(role => {
      this.roleMatrix.set(role.role, role);
    });

    this.logger.log(`✅ Initialized RBAC matrix with ${roles.length} roles`);
  }

  /**
   * Check if an agent has permission to perform an action on a resource
   */
  async hasPermission(
    agentId: string,
    roles: AgentRole[],
    action: string,
    resource: string,
    context?: Record<string, any>
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiredLevel?: PermissionLevel;
  }> {
    this.logger.debug(`Checking permission: ${agentId} -> ${action}:${resource}`);

    // Get all permissions for agent's roles
    const agentPermissions = this.getPermissionsForRoles(roles);
    
    // Find matching permissions
    const matchingPermissions = agentPermissions.filter(perm => 
      perm.action === action && perm.resource === resource
    );

    if (matchingPermissions.length === 0) {
      return {
        allowed: false,
        reason: `No permission found for ${action}:${resource}`,
        requiredLevel: this.getMinimumLevelForAction(action, resource)
      };
    }

    // Check conditions if any
    for (const permission of matchingPermissions) {
      if (!permission.conditions) {
        return { allowed: true };
      }

      const conditionsMet = await this.evaluateConditions(
        permission.conditions,
        context || {},
        agentId
      );

      if (conditionsMet) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: 'Permission conditions not met',
      requiredLevel: this.getMinimumLevelForAction(action, resource)
    };
  }

  /**
   * Get all permissions for given roles
   */
  getPermissionsForRoles(roles: AgentRole[]): Permission[] {
    const allPermissions: Permission[] = [];
    
    for (const role of roles) {
      const roleMatrix = this.roleMatrix.get(role);
      if (roleMatrix) {
        allPermissions.push(...roleMatrix.permissions);
        
        // Include inherited permissions
        if (roleMatrix.inherits) {
          const inheritedPermissions = this.getPermissionsForRoles(roleMatrix.inherits);
          allPermissions.push(...inheritedPermissions);
        }
      }
    }

    // Remove duplicates
    const uniquePermissions = allPermissions.filter((perm, index, array) => 
      array.findIndex(p => p.action === perm.action && p.resource === perm.resource) === index
    );

    return uniquePermissions;
  }

  /**
   * Generate agent permissions object based on roles
   */
  generatePermissionsFromRoles(roles: AgentRole[]): AgentPermissions {
    const permissions = this.getPermissionsForRoles(roles);
    const maxLevel = this.getMaxPermissionLevel(roles);

    return {
      level: maxLevel,
      canPropose: permissions.some(p => p.action === 'create' && p.resource === 'proposals'),
      canDiscuss: permissions.some(p => p.action === 'participate' && p.resource === 'discussions'),
      canReview: permissions.some(p => p.action === 'review' && p.resource === 'proposals'),
      canVote: permissions.some(p => p.action === 'vote' && p.resource === 'proposals'),
      canExecute: permissions.some(p => p.action === 'execute' && p.resource === 'proposals'),
      canMediate: permissions.some(p => p.action === 'resolve' && p.resource === 'conflicts'),
      canModerate: permissions.some(p => p.action === 'moderate' && p.resource === 'discussions'),
      canValidate: permissions.some(p => p.action === 'validate' && p.resource === 'proposals'),
      canSummarize: permissions.some(p => p.action === 'summarize' && p.resource === 'discussions'),
      customPermissions: permissions.reduce((acc, perm) => {
        const key = `${perm.action}:${perm.resource}`;
        acc[key] = true;
        return acc;
      }, {} as Record<string, boolean>)
    };
  }

  /**
   * Get maximum permission level for given roles
   */
  private getMaxPermissionLevel(roles: AgentRole[]): PermissionLevel {
    let maxLevel = PermissionLevel.BASIC;

    for (const role of roles) {
      const roleMatrix = this.roleMatrix.get(role);
      if (roleMatrix && roleMatrix.level > maxLevel) {
        maxLevel = roleMatrix.level;
      }
    }

    return maxLevel;
  }

  /**
   * Get minimum permission level required for an action
   */
  private getMinimumLevelForAction(action: string, resource: string): PermissionLevel {
    const criticalActions = ['execute', 'override', 'moderate', 'validate'];
    const standardActions = ['create', 'vote', 'review'];

    if (criticalActions.includes(action)) {
      return PermissionLevel.ADVANCED;
    }

    if (standardActions.includes(action)) {
      return PermissionLevel.STANDARD;
    }

    return PermissionLevel.BASIC;
  }

  /**
   * Evaluate permission conditions
   */
  private async evaluateConditions(
    conditions: Record<string, any>,
    context: Record<string, any>,
    agentId: string
  ): Promise<boolean> {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'author':
          if (value === 'self' && context.authorId !== agentId) {
            return false;
          }
          break;
        case 'phase':
          if (context.phase !== value) {
            return false;
          }
          break;
        case 'emergency':
          if (value === true && !context.emergency) {
            return false;
          }
          break;
        case 'quality':
          if (context.quality !== value) {
            return false;
          }
          break;
        default:
          // Custom condition evaluation
          if (context[key] !== value) {
            return false;
          }
      }
    }

    return true;
  }

  /**
   * Get role matrix for a specific role
   */
  getRoleMatrix(role: AgentRole): RolePermissionMatrix | undefined {
    return this.roleMatrix.get(role);
  }

  /**
   * Get all available roles and their permissions
   */
  getAllRoles(): RolePermissionMatrix[] {
    return Array.from(this.roleMatrix.values());
  }

  /**
   * Check if roles are compatible (can be assigned to same agent)
   */
  areRolesCompatible(roles: AgentRole[]): {
    compatible: boolean;
    conflicts?: string[];
  } {
    const conflicts: string[] = [];

    // Define incompatible role combinations
    const incompatiblePairs: [AgentRole, AgentRole][] = [
      [AgentRole.PROPOSER, AgentRole.VALIDATOR], // Conflict of interest
      [AgentRole.EXECUTOR, AgentRole.VALIDATOR]   // Separation of duties
    ];

    for (const [role1, role2] of incompatiblePairs) {
      if (roles.includes(role1) && roles.includes(role2)) {
        conflicts.push(`${role1} and ${role2} are incompatible`);
      }
    }

    return {
      compatible: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined
    };
  }

  /**
   * Suggest roles based on desired permissions
   */
  suggestRoles(desiredPermissions: string[]): {
    recommendedRoles: AgentRole[];
    coverage: number;
  } {
    const allRoles = this.getAllRoles();
    const roleScores: Array<{ role: AgentRole; score: number }> = [];

    for (const roleMatrix of allRoles) {
      let score = 0;
      const rolePermissionStrings = roleMatrix.permissions.map(p => `${p.action}:${p.resource}`);
      
      for (const desired of desiredPermissions) {
        if (rolePermissionStrings.includes(desired)) {
          score++;
        }
      }

      if (score > 0) {
        roleScores.push({ role: roleMatrix.role, score });
      }
    }

    // Sort by score and select top roles
    roleScores.sort((a, b) => b.score - a.score);
    
    const recommendedRoles = roleScores.slice(0, 3).map(rs => rs.role);
    const totalCovered = roleScores.reduce((sum, rs) => sum + rs.score, 0);
    const coverage = totalCovered / desiredPermissions.length;

    return {
      recommendedRoles,
      coverage: Math.min(coverage, 1.0)
    };
  }
}
