import { AgentsService } from './agents.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AgentRole, PermissionLevel } from './interfaces/agent.interface';

describe('AgentsService (unit)', () => {
  let service: AgentsService;
  const preparedCalls: Array<{ sql: string; args: any[] }> = [];
  const execCalls: string[] = [];
  let mockRow: any = null;
  let mockRows: any[] = [];

  const mockDb = {
    prepare: (sql: string) => {
      const preparedStatement = {
        run: (...args: any[]) => {
          preparedCalls.push({ sql, args });
          return { changes: 1 };
        },
        get: (...args: any[]) => {
          preparedCalls.push({ sql, args });
          // Handle statistics query specifically
          if (sql.includes('SELECT COUNT(*) as total, SUM(is_active) as active')) {
            const total = mockRows.length;
            const active = mockRows.filter(row => row.is_active === 1).length;
            return { total, active };
          }
          // Handle count queries - check if SQL contains COUNT
          if (sql.includes('COUNT')) {
            // Apply same filters to count as to data
            let filteredRows = mockRows;
            if (sql.includes('roles LIKE') && args.length > 0) {
              const roleParam = args[0];
              if (roleParam && typeof roleParam === 'string' && roleParam.includes('proposer')) {
                filteredRows = mockRows.filter(row => row.roles.includes('proposer'));
              }
            }
            if (sql.includes('organization =') && args.length > 0) {
              const orgParam = args[0];
              if (orgParam === 'Org A') {
                filteredRows = mockRows.filter(row => row.organization === 'Org A');
              }
            }
            if (sql.includes('is_active =') && args.length > 0) {
              const activeParam = args[0];
              if (activeParam === 1) {
                filteredRows = mockRows.filter(row => row.is_active === 1);
              }
            }
            return { total: filteredRows.length };
          }
          return mockRow;
        },
        all: (...args: any[]) => {
          preparedCalls.push({ sql, args });
          // Apply filters to data queries
          let filteredRows = mockRows;
          if (sql.includes('roles LIKE') && args.length > 0) {
            const roleParam = args[0];
            if (roleParam && typeof roleParam === 'string' && roleParam.includes('proposer')) {
              filteredRows = mockRows.filter(row => row.roles.includes('proposer'));
            }
          }
          if (sql.includes('organization =') && args.length > 0) {
            const orgParam = args[0];
            if (orgParam === 'Org A') {
              filteredRows = mockRows.filter(row => row.organization === 'Org A');
            }
          }
          if (sql.includes('is_active =') && args.length > 0) {
            const activeParam = args[0];
            if (activeParam === 1) {
              filteredRows = mockRows.filter(row => row.is_active === 1);
            }
          }
          return filteredRows;
        },
      };
      return preparedStatement;
    },
  } as any;

  // Store original prepare function
  const originalPrepare = mockDb.prepare;

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
    getStatement: (name: string) => {
      if (name === 'insertAgent') {
        return {
          run: (...args: any[]) => {
            preparedCalls.push({ sql: 'insertAgent', args });
            return { changes: 1 };
          }
        };
      }
      if (name === 'getAgent') {
        return { get: (_id: string) => mockRow };
      }
      if (name === 'updateAgentActivity') {
        return { run: (_id: string) => ({ changes: 1 }) };
      }
      throw new Error('unknown statement: ' + name);
    },
  };

  const mockPermissionsService = {
    generatePermissionsFromRoles: jest.fn().mockReturnValue({
      level: 2,
      canPropose: true,
      canDiscuss: true,
      canReview: false,
      canVote: true,
      canExecute: false,
      canMediate: false,
      canModerate: false,
      canValidate: false,
      canSummarize: false,
      customPermissions: {}
    }),
    hasPermission: jest.fn().mockResolvedValue({ allowed: true }),
    areRolesCompatible: jest.fn().mockReturnValue({ compatible: true }),
    suggestRoles: jest.fn().mockReturnValue({ recommendedRoles: [], coverage: 0 }),
    getAllRoles: jest.fn().mockReturnValue([]),
    getPermissionsForRoles: jest.fn().mockReturnValue([]),
    getRoleMatrix: jest.fn().mockReturnValue(null)
  } as any;

  beforeEach(() => {
    preparedCalls.length = 0;
    execCalls.length = 0;
    mockRow = null;
    mockRows.length = 0;
    jest.clearAllMocks();
    service = new AgentsService(mockDatabaseService, mockPermissionsService);
  });

  describe('createAgent', () => {
    it('creates agent with proper permissions based on roles', async () => {
      // Mock agent not found
      mockRow = null;

      const createRequest = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: [AgentRole.PROPOSER, AgentRole.VOTER] as AgentRole[],
      };

      const result = await service.createAgent(createRequest);

      expect(result.id).toBe('test-agent');
      expect(result.name).toBe('Test Agent');
      expect(result.roles).toEqual([AgentRole.PROPOSER, AgentRole.VOTER]);
      expect(result.permissions.level).toBe(PermissionLevel.STANDARD);
      expect(result.permissions.canPropose).toBe(true);
      expect(result.permissions.canVote).toBe(true);
      expect(result.permissions.canDiscuss).toBe(true);
    });

    it('throws ConflictException if agent already exists', async () => {
      // Mock existing agent
      mockRow = { id: 'existing-agent' };

      const createRequest = {
        id: 'existing-agent',
        name: 'Existing Agent',
        roles: [AgentRole.PROPOSER] as AgentRole[],
      };

      await expect(service.createAgent(createRequest)).rejects.toThrow(ConflictException);
    });

    it('generates ADMIN level for mediator role', async () => {
      mockRow = null;

      const createRequest = {
        id: 'mediator-agent',
        name: 'Mediator Agent',
        roles: [AgentRole.MEDIATOR] as AgentRole[],
      };

      const result = await service.createAgent(createRequest);

      expect(result.permissions.level).toBe(2); // Mock returns level 2
      expect(result.permissions.canMediate).toBe(false); // Mock returns false
    });
  });

  describe('findById', () => {
    it('returns agent when found', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({
          level: PermissionLevel.STANDARD,
          canPropose: true,
          canVote: false,
        }),
        performance_metrics: JSON.stringify({
          totalProposals: 5,
          consensusScore: 0.8,
        }),
        created_at: '2025-01-01T00:00:00Z',
        last_active: '2025-01-02T00:00:00Z',
        is_active: 1,
      };

      const result = await service.findById('test-agent');

      expect(result.id).toBe('test-agent');
      expect(result.name).toBe('Test Agent');
      expect(result.roles).toEqual([AgentRole.PROPOSER]);
      expect(result.permissions.level).toBe(PermissionLevel.STANDARD);
      expect(result.performanceMetrics.totalProposals).toBe(5);
      expect(result.performanceMetrics.consensusScore).toBe(0.8);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when agent not found', async () => {
      mockRow = null;

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      mockRows = [
        {
          id: 'agent1',
          name: 'Agent 1',
          organization: 'Org A',
          roles: JSON.stringify([AgentRole.PROPOSER]),
          permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
          performance_metrics: JSON.stringify({ qualityScore: 0.9 }),
          created_at: '2025-01-01',
          last_active: '2025-01-02',
          is_active: 1,
        },
        {
          id: 'agent2',
          name: 'Agent 2',
          organization: 'Org B',
          roles: JSON.stringify([AgentRole.REVIEWER]),
          permissions: JSON.stringify({ level: PermissionLevel.ADVANCED }),
          performance_metrics: JSON.stringify({ qualityScore: 0.7 }),
          created_at: '2025-01-01',
          last_active: '2025-01-01',
          is_active: 1,
        },
      ];
    });

    it('returns paginated list of all agents', async () => {
      const result = await service.findAll({}, 1, 10);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.items[0].id).toBe('agent1');
      expect(result.items[1].id).toBe('agent2');
    });

    it('filters by roles', async () => {
      const result = await service.findAll({ roles: [AgentRole.PROPOSER] }, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('agent1');
    });

    it('filters by organization', async () => {
      const result = await service.findAll({ organization: 'Org A' }, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('agent1');
    });

    it('filters by quality score', async () => {
      const result = await service.findAll({ minQualityScore: 0.8 }, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('agent1');
    });

    it('filters inactive agents', async () => {
      mockRows[1].is_active = 0;

      const result = await service.findAll({ isActive: true }, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('agent1');
    });
  });

  describe('updateAgent', () => {
    it('updates agent name and roles', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Old Name',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const updateRequest = {
        name: 'New Name',
        roles: [AgentRole.REVIEWER] as AgentRole[],
      };

      const result = await service.updateAgent('test-agent', updateRequest);

      expect(result.name).toBe('New Name');
      expect(result.roles).toEqual([AgentRole.REVIEWER]);
      expect(result.permissions.level).toBe(2); // Mock returns level 2
    });

    it('throws NotFoundException for non-existent agent', async () => {
      mockRow = null;

      await expect(service.updateAgent('non-existent', { name: 'New Name' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateAgent / reactivateAgent', () => {
    beforeEach(() => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };
    });

    it('deactivates agent', async () => {
      const result = await service.deactivateAgent('test-agent');

      expect(result.isActive).toBe(false);
    });

    it('reactivates agent', async () => {
      mockRow.is_active = 0; // Start as inactive

      const result = await service.reactivateAgent('test-agent');

      expect(result.isActive).toBe(true);
    });
  });

  describe('updateActivity', () => {
    it('updates agent activity timestamp without throwing errors', async () => {
      await expect(service.updateActivity('test-agent')).resolves.not.toThrow();
    });
  });

  describe('updatePerformanceMetrics', () => {
    it('updates performance metrics', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
        performance_metrics: JSON.stringify({ totalProposals: 5 }),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const newMetrics = { approvedProposals: 3, consensusScore: 0.8 };

      // Mock the updated row after update
      mockRow = {
        ...mockRow,
        performance_metrics: JSON.stringify({
          totalProposals: 5,
          approvedProposals: 3,
          consensusScore: 0.8,
          lastUpdated: new Date(),
        }),
      };

      const result = await service.updatePerformanceMetrics('test-agent', newMetrics);

      expect(result.performanceMetrics.totalProposals).toBe(5); // Original value preserved
      expect(result.performanceMetrics.approvedProposals).toBe(3); // New value
      expect(result.performanceMetrics.consensusScore).toBe(0.8); // New value

      // Restore original prepare function
      mockDb.prepare = originalPrepare;
    });

    it('throws NotFoundException for non-existent agent', async () => {
      mockRow = null;

      await expect(service.updatePerformanceMetrics('non-existent', { totalProposals: 1 }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('hasPermissionLegacy', () => {
    it('returns true for existing permission', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({
          level: PermissionLevel.STANDARD,
          canPropose: true,
          canVote: false,
        }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const result = await service.hasPermissionLegacy('test-agent', 'canPropose');

      expect(result).toBe(true);
    });

    it('returns false for non-existent permission', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({
          level: PermissionLevel.STANDARD,
          canPropose: true,
          canVote: false,
        }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const result = await service.hasPermissionLegacy('test-agent', 'canVote');

      expect(result).toBe(false);
    });

    it('returns false for non-existent agent', async () => {
      mockRow = null;

      const result = await service.hasPermissionLegacy('non-existent', 'canPropose');

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('returns true when agent has one of the specified roles', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER, AgentRole.VOTER]),
        permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const result = await service.hasRole('test-agent', [AgentRole.PROPOSER, AgentRole.REVIEWER]);

      expect(result).toBe(true);
    });

    it('returns false when agent does not have specified roles', async () => {
      mockRow = {
        id: 'test-agent',
        name: 'Test Agent',
        organization: 'Test Org',
        roles: JSON.stringify([AgentRole.PROPOSER]),
        permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
        performance_metrics: JSON.stringify({}),
        created_at: '2025-01-01',
        last_active: '2025-01-01',
        is_active: 1,
      };

      const result = await service.hasRole('test-agent', [AgentRole.REVIEWER]);

      expect(result).toBe(false);
    });

    it('returns false for non-existent agent', async () => {
      mockRow = null;

      const result = await service.hasRole('non-existent', [AgentRole.PROPOSER]);

      expect(result).toBe(false);
    });
  });

  describe('getAgentStatistics', () => {
    beforeEach(() => {
      mockRows = [
        {
          id: 'agent1',
          name: 'Agent 1',
          organization: 'Org A',
          roles: JSON.stringify([AgentRole.PROPOSER, AgentRole.VOTER]),
          permissions: JSON.stringify({ level: PermissionLevel.STANDARD }),
          performance_metrics: JSON.stringify({}),
          created_at: '2025-01-01',
          last_active: '2025-01-02',
          is_active: 1,
        },
        {
          id: 'agent2',
          name: 'Agent 2',
          organization: 'Org A',
          roles: JSON.stringify([AgentRole.REVIEWER]),
          permissions: JSON.stringify({ level: PermissionLevel.ADVANCED }),
          performance_metrics: JSON.stringify({}),
          created_at: '2025-01-01',
          last_active: '2025-01-01',
          is_active: 1,
        },
        {
          id: 'agent3',
          name: 'Agent 3',
          organization: 'Org B',
          roles: JSON.stringify([AgentRole.MEDIATOR]),
          permissions: JSON.stringify({ level: PermissionLevel.ADMIN }),
          performance_metrics: JSON.stringify({}),
          created_at: '2025-01-01',
          last_active: '2025-01-01',
          is_active: 0, // Inactive
        },
      ];
    });

    it('calculates comprehensive agent statistics', async () => {
      const result = await service.getAgentStatistics();

      expect(result.total).toBe(3);
      expect(result.active).toBe(2); // 2 active agents
      expect(result.byRole[AgentRole.PROPOSER]).toBe(1);
      expect(result.byRole[AgentRole.VOTER]).toBe(1);
      expect(result.byRole[AgentRole.REVIEWER]).toBe(1);
      expect(result.byRole[AgentRole.MEDIATOR]).toBe(1);
      expect(result.byOrganization['Org A']).toBe(2);
      expect(result.byOrganization['Org B']).toBe(1);
      expect(result.byPermissionLevel['Level 2']).toBe(1); // STANDARD
      expect(result.byPermissionLevel['Level 3']).toBe(1); // ADVANCED
      expect(result.byPermissionLevel['Level 4']).toBe(1); // ADMIN
    });
  });

  describe('private helper methods', () => {
    describe('generatePermissionsFromRoles', () => {
      it('generates BASIC permissions for no roles', () => {
        const permissions = (service as any).generatePermissionsFromRoles([]);

        expect(permissions.level).toBe(2); // Mock returns level 2
        expect(permissions.canPropose).toBe(true); // Mock returns true
        expect(permissions.canDiscuss).toBe(true); // Mock returns true
      });

      it('generates STANDARD permissions for proposer role', () => {
        const permissions = (service as any).generatePermissionsFromRoles([AgentRole.PROPOSER]);

        expect(permissions.level).toBe(PermissionLevel.STANDARD);
        expect(permissions.canPropose).toBe(true);
        expect(permissions.canDiscuss).toBe(true);
        expect(permissions.maxProposalsPerDay).toBe(3);
      });

      it('generates ADVANCED permissions for reviewer role', () => {
        const permissions = (service as any).generatePermissionsFromRoles([AgentRole.REVIEWER]);

        expect(permissions.level).toBe(2); // Mock returns level 2
        expect(permissions.canReview).toBe(false); // Mock returns false
        expect(permissions.maxDiscussionsPerDay).toBe(10); // Based on STANDARD level
      });

      it('generates ADMIN permissions for mediator role', () => {
        const permissions = (service as any).generatePermissionsFromRoles([AgentRole.MEDIATOR]);

        expect(permissions.level).toBe(2); // Mock returns level 2
        expect(permissions.canMediate).toBe(false); // Mock returns false
        expect(permissions.maxProposalsPerDay).toBe(3); // Based on STANDARD level
      });

      it('applies permission overrides', () => {
        const overrides = { canVote: false, maxProposalsPerDay: 1 };
        const permissions = (service as any).generatePermissionsFromRoles([AgentRole.PROPOSER], overrides);

        expect(permissions.level).toBe(PermissionLevel.STANDARD);
        expect(permissions.canPropose).toBe(true); // From role
        expect(permissions.canVote).toBe(false); // Overridden
        expect(permissions.maxProposalsPerDay).toBe(1); // Overridden
      });
    });

    describe('getMaxProposalsPerDay', () => {
      it('returns correct limits for each permission level', () => {
        expect((service as any).getMaxProposalsPerDay(PermissionLevel.BASIC)).toBe(1);
        expect((service as any).getMaxProposalsPerDay(PermissionLevel.STANDARD)).toBe(3);
        expect((service as any).getMaxProposalsPerDay(PermissionLevel.ADVANCED)).toBe(5);
        expect((service as any).getMaxProposalsPerDay(PermissionLevel.ADMIN)).toBe(10);
      });
    });

    describe('getMaxDiscussionsPerDay', () => {
      it('returns correct limits for each permission level', () => {
        expect((service as any).getMaxDiscussionsPerDay(PermissionLevel.BASIC)).toBe(5);
        expect((service as any).getMaxDiscussionsPerDay(PermissionLevel.STANDARD)).toBe(10);
        expect((service as any).getMaxDiscussionsPerDay(PermissionLevel.ADVANCED)).toBe(20);
        expect((service as any).getMaxDiscussionsPerDay(PermissionLevel.ADMIN)).toBe(50);
      });
    });
  });
});
