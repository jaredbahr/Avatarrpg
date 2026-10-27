"""Ba Dan's remaining object families (Route A at G1): tone, G1 export with placement data, and review sheets.

Reads `selection-families.json` ({name: {"blockout", "path", "tiles"}}); for each selected candidate:
  1. `tone.py` (Kaya's contour weight, warmth and value)  -> families/toned/<name>.png (source px)
  2. the G1 pixel reduction of `grain.py` (1 art px = 1 world px; Kaya 59 px) -> families/g1/<name>.png
  3. placement in families/families.json, in the same convention as grain/grain.json
It also writes toned G1 copies of the market set (grain/g1-toned/) so every object in Ba Dan can share one
treatment, and the sheets:
  review/families-1x.png          each object at game scale (screen px at the 1.5 camera) beside Kaya
  review/families-g1.png          each G1 export beside Kaya's G1 (59 px), 1x and 4x nearest
  review/families-crops-4x.png    4x crops at game scale: figure beside the well, a lantern, a cart wheel, the kiln
  review/families-candidates.png  every candidate beside its blockout at game scale

    python3 -I art/source/ba-dan-market-g/tools/families.py                    # soft 2 px outline (default)
    TONE_OUTLINE=crisp1 python3 -I art/source/ba-dan-market-g/tools/families.py  # crisp 1 px #1b1410 on the G1 grid
"""
import json, math, pathlib, sys
from PIL import Image, ImageDraw

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import tone as tone_mod                    # noqa: E402
from tone import tone, crisp_outline       # noqa: E402
from grain import reduce_pixel             # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
FAM = ROOT / "families"
REVIEW = ROOT / "review"
K = 0.5625
GROUND = (118, 122, 84, 255)
PAPER = (40, 36, 32, 255)
INK = (230, 222, 200, 255)
PER_LOGICAL = 1.5 * math.sqrt(5) / 2
META = json.loads((ROOT / "blockouts/meta.json").read_text())


def scaled(im, s):
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def kaya_1x():
    k = scaled(Image.open(ROOT / "ref/kaya-idle-south.png").convert("RGBA"), K)
    return k.crop(k.getbbox())


def kaya_g1():
    k = reduce_pixel(Image.open(ROOT / "ref/kaya-idle-south.png"), K / 1.5)
    return k.crop(k.getbbox())


def g1_export(im, m, s):
    factor = m["grain_f"] / 1.5
    g1 = reduce_pixel(im, factor)
    if tone_mod.OUTLINE == "crisp1":
        g1 = crisp_outline(g1)
    bb = g1.getbbox()
    g1 = g1.crop(bb)
    ax, ay = m["ground_anchor_src_px"]
    a0, b0 = m["offset_in_footprint_screen_px"]
    rec = {"source": s["path"], "toned": None, "factor_from_source": round(factor, 4), "g1": list(g1.size),
           "tiles": s.get("tiles", []), "footprint_tiles": m["footprint_tiles"],
           "g1_anchor_px": [round(ax * factor - bb[0], 1), round(ay * factor - bb[1], 1)],
           "origin_in_footprint_logical_px": [round(a0 / PER_LOGICAL, 1), round(b0 / PER_LOGICAL, 1)],
           "extent_logical_px": [round(m["extent_screen_px"]["along_a"] / PER_LOGICAL, 1),
                                 round(m["extent_screen_px"]["along_b"] / PER_LOGICAL, 1)]}
    return g1, rec


def grid(cells, width=900):
    rows, row, w = [], [], 0
    for c in cells:
        if w + c.width > width and row:
            rows.append(row); row, w = [], 0
        row.append(c); w += c.width + 6
    rows.append(row)
    out = Image.new("RGBA", (max(sum(c.width + 6 for c in r) for r in rows) + 6,
                             sum(max(c.height for c in r) + 6 for r in rows) + 6), PAPER)
    y = 6
    for r in rows:
        x = 6
        for c in r:
            out.alpha_composite(c, (x, y)); x += c.width + 6
        y += max(c.height for c in r) + 6
    return out


def beside(fig, im, label, zoom=1):
    W, H = fig.width + im.width + 10, max(fig.height, im.height) + 4
    p = Image.new("RGBA", (W, H), GROUND)
    p.alpha_composite(fig, (2, H - 2 - fig.height)); p.alpha_composite(im, (fig.width + 8, H - 2 - im.height))
    if zoom > 1:
        p = p.resize((p.width * zoom, p.height * zoom), Image.NEAREST)
    out = Image.new("RGBA", (p.width, p.height + 14), PAPER)
    out.alpha_composite(p, (0, 14))
    ImageDraw.Draw(out).text((2, 1), label, fill=INK)
    return out


def main():
    sel = json.loads((ROOT / "selection-families.json").read_text())
    for d in ("toned", "g1"):
        (FAM / d).mkdir(parents=True, exist_ok=True)
    fig1, figg = kaya_1x(), kaya_g1()
    record, c1, cg = {}, [], []
    for name, s in sel.items():
        m = META[s["blockout"]]
        t = tone(Image.open(ROOT / s["path"]))
        t.save(FAM / "toned" / f"{name}.png")
        g1, rec = g1_export(t, m, s)
        rec["toned"] = f"families/toned/{name}.png"
        g1.save(FAM / "g1" / f"{name}.png")
        record[name] = rec
        one = scaled(t, m["grain_f"]); one = one.crop(one.getbbox())
        c1.append(beside(fig1, one, f"{name} {one.width}x{one.height}"))
        cg.append(beside(figg, g1, f"{name} G1 {g1.width}x{g1.height}", zoom=1))
        cg.append(beside(figg, g1, f"{name} G1 4x", zoom=4))
    (FAM / "families.json").write_text(json.dumps({
        "definition": "G1 = 1 art px per world px (toned source reduced by grain_f / 1.5; Kaya 59 px)",
        "placement": "draw the G1 image with g1_anchor_px on the screen point of logical ground (tile_x * 64 + origin[0], tile_y * 64 + origin[1]) at 1 px per world px (screen x = lx - ly, y = (lx + ly) / 2); the ground origin is the object's own min-x, min-y ground corner",
        "objects": record}, indent=1) + "\n")
    grid(c1).save(REVIEW / "families-1x.png")
    grid(cg, width=1400).save(REVIEW / "families-g1.png")
    market_toned()
    crops(sel)
    candidates(sel)


def market_toned():
    """Toned G1 copies of the market set, same placement as grain/grain.json (the tone pass moves no pixel's place)."""
    sel = json.loads((ROOT / "selection.json").read_text())
    out = ROOT / "grain" / "g1-toned"
    out.mkdir(parents=True, exist_ok=True)
    grain = json.loads((ROOT / "grain" / "grain.json").read_text())["objects"]
    for slug, rec in grain.items():
        name = next(n for n, s in sel.items() if s["path"] == rec["source"])
        s = sel[name]
        im = tone(Image.open(ROOT / s["path"]))
        g1 = reduce_pixel(im, rec["factor_from_source"])
        if tone_mod.OUTLINE == "crisp1":
            g1 = crisp_outline(g1)
        g1 = g1.crop(g1.getbbox())
        if s.get("repeat"):
            step = s["repeat"] / 1.5
            dx, dy = round(step * 2 / math.sqrt(5)), round(step / math.sqrt(5))
            big = Image.new("RGBA", (g1.width + dx, g1.height + dy))
            big.alpha_composite(g1, (0, 0)); big.alpha_composite(g1, (dx, dy)); g1 = big
        if g1.width % 2: g1 = g1.crop((0, 0, g1.width + 1, g1.height))
        if g1.height % 2: g1 = g1.crop((0, 0, g1.width, g1.height + 1))
        assert list(g1.size) == rec["g1"], (slug, g1.size, rec["g1"])
        g1.save(out / f"{slug}.png")


def crops(sel):
    fig = kaya_1x()
    panels = []
    for name, box in (("village-well", None), ("lantern-post", None), ("handcart", None), ("kiln", None),
                      ("low-planter", None), ("firewood", None)):
        if name not in sel:
            continue
        m = META[sel[name]["blockout"]]
        im = scaled(Image.open(FAM / "toned" / f"{name}.png"), m["grain_f"])
        im = im.crop(im.getbbox())
        p = beside(fig, im, f"{name} beside Kaya (game scale, 4x nearest)")
        body = p.crop((0, 14, p.width, p.height))
        panels.append(beside(Image.new("RGBA", (1, 1)), body, f"{name} beside Kaya (game scale, 4x nearest)", zoom=4))
    grid(panels, width=2400).save(REVIEW / "families-crops-4x.png")


def candidates(sel):
    names = sorted({p.name.rsplit("-f2-", 1)[0] for p in (ROOT / "raw").glob("*-f2-*")})
    cells = []
    for n in names:
        m = META[n]
        ims = [("blockout", Image.open(ROOT / f"blockouts/{n}.png"))]
        for p in sorted((ROOT / "raw").glob(f"{n}-f2-*")):
            if (p / "0.png").exists():
                ims.append((p.name.split("-f2-")[1], Image.open(p / "0.png")))
        for lab, im in ims:
            g = scaled(im.convert("RGBA"), m["grain_f"])
            g2 = g.resize((g.width * 2, g.height * 2), Image.NEAREST)
            cell = Image.new("RGBA", (g2.width + 4, g2.height + 16), GROUND)
            cell.alpha_composite(g2, (2, 14))
            mark = " (selected)" if sel.get(n, {}).get("path", "").startswith(f"raw/{n}-f2-{lab}") else ""
            ImageDraw.Draw(cell).text((2, 1), f"{n} {lab}{mark}", fill=INK)
            cells.append(cell)
    grid(cells, width=1500).save(REVIEW / "families-candidates.png")


if __name__ == "__main__":
    import os
    tone_mod.OUTLINE = os.environ.get("TONE_OUTLINE", "soft2")   # soft2 (default) or crisp1
    main()
