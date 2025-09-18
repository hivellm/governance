import request from 'supertest';

const API = 'http://localhost:23080/api';

describe('Proposals E2E', () => {
  it('should create or upsert proposals from metadata style payload', async () => {
    const payload = {
      id: 'P999',
      title: 'Test Proposal From Metadata',
      type: 'informational',
      content: {
        abstract: 'A test proposal abstract long enough to pass validation.'.padEnd(60, '.'),
        motivation: 'm'.repeat(120),
        specification: 's'.repeat(220)
      },
      metadata: {
        original_status: 'active',
        tags: ['test','e2e']
      }
    };

    const res = await request(API)
      .post('/proposals')
      .send(payload)
      .expect((r) => [201, 200].includes(r.status));

    expect(res.body.id).toBe('P999');

    const list = await request(API)
      .get('/proposals?limit=1')
      .expect(200);
    expect(list.body.total).toBeGreaterThan(0);
  });
});


