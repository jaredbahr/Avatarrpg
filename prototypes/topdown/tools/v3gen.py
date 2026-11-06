import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
K = '977535f6-c1b6-4a2f-999c-ffea3a9ba289'
JAB = ('a martial-arts fire punch: she starts in a guard stance with fists up, winds up by pulling her right fist back to the hip and turning the shoulders, '
       'then steps forward and punches straight ahead with the right arm fully extended at shoulder height, holds the extended punch for a moment, '
       'then pulls the arm back and returns to the guard stance; the coat hem and ponytail swing with the motion')
n = sys.argv[1]
if n == 'jab': custom('v3_kaya_firejab', K, JAB, ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'], 14, estimate=32)
if n == 'dummy':
    from obj import mapobj
    for seed in (5, 9): mapobj(f'v3_dummy_{seed}', 'a straw training dummy on a wooden post with a cross-bar for arms, burlap sack head, rope bindings, front view', 48, 80, extra={'seed': seed}, estimate=2)
if n.startswith('vfx'):
    D = {
     'vfx_burst': 'a short burst of fire from a fist, like a punch launching flame: a bright yellow-white core flash that blooms into orange and red flame tongues pointing to the right, then breaks into a few embers; about 6 frames; pixel art, crisp, no anti-aliasing; small, fits in 48x48',
     'vfx_ball': 'a small fireball projectile flying to the right: bright yellow core, orange and red flickering flames trailing to the left, a few sparks; seamless loop of about 6 frames; pixel art, crisp, no anti-aliasing; fits in 32x32',
     'vfx_embers': 'a small fireball dissipating: the flame puffs apart into a few orange embers and a little grey smoke that drift upward and fade out; about 8 frames; pixel art, crisp, no anti-aliasing; fits in 32x32',
    }
    e, r = pl.run('/vfx', {'description': D[n], 'artist': 'lite', 'name': n}, 'v3_' + n, estimate=3)
    print(json.dumps(pl.strip(r['final'].get('last_response') or r['final']))[:1500])
