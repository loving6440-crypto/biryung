// 비령 play — 세계관 개변 적용. 보관고의 아이템 · 적 · 영능력 객체에 비령판 이름 · 설명 · 도트 아이콘 데이터를 덮어쓴다.
// (수치는 그대로. 표는 systems/biryeong/*.txt → reskin.data.js)
import { ITEMS, STORE_ITEMS } from '@vault/game/items.js'
import { ALL_ENEMIES, PSYCHICS } from '@vault/game/battle.js'
import { applyPsychicFix } from './psychicText.js'
import { ITEM_RESKIN, ENEMY_RESKIN, PSYCHIC_RESKIN, ITEM_PIXELS, ITEM_EDITS, HUNT_EXTRA } from '../../biryeong/reskin.data.js'
import { HUNT_SPECIES } from '@vault/game/huntSites.js'
import { LOCATIONS } from '@vault/game/constants.js'
import { REC_STATS, BESTIARY_ENEMIES } from '@vault/game/battle.js'
import { rescaleEnemy, TIER_REC } from './tierScale.js'
import { reconceptPractice } from './practiceEnemies.js'
import { retuneItems, NEW_STORE } from './itemRetune.js'
// vC.01 추가전투 6~10단계를 주 단위 공개 기준으로 다시 맞춘다(tierScale.js). 본편 보스 · 산길 요괴도 이 수치를 바탕으로 쓴다.
for (const e of BESTIARY_ENEMIES) rescaleEnemy(e)
Object.assign(REC_STATS, TIER_REC)
import { LOCATION_INTRO } from '@vault/game/locationText.js'
// vB.04 오방색 맞추기: 비령의 배치는 산문 北 · 黑 / 강학당(본관 · 별관) 東 · 靑 / 생활관(기숙사) 西 · 白 / 비령산 南 · 赤 / 사당 中 · 黃.
// 보관고는 기숙사를 북(흑), 별관을 서(백)로 적어 두었으므로 여기서 방위 · 색 · 소개 글을 고친다.
Object.assign(LOCATIONS.dorm, { hanja: '白', accentLabel: '백', navNote: '서쪽, 달빛을 머금은 하얀 보금자리.' })
Object.assign(LOCATIONS.annex, { hanja: '靑', accentLabel: '청', navNote: '동쪽, 본관 곁에 선 푸른 띠의 장서각.' })
LOCATION_INTRO.dorm[0] = '사당을 중심으로 서쪽에 놓인 건물. 당신이 살아가는 하얀 공간. 바닥과 벽은 그나마 알아볼 수 있게끔 검고 노란 줄들이 그어져 있으나 가끔 밤에 움직이면 온통 희기만 해서 거리감이 분간이 가질 않아 해가 진 뒤에 이동할 때엔 최소 3명에서 많으면 다섯명씩 움직이라고 주의를 받는다. 4시간 마다 선생님들이 복도를 돌아다니면서 길 잃은 아이들을 다시 방으로 돌려보내곤 한다.'
LOCATION_INTRO.annex[0] = '사당을 중심으로 동쪽, 본관 곁에 놓인 건물. 본관과 같은 파란 띠를 둘렀지만, 별관의 벽은 푸른빛으로 일렁이는 본관과 대비가 될 정도로 하얗다. 모서리에는 글자 대신 동물 모양의 석상이 있으나, 목의 자리엔 그 무엇도 남아있지 않다. 자세히 보려고 해도 선생님들께선 그러는 것을 추천하지 않는다고 주의를 내릴 뿐이다.'
// v1.9.8 개척 덤: 얻을 곳이 없던 아이템을 쉬운 산길의 흔한 대상에 낮은 확률로 붙인다(hunt-extra.txt). 개척을 시작할 때 대상의 보상 목록을 복사하므로 여기서 더해 두면 된다.
for (const x of HUNT_EXTRA) { const sp = HUNT_SPECIES[x.species]; if (sp && !sp.rewards.some((r) => r.item === x.item)) sp.rewards.push({ item: x.item, chance: x.chance, amount: x.amount }) }

for (const item of ITEMS) {
  const r = ITEM_RESKIN[item.id]
  if (r) { item.name = r.name; item.desc = r.desc }
  if (ITEM_EDITS[item.id]) Object.assign(item, ITEM_EDITS[item.id]) // v1.6 아이템 시트에서 고친 해설 · 효과
  if (ITEM_PIXELS[item.id]) item.pixel = ITEM_PIXELS[item.id] // 도트 아이콘: { t: 틀 이름, p: 팔레트 이름 }
}
retuneItems(ITEMS) // vD.01 아이템 효과 겹침 정리(itemRetune.js)
for (const id of Object.keys(NEW_STORE)) { const it = ITEMS.find((i) => i.id === id); if (it && !STORE_ITEMS.includes(it)) STORE_ITEMS.push(it) } // vD.04 매점에 새로 들인 물건(우정 편지)
for (const e of ALL_ENEMIES) {
  const r = ENEMY_RESKIN[e.id]
  if (!r) continue
  e.name = r.name; e.blurb = r.blurb
  if (r.special && e.special) e.special.label = r.special
  if (r.special2 && e.special2) e.special2.label = r.special2
}
reconceptPractice(ALL_ENEMIES) // vC.06 퇴마 실습장 상대 = 실습용 존재(practiceEnemies.js)
for (const p of PSYCHICS) { const r = PSYCHIC_RESKIN[p.id]; if (r) p.note = r.note } // 이름(label)은 빌드할 때 글자째로 바꾼다
applyPsychicFix(PSYCHICS) // vD.03.2 영능력 상세를 실제 계산에 맞춘다

// ── vB.01 조사(탐사) 글 — 시트 「비령_조사」 탭에 맞춘 글로 바꾼다(josa-overrides.json, systems/biryeong/josa_match.mjs 가 만든다).
//    조건부 글(스탯에 따라 덧붙는 글)은 그대로 두고, 바탕 글만 바꾼다. ──
import { FLOORS } from '@vault/game/explore.js'
import { ANNEX_FLOORS } from '@vault/game/annex.js'
import { HIKE_PATHS as JOSA_HIKE } from '@vault/game/hike.js'
import { SHRINE_AREAS } from '@vault/game/shrineExplore.js'
import JOSA from '../../biryeong/josa-overrides.json'
{
  const ROOTS = { main: { floors: FLOORS }, annex: { floors: ANNEX_FLOORS }, hike: { floors: JOSA_HIKE }, shrine: { areas: SHRINE_AREAS } }
  const KEYS = ['floors', 'areas', 'rooms', 'spots', 'choices', 'branches']
  const step = (node, id) => { for (const k of KEYS) { const i = node?.[k]?.findIndex?.((c) => c.id === id) ?? -1; if (i >= 0) return { list: node[k], i } } return null }
  for (const e of JOSA.edits) {
    let node = ROOTS[e.zone], at = null
    for (const id of e.path) { at = step(node, id); if (!at) break; node = at.list[at.i] }
    if (!at) continue
    if (e.remove) { at.list.splice(at.i, 1); continue }
    if (e.name) node.name = e.name
    if (e.set) Object.assign(node, e.set) // vC.06: 글 말고 다른 칸(예: 비품실 안내사항의 typeAfter · typeAuto)
    if (e.texts) { const old = Array.isArray(node[e.field]) ? node[e.field] : node[e.field] != null ? [node[e.field]] : []; node[e.field] = [...e.texts, ...old.filter((x) => typeof x !== 'string')] }
  }
}

// ── v1.0 새 제작법 113개(공작소 63 · 조리실 50) — 보관고의 제작법 목록 뒤에 붙인다. 표: systems/biryeong/recipes-new.txt ──
// tier: 1 바탕 · 2 바탕으로 만드는 완성품 · 3 상급 공정 / yield: 한 번에 나오는 수(usePlayHost 의 afterMake 가 더해 준다)
import { RECIPES } from '@vault/game/crafting.js'
import { COOK_RECIPES } from '@vault/game/cooking.js'
import { HIKE_PATHS } from '@vault/game/hike.js'
import { NEW_RECIPES, RECIPE_TIERS } from '../../biryeong/reskin.data.js'
import { AIL_RECIPES, NURSE_STOCK } from './ailments.js'
import { NEW_SPIRIT_RECIPES } from './newSpirits.js'
const TIER_NOTE = { 1: '1단계 · 바탕', 2: '2단계 · 바탕으로 만든다', 3: '3단계 · 상급 공정' }
for (const r of [...RECIPES, ...COOK_RECIPES]) if (r.tier == null) r.tier = RECIPE_TIERS[r.id] ?? 2
const withNote = (r) => ({ ...r, note: `${TIER_NOTE[r.tier]}${r.yield > 1 ? ` · 한 번에 ${r.yield}개` : ''}` })
RECIPES.push(...NEW_RECIPES.W.map(withNote))
COOK_RECIPES.push(...NEW_RECIPES.K.map(withNote))
// vC.06 몸의 이상을 낫게 하는 물건 28가지(ailments.js) — 1단계: 완치 · 시간 줄이기 / 2단계: 완치 + 회복
// vD.02 새 영물 5종의 전리품으로 만드는 물건
for (const r of NEW_SPIRIT_RECIPES) RECIPES.push({ ...withNote(r), note: `${withNote(r).note} · 영물의 전리품` })
for (const r of AIL_RECIPES) { const { place, ...rest } = r; (place === 'K' ? COOK_RECIPES : RECIPES).push({ ...withNote(rest), note: `${withNote(rest).note} · 몸의 이상` }) }

// ── v1.3 본편 제작법 16개 — 처음엔 잠겨 있다(unlock). 퀘스트가 가르쳐 주거나 그 상대를 이기면 열린다(usePlayHost · patches.mjs). ──
import { STORY_RECIPES } from '../../biryeong/reskin.data.js'
const OPEN_NOTE = (u) => (u === 'quest' ? '본편 · 퀘스트에서 배운 제작법' : u === 'open' ? '본편 물건으로 만든다(재료는 개척에서)' : '본편 · 이야기 전투의 전리품으로 만든다')
for (const r of STORY_RECIPES) {
  const { place, ...rest } = r
  if (rest.unlock === 'open') delete rest.unlock // 처음부터 열려 있다
  ;(place === 'K' ? COOK_RECIPES : RECIPES).push({ ...rest, note: `${OPEN_NOTE(r.unlock)} · ${TIER_NOTE[r.tier]}${r.yield > 1 ? ` · 한 번에 ${r.yield}개` : ''}` })
}

// ── vD.02.3 어딘가에서 살 수 있는 물건(매점 · 양호실 · 정원 씨앗)은 제작법을 두지 않는다 — 헷갈리기만 한다 ──
{
  const sold = new Set([...ITEMS.filter((i) => i.price != null).map((i) => i.id), ...NURSE_STOCK.map((x) => x.id)])
  for (const list of [RECIPES, COOK_RECIPES]) for (let i = list.length - 1; i >= 0; i--) if (sold.has(list[i].result)) list.splice(i, 1)
}

// ── v1.0 추가전투는 퇴마 실습장으로 옮겼다: 뒷산 둘레길(교외 옆)의 [추가전투] 칸을 뺀다. ──
const dropExtra = (node) => {
  for (const key of ['choices', 'areas', 'rooms', 'spots', 'branches']) {
    if (!Array.isArray(node?.[key])) continue
    for (let i = node[key].length - 1; i >= 0; i--) { if (node[key][i].widget === 'extraBattle') node[key].splice(i, 1); else dropExtra(node[key][i]) }
  }
}
HIKE_PATHS.forEach(dropExtra)
