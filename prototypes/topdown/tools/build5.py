"""v5: pack assets (Kaya = candidate $CAND, default C; v2 walk engine). v4: pack assets: v2's cast and world, Kaya's new walk (north kept from v2), three bending moves and their VFX into atlases (80 px cells, each direction re-anchored on its measured foot line and centre),
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
for name, src, kind in [('gc', 'gc32', 'GC'), ('canal', 'canal32', 'WC'), ('dirt', 'dirt32', 'DG')]:
    t = {k: Image.open(A / 'tiles' / src / f'c{k}.png').convert('RGBA') for k in [format(i, '04b') for i in range(16)]}
    atlas = Image.new('RGBA', (TS * 4, TS * 4))
    for k, im in t.items():
        i = int(k, 2); atlas.alpha_composite(im, ((i % 4) * TS, (i // 4) * TS))
    one, zero = t['1111'], t['0000']
    if kind == 'GC': m = {'1': 'C', '0': 'G'} if green(zero) > green(one) else {'1': 'G', '0': 'C'}
    if kind == 'WC': m = {'1': 'C', '0': 'W'} if blue(zero) > blue(one) else {'1': 'W', '0': 'C'}
    if kind == 'DG': m = {'1': 'G', '0': 'D'} if green(one) > green(zero) else {'1': 'D', '0': 'G'}
    out['tiles'][name] = uri(atlas); out['tileKey'][name] = m
# base-tile variants (tiles-pro edits of the base, so their edges still match): a strip per terrain
for terr, d in [('G', 'var_grass'), ('C', 'var_cobble')]:
    ims = [Image.open(p).convert('RGBA').crop((0, 0, TS, TS)) for p in sorted((A / 'tiles' / d).glob('tile_*.png'), key=lambda p: int(p.stem.split('_')[1]))]
    strip = Image.new('RGBA', (TS * len(ims), TS))
    for i, im in enumerate(ims): strip.alpha_composite(im, (i * TS, 0))
    out['variants'][terr] = {'src': uri(strip), 'n': len(ims)}
CAND = os.environ.get('CAND', 'C'); KF = f'kaya5{CAND}'
# the v4 walk: the 'feminine' skeleton-v3 motion in seven headings; north keeps v2's frames (the new north barely moved)
WALK_MIX = {'default': 'custom-feminine', 'north': 'custom-a relaxed'}
def clip(char, prefix):
    m = json.load(open(A / 'chars' / char / 'meta.json'))
    if isinstance(prefix, str) and char == KF and not any(k.startswith(prefix) for k in m['anims']):
        if prefix.startswith('custom-standing'):   # a comparison build without this clip: stand on the rotation
            return {d: [f'rot_{d}.png'] for d in D8 if (A / 'chars' / char / f'rot_{d}.png').exists()}
        m2 = json.load(open(A / 'chars' / 'kaya2' / 'meta.json'))   # moves: borrow v4's so the build runs
        v = next(v for k, v in m2['anims'].items() if k.startswith(prefix))
        return {d: [f'../kaya2/{f}' for f in fs] for d, fs in v.items()}
    if isinstance(prefix, dict):
        pick = lambda p: next(v for k, v in m['anims'].items() if k.startswith(p))
        base = pick(prefix['default'])
        return {d: (pick(prefix[d])[d] if d in prefix else f) for d, f in base.items()}
    for k, v in m['anims'].items():
        if k.startswith(prefix): return v
    raise KeyError(prefix)
CH = {
 'kaya': (KF, {'walk': 'custom-a relaxed', 'idle': 'custom-standing at rest', 'look': 'custom-standing still', 'jab': 'custom-a martial-arts', 'whip': ('custom-a fire-bending whip: from a lo@7a18b3' if CAND == 'C' else 'custom-a fire-bending whip'), 'stomp': 'custom-a fire-bending ground'}),
 'villager': ('vill2', {'walk': 'custom-a relaxed', 'idle': 'custom-standing at rest'}),
 'shopkeeper': ('shop2', {'idle': 'custom-an elderly'}),
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
for k, v in json.load(open(A / 'objects3' / 'manifest.json')).items():
    out['objects'][k] = {'src': uri(Image.open(A / 'objects3' / f'{k}.png')), 'w': v['w'], 'h': v['h']}
exec(open(H / 'tools' / 'moves5.py').read())
js = (H / 'src' / 'game5.js').read_text()
html = (H / 'src' / 'index4.html').read_text().replace('/*ASSETS*/', 'const ASSETS = ' + json.dumps(out) + ';').replace('/*GAME*/', js)
OUT = H / 'topdown-demo.html' if CAND == 'C' and not os.environ.get('OUT') else H / os.environ.get('OUT', f'work/v5/demo_{CAND}.html')
OUT.write_text(html)
print('wrote', OUT, len(html) // 1024, 'KiB', out['tileKey']); print('cleaned px', dict(CLEANED))
