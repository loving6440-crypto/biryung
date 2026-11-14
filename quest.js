/* 秘靈 · 비령 — 본편 퀘스트(3권 15장 · 장면 퀘스트 97개)를 돌리는 곳.
 *
 * 데이터: story-data.js (스토리 원고에서 만든다 — 직접 고치지 않는다)
 * 화면  : 산문 › 산문 너머(#/zone/north) = 퀘스트 보드 · 장소 · 기록 · 세계 / 바깥 지역(#/out/<지역>/<지점>) / 오른쪽 상태 창의 진행 추적 / 대사 창
 * 저장  : save.story.q  (계정마다 따로 — app.js 가 적는다)
 *
 * 퀘스트는 한 페이지에서 끝나지 않는다. 단계마다 "어디에서(w) 무엇을(n)" 이 정해져 있고,
 *   · 그 자리에 가면(주소가 그 장소면) 대사가 이어지고
 *   · 탐사 지점 · 전투 · 개척 · 제작 · 수업처럼 실제 게임에서 생긴 일(biryeong:quest 이벤트)을 듣고 다음으로 넘어간다.
 *   · 새 장소(서울 · 청암리 · 물치항 · 관측 밖 · 거대한 문 너머 · 경계)는 #/out 페이지에서 걸어 다닌다.
 *
 * 단계의 need(n):  visit:<탐사 지점>  spot:<바깥 지점>  win  gather×n  site:<터>|<터>  craft  cook  lesson:<과목>×n  zone:<구역>  flag:shrineSign
 *                  battle:<상대>×n|calm(이야기 전투 단추)  maze:<규칙>(갈림길)  act:<글>×n(행동 단추)
 *          v1.3 — make:<아이템>(직접 만들기)  have:<아이템>[*k](지니고 그 자리로)  use:<아이템>[*k][×n](그 자리에서 써서 없애기)  equip:heir(유품 무구 장착)  enhance
 * 단계의 덤(v1.3): give(마치면 받는 것) · learn / kit(단계가 열릴 때 배우는 본편 제작법과 재료) · heir(고른 유품의 무구를 실제로 받는다) · alt(앞 선택에 따라 바뀌는 need)
 * 보스: battle:<상대> 단추가 부르는 이야기 전투에는 보스마다 고유 패턴이 붙는다(systems/play/src/storyBoss.js). 이기면 전리품 + 전리품 제작법.
 * 서버(Supabase)가 붙으면 선택과 공동 사건 기여를 sync.js 가 올리고, 세계 탭이 서버 집계를 보여 준다. 없으면 이 브라우저의 값만 쓴다.
 */
(() => {
  'use strict';
  const App = window.BiryeongApp, D = window.BIRYEONG_QUESTS;
  if (!App || !D) return;
  const { h, btn, para, go, toast } = App;
  const Sync = () => window.BiryeongSync || null;
  const SCENES = D.scenes, byId = Object.fromEntries(SCENES.map((s) => [s.id, s]));
  const CIRC = '①②③④⑤⑥⑦⑧⑨⑩';
  /* 유품 10종 = 게임의 무구 10종. 둘씩 다섯 계통(방울 · 부채 · 거울 · 칼 · 오색천). save.story.heirloom 에는 무구 id(w-…)를 적는다. */
  const HEIRS = D.heirlooms || [];
  const OLD_HEIR = { bell: 'w-bell', fan: 'w-fan', mirror: 'w-spear', blade: 'w-sword', cloth: 'w-dagger' }; // v1.2 까지의 다섯 유품
  const WEAPON_NAME = { 'w-bell': '공명 방울', 'w-mace': '충격 철퇴', 'w-fan': '위상 부채', 'w-staff': '육환 석장', 'w-bow': '전자 각궁', 'w-spear': '관측창', 'w-sword': '신칼', 'w-sickle': '절단 낫', 'w-dagger': '회로 단검', 'w-instrument': '장단 변조기' };
  const itemName = (id) => { try { return App.playApi()?.itemName(id) || WEAPON_NAME[id] || id; } catch (_) { return WEAPON_NAME[id] || id; } };
  const heir = () => HEIRS.find((x) => x.weapon === save().story.heirloom) || null;
  const lineKey = () => heir()?.key || '';
  const MAIN = ['서창현', '윤진서', '비', '△△', '연호수'];

  /* ───────── 인물 인장 · 초상 자리 ─────────
   * 초상 그림이 생기면 config.js 의 BIRYEONG_PORTRAITS 에 { '서창현': 'assets/portraits/changhyeon.png' } 처럼 적는다.
   * 없는 동안은 머리색 단색 인장(둥근 도장)으로 대신한다. 테두리는 금색 동양풍 액자. */
  const CAST = {
    서창현: { hair: '#1c2231', ink: '#e9edf7' }, 윤진서: { hair: '#7b4a32', ink: '#fff2e2' }, 비: { hair: '#ebe7de', ink: '#3a3226' },
    '△△': { hair: '#9fb0d8', ink: '#1b2440' }, 연호수: { hair: '#2c4a48', ink: '#e6f5f0' }, 비령: { hair: '#0f5f66', ink: '#c9fbff' }, PC: { hair: '#5d6170', ink: '#f1f1f4' },
  };
  const EXTRA_HAIR = ['#3b3a40', '#54463c', '#6c6a66', '#2f3a4a', '#4a3f52', '#5a4a36', '#39453d', '#7a7468'];
  const hairOf = (who) => { if (CAST[who]) return CAST[who]; let n = 0; for (const c of who) n = (n * 31 + c.charCodeAt(0)) % 9973; return { hair: EXTRA_HAIR[n % EXTRA_HAIR.length], ink: '#f2ecdf' }; };
  const PORTRAITS = window.BIRYEONG_PORTRAITS || {};
  function portrait(who, shown) {
    const box = h('div', 'pt-frame'); box.dataset.who = who;
    for (const c of ['tl', 'tr', 'bl', 'br']) box.append(h('i', `pt-corner pt-${c}`));
    const src = PORTRAITS[who] || PORTRAITS[who.replace(/\(.*\)$/, '')];
    if (src) { const img = new Image(); img.className = 'pt-img'; img.alt = `${shown} 초상`; img.src = src; img.addEventListener('error', () => img.replaceWith(seal(who, shown))); box.append(img); }
    else box.append(seal(who, shown));
    return box;
  }
  function seal(who, shown) {
    const base = who.replace(/\(.*\)$/, ''); const c = hairOf(base);
    const s = h('span', 'pt-seal', [...shown][0] || '?'); s.style.setProperty('--hair', c.hair); s.style.setProperty('--ink', c.ink); s.setAttribute('aria-hidden', 'true');
    return s;
  }

  /* ───────── 상태 ───────── */
  const save = () => App.save;
  function Q() {
    const st = save().story;
    if (!st.q) st.q = {};
    const q = st.q;
    for (const [k, v] of Object.entries({ done: {}, step: 0, prog: {}, flags: {}, pick: {}, picked: {}, fx: {}, trust: {}, world: {}, calm: {}, regions: {}, keep: [], taint: 0 })) if (q[k] == null) q[k] = v;
    for (const k of MAIN) if (q.trust[k] == null) q.trust[k] = k === '△△' ? 0 : 30;
    for (const [k, v] of Object.entries(D.world)) if (q.world[k] == null) q.world[k] = v;
    for (const k of ['given', 'kit', 'beaten', 'got']) if (q[k] == null) q[k] = {};
    if (OLD_HEIR[st.heirloom]) { st.heirloom = OLD_HEIR[st.heirloom]; if (q.flags['B1-1']) q.flags['B1-1'] = HEIRS.findIndex((x) => x.weapon === st.heirloom) + 1; } // 옛 저장분: 다섯 유품 → 무구 id
    return q;
  }
  const persist = () => App.persist();
  const playerName = () => App.profile()?.name || '학생';
  const godName = () => Q().god?.name || '';

  /* 이름 넣기: OO = 플레이어, △△ = 플레이어가 지어 준 신의 이름(조사는 받침에 맞춘다) */
  const hasBatchim = (word) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : /[13678lmnr]$/i.test(word); };
  const rieul = (word) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 8; };
  function fill(text) {
    const g = godName() || '이름 없는 것', b = hasBatchim(g);
    return String(text)
      .replace(/△△\(이\)가/g, g + (b ? '이' : '가')).replace(/△△\(은\)는/g, g + (b ? '은' : '는')).replace(/△△\(을\)를/g, g + (b ? '을' : '를'))
      .replace(/△△\(과\)와/g, g + (b ? '과' : '와')).replace(/△△\(이\)다/g, g + (b ? '이다' : '다')).replace(/△△\(이\)랑/g, g + (b ? '이랑' : '랑'))
      .replace(/△△\(으\)로/g, g + (b && !rieul(g) ? '으로' : '로')).replace(/△△/g, g).replace(/OO/g, playerName())
      .replace(/\{유품\}/g, heir()?.name || '유품').replace(/\{무구\}/g, heir() ? itemName(heir().weapon) : '무구');
  }

  /* ───────── 조건 ───────── */
  function ok(conds, scene) {
    const q = Q();
    return (conds || []).every((c) => {
      if (c.pick) return c.pick.includes(q.pick[scene?.id]);
      if (c.flag) return c.in.includes(q.flags[c.flag]);
      if ('god' in c) return !!q.god === c.god;
      if (c.calm) return !!q.calm[scene?.id];
      if (c.trust) return (q.trust[c.trust] || 0) >= c.min;
      if (c.ending) return q.ending === c.ending;
      return true;
    });
  }
  /** 히든 엔딩 조건(이 브라우저 기준. 서버가 붙으면 세계 값이 서버 집계로 바뀐다) */
  function hiddenOpen() {
    const q = Q(), w = q.world;
    return !!q.god && q.flags['B9-1'] !== 1 && !!q.done['13-05'] && (w['W_새계약'] || 0) >= 3 && [3, 4].includes(q.flags['B10-1'])
      && w['W_신탁신뢰'] >= 40 && w['W_신탁신뢰'] <= 69 && w['W_신격관계'] >= 40;
  }
  function decideEnding() {
    const q = Q(), w = q.world;
    if (w['W_경계안정'] < 30) return 'D';
    if (q.flags['B15-1'] === 4 && hiddenOpen() && q.flags['B15-2'] === 3) return 'E';
    if (q.flags['B15-1'] === 1) return 'A';
    if (q.flags['B15-1'] === 3) return 'C';
    return 'B';
  }

  /* ───────── 진행 ───────── */
  const current = () => SCENES.find((s) => !Q().done[s.id] && ok(s.c, s) && !(s.id.startsWith('15-') && /[A-E]$/.test(s.id) && !Q().ending)) || null;
  const doneCount = () => SCENES.filter((s) => Q().done[s.id]).length;
  const total = SCENES.filter((s) => !/15-[A-E]/.test(s.id)).length + 1;
  function activeStep(scene) {
    const q = Q();
    while (q.step < scene.steps.length && !ok(scene.steps[q.step].c, scene)) { q.step += 1; q.prog = {}; }
    return scene.steps[q.step] || null;
  }
  const parseNeed = (n) => {
    const m = /^([a-zA-Z]+)(?::(.*?))?(?:×(\d+))?(\|calm)?$/.exec(n) || [];
    const [id, k] = (m[2] || '').split('*');
    return { type: m[1], arg: m[2] || '', id, per: Number(k || 1), count: Number(m[3] || 1), calm: !!m[4] };
  };
  const BUTTON = new Set(['battle', 'maze', 'act', 'use']);            // 그 자리에서 단추로 하는 것
  const AT_PLACE = new Set([...BUTTON, 'have']);                         // 그 자리에 가야 하는 것
  const api = () => { try { return App.playApi(); } catch (_) { return null; } };
  const countOf = (id) => api()?.count(id) || 0;
  /** 이 단계의 need — 앞 선택에 따라 바뀌면(alt) 바뀐 것 */
  function needsOf(st) {
    if (!st.alt) return st.n || [];
    for (const [flag, by] of Object.entries(st.alt)) { const v = Q().flags[flag]; if (by[v]) return by[v]; }
    return st.n || [];
  }
  function needState(scene, st) {
    const q = Q();
    return needsOf(st).map((raw, i) => {
      const n = parseNeed(raw); let have = q.prog[i] || 0;
      if (n.type === 'flag' && n.arg === 'shrineSign' && App.game()?.shrineSignRead) have = 1;
      if (n.calm && q.calm[scene.id]) have = n.count;
      if (n.type === 'have') have = countOf(n.id) >= n.per ? 1 : 0;
      if (n.type === 'equip') have = heir() && api()?.equippedBase() === heir().weapon ? 1 : 0;
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
  const NEED_TEXT = { visit: '탐사 지점 살피기', spot: '찾아가기', win: '전투 승리', gather: '개척 채집 · 수렵', site: '개척 터 들어가기', craft: '공작소 제작', cook: '조리', lesson: '수업 마치기', zone: '구역 들르기', flag: '표지판 읽기', battle: '전투', maze: '길 찾기', act: '행동', enhance: '무구보관소에서 무구 강화' };
  /** 할 일 한 줄 */
  function needLine(n) {
    const name = n.id ? itemName(n.id) : '';
    if (n.type === 'make') return `「${name}」 직접 만들기${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''}`;
    if (n.type === 'have') return `「${name}」${n.per > 1 ? ` ${n.per}개` : ''} 지니고 가기 (지금 ${countOf(n.id)}개)`;
    if (n.type === 'use') return `「${name}」${n.per > 1 ? ` ${n.per}개씩` : ''} 쓰기${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''} (지금 ${countOf(n.id)}개)`;
    if (n.type === 'equip') return heir() ? `「${itemName(heir().weapon)}」 장착하기 — 소지품에서` : '유품 무구 장착하기';
    if (n.type === 'battle') { const foe = D.foes[n.arg]; return `${foe?.name || '상대'}${n.calm ? ' — 진정시키거나 쓰러뜨리기' : ' 퇴마'}${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''}`; }
    return `${NEED_TEXT[n.type] || n.type}${n.count > 1 ? ` ${Math.min(n.have, n.count)}/${n.count}` : ''}`;
  }

  let busy = false, timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(tick, 380); };
  function tick() {
    if (busy || !App.profile()) { drawTracker(); return; }
    const scene = current();
    if (!scene) { drawTracker(); return; }
    const q = Q();
    if (q.cur !== scene.id) { q.cur = scene.id; q.step = 0; q.prog = {}; persist(); }
    const st = activeStep(scene);
    if (!st) { finishQuest(scene); return; }
    if (st.w.startsWith('out:')) unlockRegion(st.w.slice(4).split('/')[0]);
    if ((st.learn || st.kit) && !q.kit[`${scene.id}.${q.step}`]) openKit(scene, st);
    const needs = needState(scene, st);
    const real = needs.some((n) => !AT_PLACE.has(n.type));
    const ready = needs.every((n) => n.done) && (real || atPlace(st.w));
    if (!ready) { drawTracker(); return; }
    const end = () => { stepDone(scene, st); };
    if (st.l) { busy = true; playLines(scene, st.l[0], st.l[1], () => { busy = false; end(); }); } else end();
  }
  /** 단계가 열릴 때: 본편 제작법을 배우고 재료를 받는다(한 번만) */
  function openKit(scene, st) {
    const q = Q(), a = api(); if (!a) return;
    q.kit[`${scene.id}.${q.step}`] = Date.now();
    const learned = a.unlockRecipes(st.learn || []);
    if (st.kit) a.grant({ items: st.kit, log: `재료를 받았다 — ${Object.entries(st.kit).map(([id, n]) => `${itemName(id)} ×${n}`).join(', ')}` });
    persist();
    if (learned.length || st.kit) card({ kind: 'recipe', head: learned.length ? '새 제작법' : '받은 재료', title: learned.length ? learned.map((r) => `「${r.name}」`).join(' · ') : '', lines: [
      ...(learned.length ? [`${st.k === '조리' || /조리/.test(st.p) ? '조리실' : '공작소'}의 제작법 목록에 들어왔다.`] : []),
      ...(st.kit ? [`받은 재료 — ${Object.entries(st.kit).map(([id, n]) => `${itemName(id)} ×${n}`).join(' · ')}`] : []),
    ] });
  }
  function stepDone(scene, st) {
    const q = Q(), a = api();
    if (st.keep && !q.keep.includes(st.keep)) q.keep.push(st.keep);
    const got = [];
    if (st.give && a) {
      a.grant({ items: st.give, log: `본편: ${Object.entries(st.give).map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ''}`).join(', ')}을(를) 받았다.` });
      for (const [id, n] of Object.entries(st.give)) { q.given[id] = (q.given[id] || 0) + n; got.push(`${itemName(id)}${n > 1 ? ` ×${n}` : ''}`); }
    } else if (st.keep) toast('간직한 것', st.keep);
    if (st.heir && heir() && a && !q.given[heir().weapon]) {
      const name = a.giveHeirloom(heir().weapon, heir().enh);
      if (name) { q.given[heir().weapon] = 1; card({ kind: 'heir', head: '유품이 무구가 되었다', title: `「${name}」`, sub: `${heir().name} · ${heir().line} 계통`, lines: [heir().note, '부모의 손길 — 강화 1이 붙은 채로 받았다.', '소지품을 열어 장착하자. 무구보관소에서 더 강화할 수 있다.'], btn: '소지품 열기', act: () => a.openInventory() }); }
    }
    if (got.length) card({ kind: 'item', head: '받은 것', title: got.join(' · '), lines: [st.keep && st.keep !== got[0] ? `간직한 것 — ${st.keep}` : '소지품에 들어왔다. 본편 도감(산문 너머 › 나의 기록)에서 다시 볼 수 있다.'] });
    if (st.sv) Sync()?.contrib(st.sv, 1);
    q.step += 1; q.prog = {}; persist();
    tick();
  }
  function finishQuest(scene) {
    const q = Q();
    q.done[scene.id] = Date.now(); q.step = 0; q.prog = {};
    if (scene.id === '13-05') q.godRefused = true;
    if (scene.id === '15-04') q.ending = decideEnding();
    const spirit = 4 + scene.ch * 2, money = 5 + scene.ch * 3;
    try { App.playApi()?.grant({ spirit, money, log: `본편 「${scene.title}」을(를) 마쳤다. 영력 +${spirit}, ${money}냥.` }); } catch (_) { /* 실행 화면이 아직 없으면 넘어간다 */ }
    persist();
    const title = (window.BIRYEONG_TITLES || []).find((t) => t.id === `st-${scene.id}`);
    App.grantTitle(`st-${scene.id}`);
    banner(scene, [`영력 +${spirit}`, `${money}냥`, ...(title ? [`칭호 「${title.name}」`] : [])]);
    if (/15-[A-E]/.test(scene.id)) card({ kind: 'ending', head: `엔딩 ${scene.id.slice(-1)}`, title: `《${scene.title}》`, sub: `본편 완결 · ${playerName()}`, lines: [`퇴마한 신탁 ${Object.keys(q.beaten).length} / ${Object.keys(D.foes).length}`, `이름을 준 신 — ${q.god?.name || '없음'}`, `유품 — ${heir()?.name || '없음'}`, '산문 너머 › 퀘스트에서 지나온 장면을 다시 볼 수 있다.'] });
    const chapterScenes = SCENES.filter((s) => s.ch === scene.ch && !/15-[A-E]/.test(s.id));
    if (!/15-[A-E]/.test(scene.id) && chapterScenes.every((s) => q.done[s.id])) chapterCard(scene.ch, title);
    Sync()?.progress(doneCount());
    App.renderStatus();
    if (/^#\/zone\/north/.test(location.hash)) App.route(); else tick();
  }
  function unlockRegion(reg) { const q = Q(); if (!q.regions[reg]) { q.regions[reg] = Date.now(); persist(); toast('산문 너머', `「${D.regions[reg].name}」(으)로 가는 길이 열렸다.`); } }

  /* 게임에서 생긴 일 듣기 */
  function onEvent(type, id) {
    if (!App.profile()) return;
    if (type === 'storyBattle' && id) afterStoryBattle(id);
    const scene = current(); if (!scene) return;
    const st = activeStep(scene); if (!st || !st.n) return;
    const q = Q(); let hit = false;
    needState(scene, st).forEach((n) => {
      if (n.done) return;
      const match = (n.type === 'visit' && type === 'visit' && id === n.arg) || (n.type === 'spot' && type === 'spot' && id === n.arg) || (n.type === 'win' && type === 'win')
        || (n.type === 'gather' && type === 'gather') || (n.type === 'site' && type === 'site' && n.arg.split('|').includes(id)) || (n.type === 'craft' && type === 'craft')
        || (n.type === 'cook' && type === 'cook') || (n.type === 'lesson' && type === 'lesson' && id === n.arg) || (n.type === 'zone' && type === 'zone' && id === n.arg)
        || (n.type === 'flag' && type === n.arg) || (n.type === 'battle' && type === 'storyBattle' && id?.key === n.arg && id.win)
        || (n.type === 'enhance' && type === 'enhance');
      if (match) { q.prog[n.i] = (q.prog[n.i] || 0) + 1; hit = true; }
      if (n.type === 'make' && type === 'make' && id?.id === n.id) { q.prog[n.i] = (q.prog[n.i] || 0) + (id.qty || 1); hit = true; }
    });
    if (type === 'storyBattle' && id?.calm && id.win) { q.calm[scene.id] = true; hit = true; }
    if (type === 'equip') hit = true;
    if (hit) { persist(); later(); }
  }
  /** 이야기 전투가 끝난 뒤: 격파 기록 · 전리품 카드 */
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
  window.addEventListener('biryeong:saved', () => { if (!busy) later(); }); // 소지품 · 장착이 바뀌면 지니기 · 장착 조건을 다시 본다
  window.addEventListener('biryeong:route', (e) => {
    loc = readLoc(e.detail.parts);
    if (zoneKey) onEvent('zone', zoneKey);
    if (loc.startsWith('out:')) onEvent('spot', loc.slice(4));
    later();
  });

  /* ───────── 행동 단추(전투 · 갈림길 · 행동) ───────── */
  function actions(scene, st) {
    const out = [];
    if (!atPlace(st.w)) return out;
    const q = Q();
    needState(scene, st).forEach((n) => {
      if (n.done || !BUTTON.has(n.type)) return;
      const left = n.count > 1 ? ` (${n.have}/${n.count})` : '';
      if (n.type === 'battle') {
        const foe = D.foes[n.arg];
        out.push(btn('solid-btn quest-act', `${foe.name}와(과) ${n.calm ? '마주한다' : '싸운다'}${left}`, () => {
          const a = App.playApi(); if (!a) { toast('본편', '실행 화면을 불러오는 중이다.'); return; }
          const form = foe.form ? Math.min(3, Math.max(1, q.flags[foe.form] === 4 ? 2 : q.flags[foe.form] || 1)) : 1;
          a.storyBattle({ key: n.arg, tier: foe.tier, i: foe.i, name: foe.name, blurb: foe.blurb, ctx: { taint: q.taint, form, names: { player: playerName(), god: godName() }, family: lineKey() } });
        }));
      } else if (n.type === 'use') {
        const have = countOf(n.id), name = itemName(n.id);
        const b = btn('solid-btn quest-act', `${name}${n.per > 1 ? ` ${n.per}개` : ''}을(를) 쓴다${left}`, () => {
          const a = App.playApi(); if (!a?.take({ [n.id]: n.per })) { toast('본편', `${name}이(가) 모자라다. (${n.per}개 필요 · 지금 ${countOf(n.id)}개)`); return; }
          q.prog[n.i] = (q.prog[n.i] || 0) + 1; persist(); later(); drawTracker();
        });
        if (have < n.per) b.classList.add('is-short');
        out.push(b);
      } else if (n.type === 'maze') out.push(btn('solid-btn quest-act', st.a.split(' — ')[0], () => openMaze(n.arg, () => { q.prog[n.i] = 1; persist(); later(); })));
      else out.push(btn('solid-btn quest-act', `${n.arg || st.a.split(' — ')[0]}${left}`, () => {
        if (st.mp && !App.playApi()?.spendMp(st.mp)) { toast('본편', `의지력이 모자라다. (${st.mp} 필요)`); return; }
        if (st.taint) q.taint = Math.max(0, Math.min(100, q.taint + st.taint));
        q.prog[n.i] = (q.prog[n.i] || 0) + 1; persist(); later(); drawTracker();
      }));
    });
    return out;
  }

  /* ───────── 진행 추적(오른쪽 상태 창 · 페이지 안) ───────── */
  function trackerBox() {
    const box = h('div', 'quest-box');
    if (!App.profile()) { box.append(h('p', 'quest-box-step', '프로필을 만들면 이야기가 시작된다.')); return box; }
    const scene = current();
    if (!scene) { box.append(h('p', 'quest-box-title', '본편 완결'), h('p', 'quest-box-step', `엔딩 ${Q().ending || ''} — 산문 너머에서 다시 볼 수 있다.`)); return box; }
    const st = busy ? null : activeStep(scene);
    box.append(h('p', 'quest-box-title', `◆ ${scene.ch}장 · ${scene.title}`));
    if (!st) { box.append(h('p', 'quest-box-step', '…')); return box; }
    box.append(h('p', 'quest-box-step', fill(st.a)), h('p', 'quest-box-place', fill(st.p)));
    const needs = needState(scene, st);
    if (needs.length) {
      const ul = h('ul', 'quest-box-needs');
      needs.forEach((n) => ul.append(h('li', n.done ? 'is-done' : '', `${n.done ? '◆' : '◇'} ${needLine(n)}`)));
      box.append(ul);
    }
    if (st.learn?.length) box.append(h('p', 'quest-box-place', `배운 제작법 — ${st.learn.map((id) => `「${itemName(D.recipeResult?.[id] || '') || id}」`).join(' · ')}`));
    const row = h('div', 'quest-box-acts');
    const real = needs.some((n) => !BUTTON.has(n.type));
    const target = hashOf(st.w);
    if (target && !atPlace(st.w)) row.append(btn('ghost-btn quest-go', '그곳으로', () => go(target)));
    else if (!real && !needs.length && st.l) row.append(btn('solid-btn quest-act', '이어서 본다', () => later()));
    actions(scene, st).forEach((b) => row.append(b));
    // 퀘스트가 준 물건을 잃어버렸으면 다시 찾을 수 있다(막히지 않게)
    needs.filter((n) => n.type === 'have' && !n.done && Q().given[n.id] && countOf(n.id) < n.per).forEach((n) => row.append(btn('ghost-btn quest-act', `${itemName(n.id)}을(를) 다시 찾는다`, () => { App.playApi()?.grant({ items: { [n.id]: n.per - countOf(n.id) }, log: `${itemName(n.id)}을(를) 다시 찾았다.` }); later(); })));
    if (needs.some((n) => n.type === 'equip' && !n.done)) {
      row.append(btn('ghost-btn quest-act', '소지품 열기', () => App.playApi()?.openInventory()));
      const wid = App.playApi()?.heirloomWeapon?.();
      if (wid) row.append(btn('solid-btn quest-act', '바로 장착한다', () => { const r = App.playApi()?.equip(wid); if (r?.error) toast('본편', r.error); later(); }));
    }
    if (row.children.length) box.append(row);
    return box;
  }
  function drawTracker() {
    const side = document.getElementById('questTracker');
    if (side) side.replaceChildren(trackerBox());
    document.querySelectorAll('.quest-inline').forEach((el) => el.replaceChildren(trackerBox()));
    const b = document.getElementById('statusQuest'); if (b) b.textContent = progressText();
  }
  const progressText = () => (App.profile() ? (current() ? `${doneCount()} / ${total}` : '완결') : '');

  /* ───────── 성취 카드 · 완료 띠 ─────────
   * card(): 가운데에 뜨는 금테 카드(유품 무구 · 새 제작법 · 받은 것 · 격파 · 장 완료). 대사가 흐르는 동안은 기다렸다가 차례로 뜬다.
   * banner(): 장면 하나를 마칠 때 위에서 내려왔다 사라지는 띠(보상 칩). */
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
    const MARK = { heir: '器', recipe: '方', item: '得', boss: '勝', chapter: '章', ending: '終', lose: '息' };
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
    el.append(h('small', '', `${scene.ch}장 · 장면 완료`), h('b', '', `「${scene.title}」`));
    const row = h('div', 'quest-banner-chips'); chips.forEach((c) => row.append(h('span', '', c))); el.append(row);
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 600); }, 4200);
  }
  function chapterCard(ch, title) {
    const c = D.chapters.find((x) => x.n === ch) || { title: '' };
    const q = Q(), list = SCENES.filter((s) => s.ch === ch && !/15-[A-E]/.test(s.id));
    const foes = [...new Set(list.flatMap((s) => s.steps.flatMap((st) => (st.n || []).filter((n) => n.startsWith('battle:')).map((n) => n.slice(7).split(/[×|]/)[0]))))].filter((k) => q.beaten[k]).map((k) => D.foes[k].name);
    const picks = list.flatMap((s) => s.lines.map((ln, i) => (ln.t === 'choice' && q.picked[`${s.id}:${i}`] ? fill(ln.o[q.picked[`${s.id}:${i}`] - 1]) : null))).filter(Boolean);
    card({ kind: 'chapter', head: `제${ch}장 완료`, title: `《${c.title}》`, sub: `장면 ${list.length}개 · 본편 ${doneCount()} / ${total}`, lines: [
      ...(foes.length ? [`퇴마한 상대 — ${foes.join(' · ')}`] : []),
      ...(picks.length ? [`고른 것 — ${picks.slice(0, 3).join(' / ')}${picks.length > 3 ? ' …' : ''}`] : []),
      ...(title ? [`칭호 「${title.name}」 — ${title.perkText || ''}`] : []),
      ch < 15 ? '다음 장이 산문 너머에 열렸다.' : '본편의 끝이 다가온다.',
    ] });
  }

  /* ───────── 대사 창 ───────── */
  let layer = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = h('div', 'scene-layer'); layer.id = 'sceneLayer'; layer.hidden = true; layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', '이야기');
    document.body.append(layer);
    return layer;
  }
  function applyEffects(list) {
    const q = Q();
    (list || []).forEach(([k, v]) => {
      if (k.startsWith('신뢰_')) { const who = k.slice(3); q.trust[who] = Math.max(0, Math.min(100, (q.trust[who] || 0) + v)); }
      else if (k === '정신오염') q.taint = Math.max(0, Math.min(100, q.taint + v));
      else q.world[k] = (q.world[k] || 0) + v;
    });
  }
  function playLines(scene, from, to, onEnd, replay) {
    const q = Q(), L = ensureLayer();
    const list = [];
    for (let i = from; i < to; i++) list.push([i, scene.lines[i]]);
    let at = 0;
    const win = h('div', 'scene-win');
    const head = h('div', 'scene-head'); head.append(h('span', '', `${scene.ch}장 · ${scene.title}`), h('small', '', `${scene.place} · ${scene.time}`));
    const body = h('div', 'scene-body'), foot = h('div', 'scene-foot');
    win.append(head, body, foot); L.replaceChildren(win); L.hidden = false; document.body.classList.add('is-scene'); drawTracker();
    const close = () => { L.hidden = true; L.replaceChildren(); document.body.classList.remove('is-scene'); persist(); onEnd && onEnd(); setTimeout(flushCards, 200); };
    function show() {
      while (at < list.length && !ok(list[at][1].c, scene)) at += 1;
      if (at >= list.length) { close(); return; }
      const [idx, ln] = list[at]; const key = `${scene.id}:${idx}`;
      body.replaceChildren(); foot.replaceChildren();
      if (ln.t === 'choice') { choice(ln, key); return; }
      if (!replay && ln.e && !q.fx[key]) { q.fx[key] = 1; applyEffects(ln.e); }
      const who = ln.w || '', shown = who === '△△' ? (godName() || '이름 없는 것') : who === 'PC' ? playerName() : fill(who);
      const row = h('div', `scene-line is-${ln.t}`);
      if (ln.t === 'd' || ln.t === 'r') { row.append(portrait(who, shown)); const tx = h('div', 'scene-text'); tx.append(h('b', 'scene-name', shown), h('p', '', fill(ln.x))); row.append(tx); }
      else if (ln.t === 'b') { row.append(portrait('비령', '비령')); const tx = h('div', 'scene-text'); tx.append(h('b', 'scene-name', '비령 단말기'), h('p', 'scene-term', fill(ln.x))); row.append(tx); }
      else { const tx = h('div', 'scene-text'); if (ln.t === 'i') tx.append(h('b', 'scene-name', '조사')); if (ln.t === 's') tx.append(h('b', 'scene-name', '안내')); tx.append(h('p', '', fill(ln.x))); row.append(tx); }
      body.append(row);
      if (ln.d) body.append(h('p', 'scene-direction', fill(ln.d)));
      const next = btn('solid-btn scene-next', at >= list.length - 1 ? '닫는다' : '다음', () => { at += 1; show(); });
      foot.append(h('small', 'scene-count', `${at + 1} / ${list.length}`), next); next.focus();
    }
    function choice(ln, key) {
      const already = q.picked[key];
      if (already || replay) {
        if (already) { q.pick[scene.id] = already; body.append(h('p', 'scene-chosen', `고른 것 — ${fill(ln.o[already - 1])}`)); }
        else body.append(h('p', 'scene-chosen', '(아직 고르지 않은 갈림)'));
        const next = btn('solid-btn scene-next', '다음', () => { at += 1; show(); }); foot.append(next); next.focus(); return;
      }
      if (!ok(ln.c, scene)) { at += 1; show(); return; }
      body.append(h('p', 'scene-question', fill(ln.q)));
      const box = h('div', 'scene-options');
      ln.o.forEach((text, i) => {
        const n = i + 1; let off = '';
        if (ln.id === 'B3-1' && n === 2 && !['fan', 'cloth'].includes(lineKey())) off = `부채 · 오색천 계통만 (내 유품: ${heir()?.name || '없음'} — ${heir()?.line || '?'} 계통)`;
        if (ln.id === '13-05' && n === 3 && countOf('st-tangerine') < 1) off = '귤이 없다 — 매점에서 살 수 있다';
        if (ln.id === 'B7-1' && n === 5 && !q.god) off = '이름을 준 신이 없다';
        if (ln.id === 'B15-1' && n === 4 && !hiddenOpen()) return;
        const b = btn('scene-option', '', () => pick(ln, key, n)); b.append(h('i', '', CIRC[i]), h('span', '', fill(text) + (off ? ` — ${off}` : ''))); b.disabled = !!off;
        if (ln.id === 'B1-1' && HEIRS[i]) { b.classList.add('is-heir'); b.append(h('small', 'scene-option-note', `${HEIRS[i].line} 계통 · 무구 「${itemName(HEIRS[i].weapon)}」 — ${HEIRS[i].note}`)); }
        box.append(b);
      });
      body.append(box);
    }
    function pick(ln, key, n) {
      const done = () => {
        q.picked[key] = n; q.pick[scene.id] = n; q.flags[ln.id] = n;
        applyEffects(ln.e[n - 1]);
        if (ln.id === 'B1-1') { save().story.heirloom = HEIRS[n - 1]?.weapon || null; App.mark('heirloomChosen'); if (!q.keep.includes('부모의 유품')) q.keep.push('부모의 유품'); }
        if (ln.id === '13-05' && n === 3) App.playApi()?.take({ 'st-tangerine': 1 });
        if (/^B\d/.test(ln.id)) Sync()?.choice(ln.id, n);
        persist(); at += 1; show();
      };
      if ((ln.id === 'B4-1' || ln.id === '7-03') && n === 1 && !q.god) askName((name) => { q.god = { name, at: Date.now() }; q.trust['△△'] = ln.id === 'B4-1' ? 40 : 30; done(); });
      else done();
    }
    function askName(then) {
      body.replaceChildren(h('p', 'scene-question', '무슨 이름을 줄까.'));
      const form = h('form', 'scene-name-form'); const input = h('input'); input.type = 'text'; input.maxLength = 8; input.placeholder = '이름 (1~8자)'; input.setAttribute('aria-label', '신에게 줄 이름');
      const go2 = h('button', 'solid-btn', '이 이름을 준다'); go2.type = 'submit'; form.append(input, go2);
      form.addEventListener('submit', (e) => { e.preventDefault(); const name = input.value.trim().replace(/[<>△]/g, ''); if (!name) { input.focus(); return; } then(name); });
      body.append(form, h('p', 'scene-direction', '한 번 준 이름은 바꿀 수 없다. 이 신은 당신에게 이 이름으로 대답한다.')); input.focus();
    }
    show();
  }

  /* 갈림길(환각 · 잠입 · 추적): 네 번 고른다. norepeat = 같은 길을 연달아 고르면 들킨다 / real = 셋 중 진짜 하나(거울 계통은 표시가 보인다) */
  function openMaze(rule, onClear) {
    const q = Q(), L = ensureLayer(); busy = true;
    const NAMES = rule === 'real' ? ['따뜻한 손', '거대한 신상', '꺼지지 않는 화면'] : ['왼쪽 복도', '가운데 계단', '오른쪽 통로'];
    let round = 0, last = -1, real = Math.floor(Math.random() * 3);
    const win = h('div', 'scene-win'); const body = h('div', 'scene-body'), foot = h('div', 'scene-foot');
    win.append(h('div', 'scene-head', rule === 'real' ? '무엇이 진짜인가' : '들키지 않고 지나가기'), body, foot); L.replaceChildren(win); L.hidden = false; document.body.classList.add('is-scene');
    const end = (clear) => { L.hidden = true; L.replaceChildren(); document.body.classList.remove('is-scene'); busy = false; if (clear) onClear(); else drawTracker(); setTimeout(flushCards, 200); };
    function draw(note) {
      body.replaceChildren(h('p', 'scene-question', `${round + 1} / 4 — ${rule === 'real' ? '셋 가운데 하나만 진짜다.' : '같은 길을 두 번 잇달아 고르면 눈이 따라온다.'}`));
      if (note) body.append(h('p', 'scene-direction', note));
      const box = h('div', 'scene-options');
      NAMES.forEach((name, i) => {
        const mark = rule === 'real' && lineKey() === 'mirror' && i === real ? ' ◆ 거울에 비친다' : '';
        const b = btn('scene-option', '', () => {
          if (rule === 'real') { if (i !== real) { q.taint = Math.min(100, q.taint + 3); persist(); draw('그것이 당신이 바라는 얼굴로 웃는다. 아니다. (정신오염 +3)'); return; } real = Math.floor(Math.random() * 3); }
          else if (i === last) { round = 0; last = -1; draw('천장의 눈이 일제히 이쪽을 본다. 처음부터.'); return; }
          last = i; round += 1; if (round >= 4) end(true); else draw();
        });
        b.append(h('i', '', CIRC[i]), h('span', '', name + mark)); box.append(b);
      });
      body.append(box); foot.replaceChildren(btn('ghost-btn', '물러난다', () => end(false)));
    }
    draw();
  }

  /* ───────── 산문 너머: 퀘스트 보드 ───────── */
  function renderBoard(tab) {
    const body = App.body; const cur = ['quests', 'places', 'record', 'world'].includes(tab) ? tab : 'quests';
    App.addTo('pages', 'story');
    if (!App.profile()) { body.append(App.needProfile()); return; }
    App.setTabs(App.tabs, [{ id: 'quests', label: '퀘스트' }, { id: 'places', label: '바깥 지역' }, { id: 'record', label: '나의 기록' }, { id: 'world', label: '세계' }], cur, (id) => go(`#/zone/north/${id}`));
    const now = h('div', 'quest-inline'); body.append(h('p', 'panel-label', '지금 할 일'), now, h('div', 'panel-rule'));
    if (cur === 'quests') boardQuests(body); else if (cur === 'places') boardPlaces(body); else if (cur === 'record') boardRecord(body); else boardWorld(body);
    drawTracker();
  }
  function boardQuests(body) {
    const q = Q(), now = current();
    body.append(h('p', 'panel-count', `산문 너머 — 본편 ${doneCount()} / ${total}`));
    D.volumes.forEach((v) => {
      const chapters = D.chapters.filter((c) => c.vol === v.n);
      const reached = chapters.some((c) => SCENES.some((s) => s.ch === c.n && (q.done[s.id] || s === now)));
      const vol = h('section', `quest-vol${reached ? '' : ' is-locked'}`);
      vol.append(h('h3', 'quest-vol-title', `제${v.n}권 《${reached ? v.title : '？？？'}》`), h('p', 'quest-vol-q', reached ? `${v.when} · ${v.q}` : '아직 닿지 않은 이야기.'));
      if (reached) chapters.forEach((c) => {
        const list = SCENES.filter((s) => s.ch === c.n && (!/15-[A-E]/.test(s.id) || q.done[s.id] || s === now));
        const open = list.some((s) => q.done[s.id] || s === now);
        const det = h('details', 'quest-chapter'); det.open = list.includes(now);
        det.append(h('summary', '', `${c.n}장 · ${open ? c.title : '？？？'}  ${list.filter((s) => q.done[s.id]).length}/${list.length}`));
        if (open) list.forEach((s) => {
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
    body.append(para('산문 밖과 학당 아래. 이야기가 길을 열어 주면 여기에서 걸어 나갈 수 있다. (학당 안의 장소는 오방 지도에서 간다.)'));
    if (!open.length) { body.append(App.emptyBox('外', '아직 열린 길이 없다.', '금줄 밖으로는 나가지 마라.')); return; }
    open.forEach((r) => { const reg = D.regions[r]; const card = btn('quest-region', '', () => go(`#/out/${r}`)); card.append(h('strong', '', reg.name), h('small', '', `${reg.sub} · ${reg.spots.length}곳`)); body.append(card); });
  }
  function boardRecord(body) {
    const q = Q(), s = save().story;
    const meta = h('div', 'quest-meta');
    meta.append(h('span', '', `유품 — ${heir() ? `${heir().name} (${heir().line} 계통 · 무구 「${itemName(heir().weapon)}」)` : '아직'}`), h('span', '', `이름을 준 신 — ${q.god?.name || '없음'}`), h('span', '', `정신오염 ${q.taint}`), h('span', '', q.ending ? `엔딩 ${q.ending}` : '엔딩 — 아직'));
    body.append(meta, h('p', 'panel-label', '신뢰'));
    MAIN.forEach((k) => {
      const name = k === '△△' ? (q.god?.name || '이름 없는 신') : k; const row = h('div', 'quest-trust');
      const bar = h('i'); bar.style.width = `${q.trust[k] || 0}%`; const track = h('span', 'quest-trust-bar'); track.append(bar);
      row.append(portrait(k, name), h('b', '', name), track, h('small', '', String(q.trust[k] || 0))); body.append(row);
    });
    body.append(h('p', 'panel-label', '간직한 것'));
    body.append(q.keep.length ? para(q.keep.join(' · ')) : para('아직 없다.'));
    // 본편 도감: 퇴마한 신탁 · 본편 물건 · 본편 제작법
    const foes = Object.entries(D.foes);
    body.append(h('p', 'panel-label', `퇴마한 신탁 ${foes.filter(([k]) => q.beaten[k]).length} / ${foes.length}`));
    const fg = h('div', 'dex-grid');
    foes.forEach(([k, f]) => { const c = h('div', `dex-cell${q.beaten[k] ? ' is-on' : ''}`); c.append(h('b', '', q.beaten[k] ? f.name : '？？？'), h('small', '', q.beaten[k] ? f.blurb : `${f.tier}단계 수준`)); fg.append(c); });
    body.append(fg);
    const dex = App.playApi()?.storyDex?.();
    if (dex) {
      const seen = dex.items.filter((it) => it.have > 0 || q.given[it.id]);
      body.append(h('p', 'panel-label', `본편 물건 ${seen.length} / ${dex.items.length}`));
      const ig = h('div', 'dex-grid');
      dex.items.forEach((it) => { const on = it.have > 0 || q.given[it.id]; const c = h('div', `dex-cell${on ? ' is-on' : ''}`); c.title = on ? it.desc : ''; c.append(h('b', '', on ? it.name : '？？？'), h('small', '', on ? (it.text || it.tags.filter((t) => t !== '본편').join(' · ')) + (it.have ? ` · 지금 ${it.have}개` : '') : it.tags.includes('전리품') ? '이야기 전투의 전리품' : '본편에서 얻는다')); ig.append(c); });
      body.append(ig);
      body.append(h('p', 'panel-label', `본편 제작법 ${dex.recipes.filter((r) => r.open).length} / ${dex.recipes.length}`));
      const rg = h('div', 'dex-grid');
      dex.recipes.forEach((r) => { const c = h('div', `dex-cell${r.open ? ' is-on' : ''}`); c.append(h('b', '', r.open ? r.name : '？？？'), h('small', '', `${r.place === 'K' ? '조리실' : '공작소'} · ${r.unlock === 'quest' ? '퀘스트에서 배운다' : `「${D.foes[r.unlock.slice(5)]?.name || '?'}」을(를) 이기면`}`)); rg.append(c); });
      body.append(rg);
    }
    body.append(h('p', 'panel-label', '내가 고른 것'));
    const ul = h('ul', 'admin-list');
    SCENES.forEach((sc) => sc.lines.forEach((ln, i) => { const n = q.picked[`${sc.id}:${i}`]; if (ln.t === 'choice' && n) ul.append(h('li', '', `${sc.ch}장 ${sc.title} — ${fill(ln.o[n - 1])}`)); }));
    body.append(ul.children.length ? ul : para('아직 없다.'));
  }
  function boardWorld(body) {
    const q = Q(), sync = Sync();
    body.append(para(sync?.enabled ? '세계의 값 — 서버에 모인 모든 학생의 선택이 아래에 함께 보인다.' : '세계의 값 — 지금은 이 브라우저의 선택만 반영된다. 서버(Supabase)를 연결하면 모든 학생의 선택이 모인다.'));
    const grid = h('div', 'quest-world');
    Object.entries(q.world).forEach(([k, v]) => { const c = h('div', ''); c.append(h('small', '', k.replace('W_', '')), h('b', '', String(v))); grid.append(c); });
    body.append(grid, h('p', 'panel-label', '세계 결정'));
    const box = h('div', 'quest-tally'); box.append(para(sync?.enabled ? '불러오는 중…' : '서버 연결 전 — 내 선택만 보인다.')); body.append(box);
    const mine = () => { const ul = h('ul', 'admin-list'); SCENES.forEach((sc) => sc.lines.forEach((ln) => { if (ln.t === 'choice' && /^B\d/.test(ln.id) && q.flags[ln.id]) ul.append(h('li', '', `${ln.id} ${fill(ln.q)} → ${fill(ln.o[q.flags[ln.id] - 1])}`)); })); return ul; };
    if (!sync?.enabled) { box.append(mine()); return; }
    sync.tally().then((rows) => {
      box.replaceChildren();
      const by = {}; (rows || []).forEach((r) => { (by[r.branch] = by[r.branch] || {})[r.option] = r.votes; });
      const seen = new Set();
      SCENES.forEach((sc) => sc.lines.forEach((ln) => {
        if (ln.t !== 'choice' || !/^B\d/.test(ln.id) || !by[ln.id] || seen.has(ln.id)) return; seen.add(ln.id);
        const sum = Object.values(by[ln.id]).reduce((a, b) => a + b, 0); const row = h('div', 'quest-tally-row'); row.append(h('strong', '', `${ln.id} · ${fill(ln.q)}`));
        ln.o.forEach((o, i) => { const v = by[ln.id][i + 1] || 0; const line = h('p', q.flags[ln.id] === i + 1 ? 'is-mine' : '', `${CIRC[i]} ${fill(o)} — ${v}명 (${sum ? Math.round(v * 100 / sum) : 0}%)`); row.append(line); });
        box.append(row);
      }));
      if (!seen.size) box.append(para('아직 모인 선택이 없다.'));
    }).catch(() => { box.replaceChildren(para('서버에 닿지 않는다. 내 선택만 보인다.'), mine()); });
  }

  /* ───────── 바깥 지역 · 새 층 (#/out/<지역>/<지점>) ───────── */
  function renderPlace(regId, spotId) {
    const reg = D.regions[regId];
    if (!reg || !Q().regions[regId]) { go('#/zone/north/places'); return; }
    App.openPage(`外 / ${reg.sub}`, reg.name, 'simple');
    const body = App.body;
    const box = h('div', 'quest-inline'); body.append(box);
    const board = h('div', 'pxmap pxmap-yellow'); const title = h('div', 'pxmap-title'); title.append(h('b', '', '外'), h('span', '', reg.name), h('i', '', 'IS'), h('em', '', reg.sub));
    const plan = h('div', 'pxwall pxplan');
    reg.spots.forEach((s) => { const b = btn(`pxroom${s.id === spotId ? ' is-here' : ''}`, '', () => go(`#/out/${regId}/${s.id}`)); b.append(h('span', '', `${s.id === spotId ? '◆ ' : ''}${s.name}`)); plan.append(b); });
    board.append(title, plan); body.append(board);
    const spot = reg.spots.find((s) => s.id === spotId);
    if (spot) body.append(h('p', 'panel-label', spot.name), para(spot.desc)); else body.append(para('갈 곳을 고른다.'));
    body.append(btn('ghost-btn', '산문 너머로 돌아간다', () => go('#/zone/north/places')));
    drawTracker();
  }

  const peek = () => { const scene = current(); const st = scene && !busy ? activeStep(scene) : null; return { id: scene?.id || null, step: st ? Q().step : -1, w: st?.w || '', at: st ? atPlace(st.w) : false, needs: st ? needState(scene, st).map((n) => ({ raw: n.raw, type: n.type, arg: n.arg, done: n.done })) : [], busy, loc }; };
  window.BiryeongQuest = { renderBoard, renderPlace, progressText, tick, state: Q, current, peek, replay: (id) => byId[id] && playLines(byId[id], 0, byId[id].lines.length, null, true) };
  App.route();
  drawTracker();
})();
