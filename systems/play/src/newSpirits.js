// 비령 vD.02 — 개척 터마다 영물은 한 마리, 모든 터의 영물이 서로 다르다.
// 원래 영물 18종에 새 영물 5종(흰 토끼 · 솟대 오리 · 불쥐 · 삽사리 · 백랑)을 더해 23곳에 하나씩 둔다.
// 새 영물마다 전리품(재료)과, 그 재료로 공작소에서 만드는 물건(효과 · 제작법)이 있다.
// 레벨은 remapHuntSites 가 고친 뒤의 값(육조 합과 견준다)이다.

export const SPIRIT_CHANCE = 0.2

export const NEW_SPIRIT_SPECIES = {
  whiteRabbit: { name: '흰 토끼', kind: 'spirit', rewards: [{ item: 'white-rabbit-fur', dice: 2 }], desc: '민들레 홀씨 사이로 깡총 뛰어가는 하얀 토끼. 달에서 내려왔다는 말이 있다.' },
  sotdaeDuck: { name: '솟대 오리', kind: 'spirit', rewards: [{ item: 'sotdae-duck-feather', dice: 2 }], desc: '솟대 끝에 앉아 있던 나무 오리가 밤이면 날개를 편다. 마을로 드는 나쁜 기운을 먼저 본다.' },
  fireRat: { name: '불쥐', kind: 'spirit', rewards: [{ item: 'fire-rat-fur', dice: 2 }], desc: '숯가마 불 속에서 사는 쥐. 털을 짜면 불에 넣어도 타지 않는 천이 된다.' },
  sapsari: { name: '삽사리', kind: 'spirit', rewards: [{ item: 'sapsal-fur', dice: 2 }], desc: '옛 산성을 지키던 북슬북슬한 개. 귀신이 그 털만 보아도 달아난다고 한다.' },
  whiteWolf: { name: '백랑', kind: 'spirit', rewards: [{ item: 'white-wolf-fang', amount: 1 }], desc: '골짜기를 울리는 늑대 울음의 주인. 눈처럼 흰 털에 눈빛만 푸르다.' },
}

/** 터 id → [영물, 레벨] (쉬운 터부터) */
export const SITE_SPIRIT = {
  'left-trail-1': ['brokenJangseung', 30],
  'left-trail-2': ['whiteRabbit', 36],
  'left-lake': ['imugi', 40],
  'left-trail-3': ['blueDeer', 50],
  'left-trail-5': ['whiteSquirrel', 54],
  'left-trail-4': ['sotdaeDuck', 58],
  'left-trail-6': ['whiteMagpie', 72],
  'left-trail-7': ['goldToad', 84],
  'left-cemetery': ['soulButterfly', 100],
  'left-cave': ['darkSpirit', 100],
  'left-trail-8': ['fireRat', 92],
  'left-trail-9': ['ginsengChild', 108],
  'left-trail-10': ['goldenSerpent', 114],
  'left-trail-11': ['whiteWeasel', 131],
  'left-trail-12': ['sapsari', 143],
  'left-trail-13': ['fortuneBat', 155],
  'left-trail-14': ['eagleOwl', 170],
  'left-trail-15': ['crane', 183],
  'left-trail-16': ['whiteWolf', 202],
  'left-trail-17': ['whiteRoe', 227],
  'left-trail-18': ['haedongcheong', 248],
  'left-trail-19': ['dragonHorse', 279],
  'left-trail-20': ['oldTurtle', 305],
}

const MAT = (id, name, desc, pixel) => ({ id, kind: 'material', tags: ['재료'], name, price: null, desc, effectText: '제작용 재료', effect: {}, battle: false, pixel })
export const NEW_SPIRIT_ITEMS = [
  MAT('white-rabbit-fur', '흰 토끼털', '흰 토끼가 남긴 털 한 줌. 달빛을 머금은 듯 보드랍다.', { t: 'fur', p: 'cream' }),
  MAT('sotdae-duck-feather', '솟대 오리 깃', '나무 오리가 떨군 깃. 깃털인데 나뭇결이 비친다.', { t: 'feather', p: 'soy' }),
  MAT('fire-rat-fur', '불쥐 털', '불 속에서 사는 쥐의 털. 불에 넣어도 타지 않고 따뜻하기만 하다.', { t: 'fur', p: 'ember' }),
  MAT('sapsal-fur', '삽사리 털', '귀신 쫓는 개로 이름난 삽사리의 북슬북슬한 털.', { t: 'fur', p: 'gray' }),
  MAT('white-wolf-fang', '백랑 송곳니', '흰 늑대의 송곳니. 쥐고 있으면 등이 꼿꼿해진다.', { t: 'fang', p: 'white' }),
  {
    id: 'rabbit-moon-bell', kind: 'consumable', name: '옥토끼 방울', price: null, tags: ['완성품', '#개척'], pixel: { t: 'bell', p: 'cream' },
    desc: '흰 토끼털 술을 단 작은 방울. 흔들면 숨어 있던 산물이 고개를 내민다.',
    effect: { hunt: { odds: { amount: 10, attempts: 4 } } }, effectText: '개척 중: 다음 4번 성공률 +10%', battle: false,
  },
  {
    id: 'sotdae-feather-charm', kind: 'consumable', name: '솟대 깃 부적', price: null, tags: ['완성품', '#개척', '#부적'], pixel: { t: 'talisman', p: 'sky' },
    desc: '솟대 오리 깃을 꽂은 부적. 나쁜 기운을 먼저 보고 길을 비켜 준다.',
    effect: { hunt: { ward: 4, turns: 2 } }, effectText: '개척 중: 요괴 쫓기 4턴 · 행동 턴 +2', battle: false,
  },
  {
    id: 'fire-rat-cloth', kind: 'consumable', name: '화완포 손수건', price: null, tags: ['완성품', '#몸의 이상'], pixel: { t: 'cloth', p: 'ember' },
    desc: '불쥐 털로 짠 손수건. 덴 자리에는 시원하고, 언 자리에는 따뜻하다.',
    effect: { hp: 15, cureAil: ['hwasang', 'hangi'], ailGuard: ['hwasang', 'hangi'] }, effectText: '[화상] · [한기] 완치 · 20분 동안 다시 걸리지 않는다 / 체력 +15 (전투 밖에서)', battle: false,
  },
  {
    id: 'sapsari-talisman', kind: 'consumable', name: '삽사리 부적', price: null, tags: ['완성품', '#개척', '#부적'], pixel: { t: 'talisman', p: 'ghost' },
    desc: '삽사리 털을 꼬아 넣은 부적. 터에 어슬렁대던 요괴가 냄새만 맡고 달아난다.',
    effect: { hunt: { banish: 1, ward: 6 } }, effectText: '개척 중: 터의 요괴를 쫓아낸다 · 요괴 쫓기 6턴', battle: false,
  },
  {
    id: 'white-wolf-amulet', kind: 'consumable', name: '백랑 송곳니 부적', price: null, tags: ['완성품', '#전투', '#기운(버프)'], pixel: { t: 'necklace', p: 'ghost' },
    desc: '백랑 송곳니를 끈에 꿴 것. 목에 걸면 늑대처럼 먼저 뛰어든다.',
    effect: { battleStat: { aggression: 6, agility: 3 }, onlyBattle: true }, effectText: '이번 전투 동안 공격성 +6 · 민첩 +3 (전투 중에만)', battle: true,
  },
]

export const NEW_SPIRIT_RECIPES = [
  { id: 'sp-r-rabbit-moon-bell', result: 'rabbit-moon-bell', inputs: [['white-rabbit-fur', 2], ['twine', 1]], tier: 2 },
  { id: 'sp-r-sotdae-feather-charm', result: 'sotdae-feather-charm', inputs: [['sotdae-duck-feather', 2], ['charm-scrap', 1]], tier: 2 },
  { id: 'sp-r-fire-rat-cloth', result: 'fire-rat-cloth', inputs: [['fire-rat-fur', 3], ['yarn-ball', 1]], tier: 2 },
  { id: 'sp-r-sapsari-talisman', result: 'sapsari-talisman', inputs: [['sapsal-fur', 2], ['charm-scrap', 2]], tier: 2 },
  { id: 'sp-r-white-wolf-amulet', result: 'white-wolf-amulet', inputs: [['white-wolf-fang', 2], ['twine', 1]], tier: 2 },
]

/** 터마다 영물 하나(remapHuntSites 안에서, 재료 나누기 전에 부른다) */
export function assignSiteSpirits(HUNT_SITES, SPECIES) {
  for (const [k, v] of Object.entries(NEW_SPIRIT_SPECIES)) if (!SPECIES[k]) SPECIES[k] = v
  for (const [id, [species, level]] of Object.entries(SITE_SPIRIT)) {
    const site = HUNT_SITES[id]; const sp = SPECIES[species]
    if (!site || !sp) continue
    const one = { ...sp, rewards: sp.rewards.map((r) => ({ ...r })), species, chance: SPIRIT_CHANCE, level }
    site.spirits = [one]
    site.spirit = one
  }
}
