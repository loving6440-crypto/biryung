/* 秘靈 · 비령 — 로그인. 서버가 붙기 전까지 계정과 기록은 '이 브라우저'에만 보관한다.
 *
 *   biryeong-accounts-v1      { users: { <아이디>: { id, salt, hash, createdAt, admin? } } }   (비밀번호는 소금을 친 SHA-256 으로만 남긴다)
 *   biryeong-session-v1       지금 로그인한 아이디
 *   biryeong-save-v1:<아이디>  그 계정의 기록(프로필 · 진행). 예전 판의 기록(biryeong-save-v1)은 처음 만든 계정이 이어받는다.
 *
 * 로그인 화면: 로고 자리의 갈무리9 '비령' 글자를 다섯 번 누르면 관리자 코드 칸이 나온다.
 *   관리자 코드 확인 — 서버가 있으면 POST {api}/api/admin/verify (서버의 ADMIN_CODE 환경변수와 비교), 없으면 config.js 의 adminCodeHash.
 *
 * window.BiryeongAuth = { session(), saveKey(), isAdmin(), logout(), list(), resetPassword(id, pw), remove(id), setAdmin(id, on) }
 * 나중에 서버 로그인으로 바꿀 때는 이 파일의 register · login · verifyAdminCode 만 서버 호출로 바꾸면 된다.
 */
(() => {
  'use strict';
  const ACC_KEY = 'biryeong-accounts-v1', SES_KEY = 'biryeong-session-v1', SAVE_BASE = 'biryeong-save-v1';
  const CONFIG = Object.assign({ api: '', sameOrigin: false, adminCodeHash: '', supabaseUrl: '', supabaseAnonKey: '' }, window.BIRYEONG_CONFIG);
  /* v1.9 서버(Supabase)가 연결되면 계정 · 기록이 서버에 있다. 이 브라우저에는 그림자 계정(로그인 유지용)과 서버 표(token)만 둔다. */
  const SERVER = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  const TOKEN_KEY = (id) => `biryeong-token:${id}`, CLOUD_KEY = (id) => `biryeong-cloud:${id}`, PENDING_KEY = (id) => `biryeong-save-pending:${id}`;
  const ERR = {
    network: '비령 서버에 닿지 못했습니다. 잠시 뒤 다시 해 주세요.', schema_missing: '서버에 비령의 표가 아직 없습니다. Supabase SQL Editor 에서 supabase/schema.sql 을 실행해 주세요.',
    login_required: '다시 로그인해 주세요.', banned: '이 계정은 정지되어 있습니다.', muted: '지금은 글을 남길 수 없습니다(운영자 조치).', forbidden: '권한이 없습니다.',
    invalid_username: '아이디는 2~16자(한글 · 영문 · 숫자 · _)로 적어 주세요.', invalid_password: '비밀번호는 4자 이상으로 적어 주세요.', username_taken: '이미 명부에 있는 아이디입니다.',
    invalid_credentials: '아이디 또는 비밀번호가 맞지 않습니다.', user_not_found: '해당 계정을 찾을 수 없습니다.', too_many_requests: '요청이 너무 많습니다. 잠시 뒤 다시 해 주세요.',
    invalid_profile: '프로필 입력값을 확인해 주세요.', invalid_post: '글은 1~500자로 적어 주세요.', invalid_memo: '제목(1~100자)과 메모(1~3,000자)를 확인해 주세요.', invalid_comment: '댓글은 1~1,200자로 적어 주세요.',
    invalid_dm: '대화는 1~2,000자로 적어 주세요.', not_found: '대상을 찾을 수 없거나 볼 수 없습니다.', not_self: '자기 계정에는 할 수 없습니다.', invalid_value: '입력값을 확인해 주세요.', save_too_large: '기록이 너무 커서 서버에 올리지 못했습니다(프로필 사진을 줄여 주세요).',
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
    if (!res.ok) { const code = data?.code === 'PGRST202' || res.status === 404 ? 'schema_missing' : (data?.message || `server_${res.status}`); const e = new Error(errorText(code)); e.code = code; throw e; }
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
  const sig = (text) => { let x = 5381; for (let i = 0; i < text.length; i++) x = ((x << 5) + x + text.charCodeAt(i)) | 0; return `${text.length}:${x}`; };
  const cloudMeta = (id) => { try { return JSON.parse(get(CLOUD_KEY(id)) || '{}') || {}; } catch (_) { return {}; } };
  // 서버에서 받은 기록은 '대기 칸'에 두었다가 다음 번 화면을 열 때 맨 먼저 옮긴다(열려 있던 화면이 닫히며 옛 기록으로 덮어쓰지 못하게).
  (() => { const id = get(SES_KEY); if (!id) return; const pend = get(PENDING_KEY(id)); if (pend != null) { set(saveKey(id), pend); del(PENDING_KEY(id)); } })();
  /* 기록 올리기: 이 브라우저의 기록이 마지막으로 맞춘 것과 다르면 서버에 올린다. */
  let pushing = false;
  async function pushSave(opt = {}) {
    const id = session(), t = token(id); if (!t || pushing) return false;
    const local = get(saveKey(id)); if (local == null) return false;
    const meta = cloudMeta(id), s = sig(local); if (meta.sig === s) return false;
    let data; try { data = JSON.parse(local); } catch (_) { return false; }
    pushing = true;
    try { const r = await rpc('bry_save_put', { p_token: t, p_data: data }, { keepalive: !!opt.keepalive && local.length < 60000 }); set(CLOUD_KEY(id), JSON.stringify({ at: r.updated_at, sig: s })); return true; }
    catch (e) { if (e.code === 'save_too_large' && !pushSave.warned) { pushSave.warned = true; console.warn('[비령]', e.message); } return false; }
    finally { pushing = false; }
  }
  /* 기록 받기: 서버 것이 더 새로우면 받아 온다. 돌려주는 값: 'pulled'(받아서 대기 칸에 둠) · 'kept' · 'none' */
  async function pullSave(id, t, ask) {
    const meta = cloudMeta(id), local = get(saveKey(id));
    const m = await rpc('bry_save_get', { p_token: t, p_meta: true });
    if (!m || !m.updated_at) return 'none';
    if (m.updated_at === meta.at) return 'kept';
    const dirty = local != null && sig(local) !== meta.sig;
    if (dirty) {
      if (!ask) return 'kept'; // 이 기기에서 한 것이 아직 안 올라갔다 → 이 기기 것을 올린다
      const when = new Date(m.updated_at).toLocaleString('ko-KR');
      if (!window.confirm(`서버에 저장된 기록이 있습니다. (${when})\n\n[확인] 서버의 기록을 불러온다\n[취소] 이 기기의 기록을 서버에 덮어쓴다`)) return 'kept';
    }
    const full = await rpc('bry_save_get', { p_token: t, p_meta: false });
    if (!full || !full.data) return 'none';
    const text = JSON.stringify(full.data);
    set(PENDING_KEY(id), text); set(CLOUD_KEY(id), JSON.stringify({ at: full.updated_at, sig: sig(text) }));
    return 'pulled';
  }
  /* 서버 로그인 · 등록. 이 브라우저에만 있던 계정은 같은 비밀번호로 로그인하면 서버에 올라간다. */
  async function serverEnter(mode, idRaw, pw, code) {
    const id = norm(idRaw);
    let r;
    try {
      if (mode === 'join') r = await rpc('bry_register', { p_username: id, p_password: pw });
      else {
        r = await rpc('bry_login', { p_username: id, p_password: pw });
        if (r.error === 'user_not_found') {
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
        else window.alert('관리자 코드가 맞지 않아 일반 계정으로 들어갑니다. (Supabase 에 등록한 관리자 코드를 확인해 주세요.)');
      } catch (e) { window.alert(e.message); }
    }
    set(SES_KEY, id);
    try { await pullSave(id, r.token, true); } catch (_) { /* 기록은 다음에 맞춘다 */ }
    (() => { const pend = get(PENDING_KEY(id)); if (pend != null) { set(saveKey(id), pend); del(PENDING_KEY(id)); } })();
    return { id };
  }
  /* 들어와 있는 동안: 계정 상태(정지 · 관리자)를 서버와 맞추고, 기록을 주기적으로 올린다. */
  async function serverBoot() {
    const id = session(), t = token(id); if (!t) return;
    try {
      const me = (await rpc('bry_me', { p_token: t })).user;
      const acc = readAcc(), u = acc.users[id], was = !!u.admin;
      if ((me.role === 'admin') !== was) { if (me.role === 'admin') u.admin = true; else delete u.admin; writeAcc(acc); location.reload(); return; }
      if ((await pullSave(id, t, false)) === 'pulled') { location.reload(); return; }
    } catch (e) {
      if (e.code === 'banned') { window.alert(ERR.banned); del(TOKEN_KEY(id)); del(SES_KEY); location.reload(); return; }
      if (e.code === 'login_required') { del(TOKEN_KEY(id)); del(SES_KEY); location.reload(); return; }
    }
    setInterval(() => { if (!document.hidden) pushSave(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pushSave({ keepalive: true }); });
    window.addEventListener('pagehide', () => { pushSave({ keepalive: true }); });
    setTimeout(pushSave, 4000);
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
      } catch (_) { /* 서버에 닿지 않으면 아래 임시 코드로 */ }
    }
    return !!CONFIG.adminCodeHash && sha256(code) === CONFIG.adminCodeHash;
  }

  const Auth = {
    session, saveKey,
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
    list: () => Object.values(readAcc().users).map((u) => ({ id: u.id, createdAt: u.createdAt, admin: !!u.admin, hasSave: !!get(saveKey(u.id)) })),
    resetPassword(id, pw) { const acc = readAcc(); const u = acc.users[id]; if (!u || !Auth.isAdmin()) return false; if (String(pw).length < 4) return false; u.salt = newSalt(); u.hash = hashPw(u.salt, pw); return writeAcc(acc); },
    remove(id) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; delete acc.users[id]; del(saveKey(id)); return writeAcc(acc); },
    setAdmin(id, on) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; if (on) acc.users[id].admin = true; else delete acc.users[id].admin; return writeAcc(acc); },
    verifyAdminCode,
  };
  window.BiryeongAuth = Auth;

  // 글꼴은 로그인 화면에서도 맞춘다.
  try { const f = get('biryeong-ui-font'); if (f) document.documentElement.dataset.uiFont = f; } catch (_) { /* 기본 글꼴 */ }
  let relogin = false;
  if (session()) {
    if (!SERVER) return;
    if (token()) { serverBoot(); return; }
    del(SES_KEY); relogin = true; // 서버가 붙기 전에 만든 계정: 한 번 더 로그인하면 서버로 올라간다
  }

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
  const note = h('small', 'gate-note', SERVER ? '계정과 기록은 비령 서버에 보관됩니다. 어느 기기에서든 같은 아이디로 이어집니다.' : '계정과 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.');
  let mode = Object.keys(readAcc().users).length ? 'login' : 'join';
  const tabBtn = (m, label) => { const b = h('button', '', label); b.type = 'button'; b.dataset.mode = m; b.addEventListener('click', () => setMode(m)); return b; };
  tabs.append(tabBtn('login', '로그인'), tabBtn('join', '명부 등록'));
  function setMode(m) {
    mode = m;
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    pw2Wrap.hidden = m !== 'join'; pw2In.required = m === 'join';
    pwIn.autocomplete = m === 'join' ? 'new-password' : 'current-password';
    submit.textContent = m === 'join' ? '명부에 올리고 입산' : '입산';
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
    if (!id.trim() || !pw) return fail('아이디와 비밀번호를 적어 주세요.');
    if (mode === 'join' && pw !== pw2In.value) return fail('비밀번호 확인이 맞지 않습니다.');
    submit.disabled = true;
    if (SERVER) {
      if (mode === 'join' && !/^[a-z0-9_가-힣]{2,16}$/.test(norm(id))) { submit.disabled = false; return fail(ERR.invalid_username); }
      const sr = await serverEnter(mode, id, pw, code);
      if (sr.error) { submit.disabled = false; return fail(sr.error); }
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
  box.append(logo, sub, tabs, form, note);
  gate.append(box);
  document.body.append(gate);
  setMode(mode);
  idIn.focus();
})();
