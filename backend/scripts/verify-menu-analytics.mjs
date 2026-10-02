import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";

export async function verifyMenuAnalytics(pool) {
  const query = (sql, values) => pool.query(sql, values);
  const value = async (sql, values) =>
    (await query(sql, values)).rows[0]?.value;
  let checks = 0;
  async function check(name, action) {
    await action();
    checks++;
    console.log(`OK analytics: ${name}`);
  }
  const user = randomUUID(),
    otherUser = randomUUID(),
    admin = randomUUID(),
    business = randomUUID(),
    other = randomUUID();
  const category = randomUUID(),
    otherCategory = randomUUID(),
    item = randomUUID(),
    otherItem = randomUUID(),
    qr = randomUUID(),
    otherQr = randomUUID();
  const visitor = randomBytes(32).toString("hex"),
    ip = randomBytes(32).toString("hex"),
    page = randomUUID();
  await query(
    "INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now()),($3,$4,now()),($5,$6,now())",
    [
      user,
      "analytics-a@local.test",
      otherUser,
      "analytics-b@local.test",
      admin,
      "analytics-admin@local.test",
    ],
  );
  await query("INSERT INTO profiles(id,full_name) VALUES($1,'A'),($2,'B')", [
    user,
    otherUser,
  ]);
  await query("INSERT INTO admin_identities(user_id) VALUES($1)", [admin]);
  await query(
    "INSERT INTO businesses(id,owner_user_id,name,slug,status) VALUES($1,$2,'A','analytics-a','ACTIVE'),($3,$4,'B','analytics-b','ACTIVE')",
    [business, user, other, otherUser],
  );
  await query(
    "UPDATE business_account_state SET is_published=true WHERE business_id IN ($1,$2)",
    [business, other],
  );
  await query(
    "INSERT INTO categories(id,business_id,name) VALUES($1,$2,'Cat A'),($3,$4,'Cat B')",
    [category, business, otherCategory, other],
  );
  await query(
    "INSERT INTO menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,'Item A',12),($4,$5,$6,'Item B',15)",
    [item, business, category, otherItem, other, otherCategory],
  );
  await query(
    "INSERT INTO analytics_qr_refs(id,business_id,label) VALUES($1,$2,'Mesa A'),($3,$4,'Mesa B')",
    [qr, business, otherQr, other],
  );
  const today = await value(
    "SELECT (now() AT TIME ZONE timezone)::date::text value FROM analytics_settings",
  );
  const shift = (date, days) =>
    new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
      .toISOString()
      .slice(0, 10);
  const event = (name, fields = {}) => ({
    id: randomUUID(),
    eventName: name,
    ...fields,
  });
  const ingest = (events, opts = {}) =>
    value("SELECT analytics_ingest($1,$2,$3,$4,$5,$6,$7,$8,$9) value", [
      opts.business || business,
      opts.visitor || visitor,
      opts.page || page,
      opts.ip || ip,
      JSON.stringify(events),
      opts.source || "direct",
      opts.qr || null,
      opts.ipLimit || 1500,
      opts.visitorLimit || 180,
    ]);
  const report = (kind = "summary", opts = {}) =>
    value("SELECT analytics_query($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) value", [
      opts.business || business,
      opts.start || today,
      opts.end || today,
      kind,
      opts.metric || "product_views",
      opts.bucket || "day",
      opts.source || null,
      opts.qr || null,
      opts.item || null,
      opts.offset || 0,
      opts.limit || 10,
    ]);
  const assign = (code) =>
    query("SELECT admin_assign_business_plan($1,$2,$3,$4)", [
      admin,
      business,
      code,
      "local Analytics entitlement validation",
    ]);
  await check("Free collects; Free cannot read any report", async () => {
    assert.equal(await ingest([event("MENU_VIEW")]), 1);
    await assert.rejects(report(), /ANALYTICS_FORBIDDEN/);
    await assert.rejects(report("series"), /ANALYTICS_FORBIDDEN/);
  });
  await check(
    "concurrent duplicate IDs and semantic duplicates commit exactly once",
    async () => {
      const e = event("PRODUCT_VIEW", { itemId: item });
      const results = await Promise.all([
        ingest([e]),
        ingest([e]),
        ingest([event("PRODUCT_VIEW", { itemId: item })]),
      ]);
      assert.equal(
        results.reduce((a, b) => a + b, 0),
        1,
      );
      await assign("BASIC");
      const r = await report();
      assert.equal(r.menuViews, 1);
      assert.equal(r.productViews, 1);
      assert.equal(r.visitors, 1);
    },
  );
  await check(
    "Basic essential only; expanded history and advanced/Pro queries denied",
    async () => {
      assert.deepEqual(Object.keys(await report()).sort(), [
        "likes",
        "menuViews",
        "productViews",
        "videoPlays",
        "visitors",
      ]);
      assert.equal((await report("ranking")).rows[0].name, "Item A");
      for (const [kind, opts] of [
        ["sources", {}],
        ["hours", {}],
        ["product-trend", { item }],
        ["qr", {}],
        ["summary", { source: "qr" }],
        ["ranking", { metric: "categories" }],
        ["summary", { qr }],
      ])
        await assert.rejects(report(kind, opts), /ANALYTICS_FORBIDDEN/);
      await assert.rejects(
        report("summary", { start: shift(today, -31) }),
        /INVALID_ANALYTICS_RANGE/,
      );
    },
  );
  await check(
    "tenant-bound items/categories/QR, private resources and forged LIKE rejected atomically",
    async () => {
      for (const e of [
        event("PRODUCT_VIEW", { itemId: otherItem }),
        event("CATEGORY_VIEW", { categoryId: otherCategory }),
        event("LIKE", { itemId: item }),
      ])
        await assert.rejects(ingest([e]), /INVALID_ANALYTICS_(RESOURCE|EVENT)/);
      await assert.rejects(
        ingest([event("MENU_VIEW")], { source: "qr", qr: otherQr }),
        /INVALID_ANALYTICS_RESOURCE/,
      );
      await query("UPDATE menu_items SET is_available=false WHERE id=$1", [
        item,
      ]);
      await assert.rejects(
        ingest([event("PRODUCT_VIEW", { itemId: item })], {
          page: randomUUID(),
        }),
        /INVALID_ANALYTICS_RESOURCE/,
      );
      await query("UPDATE menu_items SET is_available=true WHERE id=$1", [
        item,
      ]);
      await query(
        "UPDATE business_account_state SET is_published=false WHERE business_id=$1",
        [other],
      );
      await assert.rejects(
        ingest([event("MENU_VIEW")], { business: other }),
        /ANALYTICS_MENU_UNAVAILABLE/,
      );
      await query(
        "UPDATE business_account_state SET is_published=true WHERE business_id=$1",
        [other],
      );
    },
  );
  await check(
    "UTC midnight maps to configured calendar day; distinct presence spans days and hours",
    async () => {
      const insert = (at) =>
        query(
          "INSERT INTO analytics_events(business_id,id,visitor_id,page_id,event_name,source,occurred_at,dedupe_key) VALUES($1,$2,$3,$4,'MENU_VIEW','direct',$5,$6)",
          [business, randomUUID(), visitor, randomUUID(), at, randomUUID()],
        );
      await insert(today + "T02:30:00Z");
      await insert(today + "T05:00:00Z");
      const r = await report("summary", { start: shift(today, -1) });
      assert.equal(r.menuViews, 3);
      assert.equal(r.visitors, 1);
      const hours = await report("series", { bucket: "hour" });
      assert.equal(hours.length, 24);
      assert.equal(hours[2].visitors, 1);
      const yesterday = await report("summary", {
        start: shift(today, -1),
        end: shift(today, -1),
      });
      assert.equal(yesterday.menuViews, 1);
      const month = await report("series", {
        start: shift(today, -1),
        bucket: "month",
      });
      assert.equal(
        month.reduce((n, p) => n + p.menuViews, 0),
        3,
      );
    },
  );
  await check(
    "Medium comparisons inputs, sources, category ranking and zero-filled trends; no per-QR detail",
    async () => {
      await assign("MEDIUM");
      await ingest([event("CATEGORY_VIEW", { categoryId: category })]);
      await ingest([event("MENU_VIEW"), event("QR_ENTRY")], {
        source: "qr",
        qr,
        page: randomUUID(),
      });
      assert.equal((await report()).qrEntries, 1);
      assert.equal(
        (await report("ranking", { metric: "categories" })).rows[0].value,
        1,
      );
      assert.ok((await report("sources")).some((s) => s.name === "qr"));
      assert.equal((await report("hours")).length, 24);
      const trend = await report("product-trend", {
        item,
        start: shift(today, -6),
      });
      assert.equal(trend.length, 7);
      assert.equal(trend[6].value, 1);
      await assert.rejects(report("qr"), /ANALYTICS_FORBIDDEN/);
      await assert.rejects(
        report("product-trend", { item: otherItem }),
        /INVALID_ANALYTICS_RESOURCE/,
      );
    },
  );
  await check(
    "published Mux media validates; each play/milestone deduplicates",
    async () => {
      const media = randomUUID(),
        playId = randomUUID();
      await query(
        "INSERT INTO product_media(id,business_id,menu_item_id,media_type,source,status,mux_upload_id,mux_asset_id,mux_playback_id,is_published,aspect_ratio,duration_seconds) VALUES($1,$2,$3,'video','mux','ready','analytics-upload','analytics-asset','analytics-playback',true,'16:9',12)",
        [media, business, item],
      );
      const batch = ["VIDEO_PLAY", "VIDEO_25", "VIDEO_50", "VIDEO_100"].map(
        (name) => event(name, { itemId: item, mediaId: media, playId }),
      );
      assert.equal(await ingest(batch), 4);
      assert.equal(await ingest(batch), 0);
      const r = await report();
      assert.equal(r.videoPlays, 1);
      assert.equal(r.video100, 1);
      await query("UPDATE product_media SET is_published=false WHERE id=$1", [
        media,
      ]);
      await assert.rejects(
        ingest([
          event("VIDEO_PLAY", {
            itemId: item,
            mediaId: media,
            playId: randomUUID(),
          }),
        ]),
        /INVALID_ANALYTICS_RESOURCE/,
      );
    },
  );
  await check(
    "authoritative like analytics tracks only new confirmed likes, without attribution",
    async () => {
      const args = [
        item,
        business,
        randomBytes(32).toString("hex"),
        randomBytes(32).toString("hex"),
      ];
      const like = () =>
        query("SELECT * FROM register_anonymous_like($1,$2,$3,$4)", args);
      assert.equal((await like()).rows[0].created, true);
      assert.equal((await like()).rows[0].created, false);
      assert.equal((await report()).likes, 1);
      assert.equal((await report("summary", { source: "qr" })).likes, 0);
      const rank = await report("ranking", { metric: "likes" });
      assert.equal(rank.rows[0].value, 1);
    },
  );
  await check(
    "Pro per-QR filters, tenant isolation and extended history",
    async () => {
      await assign("PRO");
      const detail = await report("qr");
      assert.equal(detail[0].id, qr);
      assert.equal(detail[0].name, "Mesa A");
      assert.equal((await report("summary", { qr })).menuViews, 1);
      await assert.rejects(
        report("summary", { qr: otherQr }),
        /INVALID_ANALYTICS_RESOURCE/,
      );
      await query("SELECT admin_assign_business_plan($1,$2,$3,$4)", [
        admin,
        other,
        "PRO",
        "isolated test",
      ]);
      assert.equal((await report("summary", { business: other })).menuViews, 0);
      assert.equal(
        (await report("series", { start: shift(today, -365), bucket: "month" }))
          .length >= 12,
        true,
      );
    },
  );
  await check(
    "invalid/inverted/future/expired ranges and invalid bucket fail",
    async () => {
      for (const opts of [
        { start: today, end: shift(today, -1) },
        { end: shift(today, 1) },
        { start: shift(today, -3650) },
        { start: shift(today, -1), bucket: "hour" },
      ])
        await assert.rejects(
          report("series", opts),
          /INVALID_ANALYTICS_(RANGE|QUERY)/,
        );
    },
  );
  await check(
    "persistent per-session and global IP quotas hold with concurrent requests",
    async () => {
      const v = randomBytes(32).toString("hex"),
        i = randomBytes(32).toString("hex");
      const batches = await Promise.all(
        Array.from({ length: 3 }, () =>
          ingest(
            Array.from({ length: 10 }, () => event("MENU_VIEW")),
            { visitor: v, ip: i, page: randomUUID(), visitorLimit: 20 },
          ),
        ),
      );
      assert.equal(batches.filter((n) => n === -1).length, 1);
      assert.equal(
        batches.reduce((s, n) => s + Math.max(0, n), 0),
        2,
      );
      const shared = randomBytes(32).toString("hex");
      const outcomes = await Promise.all(
        Array.from({ length: 3 }, () =>
          ingest(
            Array.from({ length: 10 }, () => event("MENU_VIEW")),
            {
              visitor: randomBytes(32).toString("hex"),
              ip: shared,
              page: randomUUID(),
              ipLimit: 20,
            },
          ),
        ),
      );
      assert.equal(outcomes.filter((n) => n === -1).length, 1);
    },
  );
  await check(
    "server-side ranking pagination is stable and labels removed resources",
    async () => {
      for (let n = 0; n < 6; n++) {
        const id = randomUUID();
        await query(
          "INSERT INTO menu_items(id,business_id,category_id,name,price) VALUES($1,$2,$3,$4,10)",
          [id, business, category, `Rank ${n}`],
        );
        await ingest([event("PRODUCT_VIEW", { itemId: id })]);
      }
      const a = await report("ranking", { limit: 5 }),
        b = await report("ranking", { offset: 5, limit: 5 });
      assert.equal(a.total, 7);
      assert.equal(b.rows.length, 2);
      assert.equal(
        a.rows.some((x) => b.rows.some((y) => y.id === x.id)),
        false,
      );
      await query("DELETE FROM menu_items WHERE id=$1", [a.rows[0].id]);
      assert.equal(
        (await report("ranking", { limit: 10 })).rows.some(
          (row) => row.id === a.rows[0].id && row.removed,
        ),
        true,
      );
    },
  );
  await check(
    "RLS/grants deny browser table reads and direct RPCs for both roles",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        const client = await pool.connect();
        try {
          for (const sql of [
            "SELECT * FROM analytics_events",
            "SELECT * FROM analytics_daily",
            "SELECT * FROM analytics_visitors_daily",
            "SELECT analytics_query('" +
              business +
              "','" +
              today +
              "','" +
              today +
              "','summary')",
            "SELECT maintain_menu_analytics()",
          ]) {
            await client.query("BEGIN");
            await client.query(`SET LOCAL ROLE ${role}`);
            await assert.rejects(client.query(sql), /permission denied/);
            await client.query("ROLLBACK");
          }
        } finally {
          client.release();
        }
      }
    },
  );
  await check(
    "raw retention preserves aggregates; settings reject timezone reinterpretation",
    async () => {
      const old = shift(today, -100);
      await query(
        "INSERT INTO analytics_events(business_id,id,visitor_id,page_id,event_name,source,occurred_at,dedupe_key) VALUES($1,$2,$3,$4,'MENU_VIEW','direct',$5,$6)",
        [
          business,
          randomUUID(),
          visitor,
          randomUUID(),
          old + "T12:00:00Z",
          randomUUID(),
        ],
      );
      const summary = await report("summary", { start: old, end: old });
      assert.equal(summary.menuViews, 1);
      const maintenance = await value("SELECT maintain_menu_analytics() value");
      assert.ok(maintenance.rawDeleted >= 1);
      assert.equal(maintenance.rawRetentionDays, 90);
      assert.equal(
        (await report("summary", { start: old, end: old })).menuViews,
        1,
      );
      assert.equal(
        await value(
          "SELECT count(*)::int value FROM analytics_events WHERE business_id=$1 AND occurred_at<$2",
          [business, shift(today, -90)],
        ),
        0,
      );
      await assert.rejects(
        query("UPDATE analytics_settings SET timezone='UTC'"),
        /ANALYTICS_TIMEZONE_REQUIRES_BACKFILL/,
      );
      await assert.rejects(
        query("UPDATE analytics_settings SET timezone='Invalid/Zone'"),
        /INVALID_ANALYTICS_TIMEZONE/,
      );
    },
  );
  console.log(`Analytics database checks passed: ${checks}.`);
}
