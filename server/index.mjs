/** 비령 단독 서버. 정적 UI와 독립 커뮤니티 API를 같은 출처에서 제공. */
import { createServer } from 'node:http';
import { readFile, readFileSync } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, pool } from './db.mjs';
import { handleCommunity } from './community.mjs';
const manifest=JSON.parse(readFileSync(new URL('../systems/data/catalog-manifest.json',import.meta.url),'utf8'));
const port=Number(process.env.PORT || 10000);
const base=resolve(fileURLToPath(new URL('../site/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const answer=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const path=url.pathname;
    if(await handleCommunity(req,res,url))return;
    if(path==='/health' && req.method==='GET')return answer(res,200,{service:'biryeong',status:'ok',database:pool?'configured':'not_configured',playEnabled:false});
    if(path==='/api/v1/meta' && req.method==='GET')return answer(res,200,{service:'biryeong',gameDataVersion:'C.01-snapshot',counts:manifest.counts,playEnabled:false,communityEnabled:Boolean(pool)});
    if(req.method!=='GET'&&req.method!=='HEAD')return answer(res,405,{error:'method_not_allowed'});
    if(path.startsWith('/api/'))return answer(res,404,{error:'not_found'});
    let decoded;
    try {decoded=decodeURIComponent(path);}catch{return answer(res,400,{error:'bad_path'});}
    if(decoded.includes('\0')||decoded.includes('\\'))return answer(res,400,{error:'bad_path'});
    const file=resolve(base,'.'+(decoded==='/'?'/index.html':decoded));
    if(file!==base && !file.startsWith(base+sep))return answer(res,403,{error:'forbidden'});
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
