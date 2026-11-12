/* 비령 — 화면 로직. 서버 없이 동작한다(내 프로필 · 진행 기록은 이 브라우저에 보관).
 * 구역 데이터는 game-data.js(보관고에서 생성), 칭호 · 업적은 titles.js 에 있다. */
(() => {
  'use strict';

  const DATA = window.BIRYEONG_DATA || { rules: {}, zones: {} };
  const TITLES = window.BIRYEONG_TITLES || [];
  const ACHIEVEMENTS = window.BIRYEONG_ACHIEVEMENTS || [];
  const R = Object.assign({ statKeys: [], stats: {}, statMin: 1, startPoints: 10, hpMax: 100, mpMax: 100, spiritStart: 100, spiritMax: 500, startMoney: 0, nameMax: 12, introMax: 30 }, DATA.rules);
  const $ = (selector, root = document) => root.querySelector(selector);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (cls, text, onClick) => { const b = h('button', cls, text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; };

  /* ───────── 글꼴 (갈무리 · KoPub 돋움 · KoPub 바탕) ───────── */
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
    if (byUser) mark('fontChanged');
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

  /* ───────── 저장: 내 프로필 + 진행 기록 ───────── */
  const SAVE_KEY = 'biryeong-save-v1';
  const blankStats = () => Object.fromEntries(R.statKeys.map((k) => [k, R.statMin]));
  const blankSave = () => ({ profile: null, flags: {}, sets: {}, counts: {}, achievements: {}, titles: {}, lantern: false });
  let save = blankSave();
  try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (raw && typeof raw === 'object') save = Object.assign(blankSave(), raw); } catch (_) { /* 저장 없이 동작 */ }
  let saveWarned = false;
  // 실행 화면(play/)이 같은 저장 칸에 game · counts · playLog 를 적는다. 메인 화면은 그 칸을 덮어쓰지 않는다.
  const PLAY_KEYS = ['game', 'counts', 'playLog'];
  const readStored = () => { try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return raw && typeof raw === 'object' ? raw : {}; } catch (_) { return {}; } };
  function persist() {
    const latest = readStored();
    for (const k of PLAY_KEYS) { if (k in latest) save[k] = latest[k]; else delete save[k]; }
    save.counts = save.counts || {};
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
    catch (_) { if (!saveWarned) { saveWarned = true; toast('저장 실패', '이 브라우저에 기록을 저장할 수 없습니다. 사진이 너무 크거나 저장 공간이 막혀 있을 수 있습니다.'); } }
  }
  const profile = () => save.profile;
  const game = () => (save.profile && save.game ? save.game : null); // 실행 화면에서 플레이한 뒤의 상태
  const statsNow = () => game()?.stats ?? (save.profile ? save.profile.stats : blankStats());
  /** 실행 화면이 바꾼 값(game · counts · playLog)을 다시 읽는다. */
  function refreshFromPlay() {
    const latest = readStored();
    for (const k of PLAY_KEYS) { if (k in latest) save[k] = latest[k]; else delete save[k]; }
    save.counts = save.counts || {};
    renderStatus();
    checkAchievements();
  }
  const titleById = Object.fromEntries(TITLES.map((t) => [t.id, t]));
  const ownsTitle = (id) => titleById[id]?.from === 'start' || !!save.titles[id];
  const ownedTitles = () => TITLES.filter((t) => ownsTitle(t.id));

  /* ───────── 업적 ───────── */
  const toastStack = $('#toastStack');
  function toast(head, text) {
    const el = h('div', 'toast'); el.append(h('strong', '', head), h('span', '', text));
    toastStack.appendChild(el);
    // 열려 있는 창(dialog) 위에 보이도록 맨 위 층으로 다시 올린다.
    try { if (toastStack.matches(':popover-open')) toastStack.hidePopover(); toastStack.showPopover(); } catch (_) { /* popover 를 모르는 브라우저: 그대로 둔다 */ }
    setTimeout(() => el.classList.add('is-leaving'), 4200);
    setTimeout(() => { el.remove(); if (!toastStack.children.length) { try { toastStack.hidePopover(); } catch (_) { /* 무시 */ } } }, 4800);
  }
  const met = (w) => (w.flag ? !!save.flags[w.flag] : w.set ? Object.keys(save.sets[w.set] || {}).length >= w.n : w.count ? ((save.counts || {})[w.count] || 0) >= w.n : false);
  const progressOf = (w) => (w.set ? [Math.min(Object.keys(save.sets[w.set] || {}).length, w.n), w.n] : w.count ? [Math.min((save.counts || {})[w.count] || 0, w.n), w.n] : null);
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

  /* ───────── 작은 글 창(사건 기록 등) ───────── */
  const dialog = $('#storyDialog');
  function openStory(eyebrow, title, texts, footnote) {
    $('#dialogEyebrow').textContent = eyebrow;
    $('#dialogTitle').textContent = title;
    $('#dialogFootnote').textContent = footnote || '비령 · 비공개 기록';
    const parent = $('#dialogContent');
    parent.replaceChildren(...texts.map((t) => h('p', '', t)));
    if (!dialog.open) dialog.showModal();
  }
  function showCase() {
    openStory('檔案 001 / 비령산 집단 실종 사건', '그날 사라진 사람들', [
      '그날의 실종은 어느 한 마을에서 시작되지 않았다. 전국 각지에서 무당들이 같은 순간 흔적도 없이 사라졌다. 누구도 그들이 어디로 갔는지 설명하지 못했다.',
      '얼마 뒤, 강원도 비령산에서 실종된 무당들의 주검이 대거 발견되었다. 사건의 경위는 여전히 밝혀지지 않았다.',
      '남은 것은 그들의 아이들이다. 친부모가 무당이었다는 사실을 모른 채 자란 이도, 일찍 가족을 잃은 이도 있다. 그 후손들을 비령산에 모아 임시 학교를 세웠다.',
      '누군가는 이곳을 피난처라고 부른다. 누군가는 진실을 묻기 위해 만든 장소라고 말한다.'
    ], '보관 문서 001 · 비령');
    mark('caseRead');
  }

  /* ───────── 큰 창(구역 · 프로필 · 도감 …) ───────── */
  const panel = $('#panelDialog'), panelBody = $('#panelBody'), panelTabs = $('#panelTabs'), panelChips = $('#panelChips');
  function openPanel(eyebrow, title, kind) {
    $('#panelEyebrow').textContent = eyebrow; $('#panelTitle').textContent = title;
    panel.dataset.kind = kind || '';
    panelTabs.hidden = true; panelTabs.replaceChildren(); panelChips.hidden = true; panelChips.replaceChildren(); panelBody.replaceChildren();
    if (!panel.open) panel.showModal();
    panelBody.scrollTop = 0;
  }
  function setTabs(nav, list, current, onPick) {
    nav.hidden = list.length < 1;
    nav.replaceChildren(...list.map((t) => { const b = btn(t.id === current ? 'is-on' : '', t.label, () => onPick(t.id)); b.setAttribute('aria-pressed', String(t.id === current)); return b; }));
  }
  $('#panelClose').addEventListener('click', () => panel.close());
  panel.addEventListener('click', (event) => { if (event.target === panel) panel.close(); });

  /* ───────── 실행 화면 (play/index.html#주소) ─────────
   * 전투 · 개척 · 제작 · 수업 · 매점 … 은 초록동색 화면을 묶은 실행 화면에서 돈다(systems/play).
   * 메인 화면에서는 그 화면을 창 안에 띄운다. 주소만 알면 새 탭(play/index.html#battle/scarecrow 등)으로도 바로 열린다. */
  const playDialog = $('#playDialog'), playFrame = $('#playFrame');
  const playUrl = (to) => `play/index.html#${to}`;
  function openPlay(to) {
    if (!profile()) { toast('내 프로필 먼저', '실행 화면은 내 프로필(이름 · 육조 스탯)로 플레이한다.'); openProfile(false); return; }
    if (panel.open) panel.close();
    $('#playOpenTab').href = playUrl(to);
    playFrame.src = playUrl(to);
    if (!playDialog.open) playDialog.showModal();
    playFrame.focus();
  }
  function closePlay() { if (playDialog.open) playDialog.close(); }
  playDialog.addEventListener('close', () => { playFrame.src = 'about:blank'; refreshFromPlay(); });
  $('#playClose').addEventListener('click', closePlay);
  window.addEventListener('message', (event) => { if (event.source === playFrame.contentWindow && event.data?.type === 'biryeong-play-close') closePlay(); });
  window.addEventListener('storage', (event) => { if (event.key === SAVE_KEY) refreshFromPlay(); });
  window.addEventListener('focus', refreshFromPlay);
  const playButton = (play, cls = 'play-btn') => { const b = btn(cls, `▶ ${play.label}`, () => openPlay(play.to)); b.dataset.play = play.to; return b; };

  /* ───────── 구역 ───────── */
  const ZONE_META = {
    north: { hanja: '北', eyebrow: '01 北 / GATE OF THE MOUNTAIN' },
    east: { hanja: '東', eyebrow: '02 東 / HALL OF TALISMANS' },
    west: { hanja: '西', eyebrow: '03 西 / HOUSE OF THE LEFT BEHIND' },
    south: { hanja: '南', eyebrow: '04 南 / THE FORBIDDEN PEAK' },
  };
  const zoneView = { zone: null, tab: null, section: null, path: [] };
  function enterZone(key) {
    const zone = DATA.zones[key];
    if (!zone) return;
    zoneView.zone = key; zoneView.tab = zone.tabs[0]?.id ?? null; zoneView.section = zone.tabs[0]?.sections[0]?.id ?? null; zoneView.path = [];
    openPanel(ZONE_META[key].eyebrow, zone.title, 'zone');
    mark(`zone:${key}`); addTo('zones', key);
    renderZone();
  }
  function renderZone() {
    const zone = DATA.zones[zoneView.zone];
    panelBody.replaceChildren();
    if (!zone.tabs.length) {
      setTabs(panelTabs, [], null, () => {}); panelChips.hidden = true;
      const empty = h('div', 'panel-empty'); empty.append(h('span', 'panel-empty-mark', ZONE_META[zoneView.zone].hanja), h('p', '', '아직 비어 있는 곳.'), h('small', '', '금줄 너머로 바람 소리만 들린다.'));
      panelBody.append(empty); return;
    }
    const tab = zone.tabs.find((t) => t.id === zoneView.tab) ?? zone.tabs[0];
    const section = tab.sections.find((s) => s.id === zoneView.section) ?? tab.sections[0];
    setTabs(panelTabs, zone.tabs.map((t) => ({ id: t.id, label: `${t.hanja} ${t.name}` })), tab.id, (id) => { zoneView.tab = id; zoneView.section = zone.tabs.find((t) => t.id === id).sections[0].id; zoneView.path = []; renderZone(); });
    setTabs(panelChips, tab.sections.map((s) => ({ id: s.id, label: s.title })), section.id, (id) => { zoneView.section = id; zoneView.path = []; renderZone(); });
    panelChips.hidden = false;
    if (section.play) panelBody.append(playButton(section.play, 'play-btn play-btn-lead'));
    if (section.kind === 'text') section.paras.forEach((t) => panelBody.append(para(t)));
    else if (section.kind === 'list') renderList(section, tab);
    else renderScene(section, tab);
    panelBody.scrollTop = 0;
  }
  function renderList(section, tab) {
    if (section.intro) panelBody.append(para(section.intro, 'panel-intro'));
    panelBody.append(h('p', 'panel-count', `${section.items.length}개 · 눌러서 펼치기`));
    const isEnemy = ['practice', 'bestiary'].includes(section.id);
    const listEl = h('div', 'entry-list');
    section.items.forEach((item, i) => {
      const d = h('details', 'entry');
      const sum = h('summary'); sum.append(h('strong', '', item.name), h('span', '', item.sub || ''));
      d.append(sum);
      if (item.desc) d.append(para(item.desc, 'entry-desc'));
      (item.lines || []).forEach((l) => d.append(para(l, 'entry-line')));
      if (!item.desc && !(item.lines || []).length) d.append(h('p', 'panel-p entry-line', '(설명이 아직 없다)'));
      if (item.play) d.append(playButton(item.play, 'play-btn play-btn-item'));
      d.addEventListener('toggle', () => { if (!d.open) return; addTo('entries', `${tab.id}:${section.id}:${i}`); if (isEnemy) addTo('enemies', `${section.id}:${i}`); });
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
  function renderScene(section, tab) {
    const stats = statsNow();
    let node = section.root;
    const trail = [node];
    for (const id of zoneView.path) { const next = (node.choices || []).find((c) => c.id === id); if (!next) break; node = next; trail.push(node); }
    const crumbs = h('div', 'scene-crumbs');
    trail.forEach((n, i) => {
      if (i) crumbs.append(h('span', 'scene-sep', '›'));
      const last = i === trail.length - 1;
      const c = last ? h('strong', '', '') : btn('', '', () => { zoneView.path = zoneView.path.slice(0, i); renderZone(); });
      c.append(rich(n.name)); crumbs.append(c);
    });
    panelBody.append(crumbs);
    if (trail.length > 1) addTo('scenes', `${tab.id}:${zoneView.path.join('/')}`);
    const hour = new Date().getHours();
    const closed = node.night && !(node.night.from > node.night.to ? hour >= node.night.from || hour < node.night.to : hour >= node.night.from && hour < node.night.to);
    const box = h('div', `scene-box${node.fx === 'jitter' ? ' scene-jitter' : ''}`);
    if (closed) box.append(para(node.night.closed));
    else {
      resolveText(node, stats).forEach((t) => box.append(para(t)));
      if (node.seq) {
        let page = 0;
        const seqP = para(node.seq[0], 'scene-seq');
        const next = btn('scene-next', node.seq.length > 1 ? '다음 ▸' : '', () => { page += 1; seqP.replaceChildren(rich(node.seq[page])); if (page >= node.seq.length - 1) next.hidden = true; });
        next.hidden = node.seq.length < 2;
        box.append(seqP, next);
      }
      if (node.after) box.append(para(node.after, 'scene-after'));
      if (node.result) {
        const cost = node.cost || {};
        const label = cost.mp ? `의지력 ${cost.mp} 쓰기` : cost.wait ? `${cost.wait}분 기다리기 (지금은 바로 지나간다)` : '결과 보기';
        const reveal = btn('scene-cost', label, () => {
          const p = profile();
          if (cost.mp && p) { if (p.mp < cost.mp) { toast('의지력 부족', `의지력이 ${cost.mp} 필요하다.`); return; } p.mp -= cost.mp; persist(); renderStatus(); }
          reveal.replaceWith(...node.result.map((t) => para(t, 'scene-result')));
        });
        box.append(reveal);
      }
      if (node.note) box.append(h('p', 'scene-note', node.note));
      if (node.notice) box.append(h('p', 'scene-notice', node.notice));
      if (node.widgetNote) box.append(h('p', 'scene-note', node.widgetNote));
      if (node.play) box.append(playButton(node.play));
    }
    if (box.childNodes.length) panelBody.append(box);
    const kids = closed ? [] : (node.choices || []);
    if (kids.length) {
      const wrap = h('div', 'scene-choices');
      kids.forEach((c) => {
        const ok = meets(c.when, stats);
        const b = btn(`scene-choice${ok ? '' : ' is-locked'}`, '', () => { zoneView.path = [...zoneView.path, c.id]; renderZone(); });
        b.append(rich(c.name));
        if (c.when) b.append(h('small', '', ok ? whenLabel(c.when) : `${whenLabel(c.when)} 필요`));
        b.disabled = !ok;
        wrap.append(b);
      });
      panelBody.append(wrap);
    }
    if (trail.length > 1) panelBody.append(btn('scene-back', '◂ 돌아가기', () => { zoneView.path = zoneView.path.slice(0, -1); renderZone(); }));
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
  function openProfile(editing) {
    const p = profile();
    openPanel('個人記錄 / MY PROFILE', '내 프로필', 'profile');
    if (!p || editing) renderProfileForm(p); else renderProfileCard(p);
  }
  function renderProfileCard(p) {
    panelBody.replaceChildren();
    const card = h('div', 'profile-card');
    const av = h('div', 'profile-avatar'); avatarInto(av, p.photo, p.name);
    const info = h('div', 'profile-info');
    info.append(h('small', 'profile-title', p.title && ownsTitle(p.title) ? `「${titleById[p.title].name}」` : '칭호 없음'), h('h3', '', p.name));
    const meta = h('p', 'profile-meta'); meta.append(h('span', '', `나이 ${p.age || '—'}`), h('span', '', `성별 ${p.gender || '—'}`)); info.append(meta);
    info.append(h('p', 'profile-intro', p.intro || '(한줄소개가 비어 있다)'));
    card.append(av, info);
    panelBody.append(card, h('div', 'panel-rule'));
    const grid = h('div', 'profile-stats');
    const st = statsNow();
    R.statKeys.forEach((k) => { const c = h('div', 'profile-stat'); c.title = R.stats[k].detail; c.append(h('span', '', R.stats[k].label), h('b', '', String(Math.floor(st[k] ?? 1)))); grid.append(c); });
    panelBody.append(h('p', 'panel-label', '육조 스탯'), grid);
    const pick = h('div', 'profile-field');
    const sel = h('select'); sel.id = 'profileTitleSelect';
    sel.append(new Option('칭호 없음', ''));
    ownedTitles().forEach((t) => sel.append(new Option(t.name, t.id, false, p.title === t.id)));
    sel.addEventListener('change', () => { p.title = sel.value || null; persist(); if (sel.value) mark('titleEquipped'); renderStatus(); renderProfileCard(p); });
    const lab = h('label', '', `칭호 고르기 (가진 칭호 ${ownedTitles().length} / ${TITLES.length})`); lab.htmlFor = sel.id;
    pick.append(lab, sel);
    if (p.title && titleById[p.title]) pick.append(h('small', '', titleById[p.title].desc));
    panelBody.append(pick);
    const foot = h('div', 'profile-actions');
    foot.append(btn('ghost-btn', '프로필 고치기', () => openProfile(true)), btn('ghost-btn', '업적 / 도감', () => openCodex('titles')));
    panelBody.append(foot, h('p', 'panel-fine', '프로필은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.'));
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
    if (!creating) actions.append(btn('ghost-btn', '취소', () => openProfile(false)));
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
      renderStatus(); openProfile(false);
    });
    panelBody.append(form);
    nameIn.focus();
  }

  /* ───────── 오른쪽: 나의 상태 ───────── */
  function renderStatus() {
    const p = profile();
    avatarInto($('#statusAvatar'), p?.photo, p?.name);
    $('#statusTitle').textContent = p?.title && ownsTitle(p.title) ? `「${titleById[p.title].name}」` : '칭호 없음';
    $('#statusName').textContent = p?.name ?? '이름 없는 입산자';
    $('#statusSub').textContent = p ? (p.intro || '한줄소개 없음') : '눌러서 프로필 만들기';
    const g = game();
    const bars = [['체력', 'hp', g?.hp ?? p?.hp ?? R.hpMax, g?.hpMax ?? R.hpMax], ['영력', 'spirit', g?.spirit ?? p?.spirit ?? R.spiritStart, R.spiritMax], ['의지력', 'mp', g?.mp ?? p?.mp ?? R.mpMax, g?.mpMax ?? R.mpMax]];
    $('#statusBars').replaceChildren(...bars.map(([label, key, value, max]) => {
      const row = h('div', `status-bar bar-${key}`);
      const top = h('div', 'status-bar-top'); top.append(h('span', '', label), h('b', '', `${Math.floor(value)} / ${max}`));
      const track = h('div', 'status-bar-track'); track.setAttribute('role', 'meter'); track.setAttribute('aria-label', label); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(max)); track.setAttribute('aria-valuenow', String(Math.floor(value)));
      const fill = h('i'); fill.style.width = `${Math.min(100, (value / max) * 100)}%`; track.append(fill);
      row.append(top, track); return row;
    }));
    const stats = statsNow();
    $('#statusStats').replaceChildren(...R.statKeys.map((k) => { const c = h('div', 'status-stat'); c.title = R.stats[k].detail; c.append(h('span', '', R.stats[k].label), h('b', '', String(Math.floor(stats[k] ?? 1)))); return c; }));
    $('#statusMoney').textContent = `${Math.floor(g?.money ?? p?.money ?? 0)}냥`;
  }

  /* ───────── 소지품 · 적응 퀘스트 · 소지금 · 업데이트 노트 ───────── */
  const UPDATE_NOTES = [
    { v: 'v0.8', date: '2026-11-12', lines: ['전투(퇴마 실습 · 추가전투 50종) · 개척 23곳 · 공작소 · 조리실 · 수업 미니게임 6종을 바로 실행할 수 있게 연결.', '매점 · 무구보관소 · 텃밭 · 수련 · 잠 · 양호실 · 스탯 올리기 · 소지품도 실행 화면에서 동작.', '구역 화면의 ▶ 버튼, 또는 play/index.html#주소 로 바로 열기.', '전투 · 수업 · 제작 · 개척 · 소지금 업적을 달성할 수 있게 됨.'] },
    { v: 'v0.7', date: '2026-11-12', lines: ['내 프로필(이름 · 나이 · 성별 · 한줄소개 · 사진)과 육조 스탯 첫 배분.', '오른쪽에 나의 상태(체력 · 영력 · 의지력 · 육조 스탯)와 메뉴 버튼.', '강학당(본관 · 별관) · 생활관(기숙사) · 비령산 금역(뒷산)에 데이터 배치. 산문은 비어 있음.', '메인 배너 다섯 쪽(청 · 적 · 황 · 백 · 흑).', '칭호 50개 · 업적 30개, 도감에서 확인.', '글꼴은 갈무리 · KoPub 돋움 · KoPub 바탕 세 가지.'] },
    { v: 'v0.6', date: '2026-11-12', lines: ['초록동색 C.01 콘텐츠 보관고 추가(NPC · 퀘스트 제외).', '화면 파일을 저장소 맨 위로 옮겨 GitHub Pages 에서 바로 열림.'] },
    { v: 'v0.5', date: '', lines: ['사방 지도, 지신성 · 낮새들의 터 · 밤쥐들의 터.'] },
  ];
  function openInventory() { openPlay('inventory'); }
  function openQuest() {
    openPanel('適應 / FIRST DAYS', '적응 퀘스트', 'simple');
    const e = h('div', 'panel-empty'); e.append(h('span', 'panel-empty-mark', '導'), h('p', '', '아직 받은 적응 퀘스트가 없다.'), h('small', '', '퀘스트 내용은 준비 중이다.')); panelBody.append(e);
  }
  function openMoney() {
    const p = profile();
    openStory('錢 / 소지금', `${Math.floor(game()?.money ?? p?.money ?? 0)}냥`, [p ? '주머니 속 엽전을 세어 보았다.' : '프로필을 만들면 주머니가 생긴다.', '퇴마 실습에서 이기거나 매점에 물건을 팔면 늘어나고, 매점에서 사면 줄어든다.'], '비령 · 소지금');
  }
  function openNotes() {
    openPanel('報 / UPDATE NOTES', '업데이트 노트', 'simple');
    UPDATE_NOTES.forEach((n) => {
      const box = h('div', 'note-box'); const head = h('p', 'panel-label'); head.append(h('b', '', n.v), n.date ? ` · ${n.date}` : '');
      const ul = h('ul'); n.lines.forEach((l) => ul.append(h('li', '', l)));
      box.append(head, ul); panelBody.append(box);
    });
  }

  /* ───────── 업적 / 도감 ───────── */
  function openCodex(tab = 'achievements') {
    openPanel('圖鑑 / CODEX', '업적 / 도감', 'codex');
    const draw = (current) => {
      setTabs(panelTabs, [{ id: 'achievements', label: `업적 ${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length}` }, { id: 'titles', label: `칭호 ${ownedTitles().length} / ${TITLES.length}` }], current, draw);
      panelBody.replaceChildren();
      const listEl = h('div', 'codex-list');
      if (current === 'achievements') {
        ACHIEVEMENTS.forEach((a) => {
          const got = save.achievements[a.id];
          const row = h('div', `codex-row${got ? ' is-got' : ''}`);
          const text = h('div', 'codex-text');
          text.append(h('strong', '', a.name), h('p', '', got ? a.desc : a.hint));
          const prog = !got && progressOf(a.when);
          const side = h('div', 'codex-side');
          side.append(h('span', 'codex-state', got ? '달성' : a.live ? (prog ? `${prog[0]} / ${prog[1]}` : '미달성') : '준비 중'));
          if (a.title && titleById[a.title]) side.append(h('small', '', `칭호 [${titleById[a.title].name}]`));
          row.append(h('span', 'codex-mark', got ? '◆' : '◇'), text, side); listEl.append(row);
        });
        panelBody.append(listEl);
      } else {
        const p = profile();
        TITLES.forEach((t) => {
          const got = ownsTitle(t.id);
          const row = h('div', `codex-row${got ? ' is-got' : ''}`);
          const text = h('div', 'codex-text');
          const source = ACHIEVEMENTS.find((a) => a.title === t.id);
          text.append(h('strong', '', got ? t.name : '???'), h('p', '', got ? t.desc : source ? `업적 [${source.name}] 달성 시 획득` : '아직 얻을 방법이 알려지지 않았다.'));
          const side = h('div', 'codex-side');
          if (got && p) side.append(p.title === t.id ? h('span', 'codex-state', '사용 중') : btn('ghost-btn codex-use', '달기', () => { p.title = t.id; persist(); mark('titleEquipped'); renderStatus(); draw('titles'); }));
          else side.append(h('span', 'codex-state', got ? '보유' : '미획득'));
          row.append(h('span', 'codex-mark', got ? '◆' : '◇'), text, side); listEl.append(row);
        });
        panelBody.append(listEl);
      }
      panelBody.scrollTop = 0;
    };
    draw(tab);
  }

  /* ───────── 메인 배너 (다섯 쪽) ───────── */
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
    if (document.querySelector('dialog[open]') || !fontMenu.hidden) return;
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
  document.querySelectorAll('[data-zone]').forEach((card) => card.addEventListener('click', () => enterZone(card.dataset.zone)));
  $('#storyBtn').addEventListener('click', showCase);
  $('#readCase').addEventListener('click', showCase);
  $('#journalBtn').addEventListener('click', () => openProfile(false));
  $('#statusWho').addEventListener('click', () => openProfile(false));
  const MENU = { inventory: openInventory, quest: openQuest, codex: () => openCodex('achievements'), money: openMoney, notes: openNotes };
  document.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => MENU[b.dataset.menu]?.()));
  document.querySelectorAll('[data-community]').forEach((b) => b.addEventListener('click', () => addTo('community', b.dataset.community)));
  document.querySelectorAll('[data-community-tab]').forEach((b) => b.addEventListener('click', () => addTo('community', b.dataset.communityTab)));
  $('#dialogClose').addEventListener('click', () => dialog.close());
  $('#dialogConfirm').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  const lanternBtn = $('#lanternBtn');
  function setLantern(on) {
    document.body.classList.toggle('lantern-lit', on);
    lanternBtn.textContent = on ? '☾ 등불 끄기' : '☼ 등불 켜기';
    lanternBtn.setAttribute('aria-pressed', String(on));
  }
  lanternBtn.addEventListener('click', () => { const on = !document.body.classList.contains('lantern-lit'); setLantern(on); if (on) mark('lantern'); });

  let storedFont = DEFAULT_FONT;
  try { storedFont = localStorage.getItem(FONT_STORAGE_KEY) || DEFAULT_FONT; } catch (_) { /* 기본 글꼴 */ }
  setFont(storedFont, false);
  goHero(0);
  renderStatus();
  const now = new Date();
  addTo('days', `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`);
  if (now.getHours() < 4) mark('nightVisit');
  checkAchievements();
})();
