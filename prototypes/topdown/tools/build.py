"""Pack assets/ into atlases, inline them as base64 and write topdown-demo.html from src/."""
import base64, io, json
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
A = H / 'assets'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
out = {'tiles': {}, 'tileKey': {}, 'chars': {}, 'objects': {}}
# terrain: one 4x4 atlas per Wang set, index = int(key, 2) with key = NW NE SW SE; which terrain '1' means is measured, not assumed
def green(im): r, g, b = im.convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0)); return g - (r + b) / 2
def blue(im): r, g, b = im.convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0)); return b - r
for name, src, kind in [('gc', 'gc_pro2', 'GC'), ('canal', 'canal', 'WC'), ('dirt', 'dirt', 'DG')]:
    t = {k: Image.open(A / 'tiles' / src / f'c{k}.png').convert('RGBA') for k in [format(i, '04b') for i in range(16)]}
    atlas = Image.new('RGBA', (64, 64))
    for k, im in t.items():
        i = int(k, 2); atlas.alpha_composite(im, ((i % 4) * 16, (i // 4) * 16))
    one, zero = t['1111'], t['0000']
    if kind == 'GC': m = {'1': 'C', '0': 'G'} if green(zero) > green(one) else {'1': 'G', '0': 'C'}
    if kind == 'WC': m = {'1': 'C', '0': 'W'} if blue(zero) > blue(one) else {'1': 'W', '0': 'C'}
    if kind == 'DG': m = {'1': 'G', '0': 'D'} if green(one) > green(zero) else {'1': 'D', '0': 'G'}
    out['tiles'][name] = uri(atlas); out['tileKey'][name] = m
    atlas.save(A / 'tiles' / f'{name}_atlas.png')
# characters: one atlas per clip, a row per direction it has, 48 px cells (rotations padded to the animation canvas)
def clip(char, prefix):
    m = json.load(open(A / 'chars' / char / 'meta.json'))
    for k, v in m['anims'].items():
        if k.startswith(prefix) and not k.endswith('1081cc'): return v
def foot(atlas, cell):
    # the lowest opaque row of the clip, so every clip stands on the same ground line
    from collections import Counter
    b = [(atlas.crop((x, y, x + cell, y + cell)).getbbox() or (0, 0, 0, 0))[3] for y in range(0, atlas.height, cell) for x in range(0, atlas.width, cell)]
    return Counter(v for v in b if v).most_common(1)[0][0]
CH = {'kaya': {'walk': 'walking-8-frames', 'idle': 'breathing-idle'}, 'villager': {'walk': 'walking-8-frames'},
      'shopkeeper': {'idle': 'breathing-idle'}, 'cat': {'walk': 'walk-8-frames', 'sit': 'seated-on-belly-idle'}}
for c, clips in CH.items():
    out['chars'][c] = {}
    rots = [d for d in D8 if (A / 'chars' / c / f'rot_{d}.png').exists()]
    atlas = Image.new('RGBA', (48, 48 * len(rots)))
    for r, d in enumerate(rots):
        im = Image.open(A / 'chars' / c / f'rot_{d}.png'); atlas.alpha_composite(im, ((48 - im.width) // 2, r * 48 + (48 - im.height) // 2))
    out['chars'][c]['rot'] = {'src': uri(atlas), 'frames': 1, 'dirs': rots, 'foot': foot(atlas, 48)}
    for nm, pre in clips.items():
        v = clip(c, pre); dirs = [d for d in D8 if d in v]; n = len(v[dirs[0]])
        atlas = Image.new('RGBA', (48 * n, 48 * len(dirs)))
        for r, d in enumerate(dirs):
            for i, f in enumerate(v[d]): atlas.alpha_composite(Image.open(A / 'chars' / c / f), (i * 48, r * 48))
        atlas.save(A / 'chars' / c / f'{nm}_atlas.png')
        out['chars'][c][nm] = {'src': uri(atlas), 'frames': n, 'dirs': dirs, 'foot': foot(atlas, 48)}
for k, v in json.load(open(A / 'objects' / 'manifest.json')).items():
    out['objects'][k] = {'src': uri(Image.open(A / 'objects' / f'{k}.png')), 'w': v['w'], 'h': v['h']}
js = (H / 'src' / 'game.js').read_text()
html = (H / 'src' / 'index.html').read_text().replace('/*ASSETS*/', 'const ASSETS = ' + json.dumps(out) + ';').replace('/*GAME*/', js)
(H / 'topdown-demo.html').write_text(html)
print('wrote', len(html) // 1024, 'KiB', out['tileKey'])
