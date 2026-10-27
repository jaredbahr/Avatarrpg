"""Ba Dan at G1, step 3: the G1 world (world px) back into the twelve region paintings.

The G1 painting is scaled to the regions' 1.5 painting px per world px by EPX x2 then a 0.75 Lanczos (`compose.up15`), and
each region is its crop. Every overlap is the same pixels in both neighbours, so `stitch` joins them invisibly.
Each crop goes through `regions.py accept` (the registration gate against the guide of the frozen geometry), with the
prompt file of the restyle. Run from the repository root:

    python art/source/ba-dan-route-a/tools/regions_back.py [--force]
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from compose import up15

RA = os.environ.get('ROUTE_A_WORK', '.review/route-a')
REG = os.environ.get('BA_DAN_WORK', '.review/regions')
PROMPT = 'art/source/ba-dan-route-a/world/prompt.txt'

def main():
    world = Image.open(os.environ.get('WORLD_G1', 'art/source/ba-dan-route-a/world/world-g1.png')).convert('RGB')
    paint = up15(world, (4500, 2402)).convert('RGB').crop((0, 0, 4500, 2401))
    os.makedirs(f'{RA}/candidates', exist_ok=True)
    paint.save(f'{RA}/painting-g1.png')
    plan = json.load(open(f'{REG}/regions.json'))
    py = os.environ.get('PYTHON', 'python')
    # the geometry (with the replaced pieces' new silhouettes) on the grid, and every guide from the shipped painting
    # before any region is replaced, so each candidate is gated against the same reference
    for step in (['render'], ['guide', 'all']):
        subprocess.run([py, 'scripts/art/ba-dan-regions/regions.py', '--out', REG] + step, check=True, capture_output=True)
    out = {}
    for r in plan['regions']:
        b = r['px']; c = paint.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))
        p = f"{RA}/candidates/{r['id']}.png"; c.save(p)
        cmd = [py, 'scripts/art/ba-dan-regions/regions.py', '--out', REG, 'accept', r['id'], p, '--prompt', PROMPT]
        if '--force' in sys.argv: cmd.append('--force')
        res = subprocess.run(cmd, capture_output=True, text=True)
        out[r['id']] = res.returncode
        print(r['id'], res.returncode, res.stdout.strip().splitlines()[-1] if res.stdout.strip() else res.stderr[-300:])
    return 0 if all(v == 0 for v in out.values()) else 1

if __name__ == '__main__':
    sys.exit(main())
