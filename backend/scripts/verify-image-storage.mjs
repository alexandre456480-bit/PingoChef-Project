import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyImageStorage(pool) {
  const user=randomUUID(),other=randomUUID(),business=randomUUID(),foreign=randomUUID();
  await pool.query("INSERT INTO auth.users(id,email) VALUES($1,'storage-a@local.test'),($2,'storage-b@local.test')",[user,other]);
  await pool.query("INSERT INTO profiles(id,full_name) VALUES($1,'A'),($2,'B')",[user,other]);
  await pool.query("INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'A','storage-a','ACTIVE'),($3,$4,'B','storage-b','ACTIVE')",[business,user,foreign,other]);
  const digest='a'.repeat(64),path=`businesses/${business}/images/${digest}.png`;
  await pool.query("INSERT INTO image_assets(business_id,sha256,object_path,size_bytes,width,height) VALUES($1,$2,$3,100,32,32)",[business,digest,path]);
  const asRole=async(role,id,sql,args=[])=>{
    const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL ROLE ${role}`);
      await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,iat:Math.floor(Date.now()/1000)})]);
      const result=await c.query(sql,args);await c.query('COMMIT');return result;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  };
  assert.equal((await asRole('authenticated',user,'SELECT * FROM image_assets')).rows.length,1);
  assert.equal((await asRole('authenticated',other,'SELECT * FROM image_assets')).rows.length,0);
  for(const role of ['anon','authenticated']) {
    await assert.rejects(asRole(role,user,'UPDATE image_assets SET verified_at=now()'),/permission denied/);
    await assert.rejects(asRole(role,user,"INSERT INTO image_assets(business_id,sha256,object_path,size_bytes,width,height) VALUES($1,$2,$3,100,32,32)",[foreign,digest,path]),/permission denied/);
  }
  await assert.rejects(pool.query("INSERT INTO image_assets(business_id,sha256,object_path,size_bytes,width,height) VALUES($1,$2,$3,100,32,32)",[foreign,digest,path]),/check constraint/);
  const rls=(await pool.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='image_assets'::regclass")).rows[0];
  assert.ok(rls.relrowsecurity&&rls.relforcerowsecurity);
  // Even an accidentally broad browser policy cannot open this private bucket.
  await pool.query('CREATE POLICY test_permissive_storage ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)');
  try {
    await pool.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pingo-images-private',$1)",[path]);
    for(const role of ['anon','authenticated']) {
      assert.equal((await asRole(role,other,'SELECT * FROM storage.objects')).rows.length,0);
      await assert.rejects(asRole(role,other,"INSERT INTO storage.objects(bucket_id,name) VALUES('pingo-images-private','../../foreign.png')"),/row-level security/);
      assert.equal((await asRole(role,other,"UPDATE storage.objects SET name='overwrite.png' RETURNING *")).rows.length,0);
      assert.equal((await asRole(role,other,'DELETE FROM storage.objects RETURNING *')).rows.length,0);
    }
  } finally {await pool.query('DROP POLICY test_permissive_storage ON storage.objects');}
  await pool.query("UPDATE business_account_state SET lifecycle_status='SUSPENDED' WHERE business_id=$1",[business]);
  assert.equal((await asRole('authenticated',user,'SELECT * FROM image_assets')).rows.length,0);
  console.log('OK Storage catalog: FORCE RLS, tenant reads, forged paths, direct writes, cross-tenant overwrite/delete and permissive-policy bypass denied; suspended owner denied');
}
