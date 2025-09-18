import request from 'supertest';

const API = 'http://localhost:23080/api';

describe('Minutes & Votes E2E', () => {
  it('should list or create a minutes session and accept votes', async () => {
    const id = 't9999';
    // upsert session
    await request(API)
      .post('/minutes/sessions')
      .send({ id, title: 'Test Session', date: '2025-01-01', summary: 'E2E' })
      .expect(201);

    // add vote requires agent - create minimal agent
    await request(API)
      .post('/agents')
      .send({ id: 'e2e-agent', name: 'E2E Agent', roles: ['voter'] })
      .expect((res) => [201, 409].includes(res.status));

    // add vote
    await request(API)
      .post(`/minutes/sessions/${id}/votes`)
      .send({ id: `${id}-e2e-agent-001`, agentId: 'e2e-agent', weight: 9, decision: 'approve', comment: 'ok', proposalRef: '001' })
      .expect(201);

    // list votes
    const list = await request(API)
      .get(`/minutes/sessions/${id}/votes`)
      .expect(200);

    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);
  });
});


