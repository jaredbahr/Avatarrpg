import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom, WALK   # WALK = v2's exact action description
IDS = {'A': 'c0142415-d712-4369-9475-93fa1468f24a', 'B': '25966c66-4235-43fb-9c31-ad35615572c6', 'C': 'bb5c43f4-3575-4ed3-aba1-cc299bf58fcf'}
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
A = WALK + '; a narrow graceful gait with the feet landing close to one line, a soft arm swing close to the body, an upright posture'
k = sys.argv[1]
e, r = custom(f'v5_walk_{k}', IDS[k], A, D8, 12, estimate=32)
got = r['post'].get('directions') or []
rest = [d for d in D8 if d not in got]
if rest: custom(f'v5_walk_{k}_rest', IDS[k], A, rest, 12, group=r['post']['animation_group_id'], estimate=32)
print(k, 'first', len(got), 'rest', len(rest))
