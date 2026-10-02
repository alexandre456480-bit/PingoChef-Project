export type AnalyticsPlan = 'FREE' | 'BASIC' | 'MEDIUM' | 'PRO';
export const fixtureToday = '2026-10-02';
const shift = (date: string, days: number) =>
  new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export function analyticsOptions(plan: AnalyticsPlan) {
  const historyDays = plan === 'PRO' ? 3650 : plan === 'MEDIUM' ? 730 : 31;
  return {
    timezone: 'America/Sao_Paulo',
    today: fixtureToday,
    minDate: shift(fixtureToday, 1 - historyDays),
    historyDays,
    collectionStartedAt: '2026-09-01T03:00:00Z',
    rawRetentionDays: 90,
    aggregateRetentionDays: 3650,
    advanced: ['MEDIUM', 'PRO'].includes(plan),
    complete: plan === 'PRO',
    tier: plan === 'PRO' ? 'Completo' : plan === 'MEDIUM' ? 'Avançado' : 'Essencial',
  };
}
export const productRows = Array.from({ length: 7 }, (_, i) => ({
  id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`,
  name: 'Produto ' + (i + 1),
  value: 20 - i,
  removed: false,
}));
export function analyticsReport(plan: AnalyticsPlan, params = new URLSearchParams()) {
  const start = params.get('start') || shift(fixtureToday, -6),
    end = params.get('end') || fixtureToday;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1,
    bucket = days === 1 ? 'hour' : days <= 60 ? 'day' : days <= 180 ? 'week' : 'month';
  const opts = analyticsOptions(plan),
    total = params.get('source') ? 4 : 42;
  const summary = {
    menuViews: total,
    visitors: 3,
    productViews: 28,
    videoPlays: 6,
    video25: 5,
    video50: 3,
    video100: 1,
    likes: 4,
    qrEntries: 4,
  };
  const series =
    days === 1
      ? Array.from({ length: 24 }, (_, h) => ({
          date: start,
          hour: h,
          menuViews: h === 12 ? total : 0,
          visitors: h === 12 ? 3 : 0,
          productViews: 0,
          videoPlays: 0,
        }))
      : [
          { date: start, menuViews: total - 4, visitors: 2, productViews: 25, videoPlays: 5 },
          { date: end, menuViews: 4, visitors: 2, productViews: 3, videoPlays: 1 },
        ];
  return {
    range: { start, end, days, bucket },
    timezone: opts.timezone,
    collectionStartedAt: opts.collectionStartedAt,
    summary,
    series,
    viewed: { total: 7, rows: productRows.slice(0, 5) },
    liked: { total: 1, rows: productRows.slice(0, 1) },
    categories: opts.advanced
      ? {
          total: 1,
          rows: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Pratos',
              value: 12,
              removed: false,
            },
          ],
        }
      : null,
    sources: opts.advanced
      ? [
          { name: 'direct', value: total - 4 },
          { name: 'qr', value: 4 },
        ]
      : null,
    hours: opts.advanced
      ? Array.from({ length: 24 }, (_, h) => ({ hour: h, value: h === 12 ? total : 0 }))
      : null,
    qr: opts.complete
      ? [
          { id: '44444444-4444-4444-8444-444444444444', name: 'Mesa 1', value: 3 },
          { id: null, name: 'QR removido/não identificado', value: 1 },
        ]
      : null,
    likesAttributed: !params.get('source') && !params.get('qrId'),
    comparison:
      params.get('comparison') && params.get('comparison') !== 'none'
        ? {
            range: { start: shift(start, -days), end: shift(start, -1), days, bucket },
            summary: { ...summary, menuViews: 0 },
            deltas: Object.fromEntries(
              ['menuViews', 'visitors', 'productViews', 'videoPlays'].map((k) => [
                k,
                {
                  current: summary[k as keyof typeof summary],
                  previous: 0,
                  absolute: summary[k as keyof typeof summary],
                  percent: null,
                },
              ]),
            ),
          }
        : null,
  };
}
