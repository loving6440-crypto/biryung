/**
 * 秘靈 · 비령 vC.06 — 영능력 · 몸의 이상 · 아이템 · 제작법 · 개척 표 자료.
 *   node systems/sheets/build_c06.mjs > /tmp/c06.json  →  python3 systems/sheets/build_c06_xlsx.py /tmp/c06.json 비령_표_vC.06.xlsx
 * 게임과 같은 계산을 쓴다: 개척 터 레벨(huntLevels.js) · 실습장 상대 이름(practiceEnemies.js) · 몸의 이상(ailments.js) · 빼앗은 영능력(steal.js).
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), G = join(ROOT, 'systems/vault/modules/game')
const imp = (f) => import(join(G, f))

// ── 영능력: 도감 자료(codex-data.js)를 그대로 읽는다 — 설명(note) · 상세(detail) · 의지력 · 영향받는 스탯 · 익히는 조건 ──
globalThis.window = {}
new Function('window', readFileSync(join(ROOT, 'codex-data.js'), 'utf8'))(globalThis.window)
const CX = globalThis.window.BIRYEONG_CODEX
const psychics = CX.psychics.map((p) => ({
  id: p.id, name: p.name, kind: p.stolen ? (p.boss ? '빼앗은 영능력 · 보스' : '빼앗은 영능력') : p.always ? '처음부터' : '기본 영능력',
  from: p.stolen ? p.from : '', note: p.note, detail: p.detail, mp: p.mp, affects: p.affects, cond: p.cond,
}))

// ── 몸의 이상 ──
const A = await import(join(ROOT, 'systems/play/src/ailments.js'))
const ailments = [
  { id: 'weak', name: A.WEAK_INFO.name, hanja: A.WEAK_INFO.hanja, heavy: '무거움', effect: A.WEAK_INFO.effect, minutes: 24 * 60, max: 1, from: A.WEAK_INFO.from, chance: '전투에서 지면 반드시', text: A.WEAK_INFO.text, cure: '영양제 등 [쇠약] 회복 아이템', restore: '', shorten: '' },
  ...A.AILMENTS.map((a) => { const c = A.curesFor(a.id); return { id: a.id, name: a.name, hanja: a.hanja, heavy: a.heavy ? '무거움' : '가벼움', effect: a.effect, minutes: a.minutes, max: a.max, from: a.from, chance: A.chanceText(a.id), text: a.text, cure: c.cure.join(' / '), restore: c.restore.join(' / '), shorten: c.shorten.join(' / ') } }),
]

// ── 아이템 · 제작법: 표 자료(export.mjs)에 레벨을 더한다 ──
const sheet = JSON.parse(execFileSync(process.execPath, [join(ROOT, 'systems/sheets/export.mjs')], { encoding: 'utf8', maxBuffer: 64 << 20 }))
const hunt = await imp('huntSites.js')
;(await import(join(ROOT, 'systems/play/src/huntLevels.js'))).remapHuntSites(hunt.HUNT_SITES, hunt.HUNT_PATHS, hunt.HUNT_SPECIES)
const ML = await imp('materialLevels.js') // 위에서 고친 개척 터를 읽는다
const R = await import(join(ROOT, 'systems/biryeong/reskin.data.js'))
const { RECIPES } = await imp('crafting.js'); const { COOK_RECIPES } = await imp('cooking.js')
const ALL = [...RECIPES, ...COOK_RECIPES, ...R.NEW_RECIPES.W, ...R.NEW_RECIPES.K, ...R.STORY_RECIPES.filter((r) => !r.unlock || r.unlock === 'open'), ...A.AIL_RECIPES]
const memo = new Map()
function lvOf(id, seen = new Set()) {
  if (memo.has(id)) return memo.get(id)
  if (seen.has(id)) return null
  seen.add(id)
  const direct = (ML.MATERIAL_SOURCES[id] ?? []).map((s) => s.level).filter((v) => v != null)
  const made = ALL.filter((r) => r.result === id).map((r) => recLv(r, seen)).filter((v) => v != null)
  const all = [...direct, ...made]
  const v = all.length ? Math.min(...all) : null
  seen.delete(id); if (!seen.size) memo.set(id, v)
  return v
}
function recLv(r, seen = new Set()) { let m = 0; for (const [id] of r.inputs) { const v = lvOf(id, seen); if (v == null) return null; m = Math.max(m, v) } return m }
const recById = Object.fromEntries(ALL.map((r) => [r.id, r]))
const items = sheet.items.map((i) => ({ ...i, level: lvOf(i.id) }))
const recipes = sheet.recipes.map((r) => ({ ...r, level: recById[r.id] ? recLv(recById[r.id]) : null }))

// ── 개척 ──
const SP = hunt.HUNT_SPECIES
const itemName = Object.fromEntries(items.map((i) => [i.id, i.name]))
const KIND = { plant: '식물', obstacle: '장애물', animal: '동물', spirit: '영물' }
const sites = Object.values(hunt.HUNT_SITES).filter((s) => s.nodes?.length)
const order = hunt.HUNT_PATHS.flatMap((p) => p.sites ?? []).map((x) => (typeof x === 'string' ? x : x.id))
sites.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999))
const pioneer = sites.map((s, n) => {
  const lv = s.nodes.map((x) => x.level)
  const mats = new Set(); for (const nd of s.nodes) for (const r of SP[nd.species]?.rewards ?? []) for (const k of ['item', 'am', 'pm']) if (r[k]) mats.add(itemName[r[k]] ?? r[k])
  const spirits = (s.spirits ?? []).map((x) => `${SP[x.species]?.name ?? x.species}(레벨 ${x.level}${x.chance ? ` · ${Math.round(x.chance * 100)}%` : ''})`)
  return { order: n + 1, id: s.id, name: s.name, path: s.path, target: s.targetStat ?? null, note: s.note ?? '', turns: s.maxTurns, nodes: s.nodes.length,
    lvMin: Math.min(...lv), lvMax: Math.max(...lv), ghost: s.ghost ? `${s.ghost.name ?? ''}${s.ghost.enemy?.tier ? ` (${s.ghost.enemy.tier}단계)` : ''}` : '', spirits: spirits.join(' / '), mats: [...mats].join(', ') }
})
const nodes = sites.flatMap((s) => s.nodes.filter((nd) => nd.kind !== 'obstacle' || nd.level > 2).map((nd) => ({
  site: s.name, id: nd.id, kind: KIND[SP[nd.species]?.kind] ?? nd.kind, species: SP[nd.species]?.name ?? nd.species, level: nd.level, avg: Math.round(nd.level / (SP[nd.species]?.kind === 'spirit' ? 6 : 2)),
  rewards: (SP[nd.species]?.rewards ?? []).map((r) => [r.item, r.am, r.pm].filter(Boolean).map((id) => itemName[id] ?? id).join('/') + (r.dice ? ` (1d${r.dice})` : r.amount ? ` ×${r.amount}` : '')).join(', '),
})))

process.stdout.write(JSON.stringify({ psychics, ailments, items, recipes, pioneer, nodes, achievements: sheet.achievements, titles: sheet.titles }))
