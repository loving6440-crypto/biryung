/**
 * 秘靈 · 비령 — 세계관 개변 데이터 만들기.   npm run reskin:build → systems/biryeong/reskin.data.js
 *
 * 초록동색에서 가져온 아이템 · 적 · 영능력의 이름과 설명을 비령(2046년, SF-조선 어반 오컬트) 판으로 바꾸는 표와
 * 아이템 도트 아이콘 데이터를 한 파일로 묶는다. 수치(가격 · 효과 · 체력 · 공격력 …)는 건드리지 않는다.
 *   items-a.txt · items-b.txt   id|새 이름|새 설명
 *   enemies.txt                 id|새 이름|새 소개|영능력 1 이름|영능력 2 이름
 *   psychics.txt                id|새 이름|새 설명
 *   pixel-templates.txt         12×12 도트 틀 (k 외곽선 · a 바탕 · b 그늘 · c 빛 · d 포인트)
 * 보관고(systems/vault) 원본은 그대로 두고, 실행 화면이 시작할 때 이 표를 덮어씌운다(systems/play/src/reskin.js).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const rows = (f) => readFileSync(join(HERE, f), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('|'))
const { ITEMS } = await import('../vault/modules/game/items.js')
const { ALL_ENEMIES, PSYCHICS } = await import('../vault/modules/game/battle.js')

const items = {}
for (const [id, name, desc] of [...rows('items-a.txt'), ...rows('items-b.txt')]) items[id] = { name, desc }
const enemies = {}
for (const [id, name, blurb, s1, s2] of rows('enemies.txt')) enemies[id] = { name, blurb, ...(s1 ? { special: s1 } : {}), ...(s2 ? { special2: s2 } : {}) }
const psychics = {}
for (const [id, label, note] of rows('psychics.txt')) psychics[id] = { label, note }
for (const i of ITEMS) if (!items[i.id]) throw new Error('아이템 개변 누락: ' + i.id)
for (const e of ALL_ENEMIES) if (!enemies[e.id]) throw new Error('적 개변 누락: ' + e.id)
for (const p of PSYCHICS) if (!psychics[p.id]) throw new Error('영능력 개변 누락: ' + p.id)
// 화면 코드 안에 글자로 박힌 옛 이름(영능력 · 학교 이름)은 빌드할 때 통째로 바꾼다.
const textSwaps = [
  ...PSYCHICS.filter((p) => p.label !== psychics[p.id].label).map((p) => [p.label, psychics[p.id].label]),
  ['국립 창록고등학교', '비령 임시학당'], ['창록고등학교', '비령 임시학당'], ['창록고', '비령학당'], ['창록교', '비령학당'], ['창록', '비령'], ['초록동색', '비령'],
].sort((a, b) => b[0].length - a[0].length)

// ── 도트 아이콘 ──
const templates = {}
for (const block of readFileSync(join(HERE, 'pixel-templates.txt'), 'utf8').trim().split('#').slice(1)) {
  const [name, ...grid] = block.trim().split('\n')
  if (grid.length !== 12 || grid.some((r) => r.length !== 12)) throw new Error('도트 틀 크기 오류: ' + name)
  templates[name] = grid
}
// [바탕, 그늘, 빛, 포인트]
const PALETTES = {
  jade: ['#4f948d', '#2f625f', '#a8e0d4', '#f0d49a'], crimson: ['#c66a6c', '#84404a', '#f3b7ae', '#f0e7d1'], gold: ['#d4b078', '#8d7147', '#f6e3b5', '#c8504f'],
  bone: ['#e3dcc6', '#a59f8c', '#ffffff', '#c66a6c'], indigo: ['#4a6a94', '#2b3f60', '#a9c7ea', '#f0d49a'], violet: ['#8a6fb0', '#553f78', '#d6c4f0', '#7fe0d0'],
  cyan: ['#68a9b9', '#3a6f80', '#c6f1f5', '#f3a6a0'], ember: ['#d88a4e', '#93552c', '#f8cf9a', '#fff1c4'], moss: ['#7c9d5c', '#4a6638', '#cfe3a8', '#f0d49a'],
  rose: ['#d58aa0', '#8f5266', '#f6cbd5', '#fff3d6'], steel: ['#93a3ad', '#586771', '#e2ebee', '#64d8d0'], wood: ['#9a7654', '#5f4630', '#d6b890', '#7fe0d0'],
}
const PAL = Object.keys(PALETTES)
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
const RULES = [
  [/^hwatu-/, 'card'], [/^seed-|rice-grain|wheat-seed|barley-seed|^soybean$|^rice$|pine-nut$|^acorn$|^chestnut$|rice-seeds/, 'seed', 'wood'],
  [/quill|brush|pencil/, 'brush'], [/feather/, 'feather'], [/fur|tail|mane|yarn|web|rat/, 'fur'], [/fang|tusk|tooth|claw|horn|antler/, 'fang', 'bone'],
  [/bone|centipede$/, 'bone', 'bone'], [/scale|skin|shell|wing|carp$/, 'scale'],
  [/stew|soup|tang$|porridge|bibimbap|ramen|sujebi|hotpot|songi-rice|bingsu|salad|namul|stirfry|beomuri|jelly/, 'bowl'], [/tea|punch|tonic|elixir|nutrient/, 'bottle'], [/pill|candy|dumpling|rice-cake|gaetteok|gangjeong|jeonggwa|taffy/, 'dango'],
  [/picnic|energy/, 'can'], [/chocolate|snack|cake|pancake|hwajeon|icecream|pop|hotbar|grilled|inkstick|chewy/, 'bar'],
  [/mushroom|songi|lingzhi/, 'mushroom'], [/berry|grape|omija|tomato|raspberry/, 'berry', 'crimson'],
  [/flower|orchid|azalea|dandelion|somdari|clover/, 'flower'], [/mugwort|fern|chwinamul|cabbage|spinach|lettuce|licorice|ginseng|deodeok|doraji|dangwi|arrowroot|carrot|potato|moss|greens|branch/, 'leaf', 'moss'],
  [/crystal|gogok|pearl/, 'gem'], [/orb|darkness|starlight|flame/, 'orb'], [/stone|brick|pebble|charcoal|cinnabar$|whetstone/, 'stone'],
  [/charm|talisman|ward|amulet|exorcism-gate/, 'talisman'], [/letter|hanji|diary|bookmark|plaque|tag|oracle/, 'letter', 'bone'],
  [/knife|dagger|sword|sickle/, 'blade', 'steel'], [/spear|staff|mace|nail/, 'spear', 'steel'], [/bow$/, 'bow', 'wood'], [/bell|instrument/, 'bell', 'gold'], [/fan$/, 'fan'], [/mask/, 'mask', 'crimson'],
  [/uniform|wear|coat|robe|cape|vest|cheollik|hansam|galot|cloth|scrap/, 'robe'], [/earring|ring|necklace|norigae|bracelet|hairpin|hairpiece|hatstring|ribbon|headband|knot|inlay|thread|twine|crown/, 'ring'],
  [/lantern|lamp|incense|firecracker/, 'lantern', 'ember'], [/doll|spirit-disposable/, 'doll'], [/phone|token/, 'chip', 'cyan'], [/key/, 'key', 'gold'],
  [/bag|pouch|chest|altar|cairn|sling|bandage|trap|trash|slippers/, 'box'], [/pot|godok|water|broth|oil|juice|syrup|decoction|flour|sugar|powder|ink|pigment|dye|paste|jam|pickled/, 'pot'],
]
const KIND_DEFAULT = { drink: 'can', food: 'dango', material: 'stone', craft: 'box', gear: 'ring', tool: 'tool', misc: 'box' }
const pixels = {}
for (const i of ITEMS) {
  const rule = RULES.find(([re]) => re.test(i.id))
  const t = rule?.[1] ?? KIND_DEFAULT[i.kind] ?? 'box'
  pixels[i.id] = { t, p: rule?.[2] ?? PAL[hash(i.id) % PAL.length] }
}
const used = {}
for (const p of Object.values(pixels)) used[p.t] = (used[p.t] || 0) + 1

const out = `/* 직접 고치지 말 것 — npm run reskin:build 가 systems/biryeong/*.txt 에서 만든다. */
export const ITEM_RESKIN = ${JSON.stringify(items)}
export const ENEMY_RESKIN = ${JSON.stringify(enemies)}
export const PSYCHIC_RESKIN = ${JSON.stringify(psychics)}
export const TEXT_SWAPS = ${JSON.stringify(textSwaps)}
export const PIXEL_TEMPLATES = ${JSON.stringify(templates)}
export const PIXEL_PALETTES = ${JSON.stringify(PALETTES)}
export const ITEM_PIXELS = ${JSON.stringify(pixels)}
`
writeFileSync(join(HERE, 'reskin.data.js'), out)
console.log(`아이템 ${Object.keys(items).length} · 적 ${Object.keys(enemies).length} · 영능력 ${Object.keys(psychics).length} · 도트 틀 ${Object.keys(templates).length}`)
console.log('틀별 아이템 수', JSON.stringify(used))
