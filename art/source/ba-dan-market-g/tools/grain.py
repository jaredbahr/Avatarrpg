"""G1 / G2 grain-ladder exports of the selected objects (and Kaya, for the sheet only).

Requested by the main session on 2026-10-27, for the parallel grain-ladder study:
  G1: 1 art px = 1 world px, 64 x 32 tiles, figures 59 px tall (Kaya, as shipped).
  G2: 1 art px = 2 world px, 32 x 16 tiles, figures about 30 px tall: an exact 2x nearest-neighbour
      downsample of G1, cleaned so outlines hold at 1 art px.

G1 is 1 art px = 1 world px of the shipped game: the explore camera draws 1.5 screen px per world px, so
each object is reduced by grain_f / 1.5 from its PixelLab source (0.375 at the characters' grain, 0.413
for the 2x1 tables) and Kaya's idle stands 59 px, as the shipped sheet draws her (118 sheet px at 128 per
64 px tile). (A first export on 2026-10-27 used a relayed figure height of 76 px; corrected the same day.)

G1 is a pixel reduction, not a smooth resize: each G1 pixel takes the source block it covers; alpha by
majority; colour is the contour colour when the block is mostly contour or the pixel is on the silhouette
edge and the block has any contour, otherwise the block's most frequent colour. No new colours are made.
G2 takes the top-left pixel of every 2 x 2 block of G1 (exact nearest neighbour), then the cleanup, all
automatic (done by this script, not by hand): silhouette-edge pixels whose G1 block held contour become
contour; single-pixel islands and single-pixel holes are removed.

    python3 -I art/source/ba-dan-market-g/tools/grain.py
"""
import json, math, pathlib
from collections import Counter
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "grain"
REVIEW = ROOT / "review"
WORLD_PER_SCREEN = 1 / 1.5
GROUND = (118, 122, 84, 255)
PAPER = (40, 36, 32, 255)
INK = (230, 222, 200, 255)


def is_contour(p):
    return p[3] >= 128 and max(p[:3]) < 60


def reduce_pixel(im, factor):
    im = im.convert("RGBA")
    W, H = max(1, round(im.width * factor)), max(1, round(im.height * factor))
    src = im.load()
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    o = out.load()
    blocks = {}
    for y in range(H):
        y0, y1 = int(y / factor), max(int(y / factor) + 1, int((y + 1) / factor))
        for x in range(W):
            x0, x1 = int(x / factor), max(int(x / factor) + 1, int((x + 1) / factor))
            px = [src[i, j] for j in range(y0, min(y1, im.height)) for i in range(x0, min(x1, im.width))]
            opaque = [p for p in px if p[3] >= 128]
            blocks[(x, y)] = opaque
            if len(opaque) * 2 < len(px):
                continue
            dark = [p for p in opaque if is_contour(p)]
            if len(dark) * 2 >= len(opaque):
                o[x, y] = min(dark, key=lambda p: sum(p[:3]))[:3] + (255,)
            else:
                c = Counter(p[:3] for p in opaque if not is_contour(p)).most_common(1)[0][0]
                o[x, y] = c + (255,)
    # silhouette edge: keep a contour pixel where the block had any contour
    for (x, y), opaque in blocks.items():
        if o[x, y][3] and edge(o, x, y, W, H):
            dark = [p for p in opaque if is_contour(p)]
            if dark:
                o[x, y] = min(dark, key=lambda p: sum(p[:3]))[:3] + (255,)
    return out


def edge(o, x, y, W, H):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        i, j = x + dx, y + dy
        if not (0 <= i < W and 0 <= j < H) or o[i, j][3] == 0:
            return True
    return False


def g2_from_g1(g1):
    W, H = g1.width // 2, g1.height // 2
    s = g1.load()
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    o = out.load()
    for y in range(H):
        for x in range(W):
            o[x, y] = s[2 * x, 2 * y]          # exact nearest neighbour
    # holes and islands
    for y in range(H):
        for x in range(W):
            n = [o[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H]
            filled = [p for p in n if p[3]]
            if o[x, y][3] and len(filled) == 0:
                o[x, y] = (0, 0, 0, 0)
            elif not o[x, y][3] and len(filled) == 4:
                o[x, y] = Counter(filled).most_common(1)[0][0]
    # outlines hold: silhouette edges whose 2x2 G1 block held contour become contour
    for y in range(H):
        for x in range(W):
            if o[x, y][3] and edge(o, x, y, W, H):
                blk = [s[2 * x + i, 2 * y + j] for i in (0, 1) for j in (0, 1) if 2 * x + i < g1.width and 2 * y + j < g1.height]
                dark = [p for p in blk if p[3] and is_contour(p)]
                if dark:
                    o[x, y] = dark[0]
    return out


def main():
    sel = json.loads((ROOT / "selection.json").read_text())
    meta = json.loads((ROOT / "blockouts/meta.json").read_text())
    (OUT / "g1").mkdir(parents=True, exist_ok=True)
    (OUT / "g2").mkdir(parents=True, exist_ok=True)
    k = WORLD_PER_SCREEN
    items = [("kaya (sheet only)", Image.open(ROOT / "ref/kaya-idle-south.png"), 0.5625 * k, None, None)]
    for name, s in sel.items():
        im = Image.open(ROOT / s["path"]).convert("RGBA")
        f = meta[s["blockout"]]["grain_f"]
        items.append((name, im, f * k, s, meta[s["blockout"]]))
    rows = []
    record = {}
    for name, im, factor, s, m in items:
        g1 = reduce_pixel(im, factor)
        bb = g1.split()[3].getbbox()
        g1 = g1.crop(bb)
        if name.startswith("fence"):     # the 2x1 fence: the segment twice, sharing its post
            step = sel[name]["repeat"] * k
            dx, dy = round(step * 2 / math.sqrt(5)), round(step / math.sqrt(5))
            big = Image.new("RGBA", (g1.width + dx, g1.height + dy))
            big.alpha_composite(g1, (0, 0)); big.alpha_composite(g1, (dx, dy)); g1 = big
        if g1.width % 2: g1 = g1.crop((0, 0, g1.width + 1, g1.height))
        if g1.height % 2: g1 = g1.crop((0, 0, g1.width, g1.height + 1))
        g2 = g2_from_g1(g1)
        slug = name.split(" (")[0].replace(" ", "-") + ("-" + name.split("(")[1].rstrip(")").split()[0] if "(" in name and "kaya" not in name else "")
        if not name.startswith("kaya"):
            g1.save(OUT / "g1" / f"{slug}.png"); g2.save(OUT / "g2" / f"{slug}.png")
            ax, ay = m["ground_anchor_src_px"]
            a0, b0 = m["offset_in_footprint_screen_px"]
            if s.get("repeat"):
                a0 = (2 * 107.33 - (m["extent_screen_px"]["along_a"] + s["repeat"])) / 2
            per_logical = 1.5 * math.sqrt(5) / 2       # screen length of one logical px along a ground axis
            record[slug] = {
                "source": s["path"], "factor_from_source": round(factor, 4), "g1": list(g1.size), "g2": list(g2.size),
                "tiles": s["tiles"], "footprint_tiles": m["footprint_tiles"],
                # the G1 pixel where the object's ground origin is drawn (G2: halve it)
                "g1_anchor_px": [round(ax * factor - bb[0], 1), round(ay * factor - bb[1], 1)],
                # the ground origin, in logical px from the footprint's (min x, min y) corner along +x and +y
                "origin_in_footprint_logical_px": [round(a0 / per_logical, 1), round(b0 / per_logical, 1)],
                "extent_logical_px": [round(m["extent_screen_px"]["along_a"] / per_logical, 1),
                                      round(m["extent_screen_px"]["along_b"] / per_logical, 1)],
            }
        rows.append((name, g1, g2))
    (OUT / "grain.json").write_text(json.dumps({"definition": "G1 = 1 art px per world px (source reduced by grain_f / 1.5; Kaya 59 px); G2 = exact 2x NN of G1 + automatic cleanup",
                                                "placement": "draw the G1 image with g1_anchor_px on the screen point of logical ground (tile_x * 64 + origin[0], tile_y * 64 + origin[1]) at 1 px per world px; the ground origin is the object's own min-x, min-y ground corner (the back, top vertex of its 2:1 footprint)",
                                                "objects": record}, indent=1) + "\n")
    sheet(rows)


def sheet(rows):
    """Left: G1 at 1x and 2x nearest; right: G2 at 1x and 4x nearest (both shown at one size per art px: 2x G1 = 4x G2 world size)."""
    kaya = rows[0]
    cells = []
    for name, g1, g2 in rows[1:]:
        parts = []
        for tag, img, z, fig in (("G1", g1, 2, kaya[1]), ("G2", g2, 4, kaya[2])):
            W = fig.width + img.width + 6
            H = max(fig.height, img.height)
            one = Image.new("RGBA", (W, H), GROUND)
            one.alpha_composite(fig, (0, H - fig.height)); one.alpha_composite(img, (fig.width + 6, H - img.height))
            big = one.resize((W * z, H * z), Image.NEAREST)
            p = Image.new("RGBA", (W + 8 + big.width, max(H, big.height) + 16), PAPER)
            p.alpha_composite(one, (0, p.height - H)); p.alpha_composite(big, (W + 8, 16))
            ImageDraw.Draw(p).text((2, 2), f"{name} {tag} {img.width}x{img.height} (1x, then {z}x nearest)", fill=INK)
            parts.append(p)
        row = Image.new("RGBA", (sum(p.width + 10 for p in parts), max(p.height for p in parts) + 6), PAPER)
        x = 0
        for p in parts:
            row.alpha_composite(p, (x, 3)); x += p.width + 10
        cells.append(row)
    out = Image.new("RGBA", (max(c.width for c in cells), sum(c.height for c in cells)), PAPER)
    y = 0
    for c in cells:
        out.alpha_composite(c, (0, y)); y += c.height
    out.save(REVIEW / "grain-ladder-g1-g2.png")


if __name__ == "__main__":
    main()
