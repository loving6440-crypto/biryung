// 비령 vault — 활동 횟수 기록(주간 · 일간 카운터)만 남긴 파일.
// 초록동색 C.01 의 clubQuests.js(동아리 주간 퀘스트)에서 '퀘스트 목록 · 보상 · 수령'은 빼고,
// 다른 시스템이 같이 쓰던 카운터(player.weekly / player.daily)만 옮겼다. 퀘스트를 새로 만들면 이 카운터를 읽어 쓰면 된다.
// 퀘스트 연결 자리: setWeekInit(fn) — 새 주가 시작될 때 weekly 에 덧붙일 값.
let WEEK_INIT = null
export function setWeekInit(fn) {
  WEEK_INIT = fn
}
const KST_MS = 9 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

/** 이 시각이 속한 주의 시작(월요일 00:00 KST)의 UTC ms. 서버의 랭킹 주차 계산과 똑같다. */
export const weekStartOf = (now = Date.now()) => {
  const k = now + KST_MS
  const dow = new Date(k).getUTCDay() // 0=일
  const sinceMon = (dow + 6) % 7
  return Math.floor(k / DAY_MS) * DAY_MS - sinceMon * DAY_MS - KST_MS
}

const BLANK_WEEKLY = () => ({
  weekStart: 0,
  craft: 0,
  enhance: 0,
  battleReward: 0,
  lesson: 0,
  nurseRest: 0,
  nurseCounsel: 0,
  trainMs: 0,
  shopBuy: 0,
  pioneer: 0, // v-B.01: 개척 터에 들어간 횟수
  kills: {}, // v-B.18: 이번 주에 쓰러뜨린 적 (적 id → 횟수)
  newsDays: {},
  exploreVisited: {},
  claimed: {},
})

/** 이 시각이 속한 날의 시작(매일 00:00 KST)의 UTC ms. */
export const dayStartOf = (now = Date.now()) =>
  Math.floor((now + KST_MS) / DAY_MS) * DAY_MS - KST_MS

const BLANK_DAILY = () => ({
  dayStart: 0,
  craft: 0,
  gather: 0,
  pioneer: 0, // v-B.01: 개척 터에 들어간 횟수
  battleReward: 0,
  lesson: 0,
  newsDone: false,
  claimed: {},
})

/** 하루가 바뀌었으면(또는 처음이면) player.daily 를 새로 비운다. */
export function ensureDaily(player, now = Date.now()) {
  const ds = dayStartOf(now)
  if (player.daily?.dayStart === ds) return player
  return { ...player, daily: { ...BLANK_DAILY(), dayStart: ds } }
}

/** 오늘의 동아리 활동 숫자 카운터를 하나 늘린다. */
export function bumpDaily(player, key, amount = 1, now = Date.now()) {
  const p = ensureDaily(player, now)
  return { ...p, daily: { ...p.daily, [key]: (p.daily[key] || 0) + amount } }
}

/** 오늘의 동아리 활동 불리언(한 번만 하면 되는) 카운터를 켠다. */
export function markDaily(player, key, now = Date.now()) {
  const p = ensureDaily(player, now)
  if (p.daily[key]) return p
  return { ...p, daily: { ...p.daily, [key]: true } }
}

/** 주가 바뀌었으면(또는 처음이면) player.weekly 를 새로 비운다. */
export function ensureWeekly(player, now = Date.now()) {
  const ws = weekStartOf(now)
  if (player.weekly?.weekStart === ws) return player
  return { ...player, weekly: { ...BLANK_WEEKLY(), weekStart: ws, ...(WEEK_INIT?.(player) ?? {}) } }
}

/** 숫자 카운터를 하나 늘린다(craft · battleReward · lesson · nurseRest · nurseCounsel · shopBuy · trainMs). */
export function bumpWeekly(player, key, amount = 1, now = Date.now()) {
  const p = ensureWeekly(player, now)
  return { ...p, weekly: { ...p.weekly, [key]: (p.weekly[key] || 0) + amount } }
}

/** 집합형 카운터에 값을 하나 추가한다(newsDays 는 날짜 문자열, exploreVisited 는 장소 id). */
export function markWeeklySet(player, key, value, now = Date.now()) {
  const p = ensureWeekly(player, now)
  if (p.weekly[key]?.[value]) return p
  return { ...p, weekly: { ...p.weekly, [key]: { ...p.weekly[key], [value]: true } } }
}

// 탐사해야 하는 장소들(본관 · 별관 · 산=뒷산 각각에 있는, 지금 해금된 모든 하위 장소).
// EXPLORE_AREA_SPOTS 는 locationId(mainHall/annex/shrine) → 그 안의 세부 장소 id 배열. src/game/explore.js 에서 채운다.
export let EXPLORE_AREA_SPOTS = { mainHall: ['mainHall'], annex: ['annex'], shrine: ['shrine'] }
export function setExploreAreaSpots(map) {
  EXPLORE_AREA_SPOTS = map
}
export const EXPLORE_SPOTS = ['mainHall', 'annex', 'shrine'] // (구) 지역 단위 — 하위 호환용

/** (퀘스트 자리) 퀘스트 시스템이 없으므로 주간 기록만 맞춰 두고 아무것도 지급하지 않는다. */
export function checkClubQuests(player, now = Date.now()) {
  return { player: ensureWeekly(player, now), logs: [] }
}

/** (퀘스트 자리) 적 처치 · 방문 같은 사건. 퀘스트가 없으므로 이번 주 처치 수만 센다. */
export function questEvent(p, ev, now = Date.now()) {
  if (ev?.type !== 'kill' || !ev.id) return p
  const next = ensureWeekly(p, now)
  const w = next.weekly
  return { ...next, weekly: { ...w, kills: { ...(w.kills ?? {}), [ev.id]: ((w.kills ?? {})[ev.id] || 0) + 1 } } }
}
