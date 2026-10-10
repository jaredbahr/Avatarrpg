"""Checks for regions.py, one case per call: python test_regions.py <case> <work dir>.
Invoked from ba-dan-regions.test.ts; each case raises AssertionError on failure."""
import importlib.util
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location("regions", HERE / "regions.py")
R = importlib.util.module_from_spec(spec)
sys.modules["regions"] = R
spec.loader.exec_module(R)

ONE = (1150, 60, 1024, 682)  # one region: the trial's north view
TWO = (1000, 60, 1500, 682)  # two regions side by side, 822 px of overlap
SHIPPED = ROOT / "public" / "art" / "maps" / "ba-dan-scene"
TABLE = ROOT / "src" / "content" / "scenes" / "baDan.art.ts"


def village_for(work: Path, box):
    plan = R.make_plan(box)
    assert not R.check_plan(plan), R.check_plan(plan)
    v = R.ensure_village(work, plan)
    return plan, v


def texture(h, w, seed=1):
    """A smooth, detailed picture: the stitch must reproduce it exactly, whatever it holds."""
    rng = np.random.default_rng(seed)
    base = rng.integers(0, 255, (h // 8 + 1, w // 8 + 1, 3), dtype=np.uint8)
    big = np.asarray(Image.fromarray(base).resize((w, h), Image.BICUBIC))
    return np.clip(big.astype(int) + rng.integers(-12, 12, (h, w, 3)), 0, 255).astype(np.uint8)


def table():
    """The shipped uprights and ground plates, read from the generated table."""
    text = TABLE.read_text()
    uprights = {m.group(1): tuple(int(g) for g in m.groups()[1:]) for m in re.finditer(
        r"['\"]?([\w-]+)['\"]?:\s*\[(\d+), (\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\]", text)}
    plates = [tuple(int(g) for g in m.groups()) for m in re.finditer(
        r"\[(\d+), (\d+), (\d+), (\d+), (\d+)\]", text.split("BA_DAN_GROUND_PLATES")[1].split("BA_DAN_UPRIGHT_PAGES")[0])]
    return uprights, plates


def case_plan_covers_pan_box(work):
    plan = R.make_plan()
    assert len(plan["regions"]) == 12
    assert R.check_plan(plan) == []
    mo = 288
    xs = sorted({r["px"]["x"] for r in plan["regions"]})
    ys = sorted({r["px"]["y"] for r in plan["regions"]})
    assert all(R.RW - (b - a) >= mo for a, b in zip(xs, xs[1:])), xs
    assert all(R.RH - (b - a) >= mo for a, b in zip(ys, ys[1:])), ys
    assert xs[-1] + R.RW >= 4500 and ys[-1] + R.RH >= 2400
    orders = sorted(r["order"] for r in plan["regions"])
    assert orders == list(range(1, 13))
    # the first region is the one nearest the village centre; each later one has a painted side neighbour
    first = next(r for r in plan["regions"] if r["order"] == 1)
    assert first["id"] in ("r1c1", "r1c2"), first["id"]
    # other pan boxes, and a broken plan is caught
    for box in [(-200, -100, 3000, 1600), (0, 0, 2600, 1300), (-100, -100, 5000, 3000), (10, 10, 1000, 600)]:
        p = R.make_plan(box)
        assert R.check_plan(p) == [], (box, R.check_plan(p))
    bad = R.make_plan()
    bad["regions"][3]["px"]["x"] += 300
    assert R.check_plan(bad) != []


def one_region_inputs(work):
    """One region's plan and a painting under it: the frozen uprights over a flat ground, repainted."""
    plan, v = village_for(work / "one", ONE)
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    ground = np.empty((vh, vw, 3), np.uint8)
    ground[:] = (90, 120, 70)
    painting = R.over(ground, v.up[:vh, :vw])
    return plan, v, painting


def case_guide_is_the_painting_under_the_uprights(work):
    plan, v, painting = one_region_inputs(work)
    r = plan["regions"][0]
    gdir = work / "one" / "guides" / r["id"]
    R.build_guide(plan, v, painting, r, work / "none", gdir)
    for name in ("guide", "ground", "uprights", "mask", "carry", "carry-mask", "ids"):
        im = Image.open(gdir / f"{name}.png")
        assert im.size == (1536, 1024), (name, im.size)
    ys, xs = R.region_slice(r)
    ours = R.load_rgba(gdir / "uprights.png")
    assert np.array_equal(ours, v.up[ys, xs]), "the uprights are the frozen geometry's"
    assert np.array_equal(R.load_rgb(gdir / "ground.png"), painting[ys, xs]), "the ground is the painting"
    assert np.array_equal(R.load_rgb(gdir / "guide.png"), R.over(painting[ys, xs], ours))
    assert np.array_equal(np.asarray(Image.open(gdir / "mask.png")), ours[..., 3])
    meta = R.json.load(open(gdir / "ids.json"))
    assert meta["entries"] and all("depthKey" in e for e in meta["entries"])
    ids = R.load_rgb(gdir / "ids.png").astype(int)
    owner = ids[..., 0] | ids[..., 1] << 8 | ids[..., 2] << 16
    assert ((owner > 0) >= (ours[..., 3] >= 128)).all(), "a solid mask pixel has no owner"


def case_gate_self_and_shifts(work):
    plan, v, painting = one_region_inputs(work)
    r = plan["regions"][0]
    gdir = work / "one" / "guides" / r["id"]
    R.build_guide(plan, v, painting, r, work / "none", gdir)
    guide = R.load_rgb(gdir / "guide.png")
    none = work / "none"

    def moved(img, dx):
        return np.pad(img, ((0, 0), (dx, 0), (0, 0)), mode="edge")[:, :-dx]

    res = R.gate(plan, r, gdir, guide, none)
    assert res["pass"], res["fail"]
    assert res["blobs"] and all(b["dx"] == 0 and b["dy"] == 0 for b in res["blobs"])
    res = R.gate(plan, r, gdir, moved(guide, 4), none)
    assert not res["pass"] and res["frame"]["dx"] == 4, res["frame"]
    assert any("frame shifted" in f for f in res["fail"])
    assert R.gate(plan, r, gdir, moved(guide, 1), none)["pass"], "1 px is within tolerance"
    mask = np.asarray(Image.open(gdir / "mask.png"))
    big = max((b for b in R.find_blobs(mask) if b["area"] < 40000), key=lambda b: b["area"])
    x0, y0 = max(0, big["x0"] - R.BLOB_PAD), max(0, big["y0"] - R.BLOB_PAD)
    x1, y1 = min(1536, big["x1"] + R.BLOB_PAD), min(1024, big["y1"] + R.BLOB_PAD)
    cand = guide.copy()
    cand[y0:y1, x0:x1] = moved(guide[y0:y1, x0:x1], 4)
    res = R.gate(plan, r, gdir, cand, none)
    assert not res["pass"], "a blob shifted 4 px passed"
    assert abs(res["frame"]["dx"]) <= 1, res["frame"]
    bad = [b for b in res["blobs"] if b["status"] != "ok"]
    assert bad and any(b["dx"] == 4 for b in bad), res["blobs"]
    other = (np.random.default_rng(1).random(guide.shape) * 255).astype(np.uint8)
    res = R.gate(plan, r, gdir, other, none)
    assert not res["pass"] and any("not this region" in f for f in res["fail"]), res["fail"]
    small = work / "one" / "small.png"
    Image.fromarray(guide[:1000, :1500]).save(small)
    assert R.read_candidate(str(small)) is None, "a wrong size is refused before any measuring"


def case_guide_gate_accept_commands(work):
    """The three command-line tools end to end on the shipped painting: guide a real region from the
    accepted ones, gate and accept its own guide, refuse a 4 px shift."""
    import shutil
    out, accepted = work / "tools", work / "tools-accepted"
    shutil.rmtree(accepted, ignore_errors=True)
    accepted.mkdir(parents=True)
    for rid in ("r1c1", "r1c2"):
        shutil.copy(R.DEFAULT_ACCEPTED / f"{rid}.png", accepted / f"{rid}.png")
    base = ["--out", str(out), "--accepted", str(accepted)]
    assert R.main(base + ["guide", "r1c1"]) == 0
    gdir = out / "guides" / "r1c1"
    guide = R.load_rgb(gdir / "guide.png")
    assert guide.shape[:2] == (1024, 1536)
    painting = R.load_rgb(out / "stitched.png")
    ys, xs = R.region_slice(R.region_of(R.load_plan(out), "r1c1"))
    assert np.array_equal(R.load_rgb(gdir / "ground.png"), painting[ys, xs]), "the ground is the accepted painting"
    own = work / "tools-candidate.png"
    R.save(own, guide)
    assert R.main(base + ["gate", "r1c1", str(own)]) == 0
    shifted = work / "tools-shifted.png"
    R.save(shifted, np.pad(guide, ((0, 0), (4, 0), (0, 0)), mode="edge")[:, :-4])
    assert R.main(base + ["accept", "r1c1", str(shifted)]) == 1
    (accepted / "r1c1.json").unlink(missing_ok=True)
    assert R.main(base + ["accept", "r1c1", str(own)]) == 0
    info = R.json.load(open(accepted / "r1c1.json"))
    assert info["gate"]["pass"] and info["forced"] is False


def case_stitch_identical_reproduces(work):
    plan, v = village_for(work / "two", TWO)
    assert len(plan["regions"]) == 2
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    source = texture(vh, vw)
    images = {r["id"]: source[R.region_slice(r)] for r in plan["regions"]}
    out, rep = R.stitch(plan, images, v)
    assert rep["method"] == "seams", rep["method"]
    assert np.array_equal(out, source), int(np.abs(out.astype(int) - source).max())
    assert rep["unpaintedPixels"] == 0 and rep["disagreeingBoxes"] == 0
    assert rep["needsRepaint"] == [] and rep["forcedBlobs"] == 0
    # disagreement in an overlap is listed
    r0, r1 = plan["regions"]
    ov = R._intersect(r0["px"], r1["px"])
    images2 = {k: a.copy() for k, a in images.items()}
    b = images2[r1["id"]]
    oy, ox = ov["y"] - r1["px"]["y"] + 200, ov["x"] - r1["px"]["x"] + 300
    b[oy:oy + 64, ox:ox + 64] = 255 - b[oy:oy + 64, ox:ox + 64]
    _, rep2 = R.stitch(plan, images2, v)
    assert rep2["disagreeingBoxes"] >= 1, rep2
    box = rep2["disagreements"][0]["boxes"][0]
    assert box["x"] <= ox + r1["px"]["x"] <= box["x"] + box["width"] + 16
    # one region only (not a whole grid): cross-faded, the rest is the margin colour and is counted
    out3, rep3 = R.stitch(plan, {r0["id"]: images[r0["id"]]}, v)
    assert rep3["method"] == "feather" and rep3["unpaintedPixels"] > 0
    assert tuple(out3[-1, -1]) == R.MARGIN_RGB


def case_stitch_joins_without_ghosts_or_steps(work):
    plan, v = village_for(work / "two", TWO)
    r0, r1 = plan["regions"]
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    source = texture(vh, vw, seed=3)
    ov = R._intersect(r0["px"], r1["px"])
    a = source[R.region_slice(r0)].copy()
    b = source[R.region_slice(r1)].copy()
    # b is painted 10 levels lighter overall, registered to a: a colour step to ramp, not a ghost
    b = np.clip(b.astype(int) + 10, 0, 255).astype(np.uint8)
    out, rep = R.stitch(plan, {r0["id"]: a, r1["id"]: b}, v)
    row = out[ov["y"] + 300]
    x0, x1 = ov["x"], ov["x"] + ov["width"]
    left, right = source[ov["y"] + 300, x0 - 5:x0].astype(int), row[x1 - 5:x1].astype(int)
    assert np.array_equal(out[ov["y"] + 300, x0:x0 + 8], source[ov["y"] + 300, x0:x0 + 8]), "left of the join is a"
    assert (row[x1 - 8:x1].astype(int) - source[ov["y"] + 300, x1 - 8:x1]).mean() > 9, "right of the join is b"
    # the lightening arrives as a smooth ramp: the smoothed difference from a never jumps
    diff = (out.astype(int) - source)[ov["y"] + 100:ov["y"] + 500].mean(axis=(0, 2))[x0:x1]
    assert np.abs(np.diff(R.blur(diff[None, :], 8, 2)[0])).max() < 0.35, np.abs(np.diff(diff)).max()
    # and detail is not cross-faded: the join's edge energy is that of the sources, not softened
    def energy(img):
        g = img.astype(float).mean(-1)
        return np.abs(np.diff(g, axis=1)).mean()
    mid = slice(ov["y"] + 100, ov["y"] + 500), slice(x0 + ov["width"] // 2 - 40, x0 + ov["width"] // 2 + 40)
    assert energy(out[mid]) > 0.97 * energy(source[mid]), (energy(out[mid]), energy(source[mid]))
    # a patch the two painted differently is given whole to one side
    a2 = a.copy()
    seam = rep["seams"][0]
    sx = (seam["seamMin"] + seam["seamMax"]) // 2  # the join runs here: put the patch across it
    py, px = ov["y"] - r0["px"]["y"] + 150, sx - r0["px"]["x"] - 45
    a2[py:py + 90, px:px + 90] = 20
    out2, rep2 = R.stitch(plan, {r0["id"]: a2, r1["id"]: b}, v)
    y0, x0p = ov["y"] + 150, sx - 45
    patch = out2[y0:y0 + 90, x0p:x0p + 90].astype(int)
    from_a = np.abs(patch - a2[py:py + 90, px:px + 90]).mean()
    from_b = np.abs(patch - b[y0 - r1["px"]["y"]:y0 - r1["px"]["y"] + 90, x0p - r1["px"]["x"]:x0p - r1["px"]["x"] + 90]).mean()
    assert min(from_a, from_b) < 3 and max(from_a, from_b) > 20, (from_a, from_b)


def case_match_fill_follows_the_colour_change(work):
    rng = np.random.default_rng(5)
    own = rng.integers(40, 200, (200, 300, 3), dtype=np.uint8)
    paint = np.clip(own.astype(int) + np.array([12, -8, 5]), 0, 255).astype(np.uint8)
    trusted = np.zeros((200, 300), dtype=bool)
    trusted[:, :150] = True
    want = ~trusted
    got = R._match_fill(own, paint, trusted, want)
    expect = np.clip(own[want].astype(int) + np.array([12, -8, 5]), 0, 255)
    assert np.abs(got.astype(int) - expect).mean() < 1.0, np.abs(got.astype(int) - expect).mean()


def split_inputs(work):
    plan, v = village_for(work / "two", TWO)
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    ground = np.empty((vh, vw, 3), np.uint8)
    ground[:] = (90, 120, 70)
    a = v.up[:vh, :vw, 3:4].astype(float) / 255
    base = np.rint(ground * (1 - a) + v.up[:vh, :vw, :3] * a).astype(np.uint8)
    painting = np.clip(base.astype(int) + np.array([10, -6, 4]), 0, 255).astype(np.uint8)  # "repainted"
    return plan, v, painting


def case_split_keeps_the_silhouette_and_paints_the_rest(work):
    plan, v, painting = split_inputs(work)
    sdir = work / "two" / "split"
    rows, baked = R.split_sprites(v, painting, sdir)
    needed = v.needed()
    assert {r["id"] for r in rows} == {k for k, n in needed.items() if n > 0 and v.pieces[[p["id"] for p in v.pieces].index(k)]["sprite"]}
    assert {b["id"] for b in baked} == {k for k, n in needed.items() if n == 0 and any(p["id"] == k and p["sprite"] for p in v.pieces)}
    assert len(rows) >= 5
    vh, vw = painting.shape[:2]
    hidden = 0
    for row in rows:
        sp = R.load_rgba(sdir / row["file"])
        own = R.load_rgba(v.dir / v.pieces[row["index"]]["sprite"]["file"])
        c = row["canvas"]
        assert (row["x"] - c["x"], row["y"] - c["y"]) >= (0, 0)
        ty, tx = row["y"] - c["y"], row["x"] - c["x"]
        crop = own[ty:ty + row["height"], tx:tx + row["width"]]
        assert np.array_equal(sp[..., 3], crop[..., 3]), "alpha must be the geometry mask unchanged"
        assert (own[..., 3] > 0).sum() == (crop[..., 3] > 0).sum(), "trimming cut nothing"
        hidden += row["hiddenFilledFromSprite"]
        # a pixel the piece owns, opaque and clear is the painting's colour exactly
        sy0, sx0 = max(0, row["y"]), max(0, row["x"])
        sy1, sx1 = min(vh, row["y"] + row["height"]), min(vw, row["x"] + row["width"])
        if sy1 <= sy0 or sx1 <= sx0:
            continue
        own_here = v.ids[sy0:sy1, sx0:sx1] == row["index"] + 1
        part = sp[sy0 - row["y"]:sy1 - row["y"], sx0 - row["x"]:sx1 - row["x"]]
        solid = own_here & (part[..., 3] > 0) & (v.front[sy0:sy1, sx0:sx1] <= 2)
        assert np.array_equal(part[..., :3][solid], painting[sy0:sy1, sx0:sx1][solid])
    assert hidden > 0
    # hidden pixels carry the sprite's own picture moved by the repaint's colour change (+10, -6, +4)
    moved = 0
    for row in rows:
        if row["hiddenFilledFromSprite"] == 0:
            continue
        sp = R.load_rgba(sdir / row["file"])
        c = row["canvas"]
        own = R.load_rgba(v.dir / v.pieces[row["index"]]["sprite"]["file"])
        ty, tx = row["y"] - c["y"], row["x"] - c["x"]
        own = own[ty:ty + row["height"], tx:tx + row["width"]]
        sy0, sx0 = max(0, row["y"]), max(0, row["x"])
        sy1, sx1 = min(vh, row["y"] + row["height"]), min(vw, row["x"] + row["width"])
        own_here = np.zeros(sp.shape[:2], bool)
        own_here[sy0 - row["y"]:sy1 - row["y"], sx0 - row["x"]:sx1 - row["x"]] = (
            v.ids[sy0:sy1, sx0:sx1] == row["index"] + 1) | np.isin(
            v.ids[sy0:sy1, sx0:sx1], [i + 1 for i, p in enumerate(v.pieces) if needed[p["id"]] == 0])
        unseen = (own[..., 3] > 0) & ~own_here
        want = np.clip(own[..., :3].astype(int) + np.array([10, -6, 4]), 0, 255)
        err = np.abs(sp[..., :3].astype(int) - want)[unseen]
        assert err.mean() < 3.0, (row["id"], err.mean())  # colours that clip at 0 or 255 move less
        moved += int(unseen.sum())
    assert moved > 0


def case_split_plates_cover_and_overlap(work):
    plan, v, painting = split_inputs(work)
    sdir = work / "two" / "split"
    plates = R.cut_plates(painting, sdir)
    h, w = painting.shape[:2]
    cover = np.zeros((h, w), np.uint8)
    for p in plates:
        im = R.load_rgb(sdir / p["file"])
        assert im.shape[:2] == (p["height"], p["width"])
        assert np.array_equal(im, painting[p["y"]:p["y"] + p["height"], p["x"]:p["x"] + p["width"]])
        cover[p["y"]:p["y"] + p["height"], p["x"]:p["x"] + p["width"]] += 1
        assert p["x"] % 3 == 0 and p["y"] % 3 == 0
    assert cover.min() == 1 + 0 or cover.min() >= 1, "a gap"
    assert (cover > 1).any() and cover.max() <= 4
    cols, rows = R.PLATE_GRID
    assert len(plates) == cols * rows


def case_straddle_detects_added_clutter(work):
    plan, v, painting = split_inputs(work)
    painting = np.clip(painting.astype(int) - np.array([10, -6, 4]), 0, 255).astype(np.uint8)
    vh, vw = painting.shape[:2]
    solid = v.up[:vh, :vw, 3] >= 128
    # a vertical edge of the mask: solid on the left, ground on the right
    edge = solid[:, :-1] & ~solid[:, 1:]
    ys, xs = np.nonzero(edge[40:-40, 60:-60])
    pick = len(ys) // 2
    cy, cx = int(ys[pick]) + 40, int(xs[pick]) + 60
    # ground cover painted over the edge: the colour of the ground beside it, where the piece's own sprite
    # is something else
    painting[cy - 20:cy + 20, cx - 20:cx + 20] = (90, 120, 70)
    rows = R.straddle_report(v, painting)
    hit = [s for s in rows if s["box"]["x"] - 8 <= cx <= s["box"]["x"] + s["box"]["width"] + 8
           and s["box"]["y"] - 8 <= cy <= s["box"]["y"] + s["box"]["height"] + 8]
    assert hit, rows


def case_uprights_are_the_pieces_figures_stand_behind(work):
    plan = R.make_plan()
    v = R.ensure_village(work / "full", plan)
    uprights, _ = table()
    needed = v.needed()
    stands = {p["id"] for p in v.pieces if p["sprite"] is not None and needed[p["id"]] > 0}
    assert stands == set(uprights), (stands ^ set(uprights))
    ground = {p["id"] for p in v.pieces if needed[p["id"]] == 0}
    assert len(ground) == 29 and len(stands) == 49, (len(ground), len(stands))
    # the walkable cells frozen with the geometry are the map's (`baDan.test.ts` holds the map to them)
    assert len(v.walkable) > 200


def case_shipped_uprights_are_the_geometry_silhouette(work):
    plan = R.make_plan()
    v = R.ensure_village(work / "full", plan)
    uprights, _ = table()
    pages = {}
    by_id = {p["id"]: p for p in v.pieces}
    checked = 0
    for pid, (page, sx, sy, vx, vy, w, h) in uprights.items():
        if page not in pages:
            pages[page] = np.asarray(Image.open(SHIPPED / f"uprights-{page}.webp").convert("RGBA"))
        got = pages[page][sy:sy + h, sx:sx + w, 3]
        sp = by_id[pid]["sprite"]
        own = R.load_rgba(v.dir / sp["file"])[..., 3]
        want = own[vy - sp["y"]:vy - sp["y"] + h, vx - sp["x"]:vx - sp["x"] + w]
        assert np.array_equal(got, want), (pid, int((got != want).sum()))
        # and trimmed to exactly what it draws
        assert (got[0] > 0).any() and (got[-1] > 0).any() and (got[:, 0] > 0).any() and (got[:, -1] > 0).any(), pid
        assert int((own > 0).sum()) == int((got > 0).sum()), pid
        checked += 1
    assert checked == 49


def case_shipped_plates_are_continuous(work):
    _, plates = table()
    painting_w, painting_h = 4500, 2401
    ims = {}
    cover = np.zeros((painting_h, painting_w), np.uint8)
    for index, x, y, w, h in plates:
        im = np.asarray(Image.open(SHIPPED / f"ground-{index:02d}.webp").convert("RGB"))
        assert im.shape[:2] == (h, w), (index, im.shape)
        ims[index] = (x, y, im)
        cover[y:y + h, x:x + w] += 1
    assert cover.min() >= 1, "a gap between plates"
    # where two plates overlap they are one picture: the two encodes of the same pixels agree
    worst = 0.0
    bias = 0.0
    joins = 0
    for i, (xa, ya, a) in ims.items():
        for j, (xb, yb, b) in ims.items():
            if j <= i:
                continue
            x0, x1 = max(xa, xb), min(xa + a.shape[1], xb + b.shape[1])
            y0, y1 = max(ya, yb), min(ya + a.shape[0], yb + b.shape[0])
            if x1 <= x0 or y1 <= y0:
                continue
            if (x1 - x0) * (y1 - y0) < 50:
                continue  # a crossing of four plates: four pixels, not a join
            pa = a[y0 - ya:y1 - ya, x0 - xa:x1 - xa].astype(int)
            pb = b[y0 - yb:y1 - yb, x0 - xb:x1 - xb].astype(int)
            # two independent lossy encodes of one picture: each is within about 3.5 of it, so they differ by
            # that much, but never in one direction (a step at the hand-over would)
            d = np.abs(pa - pb).mean()
            worst = max(worst, d)
            bias = max(bias, float(np.abs((pa - pb).mean())))
            joins += 1
    assert joins == 17, joins
    assert worst < 9.0, worst
    assert bias < 1.5, bias
    # the picture is continuous across every join: the step over a plate edge is that of the picture itself
    xs = sorted({x for _, x, _, _, _ in plates} - {0})
    ys = sorted({y for _, _, y, _, _ in plates} - {0})
    full = np.zeros((painting_h, painting_w, 3), np.uint8)
    for index, (x, y, im) in sorted(ims.items(), reverse=True):  # later plates first, earlier ones over them
        full[y:y + im.shape[0], x:x + im.shape[1]] = im
    g = full.astype(int).mean(-1)
    # the step over a join, against the steps just either side of it in the same rows
    for x in xs:
        step = np.abs(g[:, x] - g[:, x - 1]).mean()
        near = np.mean([np.abs(g[:, c] - g[:, c - 1]).mean() for c in (*range(x - 8, x - 2), *range(x + 3, x + 9))])
        assert step < 1.15 * near + 0.5, (x, step, near)
    for y in ys:
        step = np.abs(g[y] - g[y - 1]).mean()
        near = np.mean([np.abs(g[r] - g[r - 1]).mean() for r in (*range(y - 8, y - 2), *range(y + 3, y + 9))])
        assert step < 1.15 * near + 0.5, (y, step, near)


def case_shipped_plate_perimeter_is_the_margin(work):
    _, plates = table()
    w, h = 4500, 2401
    full = np.zeros((h, w, 3), np.uint8)
    for index, x, y, pw, ph in plates:
        full[y:y + ph, x:x + pw] = np.asarray(Image.open(SHIPPED / f"ground-{index:02d}.webp").convert("RGB"))
    margin = np.array(R.MARGIN_RGB, int)
    edge = np.concatenate([full[0], full[-1], full[:, 0], full[:, -1]]).astype(int)
    assert np.abs(edge - margin).max() <= 3, np.abs(edge - margin).max()  # lossy encode, nothing more
    # and it is a ramp, not a band: 12 px in, still margin; 150 px in, the painting is back in places
    assert np.abs(full[12, 12:-12].astype(int) - margin).mean() < 4
    assert (np.abs(full[150, :].astype(int) - margin).max(-1) > 20).any()


def case_edge_fade_is_flat_bounded_irregular_and_deterministic(work):
    rng = np.random.RandomState(3)
    painting = rng.randint(40, 200, (900, 1400, 3)).astype(np.uint8)
    f = R.edge_fade(painting)
    assert np.array_equal(f, R.edge_fade(painting)), "deterministic"
    lo, hi = R.FADE_REACH
    assert f[:R.FADE_FLAT].min() == 1 and f[-R.FADE_FLAT:].min() == 1
    assert f[:, :R.FADE_FLAT].min() == 1 and f[:, -R.FADE_FLAT:].min() == 1
    assert f[hi + 1:-hi - 1, hi + 1:-hi - 1].max() == 0, "never reaches past 96 world px"
    # the reach along the top edge is not a straight line: where the weight drops under 0.5 varies
    first = np.argmax(f[:300, 200:1200] < 0.5, axis=0)
    assert first.max() - first.min() >= 10, (first.min(), first.max())
    assert first.min() >= R.FADE_FLAT - 1 and first.max() <= hi


CASES = {n[5:]: f for n, f in globals().items() if n.startswith("case_")}

if __name__ == "__main__":
    name, work = sys.argv[1], Path(sys.argv[2])
    work.mkdir(parents=True, exist_ok=True)
    CASES[name](work)
    print("ok", name)
