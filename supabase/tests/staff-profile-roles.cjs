const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const sql = fs.readFileSync('supabase/migrations/20261013000014_align_staff_profile_roles.sql','utf8');
  try {
    await db.exec(`create table profiles(id uuid primary key,role text check(role in ('ADMIN','CUSTOMER','BUSINESS_OWNER')),updated_at timestamptz);
      create table business_members(user_id uuid,role text,status text);`);
    for (let n=1;n<=8;n++) {
      await db.query('insert into profiles values($1,$2,now())',[id(n),n===7?'ADMIN':n===8?'CUSTOMER':'BUSINESS_OWNER']);
    }
    for (const [n,role,status] of [[1,'STAFF','ACTIVE'],[2,'MANAGER','ACTIVE'],[3,'CASHIER','ACTIVE'],[4,'OWNER','ACTIVE'],[5,'STAFF','ACTIVE'],[5,'OWNER','SUSPENDED'],[6,'STAFF','ACTIVE'],[6,'CASHIER','ACTIVE'],[7,'STAFF','ACTIVE'],[8,'STAFF','ACTIVE']]) {
      await db.query('insert into business_members values($1,$2,$3)',[id(n),role,status]);
    }
    await db.exec(sql);
    const rows = (await db.query('select role from profiles order by id')).rows.map(row=>row.role);
    assert.deepEqual(rows,['STAFF','MANAGER','CASHIER','BUSINESS_OWNER','BUSINESS_OWNER','BUSINESS_OWNER','ADMIN','CUSTOMER']);
    await db.exec(sql);
    assert.deepEqual((await db.query('select role from profiles order by id')).rows.map(row=>row.role),rows);
    await assert.rejects(db.query('insert into profiles values($1,\'INVALID\',now())',[id(9)]),/check constraint/);
    // Corrected provisioning can now insert all three staff roles directly.
    for (const [n,role] of [[10,'STAFF'],[11,'MANAGER'],[12,'CASHIER']])
      await db.query('insert into profiles values($1,$2,now())',[id(n),role]);
    // Fail atomically when a constraint also protects another column.
    await db.exec("alter table profiles add column status text default 'ACTIVE'; alter table profiles add constraint combined_check check(role<>'STAFF' or status='ACTIVE')");
    await assert.rejects(db.exec(sql),/also validates other columns/);
    await db.exec('rollback');
    console.log('Staff profile role checks passed: legacy backfill, staff provisioning roles, preserved owners/admins/customers, ambiguous memberships skipped, constraints, repeat migration.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
