/* 비령 vD.06 — 이벤트 「학생 괴담 수칙─이름 없는 작은 것들」(시트 「신수 이벤트 스크립트」)
 *
 * · 관리자 도구 › 스토리 › [이벤트 공개]를 누르기 전에는 아무것도 보이지 않는다(산문 › 이벤트 탭 없음 · 신수들의 터 「아직 공개되지 않았다」).
 * · 번진 먹(도입) → 동 · 서 · 남 · 북 · 중 다섯 괴담(순서 없이) → 마지막(다섯을 모두 마치면).
 * · 괴담 하나를 마칠 때마다 [괴담 수칙서]에 한 조씩 글자가 떠오르고 보상이 있다. 1~6조를 모두 모으면 책 완성 보상.
 * · 마지막에 고른 「운명의 신수」에게 이름을 지어 주면(한글 네 글자 · 바꿀 수 없다) 그 아이를 신수들의 터에서 기른다.
 * 대사 창 · 선택 · 이름 짓기는 본편(quest.js)의 것을 그대로 쓴다(BiryeongQuest.playScene).
 */
(() => {
  const App = window.BiryeongApp;
  if (!App) return;
  const { h, btn, para } = App;
  const BQ = () => window.BiryeongQuest;
  const api = () => { try { return App.playApi(); } catch (_) { return null; } };
  const FLAG = 'BEAST_EVENT';
  const TITLE = '학생 괴담 수칙─이름 없는 작은 것들';
  const BOOK = 'st-ghost-rules';
  const RULES = {
    1: '괴담 앞에서는 거짓을 말하지 말라',
    2: '괴담에게 하나를 원할 때는 하나를 주어라',
    3: '빛에 꼬인 것은 빛을 가려 돌려보내라',
    4: '발소리 없는 것을 굳이 좇지 말아라',
    5: '근원을 평하면 정체가 보인다',
    6: '이름 없는 것에게는 이름을 불러 주어라',
  };
  const RULE_REWARD = { money: 30, spirit: 20 };
  const BOOK_REWARD = { money: 100, spirit: 50 };
  const WAIT_MS = 15 * 60 * 1000;
  const FATE = ['gumiho', 'cheongnyong', 'baekho', 'jujak', 'hyeonmu']; // 운명의 신수 ① ~ ⑤
  const KIND_NAME = { gumiho: '구미호', cheongnyong: '청룡', baekho: '백호', jujak: '주작', hyeonmu: '현무' };

  // ── 대사 줄 ──
  const N = (x, c) => ({ t: 'n', x, ...(c ? { c } : {}) });
  const S = (w, x, a, c) => ({ t: 'say', w, x, ...(a ? { a } : {}), ...(c ? { c } : {}) });
  const B = (x) => ({ t: 'b', x });
  const C = (id, q, o, c) => ({ t: 'choice', id, q, o, ...(c ? { c } : {}) });
  const IF = (id, ...v) => [{ flag: id, in: v }];
  const jong = (w) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; };
  const jo = (w, a, b) => w + (jong(w) ? a : b);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  const FOX = { key: 'evfox', name: '여우불 · 야광귀', blurb: '주작의 빛에 나방처럼 몰려든 여우불과 야광귀 무리.' };
  const SMEAR = { key: 'smear', name: '번진 먹', blurb: '사람 같기도, 문 같기도, 다른 무엇 같기도 한 먹. 이름 없는 새끼 신수 다섯을 노린다.' };

  // 단계: { w: 장소(본편 표기) | visit: 탐사 지점, p: 길, a: 할 일, bring: { 아이템: 개수 }, battle, wait, lines }
  const QUESTS = [
    { id: 'intro', side: '序', name: '번진 먹', steps: [
      { w: 'dorm/cafeteria', p: '생활관 › 기숙사 › 급식실', a: '생활관 급식실로 간다', lines: [
        N('명부의 귀신 사건 일주일 뒤. 낮새들의 터에 익명 글 하나가 올라온다.'),
        N('「학당에도 학교 괴담 있는 거 알고 있어? 5대 괴담이라는데⋯⋯.」'),
        N('아침을 먹는 식당이 온통 그 이야기다. 서창현이 단말기를 보며 하나씩 읽는다.'),
        S('서창현', '밤마다 요괴의 그림이 늘어난다고 하네요. 매점 근처를 지날 때 어딘가에서 우드득, 우드득 씹는 소리가 들린다던가. 어디에서 거짓말을 하면 물벼락을 맞는다고 합니다.'),
        S('서창현', '산꼭대기에서 자정에 해돋이가 뜬다는 건 흥미롭네요. 물 위에 발자국이 돋는다는 건 어떤 의미일까요? 청화호수에 가봐야 알 것 같습니다.'),
        B('처음부터 각각 괴담이 아니라 피로도에 의한 착각일 확률 13%, 22%, 15%, 9%, 19%입니다.'),
        B('조사를 권장합니다.'),
        S('서창현', '어딘가에서 또 기괴한 요괴가 말썽을 부리고 있는 것일지도 모릅니다. 학교는 안전한 공간이라고 하지만, 상대적으로 안전한 것이지 절대적으로 안전한 것은 아니니까요.'),
        S('신수보관소 담당', '차, 차, 창현아! 큰일 났어!'),
        S('신수보관소 담당', '시, 시, 신수들의 봉인이 풀렸다! 이름도 없는 새끼 신수들인데, 다, 다섯 개나⋯⋯! 이게 어찌된 영문인지⋯⋯!'),
        S('서창현', '보셨죠?'),
        S('윤진서', '이게 ‘보셨죠?’ 같은 산뜻한 소개로 넘어갈 일인가요⋯⋯.'),
        S('신수보관소 담당', '저기, OO 맞지? 제발 도와다오⋯⋯! 상점을 주마. 아니 매점에서 뭐라도 사주마! 식권 줄까? 응?'),
        S('신수보관소 담당', '옆에 있는 애들은 진서랑 호수니? 창현이도! 선생님 좀 살려주라~!'),
        S('연호수', '알겠으니 바짓가랑이 놔요!!'),
      ] },
      { visit: 'mainHall:f2:beasts', w: 'mainHall/explore', p: '강학당 › 본관 탐사 › 2층 › 신수보관소', a: '본관 2층 신수보관소로 간다', give: { [BOOK]: 1 }, lines: [
        N('보관소에 가 보면 빈 우리 다섯 개의 봉인 부적이 먹에 번져 있다. 먼저 와 있던 결계학 선생이 팔짱을 끼고 심각한 표정을 짓고 있었다.'),
        S('결계학 선생', '그날 밤 보았던 그 먹⋯⋯. 명부귀가 아직 활개를 치고 있군요. 학교 괴담이니 뭐니 하며 최근 돌던 일들도 아마 연관이 있는 모양입니다.', '글자를 손끝으로 문질러 보고, 얼굴이 굳는다.'),
        S('결계학 선생', '⋯하아아아아⋯⋯. 얘들아, 이거 하나씩 받으려무나.'),
        S('결계학 선생', '옛말에 괴담은 무서워하는 사람이 키운다고 했단다. 그러니 이번 주 숙제는 ‘괴담 해결 실습’이다.'),
        S('신수보관소 담당', '제가 부족해서 죄송합니다아아⋯⋯.'),
        S('결계학 선생', '이번 일은 명부귀가 아직 어린 신수들을 건드리면서 생긴 일이니, 신수들이 너무 상하지 않게 조심, 또 조심⋯⋯. 음.'),
        S('결계학 선생', '너희 수준으로는 너희가 신수들에게 상하지 않게 조심해야 하려나⋯⋯.'),
        S('결계학 선생', '너무 걱정 말거라. 그들 역시 아직 어리고 서투른 존재들이다. 악의를 갖고 대하지 않는 이상, 그리고 그들을 존중한다면 너희를 해하려 드는 일은 없을 테야.'),
      ] },
    ] },

    { id: 'east', side: '東', rule: 1, beast: 'cheongnyong', name: '동─괴담에게 눈가리고 아웅을 하지 말라', steps: [
      { visit: 'mainHall:f2:staff', w: 'mainHall/explore', p: '강학당 › 본관 탐사 › 2층 › 교무실', a: '본관 2층 교무실 앞 복도로 간다', lines: [
        N('맑은 날에도 비가 내린다는, 아니 실내에서도 비가 내린다는 복도. 연호수는 팔짱을 낀 채로 당당하게 앞서 나간다.'),
        S('연호수', '어이가 없네.'),
        S('윤진서', '조심해요, 호수 선배. 아직 꽃샘추위가 가시지 않았을 시기라서 젖으면 감기 걸려요.'),
        S('연호수', '내가 당연히 젖을 거라고 생각하는 모양인데, 난 살면서 구라를 쳐본 적이 없어.'),
        N('연호수의 머리 위로 난데없이 물벼락이 떨어진다. 윤진서가 은근슬쩍 연호수의 곁에서 멀어진다.'),
        S('연호수', '하?'),
        N('당신도 연호수의 곁에서 멀어졌다.'),
        S('서창현', '흥미롭군요. 저는 이곳을 하루에 8번 이상 지나다니고 그 때마다 선생님들과 많은 문답을 하는데, 한 번도 젖어본 적이 없습니다.'),
        S('연호수', '그건 니가 기계새끼라 그런 거야!'),
        N('연호수는 다시 물벼락을 맞는다. 그 때, 당신의 귓가에 무언가 속삭이는 듯한 질문이 들려왔다.'),
        N('「명부의 귀신을 만나서 싸웠을 때, 솔직히 무서웠어?」'),
        N('「너는 303호의 그 애를 처음부터 알았어?」'),
        N('「너는 이곳에 원해서 왔어?」'),
        C('EV-E1', '속삭이는 목소리에게', ['솔직하게 답한다', '얼버무린다']),
        N('당신은 물벼락을 맞았다. 목소리가 말한다. ‘거짓말쟁이랑은 놀고 싶지 않아.’', IF('EV-E1', 2)),
        C('EV-E1b', '목소리가 한 번 더 묻는다', ['솔직하게 답한다', '다시 얼버무린다'], IF('EV-E1', 2)),
        N('「너, 시원한 물 가지고 있어? 그러면 내 모습을 보여줄게.」'),
      ] },
      { visit: 'mainHall:f2:staff', w: 'mainHall/explore', bring: { 'lake-water': 9 }, p: '강학당 › 본관 탐사 › 2층 › 교무실', a: '「청화물」 9개를 지니고 교무실 앞 복도로 돌아가 목소리에게 건넨다', lines: [
        N('당신이 목소리가 들린 허공에 물을 건넨 그 순간, OO의 팔에 무언가 휘감기는 듯한 감각이 느껴진다. 고개를 내리면 팔뚝만 한 푸른 새끼 용이 내려와 단말기 바로 위쪽에 돌돌 말려 있었다.'),
        N('뭉툭한 뿔 두 개가 아직 말랑하고 귀엽다. 눈은 초롱초롱하고, 작게 하품을 한다. 비늘이 선다. 차가운 물의 감각이 그 용으로부터 느껴지고 있었다.'),
        N('연호수가 축 젖은 채로 화를 냈다.'),
        S('연호수', '이제 됐어! 돌아가기나 해!'),
      ] },
    ] },

    { id: 'west', side: '西', rule: 2, beast: 'baekho', name: '서─한국 괴담들에겐 밥부터 먹여라', steps: [
      { w: 'dorm/cafeteria', p: '생활관 › 기숙사 › 급식실', a: '생활관 급식실로 간다', lines: [
        N('식당에서 숟가락과 젓가락이 사라진다. 가끔 쇳붙이를 들고 있는 학생이 있다면 무언가 잃어버린단다. 그리고 지나다니는 밤마다 ‘철컥, 철컥’ 씹는 소리가 난다.'),
        N('잃어버리는 물건은 다양하다. 간단하게는 철로 만든 키링부터, 작은 막대기, 크게는⋯⋯.'),
        S('연호수', 'X발, 내 신칼!!'),
        S('윤진서', '설마 이런 것까지 훔쳐가는 요괴가 있을 줄은 몰랐어요. 무구가 없으면 어떻게 싸우죠⋯⋯?'),
        S('연호수', '주먹으로 싸워야지 뭐 어떡해? 내가 한 때는 마장동 불주먹으로 불리기도 했어.'),
        S('연호수', '대한민국에서 쌈박질을 칼 들고 하는 놈이 어딨겠냐? 이쪽이 내 본업이야. 물리퇴마의 힘을 보여주마.'),
        S('서창현', '그건 자랑이 아닙니다.'),
      ] },
      { w: 'dorm/store', p: '생활관 › 기숙사 › 매점', a: '소리를 따라 생활관 매점으로 간다', lines: [
        N('철컥철컥철컥⋯ 하는 소리를 따라가다 보면 매점 뒤. 흰 바탕에 검은 줄무늬가 있는, 고양이만 한 새끼가 연호수의 신칼 자루를 물고 있다.'),
        S('연호수', '안 뱉냐? 뒤질라고.'),
        N('빼앗으려고 하면 더 세게 문다. 급기야 연호수는 신칼을 갖고 실랑이를 하기 시작했다. OO는 별 생각 없이 그걸 구경하게 되었으나⋯⋯.'),
        N('잠깐 고개를 돌린 사이 어쩐지 뭔가 허전한 기분이 되었다.'),
        N('응? 허전해?'),
        S('윤진서', '저기, OO.'),
        S('윤진서', '이제는 당신의 무구를 문 것 같아요.'),
        N('그 말대로 백호는 신칼을 퉤 뱉고 당신의 무구를 물어뜯고 있었다.'),
        N('침범벅이 된 신칼을 연호수가 허망하게 바라보고 있었다.'),
        S('연호수', '하나 주면 하나를 뱉긴 하네⋯⋯. 다른 놈 무구라도 훔쳐올까?'),
        S('윤진서', '다른 물거리를 준다는 좋은 방법이 있잖아요⋯⋯! 특히 쇠를 좋아하는 것 같으니 크고 뭉툭한 못 같은 건 어때요? 이갈이에는 좋을 것 같은데요.'),
      ] },
      { w: 'dorm/store', bring: { nail: 3 }, p: '생활관 › 기숙사 › 매점', a: '「못」 3개를 지니고 매점 뒤로 가 새끼 앞에 둔다', lines: [
        N('가져온 못을 앞에 두면 새끼 백호는 신칼을 놓고 못을 오독오독 씹는다. 만족스러워 보인다.'),
        N('이를 다 간 백호가 OO의 발등에 턱을 괴고 잠든다. 작은 송곳니 하나가 새로 나 있다. 연호수는 신칼의 이빨 자국을 보며 투덜대지만, 주머니에서 녹슨 못 하나를 꺼내 더 준다.'),
        S('연호수', '이 가렵다는데 뭐 어떡해, 나도 어릴 적엔 그랬어.'),
        S('윤진서', '어릴적에 못에다 이갈이를 하셨다고요⋯⋯?'),
      ] },
    ] },

    { id: 'south', side: '南', rule: 3, beast: 'jujak', name: '남─손바닥으로 태양을 가려라', steps: [
      { visit: 'gym:center:climb:peak', w: 'gym/hike', p: '비령산 금역 › 뒷산 › 중앙길 › 산 오르기 › 산꼭대기', a: '자정의 비령산 꼭대기로 올라간다', lines: [
        N('자정마다 비령산 꼭대기에 해가 뜬다는 소문. 당연하지만 건물에서 보면 태양 같은 건 보이지 않는다. 직접 가볼 필요가 있어 보인다.'),
        N('올라가 보면 주먹만 한 붉은 새가 바위 위에서 꾸벅꾸벅 졸고 있다. 깃털 끝마다 불씨가 맺혀 있어, 졸 때마다 빛이 새어 나온다.'),
        N('그 빛에 여우불과 야광귀가 나방처럼 모여든다.'),
        S('윤진서', '……불나방이랑 가로등?'),
        S('연호수', '내가 아는 간지나는 주작 이미지랑 좀 많이 다른 거 같은데.'),
        S('서창현', '아직 새끼잖습니까.'),
        N('덕지덕지 붙은 넋과 혼이 주작의 머리털에 달라붙어 일렁거린다. 맨들거려서 꼭 대머리 같다. 꾸벅꾸벅 졸다 화들짝 놀라는 통에 혼령들도 함께 놀라 튀어오른다.'),
        S('연호수', '⋯⋯잡을 의욕 안 난다.'),
        S('윤진서', '보아하니 주작이 야광귀랑 여우불들 사이에 둘러싸여서 어떻게 못 움직이고 있는 것 같기도 한데요, 우선 쫓아줄까요?'),
      ] },
      { battle: FOX, p: '비령산 산꼭대기', a: '여우불 · 야광귀 무리를 쫓아낸다 — 3인 전투', lines: [
        S('서창현', '빛 때문에 더 몰려드는 것 같습니다. 아무래도 주작의 빛이 근원인 것 같으니 몰려드는 원인 자체를 차단해야지 싶어요.'),
        C('EV-S1', '몰려드는 원인을 막으려면', ['겉옷을 벗어 주작을 덮어준다', '겉옷을 벗어 주작을 부채질해준다']),
        S('연호수', '왜 불난데 부채질하고 난리야 #$@$@#!@$@!!!!!!!', '', IF('EV-S1', 2)),
        C('EV-S1b', '다시, 몰려드는 원인을 막으려면', ['겉옷을 벗어 주작을 덮어준다'], IF('EV-S1', 2)),
        S('윤진서', '뭔가 납치하는 기분이긴 하지만⋯ 정석이네요! 이대로 내려가요 OO!'),
        S('연호수', '그럼 일단 들러붙은 것들부터 치워주자고.'),
        N('윗옷에 덮인 새끼가 길게 하품을 한다. 윗옷 안에서 따뜻한 빛이 포근하게 퍼지지만, 옷자락은 조금도 타지 않는다. 여우불들은 갈 곳을 잃고 흩어진다.'),
        N('당신의 품에 안긴 주작은 편안해보인다. 마치 제 자리를 찾아갔다는 듯이.'),
      ] },
    ] },

    { id: 'north', side: '北', rule: 4, beast: 'hyeonmu', name: '북─괴담도 사생활은 존중해 줘라', steps: [
      { visit: 'gym:right:lake', w: 'gym/hike', p: '비령산 금역 › 뒷산 › 오른길 › 청화호수', a: '새벽의 청화호수로 간다', lines: [
        N('새벽 호수 위에 작은 발자국이 찍혀 간다는 소문. 발자국 옆에는 가는 줄 하나가 구불구불 따라간다. 다가가면 발자국은 멀어지고, 쫓을수록 안개가 짙어진다.'),
        S('윤진서', '쫓아가면 흐릿해진다고 하니⋯ 길이 제대로 보일 때까지 가만히 관찰해보는 것이 제일일 듯해요.'),
        S('연호수', '가만히 앉아서 기다리라고? 젠장, 내가 제일 못하는 건데.'),
        S('윤진서', '이참에 명상하는 연습이라도 해봐요. 자, OO도 앉아서. 같이요. 응!'),
        N('당신은 얼떨결에 윤진서에게 끌려 청화호수의 선착장에 앉았다. 연호수도 이끌려 옆에 앉았다. 셋이 앉아서 멍하니 있다 보면 시간이 흐른다.'),
      ] },
      { visit: 'gym:right:lake', w: 'gym/hike', wait: WAIT_MS, p: '비령산 금역 › 뒷산 › 오른길 › 청화호수', a: '청화호수 선착장에서 15분 동안 가만히 기다린다', lines: [
        N('안개 속에서 손바닥만 한 거북이 물 위를 걸어온다. 꼬리 대신 작은 검은 뱀이 달려 있고, 뱀이 고개를 들어 길을 살피면 거북이 한 발짝 걷는다.'),
        S('윤진서', '어! 저⋯ 알아요. 사신수 중에, 말로만 듣던 그⋯⋯. 현무.'),
        S('윤진서', '둘이서 하나인가 봐요. 하나가 무서우면, 하나가 대신 보고. 엄청 겁이 많아 보이네요. 아까부터 둘이 번갈아서 이쪽 보고 있어요.'),
        N('새끼 현무가 물가에서 멈춘다. 거북은 고개를 집어넣은 채고, 꼬리의 뱀만 OO의 새끼손가락에 살짝 감긴다. 거북이 고개를 내미는 데는 조금 더 걸린다.'),
        N('왠지 OO를 마음에 들어하는 것 같기도 하고⋯⋯?'),
        S('연호수', '⋯⋯.', 'OO를 따라 손을 내밀어본다.'),
        S('연호수', '왜 나한텐 안 오지?'),
        S('연호수', '난 항상 그랬어. 고양이도 나를 보면 처 하악질하고. 아무리 순한 강아지도 내 면상을 보면 갑자기 짖기 시작하고.'),
        S('연호수', 'X발, 짐승의 사랑도 빈익빈부익부라니.'),
        S('윤진서', '아하하⋯⋯.'),
      ] },
    ] },

    { id: 'center', side: '中', rule: 5, beast: 'gumiho', name: '중─모르면 일단 신변조사부터 갈겨라', steps: [
      { visit: 'annex:f3:books', w: 'annex/explore', p: '강학당 › 별관 탐사 › 3층 › 서적실', a: '별관 3층 서적실로 간다', lines: [
        N('빈 책장마다 처음 보는 요괴 그림이 저절로 늘어난다. 그림 옆에는 어린아이 글씨 같은 설명이 붙어 있다.'),
        S('서창현', '「달걀귀신. 얼굴에 이목구비가 없다. 화장품을 훔쳐주면 기뻐한다.」'),
        S('서창현', '「물귀신. 축축하다. 호수나 강에서 자주 등장하지만 집안에서도 볼 수 있는 친근한 귀신이다. 발목을 주로 노린다.」'),
        S('서창현', '「처녀귀신. 몽달귀신과 짝지어 주면 좋아한다.」'),
        S('윤진서', '귀신대백과⋯⋯??'),
        S('연호수', '귀신 입장에서 쓴 귀신대백과 아니냐?'),
        N('서창현은 침착히 그림을 뒤집어 보았다. 뭔가 발바닥 도장 같은 것이 꾹 찍혀 있었다. 이것이 서명을 대신하는 걸까? 화백의⋯⋯.'),
        N('그림마다 남은 작은 발자국과 하얀 짐승 털 한 올. 이것이 단서일지도 모르겠다.'),
        S('서창현', '⋯우선 따라가보죠.'),
        N('당신은 뚜벅뚜벅 걸어 실시간으로 계속 한 장씩 늘어나는 요괴 그림들을 지나쳤다. 그 때였다.'),
        N('그림들 사이로 이목구비가 없는 달걀귀신이 불쑥 튀어나왔다. 당신들보다 좀 눈높이가 낮긴 했지만 분명한 달걀귀신의 몰골이었다.'),
        N('그저 흰 털이 좀 많이 달려 있고, 뒤에 꼬리도 좀 많이 달려 있었을 뿐이다. 아, 머리에 귀도 두개쯤 달려 있고.'),
        S('윤진서', '꺄아아악!!!'),
        S('연호수', '뭐야, 썅!', '신칼을 들이댄다.'),
        N('캥!! 하는 소리와 함께 달걀귀신은 그대로 무너지듯 다른 형체로 변한다. 그 아래에 있던 것은 퐁실퐁실한 꼬리를 가진 작은 구미호였다.'),
        S('서창현', '⋯⋯꼬리가 많네요. 영물로서의 영력은 충분히 갖추었으나 자라지 못한 개체 같습니다.'),
        S('서창현', '그림은 둔갑 연습장인 걸까요?'),
        N('새끼 구미호는 서창현의 손길을 가만히 받으며 고개를 숙이고 있다가, 발을 구르며 OO에게 다가온다.'),
        S('연호수', '네가 마음에 드는 모양인데?'),
        S('윤진서', '연습장 평가라도 해주는 건 어때요? 귀여워라.'),
        C('EV-C1', '아까의 달걀귀신은─ 몇 점이었다', range(1, 10).map((n) => `${n}점`)),
        N('구미호는 주눅들어 보인다⋯', IF('EV-C1', 1, 2, 3)),
        N('구미호는 분발해보겠다는 듯 꼬리를 살랑거린다.', IF('EV-C1', 4, 5, 6)),
        N('구미호는 나쁘지 않은 점수라는 듯 폴짝폴짝 뛴다.', IF('EV-C1', 7, 8, 9)),
        N('구미호는 감격한 표정을 짓는다. 여우가 어떻게 그런 표정을 짓냐고? 아무튼 당신은 지금 보고 있다.', IF('EV-C1', 10)),
        S('서창현', '이대로 보관소에 데려가시면⋯ 되겠는데, 당신에게 찰싹 붙어서 떨어지질 않네요.'),
        S('윤진서', '지⋯금 수살귀로 변하려고 하는 것 같은데요?'),
        S('연호수', '빨리 들어⋯⋯.'),
      ] },
    ] },

    { id: 'final', side: '終', rule: 6, name: '마지막─한국말은 끝까지 들어라', steps: [
      { w: 'dorm/my-room', p: '생활관 › 기숙사 › 내 기숙사', a: '생활관의 내 기숙사로 돌아간다', lines: [
        N('OO는 새끼 신수 다섯을 신수보관소로 돌려보냈다. 모든 일은 순탄하게 정리되는 듯했다.'),
        N('하지만 세상 일이 그렇게 쉽게만 돌아가면 재미없는 법이지⋯⋯.'),
        N('그날 밤.'),
        N('당신은 익숙한 비령의 붉은 빛과 함께 눈을 떠야 했다.'),
        B('경고합니다. 본관의 신수보관소에서 이미 관측된 바 있는 악의가 감지됩니다. 내일 아침까지 아무 일도 없을 확률 3.4%.'),
        B('주변의 어른들에게 알리거나 직접 조사를 하러 가는 것을 권장합니다. 다시 알립니다⋯⋯.'),
        S('연호수', '학교 꼬라지 존나 잘 돌아간다⋯⋯.'),
        N('신수보관소라고 하면 그 다섯 마리의 신수가 있는 곳이다. 꼬물꼬물 기어다니는 새끼 신수들이 얌전히 위험에 처하게 두자는 의견이 주류가 되진 않았기에, 제법 적지 않은 학생들이 그곳으로 향했다.'),
      ] },
      { visit: 'mainHall:f2:beasts', w: 'mainHall/explore', p: '강학당 › 본관 탐사 › 2층 › 신수보관소', a: '밤의 본관 2층 신수보관소로 간다', lines: [
        N('그곳으로 향하자 새까만 먹이 활짝 열린 문을 대신 채우고 있는 것이 보인다. 사람 같기도 하고 문 같기도 하고 다른 무엇 같기도 한 먹은 꿈틀대며 안으로 침입을 시도하고 있었다.'),
        N('흐릿한 결계는 지금 당장이라도 터질 것 같았고, 결계학 선생과 신수보관소 담당 선생이 그 곁에서 고군분투 중이었다.'),
        S('신수보관소 담당', '얘, 얘들아⋯⋯! 와줘서 고맙다. 도와다오⋯⋯! 부끄럽지만 우리만으로는 역부족이구나.'),
        S('결계학 선생', '이 사특한 것들⋯⋯.'),
        S('명부귀', '다섯⋯ 이름 없는 다섯⋯ 이것들만 먹으면⋯ 이번에야말로⋯⋯!'),
        S('연호수', '야! 지긋지긋하다, 개새끼야!'),
      ] },
      { battle: SMEAR, boss: 1, p: '본관 2층 신수보관소', a: '번진 먹과 싸운다 — 3인 보스 전투 · 노려지는 새끼의 이름을 불러 주자', lines: [
        C('EV-F1', '당신의 운명의 신수는─', ['구미호', '청룡', '백호', '주작', '현무']),
        { t: 'name', key: 'beast', q: '그 아이의 이름은─', x: '한글로 네 글자까지. 한 번 정하면 바꿀 수 없다.' },
        S('명부귀', '■■⋯? ■■라고? 그건 버려진 이름이 아니었다고?'),
        S('명부귀', '불린⋯이름⋯ 그럼 내 이름은⋯ 내가 가질 수 있는 건⋯ 없⋯⋯.', '흩어져 사라진다. 완전히 먹이 되어서 흔적조차 남지 않는다.'),
        S('신수보관소 담당', '휘유! 이걸로 완전히 끝난 모양이네! 고생했어, 얘들아! 그보다⋯ 이름이 정말 각양각색인걸!'),
        S('신수보관소 담당', '기왕 이렇게 된 거⋯ 다시 봉인을 걸고 돌보기도 시간이 오래 걸릴 것 같으니⋯ 너희가 잠시 맡아주지 않겠어? 저기 비령산쪽에 신수들이 뛰어놀기 좋은 터가 있단다.'),
        S('신수보관소 담당', '돌아가면서 같이 놀아주면 좋을 것 같은데, 어때?'),
        S('신수보관소 담당', '신수는 이름이 하나가 아니야. 불러 주는 사람 수만큼 이름을 갖지. 귀신은 이름이 하나라서 빼앗기고, 신수는 여럿이라서 안 빼앗기는 거야. 너희 모두가 잘 신경써줬으면 좋겠다.'),
        S('서창현', '잘⋯ 정리된 모양이군요. 해당 사건은 보고하겠습니다.'),
        B('확인했습니다, 서창현 님. 신수 등록 건수 +5. 개체명: 다수. 지금부터 정리하겠습니다.'),
        B('청룡 : 이름 1, 용대가리.'),
        S('윤진서', '호수 선배, 애 이름 바꿔 줘요⋯⋯!'),
        S('연호수', '난줄 어떻게 알았지?'),
      ] },
    ] },
  ];
  const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
  const FIVE = ['east', 'west', 'south', 'north', 'center'];

  // ── 상태(계정 기록 save.beastEv) ──
  const st = () => { const s = App.save; if (!s) return { step: {}, done: {}, wait: {}, paid: {} }; s.beastEv ||= {}; const e = s.beastEv; e.step ||= {}; e.done ||= {}; e.wait ||= {}; e.paid ||= {}; return e; };
  const persist = () => App.persist();
  const preview = () => App.isAdmin?.() && App.save?.adminStoryPreview === true;
  const open = () => Number(BQ()?.routes?.[FLAG]) === 1 || preview();
  const finished = () => !!st().done.final;
  const ready = (q) => (q.id === 'intro' ? true : q.id === 'final' ? FIVE.every((id) => st().done[id]) : !!st().done.intro && st().cur === q.id); // vD.06.1 다섯 괴담은 산문 › 이벤트에서 하나씩 골라서
  const choosable = (q) => FIVE.includes(q.id) && !!st().done.intro && !st().done[q.id];
  function choose(id) {
    const e = st(); if (e.cur === id) return;
    if (e.cur && waitOf(e.cur)) { toast('청화호수에서 기다리는 중이다. 기다림을 마치거나 그 자리를 떠난 뒤에 고르자.'); return; }
    e.cur = id; persist(); toast(`「${byId[id].name}」을(를) 맡았다. 오른쪽 할 일에 뜬다.`); redraw(); setTimeout(tick, 300);
  }
  const stepOf = (q) => q.steps[st().step[q.id] || 0] || null;
  const toast = (t) => BQ()?.toast?.('이벤트', t);
  const itemName = (id) => api()?.itemName?.(id) || id;
  const have = (bring) => Object.entries(bring || {}).every(([id, n]) => (api()?.count?.(id) || 0) >= n);
  const bringText = (bring) => Object.entries(bring || {}).map(([id, n]) => `「${itemName(id)}」 ${Math.min(api()?.count?.(id) || 0, n)}/${n}`).join(' · ');

  // 탐사 지점은 그 지점을 밟은 뒤(같은 화면에 머무는 동안)만 「그 자리」로 본다
  let here = null; // { key, hash }
  const atStep = (s) => (s.visit ? !!here && here.key === s.visit && here.hash === location.hash : !!BQ()?.at?.(s.w));

  let busy = false;
  function play(q, s, onEnd) {
    busy = true;
    const scene = { id: `EV-${q.id}-${q.steps.indexOf(s)}`, event: 1, label: '이벤트', title: q.name, place: s.p.split(' › ').slice(-1)[0], time: '학생 괴담 수칙', lines: s.lines };
    BQ().playScene(scene, () => { busy = false; onEnd && onEnd(); });
  }
  function advance(q) {
    const e = st(), i = e.step[q.id] || 0, s = q.steps[i];
    if (s.give && !e.paid[`give:${q.id}.${i}`] && api()) {
      e.paid[`give:${q.id}.${i}`] = Date.now();
      api().grant({ items: s.give, log: `이벤트: ${Object.keys(s.give).map(itemName).join(', ')}을(를) 받았다.` });
      BQ()?.card?.({ kind: 'item', head: '받은 것', title: `「${itemName(BOOK)}」`, lines: ['1조부터 6조까지의 괴담 수칙이 적힌 얇은 책자. 괴담을 하나 풀 때마다 한 조씩 글자가 떠오른다.', '이제 동 · 서 · 남 · 북 · 중 다섯 괴담을 순서 없이 풀 수 있다 — 산문 › 이벤트'] });
    }
    e.step[q.id] = i + 1; delete e.wait[q.id];
    if (e.step[q.id] >= q.steps.length && e.cur === q.id) e.cur = null; // 다 풀면 산문에서 다음 괴담을 고른다
    if (e.step[q.id] >= q.steps.length) finish(q);
    persist(); redraw(); setTimeout(tick, 400);
  }
  function finish(q) {
    const e = st(); if (e.done[q.id]) return;
    e.done[q.id] = Date.now();
    const a = api(), lines = [];
    if (q.rule && !e.paid[`rule:${q.rule}`] && a) {
      e.paid[`rule:${q.rule}`] = Date.now();
      a.grant({ ...RULE_REWARD, log: `이벤트: 괴담 수칙서 ${q.rule}조가 떠올랐다. ${RULE_REWARD.money}냥, 영력 +${RULE_REWARD.spirit}.` });
      lines.push(`${RULE_REWARD.money}냥 · 영력 +${RULE_REWARD.spirit}`);
    }
    if (q.beast) lines.push(`${jo(`새끼 ${KIND_NAME[q.beast]}`, '과', '와')}의 만남`);
    if (q.id === 'final') {
      const kind = FATE[(BQ()?.state?.().flags?.['EV-F1'] || 1) - 1] || FATE[0];
      const name = String(App.save?.story?.beastName || '').trim();
      e.fate = { kind, name };
      if (a?.beastAct && name) { const owned = a.beastView?.().list?.some((b) => b.kind === kind); if (!owned) a.beastAct('adopt', { kind, name, fate: true }); }
      lines.push(`운명의 신수 — 어린 ${KIND_NAME[kind]} 「${name || '이름'}」`, '이제 비령산 금역 › 뒷산 › 왼길 › 신수들의 터에서 기를 수 있다.');
    }
    if (q.rule) BQ()?.card?.({ kind: 'item', head: `괴담 수칙서 ${q.rule}조`, title: `「${RULES[q.rule]}」`, sub: q.name, lines: ['글자가 새로 떠올랐다.', ...lines] });
    if (Object.keys(RULES).every((n) => e.paid[`rule:${n}`]) && !e.paid.book && a) {
      e.paid.book = Date.now();
      a.grant({ ...BOOK_REWARD, log: `이벤트: 괴담 수칙서를 모두 채웠다. ${BOOK_REWARD.money}냥, 영력 +${BOOK_REWARD.spirit}.` });
      BQ()?.card?.({ kind: 'chapter', head: '괴담 수칙서 완성', title: `《${TITLE}》`, lines: ['1조부터 6조까지 모든 수칙이 떠올랐다.', `${BOOK_REWARD.money}냥 · 영력 +${BOOK_REWARD.spirit}`] });
    }
    persist();
  }

  // ── 진행: 그 자리에 오면 대사가 나온다 ──
  function tick() {
    if (busy || !open() || !App.profile() || !BQ() || BQ().sceneOpen?.() || document.getElementById('opening') || document.body.classList.contains('is-ach')) return; // 보상 카드가 떠 있으면 닫은 뒤에
    for (const q of QUESTS) {
      if (st().done[q.id] || !ready(q)) continue;
      const s = stepOf(q); if (!s || s.wait) continue;
      if (s.battle) { if (st().paid[`won:${q.id}.${st().step[q.id] || 0}`]) { play(q, s, () => advance(q)); return; } continue; } // 이기고 대사를 다 보기 전에 창을 닫았으면 다시
      if (!atStep(s)) continue;
      if (s.bring) {
        if (!have(s.bring)) continue;
        const key = `bring:${q.id}.${st().step[q.id] || 0}`;
        if (!st().paid[key]) { if (!api()?.take?.(s.bring)) continue; st().paid[key] = Date.now(); persist(); BQ()?.card?.({ kind: 'use', head: '건넸다', title: Object.entries(s.bring).map(([id, n]) => `${itemName(id)} ×${n}`).join(' · '), lines: ['소지품에서 빠졌다.'] }); }
      }
      play(q, s, () => advance(q));
      return;
    }
  }
  function fight(q, s) {
    const a = api(); if (!a?.storyBattle) { toast('실행 화면을 불러오는 중이다.'); return; }
    a.storyBattle({ key: s.battle.key, tier: 1, i: 0, name: s.battle.name, blurb: s.battle.blurb, ctx: { form: 1, stage: `EV-${q.id}.${st().step[q.id] || 0}`, names: { player: App.profile()?.name || '' }, npcUsed: false, first: true } });
  }
  // 대기(북): 시각으로 센다 — 창을 내리거나 닫아 접속이 끊겨도 이어진다.
  //   끊기는 때는 둘뿐: 다른 화면으로 옮기려 할 때(묻고) · 산에서 다른 지점을 밟을 때.
  const waitOf = (id) => { const w = st().wait[id]; return w ? (typeof w === 'number' ? { at: w } : w) : null; };
  function cancelWait(why) {
    const e = st(); if (!e.wait.north) return;
    delete e.wait.north; persist(); clearInterval(waitTimer); waitTimer = null;
    toast(why || '자리를 떠나 기다림이 끊겼다. 청화호수 선착장으로 돌아가 다시 기다리자.'); redraw();
  }
  let waitTimer = null;
  function waitLoop() {
    clearInterval(waitTimer); waitTimer = null;
    const q = byId.north, e = st();
    if (!waitOf('north') || e.done.north) return;
    waitTimer = setInterval(() => {
      const s = stepOf(q), w = waitOf('north');
      if (!s?.wait || !w) { clearInterval(waitTimer); waitTimer = null; return; }
      const left = w.at + s.wait - Date.now();
      if (left <= 0) { if (!busy && !BQ()?.sceneOpen?.() && !document.body.classList.contains('is-ach')) { clearInterval(waitTimer); waitTimer = null; play(q, s, () => advance(q)); } return; }
      document.querySelectorAll('[data-ev-wait-left]').forEach((el) => { el.textContent = mmss(left); });
    }, 1000);
  }
  const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  // ── 할 일 상자(오른쪽 상태 창) ──
  function stepRow(q, compact) {
    const e = st(), s = stepOf(q), row = h('div', 'ev-step');
    row.dataset.evQuest = q.id;
    const head = h('p', 'ev-step-head'); head.append(h('b', '', `${q.side} ${q.name}`)); row.append(head);
    if (!s) return row;
    const startNote = (e.step[q.id] || 0) === 0 && q.id !== 'intro' && q.id !== 'final' ? ' (아직 시작하지 않았다)' : '';
    row.append(h('p', 'ev-step-act', `${s.a}${startNote}`), h('small', 'ev-step-path', s.p));
    if (s.bring) row.append(h('small', 'ev-step-need', `지닐 것 — ${bringText(s.bring)}`));
    const acts = h('div', 'quest-box-acts');
    const target = s.w ? BQ()?.hashOf?.(s.w) : null;
    if (s.battle) {
      const b = btn('solid-btn quest-act', `${jo(s.battle.name, '과', '와')} 싸운다 · 3인`, () => fight(q, s)); b.dataset.evFight = q.id; acts.append(b);
    } else if (s.wait) {
      if (waitOf(q.id)) { const w = h('span', 'ev-wait'); w.append('기다리는 중 — 남은 시간 ', h('b', '', mmss(waitOf(q.id).at + s.wait - Date.now()))); w.lastChild.dataset.evWaitLeft = ''; acts.append(w); }
      else if (atStep(s)) { const b = btn('solid-btn quest-act', '대기 시작', () => { e.wait[q.id] = { at: Date.now(), hash: location.hash }; persist(); waitLoop(); redraw(); }); b.dataset.evWait = ''; acts.append(b); }
      else if (target) acts.append(btn('ghost-btn quest-go', '그곳으로', () => App.go(target)));
      if (!compact) row.append(h('small', 'ev-step-need', '해당 페이지(청화호수)에서 15분을 기다린다. 창을 내리거나 닫아도 이어지고, 다른 곳으로 옮기면 처음부터 다시.'));
    } else if (target && !atStep(s)) acts.append(btn('ghost-btn quest-go', '그곳으로', () => App.go(target)));
    if (acts.children.length) row.append(acts);
    return row;
  }
  function trackerBox() {
    if (!open() || !App.profile() || finished()) return null;
    const box = h('div', 'quest-box ev-box'); box.dataset.beastEvent = '';
    box.append(h('p', 'quest-box-kicker', `이벤트 · ${TITLE.split('─')[0]}`));
    const list = QUESTS.filter((q) => !st().done[q.id] && ready(q));
    list.forEach((q) => box.append(stepRow(q, true)));
    if (!list.length) {
      const left = FIVE.filter((id) => !st().done[id]).length;
      box.append(h('p', 'ev-step-act', `산문 › 이벤트에서 풀 괴담을 하나 고른다. (남은 괴담 ${left}개)`));
      const acts = h('div', 'quest-box-acts'); const b = btn('ghost-btn quest-go', '산문으로', () => App.go('#/zone/north/event')); b.dataset.evPick = ''; acts.append(b); box.append(acts);
    }
    return box;
  }
  function redraw() { try { BQ()?.tick?.(); } catch (_) { /* 본편이 아직 */ } if (/^#\/zone\/north\/event/.test(location.hash)) App.route(); }

  // ── 산문 › 이벤트 ──
  function board(body) {
    const e = st();
    body.append(h('p', 'panel-count', `이벤트 — ${TITLE}`));
    body.append(para('학당에 다섯 괴담이 돈다. 봉인이 풀린 이름 없는 새끼 신수 다섯 마리와, 아직 활개를 치는 번진 먹. 괴담을 하나 풀 때마다 [괴담 수칙서]에 한 조씩 글자가 떠오른다.'));
    const book = h('section', 'ev-book'); book.dataset.evBook = '';
    book.append(h('h3', 'quest-vol-title', '괴담 수칙서'));
    const ol = h('ol', 'ev-rules');
    Object.entries(RULES).forEach(([n, t]) => { const li = h('li', e.paid[`rule:${n}`] ? 'is-open' : 'is-locked', e.paid[`rule:${n}`] ? `${n}조─${t}` : `${n}조─？？？`); ol.append(li); });
    book.append(ol, h('small', 'ev-step-path', `한 조마다 ${RULE_REWARD.money}냥 · 영력 ${RULE_REWARD.spirit} · 모두 모으면 ${BOOK_REWARD.money}냥 · 영력 ${BOOK_REWARD.spirit}`));
    body.append(book);
    const sec = h('section', 'quest-vol'); sec.append(h('h3', 'quest-vol-title', '괴담'));
    QUESTS.forEach((q) => {
      const done = !!e.done[q.id], can = ready(q);
      const row = h('div', `quest-row${done ? ' is-done' : can ? ' is-now' : ' is-locked'}`); row.dataset.evRow = q.id;
      const t = h('div', 'quest-row-text');
      t.append(h('strong', '', `${done ? '◆' : can ? '◈' : '◇'} ${q.side} ${can || done || choosable(q) ? q.name : '？？？'}`));
      if (done) t.append(h('p', '', q.beast ? `${jo(`새끼 ${KIND_NAME[q.beast]}`, '을', '를')} 만났다.` : q.id === 'final' ? `운명의 신수 — ${KIND_NAME[e.fate?.kind] || ''} 「${e.fate?.name || ''}」` : '괴담 수칙서를 받았다.'));
      else if (can) t.append(stepRow(q, false));
      else if (choosable(q)) t.append(h('p', '', (st().step[q.id] || 0) > 0 ? '하다 만 괴담. 다시 고르면 이어서 한다.' : '아직 풀지 않은 괴담.'));
      else t.append(h('p', '', q.id === 'final' ? '다섯 괴담을 모두 풀면 열린다.' : '「번진 먹」을 마치면 열린다.'));
      row.append(t);
      if (choosable(q) && !can) { const pb = btn('solid-btn codex-use', e.cur ? '이 괴담으로 바꾼다' : '이 괴담을 푼다', () => choose(q.id)); pb.dataset.evChoose = q.id; row.append(pb); }
      if (done) row.append(btn('ghost-btn codex-use', '다시 보기', () => replay(q)));
      sec.append(row);
    });
    body.append(sec);
    if (finished()) body.append(para('신수들의 터(비령산 금역 › 뒷산 › 왼길)에서 운명의 신수를 기를 수 있다.'));
  }
  function replay(q) {
    if (busy) return;
    busy = true;
    const scene = { id: `EV-${q.id}-all`, event: 1, label: '이벤트', title: q.name, place: q.steps[0].p.split(' › ').slice(-1)[0], time: '다시 보기', lines: q.steps.flatMap((s) => s.lines) };
    BQ().playScene(scene, () => { busy = false; });
  }

  // ── 연결 ──
  window.addEventListener('biryeong:quest', (ev) => {
    const { type, id } = ev.detail || {};
    if (type === 'visit') {
      if (waitOf('north') && id !== byId.north.steps[1].visit && !st().done.north) cancelWait('청화호수를 떠나 다른 곳을 살폈다. 기다림이 끊겼다.');
      here = { key: id, hash: location.hash }; setTimeout(tick, 500);
    }
    if (type === 'storyBattle' && id?.win && open()) {
      for (const q of QUESTS) {
        const s = stepOf(q);
        if (!st().done[q.id] && ready(q) && s?.battle?.key === id.key) { st().paid[`won:${q.id}.${st().step[q.id] || 0}`] = Date.now(); persist(); setTimeout(tick, 600); break; }
      }
    }
  });
  window.addEventListener('biryeong:route', () => { if (here && here.hash !== location.hash) here = null; setTimeout(tick, 450); });
  window.addEventListener('biryeong:routes', () => { redraw(); setTimeout(tick, 300); });
  window.addEventListener('biryeong:saved', () => setTimeout(tick, 500));

  window.BiryeongBeastEvent = { open, finished, title: TITLE, board, trackerBox, tick, quests: QUESTS, rules: RULES, state: st, choose, busy: () => !!waitOf('north') && !st().done.north && open(), busyLeft: () => { const w = waitOf('north'), q = byId.north, sp = q && stepOf(q); if (!w || !sp?.wait) return ''; const m = Math.max(0, Math.ceil((w.at + sp.wait - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`; }, /* V.01 나가기 경고에 남은 시간 */ cancelWait, _here: (k) => { here = k ? { key: k, hash: location.hash } : null; } };
  setTimeout(() => { waitLoop(); tick(); }, 1500);
  setInterval(() => { if (!document.hidden) tick(); }, 2500); // 본편 장면이 먼저 나온 뒤에도 이어지게
})();
