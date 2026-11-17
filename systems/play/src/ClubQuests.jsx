// 비령 vC.06 — 동아리 부실에서 보이는 [오늘의 할일] · [이번주에 할일]. (동아리 단추 없이, 내 동아리의 부실에 오면 바로 보인다)
import { useEffect, useState } from 'react'
import { bridge } from './bridge.js'
import { rewardText } from './clubQuests.js'

function Row({ q, onClaim }) {
  const pct = Math.round((q.cur / Math.max(1, q.goal)) * 100)
  return (
    <li className="rounded-lg border border-edge/15 bg-shade/20 px-3 py-2" data-club-quest={q.id} data-done={q.done ? '1' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`min-w-0 flex-1 text-[13px] leading-snug break-keep ${q.claimed ? 'text-paper/45 line-through' : 'text-paper'}`}>{q.label}</p>
        {q.claimed ? <span className="text-[11px] text-paper/45">받음</span>
          : <button type="button" disabled={!q.done} onClick={onClaim} className="flat-btn !px-2 !py-0.5 text-[11px] disabled:opacity-35">보상 받기</button>}
      </div>
      {q.note && <p className="mt-0.5 text-[10px] text-paper/50">{q.note}</p>}
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-paper/60">
        <span className="h-1.5 flex-1 overflow-hidden rounded bg-shade/60"><i className="block h-full bg-gold-fill" style={{ width: `${pct}%` }} /></span>
        <span className="tabular-nums">{q.text ?? `${q.cur} / ${q.goal}`}</span>
        <span className="text-gold">{rewardText(q.reward)}</span>
      </div>
    </li>
  )
}

export default function ClubQuests({ clubId }) {
  const api = bridge.api
  const [, setTick] = useState(0)
  useEffect(() => { api?.clubEnsure?.(clubId) }, [clubId, api])
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 15000); return () => clearInterval(t) }, [])
  if (!api?.clubBoard) return null
  const b = api.clubBoard(clubId)
  const claim = (kind, id) => { if (api.clubClaim(clubId, kind, id)) setTick((x) => x + 1) }
  return (
    <div className="mt-4 space-y-4" data-club-quests={clubId}>
      <section className="rounded-lg bg-shade/25 p-3" aria-label="오늘의 할일">
        <p className="mb-2 flex items-baseline justify-between text-sm text-gold"><span>오늘의 할일</span><small className="text-[10px] text-paper/50">매일 0시에 새로 · 보상은 [보상 받기]로</small></p>
        <ul className="space-y-1.5">{b.daily.map((q) => <Row key={q.id} q={q} onClaim={() => claim('daily', q.id)} />)}</ul>
        <ul className="mt-2"><Row q={b.dailyMeta} onClaim={() => claim('dailyMeta', b.dailyMeta.id)} /></ul>
      </section>
      <section className="rounded-lg bg-shade/25 p-3" aria-label="이번주에 할일">
        <p className="mb-2 flex items-baseline justify-between text-sm text-gold"><span>이번주에 할일</span><small className="text-[10px] text-paper/50">월요일 0시에 새로 · 이번 주 수준 {b.tier}단계 (스탯 평균 {b.avg ?? '—'})</small></p>
        <ul className="space-y-1.5">{b.weekly.map((q) => <Row key={q.id} q={q} onClaim={() => claim('weekly', q.id)} />)}</ul>
        <ul className="mt-2 space-y-1.5">{b.weeklyMeta.map((q) => <Row key={q.id} q={q} onClaim={() => claim('weeklyMeta', q.id)} />)}</ul>
      </section>
    </div>
  )
}
