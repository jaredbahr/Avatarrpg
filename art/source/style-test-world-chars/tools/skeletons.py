"""Step 4: estimate-skeleton on each 128x128 root (0.1 generations a call). Writes roots/<char>/skeleton/<dir>.json."""
import json, sys, time
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
CHARS = ['kaya', 'sura', 'bo', 'gao']; DIRS = ['south-east', 'south-west', 'north-east', 'north-west']

if __name__ == '__main__':
    before = pl.balance(); t0 = time.time(); outs = []
    for c in CHARS:
        (HERE / f'roots/{c}/skeleton').mkdir(parents=True, exist_ok=True)
        for d in DIRS:
            f = HERE / f'roots/{c}/skeleton/{d}.json'
            if f.exists(): continue
            r = pl.req('POST', '/estimate-skeleton', {'image': pl.b64(Image.open(HERE / f'roots/{c}/{d}.png'))})
            json.dump(r, open(f, 'w'), indent=1); outs.append(str(f.relative_to(HERE)))
    pl.append({'name': 'skeletons-roots', 'endpoint': '/estimate-skeleton', 'job': None, 'status': 'completed', 'settings': {'image': '<png>'},
               'inputs': {'image': 'roots/<char>/<dir>.png (128x128)'}, 'outputs': outs, 'gens': round(0.1 * len(outs), 2),
               'balance_before': before, 'balance_after': pl.balance(), 'secs': round(time.time() - t0),
               'notes': f'{len(outs)} synchronous calls', 'verdict': 'used', 'error': None})
    print(len(outs), 'skeletons')
