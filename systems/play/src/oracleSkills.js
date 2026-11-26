/** Chapter 4 boss-only psychic abilities. The boss casts these as actual turns,
 * rather than applying them as invisible passive time effects.
 * The sheet specifies each skill's effect; the 3-round reuse period for
 * 절대신탁 is retained from the previous battle balance rule.
 */
export const ERROR_BOSS_SKILLS = Object.freeze([
  { id: 'oracle', name: '신탁', when: '첫 행동', desc: '시곗바늘을 23시 17분으로 뛰어넘긴다. 이후 공격력 2배' },
  { id: 'absolute-oracle', name: '절대신탁', when: '3라운드마다', desc: '23시 17분으로 되감아 직전 라운드에 받은 피해를 되돌린다' },
])
export function errorBossSkillAt(round) {
  if (round === 1) return ERROR_BOSS_SKILLS[0]
  if (round > 1 && round % 3 === 0) return ERROR_BOSS_SKILLS[1]
  return null
}
export function prepareErrorBossMove(mb) {
  if (mb?.story?.p !== 'oracle' || !Array.isArray(mb.queue) || !mb.queue.length) return null
  // Clear the old random special-skill intents of the base enemy.
  mb.queue = mb.queue.map((q) => q === 'special' ? 'jab' : q)
  const skill = errorBossSkillAt(mb.round)
  if (skill) mb.queue[0] = 'none' // Casting replaces this turn's normal attack.
  return skill
}
/** Applies the cast after the enemy's round concludes. Does not resurrect a killed boss. */
export function finishErrorBossRound(mb, previousRound, writeLog) {
  const st = mb?.story
  if (!st || st.p !== 'oracle' || mb.round <= previousRound || mb.over) return null
  const skill = errorBossSkillAt(previousRound)
  if (skill?.id === 'oracle' && !st.jump) {
    st.jump = true
    mb.enemy.atk = Math.max(1, Math.round(st.baseAtk * 2))
    writeLog('✦ 「신탁」 시전! 시곗바늘이 23시 17분으로 뛰었다. 이제 오류의 공격력은 두 배다.')
  } else if (skill?.id === 'absolute-oracle') {
    const back = Math.max(0, Math.min(mb.enemy.hp, st.rStart ?? mb.ehp) - mb.ehp)
    mb.ehp += back
    writeLog(`✦ 「절대신탁」 시전! 23시 17분으로 되돌렸다. 직전 라운드에 받은 피해 ${back}을(를) 회복했다.`)
  }
  st.rStart = mb.ehp
  st.lastCast = skill?.id || null
  const upcoming = prepareErrorBossMove(mb)
  if (upcoming?.id === 'absolute-oracle') writeLog('⚠ 오류가 「절대신탁」을 준비한다. 다음 상대 행동 대신 직전 라운드 피해가 되돌아갈 수 있다.')
  return skill
}
