// 비령 play — 세계관 개변 적용. 보관고의 아이템 · 적 · 영능력 객체에 비령판 이름 · 설명 · 도트 아이콘 데이터를 덮어쓴다.
// (수치는 그대로. 표는 systems/biryeong/*.txt → reskin.data.js)
import { ITEMS } from '@vault/game/items.js'
import { ALL_ENEMIES, PSYCHICS } from '@vault/game/battle.js'
import { ITEM_RESKIN, ENEMY_RESKIN, PSYCHIC_RESKIN, ITEM_PIXELS } from '../../biryeong/reskin.data.js'

for (const item of ITEMS) {
  const r = ITEM_RESKIN[item.id]
  if (r) { item.name = r.name; item.desc = r.desc }
  if (ITEM_PIXELS[item.id]) item.pixel = ITEM_PIXELS[item.id] // 도트 아이콘: { t: 틀 이름, p: 팔레트 이름 }
}
for (const e of ALL_ENEMIES) {
  const r = ENEMY_RESKIN[e.id]
  if (!r) continue
  e.name = r.name; e.blurb = r.blurb
  if (r.special && e.special) e.special.label = r.special
  if (r.special2 && e.special2) e.special2.label = r.special2
}
for (const p of PSYCHICS) { const r = PSYCHIC_RESKIN[p.id]; if (r) p.note = r.note } // 이름(label)은 빌드할 때 글자째로 바꾼다

// ── v1.0 새 제작법 113개(공작소 63 · 조리실 50) — 보관고의 제작법 목록 뒤에 붙인다. 표: systems/biryeong/recipes-new.txt ──
// tier: 1 바탕 · 2 바탕으로 만드는 완성품 · 3 상급 공정 / yield: 한 번에 나오는 수(usePlayHost 의 afterMake 가 더해 준다)
import { RECIPES } from '@vault/game/crafting.js'
import { COOK_RECIPES } from '@vault/game/cooking.js'
import { HIKE_PATHS } from '@vault/game/hike.js'
import { NEW_RECIPES, RECIPE_TIERS } from '../../biryeong/reskin.data.js'
const TIER_NOTE = { 1: '1단계 · 바탕', 2: '2단계 · 바탕으로 만든다', 3: '3단계 · 상급 공정' }
for (const r of [...RECIPES, ...COOK_RECIPES]) if (r.tier == null) r.tier = RECIPE_TIERS[r.id] ?? 2
const withNote = (r) => ({ ...r, note: `${TIER_NOTE[r.tier]}${r.yield > 1 ? ` · 한 번에 ${r.yield}개` : ''}` })
RECIPES.push(...NEW_RECIPES.W.map(withNote))
COOK_RECIPES.push(...NEW_RECIPES.K.map(withNote))

// ── v1.3 본편 제작법 16개 — 처음엔 잠겨 있다(unlock). 퀘스트가 가르쳐 주거나 그 상대를 이기면 열린다(usePlayHost · patches.mjs). ──
import { STORY_RECIPES } from '../../biryeong/reskin.data.js'
const OPEN_NOTE = (u) => (u === 'quest' ? '본편 · 퀘스트에서 배운 제작법' : '본편 · 이야기 전투의 전리품으로 만든다')
for (const r of STORY_RECIPES) {
  const { place, ...rest } = r
  ;(place === 'K' ? COOK_RECIPES : RECIPES).push({ ...rest, note: `${OPEN_NOTE(r.unlock)} · ${TIER_NOTE[r.tier]}${r.yield > 1 ? ` · 한 번에 ${r.yield}개` : ''}` })
}

// ── v1.0 추가전투는 퇴마 실습장으로 옮겼다: 뒷산 둘레길(교외 옆)의 [추가전투] 칸을 뺀다. ──
const dropExtra = (node) => {
  for (const key of ['choices', 'areas', 'rooms', 'spots', 'branches']) {
    if (!Array.isArray(node?.[key])) continue
    for (let i = node[key].length - 1; i >= 0; i--) { if (node[key][i].widget === 'extraBattle') node[key].splice(i, 1); else dropExtra(node[key][i]) }
  }
}
HIKE_PATHS.forEach(dropExtra)
