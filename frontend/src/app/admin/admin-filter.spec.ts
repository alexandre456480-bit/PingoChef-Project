import { describe, expect, it } from 'vitest';
import { customFilter, filterFromParams, presetFilter } from './admin-filter';

describe('Admin temporal filters', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  it('uses local São Paulo day boundaries and a half-open interval', () => {
    const today = presetFilter('today','America/Sao_Paulo',now);
    expect(today.from).toBe('2026-09-30T03:00:00.000Z');
    expect(today.to).toBe('2026-10-01T03:00:00.000Z');
    expect(today.granularity).toBe('hour');
    const last7 = presetFilter('last7','America/Sao_Paulo',now);
    expect(last7.from).toBe('2026-09-24T03:00:00.000Z');
    expect(last7.to).toBe(today.to);
    expect(last7.granularity).toBe('day');
  });
  it('preserves a valid bookmark, comparison and granularity', () => {
    const original = customFilter('range','2026-09-01','2026-09-15','UTC','previous');
    const restored = filterFromParams(Object.fromEntries(Object.entries(original)));
    expect(restored).toEqual(original);
  });
  it('rejects reversed and future custom ranges', () => {
    expect(() => customFilter('range','2026-09-20','2026-09-10','UTC','none')).toThrow();
    expect(() => customFilter('day','2099-01-01','','UTC','none')).toThrow();
  });
});
