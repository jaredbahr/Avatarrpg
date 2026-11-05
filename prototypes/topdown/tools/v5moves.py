import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
C = 'bb5c43f4-3575-4ed3-aba1-cc299bf58fcf'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
src2 = open('tools/batch2.py').read().split("n = sys.argv[1]")[0]; g2 = {}; exec(src2, g2)       # v2 IDLE / LOOK wording
g3 = {}; exec(open('tools/v3gen.py').read().split("n = sys.argv[1]")[0], g3)                       # Fire Jab wording
g4 = {}; exec(open('tools/v4gen.py').read().split("n = sys.argv[1]")[0], g4)                       # Whip / Stomp wording
JOBS = {'idle': (g2['IDLE'], D8, 12), 'look': (g2['LOOK'], ['south', 'south-east', 'south-west'], 15),
        'jab': (g3['JAB'], D8, 14), 'whip': (g4['WHIP'], D8, 14), 'stomp': (g4['STOMP'], D8, 14)}
k = sys.argv[1]; act, dirs, n = JOBS[k]
e, r = custom(f'v5C_{k}', C, act, dirs, n, estimate=4 * len(dirs))
got = r['post'].get('directions') or []; rest = [d for d in dirs if d not in got]
if rest: custom(f'v5C_{k}_rest', C, act, rest, n, group=r['post']['animation_group_id'], estimate=4 * len(rest))
print(k, len(got), 'rest', len(rest))
