"""Ba Dan at G1, step 3: the G1 world (world px) back into the region paintings.

Since ADR 0088 the region pipeline works at 1 painting px per world px (`regions.py` `SCALE`), the G1 world's own
resolution, so each region is a plain crop of the world: no resampling. Every overlap is the same pixels in both
neighbours, so `stitch` joins them invisibly. (Before ADR 0088 the world was first scaled to 1.5 painting px by EPX x2
then a 0.75 Lanczos, `compose.up15`.)

The accepted folder is cleared first (a region of another plan or scale must not be stitched with these), the geometry
is rendered on the grid, and every guide is built over the world itself (`guide all --ground`), so each crop is gated
against the frozen geometry's uprights laid over the picture it was cut from. Each crop then goes through
`regions.py accept` with the prompt file of the restyle. Run from the repository root:

    python art/source/ba-dan-route-a/tools/regions_back.py [--force]
"""
import json, os, subprocess, sys
from pathlib import Path
from PIL import Image

RA = os.environ.get('ROUTE_A_WORK', '.review/route-a')
REG = os.environ.get('BA_DAN_WORK', '.review/regions')
PROMPT = 'art/source/ba-dan-route-a/world/prompt.txt'
ACCEPTED = Path('art/source/ba-dan-regions/accepted')

def main():
    py = os.environ.get('PYTHON', 'python')
    regions = [py, 'scripts/art/ba-dan-regions/regions.py', '--out', REG]
    subprocess.run(regions + ['plan'], check=True, capture_output=True)
    plan = json.load(open(f'{REG}/regions.json'))
    v = plan['village']
    world = Image.open(os.environ.get('WORLD_G1', 'art/source/ba-dan-route-a/world/world-g1.png')).convert('RGB')
    if plan['scale'] != 1:
        sys.exit(f"regions.py plans at {plan['scale']} painting px per world px; this cuts a world-px picture as it is")
    if world.width < v['pxWidth'] or world.height < v['pxHeight']:
        sys.exit(f"the world is {world.size}, smaller than the village {v['pxWidth']}x{v['pxHeight']}")
    paint = world.crop((0, 0, v['pxWidth'], v['pxHeight']))
    os.makedirs(f'{RA}/candidates', exist_ok=True)
    paint.save(f'{RA}/painting-g1.png')
    for f in ACCEPTED.glob('r*c*.*'):
        f.unlink()
    for step in (['render'], ['guide', 'all', '--ground', f'{RA}/painting-g1.png']):
        subprocess.run(regions + step, check=True, capture_output=True)
    out = {}
    for r in plan['regions']:
        b = r['px']; c = paint.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))
        p = f"{RA}/candidates/{r['id']}.png"; c.save(p)
        cmd = regions + ['accept', r['id'], p, '--prompt', PROMPT]
        if '--force' in sys.argv: cmd.append('--force')
        res = subprocess.run(cmd, capture_output=True, text=True)
        out[r['id']] = res.returncode
        print(r['id'], res.returncode, res.stdout.strip().splitlines()[-1] if res.stdout.strip() else res.stderr[-300:])
    return 0 if all(v == 0 for v in out.values()) else 1

if __name__ == '__main__':
    sys.exit(main())
