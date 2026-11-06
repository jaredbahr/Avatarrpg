import sys; sys.path.insert(0, 'tools')
from anim import animate
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
K = '7da9ce22-d54e-4c80-919a-6d232f8a8cb3'; SH = '0f26a0be-dc3d-44ac-83df-4ece186de99e'; V = '7e651728-9398-4b8f-8927-cabdbc79b1f1'
jobs = {
 'kaya_walk': (K, 'walking-8-frames', [d for d in D8 if d != 'south'], {'animation_group_id': 'a46ed49a-4d98-49b5-9843-7cd56541f5d4'}),
 'kaya_idle': (K, 'breathing-idle', D8, {}),
 'villager_walk': (V, 'walking-8-frames', D8, {}),
 'shop_idle': (SH, 'breathing-idle', D8, {}),
}
n = sys.argv[1]; cid, t, dirs, ex = jobs[n]
e, r = animate(n, cid, t, dirs, 'skeleton-v3', estimate=3 * len(dirs), extra=ex)
print(n, e['status'], e['credits'])
