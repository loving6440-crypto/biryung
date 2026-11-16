# -*- coding: utf-8 -*-
"""본편 이야기 화면의 배경 두 장 — 강릉 시내(city_scene.png) · 청암리(village_scene.png). 380×210, 오방 지도 그림과 같은 결.
  python3 systems/art/story_scenes.py
"""
import os, random, math
from PIL import Image, ImageDraw

W, H = 380, 210
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets')

def base(seed, top, bot, stars=40):
    rnd = random.Random(seed); im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(0, 140):
        t = min(1, (y // 6) * 6 / 135)
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bot)))
    for _ in range(stars):
        x, y = rnd.randrange(W), rnd.randrange(90)
        im.putpixel((x, y), rnd.choice([(70, 86, 118), (96, 112, 142), (60, 74, 104)]))
    return im, d, rnd

def px(im, x, y, c):
    if 0 <= x < W and 0 <= y < H: im.putpixel((int(x), int(y)), c)

# ── 강릉 시내: 낮은 다세대 주택 · 전봇대 · 멀리 바다와 대관령 능선 ──
im, d, rnd = base(2036, (9, 16, 38), (28, 40, 66), 30)
ridge = [(0, H)] + [(x, 98 + round(8 * math.sin(x / 37) + 5 * math.sin(x / 13))) for x in range(0, W + 6, 6)] + [(W, H)]
d.polygon(ridge, fill=(20, 36, 54))
d.rectangle([0, 118, W, 126], fill=(30, 52, 76))                     # 바다 띠
for x in range(0, W, 7): px(im, x + rnd.randint(0, 3), 121 + rnd.randint(0, 3), (62, 92, 120))
d.rectangle([0, 160, W, H], fill=(26, 30, 40))                        # 길
for x in range(0, W, 24): d.rectangle([x, 184, x + 12, 186], fill=(70, 72, 78))
blocks = [(0, 70, 104), (64, 60, 118), (118, 52, 96), (166, 72, 112), (236, 58, 100), (290, 76, 122), (330, 50, 108)]
for x0, w, top in blocks:
    col = rnd.choice([(52, 60, 78), (60, 64, 80), (46, 54, 70), (66, 62, 72)])
    d.rectangle([x0, top, x0 + w, 160], fill=col)
    d.line([(x0, top), (x0 + w, top)], fill=tuple(min(255, c + 22) for c in col))
    d.rectangle([x0, top - 4, x0 + w, top], fill=(40, 46, 60))
    for yy in range(top + 8, 152, 14):
        for xx in range(x0 + 6, x0 + w - 8, 12):
            lit = rnd.random() < 0.45
            d.rectangle([xx, yy, xx + 6, yy + 7], fill=(236, 196, 118) if lit else (28, 34, 48))
            if lit and rnd.random() < 0.3: d.rectangle([xx, yy, xx + 6, yy + 2], fill=(250, 220, 150))
# 3층 창 하나는 따뜻한 부엌 불(다세대 주택 3층)
d.rectangle([182, 100, 196, 112], fill=(255, 210, 132)); d.line([(189, 100), (189, 112)], fill=(150, 104, 60))
for x in (30, 150, 270):  # 전봇대 · 전깃줄
    d.rectangle([x, 92, x + 2, 160], fill=(30, 26, 26)); d.rectangle([x - 8, 98, x + 10, 99], fill=(30, 26, 26))
for a, b in ((32, 152), (152, 272)):
    for t in range(0, 101):
        x = a + (b - a) * t / 100; y = 99 + 7 * math.sin(math.pi * t / 100)
        px(im, x, y, (40, 36, 40))
for x in range(0, W, 3): px(im, x, 159, (90, 92, 100))
im.save(os.path.join(OUT, 'city_scene.png'))

# ── 청암리: 당산나무 · 장승 둘 · 초가와 슬레이트 지붕 · 산비탈 ──
im, d, rnd = base(1952, (8, 14, 30), (24, 38, 52), 60)
d.polygon([(0, H)] + [(x, 86 + round(16 * math.sin(x / 50 + 1) + 4 * math.sin(x / 9))) for x in range(0, W + 6, 6)] + [(W, H)], fill=(18, 36, 44))
d.polygon([(0, H)] + [(x, 112 + round(8 * math.sin(x / 31))) for x in range(0, W + 6, 6)] + [(W, H)], fill=(26, 46, 50))
d.rectangle([0, 156, W, H], fill=(38, 44, 40))
for _ in range(220): px(im, rnd.randrange(W), rnd.randint(156, H - 1), rnd.choice([(46, 54, 46), (32, 38, 34), (52, 58, 48)]))
# 흙길
d.polygon([(170, H), (210, H), (196, 156), (184, 156)], fill=(74, 64, 52))
# 집 셋
for x0, roof in ((30, (92, 84, 70)), (92, (70, 76, 84)), (296, (96, 86, 64))):
    d.rectangle([x0, 132, x0 + 46, 156], fill=(118, 104, 86)); d.rectangle([x0 + 18, 140, x0 + 28, 156], fill=(44, 36, 30))
    d.polygon([(x0 - 6, 134), (x0 + 23, 116), (x0 + 52, 134)], fill=roof)
    d.rectangle([x0 + 34, 138, x0 + 42, 146], fill=(226, 188, 112))
# 당산나무
tx = 238
for r, c in ((44, (22, 52, 46)), (34, (34, 70, 58)), (22, (48, 90, 70))):
    d.ellipse([tx - r * 1.3, 70 - r * 0.8, tx + r * 1.3, 70 + r * 0.8], fill=c)
for _ in range(160):
    a = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(0, 52)
    px(im, tx + rr * 1.2 * math.cos(a), 70 + rr * 0.7 * math.sin(a), rnd.choice([(60, 104, 78), (28, 60, 50)]))
d.polygon([(tx - 4, 96), (tx - 12, 84), (tx - 8, 84), (tx, 94), (tx + 8, 82), (tx + 12, 82), (tx + 4, 96)], fill=(58, 44, 36))  # 가지
d.rectangle([tx - 5, 94, tx + 5, 158], fill=(58, 44, 36)); d.line([(tx - 5, 94), (tx - 5, 158)], fill=(80, 62, 48))
for y in (104, 112):  # 금줄 · 오색천
    d.line([(tx - 9, y), (tx + 9, y)], fill=(196, 170, 120))
    for k, col in enumerate([(200, 64, 56), (60, 110, 180), (230, 196, 80), (236, 236, 226), (40, 40, 40)]):
        d.rectangle([tx - 8 + k * 4, y + 1, tx - 6 + k * 4, y + 6], fill=col)
# 장승 둘
for sx, face in ((178, (176, 70, 56)), (204, (74, 70, 96))):
    d.rectangle([sx - 4, 118, sx + 4, 160], fill=(140, 116, 88)); d.rectangle([sx - 5, 114, sx + 5, 122], fill=face)
    px(im, sx - 2, 118, (20, 16, 14)); px(im, sx + 2, 118, (20, 16, 14)); d.line([(sx - 2, 121), (sx + 2, 121)], fill=(20, 16, 14))
im.save(os.path.join(OUT, 'village_scene.png'))
print('저장: city_scene.png · village_scene.png')
