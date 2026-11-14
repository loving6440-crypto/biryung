/* 秘靈 · 비령 — 서버 연결(Supabase). 지금은 "연결만 하면 되는" 준비 상태다.
 *
 * 켜는 법: config.js 의 supabaseUrl · supabaseAnonKey 를 채운다(Supabase 프로젝트 › Settings › API).
 *          그 전에 supabase/schema.sql 을 SQL Editor 에서 한 번 실행한다. 자세한 순서는 supabase/README.md.
 * 비어 있으면 아무것도 보내지 않고(enabled = false), 게임은 이 브라우저의 값만으로 돈다.
 *
 * 올리는 것  choice(분기, 고른 번호)   — 본편의 주요 선택(B1-1 … B15-2). 한 사람당 분기마다 한 줄(다시 고르면 덮어쓴다)
 *            contrib(사건, 양)         — 공동 사건 기여(B7-2 쌍응수 · erased-map 지워진 지도 · B12-1 신격 레이드 · final 오방 결전)
 *            progress(끝낸 장면 수)    — 진행도
 *            saveCloud(기록)           — 기록 전체 백업(다른 기기에서 이어 하기용)
 * 읽는 것    tally()                   — 분기별 선택 집계(세계 탭)   contribTotals() — 사건별 합계   loadCloud()
 *
 * 누구인지: 계정마다 무작위 player_id(uuid)를 하나 만들어 이 브라우저에 둔다(biryeong-sync-id:<아이디>).
 * 정식 로그인(Supabase Auth)으로 바꿀 때는 playerId() 만 auth.uid() 로 바꾸고 schema.sql 의 정책을 좁히면 된다.
 */
(() => {
  'use strict';
  const C = Object.assign({ supabaseUrl: '', supabaseAnonKey: '' }, window.BIRYEONG_CONFIG);
  const Auth = window.BiryeongAuth;
  const enabled = !!(C.supabaseUrl && C.supabaseAnonKey);
  const base = `${String(C.supabaseUrl).replace(/\/$/, '')}/rest/v1`;
  const account = () => Auth?.session?.() || 'guest';
  function playerId() {
    const key = `biryeong-sync-id:${account()}`;
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)); localStorage.setItem(key, id); }
      return id;
    } catch (_) { return '00000000-0000-4000-8000-000000000000'; }
  }
  async function call(path, { method = 'GET', body, prefer } = {}) {
    if (!enabled) return null;
    const res = await fetch(`${base}/${path}`, {
      method, headers: { apikey: C.supabaseAnonKey, Authorization: `Bearer ${C.supabaseAnonKey}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    return res.status === 204 || method !== 'GET' ? null : res.json();
  }
  const quiet = (p) => p.catch((error) => { console.warn('[비령] 서버 전송 실패(게임은 계속된다)', error.message); return null; });
  const upsert = (table, row, onConflict) => quiet(call(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' }));
  const now = () => new Date().toISOString();

  window.BiryeongSync = {
    enabled, playerId,
    choice: (branch, option) => (enabled ? upsert('story_choices', { player_id: playerId(), account: account(), branch, option, updated_at: now() }, 'player_id,branch') : null),
    contrib: (event, amount = 1) => (enabled ? quiet(call('story_contrib', { method: 'POST', body: { player_id: playerId(), account: account(), event, amount }, prefer: 'return=minimal' })) : null),
    progress: (scenes) => (enabled ? upsert('story_progress', { player_id: playerId(), account: account(), scenes, updated_at: now() }, 'player_id') : null),
    saveCloud: (data) => (enabled ? upsert('cloud_saves', { player_id: playerId(), account: account(), data, updated_at: now() }, 'player_id') : null),
    loadCloud: async () => { if (!enabled) return null; const rows = await call(`cloud_saves?player_id=eq.${playerId()}&select=data,updated_at`); return rows?.[0] ?? null; },
    tally: async () => (enabled ? call('story_tally?select=branch,option,votes') : []),
    contribTotals: async () => (enabled ? call('story_contrib_totals?select=event,total,players') : []),
  };
})();
