import { useEffect, useState } from 'react'
import LocationIntro from '../LocationIntro'
import { ANNEX_FLOORS } from '../../../game/annex'
import { NPC_SLOTS, npcName, npcPresent } from '../../../game/npcSlots'
import { pickNpcLine } from '../../../game/npcLines'
import NpcDialog from '../NpcDialog'
import NpcGift from '../NpcGift'
import ClubRoomPanel from '../ClubRoomPanel'
import BoardGames from './BoardGames'
import Workshop from './Workshop'
import Cooking from './Cooking'
import Scene, { Paras } from '../Scene'

/** 공작소: 제작 / 미술 동아리 */
function CraftRoom({ player, admin, onCraft, onStopCraft, myClub, onApplyClub, onFetchMembers, online, onBench, onKnownCraft }) {
  const [tab, setTab] = useState('craft') // craft | club

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="공작소 활동">
        {[
          ['craft', '제작하기'],
          ['club', '미술 동아리'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`tilt rounded-full px-4 py-1.5 text-sm ${tab === id ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'craft' ? (
        <Workshop player={player} admin={admin} onCraft={onCraft} onBench={(list) => onBench?.('workshop', list)} onKnownCraft={(id, q) => onKnownCraft?.('workshop', id, q)} onStopCraft={onStopCraft} online={online} />
      ) : (
        <ClubRoomPanel clubId="craft" myClub={myClub} onApply={onApplyClub} onFetchMembers={onFetchMembers} />
      )}
    </div>
  )
}

/** 패 놀이터: 놀이하기 / 판놀이 동아리 */
function BoardRoom({ player, admin, onHoljjak, myClub, onApplyClub, onFetchMembers }) {
  const [tab, setTab] = useState('play')
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="패 놀이터 활동">
        {[
          ['play', '놀이하기'],
          ['club', '판놀이 동아리'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`tilt rounded-full px-4 py-1.5 text-sm ${tab === id ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'play' ? (
        <BoardGames player={player} admin={admin} onHoljjak={onHoljjak} />
      ) : (
        <ClubRoomPanel clubId="board" myClub={myClub} onApply={onApplyClub} onFetchMembers={onFetchMembers} />
      )}
    </div>
  )
}

/** 조리실: 조리(조리실 NPC 자리 kitchenKeeper) / 요리 동아리 */
const KITCHEN_KEEPER = NPC_SLOTS.kitchenKeeper
function CookRoom({ player, admin, onCook, onBench, onKnownCraft, onMeet, onLineSeen, onGiveNpc, myClub, onApplyClub, onFetchMembers, online, onExploreAct }) {
  const [tab, setTab] = useState('cook')
  const [{ line }] = useState(() => pickNpcLine(KITCHEN_KEEPER.id, KITCHEN_KEEPER.lines, player, player.lineSeen))
  const present = npcPresent(KITCHEN_KEEPER)
  useEffect(() => {
    if (present) onMeet?.(KITCHEN_KEEPER.id)
  }, [onMeet, present])

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="조리실 활동">
        {[
          ['cook', '조리하기'],
          ['club', '요리 동아리'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`tilt rounded-full px-4 py-1.5 text-sm ${tab === id ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'cook' ? (
        <>
          {present && line && (
            <NpcDialog npc={npcName(KITCHEN_KEEPER)} src={KITCHEN_KEEPER.faces?.[line.face ?? 'plain'] ?? KITCHEN_KEEPER.src} face={line.face} dataNpc={KITCHEN_KEEPER.id}>
              {line.text}
            </NpcDialog>
          )}
          {present && <NpcGift npcId={KITCHEN_KEEPER.id} player={player} onGive={onGiveNpc} />}
          <Cooking player={player} admin={admin} onCook={onCook} onBench={(list) => onBench?.('kitchen', list)} onKnownCraft={(id, q) => onKnownCraft?.('kitchen', id, q)} online={online} />
        </>
      ) : (
        <ClubRoomPanel clubId="cook" myClub={myClub} onApply={onApplyClub} onFetchMembers={onFetchMembers} />
      )}
    </div>
  )
}

/** 동아리 부실만 있는 방(음악실 · 방송실 · 서적실 · 다도실 · 정원): 방 소개 + 동아리. */
function ClubOnlyRoom({ room, myClub, onApplyClub, onFetchMembers }) {
  return <ClubRoomPanel clubId={room.club} myClub={myClub} onApply={onApplyClub} onFetchMembers={onFetchMembers} />
}

/** 별관 탐사: 층 → 방 순으로 살핀다. 2층 공작소 · 패 놀이터는 전용 화면을, 그 외 동아리 방은 공용 동아리 화면을 더 보여 준다. */
export default function Annex({ view, player, admin, onCraft, onBench, onKnownCraft, onStopCraft, onCook, onMeet, onLineSeen, onGiveNpc, onHoljjak, myClub, onApplyClub, onFetchMembers, onVisit, onExploreAct, online }) {
  const [floorId, setFloorId] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [visit, setVisit] = useState(0)
  const floor = ANNEX_FLOORS.find((f) => f.id === floorId)
  const room = floor?.rooms.find((r) => r.id === roomId)

  if (view === 'intro') return <LocationIntro id="annex" />

  const pickFloor = (id) => {
    setFloorId(id)
    setRoomId(null)
  }
  const pickRoom = (r) => {
    setRoomId(r.id)
    setVisit((v) => v + 1)
    onVisit?.(`annex:${floor.id}:${r.id}`)
  }
  const ctx = { stats: player.stats, player, name: player.name, act: (kind, payload) => onExploreAct?.(kind, payload) ?? {} }
  const home = () => {
    setFloorId(null)
    setRoomId(null)
  }

  return (
    <section aria-label="별관 탐사">
      <h2 className="font-serif text-2xl text-gold">별관 탐사</h2>
      <p className="mt-1 text-sm text-paper/65">층을 고르고, 둘러볼 방을 누른다.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="층 선택">
        {ANNEX_FLOORS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === floorId}
            onClick={() => pickFloor(f.id)}
            className={`tilt rounded-full px-4 py-1.5 text-sm ${f.id === floorId ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {floor && (
        <div className="mt-4">
          {floor.intro?.length > 0 && (
            <div className="ink-panel mb-4 w-full rounded-xl p-5" data-annex-intro>
              <p className="font-serif text-lg text-paper">{floor.name}</p>
              <div className="mt-2">
                <Paras list={floor.intro} />
              </div>
            </div>
          )}
          <p className="text-[11px] tracking-widest text-paper/55">둘러볼 방</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="방 선택">
            {floor.rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === roomId}
                onClick={() => pickRoom(r)}
                className={`tilt rounded-xl px-4 py-2 text-sm text-paper ${r.id === roomId ? 'bg-gold-fill/30' : 'bg-edge/[0.07] hover:bg-gold-fill/20'}`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {room && (
            <div className="ink-panel mt-4 w-full rounded-xl p-5" aria-live="polite">
              <p className="text-[11px] tracking-widest text-gold">{floor.name} · {room.name}</p>
              <div className="mt-2">
                <Scene key={`${room.id}:${visit}`} root={room} ctx={ctx} scope={`annex:${floor.id}:${room.id}`} onHome={home} />
              </div>

              {room.id === 'craft' && (
                <CraftRoom
                  player={player}
                  admin={admin}
                  onCraft={onCraft}
                  onBench={onBench}
                  onKnownCraft={onKnownCraft}
                  onStopCraft={onStopCraft}
                  online={online}
                  myClub={myClub}
                  onApplyClub={onApplyClub}
                  onFetchMembers={onFetchMembers}
                />
              )}
              {room.id === 'board' && (
                <BoardRoom player={player} admin={admin} onHoljjak={onHoljjak} myClub={myClub} onApplyClub={onApplyClub} onFetchMembers={onFetchMembers} />
              )}
              {room.id === 'cook' && (
                <CookRoom
                  player={player}
                  admin={admin}
                  onCook={onCook}
                  onBench={onBench}
                  onKnownCraft={onKnownCraft}
                  online={online}
                  onMeet={onMeet}
                  onLineSeen={onLineSeen}
                  onGiveNpc={onGiveNpc}
                  myClub={myClub}
                  onApplyClub={onApplyClub}
                  onFetchMembers={onFetchMembers}
                  onExploreAct={onExploreAct}
                />
              )}
              {room.club && room.id !== 'craft' && room.id !== 'board' && room.id !== 'cook' && (
                <ClubOnlyRoom room={room} myClub={myClub} onApplyClub={onApplyClub} onFetchMembers={onFetchMembers} />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
