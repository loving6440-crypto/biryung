// 비령 vD.05 — 신수들의 터: 새끼 신수 맡아 기르기. (vD.06 3단계 · 이름은 한 번 정하면 바꾸지 않는다 · 이벤트 「학생 괴담 수칙」을 마쳐야 열린다)
//
// · 신수는 주인을 정할 수 없는 생명이라 '맡아 기른다'. 처음엔 한 마리, 그 아이가 다 자라면(성수) 다른 아이를 또 맡을 수 있다(다섯 종 모두).
// · 배부름 · 기분은 시간이 지나면 조금씩 준다(접속하지 않은 동안에도, 볼 때 한꺼번에 계산 — 서버에 묻지 않는다).
// · 유대가 쌓이면 자란다: 어린 → 성장기 → 성수(예: 어린 백호 · 성장기 백호 · 성수 백호). 단계를 처음 넘을 때 보상. 꾸준히 돌보면 2주쯤에 성수.
// · 돌보기: 먹이 주기(좋아하는 것은 더 기뻐한다) · 쓰다듬기(1시간마다) · 놀아 주기(4시간마다) · 심부름(1/3/8시간, 다녀오면 물건을 물어 온다).
// · 배가 고프거나 기분이 바닥이면 유대가 절반만 쌓인다. 떠나거나 죽지는 않는다.
// 상태는 player.beasts 에 들어 계정 기록과 함께 저장된다.

export const KINDS = {
  cheongnyong: { id: 'cheongnyong', name: '청룡', hanja: '龍', dir: '東', el: '나무', color: '#4f8fc0', look: '팔뚝만 한 푸른 용. 뭉툭한 뿔이 아직 말랑하다.',
    likes: ['lettuce', 'clover-leaf', 'dandelion', 'water-moss', 'creek-orchid'],
    trip: { common: ['clover-leaf', 'dandelion', 'lettuce', 'water-moss', 'creek-orchid', 'cherry-branch'], rare: ['clover'] } },
  baekho: { id: 'baekho', name: '백호', hanja: '虎', dir: '西', el: '쇠', color: '#d9d4c4', look: '고양이만 한 흰 새끼 호랑이. 이가 나는 중이라 뭐든 씹는다.',
    likes: ['sewer-rat', 'carp', 'nail', 'pebble'],
    trip: { common: ['pebble', 'stone', 'deer-tooth', 'raccoon-claw', 'boar-tusk'], rare: ['crystal'] } },
  jujak: { id: 'jujak', name: '주작', hanja: '雀', dir: '南', el: '불', color: '#d0533f', look: '주먹만 한 붉은 새. 깃털 끝마다 불씨가 맺혀 있다.',
    likes: ['snake-berry', 'wild-raspberry', 'charcoal', 'dokkaebi-flame'],
    trip: { common: ['snake-berry', 'wild-raspberry', 'charcoal', 'pheasant-feather', 'azalea'], rare: ['cinnabar'] } },
  hyeonmu: { id: 'hyeonmu', name: '현무', hanja: '武', dir: '北', el: '물', color: '#5d6b7d', look: '손바닥만 한 거북. 꼬리 대신 작은 검은 뱀이 달려 있다.',
    likes: ['water-moss', 'lake-water', 'carp', 'creek-orchid'],
    trip: { common: ['water-moss', 'lake-water', 'carp', 'pebble', 'loofah-fruit'], rare: ['pearl'] } },
  gumiho: { id: 'gumiho', name: '구미호', hanja: '狐', dir: '', el: '둔갑', color: '#e7c98a', look: '꼬리가 퐁실퐁실한 하얀 새끼 여우. 본 것은 뭐든 흉내 낸다.',
    likes: ['chestnut', 'acorn', 'sewer-rat', 'mushroom'],
    trip: { common: ['acorn', 'chestnut', 'mushroom', 'fox-fur', 'charm-scrap'], rare: ['gogok'] } },
}
export const KIND_IDS = Object.keys(KINDS)

/** 누구나 먹는 것(좋아하는 것이 아니어도 먹는다) */
export const FOODS = ['picnic', 'mushroom', 'acorn', 'chestnut', 'wild-raspberry', 'snake-berry', 'lettuce', 'carp', 'pine-nut', 'wild-grape', 'clover-leaf', 'dandelion', 'water-moss', 'sewer-rat', 'creek-orchid', 'lake-water', 'pebble', 'nail', 'charcoal', 'dokkaebi-flame']

export const STAGES = [
  { id: 0, name: '어린', need: 0 },
  { id: 1, name: '성장기', need: 450, reward: { money: 50, spirit: 30 } },
  { id: 2, name: '성수', need: 1000, reward: { money: 100, spirit: 50 } },
]
export const LAST = STAGES[STAGES.length - 1].id
/** 「어린 백호」 · 「성장기 백호」 · 「성수 백호」 */
export const stageLabel = (stageName, kind) => `${stageName} ${KINDS[kind]?.name ?? kind}`
export const MAX = 100
export const FULL_EVERY = 20 * 60e3 // 20분마다 배부름 -1
export const MOOD_EVERY = 30 * 60e3 // 30분마다 기분 -1
export const PET_CD = 60 * 60e3
export const PLAY_CD = 4 * 60 * 60e3
export const TRIPS = [
  { id: 'short', name: '가까운 숲', hours: 1, cost: 15, items: 2, bond: 5, rare: 0.05 },
  { id: 'mid', name: '산허리', hours: 3, cost: 25, items: 4, bond: 12, rare: 0.1 },
  { id: 'long', name: '먼 골짜기', hours: 8, cost: 40, items: 8, bond: 25, rare: 0.2 },
]
export const NAME_MAX = 4 // 한글만, 네 글자까지
export const NAME_RULE = /^[가-힣]{1,4}$/
export const NAME_NOTICE = '최초에 이름을 정하면 이름을 바꿀 수 없습니다. 확인하셨습니까?'

/** 받침에 맞춘 조사: josa('호돌이', '이', '가') → '가' */
export const josa = (word, a, b) => { const c = String(word || '').trim().slice(-1).charCodeAt(0); if (!(c >= 0xac00 && c <= 0xd7a3)) return b; const jong = (c - 0xac00) % 28; if (a === '으로') return jong === 0 || jong === 8 ? b : a; return jong ? a : b }
const clamp = (v) => Math.max(0, Math.min(MAX, Math.round(v)))
const dayKey = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10) // 한국 날짜

export const stageOf = (bond) => STAGES.reduce((s, x) => (bond >= x.need ? x : s), STAGES[0])
export const nextStage = (bond) => STAGES.find((x) => x.need > bond) || null

/** 시간이 지난 만큼 배부름 · 기분을 깎는다(새 객체). */
export function tick(b, now = Date.now()) {
  const at = b.at || now
  const fullDrop = Math.floor((now - at) / FULL_EVERY)
  const moodDrop = Math.floor((now - (b.atMood || at)) / MOOD_EVERY)
  if (fullDrop <= 0 && moodDrop <= 0) return b
  return {
    ...b,
    full: clamp((b.full ?? 80) - Math.max(0, fullDrop)), at: fullDrop > 0 ? at + fullDrop * FULL_EVERY : at,
    mood: clamp((b.mood ?? 80) - Math.max(0, moodDrop)), atMood: moodDrop > 0 ? (b.atMood || at) + moodDrop * MOOD_EVERY : (b.atMood || at),
  }
}

export function stateOf(p) {
  const s = p?.beasts
  return s && Array.isArray(s.list) ? s : { list: [], active: null, paid: {}, greet: '' }
}

/** 화면에 그릴 모습 */
export function view(p, now = Date.now()) {
  const s = stateOf(p)
  const list = s.list.map((raw) => {
    const b = tick(raw, now), k = KINDS[b.kind], st = stageOf(b.bond || 0), nx = nextStage(b.bond || 0)
    const trip = b.trip ? { ...b.trip, left: Math.max(0, b.trip.until - now), back: now >= b.trip.until, name: TRIPS.find((t) => t.id === b.trip.id)?.name || '' } : null
    return {
      id: b.id, kind: b.kind, kindName: k.name, hanja: k.hanja, color: k.color, look: k.look, dir: k.dir, el: k.el, name: b.name,
      full: b.full, mood: b.mood, bond: b.bond || 0, stage: st.id, stageName: st.name, label: stageLabel(st.name, b.kind), next: nx ? { name: nx.name, label: stageLabel(nx.name, b.kind), need: nx.need } : null,
      petLeft: Math.max(0, (b.pet || 0) + PET_CD - now), playLeft: Math.max(0, (b.play || 0) + PLAY_CD - now), trip,
      hungry: b.full <= 0, sulky: b.mood <= 0, active: s.active === b.id, likes: k.likes,
    }
  })
  const owned = new Set(s.list.map((b) => b.kind))
  const allGrown = s.list.every((b) => stageOf(b.bond || 0).id >= LAST)
  return { list, canAdopt: owned.size < KIND_IDS.length && allGrown, adoptable: KIND_IDS.filter((k) => !owned.has(k)).map((k) => ({ ...KINDS[k] })), greetToday: s.greet === dayKey(now) }
}

const cleanName = (n) => { const v = String(n || '').replace(/\s+/g, ''); return NAME_RULE.test(v) ? v : '' }

function withBeast(p, id, fn, now) {
  const s = stateOf(p)
  const i = s.list.findIndex((b) => b.id === id)
  if (i < 0) return { error: '그 아이를 찾지 못했다.' }
  const before = tick(s.list[i], now)
  const r = fn(before)
  if (r.error) return r
  const list = s.list.slice(); list[i] = r.b
  const out = { player: { ...p, beasts: { ...s, list } }, log: r.log, line: r.line, gain: r.gain || null, take: r.take || null, reward: null }
  // 단계를 처음 넘으면 보상
  const was = stageOf(before.bond || 0).id, now2 = stageOf(r.b.bond || 0)
  if (now2.id > was) {
    const paid = { ...(s.paid || {}) }, key = `${r.b.id}:${now2.id}`
    if (!paid[key]) { paid[key] = now; out.reward = now2.reward || null; out.player.beasts.paid = paid }
    out.grew = stageLabel(now2.name, r.b.kind)
  }
  return out
}

const gainBond = (b, n) => ((b.full <= 0 || b.mood <= 0) ? Math.ceil(n / 2) : n)

/** 맡기 */
export function adopt(p, kind, name, now = Date.now(), opt = {}) {
  const v = view(p, now)
  if (!KINDS[kind]) return { error: '그런 아이는 없다.' }
  if (v.list.length && !v.canAdopt && !opt.force) return { error: '지금 맡은 아이가 다 자라면(성수) 다른 아이를 맡을 수 있다.' }
  if (v.list.some((b) => b.kind === kind)) return { error: '이미 맡은 아이다.' }
  const nm = cleanName(name)
  if (!nm) return { error: `이름은 한글로 ${NAME_MAX}글자까지 지을 수 있다.` }
  const s = stateOf(p)
  const b = { id: `b${now.toString(36)}`, kind, name: nm, born: now, bond: 0, full: 80, mood: 80, at: now, atMood: now, pet: 0, play: 0, trip: null }
  return { player: { ...p, beasts: { ...s, list: [...s.list, b], active: s.active || b.id } }, log: `[신수들의 터] 어린 ${KINDS[kind].name}${josa(KINDS[kind].name, '을', '를')} 맡았다. 이름은 「${nm}」.`, line: LINES[kind].adopt(nm) }
}

// vD.06 이름은 한 번 정하면 바꾸지 않는다(이름 바꾸기 없앰)

export function setActive(p, id) {
  const s = stateOf(p)
  if (!s.list.some((b) => b.id === id)) return { error: '그 아이를 찾지 못했다.' }
  return { player: { ...p, beasts: { ...s, active: id } }, log: '', line: '이제 이 아이와 함께 다닌다.' }
}

/** 하루 첫 방문 인사(유대 +5) */
export function greet(p, now = Date.now()) {
  const s = stateOf(p)
  if (!s.list.length || s.greet === dayKey(now)) return null
  const id = s.active || s.list[0].id
  const r = withBeast(p, id, (b) => ({ b: { ...b, bond: (b.bond || 0) + gainBond(b, 5) }, log: `[신수들의 터] 「${b.name}」${josa(b.name, '이', '가')} 반갑게 달려왔다. 유대 +${gainBond(b, 5)}`, line: LINES[b.kind].greet(b.name) }), now)
  if (r.error) return null
  r.player.beasts = { ...r.player.beasts, greet: dayKey(now) }
  return r
}

export function feed(p, id, itemId, now = Date.now()) {
  return withBeast(p, id, (b) => {
    if (b.trip) return { error: '심부름을 나가 있다.' }
    const k = KINDS[b.kind], fav = k.likes.includes(itemId)
    if (!fav && !FOODS.includes(itemId)) return { error: '그건 먹지 않는다.' }
    if (b.full >= 95) return { error: `「${b.name}」${josa(b.name, '은', '는')} 배가 불러 고개를 돌린다.` }
    const up = fav ? 40 : 25, bond = gainBond(b, fav ? 8 : 3)
    return { b: { ...b, full: clamp(b.full + up), mood: clamp(b.mood + (fav ? 10 : 3)), bond: (b.bond || 0) + bond }, take: { [itemId]: 1 },
      log: `[신수들의 터] 「${b.name}」에게 먹이를 줬다. 배부름 +${up} · 유대 +${bond}`, line: fav ? LINES[b.kind].fav(b.name) : LINES[b.kind].eat(b.name) }
  }, now)
}

export function pet(p, id, now = Date.now()) {
  return withBeast(p, id, (b) => {
    if (b.trip) return { error: '심부름을 나가 있다.' }
    if ((b.pet || 0) + PET_CD > now) return { error: '방금 쓰다듬었다. 조금 뒤에.' }
    const bond = gainBond(b, 4)
    return { b: { ...b, mood: clamp(b.mood + 12), bond: (b.bond || 0) + bond, pet: now }, log: `[신수들의 터] 「${b.name}」${josa(b.name, '을', '를')} 쓰다듬었다. 기분 +12 · 유대 +${bond}`, line: LINES[b.kind].pet(b.name) }
  }, now)
}

export function play(p, id, now = Date.now()) {
  return withBeast(p, id, (b) => {
    if (b.trip) return { error: '심부름을 나가 있다.' }
    if ((b.play || 0) + PLAY_CD > now) return { error: '아직 지쳐 있다. 조금 쉬게 두자.' }
    if (b.full < 20) return { error: `「${b.name}」${josa(b.name, '은', '는')} 배가 고파 놀 기운이 없다. 먼저 먹이를.` }
    const bond = gainBond(b, 10)
    return { b: { ...b, mood: clamp(b.mood + 25), full: clamp(b.full - 10), bond: (b.bond || 0) + bond, play: now }, log: `[신수들의 터] 「${b.name}」${josa(b.name, '과', '와')} 놀아 줬다. 기분 +25 · 유대 +${bond}`, line: LINES[b.kind].play(b.name) }
  }, now)
}

export function sendTrip(p, id, tripId, now = Date.now()) {
  const t = TRIPS.find((x) => x.id === tripId)
  if (!t) return { error: '그런 길은 없다.' }
  return withBeast(p, id, (b) => {
    if (b.trip) return { error: '이미 심부름을 나가 있다.' }
    if (b.full < 30) return { error: `「${b.name}」${josa(b.name, '은', '는')} 배가 고파 멀리 못 간다. 배부름 30 이상이 필요하다.` }
    if (b.mood < 30) return { error: `「${b.name}」${josa(b.name, '은', '는')} 시무룩해서 나가기 싫어한다. 기분 30 이상이 필요하다.` }
    return { b: { ...b, full: clamp(b.full - t.cost), trip: { id: t.id, from: now, until: now + t.hours * 3600e3, mood: b.mood } },
      log: `[신수들의 터] 「${b.name}」${josa(b.name, '을', '를')} ${t.name}${josa(t.name, '으로', '로')} 심부름 보냈다. ${t.hours}시간 뒤에 돌아온다.`, line: LINES[b.kind].go(b.name) }
  }, now)
}

/** 심부름에서 돌아온 아이를 맞이한다. rnd: 시험용 난수 */
export function collectTrip(p, id, now = Date.now(), rnd = Math.random) {
  return withBeast(p, id, (b) => {
    if (!b.trip) return { error: '심부름을 나가 있지 않다.' }
    if (now < b.trip.until) return { error: '아직 돌아오지 않았다.' }
    const t = TRIPS.find((x) => x.id === b.trip.id) || TRIPS[0], k = KINDS[b.kind], st = stageOf(b.bond || 0).id
    const n = t.items + st + ((b.trip.mood ?? 0) >= 70 ? 1 : 0)
    const gain = {}
    for (let i = 0; i < n; i += 1) {
      const rare = rnd() < t.rare + st * 0.03
      const pool = rare ? k.trip.rare : k.trip.common
      const it = pool[Math.floor(rnd() * pool.length)]
      gain[it] = (gain[it] || 0) + 1
    }
    const bond = gainBond(b, t.bond)
    return { b: { ...b, trip: null, bond: (b.bond || 0) + bond }, gain,
      log: `[신수들의 터] 「${b.name}」${josa(b.name, '이', '가')} ${t.name}에서 돌아왔다. 유대 +${bond}`, line: LINES[b.kind].back(b.name) }
  }, now)
}

/** 신수마다 다른 반응 */
const L = (m) => m
export const LINES = {
  cheongnyong: L({
    adopt: (n) => `푸른 새끼 용이 당신의 손목에 몸을 감는다. 「${n}」. 머리 위의 작은 구름이 기쁜 듯 부슬비를 뿌린다.`,
    greet: (n) => `${n}${josa(n, '이', '가')} 작은 구름을 몰고 날아와 당신의 어깨에 내려앉는다.`,
    eat: (n) => `${n}${josa(n, '이', '가')} 먹이를 오물오물 씹는다. 구름이 잠깐 맑게 갠다.`,
    fav: (n) => `${n}${josa(n, '이', '가')} 눈을 반짝이며 단숨에 먹어 치운다. 머리 위에 작은 무지개가 걸렸다.`,
    pet: (n) => `말랑한 뿔 사이를 쓰다듬자 ${n}${josa(n, '이', '가')} 가르릉 대신 보슬비를 뿌린다.`,
    play: (n) => `${n}${josa(n, '이', '가')} 당신 주위를 빙글빙글 날며 물방울을 튀긴다. 둘 다 흠뻑 젖었다.`,
    go: (n) => `${n}${josa(n, '이', '가')} 구름을 타고 숲으로 날아간다.`,
    back: (n) => `${n}${josa(n, '이', '가')} 이슬에 젖은 채 돌아와 입에 문 것을 내려놓는다.`,
  }),
  baekho: L({
    adopt: (n) => `흰 새끼 호랑이가 당신의 신발 끈을 문다. 「${n}」. 놓으라고 해도 꼬리만 흔든다.`,
    greet: (n) => `${n}${josa(n, '이', '가')} 수풀에서 튀어나와 당신의 발목에 머리를 들이민다.`,
    eat: (n) => `${n}${josa(n, '이', '가')} 먹이를 와작와작 씹는다. 이가 근질거렸던 모양이다.`,
    fav: (n) => `${n}${josa(n, '이', '가')} 으르렁 소리를 내며 먹이에 달려든다. 다 먹고는 만족스럽게 앞발을 핥는다.`,
    pet: (n) => `턱 밑을 긁어 주자 ${n}${josa(n, '이', '가')} 벌러덩 드러누워 배를 보인다.`,
    play: (n) => `${n}${josa(n, '과', '와')} 나뭇가지로 줄다리기를 했다. 나뭇가지는 이빨 자국투성이가 되었다.`,
    go: (n) => `${n}${josa(n, '이', '가')} 낮게 엎드려 살금살금 숲으로 사라진다.`,
    back: (n) => `${n}${josa(n, '이', '가')} 의기양양하게 돌아와 물어 온 것을 당신 발치에 툭 떨어뜨린다.`,
  }),
  jujak: L({
    adopt: (n) => `붉은 새끼 새가 당신의 손바닥에 앉는다. 따뜻하다. 「${n}」. 깃털 끝의 불씨가 반짝인다.`,
    greet: (n) => `${n}${josa(n, '이', '가')} 불씨를 흩뿌리며 날아와 당신의 머리 위에서 맴돈다.`,
    eat: (n) => `${n}${josa(n, '이', '가')} 먹이를 콕콕 쪼아 먹는다. 불씨가 조금 밝아졌다.`,
    fav: (n) => `${n}${josa(n, '이', '가')} 기뻐서 날개를 퍼덕인다. 불씨가 폭죽처럼 튄다. 옷은 타지 않았다.`,
    pet: (n) => `머리를 쓰다듬자 ${n}${josa(n, '이', '가')} 눈을 가늘게 뜨고 따뜻한 숨을 내쉰다.`,
    play: (n) => `${n}${josa(n, '이', '가')} 당신이 던진 솔방울을 공중에서 낚아챈다. 솔방울에서 연기가 난다.`,
    go: (n) => `${n}${josa(n, '이', '가')} 한 줄기 불빛을 그리며 산 쪽으로 날아간다.`,
    back: (n) => `${n}${josa(n, '이', '가')} 노을빛을 묻히고 돌아와 물어 온 것을 내려놓는다.`,
  }),
  hyeonmu: L({
    adopt: (n) => `작은 거북은 등껍질 속에 숨어 있고, 꼬리의 뱀만 고개를 내밀어 당신을 본다. 「${n}」. 뱀이 혀를 날름거린다.`,
    greet: (n) => `${n}${josa(n, '이', '가')} 느릿느릿 걸어온다. 꼬리의 뱀이 먼저 당신에게 닿는다.`,
    eat: (n) => `${n}${josa(n, '이', '가')} 아주 천천히 먹이를 먹는다. 뱀은 옆에서 기다린다.`,
    fav: (n) => `${n}의 거북이 고개를 쑥 내민다. 좋아하는 것 앞에서는 겁도 잊는 모양이다.`,
    pet: (n) => `등껍질을 쓰다듬자 ${n}의 거북이 처음으로 고개를 끝까지 내민다.`,
    play: (n) => `${n}${josa(n, '과', '와')} 물가에서 조약돌 놓기 놀이를 했다. 뱀이 조약돌을 하나씩 밀어 준다.`,
    go: (n) => `${n}${josa(n, '이', '가')} 물길을 따라 천천히 떠난다. 뱀이 뒤를 돌아본다.`,
    back: (n) => `${n}${josa(n, '이', '가')} 물이끼를 등에 얹고 돌아와 뱀이 물어 온 것을 건넨다.`,
  }),
  gumiho: L({
    adopt: (n) => `하얀 새끼 여우가 당신의 얼굴로 둔갑했다가 재채기를 하며 돌아온다. 「${n}」. 꼬리 하나가 살랑인다.`,
    greet: (n) => `${n}${josa(n, '이', '가')} 당신의 모습으로 둔갑해 인사하다가 들켜서 여우로 돌아온다.`,
    eat: (n) => `${n}${josa(n, '이', '가')} 먹이를 물고 구석으로 가서 몰래 먹는다.`,
    fav: (n) => `${n}${josa(n, '이', '가')} 좋아서 꼬리를 흔들다가, 잠깐 꼬리가 두 개로 보였다. 착각일까.`,
    pet: (n) => `귀 뒤를 긁어 주자 ${n}${josa(n, '이', '가')} 눈을 감고 당신의 손에 머리를 기댄다.`,
    play: (n) => `${n}${josa(n, '이', '가')} 나뭇잎, 돌멩이, 연호수로 차례차례 둔갑하며 숨바꼭질을 했다. 연호수 둔갑이 제일 닮았다.`,
    go: (n) => `${n}${josa(n, '이', '가')} 나뭇잎 하나를 머리에 얹고 휙 사라진다.`,
    back: (n) => `${n}${josa(n, '이', '가')} 시치미를 뚝 떼고 돌아와, 어디서 났는지 모를 것들을 내려놓는다.`,
  }),
}
