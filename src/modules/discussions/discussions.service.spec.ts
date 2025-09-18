import { DiscussionsService } from './discussions.service';

describe('DiscussionsService (unit)', () => {
  let service: DiscussionsService;

  const mockDatabaseService: any = {
    getDatabase: () => ({}),
  };

  beforeEach(() => {
    service = new DiscussionsService(mockDatabaseService);
  });

  describe('placeholder', () => {
    it('returns placeholder message for Phase 2', async () => {
      const result = await service.placeholder();

      expect(result).toBe('DiscussionsService ready for Phase 2 implementation');
      expect(result).toContain('Phase 2');
    });

    it('logs placeholder message', async () => {
      const loggerSpy = jest.spyOn<any, any>(service['logger'], 'log');

      await service.placeholder();

      expect(loggerSpy).toHaveBeenCalledWith('DiscussionsService placeholder - to be implemented in Phase 2');
    });
  });

  describe('initialization', () => {
    it('initializes with database service', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DiscussionsService);
    });
  });
});
