"""Route A: one expression on a shipped portrait by inpaint-v3, face mask only.
gen_expr.py CHAR MOOD SEED   (CHAR keys tools/cast.json; MOOD keys its moods)
Everything outside the white mask keeps its shipped pixels; the job lands in ../raw/a-CHAR-MOOD-sSEED/."""
import json, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent)); import pl

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent.parent
cast = json.load(open(HERE / 'tools' / 'cast.json'))
char, mood, seed = sys.argv[1], sys.argv[2], int(sys.argv[3])
c = cast[char]
full = Image.open(ROOT / 'public/art/portraits' / c['file']).convert('RGB')
fmask = Image.open(HERE / 'masks' / f"{char}-{c['moods'][mood]['mask']}.png").convert('RGB')
# A 512 inpaint costs 25 generations; the face crop (c['crop'], x0,y0,size) is billed by its area.
m = c['moods'][mood]; x0, y0, n = m['crop']
src = full.crop((x0, y0, x0 + n, y0 + n)); mask = fmask.crop((x0, y0, x0 + n, y0 + n))
desc = f"{c['moods'][mood]['text']}. Same person, {c['who']}. {cast['_style']}"
payload = {'description': desc,
           'inpainting_image': {'image': pl.b64(src), 'size': {'width': n, 'height': n}},
           'mask_image': {'image': pl.b64(mask), 'size': {'width': n, 'height': n}},
           'seed': seed, 'no_background': False, 'crop_to_mask': True}
pl.run('/inpaint-v3', payload, f'a-{char}-{mood}-c{n}-s{seed}',
       inputs={'image': c['file'], 'crop': m['crop'], 'mask': f"masks/{char}-{c['moods'][mood]['mask']}.png"})
