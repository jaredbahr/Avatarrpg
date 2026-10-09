#!/bin/sh
# Regenerate the true Ba Dan pieces and every ground plate, in the order the plates agree.
# Run from the repository root:
#   sh scripts/art/ba-dan-guides/regen.sh           # packed pieces -> WebP -> ground plates
#   sh scripts/art/ba-dan-guides/regen.sh painted   # also the guide and edge stages from the painted masters
# Needs python 3 with PIL and numpy for the `painted` stage; nothing else is read from outside the repository.
set -e
if [ "$1" = painted ]; then
  python scripts/art/ba-dan-guides/build.py      # guides, masks, footprints, pieces.json
  python scripts/art/ba-dan-guides/edge.py       # painted/ (yards/ for the houses) -> <name>.png
  python scripts/art/ba-dan-guides/walls.py      # the wall modules -> walls/<run>.png (composed, joined, edge-treated)
  python scripts/art/ba-dan-guides/planes.py     # planes/<house>.png
  node --import tsx scripts/art/ba-dan-true-pins.ts >/dev/null   # pins.json
fi
node --import tsx scripts/art/ba-dan-true-pieces.ts >/dev/null   # the true pieces and true-dressing.webp
node --import tsx scripts/art/ba-dan-trees-pack.ts >/dev/null     # village-trees.webp: masters and clumps
for s in ba-dan-courtyard-ground ba-dan-western-approach-ground ba-dan-neighborhood-ground ba-dan-garden ba-dan-exterior-apron ba-dan-north-fringe-ground ba-dan-water; do
  node --import tsx scripts/art/$s.ts >/dev/null
done
node --import tsx scripts/art/ba-dan-true-pieces.ts --check
node --import tsx scripts/art/ba-dan-trees-pack.ts --check
echo regenerated
