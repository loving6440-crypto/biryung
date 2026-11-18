// 비령 vC.06 — 인물의 부탁(NPC 퀘스트). 연호수 · 서창현 · 윤진서가 강학당 · 비령산의 조사 장소 곳곳에서 부탁한다(사당에는 없다).
//
// · 조사 장소에 들어가면 [이 장소에서 받을 수 있는 퀘스트]가 보인다 — 그 장소에서 받고, 그 장소로 돌아와 마친다.
// · 내 수준(보정 포함 육조 평균 S)이 minS ~ maxS 일 때만 나온다. 적을 쓰러뜨리는 부탁은 그 적의 추가전투 단계가 열려 있어야 나온다.
// · 한 번에 다섯 건까지. 한 번 마친 부탁은 다시 나오지 않는다.
// 목표: kill { enemy, n } · win { n } 아무 전투 승리 · lesson { n } 수업 · pioneer { n } 개척 터에 들어가기 ·
//       make { item, n } 받은 뒤에 만들기 · deliver { item, n } 마칠 때 건넨다(소지품에서 빠진다) · visit { key, where } 그 장소를 살핀다
// 글 안의 {name} 은 내 캐릭터 이름, {left} 는 남은 수.
import { BESTIARY_ENEMIES, ALL_ENEMIES } from '@vault/game/battle.js'
import { itemOf } from '@vault/game/items.js'
import { clampSpirit } from '@vault/game/constants.js'

export const NPCS = {
  yeon: { name: '연호수', color: '#7f9fd8' },
  seo: { name: '서창현', color: '#9aa7b4' },
  yoon: { name: '윤진서', color: '#d8a0b4' },
}
export const MAX_ACTIVE = 5

const Q = (id, npc, place, where, minS, maxS, title, goal, offer, accept, progress, done, extra = {}) => ({ id, npc, place, where, minS, maxS, title, goal, offer, accept, progress, done, ...extra })
export const NPC_QUESTS = [
  // ───────── 연호수 ─────────
  Q('y01', 'yeon', 'gym:left:armory', '비령산 · 왼길 무구보관소', 1, 10, '빗자루 도둑들', { type: 'kill', enemy: 'mongdangbi', n: 3 },
    '야, 너. 마침 잘 왔다. 몽당비 도깨비 새끼들이 무구보관소 빗자루를 죄다 물고 튀었어. 청소 당번 나거든? 세 번만 패 줘. 나 혼자 쫓아다니다가 숨넘어가는 줄 알았다.',
    '오케이. 빗자루 하나라도 부러뜨려 오면 그건 네가 사.', '몽당비는 아직 {left}번 남았다. 추가전투 1단계에 있어.', '오, 빗자루가 돌아왔네. 털이 좀 빠졌지만 됐다. 이거 받아. 고생값.'),
  Q('y02', 'yeon', 'annex:f1:gym', '별관 1층 · 체력단련실', 1, 12, '몸 좀 풀자', { type: 'win', n: 3 },
    '여기 왜 왔냐. 운동? …웃기지 마, 너 팔 보니까 아령 들다 부러지겠다. 차라리 나가서 아무나 세 번 이기고 와. 그게 더 운동 된다.',
    '이기고 오라고. 지고 오면 여기서 팔굽혀펴기 백 개야.', '아직 {left}번 남았다. 실습장이든 개척이든 상관없어.', '…진짜 세 번 이기고 왔네? 그래, 인정. 이거 마셔. 이상한 거 아니야.', { reward: { item: 'ail-moxa' } }),
  Q('y03', 'yeon', 'mainHall:f3:class3', '본관 3층 · 교실(3학년)', 3, 14, '이빨 모으는 취미', { type: 'deliver', item: 'deer-tooth', n: 2 },
    '3학년 교실 들어와서 두리번거리지 마라, 선배들 눈 돌아간다. …아, 그리고. 고라니 이빨 두 개만 구해 와. 왜냐고 묻지 마. 그냥 필요해.',
    '민들레 들길 쪽에 고라니 많다더라. 물리지나 마.', '고라니 이빨 {left}개 더. 민들레 들길에서 나와.', '어. 이거면 됐다. …부적 만드는 데 쓴다, 됐냐? 말하지 말라니까 꼭 들어야 직성이 풀리지.'),
  Q('y04', 'yeon', 'gym:left:beastGround', '비령산 · 신수들의 터', 5, 16, '외뿔 씨름꾼', { type: 'kill', enemy: 'dokgak-gwi', n: 3 },
    '신수들이 오늘 영 기분이 안 좋아 보이지? 독각귀 그 외뿔 놈이 길목마다 서서 씨름하자고 들이받는대. 세 번만 메다꽂아 줘. 나? 나는… 허리가 좀.',
    '다리 걸기 좋아하니까 발밑 봐라.', '독각귀 {left}번 더. 추가전투 2단계.', '신수들 표정 풀렸다. …너 은근히 쓸 만하다? 칭찬 아니고 사실이야.'),
  Q('y05', 'yeon', 'gym:right:river', '비령산 · 오른길 청화강', 6, 18, '잉어 세 마리', { type: 'deliver', item: 'carp', n: 3 },
    '청화강 물살 보지 마, 빨려 들어가는 기분 들어. …잉어 세 마리만 구해 줄래? 조리실 애들이 탕 끓인다고 난리야. 내가 낚으면 꼭 한 마리씩 놓쳐.',
    '호수 쪽 개척 터에서 잘 잡힌대. 미끄러우니까 꽉 잡아.', '잉어 {left}마리 더.', '오, 씨알 굵네. 탕 나오면 너한테 한 그릇 빼 두라고 할게. 약속은 못 하고.', { reward: { item: 'ail-warm-soup' } }),
  Q('y06', 'yeon', 'mainHall:f3:locker3', '본관 3층 · 물품보관소(3학년)', 8, 20, '날 무딘 칼', { type: 'make', item: 'whetstone', n: 1 },
    '보관함 열다가 손 베였어. 칼이 무뎌서 오히려 베이더라, 웃기지. 숫돌 하나만 만들어 와. 공작소에서 만들 수 있다며.',
    '네가 만든 거여야 해. 사 온 거 말고.', '숫돌 {left}개. 받은 뒤에 만든 것만 센다.', '…잘 갈리네. 손재주 있네, 너. 이건 답례.'),
  Q('y07', 'yeon', 'mainHall:roof:door', '본관 옥상 · 문', 10, 22, '그림자가 둘', { type: 'kill', enemy: 'heokkaebi', n: 3 },
    '옥상 문 앞에 서면 그림자가 두 개 생겨. 하나는 내 거고, 하나는 허깨비 거래. X발, 진짜 소름 돋아. 세 번만 흩어 줘라. 나 옥상에서 바람 좀 쐬어야 살 것 같거든.',
    '속은 텅 빈 놈이니까 쫄지 마.', '허깨비 {left}번. 추가전투 3단계.', '그림자 하나 됐다. …무서웠던 거 아니다. 진짜로.', { reward: { item: 'ail-dizzy-tea' } }),
  Q('y08', 'yeon', 'annex:f1:auditorium', '별관 1층 · 강당', 12, 24, '산에 길을 내라', { type: 'pioneer', n: 3 },
    '강당 무대 뒤에 지도 붙어 있는 거 봤냐? 회색으로 칠해진 데가 아직 아무도 안 간 데래. 세 번만 개척 나가서 길 좀 내 와. 다음 실습 때 내가 덜 헤매게.',
    '돌아오면 어디가 어땠는지 말해 줘. 대충이라도.', '개척 {left}번 더.', '…그래, 그쪽은 늑대 소리 나니까 피하라 이거지. 고맙다. 진짜로.'),
  Q('y09', 'yeon', 'mainHall:f1:archiveG', '본관 1층 · 문헌보관소(1층)', 14, 26, '범의 앞잡이', { type: 'kill', enemy: 'changgwi', n: 3 },
    '여기 문헌에 창귀 얘기가 있더라. 범한테 먹힌 놈이 범 앞잡이가 된다고. 근데 그게 요즘 산 밑에 진짜로 돌아다닌대. 사람 이름 부르면서. …세 번만 끝내 줘. 이름 불리는 거 질색이야.',
    '누가 네 이름 불러도 대답하지 마. 알지?', '창귀 {left}번 남았다. 추가전투 4단계.', '이제 이름 부르는 소리 안 난대. 너… 안 다쳤냐? 아, 묻는 거 아니야. 그냥.'),
  Q('y10', 'yeon', 'gym:right:campsite', '비령산 · 캠핑장', 16, 30, '담비 털 목도리', { type: 'deliver', item: 'marten-fur', n: 2 },
    '캠핑장 밤에 더럽게 춥다. 담비 털 두 개만 구해 와. 목도리 만들 거야. …내 거 아니야. 그냥 누구 줄 거.',
    '머루 넝쿨 계곡 쪽에 담비 있대.', '담비 털 {left}개 더.', '부드럽네. …누구 주냐고? 신경 꺼. 너도 하나 줄까 생각은 했다.', { reward: { item: 'ail-two-steam' } }),
  Q('y11', 'yeon', 'mainHall:f3:storage', '본관 3층 · 본관 창고', 18, 32, '가위눌림', { type: 'kill', enemy: 'gawi-gwi', n: 3 },
    '창고에서 낮잠 자다가 가위눌렸다. 웃지 마. 진짜 가위귀가 가슴팍에 앉아 있었어. 눈 마주쳤다고. 세 번만 쫓아내 줘. 오늘은 좀 자고 싶다.',
    '눈 마주치면 먼저 웃어 줘라. 그놈들 그거 싫어한대.', '가위귀 {left}번. 추가전투 5단계.', '어젯밤엔 안 왔어. 처음으로 푹 잤다. …고맙다고. 두 번 말 안 해.'),
  Q('y12', 'yeon', 'annex:f2:board', '별관 2층 · 패 놀이터', 22, 36, '해골 노름꾼', { type: 'kill', enemy: 'chokru-gwi', n: 3 },
    '패 놀이터에 해골이 와서 판 깔고 앉아 있었대. 촉루귀. 지면 뼈 하나씩 내놓으라 그런다나. 판놀이 애들 손가락 다 남아 있을 때 세 번 엎어 줘.',
    '판에는 앉지 마. 그냥 엎어.', '촉루귀 {left}번 더. 추가전투 6단계.', '판 위에 뼛조각만 굴러다니더래. 잘했다. 판돈은 네가 가져.'),
  Q('y13', 'yeon', 'gym:left:goblinFarm', '비령산 · 도깨비 농장', 26, 40, '탈 쓴 영노', { type: 'kill', enemy: 'yeongno', n: 3 },
    '도깨비 농장 애들이 다 숨었어. 영노가 탈 쓰고 와서 양반 잡아먹는다고 노래를 부르고 다닌대. 우리 중에 양반 있냐? 없지. 근데 그래도 무서운 건 무서운 거야. 세 번.',
    '노래 따라 부르지 마라. 그것도 이름 먹는 거랑 비슷해.', '영노 {left}번. 추가전투 7단계.', '도깨비들 다시 나와서 너한테 절하더라. …뭘 그렇게 웃어.', { reward: { item: 'ail-purge-cord' } }),
  Q('y14', 'yeon', 'mainHall:b1:escape', '본관 지하 1층 · 거대한 문', 30, 46, '문 앞의 머리 없는 것', { type: 'kill', enemy: 'mudu-gwi', n: 3 },
    '…이 문 앞에서 머리 없는 게 서성인다는 거, 들었냐. 무두귀. 문을 두드린대. 안에서 누가 열어 주길 기다리는 것처럼. 세 번만 보내 줘. 그 문은… 열리면 안 될 것 같아.',
    '다녀와. 그리고 진짜로, 다녀와라.', '무두귀 {left}번. 추가전투 8단계.', '두드리는 소리 멎었다. 너 이제 좀 무섭다. 좋은 뜻으로.'),
  Q('y15', 'yeon', 'annex:roof:plaza', '별관 옥상 · 옥상광장', 36, 99, '거인의 발자국', { type: 'kill', enemy: 'daein', n: 3 },
    '옥상광장에서 보면 산 너머에 발자국이 보여. 대인. 산을 밟고 다니는 거인. 걔가 한 발짝 내딛을 때마다 기숙사 유리창이 운다. …세 번이면 물러날 거래. 너라면 될 거야. 아니, 너밖에 없어.',
    '돌아오면 옥상에서 컵라면 쏜다. 진짜야.', '대인 {left}번. 추가전투 9단계.', '유리창 안 운다. …약속은 지킨다. 물 끓이러 가자.'),

  // ───────── 서창현 ─────────
  Q('s01', 'seo', 'mainHall:f1:lobby', '본관 1층 · 로비', 1, 10, '지하 기록 확인', { type: 'visit', key: 'mainHall:b1:archiveB', where: '본관 지하 1층 · 문헌보관소' },
    '{name} 학생. 마침 잘 오셨습니다. 지하 1층 문헌보관소의 열람 기록이 어제부터 갱신되지 않습니다. 직접 내려가 한 번 살펴봐 주시겠습니까. 들어가 보기만 하면 됩니다.',
    '감사합니다. 이상한 소리가 들려도 대답하지 마십시오. 대답하지 않을 확률이 높을수록 무사히 돌아올 확률도 높습니다.', '아직 지하 1층 문헌보관소에 다녀오지 않으셨습니다.', '확인했습니다. 기록이 다시 갱신되기 시작했군요. 협조에 감사드립니다.'),
  Q('s02', 'seo', 'mainHall:f2:staff', '본관 2층 · 교무실', 1, 12, '출석 관리', { type: 'lesson', n: 3 },
    '교무실에 무슨 일이십니까. …아, 출석부 말이군요. {name} 학생의 이번 주 수업 기록이 비어 있습니다. 수업 세 번을 마쳐 주십시오. 미니게임이든, 30분을 기다리든 상관없습니다.',
    '좋습니다. 출석은 성실함의 가장 정직한 지표입니다.', '수업 {left}번 남았습니다.', '기록이 채워졌습니다. 비령이 틀린 사례는 0건이지만, 학생이 성실하지 않은 사례는 많습니다. 당신은 예외로 적어 두겠습니다.'),
  Q('s03', 'seo', 'mainHall:f1:principal', '본관 1층 · 교장실', 3, 14, '창문의 얼굴', { type: 'kill', enemy: 'dalgyal-gwisin', n: 3 },
    '교장실 창문에 밤마다 이목구비 없는 얼굴이 비친다는 보고가 세 건 있습니다. 달걀귀신으로 추정됩니다. 세 번 처리해 주십시오. 교장 선생님께서는… 아직 모르십니다.',
    '보고서는 제가 쓰겠습니다. 당신은 싸우기만 하면 됩니다.', '달걀귀신 {left}번 남았습니다. 추가전투 1단계입니다.', '창문이 깨끗합니다. 보고서에는 「원인 불명, 자연 소멸」이라고 적겠습니다. …농담입니다. 당신 이름을 적겠습니다.'),
  Q('s04', 'seo', 'mainHall:f2:av', '본관 2층 · 시청각실', 5, 16, '표본 수집', { type: 'deliver', item: 'clover-leaf', n: 4 },
    '시청각실 영사기에 산 아래의 풀이 한 장씩 비칩니다. 토끼풀입니다. 무슨 뜻인지는 모르겠습니다. 표본 네 장을 구해 주시면 대조해 보겠습니다.',
    '민들레 들길에서 쉽게 구할 수 있을 겁니다.', '토끼풀 {left}장이 더 필요합니다.', '대조 결과, 일치율 97%입니다. 나머지 3%는… 기록하지 않겠습니다. 수고하셨습니다.'),
  Q('s05', 'seo', 'annex:f2:broadcast', '별관 2층 · 방송실', 6, 18, '방송 사고', { type: 'kill', enemy: 'mongdal-gwisin', n: 3 },
    '어젯밤 방송실 마이크가 혼자 켜져 장가가고 싶다는 노래가 흘러나왔습니다. 몽달귀신입니다. 방송 동아리 학생들이 울면서 신고했습니다. 세 번이면 충분할 것으로 계산됩니다.',
    '노래는 듣지 마십시오. 끝까지 들으면 따라 부르게 될 확률이 높습니다.', '몽달귀신 {left}번 남았습니다. 추가전투 2단계입니다.', '방송실이 조용합니다. 방송 동아리에서 감사 인사를 전해 달라고 했습니다. 직접 하라고 했는데, 무섭다더군요.'),
  Q('s06', 'seo', 'annex:f3:archive', '별관 3층 · 자료실', 8, 20, '번지지 않는 먹', { type: 'make', item: 'nw-charcoal-ink', n: 2 },
    '자료실 기록을 다시 적어야 합니다. 보통 먹은 이곳에서 번집니다. 숯먹 두 개를 만들어 주시겠습니까. 공작소에서 만들 수 있습니다.',
    '받으신 뒤에 만드신 것만 세겠습니다.', '숯먹 {left}개가 더 필요합니다.', '번지지 않습니다. 이 기록은 오래 남을 겁니다. 당신이 만든 먹으로 적었다는 것까지.'),
  Q('s07', 'seo', 'mainHall:f1:awards', '본관 1층 · 상장 거치대', 10, 22, '이름 없는 상장', { type: 'kill', enemy: 'songaksi', n: 3 },
    '상장 거치대에 받는 사람의 이름이 지워진 상장이 늘어나고 있습니다. 손각시가 밤마다 와서 이름을 손으로 문지른다는 목격담이 있습니다. 세 번. 부탁드립니다.',
    '…상장의 이름이 전부 지워지기 전에 돌아와 주십시오.', '손각시 {left}번 남았습니다. 추가전투 3단계입니다.', '이름이 다시 보입니다. …제 이름도 하나 있었습니다. 다행입니다.', { reward: { item: 'ail-purge-charm' } }),
  Q('s08', 'seo', 'annex:f3:books', '별관 3층 · 서적실', 12, 24, '그믐꽃 표본', { type: 'deliver', item: 'waning-flower', n: 2 },
    '서적실 고서에 「그믐꽃은 달이 없는 밤에만 이름을 기억한다」는 구절이 있습니다. 확인하고 싶습니다. 동굴에서 피는 그믐꽃 두 송이를 구해 주십시오.',
    '동굴은 어둡습니다. 현기가 오면 쉬었다 가십시오.', '그믐꽃 {left}송이가 더 필요합니다.', '…달이 없는데도 꽃잎이 오므라들지 않습니다. 이 구절은 틀렸군요. 비령이 아니라 책이 틀린 겁니다.'),
  Q('s09', 'seo', 'mainHall:b1:archiveB', '본관 지하 1층 · 문헌보관소', 14, 26, '묘지기의 경고', { type: 'kill', enemy: 'myogwi', n: 3 },
    '지하 문헌보관소의 오래된 묘적부가 젖어 있습니다. 묘귀가 무덤 밖으로 나와 자기 이름을 찾으러 다닌다는 뜻입니다. 세 번 돌려보내 주십시오.',
    '묘귀는 살기를 남깁니다. 살풀이 부적을 챙기는 것을 권합니다.', '묘귀 {left}번 남았습니다. 추가전투 4단계입니다.', '묘적부가 말랐습니다. 감사합니다. 당신의 기록에 「신뢰할 수 있음」을 추가했습니다.'),
  Q('s10', 'seo', 'mainHall:f2:beasts', '본관 2층 · 신수보관소', 16, 30, '신수 사육사 실습', { type: 'lesson', n: 6 },
    '신수보관소의 신수들이 최근 학생들을 피합니다. 배움이 얕은 사람의 냄새를 싫어한다고 합니다. 수업을 여섯 번 더 들으신 뒤 다시 와 주십시오. 진심입니다.',
    '저도 신수들에게 미움받습니다. 동지라고 생각하십시오.', '수업 {left}번 남았습니다.', '신수가 당신 손에 코를 댔습니다. 저는 아직 한 번도 못 받아 본 대우입니다. …부럽지 않습니다.'),
  Q('s11', 'seo', 'annex:f1:auditorium', '별관 1층 · 강당', 18, 32, '불붙은 연모', { type: 'kill', enemy: 'jigwi', n: 3 },
    '강당 커튼에 그을린 자국이 생겼습니다. 지귀입니다. 사모하는 마음이 불이 된 귀신이라고 합니다. 화상을 입을 확률이 높으니 대비하시고, 세 번 처리해 주십시오.',
    '…사모하는 마음이 불이 된다는 건 비효율적이라고 생각합니다. 그렇게 적어 두었습니다.', '지귀 {left}번 남았습니다. 추가전투 5단계입니다.', '커튼이 무사합니다. 화상은 없으십니까. 없다면 다행이고, 있다면 이것을 쓰십시오.', { reward: { item: 'ail-burn-tea' } }),
  Q('s12', 'seo', 'mainHall:b1:supply', '본관 지하 1층 · 비품실', 22, 36, '비품 보충: 살풀이', { type: 'make', item: 'ail-purge-charm', n: 2 },
    '비품실 장부에 살풀이 부적이 0장으로 적혀 있습니다. 최근 묘소 실습이 늘어 수요가 많았습니다. 두 장을 만들어 주시겠습니까. 비품은 공공재입니다.',
    '공작소에서 만들 수 있습니다. 재료는 한지 · 부적 먹물 · 주사입니다.', '살풀이 부적 {left}장이 더 필요합니다.', '장부를 고쳤습니다. 「보충: {name} 학생」. 이 줄은 지우지 않겠습니다.'),
  Q('s13', 'seo', 'annex:roof:plaza', '별관 옥상 · 옥상광장', 26, 40, '불의 마귀', { type: 'kill', enemy: 'hwama', n: 3 },
    '옥상광장에서 산을 보면 불길이 번진 자리가 보입니다. 화마입니다. 산불 확률이 계속 올라가고 있습니다. 세 번 꺾어 주십시오. 지금 계산으로는 당신이 가장 적임자입니다.',
    '저는 여기서 기록하겠습니다. 당신이 이길 확률을.', '화마 {left}번 남았습니다. 추가전투 7단계입니다.', '확률이 0으로 떨어졌습니다. 산불의 확률 말입니다. 당신이 이길 확률은… 처음부터 높았습니다.'),
  Q('s14', 'seo', 'mainHall:f1:lobby', '본관 1층 · 로비', 30, 46, '말하는 나무', { type: 'kill', enemy: 'gwimok', n: 3 },
    '로비 창밖의 나무가 밤마다 학생 이름을 부릅니다. 귀목이 되어 버렸습니다. 이름을 불린 학생 셋이 결석했습니다. 세 번 베어 주십시오. 결석은 기록에 남습니다.',
    '…이름을 불려도 대답하지 마십시오. 이번에는 진심으로 부탁드립니다.', '귀목 {left}번 남았습니다. 추가전투 8단계입니다.', '결석한 학생들이 돌아왔습니다. 아무것도 기억하지 못합니다. 그편이 낫다고 판단합니다.'),
  Q('s15', 'seo', 'mainHall:b1:escape', '본관 지하 1층 · 거대한 문', 40, 99, '하늘의 말', { type: 'kill', enemy: 'cheonma', n: 2 },
    '거대한 문 너머에서 말발굽 소리가 들린다는 보고입니다. 천마입니다. 비령의 관측 범위를 벗어난 존재입니다. …이것은 공식 의뢰가 아닙니다. 제 개인적인 부탁입니다. 두 번만.',
    '돌아와 주십시오. 관측자가 사라지면 기록도 사라집니다.', '천마 {left}번 남았습니다. 추가전투 10단계입니다.', '…돌아오셨군요. 문이 조용합니다. 이것은 기록하지 않겠습니다. 제 기억에만 두겠습니다.'),

  // ───────── 윤진서 ─────────
  Q('j01', 'yoon', 'mainHall:f3:class1', '본관 3층 · 교실(1학년)', 1, 10, '같이 실습해요', { type: 'kill', enemy: 'scarecrow', n: 3 },
    '{name}! …이름 맞게 불렀죠? 다행이다. 저기, 퇴마 실습 같이 가요! 짚허수아비 세 번만 이기면 실습 도장 받을 수 있대요. 저는 벌써 두 번 넘어졌어요.',
    '좋아요! 넘어지면 제가 일으켜 줄게요. …아니, 제가 넘어지면 일으켜 줘요.', '짚허수아비 {left}번 남았어요! 퇴마 실습장이에요.', '도장 받았어요! 둘 다요! {name} 덕분이에요. 이거, 매점에서 산 거예요. 반 나눠요.'),
  Q('j02', 'yoon', 'mainHall:f2:nurse', '본관 2층 · 양호실', 1, 12, '쑥 찜질', { type: 'deliver', item: 'mugwort', n: 3 },
    '양호 선생님이 쑥이 다 떨어졌대요. 다친 애들 찜질해 줘야 한다는데… 쑥 세 개만 구해 줄 수 있어요? 뱀딸기 오솔길에 많대요!',
    '고마워요! 쑥 냄새 좋죠? 저는 이상하게 그 냄새 맡으면 엄마 생각이 나요.', '쑥 {left}개 더요!', '양호 선생님이 엄청 좋아하셨어요. …엄마 이름이 뭐였더라. 아, 아니에요! 고마워요, {name}!', { reward: { item: 'ail-wound-salve' } }),
  Q('j03', 'yoon', 'annex:f2:cook', '별관 2층 · 조리실', 3, 14, '첫 달임물', { type: 'make', item: 'herb-decoction', n: 1 },
    '조리실에서 약재 달임물 만드는 거 배웠어요! 근데 제가 만든 건 자꾸 타요. {name}가 하나만 만들어 줄래요? 보고 배우게요.',
    '불 세기가 중요하대요. 저는 그게 제일 어려워요.', '약재 달임물 {left}개 만들어 주세요!', '와, 색이 예뻐요. 제 건 까만데. 나중에 저도 이렇게 만들 수 있겠죠?'),
  Q('j04', 'yoon', 'gym:left:garden', '비령산 · 텃밭', 4, 15, '민들레 화관', { type: 'deliver', item: 'dandelion', n: 3 },
    '텃밭 옆에 민들레가 피었는데, 저는 다 꺾으면 안 될 것 같아서요. 민들레 들길에서 세 송이만 구해 와 줄래요? 화관 만들어서 사감 선생님 드리려고요. 이름은… 한도율 선생님 맞죠?',
    '노란색이 제일 예쁜 걸로요!', '민들레 {left}송이 더요!', '화관 다 만들었어요! …사감 선생님 성함, 아까 제가 뭐라고 했죠? 뭐 어때요, 선생님은 선생님이니까요.'),
  Q('j05', 'yoon', 'annex:f3:tea', '별관 3층 · 다도실', 5, 16, '망태 할아범', { type: 'kill', enemy: 'mangtae-halabeom', n: 3 },
    '다도실 창밖에 망태 메고 지나가는 할아버지가 있었어요. 다들 우는 아이를 잡아간다고… 저 안 울었는데 자꾸 쳐다보세요. 세 번만 쫓아 줄래요? 차는 제가 우려 둘게요.',
    '돌아오면 오미자차예요. 약속!', '망태 할아범 {left}번 남았어요. 추가전투 2단계래요.', '이제 안 쳐다보세요! 차 식기 전에 마셔요. 따뜻할 때가 제일 맛있대요.', { reward: { item: 'ail-two-omija' } }),
  Q('j06', 'yoon', 'gym:right:lake', '비령산 · 청화호수', 6, 18, '수세미 열매', { type: 'deliver', item: 'loofah-fruit', n: 2 },
    '청화호수는 물이 너무 맑아서 무서워요. 바닥에 누가 있을 것 같아요. …그건 그렇고! 수세미 열매 두 개만 구해 줄래요? 조리실에서 데인 애들한테 발라 주려고요.',
    '호수 개척 터에 있대요. 물가 조심해요, 한기 들어요!', '수세미 열매 {left}개 더요!', '고마워요! 이걸로 화상즙 만들면 되겠다. {name}도 데이면 저한테 와요.', { reward: { item: 'ail-burn-gel' } }),
  Q('j07', 'yoon', 'mainHall:f2:meditation', '본관 2층 · 명상실', 8, 20, '산이 부르는 소리', { type: 'pioneer', n: 2 },
    '명상실에서 눈 감고 있으면 산이 부르는 소리가 들려요. 저만 그런가요? …개척 두 번만 다녀와 줄래요? 산이 뭐라고 하는지 궁금해서요.',
    '돌아오면 들은 거 다 말해 줘요!', '개척 {left}번 더요!', '산이 「어서 와」라고 했다고요? 저한테는 「누구니」라고 했는데. 신기하다. 그래도 괜찮아요. 모르는 건 무서운 게 아니니까요.'),
  Q('j08', 'yoon', 'annex:f2:music', '별관 2층 · 음악실', 10, 22, '구렁이 피리', { type: 'kill', enemy: 'daemang', n: 3 },
    '음악실 피리를 불면 산에서 큰 구렁이가 대답을 한대요. 대망이요! 음악 동아리 애들이 장난으로 불었다가 진짜로 나왔대요… 세 번만 돌려보내 줄래요? 저는 피리 숨겨 둘게요.',
    '사독 조심해요! 해독환 있어요?', '대망이 {left}번 남았어요. 추가전투 3단계래요.', '피리 다시 꺼내도 되겠다! …이번엔 진짜 안 불 거예요. 아마도요.', { reward: { item: 'ail-snake-pill' } }),
  Q('j09', 'yoon', 'annex:roof:garden', '별관 옥상 · 정원', 12, 24, '진달래 꽃밭', { type: 'deliver', item: 'azalea', n: 4 },
    '옥상 정원에 꽃밭을 만들고 싶어요. 진달래 네 송이만 구해 줄래요? 진달래 샘터길에 많대요. 다 심으면 {name} 이름 붙인 팻말도 꽂을게요!',
    '이름 팻말이요! 잊어버리지 않게요.', '진달래 {left}송이 더요!', '팻말 꽂았어요. 「{name}의 꽃밭」. …매일 와서 이름 불러 줄게요. 그래야 안 잊어버리죠.'),
  Q('j10', 'yoon', 'mainHall:f3:locker1', '본관 3층 · 물품보관소(1학년)', 14, 26, '고뿔이 돌아요', { type: 'make', item: 'ail-cough-pill', n: 1 },
    '1학년 애들이 다 고뿔에 걸렸어요. 물가 실습 다녀와서 그런가 봐요. 도라지 고뿔환 하나만 만들어 줄래요? 조리실에서 만들 수 있대요. 제 보관함에 넣어 두면 나눠 줄게요.',
    '저도 콧물 나요. 히잉.', '도라지 고뿔환 {left}개요!', '고마워요! 반 쪼개서 저도 먹을게요. …반만 먹어도 되는 거 맞죠?', { reward: { item: 'ail-cough-tea' } }),
  Q('j11', 'yoon', 'annex:f2:craft', '별관 2층 · 공작소', 16, 30, '역병 귀신', { type: 'kill', enemy: 'jeokwi', n: 3 },
    '공작소에 저퀴가 들었대요. 병을 옮기는 귀신이요. 그래서 공작소 애들이 다 메스껍다고… 세 번만 쫓아 줄래요? 저는 숯가루 해독제 만들어 둘게요.',
    '균독 오면 바로 와요! 해독제 있어요.', '저퀴 {left}번 남았어요. 추가전투 4단계래요.', '다들 괜찮아졌어요! {name}는요? 메스껍지 않아요? 정말요?', { reward: { item: 'ail-fungus-ash' } }),
  Q('j12', 'yoon', 'mainHall:f3:class2', '본관 3층 · 교실(2학년)', 18, 32, '당귀 두 뿌리', { type: 'deliver', item: 'dangwi', n: 2 },
    '2학년 선배가 실습하다가 근육이 다 뭉쳤대요. 당귀 두 뿌리만 구해 줄래요? 약초꾼 오솔길에 있대요. 근육탕 끓여 드리려고요.',
    '선배가 고맙다고 할 거예요. …아마도요. 무뚝뚝하셔서.', '당귀 {left}뿌리 더요!', '선배가 고맙다고 하셨어요! 아니, 고개를 끄덕이셨어요. 그게 그 말이래요.', { reward: { item: 'ail-dangwi-soup' } }),
  Q('j13', 'yoon', 'gym:right:campsite', '비령산 · 캠핑장', 22, 36, '여우 스님', { type: 'kill', enemy: 'noho-seung', n: 3 },
    '캠핑장에 스님이 와서 시주를 하라고 했대요. 근데 꼬리가 보였대요. 노호승이요! 늙은 여우가 스님으로 둔갑한 거래요. 세 번만 정체를 밝혀 줄래요?',
    '꼬리 보이면 바로 말해요! 저도 보고 싶어요.', '노호승 {left}번 남았어요. 추가전투 6단계래요.', '꼬리 봤어요? 몇 개였어요? 하나요? 아, 아홉 개는 아니구나. 다행이다!'),
  Q('j14', 'yoon', 'mainHall:f3:locker2', '본관 3층 · 물품보관소(2학년)', 28, 42, '깃털 없는 새', { type: 'kill', enemy: 'geuseunsae', n: 3 },
    '보관함 안에서 깃털 없는 새 울음소리가 나요. 그슨새래요. 그 소리 들으면 길을 잃는대요… 저 어제 기숙사 가는 길을 세 번이나 헷갈렸어요. 세 번만, 부탁해요.',
    '길 잃으면 제 이름 불러요. 제가 대답할게요. …제 이름 알죠?', '그슨새 {left}번 남았어요. 추가전투 7단계래요.', '오늘은 한 번에 기숙사 찾았어요! {name}, 제 이름 한 번만 불러 줄래요? …응, 맞아요. 고마워요.'),
  Q('j15', 'yoon', 'gym:left:goblinFarm', '비령산 · 도깨비 농장', 36, 99, '백골의 행군', { type: 'kill', enemy: 'baekgol-janggun', n: 3 },
    '도깨비 농장에서 밤에 북소리가 나요. 백골장군이 군사를 끌고 산을 내려온대요. 도깨비들이 다 제 뒤에 숨었어요. 저도 무서운데… {name}라면 할 수 있을 것 같아요. 세 번만.',
    '돌아오면 도깨비들이랑 잔치해요! 꼭 돌아와요.', '백골장군 {left}번 남았어요. 추가전투 9단계래요.', '북소리가 멎었어요. 도깨비들이 {name} 이름으로 노래를 만들었대요. 이제 아무도 {name}를 잊어버리지 않을 거예요.', { reward: { item: 'ail-two-loofah' } }),
]

// ── 보상 · 조건 ──
const REC = [0, 4, 8, 12, 16, 20, 25, 30, 36, 43, 50]
const tierOfS = (s) => { let t = 1; for (let i = 1; i <= 10; i++) if (s >= REC[i] * 0.9) t = i; return t }
const enemyOf = (id) => ALL_ENEMIES.find((e) => e.id === id) ?? BESTIARY_ENEMIES.find((e) => e.id === id)
export const enemyTier = (id) => enemyOf(id)?.tier ?? 0 // 실습장 상대는 0(언제나 열려 있다)
export function rewardOf(q) {
  const t = tierOfS(q.minS)
  const base = { money: Math.round((30 + 25 * t) / 5) * 5, spirit: 5 * t }
  if (q.goal.type === 'kill' || q.goal.type === 'win') { base.money += 10 * t; base.spirit += 3 * t }
  return { ...base, ...(q.reward ?? {}) }
}
export const rewardText = (r) => [r.money ? `${r.money}냥` : '', r.spirit ? `영력 ${r.spirit}` : '', r.item ? `[${itemOf(r.item)?.name ?? r.item}]` : ''].filter(Boolean).join(' · ')
export const goalText = (q) => {
  const g = q.goal
  if (g.type === 'kill') return `${enemyOf(g.enemy)?.name ?? g.enemy} ${g.n}번 쓰러뜨리기`
  if (g.type === 'win') return `전투에서 ${g.n}번 이기기`
  if (g.type === 'lesson') return `수업 ${g.n}번 마치기`
  if (g.type === 'pioneer') return `개척 ${g.n}번 나가기`
  if (g.type === 'make') return `[${itemOf(g.item)?.name ?? g.item}] ${g.n}개 만들기`
  if (g.type === 'deliver') return `[${itemOf(g.item)?.name ?? g.item}] ${g.n}개 건네기`
  if (g.type === 'visit') return `${g.where} 살피기`
  return ''
}
const goalN = (g) => (g.type === 'visit' ? 1 : g.n)

const stateOf = (p) => p?.npcQ ?? { act: {}, done: {} }
const fill = (text, p, left) => String(text ?? '').split('{name}').join(p?.name || '당신').split('{left}').join(String(left))
/** 지금 수치(보정 포함 평균 S) · 열린 단계에서 이 부탁이 보이는가 */
export function canOffer(q, p, S, openTier) {
  const st = stateOf(p)
  if (st.done[q.id] || st.act[q.id]) return false
  if (S < q.minS || S > q.maxS) return false
  if (q.goal.type === 'kill' && enemyTier(q.goal.enemy) > openTier) return false
  return true
}
export function progressOf(q, p) {
  const a = stateOf(p).act[q.id]
  if (!a) return null
  const need = goalN(q.goal)
  const cur = q.goal.type === 'deliver' ? Math.min(need, p.inventory?.[q.goal.item] || 0) : Math.min(need, a.n || 0)
  return { cur, need, left: need - cur, done: cur >= need }
}
/** 장소 하나에서 보일 것: 받을 수 있는 부탁 + 이 장소에서 받은(진행 중인) 부탁 */
export function placeView(p, place, S, openTier) {
  const st = stateOf(p)
  const activeN = Object.keys(st.act).length
  const here = NPC_QUESTS.filter((q) => q.place === place)
  const rows = []
  for (const q of here) {
    const pr = progressOf(q, p)
    if (pr) rows.push({ q, state: 'active', pr, line: fill(pr.done ? q.done : q.progress, p, pr.left), reward: rewardOf(q) })
    else if (canOffer(q, p, S, openTier)) rows.push({ q, state: 'offer', line: fill(q.offer, p, goalN(q.goal)), reward: rewardOf(q), full: activeN >= MAX_ACTIVE })
  }
  return rows
}
export function activeList(p) {
  const st = stateOf(p)
  return NPC_QUESTS.filter((q) => st.act[q.id]).map((q) => ({ q, pr: progressOf(q, p), npc: NPCS[q.npc].name }))
}
export function acceptQuest(p, id, now = Date.now()) {
  const q = NPC_QUESTS.find((x) => x.id === id); const st = stateOf(p)
  if (!q || st.act[id] || st.done[id]) return { error: '받을 수 없는 부탁이다.' }
  if (Object.keys(st.act).length >= MAX_ACTIVE) return { error: `부탁은 한 번에 ${MAX_ACTIVE}건까지 받을 수 있다.` }
  return { player: { ...p, npcQ: { ...st, act: { ...st.act, [id]: { at: now, n: 0 } } } }, log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 받았다 — ${goalText(q)} (마치러 ${q.where}으로)`, line: fill(q.accept, p, goalN(q.goal)) }
}
export function abandonQuest(p, id) {
  const q = NPC_QUESTS.find((x) => x.id === id); const st = stateOf(p)
  if (!q || !st.act[id]) return { error: '진행 중인 부탁이 아니다.' }
  const act = { ...st.act }; delete act[id]
  return { player: { ...p, npcQ: { ...st, act } }, log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 그만두었다. (다시 받을 수 있다)` }
}
export function finishQuest(p, id, now = Date.now()) {
  const q = NPC_QUESTS.find((x) => x.id === id); const st = stateOf(p)
  const pr = q && progressOf(q, p)
  if (!pr?.done) return { error: '아직 마치지 않았다.' }
  let inv = { ...p.inventory }
  if (q.goal.type === 'deliver') { inv[q.goal.item] -= q.goal.n; if (inv[q.goal.item] <= 0) delete inv[q.goal.item] }
  const r = rewardOf(q)
  if (r.item) inv[r.item] = (inv[r.item] || 0) + 1
  const act = { ...st.act }; delete act[id]
  const next = clampSpirit({ ...p, inventory: inv, money: (p.money || 0) + (r.money || 0), spirit: (p.spirit || 0) + (r.spirit || 0), npcQ: { act, done: { ...st.done, [id]: now } } })
  return { player: next, log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 마쳤다. 보상: ${rewardText(r)}`, line: fill(q.done, p, 0) }
}
/** 활동이 일어났다 → 진행 중인 부탁의 수를 센다. type: kill(id) · win · lesson · pioneer · make(id, qty) · visit(key) */
export function npcEvent(p, type, arg = null, qty = 1) {
  const st = stateOf(p)
  let changed = false
  const act = { ...st.act }
  for (const id of Object.keys(act)) {
    const q = NPC_QUESTS.find((x) => x.id === id); if (!q) continue
    const g = q.goal
    const hit = (g.type === type && (type === 'kill' ? g.enemy === arg : type === 'make' ? g.item === arg : type === 'visit' ? g.key === arg : true))
    if (hit && (act[id].n || 0) < goalN(g)) { act[id] = { ...act[id], n: Math.min(goalN(g), (act[id].n || 0) + (type === 'make' ? qty : 1)) }; changed = true }
  }
  return changed ? { ...p, npcQ: { ...st, act } } : p
}
