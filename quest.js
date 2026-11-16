/* 秘靈 · 비령 — 본편 이야기(스토리 스크립트 v4)를 돌리는 곳.
 *
 * 데이터: story-data.js — 프롤로그(튜토리얼) · 권 · 장 목록 · 상대 · 바깥 지역 · 유품.  1장부터는 장 파일(story-chapters/chN.json)로 따로 있다.
 *         장 파일은 관리자 [스토리 관리]에서 올리고 공개한다. 공개 전에는 권 · 장 이름과 「[아직 열리지 않은 이야기입니다.]」만 보인다.
 *         서버(Supabase)가 붙어 있으면 공개된 장은 서버에서 받아 오고(공개 전 내용은 서버가 내주지 않는다), 없으면 이 브라우저에 올린 장만 쓴다.
 * 화면  : 산문 › 산문 너머(#/zone/north) = 이야기 · 바깥 지역 · 나의 기록 · 모두의 선택 / 바깥 지역(#/out/<지역>/<지점>) / 오른쪽 상태 창의 진행 추적 / 이야기 화면
 * 저장  : save.story.q  (계정마다 따로 — app.js 가 적는다)
 *
 * 이야기 화면에는 연출이 글자로 나오지 않는다. 글자로 나오는 것은 대사 · 지문(상황 · 행동)뿐이고,
 * 원고의 (괄호 연출)과 줄마다 붙은 fx 는 배경 · 장면 그림 · 흔들림 · 붉은 빛 · 먹물 · 뉴스 화면 · 단말기 · 구석 속삭임 · 장 표제 같은 화면 효과가 된다.
 *
 * 단계의 need(n): visit:<탐사 지점>  spot:<바깥 지점>  battle:<상대>[|calm]  make:<아이템>  equip:heir  heirlvl:<강화 수>  tutorial×<단계>  inspect:<아이템>  act:<글>
 * 단계의 덤: give(마치면 받는 것) · heir(고른 유품의 무구를 받는다) · alt / alt_a(앞 선택에 따라 바뀌는 할 일) · pre(전투 전에 흐르는 대사) · here(그 자리에 가야 끝난다) · rule(전투 안내)
 */
(() => {
  'use strict';
  const App = window.BiryeongApp, D = window.BIRYEONG_QUESTS;
  if (!App || !D) return;
  const { h, btn, para, go, toast } = App;
  const Sync = () => window.BiryeongSync || null;
  const CIRC = '①②③④⑤⑥⑦⑧⑨⑩';
  const HEIRS = D.heirlooms || [];
  const HEIR_CHOICE = D.heirChoice || 'C0-1';
  const OLD_HEIR = { bell: 'w-bell', fan: 'w-fan', mirror: 'w-spear', blade: 'w-sword', cloth: 'w-dagger' };
  const WEAPON_NAME = { 'w-bell': '무당방울', 'w-mace': '철퇴', 'w-fan': '부채', 'w-staff': '석장', 'w-bow': '활', 'w-spear': '창', 'w-sword': '칼', 'w-sickle': '낫', 'w-dagger': '단검', 'w-instrument': '악기' };
  const itemName = (id) => { try { return App.playApi()?.itemName(id) || WEAPON_NAME[id] || id; } catch (_) { return WEAPON_NAME[id] || id; } };
  const heir = () => HEIRS.find((x) => x.weapon === save().story.heirloom) || null;
  const lineKey = () => heir()?.key || '';
  const chapterOf = (n) => D.chapters.find((c) => c.n === n) || { n, title: '' };
  const volOf = (n) => D.volumes.find((v) => v.n === n) || { n, title: '' };

  /* ───────── 장 공개 · 장 파일 ─────────
   * 프롤로그(0장)는 늘 열려 있다. 1장부터는 공개된 장 파일이 있을 때만 이야기가 이어진다. */
  const LOCAL_KEY = 'biryeong-story-chapters-v1'; // { [장]: { title, content, openAt, uploadedAt } } — 서버가 없을 때 · 관리자 미리 보기
  const loaded = {};
  let SCENES = [], byId = {};
  const validChapter = (c, n) => c && c.format === 'biryeong-chapter' && Number(c.ch) === Number(n) && Array.isArray(c.scenes) && c.scenes.every((s) => s.id && Array.isArray(s.lines) && Array.isArray(s.steps));
  function rebuild() {
    SCENES = [...D.scenes, ...Object.keys(loaded).map(Number).sort((a, b) => a - b).flatMap((n) => loaded[n].scenes)];
    byId = Object.fromEntries(SCENES.map((s) => [s.id, s]));
  }
  rebuild();
  const localStore = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch (_) { return {}; } };
  const writeLocal = (v) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); return true; } catch (_) { return false; } };
  const preview = () => App.isAdmin?.() && save()?.adminStoryPreview === true;
  const isOpen = (n) => n === 0 || !!loaded[n];
  async function refreshChapters() {
    const got = {}, now = Date.now(), L = localStore();
    const sync = Sync();
    if (sync?.enabled && sync.openChapters) {
      try { (await sync.openChapters() || []).forEach((r) => { if (validChapter(r.content, r.ch)) got[r.ch] = r.content; }); } catch (e) { console.warn('[비령] 공개된 장을 받지 못했다', e?.message); }
    } else Object.entries(L).forEach(([n, v]) => { if (v?.openAt && Date.parse(v.openAt) <= now && validChapter(v.content, n)) got[n] = v.content; });
    if (preview()) Object.entries(L).forEach(([n, v]) => { if (validChapter(v?.content, n)) got[n] = v.content; }); // 관리자 미리 보기: 올려 둔 장은 공개 전이라도
    const before = Object.keys(loaded).sort().join(','), after = Object.keys(got).sort().join(',');
    Object.keys(loaded).forEach((k) => delete loaded[k]); Object.assign(loaded, got); rebuild();
    if (before !== after) { drawTracker(); if (/^#\/zone\/north/.test(location.hash) || /^#\/admin\/story/.test(location.hash)) App.route(); else later(); }
  }
  setInterval(refreshChapters, 60 * 1000);

  /* ───────── 인물 인장 · 초상 자리 ───────── */
  const CAST = {
    서창현: { hair: '#1c2231', ink: '#e9edf7' }, 윤진서: { hair: '#7b4a32', ink: '#fff2e2' }, 연호수: { hair: '#2c4a48', ink: '#e6f5f0' },
    비령: { hair: '#0f5f66', ink: '#c9fbff' }, PC: { hair: '#5d6170', ink: '#f1f1f4' }, 진달래: { hair: '#7a3b52', ink: '#ffeef3' }, '??': { hair: '#2a2f3a', ink: '#9aa4b8' },
  };
  const EXTRA_HAIR = ['#3b3a40', '#54463c', '#6c6a66', '#2f3a4a', '#4a3f52', '#5a4a36', '#39453d', '#7a7468'];
  const hairOf = (who) => { if (CAST[who]) return CAST[who]; let n = 0; for (const c of who) n = (n * 31 + c.charCodeAt(0)) % 9973; return { hair: EXTRA_HAIR[n % EXTRA_HAIR.length], ink: '#f2ecdf' }; };
  const PORTRAITS = window.BIRYEONG_PORTRAITS || {};
  function portrait(who, shown) {
    const box = h('div', 'pt-frame'); box.dataset.who = who;
    for (const c of ['tl', 'tr', 'bl', 'br']) box.append(h('i', `pt-corner pt-${c}`));
    const src = shown !== '??' && (PORTRAITS[who] || PORTRAITS[who.replace(/\(.*\)$/, '')]);
    if (src) { const img = new Image(); img.className = 'pt-img'; img.alt = `${shown} 초상`; img.src = src; img.addEventListener('error', () => img.replaceWith(seal(who, shown))); box.append(img); }
    else box.append(seal(shown === '??' ? '??' : who, shown));
    return box;
  }
  function seal(who, shown) {
    const c = hairOf(who.replace(/\(.*\)$/, ''));
    const s = h('span', 'pt-seal', shown === '??' ? '?' : [...shown][0] || '?'); s.style.setProperty('--hair', c.hair); s.style.setProperty('--ink', c.ink); s.setAttribute('aria-hidden', 'true');
    return s;
  }

  /* ───────── 상태 ───────── */
  const save = () => App.save;
  function Q() {
    const st = save().story;
    if (!st.q || st.q.v !== 4) st.q = { v: 4 };   // v4 원고로 이야기를 새로 시작한다(앞판의 진행은 원고가 달라 이어지지 않는다)
    const q = st.q;
    for (const [k, v] of Object.entries({ done: {}, step: 0, prog: {}, flags: {}, pick: {}, picked: {}, regions: {}, keep: [], given: {}, beaten: {}, calm: {}, pre: {}, chapters: {} })) if (q[k] == null) q[k] = v;
    if (OLD_HEIR[st.heirloom]) st.heirloom = OLD_HEIR[st.heirloom];
    return q;
  }
  const persist = () => App.persist();
  const playerName = () => App.profile()?.name || '학생';
  const hasBatchim = (word) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : /[13678lmnr]$/i.test(word); };
  function fill(text) {
    const n = playerName(), b = hasBatchim(n);
    return String(text ?? '')
      .replace(/OO\(이\)가/g, n + (b ? '이' : '가')).replace(/OO\(은\)는/g, n + (b ? '은' : '는')).replace(/OO\(을\)를/g, n + (b ? '을' : '를'))
      .replace(/OO는/g, n + (b ? '은' : '는')).replace(/OO가/g, n + (b ? '이' : '가')).replace(/OO를/g, n + (b ? '을' : '를')).replace(/OO와/g, n + (b ? '과' : '와'))
      .replace(/OO/g, n)
      .replace(/\{유품\}/g, heir()?.name || '유품').replace(/\{무구\}/g, heir() ? itemName(heir().weapon) : '무구');
  }

  /* ───────── 조건 ───────── */
  function ok(conds) {
    const q = Q();
    return (conds || []).every((c) => (c.flag ? c.in.includes(q.flags[c.flag]) : true));
  }

  /* ───────── 진행 ───────── */
  const current = () => SCENES.find((s) => !Q().done[s.id] && ok(s.c)) || null;
  const doneCount = () => SCENES.filter((s) => Q().done[s.id]).length;
  /** 다음에 열려야 할 장(지금 이어 할 장면이 없을 때) */
  function nextLocked() {
    const q = Q();
    const lastDone = Math.max(0, ...SCENES.filter((s) => q.done[s.id]).map((s) => s.ch));
    return D.chapters.find((c) => c.n > lastDone && !isOpen(c.n)) || null;
  }
  function activeStep(scene) {
    const q = Q();
    while (q.step < scene.steps.length && !ok(scene.steps[q.step].c)) { q.step += 1; q.prog = {}; }
    return scene.steps[q.step] || null;
  }
  const parseNeed = (n) => {
    const m = /^([a-zA-Z]+)(?::(.*?))?(?:×(\d+))?(\|calm)?$/.exec(n) || [];
    const [id, k] = (m[2] || '').split('*');
    return { type: m[1], arg: m[2] || '', id, per: Number(k || 1), count: Number(m[3] || 1), calm: !!m[4] };
  };
  const BUTTON = new Set(['battle', 'act']);
  const AT_PLACE = new Set([...BUTTON]);
  const api = () => { try { return App.playApi(); } catch (_) { return null; } };
  const countOf = (id) => api()?.count(id) || 0;
  const pickOf = (map) => { for (const [flag, by] of Object.entries(map || {})) { const v = Q().flags[flag]; if (v != null && by[v] != null) return by[v]; } return null; };
  const needsOf = (st) => (st.alt ? pickOf(st.alt) || st.n || [] : st.n || []);
  const actOf = (st) => (st.alt_a ? pickOf(st.alt_a) || st.a : st.a);
  const ruleOf = (st) => (Array.isArray(st.rule) ? st.rule[(Q().flags[Object.keys(st.alt || {})[0]] || 1) - 1] : st.rule) || '';
  function needState(scene, st) {
    const q = Q();
    return needsOf(st).map((raw, i) => {
      const n = parseNeed(raw); let have = q.prog[i] || 0;
      if (n.calm && q.calm[scene.id]) have = n.count;
      if (n.type === 'equip') have = heir() && api()?.equippedBase() === heir().weapon ? 1 : 0;
      if (n.type === 'heirlvl') have = (api()?.heirloomEnh?.() || 0) >= Number(n.arg) ? 1 : 0;
      if (n.type === 'tutorial') have = Math.min(n.count, api()?.tutorialCount?.() || 0);
      return { ...n, raw, i, have, done: have >= n.count };
    });
  }
  let loc = 'home', zoneKey = '';
  function readLoc(parts) {
    const [head, a, b, c] = parts;
    zoneKey = head === 'zone' ? a : '';
    if (!head) return 'home';
    if (head === 'out') return `out:${a}/${b || ''}`;
    if (head === 'zone') { if (a === 'north') return 'north'; const zone = App.zones[a]; const tab = b || zone?.tabs[0]?.id; return tab ? `${tab}/${c || zone.tabs.find((t) => t.id === tab)?.sections[0]?.id || ''}` : a; }
    return head;
  }
  const atPlace = (w) => w === 'any' || loc === w || loc.startsWith(w + '/') || (w.startsWith('out:') && loc === w);
  function hashOf(w) {
    if (w === 'north') return '#/zone/north'; if (w === 'home') return '#/'; if (w === 'any') return null;
    if (w.startsWith('out:')) return `#/out/${w.slice(4)}`;
    const [place, act] = w.split('/'); return App.placeHash(place, act);
  }
  const NEED_TEXT = { visit: '그 자리 살피기', spot: '찾아가기', act: '하기' };
  function needLine(n) {
    const name = n.id ? itemName(n.id) : '';
    if (n.type === 'make') return `「${name}」 직접 만들기${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''}`;
    if (n.type === 'equip') return heir() ? `「${itemName(heir().weapon)}」 장착하기 — 소지품에서` : '유품 무구 장착하기';
    if (n.type === 'heirlvl') return `유품 무구 ${n.arg}강 이상 — 뒷산 무구보관소에서 강화 (지금 ${api()?.heirloomEnh?.() || 0}강)`;
    if (n.type === 'tutorial') return `[전투 안내] ${Math.min(n.have, n.count)} / ${n.count}단계`;
    if (n.type === 'inspect') return `소지품에서 「${name}」 조사하기`;
    if (n.type === 'battle') { const foe = D.foes[n.arg]; return `${foe?.name || '상대'}${n.calm ? ' — 진정시키거나 쓰러뜨리기' : ' 퇴마'}`; }
    if (n.type === 'visit') return '그 자리를 살핀다(탐사)';
    return `${NEED_TEXT[n.type] || n.type}${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''}`;
  }

  let busy = false, timer = null;
  const later = () => { if (timer) return; timer = setTimeout(() => { timer = null; tick(); }, 320); }; // 잇달아 불려도 미뤄지기만 하지 않게(한 번은 꼭 돈다)
  function tick() {
    if (busy || !App.profile() || document.getElementById('opening')) { drawTracker(); return; }
    const scene = current();
    if (!scene) { drawTracker(); return; }
    const q = Q();
    if (q.cur !== scene.id) { q.cur = scene.id; q.step = 0; q.prog = {}; persist(); }
    const st = activeStep(scene);
    if (!st) { finishQuest(scene); return; }
    if (st.w.startsWith('out:')) unlockRegion(st.w.slice(4).split('/')[0]);
    const key = `${scene.id}.${q.step}`;
    if (st.pre && !q.pre[key] && atPlace(st.w)) { busy = true; playLines(scene, st.pre[0], st.pre[1], () => { busy = false; q.pre[key] = 1; persist(); drawTracker(); }); return; }
    const needs = needState(scene, st);
    const real = needs.some((n) => !AT_PLACE.has(n.type));
    const ready = needs.every((n) => n.done) && (st.here ? atPlace(st.w) : (real || atPlace(st.w)));
    if (!ready) { drawTracker(); return; }
    const end = () => stepDone(scene, st);
    if (st.l) { busy = true; playLines(scene, st.l[0], st.l[1], () => { busy = false; end(); }); } else end();
  }
  function stepDone(scene, st) {
    const q = Q(), a = api();
    const got = [];
    if (st.give && a) {
      a.grant({ items: st.give, log: `본편: ${Object.entries(st.give).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}을(를) 받았다.` });
      for (const [id, n] of Object.entries(st.give)) { q.given[id] = (q.given[id] || 0) + n; got.push(`${itemName(id)}${n > 1 ? ` ×${n}` : ''}`); }
    }
    if (st.heir && heir() && a && !q.given[heir().weapon]) {
      const name = a.giveHeirloom(heir().weapon, heir().enh);
      if (name) { q.given[heir().weapon] = 1; card({ kind: 'heir', head: '유품이 무구가 되었다', title: `「${name}」`, sub: `${heir().name} · ${heir().line} 계통`, lines: [heir().note, '부모의 손길 — 강화 1이 붙은 채로 받았다.', '본편 이야기 전투에서는 이 무구만 쓸 수 있다.'], btn: '소지품 열기', act: () => App.playApi()?.openInventory() }); }
    }
    if (got.length) card({ kind: 'item', head: '받은 것', title: got.join(' · '), lines: ['소지품에 들어왔다.'] });
    q.step += 1; q.prog = {}; persist();
    tick();
  }
  function finishQuest(scene) {
    const q = Q();
    q.done[scene.id] = Date.now(); q.step = 0; q.prog = {};
    const spirit = 4 + scene.ch * 2, money = 5 + scene.ch * 3;
    try { App.playApi()?.grant({ spirit, money, log: `본편 「${scene.title}」을(를) 마쳤다. 영력 +${spirit}, ${money}냥.` }); } catch (_) { /* 실행 화면이 아직 없으면 넘어간다 */ }
    persist();
    banner(scene, [`영력 +${spirit}`, `${money}냥`]);
    const list = SCENES.filter((s) => s.ch === scene.ch);
    if (list.every((s) => q.done[s.id]) && !q.chapters[scene.ch]) {
      q.chapters[scene.ch] = Date.now();
      const tid = `st-ch${scene.ch}`; const title = (window.BIRYEONG_TITLES || []).find((t) => t.id === tid);
      App.grantTitle(tid);
      chapterCard(scene.ch, title);
    }
    Sync()?.progress(doneCount());
    App.renderStatus();
    if (/^#\/zone\/north/.test(location.hash)) App.route(); else tick();
  }
  function unlockRegion(reg) { const q = Q(); if (!q.regions[reg] && D.regions[reg]) { q.regions[reg] = Date.now(); persist(); toast('산문 너머', `「${D.regions[reg].name}」(으)로 가는 길이 열렸다.`); } }

  /* 게임에서 생긴 일 듣기 */
  function onEvent(type, id) {
    if (!App.profile()) return;
    if (type === 'storyBattle' && id) afterStoryBattle(id);
    const scene = current(); if (!scene) return;
    const st = activeStep(scene); if (!st) return;
    const q = Q(); let hit = false;
    needState(scene, st).forEach((n) => {
      if (n.done) return;
      const match = (n.type === 'visit' && type === 'visit' && id === n.arg) || (n.type === 'spot' && type === 'spot' && id === n.arg)
        || (n.type === 'battle' && type === 'storyBattle' && id?.key === n.arg && id.win) || (n.type === 'inspect' && type === 'inspect' && id === n.id);
      if (match) { q.prog[n.i] = (q.prog[n.i] || 0) + 1; hit = true; }
      if (n.type === 'make' && type === 'make' && id?.id === n.id) { q.prog[n.i] = (q.prog[n.i] || 0) + (id.qty || 1); hit = true; }
    });
    if (type === 'storyBattle' && id?.calm && id.win) { q.calm[scene.id] = true; hit = true; }
    if (['equip', 'enhance', 'tutorial'].includes(type)) hit = true;
    if (hit) { persist(); later(); }
  }
  /** 소지품의 [조사한다] 단추: 지금 단계가 그 물건을 조사하라고 할 때만 */
  function inspectable(id) {
    const scene = current(); const st = scene && !busy ? activeStep(scene) : null;
    return !!st && needState(scene, st).some((n) => n.type === 'inspect' && n.id === id && !n.done);
  }
  function afterStoryBattle(r) {
    const q = Q();
    if (!r.win) { if (!r.fled) card({ kind: 'lose', head: '쓰러졌다', title: r.name || '', lines: ['이야기 전투는 져도 쇠약이 남지 않는다.', '패턴을 다시 읽고, 몸을 추스른 뒤 다시 도전하자.'] }); return; }
    const first = !q.beaten[r.key];
    q.beaten[r.key] = q.beaten[r.key] || Date.now(); persist();
    const lines = [];
    if (r.calm) lines.push('쓰러뜨리지 않고 진정시켰다 — 이야기 승리.');
    if (r.drop) lines.push(`전리품 — ${r.drop.name}${r.drop.n > 1 ? ` ×${r.drop.n}` : ''}`);
    (r.recipes || []).forEach((x) => lines.push(`새 제작법 — 「${x.name}」 (공작소)`));
    if (first || lines.length) card({ kind: 'boss', head: first ? '격파' : '다시 격파', title: r.name || '', lines: lines.length ? lines : ['이미 받은 전리품은 다시 나오지 않을 수도 있다.'] });
  }
  window.addEventListener('biryeong:quest', (e) => onEvent(e.detail.type, e.detail.id));
  window.addEventListener('biryeong:saved', () => { if (!busy) later(); });
  window.addEventListener('biryeong:route', (e) => {
    loc = readLoc(e.detail.parts);
    if (loc.startsWith('out:')) onEvent('spot', loc.slice(4));
    later();
  });

  /* ───────── 행동 단추(이야기 전투 · 행동) ───────── */
  function actions(scene, st) {
    const out = [];
    if (!atPlace(st.w)) return out;
    const q = Q();
    if (st.pre && !q.pre[`${scene.id}.${q.step}`]) return out;
    needState(scene, st).forEach((n) => {
      if (n.done || !BUTTON.has(n.type)) return;
      if (n.type === 'battle') {
        const foe = D.foes[n.arg];
        out.push(btn('solid-btn quest-act', `${foe.name}와(과) ${n.calm ? '마주한다' : '싸운다'}`, () => {
          const a = App.playApi(); if (!a) { toast('본편', '실행 화면을 불러오는 중이다.'); return; }
          a.storyBattle({ key: n.arg, tier: foe.tier, i: foe.i, name: foe.name, blurb: foe.blurb, ctx: { form: 1, names: { player: playerName() }, family: lineKey(), has: { 'st-bell302': countOf('st-bell302') > 0 } } });
        }));
      } else out.push(btn('solid-btn quest-act', n.arg || actOf(st), () => { q.prog[n.i] = (q.prog[n.i] || 0) + 1; persist(); later(); drawTracker(); }));
    });
    return out;
  }

  /* ───────── 진행 추적(오른쪽 상태 창 · 페이지 안) ───────── */
  function trackerBox() {
    const box = h('div', 'quest-box');
    if (!App.profile()) { box.append(h('p', 'quest-box-step', '프로필을 만들면 이야기가 시작된다.')); return box; }
    const scene = current();
    if (!scene) {
      const lock = nextLocked();
      if (lock) { box.append(h('p', 'quest-box-title', `◇ ${lock.n}장 · ${lock.title}`), h('p', 'quest-box-step', '[아직 열리지 않은 이야기입니다.]')); }
      else box.append(h('p', 'quest-box-title', '지금 열린 이야기를 모두 마쳤다'), h('p', 'quest-box-step', '산문 너머에서 다시 볼 수 있다.'));
      return box;
    }
    const st = busy ? null : activeStep(scene);
    box.append(h('p', 'quest-box-title', `◆ ${scene.ch ? `${scene.ch}장` : '프롤로그'} · ${scene.title}`));
    if (!st) { box.append(h('p', 'quest-box-step', '…')); return box; }
    box.append(h('p', 'quest-box-step', fill(actOf(st))), h('p', 'quest-box-place', fill(st.p)));
    const rule = st.k === '전투' ? ruleOf(st) : '';
    if (rule) box.append(h('p', 'quest-box-rule', rule));
    const needs = needState(scene, st);
    if (needs.length) {
      const ul = h('ul', 'quest-box-needs');
      needs.forEach((n) => ul.append(h('li', n.done ? 'is-done' : '', `${n.done ? '◆' : '◇'} ${needLine(n)}`)));
      box.append(ul);
    }
    const row = h('div', 'quest-box-acts');
    const target = hashOf(st.w);
    if (target && !atPlace(st.w)) row.append(btn('ghost-btn quest-go', '그곳으로', () => go(target)));
    else if (!needs.length && st.l) row.append(btn('solid-btn quest-act', '이어서 본다', () => later()));
    else if (st.pre && !Q().pre[`${scene.id}.${Q().step}`]) row.append(btn('solid-btn quest-act', '이어서 본다', () => later()));
    actions(scene, st).forEach((b) => row.append(b));
    if (needs.some((n) => (n.type === 'equip' || n.type === 'inspect') && !n.done)) row.append(btn('ghost-btn quest-act', '소지품 열기', () => App.playApi()?.openInventory()));
    if (needs.some((n) => n.type === 'equip' && !n.done)) {
      const wid = App.playApi()?.heirloomWeapon?.();
      if (wid) row.append(btn('solid-btn quest-act', '바로 장착한다', () => { const r = App.playApi()?.equip(wid); if (r?.error) toast('본편', r.error); later(); }));
    }
    if (needs.some((n) => n.type === 'heirlvl' && !n.done)) row.append(btn('ghost-btn quest-act', '무구보관소로', () => go(App.placeHash('gym', 'hike'))));
    if (needs.some((n) => n.type === 'tutorial' && !n.done) && loc !== 'gym/battle') row.append(btn('ghost-btn quest-act', '퇴마 실습으로', () => go(App.placeHash('gym', 'battle'))));
    if (row.children.length) box.append(row);
    return box;
  }
  function drawTracker() {
    const side = document.getElementById('questTracker');
    if (side) side.replaceChildren(trackerBox());
    document.querySelectorAll('.quest-inline').forEach((el) => el.replaceChildren(trackerBox()));
    const b = document.getElementById('statusQuest'); if (b) b.textContent = progressText();
  }
  const progressText = () => (App.profile() ? `${doneCount()} / ${SCENES.length}` : '');

  /* ───────── 성취 카드 · 완료 띠 ───────── */
  const cards = [];
  let cardLayer = null;
  function card(c) { cards.push(c); setTimeout(flushCards, 60); }
  function flushCards() {
    if (busy || !cards.length || (layer && !layer.hidden)) return;
    if (!cardLayer) { cardLayer = h('div', 'ach-layer'); cardLayer.id = 'achieveLayer'; cardLayer.setAttribute('role', 'dialog'); cardLayer.hidden = true; document.body.append(cardLayer); }
    if (!cardLayer.hidden) return;
    const c = cards.shift();
    const box = h('div', `ach-card is-${c.kind || 'item'}`);
    for (const k of ['tl', 'tr', 'bl', 'br']) box.append(h('i', `pt-corner pt-${k}`));
    const MARK = { heir: '器', recipe: '方', item: '得', boss: '勝', chapter: '章', lose: '息' };
    box.append(h('span', 'ach-mark', MARK[c.kind] || '◆'), h('p', 'ach-head', c.head || ''));
    if (c.title) box.append(h('h3', 'ach-title', c.title));
    if (c.sub) box.append(h('p', 'ach-sub', c.sub));
    if (c.lines?.length) { const ul = h('ul', 'ach-lines'); c.lines.filter(Boolean).forEach((l) => ul.append(h('li', '', fill(l)))); box.append(ul); }
    const row = h('div', 'ach-acts');
    const close = () => { cardLayer.hidden = true; cardLayer.replaceChildren(); document.body.classList.remove('is-ach'); setTimeout(flushCards, 120); };
    if (c.btn) row.append(btn('ghost-btn', c.btn, () => { close(); c.act?.(); }));
    const ok2 = btn('solid-btn', cards.length ? `계속 (${cards.length})` : '계속', close); row.append(ok2);
    box.append(row); cardLayer.replaceChildren(box); cardLayer.hidden = false; document.body.classList.add('is-ach'); ok2.focus();
  }
  function banner(scene, chips) {
    const el = h('div', 'quest-banner');
    el.append(h('small', '', `${scene.ch ? `${scene.ch}장` : '프롤로그'} · 장면 완료`), h('b', '', `「${scene.title}」`));
    const row = h('div', 'quest-banner-chips'); chips.forEach((c) => row.append(h('span', '', c))); el.append(row);
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 600); }, 4200);
  }
  function chapterCard(ch, title) {
    const c = chapterOf(ch); const q = Q(); const list = SCENES.filter((s) => s.ch === ch);
    const picks = list.flatMap((s) => s.lines.map((ln, i) => (ln.t === 'choice' && q.picked[`${s.id}:${i}`] ? fill(ln.o[q.picked[`${s.id}:${i}`] - 1]) : null))).filter(Boolean);
    const next = D.chapters.find((x) => x.n === ch + 1);
    card({ kind: 'chapter', head: ch ? `제${ch}장 완료` : '프롤로그 완료', title: `《${c.title}》`, sub: `장면 ${list.length}개`, lines: [
      ...(picks.length ? [`고른 것 — ${picks.slice(0, 3).join(' / ')}${picks.length > 3 ? ' …' : ''}`] : []),
      ...(title ? [`칭호 「${title.name}」`] : []),
      next ? (isOpen(next.n) ? `${next.n}장 「${next.title}」이(가) 산문 너머에 열려 있다.` : `${next.n}장 「${next.title}」 — [아직 열리지 않은 이야기입니다.]`) : '',
    ] });
  }

  /* ───────── 이야기 화면 ─────────
   * v1.9: 그림 연출 없이, 지금 보던 화면 위의 대사 창에서 대사를 넘기기만 한다(배경 · 장면 그림 없음).
   *       남기는 것은 창 자체의 흔들림 · 번쩍임 · 붉은 테두리 · 방울 소리 · 기울인 글씨뿐이다. */
  let layer = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = h('div', 'scene-layer'); layer.id = 'sceneLayer'; layer.hidden = true; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', '이야기');
    document.body.append(layer);
    return layer;
  }
  let audio = null;
  function bellSound(n = 1) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < n; i++) {
        const t = audio.currentTime + i * 0.18; const o = audio.createOscillator(), o2 = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 1320; o2.frequency.value = 1980; o.type = o2.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g); o2.connect(g); g.connect(audio.destination); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
      }
    } catch (_) { /* 소리를 못 내는 환경이면 그림만 */ }
  }
  function playLines(scene, from, to, onEnd, replay) {
    const q = Q(), L = ensureLayer();
    const list = [];
    for (let i = from; i < to; i++) { const ln = scene.lines[i]; if (ln.op && !replay && scene.id === 'P-1') continue; list.push([i, ln]); }
    let at = 0, typing = null;
    const win = h('div', 'scene-win');
    const head = h('div', 'scene-head'); head.append(h('span', '', `${scene.ch ? `${scene.ch}장` : '프롤로그'} · ${scene.title}`), h('small', '', `${scene.place} · ${scene.time}`));
    const body = h('div', 'scene-body'), foot = h('div', 'scene-foot');
    win.append(head, body, foot);
    L.className = 'scene-layer'; L.replaceChildren(win); L.hidden = false; document.body.classList.add('is-scene'); drawTracker();
    const close = () => { clearInterval(typing); L.hidden = true; L.replaceChildren(); document.body.classList.remove('is-scene'); document.removeEventListener('keydown', onKey); persist(); onEnd && onEnd(); setTimeout(flushCards, 200); };
    const onKey = (e) => { if (L.hidden || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; if (e.key === 'Enter' || e.key === ' ') { const b = foot.querySelector('.scene-next'); if (b) { e.preventDefault(); b.click(); } } };
    document.addEventListener('keydown', onKey);
    function pulse(cls, ms) { L.classList.remove(cls); void L.offsetWidth; L.classList.add(cls); setTimeout(() => L.classList.remove(cls), ms); }
    function applyFx(fx) {
      const list = (fx || []).map((f) => f.split(':')[0]);
      if (list.includes('shake')) pulse('fx-shake', 600);
      if (list.includes('flash')) pulse('fx-flash', 450);
      if (list.includes('bell')) bellSound(1);
      win.classList.toggle('is-red', list.includes('red') || list.includes('red2'));
    }
    function nextBtn(label) {
      const next = btn('solid-btn scene-next', label || (at >= list.length - 1 ? '닫는다' : '다음'), () => {
        if (typing) { clearInterval(typing); typing = null; const tp = body.querySelector('[data-typing]'); if (tp) tp.textContent = tp.dataset.full; return; }
        at += 1; show();
      });
      foot.append(h('small', 'scene-count', `${at + 1} / ${list.length}`), next); next.focus();
    }
    function typeInto(el, text, speed = 32) {
      el.dataset.full = text; el.dataset.typing = '1'; el.textContent = '';
      let n = 0; clearInterval(typing);
      typing = setInterval(() => { n += 1; el.textContent = text.slice(0, n); if (n >= text.length) { clearInterval(typing); typing = null; delete el.dataset.typing; } }, speed);
    }
    function textEl(cls, text, fx) {
      const p = h('p', cls || '');
      if ((fx || []).includes('name')) String(text).split(/(\[[^\]]+\])/).forEach((part) => p.append(/^\[.*\]$/.test(part) ? h('span', 'vn-tag', part) : document.createTextNode(part)));
      else p.textContent = text;
      if ((fx || []).includes('italic')) p.classList.add('is-italic');
      return p;
    }
    function show() {
      while (at < list.length && !ok(list[at][1].c)) at += 1;
      if (at >= list.length) { close(); return; }
      const [idx, ln] = list[at]; const key = `${scene.id}:${idx}`;
      body.replaceChildren(); foot.replaceChildren();
      applyFx(ln.fx);
      if (ln.t === 'choice') { choice(ln, key); return; }
      if (ln.t === 'end') { endCard(ln.ch); return; }
      const fx = ln.fx || [];
      const row = h('div', `scene-line is-${ln.t}${fx.includes('corner') ? ' is-small' : ''}`);
      if (ln.t === 'say' || ln.t === 'news') {
        const shown = ln.unk ? '??' : fill(ln.w || '');
        row.append(portrait(ln.w || '', shown));
        const tx = h('div', 'scene-text'); tx.append(h('b', 'scene-name', shown), textEl('', fill(ln.x), fx));
        if (ln.a) tx.append(h('p', 'scene-action', fill(ln.a)));
        row.append(tx);
        if (ln.t === 'news') row.classList.add('is-news');
      } else if (ln.t === 'b') {
        row.append(portrait('비령', '비령'));
        const tx = h('div', 'scene-text'); const p = h('p', 'scene-term'); tx.append(h('b', 'scene-name', '비령'), p); row.append(tx);
        typeInto(p, fill(ln.x));
        if (ln.a) tx.append(h('p', 'scene-action', fill(ln.a)));
      } else if (ln.t === 'sys') {
        const c = h('div', 'vn-system'); c.append(h('span', '', '◆'), textEl('', fill(ln.x), fx)); row.append(c);
      } else if (ln.t === 'i') {
        const c = h('div', 'vn-inspect'); c.append(h('b', '', `「${itemName('st-bell302')}」`), textEl('', fill(ln.x), fx)); row.append(c);
        bellSound(1);
      } else {
        const tx = h('div', 'scene-text is-narr');
        tx.append(textEl('', fill(ln.x), fx));
        if (ln.a) tx.append(h('p', 'scene-action', fill(ln.a)));
        row.append(tx);
      }
      body.append(row);
      nextBtn();
    }
    function endCard(ch) {
      const c = chapterOf(ch);
      const box = h('div', 'vn-title is-end'); box.append(h('small', '', `${volOf(c.vol).title ? `제${c.vol}권 · ${volOf(c.vol).title}` : ''}`), h('b', '', `${ch}장 ─ ${c.title}`), h('span', 'vn-title-seal', '終'));
      body.append(box); nextBtn('닫는다');
    }
    function choice(ln, key) {
      const already = q.picked[key];
      if (already || replay) {
        if (already) body.append(h('p', 'scene-chosen', `고른 것 — ${fill(ln.o[already - 1])}`)); else body.append(h('p', 'scene-chosen', '(고르지 않은 갈림)'));
        nextBtn('다음'); return;
      }
      const qBox = h('div', `vn-choice${ln.vote ? ' is-vote' : ''}`);
      if (ln.vote) qBox.append(h('span', 'vn-vote-badge', '모두의 선택'));
      if (ln.q) qBox.append(h('p', 'scene-question', fill(ln.q)));
      const box = h('div', 'scene-options');
      ln.o.forEach((text, i) => {
        const n = i + 1;
        const b = btn('scene-option', '', () => pick(ln, key, n)); b.append(h('i', '', CIRC[i]), h('span', '', fill(text)));
        if (ln.id === HEIR_CHOICE && HEIRS[i]) { b.classList.add('is-heir'); b.append(h('small', 'scene-option-note', `${HEIRS[i].line} 계통 · 무구 「${itemName(HEIRS[i].weapon)}」 — ${HEIRS[i].note}`)); }
        box.append(b);
      });
      qBox.append(box); body.append(qBox);
      box.querySelector('button')?.focus();
    }
    function pick(ln, key, n) {
      q.picked[key] = n; q.pick[scene.id] = n; q.flags[ln.id] = n;
      if (ln.id === HEIR_CHOICE) { save().story.heirloom = HEIRS[n - 1]?.weapon || null; App.mark('heirloomChosen'); if (!q.keep.includes('부모의 유품')) q.keep.push('부모의 유품'); }
      Sync()?.choice(ln.id, n);
      persist(); at += 1; show();
    }
    // 장의 첫 장면을 처음 열 때: 권 · 장 표제
    const firstOfChapter = SCENES.find((s) => s.ch === scene.ch) === scene && from === 0;
    if (firstOfChapter && !replay) {
      const c = chapterOf(scene.ch);
      const box = h('div', 'vn-title'); box.append(h('small', '', `제${c.vol}권 · ${volOf(c.vol).title}${volOf(c.vol).hanja ? ` (${volOf(c.vol).hanja})` : ''}`), h('b', '', scene.ch ? `${scene.ch}장 ─ ${c.title}` : c.title));
      body.append(box);
      foot.append(btn('solid-btn scene-next', '시작한다', () => show()));
      foot.querySelector('button').focus();
    } else show();
  }

  /* ───────── 산문 너머 ───────── */
  function renderBoard(tab) {
    const body = App.body; const cur = ['quests', 'places', 'record', 'world'].includes(tab) ? tab : 'quests';
    App.addTo('pages', 'story');
    if (!App.profile()) { body.append(App.needProfile()); return; }
    App.setTabs(App.tabs, [{ id: 'quests', label: '이야기' }, { id: 'places', label: '바깥 지역' }, { id: 'record', label: '나의 기록' }, { id: 'world', label: '모두의 선택' }], cur, (id) => go(`#/zone/north/${id}`));
    const now = h('div', 'quest-inline'); body.append(h('p', 'panel-label', '지금 할 일'), now, h('div', 'panel-rule'));
    if (cur === 'quests') boardQuests(body); else if (cur === 'places') boardPlaces(body); else if (cur === 'record') boardRecord(body); else boardWorld(body);
    drawTracker();
  }
  function boardQuests(body) {
    const q = Q(), now = current();
    body.append(h('p', 'panel-count', `산문 너머 — 본편 ${doneCount()} / ${SCENES.length}`));
    D.volumes.forEach((v) => {
      const vol = h('section', 'quest-vol');
      vol.append(h('h3', 'quest-vol-title', `제${v.n}권 《${v.title}》${v.hanja ? ` ${v.hanja}` : ''}`));
      D.chapters.filter((c) => c.vol === v.n).forEach((c) => {
        const det = h('details', 'quest-chapter');
        const label = c.n ? `${c.n}장 · ${c.title}` : c.title;
        if (!isOpen(c.n)) { det.classList.add('is-locked'); det.append(h('summary', '', label), h('p', 'quest-locked', '[아직 열리지 않은 이야기입니다.]')); vol.append(det); return; }
        const list = SCENES.filter((s) => s.ch === c.n);
        det.open = list.includes(now);
        det.append(h('summary', '', `${label}  ${list.filter((s) => q.done[s.id]).length}/${list.length}`));
        list.forEach((s) => {
          const done = !!q.done[s.id], isNow = s === now;
          const row = h('div', `quest-row${done ? ' is-done' : isNow ? ' is-now' : ' is-locked'}`);
          const t = h('div', 'quest-row-text');
          t.append(h('strong', '', `${done ? '◆' : isNow ? '◈' : '◇'} ${done || isNow ? s.title : '？？？'}`), h('p', '', done || isNow ? fill(s.post) : '앞의 일을 마치면 열린다.'));
          row.append(t);
          if (done) row.append(btn('ghost-btn codex-use', '다시 보기', () => { busy = true; playLines(s, 0, s.lines.length, () => { busy = false; drawTracker(); }, true); }));
          det.append(row);
        });
        vol.append(det);
      });
      body.append(vol);
    });
  }
  function boardPlaces(body) {
    const q = Q(); const open = Object.keys(D.regions).filter((r) => q.regions[r]);
    body.append(para('산문 밖. 이야기가 길을 열어 주면 여기에서 걸어 나갈 수 있다. (학당 안의 장소는 오방 지도에서 간다.)'));
    if (!open.length) { body.append(App.emptyBox('外', '아직 열린 길이 없다.', '금줄 밖으로는 나가지 마라.')); return; }
    open.forEach((r) => { const reg = D.regions[r]; const c = btn('quest-region', '', () => go(`#/out/${r}`)); c.append(h('strong', '', reg.name), h('small', '', `${reg.sub} · ${reg.spots.length}곳`)); body.append(c); });
  }
  function boardRecord(body) {
    const q = Q();
    const meta = h('div', 'quest-meta');
    meta.append(h('span', '', `유품 — ${heir() ? `${heir().name} (${heir().line} 계통 · 무구 「${itemName(heir().weapon)}」)` : '아직'}`));
    body.append(meta, h('p', 'panel-label', '간직한 것'), q.keep.length ? para(q.keep.join(' · ')) : para('아직 없다.'));
    const foes = Object.entries(D.foes);
    body.append(h('p', 'panel-label', `퇴마한 상대 ${foes.filter(([k]) => q.beaten[k]).length} / ${foes.length}`));
    const fg = h('div', 'dex-grid');
    foes.forEach(([k, f]) => { const c = h('div', `dex-cell${q.beaten[k] ? ' is-on' : ''}`); c.append(h('b', '', q.beaten[k] ? f.name : '？？？'), h('small', '', q.beaten[k] ? f.blurb : `${f.tier}단계 수준`)); fg.append(c); });
    body.append(fg, h('p', 'panel-label', '내가 고른 것'));
    const ul = h('ul', 'admin-list');
    SCENES.forEach((sc) => sc.lines.forEach((ln, i) => { const n = q.picked[`${sc.id}:${i}`]; if (ln.t === 'choice' && n) ul.append(h('li', '', `${sc.ch ? `${sc.ch}장` : '프롤로그'} ${sc.title} — ${fill(ln.o[n - 1])}`)); }));
    body.append(ul.children.length ? ul : para('아직 없다.'));
  }
  function boardWorld(body) {
    const q = Q(), sync = Sync();
    body.append(para(sync?.enabled ? '모든 학생의 선택이 모인다. 내가 고른 것은 금색으로 보인다.' : '서버에 닿기 전이라 지금은 내가 고른 것만 보인다.'));
    const box = h('div', 'quest-tally'); body.append(box);
    const shown = Object.entries(D.choices || {}).filter(([id, c]) => isOpen(c.ch) && q.flags[id]);
    if (!shown.length) { box.append(para('아직 고른 것이 없다.')); return; }
    const draw = (by) => {
      box.replaceChildren();
      shown.forEach(([id, c]) => {
        const counts = by?.[id] || {}; const sum = Object.values(counts).reduce((a, b) => a + b, 0);
        const row = h('div', 'quest-tally-row'); row.append(h('strong', '', `${c.ch ? `${c.ch}장` : '프롤로그'} · ${c.q || c.scene}${c.vote ? ' (모두의 선택)' : ''}`));
        c.o.forEach((o, i) => { const v = counts[i + 1] || 0; row.append(h('p', q.flags[id] === i + 1 ? 'is-mine' : '', `${CIRC[i]} ${fill(o)}${by ? ` — ${v}명 (${sum ? Math.round(v * 100 / sum) : 0}%)` : ''}`)); });
        box.append(row);
      });
    };
    draw(null);
    if (sync?.enabled) sync.tally().then((rows) => { const by = {}; (rows || []).forEach((r) => { (by[r.branch] = by[r.branch] || {})[r.option] = r.votes; }); draw(by); }).catch(() => {});
  }

  /* ───────── 바깥 지역 (#/out/<지역>/<지점>) ───────── */
  function renderPlace(regId, spotId) {
    const reg = D.regions[regId];
    if (!reg || !Q().regions[regId]) { go('#/zone/north/places'); return; }
    App.openPage(`外 / ${reg.sub}`, reg.name, 'simple');
    const body = App.body;
    const box = h('div', 'quest-inline'); body.append(box);
    const board = h('div', 'pxmap pxmap-yellow'); const title = h('div', 'pxmap-title'); title.append(h('b', '', '外'), h('span', '', reg.name));
    const plan = h('div', 'pxwall pxplan');
    reg.spots.forEach((s) => { const b = btn(`pxroom${s.id === spotId ? ' is-here' : ''}`, '', () => go(`#/out/${regId}/${s.id}`)); b.append(h('span', '', `${s.id === spotId ? '◆ ' : ''}${s.name}`)); plan.append(b); });
    board.append(title, plan); body.append(board);
    const spot = reg.spots.find((s) => s.id === spotId);
    if (spot) body.append(h('p', 'panel-label', spot.name), para(spot.desc)); else body.append(para('갈 곳을 고른다.'));
    body.append(btn('ghost-btn', '산문 너머로 돌아간다', () => go('#/zone/north/places')));
    drawTracker();
  }

  /* ───────── 관리자 [스토리 관리] (#/admin/story) ─────────
   * 장 파일 올리기 · 지금 공개 · 공개 시각 정하기 · 닫기 / 선택 집계(선택지마다 몇 명) · 누가 무엇을 골랐는지. */
  const codeKey = 'biryeong-admin-code-session';
  // 관리자 계정으로 서버에 로그인해 있으면 코드를 다시 묻지 않는다(계정의 표로 통과).
  const adminToken = () => { const A = window.BiryeongAuth; return A?.server && A.isAdmin() && A.token() ? `token:${A.token()}` : ''; };
  const adminCode = () => { if (adminToken()) return adminToken(); try { return sessionStorage.getItem(codeKey) || ''; } catch (_) { return ''; } };
  function renderAdminStory(body) {
    const sync = Sync(); const server = !!sync?.enabled;
    body.append(para(server
      ? '서버(Supabase)에 연결되어 있다. 장을 공개하면 모든 학생에게 열린다. 공개 전 장의 내용은 서버가 학생에게 내주지 않는다.'
      : '서버가 연결되지 않았다. 여기서 올리고 공개한 장은 이 브라우저(이 기기의 모든 계정)에만 적용된다. config.js 에 Supabase 를 연결하면 모두에게 공개된다.'));
    if (server && !adminToken()) {
      const f = h('form', 'admin-form story-code'); const inp = h('input'); inp.type = 'password'; inp.placeholder = '관리자 코드 (이 탭이 닫힐 때까지 기억)'; inp.value = adminCode(); inp.autocomplete = 'off';
      const b = h('button', 'ghost-btn', '코드 기억'); b.type = 'submit'; f.append(h('span', 'panel-label', '서버에 쓰려면 관리자 코드가 한 번 더 필요하다'), inp, b);
      f.addEventListener('submit', (e) => { e.preventDefault(); try { sessionStorage.setItem(codeKey, inp.value.trim()); } catch (_) { /* 무시 */ } toast('스토리 관리', '관리자 코드를 기억했다.'); App.route(); });
      body.append(f);
    }
    const pv = h('label', 'admin-check'); const pvIn = h('input'); pvIn.type = 'checkbox'; pvIn.checked = preview();
    pv.append(pvIn, h('span', '', '관리자 미리 보기 — 올려 둔 장을 공개 전에 나만 플레이해 본다(이 브라우저에 올린 장 파일)'));
    pvIn.addEventListener('change', () => { save().adminStoryPreview = pvIn.checked; persist(); refreshChapters(); });
    body.append(pv);

    body.append(h('p', 'panel-label', '장 공개'));
    const table = h('div', 'story-admin-list'); body.append(table);
    const L = localStore();
    const drawRows = (srv) => {
      table.replaceChildren();
      D.chapters.forEach((c) => {
        const row = h('div', 'story-admin-row'); const info = h('div', 'story-admin-info');
        const local = L[c.n]; const s = srv?.find((x) => Number(x.ch) === c.n);
        const has = c.n === 0 || (server ? !!s?.has_content : !!local?.content);
        const openAt = c.n === 0 ? 'always' : server ? s?.open_at : local?.openAt;
        const state = c.n === 0 ? '늘 열림(튜토리얼)' : !has ? '장 파일 없음' : !openAt ? '닫힘' : Date.parse(openAt) <= Date.now() ? '공개 중' : `공개 예정 · ${new Date(openAt).toLocaleString('ko-KR')}`;
        info.append(h('strong', '', `제${c.vol}권 · ${c.n ? `${c.n}장` : ''} ${c.title}`), h('small', '', state));
        row.append(info);
        if (c.n === 0) { table.append(row); return; }
        const acts = h('div', 'story-admin-acts');
        const file = h('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
        file.addEventListener('change', async () => {
          const f = file.files?.[0]; if (!f) return;
          let content; try { content = JSON.parse(await f.text()); } catch (_) { toast('스토리 관리', 'JSON 파일이 아니다.'); return; }
          if (!validChapter(content, c.n)) { toast('스토리 관리', `${c.n}장 파일이 아니다. (story-chapters/ch${c.n}.json)`); return; }
          const all = localStore(); all[c.n] = { ...(all[c.n] || {}), title: c.title, content, uploadedAt: new Date().toISOString() }; writeLocal(all);
          if (server) { const r = await sync.adminSet(adminCode(), c.n, c.title, content, null, 'content'); if (r?.error) { toast('스토리 관리', `서버에 올리지 못했다 — ${r.error}`); return; } }
          toast('스토리 관리', `${c.n}장 파일을 올렸다. 아직 공개되지 않았다.`); refreshChapters(); App.route();
        });
        acts.append(file, btn('ghost-btn codex-use', has ? '파일 바꾸기' : '파일 올리기', () => file.click()));
        const setOpen = async (iso) => {
          if (!has) { toast('스토리 관리', '먼저 장 파일을 올려야 한다.'); return; }
          const all = localStore(); all[c.n] = { ...(all[c.n] || {}), openAt: iso }; writeLocal(all);
          if (server) { const r = await sync.adminSet(adminCode(), c.n, c.title, null, iso, 'open'); if (r?.error) { toast('스토리 관리', `서버에 쓰지 못했다 — ${r.error}`); return; } }
          toast('스토리 관리', iso ? (Date.parse(iso) <= Date.now() ? `${c.n}장을 공개했다.` : `${c.n}장 공개 시각을 정했다.`) : `${c.n}장을 닫았다.`); refreshChapters(); App.route();
        };
        acts.append(btn('solid-btn codex-use', '지금 공개', () => setOpen(new Date().toISOString())));
        const when = h('input'); when.type = 'datetime-local'; when.className = 'story-when';
        if (openAt && Date.parse(openAt) > Date.now()) { const d = new Date(openAt); when.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
        acts.append(when, btn('ghost-btn codex-use', '이 시각에 공개', () => { if (!when.value) { toast('스토리 관리', '공개 시각을 고른다.'); return; } setOpen(new Date(when.value).toISOString()); }));
        if (openAt) acts.append(btn('ghost-btn codex-use', '닫기', () => setOpen(null)));
        row.append(acts); table.append(row);
      });
    };
    drawRows(null);
    if (server) sync.adminList(adminCode()).then((r) => { if (r?.error) { table.prepend(para(`서버 목록을 읽지 못했다 — ${r.error} (관리자 코드를 확인)`)); return; } drawRows(r); }).catch(() => {});

    body.append(h('p', 'panel-label', '선택 집계 · 누가 무엇을 골랐나'));
    const votes = h('div', 'story-votes'); body.append(votes); votes.append(para('불러오는 중…'));
    const drawVotes = (rows) => {
      votes.replaceChildren();
      const by = {};
      rows.forEach((r) => { ((by[r.branch] = by[r.branch] || {})[r.option] = by[r.branch][r.option] || []).push(r); });
      Object.entries(D.choices || {}).forEach(([id, c]) => {
        const sec = h('details', `story-vote${c.vote ? ' is-vote' : ''}`); sec.open = !!c.vote;
        const all = Object.values(by[id] || {}).flat(); const sum = all.length;
        sec.append(h('summary', '', `${id} · ${c.ch ? `${c.ch}장` : '프롤로그'} 「${c.scene}」 ${c.q ? `— ${c.q}` : ''}${c.vote ? ' (투표)' : ''} · ${sum}명`));
        c.o.forEach((o, i) => {
          const list = by[id]?.[i + 1] || []; const pct = sum ? Math.round(list.length * 100 / sum) : 0;
          const line = h('div', 'story-vote-opt'); const bar = h('i'); bar.style.width = `${pct}%`; const track = h('span', 'story-vote-bar'); track.append(bar);
          line.append(h('b', '', `${CIRC[i]} ${o}`), track, h('small', '', `${list.length}명 · ${pct}%`));
          sec.append(line);
          if (list.length) sec.append(h('p', 'story-vote-who', list.map((r) => r.account || r.player_id?.slice(0, 8)).join(', ')));
        });
        votes.append(sec);
      });
    };
    const localVotes = () => {
      const rows = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i); if (!k?.startsWith('biryeong-save-v1:')) continue;
          const s = JSON.parse(localStorage.getItem(k) || 'null'); const flags = s?.story?.q?.v === 4 ? s.story.q.flags : null; if (!flags) continue;
          Object.entries(flags).forEach(([branch, option]) => rows.push({ account: k.slice('biryeong-save-v1:'.length), branch, option }));
        }
      } catch (_) { /* 읽을 수 없으면 비운다 */ }
      return rows;
    };
    if (server) sync.adminChoices().then((rows) => drawVotes(rows || [])).catch(() => { votes.replaceChildren(para('서버에서 선택을 읽지 못했다. 이 브라우저의 계정들만 보인다.')); drawVotes(localVotes()); });
    else { drawVotes(localVotes()); votes.prepend(para('서버 연결 전 — 이 브라우저에 있는 계정들의 선택만 모았다.')); }
  }

  const peek = () => { const scene = current(); const st = scene && !busy ? activeStep(scene) : null; return { id: scene?.id || null, step: st ? Q().step : -1, w: st?.w || '', at: st ? atPlace(st.w) : false, needs: st ? needState(scene, st).map((n) => ({ raw: n.raw, type: n.type, arg: n.arg, have: n.have, count: n.count, done: n.done })) : [], busy, open: Object.keys(loaded).map(Number) }; };
  window.BiryeongQuest = { renderBoard, renderPlace, renderAdminStory, progressText, tick, state: Q, current, peek, inspectable, refreshChapters, isOpen, replay: (id) => byId[id] && playLines(byId[id], 0, byId[id].lines.length, null, true) };
  refreshChapters();
  App.route();
  drawTracker();
})();
