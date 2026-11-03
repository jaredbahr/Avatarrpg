"""Variant A step 3: copy the chosen native rotations to a/<char>/rotations/<dir>.png and estimate their skeletons.

usage (repo root): python3 -I art/source/party-g1/tools/skeletons.py char=rot-job [...]   (e.g. kaya=a-rot-kaya-s9201)
Writes a/<char>/rotations/<dir>.png for all eight, a/<char>/rotations/skeleton/<dir>.json for S, SE, E (estimate-skeleton,
0.1 generations each) and one ledger line per character.
"""
import json, shutil, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
TESTED = ['south', 'south-east', 'east']

for arg in sys.argv[1:]:
    char, job = arg.split('=')
    rot = HERE / f'a/{char}/rotations'; (rot / 'skeleton').mkdir(parents=True, exist_ok=True)
    for i, d in enumerate(DIRS): shutil.copy(HERE / f'raw/{job}/{i:02d}.png', rot / f'{d}.png')
    before = pl.balance(); t0 = time.time(); usage = []
    for d in TESTED:
        r = pl.req('POST', '/estimate-skeleton', {'image': pl.b64(rot / f'{d}.png')})
        json.dump(r, open(rot / f'skeleton/{d}.json', 'w'), indent=1); usage.append((r.get('usage') or {}).get('generations'))
    entry = {'name': f'skeleton-{char}', 'endpoint': '/estimate-skeleton', 'job': None, 'status': 'completed', 'settings': {'image': '<png>'},
             'inputs': {'image': f'a/{char}/rotations/<{"|".join(TESTED)}>.png (from raw/{job})'}, 'outputs': [f'a/{char}/rotations/skeleton/{d}.json' for d in TESTED],
             'gens': sum(u or 0.1 for u in usage), 'balance_before': before, 'balance_after': pl.balance(), 'secs': round(time.time() - t0),
             'notes': 'synchronous; 0.1 generations per call', 'verdict': 'used', 'error': None}
    L = pl.ledger(); L['jobs'].append(entry); json.dump(L, open(pl.LEDGER, 'w'), indent=1)
    print(char, 'skeletons', usage)
