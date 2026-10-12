const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    const business = '11111111-1111-1111-1111-111111111111';
    const other = '22222222-2222-2222-2222-222222222222';
    await db.exec(`create schema auth; create schema storage;
      create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
      create table businesses(id uuid primary key,name text,status text);
      create table business_members(business_id uuid,user_id uuid,role text,status text);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      alter table storage.objects enable row level security;
      alter table businesses enable row level security;
      grant usage on schema auth,storage to authenticated;
      grant insert on storage.objects to authenticated;
      grant select on businesses to authenticated;
      create function user_has_business_role(bid uuid,roles text[]) returns boolean
        language sql stable security definer set search_path=public as $$select exists(select 1 from business_members where business_id=bid and user_id=auth.uid() and status='ACTIVE' and role=any(roles))$$;
      insert into businesses values('${business}','Lee Computer Shop','ACTIVE'),('${other}','Other Shop','ACTIVE');
      insert into business_members values('${business}','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','OWNER','ACTIVE');
      set test.user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    `);
    // Reproduce the original name-binding error with business SELECT allowed.
    await db.exec(`create policy visible_businesses on businesses for select to authenticated using(true);
      create policy broken_upload on storage.objects for insert to authenticated with check(
        bucket_id='business-profile-images' and exists(select 1 from businesses b where b.id::text=split_part(name,'/',1) and user_has_business_role(b.id,array['OWNER','MANAGER'])));
      set role authenticated;`);
    const upload = (path, bucket = 'business-profile-images') => db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]);
    await assert.rejects(upload(`${business}/logo_url/test.png`), /row-level security/);
    await db.exec('reset role; drop policy broken_upload on storage.objects; drop policy visible_businesses on businesses;');
    const migration = fs.readFileSync('supabase/migrations/20261013000004_fix_profile_image_upload_policy.sql','utf8');
    await db.exec(migration);
    const bucket = (await db.query("select * from storage.buckets where id='business-profile-images'")).rows[0];
    assert.equal(Number(bucket.file_size_limit),10485760);
    await db.exec('set role authenticated');
    await upload(`${business}/logo_url/test.png`);
    await upload(`${business}/cover_url/test.jpg`);
    await assert.rejects(upload(`${other}/logo_url/test.png`), /row-level security/);
    await assert.rejects(upload(`${business}/other/test.png`), /row-level security/);
    await assert.rejects(upload('not-a-business/logo_url/test.png'), /row-level security/);
    await assert.rejects(upload(`${business}/logo_url/test.png`, 'other-bucket'), /row-level security/);
    for (const role of ['MANAGER','CASHIER','STAFF']) {
      await db.exec(`reset role; update business_members set role='${role}'; set role authenticated;`);
      if (role==='MANAGER') await upload(`${business}/logo_url/manager.png`);
      else await assert.rejects(upload(`${business}/logo_url/blocked.png`), /row-level security/);
    }
    await db.exec("reset role; update business_members set role='OWNER',status='INACTIVE'; set role authenticated;");
    await assert.rejects(upload(`${business}/logo_url/inactive.png`), /row-level security/);
    await db.exec("reset role; update business_members set status='ACTIVE'; update businesses set status='SUSPENDED'; set role authenticated;");
    await assert.rejects(upload(`${business}/logo_url/suspended.png`), /row-level security/);
    await db.exec("reset role; update businesses set status='ACTIVE'; set test.user_id=''; set role authenticated;");
    await assert.rejects(upload(`${business}/logo_url/unsigned.png`), /row-level security/);
    await db.exec('reset role');
    await db.exec(migration);
    console.log('Upload policy checks passed: original error reproduced; owner/manager uploads, tenant isolation, restricted paths, inactive memberships, bucket limits, and migration reapplication.');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
