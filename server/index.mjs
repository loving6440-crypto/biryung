/** 비령 단독 서버. 정적 UI와 독립 커뮤니티 API를 같은 출처에서 제공. */
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile, readFileSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, pool } from './db.mjs';
import { handleCommunity } from './community.mjs';
const manifest=JSON.parse(readFileSync(new URL('../systems/data/catalog-manifest.json',import.meta.url),'utf8'));
const port=Number(process.env.PORT || 10000);
// v0.6: 화면 파일(index.html 등)은 저장소 맨 위에 있다(GitHub Pages 에서 바로 열리도록).
// 서버는 아래 목록에 있는 화면 파일과 assets/ · fonts/ 폴더만 내보낸다 — server/ · systems/ · tests/ · 설정 파일은 내보내지 않는다.
const base=resolve(fileURLToPath(new URL('../',import.meta.url)));
const PUBLIC_FILES=new Set(['index.html','app.js','auth.js','config.js','styles.css','community.js','community.css','game-data.js','titles.js','titles2.js','story.js','story-data.js','sync.js','quest.js','404.html']);
const PUBLIC_DIRS=['assets','fonts','play'];
const isPublic=(file)=>{const rel=file.slice(base.length+1);if(PUBLIC_FILES.has(rel))return true;const [dir,...rest]=rel.split(sep);return PUBLIC_DIRS.includes(dir)&&rest.length>0&&!rest.some(p=>p.startsWith('.'));};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const answer=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const path=url.pathname;
    if(await handleCommunity(req,res,url))return;
    if(path==='/health' && req.method==='GET')return answer(res,200,{service:'biryeong',status:'ok',database:pool?'configured':'not_configured',playEnabled:false});
    if(path==='/api/v1/meta' && req.method==='GET')return answer(res,200,{service:'biryeong',gameDataVersion:'C.01-snapshot',counts:manifest.counts,playEnabled:false,communityEnabled:Boolean(pool)});
    // v1.0 관리자 코드 확인: Render 환경변수 ADMIN_CODE 와 비교한다(코드는 저장소에 두지 않는다). 정적 사이트(GitHub Pages)에서도 부를 수 있게 CORS 를 연다.
    if(path==='/api/admin/verify'){
      const cors={'Access-Control-Allow-Origin':process.env.ALLOW_ORIGIN||'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
      if(req.method==='OPTIONS')return res.writeHead(204,cors).end();
      if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)break;}
      let code='';try{code=String(JSON.parse(raw||'{}').code??'');}catch{code='';}
      const want=process.env.ADMIN_CODE||'';
      const a=createHash('sha256').update(code).digest(),b=createHash('sha256').update(want).digest();
      const ok=Boolean(want)&&timingSafeEqual(a,b);
      return res.writeHead(200,{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify({ok}));
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return answer(res,405,{error:'method_not_allowed'});
    if(path.startsWith('/api/'))return answer(res,404,{error:'not_found'});
    let decoded;
    try {decoded=decodeURIComponent(path);}catch{return answer(res,400,{error:'bad_path'});}
    if(decoded.includes('\0')||decoded.includes('\\'))return answer(res,400,{error:'bad_path'});
    const file=resolve(base,'.'+(decoded==='/'?'/index.html':decoded));
    if(!file.startsWith(base+sep))return answer(res,403,{error:'forbidden'});
    if(!isPublic(file))return answer(res,404,{error:'not_found'});
    const mime=types[extname(file).toLowerCase()];
    if(!mime)return answer(res,404,{error:'not_found'});
    readFile(file,(err,buffer)=>{
      if(err)return answer(res,404,{error:'not_found'});
      res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cache-Control':mime.startsWith('text/html')?'no-cache':'public,max-age=3600'});
      if(req.method==='HEAD')res.end();else res.end(buffer);
    });
  }catch(err){console.error('[biryeong]',err);if(!res.headersSent)answer(res,500,{error:'internal_error'});}
});
await initDatabase();
server.listen(port,'0.0.0.0',()=>console.log(`[biryeong] dedicated service on ${port}, community ${pool?'on':'needs DATABASE_URL'}`));
