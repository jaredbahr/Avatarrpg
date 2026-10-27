"""Ba Dan at G1, step 2: paint the oversized baked objects out of the G1 world and set the #288 objects in.

1. Each replaced piece's old silhouette (the frozen geometry, rendered by `regions.py render` into BA_DAN_WORK/village),
   reduced to world px, dilated 2 px and stretched down-right over its baked shadow, is inpainted as plain ground with
   PixelLab Pro Flash inpaint (crop <= 256 px, 3x native context, no reference).
2. The #288 selected objects (`art/source/ba-dan-market-g`, PR #288, `selection.json` and `blockouts/meta.json`) are
   reduced to world px with #288's own pixel reduction (`reduce_pixel`, copied from its `tools/grain.py`: majority
   alpha, contour kept, no new colours) at factor grain_f / 1.5, placed at their tiles by #288's anchors, and given a
   flat key-light shadow (down-right, one tone) and a 1 px contact line, on the world-px grid.
3. Each replaced piece's frozen sprite becomes the new object's silhouette inside the piece's unchanged world rectangle
   (`geometry/sprites/g1-<id>.webp`), so the split cuts the new object; footprint, depth and flags do not change.

Writes ROUTE_A_WORK/world-g1.png and ROUTE_A_WORK/objects.json, and the new geometry sprites with --geometry.
"""
import json, math, os, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
from pl import RA, run, b64

M = os.environ.get('MARKET_G', 'art/source/ba-dan-route-a/objects-288')  # copied from PR 288, see SOURCE_COMMIT
REG = os.environ.get('BA_DAN_WORK', '.review/regions')
# What to clear is the OLD objects: their silhouettes from the geometry as it stood before ADR 0085 (the frozen geometry
# at main 1983138), rendered by that tree's `regions.py render` into this folder. The current geometry holds the new ones.
OLD = os.environ.get('BA_DAN_OLD_WORK', '.review/regions-orig')
GEO = 'art/source/ba-dan-regions/geometry'
AX = (2 / math.sqrt(5), 1 / math.sqrt(5)); AY = (-2 / math.sqrt(5), 1 / math.sqrt(5))
# selection key in #288 -> the frozen piece it replaces
PIECES = {'gao-display': 'gao-display', 'south-market-display': 'south-market-display',
          'north-market-display': 'north-market-display', 'bench-2x1': 'd12', 'fence-2x1': 'd13',
          'shop-stack': 'd8', 'baskets (south)': 'd1', 'baskets (north)': 'd2'}
SHADOW = 0.70       # ground value under a cast shadow (multiplied), cooled toward brown
CONTACT = 0.50      # the 1 px contact line under an object's foot
COOL = np.array([0.93, 0.96, 1.06])
SHADOW_KX, SHADOW_KY = 0.35, 0.16
CONTOUR = 0.8  # how far an object's edge pixel goes toward #1b1410  # the key light's fall on the 2:1 ground, per px of height

def is_contour(p): return p[3] >= 128 and max(p[:3]) < 60

def reduce_pixel(im, factor):
    """#288's G1 reduction (tools/grain.py), unchanged in behaviour."""
    im = im.convert('RGBA'); W, H = max(1, round(im.width * factor)), max(1, round(im.height * factor))
    src = im.load(); out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); o = out.load(); blocks = {}
    for y in range(H):
        y0, y1 = int(y / factor), max(int(y / factor) + 1, int((y + 1) / factor))
        for x in range(W):
            x0, x1 = int(x / factor), max(int(x / factor) + 1, int((x + 1) / factor))
            px = [src[i, j] for j in range(y0, min(y1, im.height)) for i in range(x0, min(x1, im.width))]
            opaque = [p for p in px if p[3] >= 128]; blocks[(x, y)] = opaque
            if len(opaque) * 2 < len(px): continue
            dark = [p for p in opaque if is_contour(p)]
            if len(dark) * 2 >= len(opaque): o[x, y] = min(dark, key=lambda p: sum(p[:3]))[:3] + (255,)
            else: o[x, y] = Counter(p[:3] for p in opaque if not is_contour(p)).most_common(1)[0][0] + (255,)
    def edge(x, y):
        return any(not (0 <= x + dx < W and 0 <= y + dy < H) or o[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    for (x, y), opaque in blocks.items():
        if o[x, y][3] and edge(x, y):
            dark = [p for p in opaque if is_contour(p)]
            if dark: o[x, y] = min(dark, key=lambda p: sum(p[:3]))[:3] + (255,)
    return out

def world_of(px, py):  # painting px -> world-of-painting px (the G1 grid, origin at the pan box corner)
    return px / 1.5, py / 1.5

def tile_paint(x, y):  # painting px of ground corner (x, y)
    return ((x - y + 16) * 96 + 300, (x + y) * 48 + 150)

# Gao's yard (inside the gao-house sprite): the old cart and its jar are cleared and the spot dressed with #288's water
# jars and barrels at their measured size. #288's handcart is three tiles long and does not fit the strip by the wall.
# Boxes and feet in world-of-painting px (pan box corner at 0, 0); each prop's foot is its bottom centre.
# Tried 2026-10-27 (o4-out-gao-yard-cart, rejected): the strip by the wall is too narrow for #288's props beside the
# yard post, and clearing the cart made the generator invent a structure there. The cart stays the house's own, for now.
YARD_CLEAR: list = []
YARD_PROPS: list = []
# Round 2 (owner, "complete Ba Dan"): the old cart is redrawn in place as a small handcart at the figures' scale
YARD_CART = ((1401, 348, 1447, 420), ('In the masked area draw a small two-wheeled wooden handcart standing on the paved yard, '
             'tipped forward on its handles, carrying one clay water jar: the cart bed about 20 px long and 10 px wide, wheels '
             '10 px across, sturdy planks, a 1 px dark brown outline (#1b1410), warm wood in 3 flat tones, light from the upper '
             'left, matching the pixel art style around it. Paving shows around it. No people, no wall, no roof.'))

def piece_at(tile, scene_pieces):
    """The frozen piece whose footprint starts at `tile` (its min-x, min-y cell)."""
    for q in scene_pieces:
        fp = q['footprint']
        if (min(c['x'] for c in fp), min(c['y'] for c in fp)) == tuple(tile) and not q['id'].startswith(('tree', 'north-terrace')):
            return q['id']
    raise KeyError(tile)

def objects():
    """#288's G1 objects placed by its own data: the market set (`grain/grain.json`, the toned images of `grain/g1-toned`)
    and the other families (`families/families.json`, `families/g1`). `g1_anchor_px` goes on the projected logical ground
    point (tile * 64 + origin_in_footprint_logical_px): world x = lx - ly + 1024, y = (lx + ly) / 2 (+ the pan box offset).
    Entries with no tiles (the garden kit, the house props) are not placed here."""
    scene = json.load(open(f'{GEO}/scene.json'))['pieces']
    sources = [(json.load(open(f'{M}/grain/grain.json'))['objects'], 'grain/g1-toned'),
               (json.load(open(f'{M}/families/families.json'))['objects'], 'families/g1')]
    G1B = 'art/source/ba-dan-route-a/objects-g1b'  # the market furniture redrawn with mass (furniture.py)
    out = []
    for table, folder in sources:
        for key, o in table.items():
            if not o.get('tiles'):
                continue
            im = Image.open(f'{G1B}/{key}.png' if os.path.exists(f'{G1B}/{key}.png') else f'{M}/{folder}/{key}.png').convert('RGBA')
            for tx, ty in o['tiles']:
                lx = tx * 64 + o['origin_in_footprint_logical_px'][0]; ly = ty * 64 + o['origin_in_footprint_logical_px'][1]
                wx, wy = lx - ly + 1024 + 200, (lx + ly) / 2 + 100   # world-of-painting px (pan box corner at 0, 0)
                ax, ay = o['g1_anchor_px']
                out.append({'name': key, 'piece': piece_at((tx, ty), scene), 'image': im,
                            'xy': (round(wx - ax), round(wy - ay)), 'src': f'{folder}/{key}.png'})
    out.append(garden_kit(json.load(open(f'{M}/families/families.json'))['objects'], scene))
    return out

GARDEN = (2, 10, 3, 2)  # d14, the garden plot: tile x, y and footprint (BA_DAN_DRESSING)

def garden_kit(fam, scene):
    """#288's garden kit laid over the 3x2 plot as one piece: edge-a along +x on the back and front lines, edge-b along +y
    on the west and east lines, a post at every joint, and three crop rows along +x inside. Each kit image's
    `g1_anchor_px` goes on the logical ground point it is laid at; drawn back to front by lx + ly."""
    gx, gy, fw, fd = GARDEN
    parts = []
    def put(key, lx, ly):
        parts.append((lx + ly, key, lx, ly))
    rows = [('garden-cabbages', 0.28), ('garden-beans', 0.98), ('garden-greens', 1.62)]
    for key, fy in rows:
        for i in range(fw): put(key, (gx + i) * 64 + 2, (gy + fy) * 64)
    for i in range(fw):
        put('garden-edge-a', (gx + i) * 64, gy * 64); put('garden-edge-a', (gx + i) * 64, (gy + fd) * 64)
    for j in range(fd):
        put('garden-edge-b', gx * 64, (gy + j) * 64); put('garden-edge-b', (gx + fw) * 64, (gy + j) * 64)
    for i in range(fw + 1):
        for j in (0, fd): put('garden-post', (gx + i) * 64, (gy + j) * 64)
    for j in range(1, fd): put('garden-post', gx * 64, (gy + j) * 64); put('garden-post', (gx + fw) * 64, (gy + j) * 64)
    placed = []
    for _, key, lx, ly in sorted(parts):
        im = Image.open(f'{M}/families/g1/{key}.png').convert('RGBA'); ax, ay = fam[key]['g1_anchor_px']
        wx, wy = lx - ly + 1024 + 200, (lx + ly) / 2 + 100
        placed.append((im, round(wx - ax), round(wy - ay)))
    x0 = min(x for _, x, _ in placed); y0 = min(y for _, _, y in placed)
    x1 = max(x + im.width for im, x, _ in placed); y1 = max(y + im.height for im, _, y in placed)
    kit = Image.new('RGBA', (x1 - x0, y1 - y0))
    for im, x, y in placed: kit.alpha_composite(im, (x - x0, y - y0))
    return {'name': 'garden-kit', 'piece': piece_at((gx, gy), scene), 'image': kit, 'xy': (x0, y0),
            'src': 'families/g1/garden-* (laid out by garden_kit)'}

GROUND = None  # plain ground (no piece owns it), set by main
raw_world = None  # the restyle before any clearing, set by main: outside the apply mask the ground is put back from it

def tight_mask(piece_id, shape):
    """Where the inpaint is used: the old frozen silhouette dilated 6 px and its baked shadow down-right (10 px), minus
    what other pieces own. The wide `old_mask` only conditions the generator; the ground around stays the restyle's."""
    pj = json.load(open(f'{OLD}/village/pieces.json'))['pieces']
    p = next(q for q in pj if q['id'] == piece_id); s = p['sprite']
    a = Image.open(f"{OLD}/village/{s['file']}").getchannel('A')
    full = Image.new('L', (4500, 2401)); full.paste(a, (s['x'], s['y']))
    m = np.asarray(full.resize((shape[1], shape[0]), Image.BOX)) > 25
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
    sh = np.zeros_like(m)
    for d_ in range(1, 11): sh[d_ // 2:, d_:] |= m[:m.shape[0] - d_ // 2, :m.shape[1] - d_]
    return (m | sh) & ground_or(piece_id, p['index'], shape)

def ground_or(piece_id, index, shape):
    ids = np.asarray(Image.open(f'{OLD}/village/ids.png')).astype(np.int32)
    ids = ids[..., 0] | (ids[..., 1] << 8) | (ids[..., 2] << 16)
    own = Image.fromarray(((ids == 0) | (ids == index + 1)).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.BOX)
    return np.asarray(own) > 200

def old_mask(piece_id, shape):
    """What to clear for a replaced piece: its frozen silhouette dilated 8 px (the painting runs past it in places), the
    prism over its footprint up to the top of its sprite (goods painted on a table inside its volume), and the baked cast
    shadow down-right of both."""
    pj = json.load(open(f'{OLD}/village/pieces.json'))['pieces']
    p = next(q for q in pj if q['id'] == piece_id); s = p['sprite']
    a = Image.open(f"{OLD}/village/{s['file']}").getchannel('A')
    full = Image.new('L', (4500, 2401)); full.paste(a, (s['x'], s['y']))
    m = np.asarray(full.resize((shape[1], shape[0]), Image.BOX)) > 25
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17))) > 0
    # the footprint prism, in world-of-painting px
    cells = p['footprint']; xs = [c['x'] for c in cells]; ys = [c['y'] for c in cells]
    x0, x1, y0, y1 = min(xs) - 0.1, max(xs) + 1.1, min(ys) - 0.1, max(ys) + 1.1
    corners = [((u - v + 16) * 64 + 200, (u + v) * 32 + 100) for u, v in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    top = (s['y']) / 1.5
    poly = Image.new('L', (shape[1], shape[0]))
    from PIL import ImageDraw
    d = ImageDraw.Draw(poly)
    d.polygon(corners, fill=255)
    pr = np.asarray(poly) > 0
    # extrude the diamond upward to the sprite's top
    cols = np.nonzero(pr.any(0))[0]
    for c in cols:  # up 60 world px: the height of a table, a bench, a fence or a stack of stock
        rows = np.nonzero(pr[:, c])[0]
        pr[int(max(0, top, rows.min() - 60)):rows.max() + 1, c] = True
    m = m | pr
    sh = np.zeros_like(m)  # the baked cast shadow lies down-right of the old object
    for d_ in range(1, 11): sh[d_ // 2:, d_:] |= m[:m.shape[0] - d_ // 2, :m.shape[1] - d_]
    # never clear a pixel another piece owns (a canopy, a roof, a wall in front or behind): only ground and the piece itself
    ids = np.asarray(Image.open(f'{OLD}/village/ids.png'))
    ids = ids[..., 0].astype(np.int32) + ids[..., 1].astype(np.int32) * 256 if ids.ndim == 3 else ids.astype(np.int32)
    own = Image.fromarray(((ids == 0) | (ids == p['index'] + 1)).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.BOX)
    return (m | sh) & (np.asarray(own) > 200)

def ground_ids(shape):
    ids = np.asarray(Image.open(f'{OLD}/village/ids.png')).astype(np.int32)
    ids = ids[..., 0] | (ids[..., 1] << 8) | (ids[..., 2] << 16)
    g = Image.fromarray((ids == 0).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.BOX)
    return np.asarray(g) > 200

def prefill(world, mask, avoid):
    """Blank the mask to one flat colour, the median of the plain ground (no piece owns it) in a 4-10 px ring around
    it, so the generator never sees the old object, in the image or in its context; the inpaint gives it texture."""
    a = np.asarray(world.convert('RGB')).copy()
    mk = Image.fromarray(mask.astype(np.uint8) * 255)
    ring = (np.asarray(mk.filter(ImageFilter.MaxFilter(21))) > 0) & ~(np.asarray(mk.filter(ImageFilter.MaxFilter(9))) > 0)
    ring &= ground_ids(mask.shape) & ~avoid
    if ring.sum() < 50: ring = (np.asarray(mk.filter(ImageFilter.MaxFilter(21))) > 0) & ~mask & ~avoid
    a[mask] = np.median(a[ring], axis=0).astype(np.uint8)
    world.paste(Image.fromarray(a))

def grade(im):
    """A mild warm grade for #288's objects (paler and cooler than the world, its README): greys and browns toward the
    world's wood hue, a little more saturation, contour toward #1b1410. Deterministic; replaced by #288's toned set."""
    import colorsys
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255; out = a.copy()
    flat = a[..., :3].reshape(-1, 3)
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in flat]).reshape(a.shape[:2] + (3,))
    h, sa, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    dull = sa < 0.4
    h = np.where(dull, h * 0.4 + (28 / 360) * 0.6, h)
    sa = np.clip(np.where(dull, sa * 1.5 + 0.12, sa * 1.15), 0, 1)
    v = np.clip(v * 0.96, 0, 1)
    rgb = np.array([colorsys.hsv_to_rgb(*p) for p in np.stack([h, sa, v], -1).reshape(-1, 3)]).reshape(a.shape[:2] + (3,))
    dark = v < 0.28
    ink = np.array([27, 20, 16]) / 255
    rgb[dark] = rgb[dark] * 0.4 + ink * 0.6
    out[..., :3] = rgb
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')

SOIL = {'d14': ('Fill the masked area with a tilled vegetable bed: dark brown soil in furrows running along the bed, 3 flat '
                 'tones, small clods, the same pixel art style, no plants, no fence, no people.')}
TAG = os.environ.get('OBJECTS_TAG', 'o4')  # a new base needs a new tag, or the ledger hands back the old inpaints
PROMPT = ('Fill the masked area with the same ground that surrounds it (grass, worn earth, paving stones or the stone canal bank, '
          'continuing their lines and colours) as calm walkable ground in the same pixel art style: 1 px marks, 3-4 flat tones. '
          'No objects, no furniture, no baskets, no fence, no shadows of removed objects, no people.')

def inpaint(world, mask, tag, apply=None, prompt=None):
    ys, xs = np.nonzero(mask)
    if xs.max() - xs.min() + 8 > 256 or ys.max() - ys.min() + 8 > 256:  # in chunks, each seeing the last
        x0, y0 = xs.min(), ys.min(); k = 0
        for cy in range(int(y0), int(ys.max()) + 1, 240):
            for cx in range(int(x0), int(xs.max()) + 1, 240):
                sub = np.zeros_like(mask); sub[cy:cy + 240, cx:cx + 240] = mask[cy:cy + 240, cx:cx + 240]
                if sub.any(): inpaint(world, sub, f'{tag}-{k}', apply, prompt); k += 1
        return
    ys, xs = np.nonzero(mask); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w = max(32, min(256, ((x1 - x0 + 8 + 3) // 4) * 4)); h = max(32, min(256, ((y1 - y0 + 8 + 3) // 4) * 4))
    x0, x1, y0, y1 = int(x0), int(x1), int(y0), int(y1); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    bx, by = max(0, cx - w // 2), max(0, cy - h // 2)
    crop = world.crop((bx, by, bx + w, by + h))
    mk = Image.fromarray((mask[by:by + h, bx:bx + w] * 255).astype(np.uint8)).convert('RGB')
    cxw, cyh = min(world.width, bx + w + w) - max(0, bx - w), min(world.height, by + h + h) - max(0, by - h)
    ctx_box = (max(0, bx - w), max(0, by - h), max(0, bx - w) + cxw, max(0, by - h) + cyh)
    ctx = world.crop(ctx_box)
    img, h1 = b64(crop.convert('RGB')); mi, h2 = b64(mk); ci, h3 = b64(ctx.convert('RGB'))
    out = run('/inpaint-image-pro-flash', {'image': img, 'mask_image': mi, 'description': prompt or PROMPT, 'context_image': ci,
              'bounding_box': {'x': int(bx - ctx_box[0]), 'y': int(by - ctx_box[1]), 'width': int(w), 'height': int(h)},
              'output_method': 'Modify current layer', 'seed': 11},
              tag, {h1: f'{tag} crop ({bx},{by},{w}x{h}) of world-g1-raw', h2: f'{tag} mask', h3: f'{tag} context {ctx_box}'},
              f'paint out the baked object under {tag}')
    res = out[0].convert('RGB').resize((w, h), Image.NEAREST)
    keep = np.asarray(crop.convert('RGB')).copy(); new = np.asarray(res)
    mm = mask[by:by + h, bx:bx + w]
    if apply is not None:  # generated over the wide mask; used only where the old object and its shadow were
        ap = apply[by:by + h, bx:bx + w] & mm
        raw = np.asarray(raw_world.crop((bx, by, bx + w, by + h)).convert('RGB')).astype(np.float32)
        nf = new.astype(np.float32)
        # one gain: the plain ground just outside the patch against the patch's own inner band
        api = Image.fromarray(ap.astype(np.uint8) * 255)
        outer = (np.asarray(api.filter(ImageFilter.MaxFilter(11))) > 0) & ~ap & GROUND[by:by + h, bx:bx + w]
        inner = ap & ~(np.asarray(api.filter(ImageFilter.MinFilter(11))) > 0)
        if outer.sum() > 30 and inner.sum() > 30:
            nf = np.clip(nf * (raw[outer].mean(0) + 1) / (nf[inner].mean(0) + 1), 0, 255)
        a = _gauss(ap.astype(np.float32), 1.0) * (np.asarray(api.filter(ImageFilter.MaxFilter(5))) > 0)
        a = np.maximum(a, ap * 0.5 + 0.5 * (np.asarray(api.filter(ImageFilter.MinFilter(3))) > 0))
        out = raw * (1 - a[..., None]) + nf * a[..., None]
        keep[mm] = np.clip(out + 0.5, 0, 255).astype(np.uint8)[mm]
        world.paste(Image.fromarray(keep), (bx, by))
        return
    if apply is None and prompt is None: tone_match(world, mask)  # a tight patch keeps its own tone; a drawn object too

TONE_MAX = 30  # levels: the most the tone match moves a channel
TONE_SIGMA = 10  # world px: the scale of the tone the patch is matched over, above the pixel detail it keeps

def _gauss(x, sigma):
    """Separable Gaussian of a 2-D float array (edges extended)."""
    r = int(3 * sigma); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    p = np.pad(x, r, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 1, p)

def _norm_blur(a, w, sigma):
    def blur(x):
        return _gauss(x.astype(np.float32), sigma)
    num = np.stack([blur(a[..., c] * w) for c in range(3)], -1)
    den = blur(w)[..., None]
    return num / np.maximum(den, 1e-4), den[..., 0]

def tone_match(world, mask):
    """Match an inpainted patch's low-frequency tone to the ground around it: inside the mask, add the difference between
    the surroundings' tone (a normalised Gaussian of the pixels outside the mask) and the patch's own (the same over the
    mask). The tone then runs on across the patch's edge, while the patch keeps its pixel detail (deterministic)."""
    ys, xs = np.nonzero(mask); pad = 4 * TONE_SIGMA
    y0, y1 = max(0, ys.min() - pad), min(mask.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(mask.shape[1], xs.max() + pad + 1)
    a = np.asarray(world.convert('RGB')).astype(np.float32)
    sub = a[y0:y1, x0:x1]; m = mask[y0:y1, x0:x1].astype(np.float32)
    # only the surroundings that are plain ground count, and only near the patch edge: where little of the window is
    # surround (the middle of a big patch) the correction fades out, and it never moves a pixel more than TONE_MAX
    ground = GROUND[y0:y1, x0:x1].astype(np.float32) if GROUND is not None else 1.0
    out_tone, w_out = _norm_blur(sub, (1 - m) * ground, TONE_SIGMA)
    in_tone, _ = _norm_blur(sub, m, TONE_SIGMA)
    trust = np.clip((w_out - 0.05) / 0.25, 0, 1)[..., None]
    delta = np.clip(out_tone - in_tone, -TONE_MAX, TONE_MAX) * trust
    fixed = sub + delta * m[..., None]
    a[y0:y1, x0:x1] = np.where(m[..., None] > 0, fixed, sub)
    world.paste(Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)))

def dark_islands(world, patch, min_px=30, drop=45):
    """Islands inside a patch much darker (luminance) than the plain ground just around it: what the generator drew
    that is not ground (a stray dark shape in an old shadow). Returns their masks, each dilated 3 px."""
    a = np.asarray(world.convert('L')).astype(np.float32)
    pi = Image.fromarray(patch.astype(np.uint8) * 255)
    ring = (np.asarray(pi.filter(ImageFilter.MaxFilter(15))) > 0) & ~patch & GROUND
    if ring.sum() < 30: return []
    dark = patch & (a < np.median(a[ring]) - drop)
    out, seen = [], np.zeros_like(dark)
    ys, xs = np.nonzero(dark)
    for y, x in zip(ys, xs):
        if seen[y, x]: continue
        comp = np.zeros_like(dark); stack = [(y, x)]; seen[y, x] = True
        while stack:
            cy, cx = stack.pop(); comp[cy, cx] = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < dark.shape[0] and 0 <= nx < dark.shape[1] and dark[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        if comp.sum() >= min_px:
            out.append(np.asarray(Image.fromarray(comp.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(7))) > 0)
    return out

def pave_from_grid(world, mask, source, clean):
    """Where a cleared patch lies in paving, the inpaint draws flat colour, not flags. Each such pixel instead takes the
    paving a whole number of tiles away along the 2:1 grid ((64k, 32k), (-64k, 32k), (128k, 0) and their opposites,
    nearest first) from `source`, the first offset that lands on clean paving (`clean`), so the flag lines run on. Only
    pixels where the paving around (a normalised Gaussian of `clean`, the patch excluded) dominates are filled, so a
    patch that runs into grass keeps its inpainted grass. Gain-matched to the ring, feathered 2 px. Returns the count."""
    H, W = mask.shape
    frac = _gauss(clean.astype(np.float32), 12) / np.maximum(_gauss((~mask).astype(np.float32), 12), 1e-4)
    todo = mask & (frac > 0.5)
    if not todo.any(): return 0
    a = np.asarray(world.convert('RGB')).astype(np.float32); src = np.asarray(source.convert('RGB')).astype(np.float32)
    fill = np.zeros_like(a); got = np.zeros_like(todo)
    offs = []
    for k in range(1, 9):
        for d in ((64, 32), (-64, 32), (128, 0)):
            offs += [(d[0] * k, d[1] * k), (-d[0] * k, -d[1] * k)]
    offs.sort(key=lambda o: o[0] ** 2 + 4 * o[1] ** 2)
    for dx, dy in offs:
        ys, xs = np.nonzero(todo & ~got)
        if not len(ys): break
        sy, sx = ys + dy, xs + dx
        ok = (sy >= 0) & (sy < H) & (sx >= 0) & (sx < W)
        ys, xs, sy, sx = ys[ok], xs[ok], sy[ok], sx[ok]
        good = clean[sy, sx]
        fill[ys[good], xs[good]] = src[sy[good], sx[good]]; got[ys[good], xs[good]] = True
    ring = (np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(11))) > 0) & ~mask & clean
    if ring.sum() > 20 and got.sum() > 20:
        fill[got] *= (a[ring].mean(0) + 1) / (fill[got].mean(0) + 1)
    f = _gauss(got.astype(np.float32), 1.0) * got
    f[np.asarray(Image.fromarray(got.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0] = 1
    a = np.where(got[..., None], a * (1 - f[..., None]) + fill * f[..., None], a)
    world.paste(Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)))
    return int(got.sum())

def set_in(world, ob):
    a = np.asarray(world.convert('RGB')).astype(np.float32)
    im = np.asarray(ob['image']).astype(np.float32); al = im[..., 3] > 127
    x, y = ob['xy']; h, w = al.shape
    H, W = a.shape[:2]
    def region(m, dx=0, dy=0):
        z = np.zeros((H, W), bool)
        ys, xs = np.nonzero(m); ys = ys + y + dy; xs = xs + x + dx
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W); z[ys[ok], xs[ok]] = True; return z
    obj = region(al)
    # key-light shadow from the upper left: a pixel h above the base row stands over the ground at the base row, and its
    # shadow falls from there down-right along the light (SHADOW_KX * h right, SHADOW_KY * h down), so the shadow starts
    # at the feet and runs out to the lower right
    cast = np.zeros((H, W), bool)
    ys_, xs_ = np.nonzero(al); base = ys_.max()
    hgt = base - ys_
    sx = xs_ + x + np.round(hgt * SHADOW_KX).astype(int); sy = y + base + np.round(hgt * SHADOW_KY).astype(int)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H); cast[sy[ok], sx[ok]] = True
    cast = np.asarray(Image.fromarray((cast * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    contact = region(al, 0, 1) & ~obj
    for m, v in ((cast & ~obj, SHADOW), (contact, CONTACT)):
        a[m] = a[m] * v * COOL
    a[obj] = im[al][:, :3]
    # a 1 px contour on the silhouette's edge toward #1b1410, the weight of the world's own furniture lines
    edge = obj & ~(np.asarray(Image.fromarray(obj.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0)
    a[edge] = a[edge] * (1 - CONTOUR) + np.array([27, 20, 16]) * CONTOUR
    world.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    return obj

def geometry_sprite(ob, scene):
    """The new silhouette inside the old piece's world rectangle, at painting px (x1.5 nearest of the G1 object)."""
    p = next(q for q in scene['pieces'] if q['id'] == ob['piece'])
    W, H = round(p['width'] * 1.5), round(p['height'] * 1.5)
    spr = Image.new('RGBA', (W, H))
    big = ob['image'].resize((ob['image'].width * 3, ob['image'].height * 3), Image.NEAREST).resize(
        (round(ob['image'].width * 1.5), round(ob['image'].height * 1.5)), Image.BOX)
    ox = round(ob['xy'][0] * 1.5 - (p['x'] + 200) * 1.5); oy = round(ob['xy'][1] * 1.5 - (p['y'] + 100) * 1.5)
    spr.alpha_composite(big, (ox, oy)) if ox >= 0 and oy >= 0 else spr.paste(big, (ox, oy), big)
    inside = ox >= 0 and oy >= 0 and ox + big.width <= W and oy + big.height <= H
    return spr, inside

if __name__ == '__main__':
    world = Image.open(f"{RA}/{os.environ.get('OBJECTS_BASE', 'world-g1-raw.png')}").convert('RGB'); raw_world = world.copy()
    GROUND = ground_ids((world.height, world.width))
    obs = objects()
    masks = {}
    for ob in obs: masks.setdefault(ob['piece'], old_mask(ob['piece'], (world.height, world.width)))
    # one inpaint per piece over a small mask: the old footprint and silhouette (`tight_mask`) and the old baked shadow
    # wherever it reaches (raw ground clearly darker than around it); only that is blanked, so the generator sees the
    # real ground texture up to its edge, and the result is gain-matched and blended 2 px into the restyle
    small = {}
    lum = np.asarray(raw_world.convert('L')).astype(np.float32)
    for pid, m in masks.items():
        t = tight_mask(pid, m.shape); ti = Image.fromarray(t.astype(np.uint8) * 255)
        ring = (np.asarray(ti.filter(ImageFilter.MaxFilter(41))) > 0) & ~m & GROUND
        if ring.sum() > 30:
            shade = m & GROUND & (lum < np.median(lum[ring]) - 30)
            t = t | ((np.asarray(Image.fromarray(shade.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0) & m)
        small[pid] = np.asarray(Image.fromarray(t.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    world = raw_world.copy()
    avoid = np.zeros((world.height, world.width), bool)
    for t in small.values(): avoid |= t
    for t in small.values(): prefill(world, t, avoid)
    world.save(f'{RA}/world-g1-prefilled.png')
    for pid, t in small.items(): inpaint(world, t, f"{TAG}-out-{pid}", t, SOIL.get(pid))
    # paving holes: flags from the grid, not the inpaint's flat colour
    from ground import materials
    pav, _, _ = materials(np.asarray(raw_world.convert('RGB')))
    # a paving area, joints included: the flag mask closed over its 1-3 px dark joints
    pav = np.asarray(Image.fromarray(pav.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))) > 0
    clean_pav = pav & GROUND
    for m in small.values(): clean_pav &= ~m
    clean_pav = np.asarray(Image.fromarray(clean_pav.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0
    for pid, t in small.items():
        if pid in SOIL: continue
        n = pave_from_grid(world, t, raw_world, clean_pav)
        if n: print(pid, 'paved from grid', n)
    for pid, t in small.items():  # last, every cleared patch's large-scale tone to the ground around it
        if pid not in SOIL: tone_match(world, t)
    for tag, (x0, y0, x1, y1) in YARD_CLEAR:  # inside the house sprite: blank the old cart's own pixels, then inpaint
        import colorsys
        box = np.asarray(raw_world.crop((x0, y0, x1, y1)).convert('RGB')).astype(np.float32) / 255
        hsv = np.array([colorsys.rgb_to_hsv(*p) for p in box.reshape(-1, 3)]).reshape(box.shape)
        h_, s_, v_ = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
        cart = ((h_ > 8) & (h_ < 45) & (s_ > 0.35)) | ((s_ < 0.18) & (v_ > 0.72)) | (v_ < 0.2)  # wood, glaze, outline
        cart = np.asarray(Image.fromarray(cart.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
        m = np.zeros((world.height, world.width), bool); m[y0:y1, x0:x1] = cart
        a_ = np.asarray(world.convert('RGB')).copy()
        ring = np.zeros_like(m); ring[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = True; ring &= ~m
        a_[m] = np.median(a_[ring], axis=0).astype(np.uint8); world.paste(Image.fromarray(a_))
        inpaint(world, m, f"o4-out-{tag}", m)
    # YARD_CART was tried (o5-gao-yard-cart-small): the generator returned the same cart, which at G1 already stands
    # about half a figure high, so the painted one stays.
    world.save(f'{RA}/world-g1-cleared.png')
    fam = json.load(open(f'{M}/families/families.json'))['objects']
    for key, (fx, fy) in YARD_PROPS:
        im = Image.open(f'{M}/families/g1/{key}.png').convert('RGBA'); bb = im.getbbox()
        obs.append({'name': key, 'piece': None, 'image': im, 'xy': (round(fx - (bb[0] + bb[2]) / 2), fy - bb[3]),
                    'src': f'families/g1/{key}.png (placed by hand in Gao\'s yard)'})
    for ob in sorted(obs, key=lambda o: o['xy'][1] + o['image'].height):
        set_in(world, ob)
    world.save(f'{RA}/world-g1.png')
    rep = [{k: v for k, v in ob.items() if k != 'image'} | {'size': ob['image'].size} for ob in obs]
    if '--geometry' in sys.argv:
        scene = json.load(open(f'{GEO}/scene.json'))
        for ob, r in zip(obs, rep):
            if ob['piece'] is None: continue  # painted into the house sprite; its silhouette is the house's
            p = next(q for q in scene['pieces'] if q['id'] == ob['piece'])
            spr, inside = geometry_sprite(ob, scene); r['inside_old_rect'] = inside
            if not inside:  # grow the piece's world rectangle to hold the new object (footprint and depth unchanged)
                x0 = min(p['x'], ob['xy'][0] - 200); y0 = min(p['y'], ob['xy'][1] - 100)
                x1 = max(p['x'] + p['width'], ob['xy'][0] - 200 + ob['image'].width); y1 = max(p['y'] + p['height'], ob['xy'][1] - 100 + ob['image'].height)
                p['x'], p['y'], p['width'], p['height'] = x0, y0, x1 - x0, y1 - y0
                spr, inside = geometry_sprite(ob, scene); r['grown_rect'] = [x0, y0, x1 - x0, y1 - y0]
            spr.save(f"{GEO}/sprites/g1-{ob['piece']}.webp", lossless=True)
            p = next(q for q in scene['pieces'] if q['id'] == ob['piece'])
            p['file'] = f"g1-{ob['piece']}.webp"; p['sourceRect'] = None
        json.dump(scene, open(f'{GEO}/scene.json', 'w'), indent=2); open(f'{GEO}/scene.json', 'a').write('\n')
    json.dump(rep, open(f'{RA}/objects.json', 'w'), indent=1); print(json.dumps(rep))
