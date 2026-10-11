const fs = require('node:fs');
const { Client } = require('pg');
const vars = require('node:util').parseEnv(fs.readFileSync('.env', 'utf8'));
const client = new Client({ connectionString: vars.SUPABASE_DB_URL || process.env.SUPABASE_DB_URL, connectionTimeoutMillis: 10000 });
(async () => {
  try {
    await client.connect();
    const schema = await client.query(`select table_name,column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='public' and table_name in ('workstations','workstation_sessions') order by table_name,ordinal_position`);
    console.log(JSON.stringify(schema.rows));
    const functions = await client.query(`select proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('start_workstation_session','end_workstation_session','user_has_business_role')`);
    console.log(JSON.stringify(functions.rows));
    const members = await client.query(`select w.id,w.business_id,w.status,bm.user_id,bm.role,bm.status as member_status from public.workstations w join public.business_members bm on bm.business_id=w.business_id where bm.role in ('OWNER','MANAGER') and bm.status='ACTIVE' limit 5`);
    console.log(JSON.stringify(members.rows));
  } catch (e) { console.error(JSON.stringify({code:e.code,message:String(e.message).replaceAll(vars.SUPABASE_DB_URL || '___','[REDACTED]')})); process.exitCode=1; }
  finally { await client.end(); }
})();
