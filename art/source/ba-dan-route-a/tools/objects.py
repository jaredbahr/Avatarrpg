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
GEO = 'art/source/ba-dan-regions/geometry'
AX = (2 / math.sqrt(5), 1 / math.sqrt(5)); AY = (-2 / math.sqrt(5), 1 / math.sqrt(5))
# selection key in #288 -> the frozen piece it replaces
PIECES = {'gao-display': 'gao-display', 'south-market-display': 'south-market-display',
          'north-market-display': 'north-market-display', 'bench-2x1': 'd12', 'fence-2x1': 'd13',
          'shop-stack': 'd8', 'baskets (south)': 'd1', 'baskets (north)': 'd2'}
SHADOW = 0.70       # ground value under a cast shadow (multiplied), cooled toward brown
CONTACT = 0.50      # the 1 px contact line under an object's foot
COOL = np.array([0.93, 0.96, 1.06])

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

def objects():
    """#288's G1 images placed by its grain.json: g1_anchor_px on the projected logical ground point
    (tile * 64 + origin_in_footprint_logical_px), world x = lx - ly + 1024, y = (lx + ly) / 2 (+ the pan box offset)."""
    g = json.load(open(f'{M}/grain/grain.json'))['objects']
    slug = {'gao-display': 'gao-display', 'south-market-display': 'south-market-display', 'north-market-display': 'north-market-display',
            'bench-2x1': 'bench-2x1', 'fence-2x1': 'fence-2x1', 'shop-stack': 'shop-stack', 'baskets (south)': 'baskets-south',
            'baskets (north)': 'baskets-north'}
    out = []
    for name, key in slug.items():
        o = g[key]; im = Image.open(f'{M}/grain/g1/{key}.png').convert('RGBA')
        for tx, ty in o['tiles']:
            lx = tx * 64 + o['origin_in_footprint_logical_px'][0]; ly = ty * 64 + o['origin_in_footprint_logical_px'][1]
            wx, wy = lx - ly + 1024 + 200, (lx + ly) / 2 + 100   # world-of-painting px (pan box corner at 0, 0)
            ax, ay = o['g1_anchor_px']
            out.append({'name': name, 'piece': PIECES[name], 'image': im, 'xy': (round(wx - ax), round(wy - ay)),
                        'src': f"grain/g1/{key}.png ({o['source']})"})
    return out

def old_mask(piece_id, shape):
    """What to clear for a replaced piece: its frozen silhouette dilated 8 px (the painting runs past it in places), the
    prism over its footprint up to the top of its sprite (goods painted on a table inside its volume), and the baked cast
    shadow down-right of both."""
    pj = json.load(open(f'{REG}/village/pieces.json'))['pieces']
    p = next(q for q in pj if q['id'] == piece_id); s = p['sprite']
    a = Image.open(f"{REG}/village/{s['file']}").getchannel('A')
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
    ids = np.asarray(Image.open(f'{REG}/village/ids.png'))
    ids = ids[..., 0].astype(np.int32) + ids[..., 1].astype(np.int32) * 256 if ids.ndim == 3 else ids.astype(np.int32)
    own = Image.fromarray(((ids == 0) | (ids == p['index'] + 1)).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.BOX)
    return (m | sh) & (np.asarray(own) > 200)

def ground_ids(shape):
    ids = np.asarray(Image.open(f'{REG}/village/ids.png')).astype(np.int32)
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

PROMPT = ('Fill the masked area with the same ground that surrounds it (grass, worn earth, paving stones or the stone canal bank, '
          'continuing their lines and colours) as calm walkable ground in the same pixel art style: 1 px marks, 3-4 flat tones. '
          'No objects, no furniture, no baskets, no fence, no shadows of removed objects, no people.')

def inpaint(world, mask, tag):
    ys, xs = np.nonzero(mask)
    if xs.max() - xs.min() + 8 > 256 or ys.max() - ys.min() + 8 > 256:  # in chunks, each seeing the last
        x0, y0 = xs.min(), ys.min(); k = 0
        for cy in range(int(y0), int(ys.max()) + 1, 240):
            for cx in range(int(x0), int(xs.max()) + 1, 240):
                sub = np.zeros_like(mask); sub[cy:cy + 240, cx:cx + 240] = mask[cy:cy + 240, cx:cx + 240]
                if sub.any(): inpaint(world, sub, f'{tag}-{k}'); k += 1
        return
    ys, xs = np.nonzero(mask); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w = min(256, ((x1 - x0 + 8 + 3) // 4) * 4); h = min(256, ((y1 - y0 + 8 + 3) // 4) * 4)
    x0, x1, y0, y1 = int(x0), int(x1), int(y0), int(y1); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    bx, by = max(0, cx - w // 2), max(0, cy - h // 2)
    crop = world.crop((bx, by, bx + w, by + h))
    mk = Image.fromarray((mask[by:by + h, bx:bx + w] * 255).astype(np.uint8)).convert('RGB')
    cxw, cyh = min(world.width, bx + w + w) - max(0, bx - w), min(world.height, by + h + h) - max(0, by - h)
    ctx_box = (max(0, bx - w), max(0, by - h), max(0, bx - w) + cxw, max(0, by - h) + cyh)
    ctx = world.crop(ctx_box)
    img, h1 = b64(crop.convert('RGB')); mi, h2 = b64(mk); ci, h3 = b64(ctx.convert('RGB'))
    out = run('/inpaint-image-pro-flash', {'image': img, 'mask_image': mi, 'description': PROMPT, 'context_image': ci,
              'bounding_box': {'x': int(bx - ctx_box[0]), 'y': int(by - ctx_box[1]), 'width': int(w), 'height': int(h)},
              'output_method': 'Modify current layer', 'seed': 11},
              tag, {h1: f'{tag} crop ({bx},{by},{w}x{h}) of world-g1-raw', h2: f'{tag} mask', h3: f'{tag} context {ctx_box}'},
              f'paint out the baked object under {tag}')
    res = out[0].convert('RGB').resize((w, h), Image.NEAREST)
    keep = np.asarray(crop.convert('RGB')).copy(); new = np.asarray(res)
    mm = mask[by:by + h, bx:bx + w]
    # tone-match the patch to the ground around it: the inner 6 px band of the patch to the outer 6 px ring
    mi_ = Image.fromarray(mm.astype(np.uint8) * 255)
    inner = mm & ~(np.asarray(mi_.filter(ImageFilter.MinFilter(13))) > 0)
    outer = (np.asarray(mi_.filter(ImageFilter.MaxFilter(13))) > 0) & ~mm
    if inner.sum() > 20 and outer.sum() > 20:
        gain = (keep[outer].astype(np.float32).mean(0) + 1) / (new[inner].astype(np.float32).mean(0) + 1)
        new = np.clip(new.astype(np.float32) * gain + 0.5, 0, 255).astype(np.uint8)
    keep[mm] = new[mm]  # only masked pixels change
    world.paste(Image.fromarray(keep), (bx, by))

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
    # key-light shadow: the silhouette's lower half flattened onto the ground, falling down-right
    cast = np.zeros((H, W), bool)
    rows = np.nonzero(al.any(1))[0]; base = rows.max()
    for r in rows:
        hgt = base - r; cols = np.nonzero(al[r])[0]
        sx = cols + x + int(hgt * 0.9); sy = np.full_like(cols, y + base - int(hgt * 0.15))
        ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H); cast[sy[ok], sx[ok]] = True
    cast = np.asarray(Image.fromarray((cast * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    contact = region(al, 0, 1) & ~obj
    for m, v in ((cast & ~obj, SHADOW), (contact, CONTACT)):
        a[m] = a[m] * v * COOL
    a[obj] = im[al][:, :3]
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
    world = Image.open(f'{RA}/world-g1-raw.png').convert('RGB')
    obs = objects()
    for ob in obs: ob['image'] = grade(ob['image'])
    masks = {}
    for ob in obs: masks.setdefault(ob['piece'], old_mask(ob['piece'], (world.height, world.width)))
    avoid = np.zeros((world.height, world.width), bool)
    for m in masks.values(): avoid |= m
    for pid, m in masks.items(): prefill(world, m, avoid)
    world.save(f'{RA}/world-g1-prefilled.png')
    for pid, m in masks.items(): inpaint(world, m, f"o2-out-{pid}")
    world.save(f'{RA}/world-g1-cleared.png')
    for ob in sorted(obs, key=lambda o: o['xy'][1] + o['image'].height):
        set_in(world, ob)
    world.save(f'{RA}/world-g1.png')
    rep = [{k: v for k, v in ob.items() if k != 'image'} | {'size': ob['image'].size} for ob in obs]
    if '--geometry' in sys.argv:
        scene = json.load(open(f'{GEO}/scene.json'))
        for ob, r in zip(obs, rep):
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
