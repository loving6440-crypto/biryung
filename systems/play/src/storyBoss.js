// 비령 v1.3 — 본편 이야기 전투의 보스 고유 패턴.
//
// 보관고 전투 엔진(battle.js)과 전투 화면(Battle.jsx)은 고치지 않는다. 실행 화면을 묶을 때(systems/play/patches.mjs)
// Battle.jsx 의 세 군데에 이 파일의 훅을 끼운다:
//   afterPlayer(prev, r, action)          내 행동이 끝난 직후 — 받는 피해 배율 · 반사 · 눈 감기 · 평온 깎임
//   enemyTurn(state, engine, ctx)         상대 턴을 감싼다 — 쉬기(기절) · 되감기 · 안개 · 부모들의 자리 · 머리 바꾸기
//   act(state, id, arg, ctx)              전투 화면 아래 [이야기 행동] 단추(이름 부르기 · 이름 묻기 · 금줄 끊기 …)
//   <Panel> · <Intro>                     패턴 계기판 · 싸움 전 안내
// 상대 객체에 story 가 붙어 있을 때만 움직인다(enemy.story = { key, pattern, … }). 그 밖의 전투는 그대로다.
import { rollIntent, maxSurvives } from '@vault/game/battle.js'
import { itemOf } from '@vault/game/items.js'
import { STORY_RECIPES } from '../../biryeong/reskin.data.js'

const rnd = Math.random
const batchim = (w) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false }
const ya = (name) => name + (batchim(name) ? '아' : '야')
const shuffle = (arr, seed) => { const a = [...arr]; let x = seed * 9301 + 49297; for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor((x / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// ───────── 상대별 설정 ─────────
// pattern: 패턴 이름 · hp: 바탕 상대 체력 배율 · drop: [아이템, 개수] · rules: 싸움 전에 보여 주는 규칙 · say: 계기에 맞춘 한마디
export const STORY_FOES = {
  myeongbugwi: { pattern: 'names', hp: 1.25, drop: ['st-roll', 1], rules: ['[이름을 부른다] — 302호 학생의 이름을 세 번 바르게 부르면 방어가 무너진다(받는 피해 ×2, 막지 못함).', '틀린 이름을 부르면 명부귀가 그 이름을 먹고 체력을 되찾는다.', '302호의 방울을 지니고 있으면 맞는 이름 쪽에서 방울이 운다.'],
    say: { start: '이름… 부르지 않은 이름은… 주인이 없다…', broken: '그 이름은… 내 것… 아니었나…' } },
  heard: { pattern: 'calm', hp: 1.2, drop: ['st-nametag', 1], rules: ['이 사람은 쓰러뜨리지 않고 진정시킬 수 있다 — 평온이 100이 되면 이야기 승리.', '[이름을 묻는다] 평온 +35 (세 번째부터 +10) · [곁에 앉는다] 평온 +15, 막기와 같다 · [영정 조각을 보인다] 평온 +30 (한 번).', '공격하면 평온 −20. 평온이 50을 넘으면 그 사람의 공격이 절반으로 줄어든다.'],
    say: { start: '나… 죽었대. 방금 들었어. 근데 나 여기 있잖아.', calm: '…내 이름은, 그래. 그거였어.' } },
  effigy: { pattern: null, hp: 1, drop: null, rules: ['의식을 지키는 짚 인형. 별다른 수는 없다.'] },
  dangsan: { pattern: 'roots', hp: 1.3, drop: ['st-dangsan-twig', 1], rules: ['뿌리 3개가 남아 있는 동안 받는 피해가 뿌리마다 20% 줄고, 상대 턴마다 뿌리마다 체력 4%를 되찾는다.', '[금줄을 끊는다] 의지력 8(부채 · 석장 계통은 4) — 뿌리 하나를 끊는다.', '뿌리가 모두 끊기면 받는 피해 +30%.'],
    say: { start: '이 마을의 불행은 내가 가져간다. 그게 약속이었다.', bare: '…뿌리가… 내 이름이 적힌 뿌리가…' } },
  waiting: { pattern: 'forms', hp: 1.25, drop: ['st-waiting-bead', 1], rules: ['정신오염에 따라 모습이 바뀐다 — 20 미만 자비형(공격이 멈추고 스스로 낫는다) · 50 미만 복수형(준 피해의 25%를 돌려받는다) · 그 이상 공포형(공격 · 부적이 막힌다).', '[쪽지를 읽어 준다] 기도 쪽지 묶음이 있으면 한 번 — 그것이 한 턴 멈추고, 세 턴 동안 모습의 힘이 꺼진다.'],
    say: { start: '…기다렸어. 아주 오래. 누구를 기다렸는지는 잊었지만.', read: '돌아와… 돌아와… 그건 내가 쓴 글씨가 아니야.' } },
  echo: { pattern: null, hp: 1, drop: null, rules: ['예측이 남긴 찌꺼기. 별다른 수는 없다.'] },
  error: { pattern: 'rewind', hp: 1.3, drop: ['st-stopwatch', 1], rules: ['두 턴마다 23시 17분으로 되감는다 — 상대와 나의 체력이 두 턴 전으로 돌아간다.', '두 턴 안에 상대 최대 체력의 20% 이상을 깎으면 되감기가 끊기고 초침 하나가 부러진다.', '초침 셋이 모두 부러지면 더는 되감지 못하고 받는 피해 +25%.'],
    say: { start: '23시 17분. 그 시각은 지켜져야 한다.', stop: '…시각이, 지나갔다.' } },
  baekmok: { pattern: 'eyes', hp: 1.3, drop: ['st-eyelid', 1], rules: ['열 개의 눈이 나를 본다 — 뜬 눈이 많을수록 상대의 공격이 아프다(눈 10개 ×1.2 ~ 0개 ×0.4).', '앞 턴과 다른 행동을 하면 눈 하나가 감기고, 같은 행동을 하면 다시 뜬다.', '눈이 모두 감기면 백목이 한 턴 쉰다. 관측 차단 봉투를 지니면 눈 세 개가 감긴 채로 시작한다.'],
    say: { start: '관측 대상 확인. 행동 패턴 학습 개시.', blind: '관측… 불가…' } },
  guard: { pattern: null, hp: 1, drop: null, rules: ['관측동의 보안 드론. 별다른 수는 없다.'] },
  ssang: { pattern: 'heads', hp: 1.35, drop: ['st-twin-scale', 2], rules: ['두 머리가 번갈아 응답한다 — 산의 머리(받는 피해 −40%, 공격 +30%) / 바다의 머리(받는 피해 +30%, 맞으면 의지력 5를 빼앗긴다).', '[응답을 끊는다] 의지력 6 — 턴을 쓰지 않고 지금 응답하는 머리를 바꾼다(한 턴에 한 번).'],
    say: { start: '(두 목소리가 동시에) 우리를 부른 것은 너희다.' } },
  cheonseong: { pattern: 'voices', hp: 1.35, drop: ['st-voice-thread', 1], rules: ['목소리 다섯이 몸을 감싸 받는 피해가 줄어든다(목소리마다 12%).', '매 턴 한 목소리가 누군가의 이름을 부른다 — [이름을 부른다]로 그 이름을 정확히 받아 주면 그 목소리가 떨어져 나간다.', '목소리가 모두 떨어지면 받는 피해 ×1.5. 틀린 이름에는 목소리들이 웃으며 체력을 되찾는다.'],
    say: { start: '(수천 명의 목소리) 얘야, 이리 오렴.', broken: '(목소리 하나만 남아) …잘 컸구나.' } },
  wave: { pattern: null, hp: 1, drop: null, rules: ['격리 부대의 선봉. 별다른 수는 없다.'] },
  collision: { pattern: 'alternate', hp: 1.35, drop: ['st-oracle-shard', 1], rules: ['산의 신탁과 바다의 신탁이 번갈아 온다.', '산의 신탁 — 막으면 피해 없이 틈이 생기고, 막지 않으면 피해 ×1.5.', '바다의 신탁 — 이 턴에 공격하면 준 피해의 절반이 되돌아온다. 공격하지 않으면 틈이 생긴다.', '틈이 있을 때 공격하면 피해 ×1.5.'],
    say: { start: '(두 개의 목소리가 서로를 지운다) 산이 옳다. — 바다가 옳다.' } },
  eraser: { pattern: 'fog', hp: 1.25, drop: ['st-fog-jar', 1], rules: ['상대 턴마다 안개가 한 칸 찬다. 다섯 칸이 차면 막을 수 없는 피해(최대 체력의 25%).', '[이름을 부른다] 함께 있는 사람들의 이름을 하나씩 불러 안개를 두 칸 밀어낸다(같은 이름은 한 판에 한 번).'],
    say: { start: '(소리가 반 박자 늦게 들린다) …이 길에는 이름이 없다.' } },
  raid: { pattern: 'byForm', forms: { 1: ['eyes', '명소 집행기'], 2: ['heads', '분노한 신격'], 3: ['ward', '계약 해방 의식의 밤'] }, hp: 1.3, drop: ['st-godslayer', 1], rules: ['고른 진영에 따라 상대가 달라진다 — ① 명소 집행기(눈) · ② 분노한 신격(두 머리) · ③ 의식 방어(부모들의 자리 대신 의식의 자리를 지킨다).'],
    say: { start: '명소의 밤이다.' } },
  unrealized: { pattern: 'ward', hp: 1.3, drop: ['st-unborn-light', 1], rules: ['부모들의 자리를 지키며 싸운다 — 상대 턴마다 자리가 깎이고, 0이 되면 패배.', '[감싸 막는다] 막기와 같다. 이번 상대 턴엔 자리가 깎이지 않지만 내가 받는 피해 ×1.5.'],
    say: { start: '(경계에 묶인 신탁들) 이루어지게 해 줘. 이루어지게 해 줘.' } },
  final: { pattern: 'phases', phases: { 1: ['eyes', 'rewind', 'voices'], 2: ['heads', 'roots', 'alternate'], 3: ['ward', 'fog', 'voices'] }, hp: 1.6, drop: ['st-final-knot', 1], rules: ['체력 66% · 33%에서 형태를 바꾼다. 고른 진영에 따라 지금까지 만난 신탁들의 모습을 차례로 빌린다.'],
    say: { start: '(수천 개의 기도와 대답이 한꺼번에) 너희는 무엇을 약속하겠느냐.', shift: '형태가 바뀐다 —' } },
}
const PATTERN_NAME = { names: '이름 부르기', calm: '진정', roots: '뿌리', forms: '모습', rewind: '되감기', eyes: '눈', heads: '두 머리', voices: '목소리', alternate: '번갈아 오는 신탁', fog: '안개', ward: '부모들의 자리' }

/** 이 상대를 이기면 열리는 전리품 제작법 */
export const bossRecipes = (key) => STORY_RECIPES.filter((r) => r.unlock === `boss:${key}`)
export const dropOf = (key) => STORY_FOES[key]?.drop ?? null

/** 이야기 전투의 상대 만들기 — 바탕(같은 단계 혼자 상대)의 수치에 패턴 · 이름 · 소개를 얹는다. ctx: { taint, form, names: { player, god }, has: { 아이템: true } } */
export function makeStoryEnemy(base, { key, name, blurb }, ctx = {}) {
  const cfg = STORY_FOES[key] ?? { pattern: null, hp: 1 }
  let pattern = cfg.pattern, shown = name, phases = null
  if (pattern === 'byForm') { const f = cfg.forms[ctx.form] ?? cfg.forms[1]; pattern = f[0]; shown = f[1] }
  if (pattern === 'phases') { phases = cfg.phases[ctx.form] ?? cfg.phases[1]; pattern = phases[0] }
  const hp = Math.round(base.hp * (cfg.hp || 1))
  return {
    ...base, id: `story-${key}`, name: shown, blurb, hp,
    story: { key, pattern, phases, form: ctx.form || 1, taint: ctx.taint || 0, names: ctx.names || {}, has: ctx.has || {}, family: ctx.family || '', rules: cfg.rules || [], say: cfg.say || {} },
    gimmicks: pattern ? (cfg.rules || []) : undefined,
  }
}

// ───────── 상태 ─────────
const pat = (s) => s?.sb?.p ?? s?.enemy?.story?.pattern ?? null
const INIT = {
  names: () => ({ hits: 0, broken: false }),
  calm: () => ({ calm: 0, asked: 0, shown: false }),
  roots: () => ({ roots: 3 }),
  forms: (s) => { const t = s.enemy.story.taint || 0; return { form: t < 20 ? 'mercy' : t < 50 ? 'revenge' : 'fear', freeze: 0, stun: 0, read: false } },
  rewind: (s) => ({ t: 0, snapE: s.ehp, snapP: s.php, hands: 3 }),
  eyes: (s) => ({ eyes: s.enemy.story.has?.['st-envelope'] ? 7 : 10, last: null, stun: 0 }),
  heads: () => ({ head: 'san', cutRound: 0 }),
  voices: (s) => ({ voices: 5, call: voiceCall(s, 1) }),
  alternate: () => ({ phase: 'mountain', gap: false }),
  fog: () => ({ fog: 0, used: [] }),
  ward: () => ({ ward: 100, cover: false }),
}
function sbOf(s) {
  if (s.sb) return s.sb
  const p = s.enemy?.story?.pattern
  return { p, phase: 0, ...(INIT[p]?.(s) ?? {}) }
}
const withSb = (s) => ({ ...s, sb: { ...sbOf(s) } })

// 목소리 · 이름 후보
const EXTRAS = ['민서', '태오', '하린', '도윤', '서아', '지후']
function namePool(s) {
  const n = s.enemy.story.names || {}
  return [...new Set(['윤진서', '서창현', '해원', '연호수', n.player, n.god, ...EXTRAS].filter(Boolean))]
}
const VOICE_LINES = ['{n} 밥 먹어라.', '{n} 우산 챙겼니?', '{n} 엄마 여기 있어.', '{n} 늦었다, 얼른 와.', '{n} 아빠가 데리러 갈게.', '{n} 춥지 않니?', '{n} 생일 축하한다.']
function voiceCall(s, seed) {
  const pool = namePool(s)
  const name = pool[(seed * 7 + (s.round || 1) * 3) % pool.length]
  const line = VOICE_LINES[(seed * 5 + (s.round || 1)) % VOICE_LINES.length]
  const n = name.length >= 3 && name !== s.enemy.story.names?.player && name !== s.enemy.story.names?.god ? name.slice(1) : name
  return { name, text: line.replace('{n}', `"${ya(n)},`).replace(/,\s/, ', ') + '"' }
}

// ───────── 판정 도우미 ─────────
const pctOf = (s, p) => Math.max(1, Math.ceil(s.enemy.hp * p))
function hitEnemy(s, n) { s.ehp = Math.max(0, s.ehp - n); if (s.ehp <= 0 && !s.over) s.over = 'win'; return n }
function healEnemy(s, n) { const b = s.ehp; s.ehp = Math.min(s.enemy.hp, s.ehp + n); return s.ehp - b }
/** 이미 들어간 피해(dealt)에 배율을 다시 적용한다. 마지막 한 방(승리)은 그대로 둔다. */
function rescaleDealt(prev, s, dealt, mult, ev, why) {
  if (dealt <= 0 || mult === 1 || s.over === 'win') return
  const want = Math.max(0, Math.round(dealt * mult))
  s.ehp = Math.max(0, Math.min(s.enemy.hp, prev.ehp - want))
  if (s.ehp <= 0) s.over = 'win'
  ev.push({ kind: 'info', text: `${why} — 준 피해 ${dealt} → ${want}.` })
}
/** 상대 턴에 받은 피해(taken)를 배율로 다시 적용한다. 쓰러짐 판정도 다시 한다. */
function rescaleTaken(pre, s, taken, mult, ev, why, ctx) {
  if (taken <= 0 || mult === 1) return
  const want = Math.max(0, Math.round(taken * mult))
  s.php = pre.php - want
  ev.push({ kind: 'info', text: `${why} — 받은 피해 ${taken} → ${want}.` })
  fixDown(s, ev, ctx)
}
function fixDown(s, ev, ctx) {
  if (s.php > 0) {
    if (s.pendingDeath || s.over === 'lose') {
      s.pendingDeath = false; s.over = null
      for (let i = ev.length - 1; i >= 0; i--) if (ev[i].kind === 'end' || /버티기를 쓸 수 있다/.test(ev[i].text || '')) ev.splice(i, 1)
    }
    return
  }
  s.php = 0
  if (s.over || s.pendingDeath) return
  const canSurvive = ctx?.stats && (s.survived | 0) < maxSurvives(ctx.stats) && Math.floor(ctx.mp ?? 0) >= 2
  if (canSurvive) { s.pendingDeath = true; ev.push({ kind: 'warn', text: '체력이 바닥났다…! 버티기를 쓸 수 있다.' }) }
  else { s.over = 'lose'; ev.push({ kind: 'end', text: '더는 버티지 못하고 쓰러졌다.' }) }
}
const hurtPlayer = (s, n, minLeft = 0) => { const d = Math.max(0, Math.min(n, s.php - minLeft)); s.php -= d; return d }
const say = (s, k) => (s.enemy.story.say?.[k] ? { kind: 'enemy', dmg: 0, text: `${s.enemy.name}: "${s.enemy.story.say[k]}"` } : null)
const OFFENSE = new Set(['attack', 'charm', 'psychic'])

/** 상대가 이번 턴을 쉰다(눈을 감음 · 쪽지 · 기절) — 엔진 대신 다음 라운드로 넘긴다. */
function skipTurn(s, text) {
  const q = [...s.queue.slice(1)]
  q.push(rollIntent(q[q.length - 1] ?? s.queue[0], rnd, s.party, !!s.enemy.boss))
  return { state: { ...s, guard: false, round: s.round + 1, queue: q, known: Math.max(0, (s.known || 0) - 1) }, events: [{ kind: 'warn', text }], mpDrain: 0 }
}

/** 최종 신탁: 체력 66% · 33% 에서 형태를 바꾼다. */
function phaseCheck(s, ev) {
  const ph = s.enemy.story.phases
  if (!ph || s.over) return
  const at = s.ehp <= s.enemy.hp * 0.33 ? 2 : s.ehp <= s.enemy.hp * 0.66 ? 1 : 0
  if (at <= (s.sb.phase || 0)) return
  const p = ph[at]
  s.sb = { p, phase: at, ...(INIT[p]?.(s) ?? {}) }
  ev.push({ kind: 'warn', text: `✦ ${s.enemy.name}이(가) 형태를 바꾼다 — 「${PATTERN_NAME[p]}」의 모습.` })
}

// ───────── 훅 1: 내 행동 직후 ─────────
export function afterPlayer(prev, r, action) {
  if (!r || r.invalid || r.keepTurn || !prev?.enemy?.story?.pattern) return r
  const s = withSb(r.state)
  const ev = [...(r.events || [])]
  const sb = s.sb, p = pat(s)
  const dealt = Math.max(0, prev.ehp - s.ehp)
  if (p === 'names' && sb.broken) rescaleDealt(prev, s, dealt, 2, ev, '방어가 무너진 명부귀')
  if (p === 'calm' && OFFENSE.has(action) && dealt > 0) { sb.calm = Math.max(0, sb.calm - 20); ev.push({ kind: 'warn', text: `그 사람이 더 크게 운다. 평온 −20 (지금 ${sb.calm})` }) }
  if (p === 'roots') rescaleDealt(prev, s, dealt, sb.roots > 0 ? 1 - 0.2 * sb.roots : 1.3, ev, sb.roots > 0 ? `뿌리 ${sb.roots}개가 받아 낸다` : '뿌리째 드러난 당산신')
  if (p === 'forms' && !sb.freeze) {
    if (sb.form === 'mercy' && action === 'attack' && dealt > 0 && rnd() < 0.3 && s.over !== 'win') { s.ehp = prev.ehp; ev.push({ kind: 'warn', text: '손이 멈춘다 — 그것은 누군가의 얼굴로 웃고 있다. (공격이 들어가지 않았다)' }) }
    if (sb.form === 'revenge' && dealt > 0) { const d = hurtPlayer(s, Math.ceil(dealt * 0.25), 1); if (d) ev.push({ kind: 'enemy', dmg: d, text: `복수형 — 준 피해의 4분의 1이 되돌아왔다. 체력 −${d}` }) }
  }
  if (p === 'rewind' && sb.hands <= 0) rescaleDealt(prev, s, dealt, 1.25, ev, '시각을 잃은 오류')
  if (p === 'eyes') {
    if (sb.last && action !== sb.last) { sb.eyes -= 1; ev.push({ kind: 'info', text: `다른 움직임 — 눈 하나가 감긴다. (뜬 눈 ${Math.max(0, sb.eyes)})` }) }
    else if (sb.last && action === sb.last) { sb.eyes = Math.min(10, sb.eyes + 1); ev.push({ kind: 'warn', text: `같은 움직임을 읽혔다 — 감겼던 눈 하나가 다시 뜬다. (뜬 눈 ${sb.eyes})` }) }
    sb.last = action
    if (sb.eyes <= 0) { sb.stun = 1; sb.eyes = 4; ev.push({ kind: 'warn', text: `✦ ${s.enemy.name}이(가) 모든 눈을 감았다! 아무것도 보지 못한다 — 다음 턴을 쉰다.` }); const l = say(s, 'blind'); if (l) ev.push(l) }
  }
  if (p === 'heads') rescaleDealt(prev, s, dealt, sb.head === 'san' ? 0.6 : 1.3, ev, sb.head === 'san' ? '산의 머리가 받아 낸다' : '바다의 머리는 무르다')
  if (p === 'voices') rescaleDealt(prev, s, dealt, sb.voices > 0 ? 1 - 0.12 * sb.voices : 1.5, ev, sb.voices > 0 ? `목소리 ${sb.voices}개가 감싼다` : '목소리를 모두 잃은 몸')
  if (p === 'alternate') {
    if (sb.gap && dealt > 0 && s.over !== 'win') { rescaleDealt(prev, s, dealt, 1.5, ev, '틈을 찔렀다'); sb.gap = false }
    if (sb.phase === 'sea' && OFFENSE.has(action) && dealt > 0) { const d = hurtPlayer(s, Math.ceil(dealt * 0.5), 1); if (d) ev.push({ kind: 'enemy', dmg: d, text: `바다의 신탁이 되받아친다! 체력 −${d}` }) }
    else if (sb.phase === 'sea' && !OFFENSE.has(action)) { sb.gap = true; ev.push({ kind: 'info', text: '바다의 신탁을 흘려보냈다 — 틈이 생겼다. (다음 공격 ×1.5)' }) }
  }
  phaseCheck(s, ev)
  return { ...r, state: s, events: ev }
}

// ───────── 훅 2: 상대 턴 ─────────
export function enemyTurn(state, engine, ctx) {
  if (!state?.enemy?.story?.pattern) return engine(state, ctx)
  let pre = withSb(state)
  const sb0 = pre.sb, p0 = pat(pre)
  // 쉬는 턴
  if ((p0 === 'eyes' || p0 === 'forms') && sb0.stun > 0) {
    const r = skipTurn(pre, p0 === 'eyes' ? `${pre.enemy.name}이(가) 눈을 감은 채 움직이지 못한다.` : `${pre.enemy.name}이(가) 쪽지에 적힌 글씨를 내려다본다. 움직이지 않는다.`)
    r.state.sb = { ...sb0, stun: sb0.stun - 1, freeze: Math.max(0, (sb0.freeze || 0) - (p0 === 'forms' ? 1 : 0)) }
    return r
  }
  // 막지 못하게(무너진 명부귀)
  if (p0 === 'names' && sb0.broken && pre.queue[0] === 'guard') pre = { ...pre, queue: ['jab', ...pre.queue.slice(1)] }
  const r = engine(pre, ctx)
  const s = withSb(r.state)
  const ev = [...(r.events || [])]
  const sb = s.sb, p = pat(s)
  const taken = Math.max(0, pre.php - s.php)
  let mpDrain = r.mpDrain || 0
  if (p === 'calm' && sb.calm >= 50) rescaleTaken(pre, s, taken, 0.5, ev, '가라앉은 사람', ctx)
  if (p === 'roots' && sb.roots > 0 && !s.over) { const h = healEnemy(s, pctOf(s, 0.04 * sb.roots)); if (h) ev.push({ kind: 'warn', text: `뿌리가 마을의 불행을 빨아올린다. ${s.enemy.name} 체력 +${h}` }) }
  if (p === 'forms') {
    if (!sb.freeze && sb.form === 'mercy' && !s.over) { const h = healEnemy(s, pctOf(s, 0.04)); if (h) ev.push({ kind: 'warn', text: `자비형 — 그것이 스스로를 쓰다듬는다. 체력 +${h}` }) }
    if (!sb.freeze && sb.form === 'fear' && !s.over && rnd() < 0.35) { s.ps = { ...(s.ps || {}), fear: Math.max(1, s.ps?.fear || 0) }; ev.push({ kind: 'warn', text: '공포형 — 등 뒤에서 누군가 이름을 부른다. 다음 턴 공격 · 부적을 쓸 수 없다.' }) }
    if (sb.freeze) sb.freeze -= 1
  }
  if (p === 'rewind') {
    sb.t += 1
    if (sb.t % 2 === 0 && !s.over) {
      const dealt = sb.snapE - s.ehp
      if (sb.hands > 0) {
        if (dealt >= s.enemy.hp * 0.2) {
          sb.hands -= 1
          ev.push({ kind: 'warn', text: `✦ 되감기가 걸리다 끊겼다! 초침 하나가 부러진다. (남은 초침 ${sb.hands})` })
          if (!sb.hands) { ev.push({ kind: 'warn', text: '시계가 멈췄다. 오류는 더 이상 되감지 못한다 — 받는 피해 +25%.' }); const l = say(s, 'stop'); if (l) ev.push(l) }
        } else {
          s.ehp = sb.snapE
          if (sb.snapP > 0) s.php = Math.max(s.php, sb.snapP)
          ev.push({ kind: 'warn', text: '23시 17분 — 모든 것이 두 턴 전으로 되감긴다. (상대 · 나의 체력이 돌아갔다)' })
          fixDown(s, ev, ctx)
        }
      }
      sb.snapE = s.ehp; sb.snapP = s.php
    }
  }
  if (p === 'eyes') rescaleTaken(pre, s, taken, 0.4 + sb.eyes * 0.08, ev, `뜬 눈 ${sb.eyes}개`, ctx)
  if (p === 'heads') {
    if (sb.head === 'san') rescaleTaken(pre, s, taken, 1.3, ev, '산의 머리가 내리친다', ctx)
    else if (taken > 0) { mpDrain += 5; ev.push({ kind: 'warn', text: '바다의 머리가 기운을 빨아들인다. 의지력 −5' }) }
    sb.head = sb.head === 'san' ? 'sea' : 'san'
    ev.push({ kind: 'info', text: `이제 ${sb.head === 'san' ? '산' : '바다'}의 머리가 응답한다.` })
  }
  if (p === 'voices' && !s.over) sb.call = voiceCall(s, sb.voices + s.round)
  if (p === 'alternate') {
    if (sb.phase === 'mountain') {
      if (pre.guard) { if (taken > 0) { s.php = pre.php; fixDown(s, ev, ctx) } sb.gap = true; ev.push({ kind: 'info', text: '산의 신탁을 받아 냈다 — 피해 없음, 틈이 생겼다.' }) }
      else rescaleTaken(pre, s, taken, 1.5, ev, '막지 않은 산의 신탁', ctx)
    }
    sb.phase = sb.phase === 'mountain' ? 'sea' : 'mountain'
  }
  if (p === 'fog' && !s.over) {
    sb.fog += 1
    if (sb.fog >= 5) {
      const d = hurtPlayer(s, Math.ceil(s.phpMax * 0.25))
      sb.fog = 2
      ev.push({ kind: 'enemy', dmg: d, text: `안개가 덮쳤다 — 이름 하나가 지워질 뻔했다. 체력 −${d} (막을 수 없다)` })
      fixDown(s, ev, ctx)
    } else ev.push({ kind: 'info', text: `안개가 한 칸 찬다. (${sb.fog}/5)` })
  }
  if (p === 'ward') {
    if (sb.cover) rescaleTaken(pre, s, taken, 1.5, ev, '감싸 막았다', ctx)
    else if (!s.over) {
      const d = 10 + Math.round(taken * 0.5)
      sb.ward = Math.max(0, sb.ward - d)
      ev.push({ kind: 'warn', text: `${s.enemy.story.key === 'raid' ? '의식의 자리' : '부모들의 자리'}가 흔들린다. −${d} (남은 ${sb.ward})` })
      if (sb.ward <= 0) { s.over = 'lose'; ev.push({ kind: 'end', text: s.enemy.story.key === 'raid' ? '의식의 자리가 무너졌다.' : '부모들의 자리가 무너졌다. 지키지 못했다.' }) }
    }
    sb.cover = false
  }
  phaseCheck(s, ev)
  return { ...r, state: s, events: ev, mpDrain }
}

// ───────── 훅 3: 이야기 행동 ─────────
/** 반환: { state, events, mpCost?, free? } · { invalid, events } · null(이 상대에겐 없는 행동) */
export function act(state, id, arg, ctx = {}) {
  if (!state?.enemy?.story?.pattern) return null
  const s = withSb(state)
  const sb = s.sb, p = pat(s), ev = []
  const mp = Math.floor(ctx.mp ?? 0)
  const need = (n) => (mp < n ? { invalid: true, events: [{ kind: 'warn', text: `의지력이 모자라다. (필요 ${n}, 지금 ${mp})` }] } : null)
  if (p === 'names' && id === 'name') {
    if (arg === '한도윤') {
      sb.hits += 1
      const d = hitEnemy(s, pctOf(s, 0.08))
      ev.push({ kind: 'info', text: `"한도윤!" — 이름이 제자리를 찾는다. 명부귀가 움찔한다. (피해 ${d} · ${sb.hits}/3)` })
      if (sb.hits >= 3 && !sb.broken) { sb.broken = true; ev.push({ kind: 'warn', text: '✦ 명부귀의 방어가 무너졌다! 이제 받는 피해 ×2, 막지 못한다.' }); const l = say(s, 'broken'); if (l) ev.push(l) }
    } else { const h = healEnemy(s, pctOf(s, 0.1)); ev.push({ kind: 'warn', text: `"${arg}" — 명부귀가 그 이름을 삼켰다. 체력 +${h}` }) }
    return { state: s, events: ev }
  }
  if (p === 'calm') {
    if (id === 'ask') { sb.asked += 1; const g = sb.asked <= 2 ? 35 : 10; sb.calm = Math.min(100, sb.calm + g); ev.push({ kind: 'info', text: sb.asked <= 2 ? `"이름이 뭐예요?" — 그 사람이 입술을 움직인다. 평온 +${g}` : `다시 묻는다. 대답은 같다. 평온 +${g}` }) }
    else if (id === 'sit') { sb.calm = Math.min(100, sb.calm + 15); s.guard = true; ev.push({ kind: 'info', text: '곁에 앉는다. 막는 자세로 기다린다. 평온 +15' }) }
    else if (id === 'show') { if (sb.shown || !s.enemy.story.has?.['st-portrait']) return { invalid: true, events: [{ kind: 'warn', text: '보일 영정 조각이 없다.' }] }; sb.shown = true; sb.calm = Math.min(100, sb.calm + 30); ev.push({ kind: 'info', text: '흐린 영정 조각을 보인다. 그 사람이 자기 얼굴을 한참 들여다본다. 평온 +30' }) }
    else return null
    if (sb.calm >= 100) { s.over = 'win'; s.enemy = { ...s.enemy, calmed: true }; const l = say(s, 'calm'); if (l) ev.push(l); ev.push({ kind: 'end', text: `${s.enemy.name}이(가) 자기 이름을 말하고 주저앉는다. 진정시켰다 — 이야기 승리.` }) }
    return { state: s, events: ev }
  }
  if (p === 'roots' && id === 'cut') {
    const cost = s.enemy.story.family === 'fan' ? 4 : 8
    const no = need(cost); if (no) return no
    if (sb.roots <= 0) return { invalid: true, events: [{ kind: 'warn', text: '끊을 뿌리가 남아 있지 않다.' }] }
    sb.roots -= 1
    ev.push({ kind: 'info', text: `금줄 하나를 끊었다. 뿌리 하나가 흙 속에서 말라 간다. (남은 뿌리 ${sb.roots})` })
    if (!sb.roots) { ev.push({ kind: 'warn', text: '✦ 당산신이 뿌리째 드러났다! 받는 피해 +30%.' }); const l = say(s, 'bare'); if (l) ev.push(l) }
    return { state: s, events: ev, mpCost: cost }
  }
  if (p === 'forms' && id === 'read') {
    if (sb.read || !s.enemy.story.has?.['st-prayers']) return { invalid: true, events: [{ kind: 'warn', text: '읽어 줄 쪽지가 없다.' }] }
    sb.read = true; sb.stun = 1; sb.freeze = 3
    ev.push({ kind: 'info', text: '기도 쪽지를 한 장씩 소리 내어 읽는다. "돌아와." "돌아와." "돌아와."' })
    const l = say(s, 'read'); if (l) ev.push(l)
    return { state: s, events: ev }
  }
  if (p === 'heads' && id === 'cut') {
    if (sb.cutRound === s.round) return { invalid: true, events: [{ kind: 'warn', text: '이번 턴엔 이미 응답을 끊었다.' }] }
    const no = need(6); if (no) return no
    sb.head = sb.head === 'san' ? 'sea' : 'san'; sb.cutRound = s.round
    ev.push({ kind: 'info', text: `응답을 끊었다 — 이제 ${sb.head === 'san' ? '산' : '바다'}의 머리가 응답한다. (턴은 그대로)` })
    return { state: s, events: ev, mpCost: 6, free: true }
  }
  if (p === 'voices' && id === 'name') {
    if (arg === sb.call?.name) {
      sb.voices = Math.max(0, sb.voices - 1)
      const d = hitEnemy(s, pctOf(s, 0.06))
      ev.push({ kind: 'info', text: `"${arg}!" — 그 목소리가 대답을 듣고 떨어져 나간다. (피해 ${d} · 남은 목소리 ${sb.voices})` })
      if (!sb.voices) { ev.push({ kind: 'warn', text: '✦ 목소리를 모두 떼어 냈다! 받는 피해 ×1.5.' }); const l = say(s, 'broken'); if (l) ev.push(l) }
    } else { const h = healEnemy(s, pctOf(s, 0.05)); ev.push({ kind: 'warn', text: `"${arg}" — 엉뚱한 이름에 목소리들이 한꺼번에 웃는다. 체력 +${h}` }) }
    sb.call = voiceCall(s, sb.voices + s.round + 1)
    phaseCheck(s, ev)
    return { state: s, events: ev }
  }
  if (p === 'fog' && id === 'name') {
    if (sb.used.includes(arg)) return { invalid: true, events: [{ kind: 'warn', text: '이번 판에 이미 부른 이름이다.' }] }
    sb.used = [...sb.used, arg]; sb.fog = Math.max(0, sb.fog - 2)
    const d = hitEnemy(s, pctOf(s, 0.08))
    ev.push({ kind: 'info', text: `"${arg}!" — 이름이 불린 자리에서 안개가 물러난다. (안개 ${sb.fog}/5 · 피해 ${d})` })
    phaseCheck(s, ev)
    return { state: s, events: ev }
  }
  if (p === 'ward' && id === 'cover') {
    sb.cover = true; s.guard = true
    ev.push({ kind: 'info', text: `${s.enemy.story.key === 'raid' ? '의식의 자리' : '부모들'} 앞을 막아선다. (막기 · 이번 상대 턴엔 자리가 깎이지 않는다)` })
    return { state: s, events: ev }
  }
  return null
}

// ───────── 화면 ─────────
const Chip = ({ on, children }) => <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${on ? 'bg-gold/25 text-gold' : 'bg-edge/10 text-paper/45'}`}>{children}</span>
const Dots = ({ n, max, on = '●', off = '○' }) => <span className="font-mono tracking-widest text-gold">{on.repeat(Math.max(0, n))}<span className="text-paper/30">{off.repeat(Math.max(0, max - n))}</span></span>
function ActBtn({ onClick, disabled, label, note }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="tilt flex flex-col items-start gap-0.5 rounded-xl bg-gold/10 p-3 text-left enabled:hover:bg-gold-fill/25 disabled:opacity-40">
    <span className="text-sm font-medium text-gold">{label}</span>
    {note && <span className="text-[10.5px] leading-snug text-paper/60">{note}</span>}
  </button>
}

/** 전투 화면 아래의 패턴 계기판 + 이야기 행동 */
export function Panel({ b, myTurn, onAct }) {
  if (!b?.enemy?.story?.pattern || b.over) return null
  const s = { ...b, sb: sbOf(b) }
  const sb = s.sb, p = pat(s), story = b.enemy.story
  const off = !myTurn
  let meter = null
  const acts = []
  if (p === 'names') {
    meter = <p>이름 <Dots n={sb.hits} max={3} /> {sb.broken && <Chip on>방어 붕괴</Chip>}</p>
    const opts = shuffle(['한도윤', '한도연', ['윤진서', '한도율', '서창현'][(b.round + sb.hits) % 3]], b.round + sb.hits)
    for (const n of opts) acts.push(<ActBtn key={n} disabled={off} onClick={() => onAct('name', n)} label={`"${n}" 하고 부른다`} note={story.has?.['st-bell302'] && n === '한도윤' ? '♪ 302호의 방울이 운다' : '이름 부르기'} />)
  } else if (p === 'calm') {
    meter = <div><p>평온 {sb.calm} / 100</p><div className="mt-1 h-1.5 w-full rounded bg-edge/15"><div className="h-1.5 rounded bg-gold" style={{ width: `${sb.calm}%` }} /></div></div>
    acts.push(<ActBtn key="ask" disabled={off} onClick={() => onAct('ask')} label="이름을 묻는다" note={sb.asked < 2 ? '평온 +35' : '평온 +10'} />)
    acts.push(<ActBtn key="sit" disabled={off} onClick={() => onAct('sit')} label="곁에 앉는다" note="평온 +15 · 막기" />)
    if (story.has?.['st-portrait']) acts.push(<ActBtn key="show" disabled={off || sb.shown} onClick={() => onAct('show')} label="영정 조각을 보인다" note={sb.shown ? '이미 보였다' : '평온 +30 (한 번)'} />)
  } else if (p === 'roots') {
    const cost = story.family === 'fan' ? 4 : 8
    meter = <p>뿌리 <Dots n={sb.roots} max={3} on="♣" off="·" /> {sb.roots ? `받는 피해 −${sb.roots * 20}% · 턴마다 회복` : <Chip on>뿌리째 드러남 · 받는 피해 +30%</Chip>}</p>
    acts.push(<ActBtn key="cut" disabled={off || !sb.roots} onClick={() => onAct('cut')} label="금줄을 끊는다" note={`의지력 ${cost} · 뿌리 하나`} />)
  } else if (p === 'forms') {
    const F = { mercy: ['자비형', '공격이 멈추고, 스스로 낫는다'], revenge: ['복수형', '준 피해의 25%가 돌아온다'], fear: ['공포형', '공격 · 부적이 막힐 수 있다'] }[sb.form]
    meter = <p>{F[0]} — {F[1]} {sb.freeze > 0 && <Chip on>멈춤 {sb.freeze}턴</Chip>}</p>
    if (story.has?.['st-prayers']) acts.push(<ActBtn key="read" disabled={off || sb.read} onClick={() => onAct('read')} label="쪽지를 읽어 준다" note={sb.read ? '이미 읽었다' : '한 턴 멈춤 · 3턴 동안 모습의 힘이 꺼진다'} />)
  } else if (p === 'rewind') {
    meter = <p>되감기까지 {2 - (sb.t % 2)}턴 · 초침 <Dots n={sb.hands} max={3} /> · 이번 구간 깎은 체력 {Math.max(0, sb.snapE - b.ehp)} / {Math.ceil(b.enemy.hp * 0.2)}</p>
  } else if (p === 'eyes') {
    meter = <p>뜬 눈 <Dots n={sb.eyes} max={10} /> · 받는 피해 ×{(0.4 + sb.eyes * 0.08).toFixed(2)} {sb.last && <span className="text-paper/50">(앞 행동: {{ attack: '공격', guard: '막기', scan: '간파', charm: '부적', psychic: '영능력' }[sb.last] ?? sb.last})</span>}</p>
  } else if (p === 'heads') {
    meter = <p>응답하는 머리: <Chip on>{sb.head === 'san' ? '산 — 단단함 · 강타' : '바다 — 무름 · 의지력 흡수'}</Chip></p>
    acts.push(<ActBtn key="cut" disabled={off || sb.cutRound === b.round} onClick={() => onAct('cut')} label="응답을 끊는다" note="의지력 6 · 턴을 쓰지 않고 머리를 바꾼다" />)
  } else if (p === 'voices') {
    meter = <div><p>목소리 <Dots n={sb.voices} max={5} /> · 받는 피해 ×{(sb.voices ? 1 - 0.12 * sb.voices : 1.5).toFixed(2)}</p>{sb.voices > 0 && sb.call && <p className="mt-1 font-serif text-sm text-paper">한 목소리가 부른다 — {sb.call.text}</p>}</div>
    if (sb.voices > 0 && sb.call) {
      const others = namePool(s).filter((n) => n !== sb.call.name)
      const opts = shuffle([sb.call.name, ...shuffle(others, b.round + sb.voices).slice(0, 2)], b.round * 3 + sb.voices)
      for (const n of opts) acts.push(<ActBtn key={n} disabled={off} onClick={() => onAct('name', n)} label={`"${n}" 하고 받아 준다`} note="이름 부르기" />)
    }
  } else if (p === 'alternate') {
    meter = <p>이번에 오는 것: <Chip on>{sb.phase === 'mountain' ? '산의 신탁 — 막아라' : '바다의 신탁 — 치지 마라(반사)'}</Chip> {sb.gap && <Chip on>틈 — 다음 공격 ×1.5</Chip>}</p>
  } else if (p === 'fog') {
    meter = <p>안개 <Dots n={sb.fog} max={5} on="▓" off="░" /></p>
    for (const n of namePool(s).filter((x) => !sb.used.includes(x)).slice(0, 6)) acts.push(<ActBtn key={n} disabled={off} onClick={() => onAct('name', n)} label={`"${n}"`} note="안개 −2" />)
  } else if (p === 'ward') {
    meter = <div><p>{story.key === 'raid' ? '의식의 자리' : '부모들의 자리'} {sb.ward} / 100</p><div className="mt-1 h-1.5 w-full rounded bg-edge/15"><div className="h-1.5 rounded bg-crimson/70" style={{ width: `${sb.ward}%` }} /></div></div>
    acts.push(<ActBtn key="cover" disabled={off} onClick={() => onAct('cover')} label="감싸 막는다" note="막기 · 자리는 지키지만 받는 피해 ×1.5" />)
  }
  return <div className="mt-3 rounded-xl border border-gold/30 bg-gold/[0.05] p-3" aria-label="이야기 전투">
    <p className="text-[11px] text-gold">◆ 이야기 전투 — {PATTERN_NAME[p]}{story.phases ? ` · 형태 ${(sb.phase || 0) + 1}/3` : ''}</p>
    <div className="mt-1 text-xs text-paper/80">{meter}</div>
    {acts.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">{acts}</div>}
  </div>
}

/** 싸움 전 안내 */
export function Intro({ e }) {
  const st = e.story
  const drop = dropOf(st.key)
  const recipes = bossRecipes(st.key)
  return <div className="mt-2 space-y-2 text-sm text-paper/80">
    <p className="italic text-paper/70">{e.blurb}</p>
    {st.say?.start && <p className="font-serif text-paper">"{st.say.start}"</p>}
    {st.pattern && <ul className="list-disc space-y-1 pl-5 text-xs text-paper/75">{st.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
    {drop && <p className="text-xs text-gold">이기면 — {itemOf(drop[0])?.name}{drop[1] > 1 ? ` ×${drop[1]}` : ''}{recipes.length ? ` · 새 제작법 「${recipes.map((r) => itemOf(r.result)?.name).join(' · ')}」` : ''}</p>}
    <p className="text-[11px] text-paper/50">이야기 전투는 져도 쇠약이 남지 않는다. 몸을 추스르고 다시 도전하면 된다.</p>
  </div>
}
