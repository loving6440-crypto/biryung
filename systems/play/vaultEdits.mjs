// V.01 — D.06.7~D.06.18 에서 보관고(systems/vault) 원본을 직접 고쳤던 것을, 원본은 그대로 두고 끼워 넣기로 옮겼다.
// 자동 생성(/home/claude/v01tools/genpatch.py). 보관고 원본 위에 다른 묶음보다 먼저 끼운다.
export const VAULT_EDITS_D06 = [
 {
  "file": "game/battle.js",
  "edits": [
   [
    "export const PS_INFO = {\n  itemSeal: { label: '아이템 봉인', desc: '아이템을 쓸 수 없다.' },",
    "export const PS_INFO = {\n  bryBuff: {label:'오방기', desc:'선택한 육조 능력치 +5'},\n  itemSeal: { label: '아이템 봉인', desc: '아이템을 쓸 수 없다.' },"
   ],
   [
    "const PS_DATA = { thorns: ['thornsDie'], poison: ['poisonDie'], guardTrap: ['guardTrapDie'], burn: ['burnPct'], statSwap: ['swap'], plague: ['plagueDie'], paralyze: ['paralyzeChance'], statDown: ['downStat'] }",
    "const PS_DATA = { bryBuff: ['bryBuffStat','bryBuffAmount'], thorns: ['thornsDie'], poison: ['poisonDie'], guardTrap: ['guardTrapDie'], burn: ['burnPct'], statSwap: ['swap'], plague: ['plagueDie'], paralyze: ['paralyzeChance'], statDown: ['downStat'] }"
   ],
   [
    "  if (!stats || !ps || !(ps.statDown > 0 || ps.blind > 0 || ps.weaponSeal > 0 || ps.statSwap > 0)) return stats",
    "  if (!stats || !ps || !(ps.statDown > 0 || ps.blind > 0 || ps.weaponSeal > 0 || ps.statSwap > 0 || ps.bryBuff > 0)) return stats"
   ],
   [
    "  if (ps.blind > 0) out.insight = Math.max(1, Math.floor((out.insight || 0) / 2))\n  return out",
    "  if (ps.blind > 0) out.insight = Math.max(1, Math.floor((out.insight || 0) / 2))\n  if(ps.bryBuff > 0 && STAT6.includes(ps.bryBuffStat)) out[ps.bryBuffStat] = (out[ps.bryBuffStat]||0) + Math.max(0,Math.floor(ps.bryBuffAmount||0))\n  return out"
   ],
   [
    "  const atkNow = base.atk + (s.es.atkBonus || 0) + (s.es.atkUp ? s.es.atkUp.amt : 0) + (s.es.statCopy > 0 ? Math.floor(Math.max(...STAT6.map((k) => Number(ctx.stats?.[k]) || 0)) / 2) : 0)",
    "  const atkNow = Math.max(1,Math.floor((base.atk + (s.es.atkBonus || 0) + (s.es.atkUp ? s.es.atkUp.amt : 0) + (s.es.statCopy > 0 ? Math.floor(Math.max(...STAT6.map((k) => Number(ctx.stats?.[k]) || 0)) / 2) : 0) ) * ((solo ? s.es.bryAttackHalf>0 : s.es.bryAttackHalfAct) ? 0.5 : 1)))"
   ],
   [
    "  const hurt = (raw, label, { blockable = true, kind } = {}) => {\n    // 내려쬐는 빛: 사용한 직후 들어오는 공격은 무조건 '막기'한 것으로 취급한다(1회 소모). (v71)",
    "  const hurt = (raw, label, { blockable = true, kind } = {}) => {\n    s.bryLastRaw = Math.max(0,Math.floor(raw));\n    // 내려쬐는 빛: 사용한 직후 들어오는 공격은 무조건 '막기'한 것으로 취급한다(1회 소모). (v71)"
   ],
   [
    "    }\n    s.php -= dmg",
    "    }\n    if (s.bryReflectNextRaw && dmg > 0) {\n      const reflected=Math.max(0,Math.floor(raw));s.ehp=Math.max(0,s.ehp-reflected);s.bryReflectNextRaw=false;\n      ev.push({kind:'warn',text:`묘귀의 반격! 원래 피해 ${reflected}을(를) 되돌렸다.`})\n    }\n    if(s.bryFatalPrevent && s.php-dmg<=0) { s.php=16;s.bryFatalPrevent=false;ev.push({kind:'warn',text:'금돼지의 가호! 체력 16을 남기고 살아남았다.'});return }\n    s.php -= dmg"
   ],
   [
    "    if (ctx.reduction > 0 && d > 0) d -= Math.floor(d * Math.min(1, ctx.reduction))\n    s.php -= d",
    "    if (ctx.reduction > 0 && d > 0) d -= Math.floor(d * Math.min(1, ctx.reduction))\n    if(s.bryFatalPrevent && s.php-d<=0){s.php=16;s.bryFatalPrevent=false;ev.push({kind:'warn',text:'금돼지의 가호! 체력 16을 남기고 살아남았다.'});return}\n    s.php -= d"
   ],
   [
    "\n  if (s.php <= 0) {",
    "\n  if (s.bryFatalPreventTurns > 0) { s.bryFatalPreventTurns -= 1; if (!s.bryFatalPreventTurns) s.bryFatalPrevent=false }\n  if (s.php <= 0) {"
   ]
  ]
 },
 {
  "file": "game/mbattle.js",
  "edits": [
   [
    "export const BARRIER_ALLY_SKILLS = ['survival', 'echo-form', 'falling-light', 'karmic-recompense', 'warding-scripture', 'earth-step', 'seven-stars']",
    "export const BARRIER_ALLY_SKILLS = ['survival', 'echo-form', 'falling-light', 'karmic-recompense', 'warding-scripture', 'earth-step', 'seven-stars','steal-agwi','steal-geumdwaeji','steal-geuseundae-2','steal-mangtae-halabeom','steal-songaksi','steal-imae-mangryang','steal-myogwi','steal-dokgak-gwi']"
   ],
   [
    "    act: null, // 이번 라운드에 고른 행동 { action, scanAmount?, psychic?, forced? }\n    ps: {}, // v-B.05 상태 이상(battle.js PS_INFO): 남은 턴 수",
    "    act: null, // 이번 라운드에 고른 행동 { action, scanAmount?, psychic?, forced? }\n    attackCount:0, stealUses:{}, statBuffs:[], fatalPrevent:false, reflectNextRaw:false, borrowedPsychic:null,\n    ps: {}, // v-B.05 상태 이상(battle.js PS_INFO): 남은 턴 수"
   ],
   [
    "  if (a === 'psychic' && !PSYCHIC_IDS.includes(act.psychic)) return { error: 'bad-psychic' }",
    "  if (a === 'psychic' && !PSYCHIC_IDS.includes(act.psychic) && !String(act.psychic).startsWith('steal-')) return {error:'bad-psychic'}\n  if (a === 'psychic' && String(act.psychic).startsWith('steal-') && !(m.psychics||[]).includes(act.psychic) && m.borrowedPsychic !== act.psychic && !((m.borrowPsychic || 0) > 0 && mb.members.some((x) => x.id !== m.id && x.status === 'alive' && (x.psychics || []).includes(act.psychic)))) return {error:'not-owned'}"
   ],
   [
    "  if (a === 'psychic' && mb.enemy.boss && Array.isArray(m.psychicBring) && !m.psychicBring.includes(act.psychic)) return { error: 'not-brought' }",
    "  if (a === 'psychic' && mb.enemy.boss && Array.isArray(m.psychicBring) && !m.psychicBring.includes(act.psychic) && m.borrowedPsychic !== act.psychic) return { error: 'not-brought' }"
   ],
   [
    "    target: a === 'psychic' && ['karmic-recompense', 'echo-form', 'warding-scripture'].includes(act.psychic) && typeof act.target === 'string' ? act.target : undefined,\n  }",
    "    target: a === 'psychic' && ['karmic-recompense', 'echo-form', 'warding-scripture','steal-agwi','steal-songaksi','steal-mangtae-halabeom','steal-jangsanbeom-2'].includes(act.psychic) && typeof act.target === 'string' ? act.target : undefined,\n    statKey:a==='psychic' && act.psychic==='steal-songaksi' && ['insight','aggression','endurance','control','agility','comprehension'].includes(act.statKey)?act.statKey:undefined,\n    queueIndex:a==='psychic' && act.psychic==='steal-heokkaebi' && Number.isInteger(act.queueIndex) && act.queueIndex>=0 && act.queueIndex<5 ? act.queueIndex:undefined,\n    queueEdits:a==='psychic' && act.psychic==='steal-jangsanbeom' && Array.isArray(act.queueEdits)?act.queueEdits.slice(0,5).filter(x=>Number.isInteger(x?.index)&&x.index>=0&&x.index<5&&['jab','guard','charge','smash'].includes(x?.intent)):undefined,\n  }\n  if (__borrow) { m.borrowPsychic -= 1; m.act.borrowed = true; addLog(mb, [{ kind: 'info', text: `[${m.name}] 일행의 영능력을 빌려 쓴다.` }], m.id) }"
   ],
   [
    "    targetId = act.target && mb.members.some((x) => x.id === act.target && x.status === 'alive') ? act.target : m.id",
    "    const isRevive = act.psychic === 'steal-agwi'\n    targetId = act.target && mb.members.some((x) => x.id === act.target && (x.status === 'alive' || (isRevive && (x.status === 'down' || x.pendingDeath)))) ? act.target : (isRevive ? null : m.id)"
   ],
   [
    "      { stats: m.stats, mp: m.mp, boost: m.boost, aura, buff: act.buff, sacrifice: act.sacrifice, target: targetId, selfId: m.id, amount: act.amount, rerolls: act.rerolls, baseAggression: m.baseAggression },",
    "      { stats: m.stats, mp: m.mp, mpMax:m.mpMax, boost: m.boost, aura, buff: act.buff, sacrifice: act.sacrifice, target: targetId, selfId: m.id, targetDown:!!mb.members.find(x=>x.id===targetId&&(x.status==='down'||x.pendingDeath)),targetAttacks:mb.members.find(x=>x.id===targetId)?.attackCount||0,statKey:act.statKey,queueEdits:act.queueEdits,queueIndex:act.queueIndex, amount: act.amount, rerolls: act.rerolls, baseAggression: m.baseAggression },"
   ],
   [
    "  mb.es = r.state.es || {}\n  banishCheck(mb, m, Math.max(0, mb.ehp - r.state.ehp))",
    "  mb.es = r.state.es || {}\n  if(mb.es.brySpirit!=null)mb.espirit=Math.min(mb.espirit,mb.es.brySpirit)\n  if(act.action==='attack')m.attackCount=(m.attackCount||0)+1\n  banishCheck(mb, m, Math.max(0, mb.ehp - r.state.ehp))"
   ],
   [
    "    // 다른 일행을 대상으로 골랐으면 그 사람의 체력은 이 함수가 알지 못하므로 여기서 직접 100으로 맞춘다.\n    if (r.earthReduction != null) mb.earthReduction = Math.max(mb.earthReduction || 0, r.earthReduction)",
    "    // 다른 일행을 대상으로 골랐으면 그 사람의 체력은 이 함수가 알지 못하므로 여기서 직접 100으로 맞춘다.\n    // D.06.7 수정 시트: 탈취 영능력의 실제 일행 전투 효과.\n    if (r.reviveTarget) {\n      const ally = mb.members.find(x => x.id===r.reviveTarget && (x.status==='down'||x.pendingDeath));\n      if (ally) { ally.status='alive';ally.pendingDeath=false;ally.php=Math.min(ally.phpMax,20);ally.mp=0;ally.stun=0; addLog(mb,[{kind:'warn',text:`[${ally.name}] 되살아났다! 체력 ${ally.php}, 의지력 0.`}],m.id) }\n    }\n    if (r.fatalPrevent) for (const x of aliveOf(mb)) {x.fatalPrevent=true;x.fatalPreventTurns=2}\n    if (r.shareRemainingMp) for(const x of aliveOf(mb)) if(x.id!==m.id) x.mp=Math.min(x.mpMax,x.mp+Math.floor(x.mp*0.5))\n    if (r.allyAttackBuff) {\n      const target=mb.members.find(x=>x.id===r.allyAttackBuff.target && x.status==='alive');\n      if(target) { const amt=Math.max(0,r.allyAttackBuff.attacks)*target.stats.aggression; target.stats.aggression+=amt;target.permanentBuff=(target.permanentBuff||0)+amt }\n    }\n    if (r.statBuff) {\n      const target=mb.members.find(x=>x.id===r.statBuff.target && x.status==='alive');\n      const allowed=['insight','aggression','endurance','control','agility','comprehension'];\n      if(target && allowed.includes(r.statBuff.stat)) {\n        const amt=r.statBuff.amount;target.stats[r.statBuff.stat]+=amt;\n        target.statBuffs ||= [];target.statBuffs.push({stat:r.statBuff.stat,amount:amt,rounds:r.statBuff.n});\n      }\n    }\n    if (r.firstTurnProtect) mb.protector=m.id\n    if (r.redirectNext) mb.redirectNext=r.redirectNext\n    if (r.reflectNextRaw) m.reflectNextRaw=true\n    if (r.borrowedPsychic) m.borrowedPsychic=r.borrowedPsychic\n    if (r.extraTurns) mb.order.splice(mb.turnIdx+1,0,...Array(Math.min(2,r.extraTurns)).fill(m.id))\n    if (r.state.stealUses) m.stealUses=r.state.stealUses\n    if (r.earthReduction != null) mb.earthReduction = Math.max(mb.earthReduction || 0, r.earthReduction)"
   ],
   [
    "  }\n  if (m.php <= 0) downOrPending(mb, m, lines)",
    "  }\n  if (m.php <= 0 && m.fatalPrevent) {m.fatalPrevent=false;m.php=16;lines.push({kind:'warn',text:`[${m.name}] 금돼지의 가호로 체력 16을 남겼다.`})}\n  if (m.php <= 0) downOrPending(mb, m, lines)"
   ],
   [
    "  // 내려쬐는 빛: 다음 적의 공격(단일·단체 모두, 영능력 포함)을 무조건 자신에게 맞게 한다 — 실제로 공격이 들어오는 턴에만 소모된다.\n  const flTarget = mb.fallingLight && mb.members.find((x) => x.id === mb.fallingLight && x.status === 'alive' && x.php > 0 && !(x.banished > 0))",
    "  // 내려쬐는 빛: 다음 적의 공격(단일·단체 모두, 영능력 포함)을 무조건 자신에게 맞게 한다 — 실제로 공격이 들어오는 턴에만 소모된다.\n  if(mb.protector && mb.members.some(x=>x.id===mb.protector && x.status==='alive' && x.php>0))mb.fallingLight=mb.protector\n  if(mb.redirectNext && ['jab','smash','special','group'].includes(intent)){mb.fallingLight=mb.redirectNext; mb.redirectNext=null}\n  const flTarget = mb.fallingLight && mb.members.find((x) => x.id === mb.fallingLight && x.status === 'alive' && x.php > 0 && !(x.banished > 0))"
   ],
   [
    "    const downed = r.state.pendingDeath || r.state.over === 'lose'",
    "    let downed = r.state.pendingDeath || r.state.over === 'lose'\n    if (downed && t.fatalPrevent) { t.fatalPrevent=false;t.php=16;t.pendingDeath=false;t.status='alive';downed=false;tevs=[{kind:'warn',text:`[${t.name}] 금돼지의 가호로 체력 16으로 살아남았다.`}]; }\n    if(t.reflectNextRaw && prevPhp>t.php){t.reflectNextRaw=false;const reflected=Math.max(1,Number(r.state.bryLastRaw)||Math.ceil(prevPhp-t.php));mb.ehp=Math.max(0,mb.ehp-reflected);tevs=[...tevs,{kind:'warn',text:`[${t.name}] 묘귀의 반격! 받은 원 피해에 준하는 ${reflected}을(를) 적에게 돌려주었다.`}]}\n"
   ],
   [
    "  }\n  for (const m of mb.members) m.guard = false",
    "  }\n  for(const x of mb.members) if(x.fatalPreventTurns>0){x.fatalPreventTurns-=1;if(!x.fatalPreventTurns)x.fatalPrevent=false}\n  for (const x of mb.members) if(Array.isArray(x.statBuffs)) x.statBuffs=x.statBuffs.filter(b=>{\n    b.rounds-=1;if(b.rounds<=0){x.stats[b.stat]-=b.amount;return false}return true\n  })\n  for (const m of mb.members) m.guard = false"
   ],
   [
    "      name: m.name,\n      agility: m.stats.agility,",
    "      name: m.name,\n      borrowedPsychic: m.borrowedPsychic||null,\n      stealUses: m.stealUses || {},\n      spiritStolen: m.spiritStolen || 0,\n      agility: m.stats.agility,"
   ]
  ]
 },
 {
  "file": "game/codex.js",
  "edits": [
   [
    "      extra: `${x.detail}\\n취득 조건: ${x.cond}`,",
    "      extra: x.detail,\n      acquireHint: x.cond || '아직 정해지지 않았다.',"
   ]
  ]
 },
 {
  "file": "game/hike.js",
  "edits": [
   [
    "  { id: 'wordChain', name: '끝말잇기', stat: 'aggression', result: '승리 : 당신은 낡은 사전과 한참 말씨름을 한 끝에 어떻게든 꼬투리를 잡아 보았다. 사전이 한 수 봐준 듯한 건 착각이겠지? \\n패배 : 사람이 책을 어떻게 이겨? 도깨비는 친절한 말투로 김서방치고는 힘냈다고 위로해준다.' },",
    "  { id: 'wordChain', name: '끝말잇기', stat: 'comprehension', result: '승리 : 당신은 낡은 사전과 한참 말씨름을 한 끝에 어떻게든 꼬투리를 잡아 보았다. 사전이 한 수 봐준 듯한 건 착각이겠지? \\n패배 : 사람이 책을 어떻게 이겨? 도깨비는 친절한 말투로 김서방치고는 힘냈다고 위로해준다.' },"
   ]
  ]
 },
 {
  "file": "game/items.js",
  "edits": [
   [
    "    desc: '무구에 은실을 박아 넣는 장인의 장식. 이 단계까지 오른 무구는 더 손댈 곳이 없다고들 한다.',",
    "    desc: '무구에 은실을 박아 넣는 장인의 장식. 무구의 중상급 강화에 쓰이는 정교한 장식이다.',"
   ],
   [
    "// 강화 1회당 선택 스탯 +1, 무구당 총 15포인트. n번째 강화에 연마석 n개(v-B.06) + 단계별 보조 재료 + 영력.",
    "// 강화 1회당 선택 스탯 +1, 무구당 총 15포인트. n번째 강화에 연마석 n개 + 단계별 보조 재료 + 영력.\n// D.06.8: 10~12강 은입사 장식(저레벨 적 드롭) 2/3/4개, 13~15강 고비용 제작 주사 호신부 1/2/3개."
   ],
   [
    "    material: ['whetstone', 'oil-cloth', 'five-knot', 'cinnabar-charm', 'silver-inlay'][tier],\n    quantity: lv % 3 + 1,",
    "    material: ['whetstone', 'oil-cloth', 'five-knot', 'silver-inlay', 'cinnabar-charm'][tier],\n    quantity: lv % 3 + 1 + (tier === 3 ? 1 : 0), // 10~12강 은입사 장식 2·3·4개: 초기 저레벨 드롭 난이도 보정"
   ]
  ]
 },
 {
  "file": "game/v79SheetData.js",
  "edits": [
   [
    "    \"effectText\": \"무구보관소에서 무구를 일반 강화(10~12)할 때 쓰는 재료.\"\n  },\n  \"silver-inlay\": {\n    \"effectText\": \"무구보관소에서 무구를 일반 강화(13~15)할 때 쓰는 재료.\"",
    "    \"effectText\": \"무구보관소에서 무구를 일반 강화(13~15)할 때 쓰는 재료.\"\n  },\n  \"silver-inlay\": {\n    \"effectText\": \"무구보관소에서 무구를 일반 강화(10~12)할 때 쓰는 재료(2·3·4개 필요).\""
   ]
  ]
 },
 {
  "file": "ui/components/CodexModal.jsx",
  "edits": [
   [
    "        <p className=\"font-serif text-base tracking-widest text-paper/45\">???</p>",
    "        <div className=\"min-w-0 flex-1\">\n          <p className=\"font-serif text-base tracking-widest text-paper/45\">???</p>\n          {e.kind === 'skill' && e.acquireHint && (\n            <p className=\"mt-1 whitespace-pre-line text-xs leading-relaxed text-paper/75\">얻는 방법 · {e.acquireHint}</p>\n          )}\n        </div>"
   ],
   [
    "        {e.extra && <p className=\"mt-1 whitespace-pre-line text-xs leading-relaxed text-gold\">{e.extra}</p>}\n        {admin && e.kind === 'item' && (",
    "        {e.extra && <p className=\"mt-1 whitespace-pre-line text-xs leading-relaxed text-gold\">{e.extra}</p>}\n        {e.kind === 'skill' && e.acquireHint && (\n          <p className=\"mt-1 whitespace-pre-line text-xs leading-relaxed text-paper/70\">얻는 방법 · {e.acquireHint}</p>\n        )}\n        {admin && e.kind === 'item' && ("
   ]
  ]
 },
 {
  "file": "ui/components/locations/Battle.jsx",
  "edits": [
   [
    "  const list = roster ?? ENEMIES\n  const [phase, setPhase] = useState('pick') // pick | fight | result",
    "  const list = roster ?? ENEMIES\n  const [stealStat,setStealStat] = useState('aggression')\n  const [phase, setPhase] = useState('pick') // pick | fight | result"
   ],
   [
    "    if (barrierOn(cur.enemy) && !['survival','echo-form','falling-light','karmic-recompense','earth-step','seven-stars','warding-scripture'].includes(id)) {",
    "    if (barrierOn(cur.enemy) && !['survival','echo-form','falling-light','karmic-recompense','earth-step','seven-stars','warding-scripture','steal-geumdwaeji','steal-songaksi','steal-myogwi','steal-dokgak-gwi'].includes(id)) {"
   ],
   [
    "    spend(-r.mpCost)\n    const bell = applyBell(r.state)",
    "    spend(-r.mpCost)\n    // D.06.7 — 독각귀의 즉시 추가 행동을 2번 예약한다.\n    if(r.extraTurns) r.state={...r.state,bryExtraTurns:(r.state.bryExtraTurns||0)+r.extraTurns}\n    const bell = applyBell(r.state)"
   ],
   [
    "    if (bell.state.over) finish(bell.state)\n    else runEnemy(bell.state)",
    "    if (bell.state.over) finish(bell.state)\n    else if((bell.state.bryExtraTurns||0)>0){\n      const nx={...bell.state,bryExtraTurns:bell.state.bryExtraTurns-1}\n      setB(nx);beginRef.current?.(nx)\n    }\n    else runEnemy(bell.state)"
   ],
   [
    "            const mine = ownedPsychics(psychics)",
    "            const mine = ownedPsychics([...(psychics||[]),...(b?.bryMimic?[b.bryMimic]:[])]).filter(p=>!(p.id==='steal-yagwanggwi'&&b?.stealUses?.['steal-yagwanggwi']))"
   ],
   [
    "                      <div className=\"mt-2 flex gap-2\"><input type=\"number\" aria-label=\"전할 의지력\" min=\"1\" max={mp} value={mpGift} onChange={e=>setMpGift(Math.max(1,Math.floor(Number(e.target.value)||1)))} className=\"w-20 rounded bg-shade px-2 text-paper\"/><button type=\"button\" className=\"flat-btn\" onClick={()=>usePsychic(s.id,{amount:mpGift})}>사용</button></div>\n                    ) : s.id === 'language-barrier' ? (",
    "                      <div className=\"mt-2 flex gap-2\"><input type=\"number\" aria-label=\"전할 의지력\" min=\"1\" max={mp} value={mpGift} onChange={e=>setMpGift(Math.max(1,Math.floor(Number(e.target.value)||1)))} className=\"w-20 rounded bg-shade px-2 text-paper\"/><button type=\"button\" className=\"flat-btn\" onClick={()=>usePsychic(s.id,{amount:mpGift})}>사용</button></div>\n                    ) : s.id === 'steal-songaksi' ? (\n                       <div className=\"mt-2 flex flex-wrap gap-2\"><select aria-label=\"강화할 육조\" value={stealStat} onChange={e=>setStealStat(e.target.value)} className=\"rounded bg-shade p-2 text-paper\">{[['insight','안목'],['aggression','호전'],['endurance','인내'],['control','절제'],['agility','신속'],['comprehension','이해']].map(([k,n])=><option key={k} value={k}>{n}</option>)}</select><button type=\"button\" className=\"flat-btn\" onClick={()=>usePsychic(s.id,{statKey:stealStat})}>사용</button></div>\n                    ) : s.id === 'language-barrier' ? ("
   ]
  ]
 },
 {
  "file": "ui/components/locations/MultiBattle.jsx",
  "edits": [
   [
    "  const [pawAmt, setPawAmt] = useState(1) // 원숭이 손: 깎을 체력\n  const [echoTarget, setEchoTarget] = useState(meId) // 형상 기억: 체력을 회복시킬 대상(기본값은 자기 자신)",
    "  const [pawAmt, setPawAmt] = useState(1) // 원숭이 손: 깎을 체력\n  const [stealTarget,setStealTarget]=useState(meId)\n  const [stealStat,setStealStat]=useState('aggression')\n  const [stealQueueIndex,setStealQueueIndex]=useState(0)\n  const [stealQueueEdits,setStealQueueEdits]=useState({})\n  const [echoTarget, setEchoTarget] = useState(meId) // 형상 기억: 체력을 회복시킬 대상(기본값은 자기 자신)"
   ],
   [
    "            const mine = ownedPsychics(psychics).filter((p) => p.default || !view.boss || !Array.isArray(me?.psychicBring) || me.psychicBring.includes(p.id))",
    "            const mine = ownedPsychics([...(psychics||[]),...(me?.borrowedPsychic?[me.borrowedPsychic]:[])]).filter(p=>(p.default || p.id===me?.borrowedPsychic || !view.boss || !Array.isArray(me?.psychicBring) || me.psychicBring.includes(p.id)) && !(p.id==='steal-yagwanggwi' && me?.stealUses?.['steal-yagwanggwi']))"
   ],
   [
    "                      </>\n                    ) : (",
    "                      </>\n                    ) : ['steal-agwi','steal-geumdwaeji','steal-songaksi','steal-mangtae-halabeom','steal-jangsanbeom-2','steal-jangsanbeom','steal-heokkaebi'].includes(s.id) ? (\n                      <div className=\"mt-2 flex flex-col gap-2\">\n                        {['steal-agwi','steal-songaksi','steal-mangtae-halabeom','steal-jangsanbeom-2'].includes(s.id) && <select aria-label=\"영능력 대상\" value={stealTarget||meId} onChange={e=>setStealTarget(e.target.value)} className=\"rounded-lg border border-edge/25 bg-ink-muted/60 p-2 text-paper\">\n                          {view.members.filter(x=>s.id==='steal-agwi' ? x.status==='down'||x.pendingDeath : x.status==='alive').map(x=><option key={x.id} value={x.id}>{x.name}{x.id===meId?' (나)':''}</option>)}\n                        </select>}\n                        {s.id==='steal-songaksi' && <select aria-label=\"강화할 육조\" value={stealStat} onChange={e=>setStealStat(e.target.value)} className=\"rounded-lg border border-edge/25 bg-ink-muted/60 p-2 text-paper\">\n                         {[['insight','안목'],['aggression','호전'],['endurance','인내'],['control','절제'],['agility','신속'],['comprehension','이해']].map(([k,n])=><option key={k} value={k}>{n}</option>)}\n                        </select>}\n                        {s.id==='steal-jangsanbeom' && <div className=\"grid grid-cols-2 gap-1\">\n                          {(view.queue||[]).slice(0,5).map((q,i)=><label key={i} className=\"text-xs text-paper/80\">{i+1}번째\n                            <select aria-label={`${i+1}번째 적 행동`} disabled={q==='special'} value={stealQueueEdits[i]||q} onChange={e=>setStealQueueEdits(p=>({...p,[i]:e.target.value}))} className=\"mt-1 w-full rounded border border-edge/25 bg-ink-muted/60 p-1 text-paper\">\n                              {(q==='special'?[['special','영능력(수정 불가)']]:[['jab','약공'],['guard','방어 태세'],['charge','기 모으기'],['smash','강공']].filter(([k])=> !(k==='charge'&&i===4))).map(([k,n])=><option key={k} value={k}>{n}</option>)}\n                            </select>\n                          </label>)}\n                        </div>}\n                        {s.id==='steal-heokkaebi' && <select aria-label=\"삭제할 적의 행동\" value={stealQueueIndex} onChange={e=>setStealQueueIndex(+e.target.value)} className=\"rounded-lg border border-edge/25 bg-ink-muted/60 p-2 text-paper\">\n                         {(view.queue||[]).slice(0,5).map((q,i)=><option key={i} value={i} disabled={q==='special'}>{i+1}번째 {INTENTS[q]?.label||q}{q==='special'?' (삭제 불가)':''}</option>)}\n                        </select>}\n                        <button type=\"button\" className=\"flat-btn\" disabled={!canAct} onClick={()=>send({action:'psychic',psychic:s.id,target:stealTarget||meId,statKey:stealStat,queueIndex:stealQueueIndex,queueEdits:Object.entries(stealQueueEdits).map(([index,intent])=>({index:Number(index),intent}))})}>사용</button>\n                      </div>\n                    ) : ("
   ]
  ]
 }
]
