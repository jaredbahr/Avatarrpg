"""The board engine v3 (src/b3/): pack terrain, objects, the cast, Kaya's bends, the painted effects and the Driller.
  python3 tools/build_b3.py forest            -> forest-combat.html (v3: the Forest Road only, its own assets)
  python3 tools/build_b3.py tutorial          -> t13/board.html (every tutorial board; embedded by tutorial-demo.html)"""
import base64, io, json, sys, glob, re
from collections import Counter
from pathlib import Path
from PIL import Image, ImageChops
H = Path(__file__).resolve().parent.parent
A = H / 'assets'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CELL, AX, AY = 80, 40, 70
B8 = open(H / 'tools' / 'build8.py').read()
exec(B8[B8.index('def uri('):B8.index('out = {')])          # uri, clean, anchor, clip (build8's helpers, verbatim)
out = {'tiles': {}, 'chars': {}, 'objects': {}, 'cell': CELL, 'ax': AX, 'ay': AY}
exec(B8[B8.index('def mean('):B8.index('TS = 32')])
TS = 32
MODE = sys.argv[1] if len(sys.argv) > 1 else 'forest'
LEVELS = ['forest'] if MODE == 'forest' else ['forest', 'road', 'gate', 'cutting', 'floor']
# ---- terrain: the forest's pure tiles (v2), and the quarry's (tutorial pass)
def pure(folder, key): return Image.open(A / 'tiles' / folder / f'c{key}.png').convert('RGBA')
g0, g1 = pure('fc_road32', '0000'), pure('fc_road32', '1111')
floor, road = (g0, g1) if green(g0) > green(g1) else (g1, g0)
w0, w1 = pure('fc_creek32', '0000'), pure('fc_creek32', '1111')
water = w0 if blue(w0) > blue(w1) else w1
var = [Image.open(p).convert('RGBA').crop((0, 0, TS, TS)) for p in sorted((A / 'tiles' / 'fc_var_floor').glob('tile_*.png'), key=lambda p: int(p.stem.split('_')[1]))]
strip = Image.new('RGBA', (TS * (3 + len(var)), TS))
for i, im in enumerate([floor, road, water] + var): strip.alpha_composite(im, (i * TS, 0))
out['tiles'] = {'src': uri(strip), 'nvar': len(var)}   # 0 floor, 1 road, 2 water, 3.. floor variants
if MODE != 'forest':
    def t(folder, key): return Image.open(next((A / 'tiles' / folder).glob(f'*_{key}.png'))).convert('RGBA')
    def vstack(parts):
        h = sum(p.height for p in parts); s = Image.new('RGBA', (TS, h)); y = 0
        for p in parts: s.alpha_composite(p, (0, y)); y += p.height
        return s
    uutt, ttll = t('q_terrace32', 'UUTT'), t('q_terrace32', 'TTLL')
    face = vstack([uutt.crop((0, 14, TS, 32)), ttll.crop((0, 0, TS, 24))])          # 42 rows: the cut face, ending on the set's own foot line
    ruutt, rttll = t('q_rim32', 'UUTT'), t('q_rim32', 'TTLL')
    rim = vstack([ruutt.crop((0, 14, TS, 32)), rttll.crop((0, 0, TS, 23))])
    FL = 'q_floor32b' if (A / 'tiles' / 'q_floor32b').exists() else 'q_floor32'
    q = {'moss0': var[0], 'moss1': var[3] if len(var) > 3 else var[0], 'floor': t(FL, 'LLLL'), 'road': t(FL, 'UUUU'), 'top': t('q_terrace32', 'UUUU'), 'face': face, 'rim': rim, 'water': water, 'grass': floor}
    qv = [Image.open(p).convert('RGBA').crop((0, 0, TS, TS)) for p in sorted((A / 'tiles' / 'q_var_floor').glob('tile_*.png'), key=lambda p: int(p.stem.split('_')[1]))]
    for i, im in enumerate(qv): q[f'var{i}'] = im
    # polish pass: plain rock variants for the raised shelves (the Wang set's own top repeats a tuft motif)
    RK = A / 'tiles' / 'q_rock_var'
    if RK.exists():
        rk = [Image.open(RK / f).convert('RGBA').crop((0, 0, TS, TS)) for f in ('tile_0.png', 'tile_2.png', 'clean_12.png', 'clean_14.png')]
        for i, im in enumerate(rk): q[f'rock{i}'] = im
    out['qtiles'] = {k: uri(v) for k, v in q.items()}; out['qtiles_nvar'] = len(qv)
# ---- the cast: every clip packed by build8's packer (feet on (AX, AY) of each 80 px cell), eight headings where PixelLab has them
exec(B8[B8.index('TAKES = '):B8.index('CH = {')])
CH = {'kaya': ('kaya2', {'walk': WALK_MIX, 'idle': 'custom-standing at rest', 'jab': 'custom-a martial-arts punch', 'whip': 'custom-a fire-bending whip', 'stomp': 'custom-a martial-arts ground', 'blast': 'custom-a martial-arts double'}),
      'sura': ('fc_sura', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-a water-bending strike', 'ice': 'custom-an ice-bending sweep', 'heal': 'custom-a healing gesture'}),
      'bo': ('fc_bo', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-an earth-bending strike', 'wall': 'custom-an earth-bending wall', 'stance': 'custom-a defensive stance'}),
      'thug': ('fc_thug', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-swings'}),
      'slinger': ('fc_slinger', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-whirls'})}
if MODE != 'forest':
    CH.update({'bruiser': ('fc_bruiser', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-raises'}),
               'deserter': ('t13_deserter', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-a martial-arts punch', 'throw': 'custom-throws a small jar'}),
               'qbender': ('t13_qbender', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-a heavy two-handed throw'}),
               'merc': ('t13_merc', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-a quick low sword'}),
               'xbow': ('t13_xbow', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-raises the crossbow'}),
               'ruon': ('t13_ruon', {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-a disciplined sabre'})})
# a clip that PixelLab has not finished (or never made) is skipped, so the page still builds: the engine falls back to 'attack'
def has_clip(folder, pre):
    m = json.load(open(A / 'chars' / folder / 'meta.json'))
    return any(k.startswith(pre) for k in m['anims']) if not isinstance(pre, dict) else True
for c, (folder, clips) in list(CH.items()):
    CH[c] = (folder, {k: v for k, v in clips.items() if has_clip(folder, v)})
# (character, clip, heading) cells that PixelLab drew wrong and that are replaced: none needed once the eight headings are in
FIX = json.load(open(H / 't13' / 'fix_rows.json')) if (H / 't13' / 'fix_rows.json').exists() else {}
a0 = B8.index('for c, (folder, clips) in CH.items():'); a1 = B8.index("for k, v in json.load(open(A / 'objects8'")
exec(B8[a0:a1])
exec(open(H / 'tools' / 'moves4.py').read())
# Fire Blast (v3): its own pose; the strike is the frame where the east view reaches furthest forward
if 'blast' in out['chars']['kaya']:
    bl = Image.open(A / 'chars' / 'kaya2' / 'blast_atlas.png'); br = out['chars']['kaya']['blast']['dirs'].index('east')
    out['moves']['blast'] = {'strike': max(range(out['chars']['kaya']['blast']['frames']), key=lambda f: (bl.crop((f * CELL, br * CELL, (f + 1) * CELL, (br + 1) * CELL)).getbbox() or (0, 0, 0, 0))[2])}
exec(B8[B8.index('def calm_frames('):B8.index('js = (H')])
for k, row in FIX.items():   # e.g. "bruiser/idle/west": "south-west" -> use that heading's frames for the broken one
    c, nm, d = k.split('/'); v = out['chars'][c][nm]; at = Image.open(A / 'chars' / CH[c][0] / f'{nm}_atlas.png').convert('RGBA')
    src, dst = v['dirs'].index(row), v['dirs'].index(d)
    at.paste(at.crop((0, src * CELL, at.width, (src + 1) * CELL)), (0, dst * CELL)); v['src'] = uri(at)
# ---- objects: the forest set, Ba Dan pieces of the same family, and the quarry set (objects13)
OB = {k: f'fc/obj_{k}.png' for k in ['earth_wall', 'pine_a', 'pine_b', 'pine_c', 'rubble', 'boulder', 'oil_flask', 'hay_bale', 'puddle', 'stump', 'cart_wheel', 'milestone', 'log']}
OB.update({k: f'assets/objects8/{k}.png' for k in ['rain_barrel', 'signpost', 'fence', 'lamp', 'bush', 'tree', 'tree_blossom', 'tuft', 'flowers', 'crates']})
if MODE != 'forest':
    for k in json.load(open(A / 'objects13' / 'manifest.json')):
        if not k.startswith('driller'): OB[k] = f'assets/objects13/{k}.png'
for k, p in OB.items():
    im = Image.open(H / p).convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if 0 < px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
            elif px[x, y][3]: r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255)
    im = im.crop(im.getbbox()); out['objects'][k] = {'src': uri(im), 'w': im.width, 'h': im.height}
from PIL import ImageEnhance
for src, dst in [('tree', 'alder'), ('bush', 'bush_dark')]:
    im = Image.open(H / f'assets/objects8/{src}.png').convert('RGBA'); a = im.split()[3]
    rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(0.62); r, g, b = rgb.split(); rgb = Image.merge('RGB', (r.point(lambda v: int(v * 0.9)), g, b.point(lambda v: min(255, int(v * 1.08)))))
    im = Image.merge('RGBA', (*rgb.split(), a)); im = im.crop(im.getbbox()); out['objects'][dst] = {'src': uri(im), 'w': im.width, 'h': im.height}
# ---- the painted effects (PixelLab /vfx): each one a horizontal strip with its pivot and frame times
out['vfx13'] = {}
for js in sorted((A / 'vfx13').glob('*.json')):
    k = js.stem; mm = json.load(open(js)); sh = Image.open(A / 'vfx13' / f'{k}.png').convert('RGBA')
    fr = [sh.crop((f['frame']['x'], f['frame']['y'], f['frame']['x'] + f['frame']['w'], f['frame']['y'] + f['frame']['h'])) for f in mm['frames']]
    w, h = fr[0].size; s = Image.new('RGBA', (w * len(fr), h))
    for i, f in enumerate(fr): s.alpha_composite(f, (i * w, 0))
    pv = mm['frames'][0].get('pivot') or {'x': 0.5, 'y': 0.5}; ms = [f.get('duration', 83) for f in mm['frames']]
    out['vfx13'][k] = {'src': uri(s), 'w': w, 'h': h, 'n': len(fr), 'px': round(pv['x'] * w), 'py': round(pv['y'] * h), 'ms': ms, 'total': sum(ms)}
# ---- the Driller: its eight PixelLab views (objects13/driller_<dir>), the rumbling idle and the slam (object animations, v3)
if MODE != 'forest':
    dr = {'rot': {}}
    for d in D8:
        im = Image.open(A / 'objects13' / f"driller_{d.replace('-', '')}.png").convert('RGBA'); dr['rot'][d] = {'src': uri(im), 'w': im.width, 'h': im.height, 'n': 1}
    DROP = {}   # v1's slam dropped frame 4 (a white smear); the fixes pass's slam (slam2/slam3) is whole
    # fixes pass: the slam is wound up (the drill arm hauled high, held, then dropped) in all eight headings. Per heading: the clip's
    # file prefix, the frame the blow lands on (hit) and the held top frames (hold); frame times are derived below.
    SLAM = {'south': ('the_whole_mecha-driller_winds', 8, (6, 7)), 'south-east': ('the_whole_mecha-driller_winds', 9, (7, 8)),
            'east': ('the_whole_mecha-driller_winds', 10, (6, 7)), 'north-east': ('the_whole_mecha-driller_winds', 8, (6, 7)),
            'north': ('the_whole_mecha-driller_winds', 8, (6, 7)), 'north-west': ('the_whole_mecha-driller_winds', 7, (5, 6)),
            'west': ('the_whole_mecha-driller_winds', 8, (6, 7)), 'south-west': ('the_mecha-driller_rears', 10, (8, 9))}
    def slam_ms(n, hit, hold):
        return [90 if i < 3 else 230 if i in hold else 110 if i < hold[0] else 170 if i == hit else 70 if i < hit else 90 for i in range(n)]
    for clip, pre in [('idle', 'the_engine'), ('slam', None)]:
        dr[clip] = {}
        for d in D8:
            pr = pre or SLAM[d][0]
            fs = sorted(glob.glob(str(A / 'driller' / f'animations__{pr}*__{d}__frame_*.png')))
            if not fs: continue
            ims = [Image.open(f).convert('RGBA') for i, f in enumerate(fs) if i not in DROP.get(clip, ())]
            for im in ims:
                p = im.load()
                for y in range(im.height):
                    for x in range(im.width):
                        if 0 < p[x, y][3] < 128: p[x, y] = (0, 0, 0, 0)
                        elif p[x, y][3]: p[x, y] = p[x, y][:3] + (255,)
            bb = [im.getbbox() for im in ims]; x0 = min(b[0] for b in bb); x1 = max(b[2] for b in bb); y0 = min(b[1] for b in bb); y1 = max(b[3] for b in bb)
            # the machine's own base row (frame 0) is the anchor: crop every frame to the union box, bottom = frame 0's lowest pixel
            base = bb[0][3]; y1 = max(y1, base)
            w, h = x1 - x0, base - y0; s = Image.new('RGBA', (w * len(ims), h))
            for i, im in enumerate(ims): s.alpha_composite(im.crop((x0, y0, x1, base)), (i * w, 0))
            dr[clip][d] = {'src': uri(s), 'w': w, 'h': h, 'n': len(ims)}
            if clip == 'slam': dr[clip][d].update({'ms': slam_ms(len(ims), SLAM[d][1], SLAM[d][2]), 'hit': SLAM[d][1]})
    out['driller'] = dr
js = '\n'.join(open(H / 'src' / 'b3' / f).read() for f in ['levels.js', 'head.js']) + '\n' + open(H / 'src' / 'v8' / 'shadow.js').read() + '\n' + \
     '\n'.join(open(H / 'src' / 'b3' / f).read() for f in ['world_forest.js', 'world_quarry.js', 'units.js', 'rules.js', 'surfvis.js', 'fx.js', 'combat.js', 'auto.js', 'draw.js'])
html = open(H / 'src' / 'b3' / 'index.html').read().replace('/*ASSETS*/', 'const ASSETS = ' + json.dumps(out) + ';').replace('/*GAME*/', js)
dst = H / ('forest-combat.html' if MODE == 'forest' else 't13/board.html')
dst.write_text(html); print('wrote', dst.name, len(html) // 1024, 'KiB', {c: list(v) for c, v in out['chars'].items()})
