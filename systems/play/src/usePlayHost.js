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
import { lostFindChance, LOST_FIND_ITEMS } from './lostFind.js'
import * as Beasts from './beasts.js'
import { sfx as __sfx } from '@vault/game/sfx.js' // vD.06.1 [테마 관리]의 효과음 끄기가 실행 화면에도 닿게
globalThis.BiryeongSfx = __sfx
try { if (localStorage.getItem('biryeong-sfx') === 'off') __sfx.setMuted(true) } catch { /* 저장소 없음 */ } // vD.05 신수들의 터: 새끼 신수 기르기
import { protectBags, putInBag, takeFromBag, bagCount, bagRoom, bagContents, BAG_SLOTS } from '@vault/game/bag.js'
import { STAT_KEYS, STAT_META, STAT_MAX, STAT_UPGRADE_COST_PER_POINT } from '@vault/game/constants.js'
import { LESSON_WAIT_MINUTES } from '@vault/game/courseInfo.js'
import { enemyById } from '@vault/game/battle.js'
import { SKINS, isSkinOpen } from '@vault/game/skins2048.js'
import { SKINS_RUNNER, isRunnerSkinOpen } from '@vault/game/skinsRunner.js'
import { bumpWeekly, bumpDaily, questEvent, markWeeklySet, ensureDaily } from '@vault/game/activityCounters.js'
import { ensureClubWeek, boardOf, claimClub } from './clubQuests.js'
import { npcEvent, placeView, activeList, acceptQuest, abandonQuest, finishQuest, goalText as npcGoalText } from './npcQuests.js'
import { buyGardenSeed, plantGardenSeed, harvestGardenPlot } from '@vault/game/garden.js'
import { HUNT_SITES } from '@vault/game/huntSites.js'
import { enterHuntSite, moveOnHunt, attemptHunt, leaveHuntSite, resolveHuntEncounter, useHuntItem } from '@vault/game/huntField.js'
import { touchesBattleState } from '@vault/game/battleItems.js'
import { openSomeonesBag, startWait as startExploreWait, claimWait as claimExploreWait, spendMp as spendExploreMp, goblinPlay, openRicePouches, ricePouchText, readShrineSign, sneakLocker } from '@vault/game/exploreActions.js'
import { deposit, withdraw } from '@vault/game/locker.js'
import { playHoljjak as playHoljjakGame } from '@vault/game/holjjak.js'
import { GOBLIN_GAMES } from '@vault/game/hike.js'
import { clubOf, CLUBS } from '@vault/game/clubs.js'
import { ITEMS } from '@vault/game/items.js'
import { COOK_RECIPES as COOKS_ALL } from '@vault/game/cooking.js'
import { PSYCHICS, BESTIARY_ENEMIES, PS_INFO } from '@vault/game/battle.js'
import { noteKill } from './steal.js'
import { NURSE_STOCK, NURSE_GUARD_MIN } from './ailments.js'
import { AIL, AILMENTS, addAilment, setAilmentSource, afterBattleAilment, huntAilment, effortAilment, cureAilments, shortenAilments, activeAilments, gotText, ailLabel, leftText, WEAK_INFO } from './ailments.js'
import { spiritWinsLeft } from './spiritCap.js'
import { SPIRIT_MAX } from '@vault/game/constants.js'
import { sellItem } from '@vault/game/sell.js'
import { benchCraft, knownCraft, markMade, PLACE_RECIPES } from '@vault/game/freeCraft.js'
import { ACHIEVEMENTS } from '@vault/game/achievements.js'
import {
  GYM_DAILY_REWARDS, applyBattleResult, cancelWaits, completeLesson, courseTitle, gymToday, lessonOf, pickFortuneStat,
  sanitizeRestored, clampSpirit, spendAttempt, startTraining, startWait, tickPlayer, startRest, startSleep, markNpc, syncCodex,
  REST_KINDS, acquirePsychic, effectiveStats, startSlowFight, cancelSlowFight, slowFightMinutes, WEAK_MS, cancelGather, cancelHunt,
} from '@vault/game/progress.js'
import { readSave, writeHost } from './store.js'
import { bridge } from './bridge.js'
import { makeStoryEnemy, dropOf, bossRecipes, STORY_FOES } from './storyBoss.js'
import { saveBossSlot as __saveBossSlot } from '@vault/game/bossSlots.js'
import { STORY_ITEMS, STORY_RECIPES } from '../../biryeong/reskin.data.js'
import { baseIdOf, enhTotal } from '@vault/game/items.js'
import { notePsyBattle, psyCheck, psyProgressOf } from './psyUnlock.js' // V.01 영능력 얻는 방법

const LOG_MAX = 80
const COOK_IDS = { has: (id) => COOKS_ALL.some((r) => r.id === id) }
/** 제작법 id → 만들어지는 아이템 id (공작소 · 조리실) */
const resultOf = (recipeId) => [...PLACE_RECIPES.workshop, ...PLACE_RECIPES.kitchen].find((r) => r.id === recipeId)?.result ?? null
/** 지금 단 칭호의 기능(메인 화면 app.js 가 알려 준다): { type, v, key? } 또는 null */
const perkOf = () => { try { return window.BiryeongPerk?.() ?? null } catch { return null } }
const perkV = (type) => { const p = perkOf(); return p && p.type === type ? p.v : 0 }
const roll = (pct) => pct > 0 && Math.random() * 100 < pct
const TITLE_BUFF = 'title-perk' // 칭호의 육조 보정은 버프 한 줄로 얹는다
const FAR = 4102444800000 // 2100년
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const stamp = () => new Date().toTimeString().slice(0, 8)
const josa = (word, pair) => {
  const c = String(word).slice(-1).charCodeAt(0) - 0xac00
  const b = c >= 0 && c <= 11171 ? c % 28 : 0
  return word + (b ? pair[0] : pair[1])
}

/** 메인 화면의 내 프로필 → 게임 캐릭터 */
function playerFromProfile(profile) {
  return syncCodex(createPlayer({ name: profile.name, age: Number.parseInt(profile.age, 10) || 17, grade: profileGrade(profile), avatar: null, stats: profile.stats, greeting: profile.intro ?? '' }))
}
/** vD.02.3 학년은 프로필에서 고른 학년(1~3) — 나이와 상관없다(빠른년생 · 한 해 쉰 사람). 고른 적이 없으면 나이로 */
export function profileGrade(profile) {
  const g = Number(profile?.grade)
  if (g >= 1 && g <= 3) return g
  return Math.min(3, Math.max(1, (Number.parseInt(profile?.age, 10) || 17) - 16))
}

/** vC.05 튜토리얼 전에 기억해 둔 체력 · 의지력으로 되돌린다 */
function untutor(p) {
  const { tutorialSnap: snap, ...rest } = p
  if (!snap) return p
  return { ...rest, hp: Math.max(1, Math.min(rest.hpMax, Math.ceil(snap.hp ?? rest.hp))), mp: Math.max(0, Math.min(rest.mpMax, Math.floor(snap.mp ?? rest.mp))) }
}

/** vD.02 두 상태가 체력 · 영력의 소수점만 다른가(내림한 값은 같다) */
function onlyFraction(a, b) {
  if (Math.floor(a.hp) !== Math.floor(b.hp) || Math.floor(a.spirit) !== Math.floor(b.spirit)) return false
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (k !== 'hp' && k !== 'spirit' && a[k] !== b[k]) return false
  return true
}

export function usePlayHost() {
  const first = useMemo(() => readSave(), [])
  const admin = useMemo(() => { try { return !!window.BiryeongAuth?.isAdmin?.() } catch { return false } }, [])
  const profile = first.profile ?? null
  const [player, setPlayerState] = useState(() => {
    if (!profile) return null
    const restored = first.game ? sanitizeRestored(first.game, first.game.createdAt, admin) : playerFromProfile(profile)
    // 이름 · 한줄소개는 메인 화면의 프로필을 따른다.
    // vC.05 튜토리얼 도중에 창을 닫았으면, 다음에 들어올 때 튜토리얼 전의 체력 · 의지력으로 돌려놓는다.
    const back = restored?.tutorialSnap ? untutor(restored) : restored
    return { ...back, name: profile.name, greeting: profile.intro ?? '', grade: profileGrade(profile) } // vD.02.3 학년도 프로필을 따른다
  })
  const playerRef = useRef(player)
  // v1.3 본편 제작법 잠금: 보관고 제작 칸 · 제작법 목록(patches.mjs)이 이걸 본다. 관리자는 모두 열린다.
  globalThis.__BRY_OPEN = { has: (id) => !!admin || !!playerRef.current?.storyRecipes?.[id] }
  playerRef.current = player
  const countsRef = useRef({ ...(first.counts ?? {}) })
  const [logs, setLogs] = useState(() => (Array.isArray(first.playLog) ? first.playLog.slice(-LOG_MAX) : []))
  const logsRef = useRef(logs)
  logsRef.current = logs
  const [notice, setNotice] = useState(null) // 화면 위에 잠깐 뜨는 안내 { id, text }
  const [toasts, setToasts] = useState([]) // C.01 업적 달성 알림
  const [invOpen, setInvOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { text, run }
  const [bsPick, setBsPick] = useState(null) // vD.02.1 응급 처치 상자: { id, options:[{key,label,desc}] }

  // ── 저장 ──
  const saveTimer = useRef(null)
  const persist = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = null
    if (!playerRef.current) return
    // savedAt: 접속을 끊은 동안에도 영력 회복 · 수련 · 잠이 흐르도록, 마지막으로 적은 시각을 남긴다(다시 열면 그 사이를 한꺼번에 계산).
    writeHost({ game: { ...clampSpirit(playerRef.current), savedAt: Date.now() }, counts: countsRef.current, playLog: logsRef.current.slice(-LOG_MAX) })
    bridge.saved()
  }, [])
  const schedule = useCallback(() => { if (!saveTimer.current) saveTimer.current = setTimeout(persist, 250) }, [persist])
  useEffect(() => {
    const flush = () => persist()
    window.addEventListener('pagehide', flush)
    const beat = setInterval(flush, 20000)
    document.addEventListener('visibilitychange', flush)
    return () => { clearInterval(beat); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); persist() }
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
  const regenAt = useRef(0) // vD.02 시간 기운(1분마다 회복)의 마지막 때
  const timedRegenDue = (p, now) => ['hpRegen', 'mpRegen'].some((k) => p.timed?.[k]?.until > now) && now - (regenAt.current || 0) >= 60000
  const commit = useCallback((next) => {
    const prev = playerRef.current
    const safe = syncCodex(clampSpirit(protectBags(prev, limitNewGains(prev, next)))) // 한 번이라도 손에 넣은 아이템은 도감에 남는다
    playerRef.current = safe
    globalThis.__BRY_MPMAX = safe?.mpMax // vB.03: 빼앗은 영능력이 의지력을 되찾을 때 최대치를 넘지 않게(battle.js stolenTurn)
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
      let cur = playerRef.current
      const now = Date.now()
      const before = cur
      // 칭호 기능: 육조 보정(버프 한 줄) 맞추기
      const pk = perkOf()
      const want = pk?.type === 'stat' ? pk : null
      const has = (cur.buffs ?? []).find((b) => b.src === TITLE_BUFF)
      if ((want?.key ?? null) !== (has?.stat ?? null) || (want?.v ?? 0) !== (has?.amount ?? 0)) {
        const rest = (cur.buffs ?? []).filter((b) => b.src !== TITLE_BUFF)
        cur = { ...cur, buffs: want ? [...rest, { src: TITLE_BUFF, stat: want.key, amount: want.v, until: FAR }] : rest }
      }
      // 칭호 기능: 하루 첫 접속 용돈
      if (pk?.type === 'dailyMoney' && countsRef.current.perkDay !== today()) {
        countsRef.current = { ...countsRef.current, perkDay: today() }
        cur = { ...cur, money: (cur.money || 0) + pk.v }
        addLog(`칭호의 기능: 오늘의 첫 접속으로 ${pk.v}냥을 받았다.`)
      }
      const r = tickPlayer(cur, now, Math.max(0, (now - last) / 1000))
      // vD.02 끊김 줄이기: 자연 회복으로 체력 · 영력의 소수점만 바뀐 초에는 화면 전체를 다시 그리지 않는다(시간은 쌓아 두었다가 눈에 보이게 바뀔 때 한 번에)
      if (cur === before && !r.logs.length && !r.unlocked?.length && r.player !== cur && onlyFraction(cur, r.player) && !timedRegenDue(cur, now)) return
      last = now
      let np = r.player
      if (cur.resting && !np.resting) { const u = psyCheck(np, PSYCHICS); if (u.got.length) { np = u.player; u.logs.forEach(addLog) } } // V.01 형상 기억: 양호실 10회
      { // vD.02 음식의 시간 기운: 1분마다 체력 · 의지력이 조금씩(전투 중에는 쉰다)
        const tv = (k) => { const t = np.timed?.[k]; return t && t.until > now ? Number(t.v) || 0 : 0 }
        const hr = tv('hpRegen'), mr = tv('mpRegen')
        if ((hr || mr) && !battleRef.current && now - (regenAt.current || 0) >= 60000) {
          regenAt.current = now
          const hp = hr ? Math.min(np.hpMax, (np.hp || 0) + hr) : np.hp, mp = mr ? Math.min(np.mpMax, (np.mp || 0) + mr) : np.mp
          if (hp !== np.hp || mp !== np.mp) np = { ...np, hp, mp }
        }
      }
      if (cur.slowFight && !np.slowFight) { const sid = cur.slowFight.enemyId; np = npcEvent(npcEvent(bumpDaily(bumpWeekly(sid ? questEvent(np, { type: 'kill', id: sid }) : np, 'wins', 1, now), 'wins', 1, now), 'win'), 'kill', sid) } // vC.06 느린 싸움도 승리로 센다
      if (np !== cur) {
        const gain = (np.spirit || 0) - (cur.spirit || 0)
        if (cur.training && !np.training && gain > 0) { const ea = effortAilment(np); if (ea.got.length) { np = ea.player; gotText(ea.got, np).forEach(addLog) } } // vC.06 수련을 마치면 가끔 근육통
        if (cur.training && !np.training && gain > 0) { const pct = perkV('trainSpirit'); if (pct) { const more = Math.ceil(gain * pct / 100); np = { ...np, spirit: np.spirit + more }; addLog(`칭호의 기능: 수련으로 영력을 ${more} 더 얻었다.`) } }
        else if (cur.sleeping && !np.sleeping) { const v = perkV('wakeSpirit'); if (v) { np = { ...np, spirit: (np.spirit || 0) + v }; addLog(`칭호의 기능: 개운하게 일어나 영력 +${v}.`) } }
        else if (gain > 0 && !cur.training) { const pct = perkV('regen'); if (pct) np = { ...np, spirit: np.spirit + gain * pct / 100 } }
      }
      if (np !== before) { const safe = clampSpirit(limitNewGains(before, np)); playerRef.current = safe; setPlayerState(safe); schedule() }
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
  // V.01 대기 중 경고에 남은 시간: 하고 있는 대기 가운데 가장 늦게 끝나는 것
  const busyLeftText = (p, now = Date.now()) => {
    const ends = []
    for (const k of ['training', 'sleeping', 'resting', 'crafting', 'slowFight', 'gathering', 'hunting']) {
      const a = p?.[k]; if (!a) continue
      const end = Number(a.until ?? a.endsAt ?? (a.startedAt != null && a.minutes != null ? a.startedAt + a.minutes * 60000 : NaN))
      if (Number.isFinite(end)) ends.push(end)
    }
    for (const l of Object.values(p?.lessons ?? {})) if (l?.waitUntil) ends.push(Number(l.waitUntil))
    const ms = Math.max(0, ...ends.filter(Number.isFinite)) - now
    if (!(ms > 0)) return ''
    const m = Math.ceil(ms / 60000), hh = Math.floor(m / 60), mm = m % 60
    return hh ? `${hh}시간${mm ? ` ${mm}분` : ''}` : `${mm}분`
  }
  /** 대기 활동 중이면 먼저 물어본다. */
  const guard = useCallback((run) => {
    const b = busyLabel(playerRef.current)
    if (b) { const left = busyLeftText(playerRef.current); setConfirm({ text: `지금 ${b} 중이다.${left ? ` (끝나기까지 ${left} 남음)` : ''} 그만두고 진행할까? (보상은 받지 못한다)`, run: () => { interruptAll('새 동작을 시작해'); run() } }) }
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
    if ((!admin && now >= STAT_MAX) || cur.spirit < cost) return
    const done = commit({ ...cur, spirit: cur.spirit - cost, stats: { ...cur.stats, [key]: now + 1 } })
    const back = Math.floor(cost * perkV('statRefund') / 100)
    if (back > 0) { commit({ ...playerRef.current, spirit: playerRef.current.spirit + back }); addLog(`칭호의 기능: 단련에 쓴 영력 ${back}이(가) 되돌아왔다.`) }
    bump('statUps'); peak('statMax', now + 1); peak('statSum', STAT_KEYS.reduce((a, k) => a + Math.floor(done.stats[k] || 0), 0)); peak('statMin', Math.min(...STAT_KEYS.map((k) => Math.floor(done.stats[k] || 0))))
    addLog(`${STAT_META[key].label}이(가) ${now} → ${now + 1}로 올랐다. (영력 -${cost})`)
  }

  // ───── 수업 ─────
  const lessonActions = useMemo(() => ({
    spendAttempt: (id) => { const next = spendAttempt(playerRef.current, id); if (!next) return false; commit(next); return true },
    complete: (id) => { const r = completeLesson(playerRef.current, id); bridge.quest('lesson', id); if (!r.logs.length) return; const ls = perkV('lessonSpirit'); commit(npcEvent(ls ? { ...r.player, spirit: (r.player.spirit || 0) + ls } : r.player, 'lesson')); /* vC.06: completeLesson 이 이미 일 · 주간 수업 수를 센다(예전엔 두 번 셌다) */ if (ls) addLog(`칭호의 기능: 수업 보상으로 영력 +${ls}.`); r.logs.forEach(addLog); bump('lessons'); collect('courses', id) },
    wait: (id) => { const next = startWait(playerRef.current, id); if (!next) return; commit(next); addLog(`${courseTitle(id)}: 수업을 기다리기 시작했다. (${LESSON_WAIT_MINUTES}분)`) },
    pickStat: (key) => { const next = pickFortuneStat(playerRef.current, key); if (!next) return; commit(next); addLog(`점복학 보너스: ${STAT_META[key].label}이(가) 1 올랐다.`) },
  }), [commit, addLog, bump])
  const setSkin2048 = (id) => { const k = SKINS.find((x) => x.id === id); if (k && isSkinOpen(k, playerRef.current, admin)) commit({ ...playerRef.current, skin2048: id }) }
  const setSkinRunner = (id) => { const k = SKINS_RUNNER.find((x) => x.id === id); if (k && isRunnerSkinOpen(k, playerRef.current, admin)) commit({ ...playerRef.current, skinRunner: id }) }

  // ───── 매점 ─────
  const buyItem = (id, qty = 1) => {
    const item = itemOf(id); const cur = playerRef.current; const n = Math.max(1, Math.min(99, Math.floor(qty)))
    if (!item || item.price == null || (!admin && cur.money < item.price * n) || !isStoreOpen()) return
    if (!canAddInventory(cur.inventory, { [id]: n })) { addLog('소지품이 가득 찼다. 정리한 뒤 다시 사 줘.'); return }
    bump('buys', n)
    const off = admin ? item.price * n : Math.floor(item.price * n * perkV('discount') / 100)
    commit(bumpWeekly({ ...cur, money: cur.money - item.price * n + off, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + n } }, 'shopBuy'))
    bridge.quest('buy', id) // vD.03.2 적응 퀘스트(매점에서 사 보기)
    addLog(`매점에서 ${item.name} ${n}개를 샀다. (-${item.price * n - off}냥${admin ? ' · 관리자' : off ? ` · 칭호의 기능으로 ${off}냥 덜 냈다` : ''})`)
  }
  /** vD.02.1 응급 처치 상자로 풀 수 있는 것: 전투 중 상태(battle 이 알려 준 칸) + 몸의 이상 */
  const bsOptions = (p, battleBs = []) => {
    const now = Date.now()
    const out = (battleBs || []).map((k) => ({ key: k, label: `[${k === 'curse' ? '저주' : k === 'bound' ? '속박' : PS_INFO[k]?.label ?? k}]`, desc: k === 'curse' ? '매 턴 막을 수 없는 피해' : k === 'bound' ? '움직임이 묶였다' : PS_INFO[k]?.desc ?? '' }))
    for (const a of activeAilments(p, now)) out.push({ key: a.id, ail: true, label: `[${a.def.name}]${a.stack > 1 ? ` ${a.stack}겹` : ''}`, desc: `몸의 이상 · ${a.def.effect ?? ''}` })
    return out
  }
  /** vD.02.1 다인 전투에서 고른 몸의 이상을 푼다(StoryParty 가 부른다) */
  const cureAilOne = (key) => { const keys = [].concat(key); const c = playerRef.current; const r = cureAilments(c, keys); if (r.cured?.length) { commit(r.player); addLog(`응급 처치: ${r.cured.map(ailLabel).join(' · ')} 나았다.`) } }
  /** vD.02 시간 기운 이름 */
  const TIMED_LABEL = { hpRegen: (v) => `1분마다 체력 +${v}`, mpRegen: (v) => `1분마다 의지력 +${v}`, huntOdds: (v) => `개척 성공률 +${v}%`, huntBonus: (v) => `개척 추가 보상 확률 +${v}%`, winMoney: (v) => `전투 승리 냥 +${v}%` }
  /** vD.02 양호실 물품 사기(매점 영업시간과 상관없다) */
  const nurseBuy = (id, qty = 1) => {
    const st = NURSE_STOCK.find((x) => x.id === id), item = itemOf(id), cur = playerRef.current
    const n = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)))
    if (!st || !item) return { error: '양호실에서 팔지 않는 물건이다.' }
    if (!admin && (cur.money || 0) < st.price * n) { addLog('냥이 모자라다.'); return { error: '냥이 모자라다.' } }
    if (!canAddInventory(cur.inventory, { [id]: n })) { addLog('소지품이 가득 찼다. 정리한 뒤 다시 사 줘.'); return { error: '소지품이 가득 찼다.' } }
    const off = admin ? st.price * n : Math.floor(st.price * n * perkV('discount') / 100)
    commit(bumpWeekly({ ...cur, money: (cur.money || 0) - st.price * n + off, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + n } }, 'shopBuy'))
    addLog(`양호실에서 ${item.name} ${n}개를 샀다. (-${st.price * n - off}냥${off ? (admin ? ' · 관리자' : ` · 칭호의 기능으로 ${off}냥 덜 냈다`) : ''})`)
    return { ok: true }
  }
  const buyRecipe = (recipeId) => {
    if (!isStoreOpen()) return
    const r = buyRecipeAt(playerRef.current, recipeId, admin)
    if (r.error) { addLog(r.error); return }
    commit(bumpWeekly(r.player, 'shopBuy'))
    addLog(`매점에서 [${itemOf(r.recipe.result)?.name ?? r.recipe.result}] 제작법을 익혔다. (-${r.recipe.price}냥)`)
  }
  const sellToStore = (itemId, qty) => { const r = sellItem(playerRef.current, itemId, qty); if (r.error) return r; bump('sells', r.qty); const more = Math.ceil(r.gained * perkV('sell') / 100); commit(more ? { ...r.player, money: (r.player.money || 0) + more } : r.player); addLog(`매점에 ${r.item.name} ${r.qty}개를 팔았다. (+${r.gained + more}냥${more ? ` · 칭호의 기능 +${more}냥` : ''})`); return r }

  // ───── 제작 · 조리 ─────
  /** 제작 뒤처리: 3단계 공정의 수율(한 번에 여러 개) · 칭호 기능(덤 하나) */
  const afterMake = (p, place, recipeId, qty = 1) => {
    const r = (PLACE_RECIPES[place] ?? []).find((x) => x.id === recipeId)
    if (!r) return p
    let extra = r.yield > 1 ? (r.yield - 1) * qty : 0
    if (extra) addLog(`공정 수율: ${itemOf(r.result)?.name} ${extra}개가 더 나왔다.`)
    if (roll(perkV(place === 'kitchen' ? 'cookBonus' : 'craftBonus'))) { extra += 1; addLog(`칭호의 기능: ${itemOf(r.result)?.name} 하나가 덤으로 나왔다.`) }
    if (r.tier === 3) bump('crafts3', qty)
    if (r.result.startsWith('nw-')) collect('newItems', r.result) // v1.5 새 아이템 — 업적 「새 장부」 · 「장부를 다 채웠다」
    return extra ? { ...p, inventory: { ...p.inventory, [r.result]: (p.inventory?.[r.result] || 0) + extra } } : p
  }
  const madeOne = (p, recipeId, qty = 1) => { bridge.quest(COOK_IDS.has(recipeId) ? 'cook' : 'craft', recipeId); bridge.quest('make', { id: resultOf(recipeId), qty }); bump('crafts'); collect('recipes', recipeId); return npcEvent(markMade(bumpDaily(bumpWeekly(p, 'craft'), 'craft'), recipeId), 'make', resultOf(recipeId), qty) } // vC.06 인물의 부탁(만들기)
  const craftItem = (recipeId, qty = 1) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (cur.crafting) return { error: '이미 제작 중이다.' }
    const r = startCraft(cur, recipeId, qty, admin)
    if (r.error) return r
    const done = commit(madeOne(afterMake(r.player, 'workshop', recipeId, r.qty), recipeId, r.qty))
    addLog(`공작소에서 ${r.item?.name ?? itemOf(recipeOf(recipeId)?.result)?.name ?? ''} ${r.qty}개를 제작했다.`)
    return { ...r, player: done }
  }
  const endCraft = () => { if (!playerRef.current.crafting) return; commit(cancelCraft(playerRef.current)); addLog('스스로 멈춰 제작을 멈췄다. (재료도 완성품도 돌아오지 않는다)') }
  const cookItem = (recipeId) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const r = cook(playerRef.current, recipeId, admin)
    if (r.error) return r
    bump('cooks')
    const done = commit(madeOne(afterMake(r.player, 'kitchen', recipeId, 1), recipeId))
    addLog(`조리실에서 ${josa(r.item.name, ['을', '를'])} 만들었다.`)
    return { ...r, player: done }
  }
  const benchCraftAct = (place, slots) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (place === 'workshop' && cur.crafting) return { error: '이미 제작 중이다.' }
    const r = benchCraft(cur, slots, place, admin)
    if (r.error) return r
    if (!r.failed && place === 'kitchen') bump('cooks')
    if (r.failed) bump('craftFails')
    const done = commit(r.failed ? r.player : madeOne(afterMake(r.player, place, r.recipe?.id, r.qty), r.recipe?.id, r.qty))
    const where = place === 'kitchen' ? '조리실' : '공작소'
    addLog(r.failed ? `${where}에서 제작법에 없는 조합을 시도했다. 재료가 엉망이 되어 ${josa(r.item.name, ['이', '가'])} 남았다.` : `${where}에서 ${r.qty > 1 ? `${r.item.name} ${r.qty}개를` : josa(r.item.name, ['을', '를'])} 만들었다.`)
    return { ...r, player: done }
  }
  const knownCraftAct = (place, recipeId, qty) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const cur = playerRef.current
    if (place === 'workshop' && cur.crafting) return { error: '이미 제작 중이다.' }
    const r = knownCraft(cur, place, recipeId, qty, admin)
    if (r.error) return r
    bridge.quest(place === 'kitchen' ? 'cook' : 'craft', recipeId); bridge.quest('make', { id: resultOf(recipeId), qty: r.qty }); bump('crafts'); collect('recipes', recipeId); if (place === 'kitchen') bump('cooks')
    const done = commit(npcEvent(bumpDaily(bumpWeekly(afterMake(r.player, place, recipeId, r.qty), 'craft'), 'craft'), 'make', resultOf(recipeId), r.qty))
    addLog(`${place === 'kitchen' ? '조리실' : '공작소'}에서 ${r.item.name} ${r.qty}개를 만들었다.`)
    return { ...r, player: done }
  }

  // ───── 무구 ─────
  const enhance = (weaponId, stat) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = enhanceWeapon(playerRef.current, weaponId, stat, admin); if (r.error) return r; bump('enhances'); bridge.quest('enhance', baseIdOf(weaponId)); const done = commit(bumpWeekly(r.player, 'enhance')); addLog(`${itemOf(weaponId).name}을(를) 강화했다. (${STAT_META[stat].label} +${r.to})`); return { ...r, player: done } }
  const specialEnhance = (weaponId, specialId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = specialEnhanceWeapon(playerRef.current, weaponId, specialId, admin); if (r.error) return r; commit(r.player); bridge.quest('enhance', baseIdOf(weaponId)); addLog(`${r.special.title}${itemOf(weaponId).name}에 특수 강화가 붙었다.`); return r }
  const tokenExchange = (baseId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = exchangeGoblinTokens(playerRef.current, baseId, admin); if (r.error) return r; commit(r.player); addLog(`도깨비 증표를 ${r.weapon.name}(으)로 바꿨다.`); return r }
  const removeSpecial = (weaponId) => { if (battleRef.current) return { error: '전투 중이다.' }; const r = removeWeaponSpecial(playerRef.current, weaponId, admin); if (r.error) return r; commit(r.player); addLog(`${itemOf(weaponId)?.name}의 특수 강화를 해제했다.`); return r }

  /** 칭호 기능(덤): 방금 늘어난 물건 가운데 하나를 확률로 하나 더 얻는다. */
  const bonusGain = (prev, next, pct, what) => {
    if (!roll(pct)) return next
    const id = Object.keys(next.inventory ?? {}).find((k) => (next.inventory[k] || 0) > (prev.inventory?.[k] || 0))
    if (!id) return next
    addLog(`칭호의 기능: ${what}에서 ${itemOf(id)?.name ?? id} 하나를 더 얻었다.`)
    return { ...next, inventory: { ...next.inventory, [id]: next.inventory[id] + 1 } }
  }

  // ───── 텃밭 ─────
  const gardenAction = (action) => {
    const cur = playerRef.current
    const r = action.type === 'buy' ? buyGardenSeed(cur, action.seedId, Math.max(1, Math.min(99, Math.floor(Number(action.n) || 1)))) // vD.02 여러 개
      : action.type === 'plant' ? plantGardenSeed(cur, action.slot, action.seedId, Date.now())
        : action.type === 'harvest' ? harvestGardenPlot(cur, action.slot, Date.now())
          : { error: '알 수 없는 텃밭 행동입니다.' }
    if (r.error) { addLog(r.error); return { error: r.error } }
    if (action.type === 'harvest') bump('harvests')
    commit(syncCodex(action.type === 'harvest' ? bonusGain(cur, r.player, perkV('harvestBonus'), '수확') : r.player))
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
        if (action.type === 'enter') { bump('pioneers'); collect('sites', action.siteId); bridge.quest('site', action.siteId) }
        if (action.type === 'attempt') { bump('gathers'); bridge.quest('gather', action.nodeId) }
        const counted = action.type === 'enter' ? npcEvent(bumpDaily(bumpWeekly(result.player, 'pioneer', 1, now), 'pioneer', 1, now), 'pioneer') : action.type === 'attempt' ? bonusGain(cur, result.player, perkV('gatherBonus'), '개척') : result.player
        let withAil = counted, ailGot = []
        if (action.type === 'attempt') { const site = HUNT_SITES[cur.huntExpedition?.siteId]; const ha = huntAilment(counted, site, { finished: counted.huntExpedition?.status === 'finished' }); withAil = ha.player; ailGot = ha.got } // vC.06 개척에서 걸리는 몸의 이상
        const next = commit(syncCodex(withAil))
        if (result.logs?.length) addLogs(result.logs)
        if (ailGot.length) gotText(ailGot, next).forEach(addLog)
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
  // vC.01 영능력(쇠 갉아먹기)으로 상대에게서 앗아온 영력. 승리 횟수로 세지는 않지만, 하루 영력 전투 3번을 다 받은 뒤에는 늘지 않는다.
  const stealSpirit = (n) => {
    const cur = playerRef.current; if (!(n > 0) || !cur) return
    // 하루 영력 전투 3번을 다 받은 뒤에는 앗아와도 내 영력은 늘지 않는다(상대의 영력만 줄어든다) — 하루 제한을 비껴가지 않게.
    if (spiritWinsLeft(cur) <= 0) { addLog(`상대의 영력 ${Math.floor(n)}을(를) 앗았지만, 오늘 전투로 얻는 영력은 모두 받아 흩어져 버렸다.`); return }
    commit({ ...cur, spirit: (cur.spirit || 0) + Math.floor(n) }); addLog(`상대의 영력 ${Math.floor(n)}을(를) 앗아왔다.`)
  }
  globalThis.__BRY_SPIRIT_STEAL = stealSpirit
  // V.01 한 판이 끝나면 전투 화면(Battle.jsx · MultiBattle.jsx)이 그 판의 기록을 넘긴다 → 영능력 얻는 방법을 쌓고, 채우면 준다
  globalThis.__BRY_PSY_STAT = (stat, meta) => {
    const cur = playerRef.current
    if (!cur) return
    const r = notePsyBattle(cur, stat, meta, PSYCHICS)
    if (r.player !== cur) commit(r.player)
    for (const t of r.logs) { addLog(t); bridge.toast?.('영능력', t) }
    if (r.got.length) persist()
  }
  const countWin = (enemy) => {
    bump('battleWins')
    if (!enemy) return
    // vB.03 적의 영능력 빼앗기: 같은 적을 30번(보스는 20번마다) 쓰러뜨리면 그 영능력이 내 것이 된다.
    const st = noteKill(playerRef.current, enemy, Math.random, PSYCHICS)
    if (st.player !== playerRef.current) commit(st.player)
    st.logs.forEach(addLog)
    st.got.forEach((id) => bridge.toast('영능력을 빼앗았다', `「${PSYCHICS.find((p) => p.id === id)?.label ?? id}」 — ${enemy.name}에게서 빼앗았다. 전투의 영능력 목록에서 쓸 수 있다.`))
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
    { const en = result.enemy ?? enemyById(playerRef.current.huntExpedition?.encounter?.enemy?.id); const ab = afterBattleAilment(lost ? { ...vit, weakUntil: Date.now() + WEAK_MS } : vit, en, { lost, hpFrac: vit.hp / (vit.hpMax || 100) }); commit(ab.player); if (ab.got.length) gotText(ab.got, ab.player).forEach(addLog) } // vC.06 몸의 이상
    if (r.logs?.length) addLogs(r.logs)
    if (result.win) { countWin(result.enemy ?? enemyById(playerRef.current.huntExpedition?.encounter?.enemy?.id)); const c1 = playerRef.current; const eid = (result.enemy ?? playerRef.current.huntExpedition?.encounter?.enemy)?.id; commit(npcEvent(npcEvent(bumpDaily(bumpWeekly(eid ? questEvent(c1, { type: 'kill', id: eid }) : c1, 'wins'), 'wins'), 'win'), 'kill', eid)) } // vC.06
    if (lost) { addLog(`${result.enemy?.name ?? '요괴'}에게 쓰러졌다. [쇠약] 모든 육조 스탯이 5할로 줄었다. (6시간)`); wakeInInfirmary() }
  }
  // vC.06 지면 묻지 않고 곧장 양호실에서 눈을 뜬다. (패배 글자가 잠깐 보이도록 0.9초 뒤에 옮긴다)
  const wakeInInfirmary = () => {
    notify('쓰러졌다… 눈을 떠 보니 양호실 침대 위다.')
    setTimeout(() => { addLog('양호실에서 눈을 떴다. 침대에 누워 쉬면 체력과 의지력이 찬다.'); bridge.nav('at/infirmary/rest') }, 900)
  }

  // ───── 전투 ─────
  const soloFoeRef = useRef(null) // vD.06.1 배경음악: 혼자 하는 전투의 상대(보스면 보스 곡)
  const startBattle = (enemyId) => {
    soloFoeRef.current = typeof enemyId === 'object' ? enemyId : enemyById(enemyId)
    interruptAll('새 동작을 시작해')
    const cur = playerRef.current
    battleVitalsRef.current = { hp: cur.hp, mp: cur.mp }
    battleDownedRef.current = false
    battleScannedRef.current = false
    commit({ ...cur, seen: { ...cur.seen, [enemyId]: (cur.seen?.[enemyId] || 0) + 1 } })
    setBattleUsedItems([])
  }
  const finishBattle = ({ win, fled, enemy, hp: endHp }) => {
    if (fled) { bump('fled'); addLog(`${enemy.name}과의 전투에서 물러났다. (보상도 손실도 없다)`); return }
    const cur = playerRef.current
    const special = cur.weaponSpecial?.[equipOf(cur).weapon]
    const r = applyBattleResult({ ...cur, _battleNoScanWin: !battleScannedRef.current }, win, enemy.reward)
    let p = r.player
    // vD.02 내 체력보다 큰 피해로 쓰러지면 마지막 피해가 체력에 들어가지 않던 문제 — 지면 체력 1로 깨어난다
    if (!win) p = { ...p, hp: Math.max(1, Math.min(p.hp, Number.isFinite(endHp) ? Math.ceil(endHp) : 1)) }
    if (win && enemy?.id) p = questEvent(p, { type: 'kill', id: enemy.id })
    if (win) p = npcEvent(npcEvent(bumpDaily(bumpWeekly(p, 'wins'), 'wins'), 'win'), 'kill', enemy?.id) // vC.06 동아리 활동 · 인물의 부탁: 전투 승리(영력을 받든 안 받든)
    if (win && special === 'pine' && !battleDownedRef.current && battleVitalsRef.current) p = { ...p, hp: Math.min(p.hpMax, battleVitalsRef.current.hp), mp: Math.min(p.mpMax, battleVitalsRef.current.mp) }
    delete p._battleNoScanWin
    { const t = p.timed?.winMoney; if (win && t && t.until > Date.now() && (r.money ?? r.granted)) { const add = Math.ceil((r.money ?? r.granted) * (Number(t.v) || 0) / 100); if (add) { p = { ...p, money: (p.money || 0) + add }; setTimeout(() => addLog(`음식의 기운: 전투 보상 +${add}냥.`), 0) } } } // vD.02
    if (win && (r.granted || r.money)) { // vB.04: 냥 덤은 이길 때마다, 영력 덤은 영력을 받은 승리(하루 3번)에만
      const m = Math.ceil((r.money ?? r.granted) * perkV('winMoney') / 100), s = Math.ceil(r.granted * perkV('winSpirit') / 100)
      if (m || s) { p = { ...p, money: (p.money || 0) + m, spirit: (p.spirit || 0) + s }; addLog(`칭호의 기능: 전투 보상 ${[m ? `${m}냥` : '', s ? `영력 ${s}` : ''].filter(Boolean).join(' · ')} 추가.`) }
    }
    if (!win) bump('losses')
    { const ab = afterBattleAilment(p, enemy, { lost: !win, hpFrac: (p.hp || 0) / (p.hpMax || 100) }); if (ab.got.length) { p = ab.player; setTimeout(() => gotText(ab.got, ab.player).forEach(addLog), 0) } } // vC.06 몸의 이상
    commit(p)
    if (win) { bridge.quest('win', enemy?.id); countWin(enemy); addLog(r.granted ? `${enemy.name}을(를) 쓰러뜨렸다! 영력 +${r.granted}, 돈 +${r.granted}냥.` : `${enemy.name}을(를) 쓰러뜨렸다! 돈 +${r.money || 0}냥. (오늘 전투로 얻는 영력 3번은 모두 받았다)`) }
    else { addLog(`${enemy.name}에게 패했다.${r.lost ? ` 영력 -${r.lost}.` : ''} [쇠약] 모든 육조 스탯이 5할로 줄었다. (6시간)`); wakeInInfirmary() }
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
  const onTutorialDone = (key) => { const cur = playerRef.current; if (cur.tutorialDone?.[key]) return; collect('tutorials', key); bridge.quest('tutorial', key); commit({ ...cur, tutorialDone: { ...(cur.tutorialDone ?? {}), [key]: true } }); addLog(`전투 튜토리얼 '${TUTORIAL_LABEL[key] ?? key}'을 마쳤다.`) }
  // vC.05 튜토리얼: 열 때의 체력 · 의지력을 기억해 두고, 튜토리얼 동안에는 100 / 100(최대치)으로 보이게 한다. 닫으면 기억해 둔 값으로 돌아간다.
  //   튜토리얼 전투는 내 실제 체력 · 의지력을 쓰지 않으므로(안에서 100으로 따로 센다), 끝나면 정확히 처음 값으로 돌아간다.
  const onTutorialActive = (on) => {
    const cur = playerRef.current
    if (!cur) return
    if (on && !cur.tutorialSnap) commit({ ...cur, tutorialSnap: { hp: cur.hp, mp: cur.mp }, hp: cur.hpMax, mp: cur.mpMax })
    else if (!on && cur.tutorialSnap) commit(untutor(cur))
  }
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
  const equip = (id) => { if (battleRef.current) return { error: '전투 중에는 장비를 바꿀 수 없다.' }; const r = equipItem(playerRef.current, id); if (r.error) return r; if (!canAddInventory(r.player.inventory)) return { error: '소지품이 가득 찼다. 공간을 확보한 뒤 바꿔 주세요.' }; commit(r.player); addLog(`[${itemOf(id).name}]을(를) 착용했다.`); bridge.quest('equip', baseIdOf(id)); return {} }
  const unequip = (slot) => { if (battleRef.current) return { error: '전투 중에는 장비를 바꿀 수 없다.' }; const cur = playerRef.current; const was = equipOf(cur)[slot]; const r = unequipSlot(cur, slot); if (r.error) return r; if (!canAddInventory(r.player.inventory)) return { error: '소지품이 가득 찼다. 공간을 확보한 뒤 벗어 주세요.' }; commit(r.player); addLog(`[${itemOf(was).name}]을(를) 벗었다.`); return {} }
  const discardItem = (itemId, qty) => { if (battleRef.current) return { error: '전투 중에는 버릴 수 없다.' }; const r = discardInventoryItem(playerRef.current, itemId, qty); if (r.error) return r; commit(r.player); addLog(`${r.name} ${r.amount}개를 버렸다.`); return r }
  const claimInventoryPending = (id, amount) => { const r = claimPending(playerRef.current, id, amount); if (r.error) { notify(r.error); return r }; commit(r.player); addLog(`수령 대기 물품 ${itemOf(id)?.name ?? id} ${amount}개를 소지품에 넣었다.`); return r }
  const bagAction = (a) => {
    if (battleRef.current) return { error: '전투 중에는 가방을 열 수 없다.' }
    const cur = playerRef.current
    if (a.type === 'putSmart') { // vD.02 여러 가방에 들어가는 만큼 넣고, 칸이 모자라 남는 것은 소지품에 그대로(버려지지 않는다)
      let p = cur; const got = [], left = []
      for (const [id, want0] of a.items ?? []) {
        let want = Math.max(0, Math.min(Math.floor(Number(want0) || 0), p.inventory?.[id] || 0)), done = 0
        for (let i = 0; i < bagCount(p) && want > 0; i++) { const k = Math.min(want, bagRoom(bagContents(p, i), id)); if (k > 0) { const r = putInBag(p, i, id, k); if (!r.error) { p = r.player; want -= k; done += k } } }
        if (done) got.push(`${itemOf(id)?.name ?? id} ${done}개`)
        if (want) left.push(`${itemOf(id)?.name ?? id} ${want}개`)
      }
      if (!got.length) { notify(`가방에 칸이 모자란다. (가방 하나에 ${BAG_SLOTS}칸)`); return { error: '가방에 칸이 모자란다.' } }
      commit(p)
      addLog(`가방에 ${got.join(', ')}를 넣었다.${left.length ? ` (칸이 모자라 ${left.join(', ')}는 소지품에 남았다)` : ''}`)
      return { ok: true }
    }
    const r = a.type === 'put' ? putInBag(cur, a.bag, a.id, a.n) : a.type === 'take' ? takeFromBag(cur, a.bag, a.id, a.n) : { error: '알 수 없는 가방 동작' }
    if (r.error) { notify(r.error); return r }
    commit(r.player)
    addLog(`가방${a.bag > 0 ? ` ${a.bag + 1}` : ''}${a.type === 'put' ? '에' : '에서'} ${itemOf(a.id)?.name} ${a.n}개를 ${a.type === 'put' ? '넣었다' : '꺼냈다'}.`)
    return { ok: true }
  }

  /** 아이템 쓰기 (C.01 useItem 의 혼자 하는 부분. 다인 전투 분기는 뺐다.) */
  const useItem = async (id, target, nWant = 1) => {
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
    if (item.effect?.cureOneBs) { // vD.02.1 응급 처치 상자: 걸린 나쁜 상태 하나를 골라 푼다(여럿이면 고른다) · vD.02.3 cureOneBs: 2 면 둘까지
      const max = Math.max(1, Number(item.effect.cureOneBs) || 1)
      const options = bsOptions(cur, battleRef.current ? afflictRef.current.bs : [])
      if (!options.length) { notify('현재는 사용할 필요가 없습니다.'); return }
      const want = target == null ? [] : [].concat(target).flatMap((t) => String(t).split(','))
      const chosen = options.length <= max ? options : options.filter((o) => want.includes(o.key)).slice(0, max)
      if (!chosen.length) { setBsPick({ id, options, max }); return }
      setBsPick(null)
      const pick = { ail: false, key: chosen.map((o) => o.key), label: chosen.map((o) => o.label).join(' · ') }
      if (battleRef.current && afflictRef.current.itemSeal) { notify('주머니를 빼앗겨 지금은 아이템을 쓸 수 없다.'); return }
      let p1 = cur
      const ails = chosen.filter((o) => o.ail).map((o) => o.key), bsKeys = chosen.filter((o) => !o.ail)
      if (ails.length) p1 = cureAilments(p1, ails).player
      const inventory = { ...p1.inventory, [id]: (p1.inventory?.[id] || 0) - 1 }
      if (inventory[id] <= 0) delete inventory[id]
      commit({ ...p1, inventory })
      if (bsKeys.length && battleRef.current) setSoloItemFx({ seq: Date.now() + Math.random(), name: item.name, effect: { cureBs: bsKeys.map((o) => o.key), cureBsLabel: bsKeys.map((o) => o.label.replace(/[[\]]/g, '')).join(' · ') } })
      if (battleRef.current) setBattleUsedItems((arr) => (arr.includes(id) ? arr : [...arr, id]))
      bump('itemsUsed')
      addLog(`${item.name}을(를) 사용했다. (${pick.label} 풀림)`)
      return
    }
    // vD.02 지금 쓸 필요가 없으면 쓰지 않는다 · 여러 개를 한 번에(체력 · 의지력 · 영력 같은 쌓이는 효과만, 필요한 만큼만)
    const e0 = item.effect ?? {}
    {
      const ks = Object.keys(e0).filter((k) => !['onlyBattle', 'oncePerBattle'].includes(k))
      const nowA = Date.now()
      const ailOn = (a) => (cur.ailments?.[a]?.until || 0) > nowA
      const hpFull = (cur.hp || 0) >= (cur.hpMax || 0), mpFull = (cur.mp || 0) >= (cur.mpMax || 0)
      const restoreOnly = ks.length > 0 && ks.every((k) => ['hp', 'mp', 'hpFull', 'mpFull'].includes(k))
      const needHp = e0.hp || e0.hpFull, needMp = e0.mp || e0.mpFull
      const noNeed = (restoreOnly && (!needHp || hpFull) && (!needMp || mpFull))
        || (ks.length > 0 && ks.every((k) => ['cureAil', 'hp', 'mp'].includes(k)) && e0.cureAil && !e0.cureAil.some(ailOn) && (!needHp || hpFull) && (!needMp || mpFull))
        || (ks.length > 0 && ks.every((k) => ['shortenAil'].includes(k)) && !e0.shortenAil.some(ailOn))
        || (ks.length === 1 && (e0.cureWeak || e0.weakCap != null) && !((cur.weakUntil || 0) > nowA))
      if (noNeed && !e0.giveHp && !e0.giveMp) { notify('현재는 사용할 필요가 없습니다.'); return }
    }
    let n = 1
    const STACKABLE = ['hp', 'mp', 'giveHp', 'giveMp', 'spirit', 'sellMoney', 'mpStats', 'hpCost']
    const ONCE = ['weakCap', 'cureWeak', 'cureAil', 'shortenAil', 'ailGuard', 'hpFull', 'mpFull'] // vD.02.2 한 번만 들면 되는 효과(여러 개를 써도 한 번)
    if (!battleRef.current && nWant > 1 && Object.keys(e0).some((k) => STACKABLE.includes(k)) && Object.keys(e0).every((k) => STACKABLE.includes(k) || ONCE.includes(k))) {
      n = Math.max(1, Math.min(Math.floor(nWant), cur.inventory?.[id] || 0))
      const only = Object.keys(e0)
      if (only.every((k) => ['hp', 'mp'].includes(k))) { // 회복만 하는 것은 모자란 만큼만 쓴다
        const need = Math.max(e0.hp ? Math.ceil(Math.max(0, cur.hpMax - cur.hp) / e0.hp) : 0, e0.mp ? Math.ceil(Math.max(0, cur.mpMax - cur.mp) / e0.mp) : 0)
        if (need >= 1 && need < n) { n = need; notify(`필요한 만큼 ${n}개만 썼다.`) }
      }
    }
    const e = n > 1 ? Object.fromEntries(Object.entries(e0).map(([k, v]) => [k, !STACKABLE.includes(k) ? v : typeof v === 'number' ? v * n : k === 'mpStats' ? Array(n).fill(v).flat() : k === 'giveHp' || k === 'giveMp' ? { ...v, self: (v.self || 0) * n } : v])) : e0 // vD.02.2 쌓이는 효과만 n배
    const healOnly = Object.keys(e).every((k) => ['hp', 'mp', 'giveHp', 'giveMp'].includes(k))
    if (battleRef.current && afflictRef.current.itemSeal) { notify('주머니를 빼앗겨 지금은 아이템을 쓸 수 없다.'); return }
    if (battleRef.current && afflictRef.current.healBlock && healOnly && (e.hp || e.giveHp)) { notify('돌림병 탓에 지금은 회복 아이템이 듣지 않는다.'); return }
    if (e0.trainUnder10) { // vD.02.3 숯: 1개 = 10 미만 스탯 +1 · 체력 −30 / 99개 = 어떤 스탯이든 +1 · 체력 −90
      const big = nWant >= 99 && (cur.inventory?.[id] || 0) >= 99
      const n = big ? 99 : 1, cost = big ? 90 : 30
      if (!ENH_STATS.includes(target) || (!big && (cur.stats?.[target] ?? 0) >= 10)) { notify(big ? '올릴 육조를 골라야 한다.' : '스탯이 10 미만인 육조를 골라야 한다. (99개를 한 번에 쓰면 10 이상도 된다)'); return }
      if ((cur.hp || 0) <= cost) { notify(`사용하려면 체력이 ${cost}보다 많아야 한다.`); return }
      const inventory = { ...cur.inventory, [id]: cur.inventory[id] - n }
      if (inventory[id] <= 0) delete inventory[id]
      commit({ ...cur, inventory, hp: cur.hp - cost, stats: { ...cur.stats, [target]: (cur.stats[target] ?? 0) + 1 } })
      addLog(`숯을 ${n}개 사용했다. ${STAT_META[target].label} +1 / 체력 -${cost}.`)
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
    const inventory = { ...cur.inventory, [id]: cur.inventory[id] - n }
    if (inventory[id] <= 0) delete inventory[id]
    const next = commit({ ...cur, ...(buffs ? { buffs } : {}), inventory, hp, mp, money: e.sellMoney ? (cur.money || 0) + e.sellMoney : cur.money, weakUntil, ...(e.spirit ? { spirit: (cur.spirit || 0) + e.spirit } : {}) })
    if (e.spirit) parts.push(`영력 +${(next.spirit || 0) - (cur.spirit || 0)}`)
    if (e.timed) { // vD.02 n분 동안의 기운(같은 기운은 센 쪽 · 긴 쪽으로)
      const c1 = playerRef.current, nowT = Date.now(), k = e.timed.kind
      const t0 = c1.timed?.[k], live = t0 && t0.until > nowT ? t0 : null
      const t = { v: Math.max(Number(e.timed.v) || 0, live?.v || 0), until: Math.max(nowT + (Number(e.timed.min) || 0) * 60000, live?.until || 0) }
      const timed = Object.fromEntries(Object.entries(c1.timed ?? {}).filter(([, x]) => x.until > nowT))
      commit({ ...c1, timed: { ...timed, [k]: t } })
      parts.push(`${e.timed.min}분 동안 ${TIMED_LABEL[k]?.(t.v) ?? k}`)
      if (k === 'hpRegen' || k === 'mpRegen') regenAt.current = Date.now()
    }
    if (e.revive) { setReviveOn(true); parts.push('전투불능 시 1회 부활 대기') }
    if (e.boost) { setBoostOn(true); parts.push('나의 다음 행동 피해 2배 (1턴)') }
    if (e.cureAil || e.shortenAil) { // vC.06 몸의 이상을 낫게 하는 물건
      const c0 = playerRef.current
      const cr = e.cureAil ? cureAilments(c0, e.cureAil) : { player: c0, cured: [] }
      const sh = e.shortenAil ? shortenAilments(cr.player, e.shortenAil) : { player: cr.player, hit: [] }
      commit(sh.player)
      if (e.cureAil) parts.push(cr.cured.length ? `${cr.cured.map(ailLabel).join(' · ')} 나았다` : `${e.cureAil.map(ailLabel).join(' · ')}에 걸려 있지 않았다`)
      if (e.shortenAil) parts.push(sh.hit.length ? `${sh.hit.map(ailLabel).join(' · ')} 남은 시간 5분` : `${e.shortenAil.map(ailLabel).join(' · ')}에 걸려 있지 않았다`)
      if (e.ailGuard) { // vD.02 양호실 물품: 20분 동안 다시 걸리지 않는다
        const c1 = playerRef.current, now1 = Date.now()
        const g = Object.fromEntries(Object.entries(c1.ailGuard ?? {}).filter(([, t]) => t > now1))
        for (const a of e.ailGuard) g[a] = now1 + NURSE_GUARD_MIN * 60000
        commit({ ...c1, ailGuard: g }); parts.push(`${e.ailGuard.map(ailLabel).join(' · ')}에 ${NURSE_GUARD_MIN}분 동안 걸리지 않는다`)
      }
    }
    if (e.cureWeak) parts.push('[쇠약] 즉시 회복')
    else if (e.weakCap != null) parts.push('[쇠약] 남은 시간이 1시간으로 줄었다')
    if (e.sellMoney) parts.push(`${e.sellMoney}냥 획득`)
    if (battleRef.current && (touchesBattleState(e) || e.giveCleanse)) setSoloItemFx({ seq: Date.now() + Math.random(), name: item.name, effect: { enemyHit: e.enemyHit, drainSpirit: e.drainSpirit, reveal: e.reveal, charms: e.charms, cleanse: e.cleanse || e.giveCleanse, dmgCut: e.dmgCut } })
    if (battleRef.current) setBattleUsedItems((arr) => (arr.includes(id) ? arr : [...arr, id]))
    bump('itemsUsed')
    if (roll(perkV('itemSave'))) { const c = playerRef.current; commit({ ...c, inventory: { ...c.inventory, [id]: (c.inventory?.[id] || 0) + 1 } }); addLog(`칭호의 기능: ${item.name}을(를) 아껴 썼다. (줄지 않음)`) }
    addLog(`${item.name}${n > 1 ? ` ${n}개` : ''}을(를) 사용했다. (${parts.length ? parts.join(' · ') : item.effectText})`)
  }

  // ───── 탐사(본관 · 별관 · 뒷산 · 사당) — 초록동색과 같은 처리. 퀘스트만 뺐다. ─────
  const investigate = (floor, area, text) => { interruptAll('새 동작을 시작해'); addLog(`본관 탐사 · ${floor} ${area}: ${text}`) }
  const investigateShrine = (area, label, text) => { interruptAll('새 동작을 시작해'); addLog(`사당 탐사 · ${area} ${label}: ${text}`) }
  globalThis.__BRY_INSPECT = { can: (id) => !!globalThis.BiryeongQuest?.inspectable?.(baseIdOf(id)), run: (id) => bridge.quest('inspect', baseIdOf(id)) }
  // vD.04 탐사 지점을 볼 때마다 [누군가 잃어버린~] 다섯 가지 중 하나를 줍는다 — V.01 안목(보정 포함) 1 → 1%, 40 → 10%
  const lostFind = (key) => {
    const ins = (effectiveStats(playerRef.current) || playerRef.current?.stats || {}).insight
    if (Math.random() >= lostFindChance(ins)) return
    const id = LOST_FIND_ITEMS[Math.floor(Math.random() * LOST_FIND_ITEMS.length)]
    const cur = playerRef.current; if (!cur || !itemOf(id)) return
    if (!canAddInventory(cur.inventory, { [id]: 1 })) { addLog(`발치에 [${itemOf(id).name}]이(가) 떨어져 있었지만, 소지품이 가득 차 줍지 못했다.`); return }
    commit({ ...cur, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + 1 } })
    addLog(`탐사 중 발에 무언가가 채였다. [${itemOf(id).name}]을(를) 주웠다.`)
    bridge.toast('분실물', `[${itemOf(id).name}]을(를) 주웠다.`)
    void key
  }
  const visitSpot = (key) => { bridge.quest('visit', key); collect('spots', key); countsRef.current = { ...countsRef.current, lastSpot: key }; schedule(); const seenWeek = playerRef.current.weekly?.exploreVisited?.[key]; let next = markWeeklySet(playerRef.current, 'exploreVisited', key); if (!(playerRef.current.daily?.visitSet ?? {})[key]) { const d0 = ensureDaily(next); next = { ...d0, daily: { ...d0.daily, visits: (d0.daily.visits || 0) + 1, visitSet: { ...(d0.daily.visitSet ?? {}), [key]: true } } } } void seenWeek; next = npcEvent(next, 'visit', key); if (next !== playerRef.current) commit(next); lostFind(key) } // vC.06 오늘의 할일: 서로 다른 탐사 지점 수
  const lockerMove = (mode, grade, id, n) => {
    const cur = playerRef.current
    const r = mode === 'in' ? deposit(cur, grade, id, n) : withdraw(cur, grade, id, n)
    if (r.error) return r
    commit(r.player); bump('lockerUses')
    addLog(`${grade}학년 물품보관함에 ${itemOf(id)?.name} ${n}개를 ${mode === 'in' ? '맡겼다' : '꺼냈다'}.`)
    return {}
  }
  const lockerOpen = (grade) => {
    const cur = playerRef.current
    if (cur.gymwearGiven) return
    const box = cur.lockers?.[grade] ?? {}
    commit({ ...cur, gymwearGiven: true, lockers: { ...(cur.lockers ?? {}), [grade]: { ...box, gymwear: (box.gymwear || 0) + 1 } } })
    addLog(`${grade}학년 물품보관함 안에서 [${itemOf('gymwear')?.name ?? '무복'}] 한 벌을 발견했다.`)
  }
  const exploreAct = (kind, payload = {}) => {
    const cur = playerRef.current
    const now = Date.now()
    let r
    if (kind === 'waitStart') r = startExploreWait(cur, payload.key, payload.minutes, now)
    else if (kind === 'waitClaim') r = claimExploreWait(cur, payload.key, now)
    else if (kind === 'spendMp') r = spendExploreMp(cur, payload.amount)
    else if (kind === 'goblinPlay') r = goblinPlay(cur, payload, effectiveStats(cur), now)
    else if (kind === 'ricePouch') r = openRicePouches(cur)
    else if (kind === 'shrineSign') r = readShrineSign(cur, cur.stats)
    else if (kind === 'lockerSneak') r = sneakLocker(cur)
    else return { error: '아직 이어지지 않은 행동이다.' }
    if (r.error) return r
    if (kind !== 'shrineSign' && kind !== 'waitClaim') interruptAll('새 동작을 시작해')
    if (r.player && r.player !== cur) commit(syncCodex(r.player))
    if (kind === 'waitStart') addLog(`${payload.label ?? '탐사'}: ${payload.minutes}분을 기다리기 시작했다.`)
    if (kind === 'spendMp') addLog(`의지력 ${payload.amount}을(를) 써서 곧바로 ${payload.reason ?? '시도'}.`)
    if (kind === 'goblinPlay') { bump('goblinPlays'); if (r.win) bump('goblinWins'); addLog(`도깨비들과 ${GOBLIN_GAMES.find((g) => g.id === payload.game)?.name ?? '놀이'} — ${r.win ? '승리' : '패배'}. (${r.notice})`) }
    if (kind === 'ricePouch') addLog(ricePouchText(r.pouches, r.grains))
    if (kind === 'lockerSneak') addLog(`${payload.grade ?? '다른'}학년 물품보관소를 몰래 열어 [${itemOf('someones-bag')?.name ?? '누군가의 가방'}]을 챙겼다. 열쇠는 부러져 사라졌다.`)
    if (kind === 'shrineSign') bridge.quest('shrineSign', 1)
    if (kind === 'shrineSign' && r.first) { bump('shrineSign'); addLog('사당 표지판 아래의 글자를 읽었다. [사당 탐사]가 열렸다.') }
    return r
  }
  const holjjak = (bet, slots, slotIndex) => {
    if (battleRef.current) return { error: '전투 중이다.' }
    const r = playHoljjakGame(playerRef.current, bet, slots, slotIndex, admin)
    if (r.error) return r
    commit(r.player); bump('holjjak')
    addLog(`오광 뽑기 : 참여비 ${r.bet}냥 → ${r.picked.month}월 광 → ${r.payout}냥 (${r.delta >= 0 ? `+${r.delta}` : r.delta}냥)`)
    return r
  }

  // ───── 동아리 (가입 정보는 저장 기록에 담겨 서버로 간다 — 멤버 목록은 서버가 모아 준다 · vD.02.1) ─────
  const [club, setClub] = useState(() => first.counts?.club ?? null)
  globalThis.BiryeongPlayGrade = () => playerRef.current?.grade ?? profileGrade(first.profile) // vD.02.3 동아리 신청서가 본다
  const applyClub = async (clubId, name, grade0, age, hope) => {
    const grade = playerRef.current?.grade ?? profileGrade(first.profile) ?? grade0 // vD.02.3 학년은 프로필 학년으로 못 박는다
    if (countsRef.current.club) return { error: 'already-in-club' }
    const mine = { id: clubId, name, grade, age, hope, joinedAt: Date.now() }
    countsRef.current = { ...countsRef.current, club: mine, clubJoins: (countsRef.current.clubJoins || 0) + 1 }
    setClub(mine); persist()
    try { globalThis.BiryeongAuth?.pushSave?.() } catch { /* 다음 저장 때 */ } // vD.02.1 가입하자마자 서버에도(멤버 목록에 바로 보이게)
    addLog(`${clubOf(clubId)?.name ?? '동아리'}에 가입 신청서를 냈다. 가입 완료.`)
    return { ok: true }
  }
  // vD.02.1 멤버 목록은 서버(모두의 저장 기록)에서 — 닿지 않으면 이 브라우저의 내 가입 정보만
  const fetchClubMembers = async (clubId) => {
    const A = globalThis.BiryeongAuth
    if (A?.call && A.token?.()) {
      try { persist(); await A.pushSave?.() } catch { /* 저장은 다음 기회에 */ }
      try { const r = await A.call('bry_club_members', { p_club: clubId }); if (r?.ok) return r } catch { /* 아래로 */ }
    }
    return ({ ok: true, members: countsRef.current.club?.id === clubId ? [{ id: 'me', name: countsRef.current.club.name, grade: countsRef.current.club.grade, age: countsRef.current.club.age, hope: countsRef.current.club.hope, joinedAt: countsRef.current.club.joinedAt }] : [] })
  }

  // ───── 관리자 (관리자 도구의 '내 수치 고치기' · 아이템 지급) ─────
  const adminApply = (v) => {
    if (!admin) return false
    let next = { ...playerRef.current, stats: { ...playerRef.current.stats, ...(v.stats ?? {}) } }
    for (const k of ['hpMax', 'mpMax', 'hp', 'mp', 'spirit', 'money']) if (Number.isFinite(v[k])) next[k] = v[k]
    next.spirit = Math.min(SPIRIT_MAX, Math.max(0, next.spirit)); next.hp = Math.min(next.hpMax, Math.max(1, next.hp)); next.mp = Math.min(next.mpMax, Math.max(0, next.mp))
    if (v.clearWeak) { const { weakUntil: _w, curseUntil: _c, ...rest } = next; next = rest }
    if (v.acquirePsychic) next = acquirePsychic(next, v.acquirePsychic)
    commit(next); addLog('관리자 도구로 수치를 조정했다.'); persist()
    return true
  }
  const adminGive = (id, n = 1) => {
    if (!admin || !itemOf(id)) return false
    const cur = playerRef.current
    const count = Math.max(1, Math.min(999, Math.floor(n) || 1))
    commit(syncCodex(itemOf(id).slot === 'weapon' && !itemOf(id).inst ? giveWeapon(cur, id).player : { ...cur, inventory: { ...cur.inventory, [id]: (cur.inventory?.[id] || 0) + count } }))
    addLog(`관리자 도구로 [${itemOf(id).name}]을(를) 지급했다.`); persist()
    return true
  }

  // ───── 이야기 전투(퀘스트): 메인 화면의 quest.js 가 상대를 정해 부른다. 어느 페이지에서나 뜬다. ─────
  // 바탕은 추가전투 도감의 같은 단계 '혼자 상대'의 수치. 그 위에 보스 고유 패턴(storyBoss.js)을 얹는다.
  // 이기면 전리품을 받고 그 전리품으로 만드는 제작법이 열린다. 져도 쇠약은 남지 않는다. 끝나면 biryeong:quest(storyBattle) 로 알린다.
  const [storyFight, setStoryFight] = useState(null)
  // vD.06.1 배경음악: 전투가 열리면 일반 전투 곡 · 보스(보관고 보스 · 패턴이 있는 이야기 상대)면 보스 곡. 끝나면 커뮤 곡이 이어진다.
  useEffect(() => {
    const boss = (e) => !!(e && (e.boss || STORY_FOES[e.story?.key]?.pattern))
    const mode = storyFight ? (boss(storyFight.enemy) ? 'boss' : 'battle') : battleActive ? (boss(soloFoeRef.current) ? 'boss' : 'battle') : null
    try { globalThis.BiryeongBgm?.battle?.(mode) } catch { /* 음악 없이 */ }
  }, [storyFight, battleActive])
  const storyBattle = ({ key, tier, i = 0, name, blurb, ctx = {} }) => {
    if (battleRef.current || playerRef.current.sleeping || playerRef.current.training) { notify('지금은 싸울 수 없다. (잠 · 수련 · 다른 전투 중)'); return false }
    const pool = BESTIARY_ENEMIES.filter((e) => e.tier === tier && !e.boss && (e.partySize ?? 1) <= 1)
    const base = pool[Math.min(i, pool.length - 1)] ?? BESTIARY_ENEMIES.find((e) => e.tier === tier)
    if (!base) return false
    // vD.01 죽음을 들은 자: 흐린 영정 조각을 손에 쥐고 들어간다(없으면 이때 받는다) — 싸움에서 [보인다]로 쓴다
    if (key === 'heard' && !((playerRef.current.inventory ?? {})['st-portrait'] > 0) && itemOf('st-portrait')) {
      const cur = playerRef.current
      commit({ ...cur, inventory: { ...cur.inventory, 'st-portrait': 1 } })
      addLog('서울 다세대 주택에서 주운 흐린 영정 조각을 손에 쥐었다. 「죽음을 들은 자」에게 보여 줄 수 있다.')
    }
    const inv = playerRef.current.inventory ?? {}
    const has = Object.fromEntries(STORY_ITEMS.filter((it) => inv[it.id] > 0).map((it) => [it.id, true]))
    setStoryFight({ key, stage: ctx.stage || '', enemy: makeStoryEnemy(base, { key, name, blurb }, { ...ctx, has }), size: storySize(key), npcUsed: !!ctx.npcUsed, first: ctx.first !== false })
    return true
  }
  // vC.06 1인 · 다인: STORY_FOES[key].size, 없으면 패턴이 있는 상대(보스)는 다인, 없는 상대는 1인
  const storySize = () => 3 // vD.02.4 본편 이야기 전투는 모두 3인(빈자리는 연호수 · 윤진서)
  /** vC.07.3 일행 전투: 도깨비들의 터 일행끼리 추가전투 · 실습 상대와 함께 싸운다(StoryParty 의 파티 방식을 그대로 쓴다) */
  const roomFight = (enemyId, join = null) => {
    if (!join && globalThis.BiryeongParty && globalThis.BiryeongParty.isLeader === false) { notify('일행 전투는 파티장만 열 수 있다.'); return } // vD.02
    if (battleRef.current || playerRef.current.sleeping || playerRef.current.training || playerRef.current.slowFight) { notify('지금은 싸울 수 없다. (잠 · 수련 · 느린 싸움 · 다른 전투 중)'); return false }
    const room = globalThis.BiryeongParty?.room
    if (!room?.id) { notify('일행이 없다. [접속자 확인하기]에서 초대해 일행을 만든다.'); return false }
    const enemy = enemyById(enemyId)
    if (!enemy) { notify('그 상대를 찾지 못했다.'); return false }
    setStoryFight({ key: enemy.id, stage: `room:${room.id}`, enemy: { ...enemy }, size: 3, mode: 'room', join, npcUsed: true, first: false })
    return true
  }
  /** vC.06 돕는 선배: 이미 깬 다인 전투의 다른 학생 파티에 다시 들어간다(영력 · 최초 보상 없음, 냥 2배) */
  const storyHelp = ({ key, tier, i = 0, name, blurb, partyId, stage, ctx = {} }) => {
    if (battleRef.current || playerRef.current.sleeping || playerRef.current.training) { notify('지금은 싸울 수 없다. (잠 · 수련 · 다른 전투 중)'); return false }
    if (storySize(key) <= 1) return false
    const pool = BESTIARY_ENEMIES.filter((e) => e.tier === tier && !e.boss && (e.partySize ?? 1) <= 1)
    const base = pool[Math.min(i, pool.length - 1)] ?? BESTIARY_ENEMIES.find((e) => e.tier === tier)
    if (!base) return false
    setStoryFight({ key, stage: stage || '', enemy: makeStoryEnemy(base, { key, name, blurb }, { ...ctx, has: {} }), size: 3, helper: { partyId }, first: false, npcUsed: true })
    return true
  }
  /** 본편 제작법을 연다. 새로 연 것의 [{ id, name }] */
  const unlockRecipes = (ids = []) => {
    const cur = playerRef.current
    const fresh = ids.filter((id) => STORY_RECIPES.some((r) => r.id === id) && !cur.storyRecipes?.[id])
    if (!fresh.length) return []
    commit({ ...cur, storyRecipes: { ...(cur.storyRecipes ?? {}), ...Object.fromEntries(fresh.map((id) => [id, Date.now()])) } })
    const out = fresh.map((id) => ({ id, name: itemOf(STORY_RECIPES.find((r) => r.id === id).result)?.name ?? id }))
    out.forEach((r) => addLog(`새 제작법 「${r.name}」을(를) 배웠다. (${STORY_RECIPES.find((x) => x.id === r.id).place === 'K' ? '조리실' : '공작소'})`))
    return out
  }
  const finishStoryBattle = (result) => {
    const fight = storyFight
    setStoryFight(null)
    if (!fight) return
    const enemy = result.enemy ?? fight.enemy
    const calm = !!enemy?.calmed
    let drop = null, recipes = []
    if (result.cancelled) { persist(); return } // 고르는 창에서 물러났다 — 아무 일도 없었다
    { // vC.07.6 일행 전투가 끝나면: 부활 · 마이쭈 대기는 이 전투로 끝, 끊어진 기합의 띠 · 고독의 저주를 내 몸에도 남긴다
      setReviveOn(false); setBoostOn(false)
      if (result.mb?.headbandUsed) breakHeadband()
      const cu = Number(result.mb?.curseUntil) || 0, cur = playerRef.current
      if (cu > (cur.curseUntil || 0)) commit({ ...cur, curseUntil: cu, weakUntil: Math.max(cur.weakUntil || 0, cu) })
    }
    if (fight.mode === 'room') { // vC.07.3 일행 전투: 보상 · 패배는 혼자 싸울 때와 같다(각자)
      const cur = playerRef.current
      commit({ ...cur, hp: Math.max(result.win ? 1 : 0, Math.min(cur.hpMax, Math.round(result.hp ?? cur.hp))), mp: Math.max(0, Math.min(cur.mpMax, Math.round(result.mp ?? cur.mp))) })
      finishBattle({ win: !!result.win, fled: !!result.fled, enemy: enemyById(fight.key) ?? fight.enemy })
      persist(); return
    }
    if (fight.helper) { // vC.06 돕는 선배: 영력 · 전리품 · 진도 없음, 이기면 냥 2배. 져도 쇠약은 없다.
      const cur = playerRef.current
      let p = { ...cur, hp: Math.max(1, Math.min(cur.hpMax, Math.round(result.hp ?? cur.hp))), mp: Math.max(0, Math.min(cur.mpMax, Math.round(result.mp ?? cur.mp))) }
      if (result.win) {
        const money = 2 * Math.max(1, Math.round(enemy.reward ?? fight.enemy.reward ?? 10))
        p = npcEvent(bumpDaily(bumpWeekly({ ...p, money: (p.money || 0) + money }, 'wins'), 'wins'), 'win')
        commit(p); bump('storyHelps'); addLog(`돕는 선배로 ${enemy.name}을(를) 함께 쓰러뜨렸다. 돈 +${money}냥 (재참여 · 2배). 영력과 최초 보상은 없다.`)
      } else { commit({ ...p, hp: Math.max(Math.ceil(cur.hpMax * 0.3), p.hp) }); addLog(result.fled ? `돕던 전투에서 물러났다.` : `돕던 전투에서 쓰러졌다. 이야기 전투라 쇠약은 남지 않았다.`) }
      persist(); bridge.quest('storyHelp', { key: fight.key, win: !!result.win, name: enemy?.name })
      return
    }
    if (result.spiritStolen > 0) stealSpirit(result.spiritStolen) // vC.01 일행 전투에서 영능력으로 앗아온 영력
    if (result.win) {
      finishBattle({ ...result, enemy })
      if (result.party) { const cur = playerRef.current; commit({ ...cur, hp: Math.max(1, Math.min(cur.hpMax, Math.round(result.hp ?? cur.hp))), mp: Math.max(0, Math.min(cur.mpMax, Math.round(result.mp ?? cur.mp))) }) }
      const d = fight.first === false ? null : dropOf(fight.key) // vC.06 최초 보상은 한 번만
      if (d && itemOf(d[0])) {
        const cur = playerRef.current
        commit({ ...cur, inventory: { ...cur.inventory, [d[0]]: (cur.inventory?.[d[0]] || 0) + d[1] } })
        drop = { id: d[0], n: d[1], name: itemOf(d[0]).name }
        addLog(`전리품: ${drop.name}${d[1] > 1 ? ` ×${d[1]}` : ''}을(를) 얻었다.`)
      }
      recipes = unlockRecipes(bossRecipes(fight.key).map((r) => r.id))
      if (STORY_FOES[fight.key]?.pattern) bump('storyBossWins')
    } else if (result.fled) {
      addLog(`${enemy.name}에게서 물러났다. (이야기 전투는 언제든 다시 할 수 있다)`)
    } else {
      // 이야기 전투는 져도 쇠약 · 영력 손실이 없다. 체력만 바닥에서 조금 추스른다.
      const cur = playerRef.current
      commit({ ...cur, hp: Math.max(Math.ceil(cur.hpMax * 0.3), Math.ceil(result.hp || 0), 1) })
      bump('losses')
      addLog(`${enemy.name}에게 쓰러졌다. 이야기 전투라 쇠약은 남지 않았다. 몸을 추스르고 다시 도전하자.`)
    }
    persist()
    bridge.quest('storyBattle', { key: fight.key, win: !!result.win, fled: !!result.fled, calm, drop, recipes, name: enemy?.name, withNpc: !!result.withNpc })
  }
  /** vC.07.6 보스 전투 슬롯(아이템 3개 · 영능력 2개 조합) 저장 */
  const saveBossSlot = (i, items, psychics) => { commit(__saveBossSlot(playerRef.current, i, items, psychics)); persist() }
  /** 3인 전투에서 쓴 아이템 하나를 소지품에서 뺀다 */
  const spendItem = (id) => { const cur = playerRef.current; const n = cur.inventory?.[id] || 0; if (n <= 0) return false; const inventory = { ...cur.inventory }; if (n <= 1) delete inventory[id]; else inventory[id] = n - 1; commit({ ...cur, inventory }); addLog(`[${itemOf(id)?.name ?? id}]을(를) 썼다.`); return true }
  const spendMp = (amount) => { const cur = playerRef.current; if ((cur.mp || 0) < amount) return false; commit({ ...cur, mp: cur.mp - amount }); return true }

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
    tutorialDone: player.tutorialDone, tutorialRewardTaken: player.tutorialRewardTaken, onTutorialDone, onClaimTutorialReward, onTutorialActive,
  }

  /** 메인 화면(스토리 퀘스트 보상 등)이 주는 것. */
  // vC.07.5 관리자가 고친 상태(서버 우편함으로 온다): 육조 스탯 · 체력 · 의지력 · 영력 · 쇠약 · 몸의 이상
  const adminEdit = (e = {}, by = '관리자') => {
    const cur = playerRef.current
    if (!cur || !e || typeof e !== 'object') return false
    const now = Date.now(), out = []
    let p = { ...cur }
    const num = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null }
    if (e.stats && typeof e.stats === 'object') {
      const st = { ...p.stats }
      for (const k of STAT_KEYS) { const v = num(e.stats[k], 1, 99); if (v != null && v !== Math.floor(st[k] || 0)) { out.push(`${STAT_META[k]?.label ?? k} ${Math.floor(st[k] || 0)}→${v}`); st[k] = v } }
      p.stats = st
    }
    const hpMax = num(e.hpMax, 1, 999); if (hpMax != null && hpMax !== p.hpMax) { out.push(`최대 체력 ${p.hpMax}→${hpMax}`); p.hpMax = hpMax }
    const mpMax = num(e.mpMax, 1, 999); if (mpMax != null && mpMax !== p.mpMax) { out.push(`최대 의지력 ${p.mpMax}→${mpMax}`); p.mpMax = mpMax }
    const hp = num(e.hp, 0, p.hpMax); if (hp != null && hp !== Math.floor(p.hp)) { out.push(`체력 ${Math.floor(p.hp)}→${hp}`); p.hp = hp }
    const mp = num(e.mp, 0, p.mpMax); if (mp != null && mp !== Math.floor(p.mp)) { out.push(`의지력 ${Math.floor(p.mp)}→${mp}`); p.mp = mp }
    const sp = num(e.spirit, 0, 99999); if (sp != null && sp !== Math.floor(p.spirit || 0)) { out.push(`영력 ${Math.floor(p.spirit || 0)}→${sp}`); p.spirit = sp }
    if (e.weak === 'clear' && (p.weakUntil > now || p.curseUntil > now)) { p.weakUntil = 0; p.curseUntil = 0; out.push('[쇠약] 풀림') }
    else if (Number(e.weak) > 0) { p.weakUntil = now + Math.min(240, Number(e.weak)) * 3600000; out.push(`[쇠약] ${Number(e.weak)}시간`) }
    const ail = e.ailments && typeof e.ailments === 'object' ? e.ailments : null
    if (ail) {
      const m = Object.fromEntries(Object.entries(p.ailments ?? {}).filter(([, v]) => v && v.until > now))
      for (const id of ail.clear === 'all' ? Object.keys(m) : Array.isArray(ail.clear) ? ail.clear : []) if (m[id]) { delete m[id]; out.push(`[${AIL[id]?.name ?? id}] 풀림`) }
      for (const [id, v] of Object.entries(ail.set ?? {})) {
        const d = AIL[id]; if (!d) continue
        const minutes = num(v?.minutes, 1, 24 * 60) ?? d.minutes, stack = num(v?.stack, 1, d.max) ?? 1
        m[id] = { until: now + minutes * 60000, stack }; out.push(`[${d.name}${d.max > 1 ? ` ${stack}겹` : ''}] ${minutes}분`)
      }
      p.ailments = m
    }
    // 영능력 하사 · 회수
    const pName = (id) => { const x = PSYCHICS.find((y) => y.id === id); return x?.label ?? x?.name ?? id }
    for (const id of Array.isArray(e.psychicsAdd) ? e.psychicsAdd : []) if (PSYCHICS.some((x) => x.id === id) && !(p.psychics ?? []).includes(id)) { p = acquirePsychic(p, id); out.push(`영능력 《${pName(id)}》 받음`) }
    for (const id of Array.isArray(e.psychicsRemove) ? e.psychicsRemove : []) if ((p.psychics ?? []).includes(id)) { p = { ...p, psychics: p.psychics.filter((x) => x !== id) }; out.push(`영능력 《${pName(id)}》 거둠`) }
    if (!out.length) return true
    commit(p); persist()
    addLog(`${by}이(가) 상태를 고쳤다: ${out.join(' · ')}`)
    return out
  }
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
  /** 본편 유품 무구를 실제로 준다(한 벌, 부모의 손길 = 강화 1). 반환: 무구 이름 */
  const giveHeirloom = (weaponId, enhStat) => {
    if (!itemOf(weaponId)) return null
    const cur = playerRef.current
    const r = giveWeapon(cur, weaponId, enhStat ? { [enhStat]: 1 } : undefined)
    commit(syncCodex({ ...r.player, heirloomWeapon: r.id }))
    addLog(`유품이 무구가 되었다 — [${itemOf(weaponId).name}]을(를) 받았다.${enhStat ? ` (부모의 손길: ${STAT_META[enhStat]?.label ?? enhStat} +1)` : ''}`)
    persist()
    return itemOf(weaponId).name
  }
  const countOfId = (id) => Object.entries(playerRef.current?.inventory ?? {}).reduce((s, [k, n]) => s + (baseIdOf(k) === id ? n : 0), 0) + (baseIdOf(equipOf(playerRef.current ?? {}).weapon ?? '') === id ? 1 : 0)
  /** 퀘스트에서 아이템을 써서 없앤다(무구는 안 받는다). 모자라면 false */
  // vC.06 선물: 물건 · 냥을 한꺼번에 덜어 낸다(모자라면 아무것도 덜지 않는다). 장착한 것은 보낼 수 없다.
  const giveAway = ({ items = {}, money = 0 } = {}) => {
    const cur = playerRef.current
    if (!cur || money < 0 || (cur.money || 0) < money) return false
    const eq = Object.values(equipOf(cur) || {})
    const inv = { ...cur.inventory }
    for (const [id, n] of Object.entries(items)) if (!(n > 0) || (inv[id] || 0) < n || eq.includes(id)) return false
    for (const [id, n] of Object.entries(items)) { inv[id] -= n; if (inv[id] <= 0) delete inv[id] }
    commit({ ...cur, inventory: inv, money: (cur.money || 0) - money })
    persist()
    return true
  }
  const take = (items) => {
    const cur = playerRef.current
    const inv = { ...cur.inventory }
    for (const [id, n] of Object.entries(items)) if ((inv[id] || 0) < n) return false
    for (const [id, n] of Object.entries(items)) { inv[id] -= n; if (inv[id] <= 0) delete inv[id] }
    commit({ ...cur, inventory: inv })
    persist()
    return true
  }
const openTierNow = () => Math.max(1, Math.min(10, Number(globalThis.BiryeongQuest?.extraTier?.()) || 1))
  setAilmentSource(() => playerRef.current) // vC.06 혼자 하는 전투의 라운드 피해가 지금 걸린 몸의 이상을 읽는다
  // vD.05 신수들의 터 — BeastCare.jsx 가 부른다. 상태는 player.beasts(계정 기록과 함께 저장)
  const beastAct = (kind, a = {}) => {
    const cur = playerRef.current, now = Date.now()
    if (!cur) return null
    let r
    if (kind === 'adopt') r = Beasts.adopt(cur, a.kind, a.name, now, { force: !!a.fate }) // vD.06 이벤트 마지막에 고른 운명의 신수는 자람 조건 없이 맡는다
    else if (kind === 'active') r = Beasts.setActive(cur, a.id)
    else if (kind === 'feed') r = countOfId(a.item) > 0 ? Beasts.feed(cur, a.id, a.item, now) : { error: '그 먹이가 소지품에 없다.' }
    else if (kind === 'pet') r = Beasts.pet(cur, a.id, now)
    else if (kind === 'play') r = Beasts.play(cur, a.id, now)
    else if (kind === 'trip') r = Beasts.sendTrip(cur, a.id, a.trip, now)
    else if (kind === 'collect') {
      r = Beasts.collectTrip(cur, a.id, now)
      if (!r.error && r.gain && !canAddInventory(cur.inventory || {}, r.gain)) r = { error: '소지품이 가득 차서 물어 온 것을 받을 수 없다. 자리를 비우고 다시 맞이하자.' }
    } else if (kind === 'greet') { r = Beasts.greet(cur, now); if (!r) return null }
    else return null
    if (r.error) { notify(r.error); return { error: r.error } }
    const next = r.player, inv = { ...(next.inventory || {}) }
    for (const [id, n] of Object.entries(r.take || {})) { inv[id] = (inv[id] || 0) - n; if (inv[id] <= 0) delete inv[id] }
    for (const [id, n] of Object.entries(r.gain || {})) if (itemOf(id)) inv[id] = (inv[id] || 0) + n
    commit({ ...next, inventory: inv })
    if (r.log) addLog(r.log)
    if (r.gain) addLog(`[신수들의 터] 물어 온 것: ${Object.entries(r.gain).map(([id, n]) => `${itemOf(id)?.name ?? id} ×${n}`).join(', ')}`)
    if (r.reward) { const nm = r.player.beasts.list.find((b) => b.id === a.id)?.name ?? ''; grant({ ...r.reward, log: `[신수들의 터] 「${nm}」${Beasts.josa(nm, '이', '가')} ${r.grew}${Beasts.josa(r.grew, '이', '가')} 되었다! 관리인이 보상을 건넨다.` }) }
    persist()
    return { line: r.line, grew: r.grew || null, gain: r.gain || null, reward: r.reward || null }
  }
  bridge.api = player ? {
    upgradeStat, openInventory: () => setInvOpen(true), grant, get player() { return playerRef.current }, statCost: (key) => (playerRef.current?.stats?.[key] ?? 1) * STAT_UPGRADE_COST_PER_POINT, statMax: admin ? 999 : STAT_MAX,
    save: persist, storyBattle, storyHelp, storySize, roomFight, adminEdit, psychicDefs: () => PSYCHICS.map(({ id, name, label, stolen, always }) => ({ id, name: name || label || id, stolen: !!stolen, always: !!always })), ailmentDefs: () => AILMENTS.map(({ id, name, hanja, max, minutes, heavy, effect }) => ({ id, name, hanja, max, minutes, heavy, effect })), enemyName: (id) => enemyById(id)?.name ?? id, spendMp, effStats: () => effStats, giveAway,
    // vC.06 동아리 활동(오늘의 할일 · 이번주에 할일) — 부실에서 ClubQuests.jsx 가 부른다
    clubBoard: (clubId) => boardOf(ensureClubWeek(playerRef.current, clubId, effStats, openTierNow()), clubId),
    adminAilment: (id) => { if (!admin) return false; commit(addAilment(playerRef.current, id)); return true }, // vC.06 관리자 시험용
    // vC.06 인물의 부탁 — 조사 장소의 NpcQuests.jsx · 오른쪽 상태 창(app.js)이 부른다
    npcPlace: (place) => { const e = effStats || playerRef.current.stats; const v = Object.values(e).filter(Number.isFinite); return placeView(playerRef.current, place, v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), openTierNow(), Number(globalThis.BiryeongQuest?.routes?.NPC_QUESTS) === 1, Number(globalThis.BiryeongQuest?.routes?.GOBLIN_QUESTS) === 1) }, // vD.04 관리자가 퀘스트를 공개해야 보인다
    npcActive: () => activeList(playerRef.current).map(({ q, pr, npc }) => ({ id: q.id, npc, title: q.title, where: q.where, goal: npcGoalText(q), cur: pr?.cur ?? 0, need: pr?.need ?? 1, done: !!pr?.done })),
    npcAct: (kind, id) => { const cur = playerRef.current; const r = kind === 'accept' ? acceptQuest(cur, id) : kind === 'abandon' ? abandonQuest(cur, id) : finishQuest(cur, id); if (r.error) { notify(r.error); return null } commit(r.player); addLog(r.log); persist(); return r.line ?? '' },
    clubEnsure: (clubId) => { const cur = playerRef.current; const nx = ensureClubWeek(cur, clubId, effStats, openTierNow()); if (nx !== cur) commit(nx) },
    // V.01 오른쪽 [동아리] 창(app.js): 동아리 목록 · 내 동아리 — 다른 동아리의 할일은 미리 보기(저장하지 않는다)
    psyProgress: (id) => psyProgressOf(playerRef.current, id), // V.01 도감: 영능력 얻는 방법 진행(n회 / n회)
    clubList: () => CLUBS.map(({ id, name, room, floor }) => ({ id, name, room, floor })),
    clubMine: () => countsRef.current.club?.id ?? null,
    clubClaim: (clubId, kind, id) => { const r = claimClub(playerRef.current, clubId, kind, id); if (r.error) { notify(r.error); return false } commit(r.player); addLog(r.log); persist(); return true },
    // vC.06 [현재 상태] 칸: 몸의 이상 + 쇠약
    conditions: () => { const cur = playerRef.current, now = Date.now(); const list = activeAilments(cur, now).map((a) => ({ id: a.id, name: a.def.name, hanja: a.def.hanja, stack: a.stack, max: a.def.max, heavy: a.def.heavy, left: leftText(a.left), effect: a.def.effect, text: a.def.text })); const w = Math.max(cur?.weakUntil || 0, cur?.curseUntil || 0); if (w > now) list.unshift({ id: 'weak', name: WEAK_INFO.name, hanja: WEAK_INFO.hanja, stack: 1, max: 1, heavy: true, left: leftText(w - now), effect: WEAK_INFO.effect, text: WEAK_INFO.text }); for (const [k, t] of Object.entries(cur?.timed ?? {})) if (t.until > now) list.push({ id: `timed-${k}`, good: true, name: '음식의 기운', hanja: '', stack: 1, max: 1, heavy: false, left: leftText(t.until - now), effect: TIMED_LABEL[k]?.(t.v) ?? k, text: '음식을 먹고 기운이 돈다.' }); return list }, // vD.02 음식의 시간 기운도 보인다
    // vB.01: 시간이 드는 행동(느린 싸움 · 수업 대기 · 휴식 · 잠 · 수련 · 제작) 중인가 — 바깥(app.js)이 페이지를 떠나기 전에 묻는다
    busy: () => busyLabel(playerRef.current), busyLeft: () => busyLeftText(playerRef.current), interrupt: (why = '자리를 떠나') => interruptAll(why), // 도감: 안목으로 적 수치를 가린다
    // v1.3 본편: 아이템 이름 · 개수 · 장착한 무구 · 쓰기 · 유품 무구 · 제작법 열기 · 도감
    itemName: (id) => itemOf(id)?.name ?? id, count: countOfId,
    // vD.03 벼룩시장: 물건 설명 · 소지품 칸 · 장착 중인 것
    itemInfo: (id) => { const it = itemOf(id); return it ? { id: it.id, name: it.name, kind: it.kind, desc: it.desc || '', effectText: it.effectText || '', price: it.price ?? null, story: !!(it.storyOnly || String(it.id).startsWith('st-') || (it.tags || []).includes('본편')) } : null },
    beastView: () => Beasts.view(playerRef.current), beastAct, beastFoods: () => [...new Set([...Beasts.FOODS, ...Beasts.KIND_IDS.flatMap((k) => Beasts.KINDS[k].likes)])].filter((id) => countOfId(id) > 0).map((id) => ({ id, name: itemOf(id)?.name ?? id, n: countOfId(id) })),
    canAdd: (items) => canAddInventory(playerRef.current?.inventory || {}, items), equippedIds: () => Object.values(equipOf(playerRef.current) || {}).filter(Boolean), equippedBase: () => baseIdOf(equipOf(playerRef.current).weapon ?? '') || null,
    tutorialCount: () => Object.keys(playerRef.current?.tutorialDone ?? {}).length, // 본편: [전투 안내] 몇 단계까지 마쳤나
    heirloomEnh: () => { const cur = playerRef.current; const id = cur?.heirloomWeapon; return id ? enhTotal(cur, id) : 0 }, // 본편: 유품 무구 강화 수
        take, giveHeirloom, unlockRecipes, equip, heirloomWeapon: () => { const cur = playerRef.current; const id = cur?.heirloomWeapon; return id && (cur.inventory?.[id] || equipOf(cur).weapon === id) ? id : null }, knows: (id) => !!playerRef.current?.storyRecipes?.[id],
    storyDex: () => ({
      items: STORY_ITEMS.map((it) => ({ id: it.id, name: it.name, kind: it.kind, tags: it.tags ?? [], text: it.effectText || '', desc: it.desc, have: countOfId(it.id) })),
      recipes: STORY_RECIPES.map((r) => ({ id: r.id, name: itemOf(r.result)?.name ?? r.result, place: r.place, unlock: r.unlock, open: !!playerRef.current?.storyRecipes?.[r.id] })),
    }),
    admin: admin ? { apply: adminApply, give: adminGive, psychics: PSYCHICS.map((p) => ({ id: p.id, label: p.label })), items: ITEMS.map((i) => ({ id: i.id, name: i.name })), spiritMax: SPIRIT_MAX } : null,
  } : null

  return {
    bsPick, setBsPick, bsOptions, cureAilOne,
    profile, player, admin, club, effStats, logs, storyFight, finishStoryBattle, roomFight, spendItem, saveBossSlot, notice, toasts, setToasts, invOpen, setInvOpen, confirm, setConfirm, battleActive,
    reviveOn, boostOn, battleUsedItems, notify, addLog,
    handlers: {
      beginTraining, endTraining, beginSleep, endSleep, beginRest, endRest, upgradeStat,
      lessonActions, setSkin2048, setSkinRunner, lessonOf: (id) => lessonOf(playerRef.current, id),
      buyItem, nurseBuy, buyRecipe, sellToStore, craftItem, endCraft, cookItem, benchCraftAct, knownCraftAct,
      enhance, specialEnhance, tokenExchange, removeSpecial, gardenAction, huntAction, finishHuntBattle, finishBattle,
      investigate, investigateShrine, visitSpot, lockerMove, lockerOpen, exploreAct, holjjak, applyClub, fetchClubMembers, adminGive,
      meetNpc, lineSeen, giveNpc, equip, unequip, discardItem, claimInventoryPending, bagAction, useItem,
    },
    battleProps,
  }
}
