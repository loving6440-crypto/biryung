// 비령 vD.02 — 양호실 물품 진열대: 몸의 이상 10종을 하나씩 다스리는 기본 물품 + 쇠약 전용 영양제(비싸다).
import { useState } from 'react'
import { itemOf } from '@vault/game/items.js'
import ItemIcon from '@vault/ui/components/ItemIcon.jsx'
import { NURSE_STOCK } from './ailments.js'

function Row({ id, price, money, admin, onBuy }) {
  const it = itemOf(id)
  const [n, setN] = useState(1)
  if (!it) return null
  const q = Math.max(1, Math.min(99, n))
  const can = admin || (money || 0) >= price * q
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-edge/15 bg-edge/[0.04] p-3" data-nurse-item={id} title={`${it.name} — ${it.effectText}`}>
      <ItemIcon item={it} size={40} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-paper">{it.name} <small className="text-gold">{price}냥</small>{id === 'nutrient' && <small className="ml-1 text-paper/50">· 귀한 약</small>}</p>
        <p className="text-[11px] leading-snug text-paper/65">{it.effectText}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-paper/45">{it.desc}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="flat-chip !px-1.5 !py-0.5 text-xs" aria-label="하나 덜" onClick={() => setN((v) => Math.max(1, v - 1))}>−</button>
        <input type="number" min={1} max={99} value={q} onChange={(e) => setN(Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))))} className="w-11 rounded border border-edge/30 bg-transparent px-1 py-0.5 text-center text-xs text-paper" aria-label={`${it.name} 살 개수`} />
        <button type="button" className="flat-chip !px-1.5 !py-0.5 text-xs" aria-label="하나 더" onClick={() => setN((v) => Math.min(99, v + 1))}>+</button>
        <button type="button" className="flat-btn !py-1 text-xs disabled:opacity-40" disabled={!can} onClick={() => onBuy(id, q)} data-nurse-buy={id}>사기 · {price * q}냥</button>
      </div>
    </li>
  )
}

export default function NurseShop({ player, admin, onBuy }) {
  return (
    <section aria-label="양호실 물품" data-nurse-shop>
      <h2 className="font-serif text-2xl text-gold">양호실 물품</h2>
      <p className="mt-1 text-xs leading-relaxed text-paper/65">양호 선생님 책상 옆 유리장. 몸의 이상 하나를 낫게 하고, 낫고 나서 20분 동안은 같은 이상에 다시 걸리지 않는다. 쇠약에 듣는 영양제는 귀해서 값이 꽤 나간다. 지금 가진 돈 {Math.floor(player.money || 0)}냥.</p>
      <ul className="mt-3 grid gap-2">{NURSE_STOCK.map((s) => <Row key={s.id} {...s} money={player.money} admin={admin} onBuy={onBuy} />)}</ul>
    </section>
  )
}
