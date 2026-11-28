// 비령 vC.06 — 인물의 부탁(NPC 퀘스트). 연호수 · 서창현 · 윤진서가 강학당 · 비령산의 조사 장소 곳곳에서 부탁한다(사당에는 없다).
//
// · 조사 장소에 들어가면 [이 장소에서 받을 수 있는 퀘스트]가 보인다 — 그 장소에서 받고, 그 장소로 돌아와 마친다.
// · 내 수준(보정 포함 육조 평균 S)이 minS ~ maxS 일 때만 나온다. 적을 쓰러뜨리는 부탁은 그 적의 추가전투 단계가 열려 있어야 나온다.
// · 한 번에 두 건까지(vD.04) — 하나를 마치면 자리가 비어 다음 부탁을 받는다. 한 번 마친 부탁은 다시 나오지 않는다.
// · 관리자가 [스토리 관리 → 퀘스트 공개]를 누르기 전에는 받을 수 있는 부탁이 보이지 않는다(받아 둔 부탁은 마칠 수 있다).
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
  // V.01 사찰의 △△ — 본편에서 내가 지어 준 이름으로 불린다(아직 안 지었으면 「무명」)
  god: { get name() { return godNameNow() }, color: '#e6c77a' },
}
const godNameNow = () => { try { return String(globalThis.BiryeongQuest?.godName?.() || '').trim() || '무명' } catch { return '무명' } }
export const MAX_ACTIVE = 2

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


// ── V.01 도깨비 증표 퀘스트 15종: 사찰의 △△ ──
// · 사찰(비령산 · 중앙길 · 산 오르기 · 사찰)에서만 받고 마친다. 하루(한국 시각)에 하나씩, 차례대로.
// · 인물의 부탁 45종과 따로 연다 — 관리자가 [스토리 관리 → 도깨비 증표 퀘스트 공개]를 누르기 전에는 보이지 않는다.
// · 인물의 부탁 두 건 자리와 상관없다(△△의 부탁은 한 번에 한 건). 보상은 도깨비 증표.
export const GOD_PLACE = 'gym:center:climb:temple'
export const GOD_WHERE = '비령산 · 사찰'
const G = (id, title, goal, offer, accept, progress, done, n = 1) => ({ id, npc: 'god', place: GOD_PLACE, where: GOD_WHERE, minS: 0, maxS: 999, title, goal, offer, accept, progress, done, god: true, reward: { item: 'goblin-token', n } })
export const GOD_QUESTS = [
  G('god01', '바람 냄새', { type: 'visit', key: 'gym:center:climb:peak', where: '비령산 · 산꼭대기' },
    '…아. 왔다. {name}다. 나 방금 데굴데굴 굴러서 법당 이 끝에서 저 끝까지 갔다 왔어. 열일곱 번. 심심해. 저 위에, 꼭대기. 오늘 거기 바람이 무슨 냄새인지 맡고 와 줄래? 나는 여기서 못 나가. 아니, 나갈 수는 있는데 안 나가. 그런 거야.',
    '응. 냄새 기억해 와. 코로. 코 있지? …있네.', '꼭대기. 위로, 계속 위로 가면 돼. 하늘 나오기 전에 멈추고.',
    '…솔 냄새? 비 냄새? 둘 다? 와아. 오늘 산이 기분이 좋구나. 그럼 됐어. 이거 줄게. 도깨비들이 나한테 맡겨 놓은 건데, 맡긴 걸 또 맡기는 거야. 괜찮아.'),
  G('god02', '솔방울 시합', { type: 'deliver', item: 'pinecone', n: 3 },
    '{name}, 솔방울 알아? 동글동글하고 비늘 있는 거. 세 개만. 나 그거 굴리기 시합 할 거야. 누구랑? …나랑. 나 혼자. 나랑, 나랑, 나. 셋이서.',
    '큰 거, 작은 거, 중간 거. 아니 아무거나. 아무거나가 제일 좋아.', '솔방울 {left}개 더. 솟대 소나무길에 떨어져 있대. 산이 그러더라.',
    '와. 이게 제일 빨라. 이건 제일 느려. 이건… 이건 굴러가다 멈춰서 생각을 하네. 얘 마음에 든다. 고마워. 고마운 건 이렇게 주는 거래.'),
  G('god03', '학교라는 곳', { type: 'lesson', n: 2 },
    '학교에서는 뭘 해? 앉아 있어? 계속? 해 질 때까지? …신기하다. 수업 두 번만 듣고 와서 무슨 얘기 했는지 알려 줘. 나도 창문 밖에서 들어 본 적은 있는데, 귀신 하나가 옆에서 너무 떠들어서 하나도 못 들었어. 아, 그 귀신은 내가 혼내 줬어. 몰래.',
    '졸면 안 돼. 졸면… 음, 졸아도 돼. 꿈도 수업이야.', '수업 {left}번 더. 강학당에 가면 있어.',
    '귀신은 소금을 싫어하고, 이름을 부르면 돌아본다… 응, 응. 맞아. 다 맞아. 근데 그거 말고 하나 더 있는데. …비밀. 조금 더 크면 알려 줄게.'),
  G('god04', '사사삭 빗자루', { type: 'kill', enemy: 'mongdangbi', n: 2 },
    '쉿. 들려? 사사삭. 사사삭. 몽당비들이 또 마당 쓸러 왔어. 근데 쓸지는 않고 낙엽을 더 흩어 놔. 장난꾸러기야. 두 번만 혼내 줘. 세게 말고. 콩, 하고.',
    '콩. 이렇게. …너무 약한가? 그럼 쿵.', '몽당비 도깨비 {left}번 더. 추가전투 1단계에 있어.',
    '마당이 조용해졌다. 낙엽이 낙엽끼리 얌전히 누워 있어. 좋아. 이런 날은 산이 낮잠을 자.'),
  G('god05', '바깥은 어떤 모양', { type: 'pioneer', n: 2 },
    '{name}, {name}, {name}! 바깥은 어떤 모양이야? 동그래? 네모나? 길쭉해? 저기 산 아래, 사람들이 다니는 길. 나는 산 안쪽은 아주 잘 알아. 바위 하나하나 이름도 알아. 근데 바깥은 몰라. 개척 두 번만 나가서 보고 와.',
    '본 거 다 기억해. 하나도 빼지 말고. 아, 무서운 건 빼도 돼.', '개척 {left}번 더.',
    '…길이 구불구불하고, 개울이 있고, 돌탑이 있고. 아, 그 돌탑. 그거 옛날에 내가 쌓아 달라고 한 거야. 아직 있구나. 다행이다. 히히.'),
  G('god06', '불이 버섯한테 하는 말', { type: 'make', item: 'grilled-mushroom', n: 1 },
    '버섯은 구우면 냄새가 달라져? 정말? 왜? 불이 버섯한테 무슨 말을 하는 거야? 비밀 얘기? 무서운 얘기? …나 하나만 보고 싶어. 버섯 구이. 조리실에서 만들 수 있대. 네가 만든 걸로.',
    '타면 안 돼. 탄 건 산짐승들이 싫어해. 나도 싫어해. 아마.', '버섯 구이 {left}개. 받은 뒤에 만든 것만 쳐 줄 거야. 나는 다 알아.',
    '…! …! 뜨거워. 근데 냄새 좋아. 근데 뜨거워. 근데 냄새 좋아. 이거 계속 반복돼. 신기해. 남은 건 네가 먹어. 나는 냄새만 먹었어.'),
  G('god07', '오래된 손님', { type: 'visit', key: 'gym:center:climb:tomb', where: '비령산 · 묘소' },
    '묘소 쪽에 오늘 누가 왔어. 누군지는 알아. 근데 말 걸기가 좀… 쑥스러워. 아주 오래된 손님이거든. 네가 가서 인사만 하고 와. 「잘 지내시죠」 하고. 대답은 안 할 거야. 그래도 들어.',
    '공손하게. 고개는 이만큼. 아니, 이만큼.', '묘소에 다녀와. 사찰 옆길이야.',
    '…그래, 웃었구나. 안 보여도 알아. 산 위에서는 그런 게 다 느껴져. 고마워. 오늘은 네가 잠깐 산신 대신이었어.'),
  G('god08', '도토리 세는 밤', { type: 'deliver', item: 'acorn', n: 4 },
    '다람쥐들이 겨울 준비를 하다가 도토리를 어디 묻었는지 다 까먹었대. 그래서 울어. 다람쥐가 울면 산이 시끄러워. 도토리 네 개만 줘. 내가 다시 나눠 줄게. 공평하게. 아니, 제일 많이 운 애한테 하나 더.',
    '도토리 숲길에 많아. 거기 다람쥐들한테는 비밀이야.', '도토리 {left}개 더.',
    '하나, 둘, 셋, 넷. …다섯? 아, 아니다 넷이다. 하나를 두 번 셌어. 이제 아무도 안 울어. 산이 조용해졌다.'),
  G('god09', '아래에서 올라오는 냄새', { type: 'win', n: 3 },
    '…오늘은 장난 아니야. 잘 들어. 산 아래에서 나쁜 것들 냄새가 올라와. 학교 쪽으로. 내가 밤마다 몰래 밀어내고 있는데, 오늘은 좀 많아. 세 번만 이겨 줘. 어디서든. 네가 이길 때마다 그것들이 그만큼 겁을 먹어.',
    '다치지 마. 이건 부탁이 아니라… 음. 명령? 아니, 부탁.', '{left}번 더 이기면 돼. 실습장이든 개척이든.',
    '…냄새가 옅어졌어. 고마워, {name}. 내가 지키는 건 산인데, 산에는 학교도 들어 있어. 그러니까 너도 들어 있어. 알지?'),
  G('god10', '네 장짜리 행운', { type: 'deliver', item: 'clover', n: 1 },
    '행운이 뭐야? 사람들은 잎사귀 네 개짜리 풀을 보면 행운이래. 세 개면 안 되고, 다섯 개도 안 되고. 딱 네 개. 이상해. 근데 보고 싶어. 하나만.',
    '찾으면 바로 와. 행운은 오래 들고 있으면 닳는대. 거짓말 같지만.', '네잎클로버 하나. 솟대 소나무길 풀밭에 숨어 있어.',
    '…하나, 둘, 셋, 넷. 진짜 네 개다. 이걸 보면 행운이 와? 지금 와? …온 것 같아. 네가 왔으니까.'),
  G('god11', '손 흔들기', { type: 'visit', key: 'mainHall:roof:door', where: '본관 옥상 · 문' },
    '학교에서 제일 높은 데는 어디야? 옥상? 거기서 이쪽을 보면 내가 보일까? 나는 거기가 보여. 가끔 손 흔드는 애들도 보여. 내가 흔드는 건 안 보이겠지만. 옥상에 한번 올라가 줘. 내가 손 흔들게.',
    '나 흔든다. 지금부터. 계속.', '본관 옥상까지 올라가 줘. 나 아직 흔들고 있어.',
    '봤어? 못 봤어? 괜찮아. 나는 봤어. 너 작더라. 개미만 했어. 귀여웠어.'),
  G('god12', '북쪽 바위의 금', { type: 'deliver', item: 'small-altar', n: 1 },
    '…{name}. 잠깐 진지해질게. 산 북쪽 바위 밑에 금이 갔어. 거기로 안 좋은 게 새어 나와. 내가 막을 수는 있는데, 손이 하나 모자라. 소형 돌제단 하나만 만들어 줘. 공작소에서. 그걸 거기 놓으면 내 손 대신이 돼.',
    '정성 들여. 돌은 정성을 알아.', '소형 돌제단 {left}개. 공작소에서 만들 수 있어.',
    '…됐어. 막혔어. 이제 북쪽 바람이 깨끗해. 너는 몰랐겠지만, 방금 학교 하나를 지켰어. 아니, 둘? 아무튼 많이.'),
  G('god13', '산 한 바퀴', { type: 'pioneer', n: 3 },
    '산신은 매일 산을 한 바퀴 돌아야 해. 그게 일이야. 근데 오늘은 데굴데굴하느라 못 했어. …비밀이야. 대신 돌아 줄래? 개척 세 번. 그러면 산이 「아, 오늘도 누가 왔구나」 하고 안심해.',
    '발자국 크게 내. 산이 알아보게.', '개척 {left}번 더.',
    '산이 안심했대. 근데 나한테 「오늘 산신 발이 좀 작았다」고 그러더라. 히히. 들켰다.'),
  G('god14', '신발 세는 손님', { type: 'kill', enemy: 'yagwanggwi', n: 2 },
    '야광귀 알아? 밤에 와서 신발을 신어 보고, 맞으면 가져가. 그러면 신발 주인은 한 해 운이 나빠져. 기숙사 앞에 걔네가 줄 서 있어. 내가 체를 걸어 놨거든, 구멍 세느라 정신없게. 근데 두 마리는 체를 다 셌어. 똑똑한 애들이야. 쫓아내 줘.',
    '신발 꽉 신고 가. 벗겨지면 끝이야.', '야광귀 {left}번 더. 추가전투 1단계에 있어.',
    '기숙사 신발들이 다 제자리에 있어. 짝도 맞아. 좋아. 이것도 내가 몰래 한 걸로 하자. 너랑 나만 알아.'),
  G('god15', '산이 기억하는 사람', { type: 'win', n: 5 },
    '{name}. 오늘은 내가 조금 커 보이지? 기분 탓 아니야. 가끔 이렇게 돼. 산이 나를 크게 만들 때가 있어. …들어. 곧 겨울이 와. 겨울에는 나쁜 것들이 더 가까이 내려와. 다섯 번만 이겨 줘. 그러면 이 산이 너를 기억할 거야. 산이 기억하는 사람은 길을 잃지 않아.',
    '…응. 다녀와. 나는 여기서 보고 있을게. 굴러다니면서.', '{left}번 더. 산이 세고 있어.',
    '다섯. 산이 다 셌어. 이제 너는 이 산의 사람이야. 어디 가도, 길을 잃어도, 위를 보면 돼. 내가 있어. …아, 다시 작아졌다. 히히. 이거 다 가져. 도깨비들한테는 내가 줬다고 해. 다들 깜짝 놀랄 거야.', 3),
]
const ALL_Q = [...NPC_QUESTS, ...GOD_QUESTS]
const KST = 9 * 3600 * 1000
export const kstDay = (t = Date.now()) => Math.floor((t + KST) / 864e5)
const godState = (p) => p?.godQ ?? { act: {}, done: {} }
/** 오늘 받을 수 있는 △△의 부탁(없으면 null): 진행 중인 게 없고, 오늘 마친 게 없을 때 — 아직 안 한 것 중 첫째 */
export function godNext(p, openTier = 1, now = Date.now()) {
  const st = godState(p)
  if (Object.keys(st.act).length) return null
  const today = kstDay(now)
  if (Object.values(st.done).some((t) => kstDay(t) === today)) return null
  for (const q of GOD_QUESTS) {
    if (st.done[q.id]) continue
    if (q.goal.type === 'kill' && enemyTier(q.goal.enemy) > openTier) return null // 차례를 건너뛰지 않는다
    return q
  }
  return null
}

// ── 보상 · 조건 ──
const REC = [0, 4, 8, 12, 16, 20, 25, 30, 36, 43, 50]
const tierOfS = (s) => { let t = 1; for (let i = 1; i <= 10; i++) if (s >= REC[i] * 0.9) t = i; return t }
const enemyOf = (id) => ALL_ENEMIES.find((e) => e.id === id) ?? BESTIARY_ENEMIES.find((e) => e.id === id)
export const enemyTier = (id) => enemyOf(id)?.tier ?? 0 // 실습장 상대는 0(언제나 열려 있다)
export function rewardOf(q) {
  if (q.god) return { ...q.reward }
  const t = tierOfS(q.minS)
  const base = { money: Math.round((30 + 25 * t) / 5) * 5, spirit: 5 * t }
  if (q.goal.type === 'kill' || q.goal.type === 'win') { base.money += 10 * t; base.spirit += 3 * t }
  return { ...base, ...(q.reward ?? {}) }
}
export const rewardText = (r) => [r.money ? `${r.money}냥` : '', r.spirit ? `영력 ${r.spirit}` : '', r.item ? `[${itemOf(r.item)?.name ?? r.item}]${(r.n || 1) > 1 ? ` ${r.n}개` : ''}` : ''].filter(Boolean).join(' · ')
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

const npcState = (p) => p?.npcQ ?? { act: {}, done: {} }
const stateOf = npcState
const stOf = (p, q) => (q?.god ? godState(p) : npcState(p))
const withSt = (p, q, st) => (q?.god ? { ...p, godQ: st } : { ...p, npcQ: st })
// V.01 받침에 맞춘 「으로 / 로」(받침 없음 · ㄹ 받침 → 로)
const euro = (w) => { const c = String(w ?? '').trim().slice(-1).charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return '으로'; const j = c % 28; return j === 0 || j === 8 ? '로' : '으로' }
const qOf = (id) => ALL_Q.find((x) => x.id === id)
const fill = (text, p, left) => String(text ?? '').split('{name}').join(p?.name || '당신').split('{left}').join(String(left)).split('{god}').join(godNameNow())
/** 지금 수치(보정 포함 평균 S) · 열린 단계에서 이 부탁이 보이는가 */
export function canOffer(q, p, S, openTier) {
  const st = stateOf(p)
  if (st.done[q.id] || st.act[q.id]) return false
  if (S < q.minS || S > q.maxS) return false
  if (q.goal.type === 'kill' && enemyTier(q.goal.enemy) > openTier) return false
  return true
}
export function progressOf(q, p) {
  const a = stOf(p, q).act[q.id]
  if (!a) return null
  const need = goalN(q.goal)
  const cur = q.goal.type === 'deliver' ? Math.min(need, p.inventory?.[q.goal.item] || 0) : Math.min(need, a.n || 0)
  return { cur, need, left: need - cur, done: cur >= need }
}
/** 장소 하나에서 보일 것: 받을 수 있는 부탁 + 이 장소에서 받은(진행 중인) 부탁 */
export function placeView(p, place, S, openTier, open = true, godOpen = false, now = Date.now()) {
  const st = stateOf(p)
  const activeN = activeCount(p)
  const here = NPC_QUESTS.filter((q) => q.place === place)
  const rows = []
  for (const q of here) {
    const pr = progressOf(q, p)
    if (pr) rows.push({ q, state: 'active', pr, line: fill(pr.done ? q.done : q.progress, p, pr.left), reward: rewardOf(q) })
    else if (open && canOffer(q, p, S, openTier)) rows.push({ q, state: 'offer', line: fill(q.offer, p, goalN(q.goal)), reward: rewardOf(q), full: activeN >= MAX_ACTIVE })
  }
  // V.01 사찰의 △△ — 진행 중인 것은 닫혀 있어도 마칠 수 있다. 새 부탁은 공개되어 있을 때 하루 하나
  if (place === GOD_PLACE) {
    for (const q of GOD_QUESTS) { const pr = progressOf(q, p); if (pr) rows.push({ q, state: 'active', pr, line: fill(pr.done ? q.done : q.progress, p, pr.left), reward: rewardOf(q) }) }
    const nx = godOpen ? godNext(p, openTier, now) : null
    if (nx) rows.push({ q: nx, state: 'offer', line: fill(nx.offer, p, goalN(nx.goal)), reward: rewardOf(nx), full: false })
    else if (godOpen && !rows.some((r) => r.q.god)) {
      const left = GOD_QUESTS.filter((q) => !godState(p).done[q.id]).length
      rows.push({ q: { id: 'god-rest', npc: 'god', title: left ? '오늘은 여기까지' : '산의 사람', goal: { type: 'none' }, god: true }, state: 'rest', line: left ? '…오늘은 놀아 줘서 고마워. 내일 또 와. 내일의 나는 또 심심할 거야. 분명히.' : '이제 부탁은 없어. 그냥 놀러 와. 데굴데굴 같이 하자.', reward: {} })
    }
  }
  return rows
}
/** 진행 중인 부탁 수 — 지금 있는 부탁만 센다(없어진 부탁이 자리를 잡아먹지 않게) */
export const activeCount = (p) => Object.keys(stateOf(p).act).filter((id) => NPC_QUESTS.some((q) => q.id === id)).length
export function activeList(p) {
  return ALL_Q.filter((q) => stOf(p, q).act[q.id]).map((q) => ({ q, pr: progressOf(q, p), npc: NPCS[q.npc].name }))
}
export function acceptQuest(p, id, now = Date.now()) {
  const q = qOf(id); const st = stOf(p, q)
  if (!q || st.act[id] || st.done[id]) return { error: '받을 수 없는 부탁이다.' }
  if (q.god) { if (godNext(p, 99, now)?.id !== id) return { error: '오늘은 더 받을 수 없는 부탁이다.' } }
  else if (activeCount(p) >= MAX_ACTIVE) return { error: `부탁은 한 번에 ${MAX_ACTIVE}건까지 받을 수 있다. 하나를 마치면 다시 받을 수 있다.` }
  return { player: withSt(p, q, { ...st, act: { ...st.act, [id]: { at: now, n: 0 } } }), log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 받았다 — ${goalText(q)} (마치러 ${q.where}${euro(q.where)})`, line: fill(q.accept, p, goalN(q.goal)) }
}
export function abandonQuest(p, id) {
  const q = qOf(id); const st = stOf(p, q)
  if (!q || !st.act[id]) return { error: '진행 중인 부탁이 아니다.' }
  const act = { ...st.act }; delete act[id]
  return { player: withSt(p, q, { ...st, act }), log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 그만두었다. (다시 받을 수 있다)` }
}
export function finishQuest(p, id, now = Date.now()) {
  const q = qOf(id); const st = stOf(p, q)
  const pr = q && progressOf(q, p)
  if (!pr?.done) return { error: '아직 마치지 않았다.' }
  let inv = { ...p.inventory }
  if (q.goal.type === 'deliver') { inv[q.goal.item] -= q.goal.n; if (inv[q.goal.item] <= 0) delete inv[q.goal.item] }
  const r = rewardOf(q)
  if (r.item) inv[r.item] = (inv[r.item] || 0) + (r.n || 1)
  const act = { ...st.act }; delete act[id]
  const next = clampSpirit(withSt({ ...p, inventory: inv, money: (p.money || 0) + (r.money || 0), spirit: (p.spirit || 0) + (r.spirit || 0) }, q, { act, done: { ...st.done, [id]: now } }))
  return { player: next, log: `${NPCS[q.npc].name}의 부탁 「${q.title}」을(를) 마쳤다. 보상: ${rewardText(r)}`, line: fill(q.done, p, 0) }
}
/** 활동이 일어났다 → 진행 중인 부탁의 수를 센다. type: kill(id) · win · lesson · pioneer · make(id, qty) · visit(key) */
export function npcEvent(p, type, arg = null, qty = 1) {
  let out = p
  for (const god of [false, true]) {
    const st = god ? godState(out) : npcState(out)
    let changed = false
    const act = { ...st.act }
    for (const id of Object.keys(act)) {
      const q = (god ? GOD_QUESTS : NPC_QUESTS).find((x) => x.id === id); if (!q) continue
      const g = q.goal
      const hit = (g.type === type && (type === 'kill' ? g.enemy === arg : type === 'make' ? g.item === arg : type === 'visit' ? g.key === arg : true))
      if (hit && (act[id].n || 0) < goalN(g)) { act[id] = { ...act[id], n: Math.min(goalN(g), (act[id].n || 0) + (type === 'make' ? qty : 1)) }; changed = true }
    }
    if (changed) out = god ? { ...out, godQ: { ...st, act } } : { ...out, npcQ: { ...st, act } }
  }
  return out
}
