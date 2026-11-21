// 비령 vD.05 — 신수들의 터: 새끼 신수 돌보기 화면. vD.06 3단계(어린 · 성장기 · 성수) · 이름은 처음 한 번만 · 이벤트를 마쳐야 열린다. (규칙은 beasts.js, 저장·소지품은 usePlayHost 의 beastAct)
import { useEffect, useRef, useState } from 'react'
import { bridge } from './bridge.js'
import { TRIPS, NAME_MAX, NAME_RULE, NAME_NOTICE, josa } from './beasts.js'

const left = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

function Seal({ b, size = 56 }) {
  const s = size + (b.stage ?? 0) * 6
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0 items-center justify-center rounded-full font-serif"
      style={{ width: s, height: s, background: b.color, color: '#10202c', fontSize: s * 0.46, boxShadow: '0 0 0 2px #cbb27f, 0 0 0 4px rgba(203,178,127,.25)' }}>
      {b.hanja}
    </span>
  )
}

function Bar({ label, value, max = 100, tone = 'bg-gold-fill', text }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)))
  return (
    <div className="flex items-center gap-2 text-[11px] text-paper/70">
      <span className="w-12 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded bg-shade/60"><i className={`block h-full ${tone}`} style={{ width: `${pct}%` }} /></span>
      <span className="w-20 shrink-0 text-right tabular-nums">{text ?? `${value} / ${max}`}</span>
    </div>
  )
}

function Adopt({ v, act, first }) {
  const [kind, setKind] = useState(null)
  const [name, setName] = useState('')
  const [sure, setSure] = useState(false) // vD.06 「이름을 바꿀 수 없습니다. 확인하셨습니까?」
  const k = v.adoptable.find((x) => x.id === kind)
  const nm = name.replace(/\s+/g, '')
  const okName = NAME_RULE.test(nm)
  return (
    <section className="rounded-lg border border-edge/20 bg-shade/25 p-3" aria-label="새끼 신수 맡기" data-beast-adopt="">
      <p className="text-sm text-gold">{first ? '어느 아이를 맡을까' : '다른 아이도 맡을 수 있다'}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper/70 break-keep">
        {first ? '관리인: “주인이 될 수는 없어. 다 자랄 때까지 곁에서 돌봐 주는 거야. 한 번에 한 아이씩. 그 아이가 다 자라면 다른 아이도 맡을 수 있어.”'
          : '관리인: “잘 키웠네. 이제 다른 아이도 부탁해도 될까?”'}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {v.adoptable.map((x) => (
          <button key={x.id} type="button" data-beast-kind={x.id} aria-pressed={kind === x.id} onClick={() => { setKind(x.id); setSure(false) }}
            className={`flex items-center gap-3 rounded-lg border p-2 text-left ${kind === x.id ? 'border-gold bg-gold-fill/15' : 'border-edge/15 bg-shade/20 hover:bg-gold-fill/10'}`}>
            <Seal b={{ ...x, stage: 0 }} size={40} />
            <span className="min-w-0">
              <b className="block text-[13px] text-paper">어린 {x.name} <small className="text-[11px] font-normal text-paper/55">{x.dir ? `${x.dir} · ` : ''}{x.el}</small></b>
              <span className="block text-[11px] leading-snug text-paper/65 break-keep">{x.look}</span>
            </span>
          </button>
        ))}
      </div>
      {k && !sure && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (okName) setSure(true) }}>
          <label className="text-[12px] text-paper/75">어린 {k.name}의 이름
            <input data-beast-name="" value={name} maxLength={NAME_MAX + 2} onChange={(e) => setName(e.target.value)} placeholder={`한글 ${NAME_MAX}글자까지`}
              className="ml-2 w-36 rounded border border-edge/30 bg-shade/50 px-2 py-1 text-[13px] text-paper" />
          </label>
          <button type="submit" data-beast-adopt-go="" disabled={!okName} className="flat-btn !px-3 !py-1 text-[12px] disabled:opacity-35">이 이름으로</button>
          {name && !okName && <span className="w-full text-[11px] text-red-300/90">이름은 한글로 {NAME_MAX}글자까지 지을 수 있다.</span>}
        </form>
      )}
      {k && sure && (
        <div className="mt-3 rounded border border-gold/40 bg-gold-fill/10 p-2 text-[12px] text-paper/85" data-beast-confirm="">
          <p className="break-keep">「{nm}」 — {NAME_NOTICE}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" data-beast-confirm-yes="" onClick={() => act('adopt', { kind: k.id, name: nm })} className="flat-btn !px-3 !py-1 text-[12px]">확인했다 · 맡기</button>
            <button type="button" data-beast-confirm-no="" onClick={() => setSure(false)} className="text-[11px] text-paper/60 underline">다시 짓기</button>
          </div>
        </div>
      )}
    </section>
  )
}

function Beast({ b, foods, act }) {
  const [food, setFood] = useState('')
  const sorted = [...foods].sort((x, y) => (b.likes.includes(y.id) - b.likes.includes(x.id)) || x.name.localeCompare(y.name))
  const away = !!b.trip
  return (
    <article className="rounded-lg border border-edge/20 bg-shade/25 p-3" data-beast={b.kind} data-beast-id={b.id}>
      <div className="flex items-start gap-3">
        <Seal b={b} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-[15px] text-paper" data-beast-label="">{b.name}</b>
            <span className="text-[11px] text-paper/60" data-beast-stage="">{b.label}{b.dir ? ` · ${b.dir}` : ''}</span>
            {b.active ? <span className="rounded bg-gold-fill/25 px-1.5 text-[10px] text-gold">함께 다니는 중</span>
              : <button type="button" data-beast-active="" onClick={() => act('active', { id: b.id })} className="text-[10px] text-paper/55 underline">함께 다니기</button>}
          </p>
          <p className="text-[11px] leading-snug text-paper/55 break-keep">{b.look}</p>
          <div className="mt-2 space-y-1">
            <Bar label="배부름" value={b.full} tone={b.full <= 20 ? 'bg-red-400/80' : 'bg-gold-fill'} />
            <Bar label="기분" value={b.mood} tone={b.mood <= 20 ? 'bg-red-400/80' : 'bg-sky-300/80'} />
            <Bar label="유대" value={b.bond} max={b.next?.need ?? b.bond} tone="bg-emerald-300/80" text={b.next ? `${b.bond} / ${b.next.need}` : `${b.bond} · 다 자랐다`} />
            {b.next && <p className="text-[10px] text-paper/45" data-beast-next="">유대 {b.next.need}에 {b.next.label}{josa(b.next.label, '으로', '로')} 자란다</p>}
          </div>
          {(b.hungry || b.sulky) && <p className="mt-1 text-[11px] text-red-300/90">{b.hungry ? '배가 고파 기운이 없다. ' : ''}{b.sulky ? '시무룩하다. ' : ''}지금은 유대가 절반만 쌓인다.</p>}
        </div>
      </div>

      {away ? (
        <div className="mt-3 rounded bg-shade/40 p-2 text-[12px] text-paper/80" data-beast-trip="">
          {b.trip.back ? (
            <span className="flex flex-wrap items-center gap-2">{b.name}{josa(b.name, '이', '가')} {b.trip.name}에서 돌아왔다.
              <button type="button" data-beast-collect="" onClick={() => act('collect', { id: b.id })} className="flat-btn !px-2 !py-0.5 text-[11px]">맞이하기</button></span>
          ) : <span>{b.trip.name}{josa(b.trip.name, '으로', '로')} 심부름 중 · {left(b.trip.left)} 뒤에 돌아온다</span>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" data-beast-pet="" disabled={b.petLeft > 0} onClick={() => act('pet', { id: b.id })} className="flat-btn !px-2 !py-0.5 text-[11px] disabled:opacity-40">
              쓰다듬기{b.petLeft > 0 ? ` (${left(b.petLeft)})` : ''}</button>
            <button type="button" data-beast-play="" disabled={b.playLeft > 0} onClick={() => act('play', { id: b.id })} className="flat-btn !px-2 !py-0.5 text-[11px] disabled:opacity-40">
              놀아 주기{b.playLeft > 0 ? ` (${left(b.playLeft)})` : ''}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <select data-beast-food="" value={food} onChange={(e) => setFood(e.target.value)} className="max-w-[14rem] rounded border border-edge/30 bg-shade/50 px-1.5 py-0.5 text-paper">
              <option value="">{sorted.length ? '먹이 고르기' : '줄 수 있는 먹이가 없다'}</option>
              {sorted.map((f) => <option key={f.id} value={f.id}>{b.likes.includes(f.id) ? '★ ' : ''}{f.name} ×{f.n}</option>)}
            </select>
            <button type="button" data-beast-feed="" disabled={!food} onClick={() => { act('feed', { id: b.id, item: food }); setFood('') }} className="flat-btn !px-2 !py-0.5 text-[11px] disabled:opacity-40">먹이 주기</button>
            <span className="text-paper/45">★ 좋아하는 것</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-paper/70">
            <span>심부름:</span>
            {TRIPS.map((t) => (
              <button key={t.id} type="button" data-beast-trip-go={t.id} onClick={() => act('trip', { id: b.id, trip: t.id })} className="flat-btn !px-2 !py-0.5 text-[11px]">
                {t.name} {t.hours}시간</button>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

export default function BeastCare() {
  const api = bridge.api
  const [, setTick] = useState(0)
  const [line, setLine] = useState('')
  const greeted = useRef(false)
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    if (greeted.current || !api?.beastAct) return
    greeted.current = true
    const r = api.beastAct('greet')
    if (r?.line) { setLine(r.line); setTick((x) => x + 1) }
  }, [api])
  if (!api?.beastView) return null
  const v = api.beastView()
  // vD.06 이벤트 「학생 괴담 수칙」을 마쳐야 맡을 수 있다(이미 맡은 아이가 있으면 그대로 돌본다)
  const ev = globalThis.BiryeongBeastEvent
  if (!v.list.length && ev && !ev.finished()) return (
    <p className="mt-4 rounded bg-shade/30 px-3 py-2 text-[12px] leading-relaxed text-paper/70 break-keep" data-beast-wait="">
      관리인: “지금은 새끼들이 모두 보관소에 있어. 학당에 도는 괴담부터 정리되면 그때 부탁할게.” — 이벤트 「{ev.title}」을 마치면 신수를 맡을 수 있다.</p>
  )
  const foods = api.beastFoods?.() ?? []
  const act = (kind, a) => {
    const r = api.beastAct(kind, a)
    if (r?.line) setLine(r.grew ? `${r.line} — ${r.grew}${josa(r.grew, '이', '가')} 되었다!` : r.line)
    else if (r?.error) setLine(r.error)
    setTick((x) => x + 1)
  }
  const list = [...v.list].sort((x, y) => y.active - x.active)
  return (
    <div className="mt-4 space-y-3" data-beast-care="">
      <p className="text-sm text-gold">새끼 신수 돌보기</p>
      {line && <p className="rounded bg-gold-fill/10 px-3 py-2 text-[12px] leading-relaxed text-paper/85 break-keep" data-beast-line="" aria-live="polite">{line}</p>}
      {list.map((b) => <Beast key={b.id} b={b} foods={foods} act={act} />)}
      {(!v.list.length || v.canAdopt) && <Adopt v={v} act={act} first={!v.list.length} />}
      {v.list.length > 0 && !v.canAdopt && v.adoptable.length > 0 && (
        <p className="text-[11px] text-paper/50">지금 맡은 아이가 성수가 되면 다른 아이도 맡을 수 있다.</p>
      )}
      <details className="text-[11px] text-paper/55">
        <summary className="cursor-pointer">돌보는 법</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 break-keep">
          <li>배부름은 20분, 기분은 30분마다 1씩 준다. 접속하지 않아도 줄어든다.</li>
          <li>먹이 주기: 배부름 +25(좋아하는 것은 +40)와 유대. 쓰다듬기는 1시간, 놀아 주기는 4시간마다.</li>
          <li>심부름: 1 · 3 · 8시간. 배부름과 기분이 30 이상이어야 나가고, 돌아오면 물건을 물어 온다. 기분이 좋을수록, 많이 자랄수록 더 많이.</li>
          <li>유대가 쌓이면 어린 → 성장기 → 성수로 자란다(어린 백호 → 성장기 백호 → 성수 백호). 꾸준히 돌보면 2주쯤 걸린다. 단계마다 처음 한 번 보상이 있다. 하루 첫 방문에는 반갑게 맞아 준다(유대 +5).</li>
          <li>이름은 처음 맡을 때 한 번만 지을 수 있다(한글 네 글자까지). 나중에 바꿀 수 없다.</li>
          <li>배가 고프거나 시무룩하면 유대가 절반만 쌓인다. 아이가 떠나지는 않는다.</li>
        </ul>
      </details>
    </div>
  )
}
