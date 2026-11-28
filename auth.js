/* 秘靈 · 비령 — 로그인. 서버가 붙기 전까지 계정과 기록은 '이 브라우저'에만 보관한다.
 *
 *   biryeong-accounts-v1      { users: { <아이디>: { id, salt, hash, createdAt, admin? } } }   (비밀번호는 소금을 친 SHA-256 으로만 남긴다)
 *   biryeong-session-v1       지금 로그인한 아이디
 *   biryeong-save-v1:<아이디>  그 계정의 기록(프로필 · 진행). 예전 판의 기록(biryeong-save-v1)은 처음 만든 계정이 이어받는다.
 *
 * 로그인 화면: 로고 자리의 갈무리9 '비령' 글자를 다섯 번 누르면 관리자 코드 칸이 나온다.
 *   관리자 코드 확인 — 서버의 관리자 코드 검증 API / Supabase RPC에서만 수행. 공개 정적 해시는 사용하지 않는다.
 *
 * window.BiryeongAuth = { session(), saveKey(), isAdmin(), logout(), list(), resetPassword(id, pw), remove(id), setAdmin(id, on) }
 * 나중에 서버 로그인으로 바꿀 때는 이 파일의 register · login · verifyAdminCode 만 서버 호출로 바꾸면 된다.
 */
(() => {
  'use strict';
  const ACC_KEY = 'biryeong-accounts-v1', SES_KEY = 'biryeong-session-v1', SAVE_BASE = 'biryeong-save-v1';
  const CONFIG = Object.assign({ api: '', sameOrigin: false, adminCodeHash: '', supabaseUrl: '', supabaseAnonKey: '' }, window.BIRYEONG_CONFIG);
  /* v1.9 서버(Supabase)가 연결되면 계정 · 기록이 서버에 있다. 이 브라우저에는 그림자 계정(로그인 유지용)과 서버 표(token)만 둔다. */
  // 주소는 https://xxxx.supabase.co 까지만 쓴다 — 뒤에 /rest/v1/ 이 붙어 들어와도 떼어 낸다.
  CONFIG.supabaseUrl = String(CONFIG.supabaseUrl || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');
  CONFIG.supabaseAnonKey = String(CONFIG.supabaseAnonKey || '').trim();
  const SERVER = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  const TOKEN_KEY = (id) => `biryeong-token:${id}`, CLOUD_KEY = (id) => `biryeong-cloud:${id}`, PENDING_KEY = (id) => `biryeong-save-pending:${id}`;
  const ERR = {
    network: '비령 서버에 닿지 못했습니다. 잠시 뒤 다시 해 주세요.', schema_missing: '서버에 비령의 함수가 아직 없습니다. Supabase SQL Editor 에서 schema.sql 을 끝까지 실행했는지(맨 아래에 Success 가 떴는지) 확인해 주세요.',
    bad_url: '서버 주소가 맞지 않습니다. GitHub 의 SUPABASE_URL 은 https://xxxx.supabase.co 까지만 넣어 주세요.', bad_key: '서버 키가 맞지 않습니다. GitHub 의 SUPABASE_KEY 에 Publishable key(sb_publishable_…)를 넣었는지 확인해 주세요.', not_exposed: 'Supabase 의 Data API 가 public 스키마를 내보내지 않고 있습니다. Integrations › Data API › Settings 의 Exposed schemas 에 public 을 넣어 주세요.',
    login_required: '다시 로그인해 주세요.', banned: '이 계정은 정지되어 있습니다.', muted: '지금은 글을 남길 수 없습니다(운영자 조치).', forbidden: '권한이 없습니다.',
    invalid_username: '아이디는 2~16자(한글 · 영문 · 숫자 · _)로 적어 주세요.', invalid_password: '비밀번호는 4자 이상으로 적어 주세요.', username_taken: '이미 명부에 있는 아이디입니다.',
    invalid_credentials: '아이디 또는 비밀번호가 맞지 않습니다.', no_reset: '임시 비밀번호로 들어온 계정이 아닙니다. 다시 로그인해 주세요.', user_not_found: '해당 계정을 찾을 수 없습니다.', too_many_requests: '요청이 너무 많습니다. 잠시 뒤 다시 해 주세요.',
    invalid_profile: '프로필 입력값을 확인해 주세요.', invalid_post: '글은 1~500자로 적어 주세요.', invalid_memo: '제목(1~100자)과 메모(1~3,000자)를 확인해 주세요.', invalid_comment: '댓글은 1~1,200자로 적어 주세요.',
    invalid_dm: '대화는 1~2,000자로 적어 주세요.', not_found: '대상을 찾을 수 없거나 볼 수 없습니다.', not_self: '자기 계정에는 할 수 없습니다.', party_full: '일행이 이미 가득 찼습니다(3명까지).', not_leader: '파티장만 할 수 있습니다(더 초대하기 · 전투 열기).', invalid_value: '입력값을 확인해 주세요.', save_too_large: '기록이 너무 커서 서버에 올리지 못했습니다(프로필 사진을 줄여 주세요).',
  };
  const errorText = (code) => ERR[code] || `서버 오류 (${code})`;
  async function rpc(name, args, opt = {}) {
    const key = CONFIG.supabaseAnonKey;
    let res;
    try {
      res = await fetch(`${String(CONFIG.supabaseUrl).replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', keepalive: !!opt.keepalive,
        headers: { apikey: key, ...(/^eyJ/.test(key) ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
    } catch (_) { const e = new Error(ERR.network); e.code = 'network'; throw e; }
    let data = null; try { data = await res.json(); } catch (_) { /* 본문 없음 */ }
    if (!res.ok) { const code = data?.code === 'PGRST202' ? 'schema_missing' : data?.code === 'PGRST106' || res.status === 406 ? 'not_exposed' : res.status === 404 ? 'bad_url' : res.status === 401 || res.status === 403 ? 'bad_key' : (data?.message || `server_${res.status}`); const e = new Error(errorText(code)); e.code = code; throw e; }
    return data;
  }

  /* ── SHA-256 (어떤 환경에서도 같은 값이 나오도록 직접 계산한다) ── */
  function sha256(text) {
    const K = [], H = [];
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    for (let n = 2, i = 0; i < 64; n++) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { if (i < 8) H[i] = frac(Math.sqrt(n)); K[i++] = frac(Math.cbrt(n)); } }
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bits >>> (i * 8)) & 255);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    const h = H.slice();
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, hh].forEach((v, i) => { h[i] = (h[i] + v) | 0; });
    }
    return h.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /* ── 계정 저장소 ── */
  const get = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } };
  const del = (k) => { try { localStorage.removeItem(k); } catch (_) { /* 무시 */ } };
  const readAcc = () => { try { const a = JSON.parse(get(ACC_KEY) || 'null'); return a && a.users ? a : { users: {} }; } catch (_) { return { users: {} }; } };
  const writeAcc = (a) => set(ACC_KEY, JSON.stringify(a));
  const norm = (id) => String(id || '').trim().toLowerCase();
  const session = () => { const id = get(SES_KEY); return id && readAcc().users[id] ? id : null; };
  const saveKey = (id = session()) => `${SAVE_BASE}:${id}`;
  const hashPw = (salt, pw) => sha256(`${salt}:${pw}`);
  const token = (id = session()) => (SERVER && id ? get(TOKEN_KEY(id)) : null);
  // vC.01 부하 줄이기: 「마지막으로 적은 시각(savedAt)」만 바뀐 기록은 같은 기록으로 본다 — 가만히 켜 둔 화면이 20초마다 통째로 올리지 않게.
  const sig = (text0) => { const text = String(text0).replace(/"savedAt":\d+/g, '"savedAt":0'); let x = 5381; for (let i = 0; i < text.length; i++) x = ((x << 5) + x + text.charCodeAt(i)) | 0; return `${text.length}:${x}`; };
  let lastPush = 0; const PUSH_GAP = 120000; // 켜 둔 동안에는 많아야 2분에 한 번 올린다(화면을 닫거나 가릴 때는 곧바로 올린다)
  const cloudMeta = (id) => { try { return JSON.parse(get(CLOUD_KEY(id)) || '{}') || {}; } catch (_) { return {}; } };
  // 서버에서 받은 기록은 '대기 칸'에 두었다가 다음 번 화면을 열 때 맨 먼저 옮긴다(열려 있던 화면이 닫히며 옛 기록으로 덮어쓰지 못하게).
  (() => { const id = get(SES_KEY); if (!id) return; const pend = get(PENDING_KEY(id)); if (pend != null) { set(saveKey(id), pend); del(PENDING_KEY(id)); } })();
  /* ── V.01 모바일 · 컴퓨터 기록 맞추기 ──
   * 예전에는 기기마다 「내 것」을 그냥 올려서, 켜 둔 다른 기기가 방금 한 것을 덮어썼고, 들어올 때도 이 기기 기록이
   * 조금이라도 바뀌어 있으면 서버(다른 기기) 기록을 말없이 버렸다.
   * 이제: ① 올릴 때 「마지막으로 맞춘 서버 기록 시각(base)」을 함께 보내, 그 사이 다른 기기가 올렸으면 덮어쓰지 않는다.
   *       ② 화면을 다시 보거나 1분마다 서버 기록이 바뀌었는지 가볍게 묻는다.
   *       ③ 다른 기기가 올린 기록이 있으면: 이 기기에서 그 뒤로 직접 한 것이 없으면 말없이 받아 오고(새로고침),
   *          이 기기에서도 한 것이 있으면 어느 쪽을 남길지 묻는다. */
  const DEVICE_KEY = 'biryeong-device', ACT_KEY = (id) => `biryeong-act:${id}`;
  const deviceId = () => { let d = get(DEVICE_KEY); if (!d) { d = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; set(DEVICE_KEY, d); } return d; };
  // V.01 기록 지킴: 프로필이 있는 기록만 「진행한 기록」이다
  const hasProfile = (d) => !!(d && typeof d === 'object' && d.profile && typeof d.profile === 'object' && !Array.isArray(d.profile));
  const localHasProfile = (id) => { try { return hasProfile(JSON.parse(get(saveKey(id)) || 'null')); } catch (_) { return false; } };
  const writeMeta = (id, m) => set(CLOUD_KEY(id), JSON.stringify({ ...m, syncedAt: Date.now() }));
  // 마지막으로 맞춘 뒤 이 기기에서 직접 누르거나 친 적이 있는가(켜 두기만 한 화면의 시간 흐름은 「한 것」이 아니다)
  const touchedSince = (id) => Number(get(ACT_KEY(id)) || 0) > Number(cloudMeta(id).syncedAt || 0);
  let actMark = 0;
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => {
    const id = get(SES_KEY); if (!id || Date.now() - actMark < 3000) return; actMark = Date.now(); set(ACT_KEY(id), String(actMark));
  }, { passive: true, capture: true }));
  let noBase = false; // 서버에 아직 V.01 SQL 이 없으면 예전처럼 보낸다
  /* 기록 올리기: 이 브라우저의 기록이 마지막으로 맞춘 것과 다르면 서버에 올린다. */
  let pushing = false;
  async function pushSave(opt = {}) {
    const id = session(), t = token(id); if (!t || pushing || syncing || leaving) return false;
    if (opt.paced && Date.now() - lastPush < PUSH_GAP) return false;
    const local = get(saveKey(id)); if (local == null) return false;
    const meta = cloudMeta(id), s = sig(local); if (meta.sig === s && !opt.force) return false;
    // V.01 마지막으로 맞춘 뒤 이 기기에서 직접 한 것이 없으면(켜 두기만 한 화면) 올리지 않는다 — 다른 기기에서 한 것을 덮지 않게
    if (!opt.force && meta.at && !touchedSince(id)) return false;
    let data; try { data = JSON.parse(local); } catch (_) { return false; }
    if (!hasProfile(data)) return false; // V.01 프로필이 없는 빈 기록은 올리지 않는다(진행한 기록을 덮지 않게)
    data.syncDevice = deviceId();
    // vD.04.3 프로필 사진은 바뀌었을 때만 함께 보낸다(서버는 사진을 따로 두고, 키가 없으면 그대로 둔다 · null 이면 지운다)
    const prof = data && typeof data.profile === 'object' && data.profile ? data.profile : null;
    const ph = prof ? sig(String(prof.photo || '')) : meta.ph;
    if (prof) { if (meta.ph === ph) delete prof.photo; else if (!prof.photo) prof.photo = null; }
    const body = JSON.stringify(data);
    pushing = true; lastPush = Date.now();
    try {
      const args = { p_token: t, p_data: data };
      // V.01 이 기기가 서버 기록과 한 번도 맞춘 적이 없으면 「처음(1970)」을 base 로 — 서버에 이미 기록이 있으면 덮지 않고 묻는다
      if (!noBase && !opt.force) args.p_base = meta.at || '1970-01-01T00:00:00Z';
      let r;
      try { r = await rpc('bry_save_put', args, { keepalive: !!opt.keepalive && body.length < 60000 }); }
      catch (e) { if (e.code === 'schema_missing' && args.p_base) { noBase = true; delete args.p_base; r = await rpc('bry_save_put', args); } else throw e; }
      if (r && r.conflict) {
        pushing = false;
        // 그 사이 서버에 올라간 것이 이 기기의 것이면(답을 못 받았던 것) 그냥 다시 올린다
        if (r.device && r.device === deviceId()) { writeMeta(id, { ...meta, at: r.updated_at }); return pushSave({ ...opt, paced: false }); }
        if (!document.hidden && !opt.keepalive) resolveOther(id, t, r.updated_at);
        return false; // 화면을 닫거나 가릴 때는 덮어쓰지 않는다 — 다음에 열 때 맞춘다
      }
      if (!r || r.ok === false) return false; // blank_save 등: 서버가 받지 않았다
      writeMeta(id, { at: r.updated_at, sig: s, ph }); return true;
    }
    catch (e) { if (e.code === 'save_too_large' && !pushSave.warned) { pushSave.warned = true; console.warn('[비령]', e.message); } return false; }
    finally { pushing = false; }
  }
  /* 다른 기기가 올린 기록이 있다 → 받아 오거나(이 기기에서 한 것이 없을 때) 묻는다 */
  let syncing = false, leaving = false; // leaving: 다른 기기 기록을 받아 새로고침하는 중 — 닫히는 화면이 옛 기록을 올리지 못하게
  async function resolveOther(id, t, when0) {
    if (syncing) return; syncing = true;
    try {
      const local = get(saveKey(id)), meta = cloudMeta(id);
      const dirty = local != null && sig(local) !== meta.sig;
      if (dirty && touchedSince(id)) {
        const when = new Date(when0 || Date.now()).toLocaleString('ko-KR');
        if (!window.confirm(`다른 기기(모바일 · 컴퓨터)에서 저장한 기록이 있습니다. (${when})\n\n[확인] 다른 기기의 기록을 불러온다\n[취소] 이 기기의 기록을 남기고 서버에 덮어쓴다`)) {
          syncing = false; await pushSave({ force: true }); return;
        }
      }
      const full = await rpc('bry_save_get', { p_token: t, p_meta: false });
      if (!full || !full.data) return;
      if (!hasProfile(full.data) && localHasProfile(id)) { syncing = false; await pushSave({ force: true }); return; } // V.01 서버 것이 빈 기록이면 이 기기의 진행 기록을 지킨다(되살린다)
      const text = JSON.stringify(full.data);
      set(PENDING_KEY(id), text); writeMeta(id, { at: full.updated_at, sig: sig(text), ph: sig(String(full.data?.profile?.photo || '')) });
      try { sessionStorage.setItem('biryeong-synced-notice', '1'); } catch (_) { /* 무시 */ }
      leaving = true; location.reload();
    } catch (_) { /* 다음에 다시 */ } finally { syncing = false; }
  }
  /* 서버 기록이 바뀌었는지 가볍게 묻는다(시각만) */
  async function checkOther() {
    const id = session(), t = token(id); if (!t || syncing || pushing) return;
    try {
      const m = await rpc('bry_save_get', { p_token: t, p_meta: true });
      if (!m || !m.updated_at) return;
      const meta = cloudMeta(id);
      if (m.updated_at === meta.at) return;
      if (m.device && m.device === deviceId()) { writeMeta(id, { ...meta, at: m.updated_at }); return; } // 내가 올린 것(답을 못 받았던 것)
      await resolveOther(id, t, m.updated_at);
    } catch (_) { /* 다음에 다시 */ }
  }
  /* 기록 받기: 서버 것이 더 새로우면 받아 온다. 돌려주는 값: 'pulled'(받아서 대기 칸에 둠) · 'kept' · 'none' */
  async function pullSave(id, t, ask) {
    const meta = cloudMeta(id), local = get(saveKey(id));
    const m = await rpc('bry_save_get', { p_token: t, p_meta: true });
    if (!m || !m.updated_at) return 'none';
    if (m.updated_at === meta.at) return 'kept';
    if (m.device && m.device === deviceId() && meta.at) { writeMeta(id, { ...meta, at: m.updated_at }); return 'kept'; }
    const dirty = local != null && sig(local) !== meta.sig;
    // V.01 들어올 때: 이 기기 기록이 바뀌어 있어도, 마지막으로 맞춘 뒤 이 기기에서 직접 한 것이 없으면 다른 기기 기록을 받는다
    if (dirty && (ask || touchedSince(id))) {
      const when = new Date(m.updated_at).toLocaleString('ko-KR');
      if (!window.confirm(`서버에 다른 기기(모바일 · 컴퓨터)에서 저장한 기록이 있습니다. (${when})\n\n[확인] 서버의 기록을 불러온다\n[취소] 이 기기의 기록을 서버에 덮어쓴다`)) { setTimeout(() => pushSave({ force: true }), 1500); return 'kept'; }
    }
    const full = await rpc('bry_save_get', { p_token: t, p_meta: false });
    if (!full || !full.data) return 'none';
    if (!hasProfile(full.data) && localHasProfile(id)) { setTimeout(() => pushSave({ force: true }), 1500); return 'kept'; } // V.01 빈 기록으로 덮지 않는다
    const text = JSON.stringify(full.data);
    set(PENDING_KEY(id), text); writeMeta(id, { at: full.updated_at, sig: sig(text), ph: sig(String(full.data?.profile?.photo || '')) }); // vD.04.3 받은 사진은 다시 올리지 않는다
    return 'pulled';
  }
  /* vD.06.2 서버 기록을 통째로 지웠을 때(supabase/reset_all.sql) 이 브라우저에 남은 옛 계정 · 기록 · 접속 표도 함께 지운다.
   * 지우지 않으면 같은 아이디 · 비밀번호로 들어올 때 이 브라우저의 옛 기록이 서버로 다시 올라간다. 화면 설정(테마 · 글꼴 · 소리)은 남긴다. */
  const WIPE_KEY = 'biryeong-wiped-at';
  const KEEP_KEY = /^biryeong-(theme|ui-font|music|music-vol|sfx|chat-sound|wiped-at)$/;
  let wipeP = null;
  function wipeCheck() {
    if (!SERVER) return Promise.resolve(false);
    return (wipeP ||= rpc('bry_status').then((st) => {
      const t = Date.parse(st?.wiped_at || ''); if (!t) return false;
      const seen = Number(get(WIPE_KEY) || 0); if (seen >= t) return false;
      const old = seen > 0 || Object.values(readAcc().users || {}).some((u) => !u.createdAt || u.createdAt < t);
      if (old) {
        const keys = []; try { for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (_) { /* 저장소 없음 */ }
        keys.filter((k) => k && k.startsWith('biryeong') && !KEEP_KEY.test(k)).forEach(del);
      }
      set(WIPE_KEY, String(t));
      return old;
    }).catch(() => false));
  }
  /* 서버 로그인 · 등록. 이 브라우저에만 있던 계정은 같은 비밀번호로 로그인하면 서버에 올라간다. */
  async function serverEnter(mode, idRaw, pw, code) {
    await wipeCheck();
    const id = norm(idRaw);
    let r;
    try {
      if (mode === 'join') r = await rpc('bry_register', { p_username: id, p_password: pw });
      else {
        r = await rpc('bry_login', { p_username: id, p_password: pw });
        if (r.error === 'user_not_found' || r.error === 'invalid_credentials') {
          const u = readAcc().users[id];
          if (u && u.hash === hashPw(u.salt, pw)) r = await rpc('bry_register', { p_username: id, p_password: pw });
          else return { error: ERR.invalid_credentials };
        } else if (r.error) return { error: errorText(r.error) };
      }
    } catch (e) { return { error: e.message }; }
    const acc = readAcc(), salt = newSalt(), prev = acc.users[id];
    acc.users[id] = { id, salt, hash: hashPw(salt, pw), createdAt: prev?.createdAt || Date.now(), server: true };
    if (r.user.role === 'admin') acc.users[id].admin = true;
    if (!writeAcc(acc)) return { error: '이 브라우저에 저장할 수 없습니다.' };
    set(TOKEN_KEY(id), r.token);
    if (code) {
      try {
        const c = await rpc('bry_claim_admin', { p_token: r.token, p_code: code });
        if (c.ok) { const a2 = readAcc(); a2.users[id].admin = true; writeAcc(a2); }
        else if (c.error === 'admin_locked') window.alert('관리자 코드를 5번 틀려 1시간 동안 다시 시도할 수 없어요. 이번에는 일반 계정으로 들어갑니다.');
        else window.alert('관리자 코드가 맞지 않아 일반 계정으로 들어갑니다. (Supabase 에 등록한 관리자 코드를 확인해 주세요. 5번 틀리면 1시간 동안 막힙니다.)');
      } catch (e) { window.alert(e.message); }
    }
    set(SES_KEY, id);
    if (r.must_change) set(MUSTCHG_KEY(id), '1'); // V.01 임시 비밀번호로 들어왔다 → 새 비밀번호부터
    try { await pullSave(id, r.token, true); } catch (_) { /* 기록은 다음에 맞춘다 */ }
    (() => { const pend = get(PENDING_KEY(id)); if (pend != null) { set(saveKey(id), pend); del(PENDING_KEY(id)); } })();
    return { id, mustChange: !!r.must_change };
  }
  /* V.01 임시 비밀번호로 들어온 뒤: 새 비밀번호를 정하기 전에는 들어가지 못한다 */
  const MUSTCHG_KEY = (id) => `biryeong-must-change:${id}`;
  function forceNewPassword(id, t) {
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    document.getElementById('gate')?.remove();
    document.body.classList.add('is-gated');
    const gate = el('div', 'gate'); gate.id = 'gate'; gate.dataset.forceNewPw = '';
    const box = el('div', 'gate-box');
    const form = el('form', 'gate-form'); form.noValidate = true;
    const mk = (fid, label) => { const w = el('label', 'gate-field'); w.htmlFor = fid; const i = el('input'); i.id = fid; i.type = 'password'; i.autocomplete = 'new-password'; i.required = true; w.append(el('span', '', label), i); return [w, i]; };
    const [w1, p1] = mk('gateNewPw', '새 비밀번호'), [w2, p2] = mk('gateNewPw2', '새 비밀번호 확인');
    const err = el('p', 'gate-error'); err.setAttribute('role', 'alert'); err.hidden = true;
    const go = el('button', 'gate-submit', '새 비밀번호로 바꾸고 입산'); go.type = 'submit';
    const out = el('button', 'gate-link', '로그아웃'); out.type = 'button';
    out.addEventListener('click', () => { del(TOKEN_KEY(id)); del(SES_KEY); location.reload(); });
    form.append(w1, w2, err, go);
    box.append(el('p', 'gate-logo gate-logo-sm', '비령'), el('p', 'gate-sub', '새 비밀번호 정하기'), el('p', 'gate-info', '임시 비밀번호로 들어왔습니다. 앞으로 쓸 새 비밀번호를 정해 주세요. (임시 비밀번호는 이제 쓸 수 없게 됩니다)'), form, out);
    gate.append(box); document.body.append(gate); p1.focus();
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault(); err.hidden = true;
      const a = p1.value, b = p2.value;
      if (a.length < 4) { err.textContent = ERR.invalid_password; err.hidden = false; return; }
      if (a !== b) { err.textContent = '새 비밀번호 확인이 맞지 않습니다.'; err.hidden = false; return; }
      go.disabled = true;
      try {
        const r = await rpc('bry_pw_reset_finish', { p_token: t, p_new: a });
        if (!r?.ok) throw Object.assign(new Error(errorText(r?.error || 'error')), { code: r?.error });
        const acc = readAcc(); const u = acc.users[id]; if (u) { u.salt = newSalt(); u.hash = hashPw(u.salt, a); writeAcc(acc); }
        del(MUSTCHG_KEY(id));
        window.alert('새 비밀번호로 바꾸었습니다. 다음부터는 새 비밀번호로 로그인해 주세요.');
        location.hash = '#/'; location.reload();
      } catch (e) {
        go.disabled = false; err.textContent = e.message; err.hidden = false;
        if (e.code === 'no_reset') { del(MUSTCHG_KEY(id)); setTimeout(() => location.reload(), 1500); }
      }
    });
  }
  /* 들어와 있는 동안: 계정 상태(정지 · 관리자)를 서버와 맞추고, 기록을 주기적으로 올린다. */
  async function serverBoot() {
    if (await wipeCheck()) { location.reload(); return; } // 서버가 비워졌다 → 이 브라우저의 옛 기록도 비우고 처음 화면으로
    const id = session(), t = token(id); if (!t) return;
    if (get(MUSTCHG_KEY(id))) {
      try { const st = await rpc('bry_pw_reset_state', { p_token: t }); if (st?.must_change) { forceNewPassword(id, t); return; } del(MUSTCHG_KEY(id)); } catch (_) { forceNewPassword(id, t); return; }
    }
    try {
      const me = (await rpc('bry_me', { p_token: t })).user;
      const acc = readAcc(), u = acc.users[id], was = !!u.admin;
      if ((me.role === 'admin') !== was) { if (me.role === 'admin') u.admin = true; else delete u.admin; writeAcc(acc); location.reload(); return; }
      if ((await pullSave(id, t, false)) === 'pulled') { leaving = true; location.reload(); return; }
    } catch (e) {
      if (e.code === 'banned') { window.alert(ERR.banned); del(TOKEN_KEY(id)); del(SES_KEY); location.reload(); return; }
      if (e.code === 'login_required') { del(TOKEN_KEY(id)); del(SES_KEY); location.reload(); return; }
    }
    setInterval(() => { if (!document.hidden && !idle()) pushSave({ paced: true }); }, 30000); // vD.04.3 자리를 비운 동안엔 올리지 않는다(돌아오거나 화면을 가리면 올린다)
    setInterval(() => { if (!document.hidden && !idle()) checkOther(); }, 60000); // V.01 다른 기기가 올린 기록이 있는지(시각만) 1분마다
    window.addEventListener('biryeong:active', () => { checkOther(); pushSave({ paced: true }); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pushSave({ keepalive: true }); else checkOther(); }); // V.01 다시 보면 곧바로 맞춘다
    window.addEventListener('focus', () => checkOther());
    window.addEventListener('pagehide', () => { pushSave({ keepalive: true }); });
    setTimeout(pushSave, 4000);
    // V.01 다른 기기 기록을 받아 새로고침했으면 한 줄 알린다
    try { if (sessionStorage.getItem('biryeong-synced-notice')) { sessionStorage.removeItem('biryeong-synced-notice'); setTimeout(() => window.BiryeongApp?.toast?.('기록 맞춤', '다른 기기(모바일 · 컴퓨터)에서 진행한 기록을 불러왔다.'), 1500); } } catch (_) { /* 무시 */ }
  }
  const newSalt = () => { const a = new Uint8Array(12); (window.crypto || {}).getRandomValues?.(a); return Array.from(a, (b) => (b || Math.floor(Math.random() * 256)).toString(16).padStart(2, '0')).join(''); };

  function register(idRaw, pw) {
    const id = norm(idRaw), acc = readAcc();
    if (!/^[a-z0-9_가-힣]{2,16}$/.test(id)) return { error: '아이디는 2~16자(한글 · 영문 · 숫자 · _)로 적어 주세요.' };
    if (String(pw).length < 4) return { error: '비밀번호는 4자 이상으로 적어 주세요.' };
    if (acc.users[id]) return { error: '이미 명부에 있는 아이디입니다.' };
    const salt = newSalt();
    const first = !Object.keys(acc.users).length;
    acc.users[id] = { id, salt, hash: hashPw(salt, pw), createdAt: Date.now() };
    if (!writeAcc(acc)) return { error: '이 브라우저에 저장할 수 없습니다.' };
    // 예전 판(로그인 없던 때)의 기록은 처음 만든 계정이 이어받는다.
    const legacy = get(SAVE_BASE);
    if (first && legacy && !get(saveKey(id))) { set(saveKey(id), legacy); del(SAVE_BASE); }
    return { id };
  }
  function login(idRaw, pw) {
    const id = norm(idRaw), u = readAcc().users[id];
    if (!u || u.hash !== hashPw(u.salt, pw)) return { error: '아이디 또는 비밀번호가 맞지 않습니다.' };
    return { id };
  }
  async function verifyAdminCode(code) {
    if (!code) return false;
    if (CONFIG.api || CONFIG.sameOrigin) {
      try {
        const res = await fetch(`${CONFIG.api}/api/admin/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        if (res.ok) return !!(await res.json()).ok;
      } catch (_) { return false; } // 서버 오류일 때 정적 해시로 인증을 우회하지 않음
      return false;
    }
    // 순수 정적 페이지의 관리 권한은 보안 경계가 될 수 없다.
    return false;
  }

  // vD.04.3 자리를 비웠는가: 마지막으로 누르거나 움직인 뒤 지난 시간. 켜 두고 자리를 비운 화면은 서버에 덜 묻는다.
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove'].forEach((ev) => window.addEventListener(ev, () => {
    const was = Date.now() - lastInput > IDLE_MS; lastInput = Date.now();
    if (was) window.dispatchEvent(new CustomEvent('biryeong:active')); // 돌아왔다 → 곧바로 한 번 묻는다
  }, { passive: true, capture: true }));
  const IDLE_MS = 10 * 60 * 1000;
  const idle = () => Date.now() - lastInput > IDLE_MS;
  const Auth = {
    session, saveKey, idle,
    isAdmin: () => { const id = session(); return !!(id && readAcc().users[id].admin); },
    logout() {
      const id = session(), t = token(id);
      const done = () => { del(SES_KEY); location.hash = '#/'; location.reload(); };
      if (!t) return done();
      // 나가기 전에 기록을 한 번 올리고, 서버의 표를 지운다(최대 3초 기다린다).
      Promise.race([pushSave().then(() => rpc('bry_logout', { p_token: t })).catch(() => null), new Promise((r) => setTimeout(r, 3000))]).then(() => { del(TOKEN_KEY(id)); done(); });
    },
    server: SERVER, token, rpc, errorText, pushSave,
    call: (name, args = {}) => rpc(name, { p_token: token(), ...args }), // 로그인한 계정으로 서버 함수를 부른다
    list: () => Object.values(readAcc().users).map((u) => { const raw = get(saveKey(u.id)); let name = ''; try { name = (raw && JSON.parse(raw)?.profile?.name) || ''; } catch (_) { /* 기록이 깨졌으면 이름 없이 */ } return { id: u.id, name, createdAt: u.createdAt, admin: !!u.admin, hasSave: !!raw }; }),
    resetPassword(id, pw) { const acc = readAcc(); const u = acc.users[id]; if (!u || !Auth.isAdmin()) return false; if (String(pw).length < 4) return false; u.salt = newSalt(); u.hash = hashPw(u.salt, pw); return writeAcc(acc); },
    remove(id) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; delete acc.users[id]; del(saveKey(id)); return writeAcc(acc); },
    setAdmin(id, on) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; if (on) acc.users[id].admin = true; else delete acc.users[id].admin; return writeAcc(acc); },
    verifyAdminCode,
  };
  window.BiryeongAuth = Auth;
  /* 급식실 익명 사연(실행 화면의 급식실이 부른다): 날짜별 신문 읽기 · 투고 · 떼기 */
  /* 수업 랭킹(실행 화면의 수업 창이 부른다). 서버가 없거나 로그인 표가 없으면 null — 화면이 '서버에 연결되지 않아'를 보여 준다. */
  globalThis.__BRY_RANK = {
    fetch: async (course, _pid, week) => { if (!token()) return null; try { return await Auth.call('bry_rank', { p_course: course, p_week: week === 'last' ? 'last' : 'this' }); } catch (_) { return null; } },
    submit: async (course, name, score) => { if (!token()) return { ok: false, error: 'not-connected' }; try { return await Auth.call('bry_rank_submit', { p_course: course, p_score: Math.round(score), p_name: name }); } catch (e) { return { ok: false, error: e.code || 'error' }; } },
    live: () => !!token(),
  };
  if (SERVER) globalThis.__BRY_CAFE = {
    online: () => !!token(), admin: () => Auth.isAdmin(),
    fetch: async (date) => { try { const r = await Auth.call('bry_stories', { p_date: date }); return { ok: true, stories: r.stories.map((x) => ({ id: x.id, no: x.no, text: x.body, mine: x.mine })) }; } catch (_) { return { ok: false }; } },
    submit: async (body) => { try { await Auth.call('bry_story', { p_body: body }); return { ok: true }; } catch (e) { return { ok: false, error: e.code === 'too_many_requests' ? 'slow-down' : e.code === 'invalid_post' ? 'too-long' : e.code, message: e.message }; } },
    remove: async (id) => { try { await Auth.call('bry_delete', { p_kind: 'story', p_id: id }); return true; } catch (e) { window.alert(e.message); return false; } },
  };

  // 글꼴은 로그인 화면에서도 맞춘다.
  try { const f = get('biryeong-ui-font'); if (f) document.documentElement.dataset.uiFont = f; } catch (_) { /* 기본 글꼴 */ }
  let relogin = false;
  if (session()) {
    if (!SERVER) return;
    if (token()) { serverBoot(); return; }
    del(SES_KEY); relogin = true; // 서버가 붙기 전에 만든 계정: 한 번 더 로그인하면 서버로 올라간다
  }
  wipeCheck(); // 로그인 화면이 뜨는 동안 미리 맞춰 둔다

  /* ── 로그인 화면 ── */
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  document.body.classList.add('is-gated');
  const gate = h('div', 'gate'); gate.id = 'gate';
  const box = h('div', 'gate-box');
  const logo = h('button', 'gate-logo', '비령'); logo.type = 'button'; logo.id = 'gateLogo'; logo.setAttribute('aria-label', '비령');
  const sub = h('p', 'gate-sub', '秘靈 · 入山 名簿');
  const tabs = h('div', 'gate-tabs');
  const form = h('form', 'gate-form'); form.noValidate = true;
  const field = (id, label, type, auto) => { const w = h('label', 'gate-field'); w.htmlFor = id; const i = h('input'); i.id = id; i.type = type; i.autocomplete = auto; i.required = true; w.append(h('span', '', label), i); return [w, i]; };
  const [idWrap, idIn] = field('gateId', '아이디', 'text', 'username');
  const [pwWrap, pwIn] = field('gatePw', '비밀번호', 'password', 'current-password');
  const [pw2Wrap, pw2In] = field('gatePw2', '비밀번호 확인', 'password', 'new-password');
  const [codeWrap, codeIn] = field('gateCode', '관리자 코드', 'password', 'off');
  codeIn.required = false; codeWrap.hidden = true; codeWrap.classList.add('gate-admin');
  const error = h('p', 'gate-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const submit = h('button', 'gate-submit', '입산'); submit.type = 'submit';
  const info = h('p', 'gate-info'); info.hidden = true; info.setAttribute('role', 'status');
  const forgot = h('button', 'gate-link', '비밀번호를 잊었어요'); forgot.type = 'button'; forgot.hidden = !SERVER; forgot.dataset.gateForgot = '';
  forgot.addEventListener('click', () => setMode(mode === 'reset' ? 'login' : 'reset'));
  const note = h('small', 'gate-note', SERVER ? '계정과 기록은 비령 서버에 보관됩니다. 어느 기기에서든 같은 아이디로 이어집니다.' : '계정과 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.');
  let mode = Object.keys(readAcc().users).length ? 'login' : 'join';
  const tabBtn = (m, label) => { const b = h('button', '', label); b.type = 'button'; b.dataset.mode = m; b.addEventListener('click', () => setMode(m)); return b; };
  tabs.append(tabBtn('login', '로그인'), tabBtn('join', '명부 등록'));
  function setMode(m) {
    mode = m;
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    pw2Wrap.hidden = m !== 'join'; pw2In.required = m === 'join';
    pwIn.autocomplete = m === 'join' ? 'new-password' : 'current-password';
    submit.textContent = m === 'join' ? '명부에 올리고 입산' : m === 'reset' ? '임시 비밀번호 요청하기' : '입산';
    pwWrap.hidden = m === 'reset'; pwIn.required = m !== 'reset';
    forgot.hidden = !SERVER || m === 'join'; forgot.textContent = m === 'reset' ? '← 로그인으로 돌아가기' : '비밀번호를 잊었어요';
    if (m === 'reset') { info.textContent = '아이디를 적고 요청하면 임시 비밀번호가 만들어집니다. 임시 비밀번호는 관리자에게 받아 [로그인]에 적어 주세요. 들어오면 곧바로 새 비밀번호를 정하게 됩니다.'; info.hidden = false; }
    else if (m === 'join') info.hidden = true;
    error.hidden = true;
  }
  // '비령' 다섯 번 → 관리자 코드 칸
  let taps = 0, tapTimer = null;
  logo.addEventListener('click', () => {
    taps += 1; clearTimeout(tapTimer); tapTimer = setTimeout(() => { taps = 0; }, 2500);
    logo.classList.remove('is-tapped'); void logo.offsetWidth; logo.classList.add('is-tapped');
    if (taps >= 5 && codeWrap.hidden) { codeWrap.hidden = false; logo.classList.add('is-open'); codeIn.focus(); }
  });
  const fail = (text) => { error.textContent = text; error.hidden = false; };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = idIn.value, pw = pwIn.value, code = codeWrap.hidden ? '' : codeIn.value.trim();
    if (mode === 'reset') { // V.01 임시 비밀번호 요청
      if (!id.trim()) return fail('아이디를 적어 주세요.');
      submit.disabled = true;
      try {
        const r = await rpc('bry_pw_reset_request', { p_username: norm(id) });
        if (r?.error) { submit.disabled = false; return fail(errorText(r.error)); }
      } catch (e) { submit.disabled = false; return fail(e.message); }
      submit.disabled = false; setMode('login'); idIn.value = norm(id);
      info.textContent = `「${norm(id)}」의 임시 비밀번호를 요청했습니다. 관리자에게 임시 비밀번호를 받아 아래 비밀번호 칸에 적고 입산해 주세요. (3일 동안 쓸 수 있습니다. 예전 비밀번호도 그대로 쓸 수 있습니다)`; info.hidden = false;
      pwIn.focus(); return;
    }
    if (!id.trim() || !pw) return fail('아이디와 비밀번호를 적어 주세요.');
    if (mode === 'join' && pw !== pw2In.value) return fail('비밀번호 확인이 맞지 않습니다.');
    submit.disabled = true;
    if (SERVER) {
      if (mode === 'join' && !/^[a-z0-9_가-힣]{2,16}$/.test(norm(id))) { submit.disabled = false; return fail(ERR.invalid_username); }
      const sr = await serverEnter(mode, id, pw, code);
      if (sr.error) { submit.disabled = false; return fail(sr.error); }
      if (sr.mustChange) { forceNewPassword(sr.id, token(sr.id)); return; }
      location.hash = '#/'; location.reload(); return;
    }
    let admin = false;
    if (code) { admin = await verifyAdminCode(code); if (!admin) { submit.disabled = false; return fail(CONFIG.adminCodeFrom === 'github' || CONFIG.api || CONFIG.sameOrigin ? '관리자 코드가 맞지 않습니다.' : '관리자 코드가 맞지 않습니다. (이 사이트는 아직 GitHub 의 ADMIN_CODE 가 아니라 임시 코드를 쓰고 있어요 — 배포 설정을 확인해 주세요.)'); } }
    const r = mode === 'join' ? register(id, pw) : login(id, pw);
    if (r.error) { submit.disabled = false; return fail(r.error); }
    if (admin) { const acc = readAcc(); acc.users[r.id].admin = true; writeAcc(acc); }
    set(SES_KEY, r.id);
    location.hash = '#/';
    location.reload();
  });
  if (relogin) note.textContent = '비령 서버가 연결되었습니다. 쓰던 아이디와 비밀번호로 한 번 더 로그인하면 계정과 기록이 서버로 올라갑니다.';
  form.append(idWrap, pwWrap, pw2Wrap, codeWrap, error, submit);
  box.append(logo, sub, tabs, info, form, forgot, note);
  gate.append(box);
  document.body.append(gate);
  setMode(mode);
  idIn.focus();
})();
