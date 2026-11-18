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
  var voteIdx = null; // eslint-disable-line no-var -- rebuild() 가 맨 먼저 불려서 var 로 둔다
  let SCENES = [], byId = {};
  const validChapter = (c, n) => c && c.format === 'biryeong-chapter' && Number(c.ch) === Number(n) && Array.isArray(c.scenes) && c.scenes.every((s) => s.id && Array.isArray(s.lines) && Array.isArray(s.steps));
  function rebuild() {
    SCENES = [...D.scenes, ...Object.keys(loaded).map(Number).sort((a, b) => a - b).flatMap((n) => loaded[n].scenes)];
    byId = Object.fromEntries(SCENES.map((s) => [s.id, s]));
    voteIdx = null; // 투표 장면 색인은 다음에 쓸 때 다시 만든다
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
    const R = {}, RL = routeStore();
    if (sync?.enabled && sync.openRoutes) { try { (await sync.openRoutes() || []).forEach((r) => { R[r.flag] = Number(r.option); }); } catch (_) { /* 다음에 */ } }
    else Object.entries(RL).forEach(([f, v]) => { if (v?.option && v.openAt && Date.parse(v.openAt) <= now) R[f] = Number(v.option); });
    if (preview()) Object.entries(RL).forEach(([f, v]) => { if (v?.option) R[f] = Number(v.option); });
    const rBefore = JSON.stringify(routes); Object.keys(routes).forEach((k) => delete routes[k]); Object.assign(routes, R);
    const before = Object.keys(loaded).sort().join(',') + rBefore, after = Object.keys(got).sort().join(',') + JSON.stringify(routes);
    Object.keys(loaded).forEach((k) => delete loaded[k]); Object.assign(loaded, got); rebuild();
    if (before !== after) { drawTracker(); if (/^#\/zone\/north/.test(location.hash) || /^#\/admin\/story/.test(location.hash)) App.route(); else later(); }
  }
  // vC.01: 2분마다 · 가려진 탭은 묻지 않는다 · 다시 보이면 곧바로 한 번
  setInterval(() => { if (!document.hidden) refreshChapters(); }, 300 * 1000); // vD.01 공개 장 목록은 드물게 바뀐다 — 5분마다
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshChapters(); });

  /* ───────── 인물 얼굴 자리 (vC.01) ─────────
   * · 메인 인물(윤진서 · 연호수 · △△ · 비 · 서창현): 그림을 넣을 자리. config.js 의 BIRYEONG_PORTRAITS 에 적으면 그 인물의 대사마다 저절로 붙는다. 없으면 빈 액자.
   * · 비령: 한자 「秘靈」.
   * · 그 밖의 인물(엑스트라): 글자 없는 단색 원. 인물마다 색이 다르다. */
  const MAIN_CAST = ['윤진서', '연호수', '△△', '비', '서창현'];
  const FIXED_TONE = { 훈련관: '#b8643c', 진달래: '#a35f7a', PC: '#7d8494', '??': '#2a2f3a' };
  const TONES = ['#b8643c', '#5f8fa8', '#8c9a4f', '#a35f7a', '#c79a45', '#4f948d', '#7a6bb0', '#b05a55', '#6f8496', '#9b7a55', '#4c7a5a', '#a88fc0', '#c27f95', '#5a6fa8', '#8f8a7a', '#3f8f9f', '#b98a6a', '#6a9a82', '#93624a', '#7f93b8', '#a89a5a', '#8a5f8f', '#5f7f6f', '#c06f4f'];
  const toneUsed = {}; // 이름 → 색 (한 번 정해지면 그대로). 다른 인물과 겹치지 않게 빈 색부터 준다.
  const ALIAS = { 해원: '비' };
  const baseName = (who) => { const k = String(who || '').replace(/\(.*\)$/, '').trim(); return ALIAS[k] || k; };
  function toneOf(who) {
    const k = baseName(who) || '??';
    if (FIXED_TONE[k]) return FIXED_TONE[k];
    if (toneUsed[k]) return toneUsed[k];
    let n = 0; for (const ch of k) n = (n * 31 + ch.charCodeAt(0)) % 9973;
    const taken = new Set([...Object.values(toneUsed), ...Object.values(FIXED_TONE)]);
    let pick = null;
    for (let i = 0; i < TONES.length; i++) { const t = TONES[(n + i) % TONES.length]; if (!taken.has(t)) { pick = t; break; } }
    if (!pick) pick = `hsl(${(n * 47) % 360} 34% 50%)`; // 색을 다 썼으면 이름에서 색상을 뽑는다
    return (toneUsed[k] = pick);
  }
  const PORTRAITS = window.BIRYEONG_PORTRAITS || {};
  // vC.06 표정: 그림이 { base, smile, … } 처럼 여러 장이면 대사마다 고른다. 원고 줄에 e(표정 이름)가 있으면 그것, 없으면 글 · 지문으로 짐작한다.
  const MOOD = [
    ['surprised', /[?？]!|![?？]|!!|^[⋯…]+!|^(헉|엇|어\?|에\?|네\?|뭐\?|뭐라고|잠깐)|깜짝|놀라/],
    ['angry', /X발|썅|젠장|닥쳐|시끄러|짜증|빌어|꺼져!|미친|노려|인상을 쓰|화가 났|화를 내|화를 냈|소리쳤|버럭/],
    ['sad', /미안|죄송|어떡|무서|걱정|불안|아파|힘들|울먹|훌쩍|떨리|떨며|한숨|모르겠/],
    ['smile', /하하|헤헤|후후|흐흐|ㅎㅎ|다행|고마워|고맙|감사합|좋아요|좋아!|반가|기뻐|웃|신난|재밌|최고|♪|~!/],
  ];
  const MOOD_FACE = {
    '△△': { surprised: 'serious', angry: 'serious', sad: 'sad', smile: 'smile' },
    서창현: { surprised: 'sweat', sad: 'sweat', smile: 'smile' },
    연호수: { surprised: 'frown', angry: 'frown', sad: 'frown', smile: 'smile' },
    윤진서: { surprised: 'surprised', angry: 'serious', sad: 'worried', smile: 'smile', bang: 'smile' },
  };
  function faceOf(k, ln) {
    if (!ln) return 'base';
    if (ln.e) return ln.e;
    const t = `${ln.x || ''} ${ln.a || ''}`;
    let mood = (MOOD.find(([, re]) => re.test(t)) || [])[0];
    if (!mood && /!\s*$/.test(ln.x || '')) mood = 'bang'; // 밝게 끝나는 말
    return (MOOD_FACE[k] || {})[mood] || 'base';
  }
  // vD.01 얼굴 그림을 작은 칸에 그대로 줄이면 가는 선이 도트처럼 깨진다 — 미리 매끈하게 줄여 둔 72 · 144 크기를 브라우저가 고르게 한다
  function portraitSrcset(src) { return /assets\/portraits\/[^/]+\.webp$/.test(src) && !/-(72|144)\.webp$/.test(src) ? `${src.replace(/\.webp$/, '-72.webp')} 72w, ${src.replace(/\.webp$/, '-144.webp')} 144w, ${src} 240w` : ''; }
  function portrait(who, shown, ln = null) {
    const k = baseName(who);
    const box = h('div', 'pt-frame'); box.dataset.who = who;
    for (const c of ['tl', 'tr', 'bl', 'br']) box.append(h('i', `pt-corner pt-${c}`));
    let src = shown !== '??' && (PORTRAITS[who] || PORTRAITS[k]);
    if (src && typeof src === 'object') { const f = faceOf(k, ln); box.dataset.face = src[f] ? f : 'base'; src = src[f] || src.base || Object.values(src)[0]; }
    const fallback = () => (k === '비령' ? hanjaSeal() : shown !== '??' && MAIN_CAST.includes(k) ? emptySlot(k) : seal(shown === '??' ? '??' : who));
    if (src) { const img = new Image(); img.className = 'pt-img'; img.alt = `${shown} 초상`; const ss = portraitSrcset(src); if (ss) { img.srcset = ss; img.sizes = '(max-width:790px) 50px, 70px'; } img.src = src; img.addEventListener('error', () => img.replaceWith(fallback())); box.append(img); }
    else box.append(fallback());
    return box;
  }
  /** 단색 원(글자 없음) */
  function seal(who) { const s = h('span', 'pt-seal is-plain'); s.style.setProperty('--hair', toneOf(who)); s.setAttribute('aria-hidden', 'true'); return s; }
  /** 비령: 한자 */
  function hanjaSeal() { const s = h('span', 'pt-seal is-hanja', '秘靈'); s.setAttribute('aria-hidden', 'true'); return s; }
  /** 메인 인물: 그림이 들어올 빈 자리 */
  function emptySlot(k) { const s = h('span', 'pt-empty'); s.dataset.slot = k; s.setAttribute('aria-hidden', 'true'); return s; }

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
  // 최초 1회만: 본편이 주는 것 · 서버에 올리는 선택은 계정 기록(story.claimed / story.sent)에 남겨, 다시 보기 · 이야기 재시작 · 원고 판 갈이에도 두 번 들어오지 않게 한다.
  // (q 는 원고 판이 바뀌면 새로 시작하지만 claimed · sent 는 q 바깥에 두어 그대로 남는다)
  function claims() { const st = save().story; if (!st.claimed || typeof st.claimed !== 'object') st.claimed = {}; if (!st.sent || typeof st.sent !== 'object') st.sent = {}; return st; }
  function claimOnce(key) { const st = claims(); if (st.claimed[key]) return false; st.claimed[key] = Date.now(); return true; }
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
  function ok(conds, sid) {
    return (conds || []).every((c) => (c.flag ? c.in.includes(flagOf(c.flag, sid)) : true));
  }
  /* ───────── 모두의 선택(투표) → 루트 공개 ─────────
   * 투표 선택(예: C2-3)은 각자 고른 것이 집계로만 쓰이고, 이야기가 실제로 어느 길로 갈지는 관리자가 [스토리 관리]에서 공개한 루트를 따른다.
   * 루트가 공개되기 전에는 그 갈림길 뒤의 장면이 「모두의 선택이 모이는 중」으로 멈춰 있다. */
  const VOTES = new Set(Object.entries(D.choices || {}).filter(([, c]) => c.vote).map(([id]) => id));
  const ROUTE_KEY = 'biryeong-story-routes-v1'; // { [선택]: { option, openAt } } — 서버가 없을 때 · 관리자 미리 보기
  const routes = {}; // 공개된 루트 { [선택]: 번호 }
  const routeStore = () => { try { return JSON.parse(localStorage.getItem(ROUTE_KEY) || '{}') || {}; } catch (_) { return {}; } };
  // 투표 선택을 고른 그 장면 안(바로 뒤 반응 대사)에서는 내가 고른 것을, 그 뒤 장면부터는 공개된 루트를 따른다.
  function voteScene(id) {
    if (!voteIdx) { voteIdx = {}; SCENES.forEach((sc) => sc.lines.forEach((l) => { if (l.t === 'choice' && VOTES.has(l.id)) voteIdx[l.id] = sc.id; })); }
    return voteIdx[id];
  }
  function flagOf(id, sid) { return VOTES.has(id) && sid !== voteScene(id) ? routes[id] : Q().flags[id]; }
  // 이 장면이 아직 공개되지 않은 루트를 기다리는가 → 그 선택 id
  function waitingRoute(scene) {
    if (!scene) return null;
    const ids = new Set();
    const scan = (cs) => (cs || []).forEach((c) => { if (c.flag && VOTES.has(c.flag)) ids.add(c.flag); });
    scan(scene.c); scene.lines.forEach((l) => scan(l.c)); scene.steps.forEach((s) => { scan(s.c); Object.keys(s.alt || {}).forEach((f) => VOTES.has(f) && ids.add(f)); Object.keys(s.alt_a || {}).forEach((f) => VOTES.has(f) && ids.add(f)); });
    return [...ids].find((f) => routes[f] == null && voteScene(f) !== scene.id) || null;
  }

  /* ───────── 진행 ───────── */
  const firstScene = () => SCENES.find((s) => !Q().done[s.id] && ok(s.c, s.id)) || null;
  const current = () => { const s = firstScene(); return s && waitingRoute(s) ? null : s; };
  const routeWait = () => { const s = firstScene(); const f = waitingRoute(s); return f ? { scene: s, flag: f } : null; };
  const doneCount = () => SCENES.filter((s) => Q().done[s.id]).length;
  /** 다음에 열려야 할 장(지금 이어 할 장면이 없을 때) */
  function nextLocked() {
    const q = Q();
    const lastDone = Math.max(0, ...SCENES.filter((s) => q.done[s.id]).map((s) => s.ch));
    return D.chapters.find((c) => c.n > lastDone && !isOpen(c.n)) || null;
  }
  function activeStep(scene) {
    const q = Q();
    while (q.step < scene.steps.length && !ok(scene.steps[q.step].c, scene.id)) { q.step += 1; q.prog = {}; }
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
  const pickOf = (map) => { for (const [flag, by] of Object.entries(map || {})) { const v = flagOf(flag); if (v != null && by[v] != null) return by[v]; } return null; };
  const needsOf = (st) => (st.alt ? pickOf(st.alt) || st.n || [] : st.n || []);
  const actOf = (st) => (st.alt_a ? pickOf(st.alt_a) || st.a : st.a);
  const ruleOf = (st) => (Array.isArray(st.rule) ? st.rule[(flagOf(Object.keys(st.alt || {})[0]) || 1) - 1] : st.rule) || '';
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
    const stepKey = `${scene.id}.${q.step}`;
    if (st.give && a && claimOnce(`give:${stepKey}`)) {
      a.grant({ items: st.give, log: `본편: ${Object.entries(st.give).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}을(를) 받았다.` });
      for (const [id, n] of Object.entries(st.give)) { q.given[id] = (q.given[id] || 0) + n; got.push(`${itemName(id)}${n > 1 ? ` ×${n}` : ''}`); }
    }
    if (st.heir && heir() && a && !q.given[heir().weapon] && !claims().claimed[`heir:${stepKey}`]) {
      claims().claimed[`heir:${stepKey}`] = Date.now();
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
    if (claimOnce(`done:${scene.id}`)) try { App.playApi()?.grant({ spirit, money, log: `본편 「${scene.title}」을(를) 마쳤다. 영력 +${spirit}, ${money}냥.` }); } catch (_) { /* 실행 화면이 아직 없으면 넘어간다 */ }
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
    q.beaten[r.key] = q.beaten[r.key] || Date.now();
    if (r.withNpc) claimOnce(`npc:${r.key}`); // vC.06 NPC와 함께 깨는 것은 전투마다 계정당 한 번
    persist();
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
        const size = App.playApi()?.storySize?.(n.arg) ?? 3;
        out.push(btn('solid-btn quest-act', `${foe.name}와(과) ${n.calm ? '마주한다' : '싸운다'} · ${size > 1 ? '다인' : '1인'}`, () => {
          const a = App.playApi(); if (!a) { toast('본편', '실행 화면을 불러오는 중이다.'); return; }
          a.storyBattle({ key: n.arg, tier: foe.tier, i: foe.i, name: foe.name, blurb: foe.blurb, ctx: { form: 1, stage: `${scene.id}.${q.step}`, names: { player: playerName() }, family: lineKey(), has: { 'st-bell302': countOf('st-bell302') > 0 }, first: !q.beaten[n.arg], npcUsed: !!claims().claimed[`npc:${n.arg}`] } });
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
      const wait = routeWait();
      if (wait) { const c = D.choices[wait.flag]; box.append(h('p', 'quest-box-title', `◇ ${c?.ch ? `${c.ch}장 · ` : ''}${wait.scene.title}`), h('p', 'quest-box-step', '모두의 선택이 모이는 중이다. 이야기가 어느 길로 갈지는 아직 열리지 않았다.')); return box; }
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
    if (side) { side.replaceChildren(trackerBox()); const hb = helpButton(); if (hb) side.append(hb); }
    document.querySelectorAll('.quest-inline').forEach((el) => el.replaceChildren(trackerBox()));
    const b = document.getElementById('statusQuest'); if (b) b.textContent = progressText();
  }
  const progressText = () => (App.profile() ? `${doneCount()} / ${SCENES.length}` : '');

  /* ───────── vC.06 돕는 선배: 이미 깬 다인 전투에 다른 학생의 파티로 다시 들어간다 ─────────
   * 영력 · 최초 보상(전리품 · 진도)은 없고, 이기면 냥을 2배로 받는다. 처음 싸우는 학생이 모집 중인 파티에만 들어갈 수 있다. */
  const Auth = window.BiryeongAuth;
  const helpFoes = () => { const a = App.playApi(); if (!a?.storySize) return []; return Object.keys(Q().beaten).filter((k) => D.foes[k] && a.storySize(k) > 1); };
  function helpButton() {
    if (!(Auth?.server && Auth.token()) || !App.profile() || !helpFoes().length) return null;
    const b = btn('ghost-btn quest-help', '다른 학생의 본편 전투 돕기', openHelp); b.title = '이미 깬 다인 전투에 돕는 선배로 들어간다 (영력 · 최초 보상 없음, 냥 2배)';
    return b;
  }
  let helpDlg = null;
  async function openHelp() {
    if (!helpDlg) {
      helpDlg = h('dialog', 'community-dialog party-dialog party-small'); helpDlg.id = 'storyHelpDialog';
      const w = h('div', 'community-window'), head = h('header', 'community-window-head'), t = h('div');
      t.append(h('span', 'community-overline', '助力 / HELP'), h('h2', '', '본편 전투 돕기'));
      head.append(t, btn('community-close', '✕', () => helpDlg.close()));
      w.append(head, h('div', 'community-content party-body')); helpDlg.append(w); document.body.append(helpDlg);
      helpDlg.addEventListener('click', (e) => { if (e.target === helpDlg) helpDlg.close(); });
    }
    const body = helpDlg.querySelector('.party-body');
    if (!helpDlg.open) { try { helpDlg.showModal(); } catch (_) { helpDlg.setAttribute('open', ''); } }
    body.replaceChildren(h('p', '', '불러오는 중…'));
    try {
      const r = await Auth.call('bry_party_help_list', { p_foes: helpFoes() });
      const list = h('div', 'party-rooms');
      for (const pt of r.parties || []) {
        const foe = D.foes[pt.foe]; if (!foe) continue;
        const row = btn('party-room-row', '', () => { helpDlg.close(); const a = App.playApi(); if (!a) return; a.storyHelp({ key: pt.foe, tier: foe.tier, i: foe.i, name: foe.name, blurb: foe.blurb, partyId: pt.id, stage: pt.stage, ctx: { form: 1, names: { player: playerName() } } }); });
        row.append(h('b', '', `${foe.name} — ${pt.members.map((m) => m.name + (m.helper ? '(돕는 선배)' : '')).join(' · ')}`), h('small', '', `${pt.members.length}/3 · 눌러서 돕는 선배로 들어간다`));
        list.append(row);
      }
      body.replaceChildren(h('p', '', '이미 깬 다인 전투에서, 처음 싸우는 학생이 모집 중인 파티다. 돕는 선배는 영력과 최초 보상(전리품 · 진도)을 받지 않고, 이기면 냥을 2배로 받는다.'),
        list.childElementCount ? list : h('p', '', '지금은 도울 수 있는 파티가 없다.'), btn('ghost-btn', '새로고침', openHelp));
    } catch (e) { body.replaceChildren(h('p', '', e.message || '서버에 닿지 못했다.')); }
  }

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
      while (at < list.length && !ok(list[at][1].c, scene.id)) at += 1;
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
        row.append(portrait(ln.w || '', shown, ln));
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
      // 같은 선택이 다시 나와도 처음 고른 것이 남는다
      q.picked[key] = n; q.pick[scene.id] = n; if (q.flags[ln.id] == null) q.flags[ln.id] = n;
      if (ln.id === HEIR_CHOICE) { save().story.heirloom = HEIRS[n - 1]?.weapon || null; App.mark('heirloomChosen'); if (!q.keep.includes('부모의 유품')) q.keep.push('부모의 유품'); }
      const cs = claims(); if (ln.id && !cs.sent[ln.id]) { cs.sent[ln.id] = n; Sync()?.choice(ln.id, n); }
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
    body.append(para(sync?.enabled ? '모든 학생의 선택이 모인다. 내가 고른 것은 청색으로 보인다.' : '서버에 닿기 전이라 지금은 내가 고른 것만 보인다.'));
    const box = h('div', 'quest-tally'); body.append(box);
    const shown = Object.entries(D.choices || {}).filter(([id, c]) => isOpen(c.ch) && q.flags[id]);
    if (!shown.length) { box.append(para('아직 고른 것이 없다.')); return; }
    const draw = (by) => {
      box.replaceChildren();
      shown.forEach(([id, c]) => {
        const counts = by?.[id] || {}; const sum = Object.values(counts).reduce((a, b) => a + b, 0);
        const row = h('div', 'quest-tally-row'); row.append(h('strong', '', `${c.ch ? `${c.ch}장` : '프롤로그'} · ${c.q || c.scene}${c.vote ? ' (모두의 선택)' : ''}`));
        c.o.forEach((o, i) => { const v = counts[i + 1] || 0; const mine = Number(q.flags[id]) === i + 1; row.append(h('p', mine ? 'is-mine' : '', `${CIRC[i]} ${fill(o)}${by ? ` — ${v}명 (${sum ? Math.round(v * 100 / sum) : 0}%)` : ''}${mine ? '  ◂ 내 선택' : ''}`)); }); // vC.06 내 선택은 어디서나 청색(서버에서 온 글자 '1'도 맞춘다)
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

    // vC.01 추가전투 단계 공개: 처음에는 1단계만 열려 있다. 한 주에 한 단계씩 여는 것을 기준으로 난이도를 맞췄다.
    body.append(h('p', 'panel-label', '추가전투 단계 공개'));
    const tierBox = h('div', 'story-route'); body.append(tierBox);
    const drawTier = (now) => {
      tierBox.replaceChildren(h('p', 'story-route-state', `지금 ${now}단계까지 열려 있다. (처음에는 1단계만 · 한 주에 한 단계씩 여는 것을 기준으로 난이도를 맞췄다)`));
      const setTier = async (n) => {
        const iso = new Date().toISOString(), all = routeStore(); all.EXTRA_TIER = { option: n, openAt: iso }; try { localStorage.setItem(ROUTE_KEY, JSON.stringify(all)); } catch (_) { /* 무시 */ }
        if (server) { const r = await sync.adminRoute(adminCode(), 'EXTRA_TIER', n, iso); if (r?.error) { toast('스토리 관리', `서버에 쓰지 못했다 — ${r.error}`); return; } }
        routes.EXTRA_TIER = n; toast('스토리 관리', `추가전투를 ${n}단계까지 열었다.`); refreshChapters(); drawTier(n);
      };
      const acts = h('div', 'story-admin-acts');
      if (now < 10) acts.append(btn('solid-btn codex-use', `${now + 1}단계 열기`, () => { if (window.confirm(`추가전투 ${now + 1}단계를 모든 학생에게 열까요?`)) setTier(now + 1); }));
      if (now > 1) acts.append(btn('ghost-btn codex-use', `${now}단계 닫기`, () => { if (window.confirm(`추가전투 ${now}단계를 다시 닫을까요? (${now - 1}단계까지만 열린다)`)) setTier(now - 1); }));
      tierBox.append(acts);
    };
    drawTier(Math.max(1, Math.min(10, Number(routeStore().EXTRA_TIER?.option) || 1)));
    if (server) sync.adminRoutes(adminCode()).then((r) => { const row = Array.isArray(r) ? r.find((x) => x.flag === 'EXTRA_TIER') : null; drawTier(Math.max(1, Math.min(10, Number(row?.option) || 1))); }).catch(() => {});

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
          if (list.length) sec.append(h('p', 'story-vote-who', list.map((r) => nameOf[r.account] || r.name || r.account || r.player_id?.slice(0, 8)).join(', ')));
        });
        if (c.vote) sec.append(routeControls(id, c));
        votes.append(sec);
      });
    };
    // 투표 결과로 어느 루트를 공개할지(지금 · 정한 시각 · 닫기)
    function routeControls(id, c) {
      const wrap = h('div', 'story-route'); const L = routeStore()[id] || {}; const srvRow = srvRoutes?.find((r) => r.flag === id);
      const option = server ? srvRow?.option : L.option, openAt = server ? srvRow?.open_at : L.openAt;
      const state = !option || !openAt ? '루트 미공개 — 플레이어들은 갈림길 뒤에서 기다린다' : Date.parse(openAt) <= Date.now() ? `공개 중 · ${CIRC[option - 1]} ${c.o[option - 1]}` : `공개 예정 · ${CIRC[option - 1]} · ${new Date(openAt).toLocaleString('ko-KR')}`;
      wrap.append(h('p', 'story-route-state', `이야기 루트: ${state}`));
      const sel = h('select'); c.o.forEach((o, i) => sel.append(new Option(`${CIRC[i]} ${o}`, String(i + 1)))); if (option) sel.value = String(option);
      const when = h('input'); when.type = 'datetime-local'; when.className = 'story-when';
      const set = async (opt, iso) => {
        const all = routeStore(); all[id] = { option: opt, openAt: iso }; try { localStorage.setItem(ROUTE_KEY, JSON.stringify(all)); } catch (_) { /* 무시 */ }
        if (server) { const r = await sync.adminRoute(adminCode(), id, opt, iso); if (r?.error) { toast('스토리 관리', `서버에 쓰지 못했다 — ${r.error}`); return; } }
        toast('스토리 관리', !iso ? '루트를 닫았다.' : Date.parse(iso) <= Date.now() ? `${CIRC[opt - 1]} 루트를 공개했다.` : `${CIRC[opt - 1]} 루트 공개 시각을 정했다.`); refreshChapters(); App.route();
      };
      const acts = h('div', 'story-admin-acts');
      acts.append(sel, btn('solid-btn codex-use', '이 루트로 지금 공개', () => { if (window.confirm(`${CIRC[sel.value - 1]} ${c.o[sel.value - 1]} — 이 루트로 모든 학생의 이야기를 이어 갈까요?`)) set(Number(sel.value), new Date().toISOString()); }),
        when, btn('ghost-btn codex-use', '이 시각에 공개', () => { if (!when.value) { toast('스토리 관리', '공개 시각을 고른다.'); return; } set(Number(sel.value), new Date(when.value).toISOString()); }));
      if (openAt) acts.append(btn('ghost-btn codex-use', '루트 닫기', () => set(null, null)));
      wrap.append(acts);
      return wrap;
    }
    let srvRoutes = null;
    const nameOf = {}; // 계정 아이디 → 캐릭터 이름
    const localVotes = () => {
      const rows = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i); if (!k?.startsWith('biryeong-save-v1:')) continue;
          const s = JSON.parse(localStorage.getItem(k) || 'null'); const flags = s?.story?.q?.v === 4 ? s.story.q.flags : null; if (!flags) continue;
          Object.entries(flags).forEach(([branch, option]) => rows.push({ account: k.slice('biryeong-save-v1:'.length), name: s?.profile?.name || '', branch, option }));
        }
      } catch (_) { /* 읽을 수 없으면 비운다 */ }
      return rows;
    };
    const loadVotes = (rows) => (server ? sync.adminRoutes(adminCode()).then((r) => { srvRoutes = Array.isArray(r) ? r : []; drawVotes(rows); }).catch(() => drawVotes(rows)) : drawVotes(rows));
    if (server) Promise.resolve(sync.adminNames ? sync.adminNames(adminCode()) : []).then((ns) => { (Array.isArray(ns) ? ns : []).forEach((n) => { if (n.username && n.display_name) nameOf[n.username] = n.display_name; }); }).catch(() => {}).then(() => sync.adminChoices()).then((rows) => loadVotes(rows || [])).catch(() => { votes.replaceChildren(para('서버에서 선택을 읽지 못했다. 이 브라우저의 계정들만 보인다.')); drawVotes(localVotes()); });
    else { drawVotes(localVotes()); votes.prepend(para('서버 연결 전 — 이 브라우저에 있는 계정들의 선택만 모았다.')); }
  }

  const peek = () => { const scene = current(); const st = scene && !busy ? activeStep(scene) : null; return { id: scene?.id || null, step: st ? Q().step : -1, w: st?.w || '', at: st ? atPlace(st.w) : false, needs: st ? needState(scene, st).map((n) => ({ raw: n.raw, type: n.type, arg: n.arg, have: n.have, count: n.count, done: n.done })) : [], busy, open: Object.keys(loaded).map(Number) }; };
  window.BiryeongQuest = { extraTier: () => Math.max(1, Math.min(10, Number(routes.EXTRA_TIER) || 1)), routes, routeWait, renderBoard, renderPlace, renderAdminStory, progressText, tick, state: Q, current, peek, inspectable, refreshChapters, isOpen, replay: (id) => byId[id] && playLines(byId[id], 0, byId[id].lines.length, null, true) };
  refreshChapters();
  App.route();
  drawTracker();
})();
