"""Polish step: ground the trees. Each listed trunk foot (world px) gets one Pro Flash inpaint over its base: the root
spread (brown root pixels joined to the foot, beyond a small core) and the core itself, so the generator redraws the
trunk's flare as short roots sinking into soil, with grass, earth and a contact shade, and the ground around it runs on.
Roots longer than the job's 236 px window are cleared by a second ground-only inpaint."""
import colorsys
from polishlib import *

# trunk feet in world px, and the half-width of the root spread to look for (judged on the world image, 2026-10-27)
FEET = {
    'court-5-5': (1230, 447, 70),
    'canal-nw': (842, 322, 95), 'canal-w': (640, 428, 90),
    'rim-n1': (1048, 218, 70), 'rim-n2': (1110, 190, 60), 'rim-n3': (1200, 178, 70), 'rim-n4': (1290, 178, 70),
    'rim-n5': (1350, 180, 60), 'rim-n6': (1440, 198, 75),
    'rim-sw': (440, 693, 110), 'rim-w1': (92, 842, 70), 'rim-w2': (190, 865, 60),
    'rim-se2': (2840, 1075, 100),
}
PROMPT = ('Redraw the foot of the tree trunk and the ground around it: the trunk flares into three or four short thick roots that '
          'sink into the soil within a few pixels of the trunk, no long roots running over the ground; tufts of grass, a few small '
          'ferns and a little bare dark earth hug the base; a soft dark contact shadow on the ground at the lower right of the '
          'trunk; the grass, the dirt path, the paving and the stone canal bank around it continue unchanged. ' + STYLE +
          '. No people, no objects.')
GROUND_PROMPT = ('Fill the masked area with the ground around it (grass, dirt path, paving stones or the stone canal bank), '
                 'continuing their lines and colours, calm, 1 px marks and 3-4 flat tones. ' + STYLE + '. No roots, no objects, no people.')

def woody(rgb):
    a = rgb.astype(np.float32) / 255
    mx, mn = a.max(-1), a.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    brown = (hue >= 12) & (hue <= 45) & (s > 0.3) & (mx > 0.2)
    ink = mx < 0.17
    return brown | ink

def flood(seed, allowed):
    from collections import deque
    out = np.zeros_like(allowed); q = deque()
    for y, x in zip(*np.nonzero(seed & allowed)): out[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < out.shape[0] and 0 <= nx < out.shape[1] and allowed[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    return out

def masks(world, ids, fx, fy, spread):
    shape = ids.shape
    trees = np.isin(ids, [piece_index(p) for p in TREE_IDS])
    free = (ids == 0) | trees
    core = ellipse(shape, fx, fy - 2, 34, 14) | (ellipse(shape, fx, fy - 18, 24, 22) & trees)
    if spread == 0:
        return core & free, np.zeros(shape, bool)
    # the root spread is what the trees' frozen silhouettes own in a low band around the foot (they trace the roots)
    win = ellipse(shape, fx, fy + 4, spread, max(18, spread * 0.4)) & (np.mgrid[:shape[0], :shape[1]][0] > fy - 24)
    m = (core | dilate(win & trees, 2)) & free
    centre = m.copy(); centre[:, :max(0, fx - 112)] = False; centre[:, fx + 112:] = False
    return centre, m & ~centre

# a retry after a rejected first job (the sheet): its own seed and a sentence against what the first one invented
SEED = {'canal-w': 12, 'rim-sw': 12}
EXTRA = {'canal-w': ' No garden bed, no furrows, no fence, no planks.', 'rim-sw': ' No crates, no boxes, no tools on the ground.'}
PICK = {}  # which of a job's two outputs is taken (judged on the before/after sheet)

TREE_IDS = [p['id'] for p in json.load(open('art/source/ba-dan-regions/geometry/scene.json'))['pieces'] if p['id'].startswith('tree')]

def apply(world, only=None, dry=None):
    ids = ids_world()
    cleared = np.zeros(ids.shape, bool)
    for name, (fx, fy, spread) in FEET.items():
        if only and name not in only: continue
        c, rest = masks(world, ids, fx, fy, spread)
        if dry is not None:
            dry.append((name, fx, fy, c, rest)); continue
        seed = SEED.get(name, 11)
        world = inpaint(world, c, f'p1-root-{name}' + (f'-s{seed}' if seed != 11 else ''),
                        PROMPT + EXTRA.get(name, ''), seed=seed, pick=PICK.get(name, 0))
        for k, part in enumerate(split(rest)):
            world = inpaint(world, part, f'p1-root-{name}-g{k}', GROUND_PROMPT)
        cleared |= c | rest
    for name, (cx, cy, rx, ry) in TOUCH.items():  # what a root job invented beside the tree, filled as ground
        if only or dry is not None: continue
        m = ellipse(ids.shape, cx, cy, rx, ry) & (ids == 0) | ellipse(ids.shape, cx, cy, rx, ry) & np.isin(ids, [piece_index(p) for p in TREE_IDS])
        world = inpaint(world, m, f'p1-touch-{name}', 'Plain grass lawn continuing the grass around it. ' + GROUND_PROMPT, seed=13)
        cleared |= m
    return world, cleared

TOUCH = {'rim-sw-stump-s13': (543, 700, 30, 20)}

def split(m):
    """Connected parts of a mask, each a separate job."""
    out = []
    if not m.any(): return out
    seen = np.zeros_like(m)
    for y, x in zip(*np.nonzero(m)):
        if seen[y, x]: continue
        seedm = np.zeros_like(m); seedm[y, x] = True
        comp = flood(seedm, m); seen |= comp
        if comp.sum() > 30: out.append(comp)
    return out
