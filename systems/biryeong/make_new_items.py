# -*- coding: utf-8 -*-
"""v1.5 — 제작법이 둘인 아이템 정리.
v1.0 새 제작법 가운데 초록동색 원래 제작법과 결과가 겹치던 81개를, 같은 재료 · 단계 · 나오는 수로 '새 아이템'을 만들게 바꾼다.
이 파일을 한 번 돌리면 recipes-new.txt 의 결과 · 재료가 바뀌고 items-new.txt 가 만들어진다(도트 틀 · 색이 겹치면 다음 색으로 피한다).
  python3 make_new_items.py
"""
import json, re, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__))
S = lambda d: json.dumps(d, ensure_ascii=False, separators=(',', ':'))

# 제작법 번호 → (새 id, 닮은 원래 아이템(규칙 · 태그를 빌린다), 이름, 도트 틀, 색, 효과 글, 효과 JSON, 덧붙임 JSON, 설명, 재료 바꿈 {옛 재료: 새 재료})
N = {
 # ── 1단계 바탕 — 공작소 ──
 1:  ('nw-cloth-paper', 'hanji', '천 한지', 'paper', 'white', '', {}, {}, '자투리 천을 청화물에 삭혀 뜬 종이. 결이 거칠어 먹이 잘 번지지만 쉽게 찢어지지 않는다.', {}),
 2:  ('nw-rabbit-brush', 'brush', '토끼털 세필', 'brush', 'white', '', {}, {}, '토끼 털뭉치를 나무 자루에 묶은 가는 붓. 부적의 잔획을 긋는 데 쓴다.', {}),
 3:  ('nw-web-thread', 'twine', '거미줄 실', 'spool', 'gray', '', {}, {}, '거미줄 네 가닥을 꼬아 만든 가는 실. 끊어질 듯 끊어지지 않는다.', {}),
 4:  ('nw-badger-yarn', 'yarn-ball', '오소리 털실', 'orb', 'dgray', '', {}, {}, '오소리 털을 거미줄로 엮은 털실. 뻣뻣하고 따뜻하다.', {}),
 5:  ('nw-charcoal-ink', 'pine-ink', '숯먹', 'inkstick', 'dgray', '', {}, {}, '숯가루를 물이끼로 뭉친 먹. 송연묵보다 거칠지만 빨리 만든다.', {}),
 6:  ('nw-azalea-dye', 'red-pigment', '진달래 꽃물', 'drop', 'pink', '', {}, {}, '진달래와 뱀딸기를 짓이겨 받은 분홍 꽃물. 붉은 꽃물보다 연하다.', {}),
 7:  ('nw-crystal-chip', 'crystal-bead', '수정 조각알', 'gem', 'white', '', {}, {}, '자갈돌로 수정을 깨뜨려 다듬은 작은 알. 구슬이 되다 만 모양.', {}),
 8:  ('nw-cherry-plaque', 'jujube-plaque', '벚나무 패', 'plaque', 'pink', '', {}, {}, '벽조목에 벚나무 가지를 못으로 덧댄 패. 봄 냄새가 남아 있다.', {}),
 9:  ('nw-magpie-bundle', 'feather-bundle', '까치 깃 다발', 'wing', 'ink', '', {}, {}, '까치 깃 세 개를 거미줄로 묶은 다발. 흑백이 또렷하다.', {}),
 10: ('nw-black-seal', 'seal-powder', '검은 봉인 가루', 'powder', 'black', '', {}, {}, '봉인석을 숯과 함께 빻은 가루. 봉인 가루보다 무겁게 가라앉는다.', {}),
 16: ('nw-cinnabar-ink', 'talisman-ink', '주묵(朱墨)', 'bottle', 'red', '', {}, {}, '먹에 주사를 섞어 간 붉은 먹. 부적의 마지막 획에 쓴다.', {}),
 # ── 1단계 바탕 — 조리실 ──
 17: ('nw-pine-oil', 'soybean-oil', '잣기름', 'drop', 'cream', '', {}, {}, '잣을 볶아 짠 기름. 고소한 냄새가 조리실 밖까지 간다.', {}),
 18: ('nw-carp-broth', 'lake-broth', '잉어 육수', 'pot', 'orange', '', {}, {}, '청화물에 잉어를 고아 낸 뽀얀 육수.', {}),
 19: ('nw-chestnut-honey', 'chestnut-syrup', '밤엿물', 'bottle', 'brown', '', {}, {}, '밤에 설탕을 넣고 졸인 묽은 엿물. 조청보다 빨리 된다.', {}),
 20: ('nw-deodeok-decoction', 'herb-decoction', '더덕 달임물', 'pot', 'soy', '', {}, {}, '더덕과 감초를 청화물에 달인 쌉쌀한 물.', {}),
 21: ('nw-omija-syrup', 'wild-grape-juice', '오미자청', 'glass', 'crimson', '', {}, {}, '오미자를 설탕에 재운 청. 다섯 가지 맛이 한꺼번에 난다.', {}),
 22: ('nw-blanched-spinach', 'blanched-greens', '시금치 데침', 'herb', 'green', '', {}, {}, '청화물에 살짝 데친 시금치.', {}),
 # ── 2단계 — 공작소 ──
 33: ('nw-oil-wick', 'ghostfire-lantern', '기름 심지 횃불', 'torch', 'orange', '개척 중: 개척 행동 턴 +3', {'hunt': {'turns': 3}}, {}, '콩기름을 먹인 무명천을 감은 횃불. 산길에서 오래 탄다.', {}),
 34: ('nw-knot-bracelet', 'feather-norigae', '매듭 팔찌', 'bracelet', 'jade', '착용 시 절제 +1 · 인내 +1', {}, {'bonus': {'control': 1, 'endurance': 1}}, '오색실과 노끈으로 엮은 팔찌. 매듭 하나가 손목뼈에 꼭 맞는다.', {}),
 35: ('nw-mugwort-charm', 'green-charm', '쑥물 부적', 'talisman', 'lime', '전투 중: 의지력 +20', {'mp': 20, 'onlyBattle': True}, {}, '쑥 즙을 먹인 한지에 부적을 그렸다. 펼치면 숨이 깊어진다.', {}),
 36: ('nw-straw-doll', 'spirit-disposable', '액받이 헝겊인형', 'doll', 'tan', '전투 중: 전투불능 시 1회 체력 1로 부활 대기(한 전투에 부활 아이템은 1번)', {'revive': True, 'onlyBattle': True}, {}, '털실과 자투리 천에 못을 박아 만든 인형. 대신 맞아 줄 몫을 하나 품고 있다.', {}),
 37: ('nw-jangseung-bell', 'feather-norigae', '장승 매듭 방울', 'bell', 'brown', '착용 시 인내 +2', {}, {'bonus': {'endurance': 2}}, '장승 조각을 진달래 꽃물로 물들여 노끈에 꿴 방울. 마을 어귀처럼 버틴다.', {'red-pigment': 'nw-azalea-dye'}),
 38: ('nw-azalea-bookmark', 'feather-deco', '진달래 책갈피', 'tag', 'pink', '개척 중: 이번 개척 동안 추가 보상 확률 +10%', {'hunt': {'bonus': 10}}, {}, '네잎클로버를 진달래 꽃물에 물들여 한지에 눌러 붙였다.', {'red-pigment': 'nw-azalea-dye'}),
 39: ('nw-deer-tooth-charm', 'jaeaek-charm', '고라니 이빨 부적', 'talisman', 'bone', '전투 중: 적의 앞으로 3개 행동을 간파 (한 전투에 1번)', {'reveal': 3, 'oncePerBattle': True, 'onlyBattle': True}, {}, '주묵으로 그린 부적에 고라니 이빨을 꿰었다. 상대가 움직이기 전에 이빨이 먼저 떤다.', {'talisman-ink': 'nw-cinnabar-ink'}),
 40: ('nw-mugwort-rope', 'exorcism-gate', '쑥대 금줄', 'knot', 'green', '전투 중: 일행 전원 그 전투 동안 인내 +2', {'partyStat': {'endurance': 2}, 'onlyBattle': True}, {}, '쑥대를 한지 띠에 꽂아 꼰 금줄. 둘러치면 일행이 한 마을이 된다.', {}),
 41: ('nw-raccoon-tag', 'red-fox-charm', '너구리 수호패', 'tag', 'dgray', '전투 중: 전투 중 신속 +3 (다인 전투는 그 전투 동안, 단독 전투는 20분)', {'battleStat': {'agility': 3}, 'onlyBattle': True}, {}, '벽조목 패에 봉인 가루로 너구리 발톱을 붙였다. 쥐고 있으면 발이 가볍다.', {}),
 42: ('nw-brick-shrine', 'feather-deco', '벽돌 서낭단', 'bricks', 'ember', '개척 중: 이번 개척 동안 추가 보상 확률 +15%', {'hunt': {'bonus': 15}}, {}, '폐건물 벽돌 셋을 봉인 가루로 붙여 쌓은 작은 서낭단. 산이 조금 너그러워진다.', {}),
 43: ('nw-cloth-charm-pack', 'charm-bundle', '천 부적 꾸러미', 'letter', 'white', '전투 중: 부적 사용 횟수 +1 / 의지력 +5 (한 전투에 1번)', {'charms': 1, 'mp': 5, 'oncePerBattle': True, 'onlyBattle': True}, {}, '천 한지에 그린 부적 몇 장을 노끈으로 묶었다. 젖어도 번지지 않는다.', {'hanji': 'nw-cloth-paper'}),
 44: ('nw-charcoal-smudge', 'mugwort-incense', '숯쑥 모깃불', 'smoke', 'dgray', '개척 중: 4턴 동안 요괴가 다가오지 못한다', {'hunt': {'ward': 4}}, {}, '쑥을 숯먹에 버무려 나무조각 위에 피운 연기. 매캐하다.', {'pine-ink': 'nw-charcoal-ink'}),
 45: ('nw-red-centipede-charm', 'centipede-ward', '붉은 지네 부적', 'talisman', 'orange', '전투 중: 적에게 막을 수 없는 피해 2d8 + 2 (적 체력은 1 아래로 내려가지 않는다) (한 전투에 1번)', {'enemyHit': {'n': 2, 'sides': 8, 'plus': 2}, 'oncePerBattle': True, 'onlyBattle': True}, {}, '주묵으로 지네 두 마리를 그려 넣은 부적. 펼치면 다리가 꿈틀댄다. (끔찍하다고? 네 앞의 귀신은 안 끔찍하고?)', {'talisman-ink': 'nw-cinnabar-ink'}),
 46: ('nw-seal-stamp', 'jaeaek-charm', '붉은 인주 도장', 'stamp', 'red', '전투 중: 적의 영능력 자원(영력) -6 (한 전투에 1번)', {'drainSpirit': 6, 'oncePerBattle': True, 'onlyBattle': True}, {}, '주사와 꽃물을 콩기름에 갠 인주를 바른 도장. 찍힌 것은 한동안 힘을 못 쓴다.', {}),
 47: ('nw-cherry-imugi-tag', 'imugi-tag', '이무기 벚나무 패', 'tag', 'jade', '개척 중: 다음 5번의 채집 · 수렵 성공률 +15%', {'hunt': {'odds': {'amount': 15, 'attempts': 5}}}, {}, '벚나무 패에 이무기 비늘 한 장을 박았다.', {'jujube-plaque': 'nw-cherry-plaque'}),
 48: ('nw-wolf-howl-charm', 'red-fox-charm', '늑대 울음 부적', 'talisman', 'gray', '전투 중: 전투 중 호전 +4 (다인 전투는 그 전투 동안, 단독 전투는 20분)', {'battleStat': {'aggression': 4}, 'onlyBattle': True}, {}, '늑대 송곳니를 한지에 싸서 그린 부적. 귀를 대면 먼 울음이 들린다.', {}),
 49: ('nw-hawk-brush', 'feather-norigae', '매깃 부적필', 'brush', 'brown', '착용 시 안목 +2', {}, {'bonus': {'insight': 2}}, '매 깃털을 토끼털 세필에 묶은 붓. 허리에 차고 다니면 눈이 밝아진다.', {'brush': 'nw-rabbit-brush'}),
 50: ('nw-crystal-feather', 'feather-norigae', '수정 깃 노리개', 'knot', 'white', '착용 시 안목 +1 · 신속 +1', {}, {'bonus': {'insight': 1, 'agility': 1}}, '깃털 다발에 수정 구슬을 달아 거미줄 실로 맨 노리개.', {'twine': 'nw-web-thread'}),
 51: ('nw-shell-anklet', 'shell-necklace', '조개 발찌', 'bracelet', 'cream', '착용 시 신속 +1 · 안목 +1', {}, {'bonus': {'agility': 1, 'insight': 1}}, '조개껍데기와 수정 조각알을 노끈에 꿴 발찌. 걸을 때마다 파도 소리가 난다.', {'crystal-bead': 'nw-crystal-chip'}),
 52: ('nw-centipede-jar', 'beginner-godok', '지네 독단지', 'jar', 'crimson', '전투 중: 2턴 동안 적이 받는 모든 피해량이 20% 증가한다', {'enemyVulnerability': 2}, {}, '작은 항아리에 지네 셋을 검은 봉인 가루와 함께 가둔 단지. 고독이 되다 만 것.', {'seal-powder': 'nw-black-seal'}),
 53: ('nw-five-color-lantern', 'ghostfire-lantern', '오색 도깨비 초롱', 'lantern', 'yellow', '개척 중: 개척 행동 턴 +4', {'hunt': {'turns': 4}}, {}, '도깨비불을 한지 초롱에 넣고 오색실로 매달았다. 불빛이 다섯 번 색을 바꾼다.', {}),
 # ── 3단계 — 공작소 ──
 81: ('nw-cinnabar-seal-charm', 'jaeaek-charm', '주사 봉함부', 'talisman', 'crimson', '전투 중: 적의 영능력 자원(영력) -8 / 적의 앞으로 3개 행동을 간파 (한 전투에 1번)', {'drainSpirit': 8, 'reveal': 3, 'oncePerBattle': True, 'onlyBattle': True}, {}, '부적 먹물과 주사를 겹겹이 올린 봉함 부적. 접힌 자리가 붉게 번진다.', {}),
 83: ('nw-sealed-godok', 'beginner-godok', '봉인 고독함', 'box', 'purple', '전투 중: 5턴 동안 적이 받는 모든 피해량이 20% 증가한다', {'enemyVulnerability': 5}, {}, '초보용 고독 둘을 봉인 가루로 덮어 한 함에 넣었다. 고독보다 순하고, 오래간다.', {}),
 84: ('nw-double-seal', 'jaeaek-charm', '겹봉인 부적', 'talisman', 'grape', '전투 중: 적의 영능력 자원(영력) -10 (한 전투에 1번)', {'drainSpirit': 10, 'oncePerBattle': True, 'onlyBattle': True}, {}, '봉인 가루를 두 번 개어 올린 부적. 붙이면 상대의 기운이 뚝 끊긴다.', {}),
 85: ('nw-fortune-seal-book', 'fortune-talisman', '오복 봉인첩', 'book', 'gold', '전투 중: 일행 전원 부적 사용 횟수 +1', {'partyCharms': 1, 'onlyBattle': True}, {}, '오복 날개막과 봉인 부적을 오색실로 묶은 첩. 펼치는 순간 일행 모두 손이 하나씩 늘어난다.', {}),
 86: ('nw-turtle-divination', 'jaeaek-charm', '거북 점괘패', 'plaque', 'dgreen', '전투 중: 적의 앞으로 6개 행동을 간파 (한 전투에 1번)', {'reveal': 6, 'oncePerBattle': True, 'onlyBattle': True}, {}, '천년거북 등딱지 조각을 벽조목 패에 붙이고 먹으로 괘를 그었다.', {}),
 87: ('nw-soul-lamp', 'ghostfire-lantern', '혼백 초롱', 'lantern', 'sky', '개척 중: 개척 행동 턴 +8', {'hunt': {'turns': 8}}, {}, '혼백구슬과 도깨비불을 한 초롱에 넣었다. 둘이 서로를 비춰 꺼지지 않는다.', {}),
 88: ('nw-serpent-norigae', 'feather-norigae', '황구렁이 비늘 노리개', 'knot', 'yellow', '착용 시 안목 +3 · 신속 +2', {}, {'bonus': {'insight': 3, 'agility': 2}}, '황구렁이 비늘을 수정 구슬과 오색 매듭에 꿴 노리개.', {}),
 89: ('nw-talisman-cheollik', 'talisman-robe', '부적 철릭', 'robe', 'red', '착용 시 인내 +3 · 절제 +2', {}, {'bonus': {'endurance': 3, 'control': 2}}, '부적 묶음을 오소리 털실로 안감에 누빈 철릭. 무겁고, 든든하다.', {'yarn-ball': 'nw-badger-yarn'}),
 90: ('nw-feather-durumagi', 'crane-robe', '깃털 두루마기', 'cape', 'sky', '착용 시 신속 +4 · 이해 +3', {}, {'bonus': {'agility': 4, 'comprehension': 3}}, '학 깃털과 까치 깃 다발을 오색실로 이어 붙인 두루마기. 바람을 먼저 탄다.', {'feather-bundle': 'nw-magpie-bundle'}),
 91: ('nw-dragon-five-string', 'feather-norigae', '용마 오색 갓끈', 'necklace', 'jade', '착용 시 호전 +3 · 신속 +3', {}, {'bonus': {'aggression': 3, 'agility': 3}}, '용마 갈기에 오색 매듭과 수정 구슬을 꿴 갓끈.', {}),
 92: ('nw-silver-toad-ring', 'toad-ring', '은두꺼비 가락지', 'ring', 'white', '착용 시 안목 +2 / 개척: 추가 보상 확률 +10%', {}, {'bonus': {'insight': 2}, 'hunt': {'bonus': 10}}, '금두꺼비 허물에 은입사를 두른 가락지. 금보다 조용하게 운을 부른다.', {}),
 93: ('nw-five-color-charm-book', 'charm-bundle', '오색 부적첩', 'book', 'red', '전투 중: 부적 사용 횟수 +2 (한 전투에 1번)', {'charms': 2, 'oncePerBattle': True, 'onlyBattle': True}, {}, '한지 다섯 장에 부적을 그려 오색실로 엮은 첩. 한 번에 세 권씩 묶어 낸다.', {}),
 94: ('nw-crystal-whetstone', 'red-fox-charm', '수정 숫돌', 'whetstone', 'sky', '전투 중: 전투 중 호전 +3 · 안목 +1 (다인 전투는 그 전투 동안, 단독 전투는 20분)', {'battleStat': {'aggression': 3, 'insight': 1}, 'onlyBattle': True}, {}, '숫돌 둘 사이에 수정 구슬을 갈아 넣었다. 싸우기 전에 무구를 한 번 쓸면 날이 선다.', {}),
 95: ('nw-ink-glow-charm', 'jaeaek-charm', '먹빛 부적', 'talisman', 'ink', '전투 중: 적의 앞으로 4개 행동을 간파 (한 전투에 1번)', {'reveal': 4, 'oncePerBattle': True, 'onlyBattle': True}, {}, '부적 먹물을 두 번 올려 먹빛이 번들거리는 부적.', {}),
 # ── 2단계 — 조리실 ──
 54: ('nw-carp-clear-soup', 'bibimbap', '잉어 맑은탕', 'stew', 'cream', '체력 +35', {'hp': 35}, {}, '잉어 육수에 잉어를 다시 넣고 맑게 끓인 탕. 비린내가 없다.', {'lake-broth': 'nw-carp-broth'}),
 55: ('nw-snakeberry-jeonggwa', 'snakeberry-jam', '뱀딸기 정과', 'pill', 'red', '의지력 +20 / 12시간 동안 신속 +1', {'mp': 20, 'buff': {'stat': 'agility', 'amount': 1, 'hours': 12}}, {}, '뱀딸기를 밤엿물에 졸여 말린 정과. 쫀득하다.', {'chestnut-syrup': 'nw-chestnut-honey'}),
 56: ('nw-mushroom-oil-soup', 'bibimbap', '버섯 들기름국', 'bowl', 'tan', '체력 +25 / 의지력 +10', {'hp': 25, 'mp': 10}, {}, '버섯을 콩기름에 볶다가 청화 육수를 부은 국.', {}),
 57: ('nw-namul-rice', 'bibimbap', '나물밥', 'rice', 'green', '체력 +25 / 의지력 +15', {'hp': 25, 'mp': 15}, {}, '데친 나물을 쌀과 함께 지은 밥. 콩기름 한 숟갈이면 된다.', {}),
 58: ('nw-azalea-bukkumi', 'twin-pop', '진달래 부꾸미', 'halfmoon', 'pink', '체력 회복: 일행에게 건네면 +15, 자신이 먹으면 +6', {'giveHp': {'party': 15, 'self': 6}}, {}, '밀가루 반죽에 진달래를 얹어 반달로 접어 부친 떡.', {}),
 59: ('nw-moonlight-decoction', 'mystery-tonic', '달빛 탕약', 'bottle', 'purple', '의지력 +10 / 24시간 동안 무작위 육조 1개 +2', {'mp': 10, 'randomBuff': {'count': 1, 'amount': 2, 'hours': 24}}, {}, '그믐꽃과 초승꽃을 약재 달임물에 띄운 탕약. 달이 바뀌는 맛이 난다.', {}),
 60: ('nw-oyster-pine-grill', 'grilled-mushroom', '느타리 잣기름구이', 'skewer', 'gray', '개척 중: 개척 행동 턴 +3', {'hunt': {'turns': 3}}, {}, '느타리버섯을 잣기름에 구워 꼬치에 꿴 것.', {'soybean-oil': 'nw-pine-oil'}),
 61: ('nw-omija-punch', 'snakeberry-punch', '오미자 뱀딸기 화채', 'glass', 'pink', '의지력 회복: 일행에게 건네면 +18, 자신이 먹으면 +8', {'giveMp': {'party': 18, 'self': 8}}, {}, '오미자청에 뱀딸기를 띄운 화채. 붉은빛이 두 겹이다.', {'wild-grape-juice': 'nw-omija-syrup'}),
 62: ('nw-dandelion-deodeok-tea', 'bibimbap', '민들레 더덕차', 'cup', 'soy', '의지력 +25', {'mp': 25}, {}, '민들레를 더덕 달임물에 우린 차. 쓴맛 끝에 단맛이 온다.', {'herb-decoction': 'nw-deodeok-decoction'}),
 63: ('nw-cabbage-potato-soup', 'bibimbap', '배추 감잣국', 'bowl', 'cream', '체력 +30', {'hp': 30}, {}, '배추와 감자를 청화 육수에 끓인 국. 급식실에서 제일 빨리 떨어진다.', {}),
 64: ('nw-fern-spinach-namul', 'bibimbap', '고사리 시금치 무침', 'herb', 'dgreen', '체력 +15 / 의지력 +15', {'hp': 15, 'mp': 15}, {}, '고사리와 시금치 데침을 콩기름에 무쳤다.', {'blanched-greens': 'nw-blanched-spinach'}),
 65: ('nw-acorn-bowl', 'bibimbap', '도토리묵 사발', 'bowl', 'brown', '체력 +20 / 의지력 +10', {'hp': 20, 'mp': 10}, {}, '도토리묵을 채 썰어 청화 육수에 만 사발.', {}),
 66: ('nw-dangwi-brew', 'snakeberry-jam', '당귀 달인 차', 'cup', 'grape', '의지력 +10 / 12시간 동안 절제 +1', {'mp': 10, 'buff': {'stat': 'control', 'amount': 1, 'hours': 12}}, {}, '당귀를 약재 달임물에 한 번 더 달인 진한 차.', {}),
 67: ('nw-licorice-candy', 'bibimbap', '감초 사탕', 'candy', 'yellow', '의지력 +15', {'mp': 15}, {}, '감초 즙에 설탕을 녹여 굳힌 사탕. 매점 사탕보다 오래 녹는다.', {}),
 68: ('nw-deodeok-syrup-grill', 'snakeberry-jam', '더덕 조청구이', 'skewer', 'brown', '체력 +20 / 12시간 동안 인내 +1', {'hp': 20, 'buff': {'stat': 'endurance', 'amount': 1, 'hours': 12}}, {}, '더덕을 두들겨 밤 조청을 발라 구웠다.', {}),
 69: ('nw-azalea-rice-cake', 'twin-pop', '진달래 화전떡', 'dango', 'pink', '체력 회복: 일행에게 건네면 +20, 자신이 먹으면 +8', {'giveHp': {'party': 20, 'self': 8}}, {}, '쌀가루 반죽에 진달래를 얹고 밤 조청을 바른 떡.', {}),
 # ── 3단계 — 조리실 ──
 96: ('nw-palmul-tang', 'sipjeon-tang', '팔물탕', 'pot', 'brown', '12시간 동안 모든 육조 +1', {'buffAll': {'amount': 1, 'hours': 12}}, {}, '약재 여덟 가지를 다린 탕. 십전대보탕보다 순하다.', {}),
 97: ('nw-elixir-sipjeon', 'elixir-of-youth', '불로 십전탕', 'pot', 'gold', '체력 완전 회복 / 24시간 동안 모든 육조 +2', {'hpFull': True, 'buffAll': {'amount': 2, 'hours': 24}}, {}, '불로초와 십전대보탕, 녹용 보약을 한 솥에 다시 고았다.', {}),
 98: ('nw-turtle-sipjeon', 'dragon-palace-soup', '귀갑 십전탕', 'stew', 'dgreen', '24시간 동안 인내 +3 · 절제 +3', {'buffs': [{'stat': 'endurance', 'amount': 3, 'hours': 24}, {'stat': 'control', 'amount': 3, 'hours': 24}]}, {}, '천년거북 등딱지를 십전대보탕에 넣어 사흘 고았다.', {}),
 99: ('nw-fortune-taffy', 'fortune-pill', '오복 엿', 'candy', 'gold', '24시간 동안 무작위 육조 1개 +4 / 영력 +10', {'randomBuff': {'count': 1, 'amount': 4, 'hours': 24}, 'spirit': 10}, {}, '오복 날개막을 달인 보약에 밤 조청을 섞어 굳힌 엿.', {}),
 100:('nw-songi-porridge', 'dragon-palace-soup', '송이 죽', 'porridge', 'cream', '체력 +30 / 24시간 동안 안목 +2', {'hp': 30, 'buffs': [{'stat': 'insight', 'amount': 2, 'hours': 24}]}, {}, '송이버섯을 결대로 찢어 쌀과 청화 육수로 쑨 죽. 향이 먼저 숟가락에 닿는다.', {}),
 101:('nw-imugi-tonic-soup', 'dragon-palace-soup', '이무기 보양탕', 'stew', 'jade', '체력 +20 / 24시간 동안 호전 +2 · 인내 +2', {'hp': 20, 'buffs': [{'stat': 'aggression', 'amount': 2, 'hours': 24}, {'stat': 'endurance', 'amount': 2, 'hours': 24}]}, {}, '잉어탕에 이무기 비늘과 약재 달임물을 더해 고은 보양탕.', {}),
 102:('nw-pine-syrup-porridge', 'bibimbap', '잣 조청죽', 'porridge', 'white', '체력 +25 / 의지력 +20', {'hp': 25, 'mp': 20}, {}, '잣과 쌀을 갈아 쑤고 밤 조청으로 맛을 낸 죽.', {}),
 103:('nw-ginseng-doraji-pill', 'wild-ginseng-jeonggwa', '천종삼 도라지환', 'pill', 'cream', '전투 중: 전투불능 시 1회 체력 1로 부활 대기(한 전투에 부활 아이템은 1번) / 체력 +30', {'revive': True, 'hp': 30, 'onlyBattle': True}, {}, '천종삼과 도라지 정과를 함께 빚은 환.', {}),
 104:('nw-frost-punch', 'frost-bingsu', '얼음꽃 화채', 'glass', 'sky', '전투 중: 일행 전원 의지력 +25 / 일행 전원 그 전투 동안 절제 +3', {'partyMp': 25, 'partyStat': {'control': 3}, 'onlyBattle': True}, {}, '머루 화채에 얼음꽃을 띄우고 설탕을 뿌렸다. 입에 넣으면 숨이 고요해진다.', {}),
 105:('nw-oyster-namul-hotpot', 'carp-soup', '느타리 나물전골', 'hotpot', 'gray', '전투 중: 일행 전원 체력 +15', {'partyHp': 15, 'onlyBattle': True}, {}, '느타리버섯과 데친 나물을 청화 육수에 끓인 전골. 둘이 한 냄비.', {}),
 108:('nw-mushroom-namul-bowl', 'bibimbap', '버섯 나물 덮밥', 'rice', 'tan', '체력 +40 / 의지력 +25', {'hp': 40, 'mp': 25}, {}, '데친 나물과 버섯 구이를 밥 위에 듬뿍 얹었다.', {}),
 109:('nw-namul-kalguksu', 'snakeberry-jam', '나물 칼국수', 'noodle', 'green', '체력 +40 / 12시간 동안 인내 +1', {'hp': 40, 'buff': {'stat': 'endurance', 'amount': 1, 'hours': 12}}, {}, '밀가루 반죽을 칼로 썰어 나물과 청화 육수에 끓였다.', {}),
 110:('nw-antler-syrup-pill', 'antler-tonic', '녹용 조청환', 'pill', 'tan', '전투 중: 전투 중 인내 +4 · 호전 +2 (다인 전투는 그 전투 동안, 단독 전투는 20분) / 체력 +10', {'battleStat': {'endurance': 4, 'aggression': 2}, 'hp': 10, 'onlyBattle': True}, {}, '녹용과 약재 달임물을 밤 조청에 개어 빚은 환.', {}),
}
assert len(N) == 81, len(N)

# ── 지금 쓰인 도트 조합(겹치면 다음 색으로) ──
used = set(json.loads(subprocess.check_output(['node', '-e', "import('./reskin.data.js').then(R=>{const u=new Set();for(const [id,p] of Object.entries(R.ITEM_PIXELS)) if(!id.startsWith('nw-')) u.add(p.t+':'+p.p);console.log(JSON.stringify([...u]))})"], cwd=HERE)))
pal_order = ['white', 'cream', 'tan', 'brown', 'dbrown', 'gray', 'dgray', 'black', 'red', 'crimson', 'pink', 'orange', 'ember', 'yellow', 'gold', 'lime', 'green', 'dgreen', 'jade', 'cyan', 'sky', 'blue', 'ink', 'purple', 'grape', 'bone', 'soy', 'rice', 'ghost']

lines = open(os.path.join(HERE, 'recipes-new.txt'), encoding='utf8').read().split('\n')
if any('|nw-' in l for l in lines): raise SystemExit('이미 바꿨다 — recipes-new.txt 에 nw- 결과가 있다. 다시 돌리지 않는다.')
idx = [i for i, l in enumerate(lines) if l.strip()]
out = ['# v1.5 새 아이템 81종 — 겹치던 v1.0 제작법 자리를 채운다(make_new_items.py 가 만든다).',
       '# id|닮은 원래 아이템(규칙 · 태그를 빌림)|이름|도트 틀|색|효과 글|효과 JSON|덧붙임 JSON|설명']
for n, (nid, like, name, t, p, etext, eff, extra, desc, swap) in sorted(N.items()):
    li = idx[n - 1]
    place, tier, result, ins, *rest = lines[li].split('|')
    for a, b in swap.items():
        ins2 = re.sub(rf'(^|\+){re.escape(a)}(\*|\+|$)', rf'\g<1>{b}\2', ins)
        assert ins2 != ins, (n, a, ins); ins = ins2
    lines[li] = '|'.join([place, tier, nid, ins, *rest])
    if f'{t}:{p}' in used:
        p = next(q for q in pal_order if f'{t}:{q}' not in used)
    used.add(f'{t}:{p}')
    out.append('|'.join([nid, like, name, t, p, etext, S(eff), S(extra), desc]))
open(os.path.join(HERE, 'recipes-new.txt'), 'w', encoding='utf8').write('\n'.join(lines))
open(os.path.join(HERE, 'items-new.txt'), 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('새 아이템', len(out) - 2, '· 제작법 바꿈', len(N))
