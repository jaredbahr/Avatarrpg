"""Ba Dan at G1, the polish pass (owner, 2026-10-27: "Do a pass and clean up visuals. Tree roots and other items are off.").

Input: the completed G1 world (`world/world-g1.png`, the exact source of the shipped regions). Steps, in order:
  roots     tree feet redrawn so roots sink into the soil (`roots.py`, Pro Flash inpaint)
  props     lantern posts, banners, notice board, handcart and trough at a believable size (`props.py`, `props_set.py`);
            the bench's and fence's cast bars shortened, with a contact pool (`props_set.reshade`)
  garden    the garden plot without its glass box, as a tended bed (`garden.py`)
  paving    paving in one even hand (`paving.py`, deterministic but for three small inpaints)
  rim       ghosts at the page edge and behind the wall (`rim.py`)
Writes `world/world-g1-polish.png`; with --geometry it also points the resized props' frozen sprites at their new
silhouettes (footprint, depth and flags unchanged). Then:

    WORLD_G1=art/source/ba-dan-route-a/world/world-g1-polish.png python art/source/ba-dan-route-a/tools/regions_back.py
    sh scripts/art/ba-dan-regions/regen.sh

PixelLab jobs (ledger and outputs) are in `polish/`; with them present the pass makes no PixelLab call.
Intermediates go to POLISH_WORK (default .review/polish)."""
import sys
from polishlib import *
import roots, props_set, paving

WORK = os.environ.get('POLISH_WORK', '.review/polish')
OUT = 'art/source/ba-dan-route-a/world/world-g1-polish.png'

def main():
    os.makedirs(WORK, exist_ok=True)
    geometry = '--geometry' in sys.argv
    world = Image.open('art/source/ba-dan-route-a/world/world-g1.png').convert('RGB')
    world, _ = roots.apply(world); world.save(f'{WORK}/1-roots.png')
    world, info, prop_mask = props_set.apply(world, geometry=geometry); world.save(f'{WORK}/2-props.png')
    world = props_set.reshade(world)  # the bench's and fence's long cast bars (one over the canal) shortened
    import garden
    world, garden_mask = garden.apply(world, geometry=geometry); world.save(f'{WORK}/3-garden.png')
    world = paving.apply(world, protect=prop_mask | garden_mask); world.save(f'{WORK}/4-paving.png')
    import rim
    world = rim.apply(world); world.save(f'{WORK}/5-rim.png')
    world.save(OUT)
    json.dump(info, open(f'{WORK}/props.json', 'w'), indent=1)

if __name__ == '__main__':
    main()
