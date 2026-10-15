import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Real PostgreSQL/real table; synthetic tenant and index rolled back together.
export async function benchmarkAnalyticsIndex(pool) {
  if (!process.env.PERF_DB_OUTPUT) return;
  if (pool.options.host !== '127.0.0.1') throw new Error('Local PostgreSQL only');
  const root = resolve(import.meta.dirname, '../..');
  const output = resolve(root, process.env.PERF_DB_OUTPUT);
  if (!output.startsWith(resolve(root, '.tools') + sep)) throw new Error('Invalid benchmark output');
  const client = await pool.connect(), user = randomUUID(), business = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query("INSERT INTO auth.users(id,email) VALUES($1,'index-benchmark@local.test')", [user]);
    await client.query("INSERT INTO profiles(id,full_name) VALUES($1,'Benchmark')", [user]);
    await client.query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'Benchmark','index-benchmark','ACTIVE')", [business, user]);
    await client.query(`INSERT INTO analytics_dimensions_daily(business_id,day,event_name,dimension,dimension_key,source,qr_key,event_count)
      SELECT $1,current_date-d,'PRODUCT_VIEW','product',md5(n::text)::uuid,'direct','00000000-0000-0000-0000-000000000000',1
      FROM generate_series(0,729)d CROSS JOIN generate_series(1,150)n`, [business]);
    await client.query('ANALYZE analytics_dimensions_daily');
    const sql = `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT greatest(date_trunc('week',day)::date,current_date-729) bucket,sum(event_count)
      FROM analytics_dimensions_daily WHERE business_id=$1 AND dimension='product' AND dimension_key=md5('1')::uuid
      AND event_name='PRODUCT_VIEW' AND day BETWEEN current_date-729 AND current_date GROUP BY 1`;
    const measure = async () => {
      const samples = []; let plan;
      for (let i = 0; i < 12; i++) {
        const result = (await client.query(sql, [business])).rows[0]['QUERY PLAN'][0];
        if (i >= 2) samples.push(result['Execution Time']); // two warmups
        plan = result.Plan;
      }
      samples.sort((a,b) => a-b);
      const nodes = (p) => [p['Node Type'] + (p['Index Name'] ? `:${p['Index Name']}` : ''), ...(p.Plans || []).flatMap(nodes)];
      return { samples: 10, p50_ms: samples[4], p95_ms: samples[9], p99_ms: samples[9], shared_hit_blocks: plan['Shared Hit Blocks'], shared_read_blocks: plan['Shared Read Blocks'], nodes: nodes(plan) };
    };
    const before = await measure();
    await client.query("CREATE INDEX analytics_product_trend_idx ON analytics_dimensions_daily(business_id,dimension_key,day) WHERE dimension='product' AND event_name='PRODUCT_VIEW'");
    const after = await measure();
    await writeFile(output, JSON.stringify({ scenario: 'PostgreSQL 16 local, 109500 synthetic product/day aggregates, 730 days/150 products, warm buffers; not production', before, after }, null, 2));
    console.log('OK PostgreSQL EXPLAIN/BUFFERS benchmark', JSON.stringify({ before, after }));
  } finally { await client.query('ROLLBACK'); client.release(); }
}
