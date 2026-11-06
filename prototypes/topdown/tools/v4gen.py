import sys, json; sys.path.insert(0, 'tools'); import pl
from anim2 import custom
K = '977535f6-c1b6-4a2f-999c-ffea3a9ba289'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
WALK = ('a light, graceful walk for a slender young woman: upright posture with the chest lifted, narrow steps placing one foot almost in front of the other, '
        'a subtle sway of the hips from side to side, the arms swinging softly and close to the body with relaxed hands, a calm even rhythm; '
        'natural and understated, not a catwalk; the coat hem and ponytail sway gently')
WHIP = ('a fire-bending whip: from a low ready stance she draws her right arm back across her body, then sweeps it out in a wide horizontal arc '
        'from one side to the other in front of her with the arm extended and the hand open, following through with the shoulders and stepping into it, '
        'then recovers to a ready stance; the coat hem and ponytail swing with the sweep')
STOMP = ('a fire-bending ground stomp: she draws both fists up to her chest and lifts one knee high, drops into a wide low horse stance and stamps the foot down hard '
         'while punching both fists down toward the ground, holds the low stance for a moment, then rises back to standing; the coat hem flares out on the landing')
n = sys.argv[1]
if n == 'walk': custom('v4_kaya_walk', K, WALK, D8, 12, estimate=32)
if n == 'whip': custom('v4_kaya_whip', K, WHIP, D8, 14, estimate=32)
if n == 'stomp': custom('v4_kaya_stomp', K, STOMP, D8, 14, estimate=32)
if n.startswith('vfx'):
    D = {
     'vfx_whip': ('a sweeping crescent of fire, like a whip of flame swung in a wide arc to the right: a curved band of orange and yellow flame that sweeps '
                  'from top to bottom along a half-circle about 80 pixels across, bright yellow leading edge, red fading tail, breaking into sparks at the end; '
                  'about 8 frames, one-shot; pixel art, crisp, no anti-aliasing; fits in 96x96'),
     'vfx_ring': ('a ring of fire spreading outward on the ground seen from a low top-down angle: an ellipse about twice as wide as it is tall that starts small '
                  'at the centre and expands outward as a band of orange and yellow flame tongues, then thins into embers and fades; about 10 frames, one-shot; '
                  'pixel art, crisp, no anti-aliasing; fits in 128x80'),
    }
    e, r = pl.run('/vfx', {'description': D[n], 'artist': 'lite', 'name': n}, 'v4_' + n, estimate=4)
    print(json.dumps(pl.strip(r['final'].get('last_response') or r['final']))[:700])
