// 비령 v1.9.5 — 본편 이야기 전투를 3인 전투로.
// vC.06 — 1인 전투도 있었다 · vD.02.4부터 본편 이야기 전투는 모두 3인(storySize).
//   다인 전투: ① NPC(연호수 · 윤진서)와 함께 — 전투마다 계정당 1번(이기면 다 쓴 것)  ② 같은 진도의 학생과 파티
//              ③ 이미 깬 학생이 「돕는 선배」로 다른 학생의 파티에 다시 들어갈 수 있다 — 영력 · 최초 보상은 없고 냥은 2배.
//                 처음 싸우는 학생(방장)이 있는 파티에만 들어갈 수 있다(돕는 사람은 파티를 열 수 없다).
//
// 고르는 법: ① 연호수 · 윤진서(NPC)와 함께  ② 같은 진도(같은 장면의 같은 전투)의 학생과 파티(서버가 연결됐을 때)
// 전투 엔진은 보관고의 다인 전투(mbattle.js)를 이 브라우저에서 그대로 돌린다. 파티라면 방장의 브라우저가 판을 돌리고,
// 서버(Supabase bry_party_*)에는 판의 모습(view)과 일행이 보낸 행동만 오간다. 일행은 그 모습을 받아 같은 전투 화면(MultiBattle)으로 본다.
// 본편 패턴(이름 부르기 · 진정 · 뿌리)은 판(mb.story)에 얹어, 행동이 끝날 때마다 여기서 적용한다.
import { useEffect, useRef, useState } from 'react'
import BsPicker from './BsPicker.jsx'
import { activeBs as __activeBs } from '@vault/game/battleItems.js'
import { createMB, openingInitiative, beginRound, resolveTurn, submit, survive, autoFill, viewOf, noteMB, dropMember, useItemMB, MB_INPUT_MS } from '@vault/game/mbattle.js'
import MultiBattle from '@vault/ui/components/locations/MultiBattle.jsx'
import { itemOf, weaponFx, trinketFx, equipOf, itemTurnFree } from '@vault/game/items.js'
import { ownedPassives } from '@vault/game/battle.js'
import { TIER_REC } from './tierScale.js'
import BattleBag from './BattleBag.jsx'
import BringPicker from '@vault/ui/components/BringPicker.jsx'
import PassivePicker from '@vault/ui/components/PassivePicker.jsx'
import { STORY_FOES } from './storyBoss.js'
import { errorBossSkillAt, prepareErrorBossMove, finishErrorBossRound } from './oracleSkills.js'

const Auth = () => globalThis.BiryeongAuth
const live = () => !!(Auth()?.server && Auth()?.token())
const call = (name, args) => Auth().call(name, args)
const PARTY_HP = 2.6 // 3인 상대는 혼자 상대의 2.6배 체력
const NPCS = [
  { id: 'npc-hosu', name: '연호수', fx: 'spear', w: { aggression: 0.26, agility: 0.2, endurance: 0.2, insight: 0.14, control: 0.1, comprehension: 0.1 } },
  { id: 'npc-jinseo', name: '윤진서', fx: 'bell', w: { insight: 0.24, control: 0.2, comprehension: 0.2, endurance: 0.16, agility: 0.1, aggression: 0.1 } },
]
const STAT_KEYS = ['insight', 'aggression', 'endurance', 'control', 'agility', 'comprehension']
const NAME_RIGHT = '한도윤', NAME_WRONG = ['한도율', '한도임', '한도영']

/** 내 수치 → 전투 엔진에 넣는 일행 한 사람 */
// vC.07.6 무구(fx) · 장신구(trinket) · 특수 강화(special) · 부활/마이쭈 대기도 함께 넘긴다(예전엔 빠져 있어 일행 전투에서 무구 효과가 없었다)
export function memberOf({ id, name, stats, player, revive = false, boost = false }) {
  return {
    id, name,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(1, Math.round(stats?.[k] ?? 1))])),
    fx: weaponFx(player) ?? stats?.fx ?? null, trinket: trinketFx(player) ?? null, special: player.weaponSpecial?.[equipOf(player).weapon] ?? null,
    revive: !!revive, boost: !!boost,
    has: Object.fromEntries(['st-portrait', 'st-bell302'].filter((k) => (player.inventory?.[k] || 0) > 0).map((k) => [k, true])), // vD.01 본편 물건(영정 조각 등)은 지닌 사람만 쓴다
    hp: player.hp, hpMax: player.hpMax, mp: player.mp, mpMax: player.mpMax,
    psychics: player.psychics ?? [], baseAggression: player.stats?.aggression, curseUntil: player.curseUntil || 0,
  }
}
/** vD.02.3 상대의 적정 스탯 위쪽 끝(「16~18」→ 18 · 「4」→ 4) */
const recTop = (enemy) => { const nums = String(enemy?.rec ?? TIER_REC[enemy?.tier] ?? '').match(/\d+/g); return nums ? Math.max(...nums.map(Number)) : 0 }
/** NPC 둘: vD.02.3 여섯 스탯 모두 「상대 적정 스탯 + 1」(적정 16~18 → 모두 19 · 적정 4 → 모두 5). 적정을 모르면 예전처럼 내 스탯 합을 성향대로 나눈다. */
function npcMembers(me, enemy) {
  const top = recTop(enemy)
  const total = STAT_KEYS.reduce((s, k) => s + (me.stats[k] || 1), 0)
  return NPCS.map((n) => ({
    id: n.id, name: n.name, fx: n.fx, npc: true,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, top ? top + 1 : Math.max(1, Math.round(total * n.w[k]))])),
    hp: me.hpMax, hpMax: me.hpMax, mp: me.mpMax, mpMax: me.mpMax, psychics: [],
  }))
}
const isNpc = (id) => String(id).startsWith('npc-')
// vD.06 이벤트 「학생 괴담 수칙」 마지막 — 번진 먹이 노리는 새끼 신수 다섯
// [아이디, 이름, 부르는 말, 이름+이/가, 이름+을/를]
export const SMEAR_KIDS = [['cheongnyong', '새끼 청룡', '청룡아', '새끼 청룡이', '새끼 청룡을'], ['baekho', '새끼 백호', '백호야', '새끼 백호가', '새끼 백호를'], ['jujak', '새끼 주작', '주작아', '새끼 주작이', '새끼 주작을'], ['hyeonmu', '새끼 현무', '현무야', '새끼 현무가', '새끼 현무를'], ['gumiho', '새끼 구미호', '구미호야', '새끼 구미호가', '새끼 구미호를']]
const kidOf = (id) => SMEAR_KIDS.find((k) => k[0] === id) || [id, id, id, id, id]
const smearMul = (st) => 0.55 + 0.2 * (st.named?.length || 0)
const shuffle = (arr, seed) => { const a = [...arr]; let x = seed * 9301 + 49297; for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor((x / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const nameOptions = (st, round) => { const wi = (round + st.hits) % 3; return shuffle([NAME_RIGHT, NAME_WRONG[wi], NAME_WRONG[(wi + 1) % 3]], round + st.hits) }
const pct = (mb, p) => Math.max(1, Math.ceil(mb.enemy.hp * p))
const cutCost = (m) => (['fan', 'staff'].includes(m?.fx) ? 4 : 8)

/** 3인 상대 만들기 */
// vC.07.3 체력은 실제로 함께 싸우는 사람 수(NPC 포함)에 맞춘다: 1명 1배 · 2명 1.8배 · 3명 2.6배
// vD.02 2명이 싸워도 줄이지 않는다 — 3인 기준 그대로
const hpMul = (n) => (n <= 1 ? 1 : PARTY_HP)
// vC.07.6 보스: 보관고 보스(boss)는 기믹까지 그대로, 본편 보스(패턴이 있는 이야기 상대)는 가져가기 제한(bringLimit)만 건다
function partyEnemy(enemy, size = 3, n = 3, limit = false) {
  // 「다인 전투」 상대(partySize 2 · 3)는 이미 그 인원 기준의 체력이라, 모인 사람 수와의 비율만큼만 고친다(적게 모이면 조금 줄고, 많이 모이면 조금 는다)
  const base = Math.max(1, Math.min(3, enemy.partySize ?? 1))
  const flags = { boss: !!enemy.boss, bringLimit: !!limit }
  return size > 1 ? { ...enemy, ...flags, hp: Math.round(enemy.hp * hpMul(n) / hpMul(base)), partySize: Math.max(1, Math.min(3, n)) } : { ...enemy, ...flags, partySize: 1 }
}
/** vC.07.6 보스 전투 준비: 고른 것을 안전한 모양으로(아이템 낱개 3개 · 영능력 2개 · 영력결계 끄기) */
export const BRING_ITEMS = 3, BRING_PSYCHICS = 2
export function cleanPick(raw, member, boss) {
  const out = { passiveOff: (Array.isArray(raw?.passiveOff) ? raw.passiveOff : []).filter((x) => x === 'spirit-barrier') }
  if (!boss) return out
  const bring = {}; let t = 0
  for (const [id, n0] of Object.entries(raw?.items && typeof raw.items === 'object' ? raw.items : {})) {
    const n = Math.min(BRING_ITEMS - t, Math.max(0, Math.floor(Number(n0) || 0)))
    if (!n || !itemOf(id)?.battle) continue
    bring[id] = n; t += n
    if (t >= BRING_ITEMS) break
  }
  const own = member?.psychics || []
  out.bring = bring
  out.psychicBring = [...new Set((Array.isArray(raw?.psychics) ? raw.psychics : []).filter((x) => typeof x === 'string' && own.includes(x)))].slice(0, BRING_PSYCHICS)
  return out
}
const ITEM_ERR = { already: '이미 효과가 걸려 있다.', 'bad-target': '그 사람에게는 쓸 수 없다.', 'not-your-turn': '이 아이템은 내 차례에만 쓸 수 있다.', busy: '지금은(행동불능 · 도깨비불 충전 중) 아이템을 쓸 수 없다.', 'item-seal': '주머니를 빼앗겨 지금은 아이템을 쓸 수 없다.', 'heal-block': '돌림병 탓에 지금은 회복 아이템이 듣지 않는다.', 'not-brought': '보스 전투에는 가져온 아이템만 쓸 수 있다.', 'not-fighting': '지금은 쓸 수 없다.', 'not-battle-item': '전투에서 쓰는 아이템이 아니다.' }
const itemErr = (e) => ITEM_ERR[e] ?? (typeof e === 'string' && e.length > 12 ? e : '지금은 쓸 수 없다.')
function newMB(enemy, members, size = 3, limit = false) {
  const mb = createMB(partyEnemy(enemy, size, members.length, limit), members)
  const p = enemy.story?.pattern
  const taint = enemy.story?.taint || 0 // vD.02.2 기다리는 것: 정신오염에 따라 모습
  mb.story = { p, key: enemy.story?.key, hits: 0, broken: false, calm: 0, asked: 0, askedBy: {}, shown: false, roots: 3, baseAtk: mb.enemy.atk, has: enemy.story?.has || {}, form: taint < 20 ? 'mercy' : taint < 50 ? 'revenge' : 'fear', taint, freeze: 0, read: false }
  if (p === 'forms') noteMB(mb, `${mb.enemy.name}의 모습 — ${FORM_NAME[mb.story.form]} (정신오염 ${taint})`)
  // vD.06.9: 4장 오류의 영능력은 일반 공격 대신 실제 시전되는 두 기술이다
  if (p === 'smear') { Object.assign(mb.story, { named: [], aim: null, wait: 1 }); noteMB(mb, `[${mb.enemy.name}] 다섯⋯ 이름 없는 다섯⋯ — 먹이 보관소 안의 새끼 신수들을 더듬는다.`) }
  if (p === 'oracle') { mb.story.jump = false; mb.story.rStart = mb.ehp; noteMB(mb, `[${mb.enemy.name}] 시곗바늘을 쥔다 — 첫 차례에 23시 17분으로 뛰어넘을 셈이다.`) }
  // 상대가 선공할 수도 있으므로 첫 영능력을 선공 판정보다 먼저 예약한다.
  if (p === 'oracle') prepareErrorBossMove(mb)
  const openingRound = mb.round
  openingInitiative(mb)
  // 상대 선공으로 첫 라운드가 끝난 경우에도 「신탁」 시전을 놓치지 않는다.
  if (p === 'oracle' && mb.round > openingRound && !mb.over) {
    finishErrorBossRound(mb, openingRound, (line) => noteMB(mb, line))
  }
  if (!mb.turn && mb.phase === 'input') beginRound(mb)
  return mb
}
const FORM_NAME = { mercy: '자비형: 공격이 가끔 멈추고 스스로 낫는다', revenge: '복수형: 준 피해의 4분의 1이 되돌아온다', fear: '공포형: 공격이 더 아프다' }
const win = (mb, calmed) => { mb.ehp = calmed ? mb.ehp : 0; mb.over = 'win'; mb.phase = 'over'; mb.turn = null; if (calmed) mb.enemy = { ...mb.enemy, calmed: true } }

/** 행동 하나를 처리한다(엔진) + 본편 패턴을 얹는다 */
function resolveWithStory(mb, actorId, offensive) {
  const st = mb.story, before = mb.ehp, round0 = mb.round
  resolveTurn(mb)
  const dealt = Math.max(0, before - mb.ehp)
  if (st?.p && dealt > 0 && mb.over !== 'win') {
    let mult = 1, why = ''
    if (st.p === 'names' && st.broken) { mult = 2; why = '방어가 무너진 명부의 귀신' }
    if (st.p === 'roots') { mult = st.roots > 0 ? 1 - 0.2 * st.roots : 1.3; why = st.roots > 0 ? `뿌리 ${st.roots}개가 받아 낸다` : '뿌리째 드러난 당산신' }
    if (st.p === 'smear') { mult = smearMul(st); why = st.named.length < 5 ? `이름 없는 새끼들에게서 먹을 끌어온다(불린 이름 ${st.named.length}/5)` : '이름을 모두 빼앗긴 먹' }
    if (mult !== 1) {
      const want = Math.round(dealt * mult)
      mb.ehp = Math.max(0, Math.min(mb.enemy.hp, before - want))
      noteMB(mb, `${why} — 준 피해 ${dealt} → ${want}.`)
      if (mb.ehp <= 0) win(mb)
    }
  }
  if (st?.p === 'forms' && !st.freeze && dealt > 0 && mb.over !== 'win') { // vD.02.2 기다리는 것
    if (st.form === 'mercy' && offensive && Math.random() < 0.3) { mb.ehp = before; noteMB(mb, '손이 멈춘다 — 그것은 누군가의 얼굴로 웃고 있다. (공격이 들어가지 않았다)') }
    if (st.form === 'revenge') { const a = mb.members.find((x) => x.id === actorId); const d = Math.ceil(dealt * 0.25); if (a && a.status === 'alive' && d > 0) { a.php = Math.max(1, a.php - d); noteMB(mb, `복수형 — 준 피해의 4분의 1이 [${a.name}]에게 되돌아왔다. 체력 −${d}`) } }
  }
  if (st?.p === 'forms' && mb.round > round0 && !mb.over) {
    if (!st.freeze && st.form === 'mercy') { const h = Math.min(mb.enemy.hp - mb.ehp, pct(mb, 0.04)); if (h > 0) { mb.ehp += h; noteMB(mb, `자비형 — 그것이 스스로를 쓰다듬는다. 체력 +${h}`) } }
    if (st.freeze) { st.freeze -= 1; if (!st.freeze) noteMB(mb, '쪽지의 힘이 다했다. 그것이 다시 모습을 되찾는다.') }
  }
  if (st?.p === 'forms') mb.enemy.atk = st.form === 'fear' && !st.freeze ? Math.round(st.baseAtk * 1.3) : st.baseAtk
  if (st?.p === 'calm' && offensive && dealt > 0) { st.calm = Math.max(0, st.calm - 20); noteMB(mb, `그 사람이 더 크게 운다. 평온 −20 (지금 ${st.calm})`) }
  // vD.01 죽음을 들은 자(난이도↑): 라운드마다 평온이 8씩 가라앉고, 평온이 50 아래면 세 라운드마다 일행 모두에게 몸부림친다
  if (st?.p === 'calm' && mb.round > round0 && !mb.over) {
    if (st.calm > 0 && st.calm < 100) { st.calm = Math.max(0, st.calm - 8); noteMB(mb, `그 사람이 다시 흐느낀다 — "나 여기 있잖아…" 평온 −8 (지금 ${st.calm})`) }
    if (mb.round % 3 === 0 && st.calm < 50 && mb.queue?.length) { mb.queue = ['group', ...mb.queue.slice(1)]; noteMB(mb, '✦ 그 사람이 몸부림친다! 이번 차례에 일행 모두를 친다.') }
  }
  if (st?.p === 'calm') mb.enemy.atk = st.calm >= 50 ? Math.max(1, Math.round(st.baseAtk / 2)) : Math.round(st.baseAtk * 1.2)
  if (st?.p === 'names' && st.broken) mb.queue = mb.queue.map((q) => (q === 'guard' ? 'jab' : q))
  if (st?.p === 'oracle' && mb.round > round0 && !mb.over) {
    finishErrorBossRound(mb, round0, (line) => noteMB(mb, line))
  }
  // vD.06 번진 먹: 두 라운드마다 새끼 하나를 노린다 — 그 라운드에 [이름을 부른다]면 그 새끼는 다시 노려지지 않고 먹이 크게 약해진다.
  //       놓치면 먹이 몸을 불릴 뿐 새끼가 먹히지는 않는다(전투가 길어질 뿐).
  if (st?.p === 'smear' && mb.round > round0 && !mb.over) {
    if (st.aim) {
      const h = Math.min(mb.enemy.hp - mb.ehp, pct(mb, 0.06)); mb.ehp += h
      noteMB(mb, `번진 먹이 ${kidOf(st.aim)[4]} 놓쳤다. 새끼는 보관소 구석으로 숨었지만, 먹이 몸을 불린다. 체력 +${h}`)
      st.aim = null; st.wait = 1
    } else if ((st.wait = (st.wait || 1) - 1) <= 0) {
      const left = SMEAR_KIDS.filter((k) => !st.named.includes(k[0]))
      if (left.length) { const k = left[mb.round % left.length]; st.aim = k[0]; st.wait = 2; noteMB(mb, `✦ 번진 먹이 「${k[1]}」에게 손을 뻗는다! 이번 라운드에 [이름을 부른다]로 지켜 주자.`) }
    }
  }
  if (st?.p === 'smear') mb.enemy.atk = Math.max(1, Math.round(st.baseAtk * (1 - 0.1 * st.named.length)))
  if (st?.p === 'roots' && st.roots > 0 && mb.round > round0 && !mb.over) {
    const h = Math.min(mb.enemy.hp - mb.ehp, pct(mb, 0.04 * st.roots))
    if (h > 0) { mb.ehp += h; noteMB(mb, `뿌리가 마을의 불행을 빨아올린다. ${mb.enemy.name} 체력 +${h}`) }
  }
}

/** 이야기 행동(이름 부르기 · 이름 묻기 · 곁에 앉기 · 금줄 끊기). 반환 { ok } 또는 { error } */
function storyAct(mb, id, act, arg) {
  const m = mb.members.find((x) => x.id === id), st = mb.story
  if (!m || mb.phase !== 'input' || mb.turn !== id || m.act) return { error: '지금은 할 수 없다.' }
  if (st.p === 'names' && act === 'name') {
    if (arg === NAME_RIGHT) {
      st.hits += 1
      const d = Math.min(mb.ehp, pct(mb, 0.08)); mb.ehp -= d
      noteMB(mb, `[${m.name}] "${NAME_RIGHT}!" — 이름이 제자리를 찾는다. 명부의 귀신이 움찔한다. (피해 ${d} · ${st.hits}/3)`)
      if (st.hits >= 3 && !st.broken) { st.broken = true; noteMB(mb, '✦ 명부의 귀신의 방어가 무너졌다! 이제 받는 피해 ×2, 막지 못한다.') }
      if (mb.ehp <= 0) { win(mb); return { ok: true } }
    } else {
      const h = Math.min(mb.enemy.hp - mb.ehp, pct(mb, 0.1)); mb.ehp += h
      noteMB(mb, `[${m.name}] "${arg}" — 명부의 귀신이 그 이름을 삼켰다. 체력 +${h}`)
    }
  } else if (st.p === 'calm' && (act === 'ask' || act === 'sit' || act === 'show')) {
    // vD.01 묻기는 사람마다 처음 한 번만 크게(+20, 다시 물으면 +6) · 곁에 앉기 +12 · 흐린 영정 조각은 지닌 사람이 한 판에 한 번 +30
    st.askedBy = st.askedBy || {}
    if (act === 'show') {
      if (st.shown) return { error: '영정 조각은 이미 보였다.' }
      if (!m.has?.['st-portrait']) return { error: '보일 영정 조각이 없다.' }
      st.shown = true; st.calm = Math.min(100, st.calm + 30)
      noteMB(mb, `[${m.name}] 흐린 영정 조각을 내민다. 그 사람이 사진 속 얼굴을 한참 들여다본다. 평온 +30 (지금 ${st.calm})`)
    } else if (act === 'ask') { st.asked += 1; const first = !st.askedBy[id]; st.askedBy[id] = (st.askedBy[id] || 0) + 1; const g = first ? 20 : 6; st.calm = Math.min(100, st.calm + g); noteMB(mb, `[${m.name}] "이름이 뭐예요?" — ${first ? '그 사람이 입술을 움직인다' : '같은 물음에 그 사람이 고개를 젓는다'}. 평온 +${g} (지금 ${st.calm})`) }
    else { st.calm = Math.min(100, st.calm + 12); noteMB(mb, `[${m.name}] 곁에 앉는다. 막는 자세로 기다린다. 평온 +12 (지금 ${st.calm})`) }
    if (st.calm >= 100) { noteMB(mb, `${mb.enemy.name}이(가) 자기 이름을 말하고 주저앉는다. 진정시켰다 — 이야기 승리.`); win(mb, true); return { ok: true } }
    if (act === 'sit') { const r = submit(mb, id, { action: m.bound ? 'attack' : 'guard' }); if (r.error) m.act = { action: 'item' }; resolveWithStory(mb, id, false); return { ok: true } }
  } else if (st.p === 'forms' && act === 'read') { // vD.02.2 기도 쪽지 묶음을 읽어 준다
    if (st.read) return { error: '쪽지는 이미 읽어 주었다.' }
    if (!st.has?.['st-prayers'] && !m.has?.['st-prayers']) return { error: '읽어 줄 쪽지가 없다.' }
    st.read = true; st.freeze = 3
    if (mb.queue?.length) mb.queue = ['none', ...mb.queue.slice(1)]
    noteMB(mb, `[${m.name}] 기도 쪽지를 한 장씩 소리 내어 읽는다. "돌아와." "돌아와." — 그것이 멈춘다. 세 라운드 동안 모습의 힘이 꺼진다.`)
  } else if (st.p === 'roots' && act === 'cut') {
    const c = cutCost(m)
    if (st.roots <= 0) return { error: '끊을 뿌리가 남아 있지 않다.' }
    if (m.mp < c) return { error: `의지력이 모자라다. (필요 ${c})` }
    m.mp -= c; st.roots -= 1
    noteMB(mb, `[${m.name}] 금줄 하나를 끊었다. 뿌리 하나가 흙 속에서 말라 간다. (남은 뿌리 ${st.roots})`)
    if (!st.roots) noteMB(mb, '✦ 당산신이 뿌리째 드러났다! 받는 피해 +30%.')
  } else if (st.p === 'smear' && act === 'call') {
    if (!st.aim) return { error: '지금 노려지는 새끼가 없다.' }
    const k = kidOf(st.aim)
    st.named.push(st.aim); st.aim = null; st.wait = 2
    const d = Math.min(mb.ehp, pct(mb, 0.1)); mb.ehp -= d
    noteMB(mb, `[${m.name}] "${k[2]}!" — 이름이 불린 ${k[3]} 몸에 붙은 먹을 털어 낸다. 번진 먹이 크게 흔들린다. (피해 ${d} · 불린 이름 ${st.named.length}/5)`)
    if (st.named.length >= 5) noteMB(mb, '✦ 다섯 모두의 이름이 불렸다! 번진 먹이 더는 숨을 곳이 없다 — 받는 피해가 크게 늘고 공격이 약해진다.')
    mb.enemy.atk = Math.max(1, Math.round(st.baseAtk * (1 - 0.1 * st.named.length)))
    if (mb.ehp <= 0) { win(mb); return { ok: true } }
  } else return { error: '쓸 수 없는 행동이다.' }
  m.act = { action: 'item' } // 턴만 넘긴다
  resolveWithStory(mb, id, false)
  return { ok: true }
}

/** NPC 의 차례: 패턴에 맞는 이야기 행동을 먼저, 아니면 상대의 다음 수를 보고 고른다. */
function npcTurn(mb, m) {
  const st = mb.story, intent = mb.queue[0]
  if (m.act?.forced) { resolveWithStory(mb, m.id, true); return }
  if (st?.p === 'calm') { const r = storyAct(mb, m.id, !st.askedBy?.[m.id] ? 'ask' : 'sit'); if (r.ok) return }
  if (st?.p === 'roots' && m.id === 'npc-jinseo' && st.roots > 0 && m.mp >= cutCost(m)) { if (storyAct(mb, m.id, 'cut').ok) return }
  // 이름 부르기는 플레이어만 한다(NPC 가 부르면 정답이 드러난다)
  let action = 'attack'
  if (st?.p === 'oracle' && mb.round % 3 === 0) { const r0 = submit(mb, m.id, { action: 'guard' }); if (!r0.error) { resolveWithStory(mb, m.id, false); return } } // vD.03 되감는 라운드엔 공격을 아낀다
  // vD.02.3 부적도 쓴다: 상대가 방어 태세면 꼭, 그 밖에도 부적이 남아 있고 의지력이 넉넉하면 절반쯤은 부적으로(마지막 하나는 방어 태세용으로 아낀다)
  if (['smash', 'special', 'group'].includes(intent) && !m.bound) action = 'guard'
  else if (m.charms > 0 && m.mp >= 12 && (intent === 'guard' || (m.charms > 1 && Math.random() < 0.5) || mb.ehp <= mb.enemy.hp * 0.25)) action = 'charm'
  const r = submit(mb, m.id, { action })
  if (r.error) submit(mb, m.id, { action: 'attack' })
  resolveWithStory(mb, m.id, action !== 'guard')
}

/* ───────── 이야기 행동 단추 ───────── */
function StoryPanel({ story, round, me, myTurn, onStory, hasPortrait = false }) {
  if (!story?.p) return null
  const btn = (key, label, note, arg, off) => (
    <button key={key} type="button" disabled={!myTurn || off} onClick={() => onStory(key.split(':')[0], arg)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '9px 12px', borderRadius: 10, textAlign: 'left',
        background: myTurn && !off ? '#1f2f3d' : '#141e28', border: `1px solid ${myTurn && !off ? '#d9b46a' : '#4a5866'}`, cursor: myTurn && !off ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 14, color: myTurn && !off ? '#ffe2a8' : '#c9c2b2' }}>{label}</span>
      <span style={{ fontSize: 11, color: myTurn && !off ? '#e8dcc4' : '#a59e90' }}>{note}</span>
    </button>
  )
  let meter = null; const acts = []
  if (story.p === 'names') {
    meter = <p>이름 {'●'.repeat(story.hits)}{'○'.repeat(Math.max(0, 3 - story.hits))} {story.broken ? '· 방어 붕괴' : ''}</p>
    nameOptions(story, round).forEach((n) => acts.push(btn(`name:${n}`, `"${n}" 하고 부른다`, story.has?.['st-bell302'] && n === NAME_RIGHT ? '♪ 303호의 방울이 운다' : '이름 부르기 · 턴을 쓴다', n)))
  } else if (story.p === 'calm') {
    meter = <div><p>평온 {story.calm} / 100 {story.calm >= 50 ? '· 그 사람의 공격이 절반' : '· 라운드마다 −8 · 세 라운드마다 몸부림'}</p><div className="mt-1 h-1.5 w-full rounded bg-edge/15"><div className="h-1.5 rounded bg-gold" style={{ width: `${story.calm}%` }} /></div></div>
    acts.push(btn('ask', '이름을 묻는다', !story.askedBy?.[me?.id] ? '평온 +20 (사람마다 처음 한 번)' : '평온 +6'))
    acts.push(btn('sit', '곁에 앉는다', '평온 +12 · 막기'))
    if (hasPortrait) acts.push(btn('show', '흐린 영정 조각을 보인다', story.shown ? '이미 보였다' : '평온 +30 (한 판에 한 번)', undefined, !!story.shown))
  } else if (story.p === 'forms') {
    meter = <p>모습 · {FORM_NAME[story.form]}{story.freeze ? ` · 쪽지로 힘이 꺼짐(${story.freeze}라운드)` : ''}</p>
    acts.push(btn('read', '쪽지를 읽어 준다', story.read ? '이미 읽어 주었다' : '기도 쪽지 묶음 · 한 번 · 한 턴 멈추고 세 라운드 동안 모습의 힘이 꺼진다', undefined, !!story.read || !story.has?.['st-prayers']))
  } else if (story.p === 'oracle') {
    const next = errorBossSkillAt(round)
    meter = <p>시각 {story.jump ? '23:17 · 공격력 ×2' : '23:05'} · {next ? <b style={{ color: '#ff9a7a' }}>이번 상대 행동: 영능력 「{next.name}」</b> : `다음 「절대신탁」까지 ${3 - (round % 3)}라운드`}</p>
  } else if (story.p === 'smear') {
    const named = story.named || []
    meter = <div><p>불린 이름 {'●'.repeat(named.length)}{'○'.repeat(Math.max(0, 5 - named.length))} · 번진 먹이 받는 피해 ×{smearMul(story).toFixed(2)}</p>
      {story.aim ? <p style={{ color: '#ff9a7a' }}>✦ 번진 먹이 「{kidOf(story.aim)[1]}」에게 손을 뻗고 있다 — 이번 라운드에 이름을 불러 주자.</p> : <p style={{ color: '#b9b1a1' }}>지킨 새끼: {named.length ? named.map((x) => kidOf(x)[1]).join(' · ') : '아직 없다'}</p>}</div>
    if (story.aim) acts.push(btn('call', `"${kidOf(story.aim)[2]}!" 이름을 부른다`, '그 새끼를 지킨다 · 턴을 쓴다'))
  } else if (story.p === 'roots') {
    meter = <p>뿌리 {'♣'.repeat(story.roots)}{'·'.repeat(3 - story.roots)} {story.roots ? `· 받는 피해 −${story.roots * 20}% · 라운드마다 회복` : '· 뿌리째 드러남(받는 피해 +30%)'}</p>
    acts.push(btn('cut', '금줄을 끊는다', `의지력 ${cutCost(me)} · 뿌리 하나 · 턴을 쓴다`, undefined, !story.roots))
  }
  return <div className="mb-3 rounded-xl p-3 text-xs" style={{ background: '#101a24', border: '1px solid #8a7146', color: '#ece3cf' }} aria-label="이야기 전투">
    <p className="mb-1 font-serif text-sm" style={{ color: '#ffd889' }}>{acts.length ? '이야기 행동' : '이야기 상황'} {acts.length > 0 && !myTurn && <small style={{ color: '#b9b1a1', fontSize: 11 }}>· 내 차례에 쓸 수 있다</small>}</p>{meter}
    {acts.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-3">{acts}</div>}
  </div>
}

/* ───────── 본체 ───────── */
export default function StoryParty({ fight, me, player, stats, seen, specials, psychics, inventory, onSpendItem, onSpecialSeen, onScan, onFinish, onLog, onSaveSlot, reviveOn = false, boostOn = false, bsOptions, onCureAil }) {
  const [bsPick, setBsPick] = useState(null) // vD.02.1 응급 처치 상자 고르기
  const enemy = fight.enemy
  const rules = STORY_FOES[fight.key]?.rules ?? enemy.story?.rules ?? []
  const [mode, setMode] = useState('choose') // choose | lobby | battle | guest | done
  const [view, setView] = useState(null)
  const [msg, setMsg] = useState('')
  const [parties, setParties] = useState([])
  const [party, setParty] = useState(null) // { id, host, members, status }
  // vC.06 둘 이상 모이면 이 파티에도 일행 대화(도깨비들의 터)를 붙인다 — party.js 가 받는다
  const partyRoomKey = fight.mode !== 'room' && party?.id && (party.members?.length || 0) >= 2 ? `${party.id}:${party.members.length}` : '' // 일행 전투는 이미 일행 대화가 있다
  useEffect(() => { if (partyRoomKey) window.dispatchEvent(new CustomEvent('biryeong:party-room', { detail: { party: Number(partyRoomKey.split(':')[0]) } })) }, [partyRoomKey])
  const [itemsOpen, setItemsOpen] = useState(false)
  const mbRef = useRef(null), partyRef = useRef(null), doneRef = useRef(0), turnAt = useRef({ id: null, at: 0 }), finished = useRef(false), lastSeq = useRef({ seq: -1, at: Date.now() })
  const size = fight.size ?? 3, helper = fight.helper ?? null, npcUsed = !!fight.npcUsed, roomFight = fight.mode === 'room' // vC.07.3 일행 전투(추가전투 · 실습)
  const meMember = { ...memberOf({ id: me.id, name: me.name, stats, player, revive: reviveOn, boost: boostOn }), ...(helper ? { helper: true } : {}) }
  // vC.07.6 보스 전투: 보관고 보스 · 본편 보스(패턴이 있는 상대). 출발한 뒤 저마다 아이템 3개 · 영능력 2개를 고른다.
  const bossFight = !!enemy.boss || (!roomFight && !!STORY_FOES[fight.key]?.pattern)
  const pickRef = useRef(null) // 방장: { members, pid, need: { 아이디: 'boss'|'passive' }, picks, deadline }
  const [myPicked, setMyPicked] = useState(false)
  const [passiveOff, setPassiveOff] = useState([])
  const pendingItem = useRef(null) // 일행: 방장에게 보낸 아이템 { k, id, at } — 방장이 받아 주면(acks) 그때 소지품에서 뺀다
  const logSeen = useRef(null)
  // vD.01 사람이 둘 이상인 파티 전투가 열리면 일행 대화를 옆에 띄운다(전투와 같이 보이게 · 끌어서 옮길 수 있다)
  const chatOpened = useRef(false)
  useEffect(() => {
    if (chatOpened.current || !partyRef.current || !view || view.picking || !(mode === 'battle' || mode === 'guest')) return
    if ((view.members || []).filter((m) => !isNpc(m.id)).length < 2) return
    chatOpened.current = true
    window.dispatchEvent(new CustomEvent('biryeong:battle-chat'))
  }, [mode, view]) // eslint-disable-line react-hooks/exhaustive-deps
  // 돕는 선배로 왔다면 곧바로 그 파티에 들어간다
  useEffect(() => { if (helper?.partyId && mode === 'choose') joinParty(helper.partyId); else if (roomFight && mode === 'choose') { if (fight.join) joinParty(fight.join); else createParty() } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const isHost = mode === 'battle'

  // 로비 목록
  const refreshList = async () => { if (!live() || !fight.stage) return; try { setParties((await call('bry_party_list', { p_stage: fight.stage })).parties) } catch (e) { setMsg(e.message) } }
  useEffect(() => { if (mode !== 'choose') return undefined; refreshList(); const t = setInterval(() => { if (!document.hidden && !globalThis.BiryeongAuth?.idle?.()) refreshList() }, 8000); return () => clearInterval(t) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 방장(또는 혼자 + NPC): 판 돌리기 ── */
  const publish = async () => {
    const mb = mbRef.current; if (!mb) return
    const v = viewOf(mb, { enemy: mb.enemy, story: mb.story, acks: mb.acks || {} })
    setView(v)
    if (partyRef.current) { try { await call('bry_party_push', { p_id: partyRef.current, p_view: v, p_done: doneRef.current, p_status: mb.over ? 'over' : 'battle' }) } catch (e) { setMsg(e.message) } }
  }
  const finish = (v) => {
    finished.current = true
    const mine = v.members.find((m) => m.id === me.id)
    const r = mine?.result
    onFinish({ win: r === 'win', fled: r === 'fled', enemy: { ...enemy, name: v.enemy?.name ?? enemy.name, calmed: !!v.enemy?.calmed }, hp: mine?.php ?? player.hp, mp: mine?.mp ?? player.mp, spiritStolen: mine?.spiritStolen || 0, party: true, withNpc: (v.members || []).some((m) => isNpc(m.id)), helper: !!helper,
      mb: { reviveUsed: !!mine?.reviveUsed, headbandUsed: !!mine?.headbandUsed, curseUntil: mine?.curseUntil || 0 } })
  }
  // NPC 차례 · 버티기 자동 처리 · 시간 초과
  useEffect(() => {
    if (mode !== 'battle') return undefined
    const t = setInterval(() => {
      const mb = mbRef.current; if (!mb || mb.over) return
      if (mb.phase === 'survive') {
        let changed = false
        for (const m of mb.members) if (m.pendingDeath && (isNpc(m.id) || (m.id !== me.id && Date.now() - turnAt.current.at > 20000))) { survive(mb, m.id, true); changed = true }
        if (changed) publish()
        return
      }
      if (mb.phase !== 'input' || !mb.turn) return
      if (turnAt.current.id !== `${mb.round}:${mb.turn}`) turnAt.current = { id: `${mb.round}:${mb.turn}`, at: Date.now() }
      const m = mb.members.find((x) => x.id === mb.turn)
      if (!m) return
      if (isNpc(m.id) || m.fire > 0 || m.stun > 0) { if (Date.now() - turnAt.current.at > 800) { if (isNpc(m.id) && !(m.fire > 0) && !(m.stun > 0)) npcTurn(mb, m); else resolveWithStory(mb, m.id, true); publish() } return }
      if (m.act?.forced) { resolveWithStory(mb, m.id, true); publish(); return } // 돌발 행동
      if (m.id !== me.id && Date.now() - turnAt.current.at > MB_INPUT_MS) { autoFill(mb); noteMB(mb, `[${m.name}] 시간이 지나 자동으로 막았다.`); resolveWithStory(mb, m.id, false); publish() }
    }, 300)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  // 방장: 일행이 보낸 행동 읽기
  useEffect(() => {
    if (mode !== 'battle' || !partyRef.current) return undefined
    let last = 0, busy = false
    const t = setInterval(async () => {
      const mb = mbRef.current; if (!mb || mb.over || busy) return
      // vD.01 서버 부하: 다른 사람(사람)의 차례 · 버티기를 기다릴 때만 1.5초마다, 아니면 6초마다(턴을 쓰지 않는 아이템 · 이탈만 받는다)
      const remote = (id) => id && id !== me.id && !isNpc(id)
      const waiting = mb.phase === 'survive' ? mb.members.some((m) => m.pendingDeath && remote(m.id)) : mb.phase === 'input' && remote(mb.turn)
      if (Date.now() - last < (waiting ? 1400 : 6000)) return
      last = Date.now(); busy = true
      let g; try { g = await call('bry_party_get', { p_id: partyRef.current, p_seq: -1 }) } catch { busy = false; return } finally { busy = false } // 방장은 판을 스스로 갖고 있다 — view 는 받지 않는다
      let changed = false
      for (const x of g.acts || []) {
        if (x.n <= doneRef.current) continue
        doneRef.current = x.n
        const a = x.a || {}, m = mb.members.find((y) => y.id === x.u)
        if (!m) continue
        if (a.flee) { dropMember(mb, m.id); changed = true; continue }
        if (a.survive != null) { if (m.pendingDeath) { survive(mb, m.id, !!a.survive); changed = true } continue }
        if (a.item) { // vC.07.6 건네기: target 이 일행이면 그 사람에게. 결과는 acks 로 알려 준다(받아 줬을 때만 그 사람의 소지품에서 빠진다)
          const it0 = itemOf(a.item), to = mb.members.some((y) => y.id === a.target) ? a.target : m.id
          const bsIn = a.bs ? [].concat(a.bs).map(String).filter((x) => /^[A-Za-z]{1,20}$/.test(x)).slice(0, Math.max(1, Number(it0?.effect?.cureOneBs) || 1)) : []
          const it = it0 && (bsIn.length || a.ailLabel) ? { ...it0, effect: { ...it0.effect, ...(bsIn.length ? { cureBs: bsIn, cureBsLabel: String(a.bsLabel || bsIn.join(' · ')).slice(0, 80) } : {}), ...(a.ailLabel ? { cureAilLabel: String(a.ailLabel).slice(0, 80) } : {}) } } : it0 // vD.02.1 응급 처치 상자
          const r = it ? useItemMB(mb, m.id, it, to) : { error: 'not-battle-item' }
          mb.acks = { ...(mb.acks || {}), [m.id]: { k: a.k ?? null, ok: !r.error, err: r.error ?? null } }
          if (!r.error && m.act?.action === 'item') resolveWithStory(mb, m.id, false)
          changed = true; continue
        }
        if (a.story) { storyAct(mb, m.id, a.story, a.arg); changed = true; continue }
        if (a.action) {
          if (m.act?.forced) m.act = null
          const r = submit(mb, m.id, a)
          if (!r.error && !r.reveal) resolveWithStory(mb, m.id, ['attack', 'charm', 'psychic'].includes(a.action))
          changed = true
        }
      }
      if (changed || (g.acts || []).length) publish()
    }, 500)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const startLocal = (members, pid = null) => {
    partyRef.current = pid
    mbRef.current = newMB(enemy, members, size, bossFight)
    setMode('battle')
    const v = viewOf(mbRef.current, { enemy: mbRef.current.enemy, story: mbRef.current.story, acks: {} })
    setView(v)
    return v
  }
  /* ── vC.07.6 출발한 뒤 고르기: 보스 → 아이템 3개 · 영능력 2개 / 그 밖 → 영력결계를 가진 사람만 켤지 끌지 ── */
  const pickingView = () => {
    const P = pickRef.current
    return { picking: { boss: bossFight, deadline: P.deadline, need: P.need, done: Object.keys(P.picks), names: Object.fromEntries(P.members.map((m) => [m.id, m.name])) }, enemy: { id: enemy.id, name: enemy.name }, members: [] }
  }
  const beginPick = (members, pid = null) => {
    const need = {}
    for (const m of members) if (!isNpc(m.id)) { const k = bossFight ? 'boss' : ownedPassives(m.psychics || []).length ? 'passive' : null; if (k) need[m.id] = k }
    if (!Object.keys(need).length) return startLocal(members, pid)
    partyRef.current = pid
    pickRef.current = { members, pid, need, picks: {}, deadline: pid ? Date.now() + (bossFight ? 120000 : 60000) : 0 }
    setMyPicked(false)
    setMode('pick')
    const v = pickingView(); setView(v)
    return v
  }
  const finishPick = () => {
    const P = pickRef.current; if (!P) return
    pickRef.current = null
    const members = P.members.map((m) => {
      if (isNpc(m.id)) return bossFight ? { ...m, bring: {}, psychicBring: [] } : m
      return { ...m, ...cleanPick(P.picks[m.id], m, bossFight) } // 시간 안에 못 고른 사람은 아무것도 가져가지 않는다(보스) · 영력결계는 그대로 켠다
    })
    startLocal(members, P.pid)
    publish()
  }
  const recordPick = (uid, raw) => {
    const P = pickRef.current; if (!P || !P.need[uid] || P.picks[uid]) return
    P.picks[uid] = raw && typeof raw === 'object' ? raw : {}
    if (Object.keys(P.need).every((u) => P.picks[u])) { finishPick(); return }
    const v = pickingView(); setView(v)
    if (P.pid) call('bry_party_push', { p_id: P.pid, p_view: v, p_done: doneRef.current, p_status: 'battle' }).catch(() => {})
  }
  // 방장: 고르는 동안 일행이 보낸 것 받기 · 시간이 다 되면 고른 사람만으로 출발
  useEffect(() => {
    if (mode !== 'pick') return undefined
    const t = setInterval(async () => {
      const P = pickRef.current; if (!P) return
      if (P.deadline && Date.now() > P.deadline) { finishPick(); return }
      if (!P.pid) return
      if (Date.now() - (P.lastPoll || 0) < 2000) return
      P.lastPoll = Date.now()
      let g; try { g = await call('bry_party_get', { p_id: P.pid, p_seq: -1 }) } catch { return }
      for (const x of g.acts || []) {
        if (x.n <= doneRef.current) continue
        doneRef.current = x.n
        const a = x.a || {}
        if (a.flee) { P.members = P.members.filter((mm) => mm.id !== x.u); delete P.need[x.u]; delete P.picks[x.u] }
        else if (a.pick) recordPick(x.u, a.pick)
      }
      if (pickRef.current && Object.keys(P.need).every((u) => P.picks[u])) finishPick()
    }, 1200)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  // 내 행동(방장 · 혼자)
  const hostAct = async (act) => {
    const mb = mbRef.current
    if (!mb || mb.turn !== me.id) return { error: 'not-your-turn' }
    const m = mb.members.find((x) => x.id === me.id)
    if (m?.act?.forced) m.act = null
    const r = submit(mb, me.id, act)
    if (r.error) return r
    if (!r.reveal) resolveWithStory(mb, me.id, ['attack', 'charm', 'psychic'].includes(act.action))
    publish()
    return { ok: true }
  }
  const hostSurvive = (accept) => { const mb = mbRef.current; if (!mb) return; survive(mb, me.id, accept); publish() }
  const hostStory = (act, arg) => { const mb = mbRef.current; if (!mb) return; const r = storyAct(mb, me.id, act, arg); if (r.error) setMsg(r.error); publish() }
  const hostItem = (id, target, pick = null) => {
    const mb = mbRef.current, it0 = itemOf(id); if (!mb || !it0) return
    const picks = pick ? [].concat(pick) : [], pb = picks.filter((o) => !o.ail), pa = picks.filter((o) => o.ail) // vD.02.3 둘까지
    const it = picks.length ? { ...it0, effect: { ...it0.effect, ...(pb.length ? { cureBs: pb.map((o) => o.key), cureBsLabel: pb.map((o) => o.label.replace(/[[\]]/g, '')).join(' · ') } : {}), ...(pa.length ? { cureAilLabel: pa.map((o) => o.label).join(' · ') } : {}) } } : it0
    const to = target && target !== 'self' && mb.members.some((x) => x.id === target) ? target : me.id
    const r = useItemMB(mb, me.id, it, to)
    if (r.error) { setMsg(itemErr(r.error)); setItemsOpen(false); return }
    onSpendItem(id); setItemsOpen(false)
    if (pa.length) onCureAil?.(pa.map((o) => o.key)) // vD.02.1 몸의 이상은 내 기록에서 푼다
    if (to !== me.id) onLog?.([`${it.name}을(를) ${mb.members.find((x) => x.id === to)?.name ?? '일행'}에게 건넸다.`])
    if (mb.members.find((x) => x.id === me.id)?.act?.action === 'item') resolveWithStory(mb, me.id, false)
    publish()
  }
  const hostFlee = () => { const mb = mbRef.current; if (!mb) return; dropMember(mb, me.id); if (!mb.over) { mb.over = 'lose'; mb.phase = 'over'; mb.turn = null } publish() }

  const partySig = useRef('') // vD.02 마지막으로 그린 파티 정보(바뀐 것이 없으면 setParty 하지 않는다)
  const viewSeq = useRef(null) // 마지막으로 받은 판 번호(같으면 서버가 화면을 다시 보내지 않는다)
  const viewRef = useRef(null); viewRef.current = view
  const poke = useRef(false) // 일행: 방금 행동을 보냈다 — 다음 판을 곧바로 받아 본다
  /* ── 일행(guest): 판 받아 보기 ── */
  useEffect(() => {
    if (mode !== 'guest' && mode !== 'lobby') return undefined
    let last = 0, busy = false
    const t = setInterval(async () => {
      if (!partyRef.current || busy) return
      // vD.01 서버 부하: 대기실 2.5초 · 내 차례(내가 고를 때까지 판이 그대로)는 4초 · 남의 차례는 1.5초 · 방금 행동했으면 곧바로
      const v = viewRef.current, mineNow = v && !v.picking && !v.over && v.phase === 'input' && v.turn === me.id
      const gap = mode === 'lobby' ? 2500 : poke.current ? 600 : mineNow ? 4000 : document.hidden ? 5000 : 1500
      if (Date.now() - last < gap) return
      last = Date.now(); busy = true; poke.current = false
      let g; try { g = await call('bry_party_get', { p_id: partyRef.current, p_seq: viewSeq.current }) } catch (e) { busy = false; setMsg('파티가 사라졌다.'); setMode('choose'); partyRef.current = null; return } finally { busy = false }
      { const sig = `${g.seq}|${g.status}|${(g.members || []).map((m) => m.u ?? m.id ?? m.name).join(',')}|${g.is_host ? 1 : 0}`; if (sig !== partySig.current) { partySig.current = sig; setParty(g) } } // vD.02 그대로면 다시 그리지 않는다
      if (g.seq !== lastSeq.current.seq) lastSeq.current = { seq: g.seq, at: Date.now() }
      if (mode === 'lobby' && g.status === 'closed') { setMsg('방장이 파티를 해산했다.'); partyRef.current = null; setParty(null); setMode('choose'); return }
      if (mode === 'lobby' && g.status === 'battle' && !g.is_host) setMode('guest')
      if (g.view) { setView(g.view); viewSeq.current = g.seq } // 판이 그대로면 서버가 view 를 보내지 않는다
    }, 300)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const guestAct = async (act) => { try { await call('bry_party_act', { p_id: partyRef.current, p_act: act }); poke.current = true; return { ok: true } } catch (e) { return { error: e.message } } }
  const guestItem = async (id, target, pick = null) => {
    const it = itemOf(id); if (!it) return
    const v = viewRef.current
    if (!itemTurnFree(it) && !(v && v.phase === 'input' && v.turn === me.id)) { setMsg('턴을 쓰는 아이템은 내 차례에만 쓸 수 있다.'); return } // vD.01 남의 차례에 보내면 판이 받지 않는다
    if (pendingItem.current) { setMsg('앞서 쓴 아이템을 방장의 판이 받는 중이다.'); return }
    const k = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const to = target && target !== 'self' ? target : me.id
    const picks = pick ? [].concat(pick) : [], pb = picks.filter((o) => !o.ail), pa = picks.filter((o) => o.ail)
    pendingItem.current = { k, id, to, at: Date.now(), ail: pa.length ? pa.map((o) => o.key) : null }
    setItemsOpen(false)
    const r = await guestAct({ item: id, target: to, k, ...(pb.length ? { bs: pb.map((o) => o.key), bsLabel: pb.map((o) => o.label.replace(/[[\]]/g, '')).join(' · ') } : {}), ...(pa.length ? { ailLabel: pa.map((o) => o.label).join(' · ') } : {}) })
    if (r.error) { pendingItem.current = null; setMsg(r.error) }
  }
  // 일행: 방장이 아이템을 받아 줬는지(acks) 보고 소지품에서 뺀다 · 전투 기록은 활동 기록에도 흘려 보낸다
  useEffect(() => {
    if (!view || view.picking) return
    const p = pendingItem.current, ack = view.acks?.[me.id]
    if (p && ack?.k === p.k) {
      pendingItem.current = null
      if (ack.ok) { onSpendItem(p.id); if (p.ail) onCureAil?.(p.ail); if (p.to !== me.id) onLog?.([`${itemOf(p.id)?.name ?? p.id}을(를) ${view.members.find((x) => x.id === p.to)?.name ?? '일행'}에게 건넸다.`]) } else setMsg(itemErr(ack.err))
    } else if (p && Date.now() - p.at > 20000) { pendingItem.current = null; setMsg('방장의 판이 아이템을 받지 못했다. 다시 써 본다.') }
    const log = view.log || []
    if (logSeen.current == null) { logSeen.current = log.length ? log[log.length - 1].id : 0; return }
    const fresh = log.filter((l) => l.id > logSeen.current)
    if (fresh.length) { logSeen.current = fresh[fresh.length - 1].id; const texts = fresh.map((l) => l.text).filter(Boolean); if (texts.length) onLog?.(texts) }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 로비 ── */
  const createParty = async () => {
    try { const r = await call('bry_party_create', { p_stage: fight.stage, p_foe: fight.key, p_member: meMember }); partyRef.current = r.id; setParty({ id: r.id, host: me.id, members: [{ u: me.id, name: me.name }], status: 'open', is_host: true }); setMode('lobby') } catch (e) { setMsg(e.message) }
  }
  const joinParty = async (id) => {
    try {
      const r = await call('bry_party_join', { p_id: id, p_member: meMember }); partyRef.current = id; setParty({ ...r.party, is_host: false }); setMode('lobby') } catch (e) { setMsg(e.message); refreshList() }
  }
  const leaveParty = async () => { const id = partyRef.current; partyRef.current = null; setParty(null); if (helper || roomFight) onFinish({ win: false, fled: true, enemy, cancelled: true, helper: !!helper }); else setMode('choose'); if (id) try { await call('bry_party_leave', { p_id: id }) } catch { /* 무시 */ } }
  const startParty = async () => {
    const id = partyRef.current
    let g; try { g = await call('bry_party_get', { p_id: id, p_raw: true }) } catch (e) { setMsg(e.message); return }
    const humans = (g.raw || []).map((x) => ({ ...x.m, id: x.u, name: x.name }))
    const fill = npcUsed ? [] : npcMembers(meMember, enemy).slice(0, Math.max(0, 3 - humans.length)) // NPC를 이미 쓴 방장은 사람끼리만
    const v = beginPick([...humans, ...fill], id) // vC.07.6 출발 — 보스면 저마다 가져갈 것을 고른 뒤 판이 열린다
    try { await call('bry_party_start', { p_id: id, p_view: v }) } catch (e) { setMsg(e.message) }
  }

  // 방장이 오래 응답하지 않으면 알린다
  const hostGone = mode === 'guest' && view && !view.over && Date.now() - lastSeq.current.at > 45000

  const shell = (children) => <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6">
    <div role="dialog" aria-modal="true" aria-label="본편 이야기 전투" className="ink-panel max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-lg p-4 sm:p-6">{children}</div>
  </div>

  if (mode === 'choose' && roomFight) return shell(<section aria-label="일행 전투 준비"><p className="text-[11px] tracking-widest text-paper/50">일행 전투</p><h2 className="mt-1 font-serif text-2xl text-gold">{enemy.name}</h2><p className="mt-2 text-sm text-paper/70">{msg || (fight.join ? '일행의 전투에 들어가는 중…' : '일행을 부르는 중… (도깨비들의 터 일행에게 알림이 간다)')}</p><button type="button" className="flat-chip mt-3" onClick={() => onFinish({ win: false, fled: true, enemy, cancelled: true })}>물러난다</button></section>)
  if (mode === 'choose' && helper) return shell(<section aria-label="돕는 선배로 참가"><p className="text-sm text-paper/70">{msg || '파티에 들어가는 중…'}</p><button type="button" className="flat-chip mt-3" onClick={() => onFinish({ win: false, fled: true, enemy, cancelled: true, helper: true })}>물러난다</button></section>)
  if (mode === 'choose' && size <= 1) return shell(<section aria-label="본편 전투 준비">
    <p className="text-[11px] tracking-widest text-paper/50">본편 이야기 전투 · 1인</p>
    <h2 className="mt-1 font-serif text-2xl text-gold">{enemy.name}</h2>
    {enemy.blurb && <p className="mt-1 text-sm text-paper/70">{enemy.blurb}</p>}
    {rules.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-gold/25 p-3 text-xs text-paper/75">{rules.map((r, i) => <li key={i}>· {r}</li>)}</ul>}
    <p className="mt-3 text-xs text-paper/60">혼자 맞서는 전투다.{bossFight ? ' 보스 전투 — 맞서면 가져갈 아이템 3개 · 영능력 2개를 고른다.' : ''}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" data-story-solo className="flat-btn" onClick={() => beginPick([meMember])}>맞선다</button>
      <button type="button" className="flat-chip" onClick={() => onFinish({ win: false, fled: true, enemy, cancelled: true })}>물러난다</button>
    </div>
  </section>)
  if (mode === 'choose') return shell(<section aria-label="본편 전투 준비">
    <p className="text-[11px] tracking-widest text-paper/50">본편 이야기 전투 · 3인</p>
    <h2 className="mt-1 font-serif text-2xl text-gold">{enemy.name}</h2>
    {enemy.blurb && <p className="mt-1 text-sm text-paper/70">{enemy.blurb}</p>}
    {rules.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-gold/25 p-3 text-xs text-paper/75">{rules.map((r, i) => <li key={i}>· {r}</li>)}</ul>}
    <p className="mt-3 text-xs text-paper/60">다인 전투 — 세 사람까지 함께 싸운다. 같이 싸울 사람을 고른다. 이미 이 전투를 깬 선배가 도우러 올 수도 있다.{bossFight ? ' 보스 전투 — 출발하면 저마다 가져갈 아이템 3개 · 영능력 2개를 고른다.' : ''}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <button type="button" data-story-npc disabled={npcUsed} className="flat-btn flex-col !items-start !gap-0.5 text-left disabled:opacity-40" onClick={() => beginPick([meMember, ...npcMembers(meMember, enemy)])}>
        <span className="font-serif text-base text-gold">연호수 · 윤진서와 함께</span><span className="text-[11px] text-paper/60">{npcUsed ? '이 전투는 이미 두 사람과 함께 깼다. (계정당 1번)' : '두 사람이 곁에서 싸운다. 바로 시작한다. (이 전투에서 계정당 1번)'}</span>
      </button>
      <button type="button" data-story-party disabled={!live() || !fight.stage} className="flat-btn flex-col !items-start !gap-0.5 text-left disabled:opacity-40" onClick={createParty}>
        <span className="font-serif text-base text-gold">파티 모집하기</span><span className="text-[11px] text-paper/60">{live() ? (npcUsed ? '같은 진도의 학생 · 돕는 선배를 기다린다.' : '같은 진도의 학생 · 돕는 선배를 기다린다. 빈 자리는 NPC가 채운다.') : '서버가 연결되면 쓸 수 있다.'}</span>
      </button>
    </div>
    {live() && <div className="mt-4">
      <p className="text-xs text-paper/60">같은 진도의 학생이 모집 중인 파티 {parties.length ? `(${parties.length})` : ''}</p>
      {!parties.length ? <p className="mt-1 text-xs text-paper/45">지금은 없다.</p> : <ul className="mt-1 space-y-1.5">{parties.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-edge/25 px-3 py-2 text-sm">
        <span>{p.members.map((x) => x.name + (x.helper ? '(돕는 선배)' : '')).join(' · ')} <small className="text-paper/50">({p.members.length}/3)</small></span>
        <button type="button" data-story-join className="flat-btn !py-1 text-xs" onClick={() => joinParty(p.id)}>참가</button>
      </li>)}</ul>}
    </div>}
    {msg && <p className="mt-3 text-xs text-crimson">{msg}</p>}
    <button type="button" className="flat-chip mt-4" onClick={() => onFinish({ win: false, fled: true, enemy, cancelled: true })}>물러난다</button>
  </section>)

  if (mode === 'lobby') return shell(<section aria-label="파티 대기">
    <h2 className="font-serif text-xl text-gold">{enemy.name} — {roomFight ? '일행 전투' : '파티'} {party?.is_host ? '모집 중' : '대기 중'}</h2>{roomFight && <p className="mt-1 text-[11px] text-paper/55">도깨비들의 터 일행에게 알림이 갔다. 세 명까지 함께 싸운다. 체력은 모인 사람 수에 맞춰진다(2명 1.8배 · 3명 2.6배). 보상은 각자 평소대로(영력은 하루 3번).</p>}
    <ul className="mt-3 space-y-1.5 text-sm">{(party?.members || []).map((x) => <li key={x.u} className="rounded border border-edge/25 px-3 py-2">{x.name} <small className="text-paper/50">@{x.u}{x.u === party?.host ? ' · 방장' : ''}{x.helper ? ' · 돕는 선배(영력 · 최초 보상 없음, 냥 2배)' : ''}</small></li>)}
      {Array.from({ length: Math.max(0, 3 - (party?.members?.length || 0)) }).map((_, i) => <li key={`e${i}`} className="rounded border border-dashed border-edge/25 px-3 py-2 text-paper/45">{npcUsed ? '빈 자리' : `빈 자리 — 시작하면 ${NPCS[i]?.name ?? 'NPC'}가 채운다`}</li>)}
    </ul>
    {bossFight && <p className="mt-2 rounded border border-crimson/40 px-3 py-1.5 text-xs text-paper/80" data-boss-prep>보스 전투 — 출발하면 저마다 가져갈 아이템 <b>3개</b> · 영능력 <b>2개</b>를 고른다(2분). 고르지 않은 사람은 아무것도 가져가지 않는다(효험은 늘 쓸 수 있다).</p>}
    <p className="mt-2 text-xs text-paper/55">{party?.is_host ? '모인 만큼으로 언제든 시작할 수 있다. 싸우는 동안 이 창을 닫지 말 것(방장의 화면이 판을 돌린다).' : '방장이 시작하면 전투가 열린다.'}</p>
    {msg && <p className="mt-2 text-xs text-crimson">{msg}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {party?.is_host && <button type="button" data-story-start className="flat-btn" onClick={startParty}>지금 시작한다</button>}
      <button type="button" className="flat-chip" onClick={leaveParty}>{party?.is_host ? '파티 해산' : '나간다'}</button>
    </div>
  </section>)

  if (!view) return shell(<p className="text-sm text-paper/70">판을 여는 중…</p>)
  if (view.picking) {
    const pk = view.picking, hostPick = mode === 'pick', solo = hostPick && !partyRef.current
    const myNeed = pk.need?.[me.id], done = myPicked || (pk.done || []).includes(me.id)
    const submitPick = async (pick) => {
      setMyPicked(true)
      if (hostPick) { recordPick(me.id, pick); return }
      const r = await guestAct({ pick }); if (r.error) { setMyPicked(false); setMsg(r.error) }
    }
    const quit = () => { if (solo) { pickRef.current = null; onFinish({ win: false, fled: true, enemy, cancelled: true }) } else if (hostPick) leaveParty(); else { guestAct({ flee: true }); onFinish({ win: false, fled: true, enemy, cancelled: true }) } }
    const left = pk.deadline ? Math.max(0, Math.ceil((pk.deadline - Date.now()) / 1000)) : null
    const needers = Object.keys(pk.need || {})
    return shell(<section aria-label="전투 준비" data-mb-pick>
      <p className="text-[11px] tracking-widest text-paper/50">{pk.boss ? '보스 전투 준비' : '전투 준비'}</p>
      <h2 className="mt-1 font-serif text-2xl text-gold">{enemy.name}</h2>
      <p className="mt-2 text-sm text-paper/75">{pk.boss ? `출발했다. 저마다 가져갈 아이템 ${BRING_ITEMS}개 · 영능력 ${BRING_PSYCHICS}개를 고른다.` : '출발했다. 영력결계를 가진 사람은 이번 전투에서 켤지 고른다.'}{left != null ? ` (남은 ${left}초 — 다 고르거나 시간이 되면 판이 열린다)` : ''}</p>
      {needers.length > 1 && <ul className="mt-3 space-y-1 text-sm">{needers.map((u) => <li key={u} className="rounded border border-edge/25 px-3 py-1.5">{pk.names?.[u] ?? u} <small className={(pk.done || []).includes(u) || (u === me.id && done) ? 'text-gold' : 'text-paper/50'}>{(pk.done || []).includes(u) || (u === me.id && done) ? '· 다 골랐다' : '· 고르는 중…'}</small></li>)}</ul>}
      {myNeed && done && <p className="mt-3 text-xs text-paper/60">다 골랐다. 일행을 기다린다.</p>}
      {msg && <p className="mt-2 text-xs text-crimson">{msg}</p>}
      <button type="button" className="flat-chip mt-4" onClick={quit}>물러난다</button>
      {myNeed === 'boss' && !done && <BringPicker player={player} psychics={psychics} enemyName={enemy.name} onConfirm={(items, psy) => submitPick({ items, psychics: psy })} onCancel={() => (solo ? quit() : submitPick({}))} onSaveSlot={onSaveSlot} />}
      {myNeed === 'passive' && !done && <PassivePicker owned={ownedPassives(psychics)} off={passiveOff} onChange={setPassiveOff} onConfirm={() => submitPick({ passiveOff })} onCancel={() => (solo ? quit() : submitPick({}))} />}
    </section>)
  }
  const mine = view.members.find((m) => m.id === me.id)
  const myTurn = !view.over && view.phase === 'input' && view.turn === me.id && mine?.status === 'alive' && !mine?.acted
  const act = isHost ? hostAct : guestAct
  const onStory = isHost ? hostStory : (a, arg) => guestAct({ story: a, arg })
  const onItem0 = isHost ? hostItem : guestItem
  // vD.02.1 응급 처치 상자: 내 나쁜 상태(판의 상태 이상 · 저주 · 속박 + 몸의 이상)가 여럿이면 하나를 고른다
  const onItem = (id, target) => {
    const it = itemOf(id)
    if (!it?.effect?.cureOneBs) return onItem0(id, target)
    const opts = bsOptions ? bsOptions(player, __activeBs(mine ?? {})) : []
    if (!opts.length) { setMsg('현재는 사용할 필요가 없습니다.'); setItemsOpen(false); return }
    const max = Math.max(1, Number(it.effect.cureOneBs) || 1)
    if (opts.length <= max) return onItem0(id, me.id, opts)
    setItemsOpen(false); setBsPick({ id, options: opts, max })
  }
  // vC.07.6 전투 중 소지품: 보관고 소지품 창 그대로 — 일행에게 건네기 · 보스전은 가져온 것만
  const bagItems = view.bringLimit
    ? Object.entries(mine?.bring ?? {}).filter(([id, n]) => n > 0 && (player.inventory?.[id] || 0) > 0).map(([id, n]) => ({ id, n: Math.min(n, player.inventory[id]) }))
    : Object.entries(player.inventory || {}).filter(([id, n]) => n > 0 && itemOf(id)?.battle).map(([id, n]) => ({ id, n }))
  return shell(<>
    {partyRef.current && <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-paper/55">파티 전투 · {isHost ? '내 화면이 판을 돌린다 — 끝날 때까지 이 창을 닫지 말 것' : '방장의 화면에서 판이 돈다'}
      {globalThis.BiryeongParty && <button type="button" data-battle-chat className="flat-chip !py-0.5 text-[11px]" onClick={() => globalThis.BiryeongParty.openParty('room')}>일행 대화 열기</button>}</p>}
    {hostGone && <p className="mb-2 rounded border border-crimson/40 p-2 text-xs text-crimson">방장의 화면이 한동안 응답하지 않는다. 잠시 기다리거나 [전투 이탈]로 물러날 수 있다(진도는 그대로 남는다).</p>}
    {!view.over && <StoryPanel story={view.story} round={view.round} me={mine} myTurn={myTurn} onStory={onStory} hasPortrait={(player.inventory?.['st-portrait'] || 0) > 0} />}
    {itemsOpen && <BattleBag items={bagItems} mates={view.members.filter((m) => m.id !== me.id && m.status === 'alive')} pending={!!pendingItem.current}
      ctx={{ myTurn: !view.over && view.phase === 'input' && view.turn === me.id, isParty: view.members.length > 1, reviveOn: !!mine?.revive, boostOn: !!mine?.boost, usedItems: mine?.energyUsed ? ['energy'] : [], downed: !!mine?.pendingDeath || mine?.status === 'down', bringLimit: !!view.bringLimit }}
      onUse={(id, target) => onItem(id, target)} onClose={() => setItemsOpen(false)} />}
    {bsPick && <BsPicker options={bsPick.options} max={bsPick.max || 1} title={itemOf(bsPick.id)?.name} onClose={() => setBsPick(null)} onPick={(k) => { const keys = [].concat(k); const os = bsPick.options.filter((x) => keys.includes(x.key)); const id = bsPick.id; setBsPick(null); if (os.length) onItem0(id, me.id, os) }} />}
    {msg && <p className="mb-2 text-xs text-crimson">{msg}</p>}
    <MultiBattle meId={me.id} view={view} stats={stats} seen={seen} specials={specials} psychics={psychics}
      onAct={async (a) => { setMsg(''); const r = await act(a); if (r?.error) setMsg(typeof r.error === 'string' && r.error.length > 12 ? r.error : '지금은 할 수 없다.'); return r }}
      onScan={onScan} onSpecialSeen={onSpecialSeen}
      onSurvive={(accept) => (isHost ? hostSurvive(accept) : guestAct({ survive: accept }))}
      onOpenItems={() => setItemsOpen((v) => !v)}
      onFlee={() => (isHost ? hostFlee() : (guestAct({ flee: true }), onFinish({ win: false, fled: true, enemy })))}
      onClose={() => { if (!finished.current) finish(view) }} />
  </>)
}
