// 비령 vC.06 — 퇴마 실습장의 상대를 「실습」에 맞는 존재로 고친다(수치 · 영능력의 작동은 그대로, 이름 · 소개 · 영능력 이름만).
//
// 실습장은 강학당 사범들이 붙잡아 두거나 부적 먹으로 빚어 낸 상대와 겨루는 곳이다.
// 그래서 전설 속 괴수(불가살이) · 진짜 거인 요괴(그슨대)를 그대로 두지 않고, 그 요괴의 수법을 본뜬 「실습용」 상대로 바꾼다.
// 실행 화면(reskin.js) · 도감(codex/build.mjs) · 시트(sheets/export.mjs)가 같은 함수를 부른다.
export const PRACTICE_RECONCEPT = {
  scarecrow: {
    name: '짚허수아비',
    blurb: '실습장 말뚝에 묶어 둔 짚허수아비. 사범들이 잡귀 한 줌을 불어넣어 두어, 맞으면 맞은 만큼 흔들리며 의지력을 조금씩 빨아들인다. 움직임이 단순해 첫 실습 상대로 쓴다.',
  },
  snake: {
    name: '먹구렁이',
    blurb: '사범이 부적 먹으로 그려 불러낸 실습용 구렁이. 먹이 마르기 전까지는 진짜 구렁이처럼 몸을 부풀려 덮치고 휘감는다.',
  },
  wonhon: {
    name: '단지 원귀',
    blurb: '실습장 창고의 봉인 단지에 묵혀 둔 원귀. 오래 묵어 원한이 독처럼 올랐다. 한 방이 무겁고, 이겨도 다시 단지 속으로 돌아간다.',
  },
  foxfire: {
    name: '등롱 여우불',
    blurb: '실습장 처마의 등롱 속에 가둬 둔 푸른 여우불 무리. 문을 열면 여우 울음 같은 소리를 내며 사방으로 흩어진다. 둘이 함께 다루는 법을 익히는 상대.',
  },
  dueoksini: {
    name: '두억시니 탈',
    blurb: '두억시니의 탈을 씌운 짚인형에 사범이 그림자를 불어넣었다. 탈이 얼굴에 들러붙는 순간부터 진짜 두억시니처럼 사람을 짓누른다. 둘은 모여야 맞설 수 있다.',
  },
  bulgasari: {
    name: '무쇠 장승',
    blurb: '쇳물을 부어 세운 실습장 어귀의 장승. 대보름마다 사범들이 영을 깨워 셋이 함께 넘는 시험으로 쓴다. 쇠를 갉고 불을 뿜는 수법은 불가살이를 본떴다고 한다. 몸이 상할수록 사나워진다.',
    special: '쇳독 물기', special2: '풀무 불길',
  },
  geuseundae: {
    name: '사범장의 그림자',
    blurb: '실습장 끝 담벼락에 드리운 커다란 그림자. 사범장이 마지막 시험으로 세워 둔 상대로, 올려다볼수록 끝없이 커진다. 셋은 모여야 맞설 수 있다.',
    special: '내리누르는 손', special2: '먹그림자 드리우기',
    rage: { stage1: '사범장의 그림자가 짙어진다! (3라운드마다 반드시 영능력을 쓴다)', stage2: '그림자가 담벼락을 넘어 솟아오른다! (이제 매 라운드 끝마다 더 커진다)' },
  },
}

const DONE = Symbol.for('biryeong.practiceReconcept')
/** 적 목록(ENEMIES · ALL_ENEMIES)에서 실습장 상대를 그 자리에서 고친다. 두 번 불러도 한 번만. */
export function reconceptPractice(list) {
  for (const e of list ?? []) {
    const r = PRACTICE_RECONCEPT[e?.id]
    if (!r || e[DONE]) continue
    Object.defineProperty(e, DONE, { value: true, enumerable: false })
    e.name = r.name; e.blurb = r.blurb
    if (r.special && e.special) e.special = { ...e.special, label: r.special }
    if (r.special2 && e.special2) e.special2 = { ...e.special2, label: r.special2 }
    if (r.rage && e.rage) e.rage = { ...e.rage, ...r.rage }
    e.practice = true
  }
  return list
}
