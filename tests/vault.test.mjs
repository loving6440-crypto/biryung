import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as Vault from '../systems/vault/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(ROOT, 'systems/vault');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const codeFiles = walk(join(VAULT, 'modules')).filter((p) => /\.(m?js|jsx)$/.test(p));

test('Vault: 모든 파일이 manifest 와 같다 (sha256)', () => {
  const m = Vault.manifest;
  assert.equal(m.counts.files, m.entries.length);
  for (const e of m.entries) {
    assert.ok(existsSync(join(VAULT, e.path)), e.path);
    assert.equal(createHash('sha256').update(readFileSync(join(VAULT, e.path))).digest('hex'), e.sha256, e.path);
  }
  for (const c of m.catalog) assert.equal(createHash('sha256').update(readFileSync(join(VAULT, c.file))).digest('hex'), c.sha256, c.file);
});

test('Vault: 초록동색 NPC 캐릭터가 들어 있지 않다 (이름 · 초상화 · 식별자)', () => {
  const npcWords = /바리[가는를의에와도 ]|해님|단애|강유민|유민 |강신영|신영 씨|박신아|신아[가는를의에와 ]|이시[가는를의에와 ']|돗가비|\bBARI\b|\bHAENIM\b|\bDANAE\b|\bYUMIN\b|\bSHINAH\b|\bISHI\b|\bbari\b|haenim|danae|yumin|shinah|\bishi\b|shinyoung/;
  for (const p of codeFiles) {
    const lines = readFileSync(p, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (/게임의 제작자 팬케이크/.test(l)) return; // 제작자 헌정 상장(크레딧) 문구는 NPC 가 아니다
      assert.ok(!npcWords.test(l), `${relative(VAULT, p)}:${i + 1} ${l.slice(0, 80)}`);
    });
  }
  const assets = readdirSync(join(VAULT, 'assets/public'));
  for (const n of assets) assert.ok(!/^(bari|danae|haenim|yumin|ishi|shinah|shinyoung)/.test(n), n);
});

test('Vault: 퀘스트 파일 · 퀘스트 화면이 없고, 어디서도 import 하지 않는다', () => {
  for (const f of ['quests.js', 'questData.js', 'questLevels.js', 'clubQuests.js', 'firstDayQuest.js']) assert.ok(!existsSync(join(VAULT, 'modules/game', f)), f);
  for (const f of ['QuestBoard.jsx', 'QuestParts.jsx', 'ExtraQuestModal.jsx', 'FirstDayQuestModal.jsx', 'ClubModal.jsx']) assert.ok(!existsSync(join(VAULT, 'modules/ui/components', f)), f);
  for (const p of codeFiles) assert.ok(!/from\s*['"][^'"]*(quests|questData|questLevels|clubQuests|firstDayQuest|QuestParts|QuestBoard)['"]/.test(readFileSync(p, 'utf8')), p);
});

test('Vault: 다른 서버 · 네트워크 호출 · 옛 로그인이 없다', () => {
  for (const p of codeFiles) {
    const t = readFileSync(p, 'utf8');
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|new\s+(WebSocket|EventSource)\b|\bprocess\.env\b|\bcreateClient\s*\(|supabase\.co|onrender\.com/i.test(t), relative(VAULT, p));
    assert.ok(!/from\s*['"][^'"]*(net\/online|game\/auth|server\/)/.test(t), relative(VAULT, p));
  }
  for (const f of ['game/auth.js']) assert.ok(!existsSync(join(VAULT, 'modules', f)));
});

test('Vault: 상대 import 가 모두 보관고 안에서 풀린다', () => {
  for (const p of codeFiles) {
    for (const m of readFileSync(p, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]/g)) {
      const b = resolve(dirname(p), m[1]);
      assert.ok([b, b + '.js', b + '.jsx', b + '.mjs'].some((x) => existsSync(x) && statSync(x).isFile()), `${relative(VAULT, p)} → ${m[1]}`);
      assert.ok(resolve(b).startsWith(join(VAULT, 'modules')) || resolve(b).startsWith(join(VAULT, 'assets')), `보관고 밖 import: ${m[1]}`);
    }
  }
});

test('Vault: 게임 데이터를 꺼내 쓸 수 있다 (카탈로그 · 모듈)', async () => {
  assert.equal(Vault.catalog('game/items').ITEMS.length, 312);
  assert.equal(Vault.catalog('game/bestiary').BESTIARY.length, 50);
  assert.ok(Vault.catalog('game/minigames/typingSentences'));
  const battle = await Vault.load('game/battle');
  assert.equal(battle.ALL_ENEMIES.length, 57);
  for (const e of Vault.entries().filter((x) => x.kind === 'game-logic' && x.nodeImportable)) await Vault.load(e.id);
});

test('Vault: NPC 자리 7칸은 비어 있고, 채우면 글 · 선택지가 그 이름으로 바뀐다', async () => {
  const slots = await Vault.load('game/npcSlots');
  assert.deepEqual(slots.NPC_SLOT_IDS, Vault.manifest.npcSlots);
  for (const id of slots.NPC_SLOT_IDS) assert.equal(slots.NPC_SLOTS[id].vacant, true);
  assert.equal(slots.fillNpcText('{{npc:x|가}} 온다', { x: '하람' }), '하람이 온다');
  assert.equal(slots.fillNpcText('{{npc:x|가}} 온다', { x: '무지' }), '무지가 온다');
  assert.equal(slots.fillNpcText('{{npc:x|으로}}', { x: '길' }), '길로');
  const codex = await Vault.load('game/codex');
  assert.equal(codex.NPC_ENTRIES.length, 0);
});

test('Vault: 꺼내기 — 묶음과 의존 파일이 함께 나오고, --npc 로 이름을 채운다', () => {
  const to = mkdtempSync(join(tmpdir(), 'biryeong-vault-'));
  try {
    execFileSync(process.execPath, [join(VAULT, 'cli.mjs'), 'export', 'armory', '--to', to, '--npc', 'armorySmith=하람'], { stdio: 'pipe' });
    const report = JSON.parse(readFileSync(join(to, 'VAULT_EXPORT.json'), 'utf8'));
    assert.equal(report.files, Vault.manifest.bundles.armory.files);
    const hike = readFileSync(join(to, 'modules/game/armory.js'), 'utf8');
    assert.ok(hike.includes('ARMORY_KEEPER'));
    assert.match(readFileSync(join(to, 'modules/game/npcSlots.js'), 'utf8'), /fillNpcSlot\("armorySmith", \{ name: "하람" \}\)/);
  } finally { rmSync(to, { recursive: true, force: true }); }
});

test('Vault: 기존 비령 데이터 · 규칙 스냅샷(systems/data · systems/rules)은 건드리지 않았다', () => {
  const rules = readdirSync(join(ROOT, 'systems/rules')).filter((n) => n.endsWith('.js'));
  assert.equal(rules.length, 29);
  assert.ok(!existsSync(join(ROOT, 'src')));
  assert.ok(!Vault.entries().some((e) => e.path.startsWith('..') || e.path.includes(sep + '..')));
});

test('Site: 구역 · 칭호 · 업적 · 스토리 데이터가 맞게 들어 있다', () => {
  const load = (f) => { const w = {}; new Function('window', readFileSync(join(ROOT, f), 'utf8'))(w); return w; };
  const d = load('game-data.js').BIRYEONG_DATA;
  assert.equal(d.zones.north.story, true);
  assert.deepEqual(d.zones.east.tabs.map((x) => x.name), ['본관', '별관', '양호실']);
  assert.deepEqual(d.zones.center.tabs.map((x) => x.name), ['사당']);
  assert.deepEqual(d.maps.map((m) => m.id), ['mainHall', 'annex', 'gym', 'shrine']);
  assert.deepEqual(d.zones.west.tabs.map((x) => x.name), ['기숙사']);
  assert.deepEqual(d.zones.south.tabs.map((x) => x.name), ['뒷산']);
  assert.equal(d.rules.statMin, 1); assert.equal(d.rules.startPoints, 10);
  assert.ok(!/\{\{npc:/.test(JSON.stringify(d)));
  assert.ok(!/창록|초록동색/.test(JSON.stringify(d)), '구역 글에 옛 이름이 남아 있다');
  // 그 자리에서 실행되는 칸의 주소는 모두 실행 화면에 있는 화면이다
  const app = readFileSync(join(ROOT, 'systems/play/src/App.jsx'), 'utf8');
  const screens = new Set([...app.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]));
  const plays = [];
  (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.kind === 'play') plays.push(o.to); if (o.play) plays.push(o.play.to); Object.values(o).forEach(walk); } })(d.zones);
  assert.ok(plays.length >= 12);
  for (const to of plays) assert.ok(screens.has(to.split('/')[0]), `실행 화면에 없는 주소: ${to}`);
  const t = load('titles.js');
  assert.equal(t.BIRYEONG_ACHIEVEMENTS.length, 60); assert.equal(t.BIRYEONG_TITLES.length, 64);
  const perGroup = {}; for (const a of t.BIRYEONG_ACHIEVEMENTS) perGroup[a.group] = (perGroup[a.group] || 0) + 1;
  assert.deepEqual(perGroup, { roam: 5, day: 5, days: 10, steady: 20, month: 10, peak: 10 });
  for (const a of t.BIRYEONG_ACHIEVEMENTS) assert.ok(t.BIRYEONG_TITLES.some((x) => x.id === a.title && x.from === 'achievement'), a.id);
  const s = load('story.js').BIRYEONG_STORY;
  assert.equal(s.steps.length, 10); assert.equal(s.steps[1].options.length, 10); // v1.3 유품 10종 = 무구 10종
  for (const st of s.steps) assert.ok(st.text.length && st.goal.when && st.reward, st.id);
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8') + readFileSync(join(ROOT, 'app.js'), 'utf8') + readFileSync(join(ROOT, 'play/play.css'), 'utf8');
  assert.ok(!/NeoDunggeunmo|neodgm|Stardust|Ramche/.test(css), '글꼴은 갈무리 · KoPub 만');
  assert.ok(!/<dialog class="(panel|play|story)-dialog"/.test(readFileSync(join(ROOT, 'index.html'), 'utf8')), '페이지로 바꾼 창이 남아 있다');
});

test('Play: 실행 화면 부품이 빌드되어 있고, 스타일이 .play-scope 안에 갇혀 있다', () => {
  for (const f of ['play.js', 'play.css', 'bgm.mp3']) assert.ok(existsSync(join(ROOT, 'play', f)), `play/${f}`);
  const css = readFileSync(join(ROOT, 'play/play.css'), 'utf8');
  const selectors = [...css.matchAll(/(?:^|\})([^{}@]+)\{/g)].map((m) => m[1].trim()).filter((x) => !/^(from|to|[\d.]+%)/.test(x));
  assert.ok(selectors.length > 500);
  for (const sel of selectors) assert.ok(sel.includes('.play-scope'), `범위 밖 스타일: ${sel.slice(0, 60)}`);
  assert.ok(/z-\\\[70\\\]/.test(css), '대괄호 유틸리티(z-[70])가 빠졌다');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /src="play\/play\.js(\?v=[^"]+)?"/); assert.match(html, /id="playRoot"/); assert.match(html, /id="pageBack"/);
});

test('v1.4: 아이템 · 상대 · 영능력은 초록동색 원래 이름 · 해설 그대로이고, 아이템마다 도트 아이콘이 있으며 사이버펑크 말이 없다', async () => {
  const r = await import('../systems/biryeong/reskin.data.js');
  const { ITEMS } = await Vault.load('game/items');
  // 개변표가 비어 있다 — 실행 화면은 보관고의 원래 이름 · 해설을 쓴다(학교 이름만 TEXT_SWAPS 로 바뀐다)
  assert.deepEqual(r.ITEM_RESKIN, {}); assert.deepEqual(r.ENEMY_RESKIN, {}); assert.deepEqual(r.PSYCHIC_RESKIN, {});
  assert.ok(r.TEXT_SWAPS.every(([a]) => /창록|초록동색|둘레길/.test(a)), '학교 이름 말고 바꾸는 글자가 있다');
  for (const i of ITEMS) { const px = r.ITEM_PIXELS[i.id]; assert.ok(px && r.PIXEL_TEMPLATES[px.t] && r.PIXEL_PALETTES[px.p], i.id); }
  assert.ok(!r.PIXEL_PALETTES.neon, '네온 색이 남아 있다');
  for (const grid of Object.values(r.PIXEL_TEMPLATES)) { assert.equal(grid.length, 12); for (const row of grid) assert.match(row, /^[.kabcd]{12}$/); }
  // 사이버펑크 말: 본편 아이템 · 칭호 · 원고에 남아 있지 않다
  const CYBER = /사이버|네온|회로|홀로그램|해커|해킹|프로토콜|오버클럭|안드로이드|광섬유|전뇌|렌더러|코인|나노|뉴로/;
  for (const it of r.STORY_ITEMS) assert.ok(!CYBER.test(it.name + it.desc), it.id);
  const { readFileSync } = await import('node:fs');
  const t2 = readFileSync(new URL('../titles2.js', import.meta.url), 'utf8').split('\n').slice(25).join('\n');
  assert.ok(!CYBER.test(t2), '칭호에 사이버펑크 말');
  for (const f of ['script_vol1.txt', 'script_vol2.txt', 'script_vol3.txt']) assert.ok(!CYBER.test(readFileSync(new URL('../systems/story/' + f, import.meta.url), 'utf8')), f);
});

// ── v1.0: 새 제작법 · 칭호 기능 ──
import { test as t10 } from 'node:test'
import assert10 from 'node:assert/strict'
import { readFileSync as read10 } from 'node:fs'
t10('v1.0 새 제작법은 재료 조합이 서로 겹치지 않고, 올려 두면 그 제작법으로 잡힌다', async () => {
  const base = new URL('../systems/', import.meta.url)
  const { RECIPES } = await import(new URL('vault/modules/game/crafting.js', base))
  const { COOK_RECIPES } = await import(new URL('vault/modules/game/cooking.js', base))
  const { matchRecipe, benchCraft } = await import(new URL('vault/modules/game/freeCraft.js', base))
  const { NEW_RECIPES, RECIPE_TIERS } = await import(new URL('biryeong/reskin.data.js', base))
  const w0 = RECIPES.length, k0 = COOK_RECIPES.length
  RECIPES.push(...NEW_RECIPES.W); COOK_RECIPES.push(...NEW_RECIPES.K)
  try {
    assert10.ok(NEW_RECIPES.W.length + NEW_RECIPES.K.length >= 100)
    for (const [place, list] of [['workshop', NEW_RECIPES.W], ['kitchen', NEW_RECIPES.K]]) {
      for (const r of list) {
        const slots = r.inputs.map(([id, n]) => ({ id, n: n * 2 }))
        const m = matchRecipe(slots, place)
        assert10.equal(m?.recipe.id, r.id, `${r.id} 가 ${m?.recipe.id} 로 잡혔다`)
        assert10.equal(m.k, 2)
        assert10.ok([1, 2, 3].includes(RECIPE_TIERS[r.id]))
      }
    }
    const r = NEW_RECIPES.W.find((x) => !x.result.startsWith('nw-')) // 보관고 그대로(패치 없이) 도는 시험이라, 보관고에 있는 결과로 본다
    const player = { inventory: Object.fromEntries(r.inputs), money: 0 }
    const done = benchCraft(player, r.inputs.map(([id, n]) => ({ id, n })), 'workshop', false)
    assert10.equal(done.failed, false); assert10.equal(done.player.inventory[r.result], 1)
  } finally { RECIPES.length = w0; COOK_RECIPES.length = k0 }
})
t10('v1.5 칭호 124개 모두에 기능이 있고, 업적 120개 — 업적 하나에 칭호 하나', () => {
  const window = {}
  for (const f of ['../titles.js', '../titles2.js']) new Function('window', read10(new URL(f, import.meta.url), 'utf8'))(window)
  const T = window.BIRYEONG_TITLES, A = window.BIRYEONG_ACHIEVEMENTS
  assert10.equal(T.length, 124); assert10.equal(A.length, 120)
  assert10.equal(new Set(T.map((t) => t.name)).size, T.length)
  for (const t of T) { assert10.ok(t.perk?.type && t.perk.v > 0 && t.perkText, t.id); if (t.from !== 'start') assert10.equal(A.filter((a) => a.title === t.id).length, 1, t.id) }
})

// ── v1.2: 본편 퀘스트 데이터 ──
t10('v1.8 본편(스크립트 v4): 프롤로그는 사이트에, 1 · 2장은 장 파일에 — 모든 단계에 갈 곳 · 상대 · 지점 · 분기가 맞물린다', async () => {
  const window = {}
  for (const f of ['../titles.js', '../titles2.js', '../story-data.js']) new Function('window', read10(new URL(f, import.meta.url), 'utf8'))(window)
  const D = window.BIRYEONG_QUESTS
  assert10.deepEqual(D.scenes.map((s) => s.id), ['P-1', 'P-2', 'P-3'])
  assert10.ok(D.scenes.every((s) => s.ch === 0), '사이트에는 프롤로그만')
  const chapters = [1, 2].map((n) => JSON.parse(read10(new URL(`../story-chapters/ch${n}.json`, import.meta.url), 'utf8')))
  chapters.forEach((c, i) => { assert10.equal(c.format, 'biryeong-chapter'); assert10.equal(c.ch, i + 1); assert10.ok(c.scenes.every((s) => s.ch === i + 1)) })
  const all = [...D.scenes, ...chapters.flatMap((c) => c.scenes)]
  assert10.equal(all.length, 16)
  const spots = new Set(Object.entries(D.regions).flatMap(([r, v]) => v.spots.map((s) => `${r}/${s.id}`)))
  const { ITEMS } = await import('../systems/vault/modules/game/items.js')
  const { STORY_ITEMS } = await import('../systems/biryeong/reskin.data.js')
  const ids = new Set([...ITEMS, ...STORY_ITEMS].map((i) => i.id))
  const choiceIds = new Set()
  for (const s of all) {
    assert10.ok(s.steps.length > 0, s.id)
    const covered = new Set()
    for (const st of s.steps) {
      assert10.ok(st.w, `${s.id} 갈 곳`)
      if (st.w.startsWith('out:')) assert10.ok(spots.has(st.w.slice(4)), `${s.id} ${st.w}`)
      const needs = [...(st.n ?? []), ...Object.values(st.alt ?? {}).flatMap((by) => Object.values(by).flat())]
      for (const n of needs) {
        if (n.startsWith('battle:')) assert10.ok(D.foes[n.slice(7).split('|')[0]], `${s.id} ${n}`)
        const m = /^(make|inspect):(.+)$/.exec(n); if (m) assert10.ok(ids.has(m[2]), `${s.id} ${n}`)
      }
      for (const r of [st.l, st.pre]) if (r) for (let i = r[0]; i < r[1]; i++) covered.add(i)
    }
    assert10.equal(covered.size, s.lines.length, `${s.id} 의 모든 대사가 어느 단계에 들어 있어야 한다`)
    for (const ln of s.lines) {
      assert10.ok(!('d' in ln), `${s.id} 연출 글(d)이 줄에 남았다`)
      if (ln.x) assert10.ok(!/^\(.*\)$/.test(ln.x.trim()), `${s.id} 괄호 연출이 대사로 나온다: ${ln.x}`)
      if (ln.t === 'choice') { assert10.ok(ln.o.length >= 2); choiceIds.add(ln.id); assert10.ok(D.choices[ln.id], ln.id) }
      if (ln.c) for (const c of ln.c) assert10.ok(choiceIds.has(c.flag), `${s.id} 분기 조건 ${c.flag} 는 앞에서 고른 것이어야 한다`)
      if (ln.op) assert10.equal(s.id, 'P-1')
    }
  }
  assert10.deepEqual([...choiceIds].sort(), Object.keys(D.choices).sort())
  assert10.ok(D.choices['C2-3'].vote, '당산신 선택은 투표')
  // 2장 마지막 전투는 고른 것에 따라 상대가 바뀐다
  const last = chapters[1].scenes.at(-1).steps.find((st) => st.alt)
  assert10.deepEqual(last.alt['C2-3'], { 1: ['battle:effigy'], 2: ['battle:dangsan'], 3: ['battle:dangsan'] })
  assert10.equal(window.BIRYEONG_TITLES.filter((t) => t.from === 'story').length, 3)
  assert10.ok(!JSON.stringify(D.regions).includes('서울'), '바깥 지역 서울은 강릉으로')
})

t10('v1.8 본편: 유품 10종 = 무구 10종(시트 순서) · 무구보관소에서 실제로 준다', async () => {
  const window = {}
  for (const f of ['../titles.js', '../titles2.js', '../story-data.js']) new Function('window', read10(new URL(f, import.meta.url), 'utf8'))(window)
  const D = window.BIRYEONG_QUESTS
  const { ITEMS } = await import('../systems/vault/modules/game/items.js')
  const weapons = ITEMS.filter((i) => i.kind === 'gear' && i.slot === 'weapon').map((i) => i.id).sort()
  assert10.equal(D.heirlooms.length, 10)
  assert10.deepEqual(D.heirlooms.map((h) => h.weapon).sort(), weapons)
  const pick = D.scenes[0].lines.find((l) => l.id === D.heirChoice)
  assert10.deepEqual(pick.o, D.heirlooms.map((h) => h.name))
  assert10.ok(D.scenes.find((s) => s.id === 'P-3').steps.some((st) => st.heir), '무구보관소에서 무구 지급')
})

test('v1.5: 아이템마다 제작법은 하나뿐이고, 겹치던 자리는 새 아이템 81종이 채운다(도트도 따로)', async () => {
  const assert15 = (await import('node:assert/strict')).default
  const { RECIPES } = await import('../systems/vault/modules/game/crafting.js')
  const { COOK_RECIPES } = await import('../systems/vault/modules/game/cooking.js')
  const R = await import('../systems/biryeong/reskin.data.js')
  const all = [...RECIPES, ...COOK_RECIPES, ...R.NEW_RECIPES.W, ...R.NEW_RECIPES.K, ...R.STORY_RECIPES]
  const by = new Map()
  for (const r of all) by.set(r.result, [...(by.get(r.result) ?? []), r.id])
  for (const [id, rs] of by) assert15.equal(rs.length, 1, `${id} 의 제작법이 둘 이상: ${rs.join(', ')}`)
  assert15.equal(R.NEW_ITEMS.length, 81)
  const made = new Set(all.map((r) => r.result))
  const usedAsInput = new Set(all.flatMap((r) => r.inputs.map(([i]) => i)))
  const combos = new Set()
  for (const it of R.NEW_ITEMS) {
    assert15.ok(made.has(it.id), `${it.id} 를 만드는 제작법`)
    if (it.kind === 'material') assert15.ok(usedAsInput.has(it.id), `${it.id} 는 재료인데 쓰는 곳이 없다`)
    const p = R.ITEM_PIXELS[it.id]; assert15.ok(p, `${it.id} 도트`)
    const k = p.t + ':' + p.p; assert15.ok(!combos.has(k), k); combos.add(k)
    assert15.ok(!/네온|사이버|홀로|해킹|칩셋/.test(it.name + it.desc), it.id)
  }
})

test('v1.5: 본교 묶음 10개 — 초록동색 원래 업적 셋은 보관고 업적을 읽고, 새 업적의 셈은 실행 화면이 센다', async () => {
  const assert15 = (await import('node:assert/strict')).default
  const { readFileSync } = await import('node:fs')
  const window = {}
  for (const f of ['../titles.js', '../titles2.js']) new Function('window', readFileSync(new URL(f, import.meta.url), 'utf8'))(window)
  const home = window.BIRYEONG_ACHIEVEMENTS.filter((a) => a.group === 'home')
  assert15.equal(home.length, 10)
  const { ACHIEVEMENTS } = await import('../systems/vault/modules/game/achievements.js')
  const vaultIds = home.filter((a) => a.when.vault).map((a) => a.when.vault).sort()
  assert15.deepEqual(vaultIds, ['gods-gaze', 'model-student', 'student-exercise'])
  for (const id of vaultIds) assert15.equal(home.find((a) => a.when.vault === id).name, ACHIEVEMENTS.find((a) => a.id === id).name)
  const host = readFileSync(new URL('../systems/play/src/usePlayHost.js', import.meta.url), 'utf8')
  for (const a of home) {
    if (a.when.count) assert15.ok(new RegExp(`(bump|peak)\\('${a.when.count}'`).test(host), a.id)
    if (a.when.pset) assert15.ok(host.includes(`collect('${a.when.pset}'`), a.id)
  }
  assert15.ok(readFileSync(new URL('../app.js', import.meta.url), 'utf8').includes('w.vault ?'), 'app.js 가 when.vault 를 읽는다')
})

test('v1.6: 아이템 시트 수정 — 붉은여우 부적은 일행 전용 · 영능력 빌리기, 해설 셋이 바뀌었다', async () => {
  const assert16 = (await import('node:assert/strict')).default
  const R = await import('../systems/biryeong/reskin.data.js')
  const fox = R.ITEM_EDITS['red-fox-charm']
  assert16.equal(fox.party, true); assert16.equal(fox.effect.borrowPsychic, 1)
  assert16.ok(fox.effectText.includes('파티 상태에서만'))
  assert16.ok(R.ITEM_EDITS['hawk-cheollik'].desc.includes('3000만원'))
  assert16.ok(R.ITEM_EDITS['oyster-mushroom-hotpot'].desc.endsWith('설마.'))
  assert16.ok(R.NEW_ITEMS.find((i) => i.id === 'nw-red-centipede-charm').desc.includes('안 끔찍하고?'))
  const { canUseItem, ITEMS } = await import('../systems/vault/modules/game/items.js')
  const item = { ...ITEMS.find((i) => i.id === 'red-fox-charm'), ...fox }
  assert16.equal(canUseItem(item, { inBattle: true, isParty: false, countNow: 1 }).ok, false)
  const P = (await import('../systems/play/patches.mjs')); const list = P.default ?? P.PATCHES ?? Object.values(P).find(Array.isArray)
  assert16.ok(list.some((x) => x.file === 'game/mbattle.js' && x.edits.some(([, b]) => b.includes('borrowPsychic'))))
})

test('v1.7: 배포되는 파일 어디에도 옛 이름이 없다 · 도감 자료(아이템 · 영능력 · 적)가 있다', async () => {
  const assert17 = (await import('node:assert/strict')).default
  const { readFileSync } = await import('node:fs')
  const files = ['index.html', 'app.js', 'auth.js', 'config.js', 'styles.css', 'community.js', 'community.css', 'game-data.js', 'titles.js', 'titles2.js', 'story.js', 'story-data.js', 'sync.js', 'quest.js', 'opening.js', 'codex-data.js', 'server.js', 'play/play.js', 'play/play.css']
  for (const f of files) {
    const t = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert17.ok(!/초록동색|草綠|창록|昌綠|chorok|changnok/i.test(t), `${f} 에 옛 이름이 남았다`)
  }
  const window = {}
  new Function('window', readFileSync(new URL('../codex-data.js', import.meta.url), 'utf8'))(window)
  const C = window.BIRYEONG_CODEX
  assert17.equal(C.items.length, 457) // vC.06: 몸의 이상을 낫게 하는 물건 28가지; assert17.equal(C.psychics.filter((p) => !p.stolen).length, 13); assert17.equal(C.psychics.filter((p) => p.stolen).length, 69); assert17.ok(C.enemies.length >= 62)
  // 「」 는 본편 장면 · 유품 이름에만 쓴다(v1.9.7). 개척 영물 · 요괴 이름은 짧은 획득처에 넣지 않는다.
  for (const i of C.items) { assert17.ok(i.from, i.id); for (const part of i.from.split(' / ')) assert17.ok(!/「/.test(part) || /^본편/.test(part), `${i.id} 획득처에 영물 · 요괴 이름이 들어갔다: ${part}`) }
  assert17.ok(C.enemies.some((e) => e.specials.length === 2), '영능력이 둘인 적')
})

test('v1.8: 1 · 2장 장 파일은 사이트에 올라가지 않는다(관리자가 올리고 공개한다)', async () => {
  const assert18 = (await import('node:assert/strict')).default
  const { readFileSync } = await import('node:fs')
  const yml = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const srv = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8')
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  for (const t of [yml, srv, html]) assert18.ok(!/story-chapters/.test(t), '배포 목록에 장 파일이 있으면 안 된다')
  assert18.ok(/codex-data\.js/.test(yml) && /opening\.js/.test(yml))
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  assert18.ok(/chapters_read_open[\s\S]*open_at <= now\(\)/.test(sql), '공개 전 장은 서버가 내주지 않는다')
  assert18.ok(/story_admin_set/.test(sql) && /option between 1 and 12/.test(sql))
})

// ───────── v1.9 서버(Supabase): 계정 · 기록 · 소통 공간 · 관리자 / 이야기 화면은 그림 없이 ─────────
import { test as t19 } from 'node:test'
import assert19 from 'node:assert/strict'
t19('v1.9: 서버 함수가 모두 있고, 표는 공개 키로 직접 닿지 않는다', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  const used = new Set()
  for (const f of ['auth.js', 'community.js', 'server.js']) for (const m of readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').matchAll(/'(bry_[a-z_]+)'/g)) used.add(m[1])
  assert19.ok(used.size >= 25, `화면이 부르는 서버 함수 ${used.size}개`)
  for (const fn of used) assert19.ok(new RegExp(`create or replace function public\\.${fn}\\(`).test(sql), `schema.sql 에 ${fn} 이 없다`)
  assert19.ok(/revoke all on all tables in schema biryeong_private from anon, authenticated/.test(sql))
  assert19.ok(/revoke all on public\.cloud_saves from anon/.test(sql), '예전 기록 백업 표는 닫는다')
  assert19.ok(/crypt\(p_password, gen_salt\('bf'/.test(sql), '비밀번호는 bcrypt 해시로만')
  for (const fn of ['bry_admin_users', 'bry_admin_user_set', 'bry_admin_dm_messages', 'bry_admin_grant', 'bry_admin_notice', 'bry_admin_audit', 'bry_admin_save'])
    assert19.ok(new RegExp(`function public\\.${fn}\\([\\s\\S]{0,400}?:= adm\\(p_token\\)`).test(sql), `${fn} 은 관리자만`)
})
t19('v1.9: 새 키(sb_publishable_)는 Authorization 에 넣지 않는다 · server.js 가 배포된다', () => {
  for (const f of ['auth.js', 'sync.js']) assert19.ok(/\^eyJ/.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')), f)
  assert19.ok(/server\.js/.test(readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')))
  assert19.ok(/'server\.js'/.test(readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8')))
  assert19.ok(/src="server\.js(\?v=[^"]+)?"/.test(readFileSync(new URL('../index.html', import.meta.url), 'utf8')))
})
t19('v1.9: 이야기 화면에 배경 · 장면 그림이 없다', () => {
  const q = readFileSync(new URL('../quest.js', import.meta.url), 'utf8')
  assert19.ok(!/vn-bg|vn-stage|vn-fx|_scene\.png|BiryeongOpening\?*\.stage/.test(q), '이야기 화면은 대사 창만')
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
  assert19.ok(!/\.vn-bg|\.vn-stage|\.vn-tint|\.vn-crack|\.vn-ink/.test(css))
})

// ───────── v1.9.5 본편 3인 전투 · 파티 · 튜토리얼 ─────────
import { test as t195 } from 'node:test'
import assert195 from 'node:assert/strict'
t195('v1.9.5: 본편 전투는 3인(StoryParty)으로 열리고, 파티 함수가 서버에 있다', () => {
  const app = readFileSync(new URL('../systems/play/src/App.jsx', import.meta.url), 'utf8')
  assert195.ok(/<StoryParty /.test(app) && !/<HuntBattleModal[^>]*storyFight/.test(app), '본편 전투는 StoryParty')
  const sp = readFileSync(new URL('../systems/play/src/StoryParty.jsx', import.meta.url), 'utf8')
  assert195.ok(/연호수/.test(sp) && /윤진서/.test(sp))
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  for (const fn of ['bry_party_list', 'bry_party_create', 'bry_party_join', 'bry_party_leave', 'bry_party_get', 'bry_party_start', 'bry_party_push', 'bry_party_act']) {
    assert195.ok(new RegExp(`function public\\.${fn}\\(`).test(sql), fn)
    assert195.ok(sp.includes(`'${fn}'`), `화면이 ${fn} 을 부른다`)
  }
})
t195('v1.9.5: 튜토리얼 허수아비는 체력이 크고 되살리지 않는다 · #3은 오른쪽 아래 소지품 버튼', () => {
  const p = readFileSync(new URL('../systems/play/patches.mjs', import.meta.url), 'utf8')
  assert195.ok(/hp: 9999/.test(p) && /finisher: true/.test(p))
  assert195.ok(/data-tutorial-real-items-btn/.test(readFileSync(new URL('../index.html', import.meta.url), 'utf8')))
  const play = readFileSync(new URL('../play/play.js', import.meta.url), 'utf8')
  assert195.ok(!/내 소지품 확인하기/.test(play), '없는 버튼을 누르라는 안내가 남아 있으면 안 된다')
})

// ───────── v1.9.6 투표 루트 공개 ─────────
import { test as t196 } from 'node:test'
import assert196 from 'node:assert/strict'
t196('v1.9.6: 투표 루트는 관리자가 공개해야 이어지고, 전투 안내에 정답이 없다', () => {
  const q = readFileSync(new URL('../quest.js', import.meta.url), 'utf8')
  assert196.ok(/function flagOf\(id, sid\)/.test(q) && /routeWait/.test(q) && /adminRoute\(/.test(q))
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  assert196.ok(/create table if not exists public\.story_routes/.test(sql) && /function public\.story_admin_route\(/.test(sql) && /routes_read_open/.test(sql))
  assert196.ok(!/한도윤\)/.test(readFileSync(new URL('../story-chapters/ch1.json', import.meta.url), 'utf8')))
})

// ───────── v1.9.7 중요한 아이템 · 본편 획득처 ─────────
import { test as t197 } from 'node:test'
import assert197 from 'node:assert/strict'
t197('v1.9.7: 본편 전리품은 중요한 아이템이고, 획득처에 몇 장 어느 장면인지 적힌다', async () => {
  const R = await import('../systems/biryeong/reskin.data.js')
  const key = R.STORY_ITEMS.filter((i) => i.tags?.includes('중요한 아이템')).map((i) => i.id)
  for (const id of ['st-bell302', 'st-roll', 'st-nametag', 'st-dangsan-twig']) assert197.ok(key.includes(id), id)
  for (const id of ['st-tangerine', 'st-name-charm']) assert197.ok(!key.includes(id), `${id} 은 중요한 아이템이 아니다`)
  const w = {}; new Function('window', readFileSync(new URL('../codex-data.js', import.meta.url), 'utf8'))(w)
  const from = Object.fromEntries(w.BIRYEONG_CODEX.items.map((i) => [i.id, i.from]))
  assert197.match(from['st-bell302'], /본편 1장 「.+」에서 받는다/)
  assert197.match(from['st-roll'], /본편 1장 「.+」 — 이야기 전투 전리품/)
  assert197.match(from['st-dangsan-twig'], /② · ③ 루트/)
  const play = readFileSync(new URL('../play/play.js', import.meta.url), 'utf8')
  assert197.ok(/data-key-items/.test(play) && !/취득 경로 미정/.test(play))
})

// ───────── v1.9.8 모든 아이템에 획득처 ─────────
import { test as t198 } from 'node:test'
import assert198 from 'node:assert/strict'
t198('v1.9.8: 획득처가 없는 것은 본편 전용 아이템뿐 · 개척 덤은 일반 재료에만, 낮은 확률로', async () => {
  const w = {}; new Function('window', readFileSync(new URL('../codex-data.js', import.meta.url), 'utf8'))(w)
  const none = w.BIRYEONG_CODEX.items.filter((i) => /^아직/.test(i.from)).map((i) => i.id)
  assert198.ok(none.every((id) => id.startsWith('st-')), `본편 전용이 아닌데 획득처가 없다: ${none.filter((id) => !id.startsWith('st-'))}`)
  const R = await import('../systems/biryeong/reskin.data.js')
  assert198.ok(R.HUNT_EXTRA.length === 6 && R.HUNT_EXTRA.every((x) => !x.item.startsWith('st-') && x.chance > 0 && x.chance <= 0.3))
})

// ───────── vB.01 ─────────
import { test as tB01 } from 'node:test'
import assertB01 from 'node:assert/strict'
tB01('vB.01: 지신성 없음 · 수업 랭킹은 서버로 · 업데이트 노트는 vB.01 하나 · 나가기 확인 · 조사 글', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assertB01.ok(!/data-community="social"/.test(html) && !/data-community-tab="social"/.test(html), '지신성 단추가 없다')
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  assertB01.ok(/const UPDATE_NOTES = \[\];/.test(app) && !/v: 'v1\.\d/.test(app), '예전 노트는 지웠다(vC.01: 모두 비움)')
  assertB01.ok(/정말 나가겠습니까\? 지금 나가면 보상을 얻을 수 없습니다\./.test(app))
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  for (const fn of ['bry_rank', 'bry_rank_submit', 'bry_notes', 'bry_admin_note_post', 'bry_admin_note_delete']) assertB01.ok(new RegExp(`function public\\.${fn}\\(`).test(sql), fn)
  const J = JSON.parse(readFileSync(new URL('../systems/biryeong/josa-overrides.json', import.meta.url), 'utf8'))
  assertB01.ok(J.edits.length >= 20 && J.edits.some((e) => e.name === '비령산 학당 (??%)'))
})

test('vB.02: 같은 파일의 조각 묶음은 모두 끼워진다 (소지품 [조사한다] · 급식실 사연 · 랭킹)', async () => {
  const { applyPatches } = await import('../systems/play/patches.mjs');
  const inv = applyPatches('ui/components/InventoryModal.jsx', readFileSync(join(VAULT, 'modules/ui/components/InventoryModal.jsx'), 'utf8'));
  assert.ok(inv.includes('data-inspect') && inv.includes('data-key-items'));
  const on = applyPatches('ui/adapters/online.js', readFileSync(join(VAULT, 'modules/ui/adapters/online.js'), 'utf8'));
  assert.ok(on.includes('__BRY_CAFE') && on.includes('__BRY_RANK'));
});

test('vB.02: 서버 이름은 캐릭터 이름을 따른다 (기록 저장 · 밀담 · 관리자 열람)', () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8');
  assert.match(sql, /p_data #>> '\{profile,name\}'/);
  assert.match(sql, /'sender_name', u\.display_name/);
  assert.match(sql, /'name_low', l\.display_name/);
  const cm = readFileSync(join(ROOT, 'community.js'), 'utf8');
  assert.ok(cm.includes('message.sender_name') && !cm.includes('`@${message.sender_username}'));
});

test('vB.03: 적의 영능력 빼앗기 — 일반 30번 · 보스 20번마다 하나씩 · 본편 전투는 세지 않는다', async () => {
  const S = await import('../systems/play/src/steal.js')
  const { ALL_ENEMIES } = await import('../systems/vault/modules/game/battle.js')
  const defs = S.stolenPsychics(ALL_ENEMIES)
  assert.equal(defs.length, 69)
  for (const d of defs) { assert.ok(d.detail.length > 10 && d.k.mp >= 0, d.id); assert.ok(!/초록동색/.test(d.note + d.detail + d.cond)) }
  const fox = ALL_ENEMIES.find((e) => e.id === 'foxfire')
  let p = { psychics: [], killCount: { foxfire: 28 } }
  p = S.noteKill(p, fox, () => 0, defs).player; assert.ok(!p.psychics.includes('steal-foxfire'))
  const r30 = S.noteKill(p, fox, () => 0, defs); assert.deepEqual(r30.got, ['steal-foxfire']); assert.equal(r30.player.killCount.foxfire, 30)
  const boss = ALL_ENEMIES.find((e) => e.id === 'gumiho')
  let b = { psychics: [], killCount: { gumiho: 19 } }
  const b20 = S.noteKill(b, boss, () => 0.99, defs); assert.equal(b20.got.length, 1); b = b20.player
  b = { ...b, killCount: { gumiho: 38 } }
  assert.equal(S.noteKill(b, boss, () => 0.5, defs).got.length, 0)
  const b40 = S.noteKill({ ...b, killCount: { gumiho: 39 } }, boss, () => 0.5, defs); assert.equal(b40.got.length, 1)
  assert.equal(new Set([...b40.player.psychics]).size, 2)
  assert.equal(S.noteKill({ psychics: [] }, { id: 'story-x', name: '이야기' }, Math.random, defs).player.killCount, undefined)
  // 개척 요괴와 묵은 원귀는 같은 「원한의 저주」 하나
  assert.deepEqual(S.stealableOf({ id: 'tree-spirit' }).map((x) => x.id), ['steal-curse'])
  // 실행 화면 조각: 영능력 목록에 붙고, 쓰면 stolenTurn 이 처리한다
  const { applyPatches } = await import('../systems/play/patches.mjs')
  const src = applyPatches('game/battle.js', readFileSync(join(VAULT, 'modules/game/battle.js'), 'utf8'))
  assert.ok(src.includes('...stolenPsychics(ALL_ENEMIES)') && src.includes('return __stolenTurn(') && src.includes('__bryHead('))
  for (const d of defs) assert.equal(d.k.mp % 5, 0, `${d.id} 의지력은 5의 배수`) // vC.01
})

test('vB.03: 본편 보상 · 서버 선택은 최초 1회만 · 관리자 기록도 랭킹에 오른다', () => {
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8')
  assert.ok(q.includes("claimOnce(`give:${stepKey}`)") && q.includes("claimOnce(`done:${scene.id}`)") && q.includes('cs.sent[ln.id]'))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.match(sql, /create trigger story_choice_first before insert on public\.story_choices/)
  assert.match(sql, /drop policy if exists choices_update/)
  assert.ok(!/if a\.role = 'admin' then return jsonb_build_object\('ok', true, 'recorded', false/.test(sql))
  assert.match(readFileSync(join(ROOT, 'sync.js'), 'utf8'), /resolution=ignore-duplicates/)
})

test('vB.04: 오방색 배치 · 영능력 도감 양식 · 하루 영력 전투 3번(냥은 제한 없음)', async () => {
  const D = {}; new Function('window', readFileSync(join(ROOT, 'game-data.js'), 'utf8'))(D)
  const tabs = Object.fromEntries(Object.values(D.BIRYEONG_DATA.zones).flatMap((z) => z.tabs.map((t) => [t.id, t.hanja])))
  assert.deepEqual([tabs.mainHall, tabs.annex, tabs.dorm, tabs.gym, tabs.shrine], ['靑', '靑', '白', '赤', '黃'])
  const rs = readFileSync(join(ROOT, 'systems/play/src/reskin.js'), 'utf8')
  assert.ok(rs.includes("LOCATIONS.dorm, { hanja: '白'") && rs.includes("LOCATIONS.annex, { hanja: '靑'"))
  assert.match(readFileSync(join(ROOT, 'styles.css'), 'utf8'), /\.zone-card\.north\{--accent:#0a0c12/)
  const C = {}; new Function('window', readFileSync(join(ROOT, 'codex-data.js'), 'utf8'))(C)
  const SIX = ['안목', '호전', '인내', '절제', '신속', '이해', '육조 가운데 가장 높은 스탯', '없음']
  for (const p of C.BIRYEONG_CODEX.psychics) {
    assert.ok(p.mp && p.detail && p.cond && p.affects, p.id)
    for (const a of p.affects.split(' · ')) assert.ok(SIX.includes(a), `${p.id}: ${a}`)
    assert.ok(!/취득 경로 미정/.test(p.cond), p.id)
  }
  const cap = await import('../systems/play/src/spiritCap.js')
  let p = {}; for (let i = 0; i < 3; i++) p = cap.countSpiritWin(p)
  assert.equal(cap.spiritWinsLeft(p), 0); assert.equal(cap.spiritWinsLeft(p, Date.now() + 86400000 * 2), 3)
  const { applyPatches } = await import('../systems/play/patches.mjs')
  const pr = applyPatches('game/progress.js', readFileSync(join(VAULT, 'modules/game/progress.js'), 'utf8'))
  assert.ok(pr.includes('money: player.money + reward, gym: g }, granted: 0, money: reward'))
  assert.ok(applyPatches('game/huntField.js', readFileSync(join(VAULT, 'modules/game/huntField.js'), 'utf8')).includes('__left(player, now) <= 0'))
  assert.ok(applyPatches('game/hunt.js', readFileSync(join(VAULT, 'modules/game/hunt.js'), 'utf8')).includes('__left(rest, now) <= 0'))
})

test('vC.01: 추가전투 단계 공개 · 난이도 재조정 · 얼굴 자리 · 훈련관 튜토리얼 · 배너 링크 · 부하 줄이기', async () => {
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8'), app = readFileSync(join(ROOT, 'app.js'), 'utf8'), html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8'), sync = readFileSync(join(ROOT, 'sync.js'), 'utf8'), auth = readFileSync(join(ROOT, 'auth.js'), 'utf8')
  // 1 · 2 추가전투
  assert.ok(q.includes("'EXTRA_TIER'") && q.includes('extraTier:'))
  const T = await import('../systems/play/src/tierScale.js')
  const e = T.rescaleEnemy({ tier: 10, hp: 1000, atk: 100, act: 60, spirit: 60, reward: 120 })
  assert.ok(e.hp < 1000 && e.reward === 120); assert.equal(T.rescaleEnemy(e).hp, e.hp) // 두 번 불러도 한 번만 · 보상은 그대로
  // 5 · 6 얼굴
  assert.ok(q.includes("const MAIN_CAST = ['윤진서', '연호수', '△△', '비', '서창현']") && q.includes("'秘靈'") && q.includes("'pt-seal is-plain'"))
  assert.ok(!/\[\.\.\.shown\]\[0\]/.test(q), '엑스트라 얼굴에 글자를 넣지 않는다')
  // 7 훈련관
  const { applyPatches } = await import('../systems/play/patches.mjs')
  const tut = applyPatches('ui/components/BattleTutorial2.jsx', readFileSync(join(VAULT, 'modules/ui/components/BattleTutorial2.jsx'), 'utf8'))
  assert.ok(tut.includes("'훈련관'") && !tut.includes('npcName(GUIDE)') && tut.includes('data-tutor-face') && !tut.includes('npc-portrait'))
  assert.ok(tut.includes('자, 주목! 지금부터 전투를 알려 줄게.') && !tut.includes('알려 드릴게요'))
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'systems/biryeong/tutor-lines.json'), 'utf8')).length, 88)
  // 8 배너
  assert.ok(app.includes('https://cafe.naver.com/occultblue') && app.includes('1K2-S1SxB3rrrBRc1oMBVMZRg9Nbv8XIJ5Lbwo2yoii4'))
  assert.ok(html.includes('비령 통합안내사항') && html.includes('비령 카페'))
  // 9 선택 집계 이름
  assert.match(sql, /function public\.story_admin_names\(/)
  // 11 부하
  assert.ok(sync.includes("story_chapters?select=ch,updated_at&order=ch") && !sync.includes("call('story_chapters?select=ch,title,content&order=ch')"))
  assert.ok(auth.includes('PUSH_GAP') && auth.includes('"savedAt":0'))
  assert.match(sql, /function public\.bry_party_get\(p_token text, p_id bigint, p_seq integer default null\)/)
  assert.match(sql, /'version', 'C\.0[167]'/)
})

test('vC.02: 육조 스탯 만렙 40 · 추가전투 1~10단계 재조정(보스는 언제나 훨씬 어렵다)', async () => {
  const { applyPatches } = await import('../systems/play/patches.mjs')
  assert.ok(applyPatches('game/constants.js', readFileSync(join(VAULT, 'modules/game/constants.js'), 'utf8')).includes('export const STAT_MAX = 40 //'))
  const D = {}; new Function('window', readFileSync(join(ROOT, 'game-data.js'), 'utf8'))(D)
  assert.equal(D.BIRYEONG_DATA.rules.statMax, 40)
  const T = await import('../systems/play/src/tierScale.js')
  assert.equal(T.STAT_CAP, 40); assert.match(T.TIER_REC[10], /^50/)
  const { ALL_ENEMIES } = await import('../systems/vault/modules/game/battle.js')
  const list = ALL_ENEMIES.filter((e) => e.tier).map((e) => T.rescaleEnemy({ ...e }))
  for (let t = 1; t <= 10; t++) {
    const here = list.filter((e) => e.tier === t), normal = here.filter((e) => !e.boss && e.partySize <= 1), boss = here.filter((e) => e.boss)
    assert.ok(boss.length >= 1 && normal.length >= 1, `${t}단계`)
    const top = Math.max(...normal.map((e) => e.hp))
    for (const b of boss) assert.ok(b.hp > top, `${t}단계 보스 ${b.name}의 체력은 보통 적보다 많다`)
    assert.equal(here[0].rec, T.TIER_REC[t])
  }
  // 단계가 오를수록 보통 적은 단단해진다
  const avg = (t) => { const n = list.filter((e) => e.tier === t && !e.boss && e.partySize <= 1); return n.reduce((x, e) => x + e.hp, 0) / n.length }
  for (let t = 2; t <= 10; t++) assert.ok(avg(t) > avg(t - 1), `${t}단계 > ${t - 1}단계`)
})

test('vC.04: app.js 는 없는 이름(App)을 부르지 않는다 — 업데이트 노트 화면이 비어 버리던 원인', () => {
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
  assert.ok(!/(^|[^.\w])App\.[a-zA-Z]+\(/.test(app), 'app.js 안에서는 Auth · window.BiryeongApp 를 쓴다')
  assert.ok(/function renderNotes\(\)[\s\S]{0,400}Auth\.isAdmin\(\)/.test(app))
})

test('vC.05: 막기는 1d(인내)만큼 더 막는다 · 튜토리얼 체력/의지력 기억 · 업적 · 아이템 가나다순', async () => {
  const { applyPatches } = await import('../systems/play/patches.mjs')
  const b = applyPatches('game/battle.js', readFileSync(join(VAULT, 'modules/game/battle.js'), 'utf8'))
  assert.ok(b.includes('const blockD = die(Math.max(1, Math.floor(stats.endurance || 0)), rng)') && b.includes('dmg = Math.max(0, reduced - blockD)'))
  assert.ok(b.includes("1d(인내)만큼 더 막는다"))
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes('tutorialSnap: { hp: cur.hp, mp: cur.mp }, hp: cur.hpMax, mp: cur.mpMax') && host.includes('onTutorialActive,'))
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
  assert.ok(app.includes("ACHIEVEMENTS.filter((a) => a.group === group.id).sort(byName)") && app.includes('.sort(byName).forEach((i) =>'))
})

test('vC.06: 몸의 이상 · 동아리 활동 · 인물의 부탁 · 실습장 상대 · 접속자/도깨비들의 터 · 업적/도감 창', async () => {
  const A = await import('../systems/play/src/ailments.js')
  assert.equal(A.AILMENTS.length, 10)
  const now = Date.now()
  let p = { stats: { insight: 10, aggression: 10, endurance: 10, control: 10, agility: 10, comprehension: 10 }, inventory: {} }
  p = A.addAilment(p, 'sadok', now); p = A.addAilment(p, 'sadok', now, 9)
  assert.equal(p.ailments.sadok.stack, 5, '사독은 5겹까지')
  p = A.addAilment(p, 'salgi', now)
  assert.equal(A.ailmentStatBonus(p, now).insight, -2)
  assert.equal(A.cureAilments(p, ['sadok']).player.ailments.sadok, undefined)
  assert.ok(A.shortenAilments(p, ['salgi'], 5 * 60000, now).player.ailments.salgi.until <= now + 5 * 60000)
  for (const a of A.AILMENTS) { const c = A.curesFor(a.id); assert.ok(c.cure.length && c.restore.length && c.shorten.length, `${a.name}: 완치 · 완치+회복 · 시간 줄이기`) }
  // 무거운 이상 둘을 한 번에 낫게 하는 물건은 없다
  for (const it of A.AIL_ITEMS) if ((it.effect.cureAil || []).length > 1) assert.ok(it.effect.cureAil.every((id) => !A.AIL[id].heavy), it.name)
  const codex = readFileSync(join(ROOT, 'codex-data.js'), 'utf8')
  assert.ok(codex.includes('먹구렁이에게서 빼앗은 영능력') && codex.includes('무쇠 장승') && !codex.includes('을(를) 30번'))
  const patches = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  assert.ok(patches.includes('__ailRound()') && patches.includes('__ailStat(player, now)') && patches.includes('<NpcQuests place='))
  // 인물의 부탁: 셋이 15건씩, 사당에는 없다
  const NQ = readFileSync(join(ROOT, 'systems/play/src/npcQuests.js'), 'utf8')
  for (const npc of ['yeon', 'seo', 'yoon']) assert.equal((NQ.match(new RegExp(`Q\\('[a-z]\\d\\d', '${npc}'`, 'g')) || []).length, 15, npc)
  assert.ok(!/Q\('[a-z]\d\d', '[a-z]+', 'shrine/.test(NQ), '사당에는 부탁이 없다')
  // 동아리 활동
  const C = readFileSync(join(ROOT, 'systems/play/src/clubQuests.js'), 'utf8')
  assert.ok(C.includes("id: 'win10'") && C.includes("e.tier === tier && !e.boss"))
  // 화면
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(html.includes('id="onlineBtn"') && !html.includes('id="storyBtn"') && html.includes('data-party-open') && html.includes('id="codexDialog"') && html.includes('id="statusConditions"'))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('[일행이 생성되었습니다. 자유롭게 대화를 나눌 수 있습니다.]') && sql.includes('종단 간 암호화 대화는 아닙니다.]') && sql.includes('function public.bry_rooms_ended'))
  const titles = readFileSync(join(ROOT, 'titles.js'), 'utf8')
  assert.ok(!titles.includes('지신성') && titles.includes('도깨비들의 터'))
})

test('vC.07: 메인 인물 그림 · 본편 1인/다인 · 돕는 선배 · 접속자 프로필', () => {
  const cfg = readFileSync(join(ROOT, 'config.js'), 'utf8')
  for (const f of ['dd-base', 'dd-smile', 'bi-base', 'seo-sweat', 'yeon-frown', 'yoon-surprised']) { assert.ok(cfg.includes(`assets/portraits/${f}.webp`)); assert.ok(existsSync(join(ROOT, `assets/portraits/${f}.webp`)), f) }
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8')
  assert.ok(q.includes('function faceOf(k, ln)') && q.includes("claimOnce(`npc:${r.key}`)") && q.includes('bry_party_help_list'))
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes('data-story-solo') && sp.includes('npcUsed') && sp.includes('helper: true'))
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes('const storySize = (key)') && host.includes('2 * Math.max(1') && host.includes("fight.first === false ? null : dropOf"))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('function public.bry_player_card') && sql.includes('function public.bry_party_help_list') && sql.includes("update accounts set last_seen = now() where id = a.id"))
  const pj = readFileSync(join(ROOT, 'party.js'), 'utf8')
  assert.ok(pj.includes('users = [mine, ...users') && pj.includes("call('bry_player_card'"))
})
