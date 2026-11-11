import { useEffect, useMemo, useState } from 'react'
import { Footprints, Zap } from 'lucide-react'
import { LOCATIONS } from '../../game/constants'
import { NPC_ENTRIES } from '../../game/codex'

const leftText = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`
}

// 이동하는 동안 랜덤으로 뜨는 한 줄 대사. 이동을 시작할 때 하나를 골라 도착할 때까지 그대로 보여 준다.
const TRAVEL_LINES = [
  '끝까지 기다려야 도착한다. 달리 말 하자면, 기다림엔 끝이 있단 소리다.',
  '걸으면서 현학적인 생각을 하는 건 지루한가? 그렇다면 지나가는 귀신을 세어보자.',
  '걷고 있다. 기어가고 있진 않다. 어쩌면 날고 있을 수도 있다.',
  '교내 부지가 넓은 건 이래서 좋지 못하다. 건물을 돌아다니기만 해도 지구력이 붙는 기분이다.',
  '시간은 언젠가 흐른다. 마찬가지로 걷다 보면 반드시 도착한다.',
]

/** 건물이 아예 바뀌는 이동 중일 때, 그 구역의 화면 대신 보여 주는 대기 패널. */
export default function TravelPanel({ traveling, mp, onFastTravel }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const loc = LOCATIONS[traveling.toId]
  const left = traveling.startedAt + traveling.minutes * 60000 - Date.now()
  // 이동을 시작한 시각을 씨앗 삼아 하나를 고른다 — 도착할 때까지(재렌더링돼도) 같은 대사가 유지된다.
  const line = useMemo(() => TRAVEL_LINES[Math.abs(Math.floor(traveling.startedAt)) % TRAVEL_LINES.length], [traveling.startedAt])
  const fastCost = Math.ceil(traveling.minutes / 2)
  const canFast = typeof onFastTravel === 'function' && typeof mp === 'number' && mp >= fastCost
  const npcs = (loc?.npcs ?? []).map((id) => NPC_ENTRIES.find((n) => n.id === id)).filter(Boolean)
  return (
    <section aria-label="이동 중" className="grid min-h-[16rem] place-items-center py-10 text-center">
      <Footprints size={28} className="text-gold/70" aria-hidden />
      <p className="mt-3 font-serif text-xl text-gold">{loc?.name ?? ''}(으)로 이동하는 중이다</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed break-keep text-paper/70" data-travel-line>
        {line}
      </p>
      {!!loc?.facilities?.length && (
        <div className="mt-4 max-w-sm" data-travel-destination>
          <p className="text-[11px] tracking-[0.2em] text-gold/60">도착하면 — {loc.name}</p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {loc.facilities.map((f) => (
              <span key={f} className="rounded-md border border-edge/25 px-2 py-0.5 text-xs text-paper/80">
                {f}
              </span>
            ))}
          </div>
          {!!npcs.length && (
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              {npcs.map((n) => (
                <div key={n.id} className="flex flex-col items-center gap-1">
                  <img src={n.portrait} alt={n.name} className="npc-portrait size-10 rounded-full border border-gold/30 object-cover" />
                  <span className="text-[11px] text-paper/70">{n.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-lg text-gold" data-travel-left>
        남은 시간: {left > 0 ? leftText(left) : '거의 다 됐다'}
      </p>
      {typeof onFastTravel === 'function' && (
        <button
          type="button"
          className="mt-4 flat-chip inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onFastTravel}
          disabled={!canFast}
          data-fast-travel
          title={canFast ? '' : '의지력이 부족하다'}
        >
          <Zap size={16} aria-hidden />
          빠른 이동 (의지력 -{fastCost})
        </button>
      )}
    </section>
  )
}
