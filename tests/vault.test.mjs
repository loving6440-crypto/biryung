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
  assert.equal(s.steps.length, 10); assert.equal(s.steps[1].options.length, 5);
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
  assert.match(html, /src="play\/play\.js"/); assert.match(html, /id="playRoot"/); assert.match(html, /id="pageBack"/);
});

test('Reskin: 아이템 312 · 상대 57 · 영능력 13 이 모두 비령판 이름을 갖고, 아이템마다 도트 아이콘이 있다', async () => {
  const r = await import('../systems/biryeong/reskin.data.js');
  const { ITEMS } = await Vault.load('game/items');
  const { ALL_ENEMIES, PSYCHICS } = await Vault.load('game/battle');
  for (const i of ITEMS) { assert.ok(r.ITEM_RESKIN[i.id]?.name && r.ITEM_RESKIN[i.id]?.desc, i.id); const px = r.ITEM_PIXELS[i.id]; assert.ok(r.PIXEL_TEMPLATES[px.t] && r.PIXEL_PALETTES[px.p], i.id); }
  for (const e of ALL_ENEMIES) assert.ok(r.ENEMY_RESKIN[e.id]?.name && r.ENEMY_RESKIN[e.id]?.blurb, e.id);
  for (const p of PSYCHICS) assert.ok(r.PSYCHIC_RESKIN[p.id]?.label, p.id);
  for (const grid of Object.values(r.PIXEL_TEMPLATES)) { assert.equal(grid.length, 12); for (const row of grid) assert.match(row, /^[.kabcd]{12}$/); }
  assert.equal(new Set(Object.values(r.ITEM_RESKIN).map((x) => x.name)).size, ITEMS.length, '아이템 이름이 겹친다');
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
    const r = NEW_RECIPES.W[0]
    const player = { inventory: Object.fromEntries(r.inputs), money: 0 }
    const done = benchCraft(player, r.inputs.map(([id, n]) => ({ id, n })), 'workshop', false)
    assert10.equal(done.failed, false); assert10.equal(done.player.inventory[r.result], 1)
  } finally { RECIPES.length = w0; COOK_RECIPES.length = k0 }
})
t10('v1.0 칭호 114개 모두에 기능이 있고, 업적 하나에 칭호 하나', () => {
  const window = {}
  for (const f of ['../titles.js', '../titles2.js']) new Function('window', read10(new URL(f, import.meta.url), 'utf8'))(window)
  const T = window.BIRYEONG_TITLES, A = window.BIRYEONG_ACHIEVEMENTS
  assert10.equal(T.length, 114); assert10.equal(A.length, 110)
  assert10.equal(new Set(T.map((t) => t.name)).size, T.length)
  for (const t of T) { assert10.ok(t.perk?.type && t.perk.v > 0 && t.perkText, t.id); if (t.from !== 'start') assert10.equal(A.filter((a) => a.title === t.id).length, 1, t.id) }
})
