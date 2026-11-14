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
  const CONFIG = Object.assign({ api: '', sameOrigin: false, adminCodeHash: '' }, window.BIRYEONG_CONFIG);

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
    logout() { del(SES_KEY); location.hash = '#/'; location.reload(); },
    list: () => Object.values(readAcc().users).map((u) => ({ id: u.id, createdAt: u.createdAt, admin: !!u.admin, hasSave: !!get(saveKey(u.id)) })),
    resetPassword(id, pw) { const acc = readAcc(); const u = acc.users[id]; if (!u || !Auth.isAdmin()) return false; if (String(pw).length < 4) return false; u.salt = newSalt(); u.hash = hashPw(u.salt, pw); return writeAcc(acc); },
    remove(id) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; delete acc.users[id]; del(saveKey(id)); return writeAcc(acc); },
    setAdmin(id, on) { const acc = readAcc(); if (!acc.users[id] || !Auth.isAdmin() || id === session()) return false; if (on) acc.users[id].admin = true; else delete acc.users[id].admin; return writeAcc(acc); },
    verifyAdminCode,
  };
  window.BiryeongAuth = Auth;

  // 글꼴은 로그인 화면에서도 맞춘다.
  try { const f = get('biryeong-ui-font'); if (f) document.documentElement.dataset.uiFont = f; } catch (_) { /* 기본 글꼴 */ }
  if (session()) return;

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
  const note = h('small', 'gate-note', '계정과 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.');
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
    let admin = false;
    if (code) { admin = await verifyAdminCode(code); if (!admin) { submit.disabled = false; return fail('관리자 코드가 맞지 않습니다.'); } }
    const r = mode === 'join' ? register(id, pw) : login(id, pw);
    if (r.error) { submit.disabled = false; return fail(r.error); }
    if (admin) { const acc = readAcc(); acc.users[r.id].admin = true; writeAcc(acc); }
    set(SES_KEY, r.id);
    location.hash = '#/';
    location.reload();
  });
  form.append(idWrap, pwWrap, pw2Wrap, codeWrap, error, submit);
  box.append(logo, sub, tabs, form, note);
  gate.append(box);
  document.body.append(gate);
  setMode(mode);
  idIn.focus();
})();
