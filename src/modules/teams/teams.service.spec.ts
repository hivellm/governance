import { TeamsService, TeamRecord } from './teams.service';
import { BadRequestException } from '@nestjs/common';

describe('TeamsService (unit)', () => {
  let service: TeamsService;
  const preparedCalls: Array<{ sql: string; args?: any }> = [];
  let mockRow: any = null;
  let mockRows: any[] = [];

  const mockDb = {
    prepare: (sql: string) => ({
      run: (args?: any) => {
        preparedCalls.push({ sql, args });
        return { changes: 1 };
      },
      get: (...args: any[]) => {
        preparedCalls.push({ sql: 'get', args });
        return mockRow;
      },
      all: (...args: any[]) => {
        preparedCalls.push({ sql: 'all', args });
        return mockRows;
      },
    }),
  } as any;

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
  };

  beforeEach(() => {
    preparedCalls.length = 0;
    mockRow = null;
    mockRows.length = 0;
    service = new TeamsService(mockDatabaseService);
  });

  describe('list', () => {
    it('returns empty array when no teams exist', async () => {
      mockRows = [];

      const result = await service.list();

      expect(result).toEqual([]);
      expect(preparedCalls[0].sql).toBe('all');
    });

    it('returns list of teams with proper mapping', async () => {
      mockRows = [
        {
          id: 'team-core',
          name: 'Core Development Team',
          members: JSON.stringify(['alice', 'bob', 'charlie']),
          metadata: JSON.stringify({ department: 'Engineering', priority: 'high' }),
        },
        {
          id: 'team-design',
          name: 'Design Team',
          members: JSON.stringify(['diana', 'eve']),
          metadata: JSON.stringify({ department: 'Design', priority: 'medium' }),
        },
      ];

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'team-core',
        name: 'Core Development Team',
        members: ['alice', 'bob', 'charlie'],
        metadata: { department: 'Engineering', priority: 'high' },
      });
      expect(result[1]).toEqual({
        id: 'team-design',
        name: 'Design Team',
        members: ['diana', 'eve'],
        metadata: { department: 'Design', priority: 'medium' },
      });
    });

    it('handles teams with empty members array', async () => {
      mockRows = [
        {
          id: 'empty-team',
          name: 'Empty Team',
          members: JSON.stringify([]),
          metadata: JSON.stringify({}),
        },
      ];

      const result = await service.list();

      expect(result[0]).toEqual({
        id: 'empty-team',
        name: 'Empty Team',
        members: [],
        metadata: {},
      });
    });

    it('handles malformed JSON gracefully', async () => {
      mockRows = [
        {
          id: 'malformed-team',
          name: 'Malformed Team',
          members: 'invalid json',
          metadata: '{invalid}',
        },
      ];

      const result = await service.list();

      expect(result[0]).toEqual({
        id: 'malformed-team',
        name: 'Malformed Team',
        members: [], // Falls back to empty array
        metadata: {}, // Falls back to empty object
      });
    });

    it('throws BadRequestException on database error', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Database connection failed'); },
      } as any;

      const mockService = new TeamsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.list()).rejects.toThrow(BadRequestException);
      await expect(mockService.list()).rejects.toThrow('Failed to list teams');
    });
  });

  describe('get', () => {
    it('returns null when team not found', async () => {
      mockRow = null;

      const result = await service.get('non-existent');

      expect(result).toBeNull();
      expect(preparedCalls[0].sql).toBe('get');
      expect(preparedCalls[0].args).toEqual(['non-existent']);
    });

    it('returns team with proper mapping when found', async () => {
      mockRow = {
        id: 'team-dev',
        name: 'Development Team',
        members: JSON.stringify(['alice', 'bob', 'charlie']),
        metadata: JSON.stringify({
          department: 'Engineering',
          created: '2025-01-01',
          skills: ['typescript', 'node.js', 'react'],
        }),
      };

      const result = await service.get('team-dev');

      expect(result).toEqual({
        id: 'team-dev',
        name: 'Development Team',
        members: ['alice', 'bob', 'charlie'],
        metadata: {
          department: 'Engineering',
          created: '2025-01-01',
          skills: ['typescript', 'node.js', 'react'],
        },
      });
    });

    it('handles team with minimal data', async () => {
      mockRow = {
        id: 'minimal-team',
        name: 'Minimal Team',
        members: null,
        metadata: null,
      };

      const result = await service.get('minimal-team');

      expect(result).toEqual({
        id: 'minimal-team',
        name: 'Minimal Team',
        members: [],
        metadata: {},
      });
    });

    it('handles team with empty members and metadata', async () => {
      mockRow = {
        id: 'empty-team',
        name: 'Empty Team',
        members: JSON.stringify([]),
        metadata: JSON.stringify({}),
      };

      const result = await service.get('empty-team');

      expect(result).toEqual({
        id: 'empty-team',
        name: 'Empty Team',
        members: [],
        metadata: {},
      });
    });
  });

  describe('upsert', () => {
    it('inserts new team when it does not exist', async () => {
      mockRow = {
        id: 'new-team',
        name: 'New Team',
        members: JSON.stringify(['alice']),
        metadata: JSON.stringify({ department: 'New' }),
      };

      const teamData: TeamRecord = {
        id: 'new-team',
        name: 'New Team',
        members: ['alice'],
        metadata: { department: 'New' },
      };

      const result = await service.upsert(teamData);

      expect(preparedCalls[0].sql).toContain('INSERT INTO teams');
      expect(preparedCalls[0].sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(preparedCalls[0].args).toEqual({
        id: 'new-team',
        name: 'New Team',
        members: JSON.stringify(['alice']),
        metadata: JSON.stringify({ department: 'New' }),
      });
      expect(preparedCalls[1].sql).toBe('get'); // Called by get() method
      expect(result).toBeTruthy();
    });

    it('updates existing team when it exists', async () => {
      mockRow = {
        id: 'existing-team',
        name: 'Updated Team',
        members: JSON.stringify(['alice', 'bob']),
        metadata: JSON.stringify({ department: 'Updated' }),
      };

      const teamData: TeamRecord = {
        id: 'existing-team',
        name: 'Updated Team',
        members: ['alice', 'bob'],
        metadata: { department: 'Updated' },
      };

      const result = await service.upsert(teamData);

      expect(preparedCalls[0].sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(result).toBeTruthy();
    });

    it('handles team with minimal required fields', async () => {
      mockRow = {
        id: 'minimal-team',
        name: 'Minimal Team',
        members: JSON.stringify([]),
        metadata: JSON.stringify({}),
      };

      const teamData: TeamRecord = {
        id: 'minimal-team',
        name: 'Minimal Team',
        members: [],
      };

      const result = await service.upsert(teamData);

      expect(preparedCalls[0].args).toEqual({
        id: 'minimal-team',
        name: 'Minimal Team',
        members: JSON.stringify([]),
        metadata: JSON.stringify({}),
      });
      expect(result).toBeTruthy();
    });

    it('handles team with complex members and metadata', async () => {
      const complexMembers = [
        'alice@company.com',
        'bob.smith',
        'charlie-brown',
        'diana.prince_123',
      ];

      const complexMetadata = {
        department: 'Engineering',
        manager: 'sarah.jones',
        created: '2025-01-01T10:00:00Z',
        budget: 50000,
        projects: ['project-a', 'project-b', 'project-c'],
        skills: {
          required: ['typescript', 'react', 'node.js'],
          niceToHave: ['python', 'aws'],
        },
        location: {
          office: 'New York',
          timezone: 'EST',
          remote: true,
        },
      };

      mockRow = {
        id: 'complex-team',
        name: 'Complex Engineering Team',
        members: JSON.stringify(complexMembers),
        metadata: JSON.stringify(complexMetadata),
      };

      const teamData: TeamRecord = {
        id: 'complex-team',
        name: 'Complex Engineering Team',
        members: complexMembers,
        metadata: complexMetadata,
      };

      const result = await service.upsert(teamData);

      expect(preparedCalls[0].args).toEqual({
        id: 'complex-team',
        name: 'Complex Engineering Team',
        members: JSON.stringify(complexMembers),
        metadata: JSON.stringify(complexMetadata),
      });
      expect(result).toBeTruthy();
    });

    it('handles team with undefined members and metadata', async () => {
      mockRow = {
        id: 'undefined-team',
        name: 'Undefined Team',
        members: JSON.stringify([]),
        metadata: JSON.stringify({}),
      };

      const teamData: TeamRecord = {
        id: 'undefined-team',
        name: 'Undefined Team',
        members: [],
        metadata: {},
      };

      const result = await service.upsert(teamData);

      expect(preparedCalls[0].args).toEqual({
        id: 'undefined-team',
        name: 'Undefined Team',
        members: JSON.stringify([]),
        metadata: JSON.stringify({}),
      });
      expect(result).toBeTruthy();
    });
  });

  describe('private helper methods', () => {
    describe('safeParse', () => {
      it('parses valid JSON string', () => {
        const result = (service as any).safeParse('{"test": "value"}');
        expect(result).toEqual({ test: 'value' });
      });

      it('returns null for invalid JSON', () => {
        const result = (service as any).safeParse('invalid json');
        expect(result).toBeNull();
      });

      it('returns non-string values as-is', () => {
        const obj = { test: 'value' };
        const result = (service as any).safeParse(obj);
        expect(result).toBe(obj);

        const arr = ['item1', 'item2'];
        const result2 = (service as any).safeParse(arr);
        expect(result2).toBe(arr);

        const num = 42;
        const result3 = (service as any).safeParse(num);
        expect(result3).toBe(num);
      });

      it('handles empty string', () => {
        const result = (service as any).safeParse('');
        expect(result).toBeNull();
      });

      it('handles null and undefined', () => {
        expect((service as any).safeParse(null)).toBeNull();
        expect((service as any).safeParse(undefined)).toBeUndefined();
      });

      it('handles boolean values', () => {
        expect((service as any).safeParse(true)).toBe(true);
        expect((service as any).safeParse(false)).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('handles database errors in list method', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Connection timeout'); },
      } as any;

      const mockService = new TeamsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.list()).rejects.toThrow(BadRequestException);
      await expect(mockService.list()).rejects.toThrow('Failed to list teams');
    });

    it('handles database errors in get method', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Query syntax error'); },
      } as any;

      const mockService = new TeamsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.get('team-001')).rejects.toThrow(BadRequestException);
    });

    it('handles database errors in upsert method', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Table does not exist'); },
      } as any;

      const mockService = new TeamsService({ getDatabase: () => mockDbError } as any);

      const teamData: TeamRecord = {
        id: 'error-team',
        name: 'Error Team',
        members: ['alice'],
      };

      await expect(mockService.upsert(teamData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('integration scenarios', () => {
    it('handles team lifecycle: create, read, update', async () => {
      // Initial team creation
      mockRow = {
        id: 'lifecycle-team',
        name: 'Lifecycle Team',
        members: JSON.stringify(['alice']),
        metadata: JSON.stringify({ phase: 'initial' }),
      };

      const initialTeam: TeamRecord = {
        id: 'lifecycle-team',
        name: 'Lifecycle Team',
        members: ['alice'],
        metadata: { phase: 'initial' },
      };

      await service.upsert(initialTeam);

      // Simulate reading the team back
      const readResult = await service.get('lifecycle-team');
      expect(readResult?.members).toEqual(['alice']);
      expect(readResult?.metadata).toEqual({ phase: 'initial' });

      // Update the team
      mockRow.members = JSON.stringify(['alice', 'bob']);
      mockRow.metadata = JSON.stringify({ phase: 'updated' });

      const updatedTeam: TeamRecord = {
        id: 'lifecycle-team',
        name: 'Lifecycle Team',
        members: ['alice', 'bob'],
        metadata: { phase: 'updated' },
      };

      await service.upsert(updatedTeam);

      const finalResult = await service.get('lifecycle-team');
      expect(finalResult?.members).toEqual(['alice', 'bob']);
      expect(finalResult?.metadata).toEqual({ phase: 'updated' });
    });

    it('handles multiple teams with different structures', async () => {
      mockRows = [
        {
          id: 'team-1',
          name: 'Small Team',
          members: JSON.stringify(['alice']),
          metadata: JSON.stringify({ size: 'small' }),
        },
        {
          id: 'team-2',
          name: 'Medium Team',
          members: JSON.stringify(['bob', 'charlie', 'diana']),
          metadata: JSON.stringify({ size: 'medium', budget: 30000 }),
        },
        {
          id: 'team-3',
          name: 'Large Team',
          members: JSON.stringify(['eve', 'frank', 'grace', 'henry', 'iris']),
          metadata: JSON.stringify({
            size: 'large',
            budget: 75000,
            departments: ['eng', 'design', 'qa'],
          }),
        },
      ];

      const teams = await service.list();

      expect(teams).toHaveLength(3);
      expect(teams[0].members).toHaveLength(1);
      expect(teams[1].members).toHaveLength(3);
      expect(teams[2].members).toHaveLength(5);
      expect(teams[2].metadata.departments).toHaveLength(3);
    });
  });
});
