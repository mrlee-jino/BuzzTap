const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../../.tmp/db-tools/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated;
      create table session_state(signed_in boolean, can_edit boolean);
      insert into session_state values(true,true);
      create function auth.uid() returns uuid language sql as $$select case when signed_in then 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid end from session_state$$;
      create function user_has_business_role(uuid,text[]) returns boolean language sql as $$select signed_in and can_edit from session_state$$;
      create table businesses(id uuid primary key,name text,business_type text,status text,email text);
      insert into businesses values('11111111-1111-1111-1111-111111111111','Test Shop','Cafe','ACTIVE','private@example.test');`);
    const migration = fs.readFileSync('supabase/migrations/20261013000002_business_public_profiles.sql','utf8');
    await db.exec(migration);
    const bid = '11111111-1111-1111-1111-111111111111';
    const read = async () => (await db.query('select get_public_business_profile($1) as profile',[bid])).rows[0].profile;
    const save = async (profile) => (await db.query('select save_public_business_profile($1,$2::jsonb) as profile',[bid,JSON.stringify(profile)])).rows[0].profile;
    assert.equal((await read()).display_name,'Test Shop');
    assert.equal((await read()).email,undefined);
    const profile = { display_name:'Public Shop',about:'Welcome',website:'https://example.test',email:'public@example.test',business_id:'injected',status:'injected' };
    assert.equal((await save(profile)).business_id,bid);
    assert.equal((await read()).email,'public@example.test');
    assert.equal((await read()).status,undefined);
    await assert.rejects(save({...profile,logo_url:'javascript:alert(1)'}),/http or https/);
    await assert.rejects(save({...profile,about:'x'.repeat(2001)}),/too long/);
    await db.exec('update session_state set can_edit=false');
    assert.equal((await read()).display_name,'Public Shop');
    await assert.rejects(save(profile),/Only owners and managers/);
    await db.exec('update session_state set signed_in=false');
    await assert.rejects(read(),/Sign in/);
    await db.exec(migration);
    console.log('Business public profile checks passed: persistence, public fields, protected edits, URL validation, repeat migration.');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
