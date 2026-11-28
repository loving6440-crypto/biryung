import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as Vault from '../systems/vault/index.mjs';
import { applyPatches as applyPatchesSync } from '../systems/play/patches.mjs';

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
  const chapters = [1, 2, 3, 4].map((n) => JSON.parse(read10(new URL(`../story-chapters/ch${n}.json`, import.meta.url), 'utf8')))
  chapters.forEach((c, i) => { assert10.equal(c.format, 'biryeong-chapter'); assert10.equal(c.ch, i + 1); assert10.ok(c.scenes.every((s) => s.ch === i + 1)) })
  const all = [...D.scenes, ...chapters.flatMap((c) => c.scenes)]
  assert10.equal(all.length, 26) // vD.02.2 3장 5장면 · vD.03 4장 5장면
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
        const m = /^(make|inspect|bring):([^×]+)/.exec(n); if (m) assert10.ok(ids.has(m[2]), `${s.id} ${n}`)
      }
      for (const r of [st.l, st.pre]) if (r) for (let i = r[0]; i < r[1]; i++) covered.add(i)
    }
    assert10.equal(covered.size, s.lines.length, `${s.id} 의 모든 대사가 어느 단계에 들어 있어야 한다`)
    for (const ln of s.lines) {
      assert10.ok(!('d' in ln), `${s.id} 연출 글(d)이 줄에 남았다`)
      if (ln.x) assert10.ok(!/^\(.*\)$/.test(ln.x.trim()), `${s.id} 괄호 연출이 대사로 나온다: ${ln.x}`)
      if (ln.t === 'choice') { assert10.ok(ln.o.length >= 2); choiceIds.add(ln.id); assert10.ok(D.choices[ln.id], ln.id) }
      if (ln.c) for (const c of ln.c) if (!c.grade) assert10.ok(choiceIds.has(c.flag), `${s.id} 분기 조건 ${c.flag} 는 앞에서 고른 것이어야 한다`)
      if (ln.op) assert10.equal(s.id, 'P-1')
    }
  }
  assert10.deepEqual([...choiceIds].sort(), Object.keys(D.choices).sort())
  assert10.ok(D.choices['C2-3'].vote, '당산신 선택은 투표')
  // 2장 마지막 전투는 고른 것에 따라 상대가 바뀐다
  const last = chapters[1].scenes.at(-1).steps.find((st) => st.alt)
  assert10.deepEqual(last.alt['C2-3'], { 1: ['battle:effigy'], 2: ['battle:dangsan'], 3: ['battle:dangsan'] })
  assert10.equal(window.BIRYEONG_TITLES.filter((t) => t.from === 'story').length, 5)
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
  assert17.equal(C.items.length, 479) // vD.06 괴담 수칙서 · vC.06: 몸의 이상을 낫게 하는 물건 28가지; assert17.equal(C.psychics.filter((p) => !p.stolen).length, 13); assert17.equal(C.psychics.filter((p) => p.stolen).length, 69); assert17.ok(C.enemies.length >= 62)
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
  assert198.ok(R.HUNT_EXTRA.length === 4 && !R.HUNT_EXTRA.some((x) => x.item === 'friendship-letter') && // vD.04.1 우정 편지는 매점으로
    R.HUNT_EXTRA.every((x) => !x.item.startsWith('st-') && x.chance > 0 && x.chance <= 0.3))
})

// ───────── vB.01 ─────────
import { test as tB01 } from 'node:test'
import assertB01 from 'node:assert/strict'
tB01('vB.01: 지신성 없음 · 수업 랭킹은 서버로 · 업데이트 노트는 vB.01 하나 · 나가기 확인 · 조사 글', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  assertB01.ok(!/data-community="social"/.test(html) && !/data-community-tab="social"/.test(html), '지신성 단추가 없다')
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  assertB01.ok(!/UPDATE_NOTES/.test(app) && !/v: 'v1\.\d/.test(app), '예전 노트는 지웠다(V.01: 업데이트 노트 창 자체를 동아리 창으로 바꿨다)')
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
  assert.match(readFileSync(join(ROOT, 'sync.js'), 'utf8'), /bry_story_choice/)
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
  assert.ok(e.hp < 1000 && e.reward === 160); assert.equal(T.rescaleEnemy(e).hp, e.hp) // 두 번 불러도 한 번만 · vD.02 보상은 단계 표(TIER_REWARD)
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
  assert.ok(app.includes('https://cafe.naver.com/biryungkic102') && app.includes('1K2-S1SxB3rrrBRc1oMBVMZRg9Nbv8XIJ5Lbwo2yoii4'))
  assert.ok(html.includes('비령 통합안내사항') && html.includes('비령 카페'))
  // 9 선택 집계 이름
  assert.match(sql, /function public\.story_admin_names\(/)
  // 11 부하
  assert.ok(sync.includes("story_chapters?select=ch,updated_at&order=ch") && !sync.includes("call('story_chapters?select=ch,title,content&order=ch')"))
  assert.ok(auth.includes('PUSH_GAP') && auth.includes('"savedAt":0'))
  assert.match(sql, /function public\.bry_party_get\(p_token text, p_id bigint, p_seq integer default null\)/)
  assert.match(sql, /'version', '(C\.0[167]|D\.0[123456](\.[1-9])?)'/)
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
  assert.ok(/function renderClubs\(\)/.test(app) && !/function renderNotes\(\)/.test(app), 'V.01 업데이트 노트 창 → 동아리 창')
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
  assert.ok(codex.includes('승자독식') && codex.includes('무쇠 장승') && !codex.includes('을(를) 30번'))
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
  assert.ok(host.includes('const storySize = () => 3') && host.includes('2 * Math.max(1') && host.includes("fight.first === false ? null : dropOf"))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('function public.bry_player_card') && sql.includes('function public.bry_party_help_list') && sql.includes("update accounts set last_seen = now() where id = a.id"))
  const pj = readFileSync(join(ROOT, 'party.js'), 'utf8')
  assert.ok(pj.includes('users = [mine, ...users') && pj.includes("call('bry_player_card'"))
})

test('vC.07.2: Pages 배포가 맨 위의 화면 파일(party.js 포함)을 모두 담고, 판 번호를 모든 주소에 붙인다', () => {
  const wf = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8')
  assert.ok(wf.includes('cp index.html *.js *.css .nojekyll _site/'))
  assert.ok(wf.includes('party.js?v=$V'))
  assert.ok(!/grep -o 'src="\[a-z\]\*\\\.js\?v=\[0-9a-f\]\*"'/.test(wf), '옛 grep(판 번호 C.07.1 에서 실패)은 없어야 한다')
})

test('vC.07.3: 일행 전투 — 도깨비들의 터 일행끼리 추가전투 · 실습 상대와 함께', () => {
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes("roomFight = fight.mode === 'room'") && sp.includes('const hpMul = (n)') && sp.includes("fight.mode !== 'room' && party?.id"))
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes('const roomFight = (enemyId, join = null)') && host.includes("if (fight.mode === 'room')"))
  assert.ok(readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8').includes('<RoomFight enemy={e}'))
  assert.ok(readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8').includes("p.stage = 'room:' || r.id"))
  assert.ok(readFileSync(join(ROOT, 'party.js'), 'utf8').includes('function showFight(f)'))
})

test('vC.07.4: 「다인 전투」 상대(적정 2 · 3명)의 [겨루기]가 일행이 있으면 열린다', () => {
  const app = readFileSync(join(ROOT, 'systems/play/src/App.jsx'), 'utf8')
  assert.ok(!app.includes('multi={null}') && app.includes('canParty: roomOk && leaderOk && !host.storyFight') && app.includes('lobby: null'))
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes('hpMul(n) / hpMul(base)') && sp.includes('const hpMul = (n) => (n <= 1 ? 1 : PARTY_HP)')) // vD.02 2명도 3인 기준
})

test('vC.07.5: 관리자 — 학생의 스탯 · 체력/의지력/영력 · 쇠약 · 몸의 이상 · 영능력 고치기, 영능력 하사', () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('function public.bry_admin_edit') && sql.includes("jsonb_build_object('edit', p_edit)") && sql.includes("'mail', (select count(*) from grants g"))
  const srv = readFileSync(join(ROOT, 'server.js'), 'utf8')
  assert.ok(srv.includes("'상태 고치기'") && srv.includes("call('bry_admin_edit'") && srv.includes('payload.psychics = [gPsy.value]') && srv.includes('api.adminEdit?.(p.edit'))
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes('const adminEdit = (e = {}') && host.includes('e.psychicsAdd') && host.includes('ailmentDefs:') && host.includes('psychicDefs:'))
})

test('vC.07.6: 보스 전투 준비(출발 뒤 아이템 3 · 영능력 2) · 전투 중 소지품 건네기 · 빼앗은 영능력이 일행 전투에서 남기는 것', () => {
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes('const beginPick = ') && sp.includes('<BringPicker') && sp.includes('<PassivePicker') && sp.includes('const v = beginPick([...humans, ...fill], id)'))
  assert.ok(sp.includes('<BattleBag') && sp.includes('mates={view.members.filter') && sp.includes('mb.acks = {') && !sp.includes('function ItemPicker'))
  assert.ok(sp.includes('fx: weaponFx(player)') && sp.includes('bringLimit: !!limit'))
  const pt = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  // V.01 보관고 원본은 그대로 두고 끼워 넣은 결과(빌드가 쓰는 글)로 확인한다
  const mbp = applyPatchesSync('game/mbattle.js', readFileSync(join(ROOT, 'systems/vault/modules/game/mbattle.js'), 'utf8'))
  assert.ok(pt.includes('mb.enemy.bringLimit') && mbp.includes('stealUses: m.stealUses || {}') && mbp.includes('mpMax:m.mpMax') && mbp.includes('amount: act.amount'))
  for (const m of mbp.matchAll(/stealUses: m\.stealUses \|\| \{\},[\s\S]{0,400}/g)) assert.ok(!m[0].slice(10).includes('stealUses:'), '같은 칸이 두 번 적히지 않는다')
  assert.ok(mbp.includes('if (__borrow) { m.borrowPsychic -= 1') && !mbp.includes('typeof __borrow'), '붉은여우 부적 빌려 쓰기는 한 번 쓰면 줄어든다')
})

test('vD.01: 뒷산 탐사 · 얼굴 그림 매끈하게 · 퀘스트 잔상 · 띠링 · 우편함 · 상태 설명 · 옆 창 일행 대화', () => {
  const r = (f) => readFileSync(join(ROOT, f), 'utf8')
  assert.ok(r('systems/site-data/build.mjs').includes("act('gym', 'hike', '뒷산 탐사')"))
  assert.ok(r('quest.js').includes('portraitSrcset') && r('systems/play/src/NpcQuests.jsx').includes('saidAt.place === place'))
  for (const f of ['bi-base', 'yoon-base', 'dd-smile']) for (const n of [72, 144]) assert.ok(existsSync(join(ROOT, `assets/portraits/${f}-${n}.webp`)), `${f}-${n}`)
  const app = r('app.js')
  assert.ok(app.includes('function ding(') && app.includes("kind === 'chat' && !chatSoundOn()") && app.includes("'cond-tip'"))
  const party = r('party.js')
  assert.ok(party.includes("App.ding?.('invite')") && party.includes("App.ding?.('dm')") && party.includes("App.ding?.('chat')") && party.includes("party.d.classList.add('party-dock')") && party.includes('party.d.show()'))
  assert.ok(r('server.js').includes("App.ding?.('gift')"))
  assert.ok(r('index.html').includes('data-community-tab="mail"') && r('community.js').includes("call('bry_mail_list')".replace('call(', 'Auth.call(')))
  const sql = r('supabase/schema.sql')
  assert.ok(sql.includes('function public.bry_mail_list') && sql.includes('function biryeong_private.maint_tick') && sql.includes("'dm', (select count(*)") && sql.includes('jsonb_array_length(acts) < 40') && sql.includes('p_raw boolean default false'))
})

test('vD.01: 단체전 소지품(턴소모는 내 차례만) · 죽음을 들은 자 · 개척 재료 두 곳까지 · 빼앗은 영능력 56종 · 아이템 겹침 없음', async () => {
  const r = (f) => readFileSync(join(ROOT, f), 'utf8')
  const bag = r('systems/play/src/BattleBag.jsx')
  assert.ok(bag.includes('!itemTurnFree(item) && !myTurn'))
  const sp = r('systems/play/src/StoryParty.jsx')
  assert.ok(sp.includes("act === 'show'") && sp.includes('askedBy') && sp.includes('평온 −8'))
  assert.ok(r('systems/play/src/usePlayHost.js').includes("key === 'heard' && !((playerRef.current.inventory ?? {})['st-portrait'] > 0)"))
  const { rebalanceHuntMaterials } = await import(join(ROOT, 'systems/play/src/huntLevels.js'))
  assert.equal(typeof rebalanceHuntMaterials, 'function')
  const st = r('systems/play/src/steal.js')
  const keys = [...st.matchAll(/^  '([a-z0-9-]+#\d)': (\{[^}]*\}),$/gm)].map((m) => [m[1], m[2].replace(/\s/g, '')])
  const vals = keys.map(([, v]) => v)
  assert.ok(keys.length >= 69, `칸 ${keys.length}`)
  assert.equal(new Set(vals).size, vals.length, '빼앗은 영능력 효과가 모두 다르다')
  const { ITEM_RETUNE } = await import(join(ROOT, 'systems/play/src/itemRetune.js'))
  assert.ok(Object.keys(ITEM_RETUNE).length >= 30)
})

test('vD.02: 단계 보상은 언제나 위가 많다 · 느린 싸움 · 2명도 3인 기준 · 터마다 영물 하나 · 양호실 물품 · 음식의 시간 기운 · 파티장', async () => {
  const T = await import('../systems/play/src/tierScale.js')
  for (let t = 1; t < 10; t++) assert.ok(Math.max(...T.TIER_REWARD[t]) < Math.min(...T.TIER_REWARD[t + 1]), `${t}단계 보상 < ${t + 1}단계`)
  const pat = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  assert.ok(pat.includes('Math.max(5, Math.round((enemy.spirit * 2) / 5) * 5)') && pat.includes("'export const SLOW_FIGHT_COST_PER_SPIRIT = 1'"))
  const S = await import('../systems/play/src/newSpirits.js')
  const sp = Object.values(S.SITE_SPIRIT).map(([s]) => s)
  assert.equal(new Set(sp).size, sp.length, '영물이 모두 다르다')
  assert.equal(S.NEW_SPIRIT_RECIPES.length, 5)
  for (const r of S.NEW_SPIRIT_RECIPES) assert.ok(S.NEW_SPIRIT_ITEMS.some((i) => i.id === r.result) && S.NEW_SPIRIT_ITEMS.some((i) => i.id === r.inputs[0][0]))
  const A = await import('../systems/play/src/ailments.js')
  assert.equal(A.NURSE_STOCK.length, 12) // vD.02.1 응급 처치 상자
  assert.ok(A.NURSE_STOCK.find((x) => x.id === 'nutrient').price >= 500)
  const { ITEM_RETUNE } = await import('../systems/play/src/itemRetune.js')
  assert.ok(Object.values(ITEM_RETUNE).filter((r) => r.effect?.timed).length >= 10)
  assert.ok(ITEM_RETUNE['nw-mugwort-rope'].effect.dmgCut === 0.5 && ITEM_RETUNE['nw-raccoon-tag'].effect.dmgCut > 0.5)
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes('현재는 사용할 필요가 없습니다.') && host.includes('onlyFraction(cur, r.player)'))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes("'leader', r.members->0->>'u'") && sql.includes('not_leader'))
  const party = readFileSync(join(ROOT, 'party.js'), 'utf8')
  assert.ok(party.includes('party-leader-tag') && party.includes('get isLeader()'))
})

test('vD.02.1: 학생기록부 · 동아리 멤버는 서버에서 · 응급 처치 상자(하나 골라 풀기) · 언어장벽 새로 굴리기 · 단도 ×1.7 · 하사 목록 스크롤', async () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('function public.bry_students(p_token text, p_grade int)') && sql.includes('function public.bry_club_members(p_token text, p_club text)'))
  const pat = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  assert.ok(pat.includes("export const fetchStudents = async (grade)") && pat.includes("queue[i] = rollIntent(null, rng, s.party, !!s.enemy?.boss)") && pat.includes('base = Math.floor(base * 1.7)'))
  const host = readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8')
  assert.ok(host.includes("A.call('bry_club_members'") && host.includes('setBsPick({ id, options, max })'))
  const A = await import('../systems/play/src/ailments.js')
  assert.ok(A.FIRST_AID.battle && A.FIRST_AID.effect.cureOneBs && A.NURSE_STOCK.some((x) => x.id === 'nurse-firstaid'))
  assert.ok(readFileSync(join(ROOT, 'server.js'), 'utf8').includes('admin-grant-list') && readFileSync(join(ROOT, 'styles.css'), 'utf8').includes('.admin-grant-list{max-height'))
})

test('vD.02.3: 프로필 학년 · 재액부/털실 인형 · 살 수 있는 물건은 제작법 없음 · 매점 값 · 주사위 최솟값 · 도깨비 탈 자해 · NPC 스탯 · 숯 · 상태이상 완화 · 팝업 공지', async () => {
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
  assert.ok(app.includes("gradeSel.id = 'pfGrade'") && app.includes('function openMyProfile()'))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes("when (d #>> '{profile,grade}') ~ '^[1-3]$'") && sql.includes('function public.bry_admin_popup(') && sql.includes("'popup', (select jsonb_build_object('id', pp.id"))
  const { ITEM_RETUNE, STORE_PRICES } = await import('../systems/play/src/itemRetune.js')
  assert.equal(ITEM_RETUNE['yarn-doll'].effect.cureOneBs, 1); assert.equal(ITEM_RETUNE['jaeaek-charm'].effect.cureOneBs, 2)
  assert.ok(ITEM_RETUNE.charcoal.effect.trainUnder10 && STORE_PRICES.dumpling > 12)
  const rs = readFileSync(join(ROOT, 'systems/play/src/reskin.js'), 'utf8')
  assert.ok(rs.includes('if (sold.has(list[i].result)) list.splice(i, 1)'))
  const pat = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  assert.ok(pat.includes('export function attackFloor(stats)') && pat.includes('const others = aliveOf(mb) // vD.02.3'))
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes('top ? top + 1 :') && sp.includes("action = 'charm'"))
  const A = await import('../systems/play/src/ailments.js')
  assert.ok(A.battleAilChance('salgi', true, 0) < 0.3 && A.battleAilChance('hwasang', false, 1) <= 0.02)
  assert.ok(A.chanceText('salgi').includes('묘소'))
})

test('vD.02.4: △△(신 이름) 조사 · 본편 전투는 모두 3인', () => {
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8')
  assert.ok(q.includes("josaFill(josaFill(String(text ?? ''), 'OO', playerName()), '△△', godName())"))
  const sb = readFileSync(join(ROOT, 'systems/play/src/storyBoss.js'), 'utf8')
  assert.ok(!/sachal:[^\n]*size: 1/.test(sb))
})

test('vD.02.4: 장애물 덤은 다시 자갈돌(내 산출값 − 레벨) · 갈라진 붓은 쓰러진 고목에서', async () => {
  const hl = readFileSync(join(ROOT, 'systems/play/src/huntLevels.js'), 'utf8')
  assert.ok(hl.includes("['plant', 'animal'].includes(n.kind)) n.bonus") && hl.includes("{ item: 'split-brush', chance: 0.2, amount: 1 }] }, // vD.02.4"))
  assert.ok(!readFileSync(join(ROOT, 'systems/biryeong/hunt-extra.txt'), 'utf8').includes('bush|split-brush'))
})

test('vD.02.6: 보이는 글에 옛 개척 터 이름 · 없는 곳이 없다', () => {
  const codex = readFileSync(join(ROOT, 'codex-data.js'), 'utf8')
  assert.ok(!/산길[ -]?\d/.test(codex) && !codex.includes('개척 산길') && !codex.includes('둘레길 · 추가전투'))
  const edits = readFileSync(join(ROOT, 'systems/biryeong/item-edits.txt'), 'utf8')
  assert.ok(edits.includes('cairn-model|desc|') && edits.includes('clover|desc|'))
  assert.ok(!readFileSync(join(ROOT, 'systems/biryeong/items-new.txt'), 'utf8').includes('산길에서 오래 탄다'))
  const hl = readFileSync(join(ROOT, 'systems/play/src/huntLevels.js'), 'utf8')
  assert.ok(hl.includes("'left-trail-19': { name: '얼음꽃 능선'") && !hl.includes('솟대 소나무길를'))
})

test('vD.03: 4장 「신탁 오류」 — 지참 · 학년 줄 · 비의 얼굴 가림 · 오류 보스(신탁 · 절대 신탁)', async () => {
  const ch4 = JSON.parse(readFileSync(join(ROOT, 'story-chapters/ch4.json'), 'utf8'))
  assert.equal(ch4.ch, 4); assert.equal(ch4.title, '신탁 오류')
  const steps = ch4.scenes.flatMap((s) => s.steps)
  const bring = steps.find((st) => (st.n || []).some((n) => n.startsWith('bring:')))
  assert.deepEqual(bring.n.filter((n) => n.startsWith('bring:')), ['bring:cinnabar×3', 'bring:sealing-stone', 'bring:charm-scrap×4'])
  assert.ok(steps.some((st) => (st.n || []).includes('battle:error')))
  const lines = ch4.scenes.flatMap((s) => s.lines)
  assert.ok(lines.some((l) => l.c?.some((c) => c.grade?.[0] === 1)))
  assert.ok(lines.filter((l) => l.w === '비').every((l) => l.mask))
  assert.ok(lines.at(-2).t === 'end' && lines.at(-2).ch === 4)
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8')
  assert.ok(q.includes("n.type === 'bring'") && q.includes('function myGrade()') && q.includes('ln?.mask'))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/storyBoss.js'), 'utf8').includes("error: { pattern: 'oracle'"))
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8')
  assert.ok(sp.includes('finishErrorBossRound') && sp.includes('prepareErrorBossMove'))
  const { ERROR_BOSS_SKILLS, errorBossSkillAt, prepareErrorBossMove, finishErrorBossRound } = await import('../systems/play/src/oracleSkills.js')
  assert.deepEqual(ERROR_BOSS_SKILLS.map((s) => s.name), ['신탁', '절대신탁'])
  assert.equal(errorBossSkillAt(1)?.name, '신탁')
  assert.equal(errorBossSkillAt(3)?.name, '절대신탁')
  const mb = { story: { p: 'oracle', jump: false, baseAtk: 10, rStart: 100 }, enemy: { hp: 100, atk: 10 }, ehp: 100, round: 1, queue: ['special', 'jab'], over: null }
  prepareErrorBossMove(mb); assert.equal(mb.queue[0], 'none')
  mb.round = 2; finishErrorBossRound(mb, 1, () => {}); assert.equal(mb.enemy.atk, 20)
  mb.round = 3; mb.ehp = 65; prepareErrorBossMove(mb); assert.equal(mb.queue[0], 'none')
  mb.round = 4; finishErrorBossRound(mb, 3, () => {}); assert.equal(mb.ehp, 100)
})

test('vD.03: 아이템 글 = 실제 성능 — 전투 밖 음식은 어디서든 못 쓰던 것 풀림 · 일행 전투 전용 표기 · 전투 태그', async () => {
  const { ITEM_TEXT_FIX, applyTextFix } = await import('../systems/play/src/itemRetune.js')
  assert.ok(ITEM_TEXT_FIX['beginner-godok'].effectText.includes('일행 전투 중에만') && ITEM_TEXT_FIX['beginner-godok'].effectText.includes('라운드'))
  assert.ok(ITEM_TEXT_FIX.godok.effectText.includes('사흘') && ITEM_TEXT_FIX['hwatu-paulownia'].effectText.includes('받는'))
  const [x] = applyTextFix([{ id: 'nw-mugwort-rope', party: true, tags: ['완성품'] }]); assert.equal(x.party, false)
  const rt = readFileSync(join(ROOT, 'systems/play/src/itemRetune.js'), 'utf8')
  assert.ok(rt.includes("if (it.only === 'battle') delete it.only"))
  const ns = readFileSync(join(ROOT, 'systems/play/src/newSpirits.js'), 'utf8')
  assert.ok(!ns.includes('공격성') && ns.includes('호전 +6 · 신속 +3'))
})

test('vD.03: 벼룩시장 — 이름 없이 · 여러 개 올리기 · 장바구니 · 가장 싼 것부터 · 판 사람에게 우편으로 대금', () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  for (const f of ['bry_market(', 'bry_market_post(', 'bry_market_cancel(', 'bry_market_buy(']) assert.ok(sql.includes(`function public.${f}`), f)
  assert.ok(sql.includes('order by price, id for update') && sql.includes("'벼룩시장에서 팔렸다'") && sql.includes("raise exception 'price_changed'"))
  assert.ok(!/bry_market\(p_token text\)[\s\S]{0,900}display_name/.test(sql)) // 올린 사람은 내보내지 않는다
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(html.includes('data-menu="market"') && html.includes('class="status-tools" data-admin-slot') && html.includes('market.js?v='))
  const mk = readFileSync(join(ROOT, 'market.js'), 'utf8')
  assert.ok(mk.includes('const cart = new Map()') && mk.includes('const staged = new Map()') && mk.includes("call('bry_market_buy'"))
  const sv = readFileSync(join(ROOT, 'server.js'), 'utf8'); assert.ok(sv.includes("g.gift_from === '벼룩시장'"))
})

test('vD.03.2: 적응 퀘스트 — 본편 퀘스트 단추 자리 · 첫 장면 뒤 서창현 안내 · 5개 · 보상은 처음 한 번', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(html.includes('data-menu="adapt"') && !html.includes('data-menu="quest"') && html.includes('adapt.js?v='))
  assert.ok(html.includes('https://cafe.naver.com/biryungkic102'))
  const ad = readFileSync(join(ROOT, 'adapt.js'), 'utf8')
  assert.ok(ad.includes('제3특수교육시설, 비령산 학당에 오신 것을 진심으로 환영합니다. 해당 버튼을 눌러 적응 퀘스트를 진행하면서 학당 생활에 익숙해져보세요.'))
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) assert.ok(ad.includes(`id: '${id}'`), id)
  assert.ok(ad.includes("'biryeong:scene-done'") && ad.includes('!a.paid[q.id]') && ad.includes('st().gave[key]'))
  assert.ok(ad.includes("dialog[open]")) // 도감처럼 모달 창이 열려도 안내 상자를 누를 수 있게
  assert.ok(readFileSync(join(ROOT, 'quest.js'), 'utf8').includes("new CustomEvent('biryeong:scene-done'"))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8').includes("bridge.quest('buy', id)"))
})

test('vD.03.2: 영능력 글 = 실제 성능 — 효험 · 언어장벽 · 영력결계 · 빼앗은 영능력', async () => {
  const { PSYCHIC_DETAIL_FIX, applyPsychicFix } = await import('../systems/play/src/psychicText.js')
  assert.ok(!PSYCHIC_DETAIL_FIX.buff.detail.includes('모자라면 0까지') && !PSYCHIC_DETAIL_FIX.buff.note.includes('생존본능'))
  assert.ok(PSYCHIC_DETAIL_FIX['language-barrier'].detail.includes('80%') && PSYCHIC_DETAIL_FIX['spirit-barrier'].detail.includes('본편 보스'))
  const [p] = applyPsychicFix([{ id: 'cotton-mist', detail: 'x' }]); assert.ok(p.detail.includes('바로 다음 행동'))
  const { stealDetail } = await import('../systems/play/src/steal.js')
  assert.ok(!stealDetail({ mp: 10, m: 2, p: 1, sf: 0.3 }).includes('부적 공격을'))
  assert.ok(!stealDetail({ mp: 25, m: 1, n: 2, gx: 2 }).includes('방어 태세면 절반'))
  assert.ok(stealDetail({ mp: 15, rat: [3, 0.35, 20] }).includes('다음 3차례 동안'))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/reskin.js'), 'utf8').includes('applyPsychicFix(PSYCHICS)'))
  assert.ok(readFileSync(join(ROOT, 'systems/codex/build.mjs'), 'utf8').includes('applyPsychicFix(PSYCHICS)'))
})

test('vD.04: 카페 정산 — 상태 창 빈칸의 단추 · 메모 · 5가지 보상 · 내 내역 · 관리자 내역', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(html.includes('class="cafe-settle-btn" data-menu="cafe"') && html.includes('cafe.js?v='))
  assert.ok(html.indexOf('id="npcTracker"') < html.indexOf('cafe-settle-btn') && html.indexOf('cafe-settle-btn') < html.indexOf('status-spacer'))
  const cf = readFileSync(join(ROOT, 'cafe.js'), 'utf8')
  assert.ok(cf.includes('[게시글 제목 / 날짜] [현재 댓글 수 / 날짜] [현재 방문 수 / 날짜] 셋 중 하나를 골라 기입해주세요. 메인스토리 또는 이벤트, 장편 보너스가 있는 경우 직접 계산해 수령하셔야 합니다.'))
  for (const k of ['money: 50, spirit: 0', 'money: 70, spirit: 50', 'money: 80, spirit: 0', 'money: 100, spirit: 50', 'custom: true']) assert.ok(cf.includes(k), k)
  assert.ok(cf.includes("call('bry_cafe_submit'") && cf.includes("call('bry_cafe_mine')") && cf.includes("call('bry_admin_cafe')"))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  for (const f of ['bry_cafe_submit(', 'bry_cafe_mine(', 'bry_admin_cafe(']) assert.ok(sql.includes(`function public.${f}`), f)
  assert.ok(/bry_cafe_submit[\s\S]{0,900}p_kind = 2 then m := 70; sp := 50/.test(sql) && /bry_admin_cafe[\s\S]{0,200}adm\(p_token\)/.test(sql))
  assert.ok(readFileSync(join(ROOT, 'server.js'), 'utf8').includes('window.BiryeongCafe.admin(body)'))
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
  assert.ok(app.includes("head === 'cafe'") && app.includes("cafe: () => go('#/cafe')"))
})

test('vD.04: 육조 스탯 마우스오버 설명 6개', () => {
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8')
  assert.ok(app.includes("c.dataset.statTip = k") && app.includes('const STAT_TIP = {'))
  for (const t of ['교육자들은 우선 눈을 크게 뜰 것을 1원칙으로', '제어할 수 없는 돌발 행동 확률도', '시간을 들여 얻는 보상이 늘어납니다', '영력 활용이 효율적으로', '반 박자 빠를 수 있는 법칙', '개척 중 전투를 확률적으로 피하게']) assert.ok(app.includes(t), t)
})

test('vD.06.12: 우정 편지 매점 50냥 · 개척에서 안 나옴 · 선물용 도구 · 재료로 안 쓰임', async () => {
  const { NEW_STORE, retuneItems } = await import('../systems/play/src/itemRetune.js')
  assert.equal(NEW_STORE['friendship-letter'].price, 50)
  assert.equal(NEW_STORE['friendship-letter'].effectText, '선물용 도구. 이 편지를 전송하면 받은 사람과 특별한 연을 맺게 된다.')
  const [x] = retuneItems([{ id: 'friendship-letter', kind: 'material', tags: ['재료'], price: null, desc: '누군가들이 주고받은 편지. 다른 사람의 인연이 담겨있다.', effect: {} }])
  assert.ok(x.price === 50 && x.kind === 'tool' && !x.tags.includes('재료') && x.desc.startsWith('누군가들이 주고받은 편지'))
  assert.ok(!readFileSync(join(ROOT, 'systems/biryeong/hunt-extra.txt'), 'utf8').includes('friendship-letter'))
  const R = await import('../systems/biryeong/reskin.data.js')
  const recs = [...R.NEW_RECIPES.W, ...R.NEW_RECIPES.K, ...R.STORY_RECIPES]
  assert.ok(!recs.some((r) => r.inputs.some(([id]) => id === 'friendship-letter')))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/reskin.js'), 'utf8').includes('STORE_ITEMS.push(it)'))
})

test('vD.04.1: 탐사 지점마다 1% 분실물(다섯 가지가 똑같이) · 우편함 엿보기 · 카페 여섯 가지 · 퀘스트 공개 · 동시에 2건', async () => {
  const L = await import('../systems/play/src/lostFind.js')
  assert.equal(L.LOST_FIND_CHANCE, 0.01); assert.equal(L.LOST_FIND_ITEMS.length, 5); assert.ok(L.LOST_FIND_ITEMS.includes('lost-key'))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8').includes('lostFind(key) }'))
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('function public.bry_admin_gifts(') && sql.includes('gift_by) values (t.id') && sql.includes("p_kind = 5 then m := 30; sp := 0;"))
  const sv = readFileSync(join(ROOT, 'server.js'), 'utf8'); assert.ok(sv.includes("call('bry_admin_gifts')") && sv.includes("'codex-list admin-scroll'"))
  const cf = readFileSync(join(ROOT, 'cafe.js'), 'utf8'); assert.ok(cf.includes("label: '일반 로그 or 댓글 100개', money: 50") && cf.includes("label: '방문 100회', money: 30") && cf.includes("{ id: 6, label: '자유 기입', custom: true }"))
  const nq = readFileSync(join(ROOT, 'systems/play/src/npcQuests.js'), 'utf8')
  assert.ok(nq.includes('export const MAX_ACTIVE = 2') && (nq.match(/^  Q\('/gm) || []).length === 45)
  assert.ok(nq.includes('else if (open && canOffer(') && nq.includes('if (activeCount(p) >= MAX_ACTIVE)'))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8').includes('BiryeongQuest?.routes?.NPC_QUESTS) === 1'))
  assert.ok(readFileSync(join(ROOT, 'quest.js'), 'utf8').includes("sync.adminRoute(adminCode(), 'NPC_QUESTS'"))
})

test('vD.04.1: 처음 만든 캐릭터의 소지금 200냥', () => {
  assert.ok(readFileSync(join(ROOT, 'game-data.js'), 'utf8').includes('"startMoney":200'))
  assert.ok(readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8').includes("['export const START_MONEY = 50', 'export const START_MONEY = 200']"))
})

test('vD.04.2: 친구 목록 — 우정 편지를 보내거나 받으면 서로 친구 · 접속 여부 · 프로필', () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('create table if not exists biryeong_private.friends') && sql.includes("? 'friendship-letter' then\n    insert into friends (a, b)"))
  assert.ok(sql.includes('function public.bry_friends(') && sql.includes("'online', x.last_seen > now() - interval '3 minutes'"))
  const pj = readFileSync(join(ROOT, 'party.js'), 'utf8')
  assert.ok(pj.includes("call('bry_friends')") && pj.includes('openCard(u)') && pj.includes('openFriends,'))
  assert.ok(readFileSync(join(ROOT, 'app.js'), 'utf8').includes("btn('ghost-btn', '친구 목록'"))
})

test('vD.04.3: 부하 줄이기 — 사진은 따로 · throttle 은 WAL 없이 · 자리 비우면 덜 묻는다', () => {
  const sql = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8')
  assert.ok(sql.includes('create table if not exists biryeong_private.photos') && sql.includes('where photos.photo is distinct from excluded.photo'))
  assert.ok(sql.includes("jsonb_set(s.data, '{profile,photo}', to_jsonb(ph.photo))") && sql.includes('alter table biryeong_private.throttle set unlogged'))
  assert.ok(!/throttle_do[\s\S]{0,300}delete from throttle where key = p_key/.test(sql))
  const au = readFileSync(join(ROOT, 'auth.js'), 'utf8')
  assert.ok(au.includes('const idle = () =>') && au.includes('if (meta.ph === ph) delete prof.photo') && au.includes('!idle()) pushSave'))
  assert.ok(readFileSync(join(ROOT, 'party.js'), 'utf8').includes("(Auth.idle?.() && !room) ? 120000 : 25000"))
  assert.ok(readFileSync(join(ROOT, 'market.js'), 'utf8').includes('!Auth.idle?.()) load(); }, 45000)'))
})

test('vD.04.4: 사이트로 나가는 파일에 원작 제작진 헌정 문구가 남지 않는다(상장 거치대)', () => {
  const dec = (s) => s.replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  const files = ['play/play.js', 'game-data.js', 'codex-data.js', 'story-data.js', 'index.html', 'app.js', 'quest.js']
  for (const f of files) {
    const s = dec(readFileSync(join(ROOT, f), 'utf8'))
    for (const w of ['Terrarium', '팬케이크', '에스티아', '초록동색', '금유성', '오단애']) assert.ok(!s.includes(w), `${f}: ${w}`)
  }
  assert.ok(dec(readFileSync(join(ROOT, 'play/play.js'), 'utf8')).includes('일상과 미지의 경계에 선 우리들은'))
})

test('vD.05 · vD.06: 신수들의 터 — 어린 신수 맡기 · 시간 따라 배고픔 · 돌보기 · 심부름 · 자라기', async () => {
  const B = await import('../systems/play/src/beasts.js')
  const t0 = Date.UTC(2026, 10, 21, 3)
  assert.deepEqual(B.KIND_IDS, ['cheongnyong', 'baekho', 'jujak', 'hyeonmu', 'gumiho'])
  let p = { inventory: {} }
  assert.ok(B.adopt(p, 'baekho', '   ', t0).error)
  assert.ok(B.adopt(p, 'baekho', '호랑<이>', t0).error) // vD.06 한글만
  assert.ok(B.adopt(p, 'baekho', '호랑이호랑', t0).error) // 네 글자까지
  let r = B.adopt(p, 'baekho', '호랑이', t0); p = r.player
  const id = p.beasts.list[0].id
  assert.equal(p.beasts.list[0].name, '호랑이'); assert.equal(p.beasts.active, id)
  assert.ok(B.adopt(p, 'jujak', '불새', t0).error) // 다 자라기 전엔 하나만
  // 시간: 10시간 → 배부름 -30, 기분 -20
  const v = B.view(p, t0 + 10 * 3600e3).list[0]
  assert.equal(v.full, 50); assert.equal(v.mood, 60); assert.equal(v.stageName, '어린'); assert.equal(v.label, '어린 백호'); assert.equal(v.next.label, '성장기 백호')
  // 좋아하는 먹이는 더
  r = B.feed(p, id, 'pebble', t0); assert.ok(r.player.beasts.list[0].full === 100 && r.take.pebble === 1 && r.player.beasts.list[0].bond === 8)
  assert.ok(B.feed(p, id, 'crystal', t0).error) // 먹지 않는 것
  r = B.pet(p, id, t0); p = r.player; assert.ok(B.pet(p, id, t0 + 1000).error) // 1시간 쿨
  // 심부름
  r = B.sendTrip(p, id, 'long', t0); p = r.player
  assert.ok(B.collectTrip(p, id, t0 + 3600e3).error)
  let k = 0; const rnd = () => [0.01, 0.5][k++ % 2]
  r = B.collectTrip(p, id, t0 + 8 * 3600e3 + 1, rnd)
  assert.ok(Object.values(r.gain).reduce((a, n) => a + n, 0) >= 8 && r.gain.crystal >= 1 && !r.player.beasts.list[0].trip)
  // 유대 1000 → 성수 · 보상 · 다른 아이 맡기
  p = { ...r.player, beasts: { ...r.player.beasts, list: [{ ...r.player.beasts.list[0], bond: 998, pet: 0 }] } }
  const p450 = { ...p, beasts: { ...p.beasts, list: [{ ...p.beasts.list[0], bond: 448 }] } }
  const r450 = B.pet(p450, id, t0 + 9 * 3600e3); assert.equal(r450.grew, '성장기 백호'); assert.deepEqual(r450.reward, { money: 50, spirit: 30 })
  assert.ok(B.adopt(r450.player, 'jujak', '불새', t0 + 9 * 3600e3).error) // 성수 전에는 다른 아이 못 맡는다
  assert.ok(B.adopt(r450.player, 'jujak', '불새', t0 + 9 * 3600e3, { force: true }).player) // 이벤트의 운명의 신수는 맡는다
  r = B.pet(p, id, t0 + 9 * 3600e3); assert.equal(r.grew, '성수 백호'); assert.deepEqual(r.reward, { money: 100, spirit: 50 })
  assert.equal(B.STAGES.length, 3); assert.equal(B.rename, undefined) // 이름은 바꿀 수 없다
  assert.ok(B.view(r.player, t0 + 9 * 3600e3).canAdopt)
  assert.ok(B.adopt(r.player, 'jujak', '불새', t0 + 9 * 3600e3).player)
  // 하루 첫 방문 인사는 하루 한 번
  const g = B.greet(r.player, t0 + 9 * 3600e3); assert.ok(g && g.player); assert.equal(B.greet(g.player, t0 + 9 * 3600e3 + 60e3), null)
})

test('vD.05: 신수들의 터 화면이 산 탐사에 붙는다 · 우정 편지 30냥', () => {
  const pt = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8')
  assert.ok(pt.includes("\"widget: 'beastCare',\"") && pt.includes("import BeastCare from '@story/BeastCare.jsx'"))
  assert.ok(readFileSync(join(ROOT, 'systems/play/src/usePlayHost.js'), 'utf8').includes('beastView: () => Beasts.view(playerRef.current), beastAct'))
})

test('vD.06: 스토리 시트 반영 — 훈련관 세 줄 · 사감→연호수 · 고친 대사', () => {
  const ch1 = JSON.parse(readFileSync(join(ROOT, 'story-chapters/ch1.json'), 'utf8'))
  const all = ch1.scenes.flatMap((s) => s.lines)
  const i = all.findIndex((l) => l.x === '이 경험이 다 너희들을 각종 사고로부터 지켜줄 거야.')
  assert.ok(i >= 0 && all[i + 1].w === '훈련관' && all[i + 1].x.startsWith('우리 같은 ‘일반인’들은') && all[i + 3].x.startsWith('그러지 않으면'))
  assert.ok(all.some((l) => l.w === '연호수' && l.x === '그 침대? 원래 비어 있었어. …비어 있었지?'))
  assert.ok(all.some((l) => l.x === '호수 선배, 의외로 착할지도 모르겠어요.') && !all.some((l) => /씹 답답해/.test(l.x || '')))
  const ch4 = readFileSync(join(ROOT, 'story-chapters/ch4.json'), 'utf8'); assert.ok(ch4.includes('FM 새끼') && !ch4.includes('FH 새끼'))
  assert.ok(readFileSync(join(ROOT, 'story-data.js'), 'utf8').includes('전국에서 실종 신고가 잇따르고'))
  const ch2 = readFileSync(join(ROOT, 'story-chapters/ch2.json'), 'utf8'); assert.ok(ch2.includes('돌아가도록 도와 주는 게 맞을 것 같아'))
})

test('vD.06: 이벤트 「학생 괴담 수칙」 — 관리자 공개 · 신수들의 터 잠금 · 번진 먹 패턴', () => {
  const ev = readFileSync(join(ROOT, 'beast-event.js'), 'utf8')
  for (const id of ['intro', 'east', 'west', 'south', 'north', 'center', 'final']) assert.ok(ev.includes(`id: '${id}'`), id)
  assert.ok(ev.includes("const FLAG = 'BEAST_EVENT'") && ev.includes("bring: { 'lake-water': 9 }") && ev.includes('bring: { nail: 3 }') && ev.includes('wait: WAIT_MS'))
  assert.ok(ev.includes("key: 'beast'") && ev.includes('6: \'이름 없는 것에게는 이름을 불러 주어라\''))
  const q = readFileSync(join(ROOT, 'quest.js'), 'utf8')
  assert.ok(q.includes("sync.adminRoute(adminCode(), 'BEAST_EVENT'") && q.includes('최초에 이름을 정하면 이름을 바꿀 수 없습니다. 확인하셨습니까?'))
  assert.ok(readFileSync(join(ROOT, 'index.html'), 'utf8').includes('beast-event.js?v=V.01-4'))
  const pt = readFileSync(join(ROOT, 'systems/play/patches.mjs'), 'utf8'); assert.ok(pt.includes('data-beast-locked') && pt.includes('아직 공개되지 않았다.'))
  const sp = readFileSync(join(ROOT, 'systems/play/src/StoryParty.jsx'), 'utf8'); assert.ok(sp.includes("st.p === 'smear' && act === 'call'"))
  const bc = readFileSync(join(ROOT, 'systems/play/src/BeastCare.jsx'), 'utf8'); assert.ok(!bc.includes('이름 바꾸기') && !bc.includes('아기 ') && bc.includes('NAME_NOTICE'))
})

test('vD.06.1: 주작 전투 한 번 · 괴담 고르기 · 대기 유지 · 테마 관리 · 배경음악', () => {
  const ev = readFileSync(join(ROOT, 'beast-event.js'), 'utf8')
  assert.equal((ev.match(/battle: FOX/g) || []).length, 1)
  assert.ok(ev.includes('st().cur === q.id') && ev.includes('pb.dataset.evChoose'))
  assert.ok(ev.includes('cancelWait') && ev.includes("hash: location.hash"))
  const idx = readFileSync(join(ROOT, 'index.html'), 'utf8')
  assert.ok(idx.includes('id="themeToggle"') && !idx.includes('id="fontToggle"') && idx.includes('data-theme-pick="light"') && idx.includes('id="musicSwitch"') && idx.includes('id="sfxSwitch"') && idx.includes('bgm.js?v=') && idx.includes('theme-light.css?v='))
  for (const f of ['commu', 'battle', 'boss']) assert.ok(existsSync(join(ROOT, `assets/bgm/${f}.mp3`)), f)
  assert.ok(readFileSync(join(ROOT, 'theme-light.css'), 'utf8').includes('html[data-theme="light"]'))
  assert.ok(readFileSync(join(ROOT, 'play/play.css'), 'utf8').includes('--c-ink: #f2f7f0'))
  const app = readFileSync(join(ROOT, 'app.js'), 'utf8'); assert.ok(app.includes('BiryeongBeastEvent?.busy?.()') && app.includes("if (!sfxOn()) return;"))
})
