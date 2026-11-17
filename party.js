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
  if (!Auth || !App) return;
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
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
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
          acts.append(btn('ghost-btn', '초대', () => invite(u)), btn('ghost-btn', '선물', () => openGift(u)));
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
  function openOnline() { openDlg(online.d); renderOnline(); }

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
        await call('bry_gift', { p_username: u.username, p_payload: { money: m, items }, p_note: note.value.trim() });
        api.grant({ log: `${u.display_name || u.username}에게 선물을 보냈다. (${[id ? `${api.itemName(id)} ×${n}` : '', m ? `${m}냥` : ''].filter(Boolean).join(' · ')})` });
        toast('선물', '선물을 보냈다. 받는 사람이 다음에 우편함을 열면 들어간다.'); Auth.pushSave?.(); App.renderStatus?.(); gift.d.close();
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
  }
  let polling = false;
  async function presence() {
    if (!live() || polling) return;
    polling = true;
    try {
      const r = await call('bry_presence', { p_seen: lastSeen });
      (r.invites || []).forEach(showInvite);
      const was = room?.id;
      room = r.room || null;
      paintButtons(room?.unread || 0);
      if (was && !room && party.d.open && partyTab === 'room') renderParty();
      if (room && was !== room.id && party.d.open && partyTab === 'room') renderParty();
    } catch (_) { /* 다음에 */ } finally { polling = false; }
  }
  function paintButtons(unread) {
    const inRoom = !!room;
    document.querySelectorAll('[data-party-open]').forEach((b) => { if (unread > 0 && !(party.d.open && partyTab === 'room')) b.dataset.unread = String(unread); else delete b.dataset.unread; });
    const head = $('#partyHeadBtn'); if (head) head.hidden = !inRoom;
  }
  if (live()) { setTimeout(presence, 1500); setInterval(() => { if (!document.hidden) presence(); }, 25000); document.addEventListener('visibilitychange', () => { if (!document.hidden) presence(); }); }
  // 본편 파티 전투가 둘 이상 모였다(StoryParty)
  window.addEventListener('biryeong:party-room', async (e) => { if (!live() || !e.detail?.party) return; try { await call('bry_room_battle', { p_party: e.detail.party }); presence(); } catch (_) { /* 없으면 그만 */ } });

  /* ───────── 도깨비들의 터 ───────── */
  const party = dialog('partyDialog', '도깨비들의 터', '鬼市 / PARTY TALK');
  let partyTab = 'room', timer = null, lastId = 0, viewing = null;
  const tabBtn = (id, label) => { const b = btn('', label, () => { partyTab = id; renderParty(); }); b.dataset.partyTab = id; return b; };
  party.tabs.append(tabBtn('room', '일행과의 대화'), tabBtn('others', '다른 일행들의 대화 보기'));
  party.d.addEventListener('close', () => { clearInterval(timer); timer = null; paintButtons(0); });
  function openParty(tab) { partyTab = tab || (room ? 'room' : 'others'); openDlg(party.d); App.addTo?.('community', 'party'); renderParty(); }
  function msgLine(m) {
    const li = h('li', `party-msg${m.u ? '' : ' is-notice'}${m.u && m.u === me() ? ' is-me' : ''}`);
    if (m.u) li.append(h('b', '', m.name || m.u), h('span', '', m.body), h('time', '', kst(m.at)));
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
    head.append(h('span', '', `${room.kind === 'battle' ? '전투 일행' : '일행'} · ${room.members.map((x) => x.name || x.u).join(', ')}`), btn('ghost-btn party-leave', '일행에서 나가기', async () => {
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
        if (r.room?.status === 'ended') { room = null; list.append(msgLine({ body: '[일행이 끝났다.]' })); clearInterval(timer); timer = null; }
      } catch (_) { /* 다음에 */ }
    }
    await pull();
    timer = setInterval(() => { if (!document.hidden) pull(); }, 4000);
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
    if (e.target.closest?.('#onlineBtn')) { e.preventDefault(); openOnline(); }
  });
  window.BiryeongParty = { openParty, openOnline, presence, get room() { return room; } };
})();
