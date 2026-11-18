// 비령 vD.02.1 — 응급 처치 상자: 나쁜 상태가 여럿이면 풀 것을 하나 고른다.
export default function BsPicker({ options, onPick, onClose, title = '응급 처치 상자' }) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-shade/60 p-4" data-bs-picker onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="ink-panel w-full max-w-sm rounded-xl p-4">
        <p className="text-[10px] tracking-[0.25em] text-gold/80">{title}</p>
        <p className="mt-1 text-sm text-paper">어느 것을 풀까? (하나만)</p>
        <ul className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto">
          {options.map((o) => (
            <li key={o.key}>
              <button type="button" data-bs-option={o.key} onClick={() => onPick(o.key)} className="w-full rounded-lg bg-edge/[0.08] px-3 py-2 text-left hover:bg-gold-fill/15">
                <b className="text-sm text-paper">{o.label}</b>
                {o.desc && <span className="mt-0.5 block text-[11px] leading-snug text-paper/60">{o.desc}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onClose} className="flat-btn-ghost !py-1 text-xs">그만두기</button>
        </div>
      </div>
    </div>
  )
}
