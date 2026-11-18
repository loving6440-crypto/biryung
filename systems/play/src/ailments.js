// 비령 vC.06 — 몸의 이상(배드 스테이터스). 영능력이 거는 전투 안의 디버프(독 · 화상 …)와는 따로 논다.
//
// · 전투 · 개척 · 수련 같은 활동을 하다가 걸리고, 실제 시간으로 정해진 동안 남는다(player.ailments = { id: { until, stack } }).
// · 육조 스탯을 깎는 것(statCalc.effectiveStats 가 더한다)과, 혼자 하는 전투에서 라운드가 끝날 때마다 체력을 깎는 것이 있다.
//   라운드 피해로는 쓰러지지 않는다(체력 1에서 멈춘다).
// · 낫게 하는 물건(공작소 · 조리실): ① 완치  ② 완치 + 체력/의지력 회복  ③ 남은 시간을 5분으로 줄이기(두 가지씩).
//   가벼운 이상(simple) 둘을 한 번에 낫게 하는 물건도 셋 있다. 무거운 이상(heavy)을 둘 낫게 하는 물건은 없다.
// · 쇠약(지면 24시간, 모든 육조 스탯 5할)은 예전처럼 player.weakUntil 로 따로 센다 — [현재 상태] 칸에는 같이 보인다.
export const MIN = 60_000

export const AILMENTS = [
  { id: 'sadok', name: '사독', hanja: '蛇毒', heavy: true, max: 5, minutes: 40, round: 3,
    text: '뱀의 독이 핏줄을 따라 돈다.', effect: '혼자 하는 전투에서 라운드가 끝날 때마다 체력 −3 × 겹 (최대 5겹)',
    from: '구렁이 · 이무기 · 지네처럼 독을 품은 요괴에게 물리면 (먹구렁이 · 대망이 · 천년지네 · 삼두구미 · 강철이)' },
  { id: 'yeolsang', name: '열상', hanja: '裂傷', heavy: true, max: 3, minutes: 30, round: 2, stat: { agility: -1 },
    text: '발톱 · 이빨 자국이 벌어져 피가 멎지 않는다.', effect: '라운드가 끝날 때마다 체력 −2 × 겹 (최대 3겹) · 신속 −1',
    from: '짐승 요괴의 발톱 · 이빨 (둔갑쥐 떼 · 장산범 · 금돼지 · 구미호 · 노호승 · 불개 · 도올 · 도철)' },
  { id: 'hwasang', name: '화상', hanja: '火傷', heavy: false, max: 1, minutes: 20, round: 4,
    text: '불에 덴 자리가 화끈거린다.', effect: '라운드가 끝날 때마다 체력 −4',
    from: '불을 다루는 요괴 (등롱 여우불 · 야광귀 · 화마 · 지귀 · 무쇠 장승 · 한발 · 요화)' },
  { id: 'hangi', name: '한기', hanja: '寒氣', heavy: false, max: 1, minutes: 40, stat: { agility: -3, endurance: -2 },
    text: '뼛속까지 찬 기운이 스며 몸이 굳는다.', effect: '신속 −3 · 인내 −2',
    from: '개척 「호수」 · 「진달래 샘터길」의 물가, 산마루 · 능선의 찬 바람, 물 · 서리 기운의 요괴 (창귀 · 영노 · 거울귀)' },
  { id: 'gobul', name: '고뿔', hanja: '感氣', heavy: true, max: 1, minutes: 90, stat: { endurance: -3, comprehension: -3 },
    text: '콧물이 흐르고 머리가 멍하다.', effect: '인내 −3 · 이해 −3',
    from: '[한기]가 든 채로 물가 개척을 하거나 전투에 지면 고뿔로 번진다. 개척 「호수」 · 「진달래 샘터길」에서 물에 빠질 때' },
  { id: 'hyeongi', name: '현기', hanja: '眩氣', heavy: false, max: 1, minutes: 30, stat: { insight: -3, control: -2 },
    text: '눈앞이 빙빙 돌아 초점이 맞지 않는다.', effect: '안목 −3 · 절제 −2',
    from: '홀리는 요괴 (허깨비 · 이매망량 · 가위귀 · 여우누이 · 그슨새 · 혼돈 · 사범장의 그림자), 개척 「동굴」 · 높은 산마루와 능선' },
  { id: 'salgi', name: '살기', hanja: '煞氣', heavy: true, max: 1, minutes: 60, stat: { insight: -2, aggression: -2, endurance: -2, control: -2, agility: -2, comprehension: -2 },
    text: '죽은 것의 기운이 몸에 들러붙었다.', effect: '모든 육조 스탯 −2',
    from: '원귀 · 망령 (단지 원귀 · 달걀귀신 · 몽달귀신 · 객귀 떼 · 손각시 · 묘귀 · 촉루귀 · 무두귀 · 백귀행렬 · 백골장군), 개척 「묘소」' },
  { id: 'otdok', name: '옻독', hanja: '漆毒', heavy: false, max: 5, minutes: 60, round: 1, stat: { control: -1 },
    text: '풀독이 올라 살갗이 벌겋게 가렵다.', effect: '절제 −1 · 라운드가 끝날 때마다 체력 −1 × 겹 (최대 5겹)',
    from: '그 밖의 개척 터(오솔길 · 숲길 · 들길 · 계곡 · 고개 …)에서 풀숲을 헤치다가 (채집 · 수렵할 때 가끔)' },
  { id: 'gyundok', name: '균독', hanja: '菌毒', heavy: true, max: 1, minutes: 60, round: 2, stat: { comprehension: -3 },
    text: '곰팡이 포자를 들이마셔 속이 메스껍다.', effect: '이해 −3 · 라운드가 끝날 때마다 체력 −2',
    from: '역병 · 썩은 기운의 요괴 (저퀴 · 아귀 떼 · 역신 · 귀목 · 궁기), 개척 「동굴」 · 「묘소」의 습한 곳' },
  { id: 'geunyuk', name: '근육통', hanja: '筋肉痛', heavy: false, max: 1, minutes: 45, stat: { aggression: -2, agility: -2 },
    text: '어제 무리한 곳이 욱신거린다.', effect: '호전 −2 · 신속 −2',
    from: '수련을 마쳤을 때, 개척 행동을 끝까지 다 썼을 때, 다인 전투가 끝났을 때 (가끔)' },
]
export const AIL = Object.fromEntries(AILMENTS.map((a) => [a.id, a]))
export const WEAK_INFO = { id: 'weak', name: '쇠약', hanja: '衰弱', effect: '모든 육조 스탯이 5할로 줄어든다 (장비 보정은 그 뒤에 더한다)', from: '전투에서 지면 24시간', text: '몸이 축나 힘이 빠졌다.' }

// 적 → 걸리는 이상. 실습장 상대는 id 가 그대로라 이름이 바뀌어도 맞는다.
export const ENEMY_AILMENT = {
  snake: 'sadok', daemang: 'sadok', 'cheonnyeon-jine': 'sadok', samdugumi: 'sadok', gangcheol: 'sadok',
  'dungap-jwi': 'yeolsang', jangsanbeom: 'yeolsang', geumdwaeji: 'yeolsang', gumiho: 'yeolsang', 'noho-seung': 'yeolsang', bulgae: 'yeolsang', doul: 'yeolsang', docheol: 'yeolsang', 'udu-mamyeon': 'yeolsang', dueoksini: 'yeolsang', 'yacha-nachal': 'yeolsang', daein: 'yeolsang',
  foxfire: 'hwasang', yagwanggwi: 'hwasang', hwama: 'hwasang', jigwi: 'hwasang', bulgasari: 'hwasang', hanbal: 'hwasang', yohwa: 'hwasang', mongdangbi: 'hwasang', 'kim-seobang': 'hwasang',
  changgwi: 'hangi', yeongno: 'hangi', 'geoul-gwi': 'hangi', gildal: 'hangi',
  heokkaebi: 'hyeongi', 'imae-mangryang': 'hyeongi', 'gawi-gwi': 'hyeongi', 'yeou-nui': 'hyeongi', geuseunsae: 'hyeongi', hondon: 'hyeongi', geuseundae: 'hyeongi', cheonma: 'hyeongi', scarecrow: 'hyeongi', 'mangtae-halabeom': 'hyeongi',
  wonhon: 'salgi', 'dalgyal-gwisin': 'salgi', 'mongdal-gwisin': 'salgi', gaekgwi: 'salgi', songaksi: 'salgi', myogwi: 'salgi', 'chokru-gwi': 'salgi', 'mudu-gwi': 'salgi', baekgwi: 'salgi', 'baekgol-janggun': 'salgi', 'dokgak-gwi': 'salgi',
  jeokwi: 'gyundok', agwi: 'gyundok', yeoksin: 'gyundok', gwimok: 'gyundok', gunggi: 'gyundok', 'jihaguk-daejeok': 'gyundok',
}
// 개척 터 → 채집 · 수렵할 때 가끔 걸리는 이상 [id, 한 번에 걸릴 확률(%)]
export function siteAilment(site) {
  const id = String(site?.id ?? ''), name = String(site?.name ?? '')
  // vD.02.3 너무 자주 걸려서 대략 절반으로
  if (/lake|호수|샘터/.test(id + name)) return [['hangi', 3], ['gobul', 1]]
  if (/cave|동굴/.test(id + name)) return [['hyeongi', 2], ['gyundok', 1.5]]
  if (/tomb|grave|묘소/.test(id + name)) return [['salgi', 1.5], ['gyundok', 1]]
  if (/산마루|봉우리|능선|summit|peak/.test(id + name)) return [['hyeongi', 1.5], ['hangi', 1]]
  return [['otdok', 2]] // 숲길 · 들길 · 오솔길
}

const clampStack = (a, n) => Math.max(1, Math.min(a.max, n))
/** 지금 걸려 있는 이상 목록 [{ id, def, stack, until, left(ms) }] (끝난 것은 뺀다) */
export function activeAilments(player, now = Date.now()) {
  return Object.entries(player?.ailments ?? {})
    .filter(([id, v]) => AIL[id] && v && v.until > now)
    .map(([id, v]) => ({ id, def: AIL[id], stack: clampStack(AIL[id], v.stack || 1), until: v.until, left: v.until - now }))
    .sort((a, b) => AILMENTS.indexOf(a.def) - AILMENTS.indexOf(b.def))
}
/** 육조 스탯 보정(음수) { stat: -n } */
export function ailmentStatBonus(player, now = Date.now()) {
  const out = {}
  for (const a of activeAilments(player, now)) for (const [k, v] of Object.entries(a.def.stat ?? {})) out[k] = (out[k] || 0) + v
  return out
}
/** 걸린다(이미 있으면 겹을 쌓고 시간을 처음부터). 반환: 새 player (바뀌지 않으면 그대로) */
export function addAilment(player, id, now = Date.now(), stack = 1) {
  const def = AIL[id]
  if (!def || !player) return player
  if ((player.ailGuard?.[id] || 0) > now) return player // vD.02 양호실 물품: 낫고 나서 잠시 다시 걸리지 않는다
  const cur = player.ailments?.[id]
  const live = cur && cur.until > now
  const next = { until: now + def.minutes * MIN, stack: clampStack(def, (live ? cur.stack || 1 : 0) + stack) }
  return { ...player, ailments: { ...prune(player.ailments, now), [id]: next } }
}
function prune(map, now) { return Object.fromEntries(Object.entries(map ?? {}).filter(([, v]) => v && v.until > now)) }
export function cureAilments(player, ids, now = Date.now()) {
  const m = prune(player?.ailments, now)
  const had = ids.filter((id) => m[id])
  for (const id of ids) delete m[id]
  return { player: { ...player, ailments: m }, cured: had }
}
export function shortenAilments(player, ids, toMs = 5 * MIN, now = Date.now()) {
  const m = prune(player?.ailments, now)
  const hit = []
  for (const id of ids) if (m[id]) { if (m[id].until > now + toMs) m[id] = { ...m[id], until: now + toMs }; hit.push(id) }
  return { player: { ...player, ailments: m }, hit }
}
export const ailLabel = (id) => `[${AIL[id]?.name ?? id}]`
export const leftText = (ms) => { const m = Math.max(1, Math.ceil(ms / MIN)); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분` }

// ── 혼자 하는 전투: 라운드가 끝날 때의 피해. battle.js 가 부른다(patches.mjs). 실행 화면이 지금의 player 를 알려 준다. ──
let source = null
export function setAilmentSource(fn) { source = typeof fn === 'function' ? fn : null }
export function ailmentRoundTicks(now = Date.now()) {
  const p = source?.()
  if (!p) return []
  return activeAilments(p, now).filter((a) => a.def.round).map((a) => ({ id: a.id, dmg: a.def.round * a.stack, text: `[${a.def.name}${a.def.max > 1 ? ` ${a.stack}겹` : ''}] ${a.def.text}` }))
}
export function ailmentStatSource(player, now = Date.now()) { return ailmentStatBonus(player, now) }

// ── 걸리는 때 ──
// vD.02.3 완화: 전투 뒤 — 지면 40% · 이겨도 체력 4할 밑 18% · 7할 밑 6% · 그 위 2% (무거운 이상 — 살기 · 고뿔 · 균독 — 은 그 6할)
export function battleAilChance(fam, lost, hpFrac) {
  const base = lost ? 0.4 : hpFrac < 0.4 ? 0.18 : hpFrac < 0.7 ? 0.06 : 0.02
  return AIL[fam]?.heavy ? base * 0.6 : base
}
/** 표(배드 스테이터스 시트)에 적을 걸릴 확률 글 */
export function chanceText(id) {
  const pct = (x) => `${Math.round(x * 1000) / 10}%`
  const fromEnemy = Object.values(ENEMY_AILMENT).includes(id)
  const bits = []
  if (fromEnemy) bits.push(`그 상대와 싸운 뒤: 지면 ${pct(battleAilChance(id, true, 0))} · 체력 4할 밑 ${pct(battleAilChance(id, false, 0.3))} · 7할 밑 ${pct(battleAilChance(id, false, 0.5))} · 그 위 ${pct(battleAilChance(id, false, 1))}`)
  const sites = [['호수 · 진달래 샘터길', 'lake'], ['동굴', 'cave'], ['묘소', 'tomb'], ['산마루 · 능선', 'summit'], ['그 밖의 터', 'trail']]
  for (const [label, key] of sites) { const hit = siteAilment({ id: key }).find(([x]) => x === id); if (hit) bits.push(`개척 ${label}: 채집 · 수렵 한 번에 ${hit[1]}%`) }
  if (id === 'gobul') bits.push('[한기] 든 채로 지면 30% · 호수에서 [한기] 든 채로 채집하면 +6%')
  if (id === 'geunyuk') bits.push('수련을 마칠 때 12% · 개척 행동을 끝까지 다 썼을 때 12%')
  return bits.join(' / ')
}
/** 전투가 끝났다(혼자 · 개척 전투). lost: 졌나, hpFrac: 끝난 뒤 체력 비율. 반환 { player, got: [id] } */
export function afterBattleAilment(player, enemy, { lost = false, hpFrac = 1 } = {}, rng = Math.random, now = Date.now()) {
  let p = player
  const got = []
  // vD.02.3 이름에 「귀 · 혼 · 령」만 들어가도 살기를 걸던 것을 뺐다(살기가 너무 잦았다) — 표에 적힌 상대만 건다
  const fam = ENEMY_AILMENT[enemy?.id] ?? null
  if (fam) {
    const chance = battleAilChance(fam, lost, hpFrac)
    if (rng() < chance) { const st = AIL[fam].max > 1 ? (lost ? 2 : 1) : 1; p = addAilment(p, fam, now, st); got.push(fam) }
  }
  if (lost && p.ailments?.hangi?.until > now && rng() < 0.3) { p = addAilment(p, 'gobul', now); got.push('gobul') }
  return { player: p, got }
}
/** 개척에서 채집 · 수렵을 한 번 했다 */
export function huntAilment(player, site, { finished = false } = {}, rng = Math.random, now = Date.now()) {
  let p = player
  const got = []
  for (const [id, pct] of siteAilment(site)) {
    let c = pct
    if (id === 'gobul' && p.ailments?.hangi?.until > now) c += 6
    if (rng() * 100 < c) { p = addAilment(p, id, now); got.push(id) }
  }
  if (finished && rng() < 0.12) { p = addAilment(p, 'geunyuk', now); got.push('geunyuk') }
  return { player: p, got }
}
/** 수련을 마쳤다 · 다인 전투가 끝났다 */
export function effortAilment(player, chance = 0.12, rng = Math.random, now = Date.now()) {
  if (rng() >= chance) return { player, got: [] }
  return { player: addAilment(player, 'geunyuk', now), got: ['geunyuk'] }
}
export const gotText = (got, p, now = Date.now()) => got.map((id) => { const a = p.ailments?.[id]; const d = AIL[id]; return `몸에 이상이 생겼다: [${d.name}]${d.max > 1 && a ? ` ${a.stack}겹` : ''} — ${d.effect} (${leftText((a?.until ?? now) - now)})` })

// ── 낫게 하는 물건 ──
// cure: 완치 / hp · mp: 같이 차는 양 / shorten: 남은 시간을 5분으로
const ITEM = (id, name, place, inputs, effect, desc) => ({ id, name, place, inputs, effect, desc })
const RAW = [
  // 사독
  ITEM('ail-snake-pill', '감초 해독환', 'K', [['licorice', 1], ['mugwort', 2], ['snake-skin', 1]], { cure: ['sadok'] }, '감초와 쑥을 뱀 허물과 함께 볶아 빻은 환. 독은 독으로 다스린다는 옛 처방.'),
  ITEM('ail-snake-tang', '백사 해독탕', 'K', [['herb-decoction', 1], ['licorice', 1], ['snake-skin', 1]], { cure: ['sadok'], hp: 30 }, '약재 달임물에 뱀 허물을 넣어 다시 고았다. 쓴맛 뒤에 기운이 돈다.'),
  // 열상
  ITEM('ail-wound-salve', '쑥 고약', 'W', [['mugwort', 2], ['soybean-oil', 1], ['cloth-scrap', 1]], { cure: ['yeolsang'] }, '쑥을 콩기름에 개어 천 조각에 펴 바른 고약. 벌어진 상처를 붙인다.'),
  ITEM('ail-wound-wrap', '약초 붕대', 'W', [['bandage', 1], ['herb-decoction', 1]], { cure: ['yeolsang'], hp: 25 }, '붕대를 약재 달임물에 적셨다. 감아 두면 피가 멎고 살이 차오른다.'),
  // 화상
  ITEM('ail-burn-gel', '수세미 화상즙', 'K', [['loofah-fruit', 1], ['lake-water', 1]], { cure: ['hwasang'] }, '수세미 열매를 청화물에 짓찧어 거른 끈적한 즙. 덴 자리에 바르면 열이 빠진다.'),
  ITEM('ail-burn-tea', '민들레 냉차', 'K', [['dandelion', 2], ['lake-water', 1], ['sugar', 1]], { cure: ['hwasang'], mp: 20 }, '민들레를 우려 찬 청화물에 식힌 차. 속의 열까지 내린다.'),
  // 한기
  ITEM('ail-cold-pack', '콩 찜질 주머니', 'W', [['soybean', 3], ['cloth-scrap', 1]], { cure: ['hangi'] }, '볶은 콩을 천 주머니에 담았다. 데워서 품으면 굳은 몸이 풀린다.'),
  ITEM('ail-warm-soup', '칡 쌍화탕', 'K', [['arrowroot', 1], ['herb-decoction', 1], ['chestnut-syrup', 1]], { cure: ['hangi'], hp: 20 }, '칡뿌리와 약재를 밤 조청으로 달인 따뜻한 탕.'),
  // 고뿔
  ITEM('ail-cough-pill', '도라지 고뿔환', 'K', [['doraji', 2], ['licorice', 1], ['sugar', 1]], { cure: ['gobul'] }, '도라지와 감초를 설탕에 졸여 빚은 환. 목이 트이고 콧물이 멎는다.'),
  ITEM('ail-cough-tea', '도라지 오미자차', 'K', [['doraji', 1], ['nw-omija-syrup', 1], ['lake-water', 1]], { cure: ['gobul'], mp: 25 }, '도라지를 오미자청에 우렸다. 다섯 맛이 머리를 맑게 한다.'),
  // 현기
  ITEM('ail-dizzy-tea', '솔방울 맑은차', 'K', [['pinecone', 2], ['lake-water', 1]], { cure: ['hyeongi'] }, '솔방울을 청화물에 우린 차. 솔 향이 빙빙 도는 머리를 붙잡아 준다.'),
  ITEM('ail-dizzy-candy', '잣 감초엿', 'K', [['licorice', 1], ['sugar', 2], ['nw-pine-oil', 1]], { cure: ['hyeongi'], mp: 20 }, '감초를 넣어 고은 엿에 잣기름을 둘렀다. 하나 물면 눈앞이 또렷해진다.'),
  // 살기
  ITEM('ail-purge-charm', '살풀이 부적', 'W', [['hanji', 1], ['talisman-ink', 1], ['cinnabar', 1]], { cure: ['salgi'] }, '주사를 섞은 먹으로 살풀이 글자를 쓴 부적. 태우면 들러붙은 기운이 떨어진다.'),
  ITEM('ail-purge-cord', '살풀이 오색끈', 'W', [['five-color-thread', 1], ['nw-cinnabar-ink', 1], ['mugwort', 1]], { cure: ['salgi'], mp: 30 }, '오색실을 주묵에 적셔 쑥과 함께 꼬았다. 손목에 감으면 마음이 제자리로 돌아온다.'),
  // 옻독
  ITEM('ail-itch-wash', '쑥물 씻김물', 'K', [['mugwort', 2], ['lake-water', 1]], { cure: ['otdok'] }, '쑥을 진하게 우린 물. 가려운 살갗을 씻어 내면 붉은 기가 가라앉는다.'),
  ITEM('ail-itch-balm', '감초 물이끼 연고', 'W', [['licorice', 1], ['soybean-oil', 1], ['water-moss', 1]], { cure: ['otdok'], hp: 15 }, '감초 가루와 물이끼를 콩기름에 갠 연고. 시원하고 미끈하다.'),
  // 균독
  ITEM('ail-fungus-ash', '숯가루 해독제', 'W', [['charcoal', 1], ['lake-water', 1], ['licorice', 1]], { cure: ['gyundok'] }, '숯을 곱게 빻아 감초물에 갠 해독제. 속에 든 포자를 빨아들인다.'),
  ITEM('ail-fungus-porridge', '감초 흰죽', 'K', [['rice', 1], ['licorice', 1], ['herb-decoction', 1]], { cure: ['gyundok'], hp: 30 }, '쌀을 약재 달임물에 오래 끓인 흰죽. 메스꺼운 속을 달래고 기운을 채운다.'),
  // 근육통
  ITEM('ail-moxa', '쑥뜸', 'W', [['mugwort', 3], ['charcoal', 1]], { cure: ['geunyuk'] }, '쑥을 뭉쳐 숯불로 뜸을 뜬다. 욱신거리던 자리가 노곤하게 풀린다.'),
  ITEM('ail-dangwi-soup', '당귀 근육탕', 'K', [['dangwi', 1], ['herb-decoction', 1]], { cure: ['geunyuk'], hp: 20 }, '당귀를 약재 달임물에 고았다. 뭉친 근육 사이로 피가 다시 돈다.'),
  // 가벼운 이상 둘을 한 번에
  ITEM('ail-two-loofah', '수세미 감초 연고', 'W', [['loofah-fruit', 1], ['licorice', 1], ['soybean-oil', 1]], { cure: ['hwasang', 'otdok'] }, '수세미 즙과 감초를 콩기름에 갰다. 덴 곳에도 풀독 오른 곳에도 바른다.'),
  ITEM('ail-two-steam', '숯불 콩찜질', 'W', [['soybean', 2], ['cloth-scrap', 1], ['charcoal', 1]], { cure: ['hangi', 'geunyuk'] }, '숯불에 데운 콩 주머니. 찬 기운과 뭉친 근육을 함께 녹인다.'),
  ITEM('ail-two-omija', '오미자 온차', 'K', [['nw-omija-syrup', 1], ['lake-water', 1]], { cure: ['hangi', 'hyeongi'] }, '오미자청을 따뜻한 청화물에 풀었다. 몸이 데워지고 눈앞이 맑아진다.'),
  // 남은 시간 줄이기(두 가지씩)
  ITEM('ail-short-needle', '응급 사혈침', 'W', [['nail', 1], ['mugwort', 1]], { shorten: ['sadok', 'gyundok'] }, '못을 쑥불에 달궈 만든 침. 나쁜 피를 조금 빼내면 독이 빨리 빠진다.'),
  ITEM('ail-short-bind', '천 동여매기', 'W', [['cloth-scrap', 2]], { shorten: ['yeolsang', 'geunyuk'] }, '자투리 천을 길게 찢어 꽉 동여맸다. 임시방편이지만 꽤 듣는다.'),
  ITEM('ail-short-towel', '청화물 찬 수건', 'W', [['cloth-scrap', 1], ['lake-water', 1]], { shorten: ['hwasang', 'otdok'] }, '찬 청화물에 적신 천. 화끈거리고 가려운 데에 얹어 둔다.'),
  ITEM('ail-short-warmer', '숯 손난로', 'W', [['small-pot', 1], ['charcoal', 1]], { shorten: ['hangi', 'gobul'] }, '작은 항아리에 숯불을 담아 손에 쥐는 난로.'),
  ITEM('ail-short-burn', '부적 조각 태우기', 'W', [['charm-scrap', 2], ['hanji', 1]], { shorten: ['hyeongi', 'salgi'] }, '못 쓰게 된 부적 조각을 한지에 싸서 태운다. 연기를 쐬면 정신이 돌아온다.'),
]
const effText = (e) => [
  e.cure ? `${e.cure.map(ailLabel).join(' · ')} 완치` : '',
  e.shorten ? `${e.shorten.map(ailLabel).join(' · ')} 남은 시간이 5분으로 줄어든다` : '',
  e.hp ? `체력 +${e.hp}` : '', e.mp ? `의지력 +${e.mp}` : '',
].filter(Boolean).join(' · ')
/** 아이템 표(items.js 의 ITEMS 뒤에 붙는다 — patches.mjs) */
const PIX = {"ail-snake-pill": {"t": "pill", "p": "green"}, "ail-snake-tang": {"t": "stew", "p": "dgreen"}, "ail-wound-salve": {"t": "jar", "p": "green"}, "ail-wound-wrap": {"t": "patch", "p": "cream"}, "ail-burn-gel": {"t": "drop", "p": "lime"}, "ail-burn-tea": {"t": "cup", "p": "yellow"}, "ail-cold-pack": {"t": "pouch", "p": "tan"}, "ail-warm-soup": {"t": "bowl", "p": "brown"}, "ail-cough-pill": {"t": "pill", "p": "white"}, "ail-cough-tea": {"t": "cup", "p": "red"}, "ail-dizzy-tea": {"t": "cup", "p": "jade"}, "ail-dizzy-candy": {"t": "candy", "p": "gold"}, "ail-purge-charm": {"t": "talisman", "p": "red"}, "ail-purge-cord": {"t": "knot", "p": "crimson"}, "ail-itch-wash": {"t": "bottle", "p": "green"}, "ail-itch-balm": {"t": "jar", "p": "jade"}, "ail-fungus-ash": {"t": "powder", "p": "black"}, "ail-fungus-porridge": {"t": "porridge", "p": "rice"}, "ail-moxa": {"t": "smoke", "p": "gray"}, "ail-dangwi-soup": {"t": "stew", "p": "brown"}, "ail-two-loofah": {"t": "jar", "p": "lime"}, "ail-two-steam": {"t": "pouch", "p": "ember"}, "ail-two-omija": {"t": "cup", "p": "pink"}, "ail-short-needle": {"t": "stake", "p": "gray"}, "ail-short-bind": {"t": "cloth", "p": "white"}, "ail-short-towel": {"t": "cloth", "p": "sky"}, "ail-short-warmer": {"t": "pot", "p": "ember"}, "ail-short-burn": {"t": "flame", "p": "orange"}}
export const AIL_ITEMS_CRAFT = RAW.map((r) => ({
  pixel: PIX[r.id], id: r.id, kind: 'craft', name: r.name, price: null, desc: r.desc, tags: ['완성품', '#몸의 이상'], effectText: `${effText(r.effect)} (전투 밖에서)`,
  effect: { ...(r.effect.cure ? { cureAil: r.effect.cure } : {}), ...(r.effect.shorten ? { shortenAil: r.effect.shorten } : {}), ...(r.effect.hp ? { hp: r.effect.hp } : {}), ...(r.effect.mp ? { mp: r.effect.mp } : {}) },
  battle: false, party: false,
}))
// ── vD.02 양호실에서 파는 물품: 몸의 이상 하나를 낫게 하고, 그 이상에 20분 동안 다시 걸리지 않는다(제작품과 다른 점) ──
export const NURSE_GUARD_MIN = 20
const NURSE_RAW = [
  ['nurse-antivenom', '해독 앰플', 'sadok', 40, '작은 유리 앰플에 든 해독제. 양호 선생님이 금역 실습 철마다 상자째 들여 놓는다.', { t: 'bottle', p: 'green' }],
  ['nurse-gauze', '멸균 거즈 세트', 'yeolsang', 35, '소독약 묻힌 거즈와 반창고 한 벌. 찢어진 자리를 덮고 꾹 누르면 된다.', { t: 'patch', p: 'white' }],
  ['nurse-burn-band', '화상 밴드', 'hwasang', 30, '물기 머금은 젤이 발린 밴드. 덴 자리에 붙이면 열이 금세 빠진다.', { t: 'patch', p: 'sky' }],
  ['nurse-hotpack', '핫팩', 'hangi', 25, '흔들면 따뜻해지는 주머니. 품에 넣어 두면 찬 기운이 스르르 녹는다.', { t: 'pouch', p: 'ember' }],
  ['nurse-cold-medicine', '종합 감기약', 'gobul', 35, '하얀 알약 두 알. 먹고 한숨 자면 콧물이 멎는다고 봉투에 적혀 있다.', { t: 'pill', p: 'white' }],
  ['nurse-glucose', '포도당 캔디', 'hyeongi', 25, '네모난 하얀 사탕. 핑 도는 머리에는 단것이 먼저라는 양호실의 지론.', { t: 'candy', p: 'white' }],
  ['nurse-salt-pouch', '정화 소금 봉투', 'salgi', 40, '양호실 서랍 맨 아래 칸의 굵은 소금 봉투. 이 학교 양호실에는 이런 것도 있다.', { t: 'pouch', p: 'white' }],
  ['nurse-itch-cream', '가려움 연고', 'otdok', 30, '박하 향이 나는 하얀 연고. 바르는 순간 가려움이 시원함으로 바뀐다.', { t: 'jar', p: 'sky' }],
  ['nurse-charcoal-tab', '활성탄 정제', 'gyundok', 40, '까만 알약. 속에 든 포자를 붙잡아 내보낸다. 혀가 잠깐 까매진다.', { t: 'pill', p: 'black' }],
  ['nurse-pain-patch', '파스', 'geunyuk', 30, '화한 냄새가 방 안에 퍼지는 파스. 뭉친 근육 위에 붙인다.', { t: 'patch', p: 'cream' }],
]
export const NURSE_ITEMS = NURSE_RAW.map(([id, name, ail, price, desc, pixel]) => ({
  pixel, id, kind: 'consumable', name, price, storeOnly: 'infirmary', desc, tags: ['#몸의 이상', '#양호실'],
  effectText: `${ailLabel(ail)} 완치 · ${NURSE_GUARD_MIN}분 동안 ${ailLabel(ail)}에 다시 걸리지 않는다 (전투 밖에서)`,
  effect: { cureAil: [ail], ailGuard: [ail] }, battle: false, party: false,
}))
// vD.02.1 전투 중에도 쓰는 응급 처치 상자: 걸려 있는 나쁜 상태(전투 중 상태 이상 · 저주 · 속박 · 몸의 이상 10종) 가운데 하나를 골라 푼다
export const FIRST_AID = {
  pixel: { t: 'box', p: 'crimson' }, id: 'nurse-firstaid', kind: 'consumable', name: '응급 처치 상자', price: 150, storeOnly: 'infirmary',
  desc: '양호실 선반 맨 위에 둔 빨간 상자. 실습 중에 다친 학생이 생기면 선생님이 이걸 들고 뛰어간다. 무엇이든 하나는 손볼 수 있다.',
  tags: ['#몸의 이상', '#양호실', '전투 중 사용 가능', '#턴소모無'], effectText: '걸려 있는 나쁜 상태 하나를 골라 푼다 — 전투 중 상태 이상 · 저주 · 속박 · 몸의 이상 (전투 중에도 쓸 수 있다)',
  effect: { cureOneBs: true }, battle: true, party: false,
}
/** 양호실 진열대: 몸의 이상 10종의 기본 물품 + 응급 처치 상자 + 쇠약 전용 영양제(비싸다) */
export const NURSE_STOCK = [...NURSE_ITEMS.map((i) => ({ id: i.id, price: i.price })), { id: FIRST_AID.id, price: FIRST_AID.price }, { id: 'nutrient', price: 600 }]
export const AIL_ITEMS = [...AIL_ITEMS_CRAFT, ...NURSE_ITEMS, FIRST_AID]
/** 제작법(공작소 W · 조리실 K). 완치 · 시간 줄이기는 1단계, 완치 + 회복(1~2단계 완성품을 하나 더 넣는다)은 2단계 */
export const AIL_RECIPES = RAW.map((r) => ({
  place: r.place, id: `ail-r-${r.id.slice(4)}`, result: r.id, inputs: r.inputs,
  tier: r.effect.hp || r.effect.mp ? 2 : 1,
}))
/** 이상 하나를 다스리는 물건들 { cure: [], restore: [], shorten: [] } (시트 · 도감용) */
export function curesFor(id) {
  const out = { cure: [], restore: [], shorten: [] }
  for (const r of RAW) {
    if (r.effect.cure?.includes(id)) (r.effect.hp || r.effect.mp ? out.restore : out.cure).push(r.name)
    if (r.effect.shorten?.includes(id)) out.shorten.push(r.name)
  }
  return out
}
