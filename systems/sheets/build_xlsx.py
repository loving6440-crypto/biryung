"""秘靈 · 비령 — 표(엑셀) 만들기.   node systems/sheets/export.mjs > sheets.json && python3 systems/sheets/build_xlsx.py sheets.json out.xlsx"""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from openpyxl.drawing.image import Image as XLImage
import os
d = json.load(open(sys.argv[1], encoding='utf8'))
out = sys.argv[2]
ICONS = sys.argv[3] if len(sys.argv) > 3 else None  # 도트 PNG 폴더(render_icons.py 가 만든다, 48×48)

def icons(ws, col, ids):
    """col 열에 아이템 도트를 한 칸에 하나씩 넣는다."""
    if not ICONS: return
    ws.column_dimensions[col].width = 8
    for r, id_ in enumerate(ids, 2):
        ws.row_dimensions[r].height = 40
        path = os.path.join(ICONS, id_ + '.png')
        if os.path.exists(path):
            im = XLImage(path); im.width = 44; im.height = 44; ws.add_image(im, f'{col}{r}')
FONT = 'Arial'
HEAD = PatternFill('solid', fgColor='1B2A44'); BAND = PatternFill('solid', fgColor='F3F5FA')
TIER = {1: PatternFill('solid', fgColor='DDEBDD'), 2: PatternFill('solid', fgColor='DCE6F5'), 3: PatternFill('solid', fgColor='F5E3D3')}
thin = Side(style='thin', color='C9CEDA'); BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook()

def sheet(title, headers, widths, rows, tier_col=None, freeze='B2'):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
        cell = ws.cell(row=1, column=c); cell.font = Font(name=FONT, bold=True, color='FFFFFF', size=10); cell.fill = HEAD
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); cell.border = BORDER
    ws.row_dimensions[1].height = 24
    for r, row in enumerate(rows, 2):
        ws.append(row)
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c); cell.font = Font(name=FONT, size=10); cell.border = BORDER
            cell.alignment = Alignment(vertical='top', wrap_text=True, horizontal='center' if widths[c - 1] <= 9 else 'left')
            if tier_col and c == tier_col: cell.fill = TIER.get(row[tier_col - 1], BAND); cell.font = Font(name=FONT, size=10, bold=True)
            elif r % 2 == 1: cell.fill = BAND
    ws.freeze_panes = freeze
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    return ws

KIND_ORDER = ['재료', '완성품 · 소모품', '완성품 · 전투용', '완성품 · 개척용', '완성품 · 무구 강화재', '완성품 · 특수 강화 패', '완성품 · 신체 장비', '완성품 · 장신구', '완성품 · 무구']
items = sorted(d['items'], key=lambda i: (KIND_ORDER.index(i['kind']), i['name']))
ws_items = sheet('아이템', ['번호', '도트', '아이템', '종류', '효과', '해설', '설명(쓰임새)', '습득 방법', '매점가(냥)', '분류 태그', 'ID'], [6, 8, 20, 17, 44, 50, 44, 50, 9, 30, 22],
      [[n, None, i['name'], i['kind'], i['effect'], i['lore'], i['use'], i['source'], i['price'], i['tags'], i['id']] for n, i in enumerate(items, 1)], freeze='D2')
icons(ws_items, 'B', [i['id'] for i in items])

recs = sorted(d['recipes'], key=lambda r: (r['tier'], r['place'], r['result'], r['id']))
ws_recs = sheet('제작법', ['번호', '단계', '곳', '도트', '만드는 아이템', '한 번에', '조합(재료)', '재료 가짓수', '종류', '효과', '아이템 해설', '아이템 설명(쓰임새)', '구분', '제작법 ID'], [6, 6, 8, 8, 20, 7, 48, 8, 17, 42, 46, 42, 9, 26],
      [[n, r['tier'], r['place'], None, r['result'], r['qty'], r['combo'], r['parts'], r['kind'], r['effect'], r['lore'], r['use'], r['isNew'], r['id']] for n, r in enumerate(recs, 1)], tier_col=2, freeze='F2')
icons(ws_recs, 'D', [r['resultId'] for r in recs])

titles = sorted(d['titles'], key=lambda t: (t['tier'], t['isNew'] != '기존', t['name']))
sheet('칭호', ['번호', '칭호', '난이도', '묶음', '기능(달고 있을 때)', '얻는 방법', '칭호 설명', '구분'], [6, 20, 7, 18, 38, 62, 44, 9],
      [[n, t['name'], t['tier'], t['group'], t['perk'], t['how'], t['desc'], t['isNew']] for n, t in enumerate(titles, 1)])

# ── 안내(맨 앞) ──
ws = wb['Sheet']; ws.title = '안내'
ws.column_dimensions['A'].width = 26; ws.column_dimensions['B'].width = 14; ws.column_dimensions['C'].width = 14; ws.column_dimensions['D'].width = 14; ws.column_dimensions['E'].width = 60
def put(r, vals, bold=False, fill=None):
    for c, v in enumerate(vals, 1):
        cell = ws.cell(row=r, column=c, value=v); cell.font = Font(name=FONT, size=11 if bold else 10, bold=bold, color='FFFFFF' if fill is HEAD else '000000')
        cell.alignment = Alignment(vertical='top', wrap_text=True)
        if fill: cell.fill = fill
ws['A1'] = '秘靈 · 비령 v1.0 — 아이템 · 제작법 · 칭호 표'; ws['A1'].font = Font(name=FONT, size=14, bold=True)
ws['A2'] = '게임 데이터(systems/vault · systems/biryeong · titles.js · titles2.js)에서 그대로 뽑은 표. 다시 만들려면 npm run sheets.'; ws['A2'].font = Font(name=FONT, size=10, color='555555')
NR = len(recs) + 1; NI = len(items) + 1; NT = len(titles) + 1
put(4, ['제작 단계', '공작소', '조리실', '합계', '뜻'], True, HEAD)
mean = {1: '바탕 — 다른 제작의 재료가 되는 것(전도 한지 · 부적 잉크 · 약재 추출액 · 청화 육수 …). 날재료만으로 만든다.', 2: '바탕으로 만드는 완성품. 제작법의 대부분.', 3: '상급 공정 — 완성품이나 귀한 재료, 바탕 여럿을 겹쳐 쓴다. 성능이 좋거나 한 번에 여러 개가 나온다.'}
for k in (1, 2, 3):
    r = 4 + k
    put(r, [f'{k}단계', f'=COUNTIFS(제작법!$B$2:$B${NR},{k},제작법!$C$2:$C${NR},"공작소")', f'=COUNTIFS(제작법!$B$2:$B${NR},{k},제작법!$C$2:$C${NR},"조리실")', f'=B{r}+C{r}', mean[k]], fill=TIER[k])
put(8, ['합계', '=SUM(B5:B7)', '=SUM(C5:C7)', '=SUM(D5:D7)', '이 가운데 v1.0 신규:'], True)
ws['E8'] = f'="이 가운데 v1.0 신규 "&COUNTIF(제작법!$M$2:$M${NR},"v1.0 신규")&"개"'
put(10, ['아이템', '개수', '', '', '뜻'], True, HEAD)
put(11, ['재료', f'=COUNTIF(아이템!$D$2:$D${NI},"재료")', '', '', "효과 칸은 모두 '제작용 재료'로 통일했다."])
put(12, ['완성품', f'=COUNTIF(아이템!$D$2:$D${NI},"완성품*")', '', '', '소모품 · 전투용 · 개척용 · 장비 · 무구 · 강화재'])
put(13, ['합계', '=B11+B12', '', '', ''], True)
put(15, ['칭호', '개수', '', '', '뜻'], True, HEAD)
put(16, ['기존', f'=COUNTIF(칭호!$H$2:$H${NT},"기존")', '', '', '난이도 0 처음부터 · 1 둘러보기/하루 · 2 며칠 · 3 꾸준히 · 4 한 달 · 5 극'])
put(17, ['v1.0 신규(별전)', f'=COUNTIF(칭호!$H$2:$H${NT},"v1.0 신규")', '', '', '기능은 그 칭호를 달고 있을 때만 듣는다(한 번에 하나).'])
put(18, ['합계', '=B16+B17', '', '', ''], True)
put(20, ['표 읽는 법'], True)
notes = ['아이템 — 해설: 세계관 설명 글 / 설명(쓰임새): 어디에 어떻게 쓰는지 / 습득 방법: 얻는 길을 모두 적었다( / 로 구분).',
         "습득 방법이 '아직 습득처 없음'인 재료 6종은 초록동색에서 NPC · 퀘스트로 얻던 것이다. 새 NPC를 정하면 연결하면 된다.",
         '제작법 — 조합: 재료 이름 ×개수. 재료를 정확히 그 비율로 올리면 여러 개를 한꺼번에 만든다.',
         "제작법 — '한 번에'가 2 이상이면 한 번 만들 때 그 수만큼 나온다(3단계 대량 공정).",
         '도트 — 게임 화면에 나오는 그 아이템의 도트 아이콘이다(12×12, 아이템마다 하나씩 · 겹치는 것 없음). 원본은 systems/biryeong/pixels.txt 와 pixel-templates*.txt.',
         '모든 표는 첫 줄의 필터 단추로 단계 · 곳 · 종류별로 걸러 볼 수 있다.']
for i, t in enumerate(notes): ws.cell(row=21 + i, column=1, value='· ' + t).font = Font(name=FONT, size=10); ws.merge_cells(start_row=21 + i, start_column=1, end_row=21 + i, end_column=5)
wb.save(out)
print('저장', out, len(items), len(recs), len(titles))
