#!/bin/sh
# Regenerate the guide-and-paint masters' derived files (guides, edge-treated masters, wall runs, planes) from
# the painted masters. Run from the repository root:
#   sh scripts/art/ba-dan-guides/regen.sh
# Needs python 3 with PIL and numpy; nothing else is read from outside the repository.
#
# This is as far as the true-piece chain goes now. The packers that turned these masters into the village's
# sprites, the light and contact they baked into ground plates, and the plates themselves were retired when the
# village became one continuous painting (`docs/art/ba-dan-scene.md`, `scripts/art/ba-dan-regions/`); they are in
# git history at 7925789c. The sprites they packed are frozen as the geometry the painting is cut by
# (`art/source/ba-dan-regions/geometry/`).
set -e
python scripts/art/ba-dan-guides/build.py      # guides, masks, footprints, pieces.json (houses.py, pieces.py, dressing.py)
python scripts/art/ba-dan-guides/edge.py       # painted/ -> <name>.png
python scripts/art/ba-dan-guides/walls.py      # the wall modules -> walls/<run>.png (composed, joined, edge-treated)
python scripts/art/ba-dan-guides/planes.py     # planes/<house>.png
echo regenerated
