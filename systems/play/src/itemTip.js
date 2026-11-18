// 비령 vD.02 — 아이템에 마우스를 올리면 마우스 바로 위에 이름 · 효과 · 설명이 뜬다(누르지 않아도 된다).
// 소지품 · 가방 · 물품보관함 · 매점 · 도감(재료 및 아이템) · 제작법 · 양호실 · 전투 소지품 어디서든: data-item / data-bag-item / data-codex / data-recipe / data-nurse-item / data-sell-item / data-bag-item(전투) 를 읽는다.
import { itemOf } from '@vault/game/items.js'
import { itemTags } from '@vault/game/itemSearch.js'
import { RECIPES } from '@vault/game/crafting.js'
import { COOK_RECIPES } from '@vault/game/cooking.js'

const SEL = '[data-item],[data-bag-item],[data-codex],[data-recipe],[data-nurse-item],[data-sell-item],[data-store-item]'
let tip = null
const recipeResult = (rid) => [...(RECIPES ?? []), ...(COOK_RECIPES ?? [])].find((r) => r.id === rid)?.result
function idOf(el) {
  const d = el.dataset
  if (d.recipe) return recipeResult(d.recipe)
  if (d.codex) return itemOf(d.codex) ? d.codex : null
  return d.item || d.bagItem || d.nurseItem || d.sellItem || d.storeItem || null
}
function ensure() {
  if (tip) return tip
  tip = document.createElement('div')
  tip.className = 'item-tip'
  tip.setAttribute('role', 'tooltip')
  tip.hidden = true
  try { tip.setAttribute('popover', 'manual') } catch { /* 오래된 브라우저 */ }
  document.body.append(tip)
  return tip
}
function hide() { if (tip && !tip.hidden) { tip.hidden = true; try { tip.hidePopover() } catch { /* 없음 */ } } }
function show(id, x, y) {
  const it = itemOf(String(id).split('#')[0])
  if (!it) { hide(); return }
  const t = ensure()
  const tags = itemTags(it).filter((g) => g.startsWith('#')).slice(0, 5)
  t.replaceChildren()
  const b = document.createElement('b'); b.textContent = it.name; t.append(b)
  if (tags.length) { const s = document.createElement('span'); s.className = 'item-tip-tags'; s.textContent = tags.join(' '); t.append(s) }
  if (it.effectText) { const p = document.createElement('p'); p.className = 'item-tip-eff'; p.textContent = it.effectText; t.append(p) }
  if (it.desc) { const p = document.createElement('p'); p.textContent = it.desc.length > 140 ? `${it.desc.slice(0, 140)}…` : it.desc; t.append(p) }
  { const from = it.obtain || globalThis.BIRYEONG_CODEX?.items?.find((x) => x.id === it.id)?.from; if (from) { const p = document.createElement('p'); p.className = 'item-tip-from'; p.textContent = `얻는 곳: ${from.length > 90 ? `${from.slice(0, 90)}…` : from}`; t.append(p) } }
  t.hidden = false
  try { if (!t.matches(':popover-open')) t.showPopover() } catch { /* popover 없음 */ }
  const r = t.getBoundingClientRect()
  t.style.left = `${Math.max(6, Math.min(window.innerWidth - r.width - 6, x - r.width / 2))}px`
  t.style.top = `${Math.max(6, y - r.height - 16)}px`
}
let last = null
let lastEl = null
if (typeof document !== 'undefined' && !globalThis.__BRY_ITEM_TIP) {
  globalThis.__BRY_ITEM_TIP = true
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return
    const el = e.target.closest?.(SEL)
    const id = el ? idOf(el) : null
    if (!id) { if (last) { last = null; hide() } return }
    last = id; lastEl = el
    show(id, e.clientX, e.clientY)
  }, { passive: true })
  document.addEventListener('pointerdown', () => { last = null; hide() }, { capture: true, passive: true })
  document.addEventListener('scroll', () => { last = null; hide() }, { capture: true, passive: true })
  document.addEventListener('keydown', () => { last = null; hide() }, { capture: true, passive: true }) // vD.02 창을 닫으면(Esc) 설명도 닫는다
  setInterval(() => { if (tip && !tip.hidden && (!lastEl || !lastEl.isConnected || !lastEl.offsetParent)) { last = null; lastEl = null; hide() } }, 400) // 가리키던 칸이 사라지면 닫는다
}
