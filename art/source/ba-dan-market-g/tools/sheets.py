"""Review sheets for the selected market objects (selection.json), all at the game camera.

    python3 -I art/source/ba-dan-market-g/tools/sheets.py

Writes review/:
  objects-1x.png       every selected object at 1x beside Kaya (idle, south), feet on one line
  market-corner-1x.png the objects at their Ba Dan tiles (x 0..13, y 0..9) on flat ground, with Kaya and a thug,
                       to judge scale and grouping together (no painting, no shadows: integration is a later step)
  crops-4x.png         4x nearest crops of the 1x composition: basket and fruit next to a head, table leg and ground
                       contact, pottery
  candidates-1x.png    every round-3 candidate beside its blockout, 1x and 2x
"""
import json, math, pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
REVIEW = ROOT / "review"
K = 0.5625
GROUND = (118, 122, 84, 255)
PAPER = (40, 36, 32, 255)
INK = (230, 222, 200, 255)
AX = (2 / math.sqrt(5), 1 / math.sqrt(5))
AY = (-2 / math.sqrt(5), 1 / math.sqrt(5))
META = json.loads((ROOT / "blockouts/meta.json").read_text())
SEL = json.loads((ROOT / "selection.json").read_text())


def at_game_scale(im, f):
    return im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)


def figure(name="kaya-idle-south"):
    im = Image.open(ROOT / f"ref/{name}.png").convert("RGBA")
    im = at_game_scale(im, K)
    return im.crop(im.split()[3].getbbox())


def obj(name):
    """The selected candidate at game scale, and where its ground (0, 0) lands in that image."""
    m = META[SEL[name]["blockout"]]
    im = Image.open(ROOT / SEL[name]["path"]).convert("RGBA")
    if SEL[name].get("repeat"):          # the fence: one tile segment drawn twice, sharing a post
        step = SEL[name]["repeat"]
        k = 1 / m["grain_f"]
        dx, dy = round(step * AX[0] * k), round(step * AX[1] * k)
        big = Image.new("RGBA", (im.width + dx, im.height + dy))
        big.alpha_composite(im, (0, 0))
        big.alpha_composite(im, (dx, dy))
        im = big
    f = m["grain_f"]
    ax, ay = m["ground_anchor_src_px"]
    return at_game_scale(im, f), (ax * f, ay * f)


def text(d, xy, s):
    d.text(xy, s, fill=INK)


def objects_1x():
    fig = figure()
    panels = []
    for name in SEL:
        im, _ = obj(name)
        b = im.split()[3].getbbox()
        im = im.crop(b)
        w = fig.width + im.width + 40
        h = max(fig.height, im.height) + 34
        p = Image.new("RGBA", (w, h), GROUND)
        p.alpha_composite(fig, (10, h - 10 - fig.height))
        p.alpha_composite(im, (fig.width + 24, h - 10 - im.height))
        text(ImageDraw.Draw(p), (4, 2), f"{name} {im.width}x{im.height}")
        panels.append(p)
    rows, row, W = [], [], 0
    for p in panels:
        if W + p.width > 900 and row:
            rows.append(row); row, W = [], 0
        row.append(p); W += p.width + 8
    rows.append(row)
    H = sum(max(p.height for p in r) + 8 for r in rows) + 8
    out = Image.new("RGBA", (max(sum(p.width + 8 for p in r) for r in rows) + 8, H), PAPER)
    y = 8
    for r in rows:
        x = 8
        for p in r:
            out.alpha_composite(p, (x, y)); x += p.width + 8
        y += max(p.height for p in r) + 8
    out.save(REVIEW / "objects-1x.png")


def tile_point(x, y):
    """Screen px of the ground corner (x, y) of the grid at scale 1.5, relative to tile (0, 0)."""
    return ((x - y) * 96, (x + y) * 48)


def market_corner():
    """The slice's figure-scale objects at their tiles, back to front, with two figures standing among them."""
    W, H = 2500, 1100
    ox, oy = 1000, 60
    out = Image.new("RGBA", (W, H), GROUND)
    d = ImageDraw.Draw(out)
    # faint tile grid for judging the footprints
    for i in range(0, 15):
        for (a, b), (c, e) in (((i, 0), (i, 10)), ((0, i), (14, i))):
            if i <= 10 or a == i:
                p0, p1 = tile_point(a, b), tile_point(c, e)
                d.line([(ox + p0[0], oy + p0[1]), (ox + p1[0], oy + p1[1])], fill=(108, 112, 76, 255))
    placed = []
    for name, s in SEL.items():
        for (tx, ty) in s["tiles"]:
            m = META[s["blockout"]]
            im, (ax, ay) = obj(name)
            a0, b0 = m["offset_in_footprint_screen_px"]
            if s.get("repeat"):
                a0 = (2 * 107.33 - (m["extent_screen_px"]["along_a"] + s["repeat"])) / 2
            gx, gy = tile_point(tx, ty)
            gx += a0 * AX[0] + b0 * AY[0]
            gy += a0 * AX[1] + b0 * AY[1]
            fw, fd = m["footprint_tiles"]
            depth = tx + ty + fw + fd       # sort by the front corner, as the scene does
            placed.append((depth, im, (round(ox + gx - ax), round(oy + gy - ay)), name))
    for fig_name, (tx, ty) in (("thug-south", (7.0, 5.12)), ("kaya-idle-south-west", (8.0, 5.55)),
                               ("kaya-idle-south", (4.1, 10.0)), ("kaya-idle-south-east", (3.5, 5.95)),
                               ("thug-south-east", (14.9, 5.1))):
        f = Image.open(ROOT / f"ref/{fig_name}.png").convert("RGBA")
        f = at_game_scale(f, K)
        bb = f.split()[3].getbbox()
        gx, gy = tile_point(tx, ty)
        placed.append((tx + ty + 0.6, f, (round(ox + gx - (bb[0] + bb[2]) / 2), round(oy + gy - bb[3])), fig_name))
    boxes = {}
    for _, im, xy, name in sorted(placed, key=lambda t: t[0]):
        out.alpha_composite(im, xy)
        b = im.split()[3].getbbox()
        boxes.setdefault(name, (xy[0] + b[0], xy[1] + b[1], xy[0] + b[2], xy[1] + b[3]))
    content = [b for n, b in boxes.items()]
    x0 = min(b[0] for b in content) - 30; y0 = min(b[1] for b in content) - 30
    x1 = max(b[2] for b in content) + 30; y1 = max(b[3] for b in content) + 30
    out = out.crop((x0, y0, x1, y1))
    out.save(REVIEW / "market-corner-1x.png")
    return out, boxes


def crops():
    """4x nearest crops at one enlargement and one camera: each pairs a figure with the object it is judged by."""
    fig = figure("kaya-idle-south")
    panels = []

    def stage(name, figure_dx, crop):
        """Kaya standing just left of the object's left end, feet on its ground line; crop is relative to the object box."""
        im, _ = obj(name)
        im = im.crop(im.split()[3].getbbox())
        W, H = fig.width + im.width + 20, max(fig.height, im.height) + 10
        p = Image.new("RGBA", (W, H), GROUND)
        p.alpha_composite(fig, (figure_dx, H - 5 - fig.height))
        p.alpha_composite(im, (fig.width + 8, H - 5 - im.height))
        x0, y0 = fig.width + 8, H - 5 - im.height
        return p, (x0, y0)

    def beside_head(name, box):
        """Kaya's head and shoulders (top 30 px at 1x) set beside a crop of the object's top, both at 1x."""
        im, _ = obj(name)
        im = im.crop(im.split()[3].getbbox()).crop(box)
        head = fig.crop((0, 0, fig.width, 30))
        p = Image.new("RGBA", (head.width + 4 + im.width, max(head.height, im.height)), GROUND)
        p.alpha_composite(head, (0, 0))
        p.alpha_composite(im, (head.width + 4, 0))
        return p

    p, (x0, y0) = stage("gao-display", 0, None)
    panels.append(("basket and fruit beside a head (gao-display)", beside_head("gao-display", (0, 0, 100, 40))))
    im, _ = obj("gao-display"); bb = im.split()[3].getbbox(); w, h = bb[2] - bb[0], bb[3] - bb[1]
    panels.append(("table leg, apron and ground contact (gao-display)", p.crop((x0 + w - 60, y0 + h - 60, x0 + w + 4, y0 + h + 4))))
    p, (x0, y0) = stage("north-market-display", 0, None)
    panels.append(("pottery beside a head (north-market-display)", beside_head("north-market-display", (0, 0, 90, 50))))
    im, _ = obj("north-market-display"); bb = im.split()[3].getbbox(); w, h = bb[2] - bb[0], bb[3] - bb[1]
    panels.append(("storage jar on the ground (north-market-display)", p.crop((x0 + w - 50, y0 + h - 50, x0 + w + 2, y0 + h + 2))))
    p, (x0, y0) = stage("baskets (south)", 0, None)
    panels.append(("stock and carry baskets beside a figure", p))
    p, (x0, y0) = stage("bench-2x1", 0, None)
    panels.append(("bench seat height beside a figure", p.crop((0, 0, x0 + 70, p.height))))
    rows = []
    for title, c in panels:
        c4 = c.resize((c.width * 4, c.height * 4), Image.NEAREST)
        r = Image.new("RGBA", (c4.width + 16, c4.height + 26), PAPER)
        r.alpha_composite(c4, (8, 20))
        text(ImageDraw.Draw(r), (8, 4), title + "  (1x game scale, shown 4x nearest)")
        rows.append(r)
    # two columns
    cols = [rows[0::2], rows[1::2]]
    W = sum(max(r.width for r in col) for col in cols) + 8
    H = max(sum(r.height for r in col) for col in cols)
    out = Image.new("RGBA", (W, H), PAPER)
    x = 0
    for col in cols:
        y = 0
        for r in col:
            out.alpha_composite(r, (x, y)); y += r.height
        x += max(r.width for r in col) + 8
    out.save(REVIEW / "crops-4x.png")


def candidates():
    names = sorted({p.name.rsplit("-r3-", 1)[0] for p in (ROOT / "raw").glob("*-r3-*")})
    rows = []
    for n in names:
        m = META[n]
        f = m["grain_f"]
        ims = [Image.open(ROOT / f"blockouts/{n}.png").convert("RGBA")]
        labels = ["blockout"]
        for p in sorted((ROOT / "raw").glob(f"{n}-r3-*")):
            q = p / "0.png"
            if q.exists():
                ims.append(Image.open(q).convert("RGBA")); labels.append(p.name.split("-r3-")[1])
        cells = []
        for im, lab in zip(ims, labels):
            g = at_game_scale(im, f)
            g2 = g.resize((g.width * 2, g.height * 2), Image.NEAREST)
            cell = Image.new("RGBA", (g.width + g2.width + 12, g2.height + 16), GROUND)
            cell.alpha_composite(g, (2, cell.height - g.height - 2))
            cell.alpha_composite(g2, (g.width + 10, 14))
            text(ImageDraw.Draw(cell), (2, 1), f"{n} {lab}")
            cells.append(cell)
        r = Image.new("RGBA", (sum(c.width + 6 for c in cells) + 6, max(c.height for c in cells) + 6), PAPER)
        x = 6
        for c in cells:
            r.alpha_composite(c, (x, 3)); x += c.width + 6
        rows.append(r)
    out = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows)), PAPER)
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y)); y += r.height
    out.save(REVIEW / "candidates-1x-2x.png")


if __name__ == "__main__":
    REVIEW.mkdir(exist_ok=True)
    candidates()
    objects_1x()
    market_corner()
    crops()
