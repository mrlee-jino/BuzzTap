const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table workstations(id text primary key,business_id uuid,status text,rate numeric);
      create table customers(id text,business_id uuid,name text);
      create table workstation_sessions(id uuid primary key default gen_random_uuid(),business_id uuid,started_at timestamptz default now(),purchase_request_id uuid,timing_payload jsonb,customer_name text,hourly_rate numeric,duration_seconds bigint,ends_at timestamptz);
      create function user_has_business_role(uuid,text[]) returns boolean language sql as $$select true$$;
      create function start_shared_workstation_session(bid uuid,sid text,cid text,guest text,method text,amount numeric,request uuid) returns uuid language plpgsql as $$declare result uuid; begin insert into workstation_sessions(business_id,purchase_request_id) values(bid,request) returning id into result; update workstations set status='IN_USE' where id=sid; return result; end$$;
      insert into workstations values('PC1','11111111-1111-1111-1111-111111111111','ACTIVE',25);`);
    const migration = fs.readFileSync('supabase/migrations/20261013000007_cash_session_duration_from_amount.sql','utf8');
    await db.exec(migration);
    const bid='11111111-1111-1111-1111-111111111111';
    const request='22222222-2222-2222-2222-222222222222';
    const start = async (amount, req=request, minutes=null) => (await db.query("select start_timed_workstation_session($1,'PC1',null,'Local customer','CASH',$2,$3,$4) as id",[bid,amount,req,minutes])).rows[0].id;
    const id=await start(50);
    const session=(await db.query('select *,extract(epoch from ends_at-started_at) as elapsed from workstation_sessions where id=$1',[id])).rows[0];
    assert.equal(Number(session.duration_seconds),7200);
    assert.equal(Number(session.elapsed),7200);
    assert.equal(Number(session.hourly_rate),25);
    assert.equal(await start(50),id);
    await assert.rejects(start(25),/different session/);
    await db.exec("update workstations set status='ACTIVE'");
    const other='33333333-3333-3333-3333-333333333333';
    await assert.rejects(start(0,other),/positive cash/);
    await assert.rejects(start(1.111,other),/two decimal/);
    await db.exec('update workstations set rate=0');
    await assert.rejects(start(25,other),/positive hourly rate/);
    await db.exec('update workstations set rate=25');
    const second=await start(12.5,other,999);
    assert.equal(Number((await db.query('select duration_seconds from workstation_sessions where id=$1',[second])).rows[0].duration_seconds),1800);
    await db.exec(migration);
    assert.equal(Number((await db.query('select duration_seconds from workstation_sessions where id=$1',[id])).rows[0].duration_seconds),7200);
    console.log('Cash timing checks passed: amount/rate duration, fractional hours, ignored manual minutes, retries, invalid values, and preserved existing sessions.');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
