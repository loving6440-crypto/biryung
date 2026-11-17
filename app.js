/* 비령 — 화면 로직. 서버 없이 동작한다(내 프로필 · 진행 기록은 이 브라우저에 보관).
 *
 * 페이지는 주소(#/…)로 바뀐다. 머리글 · 배너 · 오른쪽 '나의 상태'는 어느 페이지에서나 그대로 있고, 가운데만 바뀐다.
 *   #/                      사방 지도(처음 화면)
 *   #/zone/<구역>/<탭>/<칸>/<탐사 경로…>    구역 (north 산문 = 스토리 퀘스트 · east 강학당 · west 생활관 · south 금역)
 *   #/go/<실행 주소>          전투 · 개척 · 수업 등을 바로 (예: #/go/battle/scarecrow, #/go/lesson/ward-tetris)
 *   #/profile · #/profile/edit · #/codex · #/codex/titles · #/notes · #/case · #/money · #/admin(관리자)
 * 구역 → 곳 → 할 일. 할 일을 고르면 그 장소의 화면(systems/play 의 at/<곳>/<할 일>)이 그 자리에 열린다.
 * 로그인: auth.js (계정마다 기록이 따로 — Auth.saveKey())
 * 데이터: game-data.js(구역, 보관고에서 생성) · titles.js(칭호 · 업적) · story.js(스토리 퀘스트) · play/play.js(실행 화면 부품)
 */
(() => {
  'use strict';

  const Auth = window.BiryeongAuth;
  if (!Auth || !Auth.session()) return; // 로그인 전 — auth.js 의 로그인 화면이 떠 있다

  const DATA = window.BIRYEONG_DATA || { rules: {}, zones: {} };
  const TITLES = window.BIRYEONG_TITLES || [];
  const ACHIEVEMENTS = window.BIRYEONG_ACHIEVEMENTS || [];
  // vC.05 목록은 가나다순(업적 · 칭호 · 도감의 아이템).
  const KO = new Intl.Collator('ko', { numeric: true });
  const byName = (a, b) => KO.compare(String(a.name ?? ''), String(b.name ?? ''));
  const ACH_GROUPS = window.BIRYEONG_ACHIEVEMENT_GROUPS || [];
  const STORY = window.BIRYEONG_STORY || { steps: [], premise: [] };
  const Play = () => window.BiryeongPlay || null;
  const playApi = () => Play()?.api() || null;
  const R = Object.assign({ statKeys: [], stats: {}, statMin: 1, startPoints: 10, hpMax: 100, mpMax: 100, spiritStart: 100, spiritMax: 500, startMoney: 0, nameMax: 12, introMax: 30 }, DATA.rules);
  const $ = (selector, root = document) => root.querySelector(selector);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (cls, text, onClick) => { const b = h('button', cls, text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; };

  /* ─────────   /* ───────── 글꼴 (갈무리 · KoPub 돋움 · KoPub 바탕) ───────── */
  const UI_FONTS = [
    { id: 'galmuri9', label: '갈무리9', detail: '기본 · 도트', family: 'Galmuri9' },
    { id: 'kopub-dotum', label: 'KoPub 돋움', detail: '웹폰트', family: 'KoPub Dotum' },
    { id: 'kopub-batang', label: 'KoPub 바탕', detail: '웹폰트', family: 'KoPub Batang' },
  ];
  const DEFAULT_FONT = 'galmuri9';
  const FONT_STORAGE_KEY = 'biryeong-ui-font';
  const FONT_IDS = new Set(UI_FONTS.map((font) => font.id));
  const fontMenu = $('#fontMenu'), fontToggle = $('#fontToggle'), fontOptions = $('#fontOptions');
  function setFont(id, byUser) {
    if (!FONT_IDS.has(id)) id = DEFAULT_FONT;
    document.documentElement.dataset.uiFont = id;
    for (const input of fontOptions.querySelectorAll('input[name="biryeong-font"]')) input.checked = input.value === id;
    $('#fontNotice').textContent = '서체를 불러올 수 없는 오프라인 환경에서는 대체 글꼴이 표시될 수 있습니다.';
    try { localStorage.setItem(FONT_STORAGE_KEY, id); } catch (_) { /* 저장할 수 없는 환경 */ }
  }
  function toggleFontMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : fontMenu.hidden;
    fontMenu.hidden = !shouldOpen;
    fontToggle.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) fontMenu.querySelector('input:checked')?.focus(); else fontToggle.focus();
  }
  UI_FONTS.forEach((font) => {
    const label = h('label', 'font-option');
    const input = h('input'); input.type = 'radio'; input.name = 'biryeong-font'; input.value = font.id;
    input.addEventListener('change', () => setFont(font.id, true));
    const sample = h('span', 'font-option-sample', '秘靈 가나다 123');
    sample.style.fontFamily = `'${font.family}', 'Noto Sans KR', sans-serif`;
    label.append(input, h('span', 'font-option-name', font.label), h('small', '', font.detail), sample);
    fontOptions.appendChild(label);
  });
  fontToggle.addEventListener('click', () => toggleFontMenu());
  $('#fontClose').addEventListener('click', () => toggleFontMenu(false));
  document.addEventListener('pointerdown', (event) => { if (!fontMenu.hidden && !$('#fontControl').contains(event.target)) toggleFontMenu(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !fontMenu.hidden) { toggleFontMenu(false); event.stopPropagation(); } });
  window.addEventListener('storage', (event) => { if (event.key === FONT_STORAGE_KEY) setFont(event.newValue); });

  /* ───────── 저장: 내 프로필 + 진행 기록 ─────────
   * 실행 화면(play)이 같은 칸에 game · counts · playLog 를 적는다. 메인 화면은 그 셋을 덮어쓰지 않는다. */
  const SAVE_KEY = Auth.saveKey(); // 계정마다 따로
  const PLAY_KEYS = ['game', 'counts', 'playLog'];
  const blankStats = () => Object.fromEntries(R.statKeys.map((k) => [k, R.statMin]));
  const blankSave = () => ({ profile: null, flags: {}, sets: {}, achievements: {}, titles: {}, story: { done: {}, heirloom: null }, lantern: false });
  const readStored = () => { try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return raw && typeof raw === 'object' ? raw : {}; } catch (_) { return {}; } };
  let save = Object.assign(blankSave(), readStored());
  save.story = Object.assign({ done: {}, heirloom: null }, save.story);
  { const OLD = { bell: 'w-bell', fan: 'w-fan', mirror: 'w-spear', blade: 'w-sword', cloth: 'w-dagger' }; if (OLD[save.story.heirloom]) { const was = save.story.heirloom; save.story.heirloom = OLD[was]; const q = save.story.q; if (q?.flags?.['B1-1']) q.flags['B1-1'] = { bell: 1, fan: 3, mirror: 6, blade: 7, cloth: 9 }[was]; } } // v1.3: 다섯 유품 → 무구 10종 id
  // 예전 판(v0.7~0.8)의 업적 · 칭호 기록 가운데 지금 없는 것은 지운다.
  const achIds = new Set(ACHIEVEMENTS.map((a) => a.id)), titleIds = new Set(TITLES.map((t) => t.id));
  for (const id of Object.keys(save.achievements)) if (!achIds.has(id)) delete save.achievements[id];
  for (const id of Object.keys(save.titles)) if (!titleIds.has(id)) delete save.titles[id];
  let saveWarned = false;
  function pullPlay() { const latest = readStored(); for (const k of PLAY_KEYS) { if (k in latest) save[k] = latest[k]; else delete save[k]; } }
  function persist() {
    pullPlay();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
    catch (_) { if (!saveWarned) { saveWarned = true; toast('저장 실패', '이 브라우저에 기록을 저장할 수 없습니다. 사진이 너무 크거나 저장 공간이 막혀 있을 수 있습니다.'); } }
  }
  const profile = () => save.profile;
  const game = () => (save.profile && save.game ? save.game : null); // 실행 화면의 플레이어 상태(체력 · 영력 · 스탯 · 소지금 …)
  const counts = () => save.counts || {};
  const statsNow = () => game()?.stats ?? (save.profile ? save.profile.stats : blankStats());
  const titleById = Object.fromEntries(TITLES.map((t) => [t.id, t]));
  const ownsTitle = (id) => titleById[id]?.from === 'start' || !!save.titles[id];
  const ownedTitles = () => TITLES.filter((t) => ownsTitle(t.id));

  /* ───────── 알림 ───────── */
  const toastStack = $('#toastStack');
  function toast(head, text) {
    const el = h('div', 'toast'); el.append(h('strong', '', head), h('span', '', text));
    toastStack.appendChild(el);
    try { if (toastStack.matches(':popover-open')) toastStack.hidePopover(); toastStack.showPopover(); } catch (_) { /* popover 를 모르는 브라우저 */ }
    setTimeout(() => el.classList.add('is-leaving'), 4200);
    setTimeout(() => { el.remove(); if (!toastStack.children.length) { try { toastStack.hidePopover(); } catch (_) { /* 무시 */ } } }, 4800);
  }

  /* ───────── 업적 조건 ───────── */
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function streakNow() { // 오늘부터 거꾸로, 하루도 빠지지 않은 날 수
    const days = save.sets.days || {};
    let n = 0;
    for (const d = new Date(); days[dayKey(d)]; d.setDate(d.getDate() - 1)) n += 1;
    return n;
  }
  const valueOf = (w) => (w.vault ? (game()?.achievements?.[w.vault] ? 1 : 0) : w.titles ? ownedTitles().length : w.set ? Object.keys(save.sets[w.set] || {}).length : w.pset ? Object.keys(counts().sets?.[w.pset] || {}).length : w.count ? Math.floor(counts()[w.count] || 0) : w.streak ? streakNow() : 0);
  const targetOf = (w) => w.n ?? w.streak ?? w.titles ?? 1;
  const met = (w) => (w.all ? w.all.every(met) : w.flag ? !!save.flags[w.flag] : valueOf(w) >= targetOf(w));
  /** 진행도 [지금, 목표] — 여러 조건이면 채운 조건 수 */
  const progressOf = (w) => (w.all ? [w.all.filter(met).length, w.all.length] : w.flag || w.vault ? null : [Math.min(valueOf(w), targetOf(w)), targetOf(w)]);
  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (save.achievements[a.id] || !met(a.when)) continue;
      save.achievements[a.id] = Date.now(); changed = true;
      if (a.title && titleById[a.title]) save.titles[a.title] = Date.now();
      toast('업적 달성', `${a.name}${a.title && titleById[a.title] ? ` — 칭호 [${titleById[a.title].name}] 획득` : ''}`);
    }
    if (changed) { persist(); renderStatus(); if (ACHIEVEMENTS.some((a) => a.when.titles && !save.achievements[a.id] && met(a.when))) checkAchievements(); }
  }
  /** 지금 단 칭호의 기능 — 실행 화면(usePlayHost)이 읽는다. */
  window.BiryeongPerk = () => { const t = titleById[save.profile?.title]; return t && ownsTitle(t.id) ? t.perk || null : null; };
  function mark(flag) { if (save.flags[flag]) return; save.flags[flag] = true; persist(); checkAchievements(); }
  function addTo(set, key) { const s = (save.sets[set] ||= {}); if (s[key]) return; s[key] = true; persist(); checkAchievements(); }

  /* ───────── 글 꾸밈: **굵게** *기울임* ~~흔들림~~, OO → 내 이름 ───────── */
  function rich(text) {
    const name = profile()?.name;
    const frag = document.createDocumentFragment();
    String(text ?? '').replace(/OO/g, name || 'OO').split(/(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*\n]+\*)/).forEach((part) => {
      if (!part) return;
      if (part.startsWith('**')) frag.append(h('strong', 'rich-b', part.slice(2, -2)));
      else if (part.startsWith('~~')) frag.append(h('span', 'rich-jitter', part.slice(2, -2)));
      else if (part.startsWith('*')) frag.append(h('em', 'rich-i', part.slice(1, -1)));
      else frag.append(part);
    });
    return frag;
  }
  const para = (text, cls = '') => { const p = h('p', `panel-p ${cls}`.trim()); p.append(rich(text)); return p; };
  const emptyBox = (markText, line, small) => { const e = h('div', 'panel-empty'); e.append(h('span', 'panel-empty-mark', markText), h('p', '', line), h('small', '', small || '')); return e; };

  /* ───────── 페이지 틀 ─────────
   * 처음 화면(#homeView)과 페이지(#pageView) 가운데 하나만 보인다. 머리글 · 배너 · 나의 상태는 그대로 둔다. */
  const homeView = $('#homeView'), pageView = $('#pageView');
  const panelBody = $('#panelBody'), panelTabs = $('#panelTabs'), panelChips = $('#panelChips'), playHost = $('#playHost');
  let steps = 0; // 이 화면 안에서 주소를 바꾼 횟수(뒤로가기가 사이트 밖으로 나가지 않게)
  const go = (hash) => { if (location.hash === hash) route(); else { steps += 1; location.hash = hash; } };
  // vC.06 뒤로가기: 방문 기록이 아니라 「한 단계 위」로 간다(구역 안 칸 → 그 구역 → 사방 지도). 실행 화면(#/go/…)은 들어오기 전 자리로.
  //   단추에는 어디로 가는지가 적힌다. (예전에는 브라우저 기록을 거슬러 올라가, 같은 구역 안에서 칸을 옮긴 만큼 눌러야 했다)
  let lastPlace = '#/';
  const ZONE_WORD = { north: '산문', center: '사당', east: '강학당', west: '생활관', south: '비령산' };
  function parentOf(hash) {
    const parts = decodeURIComponent(String(hash || '').replace(/^#\/?/, '')).split('/').filter(Boolean);
    if (parts[0] === 'zone' && parts.length > 2) return { hash: `#/zone/${parts[1]}`, label: ZONE_WORD[parts[1]] || '구역' };
    if (parts[0] === 'go') { const pp = decodeURIComponent(lastPlace.replace(/^#\/?/, '')).split('/').filter(Boolean); return pp[0] === 'zone' ? { hash: lastPlace, label: ZONE_WORD[pp[1]] || '구역' } : { hash: '#/', label: '사방 지도' }; }
    return { hash: '#/', label: '사방 지도' };
  }
  const back = () => { const to = parentOf(location.hash).hash; steps = 0; if (location.hash !== to) location.hash = to; else route(); };
  function updateBack() { if (/^#\/zone\//.test(location.hash)) lastPlace = location.hash; const b = $('#pageBack'); if (b) { const p = parentOf(location.hash); const ro = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00, k = c >= 0 && c <= 11171 ? c % 28 : 0; return w + (k && k !== 8 ? '으로' : '로'); }; b.textContent = `◂ ${ro(p.label)}`; b.title = `${ro(p.label)} 돌아간다`; } }
  function openPage(eyebrow, title, kind) {
    $('#panelEyebrow').textContent = eyebrow; $('#panelTitle').textContent = title;
    pageView.dataset.kind = kind || '';
    panelTabs.hidden = true; panelTabs.replaceChildren(); panelChips.hidden = true; panelChips.replaceChildren(); panelBody.replaceChildren();
    homeView.hidden = true; pageView.hidden = false;
    $('#innerMapBtn').dataset.map = ''; $('#innerMapBtn').hidden = true;
    showPlay(null);
  }
  function showHome() { pageView.hidden = true; homeView.hidden = false; showPlay(null); drawVolumes(); drawBoard().catch(() => {}); }
  function setTabs(nav, list, current, onPick) {
    nav.hidden = list.length < 1;
    nav.replaceChildren(...list.map((t) => { const b = btn(t.id === current ? 'is-on' : '', t.label, () => onPick(t.id)); b.setAttribute('aria-pressed', String(t.id === current)); return b; }));
  }
  /** 실행 화면 부품(전투 · 제작 · 수업 …)을 페이지 본문 아래에 보인다. null 이면 감춘다(시간은 계속 흐른다). */
  function showPlay(to) {
    const P = Play();
    playHost.hidden = !to;
    if (!P) return;
    P.show(to && profile() ? to : null);
    if (to && !profile()) { playHost.hidden = true; panelBody.append(needProfile()); }
  }
  const needProfile = () => { const box = emptyBox('名', '먼저 내 프로필을 만들어 주세요.', '이름과 육조 스탯이 있어야 움직일 수 있다.'); box.append(btn('solid-btn', '내 프로필 만들기', () => go('#/profile'))); return box; };
  $('#pageBack').addEventListener('click', back);

  /* ───────── 구역 ───────── */
  const ZONE_META = {
    center: { hanja: '中', eyebrow: '00 中 / THE YELLOW SHRINE' },
    north: { hanja: '北', eyebrow: '01 北 / GATE OF THE MOUNTAIN' },
    east: { hanja: '東', eyebrow: '02 東 / HALL OF TALISMANS' },
    west: { hanja: '西', eyebrow: '03 西 / HOUSE OF THE LEFT BEHIND' },
    south: { hanja: '南', eyebrow: '04 南 / THE FORBIDDEN PEAK' },
  };
  const zoneHash = (key, tab, section, path = []) => `#/zone/${[key, tab, section, ...path].filter(Boolean).join('/')}`;
  function renderZone(key, tabId, sectionId, path) {
    const zone = DATA.zones[key];
    if (!zone) { go('#/'); return; }
    openPage(ZONE_META[key].eyebrow, zone.title, 'zone');
    mark(`zone:${key}`); addTo('zones', key);
    if (zone.story) { if (window.BiryeongQuest) window.BiryeongQuest.renderBoard(tabId, sectionId); else panelBody.append(para('이야기를 불러오는 중이다.')); return; } // 산문 = 산문 너머(본편 퀘스트 · quest.js)
    if (!zone.tabs.length) { panelBody.append(emptyBox(ZONE_META[key].hanja, '아직 비어 있는 곳.', '금줄 너머로 바람 소리만 들린다.')); return; }
    const tab = zone.tabs.find((t) => t.id === tabId) ?? zone.tabs[0];
    const open = (s) => !s.unlock || (s.unlock === 'shrine' && !!game()?.shrineSignRead); // 사당 탐사는 표지판을 읽은 뒤에 열린다
    const sections = tab.sections.filter(open);
    const section = sections.find((s) => s.id === sectionId) ?? sections[0];
    addTo('pages', `${key}/${tab.id}/${section.id}`);
    const tabs = zone.tabs.filter((t) => !t.hidden || t.id === tab.id); // 양호실처럼 탐사로만 들어가는 곳은 들어와 있을 때만 보인다
    if (tabs.length > 1) setTabs(panelTabs, tabs.map((t) => ({ id: t.id, label: `${t.hanja} ${t.name}` })), tab.id, (id) => go(zoneHash(key, id)));
    setTabs(panelChips, sections.map((s) => ({ id: s.id, label: s.title })), section.id, (id) => go(zoneHash(key, tab.id, id)));
    $('#innerMapBtn').dataset.map = tab.id; $('#innerMapBtn').hidden = !MAP_OF[tab.id];
    if (section.kind === 'text') section.paras.forEach((t) => panelBody.append(para(t)));
    else if (section.kind === 'list') renderList(section);
    else if (section.kind === 'play') { if (section.intro) panelBody.append(para(section.intro, 'panel-intro')); showPlay(section.to); }
    else renderScene(section, key, tab, path);
  }
  function renderList(section) {
    if (section.intro) panelBody.append(para(section.intro, 'panel-intro'));
    const listEl = h('div', 'entry-list');
    section.items.forEach((item) => {
      const d = h('details', 'entry');
      const sum = h('summary'); sum.append(h('strong', '', item.name), h('span', '', item.sub || ''));
      d.append(sum);
      if (item.desc) d.append(para(item.desc, 'entry-desc'));
      (item.lines || []).forEach((l) => d.append(para(l, 'entry-line')));
      if (!item.desc && !(item.lines || []).length) d.append(h('p', 'panel-p entry-line', '(설명이 아직 없다)'));
      listEl.append(d);
    });
    panelBody.append(listEl);
  }
  const meets = (when, stats) => Object.entries(when || {}).every(([k, [lo, hi]]) => (lo == null || (stats[k] ?? 0) >= lo) && (hi == null || (stats[k] ?? 0) <= hi));
  const dayIndex = () => Math.floor((Date.now() + 9 * 3600e3) / 86400e3);
  function resolveText(node, stats) {
    const entries = node.text || [];
    const plain = entries.filter((e) => !e.when && e.chance == null);
    const lucky = entries.find((e) => e.chance != null && Math.random() * 100 < e.chance);
    const cond = entries.filter((e) => e.when && meets(e.when, stats));
    const replace = cond.filter((e) => e.mode === 'replace').at(-1);
    const out = [];
    if (lucky) out.push(lucky.t); else if (replace) out.push(replace.t); else if (plain.length) out.push(plain[(dayIndex() + node.id.length) % plain.length].t);
    cond.filter((e) => e.mode !== 'replace').forEach((e) => out.push(e.t));
    return out;
  }
  const whenLabel = (when) => Object.entries(when).map(([k, [lo, hi]]) => `${R.stats[k]?.label ?? k} ${lo != null ? `${lo} 이상` : ''}${hi != null ? ` ${hi} 이하` : ''}`.trim()).join(' · ');
  function renderScene(section, key, tab, path) {
    const stats = statsNow();
    let node = section.root;
    const trail = [node], walked = [];
    for (const id of path) { const next = (node.choices || []).find((c) => c.id === id); if (!next) break; node = next; trail.push(node); walked.push(id); }
    const here = (ids) => zoneHash(key, tab.id, section.id, ids);
    const crumbs = h('div', 'scene-crumbs');
    trail.forEach((n, i) => {
      if (i) crumbs.append(h('span', 'scene-sep', '›'));
      const c = i === trail.length - 1 ? h('strong', '', '') : btn('', '', () => go(here(walked.slice(0, i))));
      c.append(rich(n.name)); crumbs.append(c);
    });
    panelBody.append(crumbs);
    if (trail.length > 1) addTo('scenes', `${tab.id}:${walked.join('/')}`);
    const hour = new Date().getHours();
    const closed = node.night && !(node.night.from > node.night.to ? hour >= node.night.from || hour < node.night.to : hour >= node.night.from && hour < node.night.to);
    const box = h('div', `scene-box${node.fx === 'jitter' ? ' scene-jitter' : ''}`);
    if (closed) box.append(para(node.night.closed));
    else {
      resolveText(node, stats).forEach((t) => box.append(para(t)));
      if (node.seq) {
        let page = 0;
        const seqP = para(node.seq[0], 'scene-seq');
        const next = btn('scene-next', '다음 ▸', () => { page += 1; seqP.replaceChildren(rich(node.seq[page])); if (page >= node.seq.length - 1) next.hidden = true; });
        next.hidden = node.seq.length < 2;
        box.append(seqP, next);
      }
      if (node.after) box.append(para(node.after, 'scene-after'));
      if (node.result) {
        const cost = node.cost || {};
        const reveal = btn('scene-cost', cost.mp ? `의지력 ${cost.mp} 쓰기` : cost.wait ? `${cost.wait}분 기다리기 (지금은 바로 지나간다)` : '결과 보기', () => reveal.replaceWith(...node.result.map((t) => para(t, 'scene-result'))));
        box.append(reveal);
      }
      if (node.note) box.append(h('p', 'scene-note', node.note));
      if (node.notice) box.append(h('p', 'scene-notice', node.notice));
      if (node.widgetNote) box.append(h('p', 'scene-note', node.widgetNote));
      if (node.play) box.append(btn('solid-btn scene-go', `${node.play.label} ▸`, () => go(`#/go/${node.play.to}`)));
    }
    if (box.childNodes.length) panelBody.append(box);
    const kids = closed ? [] : (node.choices || []);
    if (kids.length) {
      const wrap = h('div', 'scene-choices');
      kids.forEach((c) => {
        const ok = meets(c.when, stats);
        const b = btn(`scene-choice${ok ? '' : ' is-locked'}`, '', () => go(here([...walked, c.id])));
        b.append(rich(c.name));
        if (c.when) b.append(h('small', '', ok ? whenLabel(c.when) : `${whenLabel(c.when)} 필요`));
        b.disabled = !ok;
        wrap.append(b);
      });
      panelBody.append(wrap);
    }
  }

  /** 곳(mainHall · annex · gym …)이 들어 있는 구역을 찾아 그 주소를 만든다. */
  function placeHash(loc, act) {
    const key = Object.keys(DATA.zones).find((k) => DATA.zones[k].tabs.some((t) => t.id === loc));
    return key ? zoneHash(key, loc, act) : '#/';
  }

  /* ───────── 내부 지도 (도트 지도 창) ─────────
   * DATA.maps(본관 · 별관 · 뒷산 · 사당)를 층 · 길 단위로 그린다. 벽돌 벽 사이의 어두운 칸이 방이고, 방마다 작은 도트 표식이 붙는다. */
  const mapDialog = $('#mapDialog'), mapTabs = $('#mapTabs'), mapBody = $('#mapBody');
  const PIX = { // 7×7 도트 표식
    door: '..###.. .#...#. .#...#. .#..##. .#...#. .#...#. .#####.', book: '....... .##.##. #######  #.#.#.# #######  #.#.#.# .##.##.', pot: '..#.#.. ...#... .#####. #.....# #.....# .#...#. ..###..',
    tool: '.##.... ###.... .###... ..###.. ...###. ....### .....##', flag: '.#####. .#####. .####.. .#..... .#..... .#..... ###....', bed: '....... #...... #.####. ####### #.....# #.....# .......',
    stair: '......# .....## ....### ...#### ..##### .###### #######', tree: '...#... ..###.. .#####. ..###.. .#####. ...#... ...#...', flame: '...#... ..##... ..###.. .####.. .#####. .##.##. ..###..',
    roof: '...#... ..###.. .#####. ####### .#.#.#. .#.#.#. .#####.', sword: '......# .....#. ....#.. #..#... .##.... .##.... #..#...', box: '....... .#####. #######  #..#..# #######  #.....# #######',
    moon: '..###.. .##.... ##..... ##..... ##..... .##.... ..###..', cross: '..###.. ..###.. ####### ####### ####### ..###.. ..###..', star: '...#... ...#... #######  .#####. ..###.. .##.##. .#...#.',
    card: '.#####. .#...#. .#.#.#. .#...#. .#.#.#. .#...#. .#####.', water: '...#... ..###.. ..###.. .#####. .#####. .#####. ..###..',
  };
  const PIX_RULES = [
    [/양호/, 'cross', '#d56b69'], [/보관|창고|사물/, 'box', '#d4b078'], [/공작|작업/, 'tool', '#c99a62'], [/조리|급식|주방|부엌/, 'pot', '#c99a62'], [/패 놀이|놀이터|오광|보드/, 'card', '#c98a96'],
    [/동아리|부실/, 'flag', '#c98a96'], [/옥상|달/, 'moon', '#efe6ce'], [/계단|층계/, 'stair', '#a0b2b3'], [/교실|강의|도서|서고|장서|서당|학/, 'book', '#68a9b9'], [/체력|단련|실습|무구|병기/, 'sword', '#d56b69'],
    [/사당|제단|신당|기와|문지기/, 'roof', '#d4b078'], [/표지판|안내/, 'card', '#d4b078'], [/도깨비|불/, 'flame', '#6fae9f'], [/텃밭|비닐|밭|숲|나무|길|산|둘레|야영|교외/, 'tree', '#6fae9f'], [/샘|연못|호수|개울|물/, 'water', '#68a9b9'],
    [/숙|침|방$/, 'bed', '#9fb0c8'], [/문|현관|입구|로비/, 'door', '#efe6ce'],
  ];
  function pix(name, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 7 7'); svg.setAttribute('class', 'px-ico'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('shape-rendering', 'crispEdges');
    (PIX[name] || PIX.star).split(/\s+/).forEach((row, y) => [...row].forEach((c, x) => { if (c !== '#') return; const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1); r.setAttribute('fill', color); svg.append(r); }));
    return svg;
  }
  const iconFor = (name) => { const rule = PIX_RULES.find(([re]) => re.test(name)); return rule ? pix(rule[1], rule[2]) : pix('star', '#a0b2b3'); };
  // v1.6 — 지도는 지금 있는 곳의 것만 보인다(본관에선 본관, 뒷산에선 뒷산). 눌러서 옮겨 가지 않고, 어디쯤인지 보기만 한다.
  const MAP_OF = { mainHall: 'mainHall', infirmary: 'mainHall', annex: 'annex', gym: 'gym', shrine: 'shrine' };
  /** 마지막으로 들른 탐사 지점(실행 화면이 counts.lastSpot 에 적는다 — 'mainHall:f1:lobby' 꼴)에서 지금 있는 층 · 방을 찾는다. */
  function hereOf(m) {
    const parts = String(counts().lastSpot || '').split(':');
    if (parts[0] !== m.id) return {};
    const lv = m.levels.find((l) => l.rooms.some((r) => parts.includes(r.id))) ?? m.levels.find((l) => parts.includes(l.id));
    const room = lv?.rooms.find((r) => parts.includes(r.id));
    return { level: lv?.id, room: room?.id };
  }
  function renderMap(tabId) {
    const m = (DATA.maps || []).find((x) => x.id === MAP_OF[tabId]);
    mapTabs.hidden = true; mapTabs.replaceChildren();
    if (!m) { mapBody.replaceChildren(emptyBox('圖', '이곳에는 지도가 없다.', '발밑만 보고 걷는 수밖에.')); return; }
    $('#mapDialogTitle').textContent = `${m.name} 지도`;
    const here = hereOf(m);
    const board = h('div', `pxmap pxmap-${m.color}`);
    const title = h('div', 'pxmap-title'); title.append(h('b', '', m.hanja), h('span', '', m.name));
    board.append(title);
    board.append(h('p', 'pxmap-note', here.level ? '■ 깜빡이는 칸이 지금 있는 곳이다. 지도는 보기만 할 수 있다 — 걸어서 가야 한다.' : '지도는 보기만 할 수 있다 — 걸어서 가야 한다.'));
    const levels = m.id === 'gym' || m.id === 'shrine' ? m.levels : m.levels.slice().reverse(); // 건물은 위층이 위에
    const wrap = h('div', `pxlevels${m.id === 'gym' ? ' is-paths' : ''}`);
    levels.forEach((lv) => {
      const floor = h('section', `pxfloor${here.level === lv.id ? ' is-here' : ''}`);
      floor.append(h('h3', 'pxfloor-name', lv.name));
      const plan = h('div', 'pxwall pxplan');
      const rooms = lv.rooms.length ? lv.rooms : [{ id: lv.id, name: m.id === 'gym' ? '퇴마 실습 · 추가전투' : lv.name }];
      rooms.forEach((r) => {
        const isHere = here.room === r.id;
        const cell = h('div', `pxroom${r.club ? ' is-club' : ''}${r.path ? ' is-path' : ''}${isHere ? ' is-here' : ''}`);
        cell.append(iconFor(r.club ? '동아리' : r.name), h('span', '', r.name));
        if (isHere) { cell.append(h('i', 'pxroom-here', '지금 여기')); cell.setAttribute('aria-current', 'location'); }
        cell.title = `${m.name} ${lv.name} · ${r.name}`;
        plan.append(cell);
      });
      const hall = h('div', 'pxhall'); hall.append(pix(m.id === 'gym' ? 'tree' : m.id === 'shrine' ? 'roof' : 'stair', '#6f8496'), h('span', '', m.id === 'gym' ? '산길' : m.id === 'shrine' ? '마당' : '복도 · 계단'), pix(m.id === 'gym' ? 'tree' : m.id === 'shrine' ? 'roof' : 'stair', '#6f8496'));
      plan.append(hall);
      floor.append(plan); wrap.append(floor);
    });
    board.append(wrap);
    mapBody.replaceChildren(board);
    addTo('pages', `map/${m.id}`);
  }
  document.querySelectorAll('[data-open-map]').forEach((b) => b.addEventListener('click', () => { if (pageView.hidden || !MAP_OF[b.dataset.map]) return; renderMap(b.dataset.map); mapDialog.showModal(); }));
  $('#mapClose').addEventListener('click', () => mapDialog.close());
  mapDialog.addEventListener('click', (event) => { if (event.target === mapDialog) mapDialog.close(); });

  /* ───────── 관리자 (#/admin). 서버가 필요한 것은 서버가 붙으면 열린다. ───────── */
  function renderAdmin(tab) {
    openPage('管理 / ADMIN', '관리자 도구', 'simple');
    const tabId = ['story', 'server'].includes(tab) ? tab : 'tools';
    setTabs(panelTabs, [{ id: 'tools', label: '관리자 도구' }, { id: 'story', label: '스토리 관리' }, { id: 'server', label: '서버 관리' }], tabId, (id) => go(id === 'tools' ? '#/admin' : `#/admin/${id}`));
    if (tab === 'server') { if (window.BiryeongServer) window.BiryeongServer.renderAdmin(panelBody); else panelBody.append(para('불러오는 중이다.')); return; }
    if (tab === 'story') { if (window.BiryeongQuest) window.BiryeongQuest.renderAdminStory(panelBody); else panelBody.append(para('이야기를 불러오는 중이다.')); return; }
    const api = playApi()?.admin, g = () => playApi()?.player;
    if (!profile()) { panelBody.append(needProfile()); }
    else if (!api) panelBody.append(para('실행 화면을 불러오는 중이다. 잠시 뒤 다시 열어 주세요.'));
    else {
      const p = g();
      panelBody.append(h('p', 'panel-label', '내 수치 고치기'));
      const form = h('form', 'admin-form'); form.noValidate = true;
      const num = (label, value, min, max) => { const w = h('label', 'admin-num'); const i = h('input'); i.type = 'number'; i.min = min; i.max = max; i.value = Math.floor(value); w.append(h('span', '', label), i); return [w, i]; };
      const grid = h('div', 'admin-grid'); const ins = {};
      R.statKeys.forEach((k) => { const [w, i] = num(R.stats[k].label, p.stats[k] ?? 1, 1, 999); ins[k] = i; grid.append(w); });
      const grid2 = h('div', 'admin-grid');
      [['hp', '체력', p.hp, 1, 9999], ['hpMax', '체력 최대', p.hpMax, 1, 9999], ['mp', '의지력', p.mp, 0, 9999], ['mpMax', '의지력 최대', p.mpMax, 1, 9999], ['spirit', `영력 (최대 ${api.spiritMax})`, p.spirit, 0, api.spiritMax], ['money', '소지금(냥)', p.money, 0, 9999999]]
        .forEach(([k, label, v, lo, hi]) => { const [w, i] = num(label, v ?? 0, lo, hi); ins[k] = i; grid2.append(w); });
      const weak = h('label', 'admin-check'); const weakIn = h('input'); weakIn.type = 'checkbox'; weak.append(weakIn, h('span', '', '[쇠약] · [저주] 풀기'));
      const psy = h('label', 'admin-num'); const psySel = h('select'); psySel.append(new Option('영능력 얻기 — 고르지 않음', ''));
      const have = new Set(p.psychics ?? []);
      api.psychics.forEach((x) => psySel.append(new Option(`${x.label}${have.has(x.id) ? ' (보유)' : ''}`, x.id)));
      psy.append(h('span', '', '영능력'), psySel);
      const acts = h('div', 'profile-actions');
      const clampNum = (i) => Math.min(Number(i.max), Math.max(Number(i.min), Math.floor(Number(i.value) || 0)));
      acts.append(btn('ghost-btn', '체력 · 의지력 가득', () => { ins.hp.value = ins.hpMax.value; ins.mp.value = ins.mpMax.value; }));
      const apply = h('button', 'solid-btn', '적용'); apply.type = 'submit'; acts.append(apply);
      form.append(grid, grid2, weak, psy, acts);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const v = { stats: Object.fromEntries(R.statKeys.map((k) => [k, clampNum(ins[k])])), clearWeak: weakIn.checked, acquirePsychic: psySel.value || null };
        for (const k of ['hpMax', 'mpMax', 'hp', 'mp', 'spirit', 'money']) v[k] = clampNum(ins[k]);
        if (api.apply(v)) { refreshFromPlay(); toast('관리자', '수치를 고쳤다.'); route(); }
      });
      panelBody.append(form, h('div', 'panel-rule'), h('p', 'panel-label', '아이템 지급'));
      const give = h('form', 'admin-give'); give.noValidate = true;
      const q = h('input'); q.type = 'search'; q.placeholder = '아이템 이름으로 찾기'; q.setAttribute('aria-label', '아이템 찾기');
      const sel = h('select'); sel.setAttribute('aria-label', '아이템 고르기');
      const fill = () => { const t = q.value.trim(); sel.replaceChildren(...api.items.filter((x) => !t || x.name.includes(t) || x.id.includes(t)).map((x) => new Option(x.name, x.id))); };
      q.addEventListener('input', fill); fill();
      const n = h('input'); n.type = 'number'; n.min = 1; n.max = 999; n.value = 1; n.setAttribute('aria-label', '개수');
      const giveBtn = h('button', 'solid-btn', '지급'); giveBtn.type = 'submit';
      give.append(q, sel, n, giveBtn);
      give.addEventListener('submit', (event) => { event.preventDefault(); if (sel.value && api.give(sel.value, Number(n.value) || 1)) { refreshFromPlay(); toast('관리자', `${sel.selectedOptions[0].textContent} ×${Number(n.value) || 1} 지급`); } });
      panelBody.append(give);
    }
    panelBody.append(h('div', 'panel-rule'), h('p', 'panel-label', '관리자 계정에 늘 적용되는 것'));
    const ul = h('ul', 'admin-list');
    ['매점: 값을 치르지 않고 산다.', '공작소 · 조리실: 제작법대로 만들 때 재료가 줄지 않는다.', '무구보관소: 강화 · 특수 강화 · 도깨비 토큰 교환에 재료가 들지 않는다.', '육조 스탯: 상한(50)을 넘겨 999까지 올릴 수 있다.', '패 놀이터 · 수업 꾸미기: 횟수 제한과 잠금이 풀린다.'].forEach((t) => ul.append(h('li', '', t)));
    panelBody.append(ul);
    if (Auth.server) { panelBody.append(h('div', 'panel-rule'), para('회원 · 하사 · 공지 · 밀담 감사 · 감사 기록은 [서버 관리] 탭에 있다.')); return; }
    panelBody.append(h('div', 'panel-rule'), h('p', 'panel-label', `회원 목록 — 이 브라우저 (${Auth.list().length}명)`));
    const me = Auth.session();
    const list = h('div', 'codex-list');
    Auth.list().forEach((u) => {
      const r = h('div', 'codex-row is-got'); const t = h('div', 'codex-text');
      t.append(h('strong', '', `${u.name || u.id}${u.name ? ` @${u.id}` : ''}${u.id === me ? ' (나)' : ''}${u.admin ? ' · 관리자' : ''}`), h('p', '', `등록 ${new Date(u.createdAt).toLocaleDateString('ko-KR')} · 기록 ${u.hasSave ? '있음' : '없음'}`));
      const side = h('div', 'codex-side admin-side');
      side.append(btn('ghost-btn codex-use', '비밀번호 초기화', () => { const pw = window.prompt(`${u.id} 의 새 비밀번호 (4자 이상)`); if (pw == null) return; toast('관리자', Auth.resetPassword(u.id, pw) ? `${u.id} 의 비밀번호를 바꿨다.` : '바꾸지 못했다. (4자 이상)'); }));
      if (u.id !== me) {
        side.append(btn('ghost-btn codex-use', u.admin ? '관리자 해제' : '관리자 지정', () => { Auth.setAdmin(u.id, !u.admin); route(); }));
        side.append(btn('ghost-btn codex-use', '계정 삭제', () => { if (window.confirm(`${u.id} 계정과 그 기록을 지울까요? 되돌릴 수 없습니다.`)) { Auth.remove(u.id); route(); } }));
      }
      r.append(h('span', 'codex-mark', u.admin ? '◆' : '◇'), t, side); list.append(r);
    });
    panelBody.append(list, para('지금은 서버가 연결되지 않아 계정과 기록이 이 브라우저에만 있다. Supabase 를 연결하면 [서버 관리] 탭에서 전체 회원 · 하사 · 공지 · 밀담 감사를 다룬다. 연결 순서: supabase/README.md'));
  }

  /* ───────── 바로 실행 페이지 (#/go/…) ───────── */
  function renderGo(to) {
    const label = (Play()?.routes || []).find((r) => r.path === to)?.label ?? (Play()?.routes || []).find((r) => r.path === to.split('/')[0])?.label ?? '실행';
    openPage('實行 / PLAY', label, 'play');
    addTo('pages', `go/${to.split('/')[0]}`);
    showPlay(to);
  }

  /* ───────── 스토리 퀘스트 (산문) ───────── */
  const HEIRLOOM = Object.fromEntries((STORY.steps.find((s) => s.options)?.options || []).map((o) => [o.id, o]));
  const storyIndex = () => STORY.steps.findIndex((s) => !save.story.done[s.id]); // 지금 진행 중인 절(-1 = 모두 끝)
  const rewardText = (r) => [r?.spirit ? `영력 +${r.spirit}` : '', r?.money ? `${r.money}냥` : ''].filter(Boolean).join(' · ');
  function claimStep(step) {
    if (save.story.done[step.id] || !met(step.goal.when)) return;
    const api = playApi();
    if (!api) { toast('잠시만', '실행 화면을 불러오는 중이다. 잠시 뒤 다시 눌러 주세요.'); return; }
    api.grant({ spirit: step.reward?.spirit || 0, money: step.reward?.money || 0, log: `스토리 「${step.title}」 완료. (${rewardText(step.reward)})` });
    save.story.done[step.id] = Date.now();
    persist(); pullPlay(); renderStatus();
    toast('스토리 진행', `${step.title} — ${rewardText(step.reward)}`);
    route();
  }
  function renderStory() {
    addTo('pages', 'story');
    const current = storyIndex();
    const head = h('div', 'story-head');
    head.append(h('p', 'story-chapter', STORY.chapter), h('p', 'panel-count', `진행 ${current < 0 ? STORY.steps.length : current} / ${STORY.steps.length}${save.story.heirloom ? ` · 유품: ${HEIRLOOM[save.story.heirloom]?.name ?? ''}` : ''}`));
    panelBody.append(head);
    const pre = h('details', 'story-premise'); pre.open = current <= 0;
    pre.append(h('summary', '', '2035 · 비령'), ...STORY.premise.map((t) => para(t)));
    panelBody.append(pre);
    STORY.steps.forEach((step, i) => {
      const done = !!save.story.done[step.id], now = i === current;
      const box = h('section', `story-step${done ? ' is-done' : now ? ' is-now' : ' is-locked'}`);
      const title = h('h3', '', done || now ? step.title : `${step.title.split(' · ')[0]} · ？？？`);
      title.prepend(h('span', 'story-mark', done ? '◆' : now ? '◈' : '◇'));
      box.append(title);
      if (done || now) step.text.forEach((t) => box.append(para(t)));
      if (now) {
        if (step.options) {
          const pick = h('div', 'story-options');
          step.options.forEach((o) => {
            const b = btn(`story-option${save.story.heirloom === o.id ? ' is-on' : ''}`, '', () => { save.story.heirloom = o.id; persist(); mark('heirloomChosen'); route(); });
            b.append(h('strong', '', o.name), h('small', '', o.note)); pick.append(b);
          });
          box.append(pick);
        }
        const ok = met(step.goal.when), prog = progressOf(step.goal.when);
        const goal = h('div', 'story-goal');
        goal.append(h('span', '', `목표 — ${step.goal.desc}`), h('b', '', ok ? '달성' : prog ? `${prog[0]} / ${prog[1]}` : '미달성'));
        box.append(goal);
        const claim = btn('solid-btn', `다음으로 (${rewardText(step.reward)})`, () => claimStep(step)); claim.disabled = !ok;
        box.append(claim);
      } else if (done && step.options && save.story.heirloom) box.append(h('p', 'story-chosen', `고른 유품 — ${HEIRLOOM[save.story.heirloom]?.name ?? ''}`));
      panelBody.append(box);
    });
    if (current < 0) panelBody.append(h('p', 'panel-fine', '제1장을 모두 마쳤다. 다음 장을 기다린다.'));
  }

  /* ───────── 사건 기록 · 소지금 · 업데이트 노트 ───────── */
  const VOLUMES = STORY.volumes || [];
  const QD = () => window.BIRYEONG_QUESTS || { chapters: [], volumes: [] };
  // 권이 열렸는가: 그 권에 속한 장이 하나라도 공개되었으면(프롤로그는 늘 열려 있다)
  const volOpen = (n) => QD().chapters.some((c) => c.vol === n && (c.n === 0 || window.BiryeongQuest?.isOpen(c.n)));
  const openVolumes = () => VOLUMES.filter((v) => volOpen(v.n));
  function renderCase(n) {
    const list = openVolumes();
    const vol = list.find((v) => String(v.n) === String(n)) || list[0];
    if (!vol) { go('#/'); return; }
    openPage(`主要 / 第${vol.n}卷`, `제${vol.n}권 - ${vol.title}`, 'simple');
    if (list.length > 1) setTabs(panelTabs, list.map((v) => ({ id: String(v.n), label: `제${v.n}권 · ${v.title}` })), String(vol.n), (id) => go(`#/case/${id}`));
    if (vol.hanja) panelBody.append(h('p', 'case-hanja', vol.hanja));
    const doc = h('div', 'case-doc');
    vol.blocks.forEach((b) => {
      if (b.kind === 'quote') { const q = h('div', 'case-oracle'); q.append(h('b', '', '秘靈 · 통합 신탁'), h('p', '', b.text)); doc.append(q); }
      else doc.append(h('p', 'case-para', b.text));
    });
    panelBody.append(doc, h('p', 'panel-fine', `주요 이야기 · 제${vol.n}권`), btn('solid-btn', '산문으로 — 본편 이야기', () => go('#/zone/north')));
    mark('caseRead');
  }
  /* 첫 화면 왼쪽 — [주요 이야기] 공개된 권의 사건 개요 · [공지사항] 관리자가 쓰는 게시판(최신이 맨 위) */
  function drawVolumes() {
    const host = $('#loreVolumes'); if (!host) return;
    host.replaceChildren(...openVolumes().map((v) => { const b = btn('lore-link', '', () => go(`#/case/${v.n}`)); b.append(`▤　제${v.n}권 - ${v.title}`, h('span', '', '→')); return b; }));
  }
  const BOARD_KEY = 'biryeong-board-v1', BOARD_SEEN = () => `biryeong-board-seen:${Auth.session()}`;
  const boardLocal = () => { try { return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); } catch (_) { return []; } };
  const boardSave = (rows) => { try { localStorage.setItem(BOARD_KEY, JSON.stringify(rows)); return true; } catch (_) { return false; } };
  const board = {
    list: async () => (Auth.server && Auth.token() ? (await Auth.call('bry_board')).posts : boardLocal().slice().sort((x, y) => y.id - x.id)),
    post: async (title, body) => {
      if (Auth.server) return Auth.call('bry_admin_board_post', { p_title: title, p_body: body });
      const rows = boardLocal(); rows.push({ id: Date.now(), title, body, author: Auth.session(), created_at: new Date().toISOString() }); return boardSave(rows);
    },
    remove: async (id) => (Auth.server ? Auth.call('bry_admin_board_delete', { p_id: id }) : boardSave(boardLocal().filter((x) => x.id !== id))),
  };
  const dateText = (v) => { try { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v)); } catch (_) { return ''; } };
  let boardOpenId = null;
  async function drawBoard() {
    const host = $('#loreNotice'); if (!host) return;
    const admin = Auth.isAdmin();
    const listEl = h('div', 'notice-list'); host.replaceChildren(listEl);
    if (admin) {
      const f = h('form', 'notice-form'); const t = h('input'); t.maxLength = 80; t.placeholder = '공지 제목'; t.required = true;
      const ta = h('textarea'); ta.maxLength = 3000; ta.rows = 4; ta.placeholder = '공지 내용'; ta.required = true;
      const sb = h('button', 'lore-link notice-submit', '공지 올리기'); sb.type = 'submit';
      const d = h('details', 'notice-write'); d.append(h('summary', '', '＋ 공지 쓰기 (관리자)'), f); f.append(t, ta, sb);
      f.addEventListener('submit', async (e) => { e.preventDefault(); if (!t.value.trim() || !ta.value.trim()) return; sb.disabled = true; try { await board.post(t.value.trim(), ta.value.trim()); toast('공지사항', '공지를 올렸다.'); drawBoard(); } catch (err) { toast('공지사항', err.message); sb.disabled = false; } });
      host.prepend(d);
      if (!Auth.server) host.append(h('p', 'notice-fine', '서버가 연결되지 않아, 여기 올린 공지는 이 브라우저에서만 보인다.'));
    }
    let rows = [];
    try { rows = await board.list(); } catch (err) { listEl.append(h('p', 'notice-fine', err.message)); return; }
    if (!rows.length) { listEl.append(h('p', 'notice-fine', '아직 올라온 공지가 없다.')); return; }
    const seen = Number(localStorage.getItem(BOARD_SEEN()) || 0);
    rows.forEach((r, i) => {
      const item = h('article', `notice-item${i === 0 ? ' is-latest' : ''}`);
      const head = btn('notice-head', '', () => { boardOpenId = boardOpenId === r.id ? null : r.id; drawBoard(); });
      head.append(h('span', 'notice-date', dateText(r.created_at)), h('strong', '', r.title));
      if (new Date(r.created_at).getTime() > seen) head.append(h('i', 'notice-dot', 'N'));
      item.append(head);
      if (boardOpenId === r.id || (boardOpenId == null && i === 0)) {
        item.classList.add('is-open'); item.append(h('p', 'notice-body', r.body));
        if (admin) item.append(btn('notice-del', '지우기', async () => { if (!window.confirm(`「${r.title}」 공지를 지울까요?`)) return; try { await board.remove(r.id); drawBoard(); } catch (err) { toast('공지사항', err.message); } }));
      }
      listEl.append(item);
    });
    const newest = Math.max(...rows.map((r) => new Date(r.created_at).getTime()));
    const dot = $('.lore-new');
    if (dot) dot.hidden = !(newest > seen) || !$('#loreNotice').hidden;
    if (!$('#loreNotice').hidden) try { localStorage.setItem(BOARD_SEEN(), String(newest)); } catch (_) { /* 무시 */ }
  }
  document.querySelectorAll('[data-lore-tab]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.loreTab;
    document.querySelectorAll('[data-lore-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $('#loreStory').hidden = t !== 'story'; $('#loreNotice').hidden = t !== 'notice';
    if (t === 'notice') drawBoard();
  }));
  function renderMoney() {
    const p = profile();
    openPage('錢 / 소지금', `${Math.floor(game()?.money ?? p?.money ?? 0)}냥`, 'simple');
    addTo('pages', 'money');
    panelBody.append(para(p ? '주머니 속 엽전을 세어 보았다. 퇴마 실습에서 이기거나 매점에 물건을 팔면 늘어나고, 매점에서 사면 줄어든다.' : '프로필을 만들면 주머니가 생긴다.'));
    const acts = h('div', 'profile-actions'); acts.append(btn('ghost-btn', '매점으로', () => go('#/zone/west/dorm/store')), btn('ghost-btn', '퇴마 실습으로', () => go('#/zone/south/gym/battle')));
    panelBody.append(acts);
    const log = (save.playLog || []).slice(-25).reverse();
    if (log.length) { panelBody.append(h('p', 'panel-label', '최근 기록')); const ul = h('ul', 'log-list'); log.forEach((l) => { const li = h('li'); li.append(h('span', '', `[${l.time}] `), l.message); ul.append(li); }); panelBody.append(ul); }
  }
  // vC.01: 지금까지의 노트는 모두 비웠다. 노트는 관리자가 [업데이트 노트] 화면에서 직접 쓴다(공지처럼. 서버 bry_notes — 서버가 없으면 이 브라우저에만).
  const UPDATE_NOTES = [];
  const NOTES_KEY = 'biryeong-notes-v2';
  const notesLocal = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch (_) { return []; } };
  const notesApi = {
    list: async () => (Auth.server && Auth.token() ? (await Auth.call('bry_notes')).notes : notesLocal().slice().sort((x, y) => y.id - x.id)),
    post: async (v, body) => { if (Auth.server) return Auth.call('bry_admin_note_post', { p_version: v, p_body: body }); const rows = notesLocal(); rows.push({ id: Date.now(), version: v, body, created_at: new Date().toISOString() }); localStorage.setItem(NOTES_KEY, JSON.stringify(rows)); return true; },
    remove: async (id) => { if (Auth.server) return Auth.call('bry_admin_note_delete', { p_id: id }); localStorage.setItem(NOTES_KEY, JSON.stringify(notesLocal().filter((x) => x.id !== id))); return true; },
  };
  const noteBox = (v, date, lines, onDel) => {
    const box = h('div', 'note-box'); const head = h('p', 'panel-label'); head.append(h('b', '', v), date ? ` · ${date}` : '');
    const ul = h('ul'); lines.forEach((l) => ul.append(h('li', '', l)));
    box.append(head, ul); if (onDel) box.append(btn('ghost-btn codex-use note-del', '지우기', onDel)); return box;
  };
  function renderNotes() {
    openPage('報 / UPDATE NOTES', '업데이트 노트', 'simple');
    addTo('pages', 'notes');
    if (Auth.isAdmin()) {
      const f = h('form', 'admin-form note-form'); const vIn = h('input'); vIn.placeholder = '버전 (예: vC.01)'; vIn.maxLength = 20; vIn.required = true;
      const ta = h('textarea'); ta.rows = 4; ta.maxLength = 3000; ta.placeholder = '바뀐 점 — 한 줄에 하나씩 적으면 줄마다 한 항목이 된다'; ta.required = true;
      const sb = h('button', 'solid-btn', '노트 올리기'); sb.type = 'submit';
      const d = h('details', 'notice-write'); d.open = true; d.append(h('summary', '', '＋ 업데이트 노트 쓰기 (관리자)'), f); f.append(vIn, ta, sb); panelBody.append(d);
      if (!Auth.server) panelBody.append(para('서버가 연결되지 않아, 여기 올린 노트는 이 브라우저에서만 보인다.'));
      f.addEventListener('submit', async (e) => { e.preventDefault(); sb.disabled = true; try { await notesApi.post(vIn.value.trim(), ta.value.trim()); toast('업데이트 노트', '노트를 올렸다.'); renderNotes(); } catch (err) { toast('업데이트 노트', err.message); sb.disabled = false; } });
    }
    const list = h('div', 'notes-list'); panelBody.append(list);
    const draw = (rows) => {
      list.replaceChildren();
      rows.forEach((r) => list.append(noteBox(r.version, dateOnly(r.created_at), String(r.body).split('\n').map((x) => x.trim()).filter(Boolean),
        Auth.isAdmin() ? async () => { if (!window.confirm(`${r.version} 노트를 지울까요?`)) return; try { await notesApi.remove(r.id); renderNotes(); } catch (err) { toast('업데이트 노트', err.message); } } : null)));
      UPDATE_NOTES.forEach((n) => list.append(noteBox(n.v, n.date, n.lines)));
      if (!rows.length && !UPDATE_NOTES.length) list.append(emptyBox('報', '아직 올라온 업데이트 노트가 없다.', Auth.isAdmin() ? '위의 칸에 버전과 바뀐 점을 적어 올리면 여기에 쌓인다.' : '새 소식이 올라오면 여기에 쌓인다.'));
    };
    draw([]);
    notesApi.list().then(draw).catch(() => draw([]));
  }
  const dateOnly = (v) => { try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(v)); } catch (_) { return ''; } };

  /* ───────── 내 프로필 ───────── */
  function avatarInto(el, photo, name) {
    el.replaceChildren();
    if (photo) { const img = h('img'); img.src = photo; img.alt = ''; el.append(img); } else el.append(h('span', '', (name || '人').slice(0, 1)));
  }
  function readPhoto(file, done) {
    if (!file || !file.type.startsWith('image/')) { toast('사진', '그림 파일만 올릴 수 있습니다.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256, side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = h('canvas'); canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      done(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('사진', '이 그림은 읽을 수 없습니다.'); };
    img.src = url;
  }
  const openProfile = (editing) => go(editing ? '#/profile/edit' : '#/profile');
  function renderProfile(editing) {
    const p = profile();
    openPage('個人記錄 / MY PROFILE', '내 프로필', 'profile');
    addTo('pages', 'profile');
    if (!p || editing) renderProfileForm(p); else renderProfileCard(p);
  }
  function renderProfileCard(p) {
    const card = h('div', 'profile-card');
    const avatar = h('div', 'profile-avatar'); avatarInto(avatar, p.photo, p.name);
    const info = h('div', 'profile-info');
    info.append(h('small', 'profile-title', p.title && ownsTitle(p.title) ? `「${titleById[p.title].name}」` : '칭호 없음'), h('h3', '', p.name));
    const meta = h('p', 'profile-meta'); meta.append(h('span', '', `나이 ${p.age || '—'}`), h('span', '', `성별 ${p.gender || '—'}`));
    if (save.story.heirloom) meta.append(h('span', '', `유품 ${HEIRLOOM[save.story.heirloom]?.name ?? ''}`));
    info.append(meta, h('p', 'profile-intro', p.intro || '(한줄소개가 비어 있다)'));
    card.append(avatar, info);
    panelBody.append(card, h('div', 'panel-rule'));
    const grid = h('div', 'profile-stats'); const st = statsNow();
    R.statKeys.forEach((k) => { const c = h('div', 'profile-stat'); c.title = R.stats[k].detail; c.append(h('span', '', R.stats[k].label), h('b', '', String(Math.floor(st[k] ?? 1)))); grid.append(c); });
    panelBody.append(h('p', 'panel-label', '육조 스탯'), grid);
    const pick = h('div', 'profile-field');
    const sel = h('select'); sel.id = 'profileTitleSelect';
    sel.append(new Option('칭호 없음', ''));
    ownedTitles().forEach((t) => sel.append(new Option(`${t.name} — ${t.perkText ?? ''}`, t.id, false, p.title === t.id)));
    sel.addEventListener('change', () => { p.title = sel.value || null; persist(); renderStatus(); route(); });
    const lab = h('label', '', `칭호 고르기 (가진 칭호 ${ownedTitles().length} / ${TITLES.length})`); lab.htmlFor = sel.id;
    pick.append(lab, sel);
    if (p.title && titleById[p.title]) pick.append(h('small', '', titleById[p.title].desc), h('small', 'perk-line', `기능 — ${titleById[p.title].perkText ?? '없음'}`));
    else pick.append(h('small', '', '칭호를 달면 그 칭호의 기능 하나가 듣는다.'));
    panelBody.append(pick);
    const foot = h('div', 'profile-actions');
    foot.append(btn('ghost-btn', '프로필 고치기', () => openProfile(true)), btn('ghost-btn', '업적 / 도감', () => openCodex('titles')));
    if (window.BiryeongOpening) foot.append(btn('ghost-btn', '오프닝 다시 보기', () => window.BiryeongOpening.play({ replay: true })));
    panelBody.append(foot, h('p', 'panel-fine', Auth.server ? '프로필과 진행 기록은 비령 서버에 함께 보관됩니다. 다른 기기에서도 같은 아이디로 이어집니다.' : '프로필과 진행 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.'));
  }
  function renderProfileForm(p) {
    const creating = !p;
    const draft = { name: p?.name ?? '', age: p?.age ?? '', gender: p?.gender ?? '', intro: p?.intro ?? '', photo: p?.photo ?? null, stats: p ? { ...p.stats } : blankStats() };
    panelBody.replaceChildren();
    const form = h('form', 'profile-form'); form.noValidate = true;
    if (creating) form.append(h('p', 'panel-intro panel-p', '산문 명부에 이름을 남깁니다. 스탯은 처음 한 번만 나눌 수 있고, 나머지는 언제든 고칠 수 있습니다.'));
    // 사진
    const photoRow = h('div', 'profile-photo-row');
    const av = h('div', 'profile-avatar'); avatarInto(av, draft.photo, draft.name);
    const file = h('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    file.addEventListener('change', () => readPhoto(file.files[0], (dataUrl) => { draft.photo = dataUrl; avatarInto(av, draft.photo, draft.name); }));
    const photoBtns = h('div', 'profile-photo-btns');
    photoBtns.append(btn('ghost-btn', '사진 올리기', () => file.click()), btn('ghost-btn', '사진 지우기', () => { draft.photo = null; file.value = ''; avatarInto(av, null, draft.name); }), h('small', '', '어떤 그림이든 됩니다. 가운데를 정사각형으로 잘라 씁니다.'));
    photoRow.append(av, photoBtns, file);
    form.append(photoRow);
    // 글 칸
    const field = (id, label, value, attrs = {}) => {
      const wrap = h('div', 'profile-field'); const lab = h('label', '', label); lab.htmlFor = id;
      const input = h('input'); input.id = id; input.value = value; Object.assign(input, attrs);
      wrap.append(lab, input); form.append(wrap); return input;
    };
    const nameIn = field('pfName', `이름 (${R.nameMax}자까지)`, draft.name, { maxLength: R.nameMax, required: true, autocomplete: 'off' });
    nameIn.addEventListener('input', () => { if (!draft.photo) avatarInto(av, null, nameIn.value); });
    const ageIn = field('pfAge', '나이', draft.age, { maxLength: 12, autocomplete: 'off' });
    const genderIn = field('pfGender', '성별 (자유롭게 적기)', draft.gender, { maxLength: 20, autocomplete: 'off' });
    const introIn = field('pfIntro', `한줄소개 (${R.introMax}자까지)`, draft.intro, { maxLength: R.introMax, autocomplete: 'off' });
    // 스탯
    const spent = () => R.statKeys.reduce((a, k) => a + draft.stats[k] - R.statMin, 0);
    if (creating) {
      const head = h('p', 'panel-label'); const left = h('b', '', '');
      head.append('육조 스탯 — 남은 점수 ', left);
      const grid = h('div', 'stat-alloc');
      const rows = {};
      const refresh = () => {
        left.textContent = `${R.startPoints - spent()} / ${R.startPoints}`;
        R.statKeys.forEach((k) => { rows[k].val.textContent = draft.stats[k]; rows[k].minus.disabled = draft.stats[k] <= R.statMin; rows[k].plus.disabled = spent() >= R.startPoints; });
      };
      R.statKeys.forEach((k) => {
        const row = h('div', 'stat-row');
        const text = h('div', 'stat-row-text'); text.append(h('strong', '', R.stats[k].label), h('small', '', R.stats[k].hint));
        const minus = btn('stat-step', '−', () => { if (draft.stats[k] > R.statMin) { draft.stats[k] -= 1; refresh(); } }); minus.setAttribute('aria-label', `${R.stats[k].label} 내리기`);
        const plus = btn('stat-step', '+', () => { if (spent() < R.startPoints) { draft.stats[k] += 1; refresh(); } }); plus.setAttribute('aria-label', `${R.stats[k].label} 올리기`);
        const val = h('b', 'stat-val', '');
        rows[k] = { minus, plus, val };
        row.append(text, minus, val, plus); grid.append(row);
      });
      form.append(head, grid, h('p', 'panel-fine', `모든 스탯은 ${R.statMin}에서 시작하고, 처음에 ${R.startPoints}점을 모두 나눠 줍니다.`));
      refresh();
    }
    const error = h('p', 'profile-error'); error.hidden = true; error.setAttribute('role', 'alert');
    const actions = h('div', 'profile-actions');
    const submit = h('button', 'solid-btn', creating ? '명부에 이름 남기기' : '저장'); submit.type = 'submit';
    actions.append(submit);
    if (!creating) actions.append(btn('ghost-btn', '취소', () => back()));
    form.append(error, actions);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = nameIn.value.trim();
      if (!name) { error.textContent = '이름을 적어 주세요.'; error.hidden = false; nameIn.focus(); return; }
      if (creating && spent() < R.startPoints) { error.textContent = `남은 스탯 ${R.startPoints - spent()}점을 모두 나눠 주세요.`; error.hidden = false; return; }
      const base = p ?? { stats: draft.stats, title: null, hp: R.hpMax, mp: R.mpMax, spirit: R.spiritStart, money: R.startMoney, inventory: {}, createdAt: Date.now() };
      save.profile = Object.assign(base, { name, age: ageIn.value.trim(), gender: genderIn.value.trim(), intro: introIn.value.trim(), photo: draft.photo });
      persist();
      if (creating) {
        const added = R.statKeys.map((k) => draft.stats[k] - R.statMin);
        mark('profileCreated');
        if (Math.max(...added) >= 7) mark('statsFocused');
        if (Math.min(...added) >= 1) mark('statsEven');
      }
      else mark('profileEdited');
      if (save.profile.photo) mark('photoSet');
      if (save.profile.intro) mark('introSet');
      window.BiryeongPlay?.reload(); // 실행 화면의 캐릭터도 새 프로필로 다시 읽는다
      renderStatus();
      if (location.hash === '#/profile') route(); else location.replace('#/profile'); // 같은 주소면 주소가 안 바뀌어 화면이 그대로 남는다 → 직접 다시 그린다
    });
    panelBody.append(form);
    nameIn.focus();
  }

  /* ───────── 오른쪽: 나의 상태 (육조 스탯은 여기서 바로 올린다) ───────── */
  function raiseStat(key) {
    const api = playApi();
    if (!api) { if (!profile()) go('#/profile'); return; }
    const before = api.player.stats[key];
    api.upgradeStat(key);
    if (api.player.stats[key] === before) toast('영력 부족', `${R.stats[key].label}을(를) 올리려면 영력 ${api.statCost(key)}이(가) 필요하다.`);
    setTimeout(refreshFromPlay, 0);
  }
  function renderStatus() {
    const p = profile(), g = game();
    avatarInto($('#statusAvatar'), p?.photo, p?.name);
    $('#statusTitle').textContent = p?.title && ownsTitle(p.title) ? `「${titleById[p.title].name}」` : '칭호 없음';
    $('#statusName').textContent = p?.name ?? '이름 없는 입산자';
    $('#statusSub').textContent = p ? (p.intro || '한줄소개 없음') : '눌러서 프로필 만들기';
    const spirit = g?.spirit ?? p?.spirit ?? R.spiritStart;
    const bars = [['체력', 'hp', g?.hp ?? p?.hp ?? R.hpMax, g?.hpMax ?? R.hpMax], ['영력', 'spirit', spirit, R.spiritMax], ['의지력', 'mp', g?.mp ?? p?.mp ?? R.mpMax, g?.mpMax ?? R.mpMax]];
    $('#statusBars').replaceChildren(...bars.map(([label, key, value, max]) => {
      const row = h('div', `status-bar bar-${key}`);
      const top = h('div', 'status-bar-top'); top.append(h('span', '', label), h('b', '', `${Math.floor(value)} / ${max}`));
      const track = h('div', 'status-bar-track'); track.setAttribute('role', 'meter'); track.setAttribute('aria-label', label); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(max)); track.setAttribute('aria-valuenow', String(Math.floor(value)));
      const fill = h('i'); fill.style.width = `${Math.min(100, (value / max) * 100)}%`; track.append(fill);
      row.append(top, track); return row;
    }));
    // vC.06 [현재 상태]: 쇠약 · 몸의 이상(사독 · 한기 …). 남은 시간과 효과를 보여 준다.
    const api = window.BiryeongPlay?.api?.();
    const conds = (() => { try { return api?.conditions?.() ?? []; } catch (_) { return []; } })();
    const cbox = $('#statusConditions');
    if (cbox) {
      const head = h('div', 'status-cond-head'); head.append(h('span', '', '현재 상태'), h('small', '', conds.length ? `${conds.length}가지` : ''));
      const list = h('div', 'status-cond-list');
      if (!conds.length) list.append(h('span', 'status-cond-none', '이상 없음 — 몸이 가뿐하다.'));
      for (const c of conds) {
        const chip = h('span', `status-cond${c.heavy ? ' is-heavy' : ''}${c.id === 'weak' ? ' is-weak' : ''}`);
        chip.title = `[${c.name}(${c.hanja})] ${c.text}\n효과: ${c.effect}\n남은 시간: ${c.left}`;
        chip.append(h('b', '', c.max > 1 ? `${c.name} ${c.stack}겹` : c.name), h('small', '', c.left));
        list.append(chip);
      }
      cbox.replaceChildren(head, list);
    }
    // vC.06 받은 부탁(인물의 퀘스트): 누가 · 무엇을 · 어디서 마치는지
    const npcBox = $('#npcTracker');
    if (npcBox) {
      const act = (() => { try { return api?.npcActive?.() ?? []; } catch (_) { return []; } })();
      npcBox.hidden = !act.length;
      npcBox.replaceChildren(...(act.length ? [h('p', 'npc-tracker-head', `받은 부탁 ${act.length} / 5`)] : []), ...act.map((q) => { const r = h('p', `npc-tracker-row${q.done ? ' is-done' : ''}`); r.append(h('b', '', q.npc), ` 「${q.title}」 ${q.goal} · ${q.cur}/${q.need}`, h('small', '', q.done ? ` → ${q.where}에서 마친다` : ` (${q.where})`)); return r; }));
    }
    const stats = statsNow();
    const eff = (() => { try { return api?.effStats?.() ?? null; } catch (_) { return null; } })();
    $('#statusStats').replaceChildren(...R.statKeys.map((k) => {
      const now = Math.floor(stats[k] ?? 1), cost = now * 10, can = !!p && spirit >= cost && now < R.statMax;
      const diff = eff && Number.isFinite(eff[k]) ? Math.floor(eff[k]) - now : 0; // vC.06 무구 · 장신구 · 칭호 · 음식 보정(쇠약 · 몸의 이상은 깎는다)
      const c = h('div', 'status-stat'); c.title = R.stats[k].detail;
      const up = btn('status-stat-up', '+', () => raiseStat(k));
      up.disabled = !can; up.title = !p ? '프로필을 먼저 만든다' : now >= R.statMax ? '더 올릴 수 없다' : `영력 ${cost} 로 ${R.stats[k].label} +1`;
      up.setAttribute('aria-label', `${R.stats[k].label} 올리기 (영력 ${cost})`);
      const val = h('b', '', String(now));
      if (diff) { const d = h('em', `status-stat-bonus${diff < 0 ? ' is-down' : ''}`, `(${diff > 0 ? '+' : '−'}${Math.abs(diff)})`); d.title = diff > 0 ? `장비 · 보정을 더하면 ${now + diff}` : `쇠약 · 몸의 이상으로 지금은 ${now + diff}`; val.append(d); }
      c.append(h('span', '', R.stats[k].label), val, up, h('small', '', `영력 ${cost}`));
      return c;
    }));
    $('#statusMoney').textContent = `${Math.floor(g?.money ?? p?.money ?? 0)}냥`;
    $('#statusQuest').textContent = window.BiryeongQuest ? window.BiryeongQuest.progressText() : '';
  }
  /** 실행 화면이 바꾼 값(game · counts · playLog)을 다시 읽는다. */
  function refreshFromPlay() { pullPlay(); renderStatus(); checkAchievements(); }
  function refreshStoryGoal() { const i = storyIndex(); if (i < 0) return; const ok = met(STORY.steps[i].goal.when); const b = $('.story-step.is-now .solid-btn'); if (b && b.disabled === ok) route(); }

  /* ───────── 업적 / 도감 ───────── */
  /* ───────── 도감 자료(codex-data.js) · 플레이어 기록으로 가리기 ───────── */
  const CODEX = window.BIRYEONG_CODEX || { items: [], psychics: [], enemies: [], templates: {}, palettes: {} };
  const dexPlayer = () => playApi()?.player || game() || {};
  const dexAll = () => Auth.isAdmin() && save.adminDexAll === true; // 관리자가 [모두 보기]를 켰을 때만 다 보인다
  const iconCache = {};
  /** 아이템 도트: 틀(12×12 글자) · 색(a b c d = 바탕 · 그림자 · 밝은 · 강조, k = 테두리)을 캔버스에 찍는다. */
  function itemIcon(px, size = 36) {
    const wrap = h('span', 'dex-icon');
    if (!px || !CODEX.templates[px.t]) { wrap.classList.add('is-unknown'); wrap.textContent = '?'; return wrap; }
    const key = `${px.t}:${px.p}`;
    if (!iconCache[key]) {
      const rows = CODEX.templates[px.t], pal = CODEX.palettes[px.p] || [], cv = document.createElement('canvas');
      cv.width = rows[0].length; cv.height = rows.length; const c = cv.getContext('2d');
      const col = { a: pal[0], b: pal[1], c: pal[2], d: pal[3], k: '#14101a' };
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { c.fillStyle = col[ch]; c.fillRect(x, y, 1, 1); } }));
      iconCache[key] = cv.toDataURL();
    }
    const img = h('img'); img.src = iconCache[key]; img.alt = ''; img.width = size; img.height = size; wrap.append(img);
    return wrap;
  }
  /** 적에 대해 무엇이 보이나 — 전투 화면 밖 목록과 같은 규칙(만난 횟수 · 안목 > 상대 영력). */
  function revealEnemy(e, p) {
    const fights = p.seen?.[e.id] || 0;
    const insight = (playApi()?.effStats?.() || p.stats || {}).insight || 0;
    const sharp = insight > (e.spirit || 0), again = fights >= 1;
    if (dexAll()) return { hp: true, atk: true, act: true, spirit: true, sharp: true };
    return { hp: again || sharp, atk: again && sharp, act: again && sharp, spirit: again && sharp, sharp };
  }
  const Q = '???';
  const dexLine = (label, text, cls = '') => { const p = h('p', `dex-line ${cls}`); p.append(h('b', '', label), h('span', '', text)); return p; };

  function renderDexItems(body) {
    const p = dexPlayer(), known = (id) => dexAll() || !!p.codex?.items?.[id];
    const got = CODEX.items.filter((i) => known(i.id)).length;
    const KINDS = ['전체', '재료', '완성품', '장비', '본편'];
    const kindOf = (i) => (i.id.startsWith('st-') ? '본편' : i.kind === '재료' ? '재료' : /무구|장비|장신구/.test(i.kind) ? '장비' : '완성품');
    const f = save.dexItemKind && KINDS.includes(save.dexItemKind) ? save.dexItemKind : '전체';
    const chips = h('div', 'dex-chips');
    KINDS.forEach((k) => { const b = btn(`dex-chip${k === f ? ' is-on' : ''}`, k, () => { save.dexItemKind = k; persist(); renderCodex('items'); }); chips.append(b); });
    body.append(h('p', 'panel-label codex-group', `아이템 · 손에 넣어 본 것 ${got} / ${CODEX.items.length}`), chips);
    const list = h('div', 'dex-list');
    CODEX.items.filter((i) => f === '전체' || kindOf(i) === f).sort(byName).forEach((i) => {
      const k = known(i.id), card = h('div', `dex-card${k ? ' is-got' : ''}`);
      card.dataset.dexItem = i.id; card.dataset.known = k ? '1' : '0';
      const head = h('div', 'dex-head'); head.append(k ? itemIcon(i.px) : itemIcon(null), h('strong', '', i.name), h('small', '', k ? i.kind : ''));
      card.append(head);
      if (k) card.append(dexLine('효과', i.effect), dexLine('해설', i.desc || '—', 'is-lore'), dexLine('설명', i.use));
      else card.append(dexLine('해설', Q, 'is-hidden'), dexLine('설명', Q, 'is-hidden'));
      card.append(dexLine('획득처', i.from, 'is-from'));
      list.append(card);
    });
    body.append(list);
  }

  function renderDexPsychics(body) {
    // vB.04: 아직 얻지 않은 영능력도 모두 보인다 — 이름만. 얻은 것은 의지력 소모 · 상세 설명 · 영향받는 스탯(육조) · 익히는 조건을 모두 적는다.
    const p = dexPlayer(), mine = new Set(p.psychics || []);
    const known = (x) => dexAll() || x.always || mine.has(x.id);
    const draw = (list, x, mark) => {
      const k = known(x), card = h('div', `dex-card${k ? ' is-got' : ' is-name-only'}`); card.dataset.dexPsychic = x.id; card.dataset.known = k ? '1' : '0';
      const head = h('div', 'dex-head'); head.append(h('span', 'dex-icon is-skill', mark), h('strong', '', x.name), h('small', '', k ? (x.always ? '처음부터' : x.stolen ? '빼앗음' : '익힘') : '미습득'));
      card.append(head);
      if (k) card.append(h('p', 'dex-note', x.note), dexLine('의지력 소모', x.mp), dexLine('상세 설명', x.detail || x.note), dexLine('영향받는 스탯', x.affects), dexLine('익히는 조건', x.cond));
      list.append(card);
    };
    const own = CODEX.psychics.filter((x) => !x.stolen), stolen = CODEX.psychics.filter((x) => x.stolen);
    body.append(h('p', 'panel-label codex-group', `영능력 · 익힌 것 ${own.filter(known).length} / ${own.length}`));
    const list = h('div', 'dex-list'); own.forEach((x) => draw(list, x, '術')); body.append(list);
    if (!stolen.length) return;
    body.append(h('p', 'panel-label codex-group', `빼앗은 영능력 · ${stolen.filter(known).length} / ${stolen.length}`),
      h('p', 'dex-hint', '같은 적을 30번 쓰러뜨리면 그 적의 영능력을 빼앗는다. 보스는 20번마다 두 영능력 중 하나씩(20번 · 40번). 지금 몇 번 쓰러뜨렸는지는 [적] 칸에 적힌다.'));
    const list2 = h('div', 'dex-list'); stolen.forEach((x) => draw(list2, x, '奪')); body.append(list2);
  }

  function renderDexEnemies(body) {
    const p = dexPlayer();
    const met = CODEX.enemies.filter((e) => dexAll() || (p.seen?.[e.id] || 0) > 0); // 만나지 않은 적은 아예 보이지 않는다
    body.append(h('p', 'panel-label codex-group', `적 · 만나 본 것 ${met.length}`));
    if (!met.length) { body.append(emptyBox('妖', '아직 마주친 상대가 없다.', '전투 실습 · 개척 · 둘레길에서 처음 만나면 여기에 적힌다.')); return; }
    const groups = [...new Set(met.map((e) => e.group))];
    groups.forEach((g) => {
      body.append(h('p', 'panel-label codex-group', g));
      const list = h('div', 'dex-list');
      met.filter((e) => e.group === g).forEach((e) => {
        const rv = e.story ? { hp: false, atk: false, act: false, spirit: false, sharp: true } : revealEnemy(e, p);
        const card = h('div', 'dex-card is-got is-enemy'); card.dataset.dexEnemy = e.id;
        const head = h('div', 'dex-head'); head.append(h('span', 'dex-icon is-enemy', e.tierLabel[0]), h('strong', '', e.name), h('small', '', [e.tierLabel, e.boss ? '보스' : '', e.party > 1 ? `일행 ${e.party}명` : ''].filter(Boolean).join(' · ')));
        card.append(head, h('p', 'dex-note', e.blurb || '—'), dexLine('등장 위치', e.where));
        if (e.story) card.append(dexLine('수치', '장면마다 다르다'));
        else {
          const stats = h('div', 'dex-stats');
          [['체력', rv.hp, e.hp], ['공격력', rv.atk, e.atk], ['행동력', rv.act, e.act], ['영력', rv.spirit, e.spirit]].forEach(([l, ok, v]) => { const c = h('span', ok ? '' : 'is-hidden'); c.append(h('b', '', l), document.createTextNode(` ${ok ? v : Q}`)); stats.append(c); });
          card.append(stats);
          if (!rv.sharp) card.append(h('p', 'dex-hint', `안목이 이 상대의 영력보다 높아야 나머지 수치와 영능력이 드러난다.`));
        }
        const sp = h('div', 'dex-specials'); sp.append(h('p', 'dex-sub', e.specials.length > 1 ? `영능력 ${e.specials.length}가지` : '영능력'));
        e.specials.forEach((x) => {
          const open = dexAll() || e.story || rv.sharp || !!p.specials?.[x.key];
          const item = h('div', `dex-special${open ? '' : ' is-hidden'}`);
          item.append(h('strong', '', open ? x.name : Q), h('p', '', open ? x.note : Q));
          if (open && x.rate) item.append(h('small', '', x.rate));
          sp.append(item);
        });
        const anyOpen = dexAll() || e.story || rv.sharp || e.specials.some((x) => p.specials?.[x.key]);
        if (anyOpen && (e.effects.length || e.gimmicks.length)) { const fx = h('ul', 'dex-fx'); [...e.effects, ...e.gimmicks].forEach((t) => fx.append(h('li', '', t))); sp.append(fx); }
        card.append(sp);
        if (e.drops.length) card.append(dexLine('떨어뜨리는 것', e.drops.join(' · ')));
        // vB.03 빼앗기 횟수
        const steals = CODEX.psychics.filter((x) => x.stolen && (x.src || []).includes(e.id));
        if (steals.length) {
          const n = p.killCount?.[e.id] || 0, owned = steals.filter((x) => (p.psychics || []).includes(x.id)).length;
          const goal = e.boss ? 20 * (owned + 1) : 30;
          card.append(dexLine('빼앗기', owned >= steals.length ? `다 빼앗았다 (${n}번 쓰러뜨림)` : `${n} / ${goal}번 쓰러뜨림${e.boss ? ` · 보스: 20번마다 하나씩 (${owned}/${steals.length})` : ''}`));
        }
        list.append(card);
      });
      body.append(list);
    });
  }

  // vC.06 업적 / 도감은 화면을 바꾸지 않고 소지품처럼 위에 뜬다(codexDialog).
  const codexDialog = $('#codexDialog');
  let codexTab = 'achievements';
  function openCodex(tab) {
    codexTab = tab || codexTab || 'achievements';
    if (!codexDialog.open) { try { codexDialog.showModal(); } catch (_) { codexDialog.setAttribute('open', ''); } }
    renderCodex(codexTab);
  }
  $('#codexClose').addEventListener('click', () => codexDialog.close());
  codexDialog.addEventListener('click', (e) => { if (e.target === codexDialog) codexDialog.close(); });
  function renderCodex(tab) {
    const TABS = ['achievements', 'titles', 'items', 'psychics', 'enemies'];
    const current = TABS.includes(tab) ? tab : 'achievements';
    codexTab = current;
    const panelBody = $('#codexBody'), panelTabs = $('#codexTabs');
    panelBody.replaceChildren(); panelBody.scrollTop = 0;
    addTo('pages', `codex/${current}`);
    const p = dexPlayer();
    setTabs(panelTabs, [
      { id: 'achievements', label: `업적 ${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length}` },
      { id: 'titles', label: `칭호 ${ownedTitles().length} / ${TITLES.length}` },
      { id: 'items', label: `아이템 ${CODEX.items.filter((i) => dexAll() || p.codex?.items?.[i.id]).length} / ${CODEX.items.length}` },
      { id: 'psychics', label: `영능력 ${CODEX.psychics.filter((x) => dexAll() || x.always || (p.psychics || []).includes(x.id)).length} / ${CODEX.psychics.length}` },
      { id: 'enemies', label: `적 ${CODEX.enemies.filter((e) => dexAll() || (p.seen?.[e.id] || 0) > 0).length}` },
    ], current, (id) => renderCodex(id));
    if (Auth.isAdmin() && ['items', 'psychics', 'enemies'].includes(current)) {
      const bar = h('div', 'dex-admin'); bar.append(btn('ghost-btn codex-use', dexAll() ? '관리자: 내 기록대로 보기' : '관리자: 모두 보기', () => { save.adminDexAll = !dexAll(); persist(); renderCodex(current); }));
      panelBody.append(bar);
    }
    if (current === 'items') { renderDexItems(panelBody); return; }
    if (current === 'psychics') { renderDexPsychics(panelBody); return; }
    if (current === 'enemies') { renderDexEnemies(panelBody); return; }
    const row = (got, name, text, side) => { const r = h('div', `codex-row${got ? ' is-got' : ''}`); const t = h('div', 'codex-text'); t.append(h('strong', '', name), h('p', '', text)); r.append(h('span', 'codex-mark', got ? '◆' : '◇'), t, side); return r; };
    if (current === 'achievements') {
      ACH_GROUPS.forEach((group) => {
        const list = ACHIEVEMENTS.filter((a) => a.group === group.id).sort(byName);
        panelBody.append(h('p', 'panel-label codex-group', `${group.name} · ${list.filter((a) => save.achievements[a.id]).length} / ${list.length}`));
        const listEl = h('div', 'codex-list');
        list.forEach((a) => {
          const got = save.achievements[a.id], prog = !got && progressOf(a.when);
          const side = h('div', 'codex-side');
          side.append(h('span', 'codex-state', got ? '달성' : prog ? `${prog[0].toLocaleString()} / ${prog[1].toLocaleString()}` : '미달성'));
          if (titleById[a.title]) side.append(h('small', '', `칭호 [${titleById[a.title].name}]`));
          if (a.extra) side.append(h('small', '', `+ ${a.extra}`));
          listEl.append(row(got, a.name, got ? a.desc : a.hint, side));
        });
        panelBody.append(listEl);
      });
    } else {
      const p = profile(); const listEl = h('div', 'codex-list');
      [...TITLES].sort(byName).forEach((t) => {
        const got = ownsTitle(t.id), source = ACHIEVEMENTS.find((a) => a.title === t.id);
        const side = h('div', 'codex-side');
        if (got && p) side.append(p.title === t.id ? h('span', 'codex-state', '사용 중') : btn('ghost-btn codex-use', '달기', () => { p.title = t.id; persist(); renderStatus(); renderCodex(current); }));
        else side.append(h('span', 'codex-state', got ? '보유' : '미획득'));
        const r = row(got, got ? t.name : '???', got ? t.desc : source ? `업적 [${source.name}] — ${source.hint}` : t.from === 'story' ? '본편 이야기에서 얻는다.' : '아직 얻을 방법이 알려지지 않았다.', side);
        if (t.perkText) r.querySelector('.codex-text').append(h('p', 'perk-line', `기능 — ${t.perkText}`));
        listEl.append(r);
      });
      panelBody.append(listEl);
    }
  }

  /* ───────── 주소 → 페이지 ───────── */
  function route() {
    updateBack();
    const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
    const [head, ...rest] = parts;
    if (!head) showHome();
    else if (head === 'zone') renderZone(rest[0], rest[1], rest[2], rest.slice(3));
    else if (head === 'go' && rest.length) renderGo(rest.join('/'));
    else if (head === 'profile') renderProfile(rest[0] === 'edit');
    else if (head === 'codex') { location.replace('#/'); openCodex(rest[0]); } // vC.06: 예전 주소로 와도 첫 화면 위에 띄운다
    else if (head === 'notes') renderNotes();
    else if (head === 'case') renderCase(rest[0]);
    else if (head === 'money') renderMoney();
    else if (head === 'admin' && Auth.isAdmin()) renderAdmin(rest[0]);
    else if (head === 'out' && window.BiryeongQuest) window.BiryeongQuest.renderPlace(rest[0], rest[1]); // 산문 너머의 바깥 지역 · 새 층
    else { location.replace('#/'); return; }
    window.dispatchEvent(new CustomEvent('biryeong:route', { detail: { hash: location.hash, parts } }));
    if (head) { const top = pageView.getBoundingClientRect().top; if (top < 70 || top > window.innerHeight * 0.45) window.scrollTo({ top: window.scrollY + top - 84, behavior: 'smooth' }); }
  }
  // vB.01: 시간이 드는 행동 중에 다른 페이지로 나가려 하면 한 번 더 묻는다(나가면 그 행동은 멈추고 보상은 없다).
  let lastHash = location.hash, skipHash = false;
  function leaveAsk(onYes) {
    const wrap = h('div', 'leave-ask'); const box = h('div', 'leave-ask-box'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    box.append(h('p', 'leave-ask-text', '정말 나가겠습니까? 지금 나가면 보상을 얻을 수 없습니다.'));
    const row = h('div', 'leave-ask-row');
    const close = () => wrap.remove();
    row.append(btn('solid-btn', '예', () => { close(); onYes(); }), btn('ghost-btn', '아니오', close));
    box.append(row); wrap.append(box); document.body.append(wrap); row.lastChild.focus();
  }
  window.addEventListener('hashchange', () => {
    if (skipHash) { skipHash = false; lastHash = location.hash; return; }
    const busy = playApi()?.busy?.();
    if (busy && location.hash !== lastHash) {
      const target = location.hash;
      skipHash = true; location.replace(lastHash || '#/'); // 일단 제자리로
      leaveAsk(() => { playApi()?.interrupt?.('자리를 떠나'); location.hash = target; });
      return;
    }
    lastHash = location.hash; route();
  });

  /* ─────────   /* ───────── 메인 배너 (다섯 쪽) ───────── */
  const hero = $('#hero'), heroTrack = $('#heroTrack'), heroDots = [...$('#heroDots').children];
  const PAGES = heroDots.length;
  let heroPage = 0;
  function goHero(page) {
    heroPage = ((page % PAGES) + PAGES) % PAGES;
    hero.dataset.page = String(heroPage);
    heroTrack.style.transform = `translateX(${-heroPage * 100 / PAGES}%)`;
    heroDots.forEach((d, i) => { d.setAttribute('aria-selected', String(i === heroPage)); d.tabIndex = i === heroPage ? 0 : -1; });
    [...heroTrack.children].forEach((s, i) => s.toggleAttribute('inert', i !== heroPage));
    addTo('banner', String(heroPage));
  }
  heroDots.forEach((d, i) => d.addEventListener('click', () => goHero(i)));
  $('#heroPrev').addEventListener('click', () => goHero(heroPage - 1));
  $('#heroNext').addEventListener('click', () => goHero(heroPage + 1));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (document.querySelector('dialog[open], .play-scope [role=dialog]') || !fontMenu.hidden || !pageView.hidden) return; // 배너는 처음 화면에서만 방향키로 넘긴다
    const t = event.target;
    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    goHero(heroPage + (event.key === 'ArrowRight' ? 1 : -1));
  });
  let swipe = null;
  hero.addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; swipe = { x: event.clientX, y: event.clientY }; });
  hero.addEventListener('pointerup', (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y; swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { goHero(heroPage + (dx < 0 ? 1 : -1)); swiped = Date.now(); }
  });
  // vC.01 배너를 누르면: 적 = 비령 통합안내사항, 황 = 비령 카페(새 창). 그 밖의 쪽(청 · 백 · 흑)은 어디에 있든 맨 첫 화면으로 돌아간다.
  let swiped = 0;
  const HERO_LINKS = { red: 'https://docs.google.com/document/d/1K2-S1SxB3rrrBRc1oMBVMZRg9Nbv8XIJ5Lbwo2yoii4/edit?tab=t.0', yellow: 'https://cafe.naver.com/occultblue' };
  hero.addEventListener('click', (event) => {
    if (event.target.closest('button, a, .hero-bottom') || Date.now() - swiped < 400) return;
    const colour = heroTrack.children[heroPage]?.dataset.colour, url = HERO_LINKS[colour];
    if (url) { window.open(url, '_blank', 'noopener'); return; }
    goHero(0);
    if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/'; // 시간을 들이는 행동 중이면 나가기 확인창이 먼저 뜬다
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  hero.addEventListener('pointercancel', () => { swipe = null; });

  /* ───────── 연결 ───────── */
  document.querySelectorAll('[data-zone]').forEach((card) => card.addEventListener('click', () => go(`#/zone/${card.dataset.zone}`)));
  // vC.06 머리띠의 [사건 기록]은 [접속자 확인하기](party.js)로 바뀌었다. 사건 기록은 첫 화면 [주요 이야기]에서 연다.
  window.addEventListener('error', (ev) => { if (/party\.js/.test(ev.filename || '')) window.BiryeongPartyError = `접속자 창(party.js)을 여는 중에 오류가 났다: ${ev.message}`; });
  // vC.07.1 단추는 여기서 직접 잇는다. party.js 를 못 불러왔으면(올리지 않았거나 옛 파일이 남아 있으면) 그 사실을 알린다.
  $('#onlineBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      if (window.BiryeongParty?.openOnline) { window.BiryeongParty.openOnline(); return; }
      toast('접속자 확인하기', window.BiryeongPartyError || '접속자 창(party.js)을 불러오지 못했다. 저장소에 party.js 가 올라갔는지 확인하고, 새로고침(Ctrl+Shift+R · 휴대폰은 탭을 닫았다 다시 열기)해 주세요.');
    } catch (err) { toast('접속자 확인하기', `창을 여는 중에 문제가 생겼다: ${err.message}`); }
  });
  // 공개된 장(권)은 서버에서 늦게 오므로 한 번 더 그리고, 공지 새 글 표시도 확인한다
  setTimeout(drawVolumes, 1500); setTimeout(drawVolumes, 4000); setTimeout(() => drawBoard().catch(() => {}), 2500);
  $('#journalBtn').addEventListener('click', () => go('#/profile'));
  $('#statusWho').addEventListener('click', () => go('#/profile'));
  $('#accountName').textContent = Auth.session();
  $('#accountBtn').addEventListener('click', () => { if (window.confirm('로그아웃할까요? 기록은 이 브라우저에 그대로 남습니다.')) { try { playApi()?.save(); } catch (_) { /* 무시 */ } Auth.logout(); } });
  if (Auth.isAdmin()) { const slot = $('[data-admin-slot]'); const b = btn('', '', () => go('#/admin')); b.dataset.menu = 'admin'; b.append(h('i', '', '管'), h('span', '', '관리자')); slot.replaceWith(b); }
  const MENU = {
    inventory: () => { const api = playApi(); if (api) api.openInventory(); else go('#/profile'); },
    quest: () => go('#/zone/north'), codex: () => openCodex(), money: () => go('#/money'), notes: () => go('#/notes'),
  };
  document.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => MENU[b.dataset.menu]?.()));
  document.querySelectorAll('[data-community]').forEach((b) => b.addEventListener('click', () => addTo('community', b.dataset.community)));
  document.querySelectorAll('[data-community-tab]').forEach((b) => b.addEventListener('click', () => addTo('community', b.dataset.communityTab)));
  const lanternBtn = $('#lanternBtn');
  lanternBtn.addEventListener('click', () => {
    const on = !document.body.classList.contains('lantern-lit');
    document.body.classList.toggle('lantern-lit', on);
    lanternBtn.textContent = on ? '☾ 등불 끄기' : '☼ 등불 켜기';
    lanternBtn.setAttribute('aria-pressed', String(on));
  });

  // 실행 화면 부품과의 연결
  window.addEventListener('biryeong:saved', refreshFromPlay);
  setInterval(() => { if (!document.hidden) renderStatus(); }, 30000); // vC.06 [현재 상태]의 남은 시간
  window.addEventListener('biryeong:toast', (event) => toast(event.detail.head, event.detail.text));
  window.addEventListener('biryeong:nav', (event) => {
    if (event.detail.back) { back(); return; }
    const [first, loc, act] = String(event.detail.path).split('/');
    if (first === 'at') { go(placeHash(loc, act)); return; } // 장소에서 장소로(본관 탐사 → 양호실 …)
    go(`#/go/${event.detail.path}`);
  });
  window.addEventListener('storage', (event) => { if (event.key === SAVE_KEY) refreshFromPlay(); });
  function mountPlay() { const P = Play(); if (!P) return; P.mount($('#playRoot')); route(); }
  if (Play()) mountPlay(); else window.addEventListener('biryeong:play-ready', mountPlay, { once: true });

  /* 본편 퀘스트(quest.js)가 쓰는 창구 */
  window.BiryeongApp = {
    h, btn, para, go, back, route, openPage, setTabs, toast, mark, addTo, persist, playApi, zoneHash, placeHash, renderStatus, emptyBox, needProfile,
    get save() { return save; }, get body() { return panelBody; }, get tabs() { return panelTabs; }, get chips() { return panelChips; },
    profile, game, isAdmin: () => Auth.isAdmin(), zones: DATA.zones, heirloomNames: Object.fromEntries(Object.entries(HEIRLOOM).map(([k, v]) => [k, v.name])),
    grantTitle(id) { if (!titleById[id] || save.titles[id]) return false; save.titles[id] = Date.now(); persist(); toast('칭호', `「${titleById[id].name}」을(를) 얻었다.`); checkAchievements(); return true; },
  };

  let storedFont = DEFAULT_FONT;
  try { storedFont = localStorage.getItem(FONT_STORAGE_KEY) || DEFAULT_FONT; } catch (_) { /* 기본 글꼴 */ }
  setFont(storedFont, false);
  goHero(0);
  renderStatus();
  addTo('days', dayKey(new Date()));
  route();
  checkAchievements();
})();
