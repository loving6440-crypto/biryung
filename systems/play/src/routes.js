// 비령 play — 바로가기 주소 목록.
// 실행 화면은 play/index.html#<주소> 로 바로 열린다. 메인 화면 · 다른 페이지에서 이 주소로 링크하면 된다.
//   예) play/index.html#battle/scarecrow   play/index.html#lesson/talisman-2048   play/index.html#pioneer/left-trail-3
// 새 화면을 붙이면 여기에 한 줄, App.jsx 의 SCREENS 에 한 줄을 더한다.
import { ENEMIES, BESTIARY_ENEMIES } from '@vault/game/battle.js'
import { COURSES } from '@vault/game/constants.js'
import { HUNT_PATHS, HUNT_SITES } from '@vault/game/huntSites.js'

export const ROUTE_GROUPS = [
  { title: '전투', items: [
    { path: 'battle', label: '퇴마 실습', note: '실습 상대 7종 · 전투 튜토리얼' },
    ...ENEMIES.map((e) => ({ path: `battle/${e.id}`, label: e.name, note: `실습 · ${e.tier ?? ''}단계` })),
    { path: 'extra', label: '추가전투', note: '전투 데이터 50종 · 단계 고르기' },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => ({ path: `extra/${t}`, label: `추가전투 ${t}단계`, note: BESTIARY_ENEMIES.filter((e) => e.tier === t).map((e) => e.name).join(' · ') })),
    ...BESTIARY_ENEMIES.map((e) => ({ path: `battle/${e.id}`, label: e.name, note: `${e.tier}단계 · ${e.role ?? ''}`, hidden: true })),
  ] },
  { title: '개척', items: [
    { path: 'pioneer', label: '개척', note: `터 ${Object.keys(HUNT_SITES).length}곳 고르기` },
    ...HUNT_PATHS.flatMap((p) => p.sites.map((s) => ({ path: `pioneer/${s.id}`, label: s.name, note: '바로 들어가기' }))),
  ] },
  { title: '제작', items: [
    { path: 'workshop', label: '공작소', note: '제작 · 제작법' },
    { path: 'kitchen', label: '조리실', note: '조리 · 요리법' },
  ] },
  { title: '수업', items: [
    { path: 'lesson', label: '수업 고르기', note: '미니게임 6종' },
    ...COURSES.map((c) => ({ path: `lesson/${c.id}`, label: c.title, note: c.game })),
  ] },
  { title: '생활', items: [
    { path: 'inventory', label: '소지품', note: '쓰기 · 착용 · 가방' },
    { path: 'store', label: '매점', note: '구매 · 판매 · 제작법' },
    { path: 'armory', label: '무구보관소', note: '무구 강화' },
    { path: 'garden', label: '텃밭', note: '씨앗 · 비닐하우스' },
    { path: 'train', label: '수련', note: '기숙사 수련' },
    { path: 'sleep', label: '잠', note: '기숙사 휴식' },
    { path: 'rest', label: '양호실', note: '휴식 · 상담' },
    { path: 'stats', label: '스탯 올리기', note: '영력으로 육조 올리기' },
  ] },
]

export const ALL_ROUTES = ROUTE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })))

export function parseHash(hash = location.hash) {
  const raw = decodeURIComponent(String(hash).replace(/^#\/?/, ''))
  const [screen = '', arg = null] = raw.split('/')
  return { screen, arg, path: raw }
}
