// Summarize the controlled lab without reporting fixture data as production RUM.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve('../.tools/public-menu-performance');
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const before = await read(join(root, 'before.json'));
const after = await read(join(root, 'after.json'));
if (
  before.results.length !== 26 ||
  after.results.length !== 26 ||
  [...before.results, ...after.results].some((row) => row.failures.length)
)
  throw new Error('Complete, error-free 26-case lab reports are required.');
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return (
    Math.round((sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) * 1000) /
    1000
  );
};
const summaries = (data) =>
  ['modern', 'minimal'].flatMap((template) =>
    ['wifi', 'fast4g', 'slow4g'].map((network) => {
      const rows = data.results.filter(
        (row) => row.template === template && row.network === network && row.width === 390,
      );
      return {
        template,
        network,
        runs: rows.length,
        vitals: Object.fromEntries(
          ['TTFB', 'FCP', 'LCP', 'CLS', 'INP'].map((name) => [
            name,
            median(rows.map((row) => row.vitals[name])),
          ]),
        ),
        stages: Object.fromEntries(
          ['structure', 'shell', 'hero', 'category', 'product'].map((name) => [
            name,
            median(rows.map((row) => row.stages[name])),
          ]),
        ),
        menuEntryMs: median(rows.map((row) => row.menuEntryMs)),
        detailMs: median(rows.map((row) => row.detailMs)),
        initialResponseCohortCount: median(rows.map((row) => row.initialRequests)),
        initialResponseCohortBytes: median(rows.map((row) => row.initialTransferBytes)),
        menuFixturePayloadBytes: median(rows.map((row) => row.menuPayloadBytes)),
      };
    }),
  );
const builds = {};
for (const [phase, data, dir] of [
  ['before', before, '../.tools/public-menu-baseline/site'],
  ['after', after, 'dist/frontend/browser'],
]) {
  const paths = [
    ...new Set(
      data.results[0].requests
        .filter((row) => row.type === 'Script' || row.type === 'Stylesheet')
        .map((row) => row.path),
    ),
  ];
  const files = await Promise.all(
    paths.map(async (path) => {
      const bytes = await readFile(resolve(dir, '.' + path));
      return {
        file: basename(path),
        kind: path.endsWith('.css') ? 'css' : 'js',
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
      };
    }),
  );
  builds[phase] = {
    files,
    bootstrapJsRawBytes: files
      .filter(
        (f) => f.kind === 'js' && (f.file.startsWith('main-') || f.file === 'chunk-Da4-SChG.js'),
      )
      .reduce((s, f) => s + f.rawBytes, 0),
    publicJourneyJsRawBytes: files
      .filter((f) => f.kind === 'js')
      .reduce((s, f) => s + f.rawBytes, 0),
    publicJourneyJsGzipBytes: files
      .filter((f) => f.kind === 'js')
      .reduce((s, f) => s + f.gzipBytes, 0),
    globalCssRawBytes: files.filter((f) => f.kind === 'css').reduce((s, f) => s + f.rawBytes, 0),
  };
}
const lighthouse = [];
for (const phase of ['before', 'after'])
  for (const template of ['modern', 'minimal']) {
    const result = await read(join(root, `${phase}-lighthouse-${template}.json`));
    lighthouse.push({
      phase,
      template,
      version: result.lighthouseVersion,
      scores: Object.fromEntries(
        Object.entries(result.categories).map(([key, value]) => [
          key,
          Math.round(value.score * 100),
        ]),
      ),
      metrics: Object.fromEntries(
        [
          'first-contentful-paint',
          'largest-contentful-paint',
          'cumulative-layout-shift',
          'total-blocking-time',
          'speed-index',
        ].map((key) => [key, result.audits[key].numericValue]),
      ),
      runtimeError: result.runtimeError ?? null,
    });
  }
const cases = (data) =>
  data.results.map(
    ({ requests, failures, initialRequests, initialTransferBytes, initialImageBytes, ...row }) => ({
      ...row,
      initialResponseCohortCount: initialRequests,
      initialResponseCohortBytes: initialTransferBytes,
      initialImageBytes,
      contentGets: requests.filter(
        (req) => req.type === 'Fetch' && /^\/api\/v1\/public\/menu\/[^/]+$/.test(req.path),
      ).length,
      mascotFrameResponses: requests.filter((req) => req.path.includes('/mascots/loading/')).length,
      failures,
    }),
  );
const evidence = {
  createdAt: new Date().toISOString(),
  environment: after.environment,
  methodology: {
    mobileRepeats: 3,
    otherViewportRepeats: 1,
    cpuSlowdown: { wifi: 1, fast4g: 4, slow4g: 4 },
    fixture: { items: 60, categories: 6, apiDelayMs: 200, imageFileBytes: 100770 },
    caveats: [
      'Local production builds and fixtures; not production, CrUX or a physical mobile device.',
      'External fonts isolated in both phases; family selection validated separately, font-transfer savings not measured.',
      'LCP measures the Welcome before the first interaction; category/product stages include the controlled Enter click.',
      'detailMs/menuEntryMs include Playwright actionability and animation waits, not just event processing.',
      'TTFB refers to the local HTML document, not the BFF/Supabase latency.',
      'Initial response cohort selects responses seen by Welcome+300ms, then counts completed bytes at departure. Pending transfers may be absent; compare Wi-Fi cohort only, not full-load totals.',
      'Lighthouse audits initial Welcome; it does not measure INP or certify the whole catalog.',
    ],
  },
  profiles: after.profiles,
  before: summaries(before),
  after: summaries(after),
  builds,
  lighthouse,
  cases: { before: cases(before), after: cases(after) },
};
evidence.budgets = {
  bootstrapJsAtMostBaseline: {
    limitBytes: builds.before.bootstrapJsRawBytes,
    actualBytes: builds.after.bootstrapJsRawBytes,
    passed: builds.after.bootstrapJsRawBytes <= builds.before.bootstrapJsRawBytes,
  },
  publicJourneyGzipAtMostBaseline: {
    limitBytes: builds.before.publicJourneyJsGzipBytes,
    actualBytes: builds.after.publicJourneyJsGzipBytes,
    passed: builds.after.publicJourneyJsGzipBytes <= builds.before.publicJourneyJsGzipBytes,
  },
  oneContentGet: { passed: evidence.cases.after.every((row) => row.contentGets === 1) },
  noMascotFrameDownload: {
    passed: evidence.cases.after.every((row) => row.mascotFrameResponses === 0),
  },
};
await mkdir(resolve('../docs'), { recursive: true });
await writeFile(
  resolve('../docs/public-menu-performance-evidence.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
const number = (value) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
const pair = (a, b) => `${number(a)} → ${number(b)}`;
const table = (headers, rows) =>
  `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n` +
  rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
const rows = evidence.after.map((row, i) => {
  const previous = evidence.before[i];
  return [
    row.template,
    row.network,
    ...['TTFB', 'FCP', 'LCP', 'CLS', 'INP'].map((name) =>
      pair(previous.vitals[name], row.vitals[name]),
    ),
  ];
});
const stages = evidence.after.map((row, i) => {
  const previous = evidence.before[i];
  return [
    row.template,
    row.network,
    ...['shell', 'hero', 'category', 'product'].map((name) =>
      pair(Math.round(previous.stages[name]), Math.round(row.stages[name])),
    ),
    pair(previous.menuEntryMs, row.menuEntryMs),
    pair(previous.detailMs, row.detailMs),
  ];
});
const bundle = [
  ['JS de bootstrap bruto', 'bootstrapJsRawBytes'],
  ['JS de toda a jornada pública bruto', 'publicJourneyJsRawBytes'],
  ['JS de toda a jornada pública gzip', 'publicJourneyJsGzipBytes'],
  ['CSS global bruto', 'globalCssRawBytes'],
].map(([label, key]) => [label, number(builds.before[key]), number(builds.after[key])]);
const lh = ['modern', 'minimal'].map((template) => {
  const a = lighthouse.find((row) => row.phase === 'before' && row.template === template),
    b = lighthouse.find((row) => row.phase === 'after' && row.template === template);
  return [
    template,
    ...['performance', 'accessibility', 'best-practices'].map((name) =>
      pair(a.scores[name], b.scores[name]),
    ),
    pair(
      Math.round(a.metrics['largest-contentful-paint']),
      Math.round(b.metrics['largest-contentful-paint']),
    ),
    pair(a.metrics['cumulative-layout-shift'], b.metrics['cumulative-layout-shift']),
  ];
});
const cohort = evidence.after
  .filter((row) => row.network === 'wifi')
  .map((row) => {
    const a = evidence.before.find(
      (previous) => previous.template === row.template && previous.network === 'wifi',
    );
    return [
      row.template,
      pair(a.initialResponseCohortCount, row.initialResponseCohortCount),
      pair(a.initialResponseCohortBytes, row.initialResponseCohortBytes),
      pair(a.menuFixturePayloadBytes, row.menuFixturePayloadBytes),
    ];
  });
const reportText = [
  '**MEDIDO — medianas antes → depois em 390×844 (três execuções por rede/template).** Tempos em ms; CLS sem unidade.',
  table(['Template', 'Rede', 'TTFB', 'FCP', 'LCP', 'CLS', 'INP'], rows),
  '**MEDIDO — etapas em ms.** Shell/Welcome/categoria/produto são marcos de visibilidade do DOM desde a navegação; entrada e detalhe incluem a ação automatizada.',
  table(
    [
      'Template',
      'Rede',
      'Shell',
      'Welcome/hero',
      '1ª categoria',
      '1º produto',
      'Entrada após clique',
      'Abrir detalhe',
    ],
    stages,
  ),
  '**MEDIDO — arquivos e transferência.** Bootstrap é main + chunk inicial; jornada inclui todos os scripts observados até o detalhe, inclusive telemetria. Gzip calculado igualmente nos arquivos das duas fases, sem cabeçalhos HTTP.',
  table(['Recurso (bytes)', 'Antes', 'Depois'], bundle),
  'O total da jornada inclui os novos skeletons, defer e observabilidade. A economia de carregamento também vem da remoção dos seis frames e dos assets antecipados; o runtime de formulários deixou a rota pública após simplificar o único input de busca.',
  '**MEDIDO — coorte inicial Wi-Fi, com a limitação descrita na metodologia.** Não representa o total de toda a página nem uma comparação de transferências pendentes em 4G. O payload do fixture é intencionalmente igual.',
  table(
    ['Template', 'Respostas na coorte', 'Bytes concluídos da coorte', 'JSON do fixture (bytes)'],
    cohort,
  ),
  '**MEDIDO — Lighthouse 13.5.0, uma execução por template/fase, Welcome em 390×844, 200 ms / 1,6 Mbps / CPU 4×.**',
  table(['Template', 'Performance', 'Accessibility', 'Best Practices', 'LCP (ms)', 'CLS'], lh),
  'Os resultados são mistos. FCP anterior podia corresponder ao texto do loader; o skeleton atual é geométrico e o conteúdo textual vem no Welcome. O DOM do shell não é uma medição de pixels nem de interatividade. Consultar todas as linhas antes de declarar melhora de LCP ou INP. LCP em Slow 4G e INP com CPU reduzida ainda podem ultrapassar as metas; três amostras locais não formam um p75 de campo.',
  '**MEDIDO — variação do INP após a mudança, mínimo–máximo das três amostras em 390 px:** ' +
    evidence.after
      .map((row) => {
        const values = evidence.cases.after
          .filter(
            (c) => c.width === 390 && c.template === row.template && c.network === row.network,
          )
          .map((c) => c.vitals.INP);
        return `${row.template}/${row.network}: ${number(Math.min(...values))}–${number(Math.max(...values))} ms`;
      })
      .join('; ') +
    '.',
].join('\n\n');
const reportPath = resolve('../docs/public-menu-performance.md');
const report = await readFile(reportPath, 'utf8');
await writeFile(
  reportPath,
  report.replace(
    /<!-- measured-results:start -->[\s\S]*?<!-- measured-results:end -->/,
    `<!-- measured-results:start -->\n${reportText}\n<!-- measured-results:end -->`,
  ),
);
console.log(
  JSON.stringify({ before: evidence.before, after: evidence.after, builds, lighthouse }, null, 2),
);
if (Object.values(evidence.budgets).some((budget) => !budget.passed)) process.exitCode = 1;
