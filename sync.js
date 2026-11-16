/* 秘靈 · 비령 — 서버 연결(Supabase). 지금은 "연결만 하면 되는" 준비 상태다.
 *
 * 켜는 법: GitHub 저장소 Variables 에 SUPABASE_URL · SUPABASE_KEY 를 넣으면 배포 때 config.js 에 들어간다(직접 config.js 를 채워도 된다).
 *          키는 Supabase › Project Settings › API Keys 의 Publishable key(sb_publishable_…) 또는 Legacy 의 anon 키(eyJ…).
 *          그 전에 supabase/schema.sql 을 SQL Editor 에서 한 번 실행한다. 자세한 순서는 supabase/README.md.
 * 비어 있으면 아무것도 보내지 않고(enabled = false), 게임은 이 브라우저의 값만으로 돈다.
 *
 * 올리는 것  choice(분기, 고른 번호)   — 본편의 주요 선택(B1-1 … B15-2). 한 계정당 분기마다 처음 고른 한 줄만(다시 골라도 바뀌지 않는다)
 *            contrib(사건, 양)         — 공동 사건 기여(B7-2 쌍응수 · erased-map 지워진 지도 · B12-1 신격 레이드 · final 오방 결전)
 *            progress(끝낸 장면 수)    — 진행도
 * 읽는 것    tally()                   — 분기별 선택 집계(세계 탭)   contribTotals() — 사건별 합계
 * 계정 · 기록 · 소통 공간 · 관리자 도구는 auth.js(로그인 · 기록) · community.js · server.js 가 bry_* 함수로 다룬다.
 *
 * 누구인지: 계정마다 무작위 player_id(uuid)를 하나 만들어 이 브라우저에 둔다(biryeong-sync-id:<아이디>).
 * 정식 로그인(Supabase Auth)으로 바꿀 때는 playerId() 만 auth.uid() 로 바꾸고 schema.sql 의 정책을 좁히면 된다.
 */
(() => {
  'use strict';
  const C = Object.assign({ supabaseUrl: '', supabaseAnonKey: '' }, window.BIRYEONG_CONFIG);
  const Auth = window.BiryeongAuth;
  const enabled = !!(C.supabaseUrl && C.supabaseAnonKey);
  const base = `${String(C.supabaseUrl).trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '')}/rest/v1`;
  // 새 키(sb_publishable_…)는 JWT 가 아니라 Authorization 에 넣으면 거절된다 — 옛 anon 키(eyJ…)일 때만 함께 보낸다.
  const jwtKey = /^eyJ/.test(String(C.supabaseAnonKey));
  const account = () => Auth?.session?.() || 'guest';
  function playerId() {
    const key = `biryeong-sync-id:${account()}`;
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)); localStorage.setItem(key, id); }
      return id;
    } catch (_) { return '00000000-0000-4000-8000-000000000000'; }
  }
  async function call(path, { method = 'GET', body, prefer, read } = {}) {
    if (!enabled) return null;
    const res = await fetch(`${base}/${path}`, {
      method, headers: { apikey: C.supabaseAnonKey, ...(jwtKey ? { Authorization: `Bearer ${C.supabaseAnonKey}` } : {}), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    return res.status === 204 || (method !== 'GET' && !read) ? null : res.json();
  }
  const quiet = (p) => p.catch((error) => { console.warn('[비령] 서버 전송 실패(게임은 계속된다)', error.message); return null; });
  const upsert = (table, row, onConflict) => quiet(call(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' }));
  const now = () => new Date().toISOString();

  window.BiryeongSync = {
    enabled, playerId,
    // 최초 1회만: 이미 올린 분기는 다시 보내도 서버가 처음 표를 지킨다(ignore-duplicates · 계정당 첫 표만 남기는 서버 규칙)
    choice: (branch, option) => (enabled ? quiet(call(`story_choices?on_conflict=player_id,branch`, { method: 'POST', body: { player_id: playerId(), account: account(), branch, option, updated_at: now() }, prefer: 'resolution=ignore-duplicates,return=minimal' })) : null),
    contrib: (event, amount = 1) => (enabled ? quiet(call('story_contrib', { method: 'POST', body: { player_id: playerId(), account: account(), event, amount }, prefer: 'return=minimal' })) : null),
    progress: (scenes) => (enabled ? upsert('story_progress', { player_id: playerId(), account: account(), scenes, updated_at: now() }, 'player_id') : null),
    tally: async () => (enabled ? call('story_tally?select=branch,option,votes') : []),
    // v1.8 본편 장 공개: 공개된 장만 서버가 내준다(행 수준 보안). 관리자 쓰기는 관리자 코드를 받는 함수(RPC)로만.
    openChapters: async () => (enabled ? call('story_chapters?select=ch,title,content&order=ch') : []),
    adminList: async (code) => { if (!enabled) return []; try { return await call('rpc/story_admin_list', { method: 'POST', body: { p_code: code }, read: true }); } catch (e) { return { error: e.message }; } },
    adminSet: async (code, ch, title, content, openAt, mode) => { if (!enabled) return null; try { await call('rpc/story_admin_set', { method: 'POST', body: { p_code: code, p_ch: ch, p_title: title, p_content: content, p_open_at: openAt, p_mode: mode } }); return { ok: true }; } catch (e) { return { error: e.message }; } },
    openRoutes: async () => (enabled ? call('story_routes?select=flag,option') : []),
    adminRoutes: async (code) => { if (!enabled) return []; try { return await call('rpc/story_admin_routes', { method: 'POST', body: { p_code: code }, read: true }); } catch (e) { return { error: e.message }; } },
    adminRoute: async (code, flag, option, openAt) => { if (!enabled) return null; try { await call('rpc/story_admin_route', { method: 'POST', body: { p_code: code, p_flag: flag, p_option: option, p_open_at: openAt } }); return { ok: true }; } catch (e) { return { error: e.message }; } },
    adminChoices: async () => (enabled ? call('story_choices?select=account,branch,option,updated_at,player_id&order=updated_at.desc') : []),
    contribTotals: async () => (enabled ? call('story_contrib_totals?select=event,total,players') : []),
  };
})();
