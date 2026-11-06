import sys; sys.path.insert(0, 'tools')
from obj import mapobj
P = {
 'mira_table':   ('a low wooden table with bowls of rice and a clay teapot, front view', 80, 48),
 'market_a':     ('a wooden market table with baskets of vegetables and fruit, front view', 80, 56),
 'market_b':     ('a wooden market table with clay jars and folded cloth bolts, front view', 80, 56),
 'garden_plot':  ('a small vegetable garden plot seen from above at an angle, rows of green cabbages and leeks in dark tilled soil, low wooden edging', 112, 72),
 'notice_board': ('a small wooden village notice board on two posts with pinned paper notes', 48, 64),
 'handcart':     ('a wooden handcart with two wheels loaded with grain sacks', 96, 64),
 'laundry_line': ('a laundry line strung between two wooden posts with hanging cloths', 80, 64),
 'fence':        ('a short low wooden picket fence section', 64, 40),
 'stone_lantern':('a small grey stone garden lantern', 32, 48),
 'trough':       ('a wooden water trough filled with hay', 64, 40),
 'planter':      ('a long low wooden planter box with flowers and herbs', 64, 40),
 'banner_pole':  ('a tall wooden pole with a long hanging red cloth banner', 32, 96),
}
k = sys.argv[1]; d, w, h = P[k]
for seed in (5, 9):
    mapobj(f'v7_prop_{k}_{seed}', d, w, h, extra={'seed': seed}, estimate=2)
