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
