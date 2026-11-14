// 비령 play — 실행 화면 부품. 메인 화면이 정해 준 주소(bridge.setRoute)에 맞는 화면 하나만 그린다.
// 머리글 · 뒤로가기 · 나의 상태 창은 메인 화면(index.html · app.js)의 몫이다. 여기에는 화면 본문과 창(소지품 · 확인)만 있다.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Battle from '@vault/ui/components/locations/Battle.jsx'
import HuntBattleModal from '@vault/ui/components/HuntBattleModal.jsx'
import HuntField from '@vault/ui/components/locations/HuntField.jsx'
import Workshop from '@vault/ui/components/locations/Workshop.jsx'
import Cooking from '@vault/ui/components/locations/Cooking.jsx'
import GameModal from '@vault/ui/components/GameModal.jsx'
import Store from '@vault/ui/components/locations/Store.jsx'
import Armory from '@vault/ui/components/locations/Armory.jsx'
import Garden from '@vault/ui/components/locations/Garden.jsx'
import Dormitory from '@vault/ui/components/locations/Dormitory.jsx'
import Infirmary from '@vault/ui/components/locations/Infirmary.jsx'
import InventoryModal from '@vault/ui/components/InventoryModal.jsx'
import MainHall from '@vault/ui/components/locations/MainHall.jsx'
import Annex from '@vault/ui/components/locations/Annex.jsx'
import Gym from '@vault/ui/components/locations/Gym.jsx'
import Shrine from '@vault/ui/components/locations/Shrine.jsx'
import Cafeteria from '@vault/ui/components/locations/Cafeteria.jsx'
import { BESTIARY_ENEMIES, enemyById, REC_STATS } from '@vault/game/battle.js'
import { COURSES, TIER_HANJA } from '@vault/game/constants.js'
import { COURSE_INFO } from '@vault/game/courseInfo.js'
import { HUNT_SITES } from '@vault/game/huntSites.js'
import { parseHash } from './routes.js'
import { usePlayHost } from './usePlayHost.js'
import { bridge } from './bridge.js'

function ExtraPicker({ tier, children }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="단계 선택">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
          <button type="button" key={t} onClick={() => bridge.nav(`extra/${t}`)} aria-current={t === tier ? 'page' : undefined} title={`${t}단계 · 모든 스탯 ${REC_STATS[t]}`}
            className={`tilt grid size-9 place-items-center font-serif text-sm ${t === tier ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}>{TIER_HANJA[t - 1] ?? t}</button>
        ))}
      </div>
      {children}
    </div>
  )
}

/** 퇴마 실습장: 실습 상대와 추가전투(금역 깊은 곳의 50종)를 한자리에서 고른다. */
function BattleHall({ battleProps, onFinish }) {
  const [mode, setMode] = useState('practice')
  const [tier, setTier] = useState(1)
  const tab = (id, label) => (
    <button type="button" key={id} onClick={() => setMode(id)} aria-pressed={mode === id} data-battle-mode={id}
      className={`tilt px-3 py-1.5 font-serif text-sm ${mode === id ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}>{label}</button>
  )
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="전투 종류">{tab('practice', '퇴마 실습')}{tab('extra', '추가전투')}</div>
      {mode === 'practice' ? <Battle key="practice" {...battleProps} onFinish={onFinish} multi={null} /> : (
        <div data-extra-battle>
          <p className="mb-2 text-[11px] leading-relaxed text-paper/60">실습장 뒤편 결계 너머, 금역에서 끌어온 것들. 단계마다 다섯 — 혼자 상대할 셋, 여럿이 상대할 하나, 우두머리 하나. 이긴 보상은 퇴마 실습과 같은 하루 한도를 나눠 쓴다.</p>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="단계 선택">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
              <button type="button" key={t} onClick={() => setTier(t)} aria-pressed={t === tier} data-extra-tier={t} title={`${t}단계 · 모든 스탯 ${REC_STATS[t]}`}
                className={`tilt grid size-9 place-items-center font-serif text-sm ${t === tier ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}>{TIER_HANJA[t - 1] ?? t}</button>
            ))}
          </div>
          <Battle key={`extra-${tier}`} {...battleProps} roster={BESTIARY_ENEMIES.filter((e) => e.tier === tier)} onFinish={onFinish} multi={null} />
        </div>
      )}
    </div>
  )
}

function LessonList() {
  return (
    <section aria-label="수업" className="grid gap-2 sm:grid-cols-2">
      {COURSES.map((c) => (
        <button type="button" key={c.id} onClick={() => bridge.nav(`lesson/${c.id}`)} className="ink-panel tilt block p-4 text-left hover:bg-gold-fill/10" data-course={c.id}>
          <span className="font-serif text-lg text-paper">{c.title}</span> <span className="text-xs text-paper/60">{c.game}</span>
          <span className="mt-1 block text-xs text-paper/70">{COURSE_INFO[c.id]?.short ?? c.note}</span>
        </button>
      ))}
    </section>
  )
}

export default function App() {
  const path = useSyncExternalStore(bridge.subscribe, bridge.getRoute)
  const route = parseHash(path ?? '')
  const host = usePlayHost()
  const { player, effStats, handlers: H, battleProps, admin } = host
  const [openCourse, setOpenCourse] = useState(null) // 본관 [수업]에서 연 과목(주소는 그대로 둔다)

  // pioneer/<터> : 아직 개척 중이 아니면 그 터로 바로 들어간다.
  useEffect(() => {
    if (path != null && route.screen === 'pioneer' && route.arg && HUNT_SITES[route.arg] && player && player.huntExpedition?.status !== 'active') H.huntAction({ type: 'enter', siteId: route.arg })
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) return null

  const enemy = route.screen === 'battle' && route.arg ? enemyById(route.arg) : null
  const tier = route.screen === 'extra' ? Math.min(10, Math.max(1, Number(route.arg) || 1)) : null
  const routeCourse = path != null && route.screen === 'lesson' && route.arg ? COURSES.find((c) => c.id === route.arg) : null
  const course = routeCourse ?? (path != null ? openCourse : null)
  const [, loc, act = 'intro'] = route.screen === 'at' ? route.path.split('/') : []
  const enter = (id) => bridge.nav(`at/${id}`)
  const craftProps = { onCraft: H.craftItem, onBench: H.benchCraftAct, onKnownCraft: H.knownCraftAct, onStopCraft: H.endCraft, onCook: H.cookItem }
  const encounter = player.huntExpedition?.status === 'active' ? player.huntExpedition.encounter : null

  let screen = null
  if (path != null) {
    switch (route.screen) {
      // at/<곳>/<할 일> — 초록동색의 장소 화면 그대로. 그 자리에 가면 그 자리의 기능이 나온다.
      case 'at':
        if (loc === 'mainHall') screen = <MainHall key={act} player={player} view={act} onOpenCourse={setOpenCourse} onInvestigate={H.investigate} onEnter={enter} onLockerMove={H.lockerMove} onLockerOpen={H.lockerOpen} onVisit={H.visitSpot} onExploreAct={H.exploreAct} />
        else if (loc === 'annex') screen = <Annex key={act} view={act} player={player} admin={admin} {...craftProps} online={false} onMeet={H.meetNpc} onLineSeen={H.lineSeen} onGiveNpc={H.giveNpc} onHoljjak={H.holjjak} myClub={host.club} onApplyClub={H.applyClub} onFetchMembers={H.fetchClubMembers} onVisit={H.visitSpot} onExploreAct={H.exploreAct} />
        else if (loc === 'gym' && act === 'battle') screen = <BattleHall battleProps={battleProps} onFinish={H.finishBattle} />
        else if (loc === 'gym') screen = <Gym key={act} view={act} player={player} admin={admin} onMeet={H.meetNpc} onEnhance={H.enhance} onSpecialEnhance={H.specialEnhance} onRemoveSpecial={H.removeSpecial} onTokenExchange={H.tokenExchange} onAdminGive={H.adminGive} onGardenAction={H.gardenAction} online={false} onHuntAction={H.huntAction} onVisit={H.visitSpot} onGiveNpc={H.giveNpc} onExploreAct={H.exploreAct} {...battleProps} stats={effStats} onFinish={H.finishBattle} multi={null} />
        else if (loc === 'shrine') screen = <Shrine key={act} view={act} player={player} onMeet={H.meetNpc} onLineSeen={H.lineSeen} onGiveNpc={H.giveNpc} onExploreAct={H.exploreAct} onEnter={enter} onInvestigate={H.investigateShrine} onVisit={H.visitSpot} />
        else if (loc === 'infirmary') screen = <Infirmary view={act} player={player} onStartRest={H.beginRest} onStopRest={H.endRest} />
        else if (loc === 'dorm' && act === 'store') screen = <Store player={player} onBuy={H.buyItem} onSell={H.sellToStore} onBuyRecipe={H.buyRecipe} onMeet={H.meetNpc} onLineSeen={H.lineSeen} admin={admin} onGiveNpc={H.giveNpc} />
        else if (loc === 'dorm' && act === 'cafeteria') screen = <Cafeteria online={false} onSubmitted={() => {}} />
        else if (loc === 'dorm') screen = <Dormitory view={act} control={effStats.control} spirit={player.spirit} training={player.training ?? null} sleeping={player.sleeping ?? null} onStartTraining={H.beginTraining} onStopTraining={H.endTraining} onStartSleep={H.beginSleep} onStopSleep={H.endSleep} />
        else screen = <p className="text-sm text-crimson">없는 곳: {route.path}</p>
        break
      case 'battle':
        screen = route.arg && !enemy ? <p className="text-sm text-crimson">없는 상대: {route.arg}</p>
          : <Battle key={route.path} {...battleProps} encounter={enemy ?? undefined} onFinish={H.finishBattle} multi={null} />
        break
      case 'extra':
        screen = <ExtraPicker tier={tier}><Battle key={route.path} {...battleProps} roster={BESTIARY_ENEMIES.filter((e) => e.tier === tier)} onFinish={H.finishBattle} multi={null} /></ExtraPicker>
        break
      case 'pioneer': screen = <HuntField player={player} stats={effStats} onAction={H.huntAction} />; break
      case 'workshop': screen = <Workshop player={player} admin={admin} onCraft={H.craftItem} onBench={(list) => H.benchCraftAct('workshop', list)} onKnownCraft={(id, q) => H.knownCraftAct('workshop', id, q)} onStopCraft={H.endCraft} online={false} />; break
      case 'kitchen': screen = <Cooking player={player} admin={admin} onCook={H.cookItem} onBench={(list) => H.benchCraftAct('kitchen', list)} onKnownCraft={(id, q) => H.knownCraftAct('kitchen', id, q)} online={false} />; break
      case 'lesson': screen = <LessonList />; break
      case 'store': screen = <Store player={player} onBuy={H.buyItem} onSell={H.sellToStore} onBuyRecipe={H.buyRecipe} onMeet={H.meetNpc} onLineSeen={H.lineSeen} onGiveNpc={H.giveNpc} />; break
      case 'armory': screen = <Armory player={player} part="manage" onEnhance={H.enhance} onSpecialEnhance={H.specialEnhance} onRemoveSpecial={H.removeSpecial} onTokenExchange={H.tokenExchange} onMeet={H.meetNpc} admin={admin} onGiveNpc={H.giveNpc} />; break
      case 'garden': screen = <Garden player={player} onGardenAction={H.gardenAction} onMeet={H.meetNpc} online={false} />; break
      case 'train':
      case 'sleep':
        screen = <Dormitory view={route.screen === 'sleep' ? 'sleep' : 'train'} control={effStats.control} spirit={player.spirit} training={player.training ?? null} sleeping={player.sleeping ?? null} onStartTraining={H.beginTraining} onStopTraining={H.endTraining} onStartSleep={H.beginSleep} onStopSleep={H.endSleep} />
        break
      case 'rest': screen = <Infirmary view="rest" player={player} onStartRest={H.beginRest} onStopRest={H.endRest} />; break
      case '': break
      default: screen = <p className="text-sm text-crimson">없는 화면: {route.path}</p>
    }
  }

  return (
    <>
      {screen}

      {course && (
        <GameModal course={course} onClose={() => { if (routeCourse) bridge.back(); else setOpenCourse(null) }} playerKey={`biryeong-${player.createdAt ?? 'local'}`} playerName={player.name}
          stats={effStats} lesson={H.lessonOf(course.id)} actions={H.lessonActions} player={player} onSkin={H.setSkin2048} onSkinRunner={H.setSkinRunner} admin={admin} />
      )}

      {encounter && path != null && (route.screen === 'pioneer' || (route.screen === 'at' && loc === 'gym')) && (
        <HuntBattleModal key={encounter.enemy?.id ?? 'enc'} encounter={encounter.enemy} {...battleProps} onFinish={H.finishHuntBattle} />
      )}

      {/* 소지품 창은 어느 페이지에서나 떠야 하므로(실행 화면 칸이 감춰져 있어도) 바깥의 #playPortal 에 그린다. */}
      {host.invOpen && createPortal(
        <InventoryModal player={player} inBattle={host.battleActive} reviveOn={host.reviveOn} boostOn={host.boostOn} usedItems={host.battleUsedItems}
          onUse={(id, target, n = 1) => { const times = host.battleActive ? 1 : Math.max(1, Math.floor(n) || 1); return (async () => { for (let i = 0; i < times; i++) await H.useItem(id, target) })() }}
          onDiscard={H.discardItem} onEquip={H.equip} onUnequip={H.unequip} onClaimPending={H.claimInventoryPending} onBag={H.bagAction}
          onClose={() => host.setInvOpen(false)} online={false} />
      , document.getElementById('playPortal') ?? document.body)}

      {host.confirm && (
        <div className="modal-scrim fixed inset-0 z-[90] grid place-items-center p-4">
          <div role="alertdialog" aria-modal="true" className="ink-panel w-full max-w-sm p-5">
            <p className="text-sm leading-relaxed text-paper">{host.confirm.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="flat-btn-ghost text-xs" onClick={() => host.setConfirm(null)}>계속하기</button>
              <button type="button" className="flat-btn text-xs" onClick={() => { const r = host.confirm.run; host.setConfirm(null); r() }}>그만두고 진행</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
