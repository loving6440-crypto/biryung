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
export function remapHuntSites(HUNT_SITES, HUNT_PATHS) {
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
  return HUNT_SITES
}
