import { BipsService, BipRecord } from './bips.service';
import { BadRequestException } from '@nestjs/common';

describe('BipsService (unit)', () => {
  let service: BipsService;
  const preparedCalls: Array<{ sql: string; args?: any[] }> = [];
  let mockRow: any = null;
  let mockRows: any[] = [];

  const mockDb = {
    prepare: (sql: string) => {
      const preparedStatement = {
        run: (args?: any) => {
          preparedCalls.push({ sql, args });
          return { changes: 1 };
        },
        get: (...args: any[]) => {
          preparedCalls.push({ sql, args });
          return mockRow;
        },
        all: (...args: any[]) => {
          preparedCalls.push({ sql, args });
          return mockRows;
        },
      };
      return preparedStatement;
    },
  } as any;

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
  };

  beforeEach(() => {
    preparedCalls.length = 0;
    mockRow = null;
    mockRows.length = 0;
    service = new BipsService(mockDatabaseService);
  });

  describe('list', () => {
    it('returns empty array when no BIPs exist', async () => {
      mockRows = [];

      const result = await service.list();

      expect(result).toEqual([]);
      expect(preparedCalls[0].sql).toContain('SELECT * FROM bips ORDER BY id ASC');
    });

    it('returns list of BIPs with proper mapping', async () => {
      mockRows = [
        {
          id: 'BIP-001',
          title: 'First BIP',
          status: 'active',
          content: JSON.stringify({ abstract: 'Test abstract' }),
          metadata: JSON.stringify({ author: 'Test Author' }),
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        {
          id: 'BIP-002',
          title: 'Second BIP',
          status: 'draft',
          content: JSON.stringify({ abstract: 'Another abstract' }),
          metadata: JSON.stringify({ author: 'Another Author' }),
          created_at: '2025-01-02T00:00:00Z',
          updated_at: null,
        },
      ];

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'BIP-001',
        title: 'First BIP',
        status: 'active',
        content: { abstract: 'Test abstract' },
        metadata: { author: 'Test Author' },
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      });
      expect(result[1]).toMatchObject({
        id: 'BIP-002',
        title: 'Second BIP',
        status: 'draft',
        content: { abstract: 'Another abstract' },
        metadata: { author: 'Another Author' },
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: undefined,
      });
    });

    it('handles malformed JSON gracefully', async () => {
      mockRows = [
        {
          id: 'BIP-001',
          title: 'Malformed BIP',
          status: 'active',
          content: 'invalid json',
          metadata: '{invalid}',
          created_at: '2025-01-01',
          updated_at: null,
        },
      ];

      const result = await service.list();

      expect(result[0]).toMatchObject({
        id: 'BIP-001',
        title: 'Malformed BIP',
        content: 'invalid json', // Falls back to original value
        metadata: '{invalid}', // Falls back to original value
      });
    });

    it('throws BadRequestException on database error', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Database connection failed'); },
      } as any;

      const mockService = new BipsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.list()).rejects.toThrow(BadRequestException);
    });
  });

  describe('get', () => {
    it('returns null when BIP not found', async () => {
      mockRow = null;

      const result = await service.get('non-existent');

      expect(result).toBeNull();
    });

    it('returns BIP with proper mapping when found', async () => {
      mockRow = {
        id: 'BIP-001',
        title: 'Test BIP',
        status: 'active',
        content: JSON.stringify({ abstract: 'Test content' }),
        metadata: JSON.stringify({ author: 'Test Author', tags: ['test'] }),
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };

      const result = await service.get('BIP-001');

      expect(result).toMatchObject({
        id: 'BIP-001',
        title: 'Test BIP',
        status: 'active',
        content: { abstract: 'Test content' },
        metadata: { author: 'Test Author', tags: ['test'] },
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      });
    });

    it('handles BIP without metadata', async () => {
      mockRow = {
        id: 'BIP-001',
        title: 'Simple BIP',
        status: null,
        content: null,
        metadata: null,
        created_at: '2025-01-01',
        updated_at: null,
      };

      const result = await service.get('BIP-001');

      expect(result).toMatchObject({
        id: 'BIP-001',
        title: 'Simple BIP',
        status: null,
        content: null,
        metadata: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: undefined,
      });
    });

    it('throws BadRequestException on database error', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Database query failed'); },
      } as any;

      const mockService = new BipsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.get('BIP-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('upsert', () => {
    it('inserts new BIP when it does not exist', async () => {
      mockRow = {
        id: 'BIP-001',
        title: 'New BIP',
        status: 'draft',
        content: JSON.stringify({ abstract: 'New content' }),
        metadata: JSON.stringify({ author: 'New Author' }),
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      };

      const bipData: BipRecord = {
        id: 'BIP-001',
        title: 'New BIP',
        status: 'draft',
        content: { abstract: 'New content' },
        metadata: { author: 'New Author' },
      };

      const result = await service.upsert(bipData);

      expect(preparedCalls[0].sql).toContain('INSERT INTO bips');
      expect(preparedCalls[0].sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(preparedCalls[0].args).toEqual({
        id: 'BIP-001',
        title: 'New BIP',
        status: 'draft',
        content: JSON.stringify({ abstract: 'New content' }),
        metadata: JSON.stringify({ author: 'New Author' }),
      });
      expect(result).toBeTruthy();
    });

    it('updates existing BIP when it exists', async () => {
      mockRow = {
        id: 'BIP-001',
        title: 'Updated BIP',
        status: 'active',
        content: JSON.stringify({ abstract: 'Updated content' }),
        metadata: JSON.stringify({ author: 'Updated Author' }),
        created_at: '2025-01-01',
        updated_at: '2025-01-02',
      };

      const bipData: BipRecord = {
        id: 'BIP-001',
        title: 'Updated BIP',
        status: 'active',
        content: { abstract: 'Updated content' },
        metadata: { author: 'Updated Author' },
      };

      const result = await service.upsert(bipData);

      expect(preparedCalls[0].sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(result).toBeTruthy();
    });

    it('handles BIP with minimal required fields', async () => {
      mockRow = {
        id: 'BIP-001',
        title: 'Minimal BIP',
        status: null,
        content: 'null',
        metadata: '{}',
        created_at: '2025-01-01',
        updated_at: null,
      };

      const bipData: BipRecord = {
        id: 'BIP-001',
        title: 'Minimal BIP',
      };

      const result = await service.upsert(bipData);

      expect(preparedCalls[0].args).toEqual({
        id: 'BIP-001',
        title: 'Minimal BIP',
        status: null,
        content: JSON.stringify(null),
        metadata: JSON.stringify({}),
      });
      expect(result).toBeTruthy();
    });

    it('handles BIP with complex metadata and content', async () => {
      const complexContent = {
        abstract: 'Complex abstract',
        motivation: 'Complex motivation',
        specification: 'Complex spec',
        rationale: 'Complex rationale',
        security_considerations: 'Complex security',
        copyright: 'Complex copyright',
      };

      const complexMetadata = {
        author: 'Complex Author',
        type: 'Standards Track',
        category: 'Core',
        status: 'Final',
        created: '2025-01-01',
        requires: ['BIP-0001', 'BIP-0002'],
        replaces: ['BIP-0000'],
      };

      mockRow = {
        id: 'BIP-001',
        title: 'Complex BIP',
        status: 'final',
        content: JSON.stringify(complexContent),
        metadata: JSON.stringify(complexMetadata),
        created_at: '2025-01-01',
        updated_at: '2025-01-02',
      };

      const bipData: BipRecord = {
        id: 'BIP-001',
        title: 'Complex BIP',
        status: 'final',
        content: complexContent,
        metadata: complexMetadata,
      };

      const result = await service.upsert(bipData);

      expect(preparedCalls[0].args).toEqual({
        id: 'BIP-001',
        title: 'Complex BIP',
        status: 'final',
        content: JSON.stringify(complexContent),
        metadata: JSON.stringify(complexMetadata),
      });
      expect(result).toBeTruthy();
    });
  });

  describe('private helper methods', () => {
    describe('mapRow', () => {
      it('maps complete row correctly', () => {
        const row = {
          id: 'BIP-001',
          title: 'Test BIP',
          status: 'active',
          content: JSON.stringify({ abstract: 'test' }),
          metadata: JSON.stringify({ author: 'test' }),
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        };

        const result = (service as any).mapRow(row);

        expect(result).toEqual({
          id: 'BIP-001',
          title: 'Test BIP',
          status: 'active',
          content: { abstract: 'test' },
          metadata: { author: 'test' },
          createdAt: new Date('2025-01-01T00:00:00Z'),
          updatedAt: new Date('2025-01-02T00:00:00Z'),
        });
      });

      it('handles null/undefined dates', () => {
        const row = {
          id: 'BIP-001',
          title: 'Test BIP',
          status: null,
          content: null,
          metadata: null,
          created_at: null,
          updated_at: null,
        };

        const result = (service as any).mapRow(row);

        expect(result.createdAt).toBeUndefined();
        expect(result.updatedAt).toBeUndefined();
      });
    });

    describe('safeParse', () => {
      it('parses valid JSON string', () => {
        const result = (service as any).safeParse('{"test": "value"}');
        expect(result).toEqual({ test: 'value' });
      });

      it('returns original value for invalid JSON', () => {
        const result = (service as any).safeParse('invalid json');
        expect(result).toBe('invalid json');
      });

      it('returns non-string values as-is', () => {
        const obj = { test: 'value' };
        const result = (service as any).safeParse(obj);
        expect(result).toBe(obj);

        const num = 42;
        const result2 = (service as any).safeParse(num);
        expect(result2).toBe(num);
      });

      it('handles empty string', () => {
        const result = (service as any).safeParse('');
        expect(result).toBe('');
      });

      it('handles null and undefined', () => {
        expect((service as any).safeParse(null)).toBeNull();
        expect((service as any).safeParse(undefined)).toBeUndefined();
      });
    });
  });

  describe('error handling', () => {
    it('handles database errors in list method', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Connection timeout'); },
      } as any;

      const mockService = new BipsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.list()).rejects.toThrow(BadRequestException);
      await expect(mockService.list()).rejects.toThrow('Failed to list BIPs');
    });

    it('handles database errors in get method', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Query syntax error'); },
      } as any;

      const mockService = new BipsService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.get('BIP-001')).rejects.toThrow(BadRequestException);
      await expect(mockService.get('BIP-001')).rejects.toThrow('Failed to get BIP');
    });
  });
});
