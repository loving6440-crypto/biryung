import { readFileSync } from 'node:fs'
/**
 * 비령 — 보관고(초록동색 원본) 코드에 묶을 때만 끼우는 조각들.
 *
 * 보관고 파일은 그대로 두고, 실행 화면을 묶을 때(build.mjs) 아래 [찾을 글 → 바꿀 글]을 적용한다.
 * 찾을 글이 정확히 한 번 나오지 않으면 빌드를 멈춘다(원본이 바뀌었다는 뜻이니 여기를 고친다).
 *   @story/…    → systems/play/src/…   (비령 쪽 모듈)
 *   @biryeong/… → systems/biryeong/…
 */
export const SOURCE_PATCHES = [
  // ── vC.06 개척 터: 레벨을 만렙 40 기준으로 · 이름 · 설명 · 순서(huntLevels.js) · 개척 기록 칸 고정 ──
  {
    file: 'game/huntSites.js',
    edits: [
      ["import { TRAIL_SPECIES, TRAILS } from './huntTrails.js'", "import { TRAIL_SPECIES, TRAILS } from './huntTrails.js'\nimport { remapHuntSites as __remapHunt } from '@story/huntLevels.js'"],
      ["/* 구형 길 분할 목록은 v79부터 사용하지 않는다.", "__remapHunt(HUNT_SITES, HUNT_PATHS) // vC.06\n\n/* 구형 길 분할 목록은 v79부터 사용하지 않는다."],
    ],
  },
  {
    file: 'ui/components/locations/HuntField.jsx',
    edits: [
      ["{site.theme && <p className=\"mt-1 text-xs leading-relaxed text-paper/65\" data-site-note>{site.theme} — {site.note} <span className=\"text-paper/45\">(관련 스탯 평균 {site.targetStat} 안팎이면 수월하다.",
       "{site.note && <p className=\"mt-1 text-xs leading-relaxed text-paper/65\" data-site-note>{site.note} <span className=\"text-paper/45\">(관련 스탯 평균 {site.targetStat} 안팎이면 수월하다."],
      ["{current.log.map((text, i) => <li key={i}>{text}</li>)}</ol>", "{[...current.log].reverse().map((text, i) => <li key={current.log.length - i}>{text}</li>)}</ol>"],
      ["          <p className=\"mt-4 text-xs text-gold\">획득: ", "          <p className=\"mt-4 h-9 overflow-y-auto text-xs leading-snug text-gold\" data-hunt-gained>획득: "],
      ["<ol className=\"mt-2 max-h-36 space-y-1 overflow-auto text-xs text-paper/70\" aria-label=\"개척 기록\"", "<ol className=\"mt-2 flex h-40 flex-col-reverse gap-1 overflow-y-auto overscroll-contain rounded border border-edge/15 p-2 text-xs text-paper/70\" data-hunt-log aria-label=\"개척 기록\""],
    ],
  },
  // ── vC.06 제작법 보기: [레벨 순서대로 보기] · [가나다순으로 보기] ──
  {
    file: 'ui/components/RecipeBook.jsx',
    edits: [
      ["  const rows = listed\n    .filter(({ r }) => !onlyCan || free || canMake(r))\n    .sort((a, b) => (itemOf(a.r.result)?.name ?? '').localeCompare(itemOf(b.r.result)?.name ?? '', 'ko'))",
       "  const [order, setOrder] = useState(() => { try { return localStorage.getItem('recipeOrder') === 'lv' ? 'lv' : 'name' } catch { return 'name' } })\n  const pickOrder = (o) => { setOrder(o); try { localStorage.setItem('recipeOrder', o) } catch { /* 무시 */ } }\n  const byName = (a, b) => (itemOf(a.r.result)?.name ?? '').localeCompare(itemOf(b.r.result)?.name ?? '', 'ko', { numeric: true })\n  const rows = listed\n    .filter(({ r }) => !onlyCan || free || canMake(r))\n    .sort((a, b) => (order === 'lv' ? (a.lv ?? 1e9) - (b.lv ?? 1e9) : 0) || byName(a, b))"],
      ["    <div data-recipe-book>\n", "    <div data-recipe-book>\n      <div className=\"mb-2 flex flex-wrap gap-1.5\" role=\"group\" aria-label=\"제작법 정렬\" data-recipe-order>\n        <button type=\"button\" aria-pressed={order === 'lv'} data-recipe-order-lv onClick={() => pickOrder('lv')} className={`flat-chip border px-3 py-1 text-xs ${order === 'lv' ? 'border-gold/60 text-gold' : 'border-edge/25 text-paper/70'}`}>레벨 순서대로 보기</button>\n        <button type=\"button\" aria-pressed={order === 'name'} data-recipe-order-name onClick={() => pickOrder('name')} className={`flat-chip border px-3 py-1 text-xs ${order === 'name' ? 'border-gold/60 text-gold' : 'border-edge/25 text-paper/70'}`}>가나다순으로 보기</button>\n      </div>\n"],
    ],
  },
  // ── vC.06 조사 글: typeAuto(ms)가 있으면 누르지 않아도 그만큼 뒤에 이어지는 글이 저절로 타이핑된다(비품실 안내사항: 3초) ──
  {
    file: 'ui/components/Scene.jsx',
    edits: [
      ["  useAnyClick(!!typeText && typed < 0, () => setTyped(0))\n", "  useAnyClick(!!typeText && typed < 0 && !node.typeAuto, () => setTyped(0))\n  useEffect(() => {\n    if (!typeText || typed >= 0 || !node.typeAuto) return undefined\n    const t = setTimeout(() => setTyped(0), node.typeAuto)\n    return () => clearTimeout(t)\n  }, [typeText, typed, node.typeAuto]) // eslint-disable-line react-hooks/exhaustive-deps\n"],
      ["{typed < 0 ? <span className=\"text-[11px] text-paper/40\">(화면을 누르면 이어서 읽힌다)</span>", "{typed < 0 ? (node.typeAuto ? null : <span className=\"text-[11px] text-paper/40\">(화면을 누르면 이어서 읽힌다)</span>)"],
    ],
  },
  // ── vC.06 몸의 이상(ailments.js): 육조 스탯 보정 · 혼자 하는 전투의 라운드 피해 · 낫게 하는 물건 ──
  {
    file: 'game/statCalc.js',
    edits: [
      ["import { equipOf, gearBonus, specialEnhOf, trinketFx, weaponFx } from './items.js'", "import { equipOf, gearBonus, specialEnhOf, trinketFx, weaponFx } from './items.js'\nimport { ailmentStatBonus as __ailStat } from '@story/ailments.js'"],
      ["  const bonus = { ...gearBonus(player) }\n", "  const bonus = { ...gearBonus(player) }\n  for (const [k, v] of Object.entries(__ailStat(player, now))) bonus[k] = (bonus[k] || 0) + v // vC.06 몸의 이상\n"],
      ["(weak ? Math.max(1, Math.floor(v / 2)) : v) + (bonus[k] || 0)]))", "Math.max(1, (weak ? Math.max(1, Math.floor(v / 2)) : v) + (bonus[k] || 0))]))"],
    ],
  },
  {
    file: 'game/battle.js',
    edits: [
      ["    if (s.ps.poison > 0 && s.php > 0) tickHurt(", "    for (const t of __ailRound()) { if (s.php <= 1) break; const d = Math.min(s.php - 1, t.dmg); s.php -= d; ev.push({ kind: 'warn', text: `${t.text} 체력 ${d}을(를) 잃었다.` }) } // vC.06 몸의 이상(쓰러지지는 않는다)\n    if (s.ps.poison > 0 && s.php > 0) tickHurt("],
      ["export const ENEMIES = [", "import { ailmentRoundTicks as __ailRound } from '@story/ailments.js'\nexport const ENEMIES = ["],
    ],
  },
  // ── vC.06 소지품: 테두리 색 안내 · 몸의 이상 표시 ──
  {
    file: 'ui/components/InventoryModal.jsx',
    edits: [
      ['<p className="mt-4 text-[11px] tracking-widest text-paper/55">가진 물건</p>', '<p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-widest text-paper/55"><span>가진 물건</span><span className="text-[10px] tracking-normal" data-kind-legend><b style={{ color: \'#e3bf6a\' }}>▢ 장비</b> · <b style={{ color: \'#5fb3c2\' }}>▢ 완성품</b> · <b style={{ color: \'#8d9c6f\' }}>▢ 재료</b> <span className="text-paper/40">(테두리 색)</span></span></p>'],
    ],
  },
  // ── vC.06 수업 미니게임 창: 위아래로 더 넉넉하게(화면 높이의 94%까지, 위 여백도 줄인다) ──
  {
    file: 'ui/components/GameModal.jsx',
    edits: [
      ['className="pointer-events-none fixed inset-0 z-[65] flex items-start justify-center p-2 pt-14 sm:p-4 sm:pt-16"', 'className="pointer-events-none fixed inset-0 z-[65] flex items-start justify-center p-2 pt-3 sm:p-4 sm:pt-6" data-game-modal-wrap'],
      ['className={`pointer-events-auto ink-panel max-h-[75vh] w-full overflow-y-auto', 'className={`pointer-events-auto ink-panel max-h-[94dvh] min-h-[min(640px,88dvh)] w-full overflow-y-auto'],
    ],
  },
  // ── vC.06 동아리 활동: 내 동아리 부실에 오면 [오늘의 할일] · [이번주에 할일]이 바로 보인다(ClubQuests.jsx) ──
  {
    file: 'ui/components/ClubRoomPanel.jsx',
    edits: [
      ["import { clubOf as clubMetaOf } from '../../game/clubs'", "import { clubOf as clubMetaOf } from '../../game/clubs'\nimport ClubQuests from '@story/ClubQuests.jsx'"],
      ["        <button type=\"button\" onClick={() => setTab('activity')} className=\"flat-btn-ghost !py-1 text-xs\">\n          동아리 활동하기\n        </button>\n", ""],
      ["      {tab === 'activity' && (\n        <div className=\"mt-4 rounded-lg bg-shade/25 p-3\">\n          <p className=\"text-sm text-paper/60\">(준비 중)</p>\n        </div>\n      )}\n", "      {sameClub ? <ClubQuests clubId={clubId} /> : <p className=\"mt-3 text-[11px] text-paper/45\">이 동아리에 가입하면 부실에서 [오늘의 할일] · [이번주에 할일]을 할 수 있다.</p>}\n"],
    ],
  },
  // ── vC.06 인물의 부탁: 조사 장소마다 [이 장소에서 받을 수 있는 퀘스트](NpcQuests.jsx) — 본관 · 별관 · 비령산 (사당 제외) ──
  {
    file: 'ui/components/locations/Explore.jsx',
    edits: [
      ["import { GotoInfirmary, LockerSpot, StudentList } from '../ExploreWidgets'", "import { GotoInfirmary, LockerSpot, StudentList } from '../ExploreWidgets'\nimport NpcQuests from '@story/NpcQuests.jsx'"],
      ["                onShow={(node, paras) => paras.length && onInvestigate?.(floor.name, node.name, paras.join(' ').replace(/\\*+|~~/g, ''))}\n              />\n", "                onShow={(node, paras) => paras.length && onInvestigate?.(floor.name, node.name, paras.join(' ').replace(/\\*+|~~/g, ''))}\n              />\n              <NpcQuests place={`mainHall:${floor.id}:${area.id}`} />\n"],
    ],
  },
  {
    file: 'ui/components/locations/Annex.jsx',
    edits: [
      ["import ClubRoomPanel from '../ClubRoomPanel'", "import ClubRoomPanel from '../ClubRoomPanel'\nimport NpcQuests from '@story/NpcQuests.jsx'"],
      ["                <Scene key={`${room.id}:${visit}`} root={room} ctx={ctx} scope={`annex:${floor.id}:${room.id}`} onHome={home} />\n              </div>\n", "                <Scene key={`${room.id}:${visit}`} root={room} ctx={ctx} scope={`annex:${floor.id}:${room.id}`} onHome={home} />\n              </div>\n              <NpcQuests place={`annex:${floor.id}:${room.id}`} />\n"],
    ],
  },
  {
    file: 'ui/components/locations/Hike.jsx',
    edits: [
      ["import { HIKE_PATHS, hikeSpotKey, OUTSIDE_GUIDE_LINES } from '../../../game/hike'", "import { HIKE_PATHS, hikeSpotKey, OUTSIDE_GUIDE_LINES } from '../../../game/hike'\nimport NpcQuests from '@story/NpcQuests.jsx'"],
      ["          <Scene key={`${spot.id}:${visit}`} root={spot} ctx={ctx} scope={hikeSpotKey(pathId, spot.id, branchId)} onHome={home} renderWidget={renderWidget} />\n", "          <Scene key={`${spot.id}:${visit}`} root={spot} ctx={ctx} scope={hikeSpotKey(pathId, spot.id, branchId)} onHome={home} renderWidget={renderWidget} />\n          <NpcQuests place={hikeSpotKey(pathId, spot.id, branchId)} />\n"],
    ],
  },
  // ── vC.05 막기: 1d(호전)이 아니라 1d(인내)만큼 더 막는다. 반격(호전이 상대 공격력보다 높을 때 · 최대 굴림일 때)의 세기는 그대로 호전으로 굴린다 ──
  {
    file: 'game/battle.js',
    edits: [
      ["guard: { label: '막기', note: '약공 절반 · 강공 1/3만 받고, 1d(호전)만큼 더 막는다.' },", "guard: { label: '막기', note: '약공 절반 · 강공 1/3만 받고, 1d(인내)만큼 더 막는다. (호전이 상대 공격력보다 높거나 최대로 막으면 1d호전×2 반격)' },"],
      ["      const extraD = die(stats.aggression, rng)\n      dmg = Math.max(0, reduced - extraD)\n      const strong = stats.aggression > enemy.atk\n      const crit = extraD === stats.aggression",
       "      const blockD = die(Math.max(1, Math.floor(stats.endurance || 0)), rng) // vC.05 더 막는 양 = 1d(인내)\n      dmg = Math.max(0, reduced - blockD)\n      const strong = stats.aggression > enemy.atk\n      const crit = blockD === Math.max(1, Math.floor(stats.endurance || 0))\n      const extraD = die(stats.aggression, rng) // 반격의 세기는 호전"],
    ],
  },
  // ── vC.02 육조 스탯 만렙 40(무구 · 칭호 · 음식 보정은 따로 얹힌다). 이미 40을 넘긴 기록은 들어올 때 40으로 맞춰진다(progress.js). ──
  { file: 'game/constants.js', edits: [["export const STAT_MAX = 50 //", "export const STAT_MAX = 40 //"]] },
  // ── vB.04 하루 영력 전투 3번(모든 전투 통틀어) · 냥은 제한 없음 ──
  {
    file: 'game/progress.js',
    edits: [
      ["  if (g.wins >= GYM_DAILY_REWARDS) return { player: { ...player, gym: g }, granted: 0, lost: 0 }",
       "  if (g.wins >= GYM_DAILY_REWARDS) return { player: { ...player, money: player.money + reward, gym: g }, granted: 0, money: reward, lost: 0 } // vB.04: 영력은 하루 3번까지, 냥은 언제나"],
      ["    granted: reward,\n    lost: 0,", "    granted: reward,\n    money: reward,\n    lost: 0,"],
      ["${r.granted ? ` 영력 +${r.granted}, 돈 +${r.granted}냥.` : ' (오늘의 보상은 모두 받았다)'}`,", "${r.granted ? ` 영력 +${r.granted}, 돈 +${r.granted}냥.` : ` 돈 +${r.money || 0}냥. (오늘 전투로 얻는 영력 3번은 모두 받았다)`}`,"],
    ],
  },
  {
    file: 'game/huntField.js',
    edits: [
      ["import { SPIRIT_BASELINE_MAX } from './constants.js'", "import { SPIRIT_BASELINE_MAX } from './constants.js'\nimport { spiritWinsLeft as __left, countSpiritWin as __count } from '@story/spiritCap.js'"],
      ["  const gain = win ? Math.max(0, Math.min(s.encounter.rewardSpirit ?? 20, SPIRIT_BASELINE_MAX - player.spirit)) : 0",
       "  const __capped = win && __left(player, now) <= 0 // vB.04: 개척 중 조우도 하루 영력 3번에 함께 센다\n  const gain = win && !__capped ? Math.max(0, Math.min(s.encounter.rewardSpirit ?? 20, SPIRIT_BASELINE_MAX - player.spirit)) : 0"],
      ["`${enemyName}를 물리쳤다. 영력 +${gain}${itemList", "`${enemyName}를 물리쳤다. ${__capped ? '(오늘 전투로 얻는 영력 3번은 모두 받았다)' : `영력 +${gain}`}${itemList"],
      ["  let next = { ...player, spirit: player.spirit + gain,", "  let next = { ...(gain > 0 ? __count(player, now) : player), spirit: player.spirit + gain,"],
    ],
  },
  {
    file: 'game/hunt.js',
    edits: [
      ["// 수렵 시스템(산 탐사). 채집과 마찬가지로 20분을 기다리면 결과가 정해진다.", "import { spiritWinsLeft as __left, countSpiritWin as __count } from '@story/spiritCap.js'\n// 수렵 시스템(산 탐사). 채집과 마찬가지로 20분을 기다리면 결과가 정해진다."],
      ["  const spiritGain = enemy.reward.spirit ?? 0\n", "  const __capped = __left(rest, now) <= 0 // vB.04: 수렵 승리도 하루 영력 3번에 함께 센다\n  const spiritGain = __capped ? 0 : enemy.reward.spirit ?? 0\n  if (__capped && (enemy.reward.spirit ?? 0) > 0) gained.push('영력 없음(오늘 3번을 모두 받았다)')\n"],
      ["  return { player: { ...rest, inventory: inv, spirit }, logs: [text] }", "  return { player: { ...(spiritGain > 0 ? __count(rest, now) : rest), inventory: inv, spirit }, logs: [text] }"],
    ],
  },
  {
    file: 'ui/components/locations/Battle.jsx',
    edits: [
      ["쓰러진 {b.enemy.name}의 영력과 돈이 흘러든다. (영력 +{b.enemy.reward}, 돈 +{b.enemy.reward}냥) (하루 {rewardLeft <= 0 ? '보상 소진' : '보상 한도 내'})", "쓰러진 {b.enemy.name}의 돈이 흘러든다. (돈 +{b.enemy.reward}냥 · 영력 +{b.enemy.reward}은 하루 3번의 승리까지만 — 오늘 남은 횟수 {rewardLeft}번)"],
      ["오늘 영력을 얻는 승리는 <b className=\"text-gold\">{rewardLeft}회</b> 남았다.", "오늘 전투로 영력을 얻는 승리는 <b className=\"text-gold\">{rewardLeft}회</b> 남았다(퇴마 실습 · 추가전투 · 개척을 통틀어 하루 3번). 돈은 이길 때마다 받는다."],
    ],
  },
  {
    file: 'ui/components/locations/MultiBattle.jsx',
    edits: [
      ["(영력 +{enemy.reward}, 하루 보상 한도 안에서)", "(돈 +{enemy.reward}냥 · 영력 +{enemy.reward}은 하루 3번의 승리까지만)"],
    ],
  },
  // ── vB.03 적의 영능력 빼앗기: 빼앗은 영능력(steal-…)을 영능력 목록에 붙이고, 쓰면 stolenTurn 이 처리한다 ──
  {
    file: 'game/battle.js',
    edits: [
      ["import { BESTIARY } from './bestiary.js'", "import { BESTIARY } from './bestiary.js'\nimport { stolenPsychics, STEAL_PREFIX } from '@story/steal.js'\nimport { stolenTurn as __stolenTurn, bryHead as __bryHead } from '@story/steal-turn.js'\nexport { __bryHead as bryHead }"],
      ["  special: { label: '영능력', note: '상대마다 다른 비기.' },", "  special: { label: '영능력', note: '상대마다 다른 비기.' },\n  stun: { label: '행동불능', note: '몸이 묶여 아무것도 하지 못한다.' },"],
      // 상대 차례의 머리(혼자 싸울 때): 스며드는 피해 · 행동불능 · 영능력 봉인
      ["  let intent0 = s.queue[0]\n", "  let intent0 = s.queue[0]\n  if (solo) { const __h = __bryHead(s.es, intent0, s.ehp, s.enemy.name); s.es = __h.es; s.ehp = __h.ehp; for (const __t of __h.notes) ev.push({ kind: 'warn', text: __t }); if (__h.intent !== intent0) { intent0 = __h.intent; s.queue[0] = intent0 } } else if (intent0 === 'stun') { intent0 = 'none'; s.queue[0] = 'none' }\n"],
      ["\n]\n\n/** 상시 발동(패시브) 영능력", "\n  ...stolenPsychics(ALL_ENEMIES),\n]\n\n/** 상시 발동(패시브) 영능력"],
      ["  // 언어장벽 2단계: 이미 20턴을 간파한 상태에서", "  if (String(id).startsWith(STEAL_PREFIX)) return __stolenTurn(state, s, id, ctx, rng, stats, mpNow0, { PSYCHICS, mpCostOf, maxHp, attackRoll, atkMult, STAT6, INTENTS, rollIntent, CHARMS })\n  // 언어장벽 2단계: 이미 20턴을 간파한 상태에서"],
    ],
  },
  {
    file: 'game/mbattle.js',
    edits: [
      ["  if (a === 'psychic' && !PSYCHIC_IDS.includes(act.psychic)) return { error: 'bad-psychic' }", "  if (a === 'psychic' && !PSYCHIC_IDS.includes(act.psychic) && !String(act.psychic).startsWith('steal-')) return { error: 'bad-psychic' }"],
      ["    members: mb.members.map((m) => ({\n      id: m.id,\n      name: m.name,\n      agility: m.stats.agility,", "    members: mb.members.map((m) => ({\n      id: m.id,\n      name: m.name,\n      spiritStolen: m.spiritStolen || 0,\n      agility: m.stats.agility,"],
      ["import { enemyById, effectHitsAll,", "import { bryHead as __bryHead } from '@story/steal-turn.js'\nimport { enemyById, effectHitsAll,"],
      ["  const gim = bossGimmick(mb, mb.queue[0])\n  let intent = gim.intent\n", "  const gim = bossGimmick(mb, mb.queue[0])\n  let intent = gim.intent\n  { const __h = __bryHead(mb.es, intent, mb.ehp, mb.enemy.name); mb.es = __h.es; mb.ehp = __h.ehp; intent = __h.intent; for (const __t of __h.notes) evs.push(...addLog(mb, [{ kind: 'warn', text: __t }], 'enemy')) } // vC.01\n"],
      ["    if (r.earthReduction != null) mb.earthReduction", "    if (r.spiritSteal) m.spiritStolen = (m.spiritStolen || 0) + r.spiritSteal // vC.01 앗아온 영력은 사람마다 모았다가 끝날 때 준다\n    if (r.splash) for (const __o of mb.members) if (__o.id !== m.id && __o.status === 'alive' && __o.php > 1) __o.php = Math.max(1, __o.php - r.splash) // vC.01 화염파: 아군도 함께 맞는다\n    if (r.earthReduction != null) mb.earthReduction"],
      ["  m.mp = Math.max(0, m.mp - (r.mpCost || 0))\n  if (r.selfMpRestoration)", "  m.mp = Math.max(0, Math.min(m.mpMax, m.mp - (r.mpCost || 0))) // vB.03: 빼앗은 영능력은 의지력을 되찾기도 한다(최대치까지)\n  if (r.selfMpRestoration)"],
    ],
  },
  {
    file: 'game/progress.js',
    edits: [
      ["import { enemyById } from './battle.js'", "import { enemyById, PSYCHICS as __PSY } from './battle.js'\nimport { noteKill as __noteKill } from '@story/steal.js'"],
      ["  return { player: questEvent(r.player, { type: 'kill', id: enemy.id }, now), logs } // v-B.18", "  const __st = __noteKill(questEvent(r.player, { type: 'kill', id: enemy.id }, now), enemy, Math.random, __PSY) // vB.03 느린 싸움 승리도 빼앗기 횟수에 센다\n  return { player: __st.player, logs: [...logs, ...__st.logs] } // v-B.18"],
    ],
  },

  // ── vB.01 수업 랭킹: 서버(Supabase bry_rank)에 잇는다. 서버가 없으면 null 을 돌려 '연결되지 않음'을 보여 준다(예전엔 빈 화면으로 멈췄다) ──
  {
    file: 'ui/adapters/online.js',
    edits: [
      ['export const fetchRanking = notConnected()', "export const fetchRanking = async (course, pid, week) => (globalThis.__BRY_RANK ? globalThis.__BRY_RANK.fetch(course, pid, week) : null)"],
      ['export const startRankedSession = notConnected()', "export const startRankedSession = async () => (globalThis.__BRY_RANK?.live() ? { ok: true, sid: 'bry', seed: Math.floor(Math.random() * 2 ** 31) } : null)"],
      ['export const submitScore = notConnected()', "export const submitScore = async (course, _key, name, score) => (globalThis.__BRY_RANK ? globalThis.__BRY_RANK.submit(course, name, score) : NOT_CONNECTED)"],
    ],
  },
  {
    file: 'ui/components/RankingPanel.jsx',
    edits: [
      ["  if (data === null)\n", "  if (data === null || !Array.isArray(data?.top))\n"],
    ],
  },
  // ── v1.9.7 가방의 [중요한 아이템] 칸: 본편 이야기에서 받은 물건(태그 '중요한 아이템')만 따로 모은다.
  //    소지품 칸을 차지하지 않고, 버리거나 가방에 넣을 수 없다. 마우스를 올리면 획득처(도감 자료)를 보여 준다. ──
  {
    file: 'game/inventoryCapacity.js',
    edits: [
      ["  total + (Number.isFinite(quantity) && quantity > 0 ? Math.ceil(quantity / maxStack(id)) : 0), 0)", "  total + (Number.isFinite(quantity) && quantity > 0 && !itemOf(id)?.tags?.includes('중요한 아이템') ? Math.ceil(quantity / maxStack(id)) : 0), 0)"],
    ],
  },
  {
    file: 'ui/components/InventoryModal.jsx',
    edits: [
      ["  const allStacks = owned.flatMap(item =>", "  const keyItems = owned.filter((it) => it.tags?.includes('중요한 아이템'))\n  const allStacks = owned.filter((it) => !it.tags?.includes('중요한 아이템')).flatMap(item =>"],
      ["          </ul>\n          {trusted.mode === 'verified' &&", "          </ul>\n          <p className=\"mt-4 text-[11px] tracking-widest text-paper/55\" data-key-items-label>중요한 아이템 <span className=\"tracking-normal text-paper/40\">· 본편 이야기에서 받은 물건 — 칸을 차지하지 않는다</span></p>\n          {keyItems.length === 0 ? <p className=\"mt-2 text-xs text-paper/45\">아직 없다.</p> : <ul className=\"mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5\" aria-label=\"중요한 아이템\" data-key-items>\n            {keyItems.map((item) => (\n              <li key={`key:${item.id}`}>\n                <button type=\"button\" data-item={item.id} onMouseEnter={(event) => tipFor(item, event)} onMouseMove={(event) => tipFor(item, event)} onMouseLeave={() => setHover(null)}\n                  onClick={() => { setErr(''); setTargeting(false); setSel(item.id); setSelectedStack(null); setDiscardQty(1) }}\n                  aria-label={`${displayName(item)} ×${countOf(player, item.id)}`} className=\"tilt flex w-full flex-col items-center gap-1 rounded-xl border border-gold/35 bg-gold-fill/[0.06] p-2 hover:bg-gold-fill/15\">\n                  <ItemIcon item={item} size={40} className=\"shrink-0\" />\n                  <span className=\"w-full truncate text-center text-[11px] text-paper\">{displayName(item)}</span>\n                  <span className=\"text-[11px] text-gold\">×{countOf(player, item.id)}</span>\n                </button>\n              </li>\n            ))}\n          </ul>}\n          {trusted.mode === 'verified' &&"],
      ["                {picked && picked.id !== BAG_ID && bags > 0 && !inBattle && onBag && (", "                {picked && picked.id !== BAG_ID && !picked.tags?.includes('중요한 아이템') && bags > 0 && !inBattle && onBag && ("],
      ["                {picked && !inBattle && <button type=\"button\" onClick={() => setDiscardConfirm(true)}", "                {picked && !inBattle && !picked.tags?.includes('중요한 아이템') && <button type=\"button\" onClick={() => setDiscardConfirm(true)}"],
      ["<p>{hover.item.obtain || '취득 경로 미정'}</p>", "<p>{hover.item.obtain || globalThis.BIRYEONG_CODEX?.items?.find((x) => x.id === hover.item.id)?.from || '아직 알려진 곳이 없다'}</p>"],
    ],
  },
  // ── v1.9.5 본편 3인 전투: 도감에 없는 이야기 상대는 판(view.enemy)이 보내 준 상대를 쓴다 ──
  {
    file: 'ui/components/locations/MultiBattle.jsx',
    edits: [
      ["  const enemy = enemyById(view.enemyId)", "  const enemy = view.enemy ?? enemyById(view.enemyId)"],
      ["                  상대 고르기\n", "                  닫기\n"],
    ],
  },
  // ── v1.9.5 튜토리얼: 허수아비 체력을 크게 두고 누구도 1 밑으로 떨어지지 않게(되살리기 연출 없음). 마지막 한 방(finisher)에서만 쓰러진다. #3 소지품은 오른쪽 아래 [소지품] ──
  {
    file: 'game/battleTutorial2.js',
    edits: [
      ["  hp: 46,", "  hp: 9999,"],
      ["  hp: 70,", "  hp: 9999,"],
      ["  hp: 90,", "  hp: 9999,"],
    ],
  },
  {
    file: 'ui/components/BattleTutorial2.jsx',
    edits: [
      ["    if (st.ehp <= 0 || st.php <= 0 || st.over) {\n      const ehpFloor = Math.max(1, Math.ceil((st.enemy?.hp ?? 10) * 0.35))\n      const phpFloor = Math.max(1, Math.ceil((st.phpMax ?? 100) * 0.5))\n      return { ...st, ehp: Math.max(st.ehp, ehpFloor), php: Math.max(st.php, phpFloor), over: false }\n    }", "    if (st.ehp <= 0 || st.php <= 0 || st.over) {\n      // 비령: 되살리지 않는다 — 허수아비 체력이 아주 많고, 누구도 1 밑으로는 내려가지 않을 뿐이다.\n      return { ...st, ehp: Math.max(st.ehp, 1), php: Math.max(st.php, 1), over: false }\n    }"],
      ["      const r = fireTurn(bRef.current, { stats, mp: mpRef.current, boost: false }, Math.random)\n      const wasFinished = r.state?.over || r.state?.ehp <= 0 || r.state?.php <= 0\n      setB(clampAlive(r.state))\n      pushLog(filterEndLog(r.events, wasFinished))", "      const kill = !!step.finisher // 비령: 마지막 한 방에서는 허수아비를 정말 쓰러뜨린다\n      const r = fireTurn(kill ? { ...bRef.current, ehp: 1 } : bRef.current, { stats, mp: mpRef.current, boost: false }, Math.random)\n      const wasFinished = r.state?.over || r.state?.ehp <= 0 || r.state?.php <= 0\n      setB(kill && r.state?.ehp <= 0 ? { ...r.state, php: Math.max(1, r.state.php) } : clampAlive(r.state))\n      pushLog(kill ? r.events : filterEndLog(r.events, wasFinished))"],
      ["'모바일 기준 상단, PC/탭 기준 왼쪽 하단에 \\'내 소지품 확인하기\\' 버튼이 있어요. 지금 저기를 직접 한 번 눌러 보실래요?'", "'화면 오른쪽 아래(모바일은 아래쪽 상태 창)에 \\'소지품\\' 버튼이 있어요. 지금 저기를 직접 한 번 눌러 보실래요? 소지품 창이 열리면 닫고 돌아오세요.'"],
      ["    { auto: 'enemy' },\n    { auto: 'fire' },\n    { face: 'guide', lines: ['한 방이 묵직하고 좋죠?", "    { auto: 'enemy' },\n    { auto: 'fire', finisher: true },\n    { face: 'guide', lines: ['한 방이 묵직하고 좋죠?"],
      ["          m.pendingDeath = false\n          m.php = Math.max(1, Math.ceil(m.phpMax * 0.5))\n          m.status = 'alive'", "          m.pendingDeath = false\n          m.php = 1\n          m.status = 'alive'"],
      ["      if (m.php <= 0) m.php = Math.max(1, Math.ceil(m.phpMax * 0.5))", "      if (m.php <= 0) m.php = 1"],
      ["    if (mb.ehp <= 0 || mb.over || mb.ehp > mb.enemy.hp) {\n      mb.ehp = Math.max(1, Math.min(mb.enemy.hp, Math.ceil(mb.enemy.hp * 0.35)))", "    if (mb.killed) return // 비령: 마무리 한 방으로 정말 쓰러졌다\n    if (mb.ehp <= 0 || mb.over || mb.ehp > mb.enemy.hp) {\n      mb.ehp = Math.max(1, Math.min(mb.enemy.hp, mb.ehp))"],
      ["    if (mb) mb.ehp = Math.max(mb.ehp, 999_999)", "    if (mb) mb.ehpBefore = mb.ehp // 비령: 허수아비 체력이 넉넉해 덮어 둘 필요가 없다"],
      ["      preserveEnemyHp(mb)\n      const evs = resolveTurn(mb, Math.random)\n      clampMB(mb)\n      announceAllyPsychic(evs)", "      preserveEnemyHp(mb)\n      if (step.finisher) mb.ehp = 1 // 비령: 마지막 한 방에서는 정말 쓰러뜨린다\n      const evs = resolveTurn(mb, Math.random)\n      if (step.finisher && mb.ehp <= 0) { mb.killed = true; mb.ehp = 0; for (const m of mb.members) { if (m.php <= 0) m.php = 1; m.status = 'alive' } }\n      clampMB(mb)\n      announceAllyPsychic(evs)"],
      ["    { face: 'guide-surprise', lines: ['드디어 다 모았어요 — 터뜨려 볼게요!'], auto: 'guide' },", "    { face: 'guide-surprise', lines: ['드디어 다 모았어요 — 터뜨려 볼게요!'], auto: 'guide', finisher: true },"],
    ],
  },
  // ── v1.9.1 급식실 익명 사연: 서버(Supabase)에 잇는다(globalThis.__BRY_CAFE — auth.js). 투고하면 검토 없이 바로 실리고, 쓴 본인과 관리자가 뗄 수 있다 ──
  {
    file: 'ui/adapters/online.js',
    edits: [
      ['export const fetchNewspaper = notConnected()', "export const fetchNewspaper = async (date) => (globalThis.__BRY_CAFE ? globalThis.__BRY_CAFE.fetch(date) : { ok: false, error: 'not-connected' })"],
      ['export const submitStory = notConnected()', "export const submitStory = async (body) => (globalThis.__BRY_CAFE ? globalThis.__BRY_CAFE.submit(body) : { ok: false, error: 'not-connected' })"],
    ],
  },
  {
    file: 'ui/components/locations/Cafeteria.jsx',
    edits: [
      ["setNote({ ok: true, text: '투고함에 넣었어요. 관리자가 살펴보고 신문에 올릴지 정해요. (쓴 사람은 알려지지 않아요)' })\n      onSubmitted?.()", "setNote({ ok: true, text: '오늘 자 신문에 바로 실렸어요. (쓴 사람은 아무에게도 알려지지 않아요)' })\n      onSubmitted?.()\n      load()"],
      ["} else setNote({ ok: false, text: ERR[r.error] ?? '투고하지 못했어요.' })", "} else setNote({ ok: false, text: ERR[r.error] ?? r.message ?? '투고하지 못했어요.' })"],
      ['아무 이야기나 적어 넣어 보세요. 관리자가 확인해서 신문에 올려요. 쓴 사람은 알려지지 않고, #1, #2, #3 순서로만 실려요.', '아무 이야기나 적어 넣어 보세요. 투고하면 바로 오늘 자 신문에 실려요. 쓴 사람은 아무에게도 알려지지 않고, #1, #2, #3 순서로만 실려요.'],
      ["'slow-down': '잠시 후에 다시 투고해 주세요. (1시간에 5건까지)',", "'slow-down': '잠시 후에 다시 투고해 주세요. (하루 30건까지)',"],
      ['<p className="text-xs font-bold text-gold">{s.title || `#${s.no}`}</p>', '<p className="flex items-center justify-between text-xs font-bold text-gold"><span>{s.title || `#${s.no}`}{s.mine ? \' · 내가 쓴 사연\' : \'\'}</span>{(s.mine || globalThis.__BRY_CAFE?.admin()) && <button type="button" data-story-remove className="flat-btn-ghost text-[11px]" onClick={() => { if (window.confirm(\'이 사연을 신문에서 뗄까요?\')) globalThis.__BRY_CAFE.remove(s.id).then(load) }}>{s.mine ? \'떼기\' : \'떼기(관리자)\'}</button>}</p>'],
    ],
  },
  // ── v1.3 본편 새 아이템: 보관고 아이템 목록 뒤에 붙인다(story-items.txt → reskin.data.js) ──
  {
    file: 'game/items.js',
    edits: [
      ["import { V79_SHEET_DATA } from './v79SheetData.js'", "import { V79_SHEET_DATA } from './v79SheetData.js'\nimport { STORY_ITEMS as __STORY_ITEMS, NEW_ITEMS as __NEW_ITEMS } from '@biryeong/reskin.data.js'\nimport { AIL_ITEMS as __AIL_ITEMS } from '@story/ailments.js'"],
      ['export const ITEMS = RAW_ITEMS.map((original) => {', 'export const ITEMS = [...RAW_ITEMS, ...__STORY_ITEMS, ...__NEW_ITEMS, ...__AIL_ITEMS].map((original) => {'],
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
  // ── v1.8 본편: 소지품에서 [조사한다] — 본편이 '조사하라'고 한 물건에만 단추가 생긴다 ──
  {
    file: 'ui/components/InventoryModal.jsx',
    edits: [
      // (v1.9.7 묶음이 먼저 '버리기' 줄에 중요한 아이템 조건을 붙였으므로 그 줄 앞에 끼운다)
      ["                {picked && !inBattle && !picked.tags?.includes('중요한 아이템') && <button type=\"button\" onClick={() => setDiscardConfirm(true)}",
       "                {picked && !inBattle && globalThis.__BRY_INSPECT?.can(picked.id) && <button type=\"button\" data-inspect onClick={() => { const id = picked.id; closeAll(); globalThis.__BRY_INSPECT.run(id) }} className=\"flat-btn !py-1 text-xs\">조사한다</button>}\n                {picked && !inBattle && !picked.tags?.includes('중요한 아이템') && <button type=\"button\" onClick={() => setDiscardConfirm(true)}"],
    ],
  },
  // ── v1.6 붉은여우 부적: 다인 전투에서 다른 일행이 가진 영능력을 한 번 빌려 쓴다(의지력은 똑같이 든다) ──
  {
    file: 'game/mbattle.js',
    edits: [
      ["  // 초보용 고독: 앞으로 3라운드 적이 받는 피해 +20% (보스 포함).\n  if (e.enemyVulnerability) {",
       "  if (e.borrowPsychic) {\n    if (!mb.members.some((x) => x.id !== m.id && x.status === 'alive' && x.psychics?.length)) return { error: '영능력을 빌릴 일행이 없다.' }\n    m.borrowPsychic = (m.borrowPsychic || 0) + e.borrowPsychic\n    addLog(mb, [{ kind: 'info', text: `${m.name}의 붉은여우 부적! 이번 전투에서 일행의 영능력을 한 번 빌려 쓸 수 있다.` }], m.id)\n    return { ok: true }\n  }\n  // 초보용 고독: 앞으로 3라운드 적이 받는 피해 +20% (보스 포함).\n  if (e.enemyVulnerability) {"],
      ["  if (a === 'psychic' && mb.enemy.boss && Array.isArray(m.psychicBring) && !m.psychicBring.includes(act.psychic)) return { error: 'not-brought' }",
       "  const __borrow = a === 'psychic' && (m.borrowPsychic || 0) > 0 && !(m.psychics || []).includes(act.psychic) && mb.members.some((x) => x.id !== m.id && x.status === 'alive' && (x.psychics || []).includes(act.psychic))\n  if (a === 'psychic' && !__borrow && mb.enemy.boss && Array.isArray(m.psychicBring) && !m.psychicBring.includes(act.psychic)) return { error: 'not-brought' }"],
      ["    target: a === 'psychic' && ['karmic-recompense', 'echo-form', 'warding-scripture'].includes(act.psychic) && typeof act.target === 'string' ? act.target : undefined,\n  }\n  return { ok: true }",
       "    target: a === 'psychic' && ['karmic-recompense', 'echo-form', 'warding-scripture'].includes(act.psychic) && typeof act.target === 'string' ? act.target : undefined,\n  }\n  if (__borrow) { m.borrowPsychic -= 1; m.act.borrowed = true; addLog(mb, [{ kind: 'info', text: `[${m.name}] 일행의 영능력을 빌려 쓴다.` }], m.id) }\n  return { ok: true }"],
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
  // 같은 파일에 묶음이 여럿이면 적힌 차례대로 모두 끼운다(앞 묶음만 쓰고 뒤를 건너뛰지 않는다).
  for (const p of SOURCE_PATCHES.filter((x) => relPath.replace(/\\/g, '/').endsWith(x.file))) {
    for (const [find, put] of p.edits) {
      const n = text.split(find).length - 1
      if (n !== 1) throw new Error(`보관고 조각을 끼울 자리를 찾지 못했다 (${p.file}, ${n}곳): ${find.slice(0, 60)}`)
      text = text.replace(find, () => put)
    }
  }
  if (relPath.replace(/\\/g, '/').endsWith('ui/components/BattleTutorial2.jsx')) text = tutorVoice(text)
  return text
}

/**
 * vC.01 튜토리얼 진행자를 「훈련관」으로: 이름 · 얼굴(단색 원) · 말투.
 * 말은 내용은 그대로 두고 본편의 훈련관 말투로 다시 쓴 것(systems/biryeong/tutor-lines.json, 원문과 같은 차례 88줄)으로 한 줄씩 바꾼다.
 */
function tutorVoice(text) {
  const lines = JSON.parse(readFileSync(new URL('../biryeong/tutor-lines.json', import.meta.url), 'utf8'))
  let i = 0
  text = text.replace(/lines:\s*\[([\s\S]*?)\](?=\s*[,}])/g, (whole, body) => whole.replace(body, () => body.replace(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g, () => {
    const t = lines[i++]
    if (t == null) throw new Error('튜토리얼 대사 수가 원문보다 적다 (tutor-lines.json)')
    return t.includes('${') ? '`' + t.replace(/`/g, '\\`') + '`' : JSON.stringify(t)
  })))
  if (i !== lines.length) throw new Error(`튜토리얼 대사 수가 맞지 않는다: 원문 ${i}줄 · 새 글 ${lines.length}줄`)
  const img = '<img src={FACE_SRC[face] ?? FACE_SRC.guide ?? undefined} alt={npcName(GUIDE)} className="npc-portrait size-14 shrink-0 rounded-xl bg-edge/10 object-cover object-top sm:size-16" draggable={false} />'
  if (text.split(img).length !== 2) throw new Error('튜토리얼 얼굴 자리를 찾지 못했다')
  text = text.replace(img, () => '<span data-tutor-face aria-hidden="true" className="size-14 shrink-0 rounded-full sm:size-16" style={{ background: \'#b8643c\', borderRadius: \'50%\', boxShadow: \'0 0 0 2px #0b1522, 0 0 0 3px #c9a961\' }} />')
  if (!text.includes('npcName(GUIDE)')) throw new Error('튜토리얼 진행자 이름 자리를 찾지 못했다')
  text = text.split("{npcName(GUIDE)}이(가) 직접 플레이로").join("훈련관이 직접 플레이로").split('npcName(GUIDE)').join("'훈련관'")
  return text
}
