import sys
sys.path.insert(0, 'systems/story/v4')
from xlsx_plain import read_merged_speaker_ranges
from pathlib import Path
p=Path('systems/story/v4/script_v6.xlsx')
m=read_merged_speaker_ranges(p,'스토리 스크립트')
assert m[109]=='윤진서'
assert 110 not in m
assert m[112]=='양호 선생'
assert 113 not in m
print('speaker merge test OK')
