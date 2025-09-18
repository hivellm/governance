import { ProposalsService } from './proposals.service';
import { NotFoundException } from '@nestjs/common';

describe('ProposalsService (unit)', () => {
  let service: ProposalsService;
  const preparedCalls: Array<{ sql: string; args: any[] }> = [];

  const mockDb = {
    prepare: (sql: string) => ({
      run: (...args: any[]) => {
        preparedCalls.push({ sql, args });
        return { changes: 1 };
      },
      get: (..._args: any[]) => undefined,
      all: (..._args: any[]) => [],
    }),
  };

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
    getStatement: (name: string) => {
      if (name === 'getProposal') {
        return { get: (_id: string) => undefined };
      }
      if (name === 'updateProposalStatus') {
        return { run: () => ({ changes: 1 }) };
      }
      throw new Error('unknown statement: ' + name);
    },
  };

  beforeEach(() => {
    preparedCalls.length = 0;
    service = new ProposalsService(mockDatabaseService);
  });

  it('creates proposal with provided deterministic id and upserts', async () => {
    // Simulate not found on first lookup so it proceeds to create
    jest.spyOn<any, any>(service, 'findById').mockRejectedValue(new NotFoundException());

    const result = await service.createProposal('temp-author', {
      id: 'P123',
      title: 'Test deterministic ID proposal',
      type: 'informational' as any,
      content: {
        abstract: 'a'.repeat(60),
        motivation: 'm'.repeat(120),
        specification: 's'.repeat(220),
      } as any,
      metadata: { tags: ['unit'] } as any,
    } as any);

    expect(result.id).toBe('P123');
    // Validate an UPSERT style INSERT was prepared
    const insertCall = preparedCalls.find(c => /INSERT INTO proposals/.test(c.sql));
    expect(insertCall).toBeTruthy();
    expect(insertCall?.args?.[0]).toBe('P123');
  });
});


