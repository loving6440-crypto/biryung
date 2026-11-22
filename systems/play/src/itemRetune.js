// 비령 vD.01 — 아이템 효과 겹침 정리.
// · 효과가 완전히 똑같은 아이템이 둘 이상 없게 한다.
// · 체력 · 의지력만 채우던 음식은 가게에서 파는 기본 몇 가지(피크닉 · 초콜릿 · 컵라면 · 만두 · 아이스크림 · 홍삼 사탕)와
//   전투용(보리개떡 · 왕버섯 구이 · 감초 엿 · 쑥물 부적), 본편 선물(귀 · 미역국 · 감자)만 남기고,
//   저마다 재료에 어울리는 덤(몸의 이상 줄이기 · 짧은 육조 기운 · 쇠약 줄이기 · 영력 한 줌)을 붙였다.
// · 개척용도 같은 것끼리 겹치던 것(턴 +3 넷 · 턴 +4 둘 · 멈춤 3 둘 · 요괴 막기 4 둘 · 추가 보상 15 둘 · 2배 1 둘)을 서로 다르게.
// 적용: reskin.js(실행 화면) · systems/sheets/export.mjs(표 · 도감)
const H = 3 // 짧은 기운의 시간(시간)
export const ITEM_RETUNE = {
  // ── 음식(회복만 하던 것) ──
  'lost-love-letter': { effect: { mp: 20, buff: { stat: 'comprehension', amount: 2, hours: 6 } }, effectText: '의지력 +20 / 이해 +2 (6시간)' },
  'rice-cake': { effect: { hp: 15, mp: 15, shortenAil: ['hangi'] }, effectText: '체력 +15 / 의지력 +15 / [한기] 남은 시간 5분' },
  bibimbap: { effect: { hp: 30, mp: 20, buff: { stat: 'insight', amount: 1, hours: 6 } }, effectText: '체력 +30 / 의지력 +20 / 안목 +1 (6시간)' },
  'herb-salad': { effect: { hp: 10, mp: 10, shortenAil: ['otdok'] }, effectText: '체력 +10 / 의지력 +10 / [옻독] 남은 시간 5분' },
  'lake-mushroom-soup': { effect: { hp: 18, mp: 8, shortenAil: ['gyundok'] }, effectText: '체력 +18 / 의지력 +8 / [균독] 남은 시간 5분' },
  'cabbage-soup': { effect: { hp: 25, shortenAil: ['gobul'] }, effectText: '체력 +25 / [고뿔] 남은 시간 5분' },
  'chestnut-porridge': { effect: { hp: 45, weakCap: 3600000 }, effectText: '체력 +45 / [쇠약] 남은 시간이 1시간보다 길면 1시간으로' },
  'nw-carp-clear-soup': { effect: { hp: 35, cureAil: ['hyeongi'] }, effectText: '체력 +35 / [현기] 낫는다' },
  'nw-namul-rice': { effect: { hp: 25, mp: 15, spirit: 5 }, effectText: '체력 +25 / 의지력 +15 / 영력 +5' },
  'nw-dandelion-deodeok-tea': { effect: { mp: 25, shortenAil: ['hyeongi', 'gobul'] }, effectText: '의지력 +25 / [현기] · [고뿔] 남은 시간 5분' },
  'nw-cabbage-potato-soup': { effect: { hp: 30, shortenAil: ['geunyuk'] }, effectText: '체력 +30 / [근육통] 남은 시간 5분' },
  'nw-fern-spinach-namul': { effect: { hp: 15, mp: 15, buff: { stat: 'comprehension', amount: 1, hours: H } }, effectText: `체력 +15 / 의지력 +15 / 이해 +1 (${H}시간)` },
  'nw-licorice-candy': { effect: { mp: 15, shortenAil: ['hwasang'] }, effectText: '의지력 +15 / [화상] 남은 시간 5분' },
  'nw-pine-syrup-porridge': { effect: { hp: 25, mp: 20, weakCap: 3600000 }, effectText: '체력 +25 / 의지력 +20 / [쇠약] 남은 시간이 1시간보다 길면 1시간으로' },
  'nw-mushroom-namul-bowl': { effect: { hp: 40, mp: 25, buff: { stat: 'aggression', amount: 1, hours: 6 } }, effectText: '체력 +40 / 의지력 +25 / 호전 +1 (6시간)' },
  // ── 전투용(똑같던 둘) ──
  'nw-straw-doll': { effect: { onlyBattle: true, revive: true, mp: 15 }, effectText: '전투 중 사용: 전투불능 시 1회 부활 대기 / 의지력 +15 (한 전투에 부활 아이템은 1번)' },
  'nw-five-color-charm-book': { effect: { charms: 1, reveal: 2, oncePerBattle: true, onlyBattle: true }, effectText: '전투 중 사용(한 전투에 1번): 부적 +1 / 상대의 앞으로 2턴을 간파' },
  // ── 개척용(똑같던 것끼리) ──
  'cairn-model': { effect: { hunt: { turns: 3, ward: 2 } }, effectText: '개척 중: 개척 행동 턴 +3 / 2턴 동안 요괴가 다가오지 못한다' },
  'dandelion-tea': { effect: { hunt: { turns: 2, odds: { amount: 8, attempts: 2 } } }, effectText: '개척 중: 개척 행동 턴 +2 / 다음 2번의 채집·수렵 성공률 +8%' },
  'nw-oil-wick': { effect: { hunt: { turns: 3, freeze: 1 } }, effectText: '개척 중: 개척 행동 턴 +3 / 1턴 동안 동물·영물이 제자리에 멈춘다' },
  'nw-oyster-pine-grill': { effect: { hunt: { turns: 3, stat: { endurance: 3 } } }, effectText: '개척 중: 개척 행동 턴 +3 / 이번 개척 동안 인내 +3' },
  'greens-sujebi': { effect: { hunt: { turns: 4, stat: { insight: 2, endurance: 2 } } }, effectText: '개척 중: 개척 행동 턴 +4 / 이번 개척 동안 안목 +2 · 인내 +2' },
  'nw-five-color-lantern': { effect: { hunt: { turns: 4, bonus: 5 } }, effectText: '개척 중: 개척 행동 턴 +4 / 이번 개척 동안 추가 보상 확률 +5%' },
  'clover-hwajeon': { effect: { hunt: { double: 1, turns: 1 } }, effectText: '개척 중: 다음 1번의 성공 보상이 2배 / 개척 행동 턴 +1' },
  'nw-charcoal-smudge': { effect: { hunt: { ward: 4, freeze: 1 } }, effectText: '개척 중: 4턴 동안 요괴가 다가오지 못한다 / 1턴 동안 동물·영물이 제자리에 멈춘다' },
  'acorn-jelly': { effect: { hunt: { freeze: 2, turns: 1 } }, effectText: '개척 중: 2턴 동안 동물·영물이 제자리에 멈춘다 / 개척 행동 턴 +1' },
  // ── vD.02.1 단도: ×1.5 → ×1.7 (효과는 battle.js 패치 · 여기는 글만) ──
  'w-dagger': { effectText: '상대의 체력이 35% 미만으로 떨어지면 기본 공격력이 1.7배(내림)가 된다.' },
  // ── vD.02.2 무구 다시 맞춤(효과는 patches.mjs · 여기는 글만) ──
  'w-sickle': { effectText: '전투를 마치고 받는 보상이 2배로 늘어난다.' },
  'w-instrument': { effectText: '같은 파티원(본인 포함)의 모든 공격 행동 및 막기 반격에 [이해] 값만큼 공격력 보정이 고정으로 붙는다. 단, 악기를 든 사람 자신의 기본 공격력은 75%(내림)로 떨어진다.' },
  'w-spear': { effectText: '매 공격마다 (10 + 호전/2, 내림)% 확률로 치명타. 공격력이 적용되는 영능력·일반 공격·부적·효험에 적용되며, 치명타가 나면 그 공격이 1.2배~2배 사이의 값으로 들어간다.' },
  'w-mace': { effectText: '모든 기본 공격력이 1.5배(내림)가 된다. 단, 적에게서 받는 모든 공격도 2배가 된다.' },
  'w-bow': { effectText: '모든 공격이 반드시 명중하며, 모든 일반 공격이 상대의 방어 태세를 무시한다. 단체 전투일 경우 활을 든 사람이 한 명만 있어도 일행 전원이 이 효과를 받는다.' },
  // ── vD.02.3 응급 처치 상자와 같은 일을 하는 제작품 — 낮은 단계(털실 인형)는 하나, 높은 단계(재액부)는 둘 ──
  'yarn-doll': { only: null, oncePerBattle: null, effect: { cureOneBs: 1 }, effectText: '나쁜 상태 하나를 골라 인형에 옮겨 푼다 — 전투 중 상태 이상 · 저주 · 속박 · 몸의 이상 (전투 중에도 쓸 수 있다)', battle: true, tags: ['완성품', '#몸의 이상', '#턴소모無'] },
  'jaeaek-charm': { only: null, oncePerBattle: null, effect: { cureOneBs: 2 }, effectText: '나쁜 상태를 둘까지 골라 한 번에 푼다 — 전투 중 상태 이상 · 저주 · 속박 · 몸의 이상 (전투 중에도 쓸 수 있다)', battle: true, tags: ['완성품', '#몸의 이상', '#부적', '#턴소모無'] },
  // ── vD.02.3 숯: 제작 재료 그대로 + 쓸 수도 있다 ──
  charcoal: { effect: { trainUnder10: true }, effectText: '제작용 재료. 써도 된다 — 10 미만인 스탯 하나 +1 · 체력 −30 / 99개를 한 번에 쓰면 레벨과 상관없이 스탯 하나 +1 · 체력 −90 (전투 밖에서)' },
  // ── vD.02 조리실 음식: 대체로 'n분 동안' 기운이 드는 것으로(전투용 몇 가지는 그대로) ──
  'mushroom-stew': { effect: { hp: 10, timed: { kind: 'hpRegen', v: 2, min: 30 } }, effectText: '체력 +10 / 30분 동안 1분마다 체력 +2 (전투 밖에서)', battle: false },
  'king-mushroom-stew': { effect: { hp: 15, timed: { kind: 'hpRegen', v: 3, min: 30 } }, effectText: '체력 +15 / 30분 동안 1분마다 체력 +3 (전투 밖에서)', battle: false },
  'poison-mushroom-stew': { effect: { hpCost: 10, timed: { kind: 'mpRegen', v: 3, min: 30 } }, effectText: '체력 -10 / 30분 동안 1분마다 의지력 +3 (전투 밖에서)', battle: false },
  'pickled-raspberry': { effect: { timed: { kind: 'winMoney', v: 15, min: 30 } }, effectText: '30분 동안 전투에 이기면 받는 냥 +15% (전투 밖에서)', battle: false },
  'snakeberry-punch': { effect: { mp: 10, timed: { kind: 'mpRegen', v: 2, min: 40 } }, effectText: '의지력 +10 / 40분 동안 1분마다 의지력 +2 (전투 밖에서)', battle: false },
  'dangwi-tea': { effect: { mp: 10, timed: { kind: 'hpRegen', v: 4, min: 20 } }, effectText: '의지력 +10 / 20분 동안 1분마다 체력 +4 (전투 밖에서)', battle: false },
  'songi-rice': { effect: { hp: 20, timed: { kind: 'winMoney', v: 25, min: 60 } }, effectText: '체력 +20 / 60분 동안 전투에 이기면 받는 냥 +25% (전투 밖에서)', battle: false },
  'carp-soup': { effect: { hp: 15, timed: { kind: 'huntOdds', v: 6, min: 45 } }, effectText: '체력 +15 / 45분 동안 개척 채집·수렵 성공률 +6% (전투 밖에서)', battle: false },
  'grilled-carp': { effect: { hp: 15, timed: { kind: 'huntBonus', v: 8, min: 60 } }, effectText: '체력 +15 / 60분 동안 개척 추가 보상 확률 +8% (전투 밖에서)', battle: false },
  'oyster-mushroom-hotpot': { effect: { hp: 20, timed: { kind: 'huntBonus', v: 12, min: 45 } }, effectText: '체력 +20 / 45분 동안 개척 추가 보상 확률 +12% (전투 밖에서)', battle: false },
  'wild-grape-punch': { effect: { mp: 20, timed: { kind: 'mpRegen', v: 4, min: 30 } }, effectText: '의지력 +20 / 30분 동안 1분마다 의지력 +4 (전투 밖에서)', battle: false },
  'nw-mushroom-oil-soup': { effect: { hp: 15, timed: { kind: 'huntOdds', v: 4, min: 60 } }, effectText: '체력 +15 / 60분 동안 개척 채집·수렵 성공률 +4% (전투 밖에서)', battle: false },
  'nw-acorn-bowl': { effect: { hp: 10, timed: { kind: 'winMoney', v: 10, min: 45 } }, effectText: '체력 +10 / 45분 동안 전투에 이기면 받는 냥 +10% (전투 밖에서)', battle: false },
  // ── vD.02 다음에 받는 공격 피해 줄이기(절반 쪽이 위) ──
  'nw-mugwort-rope': { effect: { dmgCut: 0.5, oncePerBattle: true, onlyBattle: true }, effectText: '전투 중 사용(한 전투에 1번 · 턴을 쓰지 않는다): 다음에 받는 공격의 피해가 무조건 절반이 된다', tags: ['완성품', '전투 중 사용 가능', '#턴소모無'] },
  'nw-raccoon-tag': { effect: { dmgCut: 0.667, oncePerBattle: true, onlyBattle: true }, effectText: '전투 중 사용(한 전투에 1번 · 턴을 쓰지 않는다): 다음에 받는 공격의 피해가 무조건 1/3 줄어든다', tags: ['완성품', '전투 중 사용 가능', '#턴소모無'] },
  'nw-brick-shrine': { effect: { hunt: { bonus: 12, ward: 3 } }, effectText: '개척 중: 이번 개척 동안 추가 보상 확률 +12% / 3턴 동안 요괴가 다가오지 못한다' },
}
// vD.02.3 매점 값 — 요즘은 냥이 넉넉하다(추가전투 한 판에 수십 냥). 효과가 센 것일수록 더 올렸다.
export const STORE_PRICES = {
  picnic: 20, chocolate: 35, ramen: 20, dumpling: 30, chewy: 20, energy: 80, 'cone-icecream': 25, 'bag-snack': 40, 'slice-cake': 40,
  firecracker: 90, 'twin-pop': 25, hotbar: 120, brush: 25, hanji: 12, 'carving-knife': 25, pouch: 20, inkstick: 25, bag: 300, 'st-tangerine': 30, 'st-seaweed': 15,
}
// vD.04 매점에 새로 들이는 물건(원래 값이 없던 것) — 값 · 종류 · 태그 · 효과 글을 정한다. 설명(desc)은 그대로.
export const NEW_STORE = {
  'friendship-letter': { price: 100, kind: 'tool', tags: ['도구', '선물용'], effectText: '선물용 도구. 이 편지를 전송하면 받은 사람과 특별한 연을 맺게 된다.' },
}
// vD.03 실제 성능에 맞춘 글 · 태그(효과는 그대로 두고 보이는 것만 고친다)
//   effectText · desc: 덮어쓴다 · addTags: 없으면 더한다 · party: 일행 전용 여부
const BATTLE_TAG = '전투 중 사용 가능'
export const ITEM_TEXT_FIX = {
  'beginner-godok': { effectText: '일행 전투 중에만: 3라운드 동안 적이 받는 모든 피해가 20% 늘어난다(보스에게도 듣는다).', addTags: [BATTLE_TAG] },
  'nw-centipede-jar': { effectText: '일행 전투 중에만: 2라운드 동안 적이 받는 모든 피해가 20% 늘어난다(보스에게도 듣는다).', addTags: [BATTLE_TAG] },
  'nw-sealed-godok': { effectText: '일행 전투 중에만: 5라운드 동안 적이 받는 모든 피해가 20% 늘어난다(보스에게도 듣는다).', addTags: [BATTLE_TAG] },
  godok: { effectText: '일행 전투 중에만: [보스]를 포함한 그 어떤 적이든 일격에 처치한다. 대신 함께 싸운 모두가 사흘 동안 저주에 걸린다.', addTags: [BATTLE_TAG] },
  'yarn-doll': { addTags: [BATTLE_TAG] }, 'jaeaek-charm': { addTags: [BATTLE_TAG] },
  'nw-mugwort-rope': { party: false, desc: '쑥대를 한지 띠에 꽂아 꼰 금줄. 몸에 둘러 두면 들이치는 기운이 반으로 꺾인다.' },
  'nw-raccoon-tag': { desc: '벽조목 패에 봉인 가루로 너구리 발톱을 붙였다. 쥐고 있으면 날아드는 것이 한 번은 비껴 맞는다.' },
  'goblin-mask': { effectText: '착용 시 모든 공격력에 +200% 보정. 단, 돌발 확률이 50% 늘어나고, 일반 공격이 (호전/3)% 확률로 상대 대신 우리 편을 친다 — 나를 포함한 일행 가운데 하나(혼자면 나 자신). 맞은 사람의 체력은 1 아래로 내려가지 않는다.' },
  'hwatu-paulownia': { effectText: '장착자가 받는 모든 피해가 10%(올림) 줄어든다.' },
  energy: { effectText: '1회에 한하여 전투불능 패널티 없이, 또한 전투를 종료하지 않고 체력 1로 부활시킨다. 의지력은 회복되지 않는다. 전투불능이 되기 전 미리 먹어둬야 효과가 바로 발휘되며, 전투불능 이후에는 사용할 수 없다. 한 전투에 1회만 쓸 수 있다 (부활에 쓰고 나서도 같은 전투에서는 다시 마실 수 없다).' },
}
export function applyTextFix(items) {
  for (const it of items) {
    const f = ITEM_TEXT_FIX[it.id]; if (!f) continue
    if (f.effectText) it.effectText = f.effectText
    if (f.desc) it.desc = f.desc
    if ('party' in f) it.party = f.party
    if (f.addTags) it.tags = [...new Set([...(it.tags ?? []), ...f.addTags])]
  }
  return items
}
export function retuneItems(items) {
  for (const it of items) { const n = NEW_STORE[it.id]; if (n) Object.assign(it, { ...n, tags: [...n.tags], effect: {} }) }
  for (const it of items) if (STORE_PRICES[it.id] != null && it.price != null) it.price = STORE_PRICES[it.id]
  for (const it of items) { const r = ITEM_RETUNE[it.id]; if (r) { if (r.effect) it.effect = { ...r.effect }; it.effectText = r.effectText; if (r.tags) it.tags = [...r.tags]; if (r.battle === true) it.battle = true; for (const k of ['only', 'oncePerBattle']) if (k in r) { if (r[k] == null) delete it[k]; else it[k] = r[k] } if (r.battle === false) { it.battle = false; it.party = false; if (it.only === 'battle') delete it.only; delete it.oncePerBattle; it.tags = (it.tags ?? []).filter((t) => !['전투 중 사용 가능', '#턴소모無', '#턴소모有', '일행'].includes(t)) } } } // vD.03 전투 밖 음식에 남아 있던 only:'battle'(전투 중에만)이 겹쳐 어디서도 못 쓰던 것을 푼다
  applyTextFix(items)
  applyWorkbookItemEdits(items)
  return items
}

// D.06.7: 사용자 업로드 시트의 아이템 텍스트를 실제 아이템 목록에 반영.
export const WORKBOOK_ITEM_EDITS = {"picnic": {"price": 20, "desc": "평범한 사과맛 피크닉, 독은 들어있지 않다. 전투중에 마셔도 목에 걸리지 않는다.", "effectText": "의지력 +15, 전투 중 사용 가능"}, "chocolate": {"price": 35, "desc": "탈지분유 맛이 난다. 크래커 과자에 껴먹는게 요즘의 소소한 유행이다.", "effectText": "의지력 +30"}, "friendship-letter": {"price": 100, "desc": "누군가들이 주고받은 편지. 다른 사람의 인연이 담겨있다.", "effectText": "선물용 도구. 이 편지를 전송하면 받은 사람과 특별한 연을 맺게 된다."}, "antler": {"price": null, "desc": "신비로운 사슴의 뿔 조각. 단단하고 예쁘다.", "effectText": "제작용 재료."}, "spirit-orb": {"price": null, "desc": "영혼의 빛을 품은 희미한 구슬. 아름다운데 뭔가 불길한 느낌도 든다. 저주 안 받을 거라고 확신해?", "effectText": "제작용 재료."}, "bat-wing": {"price": null, "desc": "작은 박쥐에게서 얻은 가죽 같은 날개. 이제 박쥐는 오들오들 떨며 밤을 나야 한다. 당신 때문이다.", "effectText": "제작용 재료."}, "starlight": {"price": null, "desc": "밤의 빛이 작은 결정에 남아 있다. 눈을 현혹시키는 듯하다.", "effectText": "제작용 재료."}, "web": {"price": null, "desc": "끈적한 실이 한데 모여 있다. 이걸 왜 주운 거야?", "effectText": "제작용 재료."}, "acorn-flour": {"price": null, "desc": "도토리를 말려 곱게 빻은 가루. 다람쥐가 보면 누구 코에 붙이냐고 화낼 것 같다.", "effectText": "제작용 재료"}, "herb-decoction": {"price": null, "desc": "냄새만 맡아도 몸이 좋아질 것 같다. 혀는 모르겠다. 알 바일까?", "effectText": "제작용 재료"}, "st-tangerine": {"price": 30, "desc": "연호수가 늘 주머니에 넣고 다니는 귤. 까면 손끝이 오래 노랗다. 매점에도 가끔 들어온다.", "effectText": "체력 +10 · 의지력 +10"}, "st-seaweed": {"price": 15, "desc": "물에 불리면 열 배가 된다. 매점 구석 칸에 늘 한 봉지씩 남아 있다.", "effectText": null}, "nurse-firstaid": {"price": 150, "desc": "양호실 선반 맨 위에 둔 빨간 상자. 실습 중에 다친 학생이 생기면 선생님이 이걸 들고 뛰어간다. 무엇이든 하나는 손볼 수 있다.", "effectText": "쇠약을 제외하고 걸려 있는 나쁜 상태 하나를 골라 푼다 — 전투 중 상태 이상 · 저주 · 속박 · 몸의 이상 (전투 중에도 쓸 수 있다)"}};
export function applyWorkbookItemEdits(items) { for (const item of items) { const edit = WORKBOOK_ITEM_EDITS[item.id]; if (edit) { if (edit.price !== undefined) item.price = edit.price; if (edit.desc != null) item.desc = edit.desc; if (edit.effectText != null) item.effectText = edit.effectText; } } return items; }
