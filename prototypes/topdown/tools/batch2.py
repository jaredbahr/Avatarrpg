import sys; sys.path.insert(0, 'tools')
from anim2 import custom, WALK
from anim import animate
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
K = '977535f6-c1b6-4a2f-999c-ffea3a9ba289'; SH = 'f63b0ad9-f8c7-41ac-a6ea-cd5deb78845a'; V = 'eca3f2ea-9a35-411c-b35e-d0765699cd5e'; C = '8aea70b4-d191-4ca9-bf31-1c1ee48c240d'
IDLE = ('standing at rest and breathing: the chest and shoulders rise and fall clearly with each slow breath, a gentle weight shift from one hip to the other, '
        'arms relaxed at the sides, the ponytail and coat hem sway slightly')
IDLE_OLD = ('an elderly woman standing at rest and breathing slowly: shoulders rise and fall clearly, she sways gently and shifts her weight, hands resting in front of her apron')
LOOK = ('standing still, she turns her head and shoulders to look to her left, pauses, then looks to her right, then returns to face forward, the ponytail swings as she turns')
VWALK = ('a relaxed natural walking cycle: the body rises and falls with each step, weight shifts from foot to foot, arms swing gently forward and back opposite the legs and stay close to the body')
n = sys.argv[1]; N = 'v2_' + n
if n == 'kaya_walk': custom(N, K, WALK, ['south-east', 'north', 'north-west', 'west', 'south-west'], 12, group='e7f0ee4c-f93e-4573-8c79-ec2e0e0b5904')
if n == 'kaya_idle': custom(N, K, IDLE, D8, 12)
if n == 'kaya_look': custom(N, K, LOOK, ['south', 'south-east', 'south-west'], 15)
if n == 'vill_walk': custom(N, V, VWALK, D8, 12)
if n == 'vill_idle': custom(N, V, IDLE.replace(', the ponytail and coat hem sway slightly', ''), ['south', 'east', 'west'], 12)
if n == 'shop_idle': custom(N, SH, IDLE_OLD, D8, 12)
if n == 'cat_walk': animate(N, C, 'walk-8-frames', ['east', 'west'], 'skeleton-v3', estimate=8)
if n == 'cat_sit': animate(N, C, 'seated-on-belly-idle', ['south-west'], 'skeleton-v3', estimate=4)
