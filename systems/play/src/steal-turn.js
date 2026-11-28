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
  // vD.01 빼앗은 영능력의 뒤끝(상대 차례의 머리에서) — 이 피해들로는 쓰러지지 않는다
  const hurt = (d, text) => { const x = Math.min(Math.max(0, ehp - 1), Math.max(0, Math.floor(d))); if (x > 0) { ehp -= x; notes.push(text.replace('{d}', x)) } }
  const ATK = ['jab', 'smash', 'special', 'group']
  const tick = (k) => { if (typeof es[k] === 'number') { es[k] -= 1; if (es[k] <= 0) delete es[k] } else if (es[k]) { es[k] = { ...es[k], n: es[k].n - 1 }; if (es[k].n <= 0) delete es[k] } }
  const R = () => Math.random() * 100
  if (es.bryRats) { hurt(es.bryRats.d, `쥐 떼가 ${name}을(를) 문다. 피해 {d}.`); if (R() < (es.bryRats.fl || 0)) { intent = 'none'; notes.push(`${name}이(가) 쥐 떼에 놀라 움찔한다.`) } tick('bryRats') }
  if (es.bryPoison) hurt(es.bryPoison.d * es.bryPoison.s, `쌓인 독(${es.bryPoison.s}겹)이 ${name}을(를) 태운다. 피해 {d}.`)
  if (es.bryPlague) { hurt(Math.ceil(ehp * es.bryPlague.p), `역병이 ${name}의 몸을 갉는다. 피해 {d}.`); tick('bryPlague') }
  if (es.brySun) { hurt(es.brySun.d, `땡볕이 ${name}을(를) 말린다. 피해 {d}.`); tick('brySun') }
  if (es.bryBurn) { if (intent === 'guard') { delete es.bryBurn; notes.push(`${name}이(가) 웅크려 몸의 불을 껐다.`) } else hurt(es.bryBurn, `옮겨붙은 불이 ${name}을(를) 태운다. 피해 {d}.`) }
  if (es.bryStomp) { es.bryStomp = { ...es.bryStomp, t: es.bryStomp.t - 1 }; if (es.bryStomp.t <= 0) { hurt(es.bryStomp.d, `들어 올렸던 발이 ${name} 위로 떨어진다! 피해 {d}.`); delete es.bryStomp } else notes.push(`들어 올린 발이 아직 허공에 있다(${es.bryStomp.t}턴 뒤 떨어진다).`) }
  if (es.bryInfight) { hurt(es.bryInfight, `${name}이(가) 제 몸을 친다! 피해 {d}.`); delete es.bryInfight; intent = 'none' }
  if (es.bryBanish) { intent = 'none'; notes.push(`${name}은(는) 백귀의 행렬에 끌려가 있다.`); tick('bryBanish') }
  if (es.brySleep) {
    if (ehp < es.brySleep.hp) { delete es.brySleep; notes.push(`아픔에 ${name}이(가) 가위에서 깨어난다.`) }
    else { intent = 'none'; notes.push(`${name}은(는) 가위에 눌려 꼼짝 못 한다.`); es.brySleep = { ...es.brySleep, n: es.brySleep.n - 1, hp: ehp }; if (es.brySleep.n <= 0) delete es.brySleep }
  }
  if (es.bryHan && ATK.includes(intent)) { hurt(es.bryHan.d, `들러붙은 한이 ${name}의 움직임을 갉는다. 피해 {d}.`); tick('bryHan') }
  if (es.bryFogPoison && intent === 'guard') { const cur = es.bryPoison || { s:0,d:0 }; es.bryPoison = {s:Math.min(5,cur.s+1),d:Math.max(cur.d,es.bryFogPoison)}; notes.push(`독안개 속에서 방어하다 독이 ${es.bryPoison.s}겹 쌓였다.`) }
  if (es.bryFog && intent === 'guard') hurt(es.bryFog.d, `웅크린 ${name}이(가) 독안개를 들이마신다. 피해 {d}.`)
  if (es.bryFog) tick('bryFog')
  if (es.bryThirst && intent === 'special') { hurt(es.bryThirst, `메마른 목으로 영능력을 쓰려던 ${name}이(가) 피를 토한다. 피해 {d}.`); delete es.bryThirst }
  if (es.bryReflect && (intent === 'smash' || intent === 'special')) { hurt(es.bryReflect, `누이의 얼굴에 홀린 ${name}의 일격이 제 몸으로 돌아간다. 피해 {d}.`); delete es.bryReflect; intent = 'jab' }
  if (es.bryThorn && ATK.includes(intent)) { hurt(es.bryThorn, `껍질의 가시가 ${name}을(를) 찌른다. 피해 {d}.`); delete es.bryThorn }
  if (es.bryExpose) { if (intent === 'guard') { intent = 'none'; notes.push(`병든 ${name}은(는) 웅크릴 힘도 없다.`) } tick('bryExpose') }
  if (es.bryWeak) { if (['smash', 'special', 'group', 'charge'].includes(intent)) { intent = 'jab'; notes.push(`기운이 빠진 ${name}은(는) 약공밖에 하지 못한다.`) } tick('bryWeak') }
  if (es.bryBind) { if (intent === 'smash' || intent === 'charge') { intent = 'guard'; notes.push(`쇠사슬에 묶인 ${name}이(가) 몸을 웅크린다.`) } tick('bryBind') }
  if (es.bryRage) { if (['jab', 'guard', 'charge'].includes(intent)) { intent = 'smash'; notes.push(`연모의 불길에 ${name}이(가) 앞뒤 가리지 않고 들이받는다.`) } tick('bryRage') }
  if (es.bryDodge && intent === 'jab') { intent = 'none'; notes.push(`여우 둔갑에 ${name}의 약공이 허공을 가른다.`); tick('bryDodge') }
  if (es.bryBlind) { if (ATK.includes(intent) && R() < es.bryBlind.c) { intent = 'none'; notes.push(`날개에 덮여 앞이 안 보이는 ${name}의 공격이 빗나간다.`) } tick('bryBlind') }
  if (es.bryNumb) { if (intent !== 'none' && R() < es.bryNumb.c) { intent = 'none'; notes.push(`꽃가루에 저린 ${name}이(가) 움직이지 못한다.`) } tick('bryNumb') }
  es.bryAttackHalfAct=es.bryAttackHalf>0
  if (es.bryAttackHalf > 0) { es.bryAttackHalf -= 1; if (!es.bryAttackHalf) delete es.bryAttackHalf }
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
  const mpCost = k.allyAttacksBuff ? Math.min(80, Math.max(0,Math.floor(ctx.targetAttacks||0))*5) : H.mpCostOf(stats,k.mp || 0)
  if (mpCost > mpNow0) return { state, events: [{ kind: 'warn', text: `의지력이 모자라 쓸 수 없다! (필요 ${mpCost}, 지금 ${mpNow0})` }], mpCost: 0, invalid: true }
  if (k.partyOnly && !ctx.selfId) return { state, events: [{kind:'warn',text:'일행 전투에서만 사용할 수 있는 영능력이다.'}], mpCost:0, invalid:true }
  if (k.onceBattle && (s.stealUses?.[id]||0)) return { state, events:[{kind:'warn',text:'이 영능력은 전투당 한 번만 사용할 수 있다.'}],mpCost:0,invalid:true }
  if ((k.firstTurnStatBuff || k.firstTurnProtect) && (s.myTurns||0)>1) return { state,events:[{kind:'warn',text:'첫 턴에만 사용할 수 있다.'}],mpCost:0,invalid:true }
  if (k.reviveAlly && !ctx.targetDown) return {state,events:[{kind:'warn',text:'전투불능인 아군을 지정해야 한다.'}],mpCost:0,invalid:true}
  if (k.allyAttacksBuff && (!ctx.target || ctx.target===ctx.selfId)) return {state,events:[{kind:'warn',text:'자신이 아닌 일행을 지정해야 한다.'}],mpCost:0,invalid:true}
  if (k.mimicEnemy && !H.PSYCHICS.some(p=>p.stolen && p.id!==id && p.src?.includes(s.enemy?.id))) return {state, events:[{kind:'warn',text:'현재 적에게서 모방 가능한 탈취 후 영능력을 찾지 못했다. 의지력과 턴은 소모하지 않았다.'}],mpCost:0,invalid:true}
  const bits = []
  const out = {}
  const es = { ...(s.es || {}) }
  if (k.onceBattle) s.stealUses = {...(s.stealUses || {}),[id]:1}
  const hpMax = s.phpMax || H.maxHp(stats)
  const maxRoll = 2 * Math.max(1, Math.floor(stats.aggression || 0)) + Math.floor(stats.insight || 0) + 1
  const roll = (m) => Math.max(1, Math.ceil(H.attackRoll(stats, rng, true).dmg * m * H.atkMult(stats)))
  const spiritLeft = () => (es.brySpirit ?? Math.max(0, Math.floor(s.enemy.spirit || 0)))
  if (k.sh) {
    const pay = Math.min(Math.max(0, Math.floor(s.php) - 1), Math.ceil(hpMax * k.sh))
    s.php = Math.floor(s.php) - pay
    out.paid = pay
    if (pay) bits.push(`체력 ${pay}을(를) 바쳤다`)
  }
  let dealt = 0
  // vD.01 두 번에 걸쳐 쓰는 것(엄니 갈기): 처음엔 기를 모으고(막기), 두 라운드 안에 다시 쓰면 크게 들이받는다
  let charging = false, chgMult = 1
  if (k.chg) {
    const key = `${id}:chg`, at = s.stealUses?.[key]
    if (at && (s.round || 1) - at <= 2) { chgMult = k.chg; s.stealUses = { ...(s.stealUses || {}), [key]: 0 } }
    else { charging = true; s.stealUses = { ...(s.stealUses || {}), [key]: s.round || 1 }; if (!s.bound) s.guard = true; bits.push('엄니를 갈며 기를 모은다(막기 자세) — 두 라운드 안에 다시 쓰면 크게 들이받는다') }
  }
  if (k.m && !charging) {
    const braced = !k.p && !k.gx && s.queue?.[0] === 'guard'
    let mult = 1
    if (k.es) {
      const used = s.stealUses?.[id] || 0
      mult *= Math.min(3, 1 + k.es * used)
      s.stealUses = { ...(s.stealUses || {}), [id]: used + 1 }
    }
    const exec = k.ex && s.ehp <= s.enemy.hp * k.ex
    if (exec) mult *= 2
    mult *= chgMult
    const q0 = s.queue?.[0]
    if (k.jx && q0 === 'jab') { mult *= k.jx; bits.push('약공을 노리던 틈을 외발로 넘는다') }
    if (k.hx) { const lost = 1 - s.ehp / Math.max(1, s.enemy.hp); mult *= Math.min(2.5, 1 + lost * k.hx) }
    if (k.oe) { if ((s.round || 1) % 2) { mult *= 1.6; bits.push('산의 정 — 홀수 라운드라 세게 친다') } else { mult *= 0.6; bits.push('물의 정 — 짝수 라운드라 약하게 치고 몸을 적신다') } }
    let eaten = 0
    if (k.eatch) { eaten = Math.max(0, Math.floor(s.charms ?? H.CHARMS)); if (eaten) { s.charms = 0; mult *= 1 + eaten * k.eatch; bits.push(`부적 ${eaten}장을 먹어 치웠다`) } }
    let hits = k.n || 1
    if (k.nr) hits = k.nr[0] + Math.floor(rng() * (k.nr[1] - k.nr[0] + 1))
    if (k.hitsup) { const used = s.stealUses?.[`${id}:h`] || 0; hits = Math.min(k.hitsup, 1 + used); s.stealUses = { ...(s.stealUses || {}), [`${id}:h`]: used + 1 } }
    if (k.frenzy) { while (hits < 6 && rng() * 100 < k.frenzy) hits += 1 }
    const rolls = []
    for (let i = 0; i < hits; i++) {
      let mi = k.m * mult
      if (k.decay && hits > 1) mi = mi * (k.decay[0] + ((k.decay[1] - k.decay[0]) * i) / (hits - 1))
      if (k.gx && q0 === 'guard' && i === hits - 1) mi *= k.gx
      rolls.push(roll(mi))
    }
    let dmg = rolls.reduce((x, y) => x + y, 0)
    if (k.kn) dmg += Math.min(36, (s.known || 0) * k.kn)
    if (k.pmax) dmg += Math.min(Math.ceil(maxRoll * 1.5), Math.floor(s.enemy.hp * k.pmax))
    if (k.shx && out.paid) dmg += out.paid * k.shx
    if (k.mpburn) { const extra = Math.max(0, Math.floor((mpNow0 - mpCost) * k.mpburn)); if (extra) { out.extraMp = extra; dmg += Math.floor(extra * 1.2); bits.push(`의지력 ${extra}을(를) 더 태웠다`) } }
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
  const alive0 = s.ehp > 0
  const atkRoll = (m) => roll(m)
  if (alive0) {
    if (k.gbr && s.queue?.[0] === 'guard') { s.queue = ['none', ...s.queue.slice(1)]; bits.push('웅크린 상대를 번쩍 메쳐, 그 방어 태세가 사라졌다') }
    if (k.qs && (s.queue?.length || 0) >= 2) { const q = [...s.queue]; [q[0], q[1]] = [q[1], q[0]]; s.queue = q; bits.push(`상대의 다음 두 행동 순서가 뒤바뀌었다(${H.INTENTS[q[0]]?.label ?? q[0]} → ${H.INTENTS[q[1]]?.label ?? q[1]})`) }
    if (k.fz) { const d = 1 + Math.floor(rng() * 100); if (d <= (s.enemy.boss ? k.fz / 2 : k.fz)) { s.queue = ['none', ...(s.queue ?? []).slice(1)]; bits.push(`헛것을 걷어 내 상대가 멈칫한다(다음 행동 없음, d100 = ${d})`) } else bits.push(`상대가 헛것에 흔들리지 않았다(d100 = ${d})`) }
    if (k.fear && ['jab', 'smash', 'special', 'group', 'charge'].includes(s.queue?.[0])) { s.queue = ['guard', ...s.queue.slice(1)]; bits.push('붙잡힌 상대가 겁에 질려 다음 차례엔 웅크린다') }
    if (k.swsp) { const q = [...(s.queue ?? [])]; const i = q.slice(0, 3).indexOf('special'); if (i >= 0) { q[i] = 'jab'; s.queue = q; out.swallowed = true; bits.push('상대가 품고 있던 영능력을 구슬로 삼켰다(그 차례는 약공)') } else bits.push('삼킬 영능력이 보이지 않았다(앞 세 턴에 없음)') }
    if (k.rat) { es.bryRats = { n: k.rat[0], d: atkRoll(k.rat[1]), fl: s.enemy.boss ? k.rat[2] / 2 : k.rat[2] }; bits.push(`쥐 떼를 풀었다 — 상대 차례마다 ${k.rat[0]}번 문다(${es.bryRats.d} 피해, 움찔 ${es.bryRats.fl}%)`) }
    if (k.han) { es.bryHan = { n: k.han[0], d: atkRoll(k.han[1]) }; bits.push(`한을 들러붙였다 — 상대가 공격할 때마다 ${es.bryHan.d} 피해(${k.han[0]}번)`) }
    if (k.psn) { const cur = es.bryPoison || { s: 0, d: 0 }; es.bryPoison = { s: Math.min(k.psn[1], cur.s + 1), d: Math.max(cur.d, atkRoll(k.psn[0])) }; bits.push(`독이 ${es.bryPoison.s}겹 쌓였다(상대 차례마다 ${es.bryPoison.d}×${es.bryPoison.s} 피해, 싸움이 끝날 때까지)`) }
    if (k.poisonOnGuard) { es.bryFogPoison = atkRoll(0.05); bits.push('앞으로 방어 태세를 취할 때마다 독이 1겹 쌓인다') }
    if (k.enemyAtkHalf) { es.bryAttackHalf = k.enemyAtkHalf; bits.push(`적의 공격력이 ${k.enemyAtkHalf}라운드 동안 절반이 된다`) }
    if (k.fogg) { es.bryFog = { n: k.fogg[0], d: atkRoll(k.fogg[1]) }; bits.push(`독안개를 깔았다 — ${k.fogg[0]}턴 동안 상대가 웅크리면 ${es.bryFog.d} 피해`) }
    if (k.wk) { es.bryWeak = Math.max(es.bryWeak || 0, k.wk); bits.push(`상대의 기운을 뺐다 — ${k.wk}턴 동안 강공 · 영능력 · 단체 공격 · 기 모으기가 약공이 된다`) }
    if (k.expose) { es.bryExpose = Math.max(es.bryExpose || 0, k.expose); bits.push(`병을 옮겼다 — ${k.expose}턴 동안 상대가 웅크리지 못한다`) }
    if (k.spb) { const left = spiritLeft(); const lost = Math.floor(left / k.spb); es.brySpirit = left - lost; bits.push(lost ? `금빛 울림이 상대의 영력 ${lost}을(를) 흩었다(남은 영력 ${es.brySpirit})` : '흩을 영력이 남아 있지 않았다') }
    if (k.dodge) { es.bryDodge = Math.max(es.bryDodge || 0, k.dodge); bits.push(`여우로 둔갑했다 — 상대의 약공 ${k.dodge}번을 흘려 낸다`) }
    if (k.rage) { es.bryRage = k.rage; bits.push(`연모의 불길이 옮겨붙었다 — ${k.rage}턴 동안 상대가 웅크리지 않고 강공만 한다`) }
    if (k.sleep) { es.brySleep = { n: s.enemy.boss ? Math.max(1, Math.floor(k.sleep / 2)) : k.sleep, hp: s.ehp }; bits.push(`가위를 눌렀다 — 최대 ${es.brySleep.n}턴 잠든다(아프면 깬다)`) }
    if (k.bind) { es.bryBind = k.bind; bits.push(`명부의 쇠사슬로 옭아맸다 — ${k.bind}턴 동안 강공 · 기 모으기가 웅크리기가 된다`) }
    if (k.rf) { es.bryReflect = atkRoll(k.rf); bits.push(`누이의 얼굴을 씌웠다 — 상대의 다음 강공 · 영능력은 제 몸을 친다(${es.bryReflect} 피해, 그 차례는 약공)`) }
    if (k.plague) { const cur = es.bryPlague; es.bryPlague = { n: (cur?.n || 0) + k.plague[1], p: k.plague[0] }; bits.push(`역병을 옮겼다 — 상대 차례마다 지금 체력의 ${Math.round(k.plague[0] * 100)}%(${es.bryPlague.n}턴)`) }
    if (k.blind) { es.bryBlind = { n: k.blind[0], c: s.enemy.boss ? k.blind[1] / 2 : k.blind[1] }; bits.push(`날개로 덮었다 — ${k.blind[0]}턴 동안 상대의 공격이 ${es.bryBlind.c}% 확률로 빗나간다`) }
    if (k.burn) { es.bryBurn = atkRoll(k.burn); bits.push(`불을 옮겨붙였다 — 웅크릴 때까지 상대 차례마다 ${es.bryBurn} 피해`) }
    if (k.thirst) { es.bryThirst = atkRoll(k.thirst); bits.push(`목을 말렸다 — 상대가 다음에 영능력을 쓰면 ${es.bryThirst} 피해`) }
    if (k.sun) { es.brySun = { n: k.sun[0], d: Math.max(1, Math.min(maxRoll, Math.floor(s.enemy.hp * k.sun[1]))) }; bits.push(`땡볕을 불렀다 — ${k.sun[0]}턴 동안 상대 차례마다 ${es.brySun.d} 피해`) }
    if (k.thorn) { es.bryThorn = atkRoll(k.thorn); bits.push(`가시 돋은 껍질을 둘렀다 — 상대가 다음에 공격하면 ${es.bryThorn} 피해`) }
    if (k.banish) { if (s.enemy.boss) bits.push('보스는 행렬에 끌려가지 않는다'); else { es.bryBanish = k.banish; bits.push(`상대를 백귀의 행렬에 끼워 보냈다(${k.banish}턴 동안 아무것도 못 한다)`) } }
    if (k.numb) { es.bryNumb = { n: k.numb[0], c: s.enemy.boss ? k.numb[1] / 2 : k.numb[1] }; bits.push(`저린 꽃가루를 뿌렸다 — ${k.numb[0]}턴 동안 상대 행동이 ${es.bryNumb.c}% 확률로 실패한다`) }
    if (k.delay) { es.bryStomp = { t: k.delay[0], d: atkRoll(k.delay[1]) }; bits.push(`산만 한 발을 들어 올렸다 — ${k.delay[0]}턴 뒤 ${es.bryStomp.d} 피해로 내리찍는다`) }
    if (k.infight) { es.bryInfight = Math.ceil((Number(s.enemy.atk) || 10) * k.infight); bits.push(`싸움을 붙였다 — 상대가 다음 차례에 제 몸을 친다(${es.bryInfight} 피해, 행동 없음)`) }
  }
  if (k.dot) {
    es.bryDot = Array.from({ length: k.dot[0] }, () => roll(k.dot[1]))
    bits.push(`저주가 스며들었다 — 앞으로 상대의 ${k.dot[0]}턴 동안 ${es.bryDot.join(' · ')} 피해`)
  }
  if (k.sp) {
    const left = spiritLeft()
    const take = Math.floor(left / k.sp)
    es.brySpirit = left - take
    if (take > 0) { if (k.spiritToMp) out.spiritMp = take; else out.spiritSteal = take; bits.push(`상대의 영력 ${take}을(를) 앗아왔다(남은 영력 ${es.brySpirit})`) } else bits.push('앗아올 영력이 남아 있지 않았다')
  }
  let heal = 0
  if (k.ls && dealt) heal += Math.ceil(dealt * k.ls)
  if (k.h) {
    let hh = hpMax * k.h
    if (k.lowx && s.php < hpMax * 0.3) { hh *= k.lowx; bits.push('뼈가 드러날 만큼 다쳐 있어 더 크게 아문다') }
    if (k.dim) { const used = s.stealUses?.[`${id}:d`] || 0; hh *= Math.pow(k.dim, used); s.stealUses = { ...(s.stealUses || {}), [`${id}:d`]: used + 1 }; if (used) bits.push(`꼬리가 줄어 회복이 ${Math.round(Math.pow(k.dim, used) * 100)}%로`) }
    heal += Math.ceil(hh)
  }
  if (k.rheal) heal += Math.ceil(Math.max(0, hpMax - s.php) * k.rheal)
  if (out.swallowed) heal += Math.ceil(hpMax * 0.1)
  if (k.swap) {
    const mine = s.php / hpMax, theirs = s.ehp / Math.max(1, s.enemy.hp)
    if (mine < theirs) {
      const before = Math.floor(s.php), eb = s.ehp
      s.php = Math.max(1, Math.min(hpMax, Math.round(hpMax * Math.min(theirs, mine + 0.3))))
      s.ehp = Math.max(1, Math.min(s.ehp, Math.round(s.enemy.hp * Math.max(mine, theirs - 0.15))))
      dealt += Math.max(0, eb - s.ehp)
      bits.push(`넋을 맞바꿨다 — 내 체력 +${Math.max(0, s.php - before)}, 상대 체력 -${Math.max(0, eb - s.ehp)}`)
    } else bits.push('맞바꿀 넋이 없다(내가 더 멀쩡하다)')
  }
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
  if (k.hpSacrificePair) { const pay = Math.min(Math.max(0,s.php-1), Math.ceil(hpMax*0.1)+Math.ceil(s.php*0.1)); s.php-=pay; bits.push(`최대·현재 체력 각 10%에 상당하는 체력 ${pay}을 바쳤다`) }
  if (k.cl) {
    const had = Object.keys(s.ps || {}).length || s.curse > 0
    s.ps = {}
    s.curse = 0
    s.bound = false
    bits.push(had ? '몸에 걸린 것을 모두 털어냈다' : '털어낼 것이 없었다(걸린 것이 없다)')
  }
  if (k.gd && !s.bound) { s.guard = true; bits.push('막기 자세를 잡았다') }
  const alive = s.ehp > 0
  if (k.st && alive) {
    const chance = Math.floor(s.enemy.boss ? k.st / 2 : k.st)
    const d = 1 + Math.floor(rng() * 100)
    if (d <= chance) { s.queue = Array.from({length:k.stunTurns||1},()=> 'stun').concat((s.queue??[]).slice(k.stunTurns||1)); bits.push(`상대의 다음 행동을 봉쇄했다 (확률 ${chance}%, d100 = ${d})`) } else bits.push(`상대가 풀려났다 (확률 ${chance}%, d100 = ${d})`)
  }
  if (k.randomAilments) {
    const pool = ['poison','blind','paralyze','plague','burn','fear','vulnerable','confuse'];
    for (let i=0;i<k.randomAilments;i++) {
      const j=Math.floor(rng()*pool.length), key=pool.splice(j,1)[0];
      s.ps={...(s.ps||{}),[key]:(s.ps?.[key]||0)+2};
      if(key==='poison') s.ps.poisonDie=Math.max(1,s.ps.poisonDie||2);
      if(key==='paralyze') s.ps.paralyzeChance=30;
      if(key==='plague') s.ps.plagueDie=Math.max(1,s.ps.plagueDie||2);
      if(key==='burn') s.ps.burnPct=0.06;
      bits.push(`상태이상 ${key} 획득`);
    }
  }
  if(k.editEnemyQueue || k.deleteOneAction) {
    const q=[...(s.queue||[])];
    while(q.length<5) q.push(H.rollIntent(q[q.length-1]??null,rng,s.party,!!s.enemy.boss));
    s.known=Math.max(s.known||0,5)
    if(k.deleteOneAction) {
      const choices=q.slice(0,5).map((v,i)=> v==='special'?-1:i).filter(i=>i>=0);
      const at=Number.isInteger(ctx.queueIndex)&&choices.includes(ctx.queueIndex)?ctx.queueIndex:choices[0];
      if(at!=null) { q[at]='stun'; bits.push(`${at+1}번째 행동을 삭제했다`) }
    } else {
      const changes=Array.isArray(ctx.queueEdits)?ctx.queueEdits:[];
      const allowed=['jab','charge','smash','guard'];
      if(!changes.length) { bits.push('적의 5행동을 확인했다. 교체할 행동을 고르지 않으면 예측만 적용된다') }
      changes.forEach((ch)=>{const i=Math.floor(Number(ch?.index)); if(i<0||i>=5||q[i]==='special'||!allowed.includes(ch?.intent)||ch.intent==='charge'&&i===4)return; q[i]=ch.intent; if(ch.intent==='charge')q[i+1]='smash';bits.push(`${i+1}번째 행동을 ${ch.intent}(으)로 변경`) });
    }
    s.queue=q;
  }
  if(k.copyDebuffs) {
    const debuffs=['poison','blind','paralyze','plague','burn','fear','vulnerable','confuse','healBlock','weaponSeal','statDown','costUp','mpTax'];
    const found=debuffs.filter(key=>s.ps?.[key]>0);
    if(found.length) { es.bryCopiedDebuffs={...(es.bryCopiedDebuffs||{}),...Object.fromEntries(found.map(k=>[k,s.ps[k]]))}; es.bryWeak=Math.max(es.bryWeak||0,Math.max(...found.map(k=>s.ps[k])));if(s.ps.poison>0)es.bryPoison={s:Math.min(5,s.ps.poison),d:Math.max(1,s.ps.poisonDie||1)};if(s.ps.burn>0)es.bryBurn=Math.max(1,Math.floor((s.phpMax||100)*(s.ps.burnPct||.06)));if(s.ps.blind>0)es.bryBlind={n:s.ps.blind,c:50};if(s.ps.paralyze>0)es.bryNumb={n:s.ps.paralyze,c:s.ps.paralyzeChance||30};bits.push(`${found.join('·')}의 불리한 기운을 상대에게도 옮겼다`) }
    else bits.push('옮길 불리한 효과가 없다');
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
  if (k.reviveAlly) { out.reviveTarget=ctx.target; bits.push('전투불능인 아군을 체력 20·의지력 0으로 일으킨다') }
  if (k.fatalPrevent) { out.fatalPrevent=true; if(!ctx.selfId) {s.bryFatalPrevent=true;s.bryFatalPreventTurns=2} bits.push('일행 전체에 치명타 생존 가호를 건다') }
  if (k.shareRemainingMp) { out.shareRemainingMp=true; bits.push('의지력 절반을 바쳐 나를 제외한 일행 전체를 회복시킨다') }
  if (k.allyAttacksBuff) { out.allyAttackBuff={target:ctx.target,attacks:Math.min(16,ctx.targetAttacks||0)};bits.push(`아군의 과거 일반공격 ${ctx.targetAttacks||0}회에 따른 공격력 증가`) }
  if (k.firstTurnStatBuff) { const stat=H.STAT6.includes(ctx.statKey)?ctx.statKey:'aggression';out.statBuff={target:ctx.target||ctx.selfId,stat,n:3,amount:5};if(!ctx.selfId)s.ps={...(s.ps||{}),bryBuff:3,bryBuffStat:stat,bryBuffAmount:5};bits.push(`${stat} 3라운드 +5`) }
  if (k.firstTurnProtect) { out.firstTurnProtect=true;bits.push('이번 전투에서 일행의 피해를 대신 받는다') }
  if (k.redirectNext) { out.redirectNext=ctx.target||ctx.selfId;bits.push('적의 다음 공격 대상을 지정했다') }
  if (k.extraTurns) { out.extraTurns=k.extraTurns;bits.push('즉시 추가 행동 2회') }
  if (k.reflectNextRaw) {out.reflectNextRaw=true;s.bryReflectNextRaw=true;bits.push('다음 공격의 원래 피해를 되돌릴 준비를 했다')}
  if (k.mimicEnemy) { const copy=H.PSYCHICS.find(p=>p.stolen && p.id!==id && p.src?.includes(s.enemy?.id)); out.borrowedPsychic=copy.id;s.bryMimic=copy.id;bits.push(`${copy.label} 영능력을 이번 전투 중 취득했다`) }
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
  let gain = (k.g || 0) + (out.spiritMp || 0) + (out.swallowed ? 15 : 0)
  if (k.gsp) {
    const left = spiritLeft()
    const got = Math.min(k.gsp[1], Math.floor(left * k.gsp[0]))
    es.brySpirit = left - got
    gain += got
    if (!got) bits.push('되찾을 영력이 남아 있지 않았다')
  }
  if (k.shareRemainingMp) out.shareMpAmount=Math.floor(mpNow0*0.5)
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
  const { paid: _p, swallowed: _s, spiritMp:_sm, extraMp = 0, ...rest } = out
  return { state: s, events: ev, mpCost: mpCost + extraMp - gain + (out.shareMpAmount||0), ...rest }
}
