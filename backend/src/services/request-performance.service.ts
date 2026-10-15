import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestPerformance {
  started: number; finished: boolean; authMs: number; authDepth: number;
  databaseMs: number; databaseCalls: number; externalMs: number; externalCalls: number;
}
export const requestPerformance = new AsyncLocalStorage<RequestPerformance>();

export async function measureAuth<T>(action: () => Promise<T>): Promise<T> {
  const context = requestPerformance.getStore();
  if (!context || context.finished) return action();
  const outer = context.authDepth++ === 0, started = performance.now();
  try { return await action(); }
  finally { context.authDepth--; if (outer) context.authMs += performance.now() - started; }
}

// No URL, headers, body, token or provider result is retained. Provider latency
// ends at response headers; total request duration also includes body transfer.
export const measuredFetch = (provider: 'supabase' | 'external'): typeof fetch => async (...args) => {
  const context = requestPerformance.getStore();
  if (!context || context.finished) return globalThis.fetch(...args);
  const input = args[0];
  const path = provider === 'supabase' ? new URL(typeof input === 'string' || input instanceof URL ? input : input.url).pathname : '';
  const database = provider === 'supabase' && path.startsWith('/rest/v1/');
  const started = performance.now();
  if (database) context.databaseCalls++; else context.externalCalls++;
  try { return await globalThis.fetch(...args); }
  finally {
    if (database) context.databaseMs += performance.now() - started;
    else context.externalMs += performance.now() - started;
  }
};
