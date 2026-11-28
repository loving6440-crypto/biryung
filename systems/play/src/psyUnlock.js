// 비령 V.01 — 기본 영능력의 「얻는 방법」을 실제로 세고, 채우면 영능력을 준다.
// (예전에는 생존본능만 실제로 얻을 수 있었고, 나머지는 관리자 도구로만 들어왔다.)
//
// 세는 곳
//  · 전투 엔진(battle.js · mbattle.js 패치)이 한 판 동안 state.bryStat 에 모은다:
//      g 막기 · a 일반 공격 · mp 쓴 의지력 · sc 한 번에 가장 많이 쓴 간파 · mist 솜구름 안개 · rash 호전 돌발 공격
//      hit 적의 공격에 다친 횟수 · smash 막지 않고 맞은 강공 · alone 3인 전투에서 혼자 남음
//  · 판이 끝나면 화면이 globalThis.__BRY_PSY_STAT(stat, meta) 로 넘기고, 여기서 player.psyProg 에 쌓는다.
//  · 양호실 휴식을 마치면 progress.js(패치)가 psyProg.nurse 를 올린다.
//
// player.psyProg = { nurse, smash, rash, mist (누적) · scanBest, guardBest, mpBest (한 판 최고) · downed, alone, boss32, noAttack, untouched (해 봤으면 1) }

/** 영능력 → 세는 칸 · 목표 · 보이는 말 */
export const PSY_RULES = {
  survival: { key: 'downed', goal: 1, unit: '회', label: '전투불능' },
  'cotton-mist': { key: 'scanBest', goal: 15, unit: '', best: true, label: '간파 한 번에 쓴 의지력', note: '한 번에 쓴 의지력 최고' },
  'echo-form': { key: 'nurse', goal: 10, unit: '회', label: '양호실 이용' },
  'falling-light': { key: 'alone', goal: 1, unit: '회', label: '3인 전투에서 혼자 남기' },
  'monkey-paw': { key: 'smash', goal: 20, unit: '회', label: '막지 않고 맞은 강공' },
  'dokkaebi-fire': { key: 'boss32', goal: 1, unit: '회', label: '3인 보스를 2인으로' },
  'karmic-recompense': { key: 'noAttack', goal: 1, unit: '회', label: '일반 공격 없이 일행 전투 이기기' },
  'earth-step': { key: 'guardBest', goal: 20, unit: '회', best: true, label: '한 전투 방어', note: '한 전투 최고' },
  'warding-scripture': { key: 'mpBest', goal: 200, unit: '', best: true, label: '한 전투에서 쓴 의지력', note: '한 전투 최고' },
  'spirit-barrier': { key: 'untouched', goal: 1, unit: '회', label: '한 대도 맞지 않고 이기기' },
  'seven-stars': { key: 'rash', goal: 20, unit: '회', label: '호전 돌발 공격' },
  'language-barrier': { key: 'mist', goal: 20, unit: '회', label: '솜구름 안개 사용' },
}

const n = (v) => Math.max(0, Math.floor(Number(v) || 0))

/** 지금 진행: { cur, goal, text } — 도감에서 「n회 / n회」로 보인다 */
export function psyProgressOf(player, id) {
  const r = PSY_RULES[id]
  if (!r) return null
  const cur = Math.min(r.goal, n(player?.psyProg?.[r.key]))
  const u = r.unit
  // 「n회 / n회」 — 한 전투 최고를 보는 것은 뒤에 (한 전투 최고)
  const text = `${cur}${u} / ${r.goal}${u}${r.note ? ` (${r.note})` : ''}`
  return { cur, goal: r.goal, text }
}

/** 조건을 채운 영능력을 넣는다. 반환 { player, got: [id], logs } */
export function psyCheck(player, defs = []) {
  const have = new Set(player?.psychics ?? [])
  const got = []
  for (const [id, r] of Object.entries(PSY_RULES)) {
    if (have.has(id)) continue
    if (n(player?.psyProg?.[r.key]) >= r.goal) got.push(id)
  }
  if (!got.length) return { player, got, logs: [] }
  const name = (id) => defs.find((p) => p.id === id)?.label ?? id
  return {
    player: { ...player, psychics: [...(player.psychics ?? []), ...got] },
    got,
    logs: got.map((id) => `✦ 얻는 방법을 채워 영능력 《${name(id)}》을(를) 얻었다!`),
  }
}

/** 한 판이 끝났다. stat = state.bryStat, meta = { party, size, win, boss, partySize } */
export function notePsyBattle(player, stat = {}, meta = {}, defs = []) {
  const s = stat || {}
  const pg = { ...(player?.psyProg ?? {}) }
  const add = (k, v) => { if (n(v)) pg[k] = n(pg[k]) + n(v) }
  const best = (k, v) => { if (n(v) > n(pg[k])) pg[k] = n(v) }
  const flag = (k, ok) => { if (ok) pg[k] = 1 }
  add('smash', s.smash); add('rash', s.rash); add('mist', s.mist)
  best('scanBest', s.sc); best('guardBest', s.g); best('mpBest', s.mp)
  flag('alone', meta.party && meta.size === 3 && s.alone)
  flag('boss32', meta.win && meta.boss && n(meta.partySize) === 3 && meta.size === 2)
  flag('noAttack', meta.party && meta.win && !n(s.a))
  flag('untouched', meta.win && !n(s.hit))
  return psyCheck({ ...player, psyProg: pg }, defs)
}

/** 생존본능처럼 전투 밖에서 한 번 해 보면 되는 것 */
export function notePsyFlag(player, key, defs = []) {
  return psyCheck({ ...player, psyProg: { ...(player?.psyProg ?? {}), [key]: 1 } }, defs)
}
