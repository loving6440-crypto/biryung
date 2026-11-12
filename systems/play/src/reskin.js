// 비령 play — 세계관 개변 적용. 보관고의 아이템 · 적 · 영능력 객체에 비령판 이름 · 설명 · 도트 아이콘 데이터를 덮어쓴다.
// (수치는 그대로. 표는 systems/biryeong/*.txt → reskin.data.js)
import { ITEMS } from '@vault/game/items.js'
import { ALL_ENEMIES, PSYCHICS } from '@vault/game/battle.js'
import { ITEM_RESKIN, ENEMY_RESKIN, PSYCHIC_RESKIN, ITEM_PIXELS } from '../../biryeong/reskin.data.js'

for (const item of ITEMS) {
  const r = ITEM_RESKIN[item.id]
  if (r) { item.name = r.name; item.desc = r.desc }
  if (ITEM_PIXELS[item.id]) item.pixel = ITEM_PIXELS[item.id] // 도트 아이콘: { t: 틀 이름, p: 팔레트 이름 }
}
for (const e of ALL_ENEMIES) {
  const r = ENEMY_RESKIN[e.id]
  if (!r) continue
  e.name = r.name; e.blurb = r.blurb
  if (r.special && e.special) e.special.label = r.special
  if (r.special2 && e.special2) e.special2.label = r.special2
}
for (const p of PSYCHICS) { const r = PSYCHIC_RESKIN[p.id]; if (r) p.note = r.note } // 이름(label)은 빌드할 때 글자째로 바꾼다
