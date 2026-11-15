# -*- coding: utf-8 -*-
"""오방 지도 가운데 칸 — 노란 사당(center_scene.png, 380×210).
산문 · 강학당 · 생활관 · 금역 그림(assets/*_scene.png)과 같은 결로 맞춘다:
밤하늘 띠 그라데이션 + 별, 먼 산 두 겹, 솔숲, 돌계단 원근, 작은 점 얼룩. 사당만 기와가 노랗다.
  python3 systems/art/center_scene.py   → assets/center_scene.png
"""
import os, random
from PIL import Image, ImageDraw

W, H = 380, 210
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'center_scene.png')
rnd = random.Random(20361231)
im = Image.new('RGB', (W, H))
d = ImageDraw.Draw(im)
px = lambda x, y, c: 0 <= x < W and 0 <= y < H and im.putpixel((int(x), int(y)), c)

# ── 하늘: 다른 그림처럼 가로 띠로 조금씩 밝아진다 ──
top, bot = (7, 13, 34), (16, 31, 52)
for y in range(0, 130):
    t = min(1, (y // 6) * 6 / 125)
    d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bot)))
for _ in range(70):
    px(rnd.randrange(W), rnd.randrange(95), rnd.choice([(70, 86, 118), (96, 112, 142), (60, 74, 104)]))
for x, y in [(30, 18), (118, 9), (171, 31), (262, 14), (331, 40), (352, 8), (74, 52), (220, 47)]:
    for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-2, 0), (2, 0), (0, -2), (0, 2)]:
        px(x + dx, y + dy, (112, 130, 160) if (dx, dy) == (0, 0) else (78, 94, 124))
# ── 먼 산 두 겹 ──
def ridge(y0, amp, col, seed, step=6):
    r = random.Random(seed); pts = [(0, H)]; y = y0
    for x in range(0, W + step, step):
        y = max(y0 - amp, min(y0 + amp, y + r.randint(-3, 3))); pts.append((x, y))
    pts.append((W, H)); d.polygon(pts, fill=col)
ridge(92, 14, (19, 39, 56), 3)
ridge(112, 9, (27, 48, 62), 7, 5)

# ── 마당 · 돌길 ──
d.rectangle([0, 150, W, H], fill=(21, 41, 54))
for y in range(150, H, 2):
    for _ in range(10): px(rnd.randrange(W), y + rnd.randrange(2), rnd.choice([(27, 42, 52), (20, 47, 50), (24, 46, 58)]))
# 원근 돌계단(아래로 넓어진다)
for i, y in enumerate(range(158, H, 6)):
    half = 30 + i * 9
    d.rectangle([190 - half, y, 190 + half, y + 4], fill=(52, 67, 75))
    d.line([(190 - half, y), (190 + half, y)], fill=(71, 80, 90))
    d.line([(190 - half, y + 4), (190 + half, y + 4)], fill=(27, 42, 52))
    for _ in range(half // 6): px(rnd.randint(190 - half, 190 + half), y + rnd.randint(1, 3), (44, 58, 66))

# ── 솔숲(양옆) ──
def pine(cx, base, h, w):
    d.rectangle([cx - 1, base - 6, cx + 1, base], fill=(40, 30, 26))
    for k in range(4):
        y1 = base - 5 - k * (h // 5); y0 = y1 - h // 3; ww = w - k * (w // 5)
        d.polygon([(cx, y0), (cx - ww, y1), (cx + ww, y1)], fill=(20, 47, 50))
        for _ in range(ww): px(cx + rnd.randint(-ww + 2, ww - 2), rnd.randint(y0 + 3, y1 - 1), (43, 85, 80))
        d.line([(cx - ww, y1), (cx + ww, y1)], fill=(16, 36, 42))
for cx, base, h, w in [(14, 156, 70, 18), (44, 150, 54, 15), (70, 153, 44, 12), (338, 152, 56, 15), (366, 157, 72, 18), (312, 154, 42, 11), (96, 150, 30, 9), (286, 150, 30, 9)]:
    pine(cx, base, h, w)

# ── 사당 ──
CX = 190
stone, stoneHi, stoneLo = (71, 80, 90), (89, 100, 106), (44, 56, 64)
# 기단
d.rectangle([CX - 78, 140, CX + 78, 152], fill=stone); d.line([(CX - 78, 140), (CX + 78, 140)], fill=stoneHi)
d.line([(CX - 78, 152), (CX + 78, 152)], fill=stoneLo)
for x in range(CX - 78, CX + 79, 13): d.line([(x, 141), (x, 151)], fill=stoneLo)
d.rectangle([CX - 26, 152, CX + 26, 158], fill=stone); d.line([(CX - 26, 152), (CX + 26, 152)], fill=stoneHi)
# 벽 · 기둥 · 문
d.rectangle([CX - 66, 106, CX + 66, 140], fill=(30, 26, 30))
wood, woodHi, woodLo = (117, 58, 48), (146, 76, 60), (76, 38, 34)
for x in (CX - 66, CX - 33, CX, CX + 33):
    pass
cols = [CX - 66, CX - 34, CX - 12, CX + 12, CX + 34, CX + 66]
for x in cols:
    d.rectangle([x - 2, 104, x + 2, 140], fill=wood); d.line([(x - 2, 104), (x - 2, 140)], fill=woodHi); d.line([(x + 2, 104), (x + 2, 140)], fill=woodLo)
lat, latHi = (180, 154, 110), (202, 170, 112)
def door(x0, x1, glow=False):
    d.rectangle([x0, 110, x1, 139], fill=(58, 44, 30) if glow else (27, 34, 44))
    for x in range(x0 + 3, x1, 4): d.line([(x, 111), (x, 138)], fill=latHi if glow else lat)
    for y in range(113, 139, 5): d.line([(x0 + 1, y), (x1 - 1, y)], fill=latHi if glow else lat)
    d.rectangle([x0, 110, x1, 139], outline=woodLo)
door(CX - 31, CX - 15); door(CX + 15, CX + 31); door(CX - 9, CX + 9, glow=True)
for x0, x1 in [(CX - 63, CX - 37), (CX + 37, CX + 63)]:
    d.rectangle([x0, 112, x1, 132], fill=(27, 34, 44)); d.rectangle([x0, 112, x1, 132], outline=woodLo)
    for x in range(x0 + 4, x1, 5): d.line([(x, 113), (x, 131)], fill=lat)
    d.line([(x0 + 1, 122), (x1 - 1, 122)], fill=lat)
# 가운데 문에서 새는 불빛
for y in range(141, 150):
    for x in range(CX - 8 - (y - 141), CX + 9 + (y - 141)):
        if (x + y) % 2 == 0: px(x, y, (120, 104, 76))
# 단청 띠
d.rectangle([CX - 70, 100, CX + 70, 105], fill=(53, 94, 97))
for x in range(CX - 70, CX + 71, 6):
    d.rectangle([x, 101, x + 2, 104], fill=(64, 122, 96)); px(x + 4, 102, (190, 72, 56)); px(x + 4, 103, (190, 72, 56))
d.line([(CX - 70, 105), (CX + 70, 105)], fill=(22, 30, 34))
# 노란 기와 지붕(팔작) — 처마 끝이 살짝 들린다
gold, goldHi, goldLo, goldDk = (186, 150, 70), (214, 184, 106), (140, 108, 50), (86, 64, 34)
roof = [(CX - 96, 98), (CX - 102, 92), (CX - 86, 94), (CX - 52, 70), (CX + 52, 70), (CX + 86, 94), (CX + 102, 92), (CX + 96, 98)]
d.polygon(roof, fill=gold)
for x in range(CX - 98, CX + 99, 3):  # 기와골
    for y in range(70, 99):
        if im.getpixel((x, y)) == gold: px(x, y, goldLo)
for y in range(72, 98, 5):  # 기와 줄
    for x in range(CX - 100, CX + 101):
        if im.getpixel((x, y)) in (gold, goldLo): px(x, y, goldHi if y < 85 else gold)
d.line([(CX - 96, 98), (CX + 96, 98)], fill=goldDk); d.line([(CX - 96, 99), (CX + 96, 99)], fill=(40, 30, 24))
d.line([(CX - 102, 92), (CX - 86, 94)], fill=goldHi); d.line([(CX + 86, 94), (CX + 102, 92)], fill=goldHi)
# 용마루 · 합각
d.rectangle([CX - 54, 66, CX + 54, 70], fill=goldDk); d.line([(CX - 54, 66), (CX + 54, 66)], fill=goldHi)
d.polygon([(CX - 20, 66), (CX, 54), (CX + 20, 66)], fill=gold); d.polygon([(CX - 12, 66), (CX, 59), (CX + 12, 66)], fill=goldLo)
for x, s in [(CX - 56, -1), (CX + 56, 1)]:  # 취두
    d.rectangle([x - 3, 60, x + 3, 67], fill=goldDk); d.line([(x - 3, 60), (x + 3, 60)], fill=goldHi); px(x + 4 * s, 59, goldHi)
# 현판
d.rectangle([CX - 14, 74, CX + 14, 84], fill=(30, 22, 18)); d.rectangle([CX - 14, 74, CX + 14, 84], outline=(202, 145, 97))
for x in (CX - 8, CX - 2, CX + 4): d.rectangle([x, 77, x + 3, 81], fill=(240, 208, 108))

# ── 석등 둘 ──
for lx in (CX - 46, CX + 46):
    d.rectangle([lx - 1, 150, lx + 1, 162], fill=stone)
    d.rectangle([lx - 4, 162, lx + 4, 164], fill=stone); d.line([(lx - 4, 162), (lx + 4, 162)], fill=stoneHi)
    d.rectangle([lx - 4, 142, lx + 4, 150], fill=(52, 67, 75)); d.rectangle([lx - 2, 144, lx + 2, 148], fill=(244, 206, 124))
    d.polygon([(lx - 6, 142), (lx, 137), (lx + 6, 142)], fill=stoneHi)
    for r in (7, 10):
        for a in range(0, 360, 18):
            import math
            x = lx + round(r * math.cos(math.radians(a))); y = 146 + round(r * 0.8 * math.sin(math.radians(a)))
            if (x + y) % 3 == 0: px(x, y, (88, 82, 64))
# 금줄(사당 앞, 들어가지 말 것)
for x in range(CX - 40, CX + 41):
    y = 150 + round(3 * (1 - ((x - CX) / 40) ** 2))
    px(x, y, (180, 154, 110))
for x in range(CX - 32, CX + 33, 16):
    y = 151 + round(3 * (1 - ((x - CX) / 40) ** 2))
    d.polygon([(x, y), (x - 2, y + 5), (x + 2, y + 5)], fill=(232, 232, 220))

im.save(OUT)
print('저장', os.path.abspath(OUT), im.size)
