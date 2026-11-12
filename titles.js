/* 秘靈 · 비령 — 칭호 50개 · 업적 30개.
 * 칭호 from: 'start'(처음부터) | 'achievement'(업적 보상) | 'later'(획득 방법 미정 — 나중에 할당)
 * 업적 when: 화면(app.js)이 세는 값으로 판정한다. { flag } 한 번이라도 한 일 / { count, n } 횟수 / { set, n } 서로 다른 것의 수
 *   live: true 인 업적은 그 시스템(전투 · 수업 · 제작 · 개척 · 소지금)이 화면에 연결된 뒤부터 달성할 수 있다.
 */
window.BIRYEONG_TITLES = [
  // ── 처음부터 가진 칭호 (6)
  { id: 'newcomer', name: '입산자', desc: '비령산에 막 발을 들인 아이.', from: 'start' },
  { id: 'left-behind', name: '남겨진 아이', desc: '사라진 이들이 남기고 간 것.', from: 'start' },
  { id: 'nameless', name: '이름 없는 후손', desc: '누구의 핏줄인지 아직 아무도 말해 주지 않았다.', from: 'start' },
  { id: 'first-term', name: '제1기 학도', desc: '임시 학당의 첫 번째 명부에 오른 이름.', from: 'start' },
  { id: 'sleepyhead', name: '잠이 덜 깬 자', desc: '산의 새벽은 생각보다 이르다.', from: 'start' },
  { id: 'ordinary', name: '평범한 척하는 자', desc: '보이는 것을 못 본 척하는 데에는 이골이 났다.', from: 'start' },
  // ── 업적으로 얻는 칭호 (30)
  { id: 'registered', name: '명부에 오른 자', desc: '산문 명부에 먹으로 이름을 남겼다.', from: 'achievement' },
  { id: 'portrait', name: '초상을 남긴 자', desc: '얼굴을 남기는 건 이 산에서 조금 용감한 일이다.', from: 'achievement' },
  { id: 'six-roots', name: '고쳐 쓰는 자', desc: '먹이 마르기 전이라면 얼마든지 고칠 수 있다.', from: 'achievement' },
  { id: 'one-path', name: '외길 수행자', desc: '한 가지만 판다. 나머지는 나중 일이다.', from: 'achievement' },
  { id: 'even-keel', name: '고른 숨', desc: '어느 한쪽으로도 기울지 않은 사람.', from: 'achievement' },
  { id: 'one-liner', name: '한 줄의 자기소개', desc: '자신을 한 줄로 줄일 줄 안다.', from: 'achievement' },
  { id: 'gate-walker', name: '산문을 넘은 자', desc: '금줄 안쪽으로 들어섰다.', from: 'achievement' },
  { id: 'hall-student', name: '강학당의 학도', desc: '스승 없는 교실에 앉아 본 사람.', from: 'achievement' },
  { id: 'housemate', name: '생활관 식구', desc: '한 지붕 아래 이불을 편 사이.', from: 'achievement' },
  { id: 'trespasser', name: '금역의 침입자', desc: '돌아가라는 글귀를 읽고도 돌아가지 않았다.', from: 'achievement' },
  { id: 'four-winds', name: '사방을 디딘 자', desc: '북 · 동 · 서 · 남, 네 곳을 모두 밟았다.', from: 'achievement' },
  { id: 'five-colours', name: '오방색을 본 자', desc: '청 · 적 · 황 · 백 · 흑을 모두 넘겨 보았다.', from: 'achievement' },
  { id: 'case-reader', name: '기밀 문서 열람자', desc: '그날의 기록을 끝까지 읽었다.', from: 'achievement' },
  { id: 'lamplighter', name: '등불지기', desc: '어두운 산에 불 하나를 밝혔다.', from: 'achievement' },
  { id: 'calligrapher', name: '글씨를 가리는 자', desc: '같은 말도 어떤 글씨로 읽느냐가 중요하다.', from: 'achievement' },
  { id: 'wanderer', name: '복도의 방랑자', desc: '갈 수 있는 곳은 일단 가 본다.', from: 'achievement' },
  { id: 'pathfinder', name: '길눈 밝은 자', desc: '학당의 구석구석이 손바닥 안이다.', from: 'achievement' },
  { id: 'cartographer', name: '학당의 지도쟁이', desc: '안 가 본 곳을 찾는 쪽이 더 어렵다.', from: 'achievement' },
  { id: 'bookworm', name: '문헌 벌레', desc: '기록을 넘기는 손이 멈추지 않는다.', from: 'achievement' },
  { id: 'yokai-scholar', name: '요괴 박사', desc: '싸우기 전에 먼저 읽는다.', from: 'achievement' },
  { id: 'night-owl', name: '밤을 걷는 자', desc: '자정 넘은 산에서 깨어 있었다.', from: 'achievement' },
  { id: 'returner', name: '다시 돌아온 자', desc: '사흘을 내리 산에 올랐다.', from: 'achievement' },
  { id: 'resident', name: '산사람', desc: '이레를 채웠다. 이제 산이 얼굴을 안다.', from: 'achievement' },
  { id: 'messenger', name: '소식을 묻는 자', desc: '지신성과 두 터의 문을 모두 두드렸다.', from: 'achievement' },
  { id: 'titled', name: '이름 앞에 붙은 것', desc: '처음으로 칭호를 골라 달았다.', from: 'achievement' },
  { id: 'first-victory', name: '첫 퇴마', desc: '엉성했지만, 물러난 쪽은 저쪽이었다.', from: 'achievement' },
  { id: 'diligent', name: '개근 학도', desc: '수업을 열 번 채웠다.', from: 'achievement' },
  { id: 'craftsperson', name: '손재주꾼', desc: '손으로 무언가를 만들어 냈다.', from: 'achievement' },
  { id: 'pioneer', name: '산길을 여는 자', desc: '아무도 다니지 않은 길에 발자국을 냈다.', from: 'achievement' },
  { id: 'moneybag', name: '쌈짓돈 부자', desc: '주머니에서 짤랑 소리가 난다.', from: 'achievement' },
  // ── 획득 방법 미정 (14) — 나중에 할당
  { id: 'bell-heir', name: '방울을 물려받은 자', desc: '알이 없는 방울이 손안에서 운다.', from: 'later' },
  { id: 'talisman-hand', name: '부적 쓰는 손', desc: '붉은 먹이 마르기 전에 다음 획을 긋는다.', from: 'later' },
  { id: 'rope-keeper', name: '금줄지기', desc: '풀린 매듭을 다시 묶는 사람.', from: 'later' },
  { id: 'spirit-eye', name: '귀문이 열린 자', desc: '보지 않으려 해도 보인다.', from: 'later' },
  { id: 'goblin-friend', name: '도깨비의 놀이 상대', desc: '져도 웃고 이겨도 웃는다.', from: 'later' },
  { id: 'red-cloth', name: '붉은 천을 묶은 자', desc: '누가 묶었는지 모를 천이 하나 더 늘었다.', from: 'later' },
  { id: 'dawn-footprint', name: '새벽의 발자국', desc: '금줄 안쪽에서 발견되는 그 발자국의 주인.', from: 'later' },
  { id: 'dream-sharer', name: '같은 꿈을 꾼 자', desc: '검은 산, 붉은 천, 그리고 방울 소리.', from: 'later' },
  { id: 'third-door', name: '세 번째 문 앞에 선 자', desc: '문패에 자기 이름이 적혀 있었다.', from: 'later' },
  { id: 'cairn-builder', name: '돌무덤에 천을 올린 자', desc: '새 흰 천은 늘 누군가 갈아 둔다.', from: 'later' },
  { id: 'no-answer', name: '대답하지 않은 자', desc: '해가 진 뒤에는 대답하지 말 것.', from: 'later' },
  { id: 'heirloom', name: '유품을 간직한 자', desc: '빛바랜 오방색 천 조각 하나.', from: 'later' },
  { id: 'truth-seeker', name: '그날을 묻는 자', desc: '피난처가 아니라 진실을 찾으러 왔다.', from: 'later' },
  { id: 'unseen-blood', name: '비령의 핏줄', desc: 'THE UNSEEN BLOODLINE.', from: 'later' },
];

window.BIRYEONG_ACHIEVEMENTS = [
  // ── 프로필
  { id: 'a-register', name: '명부에 이름을', desc: '산문 명부의 빈 줄에 이름을 적었다.', hint: '내 프로필을 만든다.', when: { flag: 'profileCreated' }, title: 'registered', live: true },
  { id: 'a-portrait', name: '얼굴 있는 이름', desc: '이름 옆에 얼굴이 붙었다.', hint: '프로필 사진을 올린다.', when: { flag: 'photoSet' }, title: 'portrait', live: true },
  { id: 'a-edit', name: '덧쓴 먹', desc: '명부의 글씨를 한 번 고쳐 적었다.', hint: '프로필을 한 번 고친다.', when: { flag: 'profileEdited' }, title: 'six-roots', live: true },
  { id: 'a-onepath', name: '한 우물', desc: '한 가지 기질에 전부를 걸었다.', hint: '처음 스탯을 나눌 때 한 스탯에 7점 이상 준다.', when: { flag: 'statsFocused' }, title: 'one-path', live: true },
  { id: 'a-even', name: '치우치지 않게', desc: '어느 것도 버리지 않았다.', hint: '처음 스탯을 나눌 때 모든 스탯에 1점 이상 준다.', when: { flag: 'statsEven' }, title: 'even-keel', live: true },
  { id: 'a-intro', name: '저는요', desc: '한 줄이면 충분하다.', hint: '한줄소개를 적는다.', when: { flag: 'introSet' }, title: 'one-liner', live: true },
  { id: 'a-title', name: '이름 앞에', desc: '불리고 싶은 이름을 골랐다.', hint: '칭호를 골라 단다.', when: { flag: 'titleEquipped' }, title: 'titled', live: true },
  // ── 구역
  { id: 'a-north', name: '금줄 안쪽', desc: '속세와 학당의 경계를 넘었다.', hint: '산문에 들어간다.', when: { flag: 'zone:north' }, title: 'gate-walker', live: true },
  { id: 'a-east', name: '스승 없는 교실', desc: '오래된 문헌만이 수업을 이어 간다.', hint: '강학당에 들어간다.', when: { flag: 'zone:east' }, title: 'hall-student', live: true },
  { id: 'a-west', name: '한 지붕 아래', desc: '남겨진 자들이 잠드는 곳.', hint: '생활관에 들어간다.', when: { flag: 'zone:west' }, title: 'housemate', live: true },
  { id: 'a-south', name: '아이들은 돌아가라', desc: '돌아가지 않았다.', hint: '비령산 금역에 들어간다.', when: { flag: 'zone:south' }, title: 'trespasser', live: true },
  { id: 'a-four', name: '사방', desc: '네 방위를 모두 디뎠다.', hint: '네 구역에 모두 들어간다.', when: { set: 'zones', n: 4 }, title: 'four-winds', live: true },
  // ── 살펴보기
  { id: 'a-scenes-10', name: '기웃기웃', desc: '문이 있으면 일단 열어 본다.', hint: '탐사에서 서로 다른 곳 10군데를 살핀다.', when: { set: 'scenes', n: 10 }, title: 'wanderer', live: true },
  { id: 'a-scenes-40', name: '구석구석', desc: '모르는 복도가 줄어든다.', hint: '탐사에서 서로 다른 곳 40군데를 살핀다.', when: { set: 'scenes', n: 40 }, title: 'pathfinder', live: true },
  { id: 'a-scenes-90', name: '손바닥 안', desc: '학당의 지도를 다시 그려도 되겠다.', hint: '탐사에서 서로 다른 곳 90군데를 살핀다.', when: { set: 'scenes', n: 90 }, title: 'cartographer', live: true },
  { id: 'a-read-30', name: '읽고 또 읽고', desc: '목록의 줄을 하나씩 펼쳐 보았다.', hint: '구역의 목록에서 서로 다른 항목 30개를 펼쳐 본다.', when: { set: 'entries', n: 30 }, title: 'bookworm', live: true },
  { id: 'a-yokai-20', name: '지피지기', desc: '적을 알면 덜 무섭다. 아주 조금.', hint: '적 정보를 서로 다른 20종 펼쳐 본다.', when: { set: 'enemies', n: 20 }, title: 'yokai-scholar', live: true },
  // ── 화면
  { id: 'a-banner', name: '청 적 황 백 흑', desc: '다섯 빛깔을 모두 넘겨 보았다.', hint: '메인 배너의 다섯 쪽을 모두 본다.', when: { set: 'banner', n: 5 }, title: 'five-colours', live: true },
  { id: 'a-case', name: '그날 사라진 사람들', desc: '보관 문서 001.', hint: '사건 기록을 열람한다.', when: { flag: 'caseRead' }, title: 'case-reader', live: true },
  { id: 'a-lantern', name: '불 하나', desc: '산이 조금 밝아졌다.', hint: '등불을 켠다.', when: { flag: 'lantern' }, title: 'lamplighter', live: true },
  { id: 'a-font', name: '글씨 고르기', desc: '눈에 맞는 글씨를 찾았다.', hint: '화면 글꼴을 바꾼다.', when: { flag: 'fontChanged' }, title: 'calligrapher', live: true },
  { id: 'a-community', name: '거기 누구 있어요', desc: '세 곳의 문을 모두 두드렸다.', hint: '지신성 · 낮새들의 터 · 밤쥐들의 터를 모두 열어 본다.', when: { set: 'community', n: 3 }, title: 'messenger', live: true },
  // ── 시간
  { id: 'a-night', name: '해가 진 뒤', desc: '대답하지는 않았다.', hint: '자정부터 새벽 4시 사이에 산에 있는다.', when: { flag: 'nightVisit' }, title: 'night-owl', live: true },
  { id: 'a-days-3', name: '사흘', desc: '작심삼일은 넘겼다.', hint: '서로 다른 날 3일 접속한다.', when: { set: 'days', n: 3 }, title: 'returner', live: true },
  { id: 'a-days-7', name: '이레', desc: '산이 얼굴을 안다.', hint: '서로 다른 날 7일 접속한다.', when: { set: 'days', n: 7 }, title: 'resident', live: true },
  // ── 실행 화면(play/)에서 세는 것
  { id: 'a-battle-1', name: '첫 실습', desc: '물러난 쪽은 저쪽이었다.', hint: '전투에서 처음 이긴다.', when: { count: 'battleWins', n: 1 }, title: 'first-victory', live: true },
  { id: 'a-lesson-10', name: '출석 도장', desc: '열 번의 수업.', hint: '수업을 10번 마친다.', when: { count: 'lessons', n: 10 }, title: 'diligent', live: true },
  { id: 'a-craft-1', name: '처음 만든 것', desc: '삐뚤어도 내 손으로 만들었다.', hint: '공작소나 조리실에서 처음으로 무언가를 만든다.', when: { count: 'crafts', n: 1 }, title: 'craftsperson', live: true },
  { id: 'a-pioneer-1', name: '없던 길', desc: '발자국이 길이 된다.', hint: '개척 터에 처음 들어간다.', when: { count: 'pioneers', n: 1 }, title: 'pioneer', live: true },
  { id: 'a-money-100', name: '짤랑짤랑', desc: '매점 앞에서 당당해졌다.', hint: '소지금 100냥을 모은다.', when: { count: 'moneyPeak', n: 100 }, title: 'moneybag', live: true },
];
