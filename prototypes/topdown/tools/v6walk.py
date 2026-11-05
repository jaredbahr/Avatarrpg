import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
from anim import animate
K = '977535f6-c1b6-4a2f-999c-ffea3a9ba289'   # v2 Kaya, unchanged
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
TAIL = ', the coat hem and ponytail sway and trail with the motion'   # kept from v2's wording (not about posture)
T = {
 'a': ('a casual, easy walking cycle: the shoulders are loose and relaxed and drop slightly, a slight natural forward lean from the hips, '
       'the arms hang and swing loosely and naturally with soft elbows, a soft bend at the knees on each step, the body rises and falls gently' + TAIL),
 'b': ('a light, confident stroll: a relaxed torso with a gentle counter-rotation of the shoulders against the hips on each step, '
       'a natural head bob, loose wrists and an easy arm swing, unhurried and comfortable, weight rolling smoothly from foot to foot' + TAIL),
}
k = sys.argv[1]
if k in T:
    e, r = custom(f'v6_walk_{k}', K, T[k], D8, 12, estimate=32)
    got = r['post'].get('directions') or []; rest = [d for d in D8 if d not in got]
    if rest: custom(f'v6_walk_{k}_rest', K, T[k], rest, 12, group=r['post']['animation_group_id'], estimate=4 * len(rest))
else:
    e, r = animate('v6_walk_c', K, 'walking-8-frames', D8, 'skeleton-v3', estimate=32)
    got = r['post'].get('directions') or []; rest = [d for d in D8 if d not in got]
    if rest: animate('v6_walk_c_rest', K, 'walking-8-frames', rest, 'skeleton-v3', estimate=4 * len(rest), extra={'animation_group_id': r['post']['animation_group_id']})
print(k, len(got), 'rest', len(rest))
