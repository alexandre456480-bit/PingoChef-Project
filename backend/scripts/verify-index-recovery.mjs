import assert from 'node:assert/strict';
import { verifyPerformanceIndex } from './recover-performance-index.mjs';

export async function verifyIndexRecovery(pool) {
  const c=await pool.connect(),blocker=await pool.connect(),builder=await pool.connect();
  try {
    assert.deepEqual(await verifyPerformanceIndex(c),{valid:true,ready:true});
    await c.query('DROP INDEX CONCURRENTLY public.analytics_product_trend_idx');
    await blocker.query('BEGIN');
    // Writer transaction blocks phase 2 after the concurrent index catalog entry exists.
    await blocker.query('LOCK TABLE public.analytics_dimensions_daily IN ROW EXCLUSIVE MODE');
    const pid=(await builder.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const building=builder.query(`CREATE INDEX CONCURRENTLY analytics_product_trend_idx
      ON public.analytics_dimensions_daily(business_id,dimension_key,day)
      WHERE dimension='product' AND event_name='PRODUCT_VIEW'`).then(()=>null,e=>e);
    const deadline=Date.now()+10000;let found=false;
    while(Date.now()<deadline) {
      found=(await c.query("SELECT to_regclass('public.analytics_product_trend_idx') IS NOT NULL present")).rows[0].present;
      if(found)break;
      await new Promise(r=>setTimeout(r,25));
    }
    await c.query('SELECT pg_cancel_backend($1)',[pid]);
    const error=await building;
    await blocker.query('ROLLBACK');
    assert.ok(found&&error,'Expected interrupted concurrent build');
    assert.equal((await c.query("SELECT indisvalid FROM pg_index WHERE indexrelid='public.analytics_product_trend_idx'::regclass")).rows[0].indisvalid,false);
    await assert.rejects(verifyPerformanceIndex(c),/Invalid index/);
    assert.deepEqual(await verifyPerformanceIndex(c,{repair:true}),{valid:true,ready:true});
    console.log('OK real interrupted concurrent index build detected and recovered outside transaction; indisvalid/indisready verified');
  } finally {await blocker.query('ROLLBACK');c.release();blocker.release();builder.release();}
}
