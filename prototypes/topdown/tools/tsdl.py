"""Save a Wang tileset's 16 tiles as assets/tiles/<label>/c<NW><NE><SW><SE>.png (1 = upper) and a preview."""
import base64, io, json, sys, random
sys.path.insert(0, 'tools'); import pl
from PIL import Image
def save(label, tsid):
    d = pl.req('GET', f'/tilesets/{tsid}')
    out = pl.HERE / 'assets' / 'tiles' / label; out.mkdir(parents=True, exist_ok=True)
    tiles = {}
    for t in d['tileset']['tiles']:
        c = t['corners']; key = ''.join('1' if c[k] == 'upper' else ('2' if c[k] == 'transition' else '0') for k in ('NW', 'NE', 'SW', 'SE'))
        im = Image.open(io.BytesIO(base64.b64decode(t['image']['base64']))).convert('RGBA')
        im.save(out / f'c{key}.png'); tiles[key] = im
    return tiles
def preview(tiles, path, w=14, h=10, seed=1):
    rnd = random.Random(seed)
    V = [[0]*(w+1) for _ in range(h+1)]
    for y in range(h+1):
        for x in range(w+1):
            V[y][x] = 1 if (3 <= x <= 10 and 2 <= y <= 7) or (x in (6,7)) else 0
    ts = next(iter(tiles.values())).width
    im = Image.new('RGBA', (w*ts, h*ts))
    for y in range(h):
        for x in range(w):
            k = f'{V[y][x]}{V[y][x+1]}{V[y+1][x]}{V[y+1][x+1]}'
            if k in tiles: im.alpha_composite(tiles[k], (x*ts, y*ts))
    im.resize((im.width*4, im.height*4), Image.NEAREST).save(path)
if __name__ == '__main__':
    tiles = save(sys.argv[1], sys.argv[2]); print(sorted(tiles))
    preview(tiles, f'work/{sys.argv[1]}_preview.png')
