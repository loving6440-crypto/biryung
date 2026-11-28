// 비령 vD.04 — 탐사 지점을 볼 때마다 [누군가 잃어버린~] 분실물을 주울 확률.
// 다섯 가지가 똑같이 나눈다(V.01: 확률은 안목에 따라 1% ~ 10%). 이동 중 줍기(travelEvents.js)는 비령에서 쓰지 않는다.
export const LOST_FIND_CHANCE = 0.01
// V.01 안목이 높을수록 잘 줍는다: 안목 1 → 1%, 안목 40(최고) → 10%. 그 사이는 고르게(안목 1 오를 때마다 약 0.23%p).
export const LOST_FIND_MAX = 0.1
export const LOST_STAT_MAX = 40
export function lostFindChance(insight) {
  const v = Math.max(1, Math.min(LOST_STAT_MAX, Number(insight) || 1))
  return LOST_FIND_CHANCE + (LOST_FIND_MAX - LOST_FIND_CHANCE) * (v - 1) / (LOST_STAT_MAX - 1)
}
export const LOST_FIND_ITEMS = ['lost-hairband', 'lost-slippers', 'lost-love-letter', 'lost-phone', 'lost-key']
