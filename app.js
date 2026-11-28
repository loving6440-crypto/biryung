/* 비령 — 화면 로직. 서버 없이 동작한다(내 프로필 · 진행 기록은 이 브라우저에 보관).
 *
 * 페이지는 주소(#/…)로 바뀐다. 머리글 · 배너 · 오른쪽 '나의 상태'는 어느 페이지에서나 그대로 있고, 가운데만 바뀐다.
 *   #/                      사방 지도(처음 화면)
 *   #/zone/<구역>/<탭>/<칸>/<탐사 경로…>    구역 (north 산문 = 스토리 퀘스트 · east 강학당 · west 생활관 · south 금역)
 *   #/go/<실행 주소>          전투 · 개척 · 수업 등을 바로 (예: #/go/battle/scarecrow, #/go/lesson/ward-tetris)
 *   #/profile · #/profile/edit · #/codex · #/codex/titles · #/clubs · #/case · #/money · #/admin(관리자)
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
  const fontMenu = $('#themeMenu'), fontToggle = $('#themeToggle'), fontOptions = $('#fontOptions'); // vD.06.1 글꼴은 [테마 관리] 안으로
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
  document.addEventListener('pointerdown', (event) => { if (!fontMenu.hidden && !$('#themeControl').contains(event.target)) toggleFontMenu(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !fontMenu.hidden) { toggleFontMenu(false); event.stopPropagation(); } });
  window.addEventListener('storage', (event) => { if (event.key === FONT_STORAGE_KEY) setFont(event.newValue); });

  /* ───────── vD.06.1 테마 관리: 화면(다크 · 화이트) · 음악 · 효과음 ───────── */
  const THEME_KEY = 'biryeong-theme', SFX_KEY = 'biryeong-sfx';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* 이번만 */ } };
  function setTheme(mode) {
    const light = mode === 'light';
    if (light) document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;
    lsSet(THEME_KEY, light ? 'light' : 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#eef5ec' : '#070e1b');
    document.querySelectorAll('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === (light ? 'light' : 'dark'))));
  }
  const sfxOn = () => lsGet(SFX_KEY) !== 'off';
  function setSfx(on) {
    lsSet(SFX_KEY, on ? 'on' : 'off'); // 실행 화면(미니게임 등)의 효과음도 같이(아래 BiryeongSfx)
    try { globalThis.BiryeongSfx?.setMuted?.(!on); } catch (_) { /* 실행 화면 전 */ }
    drawSound();
  }
  function drawSound() {
    const bg = window.BiryeongBgm, mOn = bg ? !bg.state().muted : lsGet('biryeong-music') !== 'off', vol = bg ? bg.state().volume : 0.4;
    const ms = $('#musicSwitch'), ss = $('#sfxSwitch');
    ms.textContent = mOn ? '켜짐' : '꺼짐'; ms.setAttribute('aria-pressed', String(mOn));
    ss.textContent = sfxOn() ? '켜짐' : '꺼짐'; ss.setAttribute('aria-pressed', String(sfxOn()));
    $('#musicVol').value = String(Math.round(vol * 100)); $('#musicVolText').textContent = `${Math.round(vol * 100)}%`;
  }
  document.querySelectorAll('[data-theme-pick]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themePick)));
  $('#musicSwitch').addEventListener('click', () => { const bg = window.BiryeongBgm; if (bg) bg.setMuted(!bg.state().muted); drawSound(); });
  $('#musicVol').addEventListener('input', (e) => { window.BiryeongBgm?.setVolume(Number(e.target.value) / 100); drawSound(); });
  $('#sfxSwitch').addEventListener('click', () => setSfx(!sfxOn()));
  fontToggle.addEventListener('click', () => drawSound());
  setTheme(lsGet(THEME_KEY) === 'light' ? 'light' : 'dark');
  drawSound();

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

  /* V.01 칭호 고르기 정렬: 기능 갈래 → 효과 크기(작은 것 위) → 이름 */
  const PERK_ORDER = ['dailyMoney', 'discount', 'sell', 'winMoney', 'winSpirit', 'lessonSpirit', 'trainSpirit', 'wakeSpirit', 'regen', 'statRefund', 'itemSave', 'craftBonus', 'cookBonus', 'gatherBonus', 'harvestBonus',
    'stat:insight', 'stat:aggression', 'stat:endurance', 'stat:control', 'stat:agility', 'stat:comprehension'];
  const PERK_LABEL = { dailyMoney: '하루 첫 접속 때 냥', discount: '매점에서 살 때 덜 낸다', sell: '매점에 팔 때 더 받는다', winMoney: '전투에서 이겨 받는 냥', winSpirit: '전투에서 이겨 받는 영력',
    lessonSpirit: '수업 보상 영력', trainSpirit: '수련을 마치면 영력', wakeSpirit: '잠을 다 자면 영력', regen: '영력 자연 회복', statRefund: '육조를 올릴 때 영력 되돌림', itemSave: '아이템이 줄지 않을 확률',
    craftBonus: '공작소 제작 때 하나 더', cookBonus: '조리 때 하나 더', gatherBonus: '개척 채집 · 수렵 때 하나 더', harvestBonus: '텃밭 수확 때 하나 더',
    'stat:insight': '육조 보정 · 안목', 'stat:aggression': '육조 보정 · 호전', 'stat:endurance': '육조 보정 · 인내', 'stat:control': '육조 보정 · 절제', 'stat:agility': '육조 보정 · 신속', 'stat:comprehension': '육조 보정 · 이해' };
  const perkOf = (t) => { const pk = Array.isArray(t.perk) ? { type: t.perk[0], v: t.perk[1] } : (t.perk || {}); return { key: t.noPerk || !pk.type ? 'none' : pk.type === 'stat' ? `stat:${pk.key}` : pk.type, v: Number(pk.v) || 0 }; };
  function titleGroups(list) {
    const by = new Map();
    list.forEach((t) => { const k = perkOf(t).key; if (!by.has(k)) by.set(k, []); by.get(k).push(t); });
    const keys = [...by.keys()].sort((a, b) => (a === 'none') - (b === 'none') || ((PERK_ORDER.indexOf(a) + 1 || 99) - (PERK_ORDER.indexOf(b) + 1 || 99)));
    return keys.map((k) => [k === 'none' ? '기능 없음 · 자신을 증명하는 칭호' : (PERK_LABEL[k] || k), by.get(k).sort((a, b) => perkOf(a).v - perkOf(b).v || String(a.name).localeCompare(String(b.name), 'ko'))]);
  }

  /* ───────── 알림 ───────── */
  const toastStack = $('#toastStack');
  function toast(head, text, cls) {
    const el = h('div', `toast${cls ? ` ${cls}` : ''}`); el.append(h('strong', '', head), h('span', '', text));
    toastStack.appendChild(el);
    try { if (toastStack.matches(':popover-open')) toastStack.hidePopover(); toastStack.showPopover(); } catch (_) { /* popover 를 모르는 브라우저 */ }
    const stay = cls === 'is-alert' ? 7000 : 4200; // V.01 붉은 알림은 조금 더 오래
    setTimeout(() => el.classList.add('is-leaving'), stay);
    setTimeout(() => { el.remove(); if (!toastStack.children.length) { try { toastStack.hidePopover(); } catch (_) { /* 무시 */ } } }, stay + 600);
  }

  /* ───────── vD.01 띠링 — 소리 파일 없이 두 음(WebAudio). 파티 초대 · 선물 · 밀담은 언제나, 일행 대화의 새 말은 켜 두었을 때만 ───────── */
  const CHAT_SOUND_KEY = 'biryeong-chat-sound';
  const chatSoundOn = () => { try { return localStorage.getItem(CHAT_SOUND_KEY) !== 'off'; } catch (_) { return true; } };
  const setChatSound = (on) => { try { localStorage.setItem(CHAT_SOUND_KEY, on ? 'on' : 'off'); } catch (_) { /* 이번만 */ } };
  let audioCtx = null, lastDing = 0;
  const audio = () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) { audioCtx = null; } return audioCtx; };
  document.addEventListener('pointerdown', () => audio(), { once: true, capture: true }); // 브라우저는 한 번 누른 뒤에야 소리를 낸다
  function ding(kind = 'notice') {
    if (!sfxOn()) return; // vD.06.1 효과음 끄기
    if (kind === 'chat' && !chatSoundOn()) return;
    const now = Date.now(); if (now - lastDing < 1200 && kind !== 'party-bell') return; lastDing = now;
    const ac = audio(); if (!ac) return;
    try {
      const t0 = ac.currentTime;
      // 호출 종: 띠롱-띠롱 두 번. 일반 채팅/전투 효과음은 기존대로 유지한다.
      const notes = kind === 'party-bell'
        ? [[987.77, 0], [1318.51, .12], [987.77, .48], [1318.51, .60]]
        : [[1318.5, 0], [1975.5, 0.11]];
      notes.forEach(([f, dt]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.16, t0 + dt + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.55);
        o.connect(g).connect(ac.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.6);
      });
    } catch (_) { /* 소리를 못 내는 브라우저 */ }
  }

  /* ───────── vD.01 [현재 상태] 칩에 마우스를 올리면 마우스 바로 위에 무슨 상태인지 · 몇 분 남았는지 ───────── */
  const condTip = h('div', 'cond-tip'); condTip.setAttribute('role', 'tooltip'); condTip.hidden = true; document.body.append(condTip);
  function condTipShow(chip, x, y) {
    const api = window.BiryeongPlay?.api?.();
    const c = (() => { try { return (api?.conditions?.() ?? []).find((v) => v.id === chip.dataset.cond); } catch (_) { return null; } })();
    if (!c) { condTip.hidden = true; return; }
    condTip.replaceChildren(h('b', '', `${c.name}${c.hanja ? `(${c.hanja})` : ''}${c.max > 1 ? ` · ${c.stack}/${c.max}겹` : ''}`), h('span', 'cond-tip-left', `남은 시간 ${c.left}`), h('p', '', c.text || ''), h('p', 'cond-tip-eff', `효과: ${c.effect || '—'}`));
    condTip.hidden = false;
    const r = condTip.getBoundingClientRect();
    condTip.style.left = `${Math.max(6, Math.min(window.innerWidth - r.width - 6, x - r.width / 2))}px`;
    condTip.style.top = `${Math.max(6, y - r.height - 14)}px`;
  }
  document.addEventListener('pointermove', (e) => { const chip = e.target.closest?.('[data-cond]'); if (chip) condTipShow(chip, e.clientX, e.clientY); else if (!condTip.hidden) condTip.hidden = true; });
  document.addEventListener('focusin', (e) => { const chip = e.target.closest?.('[data-cond]'); if (chip) { const r = chip.getBoundingClientRect(); condTipShow(chip, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { condTip.hidden = true; });

  /* ───────── vD.04 육조 스탯에 마우스를 올리면 그 스탯의 뜻 · 쓰임 ───────── */
  const STAT_TIP = {
    insight: { lore: '눈꺼풀 들어올려 바라봐야만 맺힌 상이 무엇인지 식별 가능하다. 교육자들은 우선 눈을 크게 뜰 것을 1원칙으로 삼는다.', eff: '개척에 유리해집니다. 희귀한 품목을 주울 확률 및 전체적 성공률이 늘어납니다. 조사 이동 중 물건을 주울 확률이 늘어납니다.' },
    aggression: { lore: '동작이란 세상에 흐름에 거슬러 육신을 다스리는 것. 공기의 저항감, 바닥의 중력, 피부에 달라붙는 옷가지 따위의 감각.', eff: '전투 중 공격력이 늘어나지만, 제어할 수 없는 돌발 행동 확률도 함께 늘어납니다.' },
    endurance: { lore: '시간 낭비라 성토하는 이들에게 보여라, 버텼기에 살아남았고 살아남았기에 본인을 증명할 수 있는 법이다.', eff: '전투 중 방어력이 늘어나고, 시간을 들여 얻는 보상이 늘어납니다.' },
    control: { lore: '자기 자신을 다룰 수 있음이란 자연의 일부를 거느린다는 뜻. 세상 만물이 한 개인을 위해 흐를 수 있게끔 끌어온다.', eff: '호전을 제어하는 역할을 합니다. 호전이 높을 때 절제도 함께 높아야 돌발 행동이 줄어들고 디버프를 받을 확률이 줄어듭니다. 또한 영력 활용이 효율적으로 변합니다.' },
    agility: { lore: '몸에 익은 박자와 뇌가 시키지 않아도 진행되는 흐름, 몸에 체득될 적 까지 익히는 것. 그것이 반 박자 빠를 수 있는 법칙이다.', eff: '전투 중 선공을 잡을 확률이 늘어납니다. 시간을 들여 보상을 얻을 때, 그 시간이 전체적으로 줄어듭니다.' },
    comprehension: { lore: '세상을 향해 너른 마음을 보이고 팔을 벌려 수용할 것을 선언하는 것. 그것 만으로도 자연은 개인을 환영한다.', eff: '전투 중 공격/방어 외 다른 행동을 지원하며, 개척 중 전투를 확률적으로 피하게 해줍니다.' },
  };
  const statTip = h('div', 'cond-tip stat-tip'); statTip.setAttribute('role', 'tooltip'); statTip.hidden = true; document.body.append(statTip);
  function statTipShow(cell, x, y) {
    const k = cell.dataset.statTip, t = STAT_TIP[k];
    if (!t) { statTip.hidden = true; return; }
    statTip.replaceChildren(h('b', '', R.stats?.[k]?.label || k), h('p', 'stat-tip-lore', t.lore), h('p', 'cond-tip-eff', t.eff));
    statTip.hidden = false;
    const r = statTip.getBoundingClientRect();
    statTip.style.left = `${Math.max(6, Math.min(window.innerWidth - r.width - 6, x - r.width / 2))}px`;
    statTip.style.top = `${y - r.height - 14 < 6 ? y + 22 : y - r.height - 14}px`;
  }
  document.addEventListener('pointermove', (e) => { const cell = e.target.closest?.('[data-stat-tip]'); if (cell && !e.target.closest('.status-stat-up')) statTipShow(cell, e.clientX, e.clientY); else if (!statTip.hidden) statTip.hidden = true; });
  document.addEventListener('focusin', (e) => { const cell = e.target.closest?.('[data-stat-tip]'); if (cell && cell === e.target) { const r = cell.getBoundingClientRect(); statTipShow(cell, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', () => { statTip.hidden = true; });

  /* ───────── 업적 조건 ───────── */
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function streakNow() { // 오늘부터 거꾸로, 하루도 빠지지 않은 날 수
    const days = save.sets.days || {};
    let n = 0;
    for (const d = new Date(); days[dayKey(d)]; d.setDate(d.getDate() - 1)) n += 1;
    return n;
  }
  function finalItemCounts(it) {
    const from = String(it?.from || ''), effect = String(it?.effect || '');
    return !from.includes('아직 알려진 곳이 없다') && !/[①-⑳][^)]*루트\)/.test(from) && !effect.startsWith('이벤트 물건');
  }
  // 최종 업적: 수집 완료는 역대 도감 기록, 무구는 실제 현재 보유+강화 상태를 기준으로 판정한다.
  function finalProgress(key) {
    const p = game();
    if (!p) return [0, 1];
    const weapons = window.BIRYEONG_FINAL_WEAPONS || [];
    const owned = new Set(Object.keys(p.inventory || {}).filter((id) => p.inventory[id] > 0));
    if (p.equip?.weapon) owned.add(p.equip.weapon);
    const copies = (id) => [...owned].filter((it) => it === id || it.startsWith(id+'#'));
    // V.01 만물 도감: 누구나 얻을 수 있는 것만 센다 — 얻는 곳이 아직 없는 것 · 한 루트 전용(② · ③ 루트) · 이벤트 물건은 뺀다
    const itemList = (CODEX.items || []).filter(finalItemCounts);
    const psychicList = CODEX.psychics || [];
    const beaten = counts().sets?.beaten || {};
    const extra = window.BIRYEONG_FINAL_ENEMIES || {};
    const taken = (ids) => ids.filter((id) => !!beaten[id]).length;
    if (key === 'stats') return [R.statKeys.filter((k) => Number(p.stats?.[k] || 0) >= 40).length, 6];
    if (key === 'items') return [itemList.filter((it) => !!p.codex?.items?.[it.id]).length, itemList.length || 1];
    if (key === 'psychics') return [psychicList.filter((it) => it.always || (p.psychics || []).includes(it.id)).length, psychicList.length || 1];
    if (key === 'weapons') return [weapons.filter((id) => copies(id).length > 0).length, weapons.length || 1];
    if (key === 'maxweapons') return [weapons.filter((id) => copies(id).some((inst) => Object.values(p.enh?.[inst] || {}).reduce((sum, x) => sum + Number(x || 0), 0) >= 15)).length, weapons.length || 1];
    if (key === 'money') return [Math.min(1000000, Math.floor(Number(p.money) || 0)), 1000000]; // V.01 백만 냥(부귀영화)
    if (key === 'extra-all') { const ids = Object.values(extra).flat(); return [taken(ids), ids.length || 1]; }
    if (/^extra-(?:10|[1-9])$/.test(key)) { const ids = extra[key.slice(6)] || []; return [taken(ids), ids.length || 1]; }
    return [0,1];
  }
  const valueOf = (w) => (w.final ? finalProgress(w.final)[0] : w.vault ? (game()?.achievements?.[w.vault] ? 1 : 0) : w.titles ? ownedTitles().length : w.set ? Object.keys(save.sets[w.set] || {}).length : w.pset ? Object.keys(counts().sets?.[w.pset] || {}).length : w.count ? Math.floor(counts()[w.count] || 0) : w.streak ? streakNow() : 0);
  const targetOf = (w) => w.final ? finalProgress(w.final)[1] : w.n ?? w.streak ?? w.titles ?? 1;
  const met = (w) => (w.final && !game() ? false : w.all ? w.all.every(met) : w.flag ? !!save.flags[w.flag] : valueOf(w) >= targetOf(w));
  /** 진행도 [지금, 목표] — 여러 조건이면 채운 조건 수 */
  const progressOf = (w) => (w.final ? finalProgress(w.final) : w.all ? [w.all.filter(met).length, w.all.length] : w.flag || w.vault ? null : [Math.min(valueOf(w), targetOf(w)), targetOf(w)]);
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
    ['매점: 값을 치르지 않고 산다.', '공작소 · 조리실: 제작법대로 만들 때 재료가 줄지 않는다.', '무구보관소: 강화 · 특수 강화 · 도깨비 토큰 교환에 재료가 들지 않는다.', '육조 스탯: 일반 상한(40)을 넘겨 999까지 올릴 수 있다.', '패 놀이터 · 수업 꾸미기: 횟수 제한과 잠금이 풀린다.'].forEach((t) => ul.append(h('li', '', t)));
    panelBody.append(ul);
    if (Auth.server) { panelBody.append(h('div', 'panel-rule'), para('회원 · 하사 · 공지 · 밀담 감사 · 감사 기록은 [서버 관리] 탭에 있다.')); return; }
    panelBody.append(h('div', 'panel-rule'), h('p', 'panel-label', `회원 목록 — 이 브라우저 (${Auth.list().length}명)`));
    const me = Auth.session();
    const list = h('div', 'codex-list scroll-box'); // V.01 네모 칸 안에서 스크롤
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
    if (log.length) { panelBody.append(h('p', 'panel-label', '최근 기록')); const ul = h('ul', 'log-list scroll-box'); log.forEach((l) => { const li = h('li'); li.append(h('span', '', `[${l.time}] `), l.message); ul.append(li); }); panelBody.append(ul); }
  }
  // vD.03 벼룩시장(market.js) — 서버에 연결된 계정만
  // vD.04 카페 정산(cafe.js) — 서버에 연결된 계정만
  function renderCafe() {
    openPage('茶 / CAFE', '카페 정산', 'simple');
    addTo('pages', 'cafe');
    if (window.BiryeongCafe) window.BiryeongCafe.render(panelBody);
    else panelBody.append(para('카페 정산을 불러오지 못했다. 새로고침해 줘.'));
  }
  function renderMarket() {
    openPage('市 / FLEA MARKET', '벼룩시장', 'simple');
    addTo('pages', 'market');
    if (window.BiryeongMarket) window.BiryeongMarket.render(panelBody);
    else panelBody.append(para('벼룩시장을 불러오지 못했다. 새로고침해 줘.'));
  }
  /* ───────── V.01 동아리 알림: 내 동아리의 할일을 다 채웠는데 아직 받지 않은 보상 ─────────
     [동아리] 단추에 붉은 숫자 · 새로 채운 것은 붉은 알림으로 한 번(무엇을 채웠고 무엇을 받는지). 보상은 부실에서 받는다. */
  const KST9 = 9 * 3600 * 1000, DAY1 = 864e5;
  const kstDayNo = (t = Date.now()) => Math.floor((t + KST9) / DAY1);
  const kstWeekNo = (t = Date.now()) => { const d = kstDayNo(t); return d - new Date(d * DAY1).getUTCDay(); }; // 그 주 일요일의 날 번호
  function clubAlerts() {
    const api = playApi(); const mine = api?.clubMine?.();
    if (!mine || !api?.clubBoard) return [];
    let b; try { b = api.clubBoard(mine); } catch (_) { return []; }
    const d = kstDayNo(), w = kstWeekNo(), out = [];
    const add = (q, daily) => { if (q && q.done && !q.claimed) out.push({ key: `${daily ? `d${d}` : `w${w}`}:${q.id}`, kind: daily ? '오늘의 할일' : '이번주에 할일', label: q.label, reward: q.reward }); };
    (b.daily || []).forEach((q) => add(q, true)); add(b.dailyMeta, true);
    (b.weekly || []).forEach((q) => add(q, false)); (b.weeklyMeta || []).forEach((q) => add(q, false));
    return out;
  }
  const CLUB_SEEN = () => `biryeong-club-seen:${window.BiryeongAuth?.session?.() || ''}`;
  function checkClubAlerts() {
    const list = clubAlerts();
    const mb = document.querySelector('.status-menu [data-menu="clubs"]');
    if (mb) {
      let dot = mb.querySelector('.menu-alert');
      if (list.length) { if (!dot) { dot = h('b', 'menu-alert'); mb.append(dot); } dot.textContent = String(list.length); mb.dataset.alert = String(list.length); mb.setAttribute('aria-label', `동아리 — 받을 수 있는 보상 ${list.length}개`); }
      else { dot?.remove(); delete mb.dataset.alert; mb.removeAttribute('aria-label'); }
    }
    let seen = []; try { seen = JSON.parse(localStorage.getItem(CLUB_SEEN()) || '[]'); } catch (_) { seen = []; }
    const fresh = list.filter((x) => !seen.includes(x.key));
    if (fresh.length) {
      const lines = fresh.slice(0, 4).map((x) => `[${x.kind}] ${x.label} — 보상 ${clubReward(x.reward) || '—'}`);
      if (fresh.length > 4) lines.push(`… 그 밖에 ${fresh.length - 4}개`);
      toast('동아리 · 할일 달성! 부실에서 보상을 받을 수 있다', lines.join('\n'), 'is-alert');
      const d = kstDayNo(), w = kstWeekNo();
      const keep = seen.filter((k) => k.startsWith(`d${d}:`) || k.startsWith(`w${w}:`)); // 지난 날 · 지난 주 것은 버린다
      try { localStorage.setItem(CLUB_SEEN(), JSON.stringify([...keep, ...fresh.map((x) => x.key)])); } catch (_) { /* 무시 */ }
    }
    return list;
  }

  /* ───────── V.01 동아리 창(예전 [업데이트 노트] 자리) ─────────
     동아리를 골라 그 동아리의 [오늘의 할일] · [이번주에 할일]을 본다.
     내 동아리: 부실에서 보는 것과 같은 판(진행 · 받은 것). 보상은 부실에서 받는다.
     다른 동아리: 미리 보기 — 납품 · 토벌은 「지금 가입하면 이번 주에 받을 것」이고 저장하지 않는다. */
  let clubPick = null, clubPickMine = undefined;
  const clubReward = (r) => [r?.money ? `${r.money}냥` : '', r?.spirit ? `영력 ${r.spirit}` : '', r?.item ? `[${playApi()?.itemName?.(r.item) ?? r.item}]` : ''].filter(Boolean).join(' · ');
  function clubRow(q, mine) {
    const li = h('li', `club-q${q.done ? ' is-done' : ''}${q.claimed ? ' is-claimed' : ''}`); li.dataset.clubQuest = q.id;
    const top = h('div', 'club-q-top');
    top.append(h('span', 'club-q-label', q.label), h('span', 'club-q-state', !mine ? '' : q.claimed ? '받음' : q.done ? '부실에서 받기' : ''));
    li.append(top);
    if (q.note) li.append(h('small', 'club-q-note', q.note));
    const bar = h('div', 'club-q-bar'); const fill = h('i'); fill.style.width = `${Math.round((q.cur / Math.max(1, q.goal)) * 100)}%`; bar.append(fill);
    const foot = h('div', 'club-q-foot'); foot.append(bar, h('span', 'club-q-num', q.text ?? `${q.cur} / ${q.goal}`), h('span', 'club-q-reward', clubReward(q.reward)));
    li.append(foot);
    return li;
  }
  function renderClubs() {
    openPage('社 / CLUBS', '동아리', 'simple');
    addTo('pages', 'clubs');
    const api = playApi();
    if (!api?.clubList || !api?.clubBoard) {
      panelBody.append(emptyBox('社', game() ? '동아리 정보를 불러오는 중이다.' : '프로필을 만들면 동아리 활동을 볼 수 있다.', game() ? '잠시 뒤 다시 열어 줘.' : ''));
      return;
    }
    const clubs = api.clubList(), mine = api.clubMine?.() || null;
    if (mine !== clubPickMine) { clubPickMine = mine; clubPick = null; } // 가입 · 탈퇴하면 내 동아리부터
    if (!clubPick || !clubs.some((c) => c.id === clubPick)) clubPick = mine || clubs[0]?.id;
    const tabs = h('div', 'club-tabs'); tabs.setAttribute('role', 'tablist');
    clubs.forEach((c) => {
      const b = btn(`club-tab${c.id === clubPick ? ' is-on' : ''}${c.id === mine ? ' is-mine' : ''}`, c.id === mine ? `★ ${c.name}` : c.name, () => { clubPick = c.id; renderClubs(); });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', c.id === clubPick ? 'true' : 'false'); b.dataset.club = c.id;
      tabs.append(b);
    });
    panelBody.append(tabs);
    const c = clubs.find((x) => x.id === clubPick); if (!c) return;
    const isMine = c.id === mine;
    if (isMine) api.clubEnsure?.(c.id);
    const b = api.clubBoard(c.id);
    if (isMine) { // V.01 받을 수 있는 보상
      const al = checkClubAlerts();
      if (al.length) {
        const box = h('section', 'club-alert'); box.dataset.clubAlert = String(al.length);
        box.append(h('p', 'club-alert-head', `받을 수 있는 보상 ${al.length}개 — 부실(${[c.floor, c.room].filter(Boolean).join(' ')})에 가서 [보상 받기]`));
        const ul = h('ul'); al.forEach((x) => ul.append(h('li', '', `[${x.kind}] ${x.label} — ${clubReward(x.reward) || '—'}`))); box.append(ul);
        panelBody.append(box);
      }
    }
    panelBody.append(para(isMine
      ? `**${c.name}** — 내 동아리. 부실(${[c.floor, c.room].filter(Boolean).join(' ')})에서 보는 것과 같은 할일이다. 다 채운 칸의 보상은 부실에 가서 [보상 받기]로 받는다.`
      : `**${c.name}**${c.room ? ` — 부실: ${[c.floor, c.room].filter(Boolean).join(' ')}` : ''}. ${mine ? '내 동아리가 아니라 미리 보기만 할 수 있다.' : '아직 가입한 동아리가 없다. 가입하면 부실에서 이 할일을 하고 보상을 받는다.'} (납품 · 토벌은 지금 가입하면 이번 주에 받게 될 것)`, 'club-intro'));
    const sec = (title, small, rows, meta) => {
      const box = h('section', 'club-sec'); box.setAttribute('aria-label', title);
      const head = h('p', 'club-sec-head'); head.append(h('b', '', title), h('small', '', small)); box.append(head);
      const ul = h('ul', 'club-list'); rows.forEach((q) => ul.append(clubRow(q, isMine))); box.append(ul);
      const ul2 = h('ul', 'club-list club-meta'); meta.forEach((q) => ul2.append(clubRow(q, isMine))); box.append(ul2);
      return box;
    };
    panelBody.append(sec('오늘의 할일', '매일 0시에 새로', b.daily, [b.dailyMeta]));
    panelBody.append(sec('이번주에 할일', `일요일 0시에 새로 · 이번 주 수준 ${b.tier}단계 (스탯 평균 ${b.avg ?? '—'})`, b.weekly, b.weeklyMeta));
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
  function renderProfileCard(p, root = panelBody, inPop = false) { // vD.02.3 root: 팝업(내 프로필 창)에도 같은 카드
    const card = h('div', 'profile-card');
    const avatar = h('div', 'profile-avatar'); avatarInto(avatar, p.photo, p.name);
    const info = h('div', 'profile-info');
    info.append(h('small', 'profile-title', p.title && ownsTitle(p.title) ? `「${titleById[p.title].name}」` : '칭호 없음'), h('h3', '', p.name));
    const meta = h('p', 'profile-meta'); meta.append(h('span', '', `${Number(p.grade) >= 1 ? `${p.grade}학년` : '학년 —'}`), h('span', '', `나이 ${p.age || '—'}`), h('span', '', `성별 ${p.gender || '—'}`));
    if (save.story.heirloom) meta.append(h('span', '', `유품 ${HEIRLOOM[save.story.heirloom]?.name ?? ''}`));
    info.append(meta, h('p', 'profile-intro', p.intro || '(한줄소개가 비어 있다)'));
    card.append(avatar, info);
    root.append(card, h('div', 'panel-rule'));
    const grid = h('div', 'profile-stats'); const st = statsNow();
    R.statKeys.forEach((k) => { const c = h('div', 'profile-stat'); c.title = R.stats[k].detail; c.append(h('span', '', R.stats[k].label), h('b', '', String(Math.floor(st[k] ?? 1)))); grid.append(c); });
    root.append(h('p', 'panel-label', '육조 스탯'), grid);
    const pick = h('div', 'profile-field');
    const sel = h('select'); sel.id = 'profileTitleSelect';
    sel.append(new Option('칭호 없음', ''));
    // V.01 같은 기능끼리 묶어 낮은 효과 → 높은 효과 순. 육조 보정은 안목 · 호전 · 인내 · 절제 · 신속 · 이해 순, 기능 없는 최종 칭호는 맨 아래
    titleGroups(ownedTitles()).forEach(([label, list]) => {
      const g = document.createElement('optgroup'); g.label = label;
      list.forEach((t) => g.append(new Option(`${t.name} — ${t.perkText ?? ''}`, t.id, false, p.title === t.id)));
      sel.append(g);
    });
    sel.addEventListener('change', () => { p.title = sel.value || null; persist(); renderStatus(); if (inPop) openMyProfile(); else route(); });
    const lab = h('label', '', `칭호 고르기 (가진 칭호 ${ownedTitles().length} / ${TITLES.length})`); lab.htmlFor = sel.id;
    pick.append(lab, sel);
    if (p.title && titleById[p.title]) pick.append(h('small', '', titleById[p.title].desc), h('small', 'perk-line', `기능 — ${titleById[p.title].perkText ?? '없음'}`));
    else pick.append(h('small', '', '칭호를 달면 그 칭호의 기능 하나가 듣는다.'));
    root.append(pick);
    const foot = h('div', 'profile-actions');
    foot.append(btn('ghost-btn', '프로필 고치기', () => { if (inPop) myProfileDialog.close(); openProfile(true); }), btn('ghost-btn', '업적 / 도감', () => { if (inPop) myProfileDialog.close(); openCodex('titles'); }));
    if (window.BiryeongOpening) foot.append(btn('ghost-btn', '오프닝 다시 보기', () => window.BiryeongOpening.play({ replay: true })));
    if (window.BiryeongParty?.openFriends) { const fb = btn('ghost-btn', '친구 목록', () => window.BiryeongParty.openFriends()); fb.dataset.openFriends = ''; foot.append(fb); } // vD.04.2 우정 편지를 주고받은 사람
    root.append(foot, h('p', 'panel-fine', Auth.server ? '프로필과 진행 기록은 비령 서버에 함께 보관됩니다. 다른 기기에서도 같은 아이디로 이어집니다.' : '프로필과 진행 기록은 이 브라우저에만 보관됩니다. 다른 기기와는 아직 이어지지 않습니다.'));
  }
  function renderProfileForm(p) {
    const creating = !p;
    const draft = { name: p?.name ?? '', age: p?.age ?? '', grade: Number(p?.grade) || 0, gender: p?.gender ?? '', intro: p?.intro ?? '', photo: p?.photo ?? null, stats: p ? { ...p.stats } : blankStats() };
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
    // vD.02.3 학년 — 나이와 따로 고른다(빠른년생 · 한 해 쉰 사람도 있으니). 동아리 · 학생기록부는 이 학년을 따른다.
    const gradeWrap = h('div', 'profile-field'); const gradeLab = h('label', '', '학년'); gradeLab.htmlFor = 'pfGrade';
    const gradeSel = h('select'); gradeSel.id = 'pfGrade'; gradeSel.required = true;
    gradeSel.append(new Option('학년을 고른다', ''), ...[1, 2, 3].map((g) => new Option(`${g}학년`, String(g), false, draft.grade === g)));
    gradeWrap.append(gradeLab, gradeSel, h('small', '', '나이와 상관없이 이 학년으로 지낸다. 동아리 · 학생기록부에 이 학년으로 적힌다.')); form.append(gradeWrap);
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
      const grade = Number(gradeSel.value) || 0;
      if (!grade) { error.textContent = '학년을 골라 주세요.'; error.hidden = false; gradeSel.focus(); return; }
      if (creating && spent() < R.startPoints) { error.textContent = `남은 스탯 ${R.startPoints - spent()}점을 모두 나눠 주세요.`; error.hidden = false; return; }
      const base = p ?? { stats: draft.stats, title: null, hp: R.hpMax, mp: R.mpMax, spirit: R.spiritStart, money: R.startMoney, inventory: {}, createdAt: Date.now() };
      save.profile = Object.assign(base, { name, age: ageIn.value.trim(), grade, gender: genderIn.value.trim(), intro: introIn.value.trim(), photo: draft.photo });
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
        const chip = h('span', `status-cond${c.heavy ? ' is-heavy' : ''}${c.id === 'weak' ? ' is-weak' : ''}${c.good ? ' is-good' : ''}`);
        chip.dataset.cond = c.id; chip.tabIndex = 0; chip.setAttribute('aria-label', `${c.name} — 남은 시간 ${c.left}`); // vD.01 마우스를 올리면 바로 위에 설명(condTip)
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
      npcBox.replaceChildren(...(act.length ? [h('p', 'npc-tracker-head', `받은 부탁 ${act.length} / 2`)] : []), ...act.map((q) => { const r = h('p', `npc-tracker-row${q.done ? ' is-done' : ''}`); r.append(h('b', '', q.npc), ` 「${q.title}」 ${q.goal} · ${q.cur}/${q.need}`, h('small', '', q.done ? ` → ${q.where}에서 마친다` : ` (${q.where})`)); return r; }));
    }
    const stats = statsNow();
    const eff = (() => { try { return api?.effStats?.() ?? null; } catch (_) { return null; } })();
    $('#statusStats').replaceChildren(...R.statKeys.map((k) => {
      const now = Math.floor(stats[k] ?? 1), cost = now * 10, can = !!p && spirit >= cost && now < R.statMax;
      const diff = eff && Number.isFinite(eff[k]) ? Math.floor(eff[k]) - now : 0; // vC.06 무구 · 장신구 · 칭호 · 음식 보정(쇠약 · 몸의 이상은 깎는다)
      const c = h('div', 'status-stat'); c.dataset.statTip = k; c.tabIndex = 0; // vD.04 마우스를 올리면 스탯 설명
      const up = btn('status-stat-up', '+', () => raiseStat(k));
      up.disabled = !can; up.title = !p ? '프로필을 먼저 만든다' : now >= R.statMax ? '더 올릴 수 없다' : `영력 ${cost} 로 ${R.stats[k].label} +1`;
      up.setAttribute('aria-label', `${R.stats[k].label} 올리기 (영력 ${cost})`);
      const val = h('b', '', String(now));
      if (diff) { const d = h('em', `status-stat-bonus${diff < 0 ? ' is-down' : ''}`, `(${diff > 0 ? '+' : '−'}${Math.abs(diff)})`); d.title = diff > 0 ? `장비 · 보정을 더하면 ${now + diff}` : `쇠약 · 몸의 이상으로 지금은 ${now + diff}`; val.append(d); }
      c.append(h('span', '', R.stats[k].label), val, up, h('small', '', `영력 ${cost}`));
      return c;
    }));
    $('#statusMoney').textContent = `${Math.floor(g?.money ?? p?.money ?? 0)}냥`;
    { const sq = $('#statusQuest'); if (sq) sq.textContent = window.BiryeongQuest ? window.BiryeongQuest.progressText() : ''; }
    { const sa = $('#statusAdapt'); if (sa && window.BiryeongAdapt) sa.textContent = window.BiryeongAdapt.progressText(); }
  }
  /** 실행 화면이 바꾼 값(game · counts · playLog)을 다시 읽는다. */
  function refreshFromPlay() { pullPlay(); renderStatus(); checkAchievements(); try { checkClubAlerts(); } catch (_) { /* 동아리 알림은 다음에 */ } }
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
    // vD.06.7b: 미습득 영능력도 이름과 '얻는 방법'을 공개한다. 의지력/설명/스탯은 습득 후에만 공개한다.
    const p = dexPlayer(), mine = new Set(p.psychics || []);
    const known = (x) => dexAll() || x.always || mine.has(x.id);
    const draw = (list, x, mark) => {
      const k = known(x), card = h('div', `dex-card${k ? ' is-got' : ' is-name-only'}`); card.dataset.dexPsychic = x.id; card.dataset.known = k ? '1' : '0';
      const head = h('div', 'dex-head'); head.append(h('span', 'dex-icon is-skill', mark), h('strong', '', x.name), h('small', '', k ? (x.always ? '처음부터' : x.stolen ? '빼앗음' : '익힘') : '미습득'));
      card.append(head);
      if (k) card.append(h('p', 'dex-note', x.note), dexLine('의지력 소모', x.mp), dexLine('상세 설명', x.detail || x.note), dexLine('영향받는 스탯', x.affects));
      // 획득 여부와 무관하게 실제 도감 자료에 기록된 획득 조건을 보여준다.
      card.append(dexLine('얻는 방법', x.cond || '아직 정해지지 않았다.', 'is-from'));
      // V.01 아직 못 얻었으면 지금까지 채운 횟수(n회 / n회)
      if (!k && !dexAll()) { const pr = psyProgress(x, p); if (pr) card.append(dexLine('지금까지', pr, 'is-progress')); }
      list.append(card);
    };
    // V.01 진행: 빼앗은 영능력은 그 적을 쓰러뜨린 수, 기본 영능력은 실행 화면이 세는 칸
    const psyProgress = (x, pl) => {
      if (x.stolen) {
        const n = Math.max(0, ...(x.src || []).map((id) => Number(pl.killCount?.[id]) || 0));
        if (!x.boss) return `처치 ${n}회 / 30회`;
        const pair = CODEX.psychics.filter((y) => y.stolen && y.boss && (y.src || []).some((id) => (x.src || []).includes(id)));
        const owned = pair.filter((y) => mine.has(y.id)).length;
        return `보스 처치 ${n}회 / ${20 * (owned + 1)}회${pair.length > 1 && !owned ? ' (20회째에 둘 중 하나 · 40회째에 나머지)' : ''}`;
      }
      return playApi()?.psyProgress?.(x.id)?.text || null;
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

  // vD.02.3 내 프로필도 화면을 바꾸지 않고 위에 뜬다(닫으면 보던 화면 그대로). 프로필이 아직 없으면 만들기 화면으로.
  const myProfileDialog = $('#myProfileDialog');
  function openMyProfile() {
    const p = profile();
    if (!p) { go('#/profile'); return; }
    const body = $('#myProfileBody'); body.replaceChildren();
    renderProfileCard(p, body, true);
    if (!myProfileDialog.open) { try { myProfileDialog.showModal(); } catch (_) { myProfileDialog.setAttribute('open', ''); } }
  }
  $('#myProfileClose').addEventListener('click', () => myProfileDialog.close());
  myProfileDialog.addEventListener('click', (e) => { if (e.target === myProfileDialog) myProfileDialog.close(); });
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
    pullPlay(); checkAchievements();
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
        const r = row(got, t.name, got ? t.desc : source ? `업적 [${source.name}] — ${source.hint}` : t.from === 'story' ? '본편 이야기에서 얻는다.' : '아직 얻을 방법이 알려지지 않았다.', side);
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
    else if (head === 'clubs') renderClubs(); // V.01 동아리 창
    else if (head === 'notes') { location.replace('#/clubs'); return; } // V.01 업데이트 노트 창은 없앴다
    else if (head === 'case') renderCase(rest[0]);
    else if (head === 'money') renderMoney();
    else if (head === 'market') renderMarket(); // vD.03 벼룩시장
    else if (head === 'cafe') renderCafe(); // vD.04 카페 정산
    else if (head === 'adapt') { if (window.BiryeongAdapt) window.BiryeongAdapt.page(); else { openPage('適 / ADAPTATION', '적응 퀘스트', 'simple'); panelBody.append(para('적응 퀘스트를 불러오는 중이다. 새로고침해 줘.')); } }
    else if (head === 'admin' && Auth.isAdmin()) renderAdmin(rest[0]);
    else if (head === 'out' && window.BiryeongQuest) window.BiryeongQuest.renderPlace(rest[0], rest[1]); // 산문 너머의 바깥 지역 · 새 층
    else { location.replace('#/'); return; }
    window.dispatchEvent(new CustomEvent('biryeong:route', { detail: { hash: location.hash, parts } }));
    if (head) { const top = pageView.getBoundingClientRect().top; if (top < 70 || top > window.innerHeight * 0.45) window.scrollTo({ top: window.scrollY + top - 84, behavior: 'smooth' }); }
  }
  // vB.01: 시간이 드는 행동 중에 다른 페이지로 나가려 하면 한 번 더 묻는다(나가면 그 행동은 멈추고 보상은 없다).
  let lastHash = location.hash, skipHash = false;
  function leaveAsk(onYes, what = '', left = '') {
    const wrap = h('div', 'leave-ask'); const box = h('div', 'leave-ask-box'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    box.append(h('p', 'leave-ask-text', '정말 나가겠습니까? 지금 나가면 보상을 얻을 수 없습니다.'));
    // V.01 지금 무엇을 기다리는 중이고, 끝나기까지 얼마나 남았는지
    if (what || left) box.append(h('p', 'leave-ask-left', `${what ? `지금 ${what} 중` : ''}${what && left ? ' · ' : ''}${left ? `끝나기까지 ${left} 남음` : ''}`));
    const row = h('div', 'leave-ask-row');
    const close = () => wrap.remove();
    row.append(btn('solid-btn', '예', () => { close(); onYes(); }), btn('ghost-btn', '아니오', close));
    box.append(row); wrap.append(box); document.body.append(wrap); row.lastChild.focus();
  }
  window.addEventListener('hashchange', () => {
    if (skipHash) { skipHash = false; lastHash = location.hash; return; }
    const busy = playApi()?.busy?.() || (window.BiryeongBeastEvent?.busy?.() ? '청화호수 대기' : ''); // vD.06.1 이벤트 대기도 같이 묻는다
    if (busy && location.hash !== lastHash) {
      const target = location.hash;
      skipHash = true; location.replace(lastHash || '#/'); // 일단 제자리로
      const left = playApi()?.busy?.() ? playApi()?.busyLeft?.() : window.BiryeongBeastEvent?.busyLeft?.();
      leaveAsk(() => { playApi()?.interrupt?.('자리를 떠나'); window.BiryeongBeastEvent?.cancelWait?.(); location.hash = target; }, busy, left || '');
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
  const HERO_LINKS = { red: 'https://docs.google.com/document/d/1K2-S1SxB3rrrBRc1oMBVMZRg9Nbv8XIJ5Lbwo2yoii4/edit?tab=t.0', yellow: 'https://cafe.naver.com/biryungkic102' };
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
  $('#journalBtn').addEventListener('click', () => openMyProfile()); // vD.02.3 팝업
  $('#statusWho').addEventListener('click', () => openMyProfile());
  $('#accountName').textContent = Auth.session();
  $('#accountBtn').addEventListener('click', () => { if (window.confirm('로그아웃할까요? 기록은 이 브라우저에 그대로 남습니다.')) { try { playApi()?.save(); } catch (_) { /* 무시 */ } Auth.logout(); } });
  // vD.03 관리자 도구는 메뉴 아래의 작은 단추로(그 자리에는 벼룩시장)
  if (Auth.isAdmin()) { const slot = $('[data-admin-slot]'); const b = btn('status-admin-btn', '', () => go('#/admin')); b.dataset.menu = 'admin'; b.append(h('i', '', '管'), h('span', '', '관리자 도구')); slot.append(b); }
  const MENU = {
    inventory: () => { const api = playApi(); if (api) api.openInventory(); else go('#/profile'); },
    adapt: () => go('#/adapt'), // vD.03.2 본편 퀘스트(산문으로 가기) 단추 자리에 적응 퀘스트
    quest: () => go('#/zone/north'), codex: () => openCodex(), money: () => go('#/money'), clubs: () => go('#/clubs'),
    market: () => go('#/market'), // vD.03
    cafe: () => go('#/cafe'), // vD.04
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
    h, btn, para, go, back, route, openPage, setTabs, toast, ding, sfxOn, chatSoundOn, setChatSound, mark, addTo, persist, playApi, zoneHash, placeHash, renderStatus, emptyBox, needProfile,
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
