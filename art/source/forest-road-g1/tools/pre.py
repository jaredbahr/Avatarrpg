"""The pre-G1 art, read from git at the commit before the forest road's G1 pass (main @ 5a41f98), cached under WORK/pre-g1."""
import os, subprocess
WORK = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
BASE = '5a41f98'


def pre_g1(path):
    """`path` under public/art (e.g. 'maps/forest-scene/pine.webp') -> a local file holding it as it was at BASE."""
    out = f'{WORK}/pre-g1/{path}'
    if not os.path.exists(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'wb') as f:
            f.write(subprocess.run(['git', 'show', f'{BASE}:public/art/{path}'], check=True, capture_output=True).stdout)
    return out
