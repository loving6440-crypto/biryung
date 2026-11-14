// 비령 play — 아이템 도트 아이콘. 보관고의 ItemIcon(원형 플랫 배지)을 이 파일로 바꿔 끼운다(build.mjs).
// item.pixel = { t: 틀, p: 색 } 를 12×12 도트로 그린다. v1.1: 아이템마다 하나씩(systems/biryeong/pixels.txt), 겹치는 도트 없음.
import { itemOf } from '@vault/game/items.js'
import { PIXEL_TEMPLATES, PIXEL_PALETTES, ITEM_PIXELS } from '../../biryeong/reskin.data.js'

const OUTLINE = '#07101b'
const cache = new Map()
function rects(t, p) {
  const key = `${t}:${p}`
  if (cache.has(key)) return cache.get(key)
  const grid = PIXEL_TEMPLATES[t] ?? PIXEL_TEMPLATES.box
  const [a, b, c, d] = PIXEL_PALETTES[p] ?? PIXEL_PALETTES.gold
  const colour = { k: OUTLINE, a, b, c, d }
  const out = []
  grid.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const f = colour[row[x]]; if (f) out.push(<rect key={`${x}-${y}`} x={x + 2} y={y + 2} width="1.02" height="1.02" fill={f} />) } })
  cache.set(key, out)
  return out
}

export default function ItemIcon({ item, id, size = 40, locked = false, className = '' }) {
  const it = item ?? itemOf(id)
  const key = it?.baseId ?? it?.id ?? id ?? '?'
  const pixel = it?.pixel ?? ITEM_PIXELS[key] ?? { t: 'box', p: 'steel' }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} shapeRendering="crispEdges" style={{ flexShrink: 0, imageRendering: 'pixelated' }} aria-hidden data-pixel-icon={locked ? 'locked' : pixel.t}>
      <rect x="0" y="0" width="16" height="16" fill="#0c1826" />
      <rect x="0.5" y="0.5" width="15" height="15" fill="none" stroke={locked ? '#3d5162' : '#6d5d43'} strokeWidth="1" />
      {locked ? <text x="8" y="11.5" textAnchor="middle" fontSize="8" fill="#6f8088">?</text> : rects(pixel.t, pixel.p)}
    </svg>
  )
}
export const CUSTOM_ICON_IDS = Object.keys(ITEM_PIXELS)
