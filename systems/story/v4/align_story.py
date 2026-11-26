"""Align a revised story sheet to prior screenplay event IDs without losing inserted dialogue.
Preserves the established story trigger / choice / presentation coordinates.
"""
import difflib
from collections import defaultdict


def group(rows):
    groups=defaultdict(list)
    scene=''; ch=''
    for row, data in rows:
        if data[2]: ch=str(data[2]).strip().split('\n')[0]
        if data[3]: scene=str(data[3]).strip()
        if not scene: continue
        if not any(data[k] for k in (4,5,6,7)):continue
        groups[scene].append((row,data))
    return groups


def similarity(a, b):
    u, v = a[1], b[1]
    txt1 = str(u[5] or '').strip()
    txt2 = str(v[5] or '').strip()
    ratio = difflib.SequenceMatcher(None, txt1[:400], txt2[:400], autojunk=False).ratio() if txt1 or txt2 else 0
    score = 3 * ratio - 1.3
    a_char = (u[4] or '').strip(); b_char=(v[4] or '').strip()
    if a_char == b_char: score += .38
    elif a_char == 'PC' or b_char == 'PC': score -= 1.7
    else: score -= .18
    a_trigger = (u[6] or '').strip(); b_trigger=(v[6] or '').strip()
    if a_trigger and b_trigger:
        score += 1.7 if a_trigger == b_trigger else -.9
    elif bool(a_trigger) != bool(b_trigger):score -= .9
    if (u[3] or '').strip() and (v[3] or '').strip() and (u[3] or '').strip() == (v[3] or '').strip(): score += 2
    return score


def align_block(old,new):
    n,m=len(old),len(new)
    dp=[[0.0]*(m+1) for _ in range(n+1)]
    path=[[None]*(m+1) for _ in range(n+1)]
    penalty=-0.75
    for i in range(1,n+1):dp[i][0]=dp[i-1][0]+penalty;path[i][0]='old'
    for j in range(1,m+1):dp[0][j]=dp[0][j-1]+penalty;path[0][j]='new'
    for i in range(1,n+1):
        for j in range(1,m+1):
            opts=[(dp[i-1][j-1]+similarity(old[i-1],new[j-1]),'match'),(dp[i-1][j]+penalty,'old'),(dp[i][j-1]+penalty,'new')]
            dp[i][j],path[i][j]=max(opts,key=lambda x:x[0])
    pairs=[]
    i,j=n,m
    while i or j:
        flag=path[i][j]
        if flag=='match':pairs.append((old[i-1][0],new[j-1][0]));i-=1;j-=1
        elif flag=='old':i-=1
        elif flag=='new':j-=1
        else:raise ValueError((i,j,flag))
    return list(reversed(pairs))


def legacy(i):
    # Historical script generator inserted three rows at 119-121 (vD.06).
    if i >= 122: return i - 3
    if 119 <= i <= 121: return 118 + (i-118)/10
    return i


def row_alignment(old_rows,new_rows):
    old=group(old_rows); new=group(new_rows)
    if set(k for k,v in new.items() if v) - set(old):
        raise ValueError('New scenes lack metadata: ' + str(sorted(set(new)-set(old))))
    result={}
    stats={}
    for scene, new_block in new.items():
        old_block=old.get(scene,[])
        pairs=align_block(old_block,new_block)
        matchmap={n:legacy(o) for o,n in pairs}
        # Extra new lines receive fractional row IDs, preserving their position while
        # ensuring they are NOT mistaken for old indexed FX/choice events.
        idx=[(i,r) for i,(r,_) in enumerate(new_block)]
        for i,(row,data) in enumerate(new_block):
            if row in matchmap:result[row]=matchmap[row];continue
            left=next((matchmap[new_block[k][0]] for k in range(i-1,-1,-1) if new_block[k][0] in matchmap),None)
            right=next((matchmap[new_block[k][0]] for k in range(i+1,len(new_block)) if new_block[k][0] in matchmap),None)
            if left is None and right is None: raise ValueError('Could not align scene '+scene)
            if left is None: value=right - (i+1)*.0001
            elif right is None: value=left + (i+1)*.0001
            else: value=left + (right-left)*.0001*(i+1)/len(new_block)
            result[row]=value
        stats[scene]={'old':len(old_block),'new':len(new_block),'matched':len(pairs)}
    return result,stats
