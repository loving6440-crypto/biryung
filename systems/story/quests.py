# -*- coding: utf-8 -*-
"""quests_vol*.txt → 장면 퀘스트 · 단계. 장면 스크립트(parse.py)와 맞춰 본다."""
STATUS_RANK = {'●': 0, '◐': 1, '○': 2, '☁': 3}
def parse_quests(paths, scenes, lines):
    by_id = {s['id']: s for s in scenes}
    n_lines = {s['id']: 0 for s in scenes}
    for l in lines: n_lines[l['scene']['id']] += 1
    quests, errs, cur = {}, [], None
    for path in paths:
        for i, raw in enumerate(open(path, encoding='utf8'), 1):
            line = raw.rstrip('\n'); where = f'{path}:{i}'
            if not line.strip() or line.startswith('#'): continue
            if line.startswith('= '):
                f = [x.strip() for x in line[2:].split('|')]
                if len(f) != 4: errs.append(f'{where} 퀘스트 머리 칸 수 {len(f)}'); continue
                if f[0] not in by_id: errs.append(f'{where} 없는 장면 {f[0]}'); continue
                if f[0] in quests: errs.append(f'{where} 퀘스트 중복 {f[0]}'); continue
                cur = quests[f[0]] = dict(id=f[0], unlock=f[1], post=f[2], reward=f[3], steps=[], scene=by_id[f[0]]); continue
            if line.startswith('@'):
                f = [x.strip() for x in line[1:].split('|')]
                if len(f) != 9: errs.append(f'{where} 단계 칸 수 {len(f)}: {line[:50]}'); continue
                start = None if f[0] == '-' else int(f[0])
                if start is not None and not (1 <= start <= n_lines[cur['id']]): errs.append(f'{where} {cur["id"]} 줄 {start} 범위 밖(1~{n_lines[cur["id"]]})')
                if f[8] not in STATUS_RANK: errs.append(f'{where} 상태 기호 {f[8]}')
                cur['steps'].append(dict(start=start, type=f[1], place=f[2], act=f[3], cond=f[4], done=f[5], uses=f[6],
                                         new=[t.strip() for t in f[7].split(',') if t.strip()], status=f[8])); continue
            errs.append(f'{where} 알 수 없는 줄: {line[:40]}')
    for s in scenes:
        if s['id'] not in quests: errs.append(f'퀘스트 없는 장면 {s["id"]}'); continue
        q = quests[s['id']]
        starts = [st['start'] for st in q['steps'] if st['start'] is not None]
        if n_lines[s['id']] and (not starts or starts[0] != 1): errs.append(f'{s["id"]} 첫 대사 단계가 1번 줄에서 시작하지 않는다 {starts}')
        if starts != sorted(starts) or len(set(starts)) != len(starts): errs.append(f'{s["id"]} 대사 단계 순서 오류 {starts}')
    # 대사 줄 → 단계 번호
    line_step = {}
    for sid, q in quests.items():
        for k, st in enumerate(q['steps'], 1): st['no'] = k
        own = [l for l in lines if l['scene']['id'] == sid]
        numbered = [st for st in q['steps'] if st['start'] is not None]
        for idx, l in enumerate(own, 1):
            cand = [x for x in numbered if x['start'] <= idx]
            if not cand: errs.append(f'{sid} 줄 {idx} 에 단계가 없다'); continue
            st = cand[-1]
            line_step[id(l)] = st; st.setdefault('lines', []).append(l)
        q['status'] = max((st['status'] for st in q['steps']), key=STATUS_RANK.get)
    return quests, line_step, errs
if __name__ == '__main__':
    from parse import parse
    s, r, e = parse(['script_vol1.txt', 'script_vol2.txt', 'script_vol3.txt'])
    q, ls, e2 = parse_quests(['quests_vol1.txt', 'quests_vol2.txt', 'quests_vol3.txt'], s, r)
    print('퀘스트', len(q), '단계', sum(len(x['steps']) for x in q.values()), '대사 연결', len(ls), '/', len(r))
    print('\n'.join(e + e2) or '오류 없음')
    import collections
    print(collections.Counter(x['status'] for x in q.values()), collections.Counter(st['status'] for x in q.values() for st in x['steps']))
    tags = collections.Counter(t.split(':')[0] for x in q.values() for st in x['steps'] for t in st['new']); print(tags)
