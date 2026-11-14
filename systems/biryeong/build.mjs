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
  ['국립 창록고등학교', '비령 임시학당'], ['창록고등학교', '비령 임시학당'], ['창록고', '비령학당'], ['창록교', '비령학당'], ['창록', '비령'], ['초록동색', '비령'], ['둘레길 바깥 숲에서 진짜 요괴와 겨룬다', '실습장 결계 너머에서 금역의 요괴와 겨룬다'],
].sort((a, b) => b[0].length - a[0].length)

// ── 도트 아이콘 (v1.1: 아이템마다 하나씩) ──
// pixel-templates.txt · pixel-templates-2.txt : 12×12 도트 틀 108개 (k 외곽선 · a 바탕 · b 그늘 · c 빛 · d 포인트)
// pixels.txt : 아이템 id|틀|색 — 312개 모두 손으로 정했다. 같은 (틀 · 색) 조합을 두 아이템이 쓰면 빌드가 멈춘다.
const templates = {}
for (const f of ['pixel-templates.txt', 'pixel-templates-2.txt']) {
  for (const block of readFileSync(join(HERE, f), 'utf8').trim().split('#').slice(1)) {
    const [name, ...grid] = block.trim().split('\n')
    if (grid.length !== 12 || grid.some((r) => r.length !== 12)) throw new Error('도트 틀 크기 오류: ' + name)
    if (templates[name]) throw new Error('도트 틀 이름이 겹친다: ' + name)
    templates[name] = grid
  }
}
// [바탕, 그늘, 빛, 포인트]
const PALETTES = {
  green: ['#6f9d5a', '#45683a', '#b9d99a', '#efe3a8'], dgreen: ['#3f7a55', '#27503a', '#8fc49a', '#d9c27a'], lime: ['#c0d060', '#8a9a38', '#eef7a8', '#7a5a3a'],
  brown: ['#9a7654', '#5f4630', '#d6b890', '#efe3a8'], dbrown: ['#6b4a34', '#40291c', '#a98060', '#e0b060'], tan: ['#d2b48a', '#9a7f58', '#f3e3c0', '#8a5a3a'],
  bone: ['#e3dcc6', '#a59f8c', '#ffffff', '#c66a6c'], gray: ['#93a3ad', '#586771', '#e2ebee', '#64d8d0'], dgray: ['#5a6570', '#353d47', '#9aa6b0', '#f0d49a'],
  black: ['#3a3f4c', '#20232c', '#737a8c', '#c8504f'], red: ['#c8504f', '#84303a', '#f3a09a', '#f6e3b5'], crimson: ['#a83250', '#6a1c34', '#e87a90', '#f0d49a'],
  pink: ['#e08aa8', '#9a5270', '#f8c8d8', '#fff3d6'], orange: ['#e0904a', '#9a5a28', '#f8cf9a', '#fff1c4'], yellow: ['#e8c84a', '#a08a28', '#fbf0a0', '#c8504f'],
  gold: ['#d4b078', '#8d7147', '#f6e3b5', '#c8504f'], purple: ['#8a6fb0', '#553f78', '#d6c4f0', '#7fe0d0'], grape: ['#6a4a90', '#3f2a60', '#a890d0', '#c8e080'],
  blue: ['#4a78b8', '#2b4878', '#a9c7ea', '#f0d49a'], sky: ['#7fc4e8', '#4a88a8', '#d6f1fa', '#ffffff'], cyan: ['#5fc8c0', '#358880', '#c0f4ec', '#f3a6a0'],
  jade: ['#4f948d', '#2f625f', '#a8e0d4', '#f0d49a'], white: ['#eef0f6', '#b0b6c8', '#ffffff', '#7fc4e8'], cream: ['#f3e6c0', '#c0ae80', '#fffbe8', '#c8504f'],
  ember: ['#f07a3a', '#a8421c', '#ffc88a', '#fff1c4'], ghost: ['#7fe0a0', '#3f9a68', '#d0ffe0', '#ffffff'], neon: ['#f060c0', '#a02880', '#ffb0e8', '#60f0f0'],
  ink: ['#2f3a5a', '#1a2238', '#6a78a8', '#e3dcc6'], rice: ['#f6f0dc', '#c8c0a0', '#ffffff', '#d4b078'], soy: ['#d8c070', '#9a8440', '#f6ecb0', '#6f9d5a'],
}
const pixels = {}
const comboOwner = new Map()
for (const [id, t, p] of rows('pixels.txt')) {
  if (!items[id]) throw new Error('도트: 없는 아이템 ' + id)
  if (!templates[t]) throw new Error(`도트: 없는 틀 ${t} (${id})`)
  if (!PALETTES[p]) throw new Error(`도트: 없는 색 ${p} (${id})`)
  const key = t + ':' + p
  if (comboOwner.has(key)) throw new Error(`도트가 겹친다: ${id} ↔ ${comboOwner.get(key)} (${key})`)
  comboOwner.set(key, id)
  pixels[id] = { t, p }
}
for (const i of ITEMS) if (!pixels[i.id]) throw new Error('도트 누락: ' + i.id)
const used = {}
for (const p of Object.values(pixels)) used[p.t] = (used[p.t] || 0) + 1

// ── 새 제작법(v1.0) · 제작 단계 ──
// recipes-new.txt : 곳(W 공작소 · K 조리실)|단계|결과|재료(a*2+b)|한 번에 나오는 수(비우면 1)
//   1단계 = 바탕(다른 제작의 재료가 되는 것) · 2단계 = 바탕으로 만드는 완성품 · 3단계 = 완성품 · 바탕을 겹쳐 쓰는 상급품 · 대량 공정
const { RECIPES } = await import('../vault/modules/game/crafting.js')
const { COOK_RECIPES } = await import('../vault/modules/game/cooking.js')
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]))
const gcd = (a, b) => (b ? gcd(b, a % b) : a)
const sig = (inputs) => { const g = inputs.map((x) => x[1]).reduce(gcd); return inputs.map(([id, n]) => id + '*' + n / g).sort().join('+') }
const seen = { W: new Map(RECIPES.map((r) => [sig(r.inputs), r.id])), K: new Map(COOK_RECIPES.map((r) => [sig(r.inputs), r.id])) }
const newRecipes = { W: [], K: [] }
rows('recipes-new.txt').forEach(([place, tier, result, ins, yieldN], i) => {
  const inputs = ins.split('+').map((p) => { const [id, n] = p.split('*'); return [id, Number(n || 1)] })
  for (const [id] of [[result], ...inputs]) if (!itemById[id]) throw new Error('새 제작법: 없는 아이템 ' + id)
  if (inputs.length > 10) throw new Error('새 제작법: 재료 칸 초과 ' + result)
  const s = sig(inputs)
  if (seen[place].has(s)) throw new Error('새 제작법: 재료 조합이 겹친다 ' + result + ' ↔ ' + seen[place].get(s))
  const id = 'n' + String(i + 1).padStart(3, '0') + '-' + result
  seen[place].set(s, id)
  newRecipes[place].push({ id, result, inputs, tier: Number(tier), ...(yieldN ? { yield: Number(yieldN) } : {}) })
})
// 원래 있던 제작법의 단계: 결과가 재료면 1, 완성품을 재료로 쓰거나 귀한 재료가 들면 3, 나머지 2
const RARE = new Set('spirit-orb golden-serpent-scale fortune-bat-wing turtle-shell dragon-mane crane-feather lingzhi wild-ginseng gold-toad-skin weasel-fur frost-flower bear-fur somdari magpie-feather antler haedongcheong-feather songi wolf-fang hawk-feather marten-fur imugi-scale ginseng'.split(' '))
const isMaterial = (id) => itemById[id].tags?.includes('재료')
const tierOf = (r) => (isMaterial(r.result) ? 1 : r.inputs.some(([id]) => !isMaterial(id) || RARE.has(id)) ? 3 : 2)
const recipeTiers = Object.fromEntries([...RECIPES, ...COOK_RECIPES].map((r) => [r.id, tierOf(r)]))
for (const r of [...newRecipes.W, ...newRecipes.K]) recipeTiers[r.id] = r.tier

const out = `/* 직접 고치지 말 것 — npm run reskin:build 가 systems/biryeong/*.txt 에서 만든다. */
export const ITEM_RESKIN = ${JSON.stringify(items)}
export const ENEMY_RESKIN = ${JSON.stringify(enemies)}
export const PSYCHIC_RESKIN = ${JSON.stringify(psychics)}
export const TEXT_SWAPS = ${JSON.stringify(textSwaps)}
export const PIXEL_TEMPLATES = ${JSON.stringify(templates)}
export const PIXEL_PALETTES = ${JSON.stringify(PALETTES)}
export const ITEM_PIXELS = ${JSON.stringify(pixels)}
export const NEW_RECIPES = ${JSON.stringify(newRecipes)}
export const RECIPE_TIERS = ${JSON.stringify(recipeTiers)}
`
writeFileSync(join(HERE, 'reskin.data.js'), out)
console.log(`아이템 ${Object.keys(items).length} · 적 ${Object.keys(enemies).length} · 영능력 ${Object.keys(psychics).length} · 도트 틀 ${Object.keys(templates).length}`)
console.log(`도트: 아이템 ${Object.keys(pixels).length}개 · 쓰인 틀 ${Object.keys(used).length} / ${Object.keys(templates).length} · 겹치는 도트 0`)
const tally = {}; for (const t of Object.values(recipeTiers)) tally[t] = (tally[t] || 0) + 1
console.log(`새 제작법 공작소 ${newRecipes.W.length} · 조리실 ${newRecipes.K.length} / 전체 단계별`, JSON.stringify(tally))
