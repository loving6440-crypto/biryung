// 비령 vC.06 — 조사 장소의 [이 장소에서 받을 수 있는 퀘스트]. 그 장소에서 받고, 그 장소로 돌아와 마친다(npcQuests.js).
import { useState } from 'react'
import { bridge } from './bridge.js'
import { NPCS, rewardText, goalText } from './npcQuests.js'

// vC.06 메인 인물 그림(config.js 의 BIRYEONG_PORTRAITS) — 부탁을 마칠 수 있을 때는 웃는 얼굴
const faceOf = (name, mood) => { const p = globalThis.BIRYEONG_PORTRAITS?.[name]; if (!p) return null; if (typeof p === 'string') return p; return p[mood] || p.base }
export default function NpcQuests({ place }) {
  const api = bridge.api
  const [said, setSaid] = useState({}) // 방금 받거나 마쳤을 때의 한마디
  const [, setTick] = useState(0)
  if (!api?.npcPlace || !place) return null
  const rows = api.npcPlace(place)
  if (!rows.length && !Object.keys(said).length) return null
  const act = (kind, id) => { const line = api.npcAct(kind, id); if (line != null) { setSaid((m) => ({ ...m, [id]: line })); setTick((x) => x + 1) } }
  return (
    <section className="mt-4 rounded-lg border border-gold/25 bg-shade/25 p-3" aria-label="이 장소에서 받을 수 있는 퀘스트" data-npc-quests={place}>
      <p className="text-[12px] tracking-wide text-gold">[이 장소에서 받을 수 있는 퀘스트]</p>
      <ul className="mt-2 space-y-3">
        {rows.map(({ q, state, pr, line, reward, full }) => {
          const who = NPCS[q.npc]
          return (
            <li key={q.id} data-npc-quest={q.id} data-state={state}>
              <div className="flex gap-3">
              {faceOf(who.name, 'base') && <img src={faceOf(who.name, state === 'active' && pr?.done ? 'smile' : 'base')} alt={`${who.name} 초상`} className="size-14 flex-none border border-gold/50 bg-[#0b1522] object-cover" />}
              <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-2 text-[13px]">
                <b style={{ color: who.color }}>{who.name}</b>
                <span className="text-paper">「{q.title}」</span>
                <span className="text-[10px] text-paper/50">{goalText(q)}{pr ? ` · ${pr.cur} / ${pr.need}` : ''} · 보상 {rewardText(reward)}</span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed break-keep text-paper/85">“{said[q.id] ?? line}”</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {state === 'offer' && <button type="button" disabled={full} onClick={() => act('accept', q.id)} className="flat-btn !px-2 !py-0.5 text-[11px] disabled:opacity-40">{full ? '부탁은 다섯 건까지' : '부탁을 받는다'}</button>}
                {state === 'active' && pr?.done && <button type="button" onClick={() => act('finish', q.id)} className="flat-btn !px-2 !py-0.5 text-[11px]">{q.goal.type === 'deliver' ? '건넨다' : '알린다'}</button>}
                {state === 'active' && <button type="button" onClick={() => { if (window.confirm(`「${q.title}」을(를) 그만둘까? (지금까지 센 것은 사라진다)`)) act('abandon', q.id) }} className="flat-btn-ghost !px-2 !py-0.5 text-[11px]">그만둔다</button>}
              </div>
              </div></div>
            </li>
          )
        })}
        {Object.entries(said).filter(([id]) => !rows.some((r) => r.q.id === id)).map(([id, line]) => <li key={id} className="text-[13px] leading-relaxed text-paper/70">“{line}”</li>)}
      </ul>
    </section>
  )
}
