"""Forest Road ambush, combat look test: pack terrain, objects, the cast and Kaya's bends into forest-combat.html."""
import base64, io, json
from collections import Counter
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
A = H / 'assets'
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CELL, AX, AY = 80, 40, 70
B8 = open(H / 'tools' / 'build8.py').read()
# reuse build8's helpers verbatim (uri, clean, anchor, clip, the atlas packer), not its Ba Dan assets
exec(B8[B8.index('def uri('):B8.index('out = {')])
out = {'tiles': {}, 'chars': {}, 'objects': {}, 'cell': CELL, 'ax': AX, 'ay': AY}
exec(B8[B8.index('def mean('):B8.index('TS = 32')])
TS = 32
def pure(folder, key): return Image.open(A / 'tiles' / folder / f'c{key}.png').convert('RGBA')
g0, g1 = pure('fc_road32', '0000'), pure('fc_road32', '1111')
floor, road = (g0, g1) if green(g0) > green(g1) else (g1, g0)
w0, w1 = pure('fc_creek32', '0000'), pure('fc_creek32', '1111')
water = w0 if blue(w0) > blue(w1) else w1
var = [Image.open(p).convert('RGBA').crop((0, 0, TS, TS)) for p in sorted((A / 'tiles' / 'fc_var_floor').glob('tile_*.png'), key=lambda p: int(p.stem.split('_')[1]))]
strip = Image.new('RGBA', (TS * (3 + len(var)), TS))
for i, im in enumerate([floor, road, water] + var): strip.alpha_composite(im, (i * TS, 0))
out['tiles'] = {'src': uri(strip), 'nvar': len(var)}   # 0 floor, 1 road, 2 water, 3.. floor variants
exec(B8[B8.index('TAKES = '):B8.index('CH = {')])
CH = {
 'kaya': ('kaya2', {'walk': WALK_MIX, 'idle': 'custom-standing at rest', 'jab': 'custom-a martial-arts', 'whip': 'custom-a fire-bending whip', 'stomp': 'custom-a fire-bending ground'}),
}
for k in ['thug', 'slinger', 'bruiser', 'sura', 'bo']:
    CH[k] = ('fc_' + k, {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-' + {'thug': 'swings', 'slinger': 'whirls', 'bruiser': 'raises', 'sura': 'a water', 'bo': 'an earth'}[k]})
a0 = B8.index('for c, (folder, clips) in CH.items():'); a1 = B8.index("for k, v in json.load(open(A / 'objects8'")
exec(B8[a0:a1])
exec(open(H / 'tools' / 'moves4.py').read())
# the new cast's west rows are their east rows mirrored: PixelLab drew the bruiser's west idle with a second head
from PIL import ImageOps
for k in ['thug', 'slinger', 'bruiser', 'sura', 'bo']:
    for nm, v in out['chars'][k].items():
        if 'west' not in v['dirs'] or 'east' not in v['dirs']: continue
        at = Image.open(A / 'chars' / f'fc_{k}' / f'{nm}_atlas.png').convert('RGBA'); e, w = v['dirs'].index('east'), v['dirs'].index('west')
        for f in range(v['frames']):
            cell = at.crop((f * CELL, e * CELL, (f + 1) * CELL, (e + 1) * CELL)); m = ImageOps.mirror(cell)
            at.paste(Image.new('RGBA', (CELL, CELL)), (f * CELL, w * CELL)); at.alpha_composite(m, (f * CELL + 1, w * CELL)) if False else at.paste(m, (f * CELL, w * CELL))
        v['src'] = uri(at)
        if 'calm' in v and 'east' in v['calm']: v['calm']['west'] = v['calm']['east']
exec(B8[B8.index('def calm_frames('):B8.index('js = (H')])
for k in ['thug', 'slinger', 'bruiser', 'sura', 'bo']:
    cl = out['chars'][k].get('idle', {}).get('calm')
    if cl and 'east' in cl: cl['west'] = cl['east']
# objects: the forest set plus Ba Dan pieces of the same family
OB = {k: f'fc/obj_{k}.png' for k in ['earth_wall', 'pine_a', 'pine_b', 'pine_c', 'rubble', 'boulder', 'oil_flask', 'hay_bale', 'puddle', 'stump', 'cart_wheel', 'milestone', 'log']}
OB.update({k: f'assets/objects8/{k}.png' for k in ['rain_barrel', 'signpost', 'fence', 'lamp', 'bush', 'tree', 'tree_blossom', 'tuft', 'flowers']})
for k, p in OB.items():
    im = Image.open(H / p).convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if 0 < px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
            elif px[x, y][3]: r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 255)
    im = im.crop(im.getbbox()); out['objects'][k] = {'src': uri(im), 'w': im.width, 'h': im.height}
# the creek's alders and bushes, darkened and cooled to sit in the pine forest (Ba Dan's own sprites, recoloured)
from PIL import ImageEnhance
for src, dst in [('tree', 'alder'), ('bush', 'bush_dark')]:
    im = Image.open(H / f'assets/objects8/{src}.png').convert('RGBA'); a = im.split()[3]
    rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(0.62); r, g, b = rgb.split(); rgb = Image.merge('RGB', (r.point(lambda v: int(v * 0.9)), g, b.point(lambda v: min(255, int(v * 1.08)))))
    im = Image.merge('RGBA', (*rgb.split(), a)); im = im.crop(im.getbbox()); out['objects'][dst] = {'src': uri(im), 'w': im.width, 'h': im.height}
js = '\n'.join(open(H / 'src' / 'fc' / f).read() for f in ['head.js']) + '\n' + open(H / 'src' / 'v8' / 'shadow.js').read() + '\n' + '\n'.join(open(H / 'src' / 'fc' / f).read() for f in ['world.js', 'units.js', 'rules.js', 'surfvis.js', 'fx.js', 'combat.js', 'auto.js', 'draw.js'])
html = open(H / 'src' / 'fc' / 'index.html').read().replace('/*ASSETS*/', 'const ASSETS = ' + json.dumps(out) + ';').replace('/*GAME*/', js)
(H / 'forest-combat.html').write_text(html); print('wrote forest-combat.html', len(html) // 1024, 'KiB')
