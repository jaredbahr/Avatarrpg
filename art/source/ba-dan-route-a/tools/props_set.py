"""Polish step: lift the small #288 props out of the world as `objects.py` set them in, and set the larger redraws
(`props.py`) in on the same foot, with a contact pool and a key-light cast shadow; the geometry sprites follow."""
from polishlib import *  # first: it points the PixelLab client at polish/
import objects as O
from props import PROPS, image

CAST = 0.76      # ground value under the cast shadow (multiplied, cooled)
POOL = 0.62      # the contact pool right under the foot
COOL = O.COOL

def placed():
    """The props objects.py set in (name, piece, image, xy), in its draw order."""
    obs = [o for o in O.objects()]
    return sorted(obs, key=lambda o: o['xy'][1] + o['image'].height)

def shadow_masks(ob, shape):
    """Exactly the cast, contact and object masks `objects.set_in` drew for `ob`."""
    H, W = shape
    im = np.asarray(ob['image']).astype(np.float32); al = im[..., 3] > 127
    x, y = ob['xy']
    def region(m, dx=0, dy=0):
        z = np.zeros((H, W), bool); ys, xs = np.nonzero(m); ys = ys + y + dy; xs = xs + x + dx
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W); z[ys[ok], xs[ok]] = True; return z
    obj = region(al)
    cast = np.zeros((H, W), bool); ys_, xs_ = np.nonzero(al); base = ys_.max(); hgt = base - ys_
    sx = xs_ + x + np.round(hgt * O.SHADOW_KX).astype(int); sy = y + base + np.round(hgt * O.SHADOW_KY).astype(int)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H); cast[sy[ok], sx[ok]] = True
    cast = dilate(cast, 1)
    contact = region(al, 0, 1) & ~obj
    return obj, cast & ~obj, contact

def lift(world, keys):
    """Undo the shadows of the props named in `keys` (where no later object covered them) and return the world, the
    old object masks and those props' placements."""
    a = np.asarray(world).astype(np.float32); shape = a.shape[:2]
    obs = placed(); masks = [shadow_masks(o, shape) for o in obs]
    old = {}
    for i, (o, (obj, cast, contact)) in enumerate(zip(obs, masks)):
        if o['name'] not in keys: continue
        later = np.zeros(shape, bool)
        for _, (obj2, _, _) in zip(obs[i + 1:], masks[i + 1:]): later |= obj2
        # set_in multiplied cast then contact (contact last, so a pixel in both was multiplied twice)
        for m, v in ((contact, O.CONTACT), (cast, O.SHADOW)):
            m = m & ~later
            a[m] = a[m] / (v * COOL)
        old.setdefault(o['name'], []).append((o, obj))
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)), old

def clone_fill(world, mask, clean):
    """Fill `mask` from the ground a whole number of tiles away on the 2:1 grid (nearest first) where that is `clean`, so
    paving joints and grass run on; gain-matched to the ring, feathered 1 px."""
    return O.pave_from_grid(world, mask, world.copy(), clean) if False else _clone(world, mask, clean)

def _clone(world, mask, clean):
    H, W = mask.shape
    a = np.asarray(world).astype(np.float32); src = a.copy()
    fill = np.zeros_like(a); got = np.zeros_like(mask)
    offs = []
    for k in range(1, 9):
        for d in ((64, 32), (-64, 32), (128, 0), (0, 64)):
            offs += [(d[0] * k, d[1] * k), (-d[0] * k, -d[1] * k)]
    offs.sort(key=lambda o: o[0] ** 2 + 4 * o[1] ** 2)
    for dx, dy in offs:
        ys, xs = np.nonzero(mask & ~got)
        if not len(ys): break
        sy, sx = ys + dy, xs + dx
        ok = (sy >= 0) & (sy < H) & (sx >= 0) & (sx < W); ys, xs, sy, sx = ys[ok], xs[ok], sy[ok], sx[ok]
        good = clean[sy, sx]
        fill[ys[good], xs[good]] = src[sy[good], sx[good]]; got[ys[good], xs[good]] = True
    ring = dilate(mask, 5) & ~mask & clean
    if ring.sum() > 20 and got.sum() > 20:
        fill[got] *= (a[ring].mean(0) + 1) / (fill[got].mean(0) + 1)
    a[got] = fill[got]
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))

def set_in(world, im, xy):
    a = np.asarray(world).astype(np.float32); H, W = a.shape[:2]
    arr = np.asarray(im); al = arr[..., 3] > 127; x, y = xy
    def region(m, dx=0, dy=0):
        z = np.zeros((H, W), bool); ys, xs = np.nonzero(m); ys = ys + y + dy; xs = xs + x + dx
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W); z[ys[ok], xs[ok]] = True; return z
    obj = region(al)
    ys_, xs_ = np.nonzero(al); base = ys_.max(); hgt = base - ys_
    cast = np.zeros((H, W), bool)
    sx = xs_ + x + np.round(hgt * O.SHADOW_KX).astype(int); sy = y + base + np.round(hgt * O.SHADOW_KY).astype(int)
    ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H); cast[sy[ok], sx[ok]] = True
    cast = dilate(cast, 1)
    # the contact pool: the object's bottom rows, widened 2 px and dropped 1-2 px, so it stands in its own shade
    low = al & (np.arange(al.shape[0])[:, None] >= base - 3)
    pool = (region(low, 0, 1) | region(low, 1, 2) | region(low, -1, 1) | region(low, 2, 1)) & ~obj
    a[cast & ~obj] *= CAST * COOL
    a[pool] *= POOL * COOL
    a[obj] = arr[al][:, :3]
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)), obj

def apply(world, geometry=False):
    world, old = lift(world, set(PROPS))
    ids = ids_world(); a_shape = ids.shape
    new = []
    covered = np.zeros(a_shape, bool)
    for key, lst in old.items():
        im, (ox, oy) = image(key); s = PROPS[key][0]
        for o, obj in lst:
            fam = json.load(open(f'{O.M}/families/families.json'))['objects'][key]
            ax, ay = fam['g1_anchor_px']
            fx, fy = o['xy'][0] + ax, o['xy'][1] + ay      # the ground point the old prop stood on
            xy = (round(fx - (ax * s + ox)), round(fy - (ay * s + oy)))
            new.append((o, im, xy, obj))
    # what the old props leave uncovered by the new ones is ground again
    newmask = np.zeros(a_shape, bool)
    for o, im, xy, _ in new:
        al = np.asarray(im)[..., 3] > 127; ys, xs = np.nonzero(al); newmask[ys + xy[1], xs + xy[0]] = True
    hole = np.zeros(a_shape, bool)
    for *_, obj in new: hole |= obj
    hole = dilate(hole, 1) & ~newmask
    clean = (ids == 0) & ~dilate(hole, 2)
    for *_, obj in new: clean &= ~dilate(obj, 4)
    world = _clone(world, hole, clean)
    placed_mask = np.zeros(a_shape, bool)
    for o, im, xy, _ in sorted(new, key=lambda n: n[2][1] + n[1].height):
        world, m = set_in(world, im, xy); placed_mask |= m
    if geometry:
        scene = json.load(open(f'{O.GEO}/scene.json'))
        for o, im, xy, _ in new:
            ob = {'piece': o['piece'], 'image': im, 'xy': xy}
            p = next(q for q in scene['pieces'] if q['id'] == o['piece'])
            x0 = min(p['x'], xy[0] - 200); y0 = min(p['y'], xy[1] - 100)
            x1 = max(p['x'] + p['width'], xy[0] - 200 + im.width); y1 = max(p['y'] + p['height'], xy[1] - 100 + im.height)
            p['x'], p['y'], p['width'], p['height'] = x0, y0, x1 - x0, y1 - y0
            spr, inside = O.geometry_sprite(ob, scene); assert inside, o['piece']
            spr.save(f"{O.GEO}/sprites/g1-{o['piece']}.webp", lossless=True)
            p['file'] = f"g1-{o['piece']}.webp"; p['sourceRect'] = None
        json.dump(scene, open(f'{O.GEO}/scene.json', 'w'), indent=2); open(f'{O.GEO}/scene.json', 'a').write('\n')
    return world, [(o['piece'], o['name'], xy, im.size) for o, im, xy, _ in new], placed_mask


RESHADE = {'bench-2x1', 'fence-2x1'}  # kept as they are; only their long cast bars (one over the canal) are redone

def reshade(world):
    """Lift the shadows of the RESHADE pieces and give them the contact pool and the milder cast of `set_in`; the
    objects' own pixels are not touched."""
    world, old = lift(world, RESHADE)
    a = np.asarray(world).astype(np.float32); H, W = a.shape[:2]
    for key, lst in old.items():
        for o, obj in lst:
            al = np.asarray(o['image'])[..., 3] > 127; x, y = o['xy']
            ys_, xs_ = np.nonzero(al); base = ys_.max(); hgt = base - ys_
            cast = np.zeros((H, W), bool)
            sx = xs_ + x + np.round(hgt * O.SHADOW_KX * 0.25).astype(int); sy = y + base + np.round(hgt * O.SHADOW_KY * 0.25).astype(int)
            ok = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H); cast[sy[ok], sx[ok]] = True
            cast = dilate(cast, 1) & ~obj
            low = np.zeros((H, W), bool); yy, xx = np.nonzero(al & (np.arange(al.shape[0])[:, None] >= base - 3))
            low[yy + y + 1, xx + x] = True; low[yy + y + 2, xx + x + 1] = True
            pool = low & ~obj
            a[cast] *= CAST * COOL; a[pool] *= POOL * COOL
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))
