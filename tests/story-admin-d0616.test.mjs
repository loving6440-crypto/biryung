import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const q=fs.readFileSync('quest.js','utf8'), s=fs.readFileSync('sync.js','utf8'),sql=fs.readFileSync('supabase/story_admin_repair_D.06.16.sql','utf8');
test('스토리 업로드와 공개는 서버 확인 후 로컬 반영',()=>{
 assert.match(q,/if \(server\) \{ const r = await sync\.adminSet\([\s\S]*?if \(!r\?\.ok\)/);
 assert.match(q,/if \(!r\?\.ok\)[^\n]*return; \} \}\n\s*const all = localStore\(\);/);
});
test('실패 RPC는 에러 코드와 함수명 표시',()=>{
 assert.match(s,/PGRST202/);assert.match(s,/D\.06\.16 관리자 스토리 SQL/);
 assert.match(q,/서버 목록 조회 실패/);
});
test('스토리 SQL은 기존 데이터 제거 없이 RPC 복구 및 권한 처리',()=>{
 for (const name of ['story_admin_ok','story_admin_list','story_admin_set','story_admin_routes','story_admin_route','story_admin_names']) assert.match(sql,new RegExp('function public\\.'+name+'\\('));
 assert.doesNotMatch(sql,/\b(truncate|drop table|delete from public\.story)/i);
 assert.match(sql,/notify pgrst, 'reload schema'/);
});
