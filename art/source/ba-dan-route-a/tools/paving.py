"""Polish step: paving in one even hand. The courts and roads carried pink squares, lighter and smudged patches (cleared
pieces, a post that stood on the east road) and mid-scale blotches from the restyle. Deterministic, no PixelLab:

1. Hand-listed defects (a ghost post, smears) are refilled from the paving a whole number of tiles away (`props_set._clone`),
   so the flag joints run on.
2. On every plain paving flag (no piece owns it; joints excluded), the mid-scale tone (between `FINE` and `BROAD` world px)
   is taken out by `EVEN`, and the broad tone is pulled toward the paving's median by `PULL`; every 1-2 px mark and every
   joint is kept."""
from polishlib import *
from ground import materials
from props_set import _clone

FINE, BROAD, EVEN, PULL = 3.0, 26.0, 0.8, 0.6
# world px polygons of paving defects that a tone pass cannot mend (judged at 4x on the world)
DEFECTS = {  # inpainted as paving (Pro Flash), then calmed with the rest
    'east-road-ghost-post': [(1700, 900), (1754, 900), (1754, 940), (1700, 940)],
    'east-road-ghost-line': [(1722, 916), (1730, 916), (1730, 982), (1722, 982)],
    'east-road-smudge': [(1668, 870), (1690, 870), (1690, 897), (1668, 897)],
}
PAVE = ('Fill the masked area with the paving around it: even squared stone flags in one warm grey-beige with crisp dark joints '
        'and a little moss, continuing the joint lines exactly. ' + STYLE + '. No objects, no posts, no shadows, no people.')

def paving_mask(world, ids):
    pav, grass, water = materials(np.asarray(world))
    area = erode(dilate(pav, 2), 2) & (ids == 0) & ~dilate(water, 2)
    return pav & area, area

def even(world, ids, keep=None):
    a = np.asarray(world).astype(np.float32)
    flags, area = paving_mask(world, ids)
    if keep is not None: flags &= ~keep
    w = flags.astype(np.float32)
    def nb(sig):
        den = gauss(w, sig)
        return np.stack([gauss(a[..., c] * w, sig) for c in range(3)], -1) / np.maximum(den, 1e-3)[..., None], den
    fine, _ = nb(FINE); broad, den = nb(BROAD)
    target = np.median(a[flags], axis=0)
    out = a - EVEN * (fine - broad) + PULL * (target - broad)
    # near a flag area's edge (grass, a wall, a piece) the means are one-sided: fade the correction out there
    trust = np.clip(den * 3 - 0.5, 0, 1)[..., None]
    a = np.where(flags[..., None], a + (out - a) * trust, a)
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))

def label(m, max_iter=2000):
    """Connected components of a bool mask (4-neighbour), numpy only: every pixel takes the largest index among itself
    and its neighbours until nothing changes. 0 is background."""
    lab = np.where(m, np.arange(1, m.size + 1, dtype=np.int64).reshape(m.shape), 0)
    for _ in range(max_iter):
        n = lab.copy()
        n[1:] = np.maximum(n[1:], lab[:-1]); n[:-1] = np.maximum(n[:-1], lab[1:])
        n[:, 1:] = np.maximum(n[:, 1:], lab[:, :-1]); n[:, :-1] = np.maximum(n[:, :-1], lab[:, 1:])
        n = np.where(m, n, 0)
        if np.array_equal(n, lab): break
        lab = n
    return lab

JOINT_DROP, JOINT_GREEN = 22, 8   # a joint is darker than the paving around it (or greenish and a little darker)
CALM = 0.45                       # how much of a flag's own variation is kept around its median
CHROMA_PULL = 0.7                 # how far each paving pixel's colour moves to the paving's median colour
FLAG_PULL = 0.5                   # how far a flag's median moves toward the broad paving tone (sigma BROAD)

def joints(a, area):
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    med = gauss(lum * area, 6) / np.maximum(gauss(area.astype(np.float32), 6), 1e-3)
    g = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    return area & ((lum < med - JOINT_DROP) | ((g > -2) & (lum < med - JOINT_GREEN))), lum

def calm_flags(world, ids, keep=None):
    """Each flag (paving between joints) is calmed toward its own median, so the restyle's blotches go and the flag
    keeps a little grain; its median moves halfway to the broad paving tone, so no flag stands out as a patch.
    Cracks (much darker than the flag) and the joints are kept."""
    a = np.asarray(world).astype(np.float32)
    flags, area = paving_mask(world, ids)
    jt, lum = joints(a, area)
    body = area & ~jt
    if keep is not None: body &= ~keep
    lab = label(body)
    w = body.astype(np.float32)
    den = gauss(w, BROAD)
    broad = np.stack([gauss(a[..., c] * w, BROAD) for c in range(3)], -1) / np.maximum(den, 1e-3)[..., None]
    idx = lab[body]; uniq, inv = np.unique(idx, return_inverse=True)
    out = a.copy()
    vals = a[body]; bvals = broad[body]
    for c in range(3):
        med = np.zeros(len(uniq)); cnt = np.bincount(inv)
        # the median per flag, by sorting once
        order = np.lexsort((vals[:, c], inv)); starts = np.concatenate([[0], np.cumsum(cnt)[:-1]])
        med = vals[order, c][starts + cnt // 2]
        bmean = np.bincount(inv, bvals[:, c]) / cnt
        m = med + FLAG_PULL * (bmean - med)
        px = vals[:, c]; mp = m[inv]
        crack = px < mp - 40
        out[..., c][body] = np.where(crack, px, mp + CALM * (px - med[inv]))
    # chroma: every flag's colour (not its value) moves CHROMA_PULL of the way to the paving's own median colour, so a
    # pink or green-tinted patch reads as the same stone
    v = out[body]; y = v.mean(-1, keepdims=True)
    gm = np.median(a[body], axis=0); gc = gm - gm.mean()
    out[body] = y + (1 - CHROMA_PULL) * (v - y) + CHROMA_PULL * gc
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))

def apply(world, protect=None):
    ids = ids_world()
    defects = np.zeros(ids.shape, bool)
    for pts in DEFECTS.values(): defects |= polygon(ids.shape, pts)
    defects &= ids == 0
    flags, area = paving_mask(world, ids)
    clean = flags & ~dilate(defects, 3)
    clean = erode(dilate(clean, 2), 2) & area & ~dilate(defects, 3)
    if protect is not None: defects &= ~dilate(protect, 1)
    for name, pts in DEFECTS.items():
        m = polygon(ids.shape, pts) & defects
        if m.any(): world = inpaint(world, m, f'p1-pave-{name}', PAVE)
    return calm_flags(world, ids, protect)
