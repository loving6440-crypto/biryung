/* 秘靈 · 비령 vC.06 — 접속자 확인하기 · 초대 · 선물 · 도깨비들의 터(일행 대화).
 *
 *   [접속자 확인하기]  머리띠의 단추. 최근 3분 안에 들어와 있던 사람들 — [초대] [선물]
 *   초대               받은 사람 화면에 작은 창이 뜬다. 받아들이면 일행이 생기고(이미 일행이 있으면 그 일행에 들어간다) 도깨비들의 터에서 대화한다.
 *   선물               내 소지품 · 냥을 덜어서 보낸다. 받는 사람은 우편함(server.js)으로 받는다.
 *   도깨비들의 터      [일행과의 대화] 지금 일행의 대화 / [다른 일행들의 대화 보기] 끝난 일행의 대화를 날짜 → 일행 → 대화 창으로.
 *                      본편 파티 전투가 둘 이상 모이면 그 파티에도 일행 대화가 붙는다(StoryParty 가 biryeong:party-room 으로 알린다).
 *   서버 함수: supabase/schema.sql 의 bry_presence · bry_online · bry_invite · bry_invite_answer · bry_room_* · bry_rooms_ended · bry_gift
 */
(() => {
  'use strict';
  const Auth = window.BiryeongAuth, App = window.BiryeongApp;
  if (!Auth || !App) { window.BiryeongPartyError = '화면 기본 파일(app.js · auth.js)을 먼저 불러오지 못했다.'; return; }
  const { h, btn, para, toast } = App;
  const $ = (s) => document.querySelector(s);
  const live = () => !!(Auth.server && Auth.token());
  const call = (name, args) => Auth.call(name, args);
  const me = () => Auth.user?.()?.username || Auth.session?.() || '';
  const kst = (v, withDate = false) => { try { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...(withDate ? { month: '2-digit', day: '2-digit' } : {}), hour: '2-digit', minute: '2-digit' }).format(new Date(v)); } catch (_) { return ''; } };
  const ERR = { not_found: '대상을 찾을 수 없다(이미 끝났거나 나간 사람).', party_full: '일행이 가득 찼다(6명).', already_member: '이미 같은 일행이다.', too_many_requests: '너무 자주 했다. 잠시 뒤에 다시.', muted: '지금은 글을 쓸 수 없는 상태다.', invalid_post: '1~500자로 적는다.', invalid_value: '보낼 수 없는 내용이다.', login_required: '로그인이 필요하다.' };
  const errText = (e) => ERR[e?.code] || e?.message || '서버에 닿지 못했다.';

  /* ───────── 창 만들기 ───────── */
  function dialog(id, title, overline) {
    const d = h('dialog', 'community-dialog party-dialog'); d.id = id;
    const w = h('div', 'community-window');
    const head = h('header', 'community-window-head');
    const t = h('div'); t.append(h('span', 'community-overline', overline), h('h2', '', title));
    const x = btn('community-close', '✕', () => d.close()); x.setAttribute('aria-label', `${title} 닫기`);
    head.append(t, x);
    const tabs = h('nav', 'community-tabs'); const body = h('div', 'community-content party-body');
    w.append(head, tabs, body); d.append(w);
    d.addEventListener('click', (e) => { if (e.target === d && !d.classList.contains('party-dock')) d.close(); });
    document.body.append(d);
    return { d, tabs, body, head };
  }
  const openDlg = (d) => { if (!d.open) { try { d.showModal(); } catch (_) { d.setAttribute('open', ''); } } };
  const need = (body) => {
    if (!Auth.server) { body.replaceChildren(para('서버(Supabase)가 연결되지 않아 접속자 · 일행 대화를 쓸 수 없다.')); return false; }
    if (!Auth.token()) { body.replaceChildren(para('로그인해야 쓸 수 있다.')); return false; }
    return true;
  };

  /* ───────── 접속자 확인하기 ───────── */
  const online = dialog('onlineDialog', '접속자 확인하기', '在席 / WHO IS HERE');
  online.tabs.remove();
  async function renderOnline() {
    const body = online.body;
    if (!need(body)) return;
    body.replaceChildren(para('불러오는 중…'));
    try {
      const r = await call('bry_online');
      const list = h('ul', 'online-list');
      // vC.06 나는 언제나 맨 위(서버가 늦게 고쳐도 빠지지 않게)
      let users = (r.users || []).slice();
      const mine = users.find((u) => u.me) || (() => { const p = App.profile?.() || {}; return { me: true, username: me(), display_name: p.name || me() }; })();
      users = [mine, ...users.filter((u) => !u.me && u.username !== mine.username)];
      for (const u of users) {
        const li = h('li', `online-row${u.me ? ' is-me' : ''}`);
        const av = h('span', 'online-avatar', u.avatar_symbol || '✦'); av.style.color = u.accent || '';
        const who = h('button', 'online-who'); who.type = 'button'; who.title = '프로필 보기';
        who.append(h('b', '', u.display_name || u.username), h('small', '', `@${u.username}${u.chat_title ? ` · ${u.chat_title}` : ''}${u.in_room ? ' · 일행 중' : ''}`));
        who.addEventListener('click', () => openCard(u)); av.addEventListener('click', () => openCard(u)); av.style.cursor = 'pointer';
        li.append(av, who);
        if (u.me) li.append(h('span', 'online-me', '나'));
        else {
          const acts = h('div', 'online-acts');
          const lead = room ? (room.leader ?? room.members?.[0]?.u) : null, full = room && room.members.length >= 3, inRoom = room && room.members.some((x) => x.u === u.username);
          const inv = btn('ghost-btn', inRoom ? '일행' : '초대', () => invite(u));
          if (inRoom || (room && lead !== me()) || full) { inv.disabled = true; inv.title = inRoom ? '이미 같은 일행이다' : full ? '일행은 세 명까지다' : '더 초대하기는 파티장만 할 수 있다'; } // vD.02
          acts.append(inv, btn('ghost-btn', '선물', () => openGift(u)));
          li.append(acts);
        }
        list.append(li);
      }
      body.replaceChildren(para(`지금 들어와 있는 사람 ${users.length}명 (최근 3분 안에 움직인 사람). 이름을 누르면 프로필이 보인다.`), list, btn('ghost-btn online-refresh', '새로고침', renderOnline));
    } catch (e) { body.replaceChildren(para(errText(e))); }
  }
  async function invite(u) {
    try { await call('bry_invite', { p_username: u.username }); toast('초대', `${u.display_name || u.username}에게 일행 초대를 보냈다. (10분 동안 유효)`); }
    catch (e) { toast('초대', errText(e)); }
  }
  function openOnline() { openDlg(online.d); renderOnline().catch((e) => { online.body.replaceChildren(para(errText(e))); }); }

  /* ───────── vD.04.2 친구 목록: 우정 편지를 보냈거나 받은 상대 ───────── */
  const friends = dialog('friendsDialog', '친구 목록', '友 / FRIENDS');
  friends.tabs.remove(); friends.d.classList.add('party-small');
  const ago = (v) => { const m = Math.floor((Date.now() - Date.parse(v)) / 60000); if (!Number.isFinite(m)) return ''; if (m < 60) return `${Math.max(1, m)}분 전`; if (m < 1440) return `${Math.floor(m / 60)}시간 전`; return `${Math.floor(m / 1440)}일 전`; };
  async function renderFriends() {
    const body = friends.body;
    if (!need(body)) return;
    body.replaceChildren(para('불러오는 중…'));
    try {
      const r = await call('bry_friends');
      const fs = r.friends || [];
      const intro = para('우정 편지를 보냈거나 받은 사람이 서로의 친구가 된다. 이름을 누르면 프로필이 보인다.');
      if (!fs.length) { body.replaceChildren(intro, para('아직 친구가 없다. 매점에서 [우정 편지]를 사서 [접속자 확인하기 → 선물]로 보내 보자.'), btn('ghost-btn online-refresh', '새로고침', renderFriends)); return; }
      const list = h('ul', 'online-list friend-list'); list.dataset.friendList = '';
      for (const u of fs) {
        const li = h('li', `online-row${u.online ? ' is-online' : ''}`); li.dataset.friend = u.username;
        const av = h('span', 'online-avatar', u.avatar_symbol || '✦'); av.style.color = u.accent || ''; av.style.cursor = 'pointer';
        const who = h('button', 'online-who'); who.type = 'button'; who.title = '프로필 보기';
        who.append(h('b', '', u.name || u.display_name || u.username), h('small', '', `@${u.username}${u.chat_title ? ` · ${u.chat_title}` : ''} · 친구가 된 지 ${ago(u.since)}`));
        who.addEventListener('click', () => openCard(u)); av.addEventListener('click', () => openCard(u));
        const st = h('span', `friend-state${u.online ? ' is-on' : ''}`, u.online ? '● 접속 중' : `○ ${u.seen ? `${ago(u.seen)} 접속` : '접속 기록 없음'}`); st.dataset.friendOnline = u.online ? '1' : '0';
        li.append(av, who, st);
        list.append(li);
      }
      body.replaceChildren(intro, h('p', 'friend-count', `친구 ${fs.length}명 · 지금 접속 ${fs.filter((u) => u.online).length}명`), list, btn('ghost-btn online-refresh', '새로고침', renderFriends));
    } catch (e) { body.replaceChildren(para(errText(e))); }
  }
  function openFriends() { openDlg(friends.d); renderFriends().catch((e) => { friends.body.replaceChildren(para(errText(e))); }); }

  /* ───────── 프로필 카드(접속자 이름을 누르면) ───────── */
  const pcard = dialog('playerCardDialog', '인물 기록', '人物 / PROFILE');
  pcard.tabs.remove(); pcard.d.classList.add('party-small');
  const TITLES = window.BIRYEONG_TITLES || [];
  async function openCard(u) {
    pcard.head.querySelector('h2').textContent = u.display_name || u.username;
    pcard.body.replaceChildren(para('불러오는 중…')); openDlg(pcard.d);
    try {
      const c = await call('bry_player_card', { p_username: u.username });
      const pr = c.profile || {};
      const top = h('div', 'pcard-top');
      const ph = h('div', 'pcard-photo');
      if (pr.photo) { const img = new Image(); img.src = pr.photo; img.alt = `${pr.name || c.display_name} 프로필 사진`; ph.append(img); }
      else { const s0 = h('span', '', (pr.name || c.display_name || '人').slice(0, 1)); ph.append(s0); }
      const info = h('div', 'pcard-info');
      const title = TITLES.find((t) => t.id === pr.title);
      info.append(h('b', '', pr.name || c.display_name || c.username), h('small', '', `@${c.username}${c.role === 'admin' ? ' · 운영자' : ''}${c.me ? ' · 나' : ''}`));
      if (title) info.append(h('span', 'pcard-title', `「${title.name}」`));
      top.append(ph, info);
      const dl = h('dl', 'pcard-fields');
      const row = (k, v) => { if (!v) return; dl.append(h('dt', '', k), h('dd', '', v)); };
      row('나이', pr.age); row('성별', pr.gender); row('한줄소개', pr.intro); row('대화 칭호', c.chat_title);
      pcard.body.replaceChildren(top, dl.childElementCount ? dl : para('아직 프로필을 적지 않았다.'));
      if (!c.me) { const acts = h('div', 'online-acts'); acts.append(btn('ghost-btn', '초대', () => invite(u)), btn('ghost-btn', '선물', () => { pcard.d.close(); openGift(u); })); pcard.body.append(acts); }
    } catch (e) { pcard.body.replaceChildren(para(errText(e))); }
  }

  /* ───────── 선물 ───────── */
  const gift = dialog('giftDialog', '선물 보내기', '膳物 / GIFT');
  gift.tabs.remove(); gift.d.classList.add('party-small');
  function openGift(u) {
    const api = App.playApi(); const p = api?.player;
    const body = gift.body;
    if (!api || !p) { body.replaceChildren(para('캐릭터를 불러온 뒤에 보낼 수 있다.')); openDlg(gift.d); return; }
    const inv = Object.entries(p.inventory || {}).filter(([id, n]) => n > 0 && !id.includes('#')).map(([id, n]) => ({ id, n, name: api.itemName(id) })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const pick = h('select', 'gift-select'); pick.append(new Option('(물건 없이 냥만)', ''));
    inv.forEach((x) => pick.append(new Option(`${x.name} (가진 수 ${x.n})`, x.id)));
    const qty = h('input', 'gift-num'); qty.type = 'number'; qty.min = '1'; qty.value = '1';
    const money = h('input', 'gift-num'); money.type = 'number'; money.min = '0'; money.value = '0';
    const note = h('input', 'gift-note'); note.maxLength = 200; note.placeholder = '한마디(선택)';
    const row = (label, el) => { const l = h('label', 'gift-row'); l.append(h('span', '', label), el); return l; };
    const send = btn('flat-btn gift-send', '보낸다', async () => {
      const id = pick.value, n = Math.max(1, Math.floor(Number(qty.value) || 1)), m = Math.max(0, Math.floor(Number(money.value) || 0));
      const have = id ? (p.inventory?.[id] || 0) : 0;
      if (!id && !m) { toast('선물', '보낼 물건이나 냥을 고른다.'); return; }
      if (id && n > have) { toast('선물', '가진 것보다 많이 보낼 수 없다.'); return; }
      if (m > (api.player.money || 0)) { toast('선물', '냥이 모자라다.'); return; }
      const items = id ? { [id]: n } : {};
      if (!api.giveAway({ items, money: m })) { toast('선물', '소지품이 바뀌었다. 다시 골라 준다.'); return; }
      send.disabled = true;
      try {
        const gr = await call('bry_gift', { p_username: u.username, p_payload: { money: m, items }, p_note: note.value.trim() });
        api.grant({ log: `${u.display_name || u.username}에게 선물을 보냈다. (${[id ? `${api.itemName(id)} ×${n}` : '', m ? `${m}냥` : ''].filter(Boolean).join(' · ')})` });
        toast('선물', gr?.friend ? `우정 편지를 보냈다. 이제 ${u.display_name || u.username}와(과) 친구다! (내 기록 → 친구 목록)` : '선물을 보냈다. 받는 사람이 다음에 우편함을 열면 들어간다.'); Auth.pushSave?.(); App.renderStatus?.(); gift.d.close();
      } catch (e) {
        api.grant({ items, money: m, log: '선물을 보내지 못해 물건을 되돌려 받았다.' }); // 서버가 받지 않았으면 그대로 돌려놓는다
        toast('선물', errText(e)); send.disabled = false;
      }
    });
    body.replaceChildren(para(`${u.display_name || u.username}(@${u.username})에게 보낸다. 장착한 무구 · 강화한 무구는 보낼 수 없다.`), row('물건', pick), row('개수', qty), row('냥', money), row('한마디', note), send);
    openDlg(gift.d);
  }

  /* ───────── 받은 초대 · 내 일행(25초마다) ───────── */
  let room = null, seenKey = () => `biryeong-room-seen:${me()}`, lastSeen = 0, answered = new Set();
  try { lastSeen = Number(localStorage.getItem(seenKey())) || 0; } catch (_) { /* 처음 */ }
  const inviteBox = h('div', 'invite-stack'); inviteBox.setAttribute('aria-live', 'polite'); document.body.append(inviteBox);
  // vD.02 초대 · 선물 같은 알림 카드는 맨 위 층(popover)에 — 일행 대화 옆 창이나 열린 창에 가리지 않는다
  try { inviteBox.setAttribute('popover', 'manual'); } catch (_) { /* 오래된 브라우저 */ }
  const raiseInvites = () => {
    try { if (!inviteBox.children.length) { if (inviteBox.matches(':popover-open')) inviteBox.hidePopover(); return; } if (inviteBox.matches(':popover-open')) inviteBox.hidePopover(); inviteBox.showPopover(); } catch (_) { /* popover 없음 */ }
  };
  new MutationObserver(raiseInvites).observe(inviteBox, { childList: true });
  function showInvite(inv) {
    if (answered.has(inv.id) || inviteBox.querySelector(`[data-invite="${inv.id}"]`)) return;
    const card = h('div', 'invite-card'); card.dataset.invite = inv.id;
    const answer = async (ok) => {
      answered.add(inv.id); card.remove();
      try { const r = await call('bry_invite_answer', { p_id: inv.id, p_accept: ok }); if (ok) { toast('도깨비들의 터', '일행에 들어왔다.'); await presence(); openParty('room'); App.addTo?.('community', 'party'); } }
      catch (e) { toast('초대', errText(e)); }
    };
    card.append(h('p', '', `${inv.from?.display_name || inv.from?.username}님이 일행에 초대했다.`), btn('flat-btn', '함께한다', () => answer(true)), btn('ghost-btn', '거절한다', () => answer(false)));
    inviteBox.append(card);
    App.ding?.('invite'); // vD.01 파티 초대는 언제나 띠링
  }
  function showFight(f) {
    const key = `fight:${f.id}`;
    if (answered.has(key) || inviteBox.querySelector(`[data-invite="${key}"]`)) return;
    const api = App.playApi();
    const card = h('div', 'invite-card'); card.dataset.invite = key;
    card.append(h('p', '', `${f.host_name || '일행'}님이 일행 전투를 연다 — [${api?.enemyName?.(f.foe) ?? f.foe}] (${f.members?.length || 1}/3)`),
      btn('flat-btn', '함께 싸운다', () => { answered.add(key); card.remove(); const a = App.playApi(); if (!a?.roomFight) { toast('일행 전투', '실행 화면을 불러오는 중이다.'); return; } a.roomFight(f.foe, f.id); }),
      btn('ghost-btn', '지금은 안 된다', () => { answered.add(key); card.remove(); }));
    inviteBox.append(card);
    App.ding?.('invite');
  }
  let polling = false, lastDm = 0, lastUnread = 0;
  // vD.02.3 팝업 공지: 한 번 본 것은 다시 띄우지 않는다(이 브라우저 기준)
  function showPopup(pp) {
    const id = Number(pp?.id) || 0; if (!id) return;
    let seen = 0; try { seen = Number(localStorage.getItem('biryeong-popup-seen')) || 0; } catch (_) { /* 저장 불가 */ }
    if (id <= seen || document.getElementById('popupNotice')) return;
    try { localStorage.setItem('biryeong-popup-seen', String(id)); } catch (_) { /* 저장 불가 */ }
    const d = document.createElement('dialog'); d.id = 'popupNotice'; d.className = 'popup-notice'; d.setAttribute('aria-labelledby', 'popupNoticeTitle');
    const box = document.createElement('div'); box.className = 'popup-notice-box';
    const t = document.createElement('p'); t.className = 'popup-notice-over'; t.textContent = '公告 · 알림';
    const h2 = document.createElement('h2'); h2.id = 'popupNoticeTitle'; h2.textContent = '관리자 공지';
    const body = document.createElement('p'); body.className = 'popup-notice-body'; body.textContent = String(pp.body || '');
    const row = document.createElement('div'); row.className = 'popup-notice-actions';
    if (pp.reload) { const re = document.createElement('button'); re.type = 'button'; re.className = 'solid-btn'; re.textContent = '지금 새로고침'; re.addEventListener('click', () => { try { window.BiryeongAuth?.pushSave?.(); } catch (_) { /* */ } setTimeout(() => location.reload(), 400); }); row.append(re); }
    const close = document.createElement('button'); close.type = 'button'; close.className = 'ghost-btn'; close.textContent = pp.reload ? '나중에' : '확인'; close.addEventListener('click', () => d.close());
    row.append(close); box.append(t, h2, body, row); d.append(box); document.body.append(d);
    d.addEventListener('close', () => d.remove());
    try { d.showModal(); } catch (_) { d.setAttribute('open', ''); }
    App.ding?.('dm');
  }
  async function presence() {
    if (!live() || polling) return;
    polling = true;
    try {
      const r = await call('bry_presence', { p_seen: lastSeen });
      (r.invites || []).forEach(showInvite);
      if (r.fight) showFight(r.fight); // vC.07.3 같은 일행이 추가전투 · 실습 파티를 열었다
      if (r.popup) showPopup(r.popup); // vD.02.3 관리자의 팝업 공지
      if (r.mail > 0) window.BiryeongServer?.poll?.(); // vC.07.5 우편이 왔다(관리자의 상태 고침 · 선물 · 하사) — 받을 때 띠링
      // vD.01 밀담: 접속 확인이 안 읽은 밀담 수까지 준다 — 늘었으면 띠링 + 알림(언제나)
      const dm = Number(r.dm) || 0;
      document.querySelectorAll('[data-community="dm"],[data-community-tab="dm"]').forEach((b) => { if (dm > 0) b.dataset.unread = String(dm); else delete b.dataset.unread; });
      if (dm > lastDm && (document.hidden || !(document.getElementById('communityDialog')?.open && document.querySelector('[data-community-tab="dm"][aria-selected="true"]')))) { App.ding?.('dm'); toast('밤쥐들의 터', `새 밀담이 왔다. (안 읽은 대화 ${dm})`); }
      lastDm = dm;
      const was = room?.id;
      room = r.room || null;
      const unread = room?.unread || 0;
      // vD.01 일행 대화의 새 말: 숫자는 언제나, 띠링은 [알림 소리]가 켜져 있을 때만
      if (unread > lastUnread && (document.hidden || !(party.d.open && partyTab === 'room' && !party.d.classList.contains('is-min')))) App.ding?.('chat'); // vD.02 탭을 내려 둬도 울린다
      lastUnread = unread;
      paintButtons(unread);
      if (was && !room && party.d.open && partyTab === 'room') renderParty();
      if (room && was !== room.id && party.d.open && partyTab === 'room') renderParty();
    } catch (_) { /* 다음에 */ } finally { polling = false; }
  }
  function paintButtons(unread) {
    const inRoom = !!room;
    document.querySelectorAll('[data-party-open]').forEach((b) => { if (unread > 0 && !(party.d.open && partyTab === 'room')) b.dataset.unread = String(unread); else delete b.dataset.unread; });
    const head = $('#partyHeadBtn'); if (head) head.hidden = !inRoom;
  }
  if (live()) { setTimeout(presence, 1500); /* vD.04.3 자리를 비운 화면(10분 넘게 손대지 않음)은 2분에 한 번만 · 일행 중이면 언제나 25초 */ let lastP = Date.now(); setInterval(() => { const gap = (Auth.idle?.() && !room) ? 120000 : 25000; if (Date.now() - lastP >= gap - 1000) { lastP = Date.now(); presence(); } }, 25000); window.addEventListener('biryeong:active', () => { lastP = Date.now(); presence(); }); /* vD.02 탭을 내려 둬도 알림(띠링)을 받는다 — 브라우저가 가려진 탭은 1분에 한 번쯤으로 늦춘다 */ /* vD.01 이 한 번으로 초대 · 우편 · 밀담 · 일행 대화 알림을 모두 받는다 */ document.addEventListener('visibilitychange', () => { if (!document.hidden) presence(); }); }
  // 본편 파티 전투가 둘 이상 모였다(StoryParty)
  window.addEventListener('biryeong:party-room', async (e) => { if (!live() || !e.detail?.party) return; try { await call('bry_room_battle', { p_party: e.detail.party }); await presence(); if (wantBattleChat && room) { wantBattleChat = false; openParty('room'); } } catch (_) { /* 없으면 그만 */ } });
  // vD.01 파티 전투가 열리면 일행 대화를 옆에 띄운다(전투와 같이 본다)
  let wantBattleChat = false;
  window.addEventListener('biryeong:battle-chat', async () => { if (!live()) return; if (!room) await presence(); if (room) { if (!party.d.open) openParty('room'); } else wantBattleChat = true; });

  /* ───────── 도깨비들의 터 ───────── */
  const party = dialog('partyDialog', '도깨비들의 터', '鬼市 / PARTY TALK');
  let partyTab = 'room', timer = null, lastId = 0, viewing = null;
  const tabBtn = (id, label) => { const b = btn('', label, () => { partyTab = id; renderParty(); }); b.dataset.partyTab = id; return b; };
  party.tabs.append(tabBtn('room', '일행과의 대화'), tabBtn('others', '다른 일행들의 대화 보기'));
  party.d.addEventListener('close', () => { clearInterval(timer); timer = null; paintButtons(0); });
  /* vD.01 도깨비들의 터는 화면을 덮지 않는 옆 창 — 전투와 같이 보고, 머리를 끌어 옮기고, 오른쪽 아래 모서리로 크기를 바꾸고, 접어 둘 수 있다 */
  party.d.classList.add('party-dock');
  {
    const tools = h('div', 'party-dock-tools');
    const sound = btn('ghost-btn party-sound', '', () => { App.setChatSound?.(!App.chatSoundOn?.()); paintSound(); });
    const paintSound = () => { const on = App.chatSoundOn?.() !== false; sound.textContent = on ? '🔔 새 말 소리 켜짐' : '🔕 새 말 소리 꺼짐'; sound.setAttribute('aria-pressed', String(on)); sound.title = on ? '일행 대화에 새 말이 오면 띠링 소리가 난다(끄면 숫자만 뜬다)' : '새 말은 도깨비들의 터 단추 위 숫자로만 알린다'; };
    const fold = btn('ghost-btn party-fold', '접기', () => { const min = party.d.classList.toggle('is-min'); fold.textContent = min ? '펴기' : '접기'; });
    paintSound(); tools.append(sound, fold);
    party.head.insertBefore(tools, party.head.lastChild);
    let drag = null;
    party.head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const r = party.d.getBoundingClientRect(); drag = { x: e.clientX - r.left, y: e.clientY - r.top };
      party.head.setPointerCapture?.(e.pointerId);
    });
    party.head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const w = party.d.offsetWidth, ht = party.head.offsetHeight;
      party.d.style.left = `${Math.max(0, Math.min(window.innerWidth - Math.min(w, 120), e.clientX - drag.x))}px`;
      party.d.style.top = `${Math.max(0, Math.min(window.innerHeight - ht, e.clientY - drag.y))}px`;
      party.d.style.right = 'auto'; party.d.style.bottom = 'auto';
    });
    const end = () => { drag = null; };
    party.head.addEventListener('pointerup', end); party.head.addEventListener('pointercancel', end);
  }
  function openParty(tab) {
    partyTab = tab || (room ? 'room' : 'others');
    if (!party.d.open) { try { party.d.show(); } catch (_) { party.d.setAttribute('open', ''); } }
    party.d.classList.remove('is-min'); party.d.querySelector('.party-fold') && (party.d.querySelector('.party-fold').textContent = '접기');
    App.addTo?.('community', 'party'); renderParty();
  }
  function msgLine(m) {
    const li = h('li', `party-msg${m.u ? '' : ' is-notice'}${m.u && m.u === me() ? ' is-me' : ''}`);
    if (m.u) { const nm = h('b', '', m.name || m.u); const lead = room?.leader ?? room?.members?.[0]?.u; if (lead && m.u === lead) nm.append(h('small', 'party-leader-tag', ' 파티장')); li.append(nm, h('span', '', m.body), h('time', '', kst(m.at))); } // vD.02 파티장 표시
    else li.append(h('span', '', m.body));
    return li;
  }
  async function renderParty() {
    party.tabs.querySelectorAll('[data-party-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.partyTab === partyTab)));
    clearInterval(timer); timer = null;
    const body = party.body;
    if (!need(body)) return;
    if (partyTab === 'others') return renderOthers(body);
    if (!room) {
      body.replaceChildren(para('지금은 일행이 없다. [접속자 확인하기]에서 다른 사람을 초대하거나, 본편 파티 전투에 함께 모이면 일행이 생긴다.'), btn('ghost-btn', '접속자 확인하기', openOnline));
      return;
    }
    const head = h('div', 'party-room-head');
    const lead = room.leader ?? room.members?.[0]?.u;
    head.append(h('span', '', `${room.kind === 'battle' ? '전투 일행' : '일행'} (${room.members.length}/3) · ${room.members.map((x) => `${x.name || x.u}${x.u === lead ? '(파티장)' : ''}`).join(', ')}${lead === me() ? '' : ' — 더 초대하기 · 전투 열기는 파티장만'}`), btn('ghost-btn party-leave', '일행에서 나가기', async () => {
      if (!window.confirm('일행에서 나갈까? 혼자 남으면 일행이 끝나고, 대화는 모두가 읽을 수 있게 된다.')) return;
      try { await call('bry_room_leave', { p_room: room.id }); room = null; await presence(); renderParty(); } catch (e) { toast('도깨비들의 터', errText(e)); }
    }));
    const list = h('ol', 'party-log'); list.setAttribute('aria-live', 'polite');
    const form = h('form', 'party-form'); const input = h('input'); input.maxLength = 500; input.placeholder = '일행에게 말한다 (캐릭터로)'; input.setAttribute('aria-label', '일행에게 보낼 말');
    const send = h('button', 'flat-btn', '보내기'); send.type = 'submit';
    form.append(input, send);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const text = input.value.trim(); if (!text) return;
      send.disabled = true;
      try { await call('bry_room_send', { p_room: room.id, p_body: text }); input.value = ''; await pull(); } catch (err) { toast('도깨비들의 터', errText(err)); }
      send.disabled = false; input.focus();
    });
    body.replaceChildren(head, list, form);
    lastId = 0; viewing = room.id;
    async function pull() {
      if (!room || viewing !== room.id) return;
      try {
        const r = await call('bry_room_msgs', { p_room: room.id, p_after: lastId });
        const near = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
        (r.msgs || []).forEach((m) => { list.append(msgLine(m)); lastId = Math.max(lastId, m.id); });
        if (near || lastId && list.childElementCount === (r.msgs || []).length) list.scrollTop = list.scrollHeight;
        lastSeen = Math.max(lastSeen, lastId); try { localStorage.setItem(seenKey(), String(lastSeen)); } catch (_) { /* 괜찮다 */ }
        paintButtons(0);
        lastUnread = 0; // 읽었으니 다음 새 말부터 다시 센다
        if (r.room?.status === 'ended') { room = null; list.append(msgLine({ body: '[일행이 끝났다.]' })); clearInterval(timer); timer = null; }
      } catch (_) { /* 다음에 */ }
    }
    await pull();
    timer = setInterval(() => { if (!document.hidden && !party.d.classList.contains('is-min') && !Auth.idle?.()) pull(); }, 5000); // vD.04.3 자리를 비우면 묻지 않는다 // vD.01 4초 → 5초 · 접어 두면 묻지 않는다(숫자는 접속 확인이 준다)
    input.focus();
  }
  async function renderOthers(body) {
    body.replaceChildren(para('불러오는 중…'));
    try {
      const r = await call('bry_rooms_ended');
      if (!r.dates?.length) { body.replaceChildren(para('아직 끝난 일행이 없다. 일행이 끝나면 그 대화를 여기서 날짜별로 읽을 수 있다.')); return; }
      const dates = h('div', 'party-dates'); const rooms = h('div', 'party-rooms');
      const pickDate = async (d, b) => {
        dates.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        rooms.replaceChildren(para('불러오는 중…'));
        try {
          const rr = await call('bry_rooms_ended', { p_date: d });
          rooms.replaceChildren(...(rr.rooms || []).map((x) => {
            const row = btn('party-room-row', '', () => openTranscript(x));
            row.append(h('b', '', (x.everyone || []).map((m) => m.name || m.u).join(' · ') || '(이름 없음)'), h('small', '', `${x.kind === 'battle' ? '전투 일행 · ' : ''}${kst(x.created_at)} ~ ${kst(x.ended_at)} · 말 ${x.count}개`));
            return row;
          }));
          if (!rr.rooms?.length) rooms.replaceChildren(para('그날 끝난 일행이 없다.'));
        } catch (e) { rooms.replaceChildren(para(errText(e))); }
      };
      r.dates.forEach((d, i) => { const b = btn('dex-chip', d.slice(5).replace('-', '월 ') + '일', () => pickDate(d, b)); b.title = d; dates.append(b); if (i === 0) setTimeout(() => pickDate(d, b), 0); });
      body.replaceChildren(para('날짜를 고르면 그날 끝난 일행이 보인다. 일행을 누르면 대화가 열린다.'), dates, rooms);
    } catch (e) { body.replaceChildren(para(errText(e))); }
  }
  const trans = dialog('partyTranscript', '일행의 대화', '記錄 / TRANSCRIPT');
  trans.tabs.remove(); trans.d.classList.add('party-small');
  async function openTranscript(x) {
    trans.head.querySelector('h2').textContent = (x.everyone || []).map((m) => m.name || m.u).join(' · ');
    trans.body.replaceChildren(para('불러오는 중…')); openDlg(trans.d);
    try {
      const r = await call('bry_room_msgs', { p_room: x.id, p_after: 0 });
      const list = h('ol', 'party-log is-read'); (r.msgs || []).forEach((m) => list.append(msgLine(m)));
      trans.body.replaceChildren(para(`${kst(x.created_at, true)} ~ ${kst(x.ended_at, true)}`), list);
    } catch (e) { trans.body.replaceChildren(para(errText(e))); }
  }

  /* ───────── 단추 ───────── */
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-party-open]'); if (b) { e.preventDefault(); openParty(); return; }
  });
  window.BiryeongParty = { openParty, openOnline, openFriends, presence, get room() { return room; }, me, get isLeader() { return !room || (room.leader ?? room.members?.[0]?.u) === me(); } };
})();
