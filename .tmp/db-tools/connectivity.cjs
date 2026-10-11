const fs = require('node:fs');
const dns = require('node:dns').promises;
const net = require('node:net');
const vars = require('node:util').parseEnv(fs.readFileSync('.env', 'utf8'));
(async () => {
  try {
    const url = new URL(vars.SUPABASE_DB_URL || process.env.SUPABASE_DB_URL);
    console.log(JSON.stringify({connectionType:url.hostname.startsWith('db.')?'direct':url.hostname.includes('pooler')?'pooler':'other',port:url.port||'5432',placeholderPassword:/\[|YOUR|PASSWORD/i.test(url.password)}));
    const addresses = await dns.lookup(url.hostname, {all:true});
    console.log(JSON.stringify({addressFamilies:addresses.map(a=>a.family)}));
    for (const entry of addresses) await new Promise(resolve => {
      const socket = net.connect({host:entry.address,port:Number(url.port||5432),family:entry.family});
      const finish = result => { console.log(JSON.stringify({family:entry.family,result}));socket.destroy();resolve(); };
      socket.setTimeout(5000,()=>finish('timeout'));
      socket.once('connect',()=>finish('connected'));
      socket.once('error',e=>finish(e.code));
    });
  } catch (e) { console.error(JSON.stringify({code:e.code,message:'Connection configuration or DNS lookup failed'})); process.exitCode=1; }
})();
