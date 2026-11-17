// 비령 vC.01 — 추가전투 난이도 재조정(주 단위 공개 기준).
//
// 추가전투는 한 주에 한 단계씩 열린다(1주차 1단계 → 10주차 10단계). 그 주에 「꾸준히 하는 학생」이 닿을 스탯에 맞춘다.
//   하루 영력 ≈ 자연 회복 70 + 수업 75 + 전투 3번 + 잠 · 수련 → 한 주에 대략 1,300~2,400, 점복학으로 스탯 +5~7.
//   스탯 1 올리는 값 = 지금 수치 × 10 이므로, 모든 스탯을 N 으로 맞추는 데 드는 영력 ≈ 30·N·(N−1).
//   → 단계가 열리는 주의 모든 스탯: 3 → 8 → 12 → 15 → 18 → 21 → 24 → 27 → 30 → 33
// 1~5단계는 원래 기준(3~4 · 6~8 · 10 · 15 · 18~20)이 이 곡선과 맞아 그대로 둔다.
// 6~10단계는 원래 29~30 · 39~40 · 45~47 · 50 · 60 기준이라, 그 주에는 닿을 수 없다 → 새 기준에 맞춰 체력 · 공격력 · 행동력 · 영력을 같은 비율로 줄인다.
//   (원래 표에서 적의 체력 ≈ 기준 스탯 × 14, 공격력 ≈ 기준 스탯 × 1.4 로 기준 스탯에 거의 비례한다. 영능력 피해는 영력 · 공격력의 비율로 적혀 있어 함께 줄어든다.)
export const TIER_REC = { 6: '21~22', 7: '24~25', 8: '27~28', 9: '30', 10: '33~35' }
export const TIER_SCALE = { 6: 21.5 / 29.5, 7: 24.5 / 39.5, 8: 27.5 / 46, 9: 30 / 50, 10: 34 / 60 }

const DONE = Symbol.for('biryeong.tierScale')
/** 적 한 마리를 그 자리에서 고친다(두 번 불러도 한 번만). reward(영력 × 2)도 다시 맞춘다. */
export function rescaleEnemy(e) {
  const f = TIER_SCALE[e?.tier]
  if (!f || e[DONE]) return e
  Object.defineProperty(e, DONE, { value: true, enumerable: false })
  const r = (v) => Math.max(1, Math.round(v * f))
  e.hp = r(e.hp); e.atk = r(e.atk); e.act = r(e.act); e.spirit = r(e.spirit)
  if (e.reward != null) e.reward = e.spirit * 2
  if (e.grows?.atkPerStage) e.grows = { ...e.grows, atkPerStage: Math.max(1, Math.round(e.grows.atkPerStage * f)) }
  e.rec = TIER_REC[e.tier]
  return e
}
