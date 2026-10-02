import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
export async function verifyQrSecurity(pool) {
  const query = (sql, values) => pool.query(sql, values);
  const value = async (sql, values) =>
    (await query(sql, values)).rows[0]?.value;
  let checks = 0;
  async function check(name, action) {
    await action();
    checks++;
    console.log(`OK phase4: ${name}`);
  }
  const a = randomUUID(),
    b = randomUUID(),
    ua = randomUUID(),
    ub = randomUUID(),
    admin = randomUUID();
  await query(
    "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now()),($3,$4,now()),($5,$6,now())",
    [
      ua,
      "qr-a@local.test",
      ub,
      "qr-b@local.test",
      admin,
      "qr-admin@local.test",
    ],
  );
  await query(
    "INSERT INTO profiles(id,full_name) VALUES($1,'QR A'),($2,'QR B')",
    [ua, ub],
  );
  await query("INSERT INTO admin_identities(user_id) VALUES($1)", [admin]);
  await query(
    "INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'QR A','qr-a','ACTIVE'),($3,$4,'QR B','qr-b','ACTIVE')",
    [a, ua, b, ub],
  );
  await query(
    "UPDATE business_account_state SET is_published=true WHERE business_id IN ($1,$2)",
    [a, b],
  );
  const configuration = {
    color: "#2C1024",
    frame: "card",
    caption: "Acesse nosso cardápio",
    logoPng: null,
  };
  const assign = (biz, tier) =>
    value(
      "SELECT admin_assign_business_plan($1,$2,$3,'Phase4 local test') value",
      [admin, biz, tier],
    );
  const save = (biz, id = null, revision = null, active = true) =>
    value("SELECT manage_business_qr($1,$2,$3,$4,$5,$6) value", [
      biz,
      id,
      "QR Mesa",
      configuration,
      active,
      revision,
    ]);
  let qa, qb;
  await check(
    "Free/Basic RPC denies; paid plans create unpredictable tenant-bound identities",
    async () => {
      await assert.rejects(save(a), /QR_NOT_ENTITLED/);
      await assign(a, "BASIC");
      await assert.rejects(save(a), /QR_NOT_ENTITLED/);
      await assign(a, "MEDIUM");
      await assign(b, "PRO");
      qa = await save(a);
      qb = await save(b);
      assert.equal(qa.business_id, a);
      assert.match(qa.public_identifier, /^[0-9a-f-]{36}$/);
      assert.notEqual(qa.public_identifier, qb.public_identifier);
    },
  );
  await check(
    "cross-tenant update denied; revision conflict cannot overwrite; pause preserves stable URL",
    async () => {
      await assert.rejects(save(a, qb.id, 1), /QR_NOT_FOUND/);
      const updated = await save(a, qa.id, 1, false);
      assert.equal(updated.public_identifier, qa.public_identifier);
      assert.equal(updated.revision, 2);
      assert.equal(updated.status, "PAUSED");
      await assert.rejects(save(a, qa.id, 1), /QR_VERSION_CONFLICT/);
      qa = await save(a, qa.id, 2, true);
    },
  );
  await check(
    "concurrent QR creates respect total capacity including paused codes",
    async () => {
      await query("UPDATE qr_settings SET max_codes_per_business=3");
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => save(a)),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
      assert.equal(
        await value(
          "SELECT count(*)::integer value FROM analytics_qr_refs WHERE business_id=$1",
          [a],
        ),
        3,
      );
      await query("UPDATE qr_settings SET max_codes_per_business=20");
    },
  );
  await check(
    "downgrade blocks generation/update while retaining identities and historical attribution",
    async () => {
      await assign(a, "FREE");
      await assert.rejects(save(a, qa.id, qa.revision), /QR_NOT_ENTITLED/);
      await assert.rejects(save(a), /QR_NOT_ENTITLED/);
      assert.equal(
        await value(
          "SELECT public_identifier::text value FROM analytics_qr_refs WHERE id=$1",
          [qa.id],
        ),
        qa.public_identifier,
      );
      await assign(a, "MEDIUM");
    },
  );
  await check(
    "a QR create queued behind a concurrent downgrade rechecks rights after the lock",
    async () => {
      const client = await pool.connect();
      let creation;
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT admin_assign_business_plan($1,$2,'FREE','Concurrent downgrade test')",
          [admin, a],
        );
        creation = save(a).then(
          () => ({ allowed: true }),
          (error) => ({ allowed: false, message: error.message }),
        );
        let waiting = false;
        for (let attempt = 0; attempt < 30; attempt++) {
          waiting = await value(
            "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) value",
          );
          if (waiting) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.equal(
          waiting,
          true,
          "create must wait for the subscription capacity lock",
        );
        await client.query("COMMIT");
        const result = await creation;
        assert.equal(result.allowed, false);
        assert.match(result.message, /QR_NOT_ENTITLED/);
      } finally {
        await client.query("ROLLBACK");
        client.release();
        if (creation) await creation;
        await assign(a, "MEDIUM");
      }
    },
  );
  await check(
    "shared rate RPC remains exact under 12 independent concurrent transactions",
    async () => {
      const hash = randomBytes(32).toString("hex");
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          value("SELECT reserve_shared_request('qr-render',$1,5,3600) value", [
            hash,
          ]),
        ),
      );
      assert.equal(results.filter(Boolean).length, 5);
      assert.equal(
        await value(
          "SELECT max(count) value FROM shared_request_quotas WHERE subject_hash=$1",
          [hash],
        ),
        6,
      );
      const otherHash = randomBytes(32).toString("hex");
      assert.equal(
        await value(
          "SELECT reserve_shared_request('qr-render',$1,5,3600) value",
          [otherHash],
        ),
        true,
      );
    },
  );
  const visitor = randomBytes(32).toString("hex"),
    ip = randomBytes(32).toString("hex");
  const ingest = (qrId, biz = a) =>
    value("SELECT analytics_ingest($1,$2,$3,$4,$5,$6,$7,1500,180) value", [
      biz,
      visitor,
      randomUUID(),
      ip,
      JSON.stringify([
        { id: randomUUID(), eventName: "MENU_VIEW" },
        { id: randomUUID(), eventName: "QR_ENTRY" },
      ]),
      "qr",
      qrId,
    ]);
  await check(
    "QR reload/redirect/concurrent new page IDs aggregate one entry, but keep distinct menu views",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => ingest(qa.id)),
      );
      assert.equal(
        results.reduce((x, y) => x + y, 0),
        7,
      );
      assert.equal(
        await value(
          "SELECT count(*)::integer value FROM analytics_events WHERE business_id=$1 AND event_name='QR_ENTRY'",
          [a],
        ),
        1,
      );
      assert.equal(
        await value(
          "SELECT sum(event_count)::integer value FROM analytics_daily WHERE business_id=$1 AND event_name='QR_ENTRY'",
          [a],
        ),
        1,
      );
      assert.equal(
        await value(
          "SELECT count(*)::integer value FROM analytics_events WHERE business_id=$1 AND event_name='MENU_VIEW'",
          [a],
        ),
        6,
      );
    },
  );
  await check(
    "another QR is independent; entry opens again after 30 minutes; other-tenant and paused QR refused",
    async () => {
      const q2 = await save(a);
      assert.equal(await ingest(q2.id), 2);
      await query(
        "UPDATE analytics_qr_entry_windows SET last_entry_at=now()-interval '31 minutes' WHERE business_id=$1 AND qr_key=$2",
        [a, qa.id],
      );
      assert.equal(await ingest(qa.id), 2);
      await assert.rejects(ingest(qb.id), /INVALID_ANALYTICS_RESOURCE/);
      await save(a, qa.id, qa.revision, false);
      await assert.rejects(ingest(qa.id), /INVALID_ANALYTICS_RESOURCE/);
    },
  );
  await check(
    "browser roles cannot access QR settings, budgets, ledger or invoke private management RPC",
    async () => {
      const client = await pool.connect();
      try {
        for (const role of ["anon", "authenticated"]) {
          await client.query(`SET ROLE ${role}`);
          for (const table of [
            "analytics_qr_refs",
            "qr_settings",
            "shared_request_quotas",
            "analytics_qr_entry_windows",
          ])
            await assert.rejects(
              client.query(`SELECT * FROM ${table}`),
              /permission denied/,
            );
          await assert.rejects(
            client.query("SELECT manage_business_qr($1,NULL,$2,$3,true,NULL)", [
              a,
              "Hacked",
              configuration,
            ]),
            /permission denied/,
          );
          await assert.rejects(
            client.query(
              "SELECT reserve_shared_request('qr-render',$1,100,60)",
              [visitor],
            ),
            /permission denied/,
          );
          await client.query("RESET ROLE");
        }
      } finally {
        await client.query("RESET ROLE");
        client.release();
      }
    },
  );
  await check(
    "maintenance clears expired shared counters and dedupe windows",
    async () => {
      await query(
        "UPDATE shared_request_quotas SET window_start=now()-interval '3 days'",
      );
      await query(
        "UPDATE analytics_qr_entry_windows SET last_entry_at=now()-interval '3 days'",
      );
      assert.ok(
        (await value("SELECT maintain_shared_security_state() value")) > 0,
      );
      assert.equal(
        await value(
          "SELECT count(*)::integer value FROM shared_request_quotas",
        ),
        0,
      );
    },
  );
  console.log(`QR/security database checks passed: ${checks}.`);
}
