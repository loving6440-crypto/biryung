// 비령 · NPC 자리 (초록동색 NPC는 들어 있지 않다)
//
// 초록동색 C.01 에서 콘텐츠를 옮겨 올 때 NPC 캐릭터(이름 · 초상화 · 대사 · 도감 설명 · 선물 반응)는 모두 뺐다.
// 그 NPC 가 있던 자리는 '역할' 단위의 빈 자리로 남겨 두었다. 새 NPC 를 만들면 아래 자리를 채우면 된다.
//
//  - 자리를 채우지 않으면 vacant: true 이고, 화면에서는 대사창 · 도감 칸이 나오지 않는다(또는 역할 이름으로 대신 보인다).
//  - 글 안의 {{npc:자리id}} / {{npc:자리id|조사}} 는 fillNpcText() 가 새 NPC 이름으로 바꾼다. 조사는 받침에 맞춰 고른다.
//    예) '{{npc:shrineKeeper|가}} 문을 연다' → 새 이름이 '하람'이면 '하람이 문을 연다'
//  - 꺼낼 때(systems/vault/cli.mjs export --npc 자리id=이름) 도 같은 규칙으로 채울 수 있다.

const slot = (id, role, where, note = '') => ({
  id,
  role, // 이 자리가 하던 일
  where, // 원래 있던 곳
  note,
  vacant: true,
  name: '',
  src: null, // 대사창 초상화 (하나짜리)
  portrait: null, // 도감 · 상점 초상화
  faces: {}, // 표정별 초상화 { plain, smile, ... }
  lines: [], // 평소 대사 [{ face?, text, when? }]
  giftLines: [], // 선물 반응 [{ minAffinity, text }]
  codex: '', // 도감 설명
  appear: '', // 처음 마주칠 때 글
})

export const NPC_SLOTS = {
  outskirtsGuide: slot('outskirtsGuide', '교외 · 뒷산 캠핑장 안내, 전투 튜토리얼 진행', '뒷산 캠핑장 · 교외', '전투 튜토리얼 #2 에서 직접 싸우는 역할(영능력 효험 · 도깨비불 시연)도 이 자리다.'),
  storeKeeper: slot('storeKeeper', '기숙사 매점 담당', '기숙사 · 매점'),
  seedKeeper: slot('seedKeeper', '뒷산 텃밭 씨앗 상점 담당', '뒷산 · 텃밭'),
  armorySmith: slot('armorySmith', '무구보관소 무구 강화 담당', '뒷산 · 무구보관소'),
  shrineKeeper: slot('shrineKeeper', '사당 문지기', '사당'),
  kitchenKeeper: slot('kitchenKeeper', '별관 2층 조리실 담당', '별관 2층 · 조리실'),
  infirmaryKeeper: slot('infirmaryKeeper', '본관 2층 양호실 담당', '본관 2층 · 양호실'),
}

/** NPC 대사를 뺀 자리에 남겨 둔 표시. 새 NPC 대사로 바꾸면 된다. */
export const NPC_LINE_PLACEHOLDER = '(이 자리의 NPC 대사는 비어 있다 — 새 NPC 를 정하면 채운다.)'

export const NPC_SLOT_IDS = Object.keys(NPC_SLOTS)

/** 자리를 채운다. info = { name, src, portrait, faces, lines, giftLines, codex, appear } (필요한 것만). */
export function fillNpcSlot(id, info = {}) {
  const s = NPC_SLOTS[id]
  if (!s) throw new Error(`없는 NPC 자리: ${id}`)
  Object.assign(s, info, { id, vacant: !(info.name ?? s.name) })
  return s
}

/** 화면에 쓸 이름. 비어 있으면 역할을 대신 보여 준다. */
export const npcName = (idOrSlot) => {
  const s = typeof idOrSlot === 'string' ? NPC_SLOTS[idOrSlot] : idOrSlot
  if (!s) return ''
  return s.name || s.role
}
export const npcPresent = (idOrSlot) => {
  const s = typeof idOrSlot === 'string' ? NPC_SLOTS[idOrSlot] : idOrSlot
  return !!s && !s.vacant && !!s.name
}

const JOSA = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'], 아: ['아', '야'], 야: ['아', '야'], 이랑: ['이랑', '랑'], 랑: ['이랑', '랑'] }
const batchim = (word) => {
  const c = String(word).trim().slice(-1).charCodeAt(0) - 0xac00
  if (c < 0 || c > 11171) return -1
  return c % 28
}
/** 받침에 맞는 조사를 붙인다. */
export function josa(word, j) {
  const pair = JOSA[j]
  if (!pair) return `${word}${j ?? ''}`
  const b = batchim(word)
  if (pair[0] === '으로') return `${word}${b > 0 && b !== 8 ? '으로' : '로'}`
  return `${word}${b > 0 ? pair[0] : pair[1]}`
}

export const NPC_TOKEN = /\{\{npc:(\w+)(?:\|([가-힣]+))?\}\}/g

/** 글 속 {{npc:자리|조사}} 를 채운다. names 를 주면 그 이름을, 안 주면 NPC_SLOTS 의 이름(없으면 역할)을 쓴다. */
export function fillNpcText(text, names = null) {
  return String(text ?? '').replace(NPC_TOKEN, (m, id, j) => {
    const name = names ? names[id] : npcName(id)
    if (!name) return m
    return j ? josa(name, j) : name
  })
}

/** 객체 · 배열 전체의 글을 한 번에 채운다(꺼낼 때 쓰기 좋다). */
export function fillNpcDeep(value, names = null) {
  if (typeof value === 'string') return fillNpcText(value, names)
  if (Array.isArray(value)) return value.map((v) => fillNpcDeep(v, names))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillNpcDeep(v, names)]))
  return value
}
