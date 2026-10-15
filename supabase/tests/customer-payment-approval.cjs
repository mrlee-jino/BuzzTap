// Isolated Postgres execution. Never connects to a deployed project.
// npm install --prefix .tmp/db-tools --no-save --package-lock=false @electric-sql/pglite
// node supabase/tests/customer-payment-approval.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');
const migration = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', customer='33333333-3333-4333-8333-333333333333';
const stranger='55555555-5555-4555-8555-555555555555', staff='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', admin='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bid='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const db=new PGlite();
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const one=async(sql,args=[]) => (await rows(sql,args))[0];
const as=async uid => {await db.exec('reset role');await rows("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
const root=()=>db.exec('reset role');
const request=async({id=randomUUID(),kind='PRODUCT',method='BUZZPOINTS',quantity=1,amount=null,customerId='CUSTOMER-1',business=bid}={}) =>
 one('select * from request_customer_payment($1,$2,$3,$4,$5,$6,$7,$8,$9)',[business,customerId,kind,method,kind==='PRODUCT'?'PRODUCT-1':null,kind==='PRODUCT'?quantity:null,kind==='WORKSTATION'?'STATION-1':null,amount,id]);
const approve=async r=>{await as(customer);return one('select * from respond_customer_payment($1,true)',[r.id]);};
const capture=async r=>{await as(owner);return one('select * from capture_customer_payment($1)',[r.id]);};
const state=async r=>one('select state from customer_payment_requests where id=$1',[r.id]);
async function setup(){
 await db.exec(`create schema auth; create role anon; create role authenticated;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,full_name text,email text,role text,status text);
 create table businesses(id uuid primary key,name text,status text);
 create table business_members(business_id uuid,user_id uuid,role text,status text);
 create function is_admin() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='ADMIN' and status='ACTIVE')$$;
 create function user_has_business_role(bid uuid,roles text[]) returns boolean language sql security definer set search_path=public as $$select exists(select 1 from business_members where business_id=bid and user_id=auth.uid() and role=any(roles) and status='ACTIVE')$$;
 create table business_bp_wallets(business_id uuid primary key,balance bigint check(balance>=0),updated_at timestamptz);
 create table customer_bp_wallets(customer_id uuid primary key,balance bigint check(balance>=0),updated_at timestamptz);
 alter table customer_bp_wallets enable row level security;
 create table transactions(id uuid primary key default gen_random_uuid(),transaction_code text,customer_id uuid,business_id uuid,transaction_type text,status text,amount_bp bigint,description text,metadata jsonb,completed_at timestamptz);
 create table audit_logs(actor_user_id uuid,action text,target_type text,target_id uuid,details jsonb);
 create function load_customer_points(uuid,text,numeric) returns uuid language sql as $$select gen_random_uuid()$$;
 create function record_business_refund(uuid,uuid) returns uuid language sql as $$select gen_random_uuid()$$;
 create function process_customer_purchase(text,uuid,uuid,uuid,jsonb,text) returns transactions language sql security definer as $$select null::transactions$$;
 create function provision_customer_wallet(uuid) returns bigint language sql security definer as $$select 0::bigint$$;
 grant usage on schema auth to authenticated;
 `);
 await db.exec(migration('20260925000007_create_business_operations'));
 await db.exec(`alter table customers add column profile_id uuid references profiles(id);
 alter table products_services add column stock integer default 0;
 create table workstation_sessions(id uuid primary key default gen_random_uuid(),business_id uuid,workstation_id text,customer_id text,operator_id uuid,status text default 'ACTIVE',started_at timestamptz default now());
 create table product_inventory_movements(id uuid default gen_random_uuid(),business_id uuid,product_id text,movement_type text,quantity integer,note text,created_by uuid);
 create table business_system_logs(id uuid default gen_random_uuid(),business_id uuid,actor_id uuid,actor_name text,category text,action text,source_table text,source_id text,details jsonb,occurred_at timestamptz default now());
 create function is_important_business_activity(text,text,jsonb) returns boolean language sql as $$select true$$;
 create function start_workstation_session(bid uuid,sid text) returns uuid language plpgsql security definer set search_path=public as $$declare nid uuid;begin
 if not public.user_has_business_role(bid,array['OWNER','MANAGER']) then raise exception 'Not authorized';end if;
 update workstations set status='IN_USE' where business_id=bid and id::text=sid and status='ACTIVE';if not found then raise exception 'Unavailable';end if;
 insert into workstation_sessions(business_id,workstation_id,operator_id) values(bid,sid,auth.uid()) returning id into nid;return nid;end;$$;
 `);
 for(const name of ['20261011000004_workstation_session_payments','20261011000009_shared_bp_transfers','20261011000010_workstation_session_countdown',
 '20261011000011_catalog_item_types','20261011000012_product_checkout_payments',
 '20261013000008_product_cash_received_and_change','20261013000011_customized_buzzpoints_rebates','20261013000012_staff_page_access']) await db.exec(migration(name));
 await rows('insert into businesses values($1,\'Example\',\'ACTIVE\'),($2,\'Other\',\'ACTIVE\')',[bid,other]);
 for(const [uid,role] of [[owner,'BUSINESS'],[customer,'CUSTOMER'],[stranger,'CUSTOMER'],[staff,'STAFF'],[admin,'ADMIN']]){
  await rows('insert into auth.users values($1)',[uid]);
  await rows("insert into profiles values($1,'Synthetic','synthetic@example.invalid',$2,'ACTIVE')",[uid,role]);
 }
 await rows("insert into business_members values($1,$2,'OWNER','ACTIVE'),($1,$3,'STAFF','ACTIVE')",[bid,owner,staff]);
 await rows("insert into customers(id,business_id,profile_id,name,email) values('CUSTOMER-1',$1,$2,'Customer','customer@example.invalid'),('CUSTOMER-2',$3,$4,'Other','other@example.invalid')",[bid,customer,other,stranger]);
 await rows("insert into business_bp_wallets values($1,100,now()),($2,100,now())",[bid,other]);
 await rows("insert into customer_bp_wallets values($1,100,now()),($2,100,now())",[customer,stranger]);
 await rows("insert into products_services(id,business_id,name,category,price,stock) values('PRODUCT-1',$1,'Item','Test',10,100)",[bid]);
 await rows("insert into workstations(id,business_id,name,type,rate) values('STATION-1',$1,'Station','Test',25)",[bid]);
 await rows('insert into business_customized_bp_wallets values($1,$2,100,now())',[bid,customer]);
 // Reproduce deployed financial DML privileges before migration hardens them.
 await db.exec('grant all on business_transactions,customer_bp_wallets,business_bp_wallets,transactions,audit_logs to authenticated,anon');
 await db.exec(migration('20261015133258_customer_payment_approval'));
}
(async()=>{try{
 await setup();await as(owner);
 const first=await request();assert.equal(first.amount,10);assert.equal(first.state,'PENDING');
 assert.equal((await request({id:first.id})).id,first.id);
 await assert.rejects(request({id:first.id,quantity:2}),/different details/);
 await assert.rejects(one('select * from capture_customer_payment($1)',[first.id]),/approval required/);
 await assert.rejects(one('select * from respond_customer_payment($1,true)',[first.id]),/not found/);
 const visibility=(await one('select get_business_shared_bp($1) as v',[bid])).v;
 assert.equal(visibility.customers[0].balance,undefined);
 assert.equal((await rows('select * from customer_bp_wallets')).length,0);
 for(const table of ['business_transactions','customer_bp_wallets','customer_payment_requests','customer_payment_events']){
  await assert.rejects(db.exec(`truncate ${table}`),/permission denied/);
 }
 await assert.rejects(rows("insert into business_transactions(business_id,type,amount) values($1,'CASH_PURCHASE',999)",[bid]),/permission denied/);
 await assert.rejects(one("select checkout_product_purchase($1,'PRODUCT-1',1,'CUSTOMER-1',null,'BUZZPOINTS',null,gen_random_uuid())",[bid]),/approval required/);
 await assert.rejects(one("select start_timed_workstation_session($1,'STATION-1','CUSTOMER-1',null,'CUSTOMIZED',10,gen_random_uuid(),null)",[bid]),/approval required/);
 for(const sig of ['purchase_shared_product(uuid,text,text,integer,uuid)','process_customer_purchase(text,uuid,uuid,uuid,jsonb,text)',
  'apply_business_shared_bp(uuid,text,text,numeric,uuid,uuid,jsonb)','checkout_product_purchase_approved_internal(uuid,text,integer,text,text,text,numeric,uuid)',
  'start_timed_workstation_session_approved_internal(uuid,text,text,text,text,numeric,uuid,integer)']){
  assert.equal((await one('select has_function_privilege(\'authenticated\',$1,\'execute\') as ok',[sig])).ok,false,sig);
 }
 await as(stranger);assert.equal((await rows('select * from customer_payment_requests')).length,0);
 await assert.rejects(one('select * from respond_customer_payment($1,true)',[first.id]),/not found/);
 await assert.rejects(one('select * from capture_customer_payment($1)',[first.id]),/not found/);
 await assert.rejects(one('select * from cancel_customer_payment($1)',[first.id]),/not found/);
 await as(customer);assert.equal((await rows('select * from customer_bp_wallets')).length,1);
 assert.equal((await rows('select * from customer_payment_events')).length,1);
 await approve(first);const paid=await capture(first);assert.equal(paid.state,'CAPTURED');
 assert.equal((await capture(first)).transaction_id,paid.transaction_id);
 await root();assert.equal(Number((await one('select balance from customer_bp_wallets where customer_id=$1',[customer])).balance),90);
 assert.equal(Number((await one("select stock from products_services where id='PRODUCT-1'")).stock),99);
 assert.equal((await one('select metadata from business_transactions where id=$1',[paid.transaction_id])).metadata.payment_request_id,first.id);
 assert.equal((await rows('select * from customer_payment_events where request_id=$1',[first.id])).length,3);
 console.log('PASS: approval ownership, RLS privacy, immutable request, restricted legacy RPCs/DML, single capture and receipt evidence.');

 await as(owner);const declined=await request();await as(customer);await one('select * from respond_customer_payment($1,false)',[declined.id]);
 await assert.rejects(capture(declined),/approval required/);
 await as(owner);const cancelled=await request();await approve(cancelled);await one('select * from cancel_customer_payment($1)',[cancelled.id]);
 await assert.rejects(capture(cancelled),/approval required/);
 const expired=await request();await approve(expired);await root();await rows("update customer_payment_requests set expires_at=now()-interval '1 second' where id=$1",[expired.id]);
 await assert.rejects(capture(expired),/expired/);
 const changed=await request();await approve(changed);await root();await db.exec("update products_services set price=11 where id='PRODUCT-1'");
 await assert.rejects(capture(changed),/details changed/);await root();await db.exec("update products_services set price=10 where id='PRODUCT-1'");
 await as(owner);await one('select * from cancel_customer_payment($1)',[changed.id]);
 const insufficient=await request();await approve(insufficient);await root();await rows('update customer_bp_wallets set balance=0 where customer_id=$1',[customer]);
 await assert.rejects(capture(insufficient),/Insufficient/);assert.equal((await state(insufficient)).state,'APPROVED');
 await root();await rows('update customer_bp_wallets set balance=90 where customer_id=$1',[customer]);await as(owner);await one('select * from cancel_customer_payment($1)',[insufficient.id]);
 const frozen=await request();await approve(frozen);await root();await rows("update profiles set status='FROZEN' where id=$1",[customer]);
 await assert.rejects(capture(frozen),/not active/);await root();await rows("update profiles set status='ACTIVE' where id=$1",[customer]);await as(owner);await one('select * from cancel_customer_payment($1)',[frozen.id]);
 const relinked=await request();await approve(relinked);await root();await rows("update customers set profile_id=$1 where id='CUSTOMER-1'",[stranger]);
 await assert.rejects(capture(relinked),/registration changed/);await root();await rows("update customers set profile_id=$1 where id='CUSTOMER-1'",[customer]);await as(owner);await one('select * from cancel_customer_payment($1)',[relinked.id]);
 const noStock=await request();await approve(noStock);await root();await db.exec("update products_services set stock=0 where id='PRODUCT-1'");
 await assert.rejects(capture(noStock),/stock/);await root();await db.exec("update products_services set stock=99 where id='PRODUCT-1'");await as(owner);await one('select * from cancel_customer_payment($1)',[noStock.id]);
 console.log('PASS: declined/cancelled/expired approvals, changed price, frozen account, insufficient-funds rollback.');

 const paused=await request();await approve(paused);await as(owner);
 await assert.rejects(one("select * from admin_set_business_points_payments($1,false,'Investigating charges')",[bid]),/Admin access/);
 await as(admin);await one("select * from admin_set_business_points_payments($1,false,'Investigating charges')",[bid]);
 await assert.rejects(capture(paused),/paused/);await assert.rejects(request(),/paused/);
 await as(admin);await one("select * from admin_set_business_points_payments($1,true,'Investigation complete')",[bid]);await as(owner);await one('select * from cancel_customer_payment($1)',[paused.id]);
 await as(staff);const cbp=await request({method:'CUSTOMIZED'});await approve(cbp);await as(staff);
 const cbpPaid=await one('select * from capture_customer_payment($1)',[cbp.id]);
 assert.equal((await rows('select * from business_customized_bp_wallets')).length,0);
 await root();assert.equal(Number((await one('select balance from business_customized_bp_wallets')).balance),90);
 await as(owner);await one('select refund_business_customized_bp($1,$2)',[bid,cbpPaid.transaction_id]);
 assert.equal((await rows("select * from customer_payment_events where request_id=$1 and event_type='REFUNDED'",[cbp.id])).length,1);
 await one('select refund_shared_customer_bp($1,$2)',[bid,paid.transaction_id]);
 await one('select refund_shared_customer_bp($1,$2)',[bid,paid.transaction_id]);
 assert.equal((await rows("select * from customer_payment_events where request_id=$1 and event_type='REFUNDED'",[first.id])).length,1);
 await as(customer);const dispute=await one('select * from open_customer_payment_dispute($1,$2)',[first.id,'I do not recognize this charge']);
 assert.equal((await one('select * from open_customer_payment_dispute($1,$2)',[first.id,'I do not recognize this charge'])).id,dispute.id);
 await as(staff);assert.equal((await rows('select * from customer_payment_disputes')).length,0);
 assert.equal((await rows("select * from customer_payment_events where event_type like 'DISPUTE_%'")).length,0);
 await assert.rejects(one("select * from admin_review_payment_dispute($1,'RESOLVED','Refund verified and completed')",[dispute.id]),/Admin access/);
 await as(admin);await one("select * from admin_review_payment_dispute($1,'RESOLVED','Refund verified and completed')",[dispute.id]);
 console.log('PASS: CBP staff capture and privacy, idempotent refunds and notifications, disputes and admin-only payment pause/review.');

 await as(owner);const session=await request({kind:'WORKSTATION',amount:25});await approve(session);const started=await capture(session);
 assert.ok(started.session_id);assert.equal((await capture(session)).session_id,started.session_id);
 await root();assert.equal(Number((await one('select duration_seconds from workstation_sessions where id=$1',[started.session_id])).duration_seconds),3600);
 await db.exec("update workstations set status='ACTIVE'");await as(owner);
 const rateChanged=await request({kind:'WORKSTATION',amount:25});await approve(rateChanged);await root();await db.exec("update workstations set rate=50");
 await assert.rejects(capture(rateChanged),/details changed/);await root();await db.exec('update workstations set rate=25');await as(owner);await one('select * from cancel_customer_payment($1)',[rateChanged.id]);
 const customSession=await request({kind:'WORKSTATION',amount:25,method:'CUSTOMIZED'});await approve(customSession);await capture(customSession);
 await root();await db.exec("update workstations set status='ACTIVE'");await as(owner);
 const cash=await one("select checkout_product_purchase($1,'PRODUCT-1',1,null,'Guest','CASH',20,gen_random_uuid()) as id",[bid]);assert.ok(cash.id);
 const cashSession=await one("select start_timed_workstation_session($1,'STATION-1',null,'Guest','CASH',25,gen_random_uuid(),null) as id",[bid]);assert.ok(cashSession.id);
 await as(staff);await assert.rejects(request({kind:'WORKSTATION',amount:25}),/Not authorized/);
 await as(owner);await assert.rejects(request({business:other}),/Not authorized/);
 const quota=[];for(let i=0;i<5;i++) quota.push(await request());await assert.rejects(request(),/Too many/);
 for(const r of quota) await one('select * from cancel_customer_payment($1)',[r.id]);
 await root();await db.exec('set role anon');await assert.rejects(one('select * from capture_customer_payment($1)',[first.id]),/permission denied/);
 await assert.rejects(one('select provision_customer_wallet($1)',[customer]),/permission denied/);
 console.log('PASS: BP/CBP workstation capture and timing, cash product/session compatibility, tenant/role isolation, request quota and anonymous rejection.');
 console.log('All payment approval checks passed. PGlite serializes queries; staging lock-contention and device tests remain required.');
}finally{await db.close();}})().catch(error=>{console.error(error.message, error.where || '', error.detail || '');process.exitCode=1;});
