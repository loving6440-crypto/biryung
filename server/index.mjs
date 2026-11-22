/** 비령 독립 Node 서버: 공용 화면과 로그인 커뮤니티 API를 같은 출처에서 제공. */
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, pool } from './db.mjs';
import { handleCommunity } from './community.mjs';
import { clientIp, permittedOrigin, limit, enter } from './security.mjs';

const manifest=JSON.parse(readFileSync(new URL('../systems/data/catalog-manifest.json', import.meta.url),'utf8'));
const port=Number(process.env.PORT || 10000);
const base=resolve(fileURLToPath(new URL('../', import.meta.url)));
// Explicit public allowlist: never expose server/, systems/, .env, SQL or credential files.
const PUBLIC_FILES=new Set([
  'index.html','404.html','app.js','auth.js','config.js','styles.css','community.js','community.css',
  'game-data.js','titles.js','titles2.js','story.js','story-data.js','sync.js','quest.js','opening.js',
  'codex-data.js','theme-light.css','theme-boot.js','server.js','market.js','cafe.js','adapt.js','beast-event.js','bgm.js','party.js'
]);
const PUBLIC_DIRS=new Set(['assets','fonts','play']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif',
  '.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon',
  '.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const common={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY',
  'Cross-Origin-Resource-Policy':'same-origin', 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net; media-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"};
const answer=(res,status,body,extra={})=>res.writeHead(status,{...common,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}).end(JSON.stringify(body));
const publicFile=(file)=>{
  const rel=file.slice(base.length+1);
  if (PUBLIC_FILES.has(rel)) return true;
  const parts=rel.split(sep);
  return parts.length>1 && PUBLIC_DIRS.has(parts[0]) && parts.slice(1).every(p=>p && !p.startsWith('.'));
};
async function verifyAdmin(req,res) {
  const allowOrigin=process.env.ALLOW_ORIGIN || '';
  if (!permittedOrigin(req,{crossOrigin:allowOrigin})) return answer(res,403,{error:'bad_origin'});
  const origin=req.headers.origin;
  const cors= origin ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'} : {};
  if (req.method==='OPTIONS') return res.writeHead(204,{...common,...cors}).end();
  if (req.method!=='POST') return answer(res,405,{error:'method_not_allowed'},cors);
  if (!limit('admin:'+clientIp(req),5,15*60*1000)) return answer(res,429,{error:'too_many_requests'},cors);
  if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return answer(res,415,{error:'json_required'},cors);
  let size=0,raw='';
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>2048) return answer(res,413,{error:'payload_too_large'},cors);
    raw+=chunk.toString('utf8');
  }
  let code;
  try {code=JSON.parse(raw).code;}catch{return answer(res,400,{error:'invalid_json'},cors);}
  if (typeof code !== 'string' || code.length>256) return answer(res,400,{error:'invalid_code'},cors);
  const want=process.env.ADMIN_CODE || '';
  const a=createHash('sha256').update(code).digest(),b=createHash('sha256').update(want).digest();
  return answer(res,200,{ok:Boolean(want) && timingSafeEqual(a,b)},cors);
}
const server=createServer(async(req,res)=>{
  const ip=clientIp(req);
  const leave=enter(ip);
  if(!leave) return answer(res,503,{error:'server_busy'},{'Retry-After':'2'});
  res.once('close',leave);
  try {
    if(!limit('all:'+ip,240,60_000)) return answer(res,429,{error:'too_many_requests'},{'Retry-After':'60'});
    if ((req.url || '').length > 2048) return answer(res,414,{error:'uri_too_long'});
    const url=new URL(req.url,'http://localhost');
    const path=url.pathname;
    if(path==='/api/admin/verify') return await verifyAdmin(req,res);
    if(await handleCommunity(req,res,url))return;
    if(path==='/health' && req.method==='GET')return answer(res,200,{service:'biryeong',status:'ok',database:pool?'configured':'not_configured',playEnabled:false});
    if(path==='/api/v1/meta' && req.method==='GET')return answer(res,200,{service:'biryeong',gameDataVersion:'C.01-snapshot',counts:manifest.counts,playEnabled:false,communityEnabled:Boolean(pool)});
    if(req.method!=='GET'&&req.method!=='HEAD')return answer(res,405,{error:'method_not_allowed'});
    if(path.startsWith('/api/'))return answer(res,404,{error:'not_found'});
    let decoded;
    try { decoded=decodeURIComponent(path); } catch { return answer(res,400,{error:'bad_path'}); }
    if(decoded.includes('\0')||decoded.includes('\\')||decoded.includes('?')||decoded.includes('#')) return answer(res,400,{error:'bad_path'});
    const file=resolve(base,'.'+(decoded==='/'?'/index.html':decoded));
    if(!file.startsWith(base+sep) || !publicFile(file))return answer(res,404,{error:'not_found'});
    const mime=types[extname(file).toLowerCase()];
    if(!mime)return answer(res,404,{error:'not_found'});
    // Realpath check also blocks symlinks inside the public asset directories.
    const actual=await realpath(file).catch(()=>null);
    if(!actual||!actual.startsWith(base+sep)||!publicFile(actual))return answer(res,404,{error:'not_found'});
    const info=await stat(actual).catch(()=>null);
    if(!info?.isFile())return answer(res,404,{error:'not_found'});
    const cache=mime.startsWith('text/html')?'no-cache':'public, max-age=3600';
    res.writeHead(200,{...common,'Content-Type':mime,'Content-Length':info.size,'Cache-Control':cache});
    if(req.method==='HEAD') return res.end();
    const stream=createReadStream(actual);
    stream.on('error',err=>{console.error('[static stream]',err.message);res.destroy();});
    stream.pipe(res);
  } catch(err) {
    console.error('[biryeong]',err);
    if(!res.headersSent)answer(res,500,{error:'internal_error'});else res.destroy();
  }
});
server.requestTimeout=15_000;
server.headersTimeout=10_000;
server.keepAliveTimeout=5_000;
server.maxRequestsPerSocket=100;
await initDatabase();
server.listen(port,'0.0.0.0',()=>console.log(`[biryeong] dedicated service on ${port}, community ${pool?'on':'needs DATABASE_URL'}`));
