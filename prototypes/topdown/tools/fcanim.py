"""Forest combat cast animations, skeleton-v3 posing like Kaya's: idle (custom), walk (walking-8-frames template), attack (custom). Four headings."""
import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
from anim import animate
ids = json.load(open('fc/ids.json')); D4 = ['south', 'east', 'north', 'west']
IDLE = 'standing at rest in a ready stance: the chest rises and falls slowly, a slight weight shift, arms relaxed; no effects'
ATK = {
 'thug': 'swings the wooden club in a big overhead arc down in front of him, stepping into the blow, then recovers to stance',
 'slinger': 'whirls the leather sling overhead once and snaps it forward, releasing a stone toward the front, then recovers to stance',
 'bruiser': 'raises the heavy cudgel high with both hands and slams it down hard onto the ground in front of him, then straightens up',
 'sura': 'a water-bending strike: sweeps both arms in one flowing circle and thrusts both open palms forward, then returns to a ready stance',
 'bo': 'an earth-bending strike: lifts the left knee high, stamps the foot down hard, then punches forward with the left fist, then returns to stance',
}
k, what = sys.argv[1], sys.argv[2]
def ensure(name, first, again):
    got = first[1]['post'].get('directions') or []; rest = [d for d in D4 if d not in got]
    if rest: again(rest, first[1]['post']['animation_group_id'])
    print(name, len(got), 'rest', len(rest))
if what == 'idle':
    r = custom(f'fc_{k}_idle', ids[k], IDLE, D4, 8, estimate=16); ensure(k + ' idle', r, lambda rest, g: custom(f'fc_{k}_idle_rest', ids[k], IDLE, rest, 8, group=g, estimate=4 * len(rest)))
elif what == 'walk':
    r = animate(f'fc_{k}_walk', ids[k], 'walking-8-frames', D4, 'skeleton-v3', estimate=16)
    ensure(k + ' walk', r, lambda rest, g: animate(f'fc_{k}_walk_rest', ids[k], 'walking-8-frames', rest, 'skeleton-v3', estimate=4 * len(rest), extra={'animation_group_id': g}))
else:
    r = custom(f'fc_{k}_attack', ids[k], ATK[k], D4, 10, estimate=16); ensure(k + ' attack', r, lambda rest, g: custom(f'fc_{k}_attack_rest', ids[k], ATK[k], rest, 10, group=g, estimate=4 * len(rest)))
