/* 秘靈 · 비령 — v1.0 별전(別傳) 칭호 50개 · 업적 50개, 그리고 모든 칭호의 '기능'.
 * titles.js 다음에 읽는다. 여기서 BIRYEONG_TITLES · BIRYEONG_ACHIEVEMENTS 뒤에 덧붙이고, 칭호마다 perk 을 단다.
 *
 * 칭호의 기능(perk) — 프로필에서 그 칭호를 '달고 있을 때만' 듣는다. 아주 소소하고, 얻은 길과 같은 갈래다.
 *   난이도(tier) 0 처음부터 · 1 둘러보기/하루 · 2 며칠 · 3 꾸준히 · 4 한 달 · 5 극
 *   type          뜻                                       난이도 1 → 5
 *   winMoney      전투 승리 보상 냥 +v%                      2 3 5 7 10
 *   winSpirit     전투 승리 보상 영력 +v%                    2 3 5 7 10
 *   lessonSpirit  수업 보상을 받을 때 영력 +v                1 1 2 3 4
 *   craftBonus    공작소 제작 때 v% 확률로 하나 더            2 3 5 7 10
 *   cookBonus     조리 때 v% 확률로 하나 더                  2 3 5 7 10
 *   gatherBonus   개척 채집 · 수렵 성공 때 v% 확률로 하나 더   2 3 4 6 8
 *   harvestBonus  텃밭 수확 때 v% 확률로 하나 더             3 5 7 10 12
 *   discount      매점에서 살 때 v% 덜 낸다                  1 2 3 4 5
 *   sell          매점에 팔 때 v% 더 받는다                  2 3 5 7 10
 *   statRefund    육조를 올릴 때 쓴 영력의 v% 가 돌아온다      2 3 5 7 10
 *   trainSpirit   수련을 끝까지 마치면 영력 +v%               2 3 5 7 10
 *   wakeSpirit    잠을 끝까지 자고 일어나면 영력 +v           2 4 6 8 10
 *   regen         영력 자연 회복 +v%                        2 3 5 7 10
 *   dailyMoney    하루 첫 접속 때 v냥                       3 5 10 20 30
 *   itemSave      아이템을 쓸 때 v% 확률로 줄지 않는다         2 3 4 5 6
 *   stat          육조 하나 +v (key)                        1 1 1 1 2
 * 실제 처리는 systems/play/src/usePlayHost.js (perkV 를 찾으면 된다).
 */
(() => {
  const TITLES = window.BIRYEONG_TITLES, ACH = window.BIRYEONG_ACHIEVEMENTS, GROUPS = window.BIRYEONG_ACHIEVEMENT_GROUPS;
  GROUPS.push({ id: 'neo', name: '별전 — 전뇌 조선' });

  // [id, 칭호 이름, 칭호 설명, 업적 이름, 달성 방법, 조건, 난이도, 기능]
  const N = [
    // ── 전투 ──
    ['n-wins50', '전뇌 무당', '굿판 대신 회로 위에서 뛴다.', '쉰 번의 굿', '전투에서 50번 이긴다.', { count: 'battleWins', n: 50 }, 2, 'winMoney'],
    ['n-wins150', '야광 포졸', '네온 아래 순라를 돈다.', '순라', '전투에서 150번 이긴다.', { count: 'battleWins', n: 150 }, 3, 'winMoney'],
    ['n-boss25', '네온 금부도사', '우두머리에게 사약 대신 부적을 내린다.', '의금부의 밤', '보스를 25번 이긴다.', { count: 'bossWins', n: 25 }, 3, 'winSpirit'],
    ['n-beaten40', '회로 검계', '칼을 품은 계원들의 명부, 그 첫 줄.', '마흔 개의 이름', '서로 다른 상대 40종을 이긴다.', { pset: 'beaten', n: 40 }, 4, 'winSpirit'],
    ['n-tier5', '증강 착호갑사', '범 잡던 갑사의 눈에 조준선이 뜬다.', '오 단계', '5단계 상대를 이긴다.', { count: 'tierMax', n: 5 }, 3, ['stat', 'aggression']],
    ['n-tier8', '홀로그램 별감', '붉은 철릭이 잔상으로 남는다.', '팔 단계', '8단계 상대를 이긴다.', { count: 'tierMax', n: 8 }, 4, ['stat', 'agility']],
    ['n-wins1000', '불패의 암행어사', '마패 대신 인증 토큰을 든다.', '천 번의 출두', '전투에서 1,000번 이긴다.', { count: 'battleWins', n: 1000 }, 5, 'winMoney'],
    ['n-boss60', '귀신 잡는 포도대장', '포도청 서버에 잡귀 명단이 쌓인다.', '포도청', '보스를 60번 이긴다.', { count: 'bossWins', n: 60 }, 5, 'winSpirit'],
    ['n-losses10', '낙마한 선달', '떨어져 본 사람이 고삐를 안다.', '열 번의 낙마', '전투에서 10번 진다.', { count: 'losses', n: 10 }, 2, ['stat', 'endurance']],
    ['n-fled10', '삼십육계 한량', '물러날 때를 아는 것도 재주다.', '줄행랑', '전투에서 10번 물러난다.', { count: 'fled', n: 10 }, 1, ['stat', 'agility']],
    // ── 수업 ──
    ['n-lessons10', '서당 개', '삼 년이면 풍월을 읊는다. 사흘째다.', '풍월', '서로 다른 날 3일 접속하고, 수업을 10번 마친다.', { all: [{ set: 'days', n: 3 }, { count: 'lessons', n: 10 }] }, 1, 'lessonSpirit'],
    ['n-lessons40', '데이터 훈장', '회초리 대신 로그를 든다.', '마흔 번의 강독', '수업을 40번 마친다.', { count: 'lessons', n: 40 }, 2, 'lessonSpirit'],
    ['n-courses6', '성균관 해커', '여섯 과목의 문을 모두 땄다.', '육예', '수업 6과목을 모두 마치고, 수업을 80번 마친다.', { all: [{ pset: 'courses', n: 6 }, { count: 'lessons', n: 80 }] }, 3, 'lessonSpirit'],
    ['n-lessons200', '광섬유 유생', '상소문을 빛의 속도로 올린다.', '이백 번의 강독', '수업을 200번 마친다.', { count: 'lessons', n: 200 }, 4, 'lessonSpirit'],
    ['n-lessons500', '장원급제 프로토콜', '어사화가 안테나처럼 선다.', '장원', '수업을 500번 마친다.', { count: 'lessons', n: 500 }, 5, 'lessonSpirit'],
    // ── 제작 · 조리 ──
    ['n-recipes20', '전도지 필경사', '한 장도 같은 글씨가 없다.', '스무 가지 솜씨', '서로 다른 제작법 20가지로 만든다.', { pset: 'recipes', n: 20 }, 2, 'craftBonus'],
    ['n-crafts60', '납땜하는 갖바치', '가죽 대신 기판을 꿰맨다.', '예순 개의 물건', '제작 · 조리를 60번 한다.', { count: 'crafts', n: 60 }, 2, 'craftBonus'],
    ['n-crafts200', '회로 대장장이', '모루 위에서 불꽃 대신 전류가 튄다.', '이백 개의 물건', '제작 · 조리를 200번 한다.', { count: 'crafts', n: 200 }, 4, 'craftBonus'],
    ['n-cooks40', '사옹원 숙수', '수라상에 오를 만한 손.', '마흔 끼', '조리를 40번 한다.', { count: 'cooks', n: 40 }, 2, 'cookBonus'],
    ['n-cooks200', '수라간 합성사', '열두 첩을 한 캡슐에 담는다.', '이백 끼', '조리를 200번 한다.', { count: 'cooks', n: 200 }, 4, 'cookBonus'],
    ['n-crafts3', '삼단 공정 도편수', '바탕에서 상급까지, 공정을 꿴다.', '상급 공정', '3단계 제작법으로 30개를 만든다.', { count: 'crafts3', n: 30 }, 3, 'craftBonus'],
    ['n-recipes80', '규합총서 편찬자', '살림의 모든 조합을 적어 둔다.', '여든 가지 솜씨', '서로 다른 제작법 80가지로 만든다.', { pset: 'recipes', n: 80 }, 4, 'cookBonus'],
    ['n-recipes180', '공조판서', '나라의 공장(工匠)이 그 손 아래 있다.', '백여든 가지 솜씨', '서로 다른 제작법 180가지로 만든다.', { pset: 'recipes', n: 180 }, 5, 'craftBonus'],
    // ── 개척 · 텃밭 ──
    ['n-gathers100', '드론 심마니', '"심봤다"를 무전으로 외친다.', '백 번의 손', '개척에서 채집 · 수렵을 100번 시도한다.', { count: 'gathers', n: 100 }, 2, 'gatherBonus'],
    ['n-pioneer30', '금줄 측량사', '넘으면 안 되는 선을 재고 다닌다.', '서른 번의 입산', '개척을 30번 나간다.', { count: 'pioneers', n: 30 }, 3, 'gatherBonus'],
    ['n-sites20', '대동여지도 렌더러', '발로 그린 지도를 빛으로 다시 그린다.', '스무 터', '서로 다른 개척 터 20곳에 들어간다.', { pset: 'sites', n: 20 }, 4, ['stat', 'insight']],
    ['n-gathers800', '산신령의 하청업자', '산이 맡긴 일을 대신 한다.', '팔백 번의 손', '개척에서 채집 · 수렵을 800번 시도한다.', { count: 'gathers', n: 800 }, 4, 'gatherBonus'],
    ['n-pioneer300', '야간 산행 파수꾼', '금역의 밤길에 발자국이 겹친다.', '삼백 번의 입산', '개척을 300번 나간다.', { count: 'pioneers', n: 300 }, 5, 'gatherBonus'],
    ['n-harvest30', '약초 캐는 안드로이드', '손끝의 센서가 흙을 읽는다.', '서른 번의 수확', '텃밭에서 30번 수확한다.', { count: 'harvests', n: 30 }, 2, 'harvestBonus'],
    ['n-harvest150', '수경 재배 권농관', '농사를 권하는 벼슬, 물 위의 논.', '백쉰 번의 수확', '텃밭에서 150번 수확한다.', { count: 'harvests', n: 150 }, 4, 'harvestBonus'],
    // ── 살림 ──
    ['n-sells60', '사이버 보부상', '등짐 대신 데이터 꾸러미를 진다.', '예순 개의 짐', '매점에 물건 60개를 판다.', { count: 'sells', n: 60 }, 2, 'sell'],
    ['n-buys300', '육의전 큰손', '시전 여섯 곳이 이름을 안다.', '삼백 개의 장바구니', '매점에서 물건 300개를 산다.', { count: 'buys', n: 300 }, 4, 'discount'],
    ['n-sells500', '전자 엽전 거간꾼', '흥정은 붙이고 구전은 챙긴다.', '오백 개의 짐', '매점에 물건 500개를 판다.', { count: 'sells', n: 500 }, 4, 'sell'],
    ['n-money5000', '냥 코인 채굴자', '엽전 꿰미가 블록처럼 쌓인다.', '오천 냥', '소지금 5,000냥을 모은다.', { count: 'moneyPeak', n: 5000 }, 3, 'dailyMoney'],
    ['n-money12000', '호조판서', '나라 곳간의 열쇠를 쥐었다.', '만 이천 냥', '소지금 12,000냥을 모은다.', { count: 'moneyPeak', n: 12000 }, 5, 'dailyMoney'],
    ['n-holjjak30', '오광 타짜', '패를 섞는 손은 눈보다 빠르다.', '서른 판', '별관 패 놀이터에서 오광 뽑기를 30번 한다.', { count: 'holjjak', n: 30 }, 3, 'sell'],
    // ── 단련 ──
    ['n-statups100', '단전 오버클럭', '아랫배의 코어가 뜨겁다.', '백 번의 단련', '육조 스탯을 100번 올린다.', { count: 'statUps', n: 100 }, 4, 'statRefund'],
    ['n-statsum120', '기경팔맥 튜너', '막힌 맥을 하나씩 조율한다.', '백스물', '육조 스탯의 합을 120까지 올린다.', { count: 'statSum', n: 120 }, 3, 'statRefund'],
    ['n-train30', '소주천 순환기', '숨이 한 바퀴 돈다.', '서른 번의 수련', '기숙사 수련을 30번 시작한다.', { count: 'trainings', n: 30 }, 2, 'trainSpirit'],
    ['n-train300', '면벽 수좌', '벽이 먼저 눈을 돌린다.', '삼백 번의 수련', '기숙사 수련을 300번 시작한다.', { count: 'trainings', n: 300 }, 5, 'trainSpirit'],
    ['n-spirit400', '영력 축전지', '가득 찬 채로 버틴다.', '사백', '영력을 400까지 채운다.', { count: 'spiritPeak', n: 400 }, 3, 'regen'],
    ['n-sleep100', '꿀잠 프로토콜', '절전 모드 진입이 빠르다.', '백 밤', '기숙사에서 100번 잠든다.', { count: 'sleeps', n: 100 }, 5, 'wakeSpirit'],
    // ── 나날 · 그 밖 ──
    ['n-days14', '야경꾼', '딱따기 소리가 밤을 가른다.', '열나흘', '서로 다른 날 14일 접속한다.', { set: 'days', n: 14 }, 2, 'dailyMoney'],
    ['n-streak7', '파루를 듣는 자', '새벽 서른세 번의 종을 놓치지 않는다.', '이레 개근', '7일 연속으로 접속한다.', { streak: 7 }, 2, 'regen'],
    ['n-days100', '백일 치성', '백 일을 빌면 산이 듣는다.', '백 일', '서로 다른 날 100일 접속한다.', { set: 'days', n: 100 }, 5, 'regen'],
    ['n-goblin20', '도깨비 동무', '메밀묵 대신 놀아 주면 된다.', '스무 판의 놀이', '도깨비들과 20번 논다.', { count: 'goblinPlays', n: 20 }, 2, ['stat', 'comprehension']],
    ['n-goblin-wins', '씨름판 장사', '도깨비가 먼저 샅바를 놓는다.', '서른 번 이긴 놀이', '도깨비 놀이에서 30번 이긴다.', { count: 'goblinWins', n: 30 }, 3, ['stat', 'endurance']],
    ['n-shrine', '사당 문턱을 넘은 자', '노란 기와 아래, 읽어서는 안 될 글자를 읽었다.', '표지판 아래의 글자', '사당 표지판 아래의 글자를 읽는다.', { count: 'shrineSign', n: 1 }, 3, ['stat', 'insight']],
    ['n-club', '계원', '계(契)에 이름을 올렸다.', '가입 신청서', '별관의 동아리 부실에서 가입 신청서를 낸다.', { count: 'clubJoins', n: 1 }, 1, 'dailyMoney'],
    ['n-titles50', '호패 수집가', '허리춤에 호패가 주렁주렁.', '쉰 개의 호패', '칭호 50개를 모은다.', { titles: 50 }, 5, 'itemSave'],
  ];
  for (const [id, name, desc, aName, hint, when, tier, perk] of N) {
    TITLES.push({ id: `t-${id}`, name, desc, from: 'achievement', tier, perkSeed: perk });
    ACH.push({ id, group: 'neo', name: aName, desc, hint, when, title: `t-${id}` });
  }

  // ── 모든 칭호에 기능 달기 ──
  const SCALE = {
    winMoney: [1, 2, 3, 5, 7, 10], winSpirit: [1, 2, 3, 5, 7, 10], lessonSpirit: [1, 1, 1, 2, 3, 4], craftBonus: [1, 2, 3, 5, 7, 10], cookBonus: [1, 2, 3, 5, 7, 10],
    gatherBonus: [1, 2, 3, 4, 6, 8], harvestBonus: [2, 3, 5, 7, 10, 12], discount: [1, 1, 2, 3, 4, 5], sell: [1, 2, 3, 5, 7, 10], statRefund: [1, 2, 3, 5, 7, 10],
    trainSpirit: [1, 2, 3, 5, 7, 10], wakeSpirit: [1, 2, 4, 6, 8, 10], regen: [1, 2, 3, 5, 7, 10], dailyMoney: [2, 3, 5, 10, 20, 30], itemSave: [1, 2, 3, 4, 5, 6], stat: [1, 1, 1, 1, 1, 2],
  };
  const STAT_LABEL = { aggression: '호전', comprehension: '이해', insight: '안목', agility: '신속', endurance: '인내', control: '절제' };
  const TEXT = {
    winMoney: (v) => `전투에서 이겨 받는 냥 +${v}%`, winSpirit: (v) => `전투에서 이겨 받는 영력 +${v}%`, lessonSpirit: (v) => `수업 보상을 받을 때 영력 +${v}`,
    craftBonus: (v) => `공작소 제작 때 ${v}% 확률로 하나 더`, cookBonus: (v) => `조리 때 ${v}% 확률로 하나 더`, gatherBonus: (v) => `개척 채집 · 수렵 성공 때 ${v}% 확률로 하나 더`,
    harvestBonus: (v) => `텃밭 수확 때 ${v}% 확률로 하나 더`, discount: (v) => `매점에서 살 때 ${v}% 덜 낸다`, sell: (v) => `매점에 팔 때 ${v}% 더 받는다`,
    statRefund: (v) => `육조를 올릴 때 쓴 영력의 ${v}%가 돌아온다`, trainSpirit: (v) => `수련을 끝까지 마치면 영력 +${v}%`, wakeSpirit: (v) => `잠을 끝까지 자고 일어나면 영력 +${v}`,
    regen: (v) => `영력 자연 회복 +${v}%`, dailyMoney: (v) => `하루 첫 접속 때 ${v}냥`, itemSave: (v) => `아이템을 쓸 때 ${v}% 확률로 줄지 않는다`,
  };
  const GROUP_TIER = { roam: 1, day: 1, days: 2, steady: 3, month: 4, peak: 5 };
  // 원래 있던 칭호: 업적의 조건(무엇을 세는가)에서 갈래를 정한다.
  const BY_KEY = {
    battleWins: 'winMoney', tierMax: 'winMoney', beaten: 'winMoney', tutorials: 'winMoney', bossWins: 'winSpirit', bosses: 'winSpirit',
    lessons: 'lessonSpirit', courses: 'lessonSpirit', crafts: 'craftBonus', recipes: 'craftBonus', cooks: 'cookBonus',
    pioneers: 'gatherBonus', gathers: 'gatherBonus', sites: 'gatherBonus', buys: 'discount', sells: 'sell',
    statUps: 'statRefund', statMax: ['stat', 'aggression'], statMin: ['stat', 'control'], statSum: 'statRefund', enhances: ['stat', 'aggression'], harvests: 'harvestBonus',
    itemsUsed: 'itemSave', trainings: 'trainSpirit', sleeps: 'wakeSpirit', moneyPeak: 'dailyMoney', spiritPeak: 'regen',
    days: 'dailyMoney', zones: ['stat', 'insight'], spots: ['stat', 'insight'], pages: 'dailyMoney', banner: 'dailyMoney', community: 'dailyMoney',
  };
  const START = { newcomer: 'dailyMoney', 'left-behind': 'regen', 'first-term': 'lessonSpirit', heir: 'winMoney' };
  const keyOf = (w) => (w.all ? keyOf(w.all[w.all.length - 1]) : w.count || w.pset || w.set || (w.streak ? 'streak' : w.flag ? 'flag' : ''));
  for (const t of TITLES) {
    const a = ACH.find((x) => x.title === t.id);
    const tier = t.tier ?? (t.from === 'start' ? 0 : GROUP_TIER[a?.group] ?? 1);
    let seed = t.perkSeed ?? START[t.id] ?? (a ? BY_KEY[keyOf(a.when)] : null) ?? (a?.when.streak ? 'regen' : 'dailyMoney');
    delete t.perkSeed;
    const [type, key] = Array.isArray(seed) ? seed : [seed];
    const v = SCALE[type][tier];
    t.tier = tier;
    t.perk = key ? { type, key, v } : { type, v };
    t.perkText = type === 'stat' ? `${STAT_LABEL[key]} +${v}` : TEXT[type](v);
  }
})();
