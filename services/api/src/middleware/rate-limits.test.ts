import { beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimits } from './rate-limits.js';
vi.mock('../db/pool.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../routes/api.js', () => ({ api: express.Router().use((_req, res) => res.json({ success: true })) }));
vi.mock('../realtime/internal-telemetry-route.js', () => ({ internalTelemetry: express.Router().use((_req, res) => res.sendStatus(202)) }));
let app: express.Express;
beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'jwt-secret-that-is-long-enough-for-tests';
  process.env.JWT_REFRESH_SECRET = 'refresh-secret-that-is-long-enough-tests';
  process.env.INTERNAL_TRACKER_SECRET = 'internal-route-test-secret-that-is-long';
  app = (await import('../app.js')).app;
});
describe('existing limiter placement; no database started', () => {
  it('login and refresh share auth protection; telemetry and health bypass API limits', async () => {
    for (let i = 0; i < 20; i++) await request(app).post(i % 2 ? '/api/v1/auth/refresh' : '/api/v1/auth/login').expect(200);
    const result = await request(app).post('/api/v1/auth/login').expect(429);
    expect(result.headers['retry-after']).toBeDefined();
    expect(result.body.error.code).toBe('RATE_LIMITED');
    await request(app).post('/api/v1/auth/refresh').expect(429);
    await request(app).post('/internal/v1/telemetry/location').expect(202);
    await request(app).get('/health/live').expect(200);
  });
  it('history is constrained independently before the normal API allowance', async () => {
    for (let i = 0; i < 30; i++) await request(app).get('/api/v1/vehicles/a/history').expect(200);
    await request(app).get('/api/v1/vehicles/a/history').expect(429);
    await request(app).get('/api/v1/vehicles').expect(200);
  });
  it('normal API is capped at 300/minute without affecting telemetry', async () => {
    const isolated = express(); const limits = createRateLimits();
    isolated.use('/api', limits.apiRateLimit, (_req, res) => res.sendStatus(200));
    isolated.post('/internal/telemetry', (_req, res) => res.sendStatus(202));
    for (let i = 0; i < 300; i++) await request(isolated).get('/api/vehicles').expect(200);
    await request(isolated).get('/api/vehicles').expect(429);
    await request(isolated).post('/internal/telemetry').expect(202);
  });
});
