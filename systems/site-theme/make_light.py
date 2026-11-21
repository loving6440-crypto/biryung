# -*- coding: utf-8 -*-
"""비령 vD.06.1 화이트 모드 — styles.css(어두운 화면)에서 색만 뽑아 밝은 화면용 덮개(theme-light.css)를 만든다.

  python3 systems/site-theme/make_light.py        (저장소 맨 위에서)

· 어두운 바탕 → 아주 희미한 녹색이 도는 백색, 밝은 글자(크림) → 짙은 녹색.
· 금색 강조 → 녹색, 붉은 강조 → 그대로 적색 계열, 청록 · 남색 → 밝은 바탕에 맞게 어둡게.
· 모든 규칙은 html[data-theme="light"] 아래에서만 적용된다. 그림이 깔린 자리(배너 · 구역 그림)는 건드리지 않는다.
styles.css 를 고친 뒤에는 이것을 다시 돌린다(npm run build 가 함께 돌린다).
"""
import colorsys, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'styles.css')
OUT = os.path.join(ROOT, 'theme-light.css')
P = 'html[data-theme="light"]'
SKIP_SEL = re.compile(r'hero|zone-art|zone-card|canopy|opening|is-red|lantern|pt-seal|portrait|vn-flash|fx-')
COLOR_PROPS = re.compile(r'^(--[\w-]+|color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration(-color)?|column-rule(-color)?|scrollbar-color)$')
TOKEN = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')


def clamp(v, a, b):
    return max(a, min(b, v))


def light(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hd = h * 360
    if l < 0.3:                                  # 어두운 바탕 · 그림자 → 희미한 녹색 백색
        h2, l2, s2 = 105, 0.965 - l * 0.28, 0.3
    elif l > 0.72 and s < 0.75:                  # 밝은 글자 · 크림 → 짙은 녹색
        h2, l2, s2 = 140, 0.13 + (1 - l) * 0.55, 0.32
    elif s < 0.14:                               # 가운데 회색 → 녹회색
        h2, l2, s2 = 125, clamp(1 - l, 0.28, 0.72), 0.12
    elif 22 <= hd < 72:                          # 금 · 황 · 주황 → 녹색 강조
        h2, l2, s2 = 145, clamp(1 - l, 0.28, 0.5), clamp(s, 0.32, 0.55)
    elif hd < 22 or hd >= 330:                   # 적 · 연지 → 적색 강조
        h2, l2, s2 = hd, clamp(1 - l * 0.9, 0.38, 0.55), max(s, 0.5)
    else:                                        # 청록 · 남 · 녹 · 보라
        h2, l2, s2 = hd, clamp(1 - l, 0.28, 0.55), clamp(s, 0.25, 0.6)
    rr, gg, bb = colorsys.hls_to_rgb(h2 / 360, l2, s2)
    return round(rr * 255), round(gg * 255), round(bb * 255)


def conv(tok):
    t = tok.lower()
    a = None
    if t.startswith('#'):
        hx = t[1:]
        if len(hx) in (3, 4):
            hx = ''.join(c * 2 for c in hx)
        r, g, b = int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16)
        if len(hx) == 8:
            a = int(hx[6:8], 16) / 255
    else:
        nums = re.findall(r'[\d.]+%?', t)
        if len(nums) < 3:
            return tok
        r, g, b = [float(n[:-1]) * 2.55 if n.endswith('%') else float(n) for n in nums[:3]]
        if len(nums) > 3:
            a = float(nums[3][:-1]) / 100 if nums[3].endswith('%') else float(nums[3])
    r2, g2, b2 = light(r, g, b)
    if a is None:
        return '#%02x%02x%02x' % (r2, g2, b2)
    return 'rgba(%d,%d,%d,%s)' % (r2, g2, b2, ('%.3f' % a).rstrip('0').rstrip('.') or '0')


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def blocks(css):
    """(머리, 몸) 목록. 몸이 None 이면 `@import …;` 같은 한 줄."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        k = css.find(';', i)
        if j < 0:
            break
        if 0 <= k < j and css[i:k].strip().startswith('@'):
            i = k + 1
            continue
        depth, m = 1, j + 1
        while m < n and depth:
            if css[m] == '{':
                depth += 1
            elif css[m] == '}':
                depth -= 1
            m += 1
        out.append((css[i:j].strip(), css[j + 1:m - 1]))
        i = m
    return out


def scope(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([':
            depth += 1
        if ch in ')]':
            depth -= 1
        if ch == ',' and not depth:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    res = []
    for p in (x.strip() for x in parts):
        if not p or SKIP_SEL.search(p):
            continue
        if p in (':root', 'html'):
            res.append(P)
        elif p.startswith(':root'):
            res.append(P + p[5:])
        elif p.startswith('html'):
            res.append(P + p[4:])
        else:
            res.append(f'{P} {p}')
    return ','.join(res)


def decls(body):
    out = []
    for d in re.split(r';(?![^(]*\))', body):
        if ':' not in d:
            continue
        prop, val = d.split(':', 1)
        prop = prop.strip()
        if not COLOR_PROPS.match(prop) or not TOKEN.search(val) or 'url(' in val:
            continue
        if prop.startswith('--') and prop in ('--serif', '--pixel'):
            continue
        out.append(f'{prop}:{TOKEN.sub(lambda m: conv(m.group(0)), val.strip())}')
    return ';'.join(out)


def walk(css):
    out = []
    for head, body in blocks(css):
        if head.startswith('@media') or head.startswith('@supports'):
            inner = walk(body)
            if inner:
                out.append(f'{head}{{{inner}}}')
            continue
        if head.startswith('@'):
            continue
        sel, d = scope(head), decls(body)
        if sel and d:
            out.append(f'{sel}{{{d}}}')
    return '\n'.join(out)


EXTRA = f"""
/* 손으로 고른 몇 가지 */
{P}{{color-scheme:light}}
{P} body{{background:radial-gradient(ellipse at 50% 0%,#ffffff 0%,#f4f9f1 45%,#e9f2e6 100%)}}
{P} ::selection{{background:#bfe0c8;color:#16301f}}
"""

if __name__ == '__main__':
    css = strip_comments(open(SRC, encoding='utf-8').read())
    body = walk(css)
    open(OUT, 'w', encoding='utf-8').write('/* 직접 고치지 말 것 — systems/site-theme/make_light.py 가 styles.css 에서 만든다. 화이트 모드: 희미한 녹색 백색 + 녹색 · 적색 강조 */\n' + body + '\n' + EXTRA)
    print('theme-light.css', round(os.path.getsize(OUT) / 1024), 'KB')
