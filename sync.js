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
    if (!res.ok) {
      let detail = null;
      try { detail = await res.json(); } catch (_) { /* non-json error */ }
      const missing = res.status === 404 && (detail?.code === 'PGRST202' || /Could not find the function/i.test(detail?.message || ''));
      throw new Error(missing ? `서버 RPC가 없습니다 (${path}). D.06.16 관리자 스토리 SQL을 적용하고 API 스키마를 새로고침하세요.` :
        `${detail?.message || `supabase ${res.status}`} (${detail?.code || res.status}; ${path})`);
    }
    return res.status === 204 || (method !== 'GET' && !read) ? null : res.json();
  }
  const quiet = (p) => p.catch((error) => { console.warn('[비령] 서버 전송 실패(게임은 계속된다)', error.message); return null; });
  const token = () => Auth?.token?.() || null;
  const authenticated = (name, args) => token() ? quiet(call(`rpc/${name}`, { method:'POST', body: { p_token: token(), ...args }, read:true })) : Promise.resolve(null);
  const now = () => new Date().toISOString();

  let chapterMem = null; // 받아 둔 장 본문(이 화면에서)
  window.BiryeongSync = {
    enabled, playerId,
    // 최초 1회만: 이미 올린 분기는 다시 보내도 서버가 처음 표를 지킨다(ignore-duplicates · 계정당 첫 표만 남기는 서버 규칙)
    // 투표 전송은 실패를 삼키지 않는다. 성공한 RPC 응답만 전송 확정으로 취급한다.
    choice: async (branch, option) => {
      if (!enabled || !token()) throw new Error('선택 집계 서버 또는 로그인 연결이 없습니다.');
      const result = await call('rpc/bry_story_choice', { method:'POST', body:{ p_token:token(), p_branch:branch, p_option:option }, read:true });
      if (!result || result.ok !== true) throw new Error(result?.error || '선택 집계 서버가 등록을 확인하지 않았습니다.');
      return result;
    },
    myChoices: async () => {
      if (!enabled || !token()) throw new Error('로그인이 필요합니다.');
      const rows = await call('rpc/bry_story_choice_mine', { method:'POST', body:{ p_token:token() }, read:true });
      if (!Array.isArray(rows)) throw new Error('선택 내역을 읽지 못했습니다.');
      return rows;
    },
    editChoice: async (branch, option) => {
      if (!enabled || !token()) throw new Error('로그인이 필요합니다.');
      const result = await call('rpc/bry_story_choice_edit', { method:'POST', body:{ p_token:token(), p_branch:branch, p_option:option }, read:true });
      if (!result?.ok) throw new Error(result?.error || '선택 수정에 실패했습니다.');
      return result;
    },
    contrib: (event, amount = 1) => (enabled ? authenticated('bry_story_contrib', { p_event: event, p_amount: amount }) : null),
    progress: (scenes) => (enabled ? authenticated('bry_story_progress', { p_scenes: scenes }) : null),
    tally: async () => (enabled ? call('story_tally?select=branch,option,votes') : []),
    // v1.8 본편 장 공개: 공개된 장만 서버가 내준다(행 수준 보안). 관리자 쓰기는 관리자 코드를 받는 함수(RPC)로만.
    // vC.01 부하 줄이기: 먼저 「장 번호 · 고친 시각」만 묻고(수백 바이트), 바뀐 장의 본문만 받아 이 브라우저에 넣어 둔다.
    //   (예전에는 1분마다 모든 장의 본문을 통째로 받았다 — 사람이 많으면 전송량 한도를 금방 넘긴다.)
    openChapters: async () => {
      if (!enabled) return [];
      const KEY = 'biryeong-chapter-cache-v1';
      let cache = chapterMem; if (!cache) { try { cache = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { cache = {}; } }
      const heads = await call('story_chapters?select=ch,updated_at&order=ch') || [];
      const need = heads.filter((h) => cache[h.ch]?.at !== h.updated_at).map((h) => h.ch);
      if (need.length) (await call(`story_chapters?select=ch,title,content,updated_at&ch=in.(${need.join(',')})`) || []).forEach((r) => { cache[r.ch] = { at: r.updated_at, title: r.title, content: r.content }; });
      const open = new Set(heads.map((h) => String(h.ch)));
      let dropped = false; Object.keys(cache).forEach((k) => { if (!open.has(String(k))) { delete cache[k]; dropped = true; } }); // 닫힌 장은 지운다
      chapterMem = cache;
      if (need.length || dropped) { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) { /* 자리가 없으면 이번 화면에서만 기억한다 */ } }
      return heads.filter((h) => cache[h.ch]).map((h) => ({ ch: h.ch, title: cache[h.ch].title, content: cache[h.ch].content }));
    },
    adminList: async (code) => { if (!enabled) return []; try { return await call('rpc/story_admin_list', { method: 'POST', body: { p_code: code }, read: true }); } catch (e) { return { error: e.message }; } },
    adminSet: async (code, ch, title, content, openAt, mode) => { if (!enabled) return null; try { await call('rpc/story_admin_set', { method: 'POST', body: { p_code: code, p_ch: ch, p_title: title, p_content: content, p_open_at: openAt, p_mode: mode } }); return { ok: true }; } catch (e) { return { error: e.message }; } },
    openRoutes: async () => (enabled ? call('story_routes?select=flag,option') : []),
    adminRoutes: async (code) => { if (!enabled) return []; try { return await call('rpc/story_admin_routes', { method: 'POST', body: { p_code: code }, read: true }); } catch (e) { return { error: e.message }; } },
    adminRoute: async (code, flag, option, openAt) => { if (!enabled) return null; try { await call('rpc/story_admin_route', { method: 'POST', body: { p_code: code, p_flag: flag, p_option: option, p_open_at: openAt } }); return { ok: true }; } catch (e) { return { error: e.message }; } },
    adminNames: async (code) => { if (!enabled) return []; try { return await call('rpc/story_admin_names', { method: 'POST', body: { p_code: code }, read: true }); } catch (_) { return []; } },
    adminChoices: async (code) => (enabled ? call('rpc/story_admin_choices', { method:'POST', body:{ p_code:code }, read:true }) : []),
    contribTotals: async () => (enabled ? call('story_contrib_totals?select=event,total,players') : []),
  };
})();
