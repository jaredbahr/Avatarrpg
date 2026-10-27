"""Load G frames and place them at game scale (128 sheet px per tile, tile = 96 screen px at game zoom)."""
import json, os
from PIL import Image, ImageDraw, ImageFilter
from geo import paint
ROOT = 'public/art/units'
_cache = {}
def frame(name, clip='idleSouth', i=0):
    key = f'{name}/{clip}/{i}'
    for page in ['-g', '-g-2', '-g-3', '-g-4']:
        j = f'{ROOT}/{name}{page}.json'
        if not os.path.exists(j):
            continue
        d = json.load(open(j))
        for k, v in d['frames'].items():
            if k.endswith(key):
                if j not in _cache:
                    _cache[j] = Image.open(j.replace('.json', '.webp')).convert('RGBA')
                f = v['frame']
                return _cache[j].crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    raise KeyError(key)

def place(canvas, img, tx, ty, ox=0, oy=0, shadow=True, scale=0.75):
    """Foot at the tile centre; canvas origin offset (ox, oy) in painting px."""
    px, py = paint(tx + 0.5, ty + 0.5)
    px -= ox; py -= oy
    w, h = img.size
    im = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    if shadow:
        sh = Image.new('L', (60, 24), 0)
        ImageDraw.Draw(sh).ellipse((6, 4, 54, 20), fill=110)
        sh = sh.filter(ImageFilter.GaussianBlur(3))
        dark = Image.new('RGBA', sh.size, (27, 20, 16, 255)); dark.putalpha(sh)
        canvas.alpha_composite(dark, (round(px - 30 + 4), round(py - 12 + 2)))
    canvas.alpha_composite(im, (round(px - 0.5 * im.width), round(py - 0.85 * im.height)))
