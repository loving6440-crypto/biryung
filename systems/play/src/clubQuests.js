// 비령 vC.06 — 동아리 활동: [오늘의 할일](매일 0시 KST) · [이번주에 할일](월요일 0시 KST).
// 가입한 동아리의 부실(별관)에 가면 보인다. 보상은 달성한 뒤 [보상 받기]를 눌러 받는다.
//
// 세는 것(player.daily · player.weekly — 보관고 activityCounters.js 의 칸을 그대로 쓴다)
//   craft 제작 · 조리 / pioneer 개척 터에 들어간 수 / lesson 수업 완료(미니게임으로 끝내든 30분을 기다리든) /
//   wins 전투 승리(직접 싸우기 · 느린 싸움 · 개척 중 요괴 — 영력을 받는 하루 3번과 상관없이) / enhance 무구 강화 / shopBuy 매점 구매 /
//   nurseRest · nurseCounsel 양호실 / trainMs 기숙사 수련 / exploreVisited 이번 주 살핀 탐사 지점 / visits 오늘 살핀 탐사 지점 수 / kills 적별 승리
// 동아리별 납품 · 토벌: 그 주에 처음 부실을 열 때 내 육조 스탯(보정 포함 평균)과 「지금 열린 추가전투 단계」에 맞춰 정한다.
//   토벌 대상은 열린 단계의 추가전투 적에서만, 납품 물건은 그 수준의 개척 터에서 나는 재료에서 고른다.
import { ensureDaily, ensureWeekly } from '@vault/game/activityCounters.js'
import { clampSpirit } from '@vault/game/constants.js'
import { BESTIARY_ENEMIES } from '@vault/game/battle.js'
import { HUNT_SITES, HUNT_SPECIES } from '@vault/game/huntSites.js'
import { itemOf } from '@vault/game/items.js'
import { TIER_REC } from './tierScale.js'

const REC = [0, 4, 8, 12, 16, 20, 25, 30, 36, 43, 50]
/** 보정 포함 육조 평균 → 그 수준의 단계(1~10), 열린 단계를 넘지 않는다 */
export function levelTier(avg, openTier = 1) {
  let t = 1
  for (let i = 1; i <= 10; i++) if (avg >= REC[i] * 0.9) t = i
  return Math.max(1, Math.min(openTier, t))
}
const avgStat = (stats) => { const v = Object.values(stats ?? {}).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 1 }
const mult = (t, per) => 1 + per * (t - 1)
const R = (money, spirit, item) => ({ ...(money ? { money } : {}), ...(spirit ? { spirit } : {}), ...(item ? { item } : {}) })
const scale = (r, t, per = 0.35) => R(r.money ? Math.round(r.money * mult(t, per) / 5) * 5 : 0, r.spirit ? Math.round(r.spirit * mult(t, per)) : 0, r.item)

const TRAIN_GOAL_MS = 3 * 3600 * 1000
const n = (v) => Number(v) || 0
const count = (w, k) => (k === 'nurse' ? n(w.nurseRest) + n(w.nurseCounsel) : k === 'explore' ? Object.keys(w.exploreVisited ?? {}).length : n(w[k]))

export const WEEKLY = [
  { id: 'craft5', label: '공작소 · 조리실에서 5번 만들기', key: 'craft', goal: 5, reward: R(30) },
  { id: 'pioneer10', label: '개척 10번 나가기', key: 'pioneer', goal: 10, reward: R(30) },
  { id: 'enhance2', label: '무구를 2번 강화하기', key: 'enhance', goal: 2, reward: R(20) },
  { id: 'win10', label: '전투에서 10번 이기기 (직접 · 느린 싸움 · 개척 모두)', key: 'wins', goal: 10, reward: R(40, 10) },
  { id: 'win21', label: '전투에서 21번 이기기', key: 'wins', goal: 21, reward: R(60, 30) },
  { id: 'lesson10', label: '수업 10번 마치기 (미니게임 · 30분 대기 모두)', key: 'lesson', goal: 10, reward: R(20, 5) },
  { id: 'lesson20', label: '수업 20번 마치기', key: 'lesson', goal: 20, reward: R(30, 10) },
  { id: 'lesson35', label: '수업 35번 마치기', key: 'lesson', goal: 35, reward: R(50, 30) },
  { id: 'nurse7', label: '양호실에서 휴식 · 상담 합쳐 7번', key: 'nurse', goal: 7, reward: R(10, 0, 'nutrient') },
  { id: 'train3h', label: '기숙사에서 모두 3시간 수련하기', key: 'trainMs', goal: TRAIN_GOAL_MS, reward: R(0, 20), fmt: (v) => `${Math.floor(v / 60000)}분 / 180분` },
  { id: 'shop2', label: '매점에서 2번 사기', key: 'shopBuy', goal: 2, reward: R(20) },
  { id: 'explore10', label: '이번 주에 서로 다른 탐사 지점 10곳 살피기', key: 'explore', goal: 10, reward: R(20, 10) },
]
export const DAILY = [
  { id: 'd_craft1', label: '공작소 · 조리실에서 1번 만들기', key: 'craft', goal: 1, reward: R(10) },
  { id: 'd_pioneer2', label: '개척 2번 나가기', key: 'pioneer', goal: 2, reward: R(10) },
  { id: 'd_win2', label: '전투에서 2번 이기기', key: 'wins', goal: 2, reward: R(10) },
  { id: 'd_lesson3', label: '수업 3번 마치기', key: 'lesson', goal: 3, reward: R(10) },
  { id: 'd_visit3', label: '탐사 지점 3곳 살피기', key: 'visits', goal: 3, reward: R(10) },
]
export const DAILY_META = { id: 'd_all', label: '오늘의 할일 5개를 모두 받기', reward: R(20, 10) }
export const WEEKLY_META = [
  { id: 'club5', label: '이번주에 할일 5개 받기', need: 5, reward: R(20, 10) },
  { id: 'club10', label: '이번주에 할일 10개 받기', need: 10, reward: R(40, 20) },
  { id: 'club14', label: '이번주에 할일 14개 모두 받기', need: 14, reward: R(80, 50) },
]

// ── 동아리별 납품 · 토벌 ──
const CLUB_FLAVOR = {
  martial: { deliver: '무예 동아리 부실의 보조기기를 손볼', hunt: '무예 동아리가 대련 상대로 점찍은' },
  craft: { deliver: '미술 동아리가 부적 그림에 쓸', hunt: '미술 동아리의 그림을 찢어 놓은' },
  music: { deliver: '음악 동아리가 악기를 고칠', hunt: '음악 동아리의 연주를 방해한' },
  board: { deliver: '판놀이 동아리가 새 판을 만들', hunt: '판놀이 동아리의 패를 훔쳐 간' },
  broadcast: { deliver: '방송 동아리가 장비를 감쌀', hunt: '방송 동아리의 전파를 어지럽힌' },
  cook: { deliver: '요리 동아리가 이번 주 식단에 쓸', hunt: '요리 동아리의 식재료 창고를 노린' },
}
function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
const hashStr = (t) => { let x = 2166136261; for (const c of String(t)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619) } return x >>> 0 }

function pickHunt(tier, rnd) {
  const pool = BESTIARY_ENEMIES.filter((e) => e.tier === tier && !e.boss)
  const any = pool.length ? pool : BESTIARY_ENEMIES.filter((e) => (e.tier ?? 1) <= tier && !e.boss)
  const e = any[Math.floor(rnd() * any.length)]
  return e ? { enemy: e.id, n: tier <= 3 ? 5 : 3 } : null
}
function pickDeliver(avg, rnd) {
  // 그 수준(평균 스탯) 이하에서 가장 높은 개척 터 둘 중 하나의 재료
  const sites = Object.values(HUNT_SITES).filter((s) => Number.isFinite(s.targetStat) && s.nodes?.length).sort((a, b) => a.targetStat - b.targetStat)
  const fit = sites.filter((s) => s.targetStat <= Math.max(4, avg))
  const near = (fit.length ? fit : sites.slice(0, 1)).slice(-2)
  const site = near[Math.floor(rnd() * near.length)]
  const items = new Set()
  for (const nd of site?.nodes ?? []) if (nd.kind === 'plant' || nd.kind === 'animal') for (const r of HUNT_SPECIES[nd.species]?.rewards ?? []) if (itemOf(r.item)?.kind === 'material') items.add(r.item)
  const list = [...items]
  const item = list[Math.floor(rnd() * list.length)]
  return item ? { item, n: 3 + Math.floor(rnd() * 3), site: site.name } : null
}
/** 이번 주의 납품 · 토벌을 정한다(이미 정했으면 그대로). eff: 보정 포함 스탯, openTier: 열린 추가전투 단계 */
export function ensureClubWeek(player, clubId, eff, openTier = 1, now = Date.now()) {
  let p = ensureWeekly(player, now)
  const w = p.weekly
  if (w.club?.id === clubId && w.club.tier) return p
  const avg = avgStat(eff ?? p.stats)
  const tier = levelTier(avg, openTier)
  const rnd = seeded(hashStr(`${w.weekStart}:${clubId}:${p.name ?? ''}`))
  const club = { id: clubId, tier, avg: Math.round(avg), deliver: pickDeliver(avg, rnd), hunt: pickHunt(tier, rnd) }
  return { ...p, weekly: { ...w, club } }
}
const enemyName = (id) => BESTIARY_ENEMIES.find((e) => e.id === id)?.name ?? id
export function clubTasks(w, clubId) {
  const c = w.club, f = CLUB_FLAVOR[clubId] ?? { deliver: '동아리에서 쓸', hunt: '동아리를 괴롭힌' }
  if (!c) return []
  const t = c.tier
  const out = []
  if (c.deliver) out.push({ id: 'deliver', label: `${f.deliver} [${itemOf(c.deliver.item)?.name ?? c.deliver.item}] ${c.deliver.n}개 납품하기`, note: `${c.deliver.site ?? '개척 터'}에서 난다 · 받을 때 소지품에서 빠진다`, deliver: c.deliver, reward: scale(R(40, 10), t, 0.5) })
  if (c.hunt) out.push({ id: 'hunt', label: `${f.hunt} [${enemyName(c.hunt.enemy)}] ${c.hunt.n}번 쓰러뜨리기`, note: `추가전투 ${t}단계 · 권장 스탯 ${TIER_REC[t] ?? ''}`, hunt: c.hunt, reward: scale(R(50, 15), t, 0.5) })
  return out
}

/** 화면에 보일 목록 { daily: [...], dailyMeta, weekly: [...], weeklyMeta: [...], tier } — 각 칸 { id, label, cur, goal, done, claimed, reward, text } */
export function boardOf(player, clubId, inventory = player?.inventory ?? {}, now = Date.now()) {
  const p = ensureWeekly(ensureDaily(player, now), now)
  const d = p.daily, w = p.weekly, t = w.club?.tier ?? 1
  const row = (q, box, per) => { const cur = count(box, q.key); return { ...q, cur: Math.min(cur, q.goal), done: cur >= q.goal, claimed: !!box.claimed?.[q.id], reward: scale(q.reward, t, per), text: q.fmt ? q.fmt(Math.min(cur, q.goal)) : `${Math.min(cur, q.goal)} / ${q.goal}` } }
  const daily = DAILY.map((q) => row(q, d, 0.25))
  const tasks = clubTasks(w, clubId).map((q) => {
    if (q.deliver) { const have = inventory[q.deliver.item] || 0; return { ...q, cur: Math.min(have, q.deliver.n), goal: q.deliver.n, done: have >= q.deliver.n, claimed: !!w.claimed?.[q.id], text: `가진 수 ${have} / ${q.deliver.n}` } }
    const k = n(w.kills?.[q.hunt.enemy]); return { ...q, cur: Math.min(k, q.hunt.n), goal: q.hunt.n, done: k >= q.hunt.n, claimed: !!w.claimed?.[q.id], text: `${Math.min(k, q.hunt.n)} / ${q.hunt.n}` }
  })
  const weekly = [...WEEKLY.map((q) => row(q, w, 0.35)), ...tasks]
  const dGot = DAILY.filter((q) => d.claimed?.[q.id]).length
  const wGot = weekly.filter((q) => w.claimed?.[q.id]).length
  return {
    tier: t, avg: w.club?.avg,
    daily, dailyMeta: { ...DAILY_META, reward: scale(DAILY_META.reward, t, 0.25), cur: dGot, goal: DAILY.length, done: dGot >= DAILY.length, claimed: !!d.claimed?.[DAILY_META.id] },
    weekly, weeklyMeta: WEEKLY_META.map((m) => ({ ...m, reward: scale(m.reward, t, 0.35), cur: Math.min(wGot, m.need), goal: m.need, done: wGot >= m.need, claimed: !!w.claimed?.[m.id] })),
  }
}
export const rewardText = (r) => [r?.money ? `${r.money}냥` : '', r?.spirit ? `영력 ${r.spirit}` : '', r?.item ? `[${itemOf(r.item)?.name ?? r.item}]` : ''].filter(Boolean).join(' · ')

/** 보상 받기. kind: 'daily' | 'dailyMeta' | 'weekly' | 'weeklyMeta' */
export function claimClub(player, clubId, kind, id, now = Date.now()) {
  let p = ensureWeekly(ensureDaily(player, now), now)
  const b = boardOf(p, clubId, p.inventory, now)
  const list = kind === 'daily' ? b.daily : kind === 'dailyMeta' ? [b.dailyMeta] : kind === 'weekly' ? b.weekly : b.weeklyMeta
  const q = list.find((x) => x.id === id)
  if (!q || q.claimed || !q.done) return { error: '아직 받을 수 없다.' }
  const box = kind.startsWith('daily') ? 'daily' : 'weekly'
  let inv = p.inventory
  if (q.deliver) { inv = { ...inv, [q.deliver.item]: (inv[q.deliver.item] || 0) - q.deliver.n }; if (inv[q.deliver.item] <= 0) delete inv[q.deliver.item] }
  const r = q.reward
  if (r.item) inv = { ...inv, [r.item]: (inv[r.item] || 0) + 1 }
  p = clampSpirit({ ...p, inventory: inv, money: (p.money || 0) + (r.money || 0), spirit: (p.spirit || 0) + (r.spirit || 0), [box]: { ...p[box], claimed: { ...p[box].claimed, [id]: true } } })
  return { player: p, log: `동아리 활동 · ${kind.startsWith('daily') ? '오늘의 할일' : '이번주에 할일'}: [${q.label}] 보상 — ${rewardText(r)}` }
}
