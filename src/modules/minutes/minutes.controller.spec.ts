import { Test, TestingModule } from '@nestjs/testing';
import { MinutesController } from './minutes.controller';
import { MinutesService } from './minutes.service';
import { SessionResults, VotingResult, AuditChainEntry } from './minutes.service';

describe('MinutesController (unit)', () => {
  let controller: MinutesController;
  let service: MinutesService;

  const mockService = {
    listSessions: jest.fn(),
    upsertSession: jest.fn(),
    getSession: jest.fn(),
    addSessionVote: jest.fn(),
    listSessionVotes: jest.fn(),
    getSessionResults: jest.fn(),
    getProposalResults: jest.fn(),
    getAuditChain: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinutesController],
      providers: [
        {
          provide: MinutesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MinutesController>(MinutesController);
    service = module.get<MinutesService>(MinutesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/minutes/sessions', () => {
    it('should return list of sessions', async () => {
      const mockSessions = [
        { id: 'session1', title: 'Session 1', date: '2025-01-01' },
        { id: 'session2', title: 'Session 2', date: '2025-01-02' },
      ];

      mockService.listSessions.mockResolvedValue(mockSessions);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.listSessions(response as any);

      expect(mockService.listSessions).toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(mockSessions);
    });
  });

  describe('POST /api/minutes/sessions', () => {
    it('should upsert session successfully', async () => {
      const sessionData = {
        id: 'test-session',
        title: 'Test Session',
        date: '2025-01-01',
        summary: 'Test summary',
      };

      const mockResult = { ...sessionData, metadata: {} };
      mockService.upsertSession.mockResolvedValue(mockResult);

      const result = await controller.upsertSession(sessionData);

      expect(mockService.upsertSession).toHaveBeenCalledWith(sessionData);
      expect(result).toEqual(mockResult);
    });
  });

  describe('GET /api/minutes/sessions/:id/votes', () => {
    it('should return votes for session', async () => {
      const mockVotes = [
        { id: 'vote1', agentId: 'agent1', decision: 'approve' },
        { id: 'vote2', agentId: 'agent2', decision: 'reject' },
      ];

      mockService.listSessionVotes.mockResolvedValue(mockVotes);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.listVotes('test-session', response as any);

      expect(mockService.listSessionVotes).toHaveBeenCalledWith('test-session');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(mockVotes);
    });
  });

  describe('POST /api/minutes/sessions/:id/votes', () => {
    it('should add vote to session', async () => {
      const voteData = {
        id: 'vote1',
        agentId: 'agent1',
        weight: 1.0,
        decision: 'approve',
        comment: 'Good proposal',
        proposalRef: 'P001',
      };

      const mockResult = { ...voteData, sessionId: 'test-session' };
      mockService.addSessionVote.mockResolvedValue(mockResult);

      const result = await controller.addVote('test-session', voteData);

      expect(mockService.addSessionVote).toHaveBeenCalledWith({
        id: 'vote1',
        sessionId: 'test-session',
        agentId: 'agent1',
        weight: 1.0,
        decision: 'approve',
        comment: 'Good proposal',
        proposalRef: 'P001',
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('GET /api/minutes/sessions/:id/results', () => {
    it('should return session results', async () => {
      const mockResults: SessionResults = {
        sessionId: 'test-session',
        session: { id: 'test-session', title: 'Test Session' },
        totalVotes: 5,
        totalAgents: 3,
        participationRate: 1.67,
        resultsByProposal: [],
        auditChain: [],
      };

      mockService.getSessionResults.mockResolvedValue(mockResults);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.getSessionResults('test-session', response as any);

      expect(mockService.getSessionResults).toHaveBeenCalledWith('test-session');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(mockResults);
    });

    it('should return 404 when session not found', async () => {
      mockService.getSessionResults.mockResolvedValue(null);

      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const result = await controller.getSessionResults('non-existent', response as any);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({ message: 'Session not found' });
    });
  });

  describe('GET /api/minutes/sessions/:sessionId/proposals/:proposalRef/results', () => {
    it('should return proposal results', async () => {
      const mockResults: VotingResult = {
        proposalRef: 'P001',
        totalVotes: 3,
        totalWeight: 3.0,
        approveCount: 2,
        approveWeight: 2.2,
        rejectCount: 1,
        rejectWeight: 0.8,
        abstainCount: 0,
        abstainWeight: 0,
        consensusPercentage: 73.33,
        quorumMet: true,
        consensusMet: true,
        result: 'approved',
      };

      mockService.getProposalResults.mockResolvedValue(mockResults);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.getProposalResults('test-session', 'P001', response as any);

      expect(mockService.getProposalResults).toHaveBeenCalledWith('test-session', 'P001');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(mockResults);
    });

    it('should return 404 when proposal results not found', async () => {
      mockService.getProposalResults.mockResolvedValue(null);

      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const result = await controller.getProposalResults('test-session', 'P999', response as any);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({ message: 'Proposal results not found' });
    });
  });

  describe('GET /api/minutes/sessions/:id/audit-chain', () => {
    it('should return audit chain for session', async () => {
      const mockAuditChain: AuditChainEntry[] = [
        {
          id: 'session-test',
          type: 'session',
          timestamp: new Date(),
          hash: 'abc123',
          previousHash: '0'.repeat(64),
          data: { id: 'test-session' },
        },
        {
          id: 'vote1',
          type: 'vote',
          timestamp: new Date(),
          agentId: 'agent1',
          decision: 'approve',
          hash: 'def456',
          previousHash: 'abc123',
          data: { id: 'vote1' },
        },
      ];

      mockService.getAuditChain.mockResolvedValue(mockAuditChain);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.getAuditChain('test-session', response as any);

      expect(mockService.getAuditChain).toHaveBeenCalledWith('test-session');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(mockAuditChain);
    });
  });

  describe('GET /api/minutes/sessions/:id/results/summary', () => {
    it('should return session results summary', async () => {
      const mockFullResults: SessionResults = {
        sessionId: 'test-session',
        session: { id: 'test-session', title: 'Test Session' },
        totalVotes: 5,
        totalAgents: 3,
        participationRate: 1.67,
        resultsByProposal: [
          {
            proposalRef: 'P001',
            totalVotes: 3,
            totalWeight: 3.0,
            approveCount: 2,
            approveWeight: 2.2,
            rejectCount: 1,
            rejectWeight: 0.8,
            abstainCount: 0,
            abstainWeight: 0,
            consensusPercentage: 73.33,
            quorumMet: true,
            consensusMet: true,
            result: 'approved',
          },
        ],
        auditChain: [
          { id: 'session-test', type: 'session', timestamp: new Date(), hash: 'abc', previousHash: '0'.repeat(64), data: {} },
          { id: 'vote1', type: 'vote', timestamp: new Date(), hash: 'def', previousHash: 'abc', data: {} },
        ],
      };

      mockService.getSessionResults.mockResolvedValue(mockFullResults);

      const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const result = await controller.getSessionResultsSummary('test-session', response as any);

      expect(mockService.getSessionResults).toHaveBeenCalledWith('test-session');
      expect(response.status).toHaveBeenCalledWith(200);

      const expectedSummary = {
        sessionId: 'test-session',
        sessionTitle: 'Test Session',
        totalVotes: 5,
        totalAgents: 3,
        participationRate: 1.67,
        proposalsCount: 1,
        proposals: [
          {
            proposalRef: 'P001',
            totalVotes: 3,
            consensusPercentage: 73.33,
            result: 'approved',
            quorumMet: true,
            consensusMet: true,
          },
        ],
        auditChainLength: 2,
        lastUpdated: expect.any(Date),
      };

      expect(response.json).toHaveBeenCalledWith(expectedSummary);
    });

    it('should return 404 when session not found for summary', async () => {
      mockService.getSessionResults.mockResolvedValue(null);

      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const result = await controller.getSessionResultsSummary('non-existent', response as any);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({ message: 'Session not found' });
    });
  });
});
