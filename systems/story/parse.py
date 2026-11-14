# -*- coding: utf-8 -*-
"""script_vol*.txt → 장면 · 줄 목록. 형식 오류가 있으면 멈춘다."""
import re
VOL_OF = lambda ch: 1 if ch <= 5 else 2 if ch <= 10 else 3
TYPES = {'지문', '대사', '비령', '회상', '독백', '선택', '전투', '조사', '시스템', '퀘스트'}
def parse(paths):
    scenes, rows, errs = [], [], []
    ch = None; sc = None
    for path in paths:
        for n, raw in enumerate(open(path, encoding='utf8'), 1):
            line = raw.rstrip('\n')
            if not line.strip(): continue
            where = f'{path}:{n}'
            if line.startswith('# '):
                ch = int(line[2:].strip()); continue
            if line.startswith('= '):
                f = line[2:].split('|')
                if len(f) != 5: errs.append(f'{where} 장면 머리 칸 수 {len(f)}'); continue
                sc = dict(zip(['id', 'title', 'place', 'time', 'link'], [x.strip() for x in f]), ch=ch, vol=VOL_OF(ch))
                if not sc['id'].startswith(f'{ch}-'): errs.append(f'{where} 장면 ID {sc["id"]} 가 {ch}장이 아니다')
                scenes.append(sc); continue
            f = line.split('|')
            if len(f) != 6: errs.append(f'{where} 줄 칸 수 {len(f)}: {line[:40]}'); continue
            t, who, text, direc, cond, res = [x.strip() for x in f]
            if t not in TYPES: errs.append(f'{where} 모르는 유형 {t}')
            if not text: errs.append(f'{where} 내용이 비었다')
            if sc is None: errs.append(f'{where} 장면 밖의 줄'); continue
            rows.append(dict(scene=sc, type=t, who=who, text=text, direc=direc, cond=cond, res=res))
    ids = [s['id'] for s in scenes]
    for i in set(ids):
        if ids.count(i) > 1: errs.append(f'장면 ID 중복 {i}')
    return scenes, rows, errs
if __name__ == '__main__':
    import collections
    s, r, e = parse(['script_vol1.txt', 'script_vol2.txt', 'script_vol3.txt'])
    print('장면', len(s), '줄', len(r)); print('\n'.join(e) or '형식 오류 없음')
    c = collections.Counter(x['scene']['ch'] for x in r); print(dict(sorted(c.items())))
    w = collections.Counter(x['who'] for x in r if x['who'] in ('AB','BC','CD','DE','EF','비령','PC')); print(w)
