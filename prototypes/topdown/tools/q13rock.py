"""Polish pass (quarry): natural rock for the raised shelves. The Wang set's own top tile repeats a tuft motif; this asks create-tiles-pro for plain
varied stone with the tufts and the cracks scrubbed from the style image."""
import sys, json, os; sys.path.insert(0, 'tools'); import pl
from PIL import Image
import numpy as np
im = np.array(Image.open('assets/tiles/q_terrace32/06_UUUU.png').convert('RGB')).astype(int)
# scrub: orange tufts (r much greater than b) and near-black cracks -> median of the grey neighbours
r, g, b = im[..., 0], im[..., 1], im[..., 2]
bad = ((r - b) > 28) | (im.sum(-1) < 190)
clean = im.copy(); H, W = bad.shape
for y in range(H):
    for x in range(W):
        if bad[y, x]:
            vals = [im[(y + dy) % H, (x + dx) % W] for dy in range(-3, 4) for dx in range(-3, 4) if not bad[(y + dy) % H, (x + dx) % W]]
            clean[y, x] = np.median(vals, axis=0)
os.makedirs('assets/tiles/q_rock_var', exist_ok=True)
Image.fromarray(clean.astype('uint8')).save('assets/tiles/q_rock_var/style_clean.png')
si = dict(pl.b64('assets/tiles/q_rock_var/style_clean.png'), width=32, height=32)
desc = ('1). plain weathered grey limestone rock surface, rough natural stone, mottled tone, a few small pale chips, no plants, no tufts, no repeating motif '
        '2). plain weathered grey limestone rock, uneven natural stone grain with a couple of small stones, no plants, no grass, no pattern '
        '3). plain grey rough rock with soft darker and lighter patches and a single faint hairline crack, no plants, no tufts '
        '4). plain grey limestone rock with scattered pale grit and one small stone, no plants, no orange, no pattern')
e, r = pl.run('/create-tiles-pro', {'description': desc, 'tile_type': 'square_topdown', 'tile_size': 32, 'tile_view': 'top-down', 'style_images': [si], 'seed': 11}, 'q13_rock_var', estimate=12)
tid = r['final']['last_response']['tile_id']; d = pl.req('GET', f'/tiles-pro/{tid}')
for k, u in sorted(d['storage_urls'].items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'assets/tiles/q_rock_var/{k}.png')
print('done', e.get('credits'))
