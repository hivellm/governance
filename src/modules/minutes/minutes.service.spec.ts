import { MinutesService, SessionResults, VotingResult, AuditChainEntry } from './minutes.service';
import { BadRequestException } from '@nestjs/common';

describe('MinutesService (unit)', () => {
  let service: MinutesService;
  const preparedCalls: Array<{ sql: string; args?: any[] }> = [];
  const execCalls: string[] = [];
  let mockRow: any = null;
  let mockRows: any[] = [];

  const mockDb = {
    prepare: (sql: string) => ({
      run: (...args: any[]) => {
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
    execCalls.length = 0;
    mockRow = null;
    mockRows.length = 0;
    service = new MinutesService(mockDatabaseService);
  });

  it('upserts session and lists votes', async () => {
    mockRow = {
      id: '0009',
      title: 'Test Session',
      date: '2025-01-01',
      summary: 'Test Summary',
      metadata: '{}',
    };

    await service.upsertSession({ id: '0009', title: 'T', date: '2025-01-01', summary: 'S' });
    expect(preparedCalls.some(s => s.sql.includes('INSERT INTO minutes_sessions'))).toBe(true);

    mockRows = [];
    const list = await service.listSessionVotes('0009');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  describe('getSessionResults', () => {
    it('returns null when session not found', async () => {
      mockRow = null;

      const result = await service.getSessionResults('non-existent');

      expect(result).toBeNull();
    });

    it('calculates comprehensive session results', async () => {
      // Mock session
      mockRow = {
        id: 'test-session',
        title: 'Test Voting Session',
        date: '2025-01-01',
        summary: 'Important decisions made',
        metadata: JSON.stringify({ location: 'Virtual' }),
      };

      // Mock votes
      mockRows = [
        {
          id: 'vote1',
          session_id: 'test-session',
          agent_id: 'agent1',
          weight: 1.0,
          decision: 'approve',
          comment: 'Great proposal!',
          proposal_ref: 'P001',
          cast_at: '2025-01-01T10:00:00Z',
        },
        {
          id: 'vote2',
          session_id: 'test-session',
          agent_id: 'agent2',
          weight: 1.2,
          decision: 'approve',
          comment: 'I support this',
          proposal_ref: 'P001',
          cast_at: '2025-01-01T10:05:00Z',
        },
        {
          id: 'vote3',
          session_id: 'test-session',
          agent_id: 'agent3',
          weight: 0.8,
          decision: 'reject',
          comment: 'Need more discussion',
          proposal_ref: 'P001',
          cast_at: '2025-01-01T10:10:00Z',
        },
      ];

      const result = await service.getSessionResults('test-session');

      expect(result).toBeTruthy();
      expect(result?.sessionId).toBe('test-session');
      expect(result?.session.title).toBe('Test Voting Session');
      expect(result?.totalVotes).toBe(3);
      expect(result?.totalAgents).toBe(3);
      expect(result?.resultsByProposal).toHaveLength(1);
      expect(result?.auditChain).toHaveLength(4); // 1 session + 3 votes
    });
  });

  describe('getAuditChain', () => {
    it('generates audit chain for session with votes', async () => {
      // Mock session
      mockRow = {
        id: 'audit-session',
        title: 'Audit Test Session',
        date: '2025-01-01',
        summary: 'Testing audit chain',
        metadata: '{}',
      };

      // Mock votes
      mockRows = [
        {
          id: 'vote1',
          session_id: 'audit-session',
          agent_id: 'agent1',
          weight: 1.0,
          decision: 'approve',
          comment: 'Approved',
          proposal_ref: 'P001',
          cast_at: '2025-01-01T10:00:00Z',
        },
        {
          id: 'vote2',
          session_id: 'audit-session',
          agent_id: 'agent2',
          weight: 1.2,
          decision: 'reject',
          comment: 'Rejected',
          proposal_ref: 'P001',
          cast_at: '2025-01-01T10:05:00Z',
        },
      ];

      const auditChain = await service.getAuditChain('audit-session');

      expect(auditChain).toHaveLength(3); // 1 session + 2 votes
      expect(auditChain[0].type).toBe('session');
      expect(auditChain[0].id).toBe('session-audit-session');
      expect(auditChain[0].hash).toBeTruthy();
      expect(auditChain[0].previousHash).toBe('0'.repeat(64));

      expect(auditChain[1].type).toBe('vote');
      expect(auditChain[1].id).toBe('vote1');
      expect(auditChain[1].agentId).toBe('agent1');
      expect(auditChain[1].decision).toBe('approve');
      expect(auditChain[1].previousHash).toBe(auditChain[0].hash);

      expect(auditChain[2].type).toBe('vote');
      expect(auditChain[2].id).toBe('vote2');
      expect(auditChain[2].agentId).toBe('agent2');
      expect(auditChain[2].decision).toBe('reject');
      expect(auditChain[2].previousHash).toBe(auditChain[1].hash);
    });
  });

  describe('Error handling', () => {
    it('handles database errors in getSessionResults', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Database connection failed'); },
      } as any;

      const mockService = new MinutesService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.getSessionResults('test-session')).rejects.toThrow(BadRequestException);
    });

    it('handles database errors in getAuditChain', async () => {
      const mockDbError = {
        prepare: () => { throw new Error('Connection timeout'); },
      } as any;

      const mockService = new MinutesService({ getDatabase: () => mockDbError } as any);

      await expect(mockService.getAuditChain('test-session')).rejects.toThrow(BadRequestException);
    });
  });
});


