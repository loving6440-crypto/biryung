# -*- coding: utf-8 -*-
"""비령 본편 v2(3권 12절) 스크립트 워크북.  python3 build_v2.py <출력.xlsx>"""
import sys, os, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import parse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import outline as O

parse.VOL_OF = lambda ch: 1 if ch <= 4 else 2 if ch <= 8 else 3
scenes, rows, errs = parse.parse([os.path.join(HERE, f'script_vol{i}.txt') for i in (1, 2, 3)])
if errs: sys.exit('\n'.join(errs))

FONT = 'Arial'
HEAD = PatternFill('solid', start_color='1F2A44')
VOL_FILL = {1: 'EAF1E4', 2: 'E6EEF6', 3: 'F3E9E4'}
TYPE_FILL = {'선택': 'FFF2CC', '전투': 'F8D7D7', '비령': 'DDEBF7', '회상': 'EDE7F6', '지문': 'F5F5F5', '시스템': 'E2EFDA', '조사': 'FCE4D6', '퀘스트': 'E2EFDA'}
thin = Side(style='thin', color='C9C9C9')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook()

def table(name, headers, widths, data, center=(), fill_of=None, wrap=True):
    ws = wb.create_sheet(name)
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(name=FONT, bold=True, color='FFFFFF', size=10); c.fill = HEAD
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); c.border = BOX
    for r in data:
        ws.append(list(r))
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for ri, row in enumerate(ws.iter_rows(min_row=2), 2):
        f = fill_of(data[ri - 2]) if fill_of else None
        for ci, c in enumerate(row, 1):
            c.font = Font(name=FONT, size=10); c.border = BOX
            c.alignment = Alignment(vertical='top', wrap_text=wrap, horizontal='center' if ci in center else 'left')
            if f: c.fill = PatternFill('solid', start_color=f)
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions
    return ws

# ── 개요 ──
ws = wb.active; ws.title = '개요'
ws['A1'] = O.TITLE; ws['A1'].font = Font(name=FONT, size=15, bold=True)
ws['A2'] = O.TIMELINE_NOTE; ws['A2'].font = Font(name=FONT, size=10, color='555555'); ws['A2'].alignment = Alignment(wrap_text=True, vertical='top')
ws.merge_cells('A2:F2'); ws.row_dimensions[2].height = 48
ws.append([])
ws.append(['권', '제목', '절', '시기', '물음', '줄거리']);
for c in ws[4]: c.font = Font(name=FONT, bold=True, color='FFFFFF'); c.fill = HEAD; c.border = BOX
for v in O.VOLUMES:
    ws.append([v[0], v[1], v[2], v[3], v[4], v[6]])
for r in ws.iter_rows(min_row=5, max_row=7):
    for c in r: c.font = Font(name=FONT, size=10); c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = BOX; c.fill = PatternFill('solid', start_color=VOL_FILL[int(r[0].value)])
ws.append([])
ws.append(['집계', '수', '', '', '', ''])
for c in ws[9]: c.font = Font(name=FONT, bold=True, color='FFFFFF'); c.fill = HEAD
NS = len(scenes) + 1; NR = len(rows) + 1
stats = [('장면', f'=COUNTA(장면목록!A2:A{NS})'), ('스크립트 줄', f'=COUNTA(스크립트!A2:A{NR})'),
         ('선택 줄', f'=COUNTIF(스크립트!D2:D{NR},"선택")'), ('전투 줄', f'=COUNTIF(스크립트!D2:D{NR},"전투")'),
         ('비령 대사', f'=COUNTIF(스크립트!D2:D{NR},"비령")'), ('분기(B)', f'=COUNTA(선택분기!A2:A{len(O.BRANCHES)+1})'), ('엔딩', f'=COUNTA(엔딩!A2:A{len(O.ENDINGS)+1})')]
for k, f in stats: ws.append([k, f])
for r in ws.iter_rows(min_row=10, max_row=9 + len(stats)):
    for c in r[:2]: c.font = Font(name=FONT, size=10); c.border = BOX
ws.append([])
notes = ['스크립트 시트의 유형: 지문 · 대사 · 비령 · 회상 · 선택 · 전투 · 조사 · 시스템 · 퀘스트. 조건 칸의 ①②③ 은 바로 앞 선택의 번호, P_ 는 개인 기록, W_ 는 세계 변수.',
         'OO 는 플레이어 이름, △△ 는 3절에서 PC가 지어 준 신의 이름, {유품} · {무구} 는 고른 무구 이름으로 바뀌는 자리.',
         '이번 판은 스크립트만이다. 게임 속 산문 너머 퀘스트(옛 15장 97개)는 아직 그대로이며, 이 원고가 확정되면 12절 기준으로 다시 구현한다.']
for n in notes:
    ws.append(['· ' + n]); ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=6)
    ws.cell(row=ws.max_row, column=1).alignment = Alignment(wrap_text=True, vertical='top'); ws.cell(row=ws.max_row, column=1).font = Font(name=FONT, size=10)
    ws.row_dimensions[ws.max_row].height = 30
for col, w in zip('ABCDEF', [14, 22, 10, 22, 34, 80]): ws.column_dimensions[col].width = w

table('세계관 반영', ['설정', '세계관 문서', '스토리에 넣은 곳'], [20, 60, 70], O.WORLD)
table('권·절 진행표', ['권', '절', '제목', '시기', '무대', '등장 메인', '핵심 사건', '핵심 선택', '다음 절로 넘기는 것', '옛 15장'],
      [5, 5, 18, 20, 26, 22, 70, 32, 30, 16], O.CHAPTERS, center=(1, 2), fill_of=lambda r: VOL_FILL[int(r[0])])
table('등장인물', ['이름', '자리', '나이 · 신분', '세계관 속 위치', '말투', '비밀 · 회수'], [20, 8, 24, 50, 30, 60], O.CHARACTERS, center=(2,))
table('선택분기', ['ID', '절', '상황', '선택지 → 기록', '세계 변수', '즉시 결과', '후속 반영', '엔딩 가중'],
      [8, 5, 36, 46, 34, 34, 30, 22], O.BRANCHES, center=(1, 2))
table('엔딩', ['엔딩', '이름', '편', '조건', '결말'], [6, 14, 18, 60, 70], O.ENDINGS, center=(1,))

cnt = collections.Counter(r['scene']['id'] for r in rows)
sc_rows = [(s['id'], int(s['vol']), int(s['ch']), O.CHAPTERS[int(s['ch']) - 1][2], s['title'], s['place'], s['time'], s['link'], cnt[s['id']]) for s in scenes]
table('장면목록', ['장면', '권', '절', '절 제목', '장면 제목', '장소', '때', '구분', '줄 수'], [8, 5, 5, 20, 26, 34, 22, 26, 7],
      sc_rows, center=(1, 2, 3, 9), fill_of=lambda r: VOL_FILL[r[1]])

seq = collections.Counter(); script = []
for r in rows:
    sid = r['scene']['id']; seq[sid] += 1
    script.append((sid, int(r['scene']['ch']), seq[sid], r['type'], r['who'], r['text'], r['direc'], r['cond'], r['res']))
table('스크립트', ['장면', '절', '줄', '유형', '화자', '대사 · 지문', '연출', '조건', '결과'], [8, 5, 5, 8, 18, 80, 40, 14, 26],
      script, center=(1, 2, 3, 4), fill_of=lambda r: TYPE_FILL.get(r[3]))
table('15장→12절', ['옛 장', '새 절', '어떻게 바뀌었나'], [32, 26, 80], O.MAPPING)

out = sys.argv[1] if len(sys.argv) > 1 else 'biryeong_story_v2.xlsx'
wb.save(out)
print('저장', out, '| 장면', len(scenes), '줄', len(rows), '| 분기', len(O.BRANCHES), '| 절별 줄', dict(sorted(collections.Counter(int(r['scene']['ch']) for r in rows).items())))
