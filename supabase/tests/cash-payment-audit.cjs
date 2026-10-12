const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table audit_logs(actor_user_id uuid,action text,target_type text,target_id uuid,details jsonb);
      create table business_transactions(id uuid primary key default gen_random_uuid(),business_id uuid,customer_id text,workstation_id text,type text,amount numeric,status text,metadata jsonb default '{}',created_by uuid,created_at timestamptz default now());
      insert into business_transactions(type,amount,status,metadata) values
        ('CASH_PURCHASE',49.5,'COMPLETED','{"guest_name":"Local buyer","product_id":"PROD-001","quantity":1}'),
        ('CASH_PURCHASE',75,'COMPLETED','{"session_id":"session-1","payment_method":"CASH"}'),
        ('CUSTOMER_PURCHASE',25,'COMPLETED','{"payment_method":"BUZZPOINTS"}'),
        ('CASH_PURCHASE',10,'PENDING','{}');`);
    const migration = fs.readFileSync('supabase/migrations/20261012000002_cash_payment_audit.sql','utf8');
    await db.exec(migration);
    const count = async () => Number((await db.query("select count(*) as count from audit_logs where action='BUSINESS_CASH_PAYMENT'")).rows[0].count);
    assert.equal(await count(), 2);
    const oldAudit = (await db.query("select details from audit_logs where details->>'amount'='49.5'")).rows[0].details;
    assert.equal(oldAudit.backfilled, true);
    assert.equal(oldAudit.metadata.product_id, 'PROD-001');
    assert.ok(oldAudit.transaction_created_at);
    await db.exec(migration);
    assert.equal(await count(), 2);
    await db.exec("update business_transactions set status='COMPLETED' where status='PENDING'");
    assert.equal(await count(), 3);
    await db.exec("update business_transactions set status='COMPLETED'");
    assert.equal(await count(), 3);
    await db.exec("insert into business_transactions(type,amount,status,metadata) values ('CASH_REFUND',10,'COMPLETED','{}')");
    assert.equal(await count(), 4);
    await db.exec("begin; insert into business_transactions(type,amount,status) values ('CASH_PURCHASE',99,'COMPLETED'); rollback;");
    assert.equal(await count(), 4);
    console.log('Cash audit checks passed: historical backfill, product/session metadata, BP exclusion, pending completion, retries, refunds, rollback.');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
