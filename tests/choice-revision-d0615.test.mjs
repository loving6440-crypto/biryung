import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const sql=readFileSync(join(root,'supabase/story_choice_revision_D.06.15.sql'),'utf8');
const quest=readFileSync(join(root,'quest.js'),'utf8');
const code=readFileSync(join(root,'sync.js'),'utf8');
function instance(handler){
 const calls=[];const ctx={window:{BIRYEONG_CONFIG:{supabaseUrl:'https://test.supabase.co',supabaseAnonKey:'sb_publishable_test'},BiryeongAuth:{session:()=> 'account',token:()=> 'token'}},localStorage:{getItem:()=>null,setItem:()=>{}},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000000'},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>handler(url,JSON.parse(options.body||'{}'))}},console};
 runInNewContext(code,ctx);return {api:ctx.window.BiryeongSync,calls};
}
test('기존 표 조회와 한번의 수정은 서버 인증 토큰 RPC를 사용한다',async()=>{
 const {api,calls}=instance((url)=>url.endsWith('mine')?[{branch:'C1-1',option:2,edit_count:0}]:{ok:true,option:3,edit_count:1});
 const mine=await api.myChoices();assert.equal(mine.length,1);
 const change=await api.editChoice('C1-1',3);assert.equal(change.edit_count,1);
 assert.match(calls[0].url,/rpc\/bry_story_choice_mine$/);
 assert.match(calls[1].url,/rpc\/bry_story_choice_edit$/);
 assert.equal(JSON.parse(calls[1].options.body).p_option,3);
});
test('선택 수정 1회는 DB row lock과 edit_count로 보장되며 동일행을 갱신한다',()=>{
 assert.match(sql,/for update/i);assert.match(sql,/c\.edit_count >= 1/);
 assert.match(sql,/set option=p_option, edit_count=1/);
 assert.doesNotMatch(sql,/delete from public\.story_choices/i);
 assert.match(sql,/revoke insert, update, delete on public\.story_choices/);
});
test('과거 서버 저장본 두 종류를 읽고 기존 표는 보존한다',()=>{
 assert.match(sql,/biryeong_private\.saves/); assert.match(sql,/public\.cloud_saves/);
 assert.match(sql,/\{story,sent\}/);assert.match(sql,/\{story,q,flags\}/);
 assert.match(sql,/on conflict do nothing/g);
});
test('이전 전송값이 서버 선택을 다시 덮지 않으며 수정 UI가 제공된다',()=>{
 assert.match(quest,/st\.choiceServer\?\.\[id\]/);
 assert.match(quest,/await reconcileServerChoices\(\)/);
 assert.match(quest,/선택 수정 \(1회\)/);
 assert.match(quest,/await sync\.editChoice\(id,i\+1\)/);
 assert.match(quest,/이전 선택표/);
});
