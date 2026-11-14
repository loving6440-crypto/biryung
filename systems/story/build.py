# -*- coding: utf-8 -*-
"""비령 장편 스토리 → 엑셀.   python3 build.py out.xlsx"""
import re, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from design import *
from chapters import VOLUMES, CHAPTERS, BRANCHES, CONTENT
from parse import parse
from quests import parse_quests, STATUS_RANK
from impl import STATUS_INFO, TRIGGERS, NEW_TAGS, SANMUN

OUT = sys.argv[1] if len(sys.argv) > 1 else 'biryeong_story.xlsx'
scenes, lines, errs = parse(['script_vol1.txt', 'script_vol2.txt', 'script_vol3.txt'])
if errs: sys.exit('\n'.join(errs))
quests, line_step, qerrs = parse_quests(['quests_vol1.txt', 'quests_vol2.txt', 'quests_vol3.txt'], scenes, lines)
if qerrs: sys.exit('\n'.join(qerrs))
for q in quests.values():
    for st in q['steps']:
        for t in st['new']:
            if t.split(':')[0] not in NEW_TAGS: sys.exit(f'설명 없는 신규 태그 {t} ({q["id"]})')

# ── 교차 확인: 스크립트에 나온 분기 ID 는 분기표에 있어야 하고, 분기표의 분기는 스크립트 어딘가에 나와야 한다 ──
branch_ids = [b[0] for b in BRANCHES]
used = set()
for l in lines:
    for m in re.findall(r'B\d+-\d', l['cond'] + ' ' + l['res']): used.add(m)
missing = sorted(used - set(branch_ids)); unused = [b for b in branch_ids if b not in used]
if missing: sys.exit(f'분기표에 없는 분기: {missing}')
if unused: sys.exit(f'스크립트에 안 나오는 분기: {unused}')

FONT = 'Arial'
NAVY = '1B2A44'
HEAD = PatternFill('solid', fgColor=NAVY)
thin = Side(style='thin', color='C9CEDA'); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
FILL = lambda c: PatternFill('solid', fgColor=c)
VOL_FILL = {1: FILL('E4EEF8'), 2: FILL('F3E6EC'), 3: FILL('EFEADB')}
TYPE_FILL = {'장면': FILL('2F3E5C'), '비령': FILL('E6F1F2'), '선택': FILL('FFF2CC'), '전투': FILL('F8DEDC'), '조사': FILL('E7F0DF'),
             '회상': FILL('EEE8F5'), '퀘스트': FILL('E7F0DF'), '지문': FILL('F6F6F6')}
SPEAKER_FONT = SPEAKER_COLORS
wb = Workbook()

def table(title, headers, widths, rows, freeze='A2', center=(), wrap=True, height=None, row_style=None):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
        cell = ws.cell(row=1, column=c)
        cell.font = Font(name=FONT, bold=True, color='FFFFFF', size=10); cell.fill = HEAD; cell.border = BORDER
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.row_dimensions[1].height = 26
    for r, row in enumerate(rows, 2):
        ws.append(list(row))
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.font = Font(name=FONT, size=10); cell.border = BORDER
            cell.alignment = Alignment(vertical='top', wrap_text=wrap, horizontal='center' if c in center else 'left')
        if row_style: row_style(ws, r, row)
        if height: ws.row_dimensions[r].height = height
    ws.freeze_panes = freeze
    ws.auto_filter.ref = f'A1:{get_column_letter(len(headers))}{len(rows) + 1}'
    return ws

# ─────────────── 장면 스크립트 ───────────────
script_rows = []
n = 0
for sc in scenes:
    script_rows.append((None, sc['vol'], sc['ch'], sc['id'], sc['title'], sc['place'], sc['time'], '장면', '', f'▣ {sc["title"]}', '', '', '', sc['link'], f'Q{sc["id"]}'))
    for l in (x for x in lines if x['scene'] is sc):
        n += 1
        st = line_step[id(l)]; l['n'] = n
        script_rows.append((n, sc['vol'], sc['ch'], sc['id'], sc['title'], sc['place'], sc['time'], l['type'], l['who'], l['text'], l['direc'], l['cond'], l['res'], '', f'Q{sc["id"]}-{st["no"]}'))

def script_style(ws, r, row):
    t, who = row[7], row[8]
    if t == '장면':
        for c in range(1, 16):
            cell = ws.cell(row=r, column=c); cell.fill = TYPE_FILL['장면']; cell.font = Font(name=FONT, size=10, bold=True, color='FFFFFF')
        ws.row_dimensions[r].height = 20
        return
    for c in (2, 3): ws.cell(row=r, column=c).fill = VOL_FILL[row[1]]
    if t in TYPE_FILL: ws.cell(row=r, column=8).fill = TYPE_FILL[t]; ws.cell(row=r, column=10).fill = TYPE_FILL[t]
    if who in SPEAKER_FONT: ws.cell(row=r, column=9).font = Font(name=FONT, size=10, bold=True, color=SPEAKER_FONT[who])
    if t in ('대사', '비령', '회상'): ws.cell(row=r, column=10).font = Font(name=FONT, size=10, color=SPEAKER_FONT.get(who, '000000'))
    if t == '지문': ws.cell(row=r, column=10).font = Font(name=FONT, size=10, italic=True, color='555555')
    if t == '선택': ws.cell(row=r, column=10).font = Font(name=FONT, size=10, bold=True)

# ─────────────── 시트 만들기 ───────────────
ws0 = wb['Sheet']; ws0.title = '개요'

ws_char = wb.create_sheet('인물')
ws_char.column_dimensions['A'].width = 16
heads = ['항목', *CHAR_KEYS]
ws_char.append(heads)
for c, h in enumerate(heads, 1):
    cell = ws_char.cell(row=1, column=c); cell.font = Font(name=FONT, bold=True, color='FFFFFF', size=12 if c > 1 else 10)
    cell.fill = HEAD if c == 1 else FILL(SPEAKER_FONT[h]); cell.alignment = Alignment(horizontal='center', vertical='center'); cell.border = BORDER
    if c > 1: ws_char.column_dimensions[get_column_letter(c)].width = 44
for i, label in enumerate(CHAR_ROWS):
    r = i + 2
    ws_char.cell(row=r, column=1, value=label)
    for c, k in enumerate(CHAR_KEYS, 2): ws_char.cell(row=r, column=c, value=CHARACTERS[k][i])
    for c in range(1, 7):
        cell = ws_char.cell(row=r, column=c); cell.border = BORDER
        cell.font = Font(name=FONT, size=10, bold=(c == 1 or label == '이름'), italic=label.startswith('대표 대사') and c > 1)
        cell.alignment = Alignment(vertical='top', wrap_text=True)
        if c == 1: cell.fill = FILL('EEF1F7')
ws_char.freeze_panes = 'B2'

table('엑스트라', ['역할(엑스트라)', '등장 장', '기능', '말투 메모', '인게임 자리'], [22, 18, 52, 26, 30], EXTRAS)

chap_rows = [(int(c[0]), int(c[1]), *c[2:]) for c in CHAPTERS]
ws_ch = table('15장 진행표', ['권', '장', '제목', '시기', '장르 태그', '무대', '새로 열리는 곳', '등장 메인', '핵심 사건', '핵심 선택', '장 끝의 세계 결정', '다음 장으로 넘기는 것', '게임 연계'],
              [5, 5, 18, 18, 22, 24, 20, 16, 70, 24, 24, 34, 34], chap_rows, freeze='D2', center=(1, 2),
              row_style=lambda ws, r, row: [setattr(ws.cell(row=r, column=c), 'fill', VOL_FILL[row[0]]) for c in (1, 2, 3)])

ws_sc = table('장면 스크립트', ['번호', '권', '장', '장면 ID', '장면 제목', '장소', '시각', '유형', '화자', '대사 · 지문', '연출', '조건', '분기 · 결과 · 플래그', '게임 연계(장면)', '퀘스트 단계'],
              [6, 5, 5, 8, 20, 22, 16, 7, 14, 64, 34, 16, 26, 24, 11], script_rows, freeze='J2', center=(1, 2, 3, 4, 8), row_style=script_style)

ws_br = table('선택 분기', ['분기', '장', '상황', '선택지 → 개인 기록', '세계 변수 변화', '즉시 결과', '후속 반영', '엔딩 가중(A~E)'],
              [8, 5, 40, 46, 36, 40, 36, 24], [(b[0], int(b[1]), *b[2:]) for b in BRANCHES], freeze='C2', center=(1, 2))

table('변수', ['변수', '종류', '값', '설명', '올리는 것', '내리는 것', '쓰이는 곳'], [18, 11, 26, 44, 34, 30, 34], VARIABLES, freeze='B2')

end_rows = [(e[0], e[1], e[2], e[3], e[4], int(e[5]), *e[6:]) for e in ENDINGS]
table('엔딩', ['코드', '이름', '성격', '열리는 조건', '15장 최종 의식', '판정 순서', *[f'{k}의 결말' for k in CHAR_KEYS]],
      [6, 14, 14, 46, 22, 9, 32, 32, 32, 32, 32], end_rows, freeze='C2', center=(1, 6))

table('장별 콘텐츠', ['장', '구분', '이름', '내용 · 목표', '등장 · 의뢰', '보상 · 결과', '연계 시스템'], [5, 11, 30, 56, 24, 26, 22],
      [(int(c[0]), *c[1:]) for c in CONTENT], freeze='C2', center=(1,),
      row_style=lambda ws, r, row: setattr(ws.cell(row=r, column=1), 'fill', VOL_FILL[1 if row[0] <= 5 else 2 if row[0] <= 10 else 3]))

ws_w = table('세계관 · 장소', ['구분', '용어', '설명', '서사에서', '게임 연계'], [11, 18, 60, 48, 24], WORLD, freeze='C2')
start = len(WORLD) + 4
ws_w.cell(row=start - 1, column=1, value='장소 대응 — 기획안의 장소를 지금 게임 지도(산문 北 · 강학당 東 · 생활관 西 · 금역 南 · 사당 中)에 놓는 자리').font = Font(name=FONT, bold=True, size=11)
for c, h in enumerate(['장', '기획안 · 스토리의 장소', '게임 지도의 자리', '메모'], 1):
    cell = ws_w.cell(row=start, column=c, value=h); cell.font = Font(name=FONT, bold=True, color='FFFFFF', size=10); cell.fill = HEAD; cell.border = BORDER
for i, p in enumerate(PLACES, 1):
    for c, v in enumerate((int(p[0]), *p[1:]), 1):
        cell = ws_w.cell(row=start + i, column=c, value=v); cell.font = Font(name=FONT, size=10); cell.border = BORDER
        cell.alignment = Alignment(vertical='top', wrap_text=True, horizontal='center' if c == 1 else 'left')

# ─────────────── 개요 (수식으로 센다) ───────────────
ws = ws0
for col, w in zip('ABCDEFGHI', [16, 12, 12, 12, 12, 12, 12, 12, 30]): ws.column_dimensions[col].width = w
def cell(r, c, v, bold=False, size=10, color='000000', fill=None, wrap=False, merge_to=None):
    x = ws.cell(row=r, column=c, value=v); x.font = Font(name=FONT, bold=bold, size=size, color=color)
    x.alignment = Alignment(vertical='top', wrap_text=wrap)
    if fill: x.fill = fill
    if merge_to: ws.merge_cells(start_row=r, start_column=c, end_row=r, end_column=merge_to)
    return x
cell(1, 1, TITLE, bold=True, size=15, merge_to=9)
cell(2, 1, '2046년 대한민국 · SF 오컬트 어반 판타지 · 다중 참여형 서사 RPG — 장편 스토리 스크립트 + 장면 퀘스트 설계(인게임 미구현 · 기획용)', color='555555', merge_to=9)
cell(4, 1, LOGLINE, wrap=True, merge_to=9); ws.row_dimensions[4].height = 34
for i, q in enumerate(QUESTIONS): cell(5 + i, 1, q, bold=True, color='355C8A', merge_to=9)
cell(9, 1, '쓰는 원칙', bold=True, size=11)
for i, p in enumerate(PRINCIPLES): cell(10 + i, 1, f'{i + 1}. {p}', wrap=True, merge_to=9); ws.row_dimensions[10 + i].height = 30
r0 = 10 + len(PRINCIPLES) + 1
cell(r0, 1, '세 권', bold=True, size=11)
for c, h in enumerate(['권', '제목', '장', '시기', '중심 질문', '', '장르', '', '요약'], 1):
    if h: cell(r0 + 1, c, h, bold=True, color='FFFFFF', fill=HEAD)
for i, v in enumerate(VOLUMES):
    r = r0 + 2 + i
    cell(r, 1, int(v[0]), fill=VOL_FILL[int(v[0])]); cell(r, 2, v[1], bold=True); cell(r, 3, v[2]); cell(r, 4, v[3])
    cell(r, 5, v[4], wrap=True, merge_to=6); cell(r, 7, v[5], wrap=True, merge_to=8); cell(r, 9, v[6], wrap=True)
    ws.row_dimensions[r].height = 58
r1 = r0 + 6
SC = "'장면 스크립트'"
NR = len(script_rows) + 1
cell(r1, 1, '장별 분량 (장면 스크립트 시트를 세는 수식)', bold=True, size=11)
for c, h in enumerate(['장', '장면 수', '줄 수', *CHAR_KEYS, '선택 수'], 1): cell(r1 + 1, c, h, bold=True, color='FFFFFF', fill=HEAD)
for ch in range(1, 16):
    r = r1 + 1 + ch
    cell(r, 1, ch, fill=VOL_FILL[1 if ch <= 5 else 2 if ch <= 10 else 3])
    rng = lambda col: f"{SC}!${col}$2:${col}${NR}"
    ws.cell(row=r, column=2, value=f'=COUNTIFS({rng("C")},A{r},{rng("H")},"장면")')
    ws.cell(row=r, column=3, value=f'=COUNTIFS({rng("C")},A{r},{rng("H")},"<>장면")')
    for c, who in zip(range(4, 9), CHAR_KEYS):
        ws.cell(row=r, column=c, value=f'=COUNTIFS({rng("C")},A{r},{rng("I")},"{who}")')
    ws.cell(row=r, column=9, value=f'=COUNTIFS({rng("C")},A{r},{rng("H")},"선택")')
    for c in range(2, 10): ws.cell(row=r, column=c).font = Font(name=FONT, size=10)
rt = r1 + 17
cell(rt, 1, '합계', bold=True)
for c in range(2, 10):
    col = get_column_letter(c)
    ws.cell(row=rt, column=c, value=f'=SUM({col}{r1 + 2}:{col}{r1 + 16})').font = Font(name=FONT, size=10, bold=True)
r2 = rt + 2
cell(r2, 1, '시트 안내', bold=True, size=11)
GUIDE = [
    ('인물', '메인 다섯(서창현 · 윤진서 · 비 · △△ · 연호수)의 이름 · 외모 · 성격 · 말투 · 역할 · 비밀 · 권별 변화. △△는 PC가 4장에서 지어 주는 이름 자리.'),
    ('엑스트라', '나머지 NPC는 모두 역할 이름의 엑스트라. 기존 인게임 NPC 자리(사감 · 양호 선생 · 매점 담당 …)에 그대로 앉힐 수 있다.'),
    ('15장 진행표', '장마다 무대 · 핵심 사건 · 핵심 선택 · 장 끝의 세계 결정 · 다음 장으로 넘기는 떡밥 · 게임 연계.'),
    ('장면 스크립트', '97개 장면의 대사 · 지문 · 연출 · 조건 · 결과. 진한 줄 = 장면 머리. 유형: 지문 · 대사 · 비령(단말기 문구) · 회상 · 선택 · 전투 · 조사 · 퀘스트. "OO"는 플레이어 이름 자리(게임이 이미 OO를 이름으로 바꾼다).'),
    ('선택 분기', '분기 ID(B장-번호)별 선택지 → 개인 기록(P_) · 세계 변수(W_) · 즉시 결과 · 후속 반영 · 엔딩 가중.'),
    ('변수', '개인 기록 P_ · 관계 신뢰_ · 세계 결정 W_. 시작값과 오르내리는 조건.'),
    ('엔딩', '다섯 엔딩의 조건 · 판정 순서(D → E → B/A/C) · 메인 다섯의 결말.'),
    ('장별 콘텐츠', '장마다 메인 임무 · 서브 · 탐사 지역 · 적 · 보스 · 제작 소재 · 제작법(새 소재는 이름만 — 아이템 데이터는 아직 없다).'),
    ('세계관 · 장소', '용어 정리, 그리고 기획안의 장소를 지금 게임 지도에 놓는 대응표.'),
    ('퀘스트 목록', '장면 97개 = 장면 퀘스트 97개. 산문 너머 게시 문구 · 해금 · 보상 · 거치는 곳 · 대사 줄 범위 · 구현 상태.'),
    ('퀘스트 단계', '퀘스트마다 실제로 돌아다니며 하는 일: 인게임 장소 경로 · 할 일 · 완료 판정 · 쓰는 기존 기능 · 신규 필요 · 그 단계에서 나오는 대사 번호.'),
    ('인게임 대응', '완료 판정 키워드가 지금 게임의 어느 함수 · 화면에서 나오는지, 그리고 구현 상태 기호.'),
    ('신규 구현', '퀘스트를 위해 새로 만들어야 하는 것(화면 · 시스템 · 장소 · 데이터)과 그것을 쓰는 퀘스트.'),
    ('산문 너머 화면', '퀘스트를 고르고 진행하는 산문 너머 페이지의 구성.'),
]
for i, (k, v) in enumerate(GUIDE):
    cell(r2 + 1 + i, 1, k, bold=True); cell(r2 + 1 + i, 2, v, wrap=True, merge_to=9); ws.row_dimensions[r2 + 1 + i].height = 30
r3 = r2 + len(GUIDE) + 2
cell(r3, 1, '유형 색', bold=True, size=11)
for i, (t, f) in enumerate([('장면', TYPE_FILL['장면']), ('선택', TYPE_FILL['선택']), ('전투', TYPE_FILL['전투']), ('조사', TYPE_FILL['조사']), ('비령', TYPE_FILL['비령']), ('회상', TYPE_FILL['회상']), ('지문', TYPE_FILL['지문'])]):
    x = cell(r3 + 1, 1 + i, t, fill=f, color='FFFFFF' if t == '장면' else '000000')
cell(r3 + 2, 1, '화자 색: ' + ' · '.join(SPEAKER_FONT.keys()) + ' — 인물 시트 머리 색과 같다.', color='555555', merge_to=9)

# ─────────────── 퀘스트 목록 · 단계 ───────────────
def zone_of(place):
    for k in ['산문', '강학당', '생활관', '금역', '사당', '오른쪽 상태 창', '오방']:
        if k in place: return '비령산 금역' if k == '금역' else k
    if any(x in place for x in ['서울', '청암리', '물치항', '가곡면', '관측 밖', '?? 보관소']): return '산문 너머(바깥)'
    if '경계' in place: return '사당'
    return place.split('›')[0].strip()
import json as _json, os as _os, io as _io, contextlib as _cl
_ROOT = _os.path.normpath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..'))
_argv = sys.argv; sys.argv = [_argv[0], _ROOT]   # export_game 은 불러오는 순간 story-data.js · game_steps.json 을 다시 쓴다(같은 원고 → 같은 결과)
with _cl.redirect_stdout(_io.StringIO()):
    from export_game import HEIRLOOMS as _HEIR, FOES as _FOES
sys.argv = _argv
GAME = _json.load(open('game_steps.json', encoding='utf8'))
WHERE_KO = {'north': '산문 › 산문 너머', 'home': '처음 화면(오방 지도)', 'any': '어디서나', 'mainHall': '강학당 › 본관', 'mainHall/explore': '강학당 › 본관 › 본관 탐사', 'mainHall/class': '강학당 › 본관 › 수업', 'annex/explore': '강학당 › 별관 › 별관 탐사', 'dorm': '생활관 › 기숙사', 'dorm/my-room': '생활관 › 기숙사 › 내 기숙사', 'dorm/store': '생활관 › 기숙사 › 매점', 'dorm/cafeteria': '생활관 › 기숙사 › 급식실', 'gym/battle': '금역 › 뒷산 › 퇴마 실습', 'gym/hike': '금역 › 뒷산 › 산 탐사', 'gym/pioneer': '금역 › 뒷산 › 개척', 'shrine': '사당'}
NEED_KO = {'visit': '탐사 지점', 'spot': '바깥 지점 방문', 'win': '전투 승리(아무 상대)', 'gather': '개척 채집 · 수렵', 'site': '개척 터 진입', 'craft': '공작소 제작(아무것)', 'cook': '조리(아무것)', 'lesson': '수업', 'zone': '구역 방문', 'flag': '사당 표지판', 'battle': '이야기 전투(보스 패턴)', 'maze': '갈림길', 'act': '행동 단추',
           'make': '직접 만들기', 'have': '지니고 가기', 'use': '그 자리에서 쓰기', 'equip': '유품 무구 장착', 'enhance': '무구 강화'}
def game_where(k):
    g = GAME.get(k)
    if not g: return '— (건너뜀: 선택 단계)'
    w = g['w']
    return ('산문 너머 › 바깥 지역 #/out/' + w[4:]) if w.startswith('out:') else WHERE_KO.get(w, w)
def game_need(k):
    g = GAME.get(k)
    if not g: return '—'
    base = ' + '.join(f"{NEED_KO.get(n.split(':')[0].split('×')[0], n)}[{n}]" for n in g['n']) if g['n'] else '그 자리에 도착하면 이어진다'
    if g.get('alt'): base += ' / 선택에 따라 ' + '; '.join(f"{f}={v}: {' + '.join(ns)}" for f, by in g['alt'].items() for v, ns in by.items())
    extra = []
    if g.get('learn'): extra.append('배움: ' + ', '.join(g['learn']))
    if g.get('kit'): extra.append('재료 받음: ' + ', '.join(f'{k}×{v}' for k, v in g['kit'].items()))
    if g.get('give'): extra.append('받음: ' + ', '.join(f'{k}×{v}' for k, v in g['give'].items()))
    if g.get('heir'): extra.append('유품 무구 지급')
    return base + (' | ' + ' · '.join(extra) if extra else '')
qlist, qsteps = [], []
order = [s['id'] for s in scenes]
for i, sid in enumerate(order):
    q = quests[sid]; sc = q['scene']
    nums = [l['n'] for st in q['steps'] for l in st.get('lines', [])]
    zones = []
    for st in q['steps']:
        z = zone_of(st['place'])
        if z not in zones: zones.append(z)
    kinds = []
    for st in q['steps']:
        if st['type'] not in kinds: kinds.append(st['type'])
    news = []
    for st in q['steps']:
        for t in st['new']:
            if t not in news: news.append(t)
    unlock = q['unlock'] if q['unlock'] else '—'
    nxt = '엔딩 판정' if sid == '15-04' else '—' if sid.startswith('15-') and not sid[3:].isdigit() else f'Q{order[i + 1]}'
    qlist.append((f'Q{sid}', sc['vol'], sc['ch'], sc['title'], unlock, q['post'], len(q['steps']), ' · '.join(zones), ' · '.join(kinds),
                  q['reward'], f'#{min(nums)}~#{max(nums)}' if nums else '—', q['status'], ', '.join(news), nxt))
    for st in q['steps']:
        ls = st.get('lines', [])
        first = ls[0] if ls else None
        qsteps.append((f'Q{sid}', st['no'], sc['ch'], st['type'], st['place'], st['act'], st['cond'], st['done'],
                       f'#{ls[0]["n"]}~#{ls[-1]["n"]}' if ls else '—', (f'{first["who"]}: {first["text"]}'[:70] if first else '(대사 없음 — 플레이)'),
                       st['uses'], ', '.join(st['new']), st['status'], game_where(f'{sid}.{st["no"]}'), game_need(f'{sid}.{st["no"]}')))

STATUS_FILL = {'●': FILL('DDEBDD'), '◐': FILL('FFF2CC'), '○': FILL('F8DEDC'), '☁': FILL('DCE6F5')}
def qstyle(col):
    def f(ws, r, row):
        ws.cell(row=r, column=col).fill = STATUS_FILL[row[col - 1]]
        ws.cell(row=r, column=col).font = Font(name=FONT, size=12, bold=True)
    return f
table('퀘스트 목록', ['퀘스트', '권', '장', '장면(퀘스트) 이름', '해금 조건', '산문 너머 게시 문구', '단계 수', '거치는 구역', '하는 일', '보상', '대사 번호', '상태', '신규 필요', '다음'],
      [10, 5, 5, 22, 20, 40, 7, 30, 30, 34, 13, 6, 44, 10], qlist, freeze='E2', center=(1, 2, 3, 7, 11, 12, 14), row_style=qstyle(12))
table('퀘스트 단계', ['퀘스트', '단계', '장', '유형', '인게임 장소', '할 일', '조건 · 필요', '완료 판정(설계)', '대사 번호', '이 단계 첫 대사', '쓰는 기존 기능', '신규 필요', '설계 때 상태', 'v1.3 구현 — 가는 곳', 'v1.3 구현 — 넘어가는 조건 · 받는 것'],
      [10, 6, 5, 8, 46, 50, 20, 34, 13, 40, 44, 32, 6, 34, 44], qsteps, freeze='F2', center=(1, 2, 3, 4, 9, 13), row_style=qstyle(13))
QS = "'퀘스트 단계'"; NQ = len(qsteps) + 1; QL = "'퀘스트 목록'"; NL = len(qlist) + 1

# 인게임 대응
ws_m = table('인게임 대응', ['완료 판정 키워드', '뜻', '지금 게임에서 이 이벤트가 나오는 곳', '상태', '쓰는 단계 수'], [26, 30, 80, 6, 12],
             [(*t, None) for t in TRIGGERS], freeze='B2', center=(4, 5), row_style=qstyle(4))
for r in range(2, len(TRIGGERS) + 2):
    key = ws_m.cell(row=r, column=1).value.split(' · ')[0].rstrip(':')
    ws_m.cell(row=r, column=5, value=f'=COUNTIF({QS}!$H$2:$H${NQ},"*{key}*")')
r0 = len(TRIGGERS) + 4
ws_m.cell(row=r0, column=1, value='상태 기호').font = Font(name=FONT, bold=True, size=11)
for i, (sym, name, desc) in enumerate(STATUS_INFO, 1):
    for c, v in enumerate((sym, name, desc), 1):
        cl = ws_m.cell(row=r0 + i, column=c, value=v); cl.font = Font(name=FONT, size=10, bold=(c == 1)); cl.border = BORDER
        cl.alignment = Alignment(vertical='top', wrap_text=True)
    ws_m.cell(row=r0 + i, column=1).fill = STATUS_FILL[sym]
    ws_m.cell(row=r0 + i, column=4, value=f'=COUNTIF({QS}!$M$2:$M${NQ},A{r0 + i})').font = Font(name=FONT, size=10)
    ws_m.cell(row=r0 + i, column=5, value=f'=COUNTIF({QL}!$L$2:$L${NL},A{r0 + i})').font = Font(name=FONT, size=10)
ws_m.cell(row=r0, column=4, value='단계 수').font = Font(name=FONT, bold=True)
ws_m.cell(row=r0, column=5, value='퀘스트 수').font = Font(name=FONT, bold=True)
r1 = r0 + len(STATUS_INFO) + 2
ws_m.cell(row=r1, column=1, value='구역별 — 퀘스트 단계가 몇 번 그 구역으로 보내는가').font = Font(name=FONT, bold=True, size=11)
ZONES = [('산문(北) · 산문 앞', ['산문(北)', '산문 앞']), ('산문 너머(퀘스트 화면 · 바깥 지역)', ['산문 너머']), ('강학당(東) — 본관 · 별관', ['강학당']),
         ('생활관(西) — 기숙사 · 매점 · 급식실', ['생활관']), ('비령산 금역(南) — 뒷산 · 개척 · 퇴마 실습', ['금역']), ('사당(中) · 경계', ['사당']),
         ('서울 · 청암리 · 물치항 · 가곡면 · 관측 밖(바깥 지역 안)', ['서울 ›', '청암리 ›', '물치항 ›', '관측 밖 ›', '가곡면']),
         ('본관 지하 2~3층(연구 구역)', ['지하 2', '지하 3']), ('오른쪽 상태 창(단말기)', ['오른쪽 상태 창'])]
ws_m.cell(row=r1, column=2, value='단계 수').font = Font(name=FONT, bold=True)
for i, (z, pats) in enumerate(ZONES, 1):
    ws_m.cell(row=r1 + i, column=1, value=z).font = Font(name=FONT, size=10)
    ws_m.cell(row=r1 + i, column=2, value='=' + '+'.join(f'COUNTIF({QS}!$E$2:$E${NQ},"*{p}*")' for p in pats)).font = Font(name=FONT, size=10)

# 신규 구현
uses = {}
for sid in order:
    for st in quests[sid]['steps']:
        for t in st['new']:
            uses.setdefault(t, [])
            if f'Q{sid}' not in uses[t]: uses[t].append(f'Q{sid}')
def tag_sort(t):
    base = t.split(':')[0]
    return (list(NEW_TAGS).index(base), int(uses[t][0][1:].split('-')[0]), t)
new_rows = []
for t in sorted(uses, key=tag_sort):
    base, _, detail = t.partition(':')
    cat, desc, rely = NEW_TAGS[base]
    first = uses[t][0][1:]
    new_rows.append((cat, base, detail or '—', desc, rely, None, ', '.join(uses[t]), f'{first.split("-")[0]}장'))
ws_n = table('신규 구현', ['분류', '요소', '세부', '설명', '지금 게임에서 기댈 곳', '쓰는 단계 수', '쓰는 퀘스트', '처음 필요한 장'], [8, 14, 18, 60, 36, 10, 44, 10],
             new_rows, freeze='C2', center=(1, 6, 8))
for r, (t) in enumerate(sorted(uses, key=tag_sort), 2):
    ws_n.cell(row=r, column=6, value=f'=COUNTIF({QS}!$L$2:$L${NQ},"*{t}*")')

table('산문 너머 화면', ['영역', '요소', '설명', '저장 · 데이터', '지금 있는 것', '새로 할 것'], [12, 22, 64, 26, 36, 30], SANMUN, freeze='C2')

# 개요에 퀘스트 합계
rq = ws.max_row + 2
cell(rq, 1, '장면 퀘스트 (퀘스트 시트를 세는 수식)', bold=True, size=11)
for c, h in enumerate(['상태', '뜻', '퀘스트', '단계'], 1): cell(rq + 1, c, h, bold=True, color='FFFFFF', fill=HEAD)
for i, (sym, name, _) in enumerate(STATUS_INFO, 1):
    r = rq + 1 + i
    cell(r, 1, sym, bold=True, fill=STATUS_FILL[sym]); cell(r, 2, name)
    ws.cell(row=r, column=3, value=f'=COUNTIF({QL}!$L$2:$L${NL},A{r})').font = Font(name=FONT, size=10)
    ws.cell(row=r, column=4, value=f'=COUNTIF({QS}!$M$2:$M${NQ},A{r})').font = Font(name=FONT, size=10)
r = rq + 2 + len(STATUS_INFO)
cell(r, 1, '합계', bold=True)
ws.cell(row=r, column=3, value=f'=SUM(C{rq + 2}:C{r - 1})').font = Font(name=FONT, size=10, bold=True)
ws.cell(row=r, column=4, value=f'=SUM(D{rq + 2}:D{r - 1})').font = Font(name=FONT, size=10, bold=True)

# ─────────────── v1.3 유품 10종 · 본편 아이템 · 제작법 · 보스 패턴 ───────────────
import json as _json, os as _os, re as _re
_WNAME = {'w-bell': '공명 방울', 'w-mace': '충격 철퇴', 'w-fan': '위상 부채', 'w-staff': '육환 석장', 'w-bow': '전자 각궁', 'w-spear': '관측창', 'w-sword': '신칼', 'w-sickle': '절단 낫', 'w-dagger': '회로 단검', 'w-instrument': '장단 변조기'}
_STAT = {'insight': '안목', 'aggression': '호전', 'endurance': '인내', 'control': '절제', 'agility': '신속', 'comprehension': '이해'}
_rec = {l.split('|')[0]: l for l in open(_os.path.join(_ROOT, 'systems/biryeong/story-recipes.txt'), encoding='utf8') if l.strip() and not l.startswith('#')}
table('유품 10종', ['번호', '유품', '계통', '받는 무구(게임 무구 10종)', '무구 id', '부모의 손길(강화 1)', '한 줄', '1장 부모 회상'], [6, 14, 10, 18, 14, 14, 44, 60],
      [(i + 1, n, l, _WNAME[w], w, _STAT[e], note, next((x['text'] for x in lines if x['who'] == f'부모({n.split()[-1]})' and x['scene']['id'] == '1-01'), '')) for i, (n, w, l, k, e, note) in enumerate(_HEIR)], center=(1, 3, 6))
_items = []
for l in open(_os.path.join(_ROOT, 'systems/biryeong/story-items.txt'), encoding='utf8'):
    if not l.strip() or l.startswith('#'): continue
    f = l.rstrip('\n').split('|'); extra = _json.loads(f[8] or '{}')
    got = '이야기 전투 전리품' if '전리품' in extra.get('tags', []) and f[1] == 'material' else ('본편 제작법' if any(r.split('|')[3] == f[0] for r in _rec.values()) else ('매점 ' + f[3] + '냥' if f[3] else '퀘스트가 준다'))
    _items.append((f[0], f[2], {'tool': '도구', 'food': '음식', 'material': '재료', 'craft': '제작품', 'gear': '장비'}.get(f[1], f[1]), got, f[6], f[9]))
table('본편 아이템', ['id', '이름', '종류', '얻는 곳', '효과', '설명'], [18, 16, 8, 18, 40, 60], _items, center=(3,))
_rrows = []
for rid, l in _rec.items():
    rid, place, tier, res, ins, y, unlock = l.rstrip('\n').split('|')
    name = next((x[1] for x in _items if x[0] == res), res)
    _rrows.append((rid, '조리실' if place == 'K' else '공작소', int(tier), name, ins.replace('+', ' + '), int(y) if y else 1, '퀘스트가 가르친다' if unlock == 'quest' else f'「{_FOES[unlock[5:]][2]}」 격파'))
table('본편 제작법', ['id', '곳', '단계', '만드는 것', '재료', '한 번에', '열리는 때'], [18, 8, 6, 18, 50, 8, 26], _rrows, center=(2, 3, 6))
_sb = open(_os.path.join(_ROOT, 'systems/play/src/storyBoss.js'), encoding='utf8').read()
_PN = dict(_re.findall(r"(\w+): '([^']+)'", _sb[_sb.index('const PATTERN_NAME'):_sb.index('\n', _sb.index('const PATTERN_NAME'))]))
_brows = []
_starts = [(mm.group(1), mm.start()) for mm in _re.finditer(r'\n  (\w+): \{ pattern:', _sb)]
_ENT = {k: _sb[s:(_starts[j + 1][1] if j + 1 < len(_starts) else _sb.index('\n}', s))] for j, (k, s) in enumerate(_starts)}
for key, (tier, i, name, blurb) in _FOES.items():
    ent = _ENT.get(key, '')
    m = _re.search(r"pattern: '?(\w+|null)'?,.*?rules: \[(.*?)\]\s*[,}]", ent, _re.S)
    pat = m.group(1) if m else 'null'; rules = ' / '.join(_re.findall(r"'([^']+)'", m.group(2))) if m else ''
    _PN.setdefault('byForm', '진영별(눈 · 두 머리 · 자리 지키기)'); _PN.setdefault('phases', '형태 변화 3단(진영별 패턴 셋)')
    drop = _re.search(r"drop: \['([\w-]+)', (\d)\]", ent)
    dname = next((x[1] for x in _items if drop and x[0] == drop.group(1)), '—')
    _brows.append((key, name, tier, _PN.get(pat, '없음(일반 상대)'), rules, f'{dname}{" ×" + drop.group(2) if drop and drop.group(2) != "1" else ""}' if drop else '—', blurb))
table('보스 패턴', ['id', '상대', '단계', '고유 패턴', '규칙(전투 전에 보이는 글)', '전리품', '소개'], [12, 16, 6, 16, 90, 18, 34], _brows, center=(3,))

wb.move_sheet('개요', offset=-wb.index(wb['개요']))
wb.save(OUT)
print('저장', OUT, '| 장면', len(scenes), '줄', len(lines), '| 분기', len(BRANCHES), '| 콘텐츠', len(CONTENT), '| 퀘스트', len(quests), '단계', len(qsteps), '| 신규', len(uses))
