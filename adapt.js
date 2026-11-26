/* 秘靈 · 비령 — 적응 퀘스트 (vD.06.10)
 *
 *   웹게임 자체의 길잡이(튜토리얼). 원고: 구글 시트 「적응 퀘스트 스크립트」 탭.
 *   · 프롤로그 첫 장면 「최초 최후의 신탁」이 끝나면 메뉴의 [適 적응 퀘스트]를 강조하고 서창현이 안내한다(한 번).
 *   · 퀘스트는 차례로 열린다(1-1 → 1-5). 다 마친 퀘스트는 언제든 다시 할 수 있다.
 *   · 보상(마칠 때 받는 것 · 도중에 건네받는 냥 · 물건)은 계정당 처음 한 번만 — 다시 할 때는 주지 않는다.
 *   · 단계마다 화면의 단추를 반짝여 알려 주고, 그곳을 누르거나(장소 이동 · 구매 · 개척 · 제작 …) [다음]을 누르면 넘어간다.
 *
 *   기록: save.adapt = { intro, done: {id: 시각}, paid: {id: 시각}, gave: {'id.단계': 시각}, cur: { id, step } }
 */
(() => {
  'use strict';
  const App = window.BiryeongApp;
  if (!App) return;
  const { h, btn, para, toast } = App;
  const $ = (s, r = document) => r.querySelector(s);
  const WHO = '서창현';
  const PORTRAIT = (window.BIRYEONG_PORTRAITS?.[WHO]?.base) || '';

  /* ───────── 길잡이 대상(강조할 단추) ─────────
     { sel, text? } — sel 에 맞는 보이는 것 가운데 글이 text 와 같은 것(앞의 한자 한 글자는 무시).
     path: 얕은 곳 → 깊은 곳 순서. 지금 화면에 보이는 것 가운데 가장 깊은 하나만 강조한다(그 단추를 누르면 다음이 보인다). */
  const MAP = { sel: '.page-home', text: '사방 지도' };
  const ZONE = (z) => ({ sel: `.zone-card[data-zone="${z}"]` });
  const PB = (text) => ({ sel: '#pageView button', text });                 // 구역 안의 갈래(본관 · 별관 · 탐사 …)
  const PLAY = (text) => ({ sel: '.play-scope button', text });             // 실행 화면 안의 단추(층 · 방 …)
  const TO_WORKSHOP = [MAP, ZONE('east'), PB('별관'), PB('별관 탐사'), PLAY('2층'), PLAY('공작소')];
  const TO_INFIRMARY = [MAP, ZONE('east'), PB('본관'), PB('본관 탐사'), PLAY('2층'), PLAY('양호실'), { sel: '[data-goto-infirmary]' }];
  const TO_STORE = [MAP, ZONE('west'), PB('매점')];
  const TO_PIONEER = [MAP, ZONE('south'), PB('개척')];
  const TO_ANNEX = [MAP, ZONE('east'), PB('별관'), PB('별관 탐사')];
  const TO_CLASS = [MAP, ZONE('east'), PB('본관'), PB('수업')];
  const TO_BATTLE = [MAP, ZONE('south'), PB('퇴마 실습')];
  const TO_DORM = [MAP, ZONE('west'), PB('내 기숙사')];
  const TO_ARMORY = [MAP, ZONE('south'), PB('뒷산 탐사'), PLAY('왼길'), PLAY('무구보관소'), { sel: '[data-armory]' }];

  /* ───────── 퀘스트 원고 ─────────
     x: 대사 · hl: 강조(path 배열 · 하나 · all:true 면 보이는 것 모두) · w: 넘어가는 조건(없으면 [다음])
       w: { route } 주소가 그것으로 시작 · { click: 1 } 강조한 곳을 누름 · { ev: 'buy' } 매점에서 삼 · { make: id } 만듦
          { hunt: 'start' | 'end' } 개척 시작 · 끝 · { see: sel } 그것이 보임 · { input: 글 } 찾기 칸에 그 글 · { home: 1 } 첫 화면
     give: 그 단계에서 건네는 것(계정당 처음 한 번) · note: 작은 글씨 */
  const QUESTS = [
    { id: 'a1', title: '1-1. 메인 스트림', sum: '본편 이야기를 보는 법 · 구역을 오가는 법', reward: { money: 30, spirit: 20 }, steps: [
      { x: '안녕하세요, OO 학생. 우선 홈페이지 내에서 스토리를 보는 방법부터 알아보도록 합시다. 각 지역을 이동하는 방법에 대해서도 알아보겠습니다.' },
      { x: '우선 메인스토리의 진행은 이곳에서 확인할 수 있습니다. 항상 떠 있으므로, 놓치는 일은 없을 겁니다.', hl: { sel: '#questTracker' } },
      { x: '혹시 길을 잃으신 경우 이곳에 뜨는 ‘그곳으로’ 버튼을 눌러 즉시 이동이 가능합니다.', hl: { sel: '#questTracker button', text: '그곳으로' } },
      { x: '하지만 오늘은 직접 해보는 법을 배워야겠죠?' },
      { x: '메인 스토리 진행 장소는 이런 식으로 뜹니다. 예를 들어 ‘강학당 › 별관 탐사 › 2층 › 공작소’라고 떠 있다고 해봅시다.' },
      { x: '맨 상위에는 ‘생활관’ ‘비령산 금역’ ‘강학당’ ‘산문’ ‘사당’ 이 뜰 수 있습니다. 해당하는 버튼을 누르고, 하위 버튼들을 계속 눌러가며 이동하시면 됩니다.' },
      { x: '우리의 경우 강학당으로 가라고 되어 있네요. 강학당으로 가보겠습니까?', hl: [MAP, ZONE('east')], w: { route: '#/zone/east' } },
      { x: '그 다음은 별관입니다.', hl: [MAP, ZONE('east'), PB('별관')], w: { route: '#/zone/east/annex' } },
      { x: '별관 탐사 버튼을 눌러 보세요.', hl: TO_ANNEX, w: { route: '#/zone/east/annex/explore' } },
      { x: '2층에 공작소가 있습니다. 가봅시다.', hl: TO_WORKSHOP.slice(0, 5), w: { see: '.play-scope button', text: '공작소' } },
      { x: '여기를 누르면 공작소로 들어갈 수 있습니다.', hl: TO_WORKSHOP, w: { see: '[data-workshop-view="book"]' } },
      { x: '이런 식으로 장소에 도착하면 자동으로 스토리가 진행됩니다. 가끔은 소지품을 열어 아이템을 조사하기, 특정한 제작 또는 채집을 하기가 조건이 되는 경우도 있습니다.' },
      { x: '사방 지도 버튼을 눌러 최초 화면으로 나가 보세요.', hl: MAP, w: { home: 1 } },
      { x: '산문으로 가면 현재 스토리, 다른 학생들의 스토리 도중 선택 현황 등을 살펴볼 수 있습니다. 물론 이동 가능한 탐사 지역도 스토리 도중 생기기도 합니다.', hl: [MAP, ZONE('north')] },
      { x: '지금까지 메인 스토리를 보는 방법에 대해 알아봤습니다. 그럼 다음으로 가볼까요?' },
    ] },
    { id: 'a2', title: '1-2. 스테이터스', sum: '체력 · 영력 · 의지력과 육조 스탯 · 양호실', reward: { money: 20, spirit: 30 }, steps: [
      { x: '안녕하세요, OO 학생. 이번에는 게임 안에서의 성장에 대해 배워보겠습니다.' },
      { x: '게임에는 총 3개의 상태 스테이터스와 6개의 육조 스테이터스가 있습니다.' },
      { x: '상태 스테이터스는 이 3개입니다. 체력, 영력, 의지력으로 나뉩니다. 대부분의 행동(개척, 전투 등)을 하기 위해서는 의지력 소모가 필요합니다.', hl: { sel: '#statusBars' } },
      { x: '영력의 경우 자동으로 차오릅니다. 매우 느리기 때문에 만약 원하신다면 생활관 - 내 기숙사에 가서 빠르게 차오르도록 만들 수 있습니다. 그 외에도 전투, 퀘스트를 통해 영력을 얻을 수 있습니다.', hl: { sel: '#statusBars' } },
      { x: '체력은 느리게 자동으로 회복되지만, 의지력은 자동으로 회복되는 값이 없습니다. 따라서 소모되었을 시 반드시 아이템을 사용하거나 양호실을 활용해야 합니다.' },
      { x: '양호실은 강학당 - 본관 - 2층에 있습니다. 우선 양호실로 이동해 보겠습니까?', hl: TO_INFIRMARY, w: { route: '#/zone/east/infirmary' } },
      { x: '네, 여기가 양호실입니다. 보시다시피 두 가지 활동이 나뉘어 있는데요. 체력을 올리는 것과 의지력을 올리는 것입니다.' },
      { x: '보시다시피 시간을 정해놓고 그 시간만큼 대기해야하는 구조인데요, 중간에 자리를 벗어나는 경우 보상을 받을 수 없으므로 참고 부탁드리겠습니다.' },
      { x: '그럼 이번에는 육조 스테이터스를 확인해봅시다. 이쪽에 있는 6종류의 스테이터스가 여러분이 가진 천성입니다.', hl: { sel: '#statusStats' } },
      { x: '어떤 식으로 스탯을 올리시든 자유입니다. 하지만 기본적으로 개척에 쓰이는 스탯들과 전투에 쓰이는 스탯들이 다르고, 골고루 다양한 기능에 사용되기 때문에 비슷하게 쭉 올리시는 것을 추천드리고 있습니다.' },
      { x: '물론 이론적으로는-게임 시스템을 완전히 이해한다면, 특정 스탯에만 몰아주거나 특정 스탯을 아예 기르지 않는 등의 플레이도 가능합니다. 게임 제작진이 직접 검증해 보았습니다.' },
      { x: '이런 식의 특화가 자연스럽게 이루어질 수 있게끔, 여유 있는 재료는 활발하게 벼룩시장에 올려 주시면 감사드리겠습니다. 그리고 다른 분들의 전투를 도와주시는 것도 중요합니다.', hl: { sel: '.status-menu [data-menu="market"]' } },
      { x: '각 육조 스탯에 마우스를 올리면 어떻게 쓰이는지 설명이 마우스오버로 뜹니다.', hl: { sel: '#statusStats' } },
      { x: '육조 스탯은 영력으로 성장시킬 수 있습니다. 예를 들어 신속을 3에서 4로 올리려면 30의 영력이 드는 식입니다. 최대 레벨은 40입니다.', hl: { sel: '#statusStats .status-stat-up', all: true } },
      { x: '이 게임에는 레벨이라는 개념이 없습니다. 오직 육조 스테이터스의 상승만이 있을 뿐입니다. 육조 스탯에 따라 포지션, 어울리는 영능력, 특화 분야가 모두 달라집니다.' },
      { x: '원하는 스탯을 원하는 방식으로 올려봅시다.', hl: { sel: '#statusStats .status-stat-up', all: true } },
      { x: '그럼 이번 성장에 대한 튜토리얼은 여기까지 하죠. 다음을 부탁드립니다.' },
    ] },
    { id: 'a3', title: '1-3. 개척과 제작', sum: '매점 · 소지품 · 개척 · 공작소에서 만들기 · 도감', reward: { money: 30, spirit: 30 }, steps: [
      { x: '이번엔 아이템에 대하여 알아보겠습니다.' },
      { x: '이 게임에서 아이템을 취득할 수 있는 경로는 다음 5가지입니다.', note: '1. 매점 물품 구매 2. 양호실 약품 구매 3. 퀘스트 보상 4. 탐사 지점 방문 중 랜덤 확률 5. 개척' },
      { x: '겹치는 경우도 있지만 획득할 수 있는 아이템이 서로 다른 경우가 더 많습니다. 따라서 필요한 효과가 무엇인지 미리 확인해두는 것이 중요하겠지요.' },
      { x: '우선 매점에서 아이템을 사는 방법부터 알아봅시다. 매점으로 가보시겠습니까? 생활관으로 가면 갈 수 있습니다.', hl: TO_STORE, w: { route: '#/zone/west/dorm/store' } },
      { x: '이곳에서 아무 아이템이나 사 보세요. 제가 방금 10냥을 드렸습니다.', give: { money: 10 }, hl: [{ sel: '.play-scope [data-item] button', text: '구매', all: true }, { sel: '.play-scope button', text: '개 구매', ends: 1 }], w: { ev: 'buy' }, hint: '반짝이는 [구매] → 개수 확인 뒤 [1개 구매]. 매점이 문을 닫은 시간이면 건너뛰기를 눌러도 된다.' },
      { x: '당신은 그게 마음에 드셨던 모양이군요. 좋습니다. 이제 소지품 칸을 눌러보세요.', hl: { sel: '.status-menu [data-menu="inventory"]' }, w: { click: 1 } },
      { x: '모든 학생은 가방을 최초 1개 가지고 시작합니다. 매점에서 가방을 추가로 구매할 수 있습니다. 기본적으로 소지품 칸은 30칸, 가방 칸은 40칸입니다.' },
      { x: '탐사 지점 중 창고 역할을 하는 공간도 숨겨져 있으니, 직접 탐사를 돌아보시길 권장드립니다. 특별한 선물이 있을지도 모릅니다.' },
      { x: '퀘스트 보상은 말 그대로 퀘스트에 의해 떨어지는 아이템입니다. 탐사 지점 방문을 이곳저곳 하다 보면 가끔 랜덤으로 아이템이 떨어지는 경우도 있습니다. 이 둘은 자동 처리이니 넘어가도록 하죠.' },
      { x: '다음 배워볼 것은 개척이라는 행동입니다. 아이템을 직접 조사하고 수렵 및 채집할 수 있는 탐사 활동입니다.' },
      { x: '개척 항목으로 이동해보세요.', hl: TO_PIONEER, w: { route: '#/zone/south/gym/pioneer' } },
      { x: '가장 쉬운 구역인 뱀딸기 오솔길부터 한 번 가보도록 합시다. 방법은 간단합니다.', hl: { sel: '.play-scope button', text: '뱀딸기 오솔길' }, w: { click: 1 } },
      { x: '우선 턴 수를 확인합니다.', hl: { sel: '.play-scope [data-hunt-turns], .play-scope p', text: '남은 행동', starts: 1 } },
      { x: '의지 10을 내면 개척을 시작할 수 있습니다. 남은 턴 횟수만큼 직접 마스칸에서 캐릭터를 움직여가며 채집을 시도할 수 있습니다.' },
      { x: '이건 아마 직접 해보는 게 이해가 빠를 겁니다. 튜토리얼이 끝나고 나면 직접 한 번 시도해보시길 강력히 권장드립니다.' },
      { x: '지금은 우선 연습만 해봅시다. 제가 방금 사과맛 피크닉 하나를 넣어 드렸습니다. 의지력이 남지 않은 경우 그걸로 회복하시고, 의지력이 꽉 차있는 경우 개척으로 소모한 의지를 다시 채우는 데에 쓰세요.', give: { items: { picnic: 1 } }, hl: { sel: '.status-menu [data-menu="inventory"]' } },
      { x: '개척에 돌입하기 전 미리 개척 대상을 클릭해 레벨 등을 확인할 수 있습니다. 영물과 귀신은 랜덤 인카운터라 나타날 수도, 그러지 않을 수도 있습니다.', hl: { sel: '.play-scope .hunt-tile:not([data-kind="empty"])', all: true } },
      { x: '그럼 시작해봅시다.', hl: { sel: '.play-scope button', text: '개척 시작하기', starts: 1 }, w: { hunt: 'start' } },
      { x: '최초 시작은 무조건 왼쪽 최하단 칸입니다. 거기서 화살표 버튼을 눌러가면서 당신의 위치를 이동할 수 있습니다. OO 학생, 이제 편한 대로 돌아다녀보세요.', w: { hunt: 'end' }, hint: '개척을 마치면(종료하기 · 턴을 다 씀 · 귀신에게 짐) 다음으로 넘어간다.' },
      { x: '고생하셨습니다. 개척을 하는 방법은 어느 정도 이해하셨다고 생각됩니다. 그럼 이제 얻은 아이템들로 제작을 하러 가보겠습니다.' },
      { x: '제가 방금 소지품에 바위 9개를 넣어 드렸습니다.', give: { items: { stone: 9 } } },
      { x: '공작소로 이동해보세요.', hl: TO_WORKSHOP, w: { see: '[data-workshop-view="book"]' } },
      { x: '제작법을 보면 어떤 제작을 할 수 있을지 확인할 수 있습니다. 저희는 이번에 숫돌을 만들 겁니다. 직접 제작하러 가보세요.', hl: { sel: '[data-workshop-view="book"]' }, w: { see: '.play-scope input[placeholder*="초성"]' } },
      { x: '숫돌을 한 번 검색해보시겠어요?', hl: { sel: '.play-scope input[placeholder*="초성"]' }, w: { input: '숫돌' } },
      { x: '이제 칸에 올려주시면 됩니다.', hl: { sel: '[data-recipe-load="r-whetstone"]' }, w: { click: 1 } },
      { x: '이제 제작해보세요.', hl: { sel: '[data-bench-go]' }, w: { make: 'whetstone' } },
      { x: '숫돌이 만들어졌습니다. 당신의 소지품에 들어갔을 겁니다.', hl: MAP, w: { home: 1 } },
      { x: '아이템을 만들다 보면 다양한 아이템들을 확인해야 하는 때가 생길 겁니다. 그럴 때 확인하기 좋은 게 있습니다. 바로 업적입니다.', hl: { sel: '.status-menu [data-menu="codex"]' }, w: { click: 1 } },
      { x: '업적 안으로 들어오면 아이템 목록을 확인할 수 있습니다. 그 아이템 목록을 확인하면 어디에서 습득이 가능한지, 아직 얻지 않은 아이템이더라도 열람이 가능합니다. 이걸 통해 하나씩 도감을 채워가는 겁니다.', hl: { sel: '#codexDialog button', text: '아이템', starts: 1 } },
      { x: '그럼 이번 튜토리얼은 여기까지 하죠. 고생하셨습니다, OO 학생.' },
    ] },
    // 구글 시트 「적응 퀘스트 스크립트」 64–79행: 1-4. 기본 활동 (원문 보존)
    { id: 'a4', title: '1-4. 기본 활동', sum: '수업 · 퇴마 실습 · 추가 전투 · 휴식 · 무구 관리', reward: { money: 50, spirit: 50, items: { picnic: 2 } }, steps: [
      { x: 'OO 학생. 그럼 이번에는 학생의 기본 본분인 수업 듣기, 그 외 기본적인 활동에 대해서 알아보도록 하겠습니다.' },
      { x: '우선 ‘수업’입니다. 본관으로 가보시겠습니까? 이곳에서 수업을 들을 수 있습니다.', hl: TO_CLASS, w: { route: '#/zone/east/mainHall/class' } },
      { x: '수업을 듣는 것은 영력을 얻기 위한 가장 기본적인 활동입니다. 매일마다 수업에서 영력을 얻을 수 있지요. 그 양이 적지 않으니 다들 수업을 듣는 것을 잊지 마십시오. 물론 학생이 수업을 듣는 건 당연하지만요.' },
      { x: '미니게임과 연결되어 있기도 하고, 뽀모도로식 30분 대기와 연결되어 있기도 하니 편하신 쪽으로 하시면 됩니다.' },
      { x: '그 다음은 전투 실습입니다. 저희는 퇴마 실습 역시 중요한 수업으로 치고 있지요. 훈련관 님을 자주 뵙게 될 겁니다.' },
      { x: '전투 안내는 이곳에서 볼 수 있습니다. 각 레벨에서 가장 난이도가 쉬운 것들을 추려 퇴마 실습에 넣어 두었습니다.', hl: TO_BATTLE, w: { route: '#/zone/south/gym/battle' } },
      { x: '여기서 전투 안내는 튜토리얼입니다. 스토리 중 들르실 때가 있을 겁니다. 지금은 생략하죠.' },
      { x: '그리고 추가 전투는 매 주 한 단계씩 추가되는 컨텐츠입니다.', hl: { sel: '.play-scope [data-battle-mode="extra"]' }, w: { click: 1 }, hint: '퇴마 실습 화면에서 [추가전투]를 눌러 보세요. 지금은 전투를 시작하지 않아도 됩니다.' },
      { x: '전투는 왼쪽에서 오른쪽에 있을 수록, 레벨이 높을 수록 영력을 더 많이 줍니다. 영력은 적이 가지고 있는 영력의 2배만큼을 빼앗아올 수 있으며, 최대 3회까지 승리해서 전리품으로 얻을 수 있지요.' },
      { x: '전투도 최대한 부지런히 싸워가며 영력을 얻는 것이 중요하겠지요? 물론, 이길 수 있는 상대를 잘 파악하여 승리를 제 시간 내에 3회 하는 것이 패배를 거듭하는 것보다 낫기도 할 겁니다.' },
      { x: '이렇게 전투를 하고 나서 할 수 있는 활동으로는 휴식이 있습니다. 우선 기숙사로 가보죠.', hl: TO_DORM, w: { route: '#/zone/west/dorm/my-room' } },
      { x: '기숙사에서 잠을 자면, 푹 잠들 수 있습니다. 이곳에서는 영력을 더 빠르게 얻는 명상을 할 수 있을 뿐더러, 체력과 의지력에 더불어 영력까지 얻는 수면을 할 수 있는 등 다양한 이득을 얻을 수 있죠. 휴식이니까요.' },
      { x: '반면, 깨어있는 동안의 휴식에도 메리트가 있습니다. 양호실로 가볼까요?', hl: TO_INFIRMARY, w: { route: '#/zone/east/infirmary/rest' }, hint: '강학당 → 본관 → 본관 탐사 → 2층 → 양호실 → 침대에 누워 쉰다. 양호실 휴식·상담 화면까지 이동하세요.' },
      { x: '상담을 하면 의지력이, 휴식을 하면 체력이 찹니다. 체력은 원래도 자연회복이 되지만 의지력은 절대 자연회복이 되지 않으니 평소에 잘 관리하세요.' },
      { x: '마지막으로 무구 관리를 할 수 있는 곳을 안내드리겠습니다. 이곳도 메인스토리 도중 들르게 될 겁니다. 미리미리 할 수 있는 데까지 강화를 해두면 스토리 클리어는 물론, 평소에 추가 전투를 하는 것도 쉬워집니다.', hl: TO_ARMORY, w: { see: '.play-scope [data-armory]' }, hint: '비령산 금역 → 뒷산 탐사 → 왼길 → 무구보관소로 이동해 관리 화면을 열어 보세요.' },
      { x: '지금까지 일상생활을 위한 정보를 잘 알아봤습니다. 이걸로 루틴이 어느 정도 파악이 되셨습니까?' },
    ] },
    // 구글 시트 80–84행: 기존 1-4 동아리를 1-5로 이동(문구와 기존 동아리 보상 유지)
    { id: 'a5', title: '1-5. 동아리', sum: '별관의 동아리 · 일일 / 주간 퀘스트', reward: { money: 20, spirit: 30 }, steps: [
      { x: 'OO 학생, 이 게임에는 일일/주간 퀘스트가 있다는 사실 알고 게셨습니까?' },
      { x: '별관으로 이동해봅시다.', hl: TO_ANNEX, w: { route: '#/zone/east/annex/explore' } },
      { x: '별관의 1층부터 옥상까지는 다양한 ‘동아리’가 자리하고 있습니다. 대표적으로, 저는 방송부에 속해 있습니다(목록에는 뜨지 않습니다).', hl: { sel: '.play-scope button.rounded-full', all: true } },
      { x: '동아리에 가입하시는 방법은 각 층 탐사를 해본 뒤, 동아리 가입하기를 눌러 들어가는 것입니다.' },
      { x: '동아리에 들어가고 나면 일일/주간 퀘스트를 할 수 있게 됩니다. 적지 않은 보상을 주므로 꼭 꾸준히 하시길 권장드립니다.' },
    ] },
  ];
  const INTRO = '제3특수교육시설, 비령산 학당에 오신 것을 진심으로 환영합니다. 해당 버튼을 눌러 적응 퀘스트를 진행하면서 학당 생활에 익숙해져보세요.';

  /* ───────── 기록 ───────── */
  // D.06.10 저장 호환: 예전 a4=동아리, a5=학당 안내였다. 이제 a4=기본 활동, a5=동아리.
  // 완료·지급 기록을 이전 퀘스트 내용에 연결해 보상을 중복 지급하지 않는다.
  // 옛 a5의 보상은 새로운 a4에, 옛 a4의 보상은 새로운 a5에 그대로 귀속한다.
  function migrate(a) {
    if ((a.questSchema || 1) >= 2) return false;
    const old4Done = a.done.a4, old5Done = a.done.a5;
    const old4Paid = a.paid.a4, old5Paid = a.paid.a5;
    delete a.done.a4; delete a.done.a5;
    delete a.paid.a4; delete a.paid.a5;
    // 과거 동아리를 끝냈다면 새로운 1-5에 완료 표시. 새 1-4는 실제로 진행해야 완료된다.
    if (old4Done) a.done.a5 = old4Done;
    if (old4Paid) a.paid.a5 = old4Paid;
    // 과거 학당 안내 보상(냥50·영력50·피크닉2)은 새 1-4에서 다시 지급하지 않는다.
    if (old5Paid) a.paid.a4 = old5Paid;
    if (a.cur?.id === 'a4') a.cur = { ...a.cur, id: 'a5', step: Math.min(4, Math.max(0, a.cur.step || 0)) };
    else if (a.cur?.id === 'a5') delete a.cur; // 기존 학당 안내는 새 시트상 1장에 해당, 적응 퀘스트에서 제외
    a.questSchema = 2;
    return true;
  }
  const st = () => {
    const s = App.save; s.adapt ||= {};
    const a = s.adapt; a.done ||= {}; a.paid ||= {}; a.gave ||= {};
    if (migrate(a)) App.persist?.();
    return a;
  };
  const api = () => App.playApi?.();
  const name = () => App.profile()?.name || '학생';
  const fill = (x) => String(x).replace(/OO/g, name());
  const qOf = (id) => QUESTS.find((q) => q.id === id);
  const unlocked = (i) => i === 0 || !!st().done[QUESTS[i - 1].id] || !!st().done[QUESTS[i].id] || st().cur?.id === QUESTS[i].id; // 기존 동아리 완료/진행 계정은 재방문 허용
  const progressText = () => `${QUESTS.filter((q) => st().done[q.id]).length} / ${QUESTS.length}`;
  const rewardText = (r) => [r.money && `${r.money}냥`, r.spirit && `영력 ${r.spirit}`, ...Object.entries(r.items || {}).map(([id, n]) => `${api()?.itemName?.(id) || id} ×${n}`)].filter(Boolean).join(' · ');
  function drawCount() { const b = document.getElementById('statusAdapt'); if (b) b.textContent = progressText(); }

  /* ───────── 강조 ───────── */
  const visible = (el) => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]'); };
  const label = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const bare = (t) => t.replace(/^[^\s가-힣A-Za-z0-9?]{1,3}\s+/, '').trim(); // 「靑 본관」 → 「본관」
  function find(spec) {
    const all = [...document.querySelectorAll(spec.sel)].filter(visible).filter((el) => !el.closest('.adapt-box'));
    const ok = (el) => { if (!spec.text) return true; const t = label(el); return spec.ends ? t.endsWith(spec.text) : spec.starts ? bare(t).startsWith(spec.text) || t.startsWith(spec.text) : bare(t) === spec.text || t === spec.text; };
    const hit = all.filter(ok);
    return spec.all ? hit : hit.slice(0, 1);
  }
  function targets(hl) {
    if (!hl) return [];
    if (Array.isArray(hl)) { for (let i = hl.length - 1; i >= 0; i--) { const f = find(hl[i]); if (f.length) return f; } return []; }
    return find(hl);
  }
  let lit = [];
  function paint(list) {
    for (const el of lit) if (!list.includes(el)) el.classList.remove('adapt-hl');
    for (const el of list) if (!el.classList.contains('adapt-hl')) { el.classList.add('adapt-hl'); if (list.length === 1) el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
    lit = list;
  }

  /* ───────── 진행 ───────── */
  let run = null;   // { q, i, start, sawHunt, clicked, ev }
  let box = null, ticker = null;
  function ensureBox() {
    if (box?.isConnected) return box;
    box = h('aside', 'adapt-box'); box.setAttribute('aria-live', 'polite'); box.dataset.adaptBox = '';
    document.body.append(box);
    return box;
  }
  function closeBox() { box?.remove(); box = null; paint([]); clearInterval(ticker); ticker = null; }

  function start(id, from = 0) {
    const q = qOf(id); if (!q || !unlocked(QUESTS.indexOf(q))) return;
    if (!api()?.player) { toast('적응 퀘스트', '캐릭터를 불러온 뒤에 할 수 있다. 프로필을 먼저 만들어 줘.'); return; }
    run = { q, i: from }; st().cur = { id, step: from }; App.persist();
    enter();
    clearInterval(ticker); ticker = setInterval(tick, 350);
  }
  function enter() {
    const s = run.q.steps[run.i];
    run.start = Date.now(); run.clicked = false; run.ev = false; run.sawHunt = !!(api()?.player?.huntExpedition?.status === 'active');
    st().cur = { id: run.q.id, step: run.i }; App.persist();
    if (s.give) {
      const key = `${run.q.id}.${run.i}`;
      if (!st().gave[key]) { st().gave[key] = Date.now(); api()?.grant?.({ ...s.give, log: `[적응 퀘스트] ${WHO}에게 받았다 — ${rewardText(s.give)}` }); App.persist(); App.renderStatus?.(); }
    }
    draw();
    tick();
  }
  function draw() {
    const s = run.q.steps[run.i], b = ensureBox();
    const face = h('span', 'adapt-face'); if (PORTRAIT) { const img = new Image(); img.src = PORTRAIT; img.alt = ''; face.append(img); } else face.textContent = '徐';
    const head = h('div', 'adapt-head'); head.append(face, h('b', '', WHO), h('small', '', `${run.q.title} · ${run.i + 1}/${run.q.steps.length}`));
    const text = h('p', 'adapt-text', fill(s.x));
    const foot = h('div', 'adapt-foot');
    if (s.give && st().gave[`${run.q.id}.${run.i}`] && st().gave[`${run.q.id}.${run.i}`] < run.start - 2000) foot.append(h('small', 'adapt-hint', '(이미 한 번 받았으니 이번엔 건네지 않는다)'));
    if (s.w) foot.append(h('small', 'adapt-hint', s.hint || (s.hl ? '반짝이는 곳을 눌러 따라와 줘.' : '그대로 해 보면 넘어간다.')));
    const prev = btn('adapt-btn ghost', '이전', () => { if (run.i > 0) { run.i -= 1; enter(); } }); prev.disabled = run.i === 0;
    const next = btn('adapt-btn', s.w ? '건너뛰기' : (run.i === run.q.steps.length - 1 ? '마치기' : '다음'), () => advance(!!s.w));
    next.dataset.adaptNext = ''; if (s.w) next.classList.add('ghost');
    const stop = btn('adapt-btn ghost', '그만두기', () => { if (st().cur) st().cur.paused = 1; App.persist(); closeBox(); run = null; toast('적응 퀘스트', '멈췄다. [적응 퀘스트]에서 이어 할 수 있다.'); });
    const btns = h('div', 'adapt-btns'); btns.append(stop, prev, next);
    b.replaceChildren(head, text);
    if (s.note) b.append(h('p', 'adapt-note', s.note));
    if (foot.childNodes.length) b.append(foot);
    b.append(btns);
  }
  function met(w) {
    if (!w) return false;
    const p = api()?.player;
    if (w.route) return (location.hash || '#/').startsWith(w.route);
    if (w.home) return !document.getElementById('homeView')?.hidden;
    if (w.click) return run.clicked;
    if (w.ev) return run.ev;
    if (w.make) return run.ev;
    if (w.see) return find({ sel: w.see, text: w.text }).length > 0;
    if (w.input) return [...document.querySelectorAll('.play-scope input')].some((el) => visible(el) && el.value.includes(w.input));
    if (w.hunt === 'start') return p?.huntExpedition?.status === 'active';
    if (w.hunt === 'end') { const on = p?.huntExpedition?.status === 'active'; if (on) run.sawHunt = true; return run.sawHunt && !on; }
    return false;
  }
  function tick() {
    if (!run) return;
    const s = run.q.steps[run.i];
    paint(targets(s.hl));
    // 모달 창(도감 등)이 열려 있으면 안내 상자를 그 안으로 옮긴다 — 바깥에 두면 눌리지 않는다
    if (box?.isConnected) { const dlg = [...document.querySelectorAll('dialog[open]')].pop(); const home = dlg || document.body; if (box.parentNode !== home) home.append(box); }
    if (s.w && Date.now() - run.start > 400 && met(s.w)) setTimeout(() => { if (run && run.q.steps[run.i] === s) advance(false); }, 450);
  }
  function advance() {
    if (!run) return;
    if (run.i < run.q.steps.length - 1) { run.i += 1; enter(); return; }
    finish();
  }
  function finish() {
    const q = run.q, a = st(); const first = !a.paid[q.id];
    a.done[q.id] ||= Date.now(); delete a.cur;
    if (first) {
      a.paid[q.id] = Date.now();
      api()?.grant?.({ ...q.reward, log: `[적응 퀘스트] 「${q.title}」을 마쳤다 — ${rewardText(q.reward)}` });
    }
    App.persist(); App.renderStatus?.(); closeBox(); run = null; drawCount();
    const nextQ = QUESTS.find((candidate) => !a.done[candidate.id] && unlocked(QUESTS.indexOf(candidate)));
    toast('적응 퀘스트', `「${q.title}」을 마쳤다.${first ? ` 보상: ${rewardText(q.reward)}` : ' (보상은 처음 한 번만)'}${nextQ ? ` 다음은 「${nextQ.title}」.` : ' 적응 퀘스트를 모두 마쳤다!'}`);
    App.ding?.('gift');
    if ((location.hash || '').startsWith('#/adapt')) renderPage(App.body);
  }

  // 강조한 곳을 누름 · 매점에서 삼 · 만듦
  document.addEventListener('click', (e) => { if (run && e.target?.closest?.('.adapt-hl')) run.clicked = true; }, true);
  window.addEventListener('biryeong:quest', (e) => {
    if (!run) return;
    const w = run.q.steps[run.i].w || {}, d = e.detail || {};
    if (w.ev && d.type === w.ev) run.ev = true;
    if (w.make && d.type === 'make' && (d.id?.id || d.id) === w.make) run.ev = true;
  });

  /* ───────── 적응 퀘스트 화면(#/adapt) ───────── */
  function renderPage(body) {
    body.replaceChildren();
    body.append(para('학당 생활에 익숙해지기 위한 길잡이. 서창현이 화면의 단추를 하나씩 짚어 가며 알려 준다. 차례대로 열리고, 다 마친 퀘스트는 언제든 다시 할 수 있다. 보상은 계정당 처음 한 번만 받는다.'));
    const ul = h('ul', 'adapt-list');
    QUESTS.forEach((q, i) => {
      const a = st(), done = !!a.done[q.id], open = unlocked(i), cur = a.cur?.id === q.id;
      const li = h('li', `adapt-item${done ? ' is-done' : ''}${open ? '' : ' is-locked'}`); li.dataset.adaptQuest = q.id;
      const info = h('div', 'adapt-info');
      info.append(h('b', '', q.title), h('small', '', q.sum), h('em', '', a.paid[q.id] ? `보상 받음 (${rewardText(q.reward)})` : `보상: ${rewardText(q.reward)}`));
      const label = !open ? '앞 퀘스트를 마치면 열린다' : cur ? `이어 하기 (${(a.cur.step || 0) + 1}/${q.steps.length})` : done ? '다시 하기' : '시작하기';
      const go = btn(done && !cur ? 'ghost-btn' : 'solid-btn', label, () => start(q.id, cur ? a.cur.step || 0 : 0));
      go.disabled = !open; go.dataset.adaptStart = q.id;
      li.append(h('span', 'adapt-mark', done ? '完' : String(i + 1)), info, go);
      ul.append(li);
    });
    body.append(ul);
  }
  function page() {
    App.openPage('適 / ADAPTATION', '적응 퀘스트', 'simple');
    App.addTo?.('pages', 'adapt');
    renderPage(App.body);
  }

  /* ───────── 첫 안내: 「최초 최후의 신탁」이 끝나면 ───────── */
  function showIntro() {
    const a = st(); if (a.intro) return;
    const layer = document.getElementById('sceneLayer');
    if (layer && !layer.hidden) { setTimeout(showIntro, 1200); return; }
    a.intro = Date.now(); App.persist();
    const b = ensureBox(); b.classList.add('is-intro');
    const face = h('span', 'adapt-face'); if (PORTRAIT) { const img = new Image(); img.src = PORTRAIT; img.alt = ''; face.append(img); }
    const head = h('div', 'adapt-head'); head.append(face, h('b', '', WHO), h('small', '', '적응 퀘스트'));
    const go = btn('adapt-btn', '적응 퀘스트 보기', () => { closeBox(); App.go('#/adapt'); }); go.dataset.adaptIntroGo = '';
    const later = btn('adapt-btn ghost', '나중에', () => closeBox());
    const btns = h('div', 'adapt-btns'); btns.append(later, go);
    b.replaceChildren(head, h('p', 'adapt-text', INTRO), btns);
    const target = document.querySelector('.status-menu [data-menu="adapt"]');
    paint(target ? [target] : []);
    clearInterval(ticker); ticker = setInterval(() => { const t = document.querySelector('.status-menu [data-menu="adapt"]'); if (box?.classList.contains('is-intro')) paint(t ? [t] : []); }, 600);
  }
  window.addEventListener('biryeong:scene-done', (e) => { if (e.detail?.id === 'P-1') setTimeout(showIntro, 600); });

  // 새로고침 뒤: 하던 퀘스트를 이어서 · 프롤로그 첫 장면을 이미 지난 사람에게도 안내 한 번
  function boot() {
    drawCount();
    if (!App.profile()) return;
    const a = st();
    if (a.cur && qOf(a.cur.id) && !a.cur.paused) setTimeout(() => { if (!run && api()?.player) start(a.cur.id, a.cur.step || 0); }, 1500);
    else if (!a.intro && window.BiryeongQuest?.state?.().done?.['P-1']) setTimeout(showIntro, 2000);
  }
  setTimeout(boot, 800);

  window.BiryeongAdapt = { page, start, progressText, quests: QUESTS, showIntro, state: st };
})();
