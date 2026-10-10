#!/bin/sh
# Rebuild Ba Dan's shipped art from its tracked sources, or with --check prove the shipped files are what
# those sources make:
#
#   sh scripts/art/ba-dan-regions/regen.sh [--check]
#
# accepted regions (art/source/ba-dan-regions/accepted/*.png) --stitch--> one painting --split by the frozen
# geometry (art/source/ba-dan-regions/geometry/)--> ground plates + uprights --pack--> public/art/maps/ba-dan-scene/
# ground-NN.webp, uprights-N.webp and src/content/scenes/baDan.art.ts. Everything is deterministic: the same
# sources give the same bytes. The work directory (default .review/regions, untracked) holds the intermediates.
set -e
cd "$(dirname "$0")/../../.."
WORK="${BA_DAN_WORK:-.review/regions}"
PY="${PYTHON:-python}"
# The plan is always rebuilt from the pipeline constants, never taken from a stale work directory, and the
# stitch refuses to run unless every planned region has an accepted painting of the right size.
"$PY" scripts/art/ba-dan-regions/regions.py --out "$WORK" plan >/dev/null
"$PY" scripts/art/ba-dan-regions/regions.py --out "$WORK" render
"$PY" scripts/art/ba-dan-regions/regions.py --out "$WORK" stitch --complete
"$PY" scripts/art/ba-dan-regions/regions.py --out "$WORK" split
node --import tsx scripts/art/ba-dan-regions/pack.ts "$WORK" "$@"
