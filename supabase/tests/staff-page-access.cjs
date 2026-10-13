// Isolated database verification; never connects to the deployed database.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const migration = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
  const bid = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const pid = '33333333-3333-4333-8333-333333333333';
  const cid = '44444444-4444-4444-8444-444444444444';
  const run = async (sql, args = []) => (await db.query(sql, args)).rows;
  try {
    await db.exec(`
      create schema auth; create role anon; create role authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid$$;
      insert into auth.users values(auth.uid());
      create table profiles(id uuid primary key,full_name text,email text,role text,status text);
      create table businesses(id uuid primary key,name text,status text);
      create table business_members(business_id uuid,user_id uuid,role text,status text);
      create function user_has_business_role(bid uuid,roles text[]) returns boolean language sql security definer as $$
        select exists(select 1 from business_members where business_id=bid and user_id=auth.uid() and role=any(roles) and status='ACTIVE')$$;
      create table business_bp_wallets(business_id uuid primary key,balance bigint check(balance>=0),updated_at timestamptz);
      create table customer_bp_wallets(customer_id uuid primary key,balance bigint check(balance>=0),updated_at timestamptz);
      create table transactions(id uuid primary key default gen_random_uuid(),transaction_code text,customer_id uuid,business_id uuid,transaction_type text,status text,amount_bp bigint,description text,metadata jsonb,completed_at timestamptz);
      create table audit_logs(actor_user_id uuid,action text,target_type text,target_id uuid,details jsonb);
      create function purchase_workstation_session(uuid,text,text,text,text,numeric) returns uuid language sql as $$select gen_random_uuid()$$;
      create function load_customer_points(uuid,text,numeric) returns uuid language sql as $$select gen_random_uuid()$$;
      create function record_business_refund(uuid,uuid) returns uuid language sql as $$select gen_random_uuid()$$;
      create function start_workstation_session(uuid,text) returns uuid language plpgsql as $$begin raise exception 'Not authorized'; end$$;
    `);
    await db.exec(migration('20260925000007_create_business_operations'));
    await db.exec(`alter table customers add column profile_id uuid references profiles(id);
      alter table products_services add column stock integer default 0;
      alter table nfc_cards add column card_code text;
      create table workstation_sessions(id uuid primary key,business_id uuid,workstation_id text,customer_id text,payment_method text,amount_paid numeric,transaction_id uuid,started_at timestamptz);
      create table product_inventory_movements(id uuid default gen_random_uuid(),business_id uuid,product_id text,movement_type text,quantity integer,note text,created_by uuid);
      create table business_system_logs(id uuid,business_id uuid,actor_id uuid,actor_name text,category text,action text,source_table text,source_id text,details jsonb,occurred_at timestamptz default now());
      create function is_important_business_activity(text,text,jsonb) returns boolean language sql as $$select true$$;
      create function get_registered_customer_cards(uuid) returns table(customer_id text,id text,card_code text,status text) language sql as $$select null::text,null::text,null::text,null::text where false$$;
    `);
    await db.exec(migration('20261011000008_register_admin_linked_card_accounts'));
    await db.exec(migration('20261011000009_shared_bp_transfers'));
    await db.exec(migration('20261011000011_catalog_item_types'));
    await db.exec(migration('20261011000012_product_checkout_payments'));
    await db.exec(migration('20261013000008_product_cash_received_and_change'));
    await db.exec(migration('20261013000011_customized_buzzpoints_rebates'));

    // Replace the broad fresh-install read/write policy with restrictive reads,
    // reproducing the membership restrictions present before this change.
    for (const table of ['customers','workstations','wallet_ledger','content_items','purchase_requests','settlement_requests']) {
      await db.exec(`drop policy ${table}_tenant_access on ${table};
        create policy managers_only on ${table} for all to authenticated
        using(user_has_business_role(business_id,array['OWNER','MANAGER']))
        with check(user_has_business_role(business_id,array['OWNER','MANAGER']));
        grant select,insert,update,delete on ${table} to authenticated;`);
    }
    await db.exec(`drop policy products_services_tenant_access on products_services;
      create policy catalog_member_read on products_services for select to authenticated using(user_is_active_business_member(business_id));
      create policy catalog_manager_write on products_services for all to authenticated using(user_has_business_role(business_id,array['OWNER','MANAGER'])) with check(user_has_business_role(business_id,array['OWNER','MANAGER']));
      grant select,insert,update,delete on products_services to authenticated;`);
    await run("insert into businesses values($1,'Example','ACTIVE'),($2,'Other','ACTIVE')", [bid,other]);
    await run("insert into business_members values($1,auth.uid(),'STAFF','ACTIVE')", [bid]);
    await run("insert into profiles values($1,'Synthetic','synthetic@example.invalid','CUSTOMER','ACTIVE')", [pid]);
    await run("insert into customers(id,business_id,profile_id,name,email) values($1,$2,$3,'Synthetic','synthetic@example.invalid')", [cid,bid,pid]);
    await run("insert into business_bp_wallets values($1,100,now())", [bid]);
    await run("insert into customer_bp_wallets values($1,100,now())", [pid]);
    await run("insert into products_services(id,business_id,name,category,price,stock) values('PRODUCT-1',$1,'Item','Test',10,20)", [bid]);
    await run("insert into workstations(id,business_id,name,type) values('STATION-1',$1,'Station','Test'),('STATION-2',$2,'Other','Test')", [bid,other]);
    await run("insert into nfc_cards(id,business_id,customer_id,card_code) values('CARD-1',$1,$2,'SYNTHETIC-CODE')", [other,pid]);
    await run("insert into profiles values('55555555-5555-4555-8555-555555555555','Unregistered','unregistered@example.invalid','CUSTOMER','ACTIVE')");
    await run("insert into nfc_cards(id,business_id,customer_id,card_code) values('CARD-2',$1,'55555555-5555-4555-8555-555555555555','UNREGISTERED-CODE')", [other]);
    for (const table of ['wallet_ledger','purchase_requests','settlement_requests']) {
      await run(`insert into ${table}(business_id,amount${table === 'wallet_ledger' ? ',type' : ''}) values($1,10${table === 'wallet_ledger' ? ",'PURCHASE'" : ''}),($2,10${table === 'wallet_ledger' ? ",'PURCHASE'" : ''})`,[bid,other]);
    }
    await run("insert into content_items(business_id,title,status) values($1,'Example draft','DRAFT'),($2,'Other draft','DRAFT')",[bid,other]);

    const sql = migration('20261013000012_staff_page_access');
    await db.exec(sql);
    await db.exec(sql); // Repeat application must preserve semantics.
    await db.exec('grant usage on schema auth to authenticated; set role authenticated');
    assert.equal((await run('select * from workstations')).length,1);
    assert.equal((await run('select * from customers')).length,1);
    for (const table of ['wallet_ledger','content_items','purchase_requests','settlement_requests']) {
      assert.equal((await run(`select * from ${table}`)).length,1);
    }
    assert.equal((await run("update content_items set status='PUBLISHED' returning id")).length,0);
    assert.equal((await run("update products_services set price=1 returning id")).length,0);
    assert.equal((await run("update purchase_requests set status='APPROVED' returning id")).length,0);
    assert.equal((await run("update workstations set status='DISABLED' returning id")).length,0);
    await assert.rejects(run("insert into workstations(id,business_id,name,type) values('BAD',$1,'Bad','Test')",[bid]),/row-level security/);
    assert.equal((await run('select get_business_shared_bp($1) as value',[bid]))[0].value.business_balance,100);
    await assert.rejects(run('select get_business_shared_bp($1)',[other]),/Not authorized/);
    assert.equal((await run('select * from resolve_customer_card_account($1,$2)',[bid,'SYNTHETIC-CODE'])).length,1);
    await assert.rejects(run('select * from resolve_customer_card_account($1,$2)',[bid,'UNREGISTERED-CODE']),/registered Customer/);
    await assert.rejects(run('select * from resolve_customer_card_account($1,$2)',[other,'SYNTHETIC-CODE']),/Not authorized/);
    await assert.rejects(run('select load_shared_customer_bp($1,$2,10,gen_random_uuid())',[bid,cid]),/Not authorized/);
    const payment = (await run("select checkout_product_purchase($1,'PRODUCT-1',1,$2,null,'BUZZPOINTS',null,gen_random_uuid()) as id",[bid,cid]))[0].id;
    await assert.rejects(run('select refund_shared_customer_bp($1,$2)',[bid,payment]),/Not authorized/);
    await run("select checkout_product_purchase($1,'PRODUCT-1',1,null,'Synthetic guest','CASH',20,gen_random_uuid())",[bid]);
    await assert.rejects(run("select checkout_product_purchase($1,'PRODUCT-1',1,$2,null,'BUZZPOINTS',null,gen_random_uuid())",[other,cid]),/Not authorized/);
    await db.exec('reset role');
    await run('insert into business_customized_bp_wallets values($1,$2,100,now())',[bid,pid]);
    await db.exec('set role authenticated');
    await run("select checkout_product_purchase($1,'PRODUCT-1',1,$2,null,'CUSTOMIZED',null,gen_random_uuid())",[bid,cid]);
    await assert.rejects(run('select refund_business_customized_bp($1,gen_random_uuid())',[bid]),/Not authorized/);
    await db.exec('reset role');
    assert.equal(Number((await run('select balance from customer_bp_wallets'))[0].balance),90);
    assert.equal(Number((await run('select balance from business_bp_wallets'))[0].balance),110);
    assert.equal(Number((await run('select balance from business_customized_bp_wallets'))[0].balance),90);
    assert.equal(Number((await run('select stock from products_services'))[0].stock),17);
    const cash = (await run("select amount,metadata from business_transactions where type='CASH_PURCHASE'"))[0];
    assert.equal(Number(cash.amount),10);
    assert.equal(cash.metadata.change_due,10);
    await db.exec("update business_members set status='SUSPENDED'; set role authenticated");
    assert.equal((await run('select * from workstations')).length,0);
    await assert.rejects(run('select get_business_shared_bp($1)',[bid]),/Not authorized/);
    await db.exec("reset role; update business_members set status='ACTIVE',role='OWNER'; set role authenticated");
    assert.equal((await run("update products_services set price=11 returning id")).length,1);
    assert.equal((await run("update workstations set status='MAINTENANCE' returning id")).length,1);
    await run('select load_shared_customer_bp($1,$2,10,gen_random_uuid())',[bid,cid]);
    console.log('STAFF checks passed: five-page data access, scoped cards, cash/BP/CBP checkout, tenant isolation, protected writes/loads/refunds, suspended membership, repeat migration.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
