# -*- coding: utf-8 -*-
"""스토리 원고 → 게임 데이터(story-data.js).   python3 export_game.py <biryeong 폴더>
장면 스크립트(script_vol*.txt) · 장면 퀘스트(quests_vol*.txt)를 읽어, quest.js 가 그대로 돌릴 수 있는 형태로 바꾼다.
조건 · 효과 글귀를 기계가 읽는 꼴로 바꾸지 못하면 멈춘다(원고를 고치면 된다)."""
import json, re, sys
from parse import parse
from quests import parse_quests
from chapters import CHAPTERS, VOLUMES
from design import VARIABLES

scenes, lines, e = parse(['script_vol1.txt', 'script_vol2.txt', 'script_vol3.txt'])
quests, line_step, e2 = parse_quests(['quests_vol1.txt', 'quests_vol2.txt', 'quests_vol3.txt'], scenes, lines)
if e or e2: sys.exit('\n'.join(e + e2))
CIRC = '①②③④⑤⑥⑦⑧⑨⑩'
# 유품 10종 = 무구 10종. 둘씩 다섯 계통(방울 · 부채 · 거울 · 칼 · 오색천). B1-1 의 고른 번호(1~10)로 적는다.
HEIR = ['방울', '징채', '부채', '석장', '활', '삼지창', '신칼', '낫', '은장도', '장구']
LINEAGE = {'방울 계통': [1, 2], '부채 계통': [3, 4], '거울 계통': [5, 6], '칼 계통': [7, 8], '오색천 계통': [9, 10]}
FLAGVAL = {'P_이름읽기=예': ('B1-2', 1), 'P_이름읽기=아니오': ('B1-2', 2), 'P_귀환자=보호': ('B2-1', 2), '부모': ('B8-1', 1), '복제': ('B8-1', 2), '유보': ('B8-1', 3), '묻는다': ('B14-2', 1), '청암리 상태': ('B3-1', 3)}
LABELS = {'공통', '방어 성공', '명명 결속 튜토리얼', '보스전', '레이드', '보스(설득)', '방어전 보스', '최종 거점 방어', '다중 진영 결전', '최종 결전', '서창현 동행', '산신 승', '자동'}
SCENE_PICK = {'13-04': 'B13-1'}  # 이 장면의 ①②… 는 앞 장면에서 고른 분기를 가리킨다

def cond_of(text, sid):
    out = []
    for tok in [t.strip() for t in text.split('·') if t.strip()]:
        if all(ch in CIRC for ch in tok):
            picks = [CIRC.index(ch) + 1 for ch in tok]
            out.append({'flag': SCENE_PICK[sid], 'in': picks} if sid in SCENE_PICK else {'pick': picks})
        elif tok.startswith('P_매개체='): out.append({'flag': 'B1-1', 'in': [HEIR.index(tok.split('=')[1]) + 1]})
        elif tok in HEIR: out.append({'flag': 'B1-1', 'in': [HEIR.index(tok) + 1]})
        elif tok in LINEAGE: out.append({'flag': 'B1-1', 'in': LINEAGE[tok]})
        elif tok in FLAGVAL: out.append({'flag': FLAGVAL[tok][0], 'in': [FLAGVAL[tok][1]]})
        elif tok.startswith('P_비령답'): out.append({'flag': 'B10-1', 'in': [CIRC.index(tok[-1]) + 1]})
        elif tok == '△△ 있음': out.append({'god': True})
        elif tok == '△△ 없음': out.append({'god': False})
        elif tok == '선택형 승리': out.append({'calm': True})
        elif tok == '용왕 패': out.append({'flag': 'B7-1', 'in': [2]}); return out  # '용왕 패 · ②' = 용왕과 계약했고 용왕이 졌다
        elif m := re.match(r'신뢰_(\S+?)≥(\d+)', tok): out.append({'trust': m[1], 'min': int(m[2])})
        elif tok in LABELS or re.fullmatch(r'\d+장 완료', tok): pass
        else: sys.exit(f'모르는 조건 "{tok}" ({sid}: {text})')
    return out

EFF = re.compile(r'(W_[가-힣]+|신뢰_[가-힣△]+|정신오염) ?([+−-]\d+)')
def effects(res):
    return [[k, int(v.replace('−', '-'))] for k, v in EFF.findall(res)]
def choice_effects(res, n):
    per = [[] for _ in range(n)]
    if not any(c in res for c in CIRC): return per
    m = re.match(r'(신뢰_[가-힣△]+) (?=[①-⑩])', res)
    parts = re.split(r'([①-⑩])', res)
    for i in range(1, len(parts), 2):
        idx = CIRC.index(parts[i]); seg = parts[i + 1]
        if idx >= n: continue
        if m:
            mm = re.match(r'\s*([+−-]\d+)', seg)
            if mm: per[idx].append([m[1], int(mm[1].replace('−', '-'))])
        else:
            per[idx] += [[k, int(v.replace('−', '-'))] for k, v in re.findall(r'(W_[가-힣]+|신뢰_[가-힣△]+) ?([+−-]\d+)', seg)]
    return per

def line_out(l, sid):
    t, text = l['type'], l['text']
    if t == '선택' and any(c in text for c in CIRC):
        first = min(text.index(c) for c in CIRC if c in text)
        prompt = re.sub(r'\s*[—:]\s*$', '', text[:first]).strip()
        prompt = re.sub(r'^\([^)]*\)\s*', '', prompt)
        opts = [o.strip() for o in re.split(r'[①-⑩]', text[first:])[1:]]
        cid = l['cond'].replace(' 선택', '').replace('△△ 재기회', '7-03')
        show = [{'god': False}] if '재기회' in l['cond'] else []
        return {'t': 'choice', 'id': cid, 'q': prompt or '어떻게 할까.', 'o': opts, 'e': choice_effects(l['res'], len(opts)), **({'c': show} if show else {})}
    c = cond_of(l['cond'], sid) if t != '선택' else []
    text2 = re.sub(r'^\((?:[①-⑩]+|△△ 있음|△△ 없음|P_[^)]*|묻는다|동행 시|서버[^)]*|신살[^)]*|전투 후|행동 반영|선택|자비형|복수형|공포형|회상|통신|[①-⑩] [^)]*)\)\s*', '', text) if l['cond'] or text.startswith('(') else text
    kind = {'지문': 'n', '대사': 'd', '비령': 'b', '회상': 'r', '조사': 'i', '전투': 's', '퀘스트': 's', '선택': 'd', '독백': 'd', '시스템': 's'}[t]
    o = {'t': kind, 'x': text2}
    if l['who'] and l['who'] != '—': o['w'] = l['who']
    if l['direc']: o['d'] = l['direc']
    if c: o['c'] = c
    ef = effects(l['res'])
    if ef: o['e'] = ef
    return o

# ─────────────── 장소 ───────────────
# 바깥 지역 · 새 층: 지역 → [(지점 id, 이름, 설명, 찾는 말…)]  (위에서부터 먼저 맞는 것)
REGIONS = {
    'seoul': ('서울', '산문 밖 · 도시', [
        ('house', '다세대 주택 3층', '참기름 냄새가 나는 집. 벽에는 가족사진이 걸려 있다.', ['다세대']),
        ('shelter', '귀환자 쉼터', '돌아온 사람들이 모여 지내는 곳. 지하에는 전등이 줄지어 달려 있다.', ['쉼터', '격리']),
        ('observatory', '관측동', '천장마다 눈이 달린 건물. 눈은 지나갈 사람이 있을 자리를 본다.', ['관측동']),
        ('bank', '은행 지점', '3번 창구와 4번 창구.', ['은행']),
        ('clinic', '폐산부인과', '녹슨 요람마다 흙이 조금씩 담겨 있다.', ['산부인과']),
        ('alley', '골목', '담벼락 사이로 저녁 냄새가 흐른다.', ['골목']),
    ]),
    'cheongam': ('청암리', '경북 산간 마을', [
        ('gate', '마을 입구', '장승 두 개 사이로 길이 나 있다.', ['마을 입구']),
        ('altar', '당산나무 아래 제단', '가지마다 금줄이 감긴 늙은 나무.', ['당산나무', '제단']),
        ('forest', '당산 숲', '금줄이 둘러쳐진 숲.', ['당산 숲']),
        ('slope', '산비탈', '마을을 내려다보는 비탈.', ['산비탈']),
        ('hall', '마을 회관', '앞마당에 차일이 쳐져 있다.', ['회관', '청암리']),
    ]),
    'mulchi': ('물치항', '동해안', [
        ('sea', '해변', '파도 속에 거대한 형체가 일렁인다.', ['해변']),
        ('clan', '종가', '지방(紙榜)이 떨리는 오래된 집.', ['종가']),
        ('underworld', '명부 앞', '검은 갓을 쓴 이가 명부를 들고 서 있다.', ['명부']),
        ('clash', '바다와 산이 만나는 곳', '비와 흙이 한자리에서 부딪친다.', ['만나는 곳']),
        ('mountain', '산신각', '소나무 사이의 작은 당집.', ['산신각']),
        ('port', '항구', '물에 잠긴 방파제.', ['항구', '물치항']),
    ]),
    'beyond': ('관측 밖', '지도에 없는 곳', [
        ('gagok', '가곡면', '버스가 사흘째 오지 않는 마을.', ['가곡면']),
        ('outpost', '전초기지', '캠핑장에서 이어지는 문. 말뚝과 등롱.', ['전초기지']),
        ('path', '색이 빠진 길', '소리가 반 박자 늦게 들린다.', ['관측 밖']),
    ]),
    'lab': ('거대한 문 너머', '본관 지하 2~3층', [
        ('records', '연구 기록실', '기록 C-0417.', ['기록실']),
        ('center', '연구 구역 중앙', '기둥들이 한꺼번에 우는 자리.', ['중앙']),
        ('own', '목소리 기둥', '이름표가 붙은 기둥들.', ['개인 기둥', '아버지의 기둥', '이름 없는 기둥']),
        ('core', '비령의 자리', '그물 한가운데의 빈 곳.', ['비령의 자리']),
        ('lab', '실험실', '벽 전체가 기록이다.', ['실험실']),
        ('net', '빛의 그물', '매듭마다 사람이 하나씩 앉아 있다.', ['그물', '지하 3층', '2~3층']),
        ('pillars', '기둥 숲', '수천 개의 목소리가 바람 소리처럼 겹친다.', ['지하 2층']),
    ]),
    'boundary': ('경계', '사당 아래', [
        ('parents', '부모들의 자리', '눈을 뜬 사람들.', ['부모들', '아버지의 자리', '이름 없는 자리']),
        ('center', '경계 중심', '다섯 매개체가 놓일 자리.', ['중심']),
        ('gap', '간격', '"부디"와 "그래" 사이.', ['경계']),
    ]),
}
REGION_KEYS = [('boundary', ['경계']), ('lab', ['지하 2층', '지하 3층', '2~3층']), ('seoul', ['서울']), ('cheongam', ['청암리']), ('mulchi', ['물치항']), ('beyond', ['관측 밖', '가곡면', '전초기지'])]
def where_of(place):
    for reg, keys in REGION_KEYS:
        if any(k in place for k in keys) and not ('산문 너머 › 지워진' in place):
            for sid, name, desc, pats in REGIONS[reg][2]:
                if any(p in place for p in pats): return f'out:{reg}/{sid}'
            sys.exit('지점을 못 찾음: ' + place)
    rules = [('오른쪽 상태 창', 'any'), ('오방', 'home'), ('각지', 'north'), ('산문', 'north'), ('수업', 'mainHall/class'), ('본관 › 둘러보기', 'mainHall'),
             ('급식실', 'dorm/cafeteria'), ('매점', 'dorm/store'), ('내 기숙사', 'dorm/my-room'), ('생활관', 'dorm'), ('기숙사', 'dorm'), ('302호', 'dorm'),
             ('퇴마 실습', 'gym/battle'), ('개척', 'gym/pioneer'), ('별관', 'annex/explore'), ('조리실', 'annex/explore'),
             ('본관', 'mainHall/explore'), ('감찰실', 'mainHall/explore'), ('실험실', 'out:lab/lab'),
             ('금역', 'gym/hike'), ('뒷산', 'gym/hike'), ('사찰', 'gym/hike'), ('캠핑장', 'gym/hike'), ('무구보관소', 'gym/hike'), ('텃밭', 'gym/hike'), ('왼길', 'gym/hike'), ('오른길', 'gym/hike'), ('중앙길', 'gym/hike'),
             ('사당', 'shrine')]
    for k, v in rules:
        if k in place: return v
    sys.exit('장소를 못 읽음: ' + place)

V = lambda k: f'visit:{k}'
# 단계별 판정(손으로 정한 것). 없으면: 대사가 있는 단계 = 그 자리에 도착하면 진행 / 대사 없는 조사 · 아이템 단계 = 그 자리에서 [행동] 단추
#   need: visit:<탐사 지점> · spot:<바깥 지점> · win · gather×n · site:<개척 터> · craft · cook · lesson:<과목> · zone:<구역> · flag:shrineSign
#         battle:<상대>[×n][|calm] · maze:<규칙> · act[×n] · wait
#         v1.3 — make:<아이템>(그것을 직접 만들기) · have:<아이템>[*k](지니고 그 자리에 가기) · use:<아이템>[*k][×n](그 자리에서 써서 없애기)
#                equip:heir(받은 유품 무구를 장착) · enhance(무구 강화)
#   cond: 이 단계를 하는 조건(분기).  where: 장소를 바꿔 적을 때.  same: 앞 단계와 같은 자리에서 이어서.
#   v1.3 — give: 단계를 마치면 받는 아이템 {id: 개수}  learn: 이 단계가 열릴 때 배우는 본편 제작법 [id]  kit: 그때 함께 받는 재료 {id: 개수}
#          heir: 이 단계를 마치면 고른 유품의 무구를 실제로 받는다  alt: 앞 선택에 따라 need 를 바꾼다 {선택 id: {번호: [need]}}
O = {
 '1-03.2': dict(need=[V('mainHall:f1:lobby')]), '1-03.4': dict(same=True), '1-03.5': dict(need=[V('gym:left:armory')], heir=True), '1-03.6': dict(need=['equip:heir'], same=True),
 '1-04.1': dict(need=['wait']), '1-05.1': dict(need=['wait']), '1-05.2': dict(need=['act'], keep='302호의 방울', give={'st-bell302': 1}),
 '1-06.1': dict(need=['act']), '1-07.1': dict(need=['have:st-bell302']), '1-07.2': dict(need=[V('mainHall:f2:staff')]), '1-07.3': dict(need=[V('mainHall:f2:nurse')]), '1-07.4': dict(need=[V('mainHall:b1:archiveB')]),
 '1-08.1': dict(need=['win']), '1-08.2': dict(need=['wait']), '1-08.3': dict(need=[V('mainHall:f2:staff')]), '1-08.4': dict(need=['battle:myeongbugwi']), '1-09.2': dict(same=True),
 '2-02.1': dict(need=[V('mainHall:f2:staff')]), '2-02.2': dict(give={'st-pass': 1}), '2-03.3': dict(need=['act'], keep='흐린 영정 조각', give={'st-portrait': 1}), '2-04.1': dict(need=['act×3']), '2-05.2': dict(need=['battle:heard|calm']),
 '2-06.3': dict(need=['craft'], cond=[{'flag': 'B2-1', 'in': [1, 2]}], alt={'B2-1': {1: ['make:mugwort-incense'], 2: ['make:bandage']}}),
 '3-03.2': dict(need=['act']), '3-03.3': dict(need=['gather×3'], where='gym/pioneer'), '3-03.4': dict(need=['make:small-altar', 'make:jaeaek-charm']), '3-04.1': dict(need=['use:small-altar', 'use:jaeaek-charm']),
 '3-05.1': dict(need=['battle:effigy×3'], cond=[{'flag': 'B3-1', 'in': [1]}]), '3-05.2': dict(need=['lesson:ward-tetris×2'], cond=[{'flag': 'B3-1', 'in': [2]}]), '3-05.3': dict(need=['battle:dangsan'], cond=[{'flag': 'B3-1', 'in': [3]}]),
 '3-06.1': dict(need=['use:st-stake*4×3'], cond=[{'flag': 'B3-1', 'in': [3]}], learn=['s-stake'], kit={'fine-woodchip': 9, 'twine': 3, 'hanji': 3}),
 '4-01.1': dict(need=['wait']), '4-01.3': dict(same=True), '4-02.1': dict(need=[V('gym:center:climb:temple')]), '4-02.3': dict(need=['act'], keep='기도 쪽지 묶음', give={'st-prayers': 1}), '4-03.1': dict(need=['maze:real']),
 '4-04.1': dict(need=['act']), '4-05.1': dict(need=['battle:waiting']), '4-06.1': dict(cond=[{'god': True}]), '4-06.2': dict(same=True, cond=[{'god': True}], keep='귤', give={'st-tangerine': 2}),
 '5-01.1': dict(need=['wait']), '5-02.2': dict(need=[V('mainHall:f1:lobby'), V('annex:f1:auditorium')]), '5-04.2': dict(need=[V('mainHall:b1:escape')]),
 '5-05.1': dict(need=['battle:echo×3'], where='mainHall'), '5-05.2': dict(need=['battle:error'], where='dorm'), '5-06.1': dict(need=[V('mainHall:f2:nurse')]),
 '6-01.1': dict(), '6-02.2': dict(need=[V('mainHall:f1:lobby')]), '6-03.1': dict(need=[V('mainHall:roof:door')]), '6-03.4': dict(need=['make:st-envelope'], cond=[{'flag': 'B6-1', 'in': [2, 3]}], learn=['s-envelope'], kit={'hanji': 3, 'cinnabar': 1}),
 '6-04.2': dict(need=['maze:norepeat']), '6-04.3': dict(need=['battle:baekmok']), '6-06.1': dict(need=['battle:guard×2'], where='out:seoul/observatory'),
 '7-01.3': dict(need=['act×3'], mp=10), '7-02.1': dict(need=['spot:mulchi/sea', 'spot:mulchi/mountain', 'spot:mulchi/clan', 'spot:mulchi/underworld'], where='out:mulchi/mountain'),
 '7-03.2': dict(same=True), '7-04.2': dict(same=True, where='out:mulchi/mountain'), '7-05.1': dict(need=['battle:ssang'], server='B7-2'), '7-06.1': dict(need=['site:left-trail-3|left-trail-4']), '7-06.2': dict(where='out:mulchi/port'),
 '8-01.1': dict(need=[V('mainHall:b1:archiveB')]), '8-01.3': dict(need=[V('mainHall:b1:handle')]), '8-02.3': dict(need=['act']), '8-06.1': dict(need=['battle:cheonseong']), '8-06.2': dict(same=True),
 '8-07.1': dict(need=[V('annex:f2:cook')]), '8-07.2': dict(need=['make:st-seaweed-soup'], keep='미역국 끓이는 법', learn=['s-seaweed-soup'], kit={'st-seaweed': 2, 'soybean-oil': 1, 'lake-water': 1}),
 '9-01.2': dict(need=['act×2']), '9-02.1': dict(need=['maze:norepeat'], where='out:seoul/alley'), '9-02.3': dict(need=['act×3'], taint=-10),
 '9-03.1': dict(need=[V('mainHall:f2:staff')]), '9-04.1': dict(need=['make:st-seaweed-soup'], kit={'st-seaweed': 2}), '9-04.3': dict(same=True), '9-05.1': dict(need=[V('mainHall:f2:staff')]),
 '9-06.4': dict(need=['battle:wave×3']), '9-07.1': dict(need=[V('annex:roof:plaza')]),
 '10-02.1': dict(need=[V('mainHall:b1:escape')]), '10-03.2': dict(need=['act']), '10-03.3': dict(need=['battle:collision']),
 '11-01.1': dict(need=[V('mainHall:f2:staff')]), '11-01.3': dict(need=['act'], server='erased-map'), '11-02.1': dict(need=[V('gym:center:climb:mysteryStorage')], where='gym/hike'),
 '11-03.2': dict(same=True, keep='가곡면 감자', give={'st-potato': 3}), '11-04.1': dict(need=[V('gym:right:campsite')]), '11-04.4': dict(need=['make:st-pillar'], learn=['s-pillar'], kit={'brick': 3}), '11-05.1': dict(need=['battle:eraser×3'], where='out:beyond/outpost'),
 '12-01.1': dict(need=[V('annex:f1:auditorium')]), '12-02.1': dict(need=[V('gym:left:armory')]), '12-02.4': dict(skip=True), '12-03.1': dict(need=[V('gym:center:climb:temple')]),
 '12-04.1': dict(need=[V('gym:left:garden')]), '12-04.3': dict(cond=[{'flag': 'B3-1', 'in': [3]}], where='out:cheongam/hall'), '12-05.1': dict(need=['battle:raid'], server='B12-1'),
 '13-02.1': dict(need=['act']), '13-03.1': dict(skip=True),
 '13-04.1': dict(need=['lesson:ward-tetris'], cond=[{'flag': 'B13-1', 'in': [1]}]), '13-04.2': dict(need=['make:five-knot'], cond=[{'flag': 'B13-1', 'in': [2]}]),
 '13-04.3': dict(need=[V('annex:roof:garden')], cond=[{'flag': 'B13-1', 'in': [3]}]), '13-04.4': dict(need=['site:left-cave'], cond=[{'flag': 'B13-1', 'in': [4]}]),
 '13-05.1': dict(need=['wait']), '13-05.2': dict(need=[V('gym:center:climb:temple')]),
 '14-01.1': dict(need=['flag:shrineSign']), '14-01.2': dict(need=[V('shrine:sealHall:oldDoor')]), '14-02.3': dict(need=['battle:unrealized']),
 '14-07.1': dict(need=[V('mainHall:f2:staff')]), '14-08.1': dict(need=['cook']), '14-08.2': dict(same=True, need=['use:st-seaweed-soup', 'use:st-tangerine', 'use:bag-snack']), '14-08.3': dict(need=[V('gym:left:armory')]),
 '15-A.1': dict(where='any'), '15-B.1': dict(where='any'), '15-C.1': dict(where='any'), '15-D.1': dict(where='any'), '15-E.1': dict(where='any'),
 '15-02.3': dict(need=['zone:north', 'zone:east', 'zone:west', 'zone:south', 'zone:center'], server='final'), '15-03.2': dict(need=['battle:final']),
}
WAIT_LABEL = {'1-04.1': '점호 시간까지 기다린다', '1-05.1': '잠자리에 든다 — 아침', '1-08.2': '자정까지 기다린다', '4-01.1': '잠든다', '5-01.1': '22시까지 기다린다', '13-05.1': '자정까지 기다린다'}
QUEST_COND = {'13-05': [{'god': True}], '15-A': [{'ending': 'A'}], '15-B': [{'ending': 'B'}], '15-C': [{'ending': 'C'}], '15-D': [{'ending': 'D'}], '15-E': [{'ending': 'E'}]}

# 이야기 전투의 상대: 추가전투 도감의 같은 단계 혼자 상대(solo)를 바탕으로 이름 · 소개만 바꾼다. (단계, 몇 번째 solo, 이름, 소개)
FOES = {
 'myeongbugwi': (1, 2, '명부귀', '부르지 않은 이름을 먹는 출석부의 괴이.'), 'heard': (1, 1, '죽음을 들은 자', '자신이 죽었다는 것을 방금 들었다.'),
 'effigy': (1, 0, '액막이 인형', '의식을 지키는 짚 인형.'), 'dangsan': (2, 2, '당산신', '마을의 불행을 가져가던 늙은 신.'), 'waiting': (2, 1, '기다리는 것', '기다리다가 신이 되어 버린 마음.'),
 'echo': (2, 0, '관측 잔향체', '예측이 남긴 찌꺼기.'), 'error': (3, 2, '오류', '23시 17분을 지키려는 예측 그 자체.'), 'baekmok': (3, 1, '백목', '백 개의 눈을 가진 관측동 방위 체계.'),
 'guard': (3, 0, '관측견', '관측동의 보안 드론.'), 'ssang': (4, 2, '쌍응수', '두 신의 응답이 한 몸에 엉긴 짐승.'), 'cheonseong': (4, 1, '천의 목소리', '수천 명의 부모 목소리가 한 몸이 된 것.'),
 'wave': (4, 0, '격리 드론', '격리 부대의 선봉.'), 'collision': (5, 2, '충돌 신탁', '양립할 수 없는 두 신탁이 부딪쳐 생긴 형상.'), 'eraser': (6, 1, '지우개', '지도를 지우는 안개의 앞머리.'),
 'raid': (7, 2, '명소의 밤', '이름을 끊는 기계와 성난 신 사이.'), 'unrealized': (7, 1, '실현되지 못한 것들', '경계에 묶인 신탁들의 덩어리.'), 'final': (8, 2, '최종 신탁', '수천 개의 기도와 수천 개의 대답이 묶인 매듭.'),
}
# 유품 10종: (이름, 무구 id, 계통, 계통 키, 무구에 덧붙는 부모의 손길(강화 1), 한 줄)
HEIRLOOMS = [
 ('방울', 'w-bell', '방울', 'bell', 'comprehension', '알이 없는데 운다. 누군가 부르면 대답하듯이.'),
 ('징채', 'w-mace', '방울', 'bell', 'endurance', '징을 치던 채. 손잡이에 감긴 무명이 반들반들하다.'),
 ('부채', 'w-fan', '부채', 'fan', 'control', '펼치면 그림이 없다. 접으면 바람이 남는다.'),
 ('석장', 'w-staff', '부채', 'fan', 'comprehension', '고리 여섯 개가 각각 다른 음으로 운다.'),
 ('복숭아나무 활', 'w-bow', '거울', 'mirror', 'insight', '화살이 없다. 시위를 당기면 숨은 것이 고개를 든다.'),
 ('삼지창', 'w-spear', '거울', 'mirror', 'insight', '세 날 사이에 손톱만 한 청동거울이 끼워져 있다.'),
 ('신칼', 'w-sword', '칼', 'blade', 'aggression', '날이 서 있지 않다. 그런데도 무언가는 벤다.'),
 ('낫', 'w-sickle', '칼', 'blade', 'agility', '자루에 새끼줄 자국. 다 자란 것만 거두던 낫.'),
 ('은장도', 'w-dagger', '오색천', 'cloth', 'agility', '오색 노리개 매듭이 달린 은장도. 매듭 하나가 풀리지 않는다.'),
 ('장구', 'w-instrument', '오색천', 'cloth', 'control', '오색 조임줄이 감긴 장구. 왼편과 오른편이 다른 소리를 낸다.'),
]
assert [h[0] for h in HEIRLOOMS][:2] == ['방울', '징채'] and len(HEIRLOOMS) == len(HEIR) and all(HEIR[i] in HEIRLOOMS[i][0] for i in range(10))
FOE_FORM = {'raid': 'B12-1', 'final': 'B15-1'}  # 이 상대의 모습은 앞에서 고른 진영에 따라 달라진다
out_scenes = []
spots_used = {}
GAME = {}
for sc in scenes:
    q = quests[sc['id']]
    own = [l for l in lines if l['scene'] is sc]
    steps = []; prev_where = None
    for st in q['steps']:
        key = f"{sc['id']}.{st['no']}"; o = dict(O.get(key, {}))
        if o.get('skip') and not st.get('lines'): continue
        where = o.get('where') or where_of(st['place'])
        if o.get('same') and prev_where: where = prev_where
        need = list(o.get('need', []))
        if key not in O and not st.get('lines') and st['type'] in ('조사', '아이템', '탐사'): need = ['act']
        need = [('act:' + WAIT_LABEL[key]) if n == 'wait' else n for n in need]
        for n in need:
            if n.startswith('battle:') and n[7:].split('×')[0].split('|')[0] not in FOES: sys.exit('없는 상대 ' + n)
        s = {'k': st['type'], 'p': st['place'], 'a': st['act'], 'w': where}
        if need: s['n'] = need
        for a, b in (('cond', 'c'), ('keep', 'keep'), ('mp', 'mp'), ('taint', 'taint'), ('server', 'sv'), ('give', 'give'), ('learn', 'learn'), ('kit', 'kit'), ('alt', 'alt')):
            if o.get(a) is not None: s[b] = o[a]
        ls = st.get('lines', [])
        if o.get('heir'): s['heir'] = 1
        if ls: s['l'] = [own.index(ls[0]), own.index(ls[-1]) + 1]
        steps.append(s); prev_where = where; GAME[key] = {'w': where, 'n': need, 'c': bool(o.get('cond')), **{k2: o[k2] for k2 in ('give', 'learn', 'kit', 'heir', 'alt') if o.get(k2)}}
        if where.startswith('out:'): spots_used.setdefault(where[4:], sc['id'])
        for n in need:
            if n.startswith('spot:'): spots_used.setdefault(n[5:], sc['id'])
    item = {'id': sc['id'], 'ch': sc['ch'], 'vol': sc['vol'], 'title': sc['title'], 'place': sc['place'], 'time': sc['time'], 'post': q['post'], 'reward': q['reward'],
            'lines': [line_out(l, sc['id']) for l in own], 'steps': steps}
    if sc['id'] in QUEST_COND: item['c'] = QUEST_COND[sc['id']]
    out_scenes.append(item)

regions = {}
for reg, (name, sub, spots) in REGIONS.items():
    regions[reg] = {'name': name, 'sub': sub, 'spots': [{'id': s, 'name': n, 'desc': d} for s, n, d, _ in spots if f'{reg}/{s}' in spots_used]}
    missing = [s for s, *_ in spots if f'{reg}/{s}' not in spots_used]
    if missing: print('안 쓰는 지점', reg, missing)
world = {v[0]: int(re.search(r'시작 (\d+)', v[2])[1]) if '시작' in v[2] else 0 for v in VARIABLES if v[0].startswith('W_')}
data = {
    'volumes': [{'n': int(v[0]), 'title': v[1], 'when': v[3], 'q': v[4]} for v in VOLUMES],
    'chapters': [{'n': int(c[1]), 'vol': int(c[0]), 'title': c[2], 'when': c[3], 'tag': c[4]} for c in CHAPTERS],
    'scenes': out_scenes, 'regions': regions, 'foes': {k: {'tier': t, 'i': i, 'name': n, 'blurb': b, **({'form': FOE_FORM[k]} if k in FOE_FORM else {})} for k, (t, i, n, b) in FOES.items()}, 'world': world,
    'recipeResult': {l.split('|')[0]: l.split('|')[3] for l in open(f"{sys.argv[1] if len(sys.argv) > 1 else '.'}/systems/biryeong/story-recipes.txt", encoding='utf8') if l.strip() and not l.startswith('#')},
    'heirlooms': [{'name': n, 'weapon': w, 'line': l, 'key': k, 'enh': e, 'note': note} for n, w, l, k, e, note in HEIRLOOMS],
}
root = sys.argv[1] if len(sys.argv) > 1 else '.'
head = '/* 秘靈 · 비령 — 본편 스토리 데이터(3권 15장 · 장면 퀘스트 97개). 직접 고치지 말 것.\n * 원고: 스토리 원고 폴더의 script_vol*.txt(대사) · quests_vol*.txt(퀘스트 단계) → export_game.py 가 만든다. 돌리는 쪽: quest.js\n */\n'
titles = []
for sc in out_scenes:
    m = re.search(r'칭호 「([^」]+)」', sc['reward'])
    if m: titles.append([f"st-{sc['id']}", m[1], f"본편 {sc['ch']}장 「{sc['title']}」을(를) 지나온 이.", min(5, sc['vol'] + 1 + (1 if '엔딩' in sc['reward'] else 0)), 4 + sc['ch'] * 2])
tail = "\n/* 본편에서 얻는 칭호(장을 마칠 때 · 엔딩) — 기능: 하루 첫 접속 용돈 */\n(() => { const T = window.BIRYEONG_TITLES; if (!T) return; for (const [id, name, desc, tier, v] of " + json.dumps(titles, ensure_ascii=False) + ") T.push({ id, name, desc, from: 'story', tier, perk: { type: 'dailyMoney', v }, perkText: `하루 첫 접속 때 ${v}냥` }); })();\n"
open(f'{root}/story-data.js', 'w', encoding='utf8').write(head + 'window.BIRYEONG_QUESTS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + tail)
print('칭호', len(titles), [t[1] for t in titles])
json.dump(GAME, open('game_steps.json', 'w', encoding='utf8'), ensure_ascii=False)
print('장면', len(out_scenes), '단계', sum(len(s['steps']) for s in out_scenes), '줄', sum(len(s['lines']) for s in out_scenes), '선택', sum(1 for s in out_scenes for l in s['lines'] if l['t'] == 'choice'))
import collections; print(collections.Counter(st['w'].split('/')[0].split(':')[0] for s in out_scenes for st in s['steps']))
