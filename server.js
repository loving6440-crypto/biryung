/* 秘靈 · 비령 — 서버(Supabase)가 연결됐을 때만 도는 것들.
 *
 *   우편함  45초마다 bry_inbox 를 읽는다 — 하사(관리자가 보낸 냥 · 영력 · 아이템)를 받고, 공지를 속보 띠에 띄우고,
 *           안 읽은 밀담 수를 「밤쥐들의 터」 단추에 붙인다. (접속 표시도 이 호출이 겸한다.)
 *   서버 관리(#/admin/server)  공지 · 하사 · 회원(칭호 · 관리자 · 글쓰기 정지 · 계정 정지 · 비밀번호 · 기록 열람 · 삭제) · 감사 기록
 *
 * 서버 쪽 함수는 supabase/schema.sql 의 bry_* — 관리자 함수는 서버가 계정의 역할을 직접 확인한다(화면만 고쳐서는 통하지 않는다).
 */
(() => {
  'use strict';
  const Auth = window.BiryeongAuth, App = window.BiryeongApp;
  if (!Auth || !App) return;
  const { h, btn, para, toast } = App;
  const live = () => !!(Auth.server && Auth.token());
  const call = (name, args) => Auth.call(name, args);
  const when = (v) => { try { return v ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—'; } catch (_) { return '—'; } };
  const itemNames = () => { const api = App.playApi(); const m = Object.fromEntries((api?.admin?.items || []).map((x) => [x.id, x.name])); return new Proxy(m, { get: (o, k) => o[k] ?? api?.itemName?.(k) ?? undefined }); };
  function payloadText(p) {
    const names = itemNames();
    if (p?.edit) return `상태 고침(${Object.keys(p.edit).map((k) => ({ stats: '육조 스탯', hp: '체력', mp: '의지력', hpMax: '최대 체력', mpMax: '최대 의지력', spirit: '영력', weak: '쇠약', ailments: '몸의 이상', psychicsAdd: '영능력 주기', psychicsRemove: '영능력 거두기' })[k] || k).join(' · ')})`;
    const psy = (p?.psychics || []).map((id) => `영능력 《${(App.playApi()?.psychicDefs?.() || []).find((x) => x.id === id)?.name || id}》`);
    return [...psy, p?.money ? `${p.money}냥` : '', p?.spirit ? `영력 ${p.spirit}` : '', ...Object.entries(p?.items || {}).map(([id, n]) => `${names[id] || id} ×${n}`)].filter(Boolean).join(' · ') || '(빈 하사)';
  }

  /* ───────── 우편함 ───────── */
  const dispatchText = document.querySelector('.dispatch-text'), dispatchBadge = document.querySelector('.dispatch-badge');
  const baseText = dispatchText?.textContent || '', baseBadge = dispatchBadge?.textContent || '';
  let polling = false;
  async function poll() {
    if (!live() || polling || document.hidden) return;
    polling = true;
    try {
      const box = await call('bry_inbox');
      if (dispatchText) { dispatchText.textContent = box.notice?.body || baseText; if (dispatchBadge) dispatchBadge.textContent = box.notice?.body ? '공지' : baseBadge; }
      document.querySelectorAll('[data-community="dm"],[data-community-tab="dm"]').forEach((b) => { if (box.unread > 0) b.dataset.unread = String(box.unread); else delete b.dataset.unread; });
      const api = App.playApi();
      if (api && App.profile() && box.grants?.length) {
        for (const g of box.grants) {
          const c = await call('bry_inbox_claim', { p_id: g.id }); // 서버가 '받았다'고 적은 뒤에만 넣는다(두 번 받지 않게)
          if (!c.ok) continue;
          const p = g.payload || {};
          const items = Object.fromEntries(Object.entries(p.items || {}).map(([id, n]) => [id, Math.max(1, Math.min(999, Math.floor(Number(n)) || 1))]));
          if (p.edit) { // vC.07.5 관리자가 상태를 고쳤다
            const done = api.adminEdit?.(p.edit, '관리자');
            setTimeout(() => App.renderStatus?.(), 400);
            App.ding?.('notice');
            toast('관리자', Array.isArray(done) && done.length ? `상태가 고쳐졌다: ${done.join(' · ')}${g.note ? ` — ${g.note}` : ''}` : '관리자가 상태를 확인했다.');
            continue;
          }
          if (g.gift_from === '벼룩시장') { // vD.03 벼룩시장: 판 대금 · 산 물건(거스름돈) · 거둔 물건
            const names = itemNames();
            const sold = Object.entries(p.sold || {}).map(([id, n]) => `${names[id] || id} ×${n}`).join(' · ');
            const text = p.sold ? `팔렸다 — ${sold} → ${Math.floor(Number(p.money) || 0)}냥` : `${g.note || '벼룩시장'} — ${payloadText({ items: p.items, money: p.money })}`;
            api.grant({ money: Math.floor(Number(p.money) || 0), items, log: `[벼룩시장] ${text}` });
            toast('벼룩시장', text); App.ding?.('gift');
            window.dispatchEvent(new CustomEvent('biryeong:market-mail'));
            continue;
          }
          const kind = g.gift_from ? `${g.gift_from}님의 선물` : '하사'; // vC.06 다른 사람이 보낸 선물
          if (Array.isArray(p.psychics) && p.psychics.length) api.adminEdit?.({ psychicsAdd: p.psychics }, g.gift_from || '관리자'); // vC.07.5 영능력 하사
          api.grant({ money: Math.floor(Number(p.money) || 0), spirit: Math.floor(Number(p.spirit) || 0), items, log: `${kind}을(를) 받았다. (${payloadText(p)})${g.note ? ` — ${g.note}` : ''}` });
          toast(g.gift_from ? '선물' : '하사', `${g.gift_from ? `${g.gift_from}님이 보냈다: ` : ''}${payloadText(p)}${g.note ? ` — ${g.note}` : ''}`);
          App.ding?.('gift'); // vD.01 선물 · 하사는 언제나 띠링
          if (g.gift_from && items['friendship-letter']) toast('친구', `${g.gift_from}님과 친구가 됐다. (내 기록 → 친구 목록)`); // vD.04.2 우정 편지
        }
        App.renderStatus?.();
        Auth.pushSave();
      }
    } catch (e) {
      if (e.code === 'banned' || e.code === 'login_required') location.reload(); // auth.js 가 다시 확인하고 내보낸다
    } finally { polling = false; }
  }
  if (live()) { setTimeout(poll, 2500); setInterval(() => { if (!document.hidden && !Auth.idle?.()) poll(); }, 300000); /* vD.04.3 자리를 비운 동안엔 묻지 않는다 */ /* vD.01: 받을 우편 · 밀담 수는 접속 확인(25초)이 알려 준다 — 여기는 공지만 5분마다 */ document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); }

  /* ───────── 서버 관리 ───────── */
  const field = (label, input) => { const w = h('label', 'admin-num'); w.append(h('span', '', label), input); return w; };
  const input = (type, placeholder, value = '') => { const i = h('input'); i.type = type; i.placeholder = placeholder || ''; i.value = value; return i; };
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast('서버 관리', e.message); } };

  function renderAdmin(body) {
    if (!Auth.server) {
      body.append(para('서버(Supabase)가 연결되지 않았다. 연결하면 이 탭에서 전체 회원 · 하사 · 공지 · 밀담 감사 · 감사 기록을 다룬다.'),
        para('연결 순서 — ① Supabase 에서 supabase/schema.sql 실행 ② 관리자 코드 한 줄 등록 ③ GitHub 저장소 Variables 에 SUPABASE_URL · SUPABASE_KEY. 자세한 것은 supabase/README.md'));
      return;
    }
    if (!Auth.token()) { body.append(para('서버 계정으로 로그인되어 있지 않다. 로그아웃한 뒤 다시 로그인해 주세요.')); return; }
    const state = h('p', 'panel-fine', '서버 상태를 확인하는 중…'); body.append(state);
    Auth.rpc('bry_status').then((s) => { state.textContent = `서버 연결됨 · 표 판 ${s.version}${s.admin_code_set ? '' : ' · ⚠ 관리자 코드가 아직 서버에 등록되지 않았다(README 2번)'}`; }).catch((e) => { state.textContent = e.message; });

    /* 공지 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '속보 띠 — 첫 화면 위쪽 띠에 짧게 뜬다 (게시판 공지사항은 첫 화면 왼쪽 [공지사항] 탭에서 쓴다)'));
    const nf = h('form', 'admin-form server-form'); const nIn = h('textarea'); nIn.maxLength = 300; nIn.rows = 2; nIn.placeholder = '비워서 저장하면 공지를 내리고 원래 속보로 돌아간다';
    const nSave = h('button', 'solid-btn', '공지 저장'); nSave.type = 'submit'; nf.append(nIn, nSave); body.append(nf);
    call('bry_inbox').then((b) => { nIn.value = b.notice?.body || ''; }).catch(() => {});
    nf.addEventListener('submit', guard(async (e) => { e.preventDefault(); await call('bry_admin_notice', { p_body: nIn.value }); toast('서버 관리', nIn.value.trim() ? '공지를 올렸다.' : '공지를 내렸다.'); poll(); }));

    /* vD.02.3 팝업 공지 — 지금 접속해 있는 사람의 화면 가운데에 한 번 뜬다 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '팝업 공지 — 지금 접속해 있는 사람(정한 시간 안에 들어오는 사람 포함)의 화면에 한 번 뜬다. 예: 「단장했으니 새로고침 해 주세요!」'));
    const pf = h('form', 'admin-form server-form'); const pIn = h('textarea'); pIn.maxLength = 400; pIn.rows = 2; pIn.placeholder = '띄울 말 (비우고 보내면 떠 있는 팝업을 거둔다)'; pIn.value = '단장했으니 새로고침 해 주세요!';
    const pRow = h('div', 'admin-grid'); const pReload = input('checkbox'); pReload.checked = true; const pReloadLab = h('label', '', ' [지금 새로고침] 단추 함께'); pReloadLab.prepend(pReload);
    const pMin = h('select'); [[10, '10분 동안'], [30, '30분 동안'], [60, '1시간 동안'], [180, '3시간 동안']].forEach(([v, t]) => pMin.append(new Option(t, String(v), false, v === 30)));
    pRow.append(pReloadLab, pMin);
    const pSend = h('button', 'solid-btn', '지금 띄우기'); pSend.type = 'submit'; pf.append(pIn, pRow, pSend); body.append(pf);
    pf.addEventListener('submit', guard(async (e) => { e.preventDefault(); const r = await call('bry_admin_popup', { p_body: pIn.value, p_reload: pReload.checked, p_minutes: Number(pMin.value) }); toast('서버 관리', r.cleared ? '떠 있던 팝업을 거뒀다.' : '팝업 공지를 띄웠다. 접속 중인 사람에게 30초 안에 뜬다.'); }));

    /* 하사 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '하사 — 학생에게 냥 · 영력 · 아이템 · 영능력을 보낸다(받는 사람이 접속하면 들어간다)'));
    const gf = h('form', 'admin-form server-form'); const grid = h('div', 'admin-grid');
    const gWho = input('text', '비우면 모두에게'), gMoney = input('number', '0', '0'), gSpirit = input('number', '0', '0'), gCount = input('number', '1', '1'), gNote = input('text', '받는 사람에게 보이는 말');
    const gItem = h('select'); gItem.append(new Option('(아이템 없음)', ''));
    (App.playApi()?.admin?.items || []).forEach((x) => gItem.append(new Option(x.name, x.id)));
    gNote.maxLength = 200; [gMoney, gSpirit].forEach((i) => { i.min = 0; i.max = 9999999; }); gCount.min = 1; gCount.max = 999;
    const gPsy = h('select'); gPsy.append(new Option('(영능력 없음)', '')); // vC.07.5 영능력 하사
    (App.playApi()?.psychicDefs?.() || []).slice().sort((a, b) => (a.stolen - b.stolen) || String(a.name || a.id).localeCompare(String(b.name || b.id), 'ko')).forEach((x) => gPsy.append(new Option(`${x.name}${x.stolen ? ' (빼앗은 영능력)' : ''}`, x.id)));
    grid.append(field('받는 아이디', gWho), field('냥', gMoney), field('영력', gSpirit), field('아이템', gItem), field('수량', gCount), field('영능력', gPsy), field('한마디', gNote));
    const gSend = h('button', 'solid-btn', '하사 보내기'); gSend.type = 'submit'; gf.append(grid, gSend); body.append(gf);
    const gList = h('div', 'codex-list admin-grant-list'); gList.setAttribute('aria-label', '보낸 하사 목록'); body.append(gList); // vD.02.1 네모 칸 안에서 스크롤
    const drawGrants = guard(async () => {
      const { grants } = await call('bry_admin_grants'); gList.replaceChildren();
      if (!grants.length) gList.append(para('보낸 하사가 없다.'));
      grants.forEach((g) => {
        const r = h('div', 'codex-row is-got'), t = h('div', 'codex-text');
        t.append(h('strong', '', `${g.target ? `@${g.target}` : '모두에게'} — ${payloadText(g.payload)}`), h('p', '', `${when(g.created_at)} · ${g.by} · 받은 사람 ${g.claimed}명${g.note ? ` · “${g.note}”` : ''}`));
        const side = h('div', 'codex-side admin-side'); side.append(btn('ghost-btn codex-use', '거두기', guard(async () => { if (!window.confirm('아직 받지 않은 사람은 받지 못하게 된다. 거둘까요?')) return; await call('bry_admin_grant_cancel', { p_id: g.id }); drawGrants(); })));
        r.append(h('span', 'codex-mark', '◆'), t, side); gList.append(r);
      });
    });
    gf.addEventListener('submit', guard(async (e) => {
      e.preventDefault();
      const payload = {}; const m = Math.floor(Number(gMoney.value) || 0), sp = Math.floor(Number(gSpirit.value) || 0);
      if (m > 0) payload.money = m; if (sp > 0) payload.spirit = sp;
      if (gItem.value) payload.items = { [gItem.value]: Math.max(1, Math.min(999, Math.floor(Number(gCount.value) || 1))) };
      if (gPsy.value) payload.psychics = [gPsy.value];
      if (!Object.keys(payload).length) { toast('서버 관리', '보낼 것을 하나 이상 적어 주세요.'); return; }
      const who = gWho.value.trim().replace(/^@/, '');
      if (!who && !window.confirm('받는 아이디가 비어 있다. 모든 학생에게 보낼까요?')) return;
      await call('bry_admin_grant', { p_username: who, p_payload: payload, p_note: gNote.value.trim() });
      toast('서버 관리', `${who ? `@${who}` : '모두'}에게 하사를 보냈다.`); gMoney.value = gSpirit.value = '0'; gItem.value = ''; gNote.value = ''; drawGrants(); poll();
    }));
    drawGrants();

    /* vD.04 카페 정산 내역 */
    if (window.BiryeongCafe) window.BiryeongCafe.admin(body);

    /* vD.04.1 우편함 엿보기 — 학생끼리 주고받은 선물 · 한마디 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '우편함 엿보기 — 학생끼리 주고받은 선물과 함께 보낸 한마디(최근 500통). 열면 감사 기록에 남는다'));
    const gsBar = h('div', 'cafe-admin-bar'); const gsQ = input('search', '찾기 (보낸 사람 · 받는 사람 · 한마디 · 물건)'); gsQ.dataset.giftSpySearch = '';
    const gsLoad = btn('ghost-btn', '열어 보기', () => drawGifts()); gsLoad.dataset.giftSpyLoad = '';
    gsBar.append(gsQ, gsLoad);
    const gsSum = h('p', 'cafe-sum'); const gsList = h('div', 'codex-list admin-scroll'); gsList.dataset.giftSpy = ''; gsList.setAttribute('aria-label', '학생끼리 주고받은 선물');
    gsList.append(para('[열어 보기]를 누르면 불러온다.'));
    body.append(gsBar, gsSum, gsList);
    let gsRows = null;
    const gsWho = (name, user, extra) => `${name || '(이름 없음)'}${user ? ` @${user}` : ''}${extra ? ` (${extra})` : ''}`;
    const gsDraw = () => {
      if (!gsRows) return;
      const t = gsQ.value.trim().toLowerCase();
      const text = (g) => [g.from_name, g.from_user, g.to_user, g.to_display, g.to_name, g.note, payloadText(g.payload || {})].join(' ').toLowerCase();
      const shown = gsRows.filter((g) => !t || text(g).includes(t));
      gsSum.textContent = `${shown.length}통${shown.length !== gsRows.length ? ` (전체 ${gsRows.length}통)` : ''}`;
      gsList.replaceChildren();
      if (!shown.length) { gsList.append(para(gsRows.length ? '찾는 선물이 없다.' : '아직 학생끼리 주고받은 선물이 없다.')); return; }
      shown.forEach((g) => {
        const r = h('div', 'codex-row is-got'); r.dataset.giftSpyRow = String(g.id); const tx = h('div', 'codex-text');
        tx.append(h('strong', '', `${gsWho(g.from_name, g.from_user)} → ${gsWho(g.to_name || g.to_display, g.to_user)}`),
          h('p', '', `${when(g.at)} · 보낸 것: ${payloadText(g.payload || {}) || '없음'} · ${g.claimed_at ? `받음 ${when(g.claimed_at)}` : '아직 받지 않음'}`));
        if (g.note) tx.append(h('p', 'gift-spy-note', `“${g.note}”`));
        r.append(h('span', 'codex-mark', '✉'), tx); gsList.append(r);
      });
    };
    const drawGifts = guard(async () => { gsList.replaceChildren(para('불러오는 중…')); ({ rows: gsRows } = await call('bry_admin_gifts')); gsDraw(); });
    gsQ.addEventListener('input', gsDraw);

    /* V.01 비밀번호 재설정 요청 — 로그인 화면의 [비밀번호를 잊었어요]. 임시 비밀번호를 본인에게 전해 준다 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '비밀번호 재설정 요청 — 본인이 맞는지 확인한 뒤 임시 비밀번호를 전해 주세요. 임시 비밀번호로 들어오면 곧바로 새 비밀번호를 정한다(3일 뒤 사라진다)'));
    const rList = h('div', 'codex-list scroll-box admin-reset-list'); rList.setAttribute('aria-label', '비밀번호 재설정 요청'); rList.dataset.pwResets = ''; body.append(rList);
    const drawResets = guard(async () => {
      const { resets } = await call('bry_admin_pw_resets'); rList.replaceChildren();
      if (!resets.length) rList.append(para('들어온 요청이 없다.'));
      resets.forEach((x) => {
        const r = h('div', `codex-row${x.used_at ? '' : ' is-got'}`), t = h('div', 'codex-text');
        const pw = h('code', 'admin-temp-pw', x.temp_pw); pw.dataset.tempPw = x.username;
        const top = h('strong', '', `@${x.username}${x.name ? ` · ${x.name}` : ''} — 임시 비밀번호 `); top.append(pw);
        t.append(top, h('p', '', `${when(x.requested_at)} 요청 · ${x.used_at ? `${when(x.used_at)}에 임시 비밀번호로 들어옴(새 비밀번호를 정하는 중)` : `아직 쓰지 않음 · ${when(x.expires_at)}까지`}`));
        const side = h('div', 'codex-side admin-side');
        side.append(btn('ghost-btn codex-use', '복사', () => { try { navigator.clipboard?.writeText(x.temp_pw); toast('서버 관리', '임시 비밀번호를 복사했다.'); } catch (_) { /* 무시 */ } }));
        side.append(btn('ghost-btn codex-use', '지우기', guard(async () => { if (!window.confirm(`@${x.username} 의 요청을 지울까요? (임시 비밀번호를 쓸 수 없게 된다)`)) return; await call('bry_admin_pw_reset_clear', { p_username: x.username }); drawResets(); })));
        r.append(h('span', 'codex-mark', '◇'), t, side); rList.append(r);
      });
    });
    drawResets();

    /* 회원 */
    body.append(h('div', 'panel-rule'));
    const uLabel = h('p', 'panel-label', '회원'); const uList = h('div', 'codex-list scroll-box admin-user-list'); uList.setAttribute('aria-label', '회원 목록');
    // V.01 회원이 많아도 아래로 끝없이 늘어나지 않게: 네모 칸 안에서 스크롤 + 이름 · 아이디로 찾기
    const uFind = h('input', 'admin-find'); uFind.type = 'search'; uFind.placeholder = '이름 · 아이디로 찾기'; uFind.setAttribute('aria-label', '회원 찾기');
    uFind.addEventListener('input', () => { const q = uFind.value.trim().toLowerCase(); uList.querySelectorAll('[data-user-row]').forEach((r) => { r.hidden = !!q && !r.dataset.userRow.includes(q); }); });
    body.append(uLabel, uFind, uList);
    const me = Auth.session();
    const setUser = (u, action, value, done) => guard(async () => { await call('bry_admin_user_set', { p_username: u.username, p_action: action, p_value: String(value ?? '') }); toast('서버 관리', done); drawUsers(); })();
    const askDays = (text) => { const v = window.prompt(`${text}\n며칠 동안? (숫자, 0 = 해제)`, '1'); if (v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
    const active = (v) => v && new Date(v) > new Date();
    const drawUsers = guard(async () => {
      const { users } = await call('bry_admin_users'); uList.replaceChildren();
      uLabel.textContent = `회원 — ${users.length}명 · 지금 접속 ${users.filter((u) => u.online).length}명`;
      users.forEach((u) => {
        const r = h('div', 'codex-row is-got'), t = h('div', 'codex-text'), self = u.username === me;
        r.dataset.userRow = `${u.display_name || ''} ${u.username} ${u.name || ''}`.toLowerCase();
        t.append(h('strong', '', `${u.online ? '● ' : ''}${u.display_name} @${u.username}${self ? ' (나)' : ''}${u.role === 'admin' ? ' · 관리자' : ''}${u.chat_title ? ` · 「${u.chat_title}」` : ''}`),
          h('p', '', `${u.name ? `학생 이름 ${u.name} · ` : ''}본편 장면 ${u.scenes}개 · 글 ${u.writes}개 · 가입 ${when(u.created_at)} · 최근 접속 ${when(u.last_seen)} · 기록 ${u.save_at ? when(u.save_at) : '없음'}`));
        if (active(u.banned_until) || active(u.muted_until)) t.append(h('p', 'server-flag', [active(u.banned_until) ? `계정 정지 ~${when(u.banned_until)}` : '', active(u.muted_until) ? `글쓰기 정지 ~${when(u.muted_until)}` : ''].filter(Boolean).join(' · ')));
        const side = h('div', 'codex-side admin-side');
        side.append(btn('ghost-btn codex-use', '칭호', () => { const v = window.prompt(`@${u.username} 이름 옆에 달 칭호 (20자까지, 비우면 뗀다)`, u.chat_title || ''); if (v != null) setUser(u, 'chat_title', v.trim(), '칭호를 고쳤다.'); }));
        side.append(btn('ghost-btn codex-use', '기록 보기', () => showSave(u)));
        side.append(btn('ghost-btn codex-use', '상태 고치기', () => editState(u))); // vC.07.5
        side.append(btn('ghost-btn codex-use', '글쓰기 정지', () => { const d = askDays(`@${u.username} 의 글쓰기(낮새 · 밤쥐 · 급식실)를 막는다.`); if (d != null) setUser(u, 'mute', d, d ? `${d}일 동안 글쓰기를 막았다.` : '글쓰기 정지를 풀었다.'); }));
        side.append(btn('ghost-btn codex-use', '비밀번호 초기화', () => { const pw = window.prompt(`@${u.username} 의 새 비밀번호 (4자 이상)`); if (pw != null) setUser(u, 'password', pw, '비밀번호를 바꿨다. 그 계정은 다시 로그인해야 한다.'); }));
        if (!self) {
          side.append(btn('ghost-btn codex-use', u.role === 'admin' ? '관리자 해제' : '관리자 지정', () => setUser(u, 'role', u.role === 'admin' ? 'user' : 'admin', '역할을 바꿨다.')));
          side.append(btn('ghost-btn codex-use', active(u.banned_until) ? '정지 해제' : '계정 정지', () => { const d = active(u.banned_until) ? 0 : askDays(`@${u.username} 계정을 정지한다(로그인할 수 없다).`); if (d != null) setUser(u, 'ban', d, d ? `${d}일 동안 정지했다.` : '정지를 풀었다.'); }));
          side.append(btn('ghost-btn codex-use', '계정 삭제', () => { if (window.confirm(`@${u.username} 계정과 그 기록 · 글 · 밀담을 모두 지울까요? 되돌릴 수 없습니다.`)) setUser(u, 'delete', '', '계정을 지웠다.'); }));
        }
        r.append(h('span', 'codex-mark', u.role === 'admin' ? '◆' : '◇'), t, side); uList.append(r);
      });
    });
    const saveBox = h('div', 'server-save'); saveBox.hidden = true; body.append(saveBox);
    const showSave = guard(async (u) => {
      const s = await call('bry_admin_save', { p_username: u.username }); const g = s.game || {}, p = s.profile || {};
      saveBox.hidden = false; saveBox.replaceChildren(h('p', 'panel-label', `@${u.username} 의 기록 — ${when(s.updated_at)} (열람이 감사 기록에 남는다)`));
      const rows = [['이름', p.name], ['나이 · 성별', [p.age, p.gender].filter(Boolean).join(' · ')], ['한줄소개', p.intro || p.bio], ['체력 · 의지력 · 영력', [g.hp != null ? `${Math.floor(g.hp)}/${g.hpMax}` : '', g.mp != null ? `${Math.floor(g.mp)}/${g.mpMax}` : '', g.spirit != null ? Math.floor(g.spirit) : ''].filter((x) => x !== '').join(' · ')], ['소지금', g.money != null ? `${Math.floor(g.money)}냥` : ''],
        ['육조 스탯', g.stats ? Object.entries(g.stats).map(([k, v]) => `${k} ${v}`).join(' · ') : ''], ['소지품', g.inventory ? `${Object.keys(g.inventory).filter((k) => g.inventory[k] > 0).length}종` : ''], ['칭호 · 업적', `${Object.keys(s.titles || {}).length}개 · ${Object.keys(s.achievements || {}).length}개`]];
      const dl = h('dl', 'server-dl'); rows.forEach(([k, v]) => { if (v) dl.append(h('dt', '', k), h('dd', '', String(v))); });
      if (!s.profile) saveBox.append(para('⚠ 이 기록에는 프로필이 없다(빈 기록). 아래 [남겨 둔 기록]에서 되돌리거나, 진행 기록이 남아 있는 기기로 접속하면 그 기록이 다시 올라간다.'));
      saveBox.append(dl);
      // V.01 남겨 둔 기록(덮어쓰기 전, 한 시간에 한 벌 · 최근 12벌)으로 되돌리기
      const bk = s.backups || []; const bl = h('div', 'codex-list scroll-box'); bl.dataset.saveBackups = String(bk.length);
      saveBox.append(h('p', 'panel-label', `남겨 둔 기록 ${bk.length}벌 — 되돌리면 지금 기록도 한 벌 남긴다. 그 학생 화면은 1분 안에 받아 간다.`), bl);
      if (!bk.length) bl.append(para('아직 남겨 둔 기록이 없다. (V.01 기록 지킴을 적용한 뒤부터 쌓인다)'));
      bk.forEach((b) => {
        const r = h('div', 'codex-row is-got'), t = h('div', 'codex-text');
        t.append(h('strong', '', `${when(b.saved_at)} 기록`), h('p', '', [b.name ? `이름 ${b.name}` : '', b.money != null ? `${Number(b.money).toLocaleString()}냥` : '', b.spirit != null ? `영력 ${b.spirit}` : ''].filter(Boolean).join(' · ')));
        const side = h('div', 'codex-side admin-side');
        side.append(btn('ghost-btn codex-use', '이 기록으로 되돌리기', guard(async () => {
          if (!window.confirm(`@${u.username} 의 기록을 ${when(b.saved_at)} 의 것으로 되돌릴까요?`)) return;
          await call('bry_admin_save_restore', { p_username: u.username, p_backup: b.id }); toast('서버 관리', '기록을 되돌렸다. 그 학생 화면이 1분 안에 받아 간다.'); showSave(u);
        })));
        r.append(h('span', 'codex-mark', '◇'), t, side); bl.append(r);
      });
      saveBox.append(btn('ghost-btn', '닫기', () => { saveBox.hidden = true; }));
      saveBox.scrollIntoView({ block: 'nearest' });
    });
    // vC.07.5 상태 고치기: 육조 스탯 · 체력 · 의지력 · 영력 · 쇠약 · 몸의 이상 · 영능력
    const editBox = h('div', 'server-save admin-edit'); editBox.hidden = true; body.append(editBox);
    const editState = guard(async (u) => {
      const s = await call('bry_admin_save', { p_username: u.username }); const g = s.game || {};
      const api = App.playApi(); const R = window.BIRYEONG_DATA?.rules || {};
      const AIL = api?.ailmentDefs?.() || [], PSY = api?.psychicDefs?.() || [];
      editBox.hidden = false; editBox.replaceChildren(h('p', 'panel-label', `@${u.username} 상태 고치기 — 기록 ${when(s.updated_at)} 기준. 바꾼 칸만 보낸다. 그 학생이 접속해 있으면 25초 안에, 아니면 다음 접속 때 적용된다.`));
      const form = h('form', 'admin-form server-form'); const grid = h('div', 'admin-grid'); const ins = {};
      const numIn = (key, label, val, min, max) => { const i = input('number', '', val ?? ''); i.min = min; i.max = max; i.dataset.orig = String(val ?? ''); ins[key] = i; grid.append(field(label, i)); };
      (R.statKeys || ['insight', 'aggression', 'endurance', 'control', 'agility', 'comprehension']).forEach((k) => numIn(`stat:${k}`, R.stats?.[k]?.label || k, Math.floor(g.stats?.[k] ?? 1), 1, 99));
      numIn('hp', '체력', Math.floor(g.hp ?? 100), 0, 999); numIn('hpMax', '최대 체력', g.hpMax ?? 100, 1, 999);
      numIn('mp', '의지력', Math.floor(g.mp ?? 100), 0, 999); numIn('mpMax', '최대 의지력', g.mpMax ?? 100, 1, 999);
      numIn('spirit', '영력', Math.floor(g.spirit ?? 0), 0, 99999);
      const now = Date.now(), weakOn = Math.max(g.weakUntil || 0, g.curseUntil || 0) > now;
      const weak = h('select'); [['', weakOn ? `그대로(걸려 있음 · ${Math.ceil((Math.max(g.weakUntil || 0, g.curseUntil || 0) - now) / 3600000)}시간 남음)` : '그대로(없음)'], ['clear', '풀기'], ['1', '1시간 걸기'], ['6', '6시간 걸기'], ['24', '24시간 걸기']].forEach(([v, t]) => weak.append(new Option(t, v)));
      grid.append(field('쇠약', weak));
      form.append(grid, h('p', 'panel-label', '몸의 이상 — 「걸기」는 분 · 겹을 정해 새로 건다'));
      const ag = h('div', 'admin-grid admin-ail'); const ailIns = [];
      AIL.forEach((a) => {
        const cur = g.ailments?.[a.id]; const live = cur && cur.until > now;
        const sel = h('select'); [['', live ? `그대로(${a.max > 1 ? `${cur.stack}겹 · ` : ''}${Math.ceil((cur.until - now) / 60000)}분)` : '그대로(없음)'], ['clear', '풀기'], ['set', '걸기']].forEach(([v, t]) => sel.append(new Option(t, v)));
        const min = input('number', '분', String(a.minutes)); min.min = 1; min.max = 1440; min.style.width = '64px';
        const st = input('number', '겹', '1'); st.min = 1; st.max = a.max; st.style.width = '48px'; st.disabled = a.max <= 1;
        const w = h('label', 'admin-num'); w.title = a.effect; w.append(h('span', '', `${a.name}${a.heavy ? ' ●' : ''}`), sel, min, st); ag.append(w);
        ailIns.push({ a, sel, min, st });
      });
      form.append(ag, h('p', 'panel-label', '영능력 — 체크 = 가지고 있음(체크를 풀면 거둔다)'));
      const pg = h('div', 'admin-psy'); const had = new Set(g.psychics || []); const psyIns = [];
      PSY.slice().sort((a, b) => (a.stolen - b.stolen) || String(a.name || a.id).localeCompare(String(b.name || b.id), 'ko')).forEach((x) => { const l = h('label', 'admin-check'); const c = h('input'); c.type = 'checkbox'; c.checked = had.has(x.id); l.append(c, ` ${x.name}${x.stolen ? '·' : ''}`); pg.append(l); psyIns.push({ x, c }); });
      const note = input('text', '학생에게 보이는 말(선택)'); note.maxLength = 200;
      const send = h('button', 'solid-btn', '고친 내용 보내기'); send.type = 'submit';
      form.append(pg, field('한마디', note), send, btn('ghost-btn', '닫기', () => { editBox.hidden = true; }));
      form.addEventListener('submit', guard(async (e) => {
        e.preventDefault();
        const ed = {}; const stats = {};
        for (const [key, i] of Object.entries(ins)) { if (i.value === '' || i.value === i.dataset.orig) continue; const v = Math.floor(Number(i.value)); if (!Number.isFinite(v)) continue; if (key.startsWith('stat:')) stats[key.slice(5)] = v; else ed[key] = v; }
        if (Object.keys(stats).length) ed.stats = stats;
        if (weak.value) ed.weak = weak.value === 'clear' ? 'clear' : Number(weak.value);
        const set = {}, clear = [];
        ailIns.forEach(({ a, sel, min, st }) => { if (sel.value === 'clear') clear.push(a.id); if (sel.value === 'set') set[a.id] = { minutes: Math.floor(Number(min.value) || a.minutes), stack: Math.floor(Number(st.value) || 1) }; });
        if (clear.length || Object.keys(set).length) ed.ailments = { set, clear };
        const add = psyIns.filter(({ x, c }) => c.checked && !had.has(x.id)).map(({ x }) => x.id), rem = psyIns.filter(({ x, c }) => !c.checked && had.has(x.id)).map(({ x }) => x.id);
        if (add.length) ed.psychicsAdd = add; if (rem.length) ed.psychicsRemove = rem;
        if (!Object.keys(ed).length) { toast('서버 관리', '바꾼 칸이 없다.'); return; }
        if (u.username === me && api?.adminEdit) { api.adminEdit(ed, '관리자(나)'); App.renderStatus?.(); Auth.pushSave?.(); toast('서버 관리', '내 상태를 바로 고쳤다.'); editBox.hidden = true; return; }
        await call('bry_admin_edit', { p_username: u.username, p_edit: ed, p_note: note.value.trim() });
        toast('서버 관리', `@${u.username}에게 고친 내용을 보냈다. 접속해 있으면 25초 안에 적용된다.`); editBox.hidden = true;
      }));
      editBox.append(form); editBox.scrollIntoView({ block: 'nearest' });
    });
    drawUsers();

    /* 감사 기록 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '감사 기록 — 관리자가 한 일(최근 150건)'));
    const aList = h('div', 'server-audit scroll-box'); body.append(aList);
    const LABEL = { edit: '상태 고침', claim_admin: '관리자 코드로 관리자가 됨', read_dm: '밀담 열람', read_save: '기록 열람', read_gifts: '우편함 엿보기', grant: '하사', grant_cancel: '하사 거둠', notice: '공지', delete_post: '지신성 글 삭제', delete_memo: '메모 삭제', delete_comment: '댓글 삭제', delete_story: '급식실 사연 삭제', board_post: '공지사항 올림', board_delete: '공지사항 지움', note_post: '업데이트 노트 올림', note_delete: '업데이트 노트 지움',
      user_role: '역할 변경', user_ban: '계정 정지(일)', user_mute: '글쓰기 정지(일)', user_password: '비밀번호 초기화', user_chat_title: '칭호', user_delete: '계정 삭제' };
    call('bry_admin_audit').then(({ rows }) => {
      if (!rows.length) aList.append(para('아직 기록이 없다.'));
      rows.forEach((x) => aList.append(h('p', '', `${when(x.at)} · ${x.admin} · ${LABEL[x.action] || x.action}${x.target ? ` → ${x.target}` : ''}${x.detail ? ` · ${x.detail}` : ''}`)));
    }).catch((e) => aList.append(para(e.message)));
    body.append(para('밀담 감사 열람은 「밤쥐들의 터」 안의 [운영자 · 전체 대화 열람]에서, 글 삭제는 각 글의 [지우기]에서, 급식실 익명 사연은 급식실의 교내 신문에서 뗀다.'));
  }

  window.BiryeongServer = { payloadText, renderAdmin, poll };
})();
