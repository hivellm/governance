import { DiscussionsService } from './discussions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DiscussionStatus, CommentType } from './interfaces/discussion.interface';

describe('DiscussionsService (unit)', () => {
  let service: DiscussionsService;
  let mockRows: any[] = [];
  let mockRow: any = null;

  const mockDb = {
    prepare: (sql: string) => {
      const preparedStatement = {
        run: (...args: any[]) => {
          return { changes: 1 };
        },
        get: (...args: any[]) => {
          // For checking existing discussion, return null to allow creation
          if (sql.includes('discussions WHERE proposal_id')) {
            return null;
          }
          return mockRow;
        },
        all: (...args: any[]) => {
          return mockRows;
        },
      };
      return preparedStatement;
    },
  } as any;

  const mockDatabaseService: any = {
    getDatabase: () => mockDb,
  };

  const mockEventEmitter: any = {
    emit: jest.fn(),
  };

  beforeEach(() => {
    mockRows = [];
    mockRow = null;
    jest.clearAllMocks();
    service = new DiscussionsService(mockDatabaseService, mockEventEmitter);
  });

  describe('createDiscussion', () => {
    beforeEach(() => {
      mockRows = []; // Reset for each test
    });

    it('creates discussion successfully', async () => {
      // Mock proposal exists, no existing discussion
      mockRow = { id: 'PROP-001', title: 'Test Proposal', status: 'draft' };
      
      const createRequest = {
        proposalId: 'PROP-001',
        title: 'Test Discussion',
        description: 'Test discussion description',
        moderators: ['moderator-1'],
        settings: {
          maxDurationMinutes: 60,
          allowThreading: true
        }
      };

      const result = await service.createDiscussion(createRequest);

      expect(result).toBeDefined();
      expect(result.proposalId).toBe('PROP-001');
      expect(result.title).toBe('Test Discussion');
      expect(result.status).toBe(DiscussionStatus.ACTIVE);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('discussion.created', expect.any(Object));
    });

    it('throws error if proposal not found', async () => {
      mockRow = null; // No proposal found

      const createRequest = {
        proposalId: 'NONEXISTENT',
        title: 'Test Discussion'
      };

      await expect(service.createDiscussion(createRequest)).rejects.toThrow('Proposal NONEXISTENT not found');
    });
  });

  describe('initialization', () => {
    it('initializes with database and event emitter services', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DiscussionsService);
    });
  });
});
