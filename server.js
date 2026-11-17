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
  const itemNames = () => Object.fromEntries((App.playApi()?.admin?.items || []).map((x) => [x.id, x.name]));
  function payloadText(p) {
    const names = itemNames();
    return [p?.money ? `${p.money}냥` : '', p?.spirit ? `영력 ${p.spirit}` : '', ...Object.entries(p?.items || {}).map(([id, n]) => `${names[id] || id} ×${n}`)].filter(Boolean).join(' · ') || '(빈 하사)';
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
          const kind = g.gift_from ? `${g.gift_from}님의 선물` : '하사'; // vC.06 다른 사람이 보낸 선물
          api.grant({ money: Math.floor(Number(p.money) || 0), spirit: Math.floor(Number(p.spirit) || 0), items, log: `${kind}을(를) 받았다. (${payloadText(p)})${g.note ? ` — ${g.note}` : ''}` });
          toast(g.gift_from ? '선물' : '하사', `${g.gift_from ? `${g.gift_from}님이 보냈다: ` : ''}${payloadText(p)}${g.note ? ` — ${g.note}` : ''}`);
        }
        App.renderStatus?.();
        Auth.pushSave();
      }
    } catch (e) {
      if (e.code === 'banned' || e.code === 'login_required') location.reload(); // auth.js 가 다시 확인하고 내보낸다
    } finally { polling = false; }
  }
  if (live()) { setTimeout(poll, 2500); setInterval(() => { if (!document.hidden) poll(); }, 90000); /* vC.01: 가려진 탭은 묻지 않는다 · 90초마다 */ document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); }

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

    /* 하사 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '하사 — 학생에게 냥 · 영력 · 아이템을 보낸다(받는 사람이 접속하면 들어간다)'));
    const gf = h('form', 'admin-form server-form'); const grid = h('div', 'admin-grid');
    const gWho = input('text', '비우면 모두에게'), gMoney = input('number', '0', '0'), gSpirit = input('number', '0', '0'), gCount = input('number', '1', '1'), gNote = input('text', '받는 사람에게 보이는 말');
    const gItem = h('select'); gItem.append(new Option('(아이템 없음)', ''));
    (App.playApi()?.admin?.items || []).forEach((x) => gItem.append(new Option(x.name, x.id)));
    gNote.maxLength = 200; [gMoney, gSpirit].forEach((i) => { i.min = 0; i.max = 9999999; }); gCount.min = 1; gCount.max = 999;
    grid.append(field('받는 아이디', gWho), field('냥', gMoney), field('영력', gSpirit), field('아이템', gItem), field('수량', gCount), field('한마디', gNote));
    const gSend = h('button', 'solid-btn', '하사 보내기'); gSend.type = 'submit'; gf.append(grid, gSend); body.append(gf);
    const gList = h('div', 'codex-list'); body.append(gList);
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
      if (!Object.keys(payload).length) { toast('서버 관리', '보낼 것을 하나 이상 적어 주세요.'); return; }
      const who = gWho.value.trim().replace(/^@/, '');
      if (!who && !window.confirm('받는 아이디가 비어 있다. 모든 학생에게 보낼까요?')) return;
      await call('bry_admin_grant', { p_username: who, p_payload: payload, p_note: gNote.value.trim() });
      toast('서버 관리', `${who ? `@${who}` : '모두'}에게 하사를 보냈다.`); gMoney.value = gSpirit.value = '0'; gItem.value = ''; gNote.value = ''; drawGrants(); poll();
    }));
    drawGrants();

    /* 회원 */
    body.append(h('div', 'panel-rule'));
    const uLabel = h('p', 'panel-label', '회원'); const uList = h('div', 'codex-list'); body.append(uLabel, uList);
    const me = Auth.session();
    const setUser = (u, action, value, done) => guard(async () => { await call('bry_admin_user_set', { p_username: u.username, p_action: action, p_value: String(value ?? '') }); toast('서버 관리', done); drawUsers(); })();
    const askDays = (text) => { const v = window.prompt(`${text}\n며칠 동안? (숫자, 0 = 해제)`, '1'); if (v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
    const active = (v) => v && new Date(v) > new Date();
    const drawUsers = guard(async () => {
      const { users } = await call('bry_admin_users'); uList.replaceChildren();
      uLabel.textContent = `회원 — ${users.length}명 · 지금 접속 ${users.filter((u) => u.online).length}명`;
      users.forEach((u) => {
        const r = h('div', 'codex-row is-got'), t = h('div', 'codex-text'), self = u.username === me;
        t.append(h('strong', '', `${u.online ? '● ' : ''}${u.display_name} @${u.username}${self ? ' (나)' : ''}${u.role === 'admin' ? ' · 관리자' : ''}${u.chat_title ? ` · 「${u.chat_title}」` : ''}`),
          h('p', '', `${u.name ? `학생 이름 ${u.name} · ` : ''}본편 장면 ${u.scenes}개 · 글 ${u.writes}개 · 가입 ${when(u.created_at)} · 최근 접속 ${when(u.last_seen)} · 기록 ${u.save_at ? when(u.save_at) : '없음'}`));
        if (active(u.banned_until) || active(u.muted_until)) t.append(h('p', 'server-flag', [active(u.banned_until) ? `계정 정지 ~${when(u.banned_until)}` : '', active(u.muted_until) ? `글쓰기 정지 ~${when(u.muted_until)}` : ''].filter(Boolean).join(' · ')));
        const side = h('div', 'codex-side admin-side');
        side.append(btn('ghost-btn codex-use', '칭호', () => { const v = window.prompt(`@${u.username} 이름 옆에 달 칭호 (20자까지, 비우면 뗀다)`, u.chat_title || ''); if (v != null) setUser(u, 'chat_title', v.trim(), '칭호를 고쳤다.'); }));
        side.append(btn('ghost-btn codex-use', '기록 보기', () => showSave(u)));
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
      const dl = h('dl', 'server-dl'); rows.forEach(([k, v]) => { if (v) dl.append(h('dt', '', k), h('dd', '', String(v))); }); saveBox.append(dl, btn('ghost-btn', '닫기', () => { saveBox.hidden = true; }));
      saveBox.scrollIntoView({ block: 'nearest' });
    });
    drawUsers();

    /* 감사 기록 */
    body.append(h('div', 'panel-rule'), h('p', 'panel-label', '감사 기록 — 관리자가 한 일(최근 150건)'));
    const aList = h('div', 'server-audit'); body.append(aList);
    const LABEL = { claim_admin: '관리자 코드로 관리자가 됨', read_dm: '밀담 열람', read_save: '기록 열람', grant: '하사', grant_cancel: '하사 거둠', notice: '공지', delete_post: '지신성 글 삭제', delete_memo: '메모 삭제', delete_comment: '댓글 삭제', delete_story: '급식실 사연 삭제', board_post: '공지사항 올림', board_delete: '공지사항 지움', note_post: '업데이트 노트 올림', note_delete: '업데이트 노트 지움',
      user_role: '역할 변경', user_ban: '계정 정지(일)', user_mute: '글쓰기 정지(일)', user_password: '비밀번호 초기화', user_chat_title: '칭호', user_delete: '계정 삭제' };
    call('bry_admin_audit').then(({ rows }) => {
      if (!rows.length) aList.append(para('아직 기록이 없다.'));
      rows.forEach((x) => aList.append(h('p', '', `${when(x.at)} · ${x.admin} · ${LABEL[x.action] || x.action}${x.target ? ` → ${x.target}` : ''}${x.detail ? ` · ${x.detail}` : ''}`)));
    }).catch((e) => aList.append(para(e.message)));
    body.append(para('밀담 감사 열람은 「밤쥐들의 터」 안의 [운영자 · 전체 대화 열람]에서, 글 삭제는 각 글의 [지우기]에서, 급식실 익명 사연은 급식실의 교내 신문에서 뗀다.'));
  }

  window.BiryeongServer = { renderAdmin, poll };
})();
