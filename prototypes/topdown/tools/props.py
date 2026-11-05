import sys, json
sys.path.insert(0, 'tools'); import pl
from obj import mapobj
P = {
 'lamp':    ('a single slim dark iron street lamp post with a small glowing lantern on top, standing alone', 32, 64),
 'barrels': ('two small wooden barrels with iron bands standing side by side', 32, 32),
 'crates':  ('two small stacked wooden crates', 32, 32),
 'well':    ('a round stone village well with a small wooden roof and a bucket on a rope', 48, 64),
 'tree':    ('a leafy round deciduous tree with a short brown trunk, lush dark green canopy', 64, 80),
 'tree2':   ('a small slender blossom tree with pink flowers and a thin trunk', 48, 64),
 'bush':    ('a small round green bush', 32, 32),
 'flowers': ('a small flower bed with red, yellow and white flowers and green leaves, flat on the ground', 32, 32),
 'bridge':  ('a short flat wooden plank footbridge with low wooden railings on both sides, seen from above at an angle, running left to right', 64, 48),
 'bench':   ('a simple wooden bench', 32, 32),
 'sign':    ('a small wooden signpost with one arrow sign', 32, 48),
 'pots':    ('three clay pots and a basket of fish', 32, 32),
}
for name in (sys.argv[1:] or P):
    d, w, h = P[name]
    e, r, ims = mapobj('prop_' + name, d, w, h, estimate=2)
    print(name, [i.size for i in ims])
