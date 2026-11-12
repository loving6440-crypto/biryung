/* 비령 — 화면 로직. 서버 없이 동작한다(내 프로필 · 진행 기록은 이 브라우저에 보관).
 *
 * 페이지는 주소(#/…)로 바뀐다. 머리글 · 배너 · 오른쪽 '나의 상태'는 어느 페이지에서나 그대로 있고, 가운데만 바뀐다.
 *   #/                      사방 지도(처음 화면)
 *   #/zone/<구역>/<탭>/<칸>/<탐사 경로…>    구역 (north 산문 = 스토리 퀘스트 · east 강학당 · west 생활관 · south 금역)
 *   #/go/<실행 주소>          전투 · 개척 · 수업 등을 바로 (예: #/go/battle/scarecrow, #/go/lesson/ward-tetris)
 *   #/profile · #/profile/edit · #/codex · #/codex/titles · #/notes · #/case · #/money
 * 데이터: game-data.js(구역, 보관고에서 생성) · titles.js(칭호 · 업적) · story.js(스토리 퀘스트) · play/play.js(실행 화면 부품)
 */
(() => {
  'use strict';

  const DATA = window.BIRYEONG_DATA || { rules: {}, zones: {} };
  const TITLES = window.BIRYEONG_TITLES || [];
  const ACHIEVEMENTS = window.BIRYEONG_ACHIEVEMENTS || [];
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
  const SAVE_KEY = 'biryeong-save-v1';
  const PLAY_KEYS = ['game', 'counts', 'playLog'];
  const blankStats = () => Object.fromEntries(R.statKeys.map((k) => [k, R.statMin]));
  const blankSave = () => ({ profile: null, flags: {}, sets: {}, achievements: {}, titles: {}, story: { done: {}, heirloom: null }, lantern: false });
  const readStored = () => { try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return raw && typeof raw === 'object' ? raw : {}; } catch (_) { return {}; } };
  let save = Object.assign(blankSave(), readStored());
  save.story = Object.assign({ done: {}, heirloom: null }, save.story);
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
  const valueOf = (w) => (w.set ? Object.keys(save.sets[w.set] || {}).length : w.pset ? Object.keys(counts().sets?.[w.pset] || {}).length : w.count ? Math.floor(counts()[w.count] || 0) : w.streak ? streakNow() : 0);
  const targetOf = (w) => w.n ?? w.streak ?? 1;
  const met = (w) => (w.all ? w.all.every(met) : w.flag ? !!save.flags[w.flag] : valueOf(w) >= targetOf(w));
  /** 진행도 [지금, 목표] — 여러 조건이면 채운 조건 수 */
  const progressOf = (w) => (w.all ? [w.all.filter(met).length, w.all.length] : w.flag ? null : [Math.min(valueOf(w), targetOf(w)), targetOf(w)]);
  function checkAchievements() {
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (save.achievements[a.id] || !met(a.when)) continue;
      save.achievements[a.id] = Date.now(); changed = true;
      if (a.title && titleById[a.title]) save.titles[a.title] = Date.now();
      toast('업적 달성', `${a.name}${a.title && titleById[a.title] ? ` — 칭호 [${titleById[a.title].name}] 획득` : ''}`);
    }
    if (changed) { persist(); renderStatus(); }
  }
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
  const back = () => { if (steps > 0) { steps -= 1; history.back(); } else location.hash = '#/'; };
  function openPage(eyebrow, title, kind) {
    $('#panelEyebrow').textContent = eyebrow; $('#panelTitle').textContent = title;
    pageView.dataset.kind = kind || '';
    panelTabs.hidden = true; panelTabs.replaceChildren(); panelChips.hidden = true; panelChips.replaceChildren(); panelBody.replaceChildren();
    homeView.hidden = true; pageView.hidden = false;
    showPlay(null);
  }
  function showHome() { pageView.hidden = true; homeView.hidden = false; showPlay(null); }
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
    if (zone.story) { renderStory(); return; }
    if (!zone.tabs.length) { panelBody.append(emptyBox(ZONE_META[key].hanja, '아직 비어 있는 곳.', '금줄 너머로 바람 소리만 들린다.')); return; }
    const tab = zone.tabs.find((t) => t.id === tabId) ?? zone.tabs[0];
    const section = tab.sections.find((s) => s.id === sectionId) ?? tab.sections[0];
    addTo('pages', `${key}/${tab.id}/${section.id}`);
    if (zone.tabs.length > 1) setTabs(panelTabs, zone.tabs.map((t) => ({ id: t.id, label: `${t.hanja} ${t.name}` })), tab.id, (id) => go(zoneHash(key, id)));
    setTabs(panelChips, tab.sections.map((s) => ({ id: s.id, label: s.title })), section.id, (id) => go(zoneHash(key, tab.id, id)));
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
    pre.append(h('summary', '', '2046 · 비령'), ...STORY.premise.map((t) => para(t)));
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
  function renderCase() {
    openPage('檔案 001 / 2046 · 무속인 전원 실종 사건', '그날 사라진 사람들', 'simple');
    STORY.premise.forEach((t) => panelBody.append(para(t)));
    ['무당들이 사라진 이후 전국에서는 기이한 현상이 발생하기 시작한다. 사당의 신들이 모습을 드러내고, 오래전에 죽은 사람들이 살아 돌아오며, 인간의 기억 속에만 존재하던 괴담이 현실이 된다.',
      '실종된 무당들의 자녀에게는 공통점이 있었다. 모두 실종 직전 부모에게 정체불명의 물건을 하나씩 받았다는 것. 방울, 부채, 거울, 칼, 오색천.',
      '이 물건들은 단순한 유품이 아니었다. 무당들이 사라지기 전, 자신들이 모시던 신과의 마지막 약속을 담아 놓은 매개체였다.',
      '무당들의 후손들은 한 자리에 모이게 된다. 비령을 통한 정부의 제어, 그 기반을 다지기 위한 일환으로.'].forEach((t) => panelBody.append(para(t)));
    panelBody.append(h('p', 'panel-fine', '보관 문서 001 · 비령'), btn('solid-btn', '산문으로 — 스토리 퀘스트', () => go('#/zone/north')));
    mark('caseRead');
  }
  function renderMoney() {
    const p = profile();
    openPage('錢 / 소지금', `${Math.floor(game()?.money ?? p?.money ?? 0)}냥`, 'simple');
    addTo('pages', 'money');
    panelBody.append(para(p ? '주머니 속 엽전을 세어 보았다. 퇴마 실습에서 이기거나 매점에 물건을 팔면 늘어나고, 매점에서 사면 줄어든다.' : '프로필을 만들면 주머니가 생긴다.'));
    const acts = h('div', 'profile-actions'); acts.append(btn('ghost-btn', '매점으로', () => go('#/zone/west/dorm/store')), btn('ghost-btn', '퇴마 실습으로', () => go('#/zone/south/gym/practice')));
    panelBody.append(acts);
    const log = (save.playLog || []).slice(-25).reverse();
    if (log.length) { panelBody.append(h('p', 'panel-label', '최근 기록')); const ul = h('ul', 'log-list'); log.forEach((l) => { const li = h('li'); li.append(h('span', '', `[${l.time}] `), l.message); ul.append(li); }); panelBody.append(ul); }
  }
  const UPDATE_NOTES = [
    { v: 'v0.9', date: '2026-11-12', lines: ['창이 뜨던 화면을 모두 페이지로 바꿈. 어느 페이지든 머리글 · 배너 · 나의 상태는 그대로, [뒤로가기] 로 돌아온다.', '전투 · 개척 · 제작 · 수업 · 매점 등이 구역 페이지 안에서 바로 열린다. 화면 색을 비령에 맞춤.', '나의 상태에서 육조 스탯을 바로 올릴 수 있다.', '아이템 312종 · 상대 57종 · 영능력 13종의 이름과 설명을 2046년 비령 세계관으로 고치고, 아이템에 도트 아이콘을 붙임.', '업적 60개 · 칭호 64개로 다시 짬(둘러보기 · 하루 · 며칠 · 꾸준히 · 한 달 · 극).', '산문에 스토리 퀘스트 제1장 「사라진 자들의 아이들」.'] },
    { v: 'v0.8', date: '2026-11-12', lines: ['전투 · 개척 · 제작 · 수업 미니게임을 실행할 수 있게 연결.'] },
    { v: 'v0.7', date: '2026-11-12', lines: ['내 프로필, 나의 상태, 구역 데이터, 배너 다섯 쪽, 칭호와 업적.'] },
    { v: 'v0.6', date: '2026-11-12', lines: ['초록동색 C.01 콘텐츠 보관고(NPC · 퀘스트 제외), GitHub Pages 대응.'] },
  ];
  function renderNotes() {
    openPage('報 / UPDATE NOTES', '업데이트 노트', 'simple');
    addTo('pages', 'notes');
    UPDATE_NOTES.forEach((n) => {
      const box = h('div', 'note-box'); const head = h('p', 'panel-label'); head.append(h('b', '', n.v), n.date ? ` · ${n.date}` : '');
      const ul = h('ul'); n.lines.forEach((l) => ul.append(h('li', '', l)));
      box.append(head, ul); panelBody.append(box);
    });
  }

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
    ownedTitles().forEach((t) => sel.append(new Option(t.name, t.id, false, p.title === t.id)));
    sel.addEventListener('change', () => { p.title = sel.value || null; persist(); renderStatus(); route(); });
    const lab = h('label', '', `칭호 고르기 (가진 칭호 ${ownedTitles().length} / ${TITLES.length})`); lab.htmlFor = sel.id;
    pick.append(lab, sel);
    if (p.title && titleById[p.title]) pick.append(h('small', '', titleById[p.title].desc));
    panelBody.append(pick);
    const foot = h('div', 'profile-actions');
    foot.append(btn('ghost-btn', '프로필 고치기', () => openProfile(true)), btn('ghost-btn', '업적 / 도감', () => go('#/codex/titles')));
    panelBody.append(foot, h('p', 'panel-fine', '프로필과 진행 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.'));
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
      renderStatus(); location.replace('#/profile');
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
    const stats = statsNow();
    $('#statusStats').replaceChildren(...R.statKeys.map((k) => {
      const now = Math.floor(stats[k] ?? 1), cost = now * 10, can = !!p && spirit >= cost && now < R.statMax;
      const c = h('div', 'status-stat'); c.title = R.stats[k].detail;
      const up = btn('status-stat-up', '+', () => raiseStat(k));
      up.disabled = !can; up.title = !p ? '프로필을 먼저 만든다' : now >= R.statMax ? '더 올릴 수 없다' : `영력 ${cost} 로 ${R.stats[k].label} +1`;
      up.setAttribute('aria-label', `${R.stats[k].label} 올리기 (영력 ${cost})`);
      c.append(h('span', '', R.stats[k].label), h('b', '', String(now)), up, h('small', '', `영력 ${cost}`));
      return c;
    }));
    $('#statusMoney').textContent = `${Math.floor(g?.money ?? p?.money ?? 0)}냥`;
    const si = storyIndex();
    $('#statusQuest').textContent = si < 0 ? '완료' : `${si} / ${STORY.steps.length}`;
  }
  /** 실행 화면이 바꾼 값(game · counts · playLog)을 다시 읽는다. */
  function refreshFromPlay() { pullPlay(); renderStatus(); checkAchievements(); if (/^#\/zone\/north/.test(location.hash)) refreshStoryGoal(); }
  function refreshStoryGoal() { const i = storyIndex(); if (i < 0) return; const ok = met(STORY.steps[i].goal.when); const b = $('.story-step.is-now .solid-btn'); if (b && b.disabled === ok) route(); }

  /* ───────── 업적 / 도감 ───────── */
  function renderCodex(tab) {
    const current = tab === 'titles' ? 'titles' : 'achievements';
    openPage('圖鑑 / CODEX', '업적 / 도감', 'codex');
    addTo('pages', `codex/${current}`);
    setTabs(panelTabs, [{ id: 'achievements', label: `업적 ${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length}` }, { id: 'titles', label: `칭호 ${ownedTitles().length} / ${TITLES.length}` }], current, (id) => go(id === 'titles' ? '#/codex/titles' : '#/codex'));
    const row = (got, name, text, side) => { const r = h('div', `codex-row${got ? ' is-got' : ''}`); const t = h('div', 'codex-text'); t.append(h('strong', '', name), h('p', '', text)); r.append(h('span', 'codex-mark', got ? '◆' : '◇'), t, side); return r; };
    if (current === 'achievements') {
      ACH_GROUPS.forEach((group) => {
        const list = ACHIEVEMENTS.filter((a) => a.group === group.id);
        panelBody.append(h('p', 'panel-label codex-group', `${group.name} · ${list.filter((a) => save.achievements[a.id]).length} / ${list.length}`));
        const listEl = h('div', 'codex-list');
        list.forEach((a) => {
          const got = save.achievements[a.id], prog = !got && progressOf(a.when);
          const side = h('div', 'codex-side');
          side.append(h('span', 'codex-state', got ? '달성' : prog ? `${prog[0].toLocaleString()} / ${prog[1].toLocaleString()}` : '미달성'));
          if (titleById[a.title]) side.append(h('small', '', `칭호 [${titleById[a.title].name}]`));
          listEl.append(row(got, a.name, got ? a.desc : a.hint, side));
        });
        panelBody.append(listEl);
      });
    } else {
      const p = profile(); const listEl = h('div', 'codex-list');
      TITLES.forEach((t) => {
        const got = ownsTitle(t.id), source = ACHIEVEMENTS.find((a) => a.title === t.id);
        const side = h('div', 'codex-side');
        if (got && p) side.append(p.title === t.id ? h('span', 'codex-state', '사용 중') : btn('ghost-btn codex-use', '달기', () => { p.title = t.id; persist(); renderStatus(); route(); }));
        else side.append(h('span', 'codex-state', got ? '보유' : '미획득'));
        listEl.append(row(got, got ? t.name : '???', got ? t.desc : source ? `업적 [${source.name}] — ${source.hint}` : '아직 얻을 방법이 알려지지 않았다.', side));
      });
      panelBody.append(listEl);
    }
  }

  /* ───────── 주소 → 페이지 ───────── */
  function route() {
    const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
    const [head, ...rest] = parts;
    if (!head) showHome();
    else if (head === 'zone') renderZone(rest[0], rest[1], rest[2], rest.slice(3));
    else if (head === 'go' && rest.length) renderGo(rest.join('/'));
    else if (head === 'profile') renderProfile(rest[0] === 'edit');
    else if (head === 'codex') renderCodex(rest[0]);
    else if (head === 'notes') renderNotes();
    else if (head === 'case') renderCase();
    else if (head === 'money') renderMoney();
    else { location.replace('#/'); return; }
    if (head) { const top = pageView.getBoundingClientRect().top; if (top < 70 || top > window.innerHeight * 0.45) window.scrollTo({ top: window.scrollY + top - 84, behavior: 'smooth' }); }
  }
  window.addEventListener('hashchange', route);

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
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) goHero(heroPage + (dx < 0 ? 1 : -1));
  });
  hero.addEventListener('pointercancel', () => { swipe = null; });

  /* ───────── 연결 ───────── */
  document.querySelectorAll('[data-zone]').forEach((card) => card.addEventListener('click', () => go(`#/zone/${card.dataset.zone}`)));
  $('#storyBtn').addEventListener('click', () => go('#/case'));
  $('#readCase').addEventListener('click', () => go('#/case'));
  $('#journalBtn').addEventListener('click', () => go('#/profile'));
  $('#statusWho').addEventListener('click', () => go('#/profile'));
  const MENU = {
    inventory: () => { const api = playApi(); if (api) api.openInventory(); else go('#/profile'); },
    quest: () => go('#/zone/north'), codex: () => go('#/codex'), money: () => go('#/money'), notes: () => go('#/notes'),
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
  window.addEventListener('biryeong:toast', (event) => toast(event.detail.head, event.detail.text));
  window.addEventListener('biryeong:nav', (event) => { if (event.detail.back) back(); else go(`#/go/${event.detail.path}`); });
  window.addEventListener('storage', (event) => { if (event.key === SAVE_KEY) refreshFromPlay(); });
  function mountPlay() { const P = Play(); if (!P) return; P.mount($('#playRoot')); route(); }
  if (Play()) mountPlay(); else window.addEventListener('biryeong:play-ready', mountPlay, { once: true });

  let storedFont = DEFAULT_FONT;
  try { storedFont = localStorage.getItem(FONT_STORAGE_KEY) || DEFAULT_FONT; } catch (_) { /* 기본 글꼴 */ }
  setFont(storedFont, false);
  goHero(0);
  renderStatus();
  addTo('days', dayKey(new Date()));
  route();
  checkAchievements();
})();
