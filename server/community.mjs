import { query, pool } from './db.mjs';
import {
  COOKIE_NAME, SESSION_AGE_MS, COLORS,
  validateUsername, normalizeUsername, validatePassword,
  hashPassword, verifyPassword, newSessionToken, tokenHash, parseCookie,
  cookieHeader, memberCanRead, adminCanAudit
} from './auth.mjs';

const fail = (status, error) => { throw Object.assign(new Error(error), { status }); };
const positiveId = value => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const finiteText = (value,min,max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && value.length <= max;
const publicFields = 'u.id AS author_id,u.username,u.display_name,u.bio,u.avatar_symbol,u.accent,u.role';
const profileFields = 'id,username,display_name,bio,avatar_symbol,accent,role,created_at';
const postFields = `p.id,p.body,p.created_at,${publicFields},(SELECT COUNT(*)::int FROM biryeong_post_replies r WHERE r.post_id=p.id) AS reply_count`;
const memoFields = `m.id,m.title,m.body,m.created_at,${publicFields},(SELECT COUNT(*)::int FROM biryeong_memo_comments c WHERE c.memo_id=m.id) AS comment_count`;
const rateBuckets = new Map();
function rateLimit(key, max = 40, windowMs = 60000) {
  const now = Date.now();
  let slot = rateBuckets.get(key);
  if (!slot || slot.until < now) slot = { count:0, until:now + windowMs };
  if (++slot.count > max) fail(429,'too_many_requests');
  rateBuckets.set(key, slot);
  if (rateBuckets.size > 5000) for (const [k,v] of rateBuckets) if (v.until < now) rateBuckets.delete(k);
}
function json(res,status,data,headers={}) {
  res.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) fail(415,'json_required');
  let size=0, chunks=[];
  for await (const chunk of req) { size += chunk.length; if (size > 16000) fail(413,'payload_too_large'); chunks.push(chunk); }
  try { const data=JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!data || Array.isArray(data) || typeof data !== 'object') fail(400,'invalid_body'); return data; }
  catch(err) { if (err.status) throw err; fail(400,'invalid_json'); }
}
async function currentUser(req) {
  const cookie = parseCookie(req.headers.cookie);
  if (!cookie) return null;
  const result = await query(`SELECT ${profileFields} FROM biryeong_sessions s JOIN biryeong_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[tokenHash(cookie)]);
  return result.rows[0] || null;
}
function requireUser(user) { if (!user) fail(401,'login_required'); return user; }
function requireAdmin(user) { requireUser(user); if (!adminCanAudit(user)) fail(403,'forbidden'); }
function sameOrigin(req) {
  const origin=req.headers.origin;
  if (!origin) return true; // non-browser clients; JSON-only, SameSite cookies
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  try { return new URL(origin).origin === new URL(`${String(proto).split(',')[0]}://${String(host).split(',')[0]}`).origin; } catch { return false; }
}
const isSecure = req => Boolean(req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https');
async function startSession(user,res,req) {
  const token = newSessionToken();
  await query('INSERT INTO biryeong_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[tokenHash(token),user.id,new Date(Date.now()+SESSION_AGE_MS)]);
  return { headers:{'Set-Cookie':cookieHeader(token,isSecure(req))}, user };
}
function usernameOrFail(input) { const value=normalizeUsername(input); if (!validateUsername(value)) fail(400,'invalid_username'); return value; }
async function threadForRead(id,user,adminMode=false) {
  const result=await query('SELECT * FROM biryeong_dm_threads WHERE id=$1',[id]);
  const thread=result.rows[0];
  if (!thread) fail(404,'not_found');
  if (adminMode) requireAdmin(user);
  else if (!memberCanRead(thread,user)) fail(404,'not_found'); // nonmember cannot enumerate threads
  return thread;
}
export async function handleCommunity(req,res,url) {
  if (!url.pathname.startsWith('/api/community/')) return false;
  try {
    if (!pool) fail(503,'database_not_configured');
    const method=req.method;
    const path=url.pathname.replace(/\/$/,'');
    const clientIP=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
    if (method!=='GET') { if(!sameOrigin(req)) fail(403,'bad_origin'); rateLimit(`write:${clientIP}`); }
    let user;
    if (path==='/api/community/register' && method==='POST') {
      rateLimit(`register:${clientIP}`,8,3600000);
      const b=await readBody(req), username=usernameOrFail(b.username);
      if (username===normalizeUsername(process.env.BIRYEONG_ADMIN_USERNAME) && process.env.BIRYEONG_ADMIN_USERNAME) fail(409,'username_taken');
      if (!validatePassword(b.password)) fail(400,'invalid_password');
      if (!finiteText(b.displayName,1,40)) fail(400,'invalid_display_name');
      const passwordHash=await hashPassword(b.password);
      let created;
      try { created=await query(`INSERT INTO biryeong_users(username,password_hash,display_name) VALUES($1,$2,$3) RETURNING ${profileFields}`,[username,passwordHash,b.displayName.trim()]); }
      catch(err) { if(err.code==='23505') fail(409,'username_taken'); throw err; }
      const session=await startSession(created.rows[0],res,req); json(res,201,{user:session.user},session.headers); return true;
    }
    if (path==='/api/community/login' && method==='POST') {
      rateLimit(`login:${clientIP}`,12,15*60000);
      const b=await readBody(req), username=usernameOrFail(b.username);
      if(typeof b.password !== 'string' || b.password.length > 128) fail(401,'invalid_credentials');
      const account=(await query('SELECT * FROM biryeong_users WHERE username=$1',[username])).rows[0];
      if (!account || !(await verifyPassword(b.password,account.password_hash))) fail(401,'invalid_credentials');
      const { password_hash, ...safe }=account;
      const session=await startSession(safe,res,req);
      json(res,200,{user:session.user},session.headers); return true;
    }
    user=await currentUser(req);
    if (path==='/api/community/me' && method==='GET') {json(res,200,{user:user||null});return true;}
    if (path==='/api/community/logout' && method==='POST') {
      const token=parseCookie(req.headers.cookie);
      if(token) await query('DELETE FROM biryeong_sessions WHERE token_hash=$1',[tokenHash(token)]);
      json(res,200,{ok:true},{'Set-Cookie':cookieHeader('',isSecure(req),true)});return true;
    }
    requireUser(user);
    if (path==='/api/community/profile' && method==='PATCH') {
      const b=await readBody(req);
      if(!finiteText(b.displayName,1,40) || typeof b.bio!=='string' || b.bio.length>300 || !finiteText(b.avatarSymbol,1,8) || [...b.avatarSymbol].length>2 || !COLORS.includes(b.accent)) fail(400,'invalid_profile');
      const result=await query(`UPDATE biryeong_users SET display_name=$1,bio=$2,avatar_symbol=$3,accent=$4,updated_at=NOW() WHERE id=$5 RETURNING ${profileFields}`,[b.displayName.trim(),b.bio.trim(),b.avatarSymbol.trim(),b.accent,user.id]);
      json(res,200,{user:result.rows[0]});return true;
    }
    if (path==='/api/community/users' && method==='GET') {
      const search=String(url.searchParams.get('q') || '').trim().toLowerCase();
      if(search.length<1 || search.length>24) {json(res,200,{users:[]});return true;}
      const found=await query(`SELECT ${profileFields} FROM biryeong_users WHERE username LIKE $1 ESCAPE '\\' AND id <> $2 ORDER BY username LIMIT 12`,[`%${search.replace(/[\\%_]/g,'\\$&')}%`,user.id]);
      json(res,200,{users:found.rows});return true;
    }
    const profileMatch=path.match(/^\/api\/community\/users\/([a-z0-9_]{3,24})\/posts$/);
    if(profileMatch && method==='GET') {
      const result=await query(`SELECT ${profileFields} FROM biryeong_users WHERE username=$1`,[profileMatch[1]]);
      if(!result.rows[0]) fail(404,'not_found');
      const before=positiveId(url.searchParams.get('before'));
      const posts=await query(`SELECT ${postFields} FROM biryeong_posts p JOIN biryeong_users u ON u.id=p.author_id WHERE u.username=$1 AND ($2::bigint IS NULL OR p.id<$2) ORDER BY p.id DESC LIMIT 25`,[profileMatch[1],before]);
      json(res,200,{profile:result.rows[0],posts:posts.rows});return true;
    }
    if (path==='/api/community/posts' && method==='GET') {
      const before=positiveId(url.searchParams.get('before'));
      const posts=await query(`SELECT ${postFields} FROM biryeong_posts p JOIN biryeong_users u ON u.id=p.author_id WHERE ($1::bigint IS NULL OR p.id<$1) ORDER BY p.id DESC LIMIT 25`,[before]);
      json(res,200,{posts:posts.rows});return true;
    }
    if (path==='/api/community/posts' && method==='POST') {
      const b=await readBody(req);
      if(!finiteText(b.body,1,500)) fail(400,'invalid_post');
      const inserted=await query('INSERT INTO biryeong_posts(author_id,body) VALUES($1,$2) RETURNING id',[user.id,b.body.trim()]);
      json(res,201,{id:inserted.rows[0].id});return true;
    }
    const postReplyMatch=path.match(/^\/api\/community\/posts\/(\d+)\/replies$/);
    if(postReplyMatch){
      const postId=positiveId(postReplyMatch[1]);if(!postId)fail(400,'invalid_id');
      if(method==='GET'){
        const target=await query(`SELECT ${postFields} FROM biryeong_posts p JOIN biryeong_users u ON u.id=p.author_id WHERE p.id=$1`,[postId]);
        if(!target.rows.length)fail(404,'not_found');
        const replies=await query(`SELECT r.id,r.post_id,r.body,r.created_at,${publicFields} FROM biryeong_post_replies r JOIN biryeong_users u ON u.id=r.author_id WHERE r.post_id=$1 ORDER BY r.id ASC LIMIT 200`,[postId]);
        json(res,200,{post:target.rows[0],replies:replies.rows});return true;
      }
      if(method==='POST'){
        const b=await readBody(req);if(!finiteText(b.body,1,500))fail(400,'invalid_post');
        try{const result=await query('INSERT INTO biryeong_post_replies(post_id,author_id,body) VALUES($1,$2,$3) RETURNING id',[postId,user.id,b.body.trim()]);json(res,201,{id:result.rows[0].id});}
        catch(err){if(err.code==='23503')fail(404,'not_found');throw err;}
        return true;
      }
    }
    if (path==='/api/community/memos' && method==='GET') {
      const before=positiveId(url.searchParams.get('before'));
      const memos=await query(`SELECT ${memoFields} FROM biryeong_memos m JOIN biryeong_users u ON u.id=m.author_id WHERE ($1::bigint IS NULL OR m.id<$1) ORDER BY m.id DESC LIMIT 20`,[before]);
      json(res,200,{memos:memos.rows});return true;
    }
    if (path==='/api/community/memos' && method==='POST') {
      const b=await readBody(req);
      if(!finiteText(b.title,1,100) || !finiteText(b.body,1,3000)) fail(400,'invalid_memo');
      const result=await query('INSERT INTO biryeong_memos(author_id,title,body) VALUES($1,$2,$3) RETURNING id',[user.id,b.title.trim(),b.body.trim()]);
      json(res,201,{id:result.rows[0].id});return true;
    }
    const commentMatch=path.match(/^\/api\/community\/memos\/(\d+)\/comments$/);
    if (commentMatch) {
      const memoId=positiveId(commentMatch[1]);if(!memoId)fail(400,'invalid_id');
      if (method==='GET') {
        const memo=await query(`SELECT ${memoFields} FROM biryeong_memos m JOIN biryeong_users u ON u.id=m.author_id WHERE m.id=$1`,[memoId]);
        if(!memo.rows[0])fail(404,'not_found');
        const comments=await query(`SELECT c.id,c.memo_id,c.parent_id,c.body,c.created_at,${publicFields} FROM biryeong_memo_comments c JOIN biryeong_users u ON u.id=c.author_id WHERE c.memo_id=$1 ORDER BY c.id ASC LIMIT 300`,[memoId]);
        json(res,200,{memo:memo.rows[0],comments:comments.rows});return true;
      }
      if (method==='POST') {
        const b=await readBody(req);
        if(!finiteText(b.body,1,1200))fail(400,'invalid_comment');
        const parentId=b.parentId==null?null:positiveId(b.parentId);
        if(b.parentId!=null && !parentId)fail(400,'invalid_parent');
        if(parentId) {
          const found=await query('SELECT id FROM biryeong_memo_comments WHERE id=$1 AND memo_id=$2',[parentId,memoId]);
          if(!found.rows.length)fail(400,'invalid_parent');
        }
        try { const result=await query('INSERT INTO biryeong_memo_comments(memo_id,parent_id,author_id,body) VALUES($1,$2,$3,$4) RETURNING id',[memoId,parentId,user.id,b.body.trim()]);json(res,201,{id:result.rows[0].id}); }
        catch(err) {if(err.code==='23503')fail(404,'not_found');throw err;}
        return true;
      }
    }
    if(path==='/api/community/dm/threads' && method==='GET') {
      const threads=await query(`SELECT t.id,t.updated_at,CASE WHEN t.user_low_id=$1 THEN hi.username ELSE lo.username END AS other_username,
        CASE WHEN t.user_low_id=$1 THEN hi.display_name ELSE lo.display_name END AS other_display_name,
        CASE WHEN t.user_low_id=$1 THEN hi.avatar_symbol ELSE lo.avatar_symbol END AS other_avatar_symbol,
        CASE WHEN t.user_low_id=$1 THEN hi.accent ELSE lo.accent END AS other_accent,
        (SELECT body FROM biryeong_dm_messages msg WHERE msg.thread_id=t.id ORDER BY id DESC LIMIT 1) AS last_body
        FROM biryeong_dm_threads t
        JOIN biryeong_users lo ON lo.id=t.user_low_id JOIN biryeong_users hi ON hi.id=t.user_high_id
        WHERE t.user_low_id=$1 OR t.user_high_id=$1 ORDER BY t.updated_at DESC LIMIT 100`,[user.id]);
      json(res,200,{threads:threads.rows});return true;
    }
    if(path==='/api/community/dm/threads' && method==='POST') {
      const b=await readBody(req), other=usernameOrFail(b.username);
      const found=await query('SELECT id FROM biryeong_users WHERE username=$1',[other]);
      if(!found.rows.length)fail(404,'user_not_found');
      const otherId=found.rows[0].id;
      if(Number(otherId)===Number(user.id))fail(400,'cannot_message_self');
      const low=Math.min(Number(user.id),Number(otherId)),high=Math.max(Number(user.id),Number(otherId));
      const result=await query(`INSERT INTO biryeong_dm_threads(user_low_id,user_high_id) VALUES($1,$2) ON CONFLICT(user_low_id,user_high_id) DO UPDATE SET user_low_id=EXCLUDED.user_low_id RETURNING id`,[low,high]);
      json(res,200,{threadId:result.rows[0].id});return true;
    }
    const dmMatch=path.match(/^\/api\/community\/dm\/threads\/(\d+)\/messages$/);
    if(dmMatch) {
      const id=positiveId(dmMatch[1]);if(!id)fail(400,'invalid_id');
      await threadForRead(id,user);
      if(method==='GET') {
        const after=positiveId(url.searchParams.get('after'));
        const before=positiveId(url.searchParams.get('before'));
        if(after && before)fail(400,'invalid_cursor');
        const messages=after
          ? await query(`SELECT msg.id,msg.sender_id,msg.body,msg.created_at,u.username AS sender_username
              FROM biryeong_dm_messages msg JOIN biryeong_users u ON msg.sender_id=u.id
              WHERE msg.thread_id=$1 AND msg.id>$2 ORDER BY msg.id ASC LIMIT 50`,[id,after])
          : await query(`SELECT msg.id,msg.sender_id,msg.body,msg.created_at,u.username AS sender_username
              FROM biryeong_dm_messages msg JOIN biryeong_users u ON msg.sender_id=u.id
              WHERE msg.thread_id=$1 AND ($2::bigint IS NULL OR msg.id<$2) ORDER BY msg.id DESC LIMIT 50`,[id,before]);
        json(res,200,{messages:after?messages.rows:messages.rows.reverse()});return true;
      }
      if(method==='POST') {
        const b=await readBody(req);if(!finiteText(b.body,1,2000))fail(400,'invalid_dm');
        // Recheck membership within the write itself, not only before reading JSON.
        const client=await pool.connect();
        try { await client.query('BEGIN');
          const inserted=await client.query(`INSERT INTO biryeong_dm_messages(thread_id,sender_id,body)
            SELECT id,$2,$3 FROM biryeong_dm_threads WHERE id=$1 AND (user_low_id=$2 OR user_high_id=$2) RETURNING id`,[id,user.id,b.body.trim()]);
          if(!inserted.rows.length) {await client.query('ROLLBACK');fail(404,'not_found');}
          await client.query('UPDATE biryeong_dm_threads SET updated_at=NOW() WHERE id=$1',[id]);
          await client.query('COMMIT'); json(res,201,{id:inserted.rows[0].id});
        } catch(err) {await client.query('ROLLBACK').catch(()=>{});throw err;} finally {client.release();}
        return true;
      }
    }
    if(path==='/api/community/admin/dm/threads' && method==='GET') {
      requireAdmin(user);
      const threads=await query(`SELECT t.id,t.updated_at,lo.username AS user_low,hi.username AS user_high,
        (SELECT COUNT(*)::int FROM biryeong_dm_messages m WHERE m.thread_id=t.id) AS message_count
        FROM biryeong_dm_threads t JOIN biryeong_users lo ON lo.id=t.user_low_id JOIN biryeong_users hi ON hi.id=t.user_high_id ORDER BY t.updated_at DESC LIMIT 100`);
      json(res,200,{threads:threads.rows});return true;
    }
    const adminMatch=path.match(/^\/api\/community\/admin\/dm\/threads\/(\d+)\/messages$/);
    if(adminMatch && method==='GET') {
      requireAdmin(user);
      const id=positiveId(adminMatch[1]);if(!id)fail(400,'invalid_id');
      await threadForRead(id,user,true);
      await query('INSERT INTO biryeong_admin_dm_audit(admin_id,thread_id) VALUES($1,$2)',[user.id,id]);
      const before=positiveId(url.searchParams.get('before'));
      const messages=await query(`SELECT msg.id,msg.body,msg.created_at,msg.sender_id,u.username AS sender_username
      FROM biryeong_dm_messages msg JOIN biryeong_users u ON u.id=msg.sender_id
      WHERE msg.thread_id=$1 AND ($2::bigint IS NULL OR msg.id<$2) ORDER BY msg.id DESC LIMIT 50`,[id,before]);
      json(res,200,{messages:messages.rows.reverse(),readOnly:true});return true;
    }
    fail(404,'not_found');
  } catch(err) {
    if(err?.status && err.status<500) json(res,err.status,{error:err.message});
    else if(err?.status===503) json(res,503,{error:'database_not_configured'});
    else { console.error('[biryeong community]',err);json(res,500,{error:'internal_error'}); }
  }
  return true;
}
