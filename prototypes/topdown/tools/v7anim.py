import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
from anim import animate
ids = json.load(open('v7/ids.json'))
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']; D4 = ['south', 'east', 'north', 'west']
IDLE = 'standing at rest: the chest and shoulders rise and fall slowly and clearly, a gentle weight shift from one hip to the other, arms relaxed at the sides; no vapour, no effects'
IDLE_OLD = 'an elderly woman standing at rest: her shoulders rise and fall slowly, she sways gently and shifts her weight, hands resting in front of her; no vapour, no effects'
k, what = sys.argv[1], sys.argv[2]
def ensure(name, first, dirs, again):
    got = first[1]['post'].get('directions') or []; rest = [d for d in dirs if d not in got]
    if rest: again(rest, first[1]['post']['animation_group_id'])
    print(name, len(got), 'rest', len(rest))
if what == 'idle':
    dirs = D4 if k in ('hanru', 'household') else D8; act = IDLE_OLD if k == 'mira' else IDLE
    r = custom(f'v7_{k}_idle', ids[k], act, dirs, 12, estimate=4 * len(dirs))
    ensure(k + ' idle', r, dirs, lambda rest, g: custom(f'v7_{k}_idle_rest', ids[k], act, rest, 12, group=g, estimate=4 * len(rest)))
else:
    r = animate(f'v7_{k}_walk', ids[k], 'walking-8-frames', D8, 'skeleton-v3', estimate=32)
    ensure(k + ' walk', r, D8, lambda rest, g: animate(f'v7_{k}_walk_rest', ids[k], 'walking-8-frames', rest, 'skeleton-v3', estimate=4 * len(rest), extra={'animation_group_id': g}))
