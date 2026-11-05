import json, sys
sys.path.insert(0, 'tools'); import pl
from obj import mapobj
from PIL import Image
def regen(name, src, scale, desc, strength=400, seed=5, pad=0):
    """map-objects with the v1 sprite, nearest-upscaled, as init_image: same design, redrawn at the new scale."""
    im = Image.open(src).convert('RGBA')
    w, h = round(im.width * scale), round(im.height * scale)
    W, H = max(32, w + 2 * pad), max(32, h + 2 * pad)
    W += (-W) % 4; H += (-H) % 4
    up = im.resize((w, h), Image.NEAREST); canvas = Image.new('RGBA', (W, H)); canvas.alpha_composite(up, ((W - w) // 2, H - h - pad))
    canvas.save(pl.RAW.parent / 'work' / f'init_{name}.png')
    e, r, ims = mapobj(name, desc, W, H, extra={'init_image': pl.b64(canvas), 'init_image_strength': strength, 'seed': seed}, estimate=2)
    return ims
if __name__ == '__main__':
    pass
