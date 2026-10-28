"""Step 4: estimate-skeleton on each 128x128 idle root (0.1 generations a call), the first frame every walk is drawn from.
Writes roots/<char>/idle/skeleton/<dir>.json and ledgers the batch as one entry.

usage (repo root): python3 -I art/source/party-world/tools/skeletons.py [char ...]"""
import json, sys, time
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']

if __name__ == '__main__':
    chars = sys.argv[1:] or ['kaya', 'sura', 'bo']
    before = pl.balance(); t0 = time.time(); outs = []
    for c in chars:
        (HERE / f'roots/{c}/idle/skeleton').mkdir(parents=True, exist_ok=True)
        for d in DIRS:
            f = HERE / f'roots/{c}/idle/skeleton/{d}.json'
            if f.exists(): continue
            r = pl.req('POST', '/estimate-skeleton', {'image': pl.b64(Image.open(HERE / f'roots/{c}/idle/{d}.png'))})
            json.dump(r, open(f, 'w'), indent=1); outs.append(str(f.relative_to(HERE)))
    if outs:
        pl.append({'name': f'skeletons-idle-{"-".join(chars)}', 'endpoint': '/estimate-skeleton', 'job': None, 'status': 'completed',
                   'settings': {'image': '<png>'}, 'inputs': {'image': 'roots/<char>/idle/<dir>.png (128x128)'}, 'outputs': outs,
                   'gens': round(before - pl.balance(), 2), 'balance_before': before, 'balance_after': pl.balance(),
                   'secs': round(time.time() - t0), 'notes': f'{len(outs)} synchronous calls', 'verdict': 'used', 'error': None})
    print(len(outs), 'skeletons, balance', pl.balance())
