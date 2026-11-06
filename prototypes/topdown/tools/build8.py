"""v8: Ba Dan as a grounded diorama (cliff edge, one shadow rule, plinths, the anchor-batched prop family). v7: Ba Dan top-down. Kaya is v2 exactly (walk, idle, look-around) plus the v4 bends; the residents are v7 characters; objects are the v2 family plus new v7 props.
inline as base64, write topdown-demo.html from src/index.html + src/game2.js."""
import base64, io, json, os
from collections import Counter
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
A = H / 'assets'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CELL, AX, AY = 80, 40, 70          # every frame is placed so its feet land on (AX, AY) of its cell
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def clean(im):
    """Drop small detached grey blobs (the idle prompt made the model draw breath vapour). Returns (image, removed px)."""
    a = im.split()[3]; W, H = im.size; px = im.load(); seen = set(); comps = []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or a.getpixel((x, y)) < 128: continue
            st = [(x, y)]; seen.add((x, y)); comp = []
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and a.getpixel((nx, ny)) >= 128: seen.add((nx, ny)); st.append((nx, ny))
            comps.append(comp)
    if len(comps) < 2: return im, 0
    comps.sort(key=len, reverse=True); removed = 0
    for comp in comps[1:]:
        if len(comp) > 24: continue
        sat = sum(max(px[x, y][:3]) - min(px[x, y][:3]) for x, y in comp) / len(comp)
        if sat < 40:
            for x, y in comp: px[x, y] = (0, 0, 0, 0)
            removed += len(comp)
    return im, removed
CLEANED = Counter()
def anchor(frames):
    bbs = [f.getbbox() for f in frames if f.getbbox()]
    foot = Counter(b[3] for b in bbs).most_common(1)[0][0]
    # centre from the lowest rows (the feet and hem), which move least
    xs = []
    for f in frames:
        a = f.split()[3]; b = f.getbbox()
        row = [x for y in range(max(0, foot - 6), foot) for x in range(f.width) if a.getpixel((x, y)) > 128]
        if row: xs.append((min(row) + max(row)) / 2)
    return foot, round(sum(xs) / len(xs))
out = {'tiles': {}, 'tileKey': {}, 'variants': {}, 'chars': {}, 'objects': {}, 'cell': CELL, 'ax': AX, 'ay': AY}
def mean(im): return im.convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
def green(im): r, g, b = mean(im); return g - (r + b) / 2
def blue(im): r, g, b = mean(im); return b - r
TS = 32
for name, src, kind in [('gc', 'gc32', 'GC'), ('canal', 'canal32', 'WC'), ('dirt', 'dirt32', 'DG'), ('flag', 'flag32', 'FC')]:
    t = {k: Image.open(A / 'tiles' / src / f'c{k}.png').convert('RGBA') for k in [format(i, '04b') for i in range(16)]}
    atlas = Image.new('RGBA', (TS * 4, TS * 4))
    for k, im in t.items():
        i = int(k, 2); atlas.alpha_composite(im, ((i % 4) * TS, (i // 4) * TS))
    one, zero = t['1111'], t['0000']
    if kind == 'GC': m = {'1': 'C', '0': 'G'} if green(zero) > green(one) else {'1': 'G', '0': 'C'}
    if kind == 'WC': m = {'1': 'C', '0': 'W'} if blue(zero) > blue(one) else {'1': 'W', '0': 'C'}
    if kind == 'DG': m = {'1': 'G', '0': 'D'} if green(one) > green(zero) else {'1': 'D', '0': 'G'}
    if kind == 'FC':   # flagstone vs cobble: the flags are the flatter, less busy tile
        def busy(im):
            p = im.convert('L').load(); return sum(abs(p[x, y] - p[x + 1, y]) for y in range(TS) for x in range(TS - 1))
        m = {'1': 'C', '0': 'F'} if busy(one) > busy(zero) else {'1': 'F', '0': 'C'}
    out['tiles'][name] = uri(atlas); out['tileKey'][name] = m
# base-tile variants (tiles-pro edits of the base, so their edges still match): a strip per terrain
for terr, d in [('G', 'var_grass'), ('C', 'var_cobble'), ('C2', 'var_cobble2'), ('F', 'var_flag')]:
    ims = [Image.open(p).convert('RGBA').crop((0, 0, TS, TS)) for p in sorted((A / 'tiles' / d).glob('tile_*.png'), key=lambda p: int(p.stem.split('_')[1]))]
    strip = Image.new('RGBA', (TS * len(ims), TS))
    for i, im in enumerate(ims): strip.alpha_composite(im, (i * TS, 0))
    out['variants'][terr] = {'src': uri(strip), 'n': len(ims)}
# the v4 walk: the 'feminine' skeleton-v3 motion in seven headings; north keeps v2's frames (the new north barely moved)
TAKES = {'v2': 'custom-a relaxed', 'a': 'custom-a casual, easy', 'b': 'custom-a light, confident', 'c': 'walking-8-frames@ce69c2', 'd': 'custom-a casual, relaxed'}
TAKE = 'v2'; WALK_MIX = 'custom-a relaxed natural walking cycl@e7f0ee'   # v2's walk, pinned to its group
def clip(char, prefix):
    m = json.load(open(A / 'chars' / char / 'meta.json'))
    if isinstance(prefix, dict):
        pick = lambda p: next(v for k, v in m['anims'].items() if k.startswith(p))
        base = pick(prefix['default'])
        return {d: (pick(prefix[d])[d] if d in prefix else f) for d, f in base.items()}
    for k, v in m['anims'].items():
        if k.startswith(prefix): return v
    raise KeyError(prefix)
CH = {
 'kaya': ('kaya2', {'walk': WALK_MIX, 'idle': 'custom-standing at rest', 'look': 'custom-standing still', 'jab': 'custom-a martial-arts', 'whip': 'custom-a fire-bending whip', 'stomp': 'custom-a fire-bending ground'}),
 'mira': ('v7_mira', {'idle': 'custom-an elderly'}),
 'gao': ('v7_gao', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames'}),
 'pella': ('v7_pella', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames'}),
 'dorin': ('v7_dorin', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames'}),
 'hanru': ('v7_hanru', {'idle': 'custom-standing at rest'}),
 'household': ('v7_household', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames'}),
 'cat': ('cat2', {'walk': 'walk-8-frames', 'sit': 'seated-on-belly-idle'}),
}
for c, (folder, clips) in CH.items():
    out['chars'][c] = {}
    for nm, pre in list(clips.items()) + [('rot', None)]:
        if pre: v = clip(folder, pre)
        else: v = {d: [f'rot_{d}.png'] for d in D8 if (A / 'chars' / folder / f'rot_{d}.png').exists()}
        if nm == 'jab': v = {d: f[:11] for d, f in v.items()}
        dirs = [d for d in D8 if d in v]; n = max(len(v[d]) for d in dirs)
        atlas = Image.new('RGBA', (CELL * n, CELL * len(dirs)))
        for r, d in enumerate(dirs):
            fr = []
            for f in v[d]:
                im, rm = clean(Image.open(A / 'chars' / folder / f).convert('RGBA')); fr.append(im)
                if rm: CLEANED[f'{c}/{nm}/{d}'] += rm
            foot, cx = anchor(fr)
            for i, im in enumerate(fr): atlas.alpha_composite(im, (i * CELL + AX - cx, r * CELL + AY - foot))
        atlas.save(A / 'chars' / folder / f'{nm}_atlas.png')
        out['chars'][c][nm] = {'src': uri(atlas), 'frames': n, 'dirs': dirs}
for k, v in json.load(open(A / 'objects8' / 'manifest.json')).items():
    out['objects'][k] = {'src': uri(Image.open(A / 'objects8' / f'{k}.png')), 'w': v['w'], 'h': v['h']}
exec(open(H / 'tools' / 'moves4.py').read())
# the cliff edge: PixelLab's grass-to-void cliff set (25 tiles) with each tile's 4x4 pattern, and the void colour
cmeta = json.load(open(H / 'v8' / 'cliff_meta.json'))['tileset']['tiles']
cfiles = sorted((A / 'tiles' / 'cliff32').glob('*.png'))
catl = Image.new('RGBA', (TS * len(cfiles), TS))
for i, f in enumerate(cfiles): catl.alpha_composite(Image.open(f).convert('RGBA'), (i * TS, 0))
vr, vg, vb = Image.open(cfiles[0]).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
out['cliff'] = {'src': uri(catl), 'void': f'rgb({vr},{vg},{vb})', 'tiles': [{'pat': [v for r in range(4) for v in t['pattern_4x4'][f'row_{r}']]} for t in cmeta]}
# a slow, barely-there idle: per direction, only the frames whose head stays within 1 px of the rest pose
def calm_frames(folder, clipv):
    calm = {}
    for d, fs in clipv.items():
        ims = [Image.open(A / 'chars' / folder / f).convert('RGBA') for f in fs]
        t0 = ims[0].getbbox()[1]
        keep = [i for i, im in enumerate(ims) if abs(im.getbbox()[1] - t0) <= 1 and sum(1 for p in ImageChops.difference(ims[0], im).getdata() if sum(p[:3]) > 60 or p[3] > 100) <= 140]
        calm[d] = keep if len(keep) >= 2 else [0, 1]
    return calm
from PIL import ImageChops
for c, (folder, clips) in CH.items():
    if 'idle' in clips and 'idle' in out['chars'][c]:
        v = clip(folder, clips['idle'])
        # rows in the atlas follow D8 order of available dirs, frames keep their index
        out['chars'][c]['idle']['calm'] = calm_frames(folder, v)
js = (H / 'src' / 'game8.js').read_text()
html = (H / 'src' / 'index7.html').read_text().replace('<title>Ba Dan Village</title>', '<title>Ba Dan Village</title>').replace('/*ASSETS*/', 'const ASSETS = ' + json.dumps(out) + ';').replace('/*GAME*/', js)
OUT = H / 'badan-topdown.html'
OUT.write_text(html)
print('wrote', OUT, len(html) // 1024, 'KiB', out['tileKey']); print('cleaned px', dict(CLEANED))
