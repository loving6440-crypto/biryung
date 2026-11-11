import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeUsername,validateUsername,validatePassword,hashPassword,verifyPassword,
 newSessionToken,tokenHash,parseCookie,cookieHeader,memberCanRead,adminCanAudit,COLORS
} from '../server/auth.mjs';

test('회원명 검증과 정규화',()=>{
 assert.equal(normalizeUsername('  Bird_12  '),'bird_12');
 assert.ok(validateUsername('bird_12'));
 for(const name of ['xy','hyphen-a','한글','admin space','a'.repeat(25)])assert.equal(validateUsername(name),false);
 assert.ok(validatePassword('strong_password'));
 assert.equal(validatePassword('short'),false);
});
test('비밀번호 해시·검증, 세션 토큰 검증',async()=>{
 const hash=await hashPassword('Super_Strong_Password#1');
 assert.ok(hash.startsWith('scrypt:'));assert.ok(!hash.includes('Super_Strong_Password'));
 assert.equal(await verifyPassword('Super_Strong_Password#1',hash),true);
 assert.equal(await verifyPassword('wrong_password',hash),false);
 const token=newSessionToken();assert.equal(token.length,43);
 assert.equal(tokenHash(token).length,64);
 assert.equal(parseCookie(`other=y; biryeong_sid=${token}; a=b`),token);
 assert.match(cookieHeader(token,true),/HttpOnly; SameSite=Lax/);
 assert.match(cookieHeader(token,true),/; Secure/);
});
test('일반인은 DM 당사자 대화만 읽을 수 있고, 운영자 전용 별도 감사 권한은 명시적 역할 검사',()=>{
 const thread={user_low_id:4,user_high_id:9};
 assert.equal(memberCanRead(thread,{id:4}),true);
 assert.equal(memberCanRead(thread,{id:9}),true);
 assert.equal(memberCanRead(thread,{id:10}),false);
 assert.equal(memberCanRead(thread,null),false);
 assert.equal(adminCanAudit({id:10,role:'member'}),false);
 assert.equal(adminCanAudit({id:10,role:'admin'}),true);
 assert.ok(COLORS.length>=5);
});
