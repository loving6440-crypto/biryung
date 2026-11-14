/**
 * 秘靈 · 비령 — 표(엑셀)용 자료 뽑기.   node systems/sheets/export.mjs > sheets.json  →  python3 systems/sheets/build_xlsx.py
 * 아이템(종류 · 효과 · 해설 · 설명 · 습득 방법) · 제작법(1~3단계) · 칭호(기능)를 게임 데이터에서 그대로 읽어 온다.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), G = join(ROOT, 'systems/vault/modules/game')
const imp = (f) => import(join(G, f))
const { ITEMS } = await imp('items.js')
const { RECIPES } = await imp('crafting.js')
const { COOK_RECIPES } = await imp('cooking.js')
const hunt = await imp('huntSites.js')
const garden = await imp('garden.js')
const R = await import(join(ROOT, 'systems/biryeong/reskin.data.js'))
const swap = (t) => R.TEXT_SWAPS.reduce((s, [a, b]) => s.split(a).join(b), String(t ?? ''))
const name = (id) => R.ITEM_RESKIN[id]?.name ?? ITEMS.find((i) => i.id === id)?.name ?? id
const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

const recipes = [
  ...RECIPES.map((r) => ({ ...r, place: '공작소', isNew: false })), ...COOK_RECIPES.map((r) => ({ ...r, place: '조리실', isNew: false })),
  ...R.NEW_RECIPES.W.map((r) => ({ ...r, place: '공작소', isNew: true })), ...R.NEW_RECIPES.K.map((r) => ({ ...r, place: '조리실', isNew: true })),
].map((r) => ({ ...r, tier: R.RECIPE_TIERS[r.id] ?? r.tier }))

// ── 습득 방법 ──
const src = {}; const add = (id, text) => { (src[id] ??= new Set()).add(text) }
for (const i of ITEMS) if (i.price != null) add(i.id, i.id.startsWith('seed-') || /-seed$/.test(i.id) ? `씨앗 상점 · 매점 구매 (${i.price}냥)` : `매점 구매 (${i.price}냥)`)
for (const r of recipes) add(r.result, `${r.place} 제작 (${r.tier}단계)`)
const KIND = { plant: '채집', animal: '수렵', obstacle: '채굴 · 조사', spirit: '영물', ghost: '요괴' }
const where = {} // 종 → 터 이름들
for (const s of Object.values(hunt.HUNT_SITES)) {
  for (const n of s.nodes) (where[n.species] ??= new Set()).add(s.name)
  if (s.spirit) for (const rw of s.spirit.rewards ?? []) add(rw.item, `개척 영물 「${s.spirit.name}」`)
  if (s.ghost) for (const rw of s.ghost.rewardItems ?? []) add(rw.item, `개척 중 만난 요괴 「${s.ghost.name}」 처치`)
}
const span = (set) => { const a = [...set]; return a.length > 3 ? `${a[0]} 등 ${a.length}곳` : a.join(' · ') }
for (const [sid, sp] of Object.entries(hunt.HUNT_SPECIES)) for (const rw of sp.rewards ?? []) if (where[sid]) add(rw.item, `개척 ${KIND[sp.kind] ?? '획득'} — ${sp.name} (${span(where[sid])})`)
for (const c of garden.GARDEN_CROPS ?? []) add(c.id, '텃밭(비닐하우스) 수확')
const FILES = { 'explore.js': '본관 탐사', 'annex.js': '별관 탐사', 'hike.js': '산 탐사', 'shrineExplore.js': '사당 탐사', 'exploreActions.js': '탐사 중 행동(기다리기 · 도깨비 놀이 · 보관함)', 'travelEvents.js': '이동 중 사건', 'huntTrails.js': '개척 산길', 'armory.js': '무구보관소', 'progress.js': '전투 · 진행 보상', 'character.js': '처음부터 지급', 'bag.js': '처음부터 지급', 'locker.js': '물품보관함', 'clubs.js': '동아리 활동', 'meals.js': '급식실', 'store.js': '매점' }
const texts = Object.fromEntries(readdirSync(G).filter((f) => FILES[f]).map((f) => [f, readFileSync(join(G, f), 'utf8')]))
for (const i of ITEMS) for (const [f, t] of Object.entries(texts)) if (t.includes(`'${i.id}'`)) add(i.id, FILES[f])
for (const i of ITEMS) {
  if (i.slot === 'weapon') { add(i.id, '전투 튜토리얼 완주 보상(택 1)'); add(i.id, '도깨비 인증 토큰 10개 교환(무구보관소)') }
  if (i.id.startsWith('hwatu-')) add(i.id, '별관 패 놀이터 · 탐사')
  if (i.tags?.includes('완성품') && i.id !== 'someones-bag') add(i.id, '주인 없는 가방(무작위)')
  if (i.id === 'charcoal') add(i.id, '조리 실패작'); if (i.id === 'trash') add(i.id, '공작소 실패작')
  if (i.id === 'crescent-flower') add(i.id, '개척 채집 — 달꽃터(오후에 캐면 초승꽃, 오전에는 그믐꽃)')
  if (i.id === 'fine-woodchip') add(i.id, '개척 채집에 실패했을 때 대신 얻는다')
  if (i.id === 'trap-scraps') add(i.id, '개척 수렵에 실패했을 때 대신 얻는다')
  if (i.id === 'someones-bag') add(i.id, '카드키로 남의 물품보관함 몰래 열기(본관 3층)')
}

// ── 쓰임새(설명) ──
const usedIn = {}
for (const r of recipes) for (const [id] of r.inputs) (usedIn[id] ??= new Set()).add(name(r.result))
const useText = (i) => {
  const t = i.tags ?? [], out = []
  if (t.includes('전투 중 사용 가능')) out.push(`전투 중 사용(${t.includes('#턴소모有') ? '턴을 쓴다' : '턴을 쓰지 않는다'})`)
  if (t.includes('#개척')) out.push('개척 중 사용')
  if (i.slot) out.push({ weapon: '무구 칸에 장착', body: '신체 칸에 착용', trinket: '장신구 칸에 착용' }[i.slot] ?? '착용')
  if (t.includes('무구 강화')) out.push('무구보관소 강화 재료')
  if (t.includes('특수 강화 패')) out.push('무구 특수 강화에 쓰는 패')
  if (t.includes('가방')) out.push('소지품 칸을 늘린다')
  if (!out.length && t.includes('완성품')) out.push('소지품에서 사용')
  if (usedIn[i.id]) { const a = [...usedIn[i.id]]; out.push(`제작 재료 — ${a.slice(0, 6).join(', ')}${a.length > 6 ? ` 등 ${a.length}종` : ''}`) }
  if (!out.length) out.push(i.id.startsWith('seed-') ? '비닐하우스에 심는다' : '아직 쓰이는 곳이 없다(판매 · 보관)')
  return out.join(' / ')
}
const kindOf = (i) => (i.tags?.includes('재료') ? '재료' : i.slot === 'weapon' ? '완성품 · 무구' : i.slot === 'body' ? '완성품 · 신체 장비' : i.slot === 'trinket' ? '완성품 · 장신구' : i.tags?.includes('무구 강화') ? '완성품 · 무구 강화재' : i.tags?.includes('특수 강화 패') ? '완성품 · 특수 강화 패' : i.tags?.includes('#개척') ? '완성품 · 개척용' : i.tags?.includes('전투 중 사용 가능') ? '완성품 · 전투용' : '완성품 · 소모품')
const effectOf = (i) => (i.tags?.includes('재료') ? '제작용 재료' : swap(i.effectText) || '효과 없음')
const items = ITEMS.map((i) => ({ id: i.id, name: name(i.id), kind: kindOf(i), tags: (i.tags ?? []).join(' · '), effect: effectOf(i), lore: swap(R.ITEM_RESKIN[i.id]?.desc ?? i.desc), use: useText(i), source: [...(src[i.id] ?? ['아직 습득처 없음 — 초록동색에서는 NPC · 퀘스트로 얻던 것. 새 NPC가 정해지면 연결(지금은 관리자 지급)'])].join(' / '), price: i.price ?? null }))

const rec = recipes.map((r) => { const i = byId[r.result]; return { id: r.id, resultId: r.result, tier: r.tier, place: r.place, result: name(r.result), qty: r.yield ?? 1, kind: kindOf(i), effect: effectOf(i), lore: swap(R.ITEM_RESKIN[r.result]?.desc ?? i.desc), use: useText(i), combo: r.inputs.map(([id, n]) => `${name(id)} ×${n}`).join(' + '), parts: r.inputs.length, isNew: r.isNew ? 'v1.0 신규' : '기존' } })

globalThis.window = {}
for (const f of ['titles.js', 'titles2.js']) new Function('window', readFileSync(join(ROOT, f), 'utf8'))(globalThis.window)
const A = window.BIRYEONG_ACHIEVEMENTS, GN = Object.fromEntries(window.BIRYEONG_ACHIEVEMENT_GROUPS.map((g) => [g.id, g.name]))
const titles = window.BIRYEONG_TITLES.map((t) => { const a = A.find((x) => x.title === t.id); return { name: t.name, desc: t.desc, tier: t.tier, group: a ? GN[a.group] : '처음부터', how: a ? `업적 「${a.name}」 — ${a.hint}` : '처음부터 가지고 있다', perk: t.perkText, isNew: a?.group === 'neo' ? 'v1.0 신규' : '기존' } })
console.log(JSON.stringify({ items, recipes: rec, titles }))
