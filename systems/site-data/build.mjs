/**
 * 秘靈 · 비령 — 화면용 구역 데이터 만들기.
 *   npm run site:data     →  저장소 맨 위의 game-data.js 를 다시 만든다.
 *
 * 보관고(systems/vault)의 데이터 카탈로그에서 구역 화면에 필요한 것만 골라 한 파일로 묶는다.
 * 화면은 정적 페이지(GitHub Pages)에서도 열려야 하므로 서버 없이 읽을 수 있는 스크립트 파일로 만든다.
 *   강학당(東) = 본관 · 별관 / 생활관(西) = 기숙사 / 비령산 금역(南) = 뒷산 / 산문(北) = 비어 있음
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const cat = (id) => JSON.parse(readFileSync(join(ROOT, 'systems/vault/catalog/game', id + '.json'), 'utf8')).exports

// 빈 NPC 자리는 화면에서 이 이름으로 보인다(새 NPC 가 정해지면 여기 또는 npcSlots 를 채운다).
const NPC_LABEL = { outskirtsGuide: '야영지 지킴이', storeKeeper: '매점 담당', seedKeeper: '씨앗 상점 주인', armorySmith: '무구보관소 담당', shrineKeeper: '사당 문지기', kitchenKeeper: '조리실 담당', infirmaryKeeper: '양호 선생' }
const JOSA = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'] }
const josa = (w, j) => { const p = JOSA[j]; if (!p) return w + (j ?? ''); const c = w.slice(-1).charCodeAt(0) - 0xac00; const b = c < 0 || c > 11171 ? -1 : c % 28; if (p[0] === '으로') return w + (b > 0 && b !== 8 ? '으로' : '로'); return w + (b > 0 ? p[0] : p[1]) }
const npcFill = (v) => typeof v === 'string' ? v.replace(/\{\{npc:(\w+)(?:\|([가-힣]+))?\}\}/g, (m, id, j) => (NPC_LABEL[id] ? (j ? josa(NPC_LABEL[id], j) : NPC_LABEL[id]) : m))
  : Array.isArray(v) ? v.map(npcFill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, npcFill(x)])) : v

const C = cat('constants'), items = cat('items'), battle = cat('battle'), progress = cat('progress')
const itemName = Object.fromEntries(items.ITEMS.map((i) => [i.id, i.name]))
const nameOf = (id) => itemName[id] ?? id
const STAT = Object.fromEntries(C.STAT_KEYS.map((k) => [k, C.STAT_META[k].label]))

// ── 장면(탐사) 노드 정리: 화면이 쓰는 것만 남긴다 ──
// 탐사 장면의 기능 칸 → 실행 화면(play/index.html#주소). 주소가 없는 것은 안내 글만 보인다.
const WIDGET_PLAY = { armoryManage: ['armory', '무구 관리하기'], seedShop: ['garden', '씨앗 상점으로'], greenhouse: ['garden', '비닐하우스로'], extraBattle: ['extra/1', '추가전투로'], gotoInfirmary: ['rest', '양호실로'] }
const WIDGET_NOTE = {
  ricePouch: '볍씨 주머니는 아직 화면에 연결되지 않았다.', goblinToday: '오늘의 도깨비 놀이는 아직 화면에 연결되지 않았다.', outsideGuide: '교문 밖은 짙은 안개에 잠겨 있다.',
}
function textOf(list) {
  return (list ?? []).map((e) => typeof e === 'string' ? { t: e } : { t: e.text, ...(e.when ? { when: e.when } : {}), ...(e.mode ? { mode: e.mode } : {}), ...(e.chance != null ? { chance: e.chance } : {}) }).filter((e) => e.t)
}
function node(n) {
  const out = { id: n.id, name: n.name }
  const text = textOf(n.text ?? n.intro)
  if (text.length) out.text = text
  if (n.when) out.when = n.when
  if (n.seq?.length) out.seq = n.seq
  if (n.typeAfter) out.after = n.typeAfter
  if (n.result) out.result = [].concat(n.result)
  if (n.cost) out.cost = { ...(n.cost.mp ? { mp: n.cost.mp } : {}), ...(n.cost.wait ? { wait: n.cost.wait } : {}) }
  if (n.note) out.note = n.note
  if (n.notice) out.notice = n.notice
  if (n.fx) out.fx = n.fx
  if (n.night) out.night = { from: n.night.from, to: n.night.to, closed: n.night.closed }
  if (n.widget && WIDGET_PLAY[n.widget]) out.play = { to: WIDGET_PLAY[n.widget][0], label: WIDGET_PLAY[n.widget][1] }
  else if (n.widget) out.widgetNote = WIDGET_NOTE[n.widget] ?? '이 기능은 아직 화면에 연결되지 않았다.'
  if (n.action) out.widgetNote = '이 선택의 결과(판정 · 보상)는 아직 화면에 연결되지 않았다.'
  if (n.club) out.note = [out.note, `동아리 부실`].filter(Boolean).join(' · ')
  const kids = [...(n.choices ?? []), ...(n.areas ?? []), ...(n.rooms ?? []), ...(n.spots ?? []), ...(n.branches ?? [])]
    .filter((c) => !((c.npc?.vacant || c.npcSlot) && !c.seq)) // 빈 NPC 자리에 말을 거는 선택지는 뺀다
  if (kids.length) out.choices = kids.map(node)
  return out
}
const scene = (id, title, name, children, intro) => ({ id, title, kind: 'scene', root: node({ id, name, text: intro ?? [], choices: children }) })
// play: { to: '실행 주소', label: '버튼 글' } — 구역 화면에서 [▶ 버튼]을 누르면 실행 화면이 열린다.
const run = (to, label) => ({ to, label })
const text = (id, title, paras, play) => ({ id, title, kind: 'text', paras: paras.filter(Boolean), ...(play ? { play } : {}) })
const list = (id, title, itemsArr, intro, play) => ({ id, title, kind: 'list', ...(intro ? { intro } : {}), ...(play ? { play } : {}), items: itemsArr })
const recipeLine = (r) => ({ name: nameOf(r.result), sub: r.inputs.map(([id, n]) => `${nameOf(id)} ×${n}`).join(' + '), desc: items.ITEMS.find((i) => i.id === r.result)?.desc ?? '', lines: [items.ITEMS.find((i) => i.id === r.result)?.effectText].filter(Boolean) })
const enemyLine = (e) => ({ play: run(`battle/${e.id}`, '이 상대와 싸우기'), name: e.name, sub: [e.tier ? `${C.TIER_HANJA?.[e.tier] ?? e.tier}단계` : '', e.role ?? (e.partySize > 1 ? `${e.partySize}인` : '단독'), e.rec ? `권장 스탯 ${e.rec}` : ''].filter(Boolean).join(' · '), desc: e.blurb ?? '', lines: [`체력 ${e.hp} · 공격력 ${e.atk} · 행동력 ${e.act} · 영력 ${e.spirit}`, e.special ? `영능력 [${e.special.label}] ${e.special.note ?? ''}` : '', e.special2 ? `영능력 [${e.special2.label}] ${e.special2.note ?? ''}` : ''].filter(Boolean) })

const LI = cat('locationText').LOCATION_INTRO
const explore = cat('explore'), annex = cat('annex'), hike = cat('hike'), courseInfo = cat('courseInfo'), clubs = cat('clubs'), store = cat('store'), meals = cat('meals')
const crafting = cat('crafting'), cooking = cat('cooking'), hunt = cat('huntSites'), garden = cat('garden'), armory = cat('armory'), bestiary = cat('bestiary')

const speciesName = (id) => hunt.HUNT_SPECIES[id]?.name ?? id
const siteLine = (s) => {
  const count = {}
  for (const n of s.nodes) (count[n.kind] ??= new Set()).add(speciesName(n.species))
  const kind = (k) => hunt.HUNT_KINDS[k]?.label ?? k
  return { play: run(`pioneer/${s.id}`, '이 터로 개척 나가기'), name: s.name, sub: `${s.maxTurns}턴 · 칸 ${s.nodes.length}개`, desc: '', lines: [...Object.entries(count).map(([k, v]) => `${kind(k)}: ${[...v].join(', ')}`), s.spirit ? `영물: ${s.spirit.name} (${Math.round((s.spirit.chance ?? 0) * 100)}%)` : '', s.ghost ? `요괴: ${s.ghost.name ?? battle.ALL_ENEMIES.find((e) => e.id === (s.ghost.enemy ?? s.ghost.id))?.name ?? ''}` : ''].filter((l) => l && !l.endsWith(': ')) }
}

// kind: 'play' = 그 자리에서 바로 실행되는 화면(systems/play). 주소는 App.jsx 의 화면 이름.
const play = (id, title, to, intro) => ({ id, title, kind: 'play', to, ...(intro ? { intro } : {}) })
// v1.0: 구역 → 곳 → 할 일. 초록동색의 장소 · 활동과 같은 얼개다(그 자리에 가면 그 자리의 기능이 나온다).
// 할 일의 실행 주소는 at/<곳>/<할 일> — systems/play/src/App.jsx 가 그 장소 화면을 그대로 그린다.
const act = (loc, id, title, extra = {}) => ({ id, title, kind: 'play', to: `at/${loc}/${id}`, ...extra })
const place = (id, name, hanja, acts) => ({ id, name, hanja, sections: acts })
const zones = {
  north: { title: '산문', story: true, tabs: [] }, // 산문 = 스토리 퀘스트(story.js)
  center: { title: '사당', tabs: [
    place('shrine', '사당', '黃', [act('shrine', 'intro', '둘러보기'), act('shrine', 'sign', '표지판'), act('shrine', 'explore', '사당 탐사', { unlock: 'shrine' })]),
  ] },
  east: { title: '강학당', tabs: [
    place('mainHall', '본관', '靑', [act('mainHall', 'intro', '둘러보기'), act('mainHall', 'class', '수업'), act('mainHall', 'explore', '본관 탐사')]),
    place('annex', '별관', '白', [act('annex', 'intro', '둘러보기'), act('annex', 'explore', '별관 탐사')]),
    { ...place('infirmary', '양호실', '癒', [act('infirmary', 'intro', '둘러보기'), act('infirmary', 'rest', '휴식 · 상담')]), hidden: true }, // 본관 탐사(2층 양호실)로 들어간다
  ] },
  west: { title: '생활관', tabs: [
    place('dorm', '기숙사', '黑', [act('dorm', 'intro', '둘러보기'), act('dorm', 'my-room', '내 기숙사'), act('dorm', 'store', '매점'), act('dorm', 'cafeteria', '급식실')]),
  ] },
  south: { title: '비령산 금역', tabs: [
    place('gym', '뒷산', '赤', [act('gym', 'intro', '둘러보기'), act('gym', 'battle', '퇴마 실습'), act('gym', 'hike', '산 탐사'), act('gym', 'pioneer', '개척')]),
  ] },
}

// ── 내부 지도(v1.0): 탐사할 수 있는 곳을 층 · 길 단위로 정리한다. app.js 가 도트 지도로 그린다. ──
const shrineX = cat('shrineExplore')
const roomsOf = (n) => [...(n.areas ?? []), ...(n.rooms ?? []), ...(n.spots ?? []), ...(n.branches ?? []), ...(n.choices ?? [])].filter((c) => c.widget !== 'extraBattle').map((c) => ({ id: c.id, name: c.name, ...(c.club ? { club: true } : {}) }))
const maps = [
  { id: 'mainHall', name: '본관', hanja: '靑', color: 'blue', levels: explore.FLOORS.map((f) => ({ id: f.id, name: f.name, rooms: roomsOf(f) })) },
  { id: 'annex', name: '별관', hanja: '白', color: 'white', levels: annex.ANNEX_FLOORS.map((f) => ({ id: f.id, name: f.name, rooms: roomsOf(f) })) },
  { id: 'gym', name: '뒷산', hanja: '赤', color: 'red', levels: hike.HIKE_PATHS.map((p) => ({ id: p.id, name: p.name, rooms: (p.branches?.length ? p.branches.flatMap((b) => [{ id: b.id, name: b.name, path: true }, ...roomsOf(b)]) : roomsOf(p)) })) },
  { id: 'shrine', name: '사당', hanja: '黃', color: 'yellow', levels: [{ id: 'shrine', name: '사당 경내', rooms: (shrineX.SHRINE_AREAS ?? []).map((a) => ({ id: a.id, name: a.name })) }] },
]

const { TEXT_SWAPS } = await import('../biryeong/reskin.data.js')
const swapText = (v) => typeof v === 'string' ? TEXT_SWAPS.reduce((t, [x, y]) => t.split(x).join(y), v) : Array.isArray(v) ? v.map(swapText) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swapText(x)])) : v
const data = swapText(npcFill({
  generatedFrom: 'systems/vault (초록동색 C.01 콘텐츠 보관고)',
  rules: {
    statKeys: C.STAT_KEYS,
    stats: Object.fromEntries(C.STAT_KEYS.map((k) => [k, { label: C.STAT_META[k].label, en: C.STAT_META[k].en, hint: C.STAT_META[k].hint, detail: C.STAT_META[k].detail }])),
    statMin: C.STAT_MIN, statMax: C.STAT_MAX, startPoints: C.STAT_START_POINTS,
    hpMax: C.HP_MAX, mpMax: C.MP_MAX, spiritStart: C.SPIRIT_START, spiritMax: C.SPIRIT_MAX, startMoney: items.START_MONEY,
    nameMax: C.NAME_MAX_LENGTH, introMax: C.GREETING_MAX_LENGTH,
  },
  zones,
  maps,
}))
const left = JSON.stringify(data).match(/\{\{npc:[^}]*\}\}/g)
if (left) throw new Error('채워지지 않은 NPC 자리표: ' + [...new Set(left)].join(' '))
const body = `/* 秘靈 · 비령 — 구역 화면 데이터. 직접 고치지 말 것: npm run site:data 로 systems/vault 에서 다시 만든다. */\nwindow.BIRYEONG_DATA = ${JSON.stringify(data)};\n`
writeFileSync(join(ROOT, 'game-data.js'), body)
const count = (n) => 1 + (n.choices ?? []).reduce((a, c) => a + count(c), 0)
for (const [k, z] of Object.entries(zones)) console.log(k, z.title, z.tabs.map((t) => `${t.name}: ${t.sections.map((s) => s.title).join(', ')}`).join(' | ') || '(스토리)')
for (const m of maps) console.log('지도', m.name, m.levels.map((l) => `${l.name}(${l.rooms.length})`).join(' '))
console.log('game-data.js', Math.round(Buffer.byteLength(body) / 1024) + 'KB')
