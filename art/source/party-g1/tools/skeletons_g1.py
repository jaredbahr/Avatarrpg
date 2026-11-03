"""Rollout step 3: estimate-skeleton on every curated root, padded onto each canvas it is animated on (motion.py CANVAS).

usage (repo root): python3 -I art/source/party-g1/tools/skeletons_g1.py char:root:canvas [...]   e.g. kaya:idle:96 kaya:stance:128
Writes roots/<char>/<root>/skeleton-<canvas>/<dir>.json; one ledger line per char:root:canvas (0.1 generations a call)."""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
from motion import CANVAS, DIRS
from PIL import Image
HERE = Path(__file__).resolve().parent.parent


def one(arg):
    char, root, W = arg.split(':'); W = int(W); x, y = CANVAS[W]
    out = HERE / f'roots/{char}/{root}/skeleton-{W}'; out.mkdir(parents=True, exist_ok=True)
    before = pl.balance(); t0 = time.time(); usage = []
    for d in DIRS:
        im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); im.alpha_composite(Image.open(HERE / f'roots/{char}/{root}/{d}.png').convert('RGBA'), (x, y))
        r = pl.req('POST', '/estimate-skeleton', {'image': pl.b64(im)})
        json.dump(r, open(out / f'{d}.json', 'w'), indent=1); usage.append((r.get('usage') or {}).get('generations') or 0.1)
    pl.append({'name': f'skeleton-{char}-{root}-{W}', 'endpoint': '/estimate-skeleton', 'job': None, 'status': 'completed', 'settings': {'image': '<png>'},
               'inputs': {'image': f'roots/{char}/{root}/<dir>.png padded to {W}x{W} at {CANVAS[W]}'}, 'outputs': [f'roots/{char}/{root}/skeleton-{W}/{d}.json' for d in DIRS],
               'gens': round(sum(usage), 2), 'balance_before': before, 'balance_after': pl.balance(), 'secs': round(time.time() - t0),
               'notes': 'synchronous; 0.1 generations per call', 'verdict': 'used', 'error': None})
    print(arg, 'skeletons', round(sum(usage), 2))


if __name__ == '__main__':
    with ThreadPoolExecutor(9) as ex: list(ex.map(one, sys.argv[1:]))
