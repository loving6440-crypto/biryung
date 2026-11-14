/**
 * 비령 — 보관고(초록동색 원본) 코드에 묶을 때만 끼우는 조각들.
 *
 * 보관고 파일은 그대로 두고, 실행 화면을 묶을 때(build.mjs) 아래 [찾을 글 → 바꿀 글]을 적용한다.
 * 찾을 글이 정확히 한 번 나오지 않으면 빌드를 멈춘다(원본이 바뀌었다는 뜻이니 여기를 고친다).
 *   @story/…    → systems/play/src/…   (비령 쪽 모듈)
 *   @biryeong/… → systems/biryeong/…
 */
export const SOURCE_PATCHES = [
  // ── v1.3 본편 새 아이템: 보관고 아이템 목록 뒤에 붙인다(story-items.txt → reskin.data.js) ──
  {
    file: 'game/items.js',
    edits: [
      ["import { V79_SHEET_DATA } from './v79SheetData.js'", "import { V79_SHEET_DATA } from './v79SheetData.js'\nimport { STORY_ITEMS as __STORY_ITEMS } from '@biryeong/reskin.data.js'"],
      ['export const ITEMS = RAW_ITEMS.map((original) => {', 'export const ITEMS = [...RAW_ITEMS, ...__STORY_ITEMS].map((original) => {'],
    ],
  },
  // ── v1.3 본편 제작법은 처음엔 잠겨 있다: 연 것(globalThis.__BRY_OPEN — usePlayHost 가 채운다)만 제작 칸 · 제작법 목록에 든다 ──
  {
    file: 'game/freeCraft.js',
    edits: [
      ['for (const r of PLACE_RECIPES[place] ?? []) {', 'for (const r of PLACE_RECIPES[place] ?? []) {\n    if (r.unlock && !globalThis.__BRY_OPEN?.has(r.id)) continue'],
    ],
  },
  {
    file: 'ui/components/locations/Workshop.jsx',
    edits: [['<RecipeBook listed={LISTED}', '<RecipeBook listed={withMeta(RECIPES).filter((x) => !x.r.unlock || globalThis.__BRY_OPEN?.has(x.r.id))}']],
  },
  {
    file: 'ui/components/locations/Cooking.jsx',
    edits: [['<RecipeBook listed={LISTED}', '<RecipeBook listed={withMeta(COOK_RECIPES).filter((x) => !x.r.unlock || globalThis.__BRY_OPEN?.has(x.r.id))}']],
  },
  // ── v1.3 본편 아이템의 수급처(제작법 목록의 '얻을 길 없음' 대신 '본편'으로 보인다) ──
  {
    file: 'game/materialLevels.js',
    edits: [
      ["import { LOST_THINGS } from './travelEvents.js'", "import { LOST_THINGS } from './travelEvents.js'\nimport { STORY_ITEMS as __SI } from '@biryeong/reskin.data.js'"],
      ["  add('charcoal', { type: '제작 실패', where: '조리실', what: '제작법에 없는 조합으로 만들면', level: 0 })", "  add('charcoal', { type: '제작 실패', where: '조리실', what: '제작법에 없는 조합으로 만들면', level: 0 })\n  for (const it of __SI) if (it.price == null) add(it.id, { type: '본편', where: '본편 퀘스트', what: it.tags?.includes('전리품') ? '이야기 전투에서 이기면' : '퀘스트가 준다', level: 0 })"],
    ],
  },
  // ── v1.3 보스 고유 패턴: 단독 전투 화면에 이야기 전투 훅(systems/play/src/storyBoss.js)을 끼운다 ──
  {
    file: 'ui/components/locations/Battle.jsx',
    edits: [
      ["import { useCallback, useEffect, useRef, useState } from 'react'", "import { useCallback, useEffect, useRef, useState } from 'react'\nimport * as __SB from '@story/storyBoss.js'"],
      // 내 행동 직후(일반 행동 · 영능력)
      ['if (!r.invalid) r = afterPlayer(cur, r, { action, mp: mpRef.current })', 'if (!r.invalid) r = __SB.afterPlayer(cur, afterPlayer(cur, r, { action, mp: mpRef.current }), action)'],
      ["r = afterPlayer(cur, r, { action: 'psychic', mp: mpRef.current })", "r = __SB.afterPlayer(cur, afterPlayer(cur, r, { action: 'psychic', mp: mpRef.current }), 'psychic')"],
      // 상대 턴
      ['const r = enemyTurn(state0, { stats, mp: mpRef.current, reduction: state.earthReduction || 0 })', 'const r = __SB.enemyTurn(state0, enemyTurn, { stats, mp: mpRef.current, reduction: state.earthReduction || 0 })'],
      // 이야기 행동(이름 부르기 · 이름 묻기 · 금줄 끊기 …) — 턴을 쓰면 상대 턴으로 넘어간다
      ['  // 효험(모두가 가진 영능력): 켜 두면 턴을 쓰지 않는다.', `  const storyAct = (id, arg) => {
    const cur = bRef.current
    if (!cur || cur.over || cur.pendingDeath || busy || phase !== 'fight') return
    const r = __SB.act(cur, id, arg, { stats, mp: mpRef.current })
    if (!r) return
    if (r.invalid) { push(r.events || []); return }
    setPsyOpen(false)
    setScanOpen(false)
    if (r.mpCost) spend(-r.mpCost)
    setB(r.state)
    push(r.events || [])
    if (r.state.over) finish(r.state)
    else if (!r.free) runEnemy(r.state)
  }

  // 효험(모두가 가진 영능력): 켜 두면 턴을 쓰지 않는다.`],
      ['{buffArmed && !b.over && (', '<__SB.Panel b={b} myTurn={myTurn} onAct={storyAct} />\n\n      {buffArmed && !b.over && ('],
      ['<p className="mt-2 text-sm text-paper/80">수렵은 잠시 멈춥니다. 승리하면 영력 20을 얻습니다.</p>', '{encounter.story ? <__SB.Intro e={encounter} /> : <p className="mt-2 text-sm text-paper/80">수렵은 잠시 멈춥니다. 승리하면 영력 20을 얻습니다.</p>}'],
    ],
  },
]

/** 한 파일의 원문에 조각을 적용한다. relPath: systems/vault/modules 기준 경로 */
export function applyPatches(relPath, text) {
  const p = SOURCE_PATCHES.find((x) => relPath.replace(/\\/g, '/').endsWith(x.file))
  if (!p) return text
  for (const [find, put] of p.edits) {
    const n = text.split(find).length - 1
    if (n !== 1) throw new Error(`보관고 조각을 끼울 자리를 찾지 못했다 (${p.file}, ${n}곳): ${find.slice(0, 60)}`)
    text = text.replace(find, () => put)
  }
  return text
}
