"""아이템 도트를 PNG 로 그린다(게임 화면의 아이콘과 같은 모양: 16×16 판 위에 12×12 도트).  python3 render_icons.py <reskin.json> <폴더> [배율]"""
import json, os, sys
from PIL import Image
d = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]; scale = int(sys.argv[3]) if len(sys.argv) > 3 else 4
os.makedirs(out, exist_ok=True)
hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
BG, FRAME, OUTLINE = hexc('#0c1826'), hexc('#6d5d43'), hexc('#07101b')
for id_, px in d['ITEM_PIXELS'].items():
    a, b, c, dd = (hexc(x) for x in d['PIXEL_PALETTES'][px['p']])
    col = {'k': OUTLINE, 'a': a, 'b': b, 'c': c, 'd': dd}
    im = Image.new('RGB', (16, 16), BG)
    for i in range(16):
        for xy in ((i, 0), (i, 15), (0, i), (15, i)): im.putpixel(xy, FRAME)
    for y, row in enumerate(d['PIXEL_TEMPLATES'][px['t']]):
        for x, ch in enumerate(row):
            if ch in col: im.putpixel((x + 2, y + 2), col[ch])
    im.resize((16 * scale, 16 * scale), Image.NEAREST).save(os.path.join(out, id_ + '.png'))
print('도트 PNG', len(d['ITEM_PIXELS']))
