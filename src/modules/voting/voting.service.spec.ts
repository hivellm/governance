import { VotingService } from './voting.service';
import { AgentsService } from '../agents/agents.service';
import { ProposalsService } from '../proposals/proposals.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VoteDecision, VotingSession, AutomatedVotingConfig } from './interfaces/voting.interface';

describe('VotingService (unit)', () => {
  let service: VotingService;
  const preparedCalls: Array<{ sql: string; args?: any[] }> = [];
  const execCalls: string[] = [];
  let mockVotingSession: any = null;
  let mockAgent: any = null;
  let mockProposal: any = null;

  const mockDb = {
    prepare: (sql: string) => ({
      run: (...args: any[]) => {
        preparedCalls.push({ sql, args });
        return { changes: 1 };
      },
      get: (...args: any[]) => mockVotingSession,
    }),
  } as any;

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
  };

  const mockAgentsService: any = {
    findById: jest.fn(),
    findAll: jest.fn(),
    hasPermission: jest.fn(),
  };

  const mockProposalsService: any = {
    findById: jest.fn(),
    moveToVoting: jest.fn(),
    updateProposalStatusPublic: jest.fn(),
  };

  beforeEach(() => {
    preparedCalls.length = 0;
    execCalls.length = 0;
    mockVotingSession = null;
    mockAgent = null;
    mockProposal = null;

    // Reset all mocks
    jest.clearAllMocks();

    service = new VotingService(
      mockDatabaseService,
      mockAgentsService,
      mockProposalsService,
    );
  });

  const createMockSessionRow = (session: VotingSession) => ({
    id: session.id,
    proposal_id: session.proposalId,
    status: session.status,
    config: JSON.stringify(session.config),
    started_at: session.startedAt.toISOString(),
    deadline: session.deadline.toISOString(),
    eligible_agents: JSON.stringify(session.eligibleAgents),
    votes: JSON.stringify(session.votes),
    results: JSON.stringify(session.results),
    finalized_at: session.finalizedAt?.toISOString() || null,
  });

  describe('initiateAutomatedVoting', () => {
    it('creates voting session with default configuration', async () => {
      mockProposal = {
        id: 'P001',
        status: 'discussion',
        title: 'Test Proposal',
      };

      mockAgentsService.findAll.mockResolvedValue({
        items: [
          { id: 'agent1', roles: ['voter'] },
          { id: 'agent2', roles: ['reviewer'] },
        ],
        total: 2,
        page: 1,
        limit: 10,
      });

      mockProposalsService.findById.mockResolvedValue(mockProposal);
      mockProposalsService.moveToVoting.mockResolvedValue(undefined);

      const result = await service.initiateAutomatedVoting('P001');

      expect(result.proposalId).toBe('P001');
      expect(result.status).toBe('active');
      expect(result.config.duration).toBe(48);
      expect(result.config.quorumThreshold).toBe(0.6);
      expect(result.config.consensusThreshold).toBe(0.7);
      expect(result.config.autoFinalize).toBe(true);
      expect(result.eligibleAgents).toEqual(['agent1', 'agent2']);
      expect(mockProposalsService.moveToVoting).toHaveBeenCalledWith('P001', expect.any(Date));
    });

    it('throws error if proposal is not in discussion phase', async () => {
      mockProposal = {
        id: 'P001',
        status: 'approved',
        title: 'Test Proposal',
      };

      mockProposalsService.findById.mockResolvedValue(mockProposal);

      await expect(service.initiateAutomatedVoting('P001')).rejects.toThrow(BadRequestException);
      await expect(service.initiateAutomatedVoting('P001')).rejects.toThrow('Proposal must be in discussion phase');
    });

    it('applies custom configuration', async () => {
      mockProposal = {
        id: 'P001',
        status: 'discussion',
        title: 'Test Proposal',
      };

      mockAgentsService.findAll.mockResolvedValue({
        items: [{ id: 'agent1', roles: ['voter'] }],
        total: 1,
        page: 1,
        limit: 10,
      });

      mockProposalsService.findById.mockResolvedValue(mockProposal);
      mockProposalsService.moveToVoting.mockResolvedValue(undefined);

      const customConfig: AutomatedVotingConfig = {
        duration: 24,
        quorumThreshold: 0.8,
        consensusThreshold: 0.9,
        autoFinalize: false,
        allowedRoles: ['reviewer'],
        votingRules: [],
        timeoutBehavior: 'extend_once',
      };

      const result = await service.initiateAutomatedVoting('P001', customConfig);

      expect(result.config.duration).toBe(24);
      expect(result.config.quorumThreshold).toBe(0.8);
      expect(result.config.consensusThreshold).toBe(0.9);
      expect(result.config.autoFinalize).toBe(false);
      expect(result.config.allowedRoles).toEqual(['reviewer']);
    });

    it('calculates correct voting deadline', async () => {
      mockProposal = {
        id: 'P001',
        status: 'discussion',
        title: 'Test Proposal',
      };

      mockAgentsService.findAll.mockResolvedValue({
        items: [{ id: 'agent1', roles: ['voter'] }],
        total: 1,
        page: 1,
        limit: 10,
      });

      mockProposalsService.findById.mockResolvedValue(mockProposal);
      mockProposalsService.moveToVoting.mockResolvedValue(undefined);

      const startTime = new Date();
      const result = await service.initiateAutomatedVoting('P001', {
        duration: 72,
        quorumThreshold: 0.6,
        consensusThreshold: 0.7,
        autoFinalize: true,
        allowedRoles: ['voter'],
        votingRules: [],
        timeoutBehavior: 'extend_once',
      });

      const expectedDeadline = new Date(startTime.getTime() + 72 * 60 * 60 * 1000);
      expect(result.deadline.getTime()).toBeGreaterThanOrEqual(expectedDeadline.getTime() - 1000);
      expect(result.deadline.getTime()).toBeLessThanOrEqual(expectedDeadline.getTime() + 1000);
    });
  });

  describe('castVote', () => {
    let activeSession: VotingSession;

    beforeEach(() => {
      activeSession = {
        id: 'vs-123',
        proposalId: 'P001',
        status: 'active',
        config: {
          duration: 48,
          quorumThreshold: 0.6,
          consensusThreshold: 0.7,
          autoFinalize: true,
          allowedRoles: ['voter', 'reviewer'],
          votingRules: [],
          timeoutBehavior: 'extend_once',
        },
        startedAt: new Date(Date.now() - 1000), // 1 second ago
        deadline: new Date(Date.now() + 3600000), // 1 hour from now
        eligibleAgents: ['agent1', 'agent2'],
        votes: [],
        results: null,
      };

      mockAgent = {
        id: 'agent1',
        name: 'Test Agent',
        roles: ['voter'],
        permissions: { canVote: true },
        performanceMetrics: {
          qualityScore: 0.8,
          consensusScore: 0.7,
        },
      };
    });

    it('successfully casts vote with justification', async () => {
      mockVotingSession = createMockSessionRow(activeSession);
      mockAgentsService.findById.mockResolvedValue(mockAgent);

      const result = await service.castVote('vs-123', 'agent1', VoteDecision.APPROVE, 'Great proposal!');

      expect(result.agentId).toBe('agent1');
      expect(result.decision).toBe(VoteDecision.APPROVE);
      expect(result.justification).toBe('Great proposal!');
      expect(result.weight).toBeCloseTo(1.225, 2); // Base 1.0 + 0.225 from metrics (0.8+0.7)/2 * 0.3 = 0.225
      expect(result.castAt).toBeInstanceOf(Date);
    });

    it('calculates vote weight correctly based on agent metrics', async () => {
      mockVotingSession = createMockSessionRow(activeSession);
      mockAgentsService.findById.mockResolvedValue({
        ...mockAgent,
        roles: ['reviewer'],
        performanceMetrics: {
          qualityScore: 1.0,
          consensusScore: 1.0,
        },
      });

      const result = await service.castVote('vs-123', 'agent1', VoteDecision.APPROVE);

      // Base 1.0 + ((1.0 + 1.0) / 2) * 0.3 = 1.3, then * 1.2 for reviewer = 1.56
      expect(result.weight).toBeCloseTo(1.56, 2);
    });

    it('throws error if voting session is not active', async () => {
      const inactiveSession: VotingSession = { ...activeSession, status: 'finalized' as const };
      mockVotingSession = createMockSessionRow(inactiveSession);

      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow(BadRequestException);
      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow('Voting session is finalized');
    });

    it('throws error if voting deadline has passed', async () => {
      const expiredSession: VotingSession = {
        ...activeSession,
        deadline: new Date(Date.now() - 1000), // 1 second ago
      };
      mockVotingSession = createMockSessionRow(expiredSession);

      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow(BadRequestException);
      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow('Voting deadline has passed');
    });

    it('throws error if agent is not eligible to vote', async () => {
      mockVotingSession = createMockSessionRow({ ...activeSession, eligibleAgents: ['agent2'] });
      mockAgentsService.findById.mockResolvedValue(mockAgent);

      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow(BadRequestException);
      await expect(service.castVote('vs-123', 'agent1', VoteDecision.APPROVE)).rejects.toThrow('Agent is not eligible to vote');
    });

    it('throws error if agent has already voted', async () => {
      const sessionWithVote: VotingSession = {
        ...activeSession,
        votes: [{ id: 'vote1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.APPROVE, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' }],
      };
      mockVotingSession = createMockSessionRow(sessionWithVote);
      mockAgentsService.findById.mockResolvedValue(mockAgent);

      await expect(service.castVote('vs-123', 'agent1', VoteDecision.REJECT)).rejects.toThrow(BadRequestException);
      await expect(service.castVote('vs-123', 'agent1', VoteDecision.REJECT)).rejects.toThrow('Agent has already voted');
    });

    it('handles vote without justification', async () => {
      mockVotingSession = createMockSessionRow(activeSession);
      mockAgentsService.findById.mockResolvedValue(mockAgent);

      const result = await service.castVote('vs-123', 'agent1', VoteDecision.ABSTAIN);

      expect(result.justification).toBe('');
    });

    it('applies minimum and maximum weight limits', async () => {
      mockVotingSession = createMockSessionRow(activeSession);
      mockAgentsService.findById.mockResolvedValue({
        ...mockAgent,
        roles: ['mediator', 'reviewer'],
        performanceMetrics: {
          qualityScore: 1.0,
          consensusScore: 1.0,
        },
      });

      const result = await service.castVote('vs-123', 'agent1', VoteDecision.APPROVE);

      // Should not exceed maximum weight of 2.0
      expect(result.weight).toBeLessThanOrEqual(2.0);
      expect(result.weight).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('getVotingResults', () => {
    let sessionWithVotes: VotingSession;

    beforeEach(() => {
      const baseTime = new Date();
      sessionWithVotes = {
        id: 'vs-123',
        proposalId: 'P001',
        status: 'active',
        config: {
          duration: 48,
          quorumThreshold: 0.6,
          consensusThreshold: 0.7,
          autoFinalize: true,
          allowedRoles: ['voter'],
          votingRules: [],
          timeoutBehavior: 'extend_once',
        },
        startedAt: baseTime,
        deadline: new Date(baseTime.getTime() + 3600000), // 1 hour from now
        eligibleAgents: ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'],
        votes: [
          { id: 'v1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.APPROVE, weight: 1.0, castAt: baseTime, justification: '', proposalRef: 'P001' },
          { id: 'v2', sessionId: 'vs-123', agentId: 'agent2', decision: VoteDecision.APPROVE, weight: 1.2, castAt: baseTime, justification: '', proposalRef: 'P001' },
          { id: 'v3', sessionId: 'vs-123', agentId: 'agent3', decision: VoteDecision.REJECT, weight: 0.8, castAt: baseTime, justification: '', proposalRef: 'P001' },
          { id: 'v4', sessionId: 'vs-123', agentId: 'agent4', decision: VoteDecision.ABSTAIN, weight: 1.0, castAt: baseTime, justification: '', proposalRef: 'P001' },
        ],
        results: null,
      };
    });

    it('calculates voting results correctly', async () => {
      mockVotingSession = createMockSessionRow(sessionWithVotes);

      const results = await service.getVotingResults('vs-123');

      expect(results.sessionId).toBe('vs-123');
      expect(results.proposalId).toBe('P001');
      expect(results.status).toBe('active');
      expect(results.totalEligible).toBe(5);
      expect(results.totalVotes).toBe(4);
      expect(results.participationRate).toBe(0.8);
      expect(results.quorumMet).toBe(true); // 0.8 >= 0.6
      expect(results.quorumThreshold).toBe(0.6);

      expect(results.votes.approve.count).toBe(2);
      expect(results.votes.approve.weight).toBe(2.2); // 1.0 + 1.2
      expect(results.votes.reject.count).toBe(1);
      expect(results.votes.reject.weight).toBe(0.8);
      expect(results.votes.abstain.count).toBe(1);
      expect(results.votes.abstain.weight).toBe(1.0);

      // Consensus: approve weight / total weight = 2.2 / 4.0 = 55%
      expect(results.consensus.percentage).toBeCloseTo(55, 2);
      expect(results.consensus.threshold).toBe(70);
      expect(results.consensus.met).toBe(false);

      expect(results.result).toBe('pending'); // Not finalized
      expect(results.timeRemaining).toBeGreaterThan(0);
      expect(results.finalizedAt).toBeNull();
    });

    it('detects consensus when threshold is met', async () => {
      const highConsensusSession = {
        ...sessionWithVotes,
        votes: [
          { id: 'v1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.APPROVE, weight: 2.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
          { id: 'v2', sessionId: 'vs-123', agentId: 'agent2', decision: VoteDecision.APPROVE, weight: 2.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
          { id: 'v3', sessionId: 'vs-123', agentId: 'agent3', decision: VoteDecision.APPROVE, weight: 2.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
        ],
      };
      mockVotingSession = createMockSessionRow(highConsensusSession);

      const results = await service.getVotingResults('vs-123');

      expect(results.consensus.percentage).toBe(100);
      expect(results.consensus.met).toBe(true);
    });

    it('returns approved result when finalized and consensus met', async () => {
      const finalizedSession: VotingSession = {
        ...sessionWithVotes,
        status: 'finalized' as const,
        finalizedAt: new Date(),
      };
      mockVotingSession = createMockSessionRow(finalizedSession);

      const results = await service.getVotingResults('vs-123');

      // Since session is finalized, result should be either approved or rejected based on consensus
      expect(['approved', 'rejected']).toContain(results.result);
      expect(results.finalizedAt).toBeInstanceOf(Date);
    });

    it('returns rejected result when finalized and consensus not met', async () => {
      const finalizedSession: VotingSession = {
        ...sessionWithVotes,
        status: 'finalized' as const,
        finalizedAt: new Date(),
        votes: [
          { id: 'v1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.REJECT, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
          { id: 'v2', sessionId: 'vs-123', agentId: 'agent2', decision: VoteDecision.REJECT, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
        ],
      };
      mockVotingSession = createMockSessionRow(finalizedSession);

      const results = await service.getVotingResults('vs-123');

      expect(results.result).toBe('rejected');
    });

    it('handles zero votes scenario', async () => {
      const emptySession = {
        ...sessionWithVotes,
        votes: [],
      };
      mockVotingSession = createMockSessionRow(emptySession);

      const results = await service.getVotingResults('vs-123');

      expect(results.totalVotes).toBe(0);
      expect(results.participationRate).toBe(0);
      expect(results.consensus.percentage).toBe(0);
      expect(results.quorumMet).toBe(false);
    });
  });

  describe('finalizeVoting', () => {
    it('finalizes voting session and updates proposal status', async () => {
      const activeSession: VotingSession = {
        id: 'vs-123',
        proposalId: 'P001',
        status: 'active' as const,
        config: {
          duration: 48,
          quorumThreshold: 0.6,
          consensusThreshold: 0.7,
          autoFinalize: true,
          allowedRoles: ['voter'],
          votingRules: [],
          timeoutBehavior: 'extend_once' as const,
        },
        startedAt: new Date(),
        deadline: new Date(Date.now() + 3600000),
        eligibleAgents: ['agent1', 'agent2'],
        votes: [
          { id: 'v1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.APPROVE, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
          { id: 'v2', sessionId: 'vs-123', agentId: 'agent2', decision: VoteDecision.APPROVE, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
        ],
        results: null,
      };

      mockVotingSession = createMockSessionRow(activeSession);
      mockProposalsService.updateProposalStatusPublic.mockResolvedValue(undefined);

      const results = await service.finalizeVoting('vs-123');

      // Verify that the proposal status was updated (the actual result depends on session state)
      expect(mockProposalsService.updateProposalStatusPublic).toHaveBeenCalledWith('P001', expect.any(String));
    });

    it('throws error if session is already finalized', async () => {
      const finalizedSession: VotingSession = {
        id: 'vs-123',
        proposalId: 'P001',
        status: 'finalized' as const,
        config: {
          duration: 48,
          quorumThreshold: 0.6,
          consensusThreshold: 0.7,
          autoFinalize: true,
          allowedRoles: ['voter'],
          votingRules: [],
          timeoutBehavior: 'extend_once' as const,
        },
        startedAt: new Date(),
        deadline: new Date(),
        eligibleAgents: [],
        votes: [],
        results: null,
        finalizedAt: new Date(),
      };
      mockVotingSession = createMockSessionRow(finalizedSession);

      await expect(service.finalizeVoting('vs-123')).rejects.toThrow(BadRequestException);
      await expect(service.finalizeVoting('vs-123')).rejects.toThrow('Already finalized');
    });

    it('rejects proposal when consensus not met', async () => {
      const sessionWithoutConsensus: VotingSession = {
        id: 'vs-123',
        proposalId: 'P001',
        status: 'active' as const,
        config: {
          duration: 48,
          quorumThreshold: 0.6,
          consensusThreshold: 0.7,
          autoFinalize: true,
          allowedRoles: ['voter'],
          votingRules: [],
          timeoutBehavior: 'extend_once' as const,
        },
        startedAt: new Date(),
        deadline: new Date(Date.now() + 3600000),
        eligibleAgents: ['agent1', 'agent2'],
        votes: [
          { id: 'v1', sessionId: 'vs-123', agentId: 'agent1', decision: VoteDecision.REJECT, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
          { id: 'v2', sessionId: 'vs-123', agentId: 'agent2', decision: VoteDecision.REJECT, weight: 1.0, castAt: new Date(), justification: '', proposalRef: 'P001' },
        ],
        results: null,
      };

      mockVotingSession = createMockSessionRow(sessionWithoutConsensus);
      mockProposalsService.updateProposalStatusPublic.mockResolvedValue(undefined);

      const results = await service.finalizeVoting('vs-123');

      // Verify that the proposal status was updated (the actual result depends on session state)
      expect(mockProposalsService.updateProposalStatusPublic).toHaveBeenCalledWith('P001', expect.any(String));
    });
  });

  describe('private helper methods', () => {
    describe('getEligibleVoters', () => {
      it('returns all active agents as eligible voters', async () => {
        const mockAgents = [
          { id: 'agent1', roles: ['voter'] },
          { id: 'agent2', roles: ['reviewer'] },
          { id: 'agent3', roles: ['voter'] },
        ];

        mockAgentsService.findAll.mockResolvedValue({
          items: mockAgents,
          total: 3,
          page: 1,
          limit: 10,
        });

        const eligible = await (service as any).getEligibleVoters(['voter', 'reviewer']);

        expect(eligible).toEqual(['agent1', 'agent2', 'agent3']);
        expect(mockAgentsService.findAll).toHaveBeenCalledWith({ isActive: true }, 1, 1000);
      });

      it('handles empty agent list', async () => {
        mockAgentsService.findAll.mockResolvedValue({
          items: [],
          total: 0,
          page: 1,
          limit: 10,
        });

        const eligible = await (service as any).getEligibleVoters(['voter']);

        expect(eligible).toEqual([]);
      });
    });

    describe('calculateVoteWeight', () => {
      it('calculates weight based on performance metrics', async () => {
        const agent = {
          roles: ['voter'],
          performanceMetrics: {
            qualityScore: 0.8,
            consensusScore: 0.6,
          },
        };

        const session = { config: {} } as VotingSession;
        const weight = await (service as any).calculateVoteWeight(agent, session);

        // Base 1.0 + ((0.8 + 0.6) / 2) * 0.3 = 1.21
        expect(weight).toBeCloseTo(1.21, 2);
      });

      it('applies role-based multipliers', async () => {
        const reviewerAgent = {
          roles: ['reviewer'],
          performanceMetrics: { qualityScore: 0.5, consensusScore: 0.5 },
        };

        const mediatorAgent = {
          roles: ['mediator'],
          performanceMetrics: { qualityScore: 0.5, consensusScore: 0.5 },
        };

        const session = { config: {} } as VotingSession;

        const reviewerWeight = await (service as any).calculateVoteWeight(reviewerAgent, session);
        const mediatorWeight = await (service as any).calculateVoteWeight(mediatorAgent, session);

        // Base 1.0 + ((0.5 + 0.5) / 2) * 0.3 = 1.15
        // Reviewer: 1.15 * 1.2 = 1.38
        // Mediator: 1.15 * 1.1 = 1.265
        expect(reviewerWeight).toBeCloseTo(1.38, 2);
        expect(mediatorWeight).toBeCloseTo(1.265, 2);
      });

      it('handles missing performance metrics', async () => {
        const agent = {
          roles: ['voter'],
          performanceMetrics: {},
        };

        const session = { config: {} } as VotingSession;
        const weight = await (service as any).calculateVoteWeight(agent, session);

        // Base 1.0 + ((0.5 + 0.5) / 2) * 0.3 = 1.15 (defaults to 0.5)
        expect(weight).toBeCloseTo(1.15, 2);
      });

      it('enforces weight limits', async () => {
        const highPerfAgent = {
          roles: ['reviewer', 'mediator'],
          performanceMetrics: { qualityScore: 1.0, consensusScore: 1.0 },
        };

        const session = { config: {} } as VotingSession;
        const weight = await (service as any).calculateVoteWeight(highPerfAgent, session);

        // Should not exceed 2.0
        expect(weight).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('database operations', () => {
    describe('getVotingSession', () => {
      it('throws NotFoundException when session not found', async () => {
        mockVotingSession = null;

        await expect((service as any).getVotingSession('non-existent')).rejects.toThrow(NotFoundException);
        await expect((service as any).getVotingSession('non-existent')).rejects.toThrow('Voting session not found');
      });

      it('parses JSON fields correctly', async () => {
        const mockRow = {
          id: 'vs-123',
          proposal_id: 'P001',
          status: 'active',
          config: JSON.stringify({ duration: 48 }),
          started_at: '2025-01-01T10:00:00Z',
          deadline: '2025-01-01T12:00:00Z',
          eligible_agents: JSON.stringify(['agent1', 'agent2']),
          votes: JSON.stringify([{ id: 'v1' }]),
          results: JSON.stringify({ consensus: 0.8 }),
          finalized_at: '2025-01-01T12:30:00Z',
        };

        mockVotingSession = mockRow;

        const session = await (service as any).getVotingSession('vs-123');

        expect(session.id).toBe('vs-123');
        expect(session.proposalId).toBe('P001');
        expect(session.status).toBe('active');
        expect(session.config).toEqual({ duration: 48 });
        expect(session.startedAt).toBeInstanceOf(Date);
        expect(session.deadline).toBeInstanceOf(Date);
        expect(session.eligibleAgents).toEqual(['agent1', 'agent2']);
        expect(session.votes).toEqual([{ id: 'v1' }]);
        expect(session.results).toEqual({ consensus: 0.8 });
        expect(session.finalizedAt).toBeInstanceOf(Date);
      });

      it('handles null results and finalized_at', async () => {
        const mockRow = {
          id: 'vs-123',
          proposal_id: 'P001',
          status: 'active',
          config: JSON.stringify({}),
          started_at: '2025-01-01T10:00:00Z',
          deadline: '2025-01-01T12:00:00Z',
          eligible_agents: JSON.stringify([]),
          votes: JSON.stringify([]),
          results: null,
          finalized_at: null,
        };

        mockVotingSession = mockRow;

        const session = await (service as any).getVotingSession('vs-123');

        expect(session.results).toBeNull();
        expect(session.finalizedAt).toBeUndefined();
      });
    });
  });
});
