// 비령 vB.04 — 하루에 전투로 영력을 얻는 횟수는 모든 전투(퇴마 실습 · 추가전투 · 개척 중 조우 · 수렵 · 느린 싸움 · 본편 전투)를 통틀어 3번.
// 냥(돈)은 몇 번을 싸워도 받는다. 횟수는 player.gym = { day, wins } 한 곳에 센다.
export const SPIRIT_WINS_PER_DAY = 3
export const dayKeyOf = (now = Date.now()) => { const d = new Date(now), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
export const spiritWinsToday = (player, now = Date.now()) => (player?.gym?.day === dayKeyOf(now) ? player.gym.wins || 0 : 0)
export const spiritWinsLeft = (player, now = Date.now()) => Math.max(0, SPIRIT_WINS_PER_DAY - spiritWinsToday(player, now))
/** 영력을 받은 승리를 한 번 센다 */
export const countSpiritWin = (player, now = Date.now()) => ({ ...player, gym: { day: dayKeyOf(now), wins: spiritWinsToday(player, now) + 1 } })
