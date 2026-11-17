// 비령 vC.07.3 — 추가전투 · 퇴마 실습의 상대 카드 밑 [일행과 함께 겨루기]. 도깨비들의 터 일행(둘 이상)이 있을 때만 보인다.
import { useEffect, useState } from 'react'
import { bridge } from './bridge.js'

const roomNow = () => { const r = globalThis.BiryeongParty?.room; return r && (r.members?.length || 0) >= 2 ? r : null }
export default function RoomFight({ enemy, disabled }) {
  const [room, setRoom] = useState(roomNow)
  useEffect(() => { const t = setInterval(() => setRoom(roomNow()), 3000); return () => clearInterval(t) }, [])
  if (!room) return null
  const others = room.members.length - 1
  return (
    <>
      <button type="button" data-room-fight={enemy.id} disabled={disabled} onClick={() => bridge.api?.roomFight?.(enemy.id)} className="flat-btn mt-2 justify-center !border-[#8fbaff88] text-[#cfe0ff]">
        일행과 함께 겨루기
      </button>
      <p className="mt-1 text-[10px] text-paper/50">도깨비들의 터 일행 {others}명에게 알림이 간다. 세 명까지 · 체력은 모인 사람 수에 맞춘다.</p>
    </>
  )
}
