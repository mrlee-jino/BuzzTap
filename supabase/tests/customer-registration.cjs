const fs = require('node:fs');
const assert = require('node:assert/strict');
// npm install --prefix .tmp/db-tools --no-save --package-lock=false @electric-sql/pglite
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create table profiles(id uuid primary key,full_name text,email text,role text,status text);
      create table customers(id text primary key,business_id uuid,name text,email text,status text);
      create table nfc_cards(id text primary key,business_id uuid,customer_id uuid,card_code text,status text);
      create function user_has_business_role(bid uuid, roles text[]) returns boolean
        language sql as $$select bid <> '33333333-3333-3333-3333-333333333333'::uuid$$;
      create function user_is_active_business_member(bid uuid) returns boolean
        language sql as $$select true$$;
    `);
    for (const migration of [
      '20261011000005_customer_account_registration.sql',
      '20261011000008_register_admin_linked_card_accounts.sql',
      '20261012000001_daily_customer_codes.sql',
    ]) await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, 'utf8'));

    const business = '11111111-1111-1111-1111-111111111111';
    const other = '22222222-2222-2222-2222-222222222222';
    const profile = '44444444-4444-4444-4444-444444444444';
    const prefix = (await db.query("select to_char(current_timestamp at time zone 'Asia/Shanghai','YYYYMMDD') as prefix")).rows[0].prefix;
    const register = async (email, bid = business, card = null, linked = null) => {
      const result = await db.query('select register_customer_with_card_code($1,$2,$3,$4,$5,$6) as id', [bid, linked, 'Local Customer', email, 'stale-preview', card]);
      return (await db.query('select * from customers where id=$1', [result.rows[0].id])).rows[0];
    };
    const first = await register('first@example.test');
    assert.equal(first.customer_code, `${prefix}001`);
    assert.equal(first.profile_id, null);
    assert.equal((await register('second@example.test')).customer_code, `${prefix}002`);
    await assert.rejects(register('second@example.test'), /already registered/);
    assert.equal((await register('third@example.test')).customer_code, `${prefix}003`);
    assert.equal((await register('other@example.test', other)).customer_code, `${prefix}001`);
    await db.query('update customers set status=$1 where customer_code=$2 and business_id=$3', ['DELETED', `${prefix}003`, business]);
    assert.equal((await register('fourth@example.test')).customer_code, `${prefix}004`);

    await db.query("insert into profiles values($1,'Card Customer','card@example.test','CUSTOMER','ACTIVE')", [profile]);
    await db.query("insert into nfc_cards values('card-1',$1,$2,'400001','ACTIVE')", [other, profile]);
    const cardCustomer = await register('ignored@example.test', business, '400001', profile);
    assert.equal(cardCustomer.customer_code, `${prefix}005`);
    assert.equal(cardCustomer.profile_id, profile);
    assert.equal(cardCustomer.email, 'card@example.test');
    const card = (await db.query("select * from nfc_cards where id='card-1'")).rows[0];
    assert.equal(card.customer_id, profile);
    assert.equal(card.business_id, other);
    await assert.rejects(register('bad@example.test', business, 'missing'), /No active Customer account/);
    await assert.rejects(register('denied@example.test', '33333333-3333-3333-3333-333333333333'), /Not authorized/);
    await db.query('update customers set customer_code=$1 where id=$2', [`${prefix}999`, first.id]);
    await assert.rejects(register('overflow@example.test'), /daily limit/);
    console.log('Customer registration database checks passed');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
