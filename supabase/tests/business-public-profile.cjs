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
    const themeMigration = fs.readFileSync('supabase/migrations/20261013000006_business_profile_theme_color.sql','utf8');
    const bid = '11111111-1111-1111-1111-111111111111';
    const read = async () => (await db.query('select get_public_business_profile($1) as profile',[bid])).rows[0].profile;
    const save = async (profile) => (await db.query('select save_public_business_profile($1,$2::jsonb) as profile',[bid,JSON.stringify(profile)])).rows[0].profile;
    const { savePublicBusinessProfile } = await import('../../src/lib/businessProfile.js');
    const client = { rpc: async (name,args) => {
      try { return { data: name==='save_public_business_profile' ? await save(args.p_profile) : await read(),error:null }; }
      catch(error) { return { data:null,error }; }
    } };
    assert.equal((await read()).email,undefined);
    // Reproduce the legacy behavior: save succeeds but loses green.
    await assert.rejects(savePublicBusinessProfile(client,bid,{display_name:'Test Shop',theme_color:'#16A34A'}),/theme color was not saved/);
    assert.equal((await read()).theme_color,undefined);
    await db.exec(themeMigration);
    const repairMigration = fs.readFileSync('supabase/migrations/20261013000013_fix_profile_theme_persistence.sql','utf8');
    await db.exec(repairMigration);
    assert.equal((await read()).display_name,'Test Shop');
    assert.equal((await read()).email,'');
    assert.equal((await read()).theme_color,'#F5C400');
    const profile = { display_name:'Public Shop',about:'Welcome',logo_url:'https://example.test/logo.png',website:'https://example.test',email:'public@example.test',business_id:'injected',status:'injected' };
    assert.equal((await save(profile)).business_id,bid);
    assert.equal((await read()).email,'public@example.test');
    assert.equal((await read()).status,undefined);
    assert.equal((await save({...profile,theme_color:'#16a34a'})).theme_color,'#16A34A');
    assert.equal((await read()).theme_color,'#16A34A');
    // Fresh reads simulate returning to the Content page or refreshing it.
    assert.equal((await savePublicBusinessProfile(client,bid,{...profile,theme_color:'#16a34a'})).theme_color,'#16A34A');
    assert.equal((await read()).theme_color,'#16A34A');
    // Older clients saving contact/profile details must preserve the color.
    await save({...profile,about:'Updated details without a theme field'});
    assert.equal((await read()).theme_color,'#16A34A');
    await db.exec(repairMigration);
    assert.equal((await read()).theme_color,'#16A34A');
    await assert.rejects(save({...profile,theme_color:'red'}),/six-digit hex/);
    await assert.rejects(save({...profile,theme_color:'#123'}),/six-digit hex/);
    await assert.rejects(save({...profile,theme_color:42}),/must be text/);
    assert.equal((await read()).theme_color,'#16A34A');
    await assert.rejects(save({...profile,logo_url:'javascript:alert(1)'}),/http or https/);
    await assert.rejects(save({...profile,about:'x'.repeat(2001)}),/too long/);
    await db.exec('create table content_items(business_id uuid,status text)');
    await db.query("insert into content_items values($1,'PUBLISHED'),($1,'PUBLISHED')",[bid]);
    await db.exec(fs.readFileSync('supabase/migrations/20261013000005_community_business_logos.sql','utf8'));
    const identities = (await db.query('select * from get_community_business_identities($1::uuid[])',[[bid]])).rows;
    assert.equal(identities.length,1);
    assert.equal(identities[0].logo_url,profile.logo_url);
    assert.equal(identities[0].name,'Public Shop');
    assert.equal(identities[0].email,undefined);
    await db.exec('update session_state set can_edit=false');
    assert.equal((await read()).display_name,'Public Shop');
    await assert.rejects(save(profile),/Only owners and managers/);
    await db.exec('update session_state set signed_in=false');
    await assert.rejects(read(),/Sign in/);
    await db.exec(migration);
    await db.exec(themeMigration);
    await db.exec(repairMigration);
    console.log('Business public profile checks passed: legacy theme loss reproduced, green persists on reload, older-client saves preserve color, protected edits, validation, repeat migration.');
  } finally { await db.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });
