// 비령 play — 실행 화면 틀. 주소(#battle/scarecrow 등)에 맞는 초록동색 화면을 띄운다.
import { useEffect, useMemo, useState } from 'react'
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
import StatusPanel from '@vault/ui/components/StatusPanel.jsx'
import { BESTIARY_ENEMIES, ENEMIES, enemyById, REC_STATS } from '@vault/game/battle.js'
import { COURSES, TIER_HANJA } from '@vault/game/constants.js'
import { COURSE_INFO } from '@vault/game/courseInfo.js'
import { HUNT_SITES } from '@vault/game/huntSites.js'
import { ROUTE_GROUPS, ALL_ROUTES, parseHash } from './routes.js'
import { usePlayHost } from './usePlayHost.js'

const embedded = (() => { try { return window.self !== window.top } catch { return true } })()
const go = (path) => { location.hash = path ? `#${path}` : '' }
const closeOrHome = () => { if (embedded) window.parent.postMessage({ type: 'biryeong-play-close' }, location.origin); else go('') }

function useRoute() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function Bar({ label, value, max, tone }) {
  return (
    <div className="min-w-0 flex-1" title={`${label} ${Math.floor(value)} / ${max}`}>
      <div className="flex justify-between text-[10px] text-paper/70"><span>{label}</span><span className="tabular-nums">{Math.floor(value)}/{max}</span></div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-shade/60"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
    </div>
  )
}

function Home() {
  const [showAll, setShowAll] = useState(false)
  return (
    <section aria-label="바로 실행" className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-gold">바로 실행</h1>
        <p className="mt-1 text-sm text-paper/70">원하는 화면을 바로 연다. 주소 뒤의 <code className="text-gold">#…</code> 를 그대로 링크하면 그 화면이 바로 열린다.</p>
      </div>
      {ROUTE_GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="font-serif text-lg text-paper">{g.title}</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.filter((i) => showAll || !i.hidden).map((i) => (
              <a key={i.path} href={`#${i.path}`} className="ink-panel tilt block rounded-lg px-3 py-2.5 hover:bg-gold-fill/10" data-route={i.path}>
                <span className="block text-sm text-paper">{i.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-paper/55">{i.note}</span>
                <span className="mt-1 block font-mono text-[10px] text-gold/70">#{i.path}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="flat-btn-ghost text-xs" onClick={() => setShowAll((v) => !v)}>{showAll ? '추가전투 적 개별 주소 숨기기' : `추가전투 적 ${BESTIARY_ENEMIES.length}종의 개별 주소도 보기`}</button>
    </section>
  )
}

function ExtraPicker({ tier, children }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="단계 선택">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => (
          <a key={t} href={`#extra/${t}`} aria-current={t === tier ? 'page' : undefined} title={`${t}단계 · 모든 스탯 ${REC_STATS[t]}`}
            className={`tilt grid size-9 place-items-center rounded-full font-serif text-sm ${t === tier ? 'bg-gold-fill text-ink' : 'bg-edge/[0.07] text-paper/85 hover:bg-gold-fill/20'}`}>{TIER_HANJA[t - 1] ?? t}</a>
        ))}
      </div>
      {children}
    </div>
  )
}

function LessonList() {
  return (
    <section aria-label="수업">
      <h2 className="font-serif text-2xl text-gold">수업</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {COURSES.map((c) => (
          <a key={c.id} href={`#lesson/${c.id}`} className="ink-panel tilt block rounded-lg p-4 hover:bg-gold-fill/10">
            <span className="font-serif text-lg text-paper">{c.title}</span> <span className="text-xs text-paper/60">{c.game}</span>
            <span className="mt-1 block text-xs text-paper/70">{COURSE_INFO[c.id]?.short ?? c.note}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const route = useRoute()
  const host = usePlayHost()
  const { player, effStats, handlers: H, battleProps } = host
  const known = useMemo(() => new Set(ALL_ROUTES.map((r) => r.path.split('/')[0])), [])
  const label = ALL_ROUTES.find((r) => r.path === route.path)?.label ?? ALL_ROUTES.find((r) => r.path === route.screen)?.label

  // #pioneer/<터> : 아직 개척 중이 아니면 그 터로 바로 들어간다.
  useEffect(() => {
    if (route.screen === 'pioneer' && route.arg && HUNT_SITES[route.arg] && player && player.huntExpedition?.status !== 'active') H.huntAction({ type: 'enter', siteId: route.arg })
  }, [route.screen, route.arg]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-items-center p-6 text-center">
        <div className="ink-panel rounded-xl p-6">
          <p className="font-serif text-xl text-gold">먼저 내 프로필을 만들어 주세요</p>
          <p className="mt-2 text-sm text-paper/70">실행 화면은 메인 화면에서 만든 프로필(이름 · 육조 스탯)로 플레이한다.</p>
          <a href="../index.html" target={embedded ? '_top' : undefined} className="flat-btn mt-4 inline-flex">비령 메인으로</a>
        </div>
      </main>
    )
  }

  const enemy = route.screen === 'battle' && route.arg ? enemyById(route.arg) : null
  const tier = route.screen === 'extra' ? Math.min(10, Math.max(1, Number(route.arg) || 1)) : null
  const course = route.screen === 'lesson' && route.arg ? COURSES.find((c) => c.id === route.arg) : null
  const encounter = player.huntExpedition?.status === 'active' ? player.huntExpedition.encounter : null

  let screen
  switch (route.screen) {
    case '': screen = <Home />; break
    case 'battle':
      screen = route.arg && !enemy ? <p className="text-sm text-crimson">없는 적: {route.arg}</p>
        : <Battle key={route.path} {...battleProps} encounter={enemy ?? undefined} onFinish={H.finishBattle} multi={null} />
      break
    case 'extra':
      screen = <ExtraPicker tier={tier}><Battle key={route.path} {...battleProps} roster={BESTIARY_ENEMIES.filter((e) => e.tier === tier)} onFinish={H.finishBattle} multi={null} /></ExtraPicker>
      break
    case 'pioneer': screen = <HuntField player={player} stats={effStats} onAction={H.huntAction} />; break
    case 'workshop': screen = <Workshop player={player} admin={false} onCraft={H.craftItem} onBench={(list) => H.benchCraftAct('workshop', list)} onKnownCraft={(id, q) => H.knownCraftAct('workshop', id, q)} onStopCraft={H.endCraft} online={false} />; break
    case 'kitchen': screen = <Cooking player={player} admin={false} onCook={H.cookItem} onBench={(list) => H.benchCraftAct('kitchen', list)} onKnownCraft={(id, q) => H.knownCraftAct('kitchen', id, q)} online={false} />; break
    case 'lesson': screen = <LessonList />; break
    case 'store': screen = <Store player={player} onBuy={H.buyItem} onSell={H.sellToStore} onBuyRecipe={H.buyRecipe} onMeet={H.meetNpc} onLineSeen={H.lineSeen} onGiveNpc={H.giveNpc} />; break
    case 'armory': screen = <Armory player={player} part="manage" onEnhance={H.enhance} onSpecialEnhance={H.specialEnhance} onRemoveSpecial={H.removeSpecial} onTokenExchange={H.tokenExchange} onMeet={H.meetNpc} admin={false} onGiveNpc={H.giveNpc} />; break
    case 'garden': screen = <Garden player={player} onGardenAction={H.gardenAction} onMeet={H.meetNpc} online={false} />; break
    case 'train':
    case 'sleep':
      screen = <Dormitory view={route.screen === 'sleep' ? 'sleep' : 'train'} control={effStats.control} spirit={player.spirit} training={player.training ?? null} sleeping={player.sleeping ?? null} onStartTraining={H.beginTraining} onStopTraining={H.endTraining} onStartSleep={H.beginSleep} onStopSleep={H.endSleep} />
      break
    case 'rest': screen = <Infirmary view="rest" player={player} onStartRest={H.beginRest} onStopRest={H.endRest} />; break
    case 'stats': screen = <StatusPanel player={player} eff={effStats} onUpgrade={H.upgradeStat} />; break
    case 'inventory': screen = <p className="text-sm text-paper/70">소지품 창이 열려 있다.</p>; break
    default: screen = <p className="text-sm text-crimson">없는 주소: #{route.path}</p>
  }
  const invVisible = host.invOpen || route.screen === 'inventory'

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-edge/15 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <nav className="flex items-center gap-2 text-sm">
            {route.screen && <a href="#" className="flat-btn-ghost !px-2 !py-1 text-xs">◂ 바로 실행</a>}
            <span className="font-serif text-gold">{route.screen ? (label ?? route.screen) : '비령 · 실행'}</span>
          </nav>
          <div className="flex min-w-[220px] flex-1 items-center gap-3">
            <Bar label="체력" value={player.hp} max={player.hpMax} tone="bg-crimson" />
            <Bar label="의지력" value={player.mp} max={player.mpMax} tone="bg-jade" />
            <Bar label="영력" value={player.spirit} max={500} tone="bg-gold" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="tabular-nums text-paper/80" title="소지금">{Math.floor(player.money ?? 0)}냥</span>
            <button type="button" className="flat-btn-ghost !px-2 !py-1 text-xs" onClick={() => host.setInvOpen(true)}>소지품</button>
            {embedded
              ? <button type="button" className="flat-btn !px-2 !py-1 text-xs" onClick={closeOrHome}>닫기</button>
              : <a href="../index.html" className="flat-btn-ghost !px-2 !py-1 text-xs">비령 메인</a>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {!known.has(route.screen) && route.screen !== '' ? <p className="text-sm text-crimson">없는 주소: #{route.path}</p> : screen}
        {host.logs.length > 0 && (
          <details className="ink-panel mt-6 rounded-lg p-3 text-xs" open={false}>
            <summary className="cursor-pointer text-paper/75">활동 기록 <span className="text-paper/50">— {host.logs.at(-1).message}</span></summary>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-[11px] text-paper/70">
              {[...host.logs].reverse().map((l) => <li key={l.id}><span className="text-gold/70">[{l.time}]</span> {l.message}</li>)}
            </ul>
          </details>
        )}
      </main>

      {course && (
        <GameModal course={course} onClose={() => go('lesson')} playerKey={`biryeong-${player.createdAt ?? 'local'}`} playerName={player.name}
          stats={effStats} lesson={H.lessonOf(course.id)} actions={H.lessonActions} player={player} onSkin={H.setSkin2048} onSkinRunner={H.setSkinRunner} admin={false} />
      )}

      {encounter && (
        <HuntBattleModal key={encounter.enemy?.id ?? 'enc'} encounter={encounter.enemy} {...battleProps} onFinish={H.finishHuntBattle} />
      )}

      {invVisible && (
        <InventoryModal player={player} inBattle={host.battleActive} reviveOn={host.reviveOn} boostOn={host.boostOn} usedItems={host.battleUsedItems}
          onUse={(id, target, n = 1) => { const times = host.battleActive ? 1 : Math.max(1, Math.floor(n) || 1); return (async () => { for (let i = 0; i < times; i++) await H.useItem(id, target) })() }}
          onDiscard={H.discardItem} onEquip={H.equip} onUnequip={H.unequip} onClaimPending={H.claimInventoryPending} onBag={H.bagAction}
          onClose={() => { host.setInvOpen(false); if (route.screen === 'inventory') { if (embedded) closeOrHome(); else go('') } }} online={false} />
      )}

      {host.confirm && (
        <div className="modal-scrim fixed inset-0 z-[90] grid place-items-center p-4">
          <div role="alertdialog" aria-modal="true" className="ink-panel w-full max-w-sm rounded-xl p-5">
            <p className="text-sm leading-relaxed text-paper">{host.confirm.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="flat-btn-ghost text-xs" onClick={() => host.setConfirm(null)}>계속하기</button>
              <button type="button" className="flat-btn text-xs" onClick={() => { const r = host.confirm.run; host.setConfirm(null); r() }}>그만두고 진행</button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[95] flex max-w-xs flex-col gap-2" aria-live="polite">
        {host.notice && <div className="ink-panel rounded-lg border border-gold/40 px-3 py-2 text-xs text-paper">{host.notice.text}</div>}
        {host.toasts.slice(0, 3).map((t) => (
          <button key={t.key} type="button" className="ink-panel pointer-events-auto rounded-lg border border-gold/40 px-3 py-2 text-left text-xs text-paper" onClick={() => host.setToasts((all) => all.filter((x) => x.key !== t.key))}>
            <span className="block text-[10px] text-gold">업적 달성</span>{t.ach?.name ?? '업적'}
          </button>
        ))}
      </div>
    </div>
  )
}
