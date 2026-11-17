// 비령 vC.01 — 빼앗은 영능력(steal-…) 한 번 쓰기와, 그 뒤끝이 상대 차례에 미치는 처리.
// 보관고의 전투 엔진(battle.js)에서 끼워 부른다(patches.mjs). 엔진의 도구는 H 로 넘겨받는다 — 이 파일은 보관고를 직접 들이지 않는다.
// 칸의 뜻은 steal.js 머리말과 stealDetail 을 본다.
// 상대 쪽에 남는 것은 모두 es(적 상태)에 둔다 — 일행 전투에서도 함께 쓰이는 칸이다.
//   es.bryDot [턴마다 피해…] · es.bryGuardStun 다음 방어 태세를 행동불능으로 · es.brySilence 영능력 봉인 라운드 · es.brySpirit 남은 영력

/** 상대 차례의 머리에서 한 번: 스며드는 피해 · 행동불능 · 영능력 봉인을 처리하고, 실제로 할 행동을 돌려준다. */
export function bryHead(es0, head, ehp, name) {
  const es = { ...(es0 || {}) }
  let intent = head
  const notes = []
  if (Array.isArray(es.bryDot) && es.bryDot.length) {
    const d = Math.min(Math.max(0, ehp - 1), es.bryDot[0])
    es.bryDot = es.bryDot.slice(1)
    if (!es.bryDot.length) delete es.bryDot
    if (d > 0) { ehp -= d; notes.push(`스며든 저주가 ${name}을(를) 갉는다. 피해 ${d}.`) }
  }
  if (intent === 'guard' && es.bryGuardStun) { delete es.bryGuardStun; intent = 'stun' }
  if (es.brySilence > 0) {
    if (intent === 'special') { intent = 'jab'; notes.push(`영능력이 봉해진 ${name}은(는) 약공밖에 하지 못한다.`) }
    es.brySilence -= 1
    if (!es.brySilence) delete es.brySilence
  }
  if (intent === 'stun') { intent = 'none'; notes.push(`${name}은(는) 몸이 묶여 아무것도 하지 못한다.`) }
  return { es, intent, ehp, notes }
}

export function stolenTurn(state, s, id, ctx, rng, stats, mpNow0, H) {
  const def = H.PSYCHICS.find((p) => p.id === id)
  const k = def?.k
  if (!k) return { state, events: [{ kind: 'warn', text: '쓸 수 없는 영능력이다.' }], mpCost: 0, invalid: true }
  const mpCost = H.mpCostOf(stats, k.mp || 0)
  if (mpCost > mpNow0) return { state, events: [{ kind: 'warn', text: `의지력이 모자라 쓸 수 없다! (필요 ${mpCost}, 지금 ${mpNow0})` }], mpCost: 0, invalid: true }
  const bits = []
  const out = {}
  const es = { ...(s.es || {}) }
  const hpMax = s.phpMax || H.maxHp(stats)
  const maxRoll = 2 * Math.max(1, Math.floor(stats.aggression || 0)) + Math.floor(stats.insight || 0) + 1
  const roll = (m) => Math.max(1, Math.ceil(H.attackRoll(stats, rng, true).dmg * m * H.atkMult(stats)))
  const spiritLeft = () => (es.brySpirit ?? Math.max(0, Math.floor(s.enemy.spirit || 0)))
  if (k.sh) {
    const pay = Math.min(Math.max(0, Math.floor(s.php) - 1), Math.ceil(hpMax * k.sh))
    s.php = Math.floor(s.php) - pay
    if (pay) bits.push(`체력 ${pay}을(를) 바쳤다`)
  }
  let dealt = 0
  if (k.m) {
    const braced = !k.p && s.queue?.[0] === 'guard'
    let mult = 1
    if (k.es) {
      const used = s.stealUses?.[id] || 0
      mult *= Math.min(3, 1 + k.es * used)
      s.stealUses = { ...(s.stealUses || {}), [id]: used + 1 }
    }
    const exec = k.ex && s.ehp <= s.enemy.hp * k.ex
    if (exec) mult *= 2
    const rolls = []
    for (let i = 0; i < (k.n || 1); i++) rolls.push(roll(k.m * mult))
    let dmg = rolls.reduce((x, y) => x + y, 0)
    if (k.a) dmg += Math.floor((k.a[0] === 'max' ? Math.max(...H.STAT6.map((x) => Number(stats[x]) || 0)) : Number(stats[k.a[0]]) || 0) * k.a[1])
    if (k.rb) dmg += Math.min(30, k.rb * Math.max(0, (s.round || 1) - 1))
    if (k.pc) dmg += Math.min(maxRoll, Math.floor(s.ehp * k.pc))
    if (k.back) dmg += Math.min(maxRoll * 2, Math.floor(Math.max(0, hpMax - s.php) * k.back))
    if (braced) dmg = Math.ceil(dmg / 2)
    dealt = Math.min(s.ehp, dmg)
    s.ehp = Math.max(0, s.ehp - dmg)
    bits.push(`${rolls.length > 1 ? `${rolls.length}번 연달아(${rolls.join('+')}) ` : ''}${dmg} 피해${exec ? ' (약해진 틈 · 2배)' : ''}${mult > 1 && !exec ? ` (×${Math.round(mult * 10) / 10})` : ''}${braced ? ' (방어에 절반으로 막힘)' : ''}`)
  }
  if (k.sf && dealt) {
    // 불길이 아군에게도 번진다(본인 포함). 이 피해로는 쓰러지지 않는다. 다른 일행의 몫은 mbattle 이 out.splash 로 처리한다.
    const burn = Math.ceil(dealt * k.sf)
    const mine = Math.min(Math.max(0, Math.floor(s.php) - 1), burn)
    s.php = Math.floor(s.php) - mine
    out.splash = burn
    bits.push(`불길이 번져 아군도 ${burn} 피해(나 ${mine})`)
  }
  if (k.dot) {
    es.bryDot = Array.from({ length: k.dot[0] }, () => roll(k.dot[1]))
    bits.push(`저주가 스며들었다 — 앞으로 상대의 ${k.dot[0]}턴 동안 ${es.bryDot.join(' · ')} 피해`)
  }
  if (k.sp) {
    const left = spiritLeft()
    const take = Math.floor(left / k.sp)
    es.brySpirit = left - take
    if (take > 0) { out.spiritSteal = take; bits.push(`상대의 영력 ${take}을(를) 앗아왔다(남은 영력 ${es.brySpirit})`) } else bits.push('앗아올 영력이 남아 있지 않았다')
  }
  let heal = 0
  if (k.ls && dealt) heal += Math.ceil(dealt * k.ls)
  if (k.h) heal += Math.ceil(hpMax * k.h)
  if (heal) {
    const before = Math.floor(s.php)
    s.php = Math.min(hpMax, before + heal)
    if (s.php > before) bits.push(`체력 +${s.php - before}`)
  }
  if (k.eq) {
    const mine = s.php / hpMax, theirs = s.ehp / Math.max(1, s.enemy.hp)
    if (mine < theirs) {
      // 한 번에 크게 뒤집지 않게: 상대는 최대 체력의 10%까지만 깎이고, 나는 20%까지만 차오른다.
      const avg = (mine + theirs) / 2
      const nm = Math.min(avg, mine + 0.2), nt = Math.max(avg, theirs - 0.1)
      const before = Math.floor(s.php), ebefore = s.ehp
      s.php = Math.max(1, Math.min(hpMax, Math.round(hpMax * nm)))
      s.ehp = Math.max(1, Math.min(s.ehp, Math.round(s.enemy.hp * nt)))
      dealt += Math.max(0, ebefore - s.ehp)
      bits.push(`되비춰 체력 +${Math.max(0, s.php - before)}, 상대 체력 -${Math.max(0, ebefore - s.ehp)}`)
    } else bits.push('되비출 것이 없었다(내가 더 멀쩡하다)')
  }
  if (k.cl) {
    const had = Object.keys(s.ps || {}).length || s.curse > 0
    s.ps = {}
    s.curse = 0
    s.bound = false
    if (had) bits.push('몸에 걸린 것을 모두 털어냈다')
  }
  if (k.gd && !s.bound) { s.guard = true; bits.push('막기 자세를 잡았다') }
  const alive = s.ehp > 0
  if (k.st && alive) {
    const chance = Math.floor(s.enemy.boss ? k.st / 2 : k.st)
    const d = 1 + Math.floor(rng() * 100)
    if (d <= chance) { s.queue = ['stun', ...(s.queue ?? []).slice(1)]; bits.push(`상대의 다음 행동을 봉쇄했다 (확률 ${chance}%, d100 = ${d})`) } else bits.push(`상대가 풀려났다 (확률 ${chance}%, d100 = ${d})`)
  }
  if (k.gs && alive) {
    const q = [...(s.queue ?? [])]
    const i = q.indexOf('guard')
    if (i >= 0) { q[i] = 'stun'; s.queue = q; bits.push('상대의 다음 방어 태세가 행동불능으로 바뀌었다') } else { es.bryGuardStun = true; bits.push('상대가 다음에 처음 잡는 방어 태세는 행동불능이 된다') }
  }
  if (k.sil && alive) { es.brySilence = k.sil; bits.push(`앞으로 ${k.sil}라운드 동안 상대는 영능력을 쓰지 못한다`) }
  if (k.dz && alive) {
    const chance = k.dc >= 100 ? 100 : Math.floor(s.enemy.boss ? k.dc / 2 : k.dc)
    const d = 1 + Math.floor(rng() * 100)
    if (d <= chance) {
      s.queue = [k.dz, ...(s.queue ?? []).slice(1)]
      bits.push(`상대의 다음 행동이 ${H.INTENTS[k.dz]?.label ?? k.dz}(으)로 바뀌었다${chance < 100 ? ` (확률 ${chance}%, d100 = ${d})` : ''}`)
    } else bits.push(`상대가 버텨 냈다 (확률 ${chance}%, d100 = ${d})`)
  }
  const reveal = k.rv ? Math.max(s.known || 0, k.rv) : k.rvAdd ? (s.known || 0) + k.rvAdd : 0
  if (reveal) {
    const q = [...(s.queue ?? [])]
    while (q.length < reveal) q.push(H.rollIntent(q[q.length - 1] ?? null, rng, s.party, !!s.enemy?.boss))
    s.queue = q
    s.known = reveal
    bits.push(k.rvAdd ? `${k.rvAdd}턴을 더 간파했다(앞으로 ${reveal}턴)` : `앞으로 ${k.rv}턴을 간파했다`)
  }
  if (k.ch) {
    const used = s.stealUses?.[`${id}:ch`] || 0
    const before = s.charms ?? H.CHARMS
    if (k.chU && used >= k.chU) bits.push(`부적은 더 되찾지 못한다(한 싸움에 ${k.chU}회까지)`)
    else if (before < H.CHARMS) {
      s.charms = before + 1
      s.stealUses = { ...(s.stealUses || {}), [`${id}:ch`]: used + 1 }
      bits.push('부적 한 장을 되찾았다')
    }
  }
  let gain = k.g || 0
  if (k.gsp) {
    const left = spiritLeft()
    const got = Math.min(k.gsp[1], Math.floor(left * k.gsp[0]))
    es.brySpirit = left - got
    gain += got
    if (!got) bits.push('되찾을 영력이 남아 있지 않았다')
  }
  if (gain) {
    const cap = Number(ctx.mpMax ?? globalThis.__BRY_MPMAX) || Infinity
    gain = Math.max(0, Math.min(gain, cap - (mpNow0 - mpCost)))
    if (gain) bits.push(`의지력 +${gain}`)
  }
  s.es = es
  // 혼자 싸울 때 앗아온 영력은 곧바로 내 것이 된다(일행 전투는 mbattle 이 사람마다 모았다가 끝날 때 준다).
  if (out.spiritSteal && ctx.selfId == null) globalThis.__BRY_SPIRIT_STEAL?.(out.spiritSteal)
  const ev = [{ kind: 'player', dmg: dealt || undefined, text: `✦ ${def.label}!${mpCost ? ` 의지력 ${mpCost} 소모.` : ''} ${bits.join(', ')}.` }]
  if (s.ehp <= 0) {
    s.over = 'win'
    ev.push({ kind: 'end', text: `${s.enemy.name}이(가) 쓰러졌다.` })
  }
  return { state: s, events: ev, mpCost: mpCost - gain, ...out }
}
