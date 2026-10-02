import request from 'supertest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import app from '../server';
import { parseMetricsFilter, shiftCalendarYear } from '../controllers/admin-read.controller';

describe('Admin phase 1 boundary', () => {
  it.each([
    ['GET', '/api/admin/overview'],
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/media?type=video'],
    ['GET', '/api/admin/businesses'],
    ['GET', '/api/admin/audit-logs'],
    ['GET', '/api/admin/invites'],
    ['POST', '/api/admin/invites'],
    ['POST', '/api/admin/businesses/72000000-0000-0000-0000-000000000001/suspend'],
    ['POST', '/api/admin/businesses/72000000-0000-0000-0000-000000000001/free-period'],
    ['POST', '/api/admin/businesses/72000000-0000-0000-0000-000000000001/revoke-sessions']
  ])('denies an ordinary bearer token on %s %s', async (method, path) => {
    const response = await request(app)[method.toLowerCase() as 'get' | 'post'](path)
      .set('Authorization', 'Bearer ordinary-customer-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('ADMIN_UNAUTHORIZED');
  });

  it('validates temporal filters before touching analytics storage', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(parseMetricsFilter({ from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T00:00:00Z', timezone: 'America/Sao_Paulo',
      granularity: 'day' }, now).timezone).toBe('America/Sao_Paulo');
    expect(() => parseMetricsFilter({ timezone: 'Invalid/Zone' }, now)).toThrow('Invalid timezone');
    expect(() => parseMetricsFilter({ from: '2026-10-01T00:00:00Z',
      to: '2026-09-01T00:00:00Z' }, now)).toThrow('Invalid metrics interval');
    expect(() => parseMetricsFilter({ from: '2026-01-01T00:00:00Z',
      to: '2026-09-01T00:00:00Z', granularity: 'hour' }, now))
      .toThrow('Invalid metrics interval');
  });

  it('compares the same local calendar boundary across daylight saving changes', () => {
    expect(shiftCalendarYear(new Date('2026-11-01T04:00:00Z'), 'America/New_York')
      .toISOString()).toBe('2025-11-01T04:00:00.000Z');
    expect(shiftCalendarYear(new Date('2026-03-08T05:00:00Z'), 'America/New_York')
      .toISOString()).toBe('2025-03-08T05:00:00.000Z');
  });

  it('rejects a customer origin even when an admin-shaped cookie is supplied', async () => {
    const original = process.env.ADMIN_ORIGINS;
    process.env.ADMIN_ORIGINS = 'http://localhost:4300';
    const response = await request(app).get('/api/admin/overview')
      .set('Origin', 'http://localhost:4200')
      .set('Cookie', `pc_admin_session=${'a'.repeat(64)}`);
    if (original === undefined) delete process.env.ADMIN_ORIGINS;
    else process.env.ADMIN_ORIGINS = original;
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ADMIN_ORIGIN_DENIED');
  });

  it('does not ship a service role key or reference in frontend source', () => {
    const root = resolve(__dirname, '../../../frontend/src');
    const walk = (folder: string): string[] => readdirSync(folder, { withFileTypes: true })
      .flatMap(entry => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]);
    for (const file of walk(root)) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service_role/i);
    }
  });
});
