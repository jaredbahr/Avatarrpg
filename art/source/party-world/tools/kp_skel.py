"""Kaya polish: estimate-skeleton (0.1 a call) on each image named, writing <image stem>.skel.json beside it, ledgered as one
batch entry. Images already estimated are skipped.

usage (repo root): python3 -I art/source/party-world/tools/kp_skel.py NAME path.png [path.png ...]  (paths relative to party-world/)"""
import json, sys, time
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent

if __name__ == '__main__':
    name = sys.argv[1]; before = pl.balance(); t0 = time.time(); outs = []
    for rel in sys.argv[2:]:
        p = HERE / rel; f = p.with_suffix('.skel.json')
        if f.exists(): continue
        r = pl.req('POST', '/estimate-skeleton', {'image': pl.b64(Image.open(p))})
        json.dump(r, open(f, 'w'), indent=1); outs.append(str(f.relative_to(HERE)))
    if outs:
        after = pl.balance()
        pl.append({'name': name, 'endpoint': '/estimate-skeleton', 'job': None, 'status': 'completed', 'settings': {'image': '<png>'},
                   'inputs': {'image': ', '.join(sys.argv[2:])}, 'outputs': outs, 'gens': round(before - after, 2),
                   'balance_before': before, 'balance_after': after, 'secs': round(time.time() - t0),
                   'notes': f'Kaya polish: {len(outs)} synchronous calls', 'verdict': 'used', 'error': None})
    print(len(outs), 'skeletons')
