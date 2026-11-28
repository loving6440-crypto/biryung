import { WORKBOOK_STOLEN } from './userWorkbookData.js'
import { reconceptPractice, PRACTICE_RECONCEPT } from './practiceEnemies.js'
// 비령 vB.03 — 적의 영능력 빼앗기.
//
// · 같은 적을 30번 쓰러뜨리면 그 적의 영능력을 빼앗아 내 영능력으로 쓴다(보상 횟수 제한과는 상관없이 이긴 횟수를 센다).
// · 보스는 20번마다 하나씩: 20번째에 둘 중 하나(무작위), 40번째에 남은 하나. 영능력이 하나뿐인 보스는 20번째에 얻는다.
// · 일행 전투에서는 저마다 자기 횟수를 센다 — 조건을 채운 사람만 받는다.
// · 본편 이야기 전투(story-…)의 「수법」은 영능력이 아니라 세지 않는다.
//
// 빼앗은 영능력은 적이 쓰던 그대로가 아니라 「내 손에 맞게」 고친 판이다(밸런스).
//   피해는 적의 공격력이 아니라 내 일반 공격 굴림(2d호전 + d안목)을 바탕으로 한다 — 내가 강해질수록 함께 강해진다.
//   부적(빗나감 없는 2배, 3장)과 비교해 ① 의지력이 더 들거나 ② 배율이 낮은 대신 덤 효과가 붙는다. 보스의 것은 한 단계 더 세다.
//
// 이 파일은 자료와 세는 규칙만 둔다. 실제 전투 처리는 battle.js 의 psychicTurn 앞에 끼운 stolenTurn(patches.mjs)이 한다.

export const STEAL_NEED = 30
export const STEAL_NEED_BOSS = 20
export const STEAL_PREFIX = 'steal-'

// 개척 요괴(산귀신 · 목신 · 물귀신 · 앙괭이 · 어둑시니)와 묵은 원귀는 같은 「원한의 저주」를 쓴다 — 누구에게서 빼앗든 같은 영능력 하나다.
const CURSE_FROM = ['wonhon', 'mountain-ghost', 'tree-spirit', 'water-ghost', 'ang-gwaengi', 'eodukssini']

// 칸: mp 의지력 · m 일반 공격 굴림 배율 · n 횟수 · p 방어 태세 무시 · a [스탯, 비율] 덧붙는 피해 · ls 준 피해의 몇 할 회복 · g 의지력 되찾기
//     h 최대 체력의 몇 할 회복 · gd 막기 자세 · dz 적의 다음 행동을 바꾼다('jab' 약공 · 'guard' 웅크림) · dc 그 확률(%, 보스는 절반)
//     rv 앞으로 N턴 간파 · cl 내게 걸린 상태 이상을 턴다 · ex 적 체력이 이 비율 아래면 피해 2배 · es 쓸 때마다 피해 +비율(최대 3배)
// vD.01: 사용자가 직접 정한 13종(허수아비 잡귀 ~ 달걀귀신 · 혼돈) 밖의 56종은 적이 쓸 때의 기믹과 맞물리게 모두 다른 효과로 바꿨다(칸 뜻은 stealDetail 참고).
//     rb 라운드마다 피해 + · pc 적의 지금 체력의 비율만큼 더 · sh 최대 체력의 비율만큼 내 체력을 바친다 · ch 부적 한 장을 되찾는다
//     back 잃은 체력의 비율만큼 더 · eq 나와 적의 체력 비율을 평균으로(내가 더 다쳤을 때만)
const T = {
  'scarecrow#1': { mp: 20, m: 0.5, p: 1, g: 30 },
  'snake#1': { mp: 15, st: 60 },
  'curse#1': { mp: 10, dot: [3, 0.5] },
  'foxfire#1': { mp: 10, m: 2, p: 1, sf: 0.3 },
  'dueoksini#1': { mp: 20, m: 1.5, p: 1, gs: 1 },
  'bulgasari#1': { mp: 40, sp: 3 },
  'bulgasari#2': { mp: 30, m: 2, p: 1, gs: 1 },
  'geuseundae#1': { mp: 40, m: 3, p: 1, sil: 3 },
  'geuseundae#2': { mp: 40, m: 1.2, gsp: [0.5, 20] },
  'mongdangbi#1': { mp: 25, cl: 1 },
  'yagwanggwi#1': { mp: 15, m: 1, ch: 1, chU: 3 },
  'dalgyal-gwisin#1': { mp: 10, dz: 'guard', dc: 70 },
  'dungap-jwi#1': { mp: 20, m: 0.4, n: 2, p: 1, rat: [3, 0.35, 20] },
  'kim-seobang#1': { mp: 20, m: 0.6, p: 1, pc: 0.18, gbr: 1 },
  'kim-seobang#2': { mp: 20, m: 0.7, nr: [1, 4] },
  'mangtae-halabeom#1': { mp: 15, m: 1, p: 1, rb: 3 },
  'mongdal-gwisin#1': { mp: 30, m: 0.6, han: [3, 0.4] },
  'dokgak-gwi#1': { mp: 10, m: 0.8, n: 2, jx: 1.6 },
  'gaekgwi#1': { mp: 20, swap: 1 },
  'jangsanbeom#1': { mp: 20, qs: 1, rv: 2 },
  'jangsanbeom#2': { mp: 10, m: 1, p: 1, rv: 3, kn: 6 },
  'heokkaebi#1': { mp: 15, rv: 4, fz: 50 },
  'daemang#1': { mp: 30, m: 1, p: 1, ls: 1 },
  'songaksi#1': { mp: 50, m: 0.6, wk: 2 },
  'imae-mangryang#1': { mp: 10, m: 1, oe: 1 },
  'cheonnyeon-jine#1': { mp: 10, m: 0.5, p: 1, psn: [0.25, 5] },
  'cheonnyeon-jine#2': { mp: 20, gd: 1, fogg: [3, 1.5] },
  'changgwi#1': { mp: 20, m: 1, p: 1, hx: 1.5 },
  'myogwi#1': { mp: 20, m: 0.8, pmax: 0.05 },
  'jeokwi#1': { mp: 20, m: 1.2, expose: 3 },
  'agwi#1': { mp: 50, m: 1.5, p: 1, ex: 0.4 },
  'geumdwaeji#1': { mp: 50, m: 1, chg: 3 },
  'geumdwaeji#2': { mp: 0, g: 25, sh: 0.08, spb: 5 },
  'gildal#1': { mp: 15, dodge: 2 },
  'jigwi#1': { mp: 20, m: 1.5, sh: 0.05, rage: 2 },
  'gawi-gwi#1': { mp: 20, sleep: 3 },
  'udu-mamyeon#1': { mp: 20, m: 1.2, p: 1, bind: 2 },
  'gumiho#1': { mp: 25, m: 1.2, p: 1, swsp: 1 },
  'gumiho#2': { mp: 25, h: 0.35, cl: 1, dim: 0.5 },
  'yeou-nui#1': { mp: 20, rf: 1.2, rv: 2 },
  'noho-seung#1': { mp: 25, rheal: 0.4 },
  'chokru-gwi#1': { mp: 25, h: 0.2, gd: 1, lowx: 2 },
  'bulgae#1': { mp: 20, m: 1, n: 3, p: 1, decay: [1.2, 0.4] },
  'yeoksin#1': { mp: 30, plague: [0.04, 3] },
  'yeoksin#2': { mp: 25, h: 0.1, cl: 1, gd: 1 },
  'geuseunsae#1': { mp: 20, blind: [2, 40] },
  'hwama#1': { mp: 20, m: 0.5, p: 1, burn: 0.5 },
  'yeongno#1': { mp: 20, m: 1.4, p: 1, es: 0.4 },
  'yacha-nachal#1': { mp: 25, m: 1, n: 2, gx: 2 },
  'hanbal#1': { mp: 0, sh: 0.06, g: 15, thirst: 2 },
  'hanbal#2': { mp: 30, m: 0.6, p: 1, sun: [3, 0.03] },
  'gangcheol#1': { mp: 25, m: 0.8, p: 1, mpburn: 0.3 },
  'mudu-gwi#1': { mp: 25, m: 1.3, p: 1, fear: 1 },
  'gwimok#1': { mp: 20, gd: 1, thorn: 0.8 },
  'baekgwi#1': { mp: 25, banish: 1, rv: 3 },
  'samdugumi#1': { mp: 30, m: 1, n: 3, p: 1 },
  'samdugumi#2': { mp: 30, m: 1, p: 1, back: 0.5 },
  'baekgol-janggun#1': { mp: 25, m: 1, gd: 1, wk: 1 },
  'yohwa#1': { mp: 25, m: 1, p: 1, numb: [2, 30] },
  'daein#1': { mp: 30, delay: [2, 4] },
  'gunggi#1': { mp: 30, m: 0.6, infight: 1.5 },
  'jihaguk-daejeok#1': { mp: 25, m: 1.5, p: 1, sh: 0.15, shx: 3 },
  'jihaguk-daejeok#2': { mp: 30, m: 0.9, p: 1, hitsup: 4 },
  'cheonma#1': { mp: 30, m: 1.6, p: 1, a: ['max', 0.8] },
  'doul#1': { mp: 30, m: 0.8, n: 3, frenzy: 30 },
  'geoul-gwi#1': { mp: 30, m: 1, eq: 1 },
  'hondon#1': { mp: 50, cl: 1, dz: 'jab', dc: 100, rvAdd: 5 },
  'docheol#1': { mp: 35, m: 2.2, p: 1, sil: 4 },
  'docheol#2': { mp: 35, m: 1.2, p: 1, eatch: 0.8 },
}


// D.06.7 — 업로드된 수정 시트의 실제 효과값. 기존 스킬 ID/습득 조건은 유지.
Object.assign(T, {
    'scarecrow#1': { mp:20, g:30 },
    'snake#1': { mp:15, st:100 },
    'foxfire#1': { mp:10, m:3, p:1, sf:0.20 },
    'bulgasari#1': { mp:40, sp:3, spiritToMp:true },
    'geuseundae#1': { mp:40, m:3, p:1, sil:5 },
    'geuseundae#2': { mp:0, shareRemainingMp:true, partyOnly:true }, // V.01 혼자면 의지력만 날아간다
    'yagwanggwi#1': { mp:15, mimicEnemy:true, onceBattle:true },
    'dalgyal-gwisin#1': { mp:10, randomAilments:2, st:100, stunTurns:2 },
    'dungap-jwi#1': { mp:20, m:0.4, n:3, st:10 },
    'kim-seobang#1': { mp:20, m:1, pmax:0.10 },
    'mangtae-halabeom#1': { mp:0, allyAttacksBuff:true, partyOnly:true },
    'mongdal-gwisin#1': { mp:30, enemyAtkHalf:5 },
    'dokgak-gwi#1': { mp:10, extraTurns:2 },
    'jangsanbeom#1': { mp:20, rv:5, editEnemyQueue:true },
    'jangsanbeom#2': { mp:10, redirectNext:true, partyOnly:true }, // V.01 혼자면 대상을 바꿀 일행이 없다
    'heokkaebi#1': { mp:15, rv:5, deleteOneAction:true },
    'daemang#1': { mp:30, m:1, p:1, ls:1 },
    'songaksi#1': { mp:50, firstTurnStatBuff:true },
    'imae-mangryang#1': { mp:10, firstTurnProtect:true, partyOnly:true },
    'cheonnyeon-jine#1': { mp:10, m:0.5, p:1, psn:[0.05,5] },
    'cheonnyeon-jine#2': { mp:20, poisonOnGuard:true },
    'myogwi#1': { mp:20, gd:1, reflectNextRaw:true },
    'jeokwi#1': { mp:20, copyDebuffs:true },
    'agwi#1': { mp:50, reviveAlly:true, onceBattle:true, partyOnly:true },
    'geumdwaeji#1': { mp:50, fatalPrevent:true, onceBattle:true },
    'geumdwaeji#2': { mp:0, hpSacrificePair:true, g:25 },
})

// vC.01: 표(빼앗은 영능력 탭)에서 고쳐 받은 이름. 적이 쓰는 영능력의 이름은 그대로 두고, 빼앗아 내 것이 된 판의 이름만 바뀐다.
export const STOLEN_NAMES = { "steal-scarecrow": "귀혼", "steal-snake": "목조르기", "steal-foxfire": "화염파", "steal-bulgasari-2": "화염의 이치", "steal-geuseundae": "부처님 손 위", "steal-geuseundae-2": "진리의 어둠", "steal-mongdangbi": "빗자루 바람", "steal-yagwanggwi": "그림자의 끈", "steal-dalgyal-gwisin": "황홀예찬", "steal-dungap-jwi": "서생원", "steal-kim-seobang": "씨름", "steal-mongdal-gwisin": "한붙음", "steal-jangsanbeom-2": "목소리를 듣거라", "steal-heokkaebi": "허상진화", "steal-daemang": "상혼", "steal-songaksi": "목울림", "steal-imae-mangryang": "산으로 물으로", "steal-cheonnyeon-jine": "만년독", "steal-changgwi": "범 내려온다", "steal-myogwi": "낫을 드시오", "steal-jeokwi": "돌림병", "steal-agwi": "승자독식", "steal-geumdwaeji": "금빛의 갈기", "steal-geumdwaeji-2": "금빛의 울림", "steal-gildal": "등잔 밑이 어둡다", "steal-gumiho-2": "환상수", "steal-yeou-nui": "정든 얼굴이 오셨소", "steal-chokru-gwi": "뼛가루 붙이기", "steal-bulgae": "해와 달", "steal-yeoksin": "역병의 신", "steal-yeoksin-2": "금강불괴", "steal-geuseunsae": "천상의 날개", "steal-hwama": "몸을 태우는 불꽃", "steal-yacha-nachal": "손바닥놀이", "steal-hanbal": "목구멍의 거미", "steal-gangcheol": "메마른 바람", "steal-gwimok": "나무껍질의 향", "steal-baekgwi": "백귀야행", "steal-samdugumi": "셋이서 하나", "steal-samdugumi-2": "발치에 감긴 한", "steal-baekgol-janggun": "진형 형성", "steal-yohwa": "꽃가루", "steal-daein": "열 손이 한 손", "steal-jihaguk-daejeok": "아군의 아군은 적", "steal-doul": "나를 보시오", "steal-geoul-gwi": "나와 나의 연쇄", "steal-hondon": "야차", "steal-docheol": "결계장승" }

const STAT_KO = { insight: '안목', aggression: '호전', endurance: '인내', control: '절제', agility: '신속', comprehension: '이해', max: '가장 높은 스탯' }
const pct = (x) => `${Math.round(x * 100)}%`

/** 칸을 읽어 사람이 읽는 상세 설명을 만든다(실제 처리와 같은 자료에서 나오므로 어긋나지 않는다). */
export function stealDetail(k) {
  const out = []
  out.push(k.mp > 0 ? `의지력 ${k.mp} 소모.` : '의지력을 쓰지 않는다.')
  if (k.sh) out.push(`먼저 최대 체력의 ${pct(k.sh)}를 바친다(체력은 1 아래로 내려가지 않는다).`)
  if (k.dot) out.push(`이 공격으로는 직접 피해를 입힐 수 없다. 앞으로 상대의 ${k.dot[0]}턴 동안 턴마다 피해가 스며든다(턴마다 일반 공격 굴림의 ${pct(k.dot[1])}, 이 피해로는 쓰러지지 않는다).`)
  if (k.sp) out.push(`이 공격으로는 직접 피해를 입힐 수 없다. 상대의 영력이 남아 있으면 그 ${k.sp}분의 1만큼을 앗아와 내 영력으로 삼는다(하루 영력 전투 3번을 다 받은 날에는 상대의 영력만 줄어든다).`)
  if (k.m) {
    const each = `일반 공격 굴림의 ${k.m}배`
    out.push(`${k.n > 1 ? `${k.n}번 연달아 ${each}씩` : each} 피해${k.a ? ` + ${STAT_KO[k.a[0]]}×${k.a[1]}` : ''}. 영능력이라 빗나가지 않는다.${k.p ? ' 방어 태세도 무시한다.' : k.gx ? '' : ' 상대가 방어 태세면 절반.'}`)
  }
  if (k.sf) out.push(`단, 준 피해의 ${pct(k.sf)}만큼을 아군(본인 포함)도 함께 맞는다(이 피해로는 쓰러지지 않는다).`)
  if (k.st) out.push(`${k.st}% 확률로 상대의 다음 행동을 봉쇄한다(행동불능 · 보스는 확률 절반).`)
  if (k.gs) out.push('상대가 다음에 처음 잡는 방어 태세를 행동불능으로 바꾼다.')
  if (k.sil) out.push(`다음 ${k.sil}라운드 동안 상대는 어떤 영능력도 쓰지 못한다(영능력을 쓰려 하면 약공이 된다).`)
  if (k.gsp) out.push(`상대의 영력이 남아 있으면 그 ${pct(k.gsp[0])}만큼 내 의지력을 되찾는다(최대 ${k.gsp[1]}).`)
  if (k.pc) out.push(`상대의 지금 체력 ${pct(k.pc)}만큼 더 친다(내 일반 공격 굴림 최대치까지).`)
  if (k.back) out.push(`이번 싸움에서 잃은 내 체력의 ${pct(k.back)}만큼 더 친다(일반 공격 굴림 최대치의 두 배까지).`)
  if (k.rb) out.push(`라운드가 지날수록 세져, 라운드마다 피해 +${k.rb} (최대 +30).`)
  if (k.ex) out.push(`상대 체력이 ${pct(k.ex)} 아래면 피해가 두 배.`)
  if (k.es) out.push(`한 싸움에서 쓸 때마다 다음 피해가 ${pct(k.es)}씩 커진다(최대 3배).`)
  if (k.ls) out.push(`준 피해의 ${pct(k.ls)}만큼 체력을 되찾는다.`)
  if (k.g) out.push(`의지력을 ${k.g} 되찾는다.`)
  if (k.h) out.push(`최대 체력의 ${pct(k.h)}만큼 체력을 회복한다.`)
  if (k.eq) out.push('내가 상대보다 더 다쳤으면, 나와 상대의 체력 비율을 둘의 평균 쪽으로 당긴다(내 체력은 최대치의 20%까지 차오르고, 상대는 최대치의 10%까지만 깎인다).')
  if (k.cl) out.push('내게 걸린 상태 이상을 모두 턴다.')
  if (k.gd) out.push('이번에 들어오는 공격은 막기 자세로 받는다.')
  if (k.dz) out.push(`${k.dc >= 100 ? '' : `${k.dc}% 확률로 `}상대의 다음 행동을 ${k.dz === 'jab' ? '약공으로 바꾼다' : '웅크리기(방어 태세)로 바꿔 공격하지 못하게 한다'}${k.dc < 100 ? '(보스는 확률 절반)' : ''}.`)
  if (k.rv) out.push(`상대의 앞으로 ${k.rv}턴을 간파한다.`)
  if (k.rvAdd) out.push(`상대의 ${k.rvAdd}턴을 추가로 간파한다.`)
  if (k.ch) out.push(`써 버린 부적 한 장을 되찾는다${k.chU ? `(한 싸움에 최대 ${k.chU}회까지)` : '(최대 3장)'}.`)
  // vD.01 새 칸
  if (k.chg) out.push(`처음 쓰면 피해 없이 엄니를 갈며 막기 자세를 잡는다. 두 라운드 안에 다시 쓰면 ${k.chg}배로 들이받는다.`)
  if (k.nr) out.push(`도깨비방망이 뚝딱 — 몇 번 칠지 매번 ${k.nr[0]}~${k.nr[1]}번 사이로 정해진다.`)
  if (k.hitsup) out.push(`한 싸움에서 쓸 때마다 머리가 하나씩 깨어나 치는 횟수가 늘어난다(1번 → 최대 ${k.hitsup}번).`)
  if (k.frenzy) out.push(`칠 때마다 ${k.frenzy}% 확률로 한 번 더 친다(최대 6번).`)
  if (k.decay) out.push(`물 때마다 힘이 빠진다 — 첫 번째 ×${k.decay[0]}에서 마지막 ×${k.decay[1]}까지.`)
  if (k.jx) out.push(`상대의 다음 행동이 약공이면 피해 ×${k.jx}.`)
  if (k.gx) out.push(`상대의 다음 행동이 방어 태세면 그 방어를 뚫고, 마지막 일격이 ×${k.gx}.`)
  if (k.hx) out.push(`상대가 잃은 체력이 많을수록 세진다(최대 ×2.5).`)
  if (k.oe) out.push('홀수 라운드엔 산의 정으로 ×1.6, 짝수 라운드엔 물의 정으로 ×0.6.')
  if (k.kn) out.push(`간파해 둔 턴 하나마다 피해 +${k.kn}(최대 +36).`)
  if (k.pmax) out.push(`상대 최대 체력의 ${pct(k.pmax)}만큼 더 친다(일반 공격 굴림 최대치의 1.5배까지).`)
  if (k.shx) out.push(`바친 체력의 ${k.shx}배를 더 친다.`)
  if (k.mpburn) out.push(`남은 의지력의 ${pct(k.mpburn)}를 더 태우고, 태운 만큼의 1.2배를 더 친다.`)
  if (k.eatch) out.push(`가진 부적을 모두 먹어 치우고, 한 장마다 피해 배율이 +${k.eatch}씩 오른다(남은 부적이 없으면 그대로).`)
  if (k.gbr) out.push('상대의 다음 행동이 방어 태세면 메쳐서 그 행동을 없앤다.')
  if (k.qs) out.push('상대의 다음 두 행동의 순서를 뒤바꾼다.')
  if (k.fz) out.push(`${k.fz}% 확률로 상대가 멈칫해 다음 행동이 없어진다(보스는 확률 절반).`)
  if (k.fear) out.push('상대의 다음 행동이 공격이면 겁에 질려 방어 태세로 바뀐다.')
  if (k.swsp) out.push('앞으로 세 턴 안에 상대의 영능력이 있으면 구슬로 삼켜 약공으로 바꾸고, 의지력 15 · 최대 체력 10%를 되찾는다.')
  if (k.rat) out.push(`쥐 떼를 풀어 상대의 다음 ${k.rat[0]}차례 동안 차례마다 한 번씩 문다(일반 공격 굴림의 ${pct(k.rat[1])}, 이 피해로는 쓰러지지 않는다). 물릴 때마다 ${k.rat[2]}% 확률(보스는 절반)로 상대가 움찔해 그 차례를 날린다.`)
  if (k.han) out.push(`한을 들러붙인다 — 상대가 공격할 때마다(${k.han[0]}번) 일반 공격 굴림의 ${pct(k.han[1])}만큼 상대가 다친다.`)
  if (k.psn) out.push(`독을 한 겹 쌓는다(최대 ${k.psn[1]}겹). 싸움이 끝날 때까지 상대 차례마다 겹 수 × 일반 공격 굴림의 ${pct(k.psn[0])}.`)
  if (k.fogg) out.push(`${k.fogg[0]}턴 동안 독안개를 깐다 — 상대가 방어 태세를 잡으면 일반 공격 굴림의 ${k.fogg[1]}배를 들이마신다.`)
  if (k.wk) out.push(`${k.wk}턴 동안 상대의 강공 · 영능력 · 단체 공격 · 기 모으기가 약공이 된다.`)
  if (k.expose) out.push(`${k.expose}턴 동안 상대가 방어 태세를 잡지 못한다(그 차례는 아무것도 못 한다).`)
  if (k.spb) out.push(`상대의 남은 영력 ${k.spb}분의 1을 흩어 없앤다.`)
  if (k.dodge) out.push(`상대의 약공 ${k.dodge}번을 흘려 낸다.`)
  if (k.rage) out.push(`${k.rage}턴 동안 상대의 약공 · 웅크리기 · 기 모으기가 모두 강공이 된다(막기를 잘 쓰면 기회다).`)
  if (k.sleep) out.push(`상대를 최대 ${k.sleep}턴 잠재운다(보스는 절반). 피해를 받으면 깬다.`)
  if (k.bind) out.push(`${k.bind}턴 동안 상대의 강공 · 기 모으기가 방어 태세로 바뀐다.`)
  if (k.rf) out.push(`상대의 다음 강공 · 영능력이 제 몸을 친다(일반 공격 굴림의 ${k.rf}배, 그 차례는 약공).`)
  if (k.plague) out.push(`역병을 옮겨 ${k.plague[1]}턴 동안 상대 차례마다 상대 지금 체력의 ${pct(k.plague[0])}만큼 갉는다(다시 쓰면 기간이 늘어난다).`)
  if (k.blind) out.push(`${k.blind[0]}턴 동안 상대의 공격이 ${k.blind[1]}% 확률로 빗나간다(보스는 절반).`)
  if (k.burn) out.push(`불을 옮겨붙여 상대가 방어 태세를 잡을 때까지 상대 차례마다 일반 공격 굴림의 ${pct(k.burn)}.`)
  if (k.thirst) out.push(`상대가 다음에 영능력을 쓰면 일반 공격 굴림의 ${k.thirst}배만큼 상대가 다친다.`)
  if (k.sun) out.push(`${k.sun[0]}턴 동안 상대 차례마다 상대 최대 체력의 ${pct(k.sun[1])}만큼 말린다(일반 공격 굴림 최대치까지, 이 피해로는 쓰러지지 않는다).`)
  if (k.thorn) out.push(`상대가 다음에 공격하면 가시에 찔려 일반 공격 굴림의 ${pct(k.thorn)}만큼 다친다.`)
  if (k.banish) out.push(`상대를 ${k.banish}턴 동안 행렬에 끼워 보내 아무것도 못 하게 한다(보스에게는 듣지 않는다).`)
  if (k.numb) out.push(`${k.numb[0]}턴 동안 상대의 행동이 ${k.numb[1]}% 확률로 실패한다(보스는 절반).`)
  if (k.delay) out.push(`발을 들어 올렸다가 ${k.delay[0]}턴 뒤 일반 공격 굴림의 ${k.delay[1]}배로 내리찍는다.`)
  if (k.infight) out.push(`상대가 다음 차례에 제 몸을 친다(상대 공격력의 ${k.infight}배, 그 차례는 행동 없음).`)
  if (k.swap) out.push('내가 상대보다 더 다쳤으면 넋을 맞바꾼다 — 내 체력 비율이 상대 쪽으로(최대 +30%), 상대는 내 쪽으로(최대 -15%) 옮겨 간다.')
  if (k.rheal) out.push(`이번 싸움에서 잃은 체력의 ${pct(k.rheal)}를 되찾는다.`)
  if (k.lowx) out.push(`체력이 30% 아래일 때 쓰면 회복이 ${k.lowx}배.`)
  if (k.dim) out.push(`한 싸움에서 다시 쓸 때마다 회복이 ${k.dim === 0.5 ? '절반으로' : `${pct(k.dim)}로`} 줄어든다(꼬리가 줄어든다).`)
  if (k.ls >= 1) out.push('(준 피해만큼 모두 되찾는다.)')
  return out.join(' ')
}

/** 적 → 빼앗을 수 있는 영능력 목록 [{ id, slot }] */
function slotsOf(enemy) {
  if (!enemy?.id || String(enemy.id).startsWith('story-')) return []
  if (CURSE_FROM.includes(enemy.id)) return [{ id: `${STEAL_PREFIX}curse`, key: 'curse#1' }]
  const out = []
  if (T[`${enemy.id}#1`]) out.push({ id: `${STEAL_PREFIX}${enemy.id}`, key: `${enemy.id}#1` })
  if (T[`${enemy.id}#2`]) out.push({ id: `${STEAL_PREFIX}${enemy.id}-2`, key: `${enemy.id}#2` })
  return out
}
export const stealableOf = (enemy) => slotsOf(enemy)

/** battle.js 의 PSYCHICS 뒤에 붙는 항목들. 적 목록(ALL_ENEMIES)과 개척 요괴 이름을 받아 만든다. */
// vC.06 받침에 맞춰 을/를 (예: 짚허수아비를 · 단지 원귀를 · 대망이를)
const eul = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0) - 0xac00; return `${w}${c >= 0 && c <= 11171 && c % 28 ? '을' : '를'}` }
export function stolenPsychics(enemies) {
  reconceptPractice(enemies) // vC.06 실습장 상대의 새 이름으로 「…에게서 빼앗은 영능력」을 쓴다
  const out = []
  const seen = new Set()
  for (const e of enemies) {
    for (const s of slotsOf(e)) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      const sp = s.key.endsWith('#2') ? e.special2 : e.special
      const k = T[s.key]
      const from = s.id === `${STEAL_PREFIX}curse` ? `${PRACTICE_RECONCEPT.wonhon.name} · 개척 요괴` : e.name
      const need = e.boss ? `${e.name}(보스)를 20번 쓰러뜨릴 때마다 두 영능력 중 하나씩(20번 · 40번)` : `${eul(from)} ${STEAL_NEED}번 쓰러뜨린다`
      const workbook = WORKBOOK_STOLEN[s.id]
      out.push({
        id: s.id, label: workbook?.label ?? STOLEN_NAMES[s.id] ?? sp?.label ?? '빼앗은 영능력', stolen: true, from, boss: !!e.boss, tier: e.tier ?? 1, src: s.id === `${STEAL_PREFIX}curse` ? [...CURSE_FROM] : [e.id],
        note: workbook?.note ?? `${from}에게서 빼앗은 영능력. ${sp?.note ?? ''}`.trim(),
        detail: workbook?.detail ?? stealDetail(k), mp: k.mp, cond: workbook?.cond ?? `빼앗기 — ${need}.`, use: true, k,
      })
    }
  }
  return out
}

/**
 * 적을 한 번 쓰러뜨렸다. player.killCount[적] 을 하나 올리고, 조건을 채웠으면 영능력을 넣는다.
 * 반환 { player, got: [영능력 id], logs: [문장] }
 */
export function noteKill(player, enemy, rng = Math.random, psychicDefs = []) {
  const slots = slotsOf(enemy)
  if (!slots.length) return { player, got: [], logs: [] }
  const count = { ...(player.killCount ?? {}) }
  const n = (count[enemy.id] || 0) + 1
  count[enemy.id] = n
  let psychics = Array.isArray(player.psychics) ? [...player.psychics] : []
  const missing = slots.filter((s) => !psychics.includes(s.id))
  const got = []
  if (missing.length) {
    if (enemy.boss) {
      // 20번마다 하나씩. 지금까지 받아야 할 개수만큼 채운다(이미 가진 것은 센다).
      const due = Math.min(slots.length, Math.floor(n / STEAL_NEED_BOSS))
      let have = slots.length - missing.length
      const pool = [...missing]
      while (have < due && pool.length) {
        const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0]
        psychics.push(pick.id); got.push(pick.id); have += 1
      }
    } else if (n >= STEAL_NEED) {
      for (const s of missing) { psychics.push(s.id); got.push(s.id) }
    }
  }
  const name = (id) => psychicDefs.find((p) => p.id === id)?.label ?? id
  const logs = got.map((id) => `✦ ${eul(enemy.name)} ${n}번 쓰러뜨려 영능력 「${name(id)}」을(를) 빼앗았다!`)
  if (!got.length && missing.length) {
    const goal = enemy.boss ? STEAL_NEED_BOSS * (slots.length - missing.length + 1) : STEAL_NEED
    if (goal - n > 0 && (goal - n) % 10 === 0) logs.push(`${enemy.name}의 영능력을 빼앗기까지 ${goal - n}번 남았다. (${n}/${goal})`)
  }
  return { player: { ...player, killCount: count, psychics }, got, logs }
}

/** 이 적의 다음 빼앗기까지 { n, goal, done } — 도감 · 전투 화면 안내용 */
export function stealProgress(player, enemy) {
  const slots = slotsOf(enemy)
  if (!slots.length) return null
  const n = player?.killCount?.[enemy.id] || 0
  const owned = slots.filter((s) => player?.psychics?.includes(s.id)).length
  if (owned >= slots.length) return { n, goal: null, done: true, total: slots.length, owned }
  const goal = enemy.boss ? STEAL_NEED_BOSS * (owned + 1) : STEAL_NEED
  return { n, goal, done: false, total: slots.length, owned }
}
