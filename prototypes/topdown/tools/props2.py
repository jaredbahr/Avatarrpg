import sys, json
sys.path.insert(0, 'tools'); import pl
from obj import mapobj
P = {
 'tree':    ('a lush leafy oak tree, bright green canopy with yellow-green highlights on the upper left, short brown trunk, no ground', 64, 80),
 'tree2':   ('a small slender tree with pink blossoms and a thin brown trunk, standing alone with no ground tile and no base', 48, 64),
 'flowers': ('a clump of small red and yellow wildflowers with green leaves', 32, 32),
 'bridge':  ('front view of a small wooden footbridge crossing from left to right, flat plank deck seen from above, low wooden railings along its front and back edges', 64, 48),
 'bench':   ('a simple wooden bench with a backrest, front view', 32, 32),
 'pots':    ('three clay storage pots of different sizes', 32, 32),
}
for name in (sys.argv[1:] or P):
    d, w, h = P[name]
    for seed in (31, 77):
        e, r, ims = mapobj(f'prop2_{name}_{seed}', d, w, h, extra={'seed': seed}, estimate=2)
