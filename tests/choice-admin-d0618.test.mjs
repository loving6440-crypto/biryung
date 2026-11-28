import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const load = f => readFileSync(new URL(f,root),'utf8');
const sql=load('supabase/old/story_choice_admin_cleanup_D.06.18.sql');
const q=load('quest.js'), sync=load('sync.js');
test('탈퇴 계정은 집계와 관리자 명단에서 모두 제외되고 삭제 트리거가 존재한다',()=>{
 assert.match(sql,/join biryeong_private\.accounts a on a\.username = c\.account/i);
 assert.match(sql,/after delete on biryeong_private\.accounts/i);
 assert.match(sql,/from public\.story_choices v join biryeong_private\.accounts/i);
});
test('관리자 삭제는 서버 인증된 RPC만 호출하고 중복 재동기화가 투표를 복구하지 못한다',()=>{
 assert.match(sql,/story_admin_ok\(p_code\)/);
 assert.match(sql,/story_choice_exclusions/);
 assert.match(sql,/removed_by_admin/);
 assert.match(sync,/adminDeleteChoice:/);
 assert.match(q,/await sync\.adminDeleteChoice\(adminCode\(\), r\.account, id\)/);
 assert.match(q,/선택 기록 새로고침/);
});
test('관리자 스토리와 모두의 선택이 별도의 로컬 가짜 기록을 섞지 않는다',()=>{
 assert.match(q,/sync\.adminChoices\(adminCode\(\)\)/);
 assert.match(q,/서버 선택 기록을 읽지 못했다/);
 assert.match(sync,/story_tally\?select=branch,option,votes/);
});
