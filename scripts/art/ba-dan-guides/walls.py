"""Compose the boundary wall's runs from the painted wall modules: python scripts/art/ba-dan-guides/walls.py

The painter made each module (`painted/wall-*.png`, `gate-pier-*`, corner and end piers) on its own guide, so a module is
a whole wall with its own end faces and outline.  A run is laid the way the wall stands: every module at its tile in the
map's projection (1.5 px per world px), painter order by depth, so each module's body covers the end face of the one behind.
The straight modules come in three paintings (`-b`, `-c` beside the plain one) laid in a fixed order, never the same twice
in a row, with a buttress every third or fourth module.  Three things are then done to the composite, never to a module:

  1. the joins.  Where a module's cut edge lies against the module behind it, the painted outline that runs along that cut
     (and the course that does not meet) is replaced over a band a few px wide by stone taken from further into the module;
     then, where a pier, a gate pier or the corner meets a run (their courses are painted to the straight modules' end
     profile but not copied from it), the colours either side are cross-faded over a few px along the wall's axis;
  2. the edge.  The silhouette is the union of the modules' exact geometry coverage (`edge.coverage`), so the outline runs
     round the run's outer edge only, 2 px, with the same brown the other true pieces carry under their fringe;
  3. the trim.  The run is kept at 1.5 px per world px, the scale it was painted at and the houses are drawn from (the scene
     draws it at 2/3 like every other true piece); only its transparent margin is trimmed, to a multiple of 3 px so its
     origin stays a whole number of world px.

Writes art/source/ba-dan-true/walls/<run>.png (RGBA at 1.5 px per world px) and walls.json (the canvas origin in world px,
the joins that were re-taken).  The packer cuts the run into the strips the scene draws."""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dressing as DR  # noqa: E402
import edge as ED  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'art', 'source', 'ba-dan-true'))
OUT = os.path.join(ROOT, 'walls')
SC = 1.5
OUTLINE = (75, 43, 29)
BAND = 4          # px (1.5x) of B along a join that is re-taken
SHIFT = 8        # steps along the wall (2 px across, 1 px down) a cut's pixels are taken from
BLACK = 40        # a painted pixel whose luma is at or under this is the painter's black (or blood-red black), not stone (see unblack)
REACH = 18        # px in from the silhouette that black paint is replaced
SHADE = 0.72      # the filled pixels are this much darker than the stone round them
CHROMA_FLOOR = 80  # the least blue a bright pixel keeps (see finish)
FADE = 5          # steps along the wall either side of a join over which the courses are cross-faded

# The straight modules vary in a fixed order: PLAIN_X / PLAIN_Y give the painting of each plain module in turn along a run.
# A buttress stands in every third or fourth module (north run: the 3rd, 6th and 10th of 12), so the paintings either side
# of a buttress differ too.  No painting follows itself, with or without a buttress between.
PLAIN_X = ['wall-x-2', 'wall-x-2-b', 'wall-x-2-c', 'wall-x-2', 'wall-x-2-c', 'wall-x-2-b', 'wall-x-2', 'wall-x-2-c', 'wall-x-2-b']
PLAIN_Y = ['wall-y-2-b', 'wall-y-2-c', 'wall-y-2']
BUTTRESS_X = (2, 5, 9)


def runs():
    """Module placements (geometry piece, painted master, tile x, tile y): north wall = tile row -2 along x, west wall = tile
    column -2 along y.  Joins fall at module ends.  The ford (canal row 6, road rows 7..8) stays open between the gate piers."""
    north = [('wall-corner-inside', 'wall-corner-inside', -2, -2)]
    plain = iter(PLAIN_X)
    for i, x in enumerate(range(-1, 23, 2)):
        if i in BUTTRESS_X:
            north.append(('wall-x-2-buttress', 'wall-x-2-buttress', x, -2))
        else:
            north.append(('wall-x-2', next(plain), x, -2))
    north.append(('wall-end-pier-x', 'wall-end-pier-x', 23, -2))
    west_n = [('wall-y-2', PLAIN_Y[0], -2, -1), ('wall-y-2', PLAIN_Y[1], -2, 1),
              ('wall-y-2-buttress', 'wall-y-2-buttress', -2, 3), ('gate-pier-n', 'gate-pier-n', -2, 5)]
    west_s = [('gate-pier-s', 'gate-pier-s', -2, 9), ('wall-y-2-buttress', 'wall-y-2-buttress', -2, 10),
              ('wall-y-2', PLAIN_Y[2], -2, 12), ('wall-y-1', 'wall-y-1', -2, 14), ('wall-end-pier-y', 'wall-end-pier-y', -2, 15)]
    return {'north-west': north + west_n, 'west-south': west_s}


def axis_of(mod):
    """Screen step along the wall for a module: (2, 1) along grid x, (-2, 1) along grid y."""
    return (2, 1) if mod.split('-')[1] == 'x' or mod.endswith('-pier-x') else (-2, 1)


def scene_pt(x, y):
    return (1024 + (x - y) * 64, (x + y) * 32)


def dist_to(mask, limit):
    """Chebyshev-ish distance (4-neighbour dilation steps) to `mask`, capped at limit+1."""
    d = np.full(mask.shape, limit + 1, np.int32)
    cur = mask.copy()
    d[cur] = 0
    for step in range(1, limit + 1):
        n = cur.copy()
        n[1:] |= cur[:-1]; n[:-1] |= cur[1:]; n[:, 1:] |= cur[:, :-1]; n[:, :-1] |= cur[:, 1:]
        d[n & ~cur] = step
        cur = n
    return d


def shifted(a, dx, dy):
    """b[y, x] = a[y + dy, x + dx] (zero / False outside)."""
    out = np.zeros_like(a)
    H, W = a.shape[:2]
    if abs(dx) >= W or abs(dy) >= H:
        return out
    d_ys, s_ys = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    d_xs, s_xs = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[d_ys, d_xs] = a[s_ys, s_xs]
    return out


def unblack(rgb, solid):
    """The painters' foot, rear lip and module ends came with runs of pure black up to a dozen px deep (a shadow they drew
    inside the silhouette; at a join it is re-taken from the stone behind it, so what is left here lies on the run's own
    silhouette, where the 2 px brown outline is applied later).  Fill those pixels from the stone beside them, one ring at
    a time, each ring the mean of the already valid neighbours; smooth the filled pixels over a 5x5 window of the painted
    pixels and darken them by SHADE, so they read as the shaded base of the stone."""
    rgb = rgb.copy()
    H, W = solid.shape
    near = solid & (rgb @ np.array([0.3, 0.59, 0.11]) <= BLACK)
    reach = near & (ED.chamfer_inside(solid) <= REACH)               # dark paint within REACH px of the silhouette
    for _ in range(2):                                              # and the specks and the soft edge round it
        grow = reach.copy()
        grow[1:] |= reach[:-1]; grow[:-1] |= reach[1:]; grow[:, 1:] |= reach[:, :-1]; grow[:, :-1] |= reach[:, 1:]
        reach = grow & solid
    dark = reach
    valid = solid & ~dark
    todo = dark.copy()
    def window_sum(a, r):
        pad = np.pad(a, [(r, r), (r, r)] + [(0, 0)] * (a.ndim - 2))
        return sum(pad[r + dy:r + dy + H, r + dx:r + dx + W] for dy in range(-r, r + 1) for dx in range(-r, r + 1))
    while todo.any():
        cnt = window_sum(valid.astype(np.float64), 1)
        acc = window_sum(rgb * valid[..., None], 1)
        ring = todo & (cnt > 0)
        if not ring.any():
            break
        rgb[ring] = acc[ring] / cnt[ring][:, None]
        valid |= ring
        todo &= ~ring
    cnt = window_sum(solid.astype(np.float64), 2)
    smooth = window_sum(rgb * solid[..., None], 2) / np.maximum(cnt, 1)[..., None]
    return np.where(dark[..., None], smooth * SHADE, rgb)


def compose(placements):
    pieces = {p.name: p for p in DR.all_dressing()}
    items = []
    for geo, paint, tx, ty in placements:
        p = pieces[geo]
        p.render()
        gx, gy = tx + p.w, ty + p.d
        sx, sy = scene_pt(gx, gy)
        ox, oy = int(round(sx * SC)) - p.anchor[0], int(round(sy * SC)) - p.anchor[1]
        items.append((gx + gy, gx, geo, paint, p, ox, oy))
    items.sort(key=lambda t: (t[0], t[1]))
    x0 = min(i[5] for i in items) // 3 * 3
    y0 = min(i[6] for i in items) // 3 * 3
    x1 = max(i[5] + i[4].size[0] for i in items)
    y1 = max(i[6] + i[4].size[1] for i in items)
    W, H = -(-(x1 - x0) // 3) * 3, -(-(y1 - y0) // 3) * 3
    rgb = np.zeros((H, W, 3), np.float64)
    alpha = np.zeros((H, W), bool)
    label = np.full((H, W), -1, np.int32)
    cov = np.zeros((H, W), np.float64)
    axes = []
    straight = []
    joins = []
    banded = 0
    for n, (_, _, geo, paint, p, ox, oy) in enumerate(items):
        img = np.asarray(Image.open(os.path.join(ROOT, 'painted', paint + '.png')).convert('RGBA')).astype(np.float64)
        w, h = p.size
        assert img.shape[1] == w and img.shape[0] == h, (paint, img.shape, p.size)
        sl = (slice(oy - y0, oy - y0 + h), slice(ox - x0, ox - x0 + w))
        full = np.zeros((H, W), bool)
        full[sl] = img[..., 3] > 0
        mine = np.zeros((H, W, 3), np.float64)
        mine[sl] = img[..., :3]
        # B's cut edge: its boundary pixels whose outside neighbour is already opaque (the module behind)
        behind = np.zeros_like(full)
        behind[1:] |= alpha[:-1] & ~full[:-1]; behind[:-1] |= alpha[1:] & ~full[1:]
        behind[:, 1:] |= alpha[:, :-1] & ~full[:, :-1]; behind[:, :-1] |= alpha[:, 1:] & ~full[:, 1:]
        j = full & behind
        dx, dy = axis_of(geo)
        if j.any():
            ys, xs = np.nonzero(j)
            joins.append({'module': paint, 'at_world_px': [int(round((xs.mean() + x0) / SC)), int(round((ys.mean() + y0) / SC))], 'cut_px': int(j.sum())})
            # The painted outline runs along the cut.  B's own pixels within BAND px of it are taken from SHIFT steps further
            # into B along the wall: the cut becomes a plain texture step.
            src = shifted(mine, dx * SHIFT, dy * SHIFT)
            src_ok = shifted(full, dx * SHIFT, dy * SHIFT)
            take = (dist_to(j, BAND) <= BAND) & full & src_ok
            mine = np.where(take[..., None], src, mine)
            banded += int(take.sum())
            # Likewise the module behind: whatever of its own end outline B's body leaves uncovered is taken from SHIFT steps
            # back into it.
            back = shifted(rgb, -dx * SHIFT, -dy * SHIFT)
            same = shifted(label, -dx * SHIFT, -dy * SHIFT) == label
            take_a = (dist_to(j, BAND) <= BAND) & alpha & ~full & same
            rgb = np.where(take_a[..., None], back, rgb)
            banded += int(take_a.sum())
        rgb = np.where(full[..., None], mine, rgb)
        label = np.where(full, n, label)
        alpha |= full
        axes.append((dx, dy))
        straight.append(geo.startswith(('wall-x-2', 'wall-y-2', 'wall-y-1')))
        cov[sl] = np.maximum(cov[sl], ED.coverage(p))
    rgb = fade_joins(unblack(rgb, alpha), alpha, label, axes, straight)
    return rgb, alpha, cov, (x0, y0), joins, banded


def fade_joins(rgb, alpha, label, axes, straight):
    """Cross-fade the colours either side of every join along the wall's axis.  A pixel whose neighbour along the axis (within
    FADE steps) belongs to another module is mixed with its mirror image across that cut, at 1/2 on the cut falling to 0 at
    FADE steps, so the courses of a pier meet the run's courses without a step.  Reads the unfaded composite, so both sides
    move together; where the mirror lies off the paint (a pier standing above the wall) the pixel is left as it is."""
    out = rgb.copy()
    H, W = alpha.shape
    ys, xs = np.mgrid[0:H, 0:W]
    done = np.zeros((H, W), bool)
    for n, (dx, dy) in enumerate(axes):
        mine = label == n
        if not mine.any():
            continue
        for sgn in (-1, 1):
            first = np.zeros((H, W), np.int32)
            for k in range(1, FADE + 1):
                lab = shifted(label, sgn * dx * k, sgn * dy * k)
                # two straight modules share the end profile they were painted to: they meet course to course, no fade
                other_straight = np.array(straight + [False])[lab]
                first[mine & (first == 0) & (lab != n) & (lab >= 0) & ~(other_straight & straight[n])] = k
            m = mine & (first > 0)
            if not m.any():
                continue
            yy, xx, k = ys[m], xs[m], first[m]
            # the cut lies between k-1 and k steps out; the mirror pixel is 2k-1 steps away
            my = yy + sgn * dy * (2 * k - 1)
            mx = xx + sgn * dx * (2 * k - 1)
            ok = (my >= 0) & (my < H) & (mx >= 0) & (mx < W)
            my = np.clip(my, 0, H - 1)
            mx = np.clip(mx, 0, W - 1)
            ok &= alpha[my, mx] & (label[my, mx] != n)
            wgt = 0.5 * (1 - (k - 0.5) / FADE)
            mixed = rgb[yy, xx] * (1 - wgt[:, None]) + rgb[my, mx] * wgt[:, None]
            sel = ok & ~done[yy, xx]
            out[yy[sel], xx[sel]] = mixed[sel]
            done[yy[sel], xx[sel]] = True
    return out


def finish(rgb, alpha, cov):
    inside = cov >= 0.5
    outline = np.array(OUTLINE, np.float64)
    depth = ED.chamfer_inside(inside) - 0.5
    rgb1 = np.where(alpha[..., None], rgb, outline)
    w = np.clip(2.5 - np.where(inside, depth + 0.5, 0.5), 0, 1)
    w = np.where(inside, w, 1.0)
    rgb1 = rgb1 * (1 - w[..., None]) + outline * w[..., None]
    # The yellow flower centres are pure enough (blue under 30 beside red over 200) that the encoder's chroma subsampling moves
    # a lone pixel's blue by 100 and more, past the fine-grain contract; lift the blue of a bright pixel to CHROMA_FLOOR.
    rgb1[..., 2] = np.where(rgb1.max(-1) >= 200, np.maximum(rgb1[..., 2], CHROMA_FLOOR), rgb1[..., 2])
    alpha1 = cov.copy()
    alpha1[cov < 1 / 255.0 / 2] = 0
    out = np.zeros(cov.shape + (4,), np.uint8)
    out[..., :3] = np.round(rgb1).clip(0, 255)
    near = ED.dist_to_inside(inside) <= 4.5
    out[~inside & ~near, :3] = 0
    out[~inside & near, :3] = OUTLINE
    out[..., 3] = np.round(alpha1 * 255)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for name, placements in runs().items():
        rgb, alpha, cov, (x0, y0), joins, banded = compose(placements)
        out = finish(rgb, alpha, cov)
        ys, xs = np.nonzero(out[..., 3])
        # trim to the opaque box, on multiples of 3 px (2 world px) so the origin stays a whole number of world px
        bx0, by0 = xs.min() // 3 * 3, ys.min() // 3 * 3
        bx1, by1 = -(-(xs.max() + 1) // 3) * 3, -(-(ys.max() + 1) // 3) * 3
        out = out[by0:by1, bx0:bx1]
        Image.fromarray(out, 'RGBA').save(os.path.join(OUT, name + '.png'), optimize=True)
        ox, oy = int((x0 + bx0) // 3 * 2), int((y0 + by0) // 3 * 2)
        meta[name] = {'origin': [ox, oy], 'size': [int(bx1 - bx0), int(by1 - by0)], 'scale': SC, 'modules': len(placements),
                      'paintings': [pl[1] for pl in placements], 'joins': joins, 'retaken_px': banded}
        print(name, meta[name]['origin'], meta[name]['size'], len(joins), 'joins', banded, 'px re-taken')
    json.dump(meta, open(os.path.join(OUT, 'walls.json'), 'w', newline='\r\n'), indent=2)


if __name__ == '__main__':
    main()
