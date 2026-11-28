import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientIp, isHttps, permittedOrigin, limit, enter } from '../server/security.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const req = (headers={}, address='127.0.0.1') => ({headers,socket:{remoteAddress:address}});

test('Proxy headers are not trusted without explicit opt-in', () => {
  const old=process.env.TRUST_PROXY;
  try {
    delete process.env.TRUST_PROXY;
    assert.equal(clientIp(req({'x-forwarded-for':'10.1.1.1, 203.0.113.9'},'127.0.0.1')),'127.0.0.1');
    process.env.TRUST_PROXY='1';
    assert.equal(clientIp(req({'x-forwarded-for':'10.1.1.1, 203.0.113.9'},'127.0.0.1')),'203.0.113.9');
    assert.equal(isHttps(req({'x-forwarded-proto':'http, https'})),true);
    assert.equal(permittedOrigin(req({origin:'https://site.example',host:'site.example','x-forwarded-proto':'https'})),true);
    assert.equal(permittedOrigin(req({origin:'https://evil.example',host:'site.example','x-forwarded-proto':'https'})),false);
  } finally { if(old===undefined)delete process.env.TRUST_PROXY;else process.env.TRUST_PROXY=old; }
});

test('In-memory limiter and concurrent request caps enforce ceilings', () => {
  const unique='security-test-'+Date.now();
  assert.equal(limit(unique,2,60_000),true);
  assert.equal(limit(unique,2,60_000),true);
  assert.equal(limit(unique,2,60_000),false);
  const left=enter(unique,1);
  assert.equal(typeof left,'function');
  assert.equal(enter(unique,1),null);
  left(); left();
  assert.equal(typeof enter(unique,1),'function');
});

test('Sensitive direct Supabase table writes are revoked in migration and browser uses credentialed RPC',()=>{
  const patch=read('supabase/old/security_patch_D.06.6.sql');
  const sync=read('sync.js');
  assert.match(patch,/revoke all on table public\.story_choices, public\.story_contrib, public\.story_progress, public\.cloud_saves/);
  assert.match(patch,/story_choice_once_account_branch/);
  assert.match(patch,/security_invoker = off/);
  assert.match(patch,/function public\.bry_story_choice\(p_token text/);
  assert.match(patch,/function public\.story_admin_choices\(p_code text/);
  assert.match(patch,/limit 100/);
  assert.match(sync,/call\('rpc\/bry_story_choice'/);
  assert.match(sync,/authenticated\('bry_story_progress'/);
  assert.match(sync,/authenticated\('bry_story_contrib'/);
  assert.doesNotMatch(sync,/call\('story_choices\?/);
  assert.doesNotMatch(sync,/call\('story_contrib'/);
});

test('Static site has CSP, no public default admin code hash and includes all top-level assets',()=>{
  const html=read('index.html');
  const config=read('config.js');
  const server=read('server/index.mjs');
  assert.match(html,/http-equiv="Content-Security-Policy"/);
  assert.match(html,/src="theme-boot\.js/);
  assert.match(config,/adminCodeHash: ''/);
  assert.match(server,/theme-light\.css/);
  assert.match(server,/beast-event\.js/);
  assert.match(server,/createReadStream/);
  assert.match(read('.github/workflows/pages.yml'),/비브라우저에|브라우저에 관리자 코드 해시를 배포하지 않습니다/);
});
