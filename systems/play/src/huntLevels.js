// 비령 vC.06 — 개척 터: 레벨을 육조 스탯 만렙 40 기준으로 다시 맞추고, 이름 · 설명 · 보이는 순서를 고친다.
//
// 레벨
//  · 예전 표는 육조 스탯 만렙 50(+보정 10 = 60)을 기준으로 적혀 있었다(산길 20 = 관련 스탯 평균 60).
//  · 추가전투의 권장 스탯(4 · 8 · 12 · 16 · 20 · 25 · 30 · 36 · 43 · 50)과 같은 곡선으로 줄인다.
//    관련 스탯 평균 19 까지(산길 1~4 · 호수 · 동굴 · 산길 5~10 언저리)는 그대로 두고, 그 위만 눌러 담는다:
//      19 → 19 · 29.5 → 25 · 39.5 → 30 · 46 → 36 · 50 → 43 · 60 → 50
//    그래서 산길 20(구름 위 산마루)은 만렙 40 + 보정 10 = 50 에서 수월하다(추가전투 10단계와 같은 자리).
//  · 칸 레벨은 두 스탯의 합(≈ 평균 × 2), 영물 레벨은 여섯 스탯의 합(≈ 평균 × 6)과 견주므로 같은 곡선을 2배 · 6배로 쓴다.
//  · 아이템의 적정 레벨 · 제작법의 레벨은 materialLevels.js 가 칸 레벨에서 바로 계산하므로 저절로 함께 내려간다.
//
// 이름 · 설명: 산길 5~20 은 지금 붙어 있던 이름(도토리 숲길 · 칡덩굴 비탈 …)을 그대로 터 이름으로 쓴다. 산길 1~4 · 호수 · 묘소 · 동굴은 새로 붙였다.
// 순서: 개척 터 단추는 수월한 스탯(관련 스탯 평균)이 낮은 순서로 늘어선다.

import { HUNT_EXTRA } from '../../biryeong/reskin.data.js'

const PTS = [[0, 0], [19, 19], [29.5, 25], [39.5, 30], [46, 36], [50, 43], [60, 50], [100, 80]]
/** 관련 스탯 평균(만렙 50 기준) → 만렙 40 기준 */
export function remapS(x) {
  const v = Number(x)
  if (!Number.isFinite(v)) return x
  for (let i = 1; i < PTS.length; i++) {
    const [a, fa] = PTS[i - 1], [b, fb] = PTS[i]
    if (v <= b) return fa + ((v - a) * (fb - fa)) / (b - a)
  }
  return v * 0.8
}
export const remapNode = (level) => Math.max(1, Math.round(remapS(level / 2) * 2))
export const remapSpirit = (level) => Math.max(1, Math.round(remapS(level / 6) * 6))

// 새 이름 · 설명. (산길 5~20 은 theme 이 이름이 되고, 설명은 그대로 둔다 — 설명 속 '산길 N' 만 새 이름으로 바꾼다)
export const SITE_TEXT = {
  'left-trail-1': { name: '뱀딸기 오솔길', note: '산문 바로 뒤로 이어지는 첫 오솔길. 뱀딸기와 버섯이 길섶에 깔려 있고, 돌기둥 사이로 뱀이 똬리를 튼다. 덤불 너머 너구리가 빙빙 돈다.' },
  'left-trail-2': { name: '민들레 들길', note: '햇볕 잘 드는 들길. 민들레와 토끼풀이 흐드러지고, 사슴과 비둘기가 풀밭을 오간다. 그늘진 끝자락에 왕버섯이 하나 숨어 있다.' },
  'left-trail-3': { name: '진달래 샘터길', note: '옛 우물 두 개가 남은 비탈. 진달래와 고사리가 우거졌고 토끼가 덤불 사이를 쏘다닌다. 오른쪽 위 끝에 산삼이 있다.' },
  'left-trail-4': { name: '솟대 소나무길', note: '솟대가 줄지어 선 소나무 길. 멧돼지가 위쪽을 헤집고, 여우가 오른쪽 덤불을 S자로 오간다. 버드나무 그늘에 네잎클로버가 난다.' },
  'left-lake': { name: '호수', note: '산 중턱의 고요한 호수. 잉어가 물가를 따라 헤엄치고, 물가 제단과 이끼 낀 바위에서 물건이 나온다. 샘물은 언제 떠도 맑다.' },
  'left-cemetery': { name: '묘소', note: '석등과 돌탑이 줄지어 선 옛 묘역. 한가운데 석관과 비석이 있고, 쥐 떼가 무덤 사이를 길게 돈다. 해가 지면 혼령나비가 떠오른다.' },
  'left-cave': { name: '동굴', note: '산허리에 뚫린 깊은 굴. 수정 기둥과 종유석 사이로 박쥐가 위아래로 날고, 동물 뼈가 흩어져 있다. 맨 안쪽 별 제단은 아무도 손대지 않았다.' },
}
const DONE = Symbol.for('biryeong.huntLevels')

/** 터 하나가 수월한 관련 스탯 평균(정렬 · 안내용). 산길 5~20 은 표에 적힌 값, 나머지는 칸 레벨의 가운데 값 ÷ 2 */
function siteS(site) {
  if (Number.isFinite(site.targetStat)) return site.targetStat
  const ls = (site.nodes ?? []).map((n) => n.level).filter(Number.isFinite).sort((a, b) => a - b)
  if (!ls.length) return 0
  return Math.round(ls[Math.floor(ls.length / 2)] / 2)
}

/**
 * HUNT_SITES · HUNT_PATHS 를 그 자리에서 고친다(두 번 불러도 한 번만).
 * huntSites.js 끝(patches.mjs)과 도감 · 표 만들기(codex · sheets)에서 부른다.
 */
export function remapHuntSites(HUNT_SITES, HUNT_PATHS, HUNT_SPECIES = null) {
  if (!HUNT_SITES || HUNT_SITES[DONE]) return HUNT_SITES
  Object.defineProperty(HUNT_SITES, DONE, { value: true, enumerable: false })
  const oldNames = {}
  for (const site of Object.values(HUNT_SITES)) {
    oldNames[site.id] = site.name
    for (const n of site.nodes ?? []) if (Number.isFinite(n.level)) n.level = remapNode(n.level)
    const spirits = site.spirits ?? (site.spirit ? [site.spirit] : [])
    const seen = new Set()
    for (const sp of spirits) { if (seen.has(sp) || !Number.isFinite(sp.level)) continue; seen.add(sp); sp.level = remapSpirit(sp.level) }
    if (site.spirit && !seen.has(site.spirit) && Number.isFinite(site.spirit.level)) site.spirit.level = remapSpirit(site.spirit.level)
    if (!site.spirits && site.spirit) site.spirits = [site.spirit]
    if (Number.isFinite(site.targetStat)) site.targetStat = Math.round(remapS(site.targetStat))
    const t = SITE_TEXT[site.id]
    if (t) { site.name = t.name; site.note = t.note }
    else if (site.theme) site.name = site.theme
    site.theme = site.name
    if (!Number.isFinite(site.targetStat)) site.targetStat = siteS(site)
  }
  // 설명 속 옛 이름(산길 N)을 새 이름으로
  const renames = Object.entries(oldNames).map(([id, old]) => [old, HUNT_SITES[id].name]).filter(([a, b]) => a !== b).sort((a, b) => b[0].length - a[0].length)
  for (const site of Object.values(HUNT_SITES)) if (site.note) site.note = renames.reduce((s, [a, b]) => s.replace(new RegExp(`${a.replace(/[-]/g, '[- ]?')}(?!\\d)`, 'g'), b), site.note)
  // 단추 목록: 이름을 맞추고, 수월한 스탯이 낮은 순으로(열리지 않은 터는 맨 뒤)
  for (const path of HUNT_PATHS ?? []) {
    path.sites = path.sites
      .map((s, i) => ({ ...s, name: HUNT_SITES[s.id]?.name ?? s.name, _i: i }))
      .sort((a, b) => (HUNT_SITES[a.id] ? siteS(HUNT_SITES[a.id]) : 1e9) - (HUNT_SITES[b.id] ? siteS(HUNT_SITES[b.id]) : 1e9) || a._i - b._i)
      .map(({ _i, ...s }) => s)
  }
  if (HUNT_SPECIES) rebalanceHuntMaterials(HUNT_SITES, HUNT_SPECIES)
  return HUNT_SITES
}

// ───────── vD.01 개척 재료 다시 나누기 ─────────
// · 한 재료는 개척 터 두 곳까지만 나온다(쉬운 터부터 보아 처음 나온 두 곳). 세 번째부터는 그 터에 이미 있는 같은 종류(식물 · 장애물 · 동물)의
//   다른 칸으로 바꾸고, 같은 종류가 없으면 아직 두 곳이 차지 않은 재료의 칸을(레벨이 가까운 것부터) 새로 들인다.
// · 두 곳에서 나오는 재료는 레벨이 높은 터에서 한 번에 더 많이(주사위 +1, 덤 +1) 나온다.
// · 성공 덤(부산물)은 모든 터에 똑같이 붙던 고운 나뭇조각 · 자갈돌 · 덫 부스러기 대신, 그 칸의 재료 1개를 더 준다.
//   고운 나뭇조각 · 덫 부스러기는 낮은 터 두 곳씩의 칸(쓰러진 고목 · 버려진 덫)에서 나온다.
export const HUNT_EXTRA_SPECIES = {
  fallenLog: { name: '쓰러진 고목', kind: 'plant', rewards: [{ item: 'fine-woodchip', dice: 2 }] },
  oldTrap: { name: '버려진 덫', kind: 'obstacle', rewards: [{ item: 'trap-scraps', dice: 2 }] },
}
const PLACE_EXTRA = [['left-trail-1', 'fallenLog'], ['left-trail-5', 'fallenLog'], ['left-trail-2', 'oldTrap'], ['left-trail-4', 'oldTrap']]
const mainItem = (sp) => sp?.rewards?.find((r) => r.chance == null)?.item ?? sp?.rewards?.[0]?.item ?? null
const itemsOf = (sp) => (sp?.rewards ?? []).map((r) => r.item)
const bump = (r) => ({ ...r, ...(r.dice ? { dice: r.dice + 1 } : { amount: (r.amount ?? 1) }), plus: (r.plus ?? 0) + 1 })
export function rebalanceHuntMaterials(HUNT_SITES, SPECIES) {
  for (const [k, v] of Object.entries(HUNT_EXTRA_SPECIES)) if (!SPECIES[k]) SPECIES[k] = v
  // 개척 덤(hunt-extra.txt — 얻을 곳이 없던 아이템의 낮은 확률 덤)도 먼저 붙여 두고 함께 센다(reskin.js 는 이미 붙은 것을 건너뛴다)
  for (const x of HUNT_EXTRA) { const sp = SPECIES[x.species]; if (sp && !sp.rewards.some((r) => r.item === x.item)) sp.rewards.push({ item: x.item, chance: x.chance, amount: x.amount }) }
  const med = (site) => { const ls = (site.nodes ?? []).map((n) => n.level).filter(Number.isFinite).sort((a, b) => a - b); return ls.length ? ls[Math.floor(ls.length / 2)] : 0 }
  const sites = Object.values(HUNT_SITES).map((s) => ({ s, m: med(s) })).sort((a, b) => a.m - b.m || String(a.s.id).localeCompare(String(b.s.id))).map((x) => x.s)
  const rank = new Map(sites.map((s, i) => [s.id, i]))
  // 낮은 터의 부산물 칸: 그 터에서 가장 흔한 같은 종류 칸 하나를 바꾼다
  for (const [id, sk] of PLACE_EXTRA) {
    const site = HUNT_SITES[id]; if (!site) continue
    const kind = SPECIES[sk].kind
    const same = (site.nodes ?? []).filter((n) => n.kind === kind && n.species !== sk)
    const cnt = {}; for (const n of same) cnt[n.species] = (cnt[n.species] || 0) + 1
    const pick = same.filter((n) => cnt[n.species] > 1).sort((a, b) => a.level - b.level)[0] ?? same.sort((a, b) => a.level - b.level)[0]
    if (pick) pick.species = sk
  }
  // 재료마다 들어간 터(쉬운 순서로 처음 두 곳)
  const homes = {} // item → [siteId, siteId]
  const claim = (item, siteId) => { const h = (homes[item] ||= []); if (h.includes(siteId)) return true; if (h.length >= 2) return false; h.push(siteId); return true }
  const okIn = (sp, siteId) => itemsOf(sp).every((it) => (homes[it] ?? []).includes(siteId) || (homes[it] ?? []).length < 2)
  // 바꿀 후보: 레벨 근처 터들에서 쓰이던 종(같은 종류)
  const origin = {} // species → 처음 나온 터 순위
  for (const site of sites) for (const n of site.nodes ?? []) if (origin[n.species] == null) origin[n.species] = rank.get(site.id)
  for (const site of sites) {
    // 영물 전리품도 두 곳까지 — 세 번째 터부터의 영물은 그 터의 가장 깊은 산물을 한 아름(1d3+1) 내준다(아래에서 정한다)
    site.spirits = (site.spirits ?? []).map((sp) => { const ok = (sp.rewards ?? []).every((r) => claim(r.item, site.id)); return ok ? sp : { ...sp, rewards: null, _late: true } })
    if (site.spirit) site.spirit = site.spirits[0] ?? site.spirit
    const nodes = (site.nodes ?? []).filter((n) => SPECIES[n.species] && ['plant', 'obstacle', 'animal'].includes(n.kind))
    for (const n of nodes) {
      const sp = SPECIES[n.species]
      if (okIn(sp, site.id)) { itemsOf(sp).forEach((it) => claim(it, site.id)); continue }
      // 산물이 여럿인 칸: 두 곳이 찬 산물만 빼고 나머지는 남긴다(그 칸에서만 나오던 재료가 사라지지 않게)
      const keep = (sp.rewards ?? []).filter((r) => (homes[r.item] ?? []).includes(site.id) || (homes[r.item] ?? []).length < 2)
      if (keep.length) { n.rewards = keep; keep.forEach((r) => claim(r.item, site.id)); continue }
      // ① 이 터에 이미 있는 같은 종류의 다른 칸
      const here = nodes.filter((x) => x !== n && x.kind === n.kind && x.species !== n.species && okIn(SPECIES[x.species], site.id) && itemsOf(SPECIES[x.species]).every((it) => (homes[it] ?? []).includes(site.id)))
      let next = here[0]?.species
      // ② 아직 두 곳이 차지 않은 같은 종류의 종(처음 나온 터가 가까운 것부터)
      if (!next) {
        const r0 = rank.get(site.id)
        next = Object.keys(SPECIES).filter((k) => SPECIES[k].kind === n.kind && k !== n.species && origin[k] != null && okIn(SPECIES[k], site.id))
          .sort((a, b) => Math.abs(origin[a] - r0) - Math.abs(origin[b] - r0) || a.localeCompare(b))[0]
      }
      if (!next) continue // 바꿀 것이 없으면 그대로 둔다(테스트가 알려 준다)
      n.species = next
      itemsOf(SPECIES[next]).forEach((it) => claim(it, site.id))
    }
  }
  for (const site of sites) {
    site.spirits = (site.spirits ?? []).map((sp) => {
      if (!sp._late) return sp
      const eff = (n) => mainItem({ rewards: n.rewards ?? SPECIES[n.species]?.rewards })
      const deep = [...(site.nodes ?? [])].filter((n) => SPECIES[n.species] && eff(n) && (homes[eff(n)] ?? []).includes(site.id)).sort((a, b) => b.level - a.level)[0]
      const { _late, ...rest } = sp
      return { ...rest, rewards: deep ? [{ item: eff(deep), dice: 3, plus: 1 }] : [], note: `이 터의 영물은 「${deep ? SPECIES[deep.species].name : '이 터'}」의 산물을 한 아름 모아 두었다.` }
    })
    if (site.spirit) site.spirit = site.spirits[0] ?? site.spirit
  }
  // 두 곳에서 나오는 재료: 레벨이 높은 터는 한 번에 더 많이 · 부산물은 그 칸의 재료 1개
  for (const site of sites) {
    for (const n of site.nodes ?? []) {
      const sp = SPECIES[n.species]; if (!sp?.rewards) continue
      const base = n.rewards ?? sp.rewards
      const rewards = base.map((r) => { const h = homes[r.item] ?? []; return h.length === 2 && h[1] === site.id ? bump(r) : r })
      if (rewards.some((r, i) => r !== base[i]) || n.rewards) n.rewards = rewards
      const it = mainItem(sp); if (it && ['plant', 'obstacle', 'animal'].includes(n.kind)) n.bonus = { item: it, amount: 1 }
    }
  }
  return homes
}
