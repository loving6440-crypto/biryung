import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const js=readFileSync(join(root,'sync.js'),'utf8');
function makeSync({ status=200, payload={ok:true}, token='token-1', enabled=true }={}) {
  const requests=[];
  const context={window:{BIRYEONG_CONFIG:{supabaseUrl:enabled?'https://example.supabase.co':'',supabaseAnonKey:enabled?'sb_publishable_demo':''},BiryeongAuth:{session:()=> 'player', token:()=>token}},localStorage:{getItem:()=>null,setItem:()=>{}},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},fetch:async(url,opts)=>{requests.push({url,opts});return {ok:status===200,status,json:async()=>payload}},console};
  runInNewContext(js,context);
  return {sync:context.window.BiryeongSync,requests};
}
test('선택 집계 RPC 성공 응답만 등록 완료로 인정한다',async()=>{
  const {sync,requests}=makeSync();
  const r=await sync.choice('C2-3',2);
  assert.equal(r.ok,true);assert.match(requests[0].url,/rpc\/bry_story_choice$/);
  assert.equal(JSON.parse(requests[0].opts.body).p_option,2);
});
test('서버 오류/로그인 없음/거짓 응답은 숨기지 않고 재시도 가능한 실패로 처리한다',async()=>{
  await assert.rejects(makeSync({status:401}).sync.choice('C2-3',1));
  await assert.rejects(makeSync({payload:{ok:false,error:'denied'}}).sync.choice('C2-3',1));
  const noToken=makeSync({token:''});await assert.rejects(noToken.sync.choice('C2-3',1));assert.equal(noToken.requests.length,0);
});
test('도감 선택표 화면은 이전 보낸 표를 재검증하며 수동 새로고침과 오류 표시가 있다',()=>{
  const q=readFileSync(join(root,'quest.js'),'utf8');
  assert.match(q,/choiceConfirmed/);assert.match(q,/st\.sent\[id\] \?\? q\.flags\[id\]/);
  assert.match(q,/syncSavedChoices\(\)/);assert.match(q,/선택 집계 새로고침/);
  assert.match(q,/선택 집계를 읽지 못했다/);
  assert.doesNotMatch(q,/cs\.sent\[ln\.id\] = n; Sync\(\)\?\.choice/);
});
