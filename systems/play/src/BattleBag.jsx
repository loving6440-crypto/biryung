// 비령 vD.01 — 단체(다인) 전투의 소지품 창.
// 전투에서 쓸 수 있는 것만 소지품 칸처럼 타일로 보여 준다(보스전은 가져온 것만). 타일을 누르면 그 아이템만 따로 뜨고,
// [사용] 또는 [건네기 → 받을 사람]을 고른다. 턴을 쓰는 아이템(#턴소모有 — 일행에게 건네는 것 · 일행 전체에 거는 것)은 내 차례에만 쓸 수 있다.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { itemOf, canUseItem, itemTurnFree, itemNeedsTarget } from '@vault/game/items.js'
import ItemIcon from '@vault/ui/components/ItemIcon.jsx'

export function battleItemCheck(item, { myTurn, isParty, countNow, reviveOn, boostOn, usedThisBattle, downed }) {
  const base = canUseItem(item, { inBattle: true, isParty, countNow, reviveOn, boostOn, usedThisBattle, downed })
  if (!base.ok) return base
  if (!itemTurnFree(item) && !myTurn) return { ok: false, why: '턴을 쓰는 아이템(#턴소모有)은 내 차례에만 쓸 수 있다.' }
  return base
}

export default function BattleBag({ items, mates = [], ctx, pending = false, onUse, onClose }) {
  const [sel, setSel] = useState(null)
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { if (sel) setSel(null); else onClose() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel, onClose])
  const picked = sel ? itemOf(sel) : null
  const count = (id) => items.find((x) => x.id === id)?.n ?? 0
  const check = picked ? battleItemCheck(picked, { ...ctx, countNow: count(picked.id), usedThisBattle: ctx.usedItems?.includes(picked.id) }) : null
  const target = picked && itemNeedsTarget(picked)
  const use = (to) => { onUse(picked.id, to); setSel(null) }
  return createPortal(
    <div className="modal-scrim fixed inset-0 z-[95] grid place-items-center p-4" onClick={onClose} data-battle-bag>
      <div role="dialog" aria-modal="true" aria-label="전투 소지품" className="ink-panel relative w-full max-w-md rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg text-gold">소지품 <small className="ml-1 font-sans text-[11px] text-paper/55">{ctx.bringLimit ? '보스전 — 가져온 것만' : '전투에서 쓸 수 있는 것'}</small></p>
          <button type="button" className="flat-chip" onClick={onClose} aria-label="소지품 닫기">닫기</button>
        </div>
        <p className="mt-1 text-[11px] text-paper/55">{ctx.myTurn ? '내 차례다. 무엇이든 쓸 수 있다.' : '지금은 남의 차례 — 턴을 쓰지 않는 아이템(#턴소모無)만 쓸 수 있다.'}{pending ? ' · 앞서 쓴 아이템을 판이 받는 중…' : ''}</p>
        {!items.length ? <p className="mt-4 text-sm text-paper/60">쓸 수 있는 아이템이 없다.</p> : (
          <ul className="mt-3 grid grid-cols-4 gap-2" aria-label="전투 아이템">
            {items.map(({ id, n }) => {
              const it = itemOf(id); if (!it) return null
              const ok = battleItemCheck(it, { ...ctx, countNow: n, usedThisBattle: ctx.usedItems?.includes(id) }).ok
              return (
                <li key={id}>
                  <button type="button" data-bag-item={id} onClick={() => setSel(id)} className={`flex w-full flex-col items-center gap-1 rounded-xl bg-edge/[0.07] p-2 hover:bg-gold-fill/15 ${ok ? '' : 'opacity-45'}`} aria-label={`${it.name} ×${n}`}>
                    <ItemIcon item={it} size={36} className="shrink-0" />
                    <span className="w-full truncate text-center text-[11px] text-paper">{it.name}</span>
                    <span className="text-[11px] text-gold">×{n}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {picked && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-shade/70 p-4" onClick={() => setSel(null)}>
            <div role="dialog" aria-label={picked.name} data-bag-pick={picked.id} className="ink-panel w-full max-w-xs rounded-xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <ItemIcon item={picked} size={44} />
                <div className="min-w-0"><p className="font-serif text-base text-gold">{picked.name} <small className="text-paper/60">×{count(picked.id)}</small></p>
                  <p className="text-[10px] text-paper/55">{itemTurnFree(picked) ? '#턴소모無 — 남의 차례에도 쓸 수 있다' : '#턴소모有 — 내 차례에 쓰면 턴이 끝난다'}</p></div>
              </div>
              {(picked.effectText || picked.desc) && <p className="mt-2 text-[12px] leading-relaxed text-paper/80">{picked.effectText || picked.desc}</p>}
              {!check.ok && <p className="mt-2 text-[11px] text-crimson" data-bag-why>{check.why}</p>}
              {target ? (
                <div className="mt-3 flex flex-wrap gap-1.5" data-bag-targets>
                  <button type="button" disabled={!check.ok || pending} className="flat-btn !py-1 text-xs disabled:opacity-40" data-target="self" onClick={() => use('self')}>나 (자신)</button>
                  {mates.map((m) => <button key={m.id} type="button" disabled={!check.ok || pending} className="flat-btn !py-1 text-xs disabled:opacity-40" data-target={m.id} onClick={() => use(m.id)}>{m.name}에게 건넨다</button>)}
                </div>
              ) : (
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" disabled={!check.ok || pending} className="flat-btn !py-1 text-xs disabled:opacity-40" data-bag-use onClick={() => use('self')}>사용</button>
                </div>
              )}
              <button type="button" className="flat-chip mt-3" onClick={() => setSel(null)}>뒤로</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.getElementById('playPortal') ?? document.body,
  )
}
