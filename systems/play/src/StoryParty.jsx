// 비령 v1.9.5 — 본편 이야기 전투를 3인 전투로.
// vC.06 — 1인 전투도 있다(STORY_FOES.size, 기본: 패턴이 있는 상대 = 다인 · 없는 상대 = 1인).
//   다인 전투: ① NPC(연호수 · 윤진서)와 함께 — 전투마다 계정당 1번(이기면 다 쓴 것)  ② 같은 진도의 학생과 파티
//              ③ 이미 깬 학생이 「돕는 선배」로 다른 학생의 파티에 다시 들어갈 수 있다 — 영력 · 최초 보상은 없고 냥은 2배.
//                 처음 싸우는 학생(방장)이 있는 파티에만 들어갈 수 있다(돕는 사람은 파티를 열 수 없다).
//
// 고르는 법: ① 연호수 · 윤진서(NPC)와 함께  ② 같은 진도(같은 장면의 같은 전투)의 학생과 파티(서버가 연결됐을 때)
// 전투 엔진은 보관고의 다인 전투(mbattle.js)를 이 브라우저에서 그대로 돌린다. 파티라면 방장의 브라우저가 판을 돌리고,
// 서버(Supabase bry_party_*)에는 판의 모습(view)과 일행이 보낸 행동만 오간다. 일행은 그 모습을 받아 같은 전투 화면(MultiBattle)으로 본다.
// 본편 패턴(이름 부르기 · 진정 · 뿌리)은 판(mb.story)에 얹어, 행동이 끝날 때마다 여기서 적용한다.
import { useEffect, useRef, useState } from 'react'
import { createMB, openingInitiative, beginRound, resolveTurn, submit, survive, autoFill, viewOf, noteMB, dropMember, useItemMB, MB_INPUT_MS } from '@vault/game/mbattle.js'
import MultiBattle from '@vault/ui/components/locations/MultiBattle.jsx'
import { itemOf, ITEMS } from '@vault/game/items.js'
import { STORY_FOES } from './storyBoss.js'

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
export function memberOf({ id, name, stats, player }) {
  return {
    id, name,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(1, Math.round(stats?.[k] ?? 1))])),
    fx: stats?.fx ?? null, trinket: stats?.trinket ?? null, special: stats?.special ?? null,
    hp: player.hp, hpMax: player.hpMax, mp: player.mp, mpMax: player.mpMax,
    psychics: player.psychics ?? [], baseAggression: player.stats?.aggression, curseUntil: player.curseUntil || 0,
  }
}
/** NPC 둘: 내 육조 스탯 합만큼을 저마다의 성향대로 나눠 가진다. */
function npcMembers(me) {
  const total = STAT_KEYS.reduce((s, k) => s + (me.stats[k] || 1), 0)
  return NPCS.map((n) => ({
    id: n.id, name: n.name, fx: n.fx, npc: true,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(1, Math.round(total * n.w[k]))])),
    hp: me.hpMax, hpMax: me.hpMax, mp: me.mpMax, mpMax: me.mpMax, psychics: [],
  }))
}
const isNpc = (id) => String(id).startsWith('npc-')
const shuffle = (arr, seed) => { const a = [...arr]; let x = seed * 9301 + 49297; for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor((x / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const nameOptions = (st, round) => { const wi = (round + st.hits) % 3; return shuffle([NAME_RIGHT, NAME_WRONG[wi], NAME_WRONG[(wi + 1) % 3]], round + st.hits) }
const pct = (mb, p) => Math.max(1, Math.ceil(mb.enemy.hp * p))
const cutCost = (m) => (['fan', 'staff'].includes(m?.fx) ? 4 : 8)

/** 3인 상대 만들기 */
// vC.07.3 체력은 실제로 함께 싸우는 사람 수(NPC 포함)에 맞춘다: 1명 1배 · 2명 1.8배 · 3명 2.6배
const hpMul = (n) => (n <= 1 ? 1 : n === 2 ? 1.8 : PARTY_HP)
function partyEnemy(enemy, size = 3, n = 3) {
  // 「다인 전투」 상대(partySize 2 · 3)는 이미 그 인원 기준의 체력이라, 모인 사람 수와의 비율만큼만 고친다(적게 모이면 조금 줄고, 많이 모이면 조금 는다)
  const base = Math.max(1, Math.min(3, enemy.partySize ?? 1))
  return size > 1 ? { ...enemy, hp: Math.round(enemy.hp * hpMul(n) / hpMul(base)), boss: false, partySize: Math.max(1, Math.min(3, n)) } : { ...enemy, boss: false, partySize: 1 }
}
function newMB(enemy, members, size = 3) {
  const mb = createMB(partyEnemy(enemy, size, members.length), members)
  const p = enemy.story?.pattern
  mb.story = { p, key: enemy.story?.key, hits: 0, broken: false, calm: 0, asked: 0, roots: 3, baseAtk: mb.enemy.atk, has: enemy.story?.has || {} }
  openingInitiative(mb)
  if (!mb.turn && mb.phase === 'input') beginRound(mb)
  return mb
}
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
    if (mult !== 1) {
      const want = Math.round(dealt * mult)
      mb.ehp = Math.max(0, Math.min(mb.enemy.hp, before - want))
      noteMB(mb, `${why} — 준 피해 ${dealt} → ${want}.`)
      if (mb.ehp <= 0) win(mb)
    }
  }
  if (st?.p === 'calm' && offensive && dealt > 0) { st.calm = Math.max(0, st.calm - 20); noteMB(mb, `그 사람이 더 크게 운다. 평온 −20 (지금 ${st.calm})`) }
  if (st?.p === 'calm') mb.enemy.atk = st.calm >= 50 ? Math.max(1, Math.round(st.baseAtk / 2)) : st.baseAtk
  if (st?.p === 'names' && st.broken) mb.queue = mb.queue.map((q) => (q === 'guard' ? 'jab' : q))
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
  } else if (st.p === 'calm' && (act === 'ask' || act === 'sit')) {
    if (act === 'ask') { st.asked += 1; const g = st.asked <= 2 ? 35 : 10; st.calm = Math.min(100, st.calm + g); noteMB(mb, `[${m.name}] "이름이 뭐예요?" — 그 사람이 입술을 움직인다. 평온 +${g} (지금 ${st.calm})`) }
    else { st.calm = Math.min(100, st.calm + 15); noteMB(mb, `[${m.name}] 곁에 앉는다. 막는 자세로 기다린다. 평온 +15 (지금 ${st.calm})`) }
    if (st.calm >= 100) { noteMB(mb, `${mb.enemy.name}이(가) 자기 이름을 말하고 주저앉는다. 진정시켰다 — 이야기 승리.`); win(mb, true); return { ok: true } }
    if (act === 'sit') { const r = submit(mb, id, { action: m.bound ? 'attack' : 'guard' }); if (r.error) m.act = { action: 'item' }; resolveWithStory(mb, id, false); return { ok: true } }
  } else if (st.p === 'roots' && act === 'cut') {
    const c = cutCost(m)
    if (st.roots <= 0) return { error: '끊을 뿌리가 남아 있지 않다.' }
    if (m.mp < c) return { error: `의지력이 모자라다. (필요 ${c})` }
    m.mp -= c; st.roots -= 1
    noteMB(mb, `[${m.name}] 금줄 하나를 끊었다. 뿌리 하나가 흙 속에서 말라 간다. (남은 뿌리 ${st.roots})`)
    if (!st.roots) noteMB(mb, '✦ 당산신이 뿌리째 드러났다! 받는 피해 +30%.')
  } else return { error: '쓸 수 없는 행동이다.' }
  m.act = { action: 'item' } // 턴만 넘긴다
  resolveWithStory(mb, id, false)
  return { ok: true }
}

/** NPC 의 차례: 패턴에 맞는 이야기 행동을 먼저, 아니면 상대의 다음 수를 보고 고른다. */
function npcTurn(mb, m) {
  const st = mb.story, intent = mb.queue[0]
  if (m.act?.forced) { resolveWithStory(mb, m.id, true); return }
  if (st?.p === 'calm') { const r = storyAct(mb, m.id, m.id === 'npc-jinseo' && st.asked < 2 ? 'ask' : 'sit'); if (r.ok) return }
  if (st?.p === 'roots' && m.id === 'npc-jinseo' && st.roots > 0 && m.mp >= cutCost(m)) { if (storyAct(mb, m.id, 'cut').ok) return }
  // 이름 부르기는 플레이어만 한다(NPC 가 부르면 정답이 드러난다)
  let action = 'attack'
  if (['smash', 'special', 'group'].includes(intent) && !m.bound) action = 'guard'
  else if (intent === 'guard' && m.charms > 0) action = 'charm'
  const r = submit(mb, m.id, { action })
  if (r.error) submit(mb, m.id, { action: 'attack' })
  resolveWithStory(mb, m.id, action !== 'guard')
}

/* ───────── 이야기 행동 단추 ───────── */
function StoryPanel({ story, round, me, myTurn, onStory }) {
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
    meter = <div><p>평온 {story.calm} / 100 {story.calm >= 50 ? '· 그 사람의 공격이 절반' : ''}</p><div className="mt-1 h-1.5 w-full rounded bg-edge/15"><div className="h-1.5 rounded bg-gold" style={{ width: `${story.calm}%` }} /></div></div>
    acts.push(btn('ask', '이름을 묻는다', story.asked < 2 ? '평온 +35' : '평온 +10'))
    acts.push(btn('sit', '곁에 앉는다', '평온 +15 · 막기'))
  } else if (story.p === 'roots') {
    meter = <p>뿌리 {'♣'.repeat(story.roots)}{'·'.repeat(3 - story.roots)} {story.roots ? `· 받는 피해 −${story.roots * 20}% · 라운드마다 회복` : '· 뿌리째 드러남(받는 피해 +30%)'}</p>
    acts.push(btn('cut', '금줄을 끊는다', `의지력 ${cutCost(me)} · 뿌리 하나 · 턴을 쓴다`, undefined, !story.roots))
  }
  return <div className="mb-3 rounded-xl p-3 text-xs" style={{ background: '#101a24', border: '1px solid #8a7146', color: '#ece3cf' }} aria-label="이야기 전투">
    <p className="mb-1 font-serif text-sm" style={{ color: '#ffd889' }}>이야기 행동 {!myTurn && <small style={{ color: '#b9b1a1', fontSize: 11 }}>· 내 차례에 쓸 수 있다</small>}</p>{meter}
    {acts.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-3">{acts}</div>}
  </div>
}

/* ───────── 전투 중 아이템 ───────── */
function ItemPicker({ inventory, onUse, onClose }) {
  const list = ITEMS.filter((it) => it.battle && (inventory?.[it.id] || 0) > 0)
  return <div className="mb-3 rounded-xl border border-edge/30 p-3 text-xs" aria-label="전투 아이템">
    <div className="mb-2 flex items-center justify-between"><b className="font-serif text-sm text-gold">아이템</b><button type="button" className="flat-chip" onClick={onClose}>닫기</button></div>
    {!list.length ? <p className="text-paper/60">전투에서 쓸 수 있는 아이템이 없다.</p> : <div className="grid gap-1.5 sm:grid-cols-2">
      {list.map((it) => <button key={it.id} type="button" className="flat-btn flex-col !items-start !gap-0 text-left" onClick={() => onUse(it.id)}><span className="text-sm">{it.name} ×{inventory[it.id]}</span><span className="text-[10.5px] text-paper/60">{it.effectText ?? it.use ?? ''}</span></button>)}
    </div>}
  </div>
}

/* ───────── 본체 ───────── */
export default function StoryParty({ fight, me, player, stats, seen, specials, psychics, inventory, onSpendItem, onSpecialSeen, onScan, onFinish }) {
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
  const meMember = { ...memberOf({ id: me.id, name: me.name, stats, player }), ...(helper ? { helper: true } : {}) }
  // 돕는 선배로 왔다면 곧바로 그 파티에 들어간다
  useEffect(() => { if (helper?.partyId && mode === 'choose') joinParty(helper.partyId); else if (roomFight && mode === 'choose') { if (fight.join) joinParty(fight.join); else createParty() } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const isHost = mode === 'battle'

  // 로비 목록
  const refreshList = async () => { if (!live() || !fight.stage) return; try { setParties((await call('bry_party_list', { p_stage: fight.stage })).parties) } catch (e) { setMsg(e.message) } }
  useEffect(() => { if (mode !== 'choose') return undefined; refreshList(); const t = setInterval(() => { if (!document.hidden) refreshList() }, 6000); return () => clearInterval(t) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 방장(또는 혼자 + NPC): 판 돌리기 ── */
  const publish = async () => {
    const mb = mbRef.current; if (!mb) return
    const v = viewOf(mb, { enemy: mb.enemy, story: mb.story })
    setView(v)
    if (partyRef.current) { try { await call('bry_party_push', { p_id: partyRef.current, p_view: v, p_done: doneRef.current, p_status: mb.over ? 'over' : 'battle' }) } catch (e) { setMsg(e.message) } }
  }
  const finish = (v) => {
    finished.current = true
    const mine = v.members.find((m) => m.id === me.id)
    const r = mine?.result
    onFinish({ win: r === 'win', fled: r === 'fled', enemy: { ...enemy, name: v.enemy?.name ?? enemy.name, calmed: !!v.enemy?.calmed }, hp: mine?.php ?? player.hp, mp: mine?.mp ?? player.mp, spiritStolen: mine?.spiritStolen || 0, party: true, withNpc: (v.members || []).some((m) => isNpc(m.id)), helper: !!helper })
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
    const t = setInterval(async () => {
      const mb = mbRef.current; if (!mb || mb.over) return
      if (document.hidden && !mbRef.current?.turn) return
      let g; try { g = await call('bry_party_get', { p_id: partyRef.current, p_seq: -1 }) } catch { return } // 방장은 판을 스스로 갖고 있다 — view 는 받지 않는다
      let changed = false
      for (const x of g.acts || []) {
        if (x.n <= doneRef.current) continue
        doneRef.current = x.n
        const a = x.a || {}, m = mb.members.find((y) => y.id === x.u)
        if (!m) continue
        if (a.flee) { dropMember(mb, m.id); changed = true; continue }
        if (a.survive != null) { if (m.pendingDeath) { survive(mb, m.id, !!a.survive); changed = true } continue }
        if (a.item) { const it = itemOf(a.item); if (it && !useItemMB(mb, m.id, it, a.target).error && m.act?.action === 'item') resolveWithStory(mb, m.id, false); changed = true; continue }
        if (a.story) { storyAct(mb, m.id, a.story, a.arg); changed = true; continue }
        if (a.action) {
          if (m.act?.forced) m.act = null
          const r = submit(mb, m.id, a)
          if (!r.error && !r.reveal) resolveWithStory(mb, m.id, ['attack', 'charm', 'psychic'].includes(a.action))
          changed = true
        }
      }
      if (changed || (g.acts || []).length) publish()
    }, 1100)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const startLocal = (members, pid = null) => {
    partyRef.current = pid
    mbRef.current = newMB(enemy, members, size)
    setMode('battle')
    const v = viewOf(mbRef.current, { enemy: mbRef.current.enemy, story: mbRef.current.story })
    setView(v)
    return v
  }
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
  const hostItem = (id) => {
    const mb = mbRef.current, it = itemOf(id); if (!mb || !it) return
    const r = useItemMB(mb, me.id, it, me.id)
    if (r.error) { setMsg(r.error === 'not-your-turn' ? '내 차례에만 쓸 수 있는 아이템이다.' : r.error === 'already' ? '이미 썼다.' : '지금은 쓸 수 없다.'); return }
    onSpendItem(id); setItemsOpen(false)
    if (mb.members.find((x) => x.id === me.id)?.act?.action === 'item') resolveWithStory(mb, me.id, false)
    publish()
  }
  const hostFlee = () => { const mb = mbRef.current; if (!mb) return; dropMember(mb, me.id); if (!mb.over) { mb.over = 'lose'; mb.phase = 'over'; mb.turn = null } publish() }

  const viewSeq = useRef(null) // 마지막으로 받은 판 번호(같으면 서버가 화면을 다시 보내지 않는다)
  /* ── 일행(guest): 판 받아 보기 ── */
  useEffect(() => {
    if (mode !== 'guest' && mode !== 'lobby') return undefined
    const t = setInterval(async () => {
      if (!partyRef.current) return
      let g; try { g = await call('bry_party_get', { p_id: partyRef.current, p_seq: viewSeq.current }) } catch (e) { setMsg('파티가 사라졌다.'); setMode('choose'); partyRef.current = null; return }
      setParty(g)
      if (g.seq !== lastSeq.current.seq) lastSeq.current = { seq: g.seq, at: Date.now() }
      if (mode === 'lobby' && g.status === 'closed') { setMsg('방장이 파티를 해산했다.'); partyRef.current = null; setParty(null); setMode('choose'); return }
      if (mode === 'lobby' && g.status === 'battle' && !g.is_host) setMode('guest')
      if (g.view) { setView(g.view); viewSeq.current = g.seq } // 판이 그대로면 서버가 view 를 보내지 않는다
    }, 1200)
    return () => clearInterval(t)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const guestAct = async (act) => { try { await call('bry_party_act', { p_id: partyRef.current, p_act: act }); return { ok: true } } catch (e) { return { error: e.message } } }

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
    let g; try { g = await call('bry_party_get', { p_id: id }) } catch (e) { setMsg(e.message); return }
    const humans = (g.raw || []).map((x) => ({ ...x.m, id: x.u, name: x.name }))
    const fill = npcUsed ? [] : npcMembers(meMember).slice(0, Math.max(0, 3 - humans.length)) // NPC를 이미 쓴 방장은 사람끼리만
    const v = startLocal([...humans, ...fill], id)
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
    <p className="mt-3 text-xs text-paper/60">혼자 맞서는 전투다.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" data-story-solo className="flat-btn" onClick={() => startLocal([meMember])}>맞선다</button>
      <button type="button" className="flat-chip" onClick={() => onFinish({ win: false, fled: true, enemy, cancelled: true })}>물러난다</button>
    </div>
  </section>)
  if (mode === 'choose') return shell(<section aria-label="본편 전투 준비">
    <p className="text-[11px] tracking-widest text-paper/50">본편 이야기 전투 · 3인</p>
    <h2 className="mt-1 font-serif text-2xl text-gold">{enemy.name}</h2>
    {enemy.blurb && <p className="mt-1 text-sm text-paper/70">{enemy.blurb}</p>}
    {rules.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-gold/25 p-3 text-xs text-paper/75">{rules.map((r, i) => <li key={i}>· {r}</li>)}</ul>}
    <p className="mt-3 text-xs text-paper/60">다인 전투 — 세 사람까지 함께 싸운다. 같이 싸울 사람을 고른다. 이미 이 전투를 깬 선배가 도우러 올 수도 있다.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <button type="button" data-story-npc disabled={npcUsed} className="flat-btn flex-col !items-start !gap-0.5 text-left disabled:opacity-40" onClick={() => startLocal([meMember, ...npcMembers(meMember)])}>
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
    <p className="mt-2 text-xs text-paper/55">{party?.is_host ? '모인 만큼으로 언제든 시작할 수 있다. 싸우는 동안 이 창을 닫지 말 것(방장의 화면이 판을 돌린다).' : '방장이 시작하면 전투가 열린다.'}</p>
    {msg && <p className="mt-2 text-xs text-crimson">{msg}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {party?.is_host && <button type="button" data-story-start className="flat-btn" onClick={startParty}>지금 시작한다</button>}
      <button type="button" className="flat-chip" onClick={leaveParty}>{party?.is_host ? '파티 해산' : '나간다'}</button>
    </div>
  </section>)

  if (!view) return shell(<p className="text-sm text-paper/70">판을 여는 중…</p>)
  const mine = view.members.find((m) => m.id === me.id)
  const myTurn = !view.over && view.phase === 'input' && view.turn === me.id && mine?.status === 'alive' && !mine?.acted
  const act = isHost ? hostAct : guestAct
  const onStory = isHost ? hostStory : (a, arg) => guestAct({ story: a, arg })
  const onItem = isHost ? hostItem : (id) => { onSpendItem(id); setItemsOpen(false); guestAct({ item: id, target: me.id }) }
  return shell(<>
    {partyRef.current && <p className="mb-2 text-[11px] text-paper/55">파티 전투 · {isHost ? '내 화면이 판을 돌린다 — 끝날 때까지 이 창을 닫지 말 것' : '방장의 화면에서 판이 돈다'}</p>}
    {hostGone && <p className="mb-2 rounded border border-crimson/40 p-2 text-xs text-crimson">방장의 화면이 한동안 응답하지 않는다. 잠시 기다리거나 [전투 이탈]로 물러날 수 있다(진도는 그대로 남는다).</p>}
    {!view.over && <StoryPanel story={view.story} round={view.round} me={mine} myTurn={myTurn} onStory={onStory} />}
    {itemsOpen && <ItemPicker inventory={inventory} onUse={onItem} onClose={() => setItemsOpen(false)} />}
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
