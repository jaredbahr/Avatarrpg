"""SQ-01's raw takes (`sq01gen.py`) -> assets/objects_sq01/<name>.png and manifest.json, cleaned by `bd20proc.py`'s rules:
hard 1-bit alpha, the largest piece kept, PixelLab's grey ground plate peeled off, the near-black outline recoloured to a
darker tone of the material, cropped to the bounding box.
Usage (from prototypes/topdown): python3 tools/sq01proc.py sled:11 cart:3"""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from bd20proc import clean, outline
from PIL import Image
from pathlib import Path
H = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get('SQ01_RAW', H / 'sq01' / 'raw'))
OUT = H / 'assets' / 'objects_sq01'; OUT.mkdir(exist_ok=True)
NAME = {'sled': 'sq01_sled', 'cart': 'parcel_cart_tidy'}

if __name__ == '__main__':
    mf = OUT / 'manifest.json'; man = json.load(open(mf)) if mf.exists() else {}
    L = {j['name']: j for j in pl.ledger()['jobs']}
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); sd = int(sd or 3); job = f'sq01_{k}_{sd}'
        im, plate, drop = clean(Image.open(RAW / f'{k}_{sd}.png').convert('RGBA'), k == 'sled')
        im, n = outline(im); im.save(OUT / f'{NAME[k]}.png')
        man[NAME[k]] = {'w': im.width, 'h': im.height, 'seed': sd, 'ledger_job': job, 'job_id': L.get(job, {}).get('job'),
                        'credits': sum(j['credits'] for n_, j in L.items() if n_.startswith(f'sq01_{k}_')),
                        'takes': sum(1 for n_ in L if n_.startswith(f'sq01_{k}_')),
                        'prompt': (L.get(job, {}).get('settings', {}).get('description') or '')[:230]}
        print(f'{NAME[k]:18s} {im.width:3d}x{im.height:<3d} plate {plate} dropped {drop} outline {n}')
    json.dump(man, open(mf, 'w'), indent=1)
