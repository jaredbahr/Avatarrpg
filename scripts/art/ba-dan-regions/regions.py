#!/usr/bin/env python3
"""The Ba Dan village painting: plan, stitch the accepted regions, split into ground plates and uprights.
See README.md.

    python scripts/art/ba-dan-regions/regions.py [--out DIR] [--accepted DIR] plan
    python scripts/art/ba-dan-regions/regions.py render      # the frozen upright geometry on the grid
    python scripts/art/ba-dan-regions/regions.py stitch      # DIR/stitched.png, stitch-report.json
    python scripts/art/ba-dan-regions/regions.py split       # DIR/split/ (uprights, plates, report)

`regen.sh` runs them in order and then `pack.ts`, which writes the shipped files. Run from the
repository root. Needs python 3 with PIL and numpy (no scipy) and, for `render`, node with tsx.
Everything is in "village pixels": the scene's world pixels times 1.5, measured from the pan box's
top-left corner.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SCALE = 1.5
RW, RH = 1536, 1024  # a region as the image tool edits it
PAN_BOX = (-200, -100, 3000, 1600)  # world px; shows everything the player can pan to
MIN_OVERLAP_WORLD = 192
DEFAULT_OUT = ROOT / ".review" / "regions"
DEFAULT_ACCEPTED = ROOT / "art" / "source" / "ba-dan-regions" / "accepted"
GEOMETRY = ROOT / "art" / "source" / "ba-dan-regions" / "geometry"

# What counts as a figure behind a piece, in world px around a standing foot point: a unit's drawing is
# well inside this. A piece no figure on a walkable cell can stand behind (it overlaps nobody it is in
# front of) is part of the ground; see `Village.needed`.
FIGURE_HALF_WIDTH, FIGURE_UP, FIGURE_DOWN = 48, 120, 8

# plates: the painting cut on a regular grid, each overlapping the next by PLATE_OVERLAP px so a
# fractional screen position can never leave a hairline between two, cuts on multiples of 3 px (whole world px)
PLATE_GRID = (4, 3)
PLATE_OVERLAP = 2

BLOB_MIN_AREA = 4000
BLOB_PAD = 24
SHIFT_RANGE = 40
BLOB_TOL = 2
FRAME_TOL = 1
NOT_THIS_REGION = 0.15  # frame edge correlation below this: a painting of somewhere else
BLOB_LOST = 0.05
CARRY_WARN = 4.0  # mean abs colour difference (0..255) inside carry-mask worth a warning
SEAM_WARN = 2.0  # seam difference over the ordinary neighbour difference
SEAM_FLOOR = 2.0  # ... where "ordinary" is at least this, so a flat margin does not inflate the ratio

MARGIN_RGB = (70, 91, 64)  # the page behind the village (`MAP_MARGIN_COLORS.verdant`): what no region covers


# The painting's outer edge is faded into the margin colour (`edge_fade`): flat margin at the very edge, then a
# soft irregular ramp reaching 48 to 96 world px in. The camera never shows past the painting
# (`Camera.viewExtent`); the fade is what keeps a viewport larger than the painting, or a canopy cut by the
# painting's border, from showing a ruled line.
FADE_FLAT = 12  # painting px at the edge that are exactly the margin colour
FADE_REACH = (72, 144)  # painting px (48 to 96 world px) the ramp may reach in
FADE_SEED = 20261010


# --------------------------------------------------------------------------- io

def load_rgb(path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def load_rgba(path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"))


def save(path, array: np.ndarray) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.ascontiguousarray(array)).save(path)


def sha256(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dump(path, data) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1)
        f.write("\n")


# --------------------------------------------------------------------------- plan

def _origins(extent: int, size: int, min_overlap: int) -> list[int]:
    """Origins along one axis: even spacing, each a multiple of 3 so it is a whole even world px."""
    if extent <= size:
        return [0]
    step_max = size - min_overlap
    n = math.ceil((extent - size) / step_max) + 1
    last = 3 * math.ceil((extent - size) / 3)
    out = [3 * round(i * last / (n - 1) / 3) for i in range(n)]
    out[-1] = last
    return out


def _intersect(a: dict, b: dict):
    x0, y0 = max(a["x"], b["x"]), max(a["y"], b["y"])
    x1 = min(a["x"] + a["width"], b["x"] + b["width"])
    y1 = min(a["y"] + a["height"], b["y"] + b["height"])
    if x1 <= x0 or y1 <= y0:
        return None
    return {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}


def make_plan(pan_box=PAN_BOX, min_overlap_world=MIN_OVERLAP_WORLD) -> dict:
    bx, by, bw, bh = pan_box
    if (bx * SCALE) % 1 or (by * SCALE) % 1 or (bx % 2) or (by % 2):
        raise ValueError("the pan box origin must be on even world pixels")
    pw, ph = math.ceil(bw * SCALE), math.ceil(bh * SCALE)
    mo = math.ceil(min_overlap_world * SCALE)
    xs, ys = _origins(pw, RW, mo), _origins(ph, RH, mo)
    regions = []
    for r, oy in enumerate(ys):
        for c, ox in enumerate(xs):
            regions.append({
                "id": f"r{r}c{c}", "row": r, "col": c,
                "px": {"x": ox, "y": oy, "width": RW, "height": RH},
                "world": {"x": bx + ox / SCALE, "y": by + oy / SCALE,
                          "width": RW / SCALE, "height": RH / SCALE},
            })
    by_id = {r["id"]: r for r in regions}
    for r in regions:
        r["neighbours"] = []
        for o in regions:
            if o is r:
                continue
            ov = _intersect(r["px"], o["px"])
            if ov is None:
                continue
            drow, dcol = o["row"] - r["row"], o["col"] - r["col"]
            if abs(drow) > 1 or abs(dcol) > 1:
                side = "far"  # overlaps without touching: only a very tall or wide pan box
            elif drow == 0:
                side = "left" if dcol < 0 else "right"
            elif dcol == 0:
                side = "top" if drow < 0 else "bottom"
            else:
                side = "corner"
            r["neighbours"].append({"id": o["id"], "side": side, "overlap": ov})
    # Order: from the region nearest the village centre, always next the unpainted region with the
    # most painted side-neighbours (then the nearest the centre), so each has painted context.
    cx, cy = pw / 2, ph / 2

    def dist(r):
        return math.hypot(r["px"]["x"] + RW / 2 - cx, r["px"]["y"] + RH / 2 - cy)

    done: list[str] = []
    todo = sorted(regions, key=lambda r: (dist(r), r["id"]))
    done.append(todo.pop(0)["id"])
    while todo:
        def key(r):
            sides = sum(1 for n in r["neighbours"] if n["side"] not in ("corner", "far") and n["id"] in done)
            anyn = sum(1 for n in r["neighbours"] if n["id"] in done)
            return (-sides, -anyn, dist(r), r["id"])
        nxt = min(todo, key=key)
        todo.remove(nxt)
        done.append(nxt["id"])
    for i, rid in enumerate(done):
        by_id[rid]["order"] = i + 1
    regions.sort(key=lambda r: r["order"])
    mx = max(r["px"]["x"] + RW for r in regions)
    my = max(r["px"]["y"] + RH for r in regions)
    return {
        "version": 1, "scale": SCALE, "size": {"width": RW, "height": RH},
        "panBox": {"x": bx, "y": by, "width": bw, "height": bh},
        "minOverlapWorld": min_overlap_world,
        "village": {"x": bx, "y": by, "width": math.ceil(mx / SCALE), "height": math.ceil(my / SCALE),
                    "pxWidth": mx, "pxHeight": my},
        "regions": regions,
    }


def check_plan(plan: dict) -> list[str]:
    """Problems with a plan: coverage of the pan box and the minimum overlap on every shared side."""
    problems = []
    pb = plan["panBox"]
    pw, ph = math.ceil(pb["width"] * SCALE), math.ceil(pb["height"] * SCALE)
    cover = np.zeros((ph, pw), dtype=bool)
    for r in plan["regions"]:
        p = r["px"]
        cover[p["y"]:p["y"] + p["height"], p["x"]:p["x"] + p["width"]] = True
    if not cover.all():
        problems.append(f"{int((~cover).sum())} px of the pan box are uncovered")
    mo = math.ceil(plan["minOverlapWorld"] * SCALE)
    for r in plan["regions"]:
        for o in plan["regions"]:
            drow, dcol = o["row"] - r["row"], o["col"] - r["col"]
            if (drow, dcol) not in ((0, 1), (1, 0)):
                continue
            ov = _intersect(r["px"], o["px"])  # recomputed, so a plan edited by hand is caught
            if dcol == 1 and (ov is None or ov["width"] < mo):
                problems.append(f"{r['id']}-{o['id']} overlap {0 if ov is None else ov['width']} px wide")
            if drow == 1 and (ov is None or ov["height"] < mo):
                problems.append(f"{r['id']}-{o['id']} overlap {0 if ov is None else ov['height']} px tall")
    seen = set()
    for r in plan["regions"]:
        if (r["px"]["x"] % 3) or (r["px"]["y"] % 3):
            problems.append(f"{r['id']} is not on whole world pixels")
        if r["order"] > 1 and not any(
            n["side"] not in ("corner", "far") and by_order(plan, n["id"]) < r["order"] for n in r["neighbours"]
        ):
            problems.append(f"{r['id']} has no earlier side neighbour")
        seen.add(r["id"])
    return problems


def by_order(plan: dict, rid: str) -> int:
    return next(r["order"] for r in plan["regions"] if r["id"] == rid)


# --------------------------------------------------------------------------- village

class Village:
    """The frozen upright geometry laid out at 1.5x: the upright layer, the owner map, each piece's sprite."""

    def __init__(self, directory: Path):
        self.dir = Path(directory)
        meta = json.load(open(self.dir / "pieces.json"))
        self.box, self.scale, self.pieces = meta["box"], meta["scale"], meta["pieces"]
        self.walkable = meta["walkable"]
        self.up = load_rgba(self.dir / "uprights.png")
        self.h, self.w = self.up.shape[:2]
        ids = load_rgb(self.dir / "ids.png").astype(np.int32)
        self.ids = ids[..., 0] | (ids[..., 1] << 8) | (ids[..., 2] << 16)
        self.front = load_rgb(self.dir / "front.png")[..., 0]
        self._needed: dict[str, int] | None = None

    def needed(self) -> dict[str, int]:
        """For each piece, the number of walkable cells where a figure stands behind it: the figure's
        foot depth (x + y of the foot point) is less than the piece's depth key, and the figure's box
        (FIGURE_* world px around the foot) overlaps something the piece draws. A piece with none is
        never in front of anyone, so nothing is gained by drawing it as an upright: it is ground."""
        if self._needed is not None:
            return self._needed
        ox, oy = self.box["x"], self.box["y"]
        out: dict[str, int] = {}
        for p in self.pieces:
            sp = p["sprite"]
            if sp is None:
                out[p["id"]] = 0
                continue
            alpha = load_rgba(self.dir / sp["file"])[..., 3] > 0
            h, w = alpha.shape
            hits = 0
            for cx, cy in self.walkable:
                if not p["depthKey"] > cx + cy + 1:
                    continue
                fx, fy = cx + 0.5, cy + 0.5
                sx, sy = 1024 + (fx - fy) * 64, (fx + fy) * 32
                x0 = max(0, int((sx - FIGURE_HALF_WIDTH - ox) * SCALE) - sp["x"])
                x1 = min(w, int((sx + FIGURE_HALF_WIDTH - ox) * SCALE) - sp["x"])
                y0 = max(0, int((sy - FIGURE_UP - oy) * SCALE) - sp["y"])
                y1 = min(h, int((sy + FIGURE_DOWN - oy) * SCALE) - sp["y"])
                if x1 > x0 and y1 > y0 and alpha[y0:y1, x0:x1].any():
                    hits += 1
            out[p["id"]] = hits
        self._needed = out
        return out


def ensure_village(out: Path, plan: dict, rebuild=False) -> Village:
    """The geometry's render under `out/village`, redone when the geometry or the renderer is newer."""
    vdir = Path(out) / "village"
    v = plan["village"]
    want = {"x": v["x"], "y": v["y"], "width": v["width"], "height": v["height"]}
    meta = vdir / "pieces.json"
    fresh = False
    if meta.exists() and not rebuild:
        try:
            m = json.load(open(meta))
            inputs = [HERE / "render-village.ts", GEOMETRY / "scene.json", *sorted((GEOMETRY / "sprites").glob("*"))]
            fresh = (m["box"] == want and (vdir / "uprights.png").exists() and (vdir / "ids.png").exists()
                     and (vdir / "front.png").exists()
                     and meta.stat().st_mtime >= max(f.stat().st_mtime for f in inputs))
        except (OSError, ValueError, KeyError):
            fresh = False
    if not fresh:
        vdir.mkdir(parents=True, exist_ok=True)
        cmd = ["node", "--import", "tsx", str(HERE / "render-village.ts"), str(vdir),
               str(want["x"]), str(want["y"]), str(want["width"]), str(want["height"]),
               "--scale", str(SCALE)]
        print("rendering the upright geometry:", " ".join(cmd[3:]), file=sys.stderr)
        subprocess.run(cmd, cwd=ROOT, check=True)
    return Village(vdir)


def region_slice(r: dict):
    p = r["px"]
    return slice(p["y"], p["y"] + p["height"]), slice(p["x"], p["x"] + p["width"])


def accepted_images(plan: dict, accepted: Path) -> dict[str, np.ndarray]:
    out = {}
    for r in plan["regions"]:
        f = Path(accepted) / f"{r['id']}.png"
        if f.exists():
            img = load_rgb(f)
            if img.shape[:2] == (RH, RW):
                out[r["id"]] = img
    return out


def over(ground: np.ndarray, layer: np.ndarray) -> np.ndarray:
    a = layer[..., 3:4].astype(np.float32) / 255
    out = ground.astype(np.float32) * (1 - a) + layer[..., :3].astype(np.float32) * a
    return np.rint(out).astype(np.uint8)


def current_painting(plan: dict, village: Village, accepted: Path, out: Path) -> np.ndarray:
    """The painting the accepted regions make (`stitched.png`, rebuilt if any region is newer), unfaded:
    the ground a guide is painted over."""
    images = accepted_images(plan, accepted)
    if not images:
        sys.exit(f"no accepted regions in {accepted}: there is no painting to guide from")
    f = Path(out) / "stitched.png"
    newest = max(Path(accepted, f"{rid}.png").stat().st_mtime for rid in images)
    if f.exists() and f.stat().st_mtime >= newest:
        return load_rgb(f)
    painting, _ = stitch(plan, images, village)
    save(f, painting)
    return painting


def compute_carry(plan: dict, region: dict, guide: np.ndarray, painted: dict[str, np.ndarray]):
    """Paste already-accepted neighbours' pixels over the guide. Returns (carry rgb, carry mask bool)."""
    carry = guide.copy()
    mask = np.zeros(guide.shape[:2], dtype=bool)
    rp = region["px"]
    # nearest earlier-accepted first; never overwrite carried pixels
    for n in sorted(region["neighbours"], key=lambda n: by_order(plan, n["id"])):
        img = painted.get(n["id"])
        if img is None or n["id"] == region["id"]:
            continue
        ov = n["overlap"]
        npx = next(x for x in plan["regions"] if x["id"] == n["id"])["px"]
        y0, x0 = ov["y"] - rp["y"], ov["x"] - rp["x"]
        sy, sx = ov["y"] - npx["y"], ov["x"] - npx["x"]
        h, w = ov["height"], ov["width"]
        fresh = ~mask[y0:y0 + h, x0:x0 + w]
        block = carry[y0:y0 + h, x0:x0 + w]
        block[fresh] = img[sy:sy + h, sx:sx + w][fresh]
        mask[y0:y0 + h, x0:x0 + w] = True
    return carry, mask


def build_guide(plan: dict, village: Village, painting: np.ndarray, region: dict, accepted: Path,
                outdir: Path) -> dict:
    """The guide a region is repainted over: the painting the accepted regions make, with the frozen
    geometry's uprights laid over it and the neighbours' pixels carried."""
    ys, xs = region_slice(region)
    ground = painting[ys, xs]  # the accepted painting under the guide, the frozen uprights over it
    guide = over(ground, village.up[ys, xs])
    up = village.up[ys, xs]
    ids = village.ids[ys, xs]
    carry, cmask = compute_carry(plan, region, guide, accepted_images(plan, accepted))
    d = Path(outdir)
    save(d / "guide.png", guide)
    save(d / "ground.png", ground)
    save(d / "uprights.png", up)
    save(d / "mask.png", up[..., 3])
    save(d / "carry.png", carry)
    save(d / "carry-mask.png", (cmask * 255).astype(np.uint8))
    enc = np.stack([ids & 255, (ids >> 8) & 255, (ids >> 16) & 255], axis=-1).astype(np.uint8)
    save(d / "ids.png", enc)
    entries = []
    for idx in np.unique(ids):
        if idx == 0:
            continue
        sel = ids == idx
        yy, xx = np.nonzero(sel)
        p = village.pieces[int(idx) - 1]
        entries.append({
            "index": int(idx) - 1, "id": p["id"], "depthKey": p["depthKey"],
            "exterior": p["exterior"], "ownedPixels": int(sel.sum()),
            "bbox": {"x": int(xx.min()), "y": int(yy.min()),
                     "width": int(xx.max() - xx.min() + 1), "height": int(yy.max() - yy.min() + 1)},
            "sprite": p["sprite"],
        })
    entries.sort(key=lambda e: (e["depthKey"], e["index"]))
    meta = {"region": region["id"], "px": region["px"], "world": region["world"],
            "carriedPixels": int(cmask.sum()), "entries": entries}
    dump(d / "ids.json", meta)
    return meta


# --------------------------------------------------------------------------- measuring



# --------------------------------------------------------------------------- measuring

def sob(g: np.ndarray) -> np.ndarray:
    p = np.pad(g, 1, mode="edge")
    gx = (p[:-2, 2:] + 2 * p[1:-1, 2:] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[1:-1, :-2] + p[2:, :-2])
    gy = (p[2:, :-2] + 2 * p[2:, 1:-1] + p[2:, 2:]) - (p[:-2, :-2] + 2 * p[:-2, 1:-1] + p[:-2, 2:])
    return np.hypot(gx, gy)


def luma(rgb: np.ndarray) -> np.ndarray:
    return np.asarray(Image.fromarray(rgb).convert("L"), dtype=np.float32)


def edges(rgb: np.ndarray) -> np.ndarray:
    return sob(luma(rgb))


def shift(a: np.ndarray, b: np.ndarray, R: int = SHIFT_RANGE):
    """Content shift (dx, dy) of b relative to a maximising edge correlation, and its strength."""
    a = a - a.mean()
    b = b - b.mean()
    F = np.fft.irfft2(np.fft.rfft2(b) * np.conj(np.fft.rfft2(a)), s=a.shape)
    w = np.roll(np.roll(F, R, 0), R, 1)[:2 * R + 1, :2 * R + 1]
    j = np.unravel_index(np.argmax(w), w.shape)
    n = np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9
    return int(j[1] - R), int(j[0] - R), float(w[j] / n)



def find_blobs(mask_img: np.ndarray, min_area: int = BLOB_MIN_AREA) -> list[dict]:
    solid = mask_img >= 128
    lab, n = label_blobs(solid)
    blobs = []
    for k in range(1, n + 1):
        sel = (lab == k) & solid
        area = int(sel.sum())
        if area <= min_area:
            continue
        yy, xx = np.nonzero(sel)
        blobs.append({"label": k, "area": area, "x0": int(xx.min()), "x1": int(xx.max()) + 1,
                      "y0": int(yy.min()), "y1": int(yy.max()) + 1})
    blobs.sort(key=lambda b: (b["y0"], b["x0"]))
    return blobs



def seam_scores(cand: np.ndarray, region_carry: np.ndarray, plan: dict, region: dict) -> list[dict]:
    """Per overlap with an accepted neighbour: difference across the carried block's inner border,
    against the ordinary neighbouring-pixel difference outside every carried block."""
    c = cand.astype(np.float32)
    h, w = cand.shape[:2]
    out_mask = ~region_carry
    base_pairs = []
    for dy, dx in ((0, 1), (1, 0)):
        a = c[:h - dy, :w - dx]
        b = c[dy:, dx:]
        ok = out_mask[:h - dy, :w - dx] & out_mask[dy:, dx:]
        base_pairs.append(np.abs(a - b).mean(axis=-1)[ok])
    baseline = float(np.concatenate(base_pairs).mean()) if base_pairs else 0.0
    rows = []
    rp = region["px"]
    for n in region["neighbours"]:
        ov = n["overlap"]
        y0, x0 = ov["y"] - rp["y"], ov["x"] - rp["x"]
        rect = np.zeros((h, w), dtype=bool)
        rect[y0:y0 + ov["height"], x0:x0 + ov["width"]] = True
        if not (rect & region_carry).any():
            continue
        diffs = []
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            ys = slice(max(0, -dy), h - max(0, dy))
            xs = slice(max(0, -dx), w - max(0, dx))
            yo = slice(max(0, dy), h - max(0, -dy))
            xo = slice(max(0, dx), w - max(0, -dx))
            inside = rect[ys, xs]
            outside = ~rect[yo, xo] & out_mask[yo, xo]
            sel = inside & outside
            if sel.any():
                diffs.append(np.abs(c[ys, xs] - c[yo, xo]).mean(axis=-1)[sel])
        if not diffs:
            continue
        d = np.concatenate(diffs)
        rows.append({"neighbour": n["id"], "side": n["side"], "pairs": int(d.size),
                     "seam": round(float(d.mean()), 3), "baseline": round(baseline, 3),
                     "ratio": round(float(d.mean() / max(baseline, SEAM_FLOOR)), 3)})
    return rows


def gate(plan: dict, region: dict, guide_dir: Path, cand: np.ndarray, accepted: Path) -> dict:
    """The registration check. `cand` is already known to be RGB 1536x1024."""
    guide = load_rgb(guide_dir / "guide.png")
    mask = np.asarray(Image.open(guide_dir / "mask.png").convert("L"))
    ge, ce = edges(guide), edges(cand)
    fx, fy, fc = shift(ge, ce)
    result = {"region": region["id"], "frame": {"dx": fx, "dy": fy, "corr": round(fc, 4)},
              "blobs": [], "fail": []}
    if fc < NOT_THIS_REGION:
        result["fail"].append(f"not this region (frame edge correlation {fc:.3f} < {NOT_THIS_REGION})")
    elif max(abs(fx), abs(fy)) > FRAME_TOL:
        result["fail"].append(f"frame shifted ({fx},{fy}) px, limit {FRAME_TOL}")
    if not any("not this region" in f for f in result["fail"]):
        for i, b in enumerate(find_blobs(mask)):
            x0, y0 = max(0, b["x0"] - BLOB_PAD), max(0, b["y0"] - BLOB_PAD)
            x1, y1 = min(RW, b["x1"] + BLOB_PAD), min(RH, b["y1"] + BLOB_PAD)
            dx, dy, c = shift(ge[y0:y1, x0:x1], ce[y0:y1, x0:x1])
            row = {"n": i + 1, "box": [x0, y0, x1, y1], "area": b["area"], "dx": dx, "dy": dy,
                   "corr": round(c, 4)}
            if c < BLOB_LOST:
                row["status"] = "lost"
                result["fail"].append(f"blob {i + 1} at ({x0},{y0}) not found in the candidate (corr {c:.3f})")
            elif max(abs(dx), abs(dy)) > BLOB_TOL:
                row["status"] = "shifted"
                result["fail"].append(f"blob {i + 1} at ({x0},{y0}) shifted ({dx},{dy}) px, limit {BLOB_TOL}")
            else:
                row["status"] = "ok"
            result["blobs"].append(row)
    # carried pixels
    carry, cmask = compute_carry(plan, region, guide, accepted_images(plan, accepted))
    result["carry"] = {"pixels": int(cmask.sum())}
    result["warn"] = []
    if cmask.any():
        diff = np.abs(cand.astype(np.int16) - carry.astype(np.int16)).mean(axis=-1)[cmask]
        result["carry"].update({"meanAbsDiff": round(float(diff.mean()), 3),
                                "p95": round(float(np.percentile(diff, 95)), 3),
                                "fractionOver16": round(float((diff > 16).mean()), 4)})
        if diff.mean() > CARRY_WARN:
            result["warn"].append(f"carried pixels repainted: mean difference {diff.mean():.1f}/255")
        seams = seam_scores(cand, cmask, plan, region)
        result["seams"] = seams
        for s in seams:
            if s["ratio"] > SEAM_WARN:
                result["warn"].append(f"seam with {s['neighbour']}: {s['ratio']:.1f}x the ordinary difference")
    result["pass"] = not result["fail"]
    return result


def print_gate(res: dict) -> None:
    f = res["frame"]
    print(f"gate {res['region']}: frame shift ({f['dx']:+d},{f['dy']:+d}) px, corr {f['corr']:.3f}")
    if res["blobs"]:
        print("  blob  area    box                      dx   dy   corr   status")
        for b in res["blobs"]:
            print(f"  {b['n']:>3}  {b['area']:>6}  {str(tuple(b['box'])):<24} {b['dx']:+4d} {b['dy']:+4d}  "
                  f"{b['corr']:.3f}  {b['status']}")
    c = res["carry"]
    if c["pixels"]:
        print(f"  carried: {c['pixels']} px, mean diff {c['meanAbsDiff']}, p95 {c['p95']}, "
              f">16 on {c['fractionOver16'] * 100:.1f}%")
        for s in res.get("seams", []):
            print(f"  seam {s['neighbour']} ({s['side']}): {s['seam']} vs ordinary {s['baseline']} "
                  f"= {s['ratio']}x")
    for w in res["warn"]:
        print("  warn:", w)
    for fl in res["fail"]:
        print("  FAIL:", fl)
    print("  PASS" if res["pass"] else "  FAILED")


# --------------------------------------------------------------------------- stitch



def label_blobs(mask: np.ndarray, factor: int = 4) -> tuple[np.ndarray, int]:
    """8-connected labelling of a boolean mask on a `factor`-downsampled grid; returns full-size labels."""
    h, w = mask.shape
    hh, ww = h // factor, w // factor
    small = mask[:hh * factor, :ww * factor].reshape(hh, factor, ww, factor).any(axis=(1, 3))
    lab = np.zeros((hh, ww), dtype=np.int32)
    n = 0
    for y, x in zip(*np.nonzero(small)):
        if lab[y, x]:
            continue
        n += 1
        lab[y, x] = n
        q = deque([(y, x)])
        while q:
            cy, cx = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < hh and 0 <= nx < ww and small[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
    full = np.zeros((h, w), dtype=np.int32)
    full[:hh * factor, :ww * factor] = np.repeat(np.repeat(lab, factor, 0), factor, 1)
    return full, n


# --------------------------------------------------------------------------- stitch

def feather_weight(plan: dict, region: dict, ramp: int = 160) -> np.ndarray:
    """1 in the interior, smoothly to ~0 at every border that has a neighbour beyond it."""
    h, w = RH, RW
    ys = np.arange(h, dtype=np.float32) + 0.5
    xs = np.arange(w, dtype=np.float32) + 0.5
    p = region["px"]
    wx = np.ones(w, dtype=np.float32)
    wy = np.ones(h, dtype=np.float32)
    has_left = any(n["overlap"]["x"] == p["x"] for n in region["neighbours"])
    has_right = any(n["overlap"]["x"] + n["overlap"]["width"] == p["x"] + w for n in region["neighbours"])
    has_top = any(n["overlap"]["y"] == p["y"] for n in region["neighbours"])
    has_bottom = any(n["overlap"]["y"] + n["overlap"]["height"] == p["y"] + h for n in region["neighbours"])
    if has_left:
        wx = np.minimum(wx, np.clip(xs / ramp, 0, 1))
    if has_right:
        wx = np.minimum(wx, np.clip((w - xs) / ramp, 0, 1))
    if has_top:
        wy = np.minimum(wy, np.clip(ys / ramp, 0, 1))
    if has_bottom:
        wy = np.minimum(wy, np.clip((h - ys) / ramp, 0, 1))
    s = lambda t: t * t * (3 - 2 * t)  # smoothstep
    return np.maximum(s(wy)[:, None] * s(wx)[None, :], 1e-4)


def _boxes(cells: np.ndarray, cell: int, origin=(0, 0)) -> list[dict]:
    lab, n = label_blobs(cells, 1)
    boxes = []
    for k in range(1, n + 1):
        yy, xx = np.nonzero(lab == k)
        boxes.append({"x": origin[0] + int(xx.min()) * cell, "y": origin[1] + int(yy.min()) * cell,
                      "width": int(xx.max() - xx.min() + 1) * cell,
                      "height": int(yy.max() - yy.min() + 1) * cell, "cells": int(yy.size)})
    return boxes


def _box1(a: np.ndarray, r: int, axis: int) -> np.ndarray:
    k = 2 * r + 1
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    n = a.shape[axis]
    return ((np.take(c, np.arange(k, k + n), axis=axis) - np.take(c, np.arange(0, n), axis=axis)) / k).astype(np.float32)


def blur(a: np.ndarray, r: int = 5, passes: int = 3) -> np.ndarray:
    """Separable box blur, `passes` times (close to a Gaussian of sigma about r * 0.58 * sqrt(passes))."""
    a = a.astype(np.float32)
    for _ in range(passes):
        a = _box1(_box1(a, r, 0), r, 1)
    return a


def find_seam(cost: np.ndarray, lo: int, hi: int) -> np.ndarray:
    """Cheapest top-to-bottom path through cost[:, lo:hi], one step of at most 1 column per row."""
    n = cost.shape[0]
    c = cost[:, lo:hi].astype(np.float64)
    acc = c.copy()
    back = np.zeros(c.shape, dtype=np.int8)
    cols = np.arange(c.shape[1])
    for i in range(1, n):
        prev = acc[i - 1]
        stack = np.stack([np.concatenate([[np.inf], prev[:-1]]), prev, np.concatenate([prev[1:], [np.inf]])])
        k = stack.argmin(0)
        acc[i] = c[i] + stack[k, cols]
        back[i] = k - 1
    j = int(acc[-1].argmin())
    path = np.zeros(n, dtype=np.int32)
    for i in range(n - 1, -1, -1):
        path[i] = j + lo
        j += int(back[i, j])
    return path


SEAM_MARGIN = 72  # the seam stays this far inside an overlap, so the blend never reaches a region's border
BLOB_DIFF = 30.0  # smoothed colour difference between two regions that counts as "they painted different things"
BLOB_MIN = 500  # px
LOW_BAND, HIGH_BAND = 24, 2  # box radii of the blends: colour fades over about +-50 px, detail over about +-4 px


def owner_mask(a: np.ndarray, b: np.ndarray, solid: np.ndarray, axis: int, margin: int = SEAM_MARGIN):
    """Which of two registered paintings of one overlap shows where: 0 = a, 1 = b.

    A cheapest seam (it keeps to where the two agree and off the uprights) is the base. A place where
    they painted different things (a canopy, a planter) goes whole to one side, never cut or cross-
    faded: the side whose own territory it runs into, else the side the seam already gave most of it.
    `axis` 1: a is left of b; 0: a is above b. Returns (mask, seam, forced blobs, conflicts), boxes as
    (x, y, w, h, area[, owner]) in the overlap's own pixels."""
    h, w = a.shape[:2]
    d = blur(np.abs(a.astype(np.float32) - b.astype(np.float32)).mean(-1), 5, 2)
    cost = d + 12 * blur(solid.astype(np.float32), 4, 1)
    if axis == 1:
        cost = cost + 0.004 * np.abs(np.arange(w) - w / 2)[None, :]
        seam = find_seam(cost, margin, w - margin)
        mask = (np.arange(w)[None, :] >= seam[:, None]).astype(np.float32)
    else:
        cost = (cost + 0.004 * np.abs(np.arange(h) - h / 2)[:, None]).T
        seam = find_seam(cost, margin, h - margin)
        mask = (np.arange(h)[:, None] >= seam[None, :]).astype(np.float32)
    lab, n = label_blobs(blur((d > BLOB_DIFF).astype(np.float32), 4, 1) > 0.01, 4)
    forced, conflicts = [], []
    for k in range(1, n + 1):
        sel = lab == k
        area = int(sel.sum())
        if area < BLOB_MIN:
            continue
        yy, xx = np.nonzero(sel)
        box = (int(xx.min()), int(yy.min()), int(xx.max() - xx.min() + 1), int(yy.max() - yy.min() + 1), area)
        first, last = (sel[:, 0].any(), sel[:, -1].any()) if axis == 1 else (sel[0, :].any(), sel[-1, :].any())
        if first and last:
            conflicts.append(box)
            continue
        owner = 0.0 if first else 1.0 if last else (1.0 if mask[sel].mean() >= 0.5 else 0.0)
        if (mask[sel] != owner).any():
            forced.append(box + (int(owner),))
        mask[sel] = owner
    return mask, seam, forced, conflicts


def merge_mask(a: np.ndarray, b: np.ndarray, mask: np.ndarray, sigma_r: int = 5) -> np.ndarray:
    """Two-band blend: colour (low band) fades over a wide ramp, detail (high band) over a narrow one."""
    a, b = a.astype(np.float32), b.astype(np.float32)
    wl, wh = blur(mask, LOW_BAND, 3)[..., None], blur(mask, HIGH_BAND, 2)[..., None]
    la, lb = blur(a, sigma_r), blur(b, sigma_r)
    out = la * (1 - wl) + lb * wl + (a - la) * (1 - wh) + (b - lb) * wh
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def _grid(plan: dict, ids) -> list[list[str]] | None:
    """The regions as rows of columns if `ids` fills the whole grid, else None."""
    regs = {r["id"]: r for r in plan["regions"]}
    ys = sorted({r["px"]["y"] for r in regs.values()})
    xs = sorted({r["px"]["x"] for r in regs.values()})
    rows = [[next((i for i, r in regs.items() if r["px"]["y"] == y and r["px"]["x"] == x), None) for x in xs] for y in ys]
    flat = [i for row in rows for i in row]
    return rows if None not in flat and set(flat) == set(ids) else None


def stitch_seams(plan: dict, images: dict[str, np.ndarray], village: Village, rows: list[list[str]]):
    """Join a full grid of accepted regions: each row left to right, then the rows top to bottom, every
    join through `owner_mask` and `merge_mask`. Returns (painting, one report row per join)."""
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    regs = {r["id"]: r for r in plan["regions"]}
    solid = village.up[:vh, :vw, 3] >= 128
    ox, oy = plan["village"]["x"], plan["village"]["y"]
    report = []

    def world(x, y, w, h):
        return {"x": ox + x / SCALE, "y": oy + y / SCALE, "width": w / SCALE, "height": h / SCALE}

    def note(pair, axis, mask, seam, forced, conflicts, x0, y0, step):
        base = x0 if axis == 1 else y0
        report.append({
            "pair": pair, "axis": "x" if axis == 1 else "y", "seamMin": int(seam.min()) + base,
            "seamMax": int(seam.max()) + base, "colourStepMeanAbs": round(step, 2),
            "forced": [{"x": f[0] + x0, "y": f[1] + y0, "width": f[2], "height": f[3], "areaPx": f[4],
                        "owner": pair[f[5]], "world": world(f[0] + x0, f[1] + y0, f[2], f[3])} for f in forced],
            "needsRepaint": [{"x": c[0] + x0, "y": c[1] + y0, "width": c[2], "height": c[3], "areaPx": c[4],
                              "world": world(c[0] + x0, c[1] + y0, c[2], c[3])} for c in conflicts]})

    def step_of(a, b, mask):
        """The low-band colour difference between the two paintings where the owner flips."""
        edge = np.zeros(mask.shape, dtype=bool)
        edge[:, :-1] |= mask[:, 1:] != mask[:, :-1]
        edge[:-1, :] |= mask[1:, :] != mask[:-1, :]
        if not edge.any():
            return 0.0
        return float(np.abs(blur(a, 5, 2) - blur(b, 5, 2)).mean(-1)[edge].mean())

    strips = []
    for row in rows:
        y0 = regs[row[0]]["px"]["y"]
        strip = np.zeros((RH, vw, 3), np.uint8)
        x0 = regs[row[0]]["px"]["x"]
        strip[:, x0:x0 + RW] = images[row[0]]
        for a, b in zip(row[:-1], row[1:]):
            bx = regs[b]["px"]["x"]
            ax_end = regs[a]["px"]["x"] + RW
            wa, wb = strip[:, bx:ax_end], images[b][:, :ax_end - bx]
            mask, seam, forced, conflicts = owner_mask(wa, wb, solid[y0:y0 + RH, bx:ax_end], 1)
            note([a, b], 1, mask, seam, forced, conflicts, bx, y0, step_of(wa, wb, mask))
            strip[:, bx:ax_end] = merge_mask(wa, wb, mask)
            strip[:, ax_end:bx + RW] = images[b][:, ax_end - bx:]
        strips.append((y0, strip, row[0][1]))
    out = np.zeros((vh, vw, 3), np.uint8)
    out[strips[0][0]:strips[0][0] + RH] = strips[0][1]
    prev_end = strips[0][0] + RH
    for (y0, strip, tag), (_, _, prev_tag) in zip(strips[1:], strips[:-1]):
        wa, wb = out[y0:prev_end], strip[:prev_end - y0]
        mask, seam, forced, conflicts = owner_mask(wa, wb, solid[y0:prev_end], 0)
        note([f"row{prev_tag}", f"row{tag}"], 0, mask, seam, forced, conflicts, 0, y0, step_of(wa, wb, mask))
        out[y0:prev_end] = merge_mask(wa, wb, mask)
        out[prev_end:y0 + RH] = strip[prev_end - y0:]
        prev_end = y0 + RH
    return out, report


def _value_noise(h: int, w: int, cell: int, rng: np.random.RandomState) -> np.ndarray:
    """Smooth 0..1 noise: random values on a `cell` px lattice, smoothstep-interpolated."""
    gh, gw = h // cell + 2, w // cell + 2
    grid = rng.rand(gh, gw).astype(np.float32)
    ys, xs = np.arange(h) / cell, np.arange(w) / cell
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = ys - y0, xs - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    top = grid[y0][:, x0] * (1 - fx) + grid[y0][:, x0 + 1] * fx
    bottom = grid[y0 + 1][:, x0] * (1 - fx) + grid[y0 + 1][:, x0 + 1] * fx
    return (top * (1 - fy)[:, None] + bottom * fy[:, None]).astype(np.float32)


def edge_fade(painting: np.ndarray) -> np.ndarray:
    """How much of the margin colour replaces the painting at each pixel, 0..1 (float32).

    1 on the outermost `FADE_FLAT` px of every side, so the painting's perimeter is exactly the margin colour.
    Inside, the ramp's reach varies from 48 to 96 world px: noise at two scales gives a ragged edge, and the
    painting itself leads it (the reach is longest where the painting is already close to the margin colour,
    its dark canopy and undergrowth, so the fade follows those shapes and a lawn is the first thing to come
    back clear). Deterministic: a fixed seed, no scipy."""
    h, w = painting.shape[:2]
    rng = np.random.RandomState(FADE_SEED)
    noise = 0.6 * _value_noise(h, w, 96, rng) + 0.4 * _value_noise(h, w, 28, rng)
    near = np.sqrt(((painting.astype(np.float32) - np.array(MARGIN_RGB, np.float32)) ** 2).sum(-1))
    kin = blur(np.exp(-near / 45.0), 8, 3)
    kin = np.clip((kin - kin.mean()) / (3 * kin.std() + 1e-6) + 0.5, 0, 1)
    lo, hi = FADE_REACH
    reach = lo + (hi - lo) * np.clip(0.55 * noise + 0.45 * kin, 0, 1)
    ys, xs = np.arange(h)[:, None], np.arange(w)[None, :]
    depth = np.minimum(np.minimum(ys, h - 1 - ys), np.minimum(xs, w - 1 - xs)).astype(np.float32)
    t = np.clip((depth - FADE_FLAT) / (reach - FADE_FLAT), 0, 1)
    return (1 - t * t * (3 - 2 * t)).astype(np.float32)


def fade_into_margin(colour: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """`colour` (h, w, 3 uint8) mixed toward the margin colour by `weight` (h, w)."""
    margin = np.array(MARGIN_RGB, np.float32)
    w = weight[..., None]
    return np.rint(colour.astype(np.float32) * (1 - w) + margin * w).astype(np.uint8)


def stitch(plan: dict, images: dict[str, np.ndarray], village: Village, threshold: float = 24.0,
           cell: int = 16) -> tuple[np.ndarray, dict]:
    """The painting from the accepted regions. A full grid is joined by `stitch_seams`; any other set
    (a trial, a test) is cross-faded with a smoothstep feather, normalised by the summed weights, so
    identical regions reproduce the source exactly either way. Pixels no region covers come from the
    unpainted village. The report lists where overlapping regions disagree (`disagreements`)."""
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    regs = {r["id"]: r for r in plan["regions"]}
    rows = _grid(plan, images)
    seams = None
    if rows is not None:
        out, seams = stitch_seams(plan, images, village, rows)
        covered = np.ones((vh, vw), dtype=bool)
    else:
        acc = np.zeros((vh, vw, 3), dtype=np.float64)
        wsum = np.zeros((vh, vw), dtype=np.float64)
        for rid, img in images.items():
            r = regs[rid]
            w = feather_weight(plan, r)
            ys, xs = region_slice(r)
            acc[ys, xs] += img.astype(np.float64) * w[..., None]
            wsum[ys, xs] += w
        covered = wsum > 0
        out = np.empty((vh, vw, 3), np.uint8)
        out[:] = MARGIN_RGB
        out[covered] = np.rint(acc[covered] / wsum[covered][:, None]).astype(np.uint8)
    report = {"regions": sorted(images), "method": "seams" if seams is not None else "feather",
              "unpaintedPixels": int((~covered).sum()), "disagreements": []}
    if seams is not None:
        report["seams"] = seams
        report["forcedBlobs"] = sum(len(s["forced"]) for s in seams)
        report["needsRepaint"] = [dict(c, pair=s["pair"]) for s in seams for c in s["needsRepaint"]]
    ids = sorted(images, key=lambda i: regs[i]["order"])
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            ov = _intersect(regs[a]["px"], regs[b]["px"])
            if ov is None:
                continue
            ay, ax = ov["y"] - regs[a]["px"]["y"], ov["x"] - regs[a]["px"]["x"]
            by_, bx = ov["y"] - regs[b]["px"]["y"], ov["x"] - regs[b]["px"]["x"]
            h, w = ov["height"], ov["width"]
            d = np.abs(images[a][ay:ay + h, ax:ax + w].astype(np.int16)
                       - images[b][by_:by_ + h, bx:bx + w].astype(np.int16)).mean(axis=-1)
            hh, ww = h // cell, w // cell
            if hh == 0 or ww == 0:
                continue
            cells = d[:hh * cell, :ww * cell].reshape(hh, cell, ww, cell).mean(axis=(1, 3))
            bad = cells > threshold
            row = {"pair": [a, b], "overlap": ov, "meanAbsDiff": round(float(d.mean()), 3),
                   "maxCellDiff": round(float(cells.max()), 2), "boxes": []}
            if bad.any():
                row["boxes"] = _boxes(bad, cell, (ov["x"], ov["y"]))
                for bx_ in row["boxes"]:
                    bx_["world"] = {"x": plan["village"]["x"] + bx_["x"] / SCALE,
                                    "y": plan["village"]["y"] + bx_["y"] / SCALE,
                                    "width": bx_["width"] / SCALE, "height": bx_["height"] / SCALE}
            report["disagreements"].append(row)
    report["disagreeingBoxes"] = sum(len(r["boxes"]) for r in report["disagreements"])
    return out, report


# --------------------------------------------------------------------------- split



def _dilate_fill(colour: np.ndarray, known: np.ndarray, want: np.ndarray, passes: int = 6):
    """Fill `want` pixels from known 4-neighbours, a ring at a time. Returns (colour, filled mask)."""
    colour = colour.astype(np.float32).copy()
    known = known.copy()
    filled = np.zeros_like(known)
    for _ in range(passes):
        todo = want & ~known
        if not todo.any():
            break
        acc = np.zeros_like(colour)
        cnt = np.zeros(known.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            ys = slice(max(0, dy), known.shape[0] + min(0, dy))
            xs = slice(max(0, dx), known.shape[1] + min(0, dx))
            yo = slice(max(0, -dy), known.shape[0] + min(0, -dy))
            xo = slice(max(0, -dx), known.shape[1] + min(0, -dx))
            k = known[yo, xo]
            acc[ys, xs] += colour[yo, xo] * k[..., None]
            cnt[ys, xs] += k
        new = todo & (cnt > 0)
        if not new.any():
            break
        colour[new] = acc[new] / cnt[new][:, None]
        known = known | new
        filled = filled | new
    return colour, filled


FILL_NEAR, FILL_FAR = 10, 40  # box radii (x3 passes) of the colour-change fields a hidden fill takes


def _match_fill(own: np.ndarray, paint: np.ndarray, trusted: np.ndarray, want: np.ndarray) -> np.ndarray:
    """The colours for `want` pixels: the sprite's own, plus the repaint's change of colour (painted minus
    own) spread from the trusted pixels. Close to a trusted pixel the change is its neighbours' (a normalised
    blur, radius FILL_NEAR); further in it is the wider field's (FILL_FAR), then the sprite's mean."""
    own = own.astype(np.float32)
    delta = (paint.astype(np.float32) - own) * trusted[..., None]
    w = trusted.astype(np.float32)
    fields = []
    for r in (FILL_NEAR, FILL_FAR):
        den = blur(w, r, 3)
        fields.append((blur(delta, r, 3) / np.maximum(den, 1e-6)[..., None], den))
    mean = delta.sum((0, 1)) / max(1.0, float(w.sum()))
    (near, dn), (far, df) = fields
    d = np.where((dn > 0.02)[..., None], near, np.where((df > 0.005)[..., None], far, mean))
    return np.clip(np.rint(own[want] + d[want]), 0, 255).astype(np.uint8)


def split_sprites(village: Village, painting: np.ndarray, outdir: Path,
                  fade: np.ndarray | None = None) -> tuple[list[dict], list[dict]]:
    """One upright sprite per piece a figure can stand behind: the painting's colour under the piece's own
    silhouette, trimmed to what it draws. Returns (the sprites, the pieces that stay in the ground).

    The silhouette (alpha, its antialiased rim included) is the geometry's, untouched. Every pixel under it
    that the piece owns takes the painting's colour, rim and all, so the sprite drawn over the plates is the
    painting again. A pixel under a piece that is ground shows what the painting shows there (that piece), so it
    takes the painting's colour too. A pixel under a faint rim of a front piece (the painting there is a blend of
    two pieces) takes on the repaint's colour change, spread from the nearest painted pixels. A pixel hidden by a
    front upright (the painting shows the other piece there), or beyond the painting, comes from the piece's
    existing sprite, moved by the colour change measured on its painted pixels. `fade` (the painting's
    `edge_fade`) is the margin weight those old-sprite fills take too: the painted pixels already carry it."""
    sprites, baked = [], []
    ph, pw = painting.shape[:2]
    needed = village.needed()
    is_ground = np.array([False] + [needed[p["id"]] == 0 for p in village.pieces])  # by owner id (0 = none)
    fades = np.array([False] + [bool(p["fade"]) for p in village.pieces])
    for p in village.pieces:
        sp = p["sprite"]
        if sp is None:
            continue
        own = load_rgba(village.dir / sp["file"])
        h, w = own.shape[:2]
        if needed[p["id"]] == 0:
            baked.append({"index": p["index"], "id": p["id"], "alphaPixels": int((own[..., 3] > 0).sum()),
                          "exterior": p["exterior"], "reason": "no figure on a walkable cell stands behind it"})
            continue
        x0, y0 = sp["x"], sp["y"]
        cx0, cy0 = max(0, x0), max(0, y0)
        cx1, cy1 = min(pw, x0 + w), min(ph, y0 + h)
        paint = np.zeros((h, w, 3), dtype=np.uint8)
        owner_here = np.zeros((h, w), dtype=bool)
        owner_id = np.zeros((h, w), dtype=np.int32)
        clear = np.zeros((h, w), dtype=bool)  # no weaker piece lies over the painted pixel
        inside = np.zeros((h, w), dtype=bool)
        if cx1 > cx0 and cy1 > cy0:
            sy, sx = slice(cy0 - y0, cy1 - y0), slice(cx0 - x0, cx1 - x0)
            paint[sy, sx] = painting[cy0:cy1, cx0:cx1]
            at = village.ids[cy0:cy1, cx0:cx1]
            owner_id[sy, sx] = at
            owner_here[sy, sx] = (at == p["index"] + 1) | is_ground[at]
            clear[sy, sx] = village.front[cy0:cy1, cx0:cx1] <= 2
            inside[sy, sx] = True
        alpha = own[..., 3]
        silhouette = alpha > 0
        # Where the painting shows a piece that is ground (in front of this one), whatever this piece's own
        # rim or outline was, the sprite is the painting: drawn over the ground it must not show through.
        under_ground = np.zeros((h, w), dtype=bool)
        if cx1 > cx0 and cy1 > cy0:
            under_ground[sy, sx] = is_ground[at]
        trusted = silhouette & owner_here & (clear | under_ground)
        hidden = silhouette & inside & ~owner_here
        outside = silhouette & ~inside
        edge = silhouette & owner_here & ~trusted
        # An edge pixel keeps the sprite's own rim colour (the existing edge treatment) and takes on the
        # repaint's change of colour, spread from the nearest pixels whose painted colour is the sprite's.
        delta = paint.astype(np.float32) - own[..., :3].astype(np.float32)
        delta, bled = _dilate_fill(delta, trusted, edge)
        out = own.copy()
        out[trusted, :3] = paint[trusted]
        out[bled, :3] = np.clip(np.rint(own[bled, :3].astype(np.float32) + delta[bled]), 0, 255).astype(np.uint8)
        # Not reachable from a trusted pixel: the existing sprite's own colour is kept (own[..., :3] is
        # already there). A pixel hidden by a front piece, or beyond the canvas, also keeps the existing
        # sprite, moved by the repaint's colour change as measured on this sprite's own trusted pixels
        # (`_match_fill`), so the part a fading front piece reveals meets the painted part at its border.
        unreached = edge & ~bled
        unseen = silhouette & ~owner_here
        # the colour change is measured on opaque pixels only: a rim pixel's painted colour is the piece blended
        # with what lies beside it, not the sprite's own colour moved by the repaint
        samples = trusted & (alpha >= 254)
        if unseen.any() and samples.any():
            out[unseen, :3] = _match_fill(own[..., :3], paint, samples, unseen)
            if fade is not None and inside.any():
                weight = np.zeros((h, w), np.float32)
                weight[sy, sx] = fade[cy0:cy1, cx0:cx1]
                faded = fade_into_margin(out[..., :3], weight)
                out[unseen, :3] = faded[unseen]
        step = step_raw = None  # mean colour difference between the hidden fill and the painted pixels beside it
        seen_ring = trusted & _grow(unseen & inside, 4)
        fill_ring = unseen & inside & _grow(trusted, 4)
        if seen_ring.any() and fill_ring.any():
            ref = out[seen_ring, :3].astype(np.float32).mean(0)
            step = round(float(np.abs(out[fill_ring, :3].astype(np.float32).mean(0) - ref).mean()), 2)
            step_raw = round(float(np.abs(own[fill_ring, :3].astype(np.float32).mean(0) - ref).mean()), 2)
        ys, xs = np.nonzero(silhouette)
        ty0, ty1, tx0, tx1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
        row = {"index": p["index"], "id": p["id"], "alphaPixels": int(silhouette.sum()),
               "hiddenBorderStep": step, "hiddenBorderStepUnmatched": step_raw,
               "paintedPixels": int((trusted | bled).sum()), "edgeShifted": int(bled.sum()),
               "edgeKeptFromSprite": int(unreached.sum()),
               "hiddenFilledFromSprite": int(hidden.sum()), "outsideCanvasFromSprite": int(outside.sum()),
               "hiddenBehindFading": int((hidden & fades[owner_id]).sum()),
               "file": f"uprights/{p['index']:03d}-{p['id']}.png",
               "x": x0 + tx0, "y": y0 + ty0, "width": tx1 - tx0, "height": ty1 - ty0,
               "canvas": {"x": x0, "y": y0, "width": w, "height": h},
               "fade": p["fade"], "exterior": p["exterior"], "figuresBehind": needed[p["id"]]}
        save(Path(outdir) / row["file"], out[ty0:ty1, tx0:tx1])
        sprites.append(row)
    return sprites, baked


def _grow(mask: np.ndarray, r: int) -> np.ndarray:
    a = mask.copy()
    for _ in range(r):
        n = a.copy()
        n[1:] |= a[:-1]
        n[:-1] |= a[1:]
        n[:, 1:] |= a[:, :-1]
        n[:, :-1] |= a[:, 1:]
        a = n
    return a


def straddle_report(village: Village, painting: np.ndarray, min_area: int = 150) -> list[dict]:
    """Painting the existing sprites did not have, lying across an upright's silhouette edge with ground.

    The ground plates carry the whole painting and an upright carries what is inside its silhouette, so
    the two always agree in colour; what a planting that crosses the edge can show is a cut when a figure
    passes behind the upright. A candidate is a pixel within 5 px inside a silhouette's edge against
    bare ground, whose painted colour is within 32 of the ground painted just outside (it reads as ground
    cover, not as the piece) and more than 60 from the existing sprite's colour. Candidates are grouped
    (grown 6 px) and listed with the piece that owns most of them."""
    h, w = painting.shape[:2]
    ids = village.ids[:h, :w]
    owner = ids > 0
    ground = ~owner
    band = owner & _grow(ground, 5)
    paint = painting.astype(np.float32)
    own = village.up[:h, :w, :3].astype(np.float32)
    gm = ground.astype(np.float32)
    den = blur(gm, 8, 2)
    outside = blur(paint * gm[..., None], 8, 2) / np.maximum(den, 1e-3)[..., None]
    cand = band & (den > 0.1) & (np.abs(blur(paint, 3, 2) - outside).max(-1) < 32) & (np.abs(paint - own).max(-1) > 60)
    lab, count = label_blobs(_grow(cand, 6), 4)
    needed = village.needed()
    rows = []
    for k in range(1, count + 1):
        sel = (lab == k) & cand
        area = int(sel.sum())
        if area < min_area:
            continue
        yy, xx = np.nonzero(sel)
        piece = village.pieces[int(np.bincount(ids[sel]).argmax()) - 1]
        rows.append({"box": {"x": int(xx.min()), "y": int(yy.min()), "width": int(xx.max() - xx.min() + 1),
                             "height": int(yy.max() - yy.min() + 1)},
                     "areaPx": area, "owner": piece["id"], "foliage": piece["id"].startswith("tree-"),
                     "upright": needed[piece["id"]] > 0})
    rows.sort(key=lambda r: -r["areaPx"])
    return rows


def _cuts(total: int, n: int) -> list[int]:
    """n+1 cut positions along `total` px, the inner ones on multiples of 3 (whole world px)."""
    step = 3 * round(total / n / 3)
    return [i * step for i in range(n)] + [total]


def cut_plates(painting: np.ndarray, outdir: Path, grid=PLATE_GRID, overlap=PLATE_OVERLAP) -> list[dict]:
    """The painting cut on a regular grid; each plate runs `overlap` px into the next so there is no gap
    whatever fraction of a screen pixel a plate edge lands on."""
    h, w = painting.shape[:2]
    cols, rows = grid
    xs, ys = _cuts(w, cols), _cuts(h, rows)
    out = []
    for j in range(rows):
        for i in range(cols):
            x0, y0 = xs[i], ys[j]
            x1 = min(w, xs[i + 1] + (overlap if i + 1 < cols else 0))
            y1 = min(h, ys[j + 1] + (overlap if j + 1 < rows else 0))
            index = j * cols + i
            row = {"index": index, "file": f"plates/plate-{index:02d}.png", "x": x0, "y": y0,
                   "width": x1 - x0, "height": y1 - y0}
            save(Path(outdir) / row["file"], painting[y0:y1, x0:x1])
            out.append(row)
    return out


# --------------------------------------------------------------------------- commands

def load_plan(out: Path) -> dict:
    """The plan in `out/regions.json`; the default plan is written there if there is none."""
    f = Path(out) / "regions.json"
    if not f.exists():
        dump(f, make_plan())
    return json.load(open(f))


def cmd_plan(a) -> int:
    pan = tuple(a.pan_box)
    plan = make_plan(pan, a.min_overlap)
    problems = check_plan(plan)
    dump(Path(a.out) / "regions.json", plan)
    v = plan["village"]
    print(f"{len(plan['regions'])} regions of {RW}x{RH} px ({RW / SCALE:.0f}x{RH / SCALE:.1f} world px) over the "
          f"pan box {pan}; painting {v['pxWidth']}x{v['pxHeight']} px")
    xs = sorted({r["px"]["x"] for r in plan["regions"]})
    ys = sorted({r["px"]["y"] for r in plan["regions"]})
    print(f"column origins {xs} (overlap {[RW - (b - a_) for a_, b in zip(xs, xs[1:])]} px), "
          f"row origins {ys} (overlap {[RH - (b - a_) for a_, b in zip(ys, ys[1:])]} px)")
    for p in problems:
        print("PROBLEM:", p)
    return 1 if problems else 0


def cmd_guide(a) -> int:
    plan = load_plan(a.out)
    ids = [r["id"] for r in plan["regions"]] if a.id == "all" else [a.id]
    village = ensure_village(Path(a.out), plan)
    painting = current_painting(plan, village, Path(a.accepted), Path(a.out))
    for rid in ids:
        r = region_of(plan, rid)
        meta = build_guide(plan, village, painting, r, Path(a.accepted), Path(a.out) / "guides" / rid)
        print(f"guide {rid}: {RW}x{RH}, {len(meta['entries'])} owners, carried {meta['carriedPixels']} px "
              f"-> {Path(a.out) / 'guides' / rid}")
    return 0


def region_of(plan: dict, rid: str) -> dict:
    for r in plan["regions"]:
        if r["id"] == rid:
            return r
    sys.exit(f"unknown region {rid}; have {', '.join(r['id'] for r in plan['regions'])}")



def read_candidate(path: str):
    im = Image.open(path)
    if im.size != (RW, RH):
        print(f"REFUSED: {path} is {im.size[0]}x{im.size[1]}, not {RW}x{RH}. The image tool must be given the "
              f"guide at exactly that size and return it at exactly that size.", file=sys.stderr)
        return None
    return np.asarray(im.convert("RGB"))


def run_gate(a, rid, cand_path):
    plan = load_plan(a.out)
    r = region_of(plan, rid)
    cand = read_candidate(cand_path)
    if cand is None:
        return None
    gdir = Path(a.out) / "guides" / rid
    if not (gdir / "guide.png").exists():
        village = ensure_village(Path(a.out), plan)
        painting = current_painting(plan, village, Path(a.accepted), Path(a.out))
        build_guide(plan, village, painting, r, Path(a.accepted), gdir)
    res = gate(plan, r, gdir, cand, Path(a.accepted))
    res["candidate"] = str(cand_path)
    return res


def cmd_gate(a) -> int:
    res = run_gate(a, a.id, a.candidate)
    if res is None:
        return 2
    print_gate(res)
    dump(a.json or Path(a.out) / "gates" / f"{a.id}.json", res)
    return 0 if res["pass"] else 1


def cmd_accept(a) -> int:
    res = run_gate(a, a.id, a.candidate)
    if res is None:
        return 2
    print_gate(res)
    dump(Path(a.out) / "gates" / f"{a.id}.json", res)
    if not res["pass"] and not a.force:
        print("not accepted (use --force to store a failing candidate)")
        return 1
    dest = Path(a.accepted) / f"{a.id}.png"
    img = load_rgb(a.candidate)
    save(dest, img)
    info = {"region": a.id, "source": {"path": str(a.candidate), "sha256": sha256(a.candidate)},
            "stored": {"path": str(dest), "sha256": sha256(dest)},
            "gate": {"pass": res["pass"], "frame": res["frame"], "blobs": res["blobs"],
                     "carry": res["carry"], "warn": res["warn"], "fail": res["fail"]},
            "prompt": ({"path": str(a.prompt), "sha256": sha256(a.prompt)} if a.prompt else None),
            "forced": bool(a.force and not res["pass"])}
    dump(Path(a.accepted) / f"{a.id}.json", info)
    print("accepted", a.id, "->", dest)
    return 0




def cmd_render(a) -> int:
    plan = load_plan(a.out)
    village = ensure_village(Path(a.out), plan, rebuild=True)
    print(f"{len(village.pieces)} pieces on a {village.w}x{village.h} grid -> {Path(a.out) / 'village'}")
    return 0


def cmd_stitch(a) -> int:
    plan = load_plan(a.out)
    village = ensure_village(Path(a.out), plan)
    images = accepted_images(plan, Path(a.accepted))
    if not images:
        sys.exit("no accepted regions to stitch")
    if a.complete:
        bad = [r["id"] for r in plan["regions"] if r["id"] not in images]
        if bad:
            sys.exit(f"accepted regions missing or not {RW}x{RH}: {', '.join(bad)}")
    out, report = stitch(plan, images, village, a.threshold)
    save(Path(a.out) / "stitched.png", out)
    dump(Path(a.out) / "stitch-report.json", report)
    print(f"stitched {len(images)} regions by {report['method']} -> {Path(a.out) / 'stitched.png'} "
          f"({out.shape[1]}x{out.shape[0]}); unpainted {report['unpaintedPixels']} px")
    for s in report.get("seams", []):
        print(f"  seam {s['pair'][0]}|{s['pair'][1]}: colour step {s['colourStepMeanAbs']}, "
              f"{len(s['forced'])} disagreements given whole to one side, {len(s['needsRepaint'])} needing a repaint")
    for c in report.get("needsRepaint", []):
        print(f"  REPAINT {c['pair']} village px ({c['x']},{c['y']}) {c['width']}x{c['height']}")
    return 0


def cmd_split(a) -> int:
    import shutil
    plan = load_plan(a.out)
    village = ensure_village(Path(a.out), plan)
    src = Path(a.painting) if a.painting else Path(a.out) / "stitched.png"
    if not src.exists():
        sys.exit(f"no painting at {src}; run `stitch` first")
    painting = load_rgb(src)
    vh, vw = plan["village"]["pxHeight"], plan["village"]["pxWidth"]
    if painting.shape[:2] != (vh, vw):
        sys.exit(f"painting is {painting.shape[1]}x{painting.shape[0]}, the village is {vw}x{vh}")
    fade = edge_fade(painting)
    painting = fade_into_margin(painting, fade)
    save(Path(a.out) / "faded.png", painting)
    sdir = Path(a.out) / "split"
    for stale in ("uprights", "plates"):
        shutil.rmtree(sdir / stale, ignore_errors=True)
    sprites, baked = split_sprites(village, painting, sdir, fade)
    plates = cut_plates(painting, sdir)
    straddles = straddle_report(village, painting)
    report = {
        "painting": {"file": src.name, "width": vw, "height": vh, "scale": SCALE,
                     "worldX": plan["village"]["x"], "worldY": plan["village"]["y"]},
        "sprites": sprites, "ground": baked, "plates": plates, "straddles": straddles,
        "totals": {"uprights": len(sprites), "ground": len(baked),
                   "hiddenFilledFromSprite": sum(s["hiddenFilledFromSprite"] for s in sprites),
                   "hiddenBehindFading": sum(s["hiddenBehindFading"] for s in sprites),
                   "edgeShifted": sum(s["edgeShifted"] for s in sprites),
                   "edgeKeptFromSprite": sum(s["edgeKeptFromSprite"] for s in sprites),
                   "outsideCanvasFromSprite": sum(s["outsideCanvasFromSprite"] for s in sprites),
                   "opaquePixels": sum(s["alphaPixels"] for s in sprites),
                   "trimmedPixels": sum(s["width"] * s["height"] for s in sprites)},
    }
    dump(sdir / "split-report.json", report)
    t = report["totals"]
    print(f"split: {t['uprights']} uprights, {t['ground']} pieces left in the ground; hidden pixels filled from "
          f"existing sprites {t['hiddenFilledFromSprite']}, edge pixels shifted {t['edgeShifted']}, kept from "
          f"sprite {t['edgeKeptFromSprite']}; {len(plates)} plates")
    loose = [s for s in straddles if s["upright"] and not s["foliage"]]
    print(f"painting across an upright's edge: {len(straddles)} places ({len(loose)} on dressing, houses, walls)")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--accepted", default=str(DEFAULT_ACCEPTED))
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan")
    p.add_argument("--pan-box", type=float, nargs=4, default=list(PAN_BOX), metavar=("X", "Y", "W", "H"))
    p.add_argument("--min-overlap", type=int, default=MIN_OVERLAP_WORLD)
    p.set_defaults(fn=cmd_plan)
    p = sub.add_parser("guide")
    p.add_argument("id", help="a region id, or `all`")
    p.set_defaults(fn=cmd_guide)
    p = sub.add_parser("gate")
    p.add_argument("id")
    p.add_argument("candidate")
    p.add_argument("--json")
    p.set_defaults(fn=cmd_gate)
    p = sub.add_parser("accept")
    p.add_argument("id")
    p.add_argument("candidate")
    p.add_argument("--prompt")
    p.add_argument("--force", action="store_true")
    p.set_defaults(fn=cmd_accept)
    p = sub.add_parser("render")
    p.set_defaults(fn=cmd_render)
    p = sub.add_parser("stitch")
    p.add_argument("--complete", action="store_true", help="fail unless every planned region has an accepted painting of the right size")
    p.add_argument("--threshold", type=float, default=24.0, help="mean abs difference per 16 px cell to list")
    p.set_defaults(fn=cmd_stitch)
    p = sub.add_parser("split")
    p.add_argument("--painting")
    p.set_defaults(fn=cmd_split)
    a = ap.parse_args(argv)
    for k in ("out", "accepted"):
        setattr(a, k, Path(getattr(a, k)))
    if hasattr(a, "pan_box"):
        a.pan_box = [int(v) if float(v).is_integer() else v for v in a.pan_box]
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
