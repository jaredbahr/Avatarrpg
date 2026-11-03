"""Rollout step 2: copy each curated root (curate.json) to roots/<char>/<kind>/<dir>.png through the palette lock.

usage (repo root): python3 -I art/source/party-g1/tools/curate.py
Deterministic: the same raw files give the same roots. palette_lock.py snaps every pixel to the character's shipped palette."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from palette_lock import lock
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
for key, src in json.load(open(HERE / 'curate.json'))['pick'].items():
    char, kind, d = key.split('/')
    out = HERE / f'roots/{char}/{kind}/{d}.png'; out.parent.mkdir(parents=True, exist_ok=True)
    lock(Image.open(HERE / 'raw' / src), char).save(out)
print('roots written')
