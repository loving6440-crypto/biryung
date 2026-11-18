"""秘靈 · 비령 표 (vC.06 ~ vD.02.3).  node systems/sheets/build_c06.mjs > c06.json && python3 systems/sheets/build_c06_xlsx.py c06.json 비령_표_vC.06.xlsx [도트 폴더]"""
import json, sys, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as XLImage

d = json.load(open(sys.argv[1], encoding='utf8'))
out = sys.argv[2]
ICONS = sys.argv[3] if len(sys.argv) > 3 else None
FONT = 'Arial'
HEAD = PatternFill('solid', fgColor='1B2A44'); BAND = PatternFill('solid', fgColor='F3F5FA')
NOTE = PatternFill('solid', fgColor='FFF7E0')
TIER = {1: PatternFill('solid', fgColor='DDEBDD'), 2: PatternFill('solid', fgColor='DCE6F5'), 3: PatternFill('solid', fgColor='F5E3D3')}
KINDFILL = {'장비': PatternFill('solid', fgColor='F6E8C3'), '완성품': PatternFill('solid', fgColor='D6EEF2'), '재료': PatternFill('solid', fgColor='E3E9D6')}
thin = Side(style='thin', color='C9CEDA'); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook(); wb.remove(wb.active)

def sheet(title, headers, widths, rows, tier_col=None, freeze='C2', kind_col=None):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
        cell = ws.cell(row=1, column=c); cell.font = Font(name=FONT, bold=True, color='FFFFFF', size=10); cell.fill = HEAD
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); cell.border = BORDER
    ws.row_dimensions[1].height = 26
    for r, row in enumerate(rows, 2):
        ws.append(row)
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c); cell.font = Font(name=FONT, size=10); cell.border = BORDER
            cell.alignment = Alignment(vertical='top', wrap_text=True, horizontal='center' if widths[c - 1] <= 9 else 'left')
            if tier_col and c == tier_col: cell.fill = TIER.get(row[tier_col - 1], BAND); cell.font = Font(name=FONT, size=10, bold=True)
            elif kind_col and c == kind_col: cell.fill = KINDFILL.get(row[kind_col - 1], BAND); cell.font = Font(name=FONT, size=10, bold=True)
            elif r % 2 == 1: cell.fill = BAND
    ws.freeze_panes = freeze
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    return ws

def icons(ws, col, ids):
    if not ICONS: return
    ws.column_dimensions[col].width = 8
    for r, id_ in enumerate(ids, 2):
        path = os.path.join(ICONS, id_ + '.png')
        if os.path.exists(path):
            ws.row_dimensions[r].height = 40
            im = XLImage(path); im.width = 44; im.height = 44; ws.add_image(im, f'{col}{r}')

# ── 읽는 법 ──
ws = wb.create_sheet('읽는 법')
guide = [
    ['비령 vC.06 표 — 읽는 법'],
    [''],
    ['영능력', '설명 = 영능력 창에 보이는 글(빼앗은 영능력은 「○○에게서 빼앗은 영능력.」 + 그 적의 영능력 설명). 상세 설명 = 실제로 어떻게 작동하는지.'],
    ['', '의지력 소모 · 영향받는 스탯(육조 스탯이 직접 관련될 때만) · 익히는 조건을 함께 적었다. 빼앗은 영능력은 같은 적 30번(보스는 20번마다 하나씩, 둘 다 40번).'],
    ['몸의 이상', '전투 · 개척 · 수련에서 걸리는 배드 스테이터스(영능력이 거는 전투 안 디버프와는 따로). 실제 시간으로 남는다. 라운드 피해로는 쓰러지지 않는다(체력 1에서 멈춤).'],
    ['', '낫게 하는 물건: 완치 / 완치 + 체력 · 의지력 회복 / 남은 시간을 5분으로(두 가지씩). 가벼운 이상 둘을 한 번에 낫게 하는 물건도 있다.'],
    ['아이템 · 제작법', '적정 레벨 = 그 아이템(재료)을 얻는 가장 쉬운 개척 칸의 레벨. 제작품은 재료 중 가장 높은 적정 레벨. 빈칸 = 개척으로 얻지 않는 것(매점 · 본편 등).'],
    ['', '개척 칸 레벨은 「두 스탯의 합」과 견준다(영물은 여섯 스탯의 합). 육조 만렙 40(보정 제외) 기준으로 vC.06에서 다시 맞췄다. 테두리 색: 장비(금) · 완성품(옥) · 재료(쑥).'],
    ['개척', '권장 스탯 = 관련 스탯 평균이 이 정도면 수월하다. 개척 터는 권장 스탯 순서로 늘어선다. 「개척 칸」 탭의 평균 환산은 레벨 ÷ 2(영물은 ÷ 6)로 계산한 식이다.'],
]
for row in guide: ws.append(row)
ws.column_dimensions['A'].width = 16; ws.column_dimensions['B'].width = 130
ws['A1'].font = Font(name=FONT, bold=True, size=14)
for r in range(3, len(guide) + 1):
    for c in (1, 2):
        cell = ws.cell(row=r, column=c); cell.font = Font(name=FONT, size=10, bold=(c == 1)); cell.alignment = Alignment(wrap_text=True, vertical='top'); cell.fill = NOTE

# ── 영능력 ──
order = {'처음부터': 0, '기본 영능력': 1, '빼앗은 영능력': 2, '빼앗은 영능력 · 보스': 3}
ps = sorted(d['psychics'], key=lambda p: (order.get(p['kind'], 9), p['name']))
sheet('영능력', ['번호', '영능력', '구분', '빼앗는 상대', '설명', '의지력 소모', '상세 설명', '영향받는 스탯', '익히는 조건', 'ID'],
      [6, 14, 14, 14, 52, 14, 60, 14, 40, 18],
      [[n, p['name'], p['kind'], p['from'], p['note'], p['mp'], p['detail'], p['affects'], p['cond'], p['id']] for n, p in enumerate(ps, 1)])

# ── 몸의 이상(배드 스테이터스) ──
def dur(m): return f"{m // 60}시간" + (f" {m % 60}분" if m % 60 else '') if m >= 60 else f"{m}분"
sheet('배드 스테이터스', ['번호', '이름', '한자', '무게', '효과', '지속', '최대 겹', '걸리는 때', '걸릴 확률 (vD.02.3 완화)', '완치', '완치 + 회복', '남은 시간 5분으로', '글', 'ID'],
      [6, 10, 8, 8, 40, 9, 8, 52, 60, 26, 26, 30, 30, 10],
      [[n, a['name'], a['hanja'], a['heavy'], a['effect'], dur(a['minutes']), a['max'], a['from'], a.get('chance', ''), a['cure'], a['restore'], a['shorten'], a['text'], a['id']] for n, a in enumerate(d['ailments'], 1)])

# ── 아이템 ──
def group(kind):
    if kind in ('완성품 · 신체 장비', '완성품 · 장신구', '완성품 · 무구'): return '장비'
    return '재료' if kind == '재료' else '완성품'
items = sorted(d['items'], key=lambda i: ({'장비': 0, '완성품': 1, '재료': 2}[group(i['kind'])], i['level'] if i['level'] is not None else 9999, i['name']))
ws_items = sheet('아이템', ['번호', '도트', '아이템', '테두리', '종류', '적정 레벨', '효과', '해설', '설명(쓰임새)', '습득 방법', '매점가(냥)', '분류 태그', 'ID'],
      [6, 8, 22, 8, 17, 9, 42, 48, 30, 54, 9, 26, 22],
      [[n, None, i['name'], group(i['kind']), i['kind'], i['level'], i['effect'], i['lore'], i['use'], i['source'], i['price'], i['tags'], i['id']] for n, i in enumerate(items, 1)], freeze='D2', kind_col=4)
icons(ws_items, 'B', [i['id'] for i in items])

recs = sorted(d['recipes'], key=lambda r: (r['level'] if r['level'] is not None else 9999, r['tier'], r['place'], r['result']))
sheet('제작법', ['번호', '단계', '적정 레벨', '곳', '만드는 아이템', '한 번에', '조합(재료)', '재료 가짓수', '종류', '효과', '구분', 'ID'],
      [6, 7, 9, 9, 22, 7, 46, 8, 17, 42, 9, 22],
      [[n, r['tier'], r['level'], r['place'], r['result'], r['qty'], r['combo'], r['parts'], r['kind'], r['effect'], {'ail': '몸의 이상'}.get(r['isNew'], r['isNew']), r['id']] for n, r in enumerate(recs, 1)], tier_col=2, freeze='F2')

# ── 개척 ──
sheet('개척 터', ['순서', '개척 터', '길', '권장 스탯(평균)', '칸 레벨(최저~최고)', '최대 턴', '칸 수', '설명', '개척 요괴', '영물(레벨 · 확률)', '나오는 재료', 'ID'],
      [6, 18, 7, 10, 12, 8, 7, 60, 16, 30, 54, 16],
      [[p['order'], p['name'], {'left': '왼길', 'center': '중앙길', 'right': '오른길'}.get(p['path'], p['path']), p['target'], f"{p['lvMin']} ~ {p['lvMax']}", p['turns'], p['nodes'], p['note'], p['ghost'], p['spirits'], p['mats'], p['id']] for p in d['pioneer']])
rows = [[n, x['site'], x['kind'], x['species'], x['level'], None, x['rewards'], x['id']] for n, x in enumerate(d['nodes'], 1)]
ws_n = sheet('개척 칸', ['번호', '개척 터', '종류', '대상', '레벨', '평균 스탯 환산', '얻는 것', '칸'], [6, 18, 8, 16, 7, 10, 40, 6], rows, freeze='C2')
for r in range(2, len(rows) + 2):
    ws_n.cell(row=r, column=6).value = f'=ROUND(E{r}/IF(C{r}="영물",6,2),0)'
    ws_n.cell(row=r, column=6).number_format = '0'

wb.save(out)
print('saved', out)
