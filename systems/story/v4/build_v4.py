# -*- coding: utf-8 -*-
"""비령 본편 v4 — 「비령_스토리 스크립트 v4」(script_v4.xlsx)를 게임 데이터로 바꾼다.

  python3 systems/story/v4/build_v4.py            (저장소 맨 위에서)

나오는 것
  story-data.js                 프롤로그(튜토리얼) + 권 · 장 목록 + 상대 · 바깥 지역 · 유품 · 칭호. 홈페이지에 들어간다.
  story-chapters/ch1.json … ch4.json   1 · 2 · 3 · 4장. 홈페이지에 넣지 않고 따로 둔다 — 관리자 [스토리 관리]에서 올리고 공개한다.

원고 읽는 법(시트의 약속)
  · 캐릭터 칸이 빈 줄: 지문(글자 그대로 나온다). 단, 바로 앞 화자의 말이 이어지는 줄은 그 화자의 대사다(NARR 에 없는 줄).
  · 행동지문 칸: 괄호 없는 글 → 대사 밑에 지문으로 나온다. (괄호 안의 글) → 실제 연출. 글자로 내보내지 않는다.
  · (①) (②) (①②) 로 시작하는 줄: 바로 앞 선택에서 그 번호를 고른 사람에게만 나온다.
  · PC 줄: 선택. 「물음 — ① … ② …」.   ??로 표기(이름): 이름 대신 ??.
  · 스토리 트리거 칸: 그 줄부터 새 단계. 어디로 가야 하는지 · 무엇을 해야 하는지(TRIG).
  · 연출(FX)은 줄 번호(시트의 행)로 붙인다 — 화면 효과 · 배경 · 장면 그림. 글자로는 나오지 않는다.
"""
import json, os, re, sys
from xlsx_plain import read_rows
from align_story import row_alignment

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SOURCE = os.environ.get('BIRYEONG_STORY_SOURCE', os.path.join(HERE, 'script_v5.xlsx'))
old_rows = read_rows(os.path.join(HERE, 'script_v4.xlsx'), '스토리 스크립트')
new_rows = read_rows(SOURCE, '스토리 스크립트')
row_map, alignment_stats = row_alignment(old_rows, new_rows)

# Preserve every revised screenplay cell in the requested B2:B851 chapter range.
# Old numeric row IDs are applied only to matched original rows, to keep existing
# choices, scene triggers, rewards, FX, and branching semantics stable.
rows, cur = [], {'ch': '', 'scene': ''}
for raw_i, r in new_rows:
    if raw_i < 2 or raw_i > 851 or raw_i not in row_map: continue
    i = row_map[raw_i]
    _, vol, ch, scene, char, text, trig, act, memo = (list(r) + [None] * 11)[:9]
    if ch: cur['ch'] = str(ch).split('\n')[0].strip()
    if scene: cur['scene'] = str(scene).strip()
    if not any([char, text, trig, act]): continue
    rows.append(dict(row=i, source_row=raw_i, ch=cur['ch'], scene=cur['scene'], char=str(char or '').strip(), text=str(text or '').strip(), trig=str(trig or '').strip(), act=str(act or '').strip()))

CH_NO = {'프롤로그': 0, '1장': 1, '2장': 2, '3장': 3, '4장': 4}
SCENE_META = {  # 장면: (id, 곳, 때, 배경)
    '최초 최후의 신탁': ('P-1', '전국 · 모든 화면', '2035년 12월 31일 23시', 'night'),
    '입소식': ('P-2', '강학당 · 별관 1층 강당', '2036년 3월 1일', 'east'),
    '마지막 무구': ('P-3', '비령산 금역 · 무구보관소', '2036년 3월 1일', 'south'),
    '불리지 않은 이름': ('1-1', '생활관 · 기숙사', '입소 17일째 밤', 'west-night'),
    '303호의 전학생?': ('1-2', '생활관 · 급식실', '이튿날 아침', 'west'),
    '울리는 소리': ('1-3', '강학당 · 본관 양호실', '같은 날', 'east'),
    '이름을 먹는 요괴': ('1-4', '비령산 금역 → 본관 교무실', '3월 하순 · 자정', 'south'),
    '당신은 누구': ('1-5', '강학당 · 본관 양호실', '이튿날 아침', 'east'),
    '이승의 목소리': ('2-1', '생활관 · 급식실', '2036년 4월 · 아침', 'west'),
    '저승의 목소리': ('2-2', '강릉 · 다세대 주택 3층', '같은 날', 'city'),
    '죽음의 목소리': ('2-3', '강릉 · 귀환자 쉼터', '같은 날 · 저녁', 'city-dusk'),
    '경계선': ('2-4', '강릉 · 다세대 주택 3층', '며칠 뒤', 'city'),
    '산 자의 관': ('2-5', '경북 청암리', '발인 닷새 전', 'village'),
    '향하는 마음': ('2-6', '강릉 · 다세대 주택 3층', '그날 밤', 'city-night'),
    '돌아온 자들': ('2-7', '청암리 · 마을 회관', '발인날 새벽', 'village-dawn'),
    '저 이승의 장례식': ('2-8', '청암리 · 당산나무 아래', '4월 18일 자정', 'village-night'),
    # vD.02.2 3장 「신이 없는 사당」
    '몽유': ('3-1', '생활관 · 기숙사 → 별관 강당', '2036년 5월', 'west-night'),
    '네가 원하는 신': ('3-2', '비령산 · 버려진 사찰', '며칠 뒤', 'south'),
    '너의 이름은': ('3-3', '비령산 · 사찰 법당', '같은 날', 'south'),
    '오너라': ('3-4', '비령산 · 사찰 둘레길', '같은 날 · 해질녘', 'south'),
    '비령': ('3-5', '비령산 · 사찰 앞', '같은 날 · 밤', 'south'),
    # vD.03 4장 「신탁 오류」
    '제물': ('4-1', '생활관 · 급식실 → 매점', '2036년 6월 1일 · 아침', 'west'),
    '신탁 오류': ('4-2', '강학당 · 본관 지하 1층', '같은 날 · 오전', 'east'),
    '소원이라는 것': ('4-3', '생활관 · 기숙사 → 비령산', '같은 날 · 저녁', 'west'),
    '시간의 찌꺼기': ('4-4', '생활관 · 기숙사', '같은 날 · 23시', 'west-night'),
    '쇳덩이 감시자': ('4-5', '강학당 · 본관 지하 1층 → 기숙사', '같은 날 · 자정 무렵', 'east-night'),
}

# 화자 칸이 빈 줄 가운데 지문인 줄(나머지는 앞 화자의 말이 이어진다)
NARR = {6, 7, 8, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 25, 26, 32, 34, 37, 38, 52, 59, 60, 61, 68, 69, 72, 73, 76, 79, 80, 81, 87, 88, 96, 101, 107, 108, 111, 112, 116, 117,
        119, 120, 121, 123, 125, 129, 130, 136, 144, 149, 154, 156, 157, 158, 163, 164, 172, 181, 182, 191, 192, 193, 198, 199, 208, 210, 217, 218, 221, 222, 223, 234, 236, 237, 238,
        241, 249, 258, 262, 266, 268, 270, 272, 276, 277, 284, 291, 292, 293, 294, 295, 296, 302, 306, 310, 318, 319, 332, 335, 336, 337, 346, 349, 352, 362, 363, 371, 384, 385, 386, 387, 399, 400,
        # 3장
        412, 413, 414, 418, 419, 421, 424, 426, 434, 440, 444, 445, 452, 464, 473, 483, 487, 488, 500, 506, 525, 536, 537, 546, 547,
        # 4장
        550, 551, 552, 563, 574, 577, 589, 598, 599, 600, 610, 615, 616, 617, 623, 624, 625, 626, 633, 634, 635, 636, 638, 641, 647, 648, 650, 653, 657, 660, 676,
        678, 697, 699, 710, 713, 714, 725, 735, 736, 737, 738, 739, 741, 749, 771, 773, 781, 782, 783, 791, 793, 802, 810, 813}
SKIP_ROWS = set(range(453, 460))   # 3장: 시트에 같은 대사 묶음(서창현 「장경각 아래에…」 ~ 연호수 「여기 말이 되는 일이…」)이 두 번 들어 있다 — 뒤의 것은 뺀다
SPEAKER_SET = {460: '연호수'}       # 위를 빼서 앞 화자가 바뀐 줄
SPEAKER_FIX = {'선생': '결계학 선생', '귀환자 쉼터': '귀환자 쉼터 담당자', '윤호수': '연호수', '—': ''}  # 시트의 화자 칸 → 화면에 나오는 이름
BATTLE_RULE_ROWS = {146, 377, 378, 379, 463, 527, 752}   # 전투 설명 줄 — 대사로 흘리지 않고 전투 단계의 안내 · 전투 시작 카드로
OPENING_ROWS = {2, 3, 4, 5, 7}            # 가입 직후 오프닝(opening.js)이 먼저 보여 주는 줄 — 프롤로그를 처음 볼 때는 건너뛴다(다시 보기에는 나온다)
CHAPTER_END = {184: 1, 402: 2, 549: 3, 812: 4}            # 「n장─… 종료.」 → 장 마침 표제(글자 줄이 아니라 화면 연출)
TEXT_FIX = {319: ('서울에 사는', '강릉에 사는'),  # 바깥 지역 서울 → 강릉(강릉 시내)
            146: ('사감 선생(한도윤)을', '사감 선생의 이름을'),
            480: ('(△△.', '△△.'),          # 3장: 짝 없는 여는 괄호
            518: ('③④ ', '(③④) '),          # 3장: 조건 표시의 괄호가 빠짐
            463: ('파티의 평균 정신오염에 따라', '정신오염(이 사찰에서 고른 것들)에 따라'),
            576: ('필요합니다. 비령 학생', '필요합니다. 학생'),   # 4장: 시트에서 화자 칸이 대사 칸에 붙어 들어감
            588: ('③ ', '(③) '), 800: ('③ ', '(③) '),          # 4장: 조건 표시의 괄호가 빠짐
            643: ('(행동 반영) ', ''),                          # 4장: 연출 메모
            527: ('3레벨 보스 수준의 적. 난이도가 상당히 어렵다. 아이템/영능력 일부를 사용해야 클리어가 가능하다.', '3단계 보스 수준의 상대. 아이템과 영능력을 함께 써야 이길 수 있다.')}
ACT_FIX = {469: ('무당을 꽉', '무구를 꽉')}
# 전투 설명 줄을 통째로 바꾼다(시트의 설명은 연출 메모를 겸한다 — 화면에는 실제 규칙을 적는다)
RULE_SET = {}  # 최신 스토리 시트의 4장 보스 영능력 설명을 원문 그대로 쓴다
GRADE_ROWS = {635: [1]}   # 4장: 1학년에게만 나오는 줄(시트 행동지문 칸의 메모)
MASK_FACE = {'비'}        # 4장: 「비의 모습이 등장했다」는 지문 · 명령이 나오기 전까지 얼굴을 단색 인장으로 가린다   # 3장 행동지문 오타  # 전투 안내에 정답(이름)을 적지 않는다

# ── 연출: 줄 번호 → 효과(글자로는 안 나온다) ──
#  stage:<그림>  장면 그림(오프닝과 같은 도트 무대) · bg:<배경> 배경 바꾸기 · shake · flash · red / red2 단말기 붉은 빛 · ink 먹물 · bell 방울 한 번 · crack 화면 갈라짐
#  distort 일그러짐 · dim 어둡게 · warm 따뜻하게 · cold 서늘하게 · name 명찰 번뜩임 · rope 금줄 끊김 · paper 봉투 · tv 뉴스 화면 · radio 통신 · vote 투표
FX = {
    2: ['stage:screens'], 3: ['stage:screens'], 4: ['stage:gauge'], 5: ['tv'], 7: ['stage:door'],
    6: ['stage:door'], 8: ['dim'], 10: ['stage:bell'], 11: ['stage:empty'], 12: ['tv', 'ticker'], 13: ['stage:empty'], 14: ['stage:tales'], 15: ['stage:tales', 'distort'],
    16: ['cold'], 17: ['dim'], 18: ['stage:mountain'], 19: ['bg:north', 'mist'], 20: ['bg:north', 'mist'], 21: ['bg:north'], 22: ['bg:north', 'dim'], 23: ['bg:north'],
    24: ['bg:north'], 26: ['name'], 31: ['shake'], 37: ['bg:east'], 39: ['shake'], 47: ['stage:gate'], 52: ['crack', 'shake'], 54: ['shake'],
    62: ['bg:south'], 66: ['flash'], 67: ['bg:west-night'], 68: ['dim'], 72: ['cold'], 73: ['bell'], 74: ['shake'], 76: ['bell', 'cold'],
    81: ['bg:west'], 89: ['cold'], 96: ['bell'], 97: ['bell'], 101: ['bg:east'], 107: ['red'], 112: ['bg:south'], 116: ['shake'], 119: ['bg:west-night', 'dim'], 120: ['cold'],
    121: ['red2'], 123: ['shake', 'flash'], 124: ['shake'], 129: ['bg:east-night', 'ink'], 130: ['ink', 'distort'], 132: ['distort'], 136: ['distort', 'red2'],
    147: ['ink'], 149: ['ink', 'flash'], 157: ['bg:east'], 177: ['cold'], 183: ['corner'], 185: ['bg:west', 'tv'], 192: ['italic'], 198: ['bg:north'],
    208: ['bg:city'], 210: ['warm'], 217: ['dim'], 225: ['cold'], 228: ['distort', 'water'], 229: ['shake'], 235: ['radio'], 236: ['bg:city'], 238: ['bg:city-dusk'],
    258: ['shake', 'flash'], 262: ['bg:city-dusk'], 264: ['distort'], 267: ['shake', 'distort'], 268: ['distort', 'red2'], 270: ['shake'],
    276: ['dim'], 292: ['bg:city', 'dim'], 293: ['distort'], 294: ['radio'], 296: ['paper', 'cold'], 301: ['radio'], 306: ['bg:village'], 310: ['bg:village', 'cold'], 316: ['bg:village-forest'],
    326: ['cold'], 328: ['rope', 'shake'], 335: ['bg:village-night', 'distort'], 336: ['red2'], 337: ['shake', 'distort'], 338: ['distort'], 340: ['cold'],
    352: ['bg:city-night', 'dim'], 362: ['bg:village-dawn'], 367: ['vote'], 380: ['distort'], 382: ['shake'], 384: ['shake', 'red'], 387: ['bg:city', 'warm'], 399: ['warm'], 400: ['dim'], 401: ['corner'],
    # 4장
    563: ['bg:west'], 575: ['red'], 576: ['red'], 580: ['cold'], 598: ['bg:east'], 616: ['bg:east-night', 'cold'], 625: ['distort'], 633: ['bg:east'], 637: ['red2'], 638: ['red', 'shake'],
    641: ['bg:east-night'], 643: ['red2'], 644: ['red2'], 645: ['red2'], 647: ['cold'], 648: ['dim'], 649: ['distort'], 678: ['bg:west'], 699: ['bg:south'], 709: ['bg:south'], 725: ['warm'],
    737: ['bg:west-night', 'red2'], 741: ['shake', 'distort'], 745: ['red2'], 746: ['distort'], 747: ['distort'], 750: ['red2', 'flash'], 771: ['dim'], 772: ['bg:east-night'], 782: ['shake'], 784: ['red'],
    792: ['cold'], 802: ['bg:west-night', 'dim'],
}

# ── 트리거 → 단계(어디에서 w · 할 일 n · 안내 a · 곳 p) ──
def V(k): return f'visit:{k}'
TRIG = {
    '회원가입 후 프로필 작성 시 자동으로 뜨는 튜토리얼': dict(w='any', a='프로필을 만들면 이야기가 시작된다', p='어디서나'),
    '별관 1층 강당으로 이동': dict(w='annex/explore', n=[V('annex:f1:auditorium')], a='별관 1층 강당으로 간다', p='강학당 › 별관 탐사 › 1층 › 강당'),
    '뒷산 무구보관소로 이동': dict(w='gym/hike', n=[V('gym:left:armory')], a='뒷산 무구보관소로 간다 — 유품을 무구로 받는다', p='비령산 금역 › 뒷산 › 왼길 › 무구보관소', heir=1),
    '생활관 - 내 기숙사로 이동': dict(w='dorm/my-room', a='생활관의 내 기숙사로 간다', p='생활관 › 기숙사 › 내 기숙사'),
    '생활관 - 급식실로 이동': dict(w='dorm/cafeteria', a='생활관 급식실로 간다', p='생활관 › 기숙사 › 급식실'),
    '소지품에서 [303호의 방울]을 조사': dict(w='any', n=['inspect:st-bell302'], a='소지품에서 「303호의 방울」을 조사한다', p='소지품'),
    '본관 - 양호실로 이동': dict(w='infirmary', a='본관 양호실로 간다', p='강학당 › 양호실'),
    '비령산 금역 - 퇴마 실습으로 이동': dict(w='gym/battle', a='비령산 금역의 퇴마 실습으로 간다', p='비령산 금역 › 뒷산 › 퇴마 실습'),
    '퇴마 실습 페이지에서 [전투 안내]를 4단계까지 완료': dict(w='gym/battle', n=['tutorial×4'], a='퇴마 실습의 [전투 안내]를 4단계까지 마친다', p='비령산 금역 › 뒷산 › 퇴마 실습'),
    '본관 - 교무실로 이동': dict(w='mainHall/explore', n=[V('mainHall:f2:staff')], a='본관 2층 교무실로 간다', p='강학당 › 본관 탐사 › 2층 › 교무실'),
    '메인 스토리 전투 - 명부귀': dict(w='mainHall/explore', n=['battle:myeongbugwi'], a='명부귀와 싸운다', p='강학당 › 본관 탐사 › 2층 › 교무실', same=1),
    '메인 스토리 전투 완료': None,   # 앞 전투 단계에 붙는다(전투에 이기면 이어지는 대사)
    '산문으로 이동': dict(w='north', a='산문으로 간다', p='산문(北)'),
    '산문 - 서울 - 다세대 주택 3층으로 이동': dict(w='out:gangneung/house', a='강릉의 다세대 주택 3층으로 간다', p='산문 너머 › 바깥 지역 › 강릉 › 다세대 주택 3층'),
    '산문 - 서울 - 골목으로 이동': dict(w='out:gangneung/alley', a='강릉의 골목으로 간다', p='산문 너머 › 바깥 지역 › 강릉 › 골목'),
    '산문 - 서울 - 귀환자 쉼터로 이동': dict(w='out:gangneung/shelter', a='강릉의 귀환자 쉼터로 간다', p='산문 너머 › 바깥 지역 › 강릉 › 귀환자 쉼터'),
    '메인스토리용 무구를 2강 이상으로 만든 뒤 장착하고 산문 - 서울 - 골목으로 이동': dict(w='out:gangneung/alley', n=['heirlvl:2', 'equip:heir'], here=1, a='유품 무구를 2강 이상으로 강화하고 장착한 채 강릉의 골목으로 간다', p='뒷산 무구보관소(강화) → 강릉 › 골목'),
    '메인 스토리 전투 - 죽음을 들은 자': dict(w='out:gangneung/alley', n=['battle:heard|calm'], a='죽음을 들은 자를 진정시키거나 쓰러뜨린다', p='강릉 › 골목', same=1),
    '산문 - 서울 - 다세대 주택 3층 이동': dict(w='out:gangneung/house', a='강릉의 다세대 주택 3층으로 간다', p='산문 너머 › 바깥 지역 › 강릉 › 다세대 주택 3층'),
    '산문 - 청암리 - 마을 입구 이동': dict(w='out:cheongam/gate', a='청암리 마을 입구로 간다', p='산문 너머 › 바깥 지역 › 청암리 › 마을 입구'),
    '산문 - 청암리 - 마을 회관 이동': dict(w='out:cheongam/hall', a='청암리 마을 회관으로 간다', p='청암리 › 마을 회관'),
    '산문 - 청암리 - 당산 숲 이동': dict(w='out:cheongam/forest', a='청암리 당산 숲으로 간다', p='청암리 › 당산 숲'),
    '산문 - 청암리 - 당산나무 아래 제단 이동': dict(w='out:cheongam/altar', a='당산나무 아래 제단으로 간다', p='청암리 › 당산나무 아래 제단'),
    '산문 - 청암리 - 마을회관 이동': dict(w='out:cheongam/hall', a='청암리 마을 회관으로 간다', p='청암리 › 마을 회관'),
    '공작소에서 [쑥 향]을 제작': dict(w='any', n=['make:mugwort-incense'], a='공작소에서 「쑥 향」을 만든다', p='강학당 › 별관 탐사 › 2층 › 공작소'),
    '메인스토리 전투': dict(w='out:cheongam/altar', alt={'C2-3': {1: ['battle:effigy'], 2: ['battle:dangsan'], 3: ['battle:dangsan']}}, a='당산나무 아래에서 싸운다', p='청암리 › 당산나무 아래 제단',
                         alt_a={'C2-3': {1: '발인을 지키는 액막이 인형 무리를 막는다 — 올해 발인만 멈춘다', 2: '당산신 본체 — 신이 당신을 시험한다', 3: '당산신 본체 — 신을 몰아낸다'}}),
    # vD.02.2 3장
    '생활관 - 별관 - 강당 이동': dict(w='annex/explore', n=[V('annex:f1:auditorium')], a='별관 1층 강당으로 간다', p='강학당 › 별관 탐사 › 1층 › 강당'),
    '강학당 - 별관 - 강당으로 이동': dict(w='annex/explore', n=[V('annex:f1:auditorium')], a='별관 1층 강당으로 간다', p='강학당 › 별관 탐사 › 1층 › 강당'),
    '뒷산 - 중앙길 - 사찰로 이동': dict(w='gym/hike', n=[V('gym:center:climb:temple')], a='뒷산 중앙길의 사찰로 간다', p='비령산 금역 › 뒷산 › 중앙길 › 산 오르기 › 사찰'),
    '뒷산 - 중앙길 - 둘레길': dict(w='gym/hike', n=[V('gym:center:loop:outside')], a='뒷산 중앙길의 둘레길로 간다', p='비령산 금역 › 뒷산 › 중앙길 › 둘레길 › 교외'),
    '메인 스토리 전투 종료': None, '메인스토리 전투 종료': None,
    # vD.03 4장
    '생활관 - 매점으로 이동': dict(w='dorm/store', a='생활관 매점으로 간다', p='생활관 › 기숙사 › 매점'),
    '강학당 - 본관 - 1층 - 로비로 이동': dict(w='mainHall/explore', n=[V('mainHall:f1:lobby')], a='본관 1층 로비로 간다', p='강학당 › 본관 탐사 › 1층 › 로비'),
    '강학당 - 본관 - 지하 1층 - 거대한 문': dict(w='mainHall/explore', n=[V('mainHall:b1:escape')], a='본관 지하 1층의 거대한 문으로 간다', p='강학당 › 본관 탐사 › 지하 1층 › 거대한 문'),
    '주사 3개와 봉인석 1개, 부적 조각 4개를 소지품에 지참한 채로 강학당 - 본관 - 지하 1층 - 거대한 문': dict(w='mainHall/explore', n=['bring:cinnabar×3', 'bring:sealing-stone', 'bring:charm-scrap×4', V('mainHall:b1:escape')], here=1,
        a='주사 3개 · 봉인석 1개 · 부적 조각 4개를 지니고 거대한 문으로 간다 — 의식에 쓰여 소지품에서 빠진다', p='강학당 › 본관 탐사 › 지하 1층 › 거대한 문'),
    '강학당 - 본관 - 수업으로 이동': dict(w='mainHall/class', a='본관 수업으로 간다', p='강학당 › 본관 › 수업'),
    '비령산 - 오른길 - 청화호수': dict(w='gym/hike', n=[V('gym:right:lake')], a='뒷산 오른길의 청화호수로 간다', p='비령산 금역 › 뒷산 › 오른길 › 청화호수'),
    '비령산 - 중앙길 - 사찰': dict(w='gym/hike', n=[V('gym:center:climb:temple')], a='뒷산 중앙길의 사찰로 간다', p='비령산 금역 › 뒷산 › 중앙길 › 산 오르기 › 사찰'),
    '생활관 - 내 기숙사': dict(w='dorm/my-room', a='생활관의 내 기숙사로 돌아간다', p='생활관 › 기숙사 › 내 기숙사'),
    '공작소에서 [소형 돌제단], [일회용 수호령]을 제작': dict(w='any', n=['make:small-altar', 'make:spirit-disposable'], a='공작소에서 「소형 돌제단」 · 「일회용 수호령」을 만든다', p='강학당 › 별관 탐사 › 2층 › 공작소'),
}
# 같은 트리거 글이 여러 장에 나올 때: 행 번호로 따로 정한다(3장의 두 전투)
ROW_TRIG = {
    463: dict(w='gym/hike', n=['battle:waiting'], a='「기다리는 것」과 싸운다', p='비령산 금역 › 뒷산 › 중앙길 › 산 오르기 › 사찰'),
    527: dict(w='gym/hike', n=['battle:sachal'], a='「사찰귀」를 물리친다', p='비령산 금역 › 뒷산 › 중앙길 › 둘레길'),
    752: dict(w='dorm/my-room', n=['battle:error'], a='「오류(誤謬)」를 물리친다 — 23시 17분 전에', p='생활관 › 기숙사 › 내 기숙사'),
}
GIVE = {'1-2': {'st-bell302': 1}}
GIVE_FIRST = {'3-2': {'st-prayers': 1}}   # 그 장면의 첫 단계를 마칠 때(전투 전에) 받는 것 — 쪽지 탑의 기도 쪽지  # 장면을 마칠 때 받는 것(윤진서가 지나간 자리에 남은 방울)

# ── 선택 ──
CHOICE_ID = {9: 'C0-1', 55: 'C0-2', 92: 'C1-1', 152: 'C1-2', 245: 'C2-1', 287: 'C2-2', 367: 'C2-3', 423: 'C3-1', 448: 'C3-2', 515: 'C3-3', 540: 'C3-4',
             585: 'C4-1', 667: 'C4-2', 729: 'C4-3', 778: 'C4-4', 797: 'C4-5', 808: 'C4-6'}
CHOICE_Q = {9: '마지막으로 받았던 것', 55: '연호수가 단말기를 밟았다', 152: '선생님을 부축할까', 245: '돌아온 사람은 어디까지 진짜인가', 287: '누구와 함께 돌아갈까',
            423: '쪽지에 무엇을 빌까', 448: '무엇이 보이나요', 515: '신을 어떻게 생각해요', 540: '제 말을 믿어 주실 수 있겠어요',
            585: '비령이 지목한 제물은 윤진서다', 667: '그 쇳덩이는 그대들의 삶에 꼭 있어야 하는가', 797: '비령은 결국 무엇인가', 808: '손등에 이름을 적어 줄까'}
# 이름을 지어 주는 줄(선택이 아니라 글자를 적는다) — 이후 △△ 자리는 이 이름으로 바뀐다
NAME_ROWS = {479: dict(id='P_신이름', key='god', q='이름을 지어 주자', x='같은 순간 다른 학생들도 저마다 다른 이름을 부른다. 이것은 당신만의 호칭이 될 것이다.', d='무명')}
VOTE = {'C2-3'}   # 모두의 의견을 모으는 선택(관리자 [스토리 관리]에서 집계 · 투표자를 본다) — 모든 선택이 서버에 올라가지만 이것은 '투표'로 표시된다
CIRC = '①②③④⑤⑥⑦⑧⑨⑩'
def parse_choice(text):
    q, rest = (text.split(' — ', 1) + [''])[:2] if ' — ' in text else ('', text)
    m = re.match(r'^([^①②③④⑤⑥⑦⑧⑨⑩]+?)[─—]\s*(?=[①②③④⑤⑥⑦⑧⑨⑩])', rest)   # 4장: 「물음─ ① …」
    if m: q, rest = (q or m[1].strip()), rest[m.end():]
    if not rest: rest = text
    opts = [o.strip() for o in re.split(r'[①②③④⑤⑥⑦⑧⑨⑩]', rest) if o.strip()]
    return q.strip(), opts

def cond_of(text, last_choice):
    m = re.match(r'^\(([①②③④⑤⑥⑦⑧⑨⑩]+)\)\s*', text)
    if not m: return text, None
    nums = [CIRC.index(c) + 1 for c in m[1]]
    return text[m.end():], [{'flag': last_choice, 'in': nums}]

# ── 줄 만들기 ──
scenes, order = {}, []
last_choice = None; speaker = None; cur_scene = None
for r in rows:
    sid, place, time, bg = SCENE_META[r['scene']]
    ch = CH_NO[r['ch']]
    if cur_scene != sid:
        cur_scene = sid; speaker = None
        scenes[sid] = {'id': sid, 'ch': ch, 'vol': 1, 'title': r['scene'], 'place': place, 'time': time, 'bg': bg, 'lines': [], 'steps': [], '_trig': []}
        order.append(sid)
    sc = scenes[sid]
    if r['row'] in SKIP_ROWS: continue
    if r['trig']: sc['_trig'].append((len(sc['lines']), r['trig'], r['row']))
    text = r['text']
    if r['row'] in TEXT_FIX: text = text.replace(*TEXT_FIX[r['row']])
    if r['row'] in RULE_SET: text = RULE_SET[r['row']]
    if r['row'] in BATTLE_RULE_ROWS:   # 전투 설명은 단계 안내로
        sc.setdefault('_rules', {})[r['row']] = re.sub(r'^\([①②③]+\)\s*', '', text)
        continue
    if r['row'] in CHAPTER_END:
        sc['lines'].append({'t': 'end', 'ch': CHAPTER_END[r['row']], 'row': r['row']}); continue
    char = SPEAKER_SET.get(r['row'], r['char'])
    ln = {'row': r['row']}
    fx = list(FX.get(r['row'], []))
    act = r['act']
    if r['row'] in ACT_FIX: act = act.replace(*ACT_FIX[r['row']])
    for paren in re.findall(r'\(([^)]*)\)', act):   # (괄호 안) = 실제 연출
        if '구석' in paren: fx.append('corner')
        elif '이탤릭' in paren: fx.append('italic')
        else: fx.append('note:' + paren)
    act_text = re.sub(r'\([^)]*\)', '', act).strip()
    if char == 'PC' and r['row'] in NAME_ROWS:
        nm = NAME_ROWS[r['row']]
        ln.update({'t': 'name', 'id': nm['id'], 'key': nm['key'], 'q': nm['q'], 'x': nm['x'], 'def': nm['d']}); speaker = None
    elif char == 'PC':
        q, opts = parse_choice(text)
        cid = CHOICE_ID[r['row']]
        ln.update({'t': 'choice', 'id': cid, 'q': q or CHOICE_Q.get(r['row'], ''), 'o': opts})
        if cid in VOTE: ln['vote'] = 1
        last_choice = cid; speaker = None
    else:
        text, cond = cond_of(text, last_choice)
        if cond: ln['c'] = cond
        if char.startswith('소지품에서'):
            ln.update({'t': 'i', 'x': text}); speaker = None
        else:
            who = None; unk = False
            if char:
                m = re.match(r'^(?:\?\?로 표기|\?\?\?)\((.+)\)$', char)
                if m: who, unk = m[1], True
                else: who = SPEAKER_FIX.get(char, char)
                speaker = (who, unk) if who else None
            elif r['row'] in NARR: speaker = None
            if char and not who: speaker = None
            cur_who = speaker
            if not cur_who: ln.update({'t': 'n', 'x': text})
            else:
                w, unk = cur_who
                t = 'b' if w == '비령' else 'news' if w == '뉴스 앵커' else 'sys' if w == '시스템' else 'say'
                ln.update({'t': t, 'x': text})
                if t in ('say', 'news'): ln['w'] = w
                if unk: ln['unk'] = 1
                if ch >= 4 and w in MASK_FACE: ln['mask'] = 1
    if r['row'] in GRADE_ROWS: ln['c'] = (ln.get('c') or []) + [{'grade': GRADE_ROWS[r['row']]}]
    if act_text: ln['a'] = act_text
    if fx: ln['fx'] = fx
    if r['row'] in OPENING_ROWS: ln['op'] = 1
    sc['lines'].append(ln)

# ── 단계 ──
for sid in order:
    sc = scenes[sid]; trigs = sc.pop('_trig'); rules = sc.pop('_rules', {})
    steps = []
    for k, (at, trig, row) in enumerate(trigs):
        if trig not in TRIG and row not in ROW_TRIG: sys.exit(f'모르는 트리거 (행 {row}): {trig}')
        o = ROW_TRIG.get(row) or TRIG[trig]
        end = trigs[k + 1][0] if k + 1 < len(trigs) else len(sc['lines'])
        if o is None:   # 「전투 완료」: 앞 단계(전투)의 대사로 붙인다
            if steps[-1].get('l'): steps[-1]['pre'] = steps[-1]['l']   # 전투 전에 그 자리에서 먼저 흐르는 대사
            steps[-1]['l'] = [at, end]; continue
        st = {'k': '이동', 'a': o['a'], 'p': o['p'], 'w': o['w']}
        if o.get('n'): st['n'] = list(o['n'])
        if o.get('alt'): st['alt'] = o['alt']; st['k'] = '전투'
        if o.get('alt_a'): st['alt_a'] = o['alt_a']
        if o.get('heir'): st['heir'] = 1
        if o.get('here'): st['here'] = 1
        if any(n.startswith('battle:') for n in st.get('n', [])) or o.get('alt'):
            st['k'] = '전투'; rr = [rules[x] for x in sorted(rules) if x >= row and x < row + 4]
            if rr: st['rule'] = rr if o.get('alt') else rr[0]
        if at < end: st['l'] = [at, end]
        steps.append(st)
    if sid in GIVE: steps[-1]['give'] = GIVE[sid]
    if sid in GIVE_FIRST: steps[0]['give'] = {**steps[0].get('give', {}), **GIVE_FIRST[sid]}
    sc['steps'] = steps
    # 전투가 있는 단계의 대사는 전투 뒤에 흐른다. 같은 자리에서 이어지는 단계는 그 자리 그대로.
    first = next((i for i, ln in enumerate(sc['lines']) if ln['t'] in ('n', 'say', 'b', 'news', 'sys', 'i')), None)
    sc['post'] = re.sub(r'OO', '당신', sc['lines'][first]['x'])[:60] if first is not None else ''
    for ln in sc['lines']: ln.pop('row', None)

# ── 상대 · 바깥 지역 · 유품 ──
FOES = {
    'myeongbugwi': (1, 2, '명부의 귀신', '부르지 않은 이름을 먹는 출석부의 괴이.'),
    'heard': (1, 1, '죽음을 들은 자', '자신이 죽었다는 것을 방금 들었다.'),
    'effigy': (1, 0, '액막이 인형 무리', '발인을 지키는 짚 인형 열두 체.'),
    'dangsan': (2, 2, '당산신', '마을의 셈을 맞추는 늙은 신.'),
    'waiting': (3, 1, '기다리는 것', '신을 기다리던 마음이 너무 오래 기다린 끝에 스스로 신이 되었다.'),
    'sachal': (3, 2, '사찰귀', '버려진 사찰에 흘러든 악귀. 비령조차 늦게 알아챘다.'),
    'error': (4, 2, '오류(誤謬)', '23시 17분의 예언을 지키려는 예측이 형상화된 것.'),
}
REGIONS = {
    'gangneung': {'name': '강릉', 'sub': '강릉 시내', 'spots': [
        {'id': 'house', 'name': '다세대 주택 3층', 'desc': '참기름 냄새가 나는 집. 벽에는 가족사진이 걸려 있다.'},
        {'id': 'alley', 'name': '골목', 'desc': '담벼락 사이로 저녁 냄새가 흐른다.'},
        {'id': 'shelter', 'name': '귀환자 쉼터', 'desc': '돌아온 사람들이 모여 지내는 곳. 지하에는 전등이 줄지어 달려 있다.'}]},
    'cheongam': {'name': '청암리', 'sub': '경북 산간 마을', 'spots': [
        {'id': 'gate', 'name': '마을 입구', 'desc': '장승 두 개 사이로 길이 나 있다.'},
        {'id': 'hall', 'name': '마을 회관', 'desc': '앞마당에 차일이 쳐져 있다.'},
        {'id': 'forest', 'name': '당산 숲', 'desc': '금줄이 둘러쳐진 숲.'},
        {'id': 'altar', 'name': '당산나무 아래 제단', 'desc': '가지마다 금줄이 감긴 늙은 나무.'}]},
}
HEIRLOOMS = [  # 시트의 순서 그대로(① 무당방울 … ⑩ 철퇴)
    ('무당방울', 'w-bell', '방울', 'bell', 'comprehension', '알이 없는데 운다. 누군가 부르면 대답하듯이.'),
    ('악기', 'w-instrument', '오색천', 'cloth', 'control', '오색 조임줄이 감긴 악기. 왼편과 오른편이 다른 소리를 낸다.'),
    ('부채', 'w-fan', '부채', 'fan', 'control', '펼치면 그림이 없다. 접으면 바람이 남는다.'),
    ('석장', 'w-staff', '부채', 'fan', 'comprehension', '고리 여섯 개가 각각 다른 음으로 운다.'),
    ('복숭아나무 활', 'w-bow', '거울', 'mirror', 'insight', '화살이 없다. 시위를 당기면 숨은 것이 고개를 든다.'),
    ('창', 'w-spear', '거울', 'mirror', 'insight', '세 날 사이에 손톱만 한 청동거울이 끼워져 있다.'),
    ('칼', 'w-sword', '칼', 'blade', 'aggression', '날이 서 있지 않다. 그런데도 무언가는 벤다.'),
    ('낫', 'w-sickle', '칼', 'blade', 'agility', '자루에 새끼줄 자국. 다 자란 것만 거두던 낫.'),
    ('단도', 'w-dagger', '오색천', 'cloth', 'agility', '오색 노리개 매듭이 달린 단도. 매듭 하나가 풀리지 않는다.'),
    ('철퇴', 'w-mace', '방울', 'bell', 'endurance', '쇠머리가 묵직하다. 손잡이에 감긴 무명이 반들반들하다.'),
]
p1 = scenes['P-1']['lines']
heir_choice = next(l for l in p1 if l.get('id') == 'C0-1')
assert [h[0] for h in HEIRLOOMS] == heir_choice['o'], heir_choice['o']

VOLUMES = [
    {'n': 1, 'title': '신공강림', 'hanja': '神空降臨', 'when': '2036년 3월 ~'},
    {'n': 2, 'title': '신격의 선', 'hanja': '', 'when': ''},
    {'n': 3, 'title': '마지막 신탁', 'hanja': '', 'when': ''},
]
CHAPTERS = [{'n': 0, 'vol': 1, 'title': '프롤로그', 'tutorial': 1}] + [
    {'n': n, 'vol': (1 if n <= 4 else 2 if n <= 8 else 3), 'title': t} for n, t in enumerate(
        ['불리지 않은 이름', '저 이승의 장례식', '신이 없는 사당', '신탁 오류', '관찰자의 눈', '신들의 불화', '천 개의 목소리', '인공 신과 인공 정령', '하늘 아래 같은 둘 없다', '인간이라는 오류', '천공의 아이들', '응답 없는 기도'], start=1)]

# 장을 마치면 받는 칭호(기능: 하루 첫 접속 용돈 — 앞판과 같다)
TITLES = [['st-ch0', '입소생', '본편 프롤로그를 지나 비령산 학당에 들어온 이.', 2, 6],
          ['st-ch1', '불리지 않은 이름', '본편 1장 「불리지 않은 이름」을 지나온 이.', 2, 8],
          ['st-ch2', '저 이승의 장례식', '본편 2장 「저 이승의 장례식」을 지나온 이.', 3, 10],
          ['st-ch3', '신이 없는 사당', '본편 3장 「신이 없는 사당」을 지나온 이.', 3, 12],
          ['st-ch4', '신탁 오류', '본편 4장 「신탁 오류」를 지나온 이 — 제1권 《신공강림》의 끝.', 3, 14]]

recipe_result = {l.split('|')[0]: l.split('|')[3] for l in open(os.path.join(ROOT, 'systems/biryeong/story-recipes.txt'), encoding='utf8') if l.strip() and not l.startswith('#')}
meta = {
    'version': 'v5', 'volumes': VOLUMES, 'chapters': CHAPTERS, 'regions': REGIONS,
    'foes': {k: {'tier': t, 'i': i, 'name': n, 'blurb': b} for k, (t, i, n, b) in FOES.items()},
    'heirlooms': [{'name': n, 'weapon': w, 'line': l, 'key': k, 'enh': e, 'note': note} for n, w, l, k, e, note in HEIRLOOMS],
    'heirChoice': 'C0-1', 'recipeResult': recipe_result, 'world': {},
    'choices': {},   # 선택 id → { ch, scene, q, o, vote } — 관리자 [스토리 관리]의 집계 표가 읽는다(1 · 2장 것도 여기 있다: 이름만, 대사는 장 파일에)
}
for sid in order:
    for ln in scenes[sid]['lines']:
        if ln['t'] == 'choice': meta['choices'][ln['id']] = {'ch': scenes[sid]['ch'], 'scene': scenes[sid]['title'], 'q': ln['q'], 'o': ln['o'], **({'vote': 1} if ln.get('vote') else {})}

pro = [scenes[s] for s in order if scenes[s]['ch'] == 0]
data = {**meta, 'scenes': pro}
head = ('/* 秘靈 · 비령 — 본편 데이터(프롤로그 · 권 · 장 목록). systems/story/v4/build_v4.py 가 「비령_스토리 시트_v3」에서 만든다. 직접 고치지 말 것.\n'
        ' * 1장부터는 이 파일에 없다 — story-chapters/chN.json 을 관리자 [스토리 관리]에서 올리고 공개하면 그때 모두에게 열린다. */\n')
tail = ("\n/* 본편에서 얻는 칭호(장을 마칠 때) — 기능: 하루 첫 접속 용돈 */\n(() => { const T = window.BIRYEONG_TITLES; if (!T) return; for (const [id, name, desc, tier, v] of "
        + json.dumps(TITLES, ensure_ascii=False) + ") if (!T.some((t) => t.id === id)) T.push({ id, name, desc, from: 'story', tier, perk: ['dailyMoney', v], perkText: `하루 첫 접속 때 ${v}냥` }); })();\n")
text = head + 'window.BIRYEONG_QUESTS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + tail
if re.search(r'초록동색|창록', text): sys.exit('옛 이름이 들어갔다')
open(os.path.join(ROOT, 'story-data.js'), 'w', encoding='utf8').write(text)
os.makedirs(os.path.join(ROOT, 'story-chapters'), exist_ok=True)
for ch in (1, 2, 3, 4):
    part = {'format': 'biryeong-chapter', 'version': 'v5', 'ch': ch, 'title': next(c['title'] for c in CHAPTERS if c['n'] == ch), 'scenes': [scenes[s] for s in order if scenes[s]['ch'] == ch]}
    open(os.path.join(ROOT, 'story-chapters', f'ch{ch}.json'), 'w', encoding='utf8').write(json.dumps(part, ensure_ascii=False, indent=1))
print('장면', {c: [s for s in order if scenes[s]['ch'] == c] for c in (0, 1, 2, 3, 4)})
print('줄', sum(len(scenes[s]['lines']) for s in order), '단계', sum(len(scenes[s]['steps']) for s in order), '선택', len(meta['choices']))
