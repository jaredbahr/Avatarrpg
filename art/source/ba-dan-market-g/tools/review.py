"""Review sheets: candidates at game scale (1x) beside Kaya, plus 4x nearest-neighbour crops.

Game scale: a source px is 0.5625 screen px (see blockout.py). The figure is reduced the way the game
reduces it (the shipped 0.75 atlas cel, then 0.75 on screen, both smooth), so a reduced candidate is
compared with the figure exactly as it will be seen. The ground is a flat mid tone of the calmed Ba Dan
ground, so contact and silhouette read; no shadow is added.

    python3 -I tools/review.py out.png label=path[@scale] ...
"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
K = 0.5625
GROUND = (118, 122, 84, 255)
PAPER = (40, 36, 32, 255)


def reduce(im, s):
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    return im.resize((w, h), Image.LANCZOS if s < 1 else Image.NEAREST)


def trim(im):
    b = im.split()[3].getbbox()
    return im.crop(b) if b else im


def kaya(direction="south"):
    return trim(reduce(Image.open(ROOT / f"ref/kaya-idle-{direction}.png").convert("RGBA"), K))


def label(d, xy, text):
    d.text(xy, text, fill=(230, 222, 200, 255))


def sheet(out, items, crops=()):
    """items: (label, image already at source px, scale). Each panel: Kaya, the object at 1x, standing on one line."""
    fig = kaya()
    panels = []
    for name, im, s in items:
        obj = trim(reduce(im, s * K / K) if s != 1 else im)
        obj1 = trim(reduce(im.convert("RGBA"), K * s))
        w = fig.width + 12 + obj1.width + 24
        h = max(fig.height, obj1.height) + 40
        p = Image.new("RGBA", (w, h), GROUND)
        base = h - 14
        p.alpha_composite(fig, (12, base - fig.height))
        p.alpha_composite(obj1, (fig.width + 24, base - obj1.height))
        d = ImageDraw.Draw(p)
        label(d, (4, 2), f"{name}  {obj1.width}x{obj1.height} screen px")
        panels.append(p)
    W = sum(p.width for p in panels) + 8 * (len(panels) + 1)
    H = max(p.height for p in panels) + 16
    row = Image.new("RGBA", (W, H), PAPER)
    x = 8
    for p in panels:
        row.alpha_composite(p, (x, 8))
        x += p.width + 8
    rows = [row]
    for name, img in crops:
        c4 = img.resize((img.width * 4, img.height * 4), Image.NEAREST)
        r = Image.new("RGBA", (c4.width + 16, c4.height + 28), PAPER)
        r.alpha_composite(c4, (8, 22))
        label(ImageDraw.Draw(r), (8, 4), name + "  (4x nearest)")
        rows.append(r)
    W = max(r.width for r in rows)
    out_im = Image.new("RGBA", (W, sum(r.height for r in rows)), PAPER)
    y = 0
    for r in rows:
        out_im.alpha_composite(r, (0, y))
        y += r.height
    out_im.save(out)
    return out_im


def crop_at_1x(im, s, box, with_kaya=True, head=False):
    """A crop of the object reduced to game scale; with Kaya's head and shoulders beside it when asked."""
    obj = reduce(im.convert("RGBA"), K * s)
    c = obj.crop(box)
    if not with_kaya:
        bg = Image.new("RGBA", c.size, GROUND); bg.alpha_composite(c); return bg
    f = kaya()
    f = f.crop((0, 0, f.width, min(f.height, 34 if head else f.height)))
    W, H = f.width + 6 + c.width, max(f.height, c.height)
    bg = Image.new("RGBA", (W, H), GROUND)
    bg.alpha_composite(f, (0, H - f.height if not head else 0))
    bg.alpha_composite(c, (f.width + 6, H - c.height))
    return bg


if __name__ == "__main__":
    out = sys.argv[1]
    items = []
    for a in sys.argv[2:]:
        name, path = a.split("=", 1)
        s = 1.0
        if "@" in path:
            path, s = path.split("@"); s = float(s)
        items.append((name, Image.open(ROOT / path).convert("RGBA"), s))
    sheet(out, items)
