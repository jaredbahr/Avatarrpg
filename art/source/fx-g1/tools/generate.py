"""PixelLab pass for the G1 effects: one Pro Flash text edit per input sheet.

Run from the repo root:  python3 -I art/source/fx-g1/tools/generate.py <sheet> [<sheet> ...] [--seed N]
Every job goes through `pl.run`, which ledgers it in `art/source/fx-g1/ledger.json`
(request with images named, job id, generations used) and caches by tag.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from pl import RA, b64, run

COMMON = ('Clean up this sheet of small spell-effect sprites into crisp pixel art at this exact size, one art pixel per '
          'pixel: keep every sprite exactly where it is, at the same size and silhouette, nothing added or removed; '
          '{look}; 1 px dark brown outline (#1b1410) on the outer silhouette, interrupted where the light catches it; '
          'flat fills, hard pixel edges, no gradients, no glow, no blur, no anti-aliasing, no dithering noise; '
          'transparent background.')

LOOK = {
    'fire': 'fire as flat flame ribbons and licks in 3-4 flat tones: deep red #8c2416, red #d1462f, coral #f0785c, pale peach core #ffb27a',
    'lightning': 'pale lightning bolts in 3 flat tones: steel blue #3e8fb0, sky #7ec8e3, near-white #cdeefb',
    'water': 'water as flat crests, whips, sheets and droplets in 3-4 flat tones: deep teal #22566e, blue #3e8fb0, sky #7ec8e3, foam #cdeefb',
    'ice': 'ice as pointed flat facets in 3-4 flat tones: blue #3e8fb0, sky #7ec8e3, pale #cdeefb, white',
    'earth': 'earth as broad stone slabs, shards and cracks in 3-4 flat tones: dark brown #4a3a2c, stone #8d7d69, light stone #bfae97, highlight #f4e9d8',
    'metal': 'metal as folded flat bands in 3 flat tones: grey-brown #9a8c72, stone #b3a488, pale #d8cbb0',
    'air': 'air as thin open streamlines and arcs with clear transparent space between them, 2-3 flat tones: shadow #9a8e72, cream #e8dcc0, pale #fdf6e3',
    'flask': 'a small clay flask with a cork in 3 flat tones: dark #4d241b, clay #8a4b3c, light #b8705c, cork #c7a87d',
}

SHEET_LOOK = {
    'bend-fire-0': 'fire', 'bend-earth-0': 'earth', 'bend-water-0': 'water',
    'cel-flame': 'fire', 'cel-fire-burst': 'fire', 'cel-lightning': 'lightning',
    'cel-splash': 'water', 'cel-ice': 'ice', 'cel-healing': 'water',
    'cel-boulder': 'earth', 'cel-earth-rise': 'earth', 'cel-metal': 'metal',
    'cel-wind': 'air', 'cel-cyclone': 'air', 'cel-cushion': 'air', 'cel-flask': 'flask',
}


def job(sheet, seed):
    path = f'{RA}/inputs/{sheet}.png'
    img, h = b64(Image.open(path))
    desc = COMMON.format(look=LOOK[SHEET_LOOK[sheet]])
    return run('/edit-image-pro-flash',
               {'image': img, 'method': 'text', 'description': desc, 'no_background': True, 'seed': seed},
               f'{sheet}-s{seed}', {h: f'inputs/{sheet}.png'}, f'G1 effects clean-up of {sheet}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    seed = int(sys.argv[sys.argv.index('--seed') + 1]) if '--seed' in sys.argv else 11
    args = [a for a in args if a != str(seed)]
    os.makedirs(f'{RA}/jobs', exist_ok=True)
    with ThreadPoolExecutor(4) as ex:
        for out in ex.map(lambda s: job(s, seed), args):
            pass
