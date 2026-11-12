// 비령 play — 플레이어 상태와 처리 함수.
//
// 초록동색 C.01 의 Game.jsx 가 하던 일(플레이어 상태 보관 · 1초 틱 · 전투/개척/제작/수업/매점… 처리)을
// 서버 · 퀘스트 · 동아리 · 다인 전투 없이 옮겨 온 것이다. 규칙 계산은 전부 보관고의 game 모듈을 그대로 쓴다.
// 새 화면을 붙일 때는 여기 handlers 에서 필요한 처리 함수를 꺼내 쓰면 된다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPlayer } from '@vault/game/character.js'
import { ENH_STATS, canUseItem, isHuntItem, enhanceWeapon, exchangeGoblinTokens, specialEnhanceWeapon, removeWeaponSpecial, discardInventoryItem, giveWeapon, migrateWeapons, equipItem, equipOf, isStoreOpen, itemOf, unequipSlot, trinketFx, breakTrinket } from '@vault/game/items.js'
import { cancelCraft, recipeOf, startCraft, buyRecipe as buyRecipeAt } from '@vault/game/crafting.js'
import { cook } from '@vault/game/cooking.js'
import { markLineSeen } from '@vault/game/npcLines.js'
import { canAddInventory, claimPending, limitNewGains } from '@vault/game/inventoryCapacity.js'
import { protectBags, putInBag, takeFromBag } from '@vault/game/bag.js'
import { STAT_KEYS, STAT_META, STAT_MAX, STAT_UPGRADE_COST_PER_POINT } from '@vault/game/constants.js'
import { LESSON_WAIT_MINUTES } from '@vault/game/courseInfo.js'
import { enemyById } from '@vault/game/battle.js'
import { SKINS, isSkinOpen } from '@vault/game/skins2048.js'
import { SKINS_RUNNER, isRunnerSkinOpen } from '@vault/game/skinsRunner.js'
import { bumpWeekly, bumpDaily, questEvent } from '@vault/game/activityCounters.js'
import { buyGardenSeed, plantGardenSeed, harvestGardenPlot } from '@vault/game/garden.js'
import { HUNT_SITES } from '@vault/game/huntSites.js'
import { enterHuntSite, moveOnHunt, attemptHunt, leaveHuntSite, resolveHuntEncounter, useHuntItem } from '@vault/game/huntField.js'
import { touchesBattleState } from '@vault/game/battleItems.js'
import { openSomeonesBag } from '@vault/game/exploreActions.js'
import { sellItem } from '@vault/game/sell.js'
import { benchCraft, knownCraft, markMade } from '@vault/game/freeCraft.js'
import { ACHIEVEMENTS } from '@vault/game/achievements.js'
import {
  GYM_DAILY_REWARDS, applyBattleResult, cancelWaits, completeLesson, courseTitle, gymToday, lessonOf, pickFortuneStat,
  sanitizeRestored, clampSpirit, spendAttempt, startTraining, startWait, tickPlayer, startRest, startSleep, markNpc, syncCodex,
  REST_KINDS, acquirePsychic, effectiveStats, startSlowFight, cancelSlowFight, slowFightMinutes, WEAK_MS, cancelGather, cancelHunt,
} from '@vault/game/progress.js'
import { readSave, writeHost } from './store.js'
import { bridge } from './bridge.js'

const LOG_MAX = 80
const stamp = () => new Date().toTimeString().slice(0, 8)
const josa = (word, pair) => {
  const c = String(word).slice(-1).charCodeAt(0) - 0xac00
  const b = c >= 0 && c <= 11171 ? c % 28 : 0
  return word + (b ? pair[0] : pair[1])
}

/** 메인 화면의 내 프로필 → 초록동색 규칙의 캐릭터 */
function playerFromProfile(profile) {
  return syncCodex(createPlayer({ name: profile.name, age: Number.parseInt(profile.age, 10) || 17, avatar: null, stats: profile.stats, greeting: profile.intro ?? '' }))
}

export function usePlayHost() {
  const first = useMemo(() => readSave(), [])
  const profile = first.profile ?? null
  const [player, setPlayerState] = useState(() => {
    if (!profile) return null
    const restored = first.game ? sanitizeRestored(first.game, first.game.createdAt) : playerFromProfile(profile)
    // 이름 · 한줄소개는 메인 화면의 프로필을 따른다.
    return { ...restored, name: profile.name, greeting: profile.intro ?? '' }
  })
  const playerRef = useRef(player)
  playerRef.current = player
  const countsRef = useRef({ ...(first.counts ?? {}) })
  const [logs, setLogs] = useState(() => (Array.isArray(first.playLog) ? first.playLog.slice(-LOG_MAX) : []))
  const logsRef = useRef(logs)
  logsRef.current = logs
  const [notice, setNotice] = useState(null) // 화면 위에 잠깐 뜨는 안내 { id, text }
  const [toasts, setToasts] = useState([]) // C.01 업적 달성 알림
  const [invOpen, setInvOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { text, run }

  // ── 저장 ──
  const saveTimer = useRef(null)
  const persist = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    if (!playerRef.current) return
    writeHost({ game: clampSpirit(playerRef.current), counts: countsRef.current, playLog: logsRef.current.slice(-LOG_MAX) })
    bridge.saved()
  }, [])
  const schedule = useCallback(() => { if (!saveTimer.current) saveTimer.current = setTimeout(persist, 250) }, [persist])
  useEffect(() => {
    const flush = () => persist()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); persist() }
  }, [persist])

  const bump = useCallback((key, n = 1) => { countsRef.current = { ...countsRef.current, [key]: (countsRef.current[key] || 0) + n }; schedule() }, [schedule])
  const peak = useCallback((key, v) => { if ((countsRef.current[key] || 0) < v) { countsRef.current = { ...countsRef.current, [key]: v }; schedule() } }, [schedule])
  /** 서로 다른 것의 수를 센다(counts.sets.<이름>.<키>). 업적의 { pset } 조건이 읽는다. */
  const collect = useCallback((setName, key) => {
    const sets = countsRef.current.sets ?? {}
    if (!key || sets[setName]?.[key]) return
    countsRef.current = { ...countsRef.current, sets: { ...sets, [setName]: { ...(sets[setName] ?? {}), [key]: true } } }
    schedule()
  }, [schedule])

  /** 모든 변경은 여기를 거친다(소지품 칸 수 · 가방 · 영력 상한을 마지막으로 지킨다). */
  const commit = useCallback((next) => {
    const prev = playerRef.current
    const safe = clampSpirit(protectBags(prev, limitNewGains(prev, next)))
    playerRef.current = safe
    setPlayerState(safe)
    peak('moneyPeak', Math.floor(safe.money || 0))
    peak('spiritPeak', Math.floor(safe.spirit || 0))
    peak('itemKinds', Object.keys(safe.inventory ?? {}).length)
    schedule()
    return safe
  }, [schedule, peak])

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), time: stamp(), message }].slice(-LOG_MAX))
    schedule()
  }, [schedule])
  const addLogs = useCallback((messages) => { (messages ?? []).filter(Boolean).forEach(addLog) }, [addLog])
  const notify = useCallback((text) => { bridge.toast('알림', text) }, [])

  // ── 1초 틱: 영력 회복 · 수련/휴식/수면 · 수업 대기 · 제작 ──
  useEffect(() => {
    if (!playerRef.current) return undefined
    let last = Math.max(Date.now() - 30 * 86400000, playerRef.current.savedAt ?? Date.now())
    let timer = null
    const tick = () => {
      const cur = playerRef.current
      const now = Date.now()
      const r = tickPlayer(cur, now, Math.max(0, (now - last) / 1000))
      last = now
      if (r.player !== cur) { const safe = clampSpirit(limitNewGains(cur, r.player)); playerRef.current = safe; setPlayerState(safe); schedule() }
      r.logs.forEach(addLog)
      if (r.unlocked?.length) setToasts((t) => [...t, ...r.unlocked.map((id) => ({ key: id + now, ach: ACHIEVEMENTS.find((a) => a.id === id) }))])
    }
    const loop = () => { tick(); timer = setTimeout(loop, 1000) }
    loop()
    return () => clearTimeout(timer)
  }, [addLog, schedule])

  // 종류 단위로 들어온 무구는 한 벌씩으로 정리한다(C.01 과 같다).
  useEffect(() => {
    const cur = playerRef.current
    if (!cur) return
    const fixed = migrateWeapons(cur)
    if (fixed !== cur) commit(fixed)
  }, [player?.inventory, commit])

  // ── 진행 중인 대기 활동 끊기 ──
  const interruptAll = useCallback((why) => {
    let p = playerRef.current
    const ended = []
    if (p.training) { p = { ...p, training: null }; ended.push('수련') }
    if (p.resting) { p = { ...p, resting: null }; ended.push('휴식') }
    if (p.sleeping) { p = { ...p, sleeping: null }; ended.push('잠') }
    const w = cancelWaits(p); if (w.ids.length) { p = w.player; w.ids.forEach((id) => ended.push(`${courseTitle(id)} 수업 대기`)) }
    if (p.crafting) { p = cancelCraft(p); ended.push('제작') }
    if (p.slowFight) { p = cancelSlowFight(p); ended.push('느린 싸움') }
    if (p.gathering) { p = cancelGather(p); ended.push('채집') }
    if (p.hunting) { p = cancelHunt(p); ended.push('수렵') }
    if (!ended.length) return
    commit(p)
    addLog(`${why} ${ended.join(' · ')}을(를) 멈췄다. (보상 없음)`)
  }, [commit, addLog])
  const busyLabel = (p) => (p.training ? '수련' : p.sleeping ? '잠' : p.resting ? '휴식' : Object.values(p.lessons ?? {}).some((l) => l.waitUntil) ? '수업 대기' : p.crafting ? '제작' : p.slowFight ? '느린 싸움' : null)
  /** 대기 활동 중이면 먼저 물어본다. */
  const guard = useCallback((run) => {
    const b = busyLabel(playerRef.current)
    if (b) setConfirm({ text: `지금 ${b} 중이다. 그만두고 진행할까? (보상은 받지 못한다)`, run: () => { interruptAll('새 동작을 시작해'); run() } })
    else run()
  }, [interruptAll])

  const battleRef = useRef(false)
  const afflictRef = useRef({ itemSeal: false, healBlock: false, downed: false })
  const [reviveOn, setReviveOn] = useState(false)
  const reviveRef = useRef(false); reviveRef.current = reviveOn
  const [boostOn, setBoostOn] = useState(false)
  const boostRef = useRef(false); boostRef.current = boostOn
  const [battleUsedItems, setBattleUsedItems] = useState([])
  const usedRef = useRef([]); usedRef.current = battleUsedItems
  const [soloItemFx, setSoloItemFx] = useState(null)
  const battleVitalsRef = useRef(null)
  const battleDownedRef = useRef(false)
  const battleScannedRef = useRef(false)
  const [battleActive, setBattleActive] = useState(false)

  const effStats = useMemo(() => (player ? effectiveStats(player) : null), [player])

  // ───── 수련 · 수면 · 휴식 ─────
  const beginTraining = (minutes) => guard(() => { bump('trainings'); const n = commit(startTraining(playerRef.current, minutes)); addLog(`기숙사에서 ${minutes}분 수련을 시작했다. (끝까지 마치면 영력 +${n.training.reward})`) })
  const endTraining = () => { if (!playerRef.current.training) return; commit({ ...playerRef.current, training: null }); addLog('스스로 멈춰 수련을 포기했다. (보상 없음)') }
  const beginSleep = () => guard(() => { bump('sleeps'); commit(startSleep(playerRef.current)); addLog('기숙사에서 잠들었다. (6시간 · 일어나면 체력과 의지력이 가득 찬다)') })
  const endSleep = () => { if (!playerRef.current.sleeping) return; commit({ ...playerRef.current, sleeping: null }); addLog('스스로 일어났다. (회복 없음)') }
  const beginRest = (kind, minutes) => guard(() => { commit(startRest(playerRef.current, kind, minutes)); addLog(`양호실에서 ${minutes}분 동안 ${REST_KINDS[kind].label}를 시작했다.`) })
  const endRest = () => { if (!playerRef.current.resting) return; commit({ ...playerRef.current, resting: null }); addLog('스스로 멈춰 휴식을 그만뒀다. (회복 없음)') }

  const upgradeStat = (key) => {
    const cur = playerRef.current
    const now = cur.stats[key]
    const cost = now * STAT_UPGRADE_COST_PER_POINT
    if (now >= STAT_MAX || cur.spirit < cost) return
    const done = commit({ ...cur, spirit: cur.spirit - cost, stats: { ...cur.stats, [key]: now + 1 } })
    bump('statUps'); peak('statMax', now + 1); peak('statSum', STAT_KEYS.reduce((a, k) => a + Math.floor(done.stats[k] || 0), 0)); peak('statMin', Math.min(...STAT_KEYS.map((k) => Math.floor(done.stats[k] || 0))))
    addLog(`${STAT_META[key].label}이(가) ${now} → ${now + 1}로 올랐다. (영력 -${cost})`)
  }

  // ───── 수업 ─────
  const lessonActions = useMemo(() => ({
    spendAttempt: (id) => { const next = spendAttempt(playerRef.current, id); if (!next) return false; commit(next); return true },
    complete: (id) => { const r = completeLesson(playerRef.current, id); if (!r.logs.length) return; commit(bumpDaily(bumpWeekly(r.player, 'lesson'), 'lesson')); r.logs.forEach(addLog); bump('lessons'); collect('courses', id) },
    wait: (id) => { const next = startWait(playerRef.current, id); if (!next) return; commit(next); addLog(`${courseTitle(id)}: 수업을 기다리기 시작했다. (${LESSON_WAIT_MINUTES}분)`) },
    pickStat: (key) => { const next = pickFortuneStat(playerRef.current, key); if (!next) return; commit(next); addLog(`점복학 보너스: ${STAT_META[key].label}이(가) 1 올랐다.`) },
  }), [commit, addLog, bump])
  const setSkin2048 = (id) => { const k = SKINS.find((x) => x.id === id); if (k && isSkinOpen(k, playerRef.current, false)) commit({ ...playerRef.current, skin2048: id }) }
  const setSkinRunner = (id) => { const k = SKINS_RUNNER.find((x) => x.id === id); if (k && isRunnerSkinOpen(k, playerRef.current, false)) commit({ ...playerRef.current, skinRunner: id }) }

  // ───── 매점 ─────
  const buyItem = (id, qty = 1) => {
    const item = itemOf(id); const cur = playerRef.current; const n = Math.max(1, Math.min(99, Math.floor(qty)))
    if (!item || item.price == null || cur.money < item.price * n || !isStoreOpen()) return
    if (!canAddInventory(cur.inventory, { [id]: n })) { addLog('소지품이 가득 찼다. 정리한 뒤 다시 사 줘.'); return }
    bump('buys', n)
    commit(bumpWeekly({ ...cur, money: cur.money - item.price * n, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + n } }, 'shopBuy'))
    addLog(`매점에서 ${item.name} ${n}개를 샀다. (-${item.price * n}냥)`)
  }
  const buyRecipe = (recipeId) => {
    if (!isStoreOpen()) return
    const r = buyRecipeAt(playerRef.current, recipeId, false)
    if (r.error) { addLog(r.error); return }
    commit(bumpWeekly(r.player, 'shopBuy'))
    addLog(`매점에서 [${itemOf(r.recipe.result)?.name ?? r.recipe.result}] 제작법을 익혔다. (-${r.recipe.price}냥)`)
  }
  const sellToStore = (itemId, qty) => { const r = sellItem(playerRef.current, itemId, qty); if (r.error) return r; bump('sells', r.qty); commit(r.player); addLog(`매점에 ${r.item.name} ${r.qty}개를 팔았다. (+${r.gained}냥)`); return r }

  // ───── 제작 · 조리 ─────
  const madeOne = (p, recipeId) => { bump('crafts'); collect('recipes', recipeId); return markMade(bumpDaily(bumpWeekly(p, 'craft'), 'craft'), recipeId) }
  const craftItem = (recipeId, qty = 1) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (cur.crafting) return { error: '이미 제작 중이다.' }
    const r = startCraft(cur, recipeId, qty, false)
    if (r.error) return r
    const done = commit(madeOne(r.player, recipeId))
    addLog(`공작소에서 ${r.item?.name ?? itemOf(recipeOf(recipeId)?.result)?.name ?? ''} ${r.qty}개를 제작했다.`)
    return { ...r, player: done }
  }
  const endCraft = () => { if (!playerRef.current.crafting) return; commit(cancelCraft(playerRef.current)); addLog('스스로 멈춰 제작을 멈췄다. (재료도 완성품도 돌아오지 않는다)') }
  const cookItem = (recipeId) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const r = cook(playerRef.current, recipeId, false)
    if (r.error) return r
    bump('cooks')
    const done = commit(madeOne(r.player, recipeId))
    addLog(`조리실에서 ${josa(r.item.name, ['을', '를'])} 만들었다.`)
    return { ...r, player: done }
  }
  const benchCraftAct = (place, slots) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (place === 'workshop' && cur.crafting) return { error: '이미 제작 중이다.' }
    const r = benchCraft(cur, slots, place, false)
    if (r.error) return r
    if (!r.failed && place === 'kitchen') bump('cooks')
    const done = commit(r.failed ? r.player : madeOne(r.player, r.recipe?.id))
    const where = place === 'kitchen' ? '조리실' : '공작소'
    addLog(r.failed ? `${where}에서 제작법에 없는 조합을 시도했다. 재료가 엉망이 되어 ${josa(r.item.name, ['이', '가'])} 남았다.` : `${where}에서 ${r.qty > 1 ? `${r.item.name} ${r.qty}개를` : josa(r.item.name, ['을', '를'])} 만들었다.`)
    return { ...r, player: done }
  }
  const knownCraftAct = (place, recipeId, qty) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (place === 'workshop' && cur.crafting) return { error: '이미 제작 중이다.' }
    const r = knownCraft(cur, place, recipeId, qty, false)
    if (r.error) return r
    bump('crafts'); collect('recipes', recipeId); if (place === 'kitchen') bump('cooks')
    const done = commit(bumpDaily(bumpWeekly(r.player, 'craft'), 'craft'))
    addLog(`${place === 'kitchen' ? '조리실' : '공작소'}에서 ${r.item.name} ${r.qty}개를 만들었다.`)
    return { ...r, player: done }
  }

  // ───── 무구 ─────
  const enhance = (weaponId, stat) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = enhanceWeapon(playerRef.current, weaponId, stat, false); if (r.error) return r; bump('enhances'); const done = commit(bumpWeekly(r.player, 'enhance')); addLog(`${itemOf(weaponId).name}을(를) 강화했다. (${STAT_META[stat].label} +${r.to})`); return { ...r, player: done } }
  const specialEnhance = (weaponId, specialId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = specialEnhanceWeapon(playerRef.current, weaponId, specialId, false); if (r.error) return r; commit(r.player); addLog(`${r.special.title}${itemOf(weaponId).name}에 특수 강화가 붙었다.`); return r }
  const tokenExchange = (baseId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = exchangeGoblinTokens(playerRef.current, baseId, false); if (r.error) return r; commit(r.player); addLog(`도깨비 증표를 ${r.weapon.name}(으)로 바꿨다.`); return r }
  const removeSpecial = (weaponId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = removeWeaponSpecial(playerRef.current, weaponId, false); if (r.error) return r; commit(r.player); addLog(`${itemOf(weaponId)?.name}의 특수 강화를 해제했다.`); return r }

  // ───── 텃밭 ─────
  const gardenAction = (action) => {
    const cur = playerRef.current
    const r = action.type === 'buy' ? buyGardenSeed(cur, action.seedId, 1)
      : action.type === 'plant' ? plantGardenSeed(cur, action.slot, action.seedId, Date.now())
        : action.type === 'harvest' ? harvestGardenPlot(cur, action.slot, Date.now())
          : { error: '알 수 없는 텃밭 행동입니다.' }
    if (r.error) { addLog(r.error); return { error: r.error } }
    if (action.type === 'harvest') bump('harvests')
    commit(syncCodex(r.player))
    if (r.log) addLog(r.log)
    return { message: r.log }
  }

  // ───── 개척 ─────
  const huntActionRef = useRef(null)
  const huntAction = (action) => {
    const run = () => {
      try {
        const cur = playerRef.current
        const now = Date.now()
        const stats = effectiveStats(cur, now)
        const result = action.type === 'enter' ? enterHuntSite(cur, HUNT_SITES[action.siteId], now)
          : action.type === 'move' ? moveOnHunt(cur, action.position, now)
            : action.type === 'attempt' ? attemptHunt(cur, action.nodeId, stats, now)
              : action.type === 'leave' ? leaveHuntSite(cur, now)
                : action.type === 'item' ? useHuntItem(cur, itemOf(action.itemId), now)
                  : null
        if (!result) return
        if (result.error) { addLog(result.error); notify(result.error); return }
        if (action.type === 'enter') { bump('pioneers'); collect('sites', action.siteId) }
        if (action.type === 'attempt') bump('gathers')
        const counted = action.type === 'enter' ? bumpDaily(bumpWeekly(result.player, 'pioneer', 1, now), 'pioneer', 1, now) : result.player
        const next = commit(syncCodex(counted))
        if (result.logs?.length) addLogs(result.logs)
        if (action.type === 'attempt' && next.huntExpedition?.status === 'finished') addLog('개척 행동 횟수를 모두 사용하여 탐색을 마쳤다. 획득한 자원은 유지된다.')
      } catch (error) {
        console.error('[비령] 개척 처리 오류', action, error)
        notify('개척 처리 중 오류가 났다. 진행 상태는 유지했다.')
      }
    }
    if (action.type === 'enter') guard(run); else run()
  }
  huntActionRef.current = huntAction
  /** 전투 승리 기록(업적용): 횟수 · 가장 높은 단계 · 보스 · 서로 다른 상대 */
  const countWin = (enemy) => {
    bump('battleWins')
    if (!enemy) return
    collect('beaten', enemy.id)
    if (enemy.tier) peak('tierMax', enemy.tier)
    if (enemy.role === '보스') { bump('bossWins'); collect('bosses', enemy.id) }
  }
  const finishHuntBattle = (result) => {
    const r = resolveHuntEncounter(playerRef.current, result)
    if (r.error) { addLog(r.error); return }
    const lost = !result.win && !result.fled
    const hp = Number.isFinite(result.hp) ? result.hp : r.player.hp
    const vit = { ...r.player, hp: Math.max(1, Math.min(r.player.hpMax, Math.ceil(hp))) }
    commit(lost ? { ...vit, weakUntil: Date.now() + WEAK_MS } : vit)
    if (r.logs?.length) addLogs(r.logs)
    if (result.win) countWin(result.enemy ?? enemyById(playerRef.current.huntExpedition?.encounter?.enemy?.id))
    if (lost) { addLog(`${result.enemy?.name ?? '요괴'}에게 쓰러졌다. [쇠약] 모든 육조 스탯이 5할로 줄었다. (24시간)`); notify('쓰러졌다. 양호실에서 쉬는 게 좋겠다.') }
  }

  // ───── 전투 ─────
  const startBattle = (enemyId) => {
    interruptAll('새 동작을 시작해')
    const cur = playerRef.current
    battleVitalsRef.current = { hp: cur.hp, mp: cur.mp }
    battleDownedRef.current = false
    battleScannedRef.current = false
    commit({ ...cur, seen: { ...cur.seen, [enemyId]: (cur.seen?.[enemyId] || 0) + 1 } })
    setBattleUsedItems([])
  }
  const finishBattle = ({ win, fled, enemy }) => {
    if (fled) { addLog(`${enemy.name}과의 전투에서 물러났다. (보상도 손실도 없다)`); return }
    const cur = playerRef.current
    const special = cur.weaponSpecial?.[equipOf(cur).weapon]
    const r = applyBattleResult({ ...cur, _battleNoScanWin: !battleScannedRef.current }, win, enemy.reward)
    let p = r.player
    if (win && enemy?.id) p = questEvent(p, { type: 'kill', id: enemy.id })
    if (win && special === 'pine' && !battleDownedRef.current && battleVitalsRef.current) p = { ...p, hp: Math.min(p.hpMax, battleVitalsRef.current.hp), mp: Math.min(p.mpMax, battleVitalsRef.current.mp) }
    delete p._battleNoScanWin
    commit(p)
    if (win) { countWin(enemy); addLog(r.granted ? `${enemy.name}을(를) 쓰러뜨렸다! 영력 +${r.granted}, 돈 +${r.granted}냥.` : `${enemy.name}을(를) 쓰러뜨렸다. (오늘의 보상은 모두 받았다)`) }
    else { addLog(`${enemy.name}에게 패했다.${r.lost ? ` 영력 -${r.lost}.` : ''} [쇠약] 모든 육조 스탯이 5할로 줄었다. (24시간)`); notify('쓰러졌다. 양호실에서 쉬는 게 좋겠다.') }
  }
  const startSlowFightAction = (enemyId) => guard(() => {
    const r = startSlowFight(playerRef.current, enemyId)
    if (r.error) { addLog(r.error); return }
    commit(r.player)
    const enemy = enemyById(enemyId)
    addLog(`느린 싸움: ${enemy?.name}을(를) 상대로 ${slowFightMinutes(enemy)}분을 기다리기 시작했다.`)
  })
  const endSlowFight = () => { if (!playerRef.current.slowFight) return; commit(cancelSlowFight(playerRef.current)); addLog('스스로 멈춰 느린 싸움을 멈췄다. (보상을 받지 못한다)') }
  const downed = () => { const cur = playerRef.current; const next = acquirePsychic(cur, 'survival'); if (next === cur) return; commit(next); addLog('✦ 영능력 《생존본능》을 얻었다.') }
  const changeHp = (value) => { const cur = playerRef.current; const hp = Math.max(1, Math.min(cur.hpMax, Math.ceil(value))); if (hp !== Math.floor(cur.hp)) commit({ ...cur, hp }) }
  const changeMp = (delta) => { const cur = playerRef.current; commit({ ...cur, mp: Math.max(0, Math.min(cur.mpMax, cur.mp + delta)) }) }
  const seeSpecial = (enemyId) => { const cur = playerRef.current; if (!cur.specials?.[enemyId]) commit({ ...cur, specials: { ...cur.specials, [enemyId]: true } }) }
  const breakHeadband = () => { const cur = playerRef.current; if (trinketFx(cur) !== 'headband') return; commit(breakTrinket(cur, equipOf(cur).trinket)); addLog('기합의 띠가 끊어졌다. (장신구 칸이 비었다)') }
  const giveItem = (id, n = 1) => { const cur = playerRef.current; commit({ ...cur, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + n } }) }
  const TUTORIAL_LABEL = { basic: '#1 기본 전투', psychic: '#2 영능력', gear: '#3 무구와 아이템', group: '#4 단체 전투' }
  const onTutorialDone = (key) => { const cur = playerRef.current; if (cur.tutorialDone?.[key]) return; collect('tutorials', key); commit({ ...cur, tutorialDone: { ...(cur.tutorialDone ?? {}), [key]: true } }); addLog(`전투 튜토리얼 '${TUTORIAL_LABEL[key] ?? key}'을 마쳤다.`) }
  const onClaimTutorialReward = (weaponId) => {
    const cur = playerRef.current
    if (cur.tutorialRewardTaken || !['basic', 'psychic', 'gear', 'group'].every((k) => cur.tutorialDone?.[k])) return
    commit({ ...giveWeapon(cur, weaponId).player, tutorialRewardTaken: true })
    addLog(`전투 튜토리얼을 모두 마쳐 [${itemOf(weaponId)?.name ?? weaponId}]을(를) 얻었다.`)
  }
  const onActive = (on) => {
    battleRef.current = on
    setBattleActive(on)
    if (!on) { setBoostOn(false); setReviveOn(false); afflictRef.current = { itemSeal: false, healBlock: false, downed: false } }
  }
  const onAfflict = (a) => { afflictRef.current = a || { itemSeal: false, healBlock: false, downed: false } }

  // ───── NPC (빈 자리면 화면에서 부르지 않는다) ─────
  const meetNpc = (id) => { const cur = playerRef.current; const next = markNpc(cur, id); if (next !== cur) commit(next) }
  const lineSeen = (npcId, cond) => { const cur = playerRef.current; const next = markLineSeen(cur, npcId, cond); if (next !== cur) commit(next) }
  const giveNpc = (npcId, itemId = 'chewy') => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (!(cur.inventory?.[itemId] > 0)) return { error: '건넬 물건이 없다.' }
    const inv = { ...cur.inventory, [itemId]: cur.inventory[itemId] - 1 }
    if (inv[itemId] <= 0) delete inv[itemId]
    const lv = (cur.affinity?.[npcId] || 0) + (itemOf(itemId)?.giftAffinity || 1)
    commit({ ...cur, inventory: inv, affinity: { ...(cur.affinity ?? {}), [npcId]: lv } })
    addLog(`${itemOf(itemId).name}을(를) 건넸다. 호감도가 올랐다. (${lv})`)
    return { level: lv }
  }

  // ───── 소지품 ─────
  const equip = (id) => { if (battleRef.current) return { error: '전투 중에는 장비를 바꿀 수 없다.' }; const r = equipItem(playerRef.current, id); if (r.error) return r; if (!canAddInventory(r.player.inventory)) return { error: '소지품이 가득 찼다. 공간을 확보한 뒤 바꿔 주세요.' }; commit(r.player); addLog(`[${itemOf(id).name}]을(를) 착용했다.`); return {} }
  const unequip = (slot) => { if (battleRef.current) return { error: '전투 중에는 장비를 바꿀 수 없다.' }; const cur = playerRef.current; const was = equipOf(cur)[slot]; const r = unequipSlot(cur, slot); if (r.error) return r; if (!canAddInventory(r.player.inventory)) return { error: '소지품이 가득 찼다. 공간을 확보한 뒤 벗어 주세요.' }; commit(r.player); addLog(`[${itemOf(was).name}]을(를) 벗었다.`); return {} }
  const discardItem = (itemId, qty) => { if (battleRef.current) return { error: '전투 중에는 버릴 수 없다.' }; const r = discardInventoryItem(playerRef.current, itemId, qty); if (r.error) return r; commit(r.player); addLog(`${r.name} ${r.amount}개를 버렸다.`); return r }
  const claimInventoryPending = (id, amount) => { const r = claimPending(playerRef.current, id, amount); if (r.error) { notify(r.error); return r }; commit(r.player); addLog(`수령 대기 물품 ${itemOf(id)?.name ?? id} ${amount}개를 소지품에 넣었다.`); return r }
  const bagAction = (a) => {
    if (battleRef.current) return { error: '전투 중에는 가방을 열 수 없다.' }
    const cur = playerRef.current
    const r = a.type === 'put' ? putInBag(cur, a.bag, a.id, a.n) : a.type === 'take' ? takeFromBag(cur, a.bag, a.id, a.n) : { error: '알 수 없는 가방 동작' }
    if (r.error) { notify(r.error); return r }
    commit(r.player)
    addLog(`가방${a.bag > 0 ? ` ${a.bag + 1}` : ''}${a.type === 'put' ? '에' : '에서'} ${itemOf(a.id)?.name} ${a.n}개를 ${a.type === 'put' ? '넣었다' : '꺼냈다'}.`)
    return { ok: true }
  }

  /** 아이템 쓰기 (C.01 useItem 의 혼자 하는 부분. 다인 전투 분기는 뺐다.) */
  const useItem = async (id, target) => {
    const item = itemOf(id)
    const cur = playerRef.current
    if (!item) return
    const ok = canUseItem(item, {
      inBattle: battleRef.current, isParty: false, countNow: cur.inventory?.[id] || 0, reviveOn: reviveRef.current, boostOn: boostRef.current,
      usedThisBattle: usedRef.current.includes(id) || (!!item.effect?.revive && usedRef.current.some((u) => itemOf(u)?.effect?.revive)),
      downed: battleRef.current && !!afflictRef.current.downed, inHunt: cur.huntExpedition?.status === 'active',
    })
    if (!ok.ok) { notify(ok.why); return }
    if (isHuntItem(item)) { huntActionRef.current?.({ type: 'item', itemId: id }); return }
    const e = item.effect
    const healOnly = Object.keys(e).every((k) => ['hp', 'mp', 'giveHp', 'giveMp'].includes(k))
    if (battleRef.current && afflictRef.current.itemSeal) { notify('주머니를 빼앗겨 지금은 아이템을 쓸 수 없다.'); return }
    if (battleRef.current && afflictRef.current.healBlock && healOnly && (e.hp || e.giveHp)) { notify('돌림병 탓에 지금은 회복 아이템이 듣지 않는다.'); return }
    if (e.trainUnder10) {
      if (!ENH_STATS.includes(target) || (cur.stats?.[target] ?? 0) >= 10) { notify('스탯이 10 미만인 육조를 골라야 한다.'); return }
      if ((cur.hp || 0) <= 30) { notify('사용하려면 체력이 30보다 많아야 한다.'); return }
      const inventory = { ...cur.inventory, [id]: cur.inventory[id] - 1 }
      if (inventory[id] <= 0) delete inventory[id]
      commit({ ...cur, inventory, hp: cur.hp - 30, stats: { ...cur.stats, [target]: (cur.stats[target] ?? 0) + 1 } })
      addLog(`숯을 사용했다. ${STAT_META[target].label} +1 / 체력 -30.`)
      return
    }
    if (e.randomProduct) {
      const r = openSomeonesBag(cur)
      if (r.error) { notify(r.error); return }
      commit(r.player)
      addLog(`${item.name}을(를) 열었다. 안에서 [${itemOf(r.got)?.name ?? r.got}]이(가) 나왔다.`)
      return
    }
    const now0 = Date.now()
    const parts = []
    const added = []
    if (e.buff) added.push({ stat: e.buff.stat, amount: e.buff.amount, ms: e.buff.hours * 3600_000 })
    for (const b of e.buffs ?? []) added.push({ stat: b.stat, amount: b.amount, ms: b.hours * 3600_000 })
    if (e.buffAll) for (const k of STAT_KEYS) added.push({ stat: k, amount: e.buffAll.amount, ms: e.buffAll.hours * 3600_000 })
    if (e.randomBuff) { const pool = [...STAT_KEYS]; for (let i = 0; i < e.randomBuff.count && pool.length; i++) added.push({ stat: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], amount: e.randomBuff.amount, ms: e.randomBuff.hours * 3600_000 }) }
    if (e.battleStat) for (const [k, v] of Object.entries(e.battleStat)) added.push({ stat: k, amount: v, ms: 20 * 60_000 })
    const buffs = added.length ? [...(cur.buffs ?? []).filter((b) => b.until > now0 && b.src !== id), ...added.map((b) => ({ src: id, stat: b.stat, amount: b.amount, until: now0 + b.ms }))] : cur.buffs
    if (added.length) { const hours = Math.round(added[0].ms / 360_000) / 10; parts.push(`${added.map((b) => `${STAT_META[b.stat]?.label ?? b.stat} +${b.amount}`).join(' · ')} (${hours >= 1 ? `${hours}시간` : `${Math.round(added[0].ms / 60_000)}분`})`) }
    const healBlocked = battleRef.current && afflictRef.current.healBlock && !(e.cleanse || e.giveCleanse)
    const giveHp = e.giveHp ? e.giveHp.self : 0
    const giveMp = e.giveMp ? e.giveMp.self : 0
    const weakUntil = Math.max(cur.curseUntil > now0 ? cur.curseUntil : 0, e.cureWeak ? 0 : e.weakCap != null ? Math.min(cur.weakUntil || 0, now0 + e.weakCap) : cur.weakUntil || 0)
    const mpGain = (e.mp || 0) + giveMp + (e.mpStats ? e.mpStats.reduce((s, k) => s + Math.max(0, Math.floor(effectiveStats(cur)[k] || 0)), 0) : 0)
    let hp = cur.hp
    if (!healBlocked && (e.hpFull || e.hp || giveHp)) hp = e.hpFull ? cur.hpMax : Math.min(cur.hpMax, cur.hp + (e.hp || 0) + giveHp)
    if (e.hpCost) hp = Math.max(1, hp - e.hpCost)
    const mp = e.mpFull ? cur.mpMax : mpGain ? Math.min(cur.mpMax, cur.mp + mpGain) : cur.mp
    if (hp !== cur.hp) parts.push(e.hpFull ? '체력 완전 회복' : `체력 ${hp > cur.hp ? '+' : ''}${Math.round(hp - cur.hp)}`)
    if (mp !== cur.mp) parts.push(e.mpFull ? '의지력 완전 회복' : `의지력 +${Math.round(mp - cur.mp)}`)
    const inventory = { ...cur.inventory, [id]: cur.inventory[id] - 1 }
    if (inventory[id] <= 0) delete inventory[id]
    const next = commit({ ...cur, ...(buffs ? { buffs } : {}), inventory, hp, mp, money: e.sellMoney ? (cur.money || 0) + e.sellMoney : cur.money, weakUntil, ...(e.spirit ? { spirit: (cur.spirit || 0) + e.spirit } : {}) })
    if (e.spirit) parts.push(`영력 +${(next.spirit || 0) - (cur.spirit || 0)}`)
    if (e.revive) { setReviveOn(true); parts.push('전투불능 시 1회 부활 대기') }
    if (e.boost) { setBoostOn(true); parts.push('나의 다음 행동 피해 2배 (1턴)') }
    if (e.cureWeak) parts.push('[쇠약] 즉시 회복')
    else if (e.weakCap != null) parts.push('[쇠약] 남은 시간이 1시간으로 줄었다')
    if (e.sellMoney) parts.push(`${e.sellMoney}냥 획득`)
    if (battleRef.current && (touchesBattleState(e) || e.giveCleanse)) setSoloItemFx({ seq: Date.now() + Math.random(), name: item.name, effect: { enemyHit: e.enemyHit, drainSpirit: e.drainSpirit, reveal: e.reveal, charms: e.charms, cleanse: e.cleanse || e.giveCleanse } })
    if (battleRef.current) setBattleUsedItems((arr) => (arr.includes(id) ? arr : [...arr, id]))
    bump('itemsUsed')
    addLog(`${item.name}을(를) 사용했다. (${parts.length ? parts.join(' · ') : item.effectText})`)
  }

  /** Battle · HuntBattleModal 에 그대로 넘기는 props */
  const battleProps = player && {
    stats: effStats, baseAggression: player.stats?.aggression, mp: player.mp, hp: player.hp, hpMax: player.hpMax,
    seen: player.seen, specials: player.specials, psychics: player.psychics ?? [], curseUntil: player.curseUntil || 0,
    rewardLeft: Math.max(0, GYM_DAILY_REWARDS - gymToday(player).wins),
    onStart: startBattle, onHp: changeHp, onMp: changeMp, onLog: addLogs, onDown: (...a) => { battleDownedRef.current = true; downed(...a) },
    onScan: () => { battleScannedRef.current = true }, onSpecialSeen: seeSpecial,
    reviveOn, onReviveUsed: () => setReviveOn(false), headbandOn: trinketFx(player) === 'headband', onHeadbandUsed: breakHeadband,
    boostOn, onBoostUsed: () => setBoostOn(false), onActive, usedItems: battleUsedItems, itemFx: soloItemFx,
    onSpotItems: () => {}, onOpenItems: () => setInvOpen(true), onGiveItem: giveItem, onAfflict,
    slowFight: player.slowFight, onStartSlow: startSlowFightAction, onStopSlow: endSlowFight,
    tutorialDone: player.tutorialDone, tutorialRewardTaken: player.tutorialRewardTaken, onTutorialDone, onClaimTutorialReward, onTutorialActive: () => {},
  }

  /** 메인 화면(스토리 퀘스트 보상 등)이 주는 것. */
  const grant = ({ spirit = 0, money = 0, items = null, log = '' } = {}) => {
    const cur = playerRef.current
    if (!cur) return false
    const inventory = { ...cur.inventory }
    for (const [id, n] of Object.entries(items ?? {})) if (itemOf(id)) inventory[id] = (inventory[id] || 0) + n
    commit({ ...cur, spirit: (cur.spirit || 0) + spirit, money: (cur.money || 0) + money, inventory })
    if (log) addLog(log)
    persist()
    return true
  }
  bridge.api = player ? { upgradeStat, openInventory: () => setInvOpen(true), grant, get player() { return playerRef.current }, statCost: (key) => (playerRef.current?.stats?.[key] ?? 1) * STAT_UPGRADE_COST_PER_POINT, statMax: STAT_MAX } : null

  return {
    profile, player, effStats, logs, notice, toasts, setToasts, invOpen, setInvOpen, confirm, setConfirm, battleActive,
    reviveOn, boostOn, battleUsedItems, notify, addLog,
    handlers: {
      beginTraining, endTraining, beginSleep, endSleep, beginRest, endRest, upgradeStat,
      lessonActions, setSkin2048, setSkinRunner, lessonOf: (id) => lessonOf(playerRef.current, id),
      buyItem, buyRecipe, sellToStore, craftItem, endCraft, cookItem, benchCraftAct, knownCraftAct,
      enhance, specialEnhance, tokenExchange, removeSpecial, gardenAction, huntAction, finishHuntBattle, finishBattle,
      meetNpc, lineSeen, giveNpc, equip, unequip, discardItem, claimInventoryPending, bagAction, useItem,
    },
    battleProps,
  }
}
