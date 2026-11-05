#!/bin/sh
# Ba Dan: the houses (v14: PixelLab redraws, processed from v14/raw by v14proc.py into assets/objects_bd13; v13's code-cue houses are
# in assets/objects_bd13-v1 and tools/v13houses.py), then the game and the page. Run from the topdown folder.
# (v12's objects12 are an input here and are not rebuilt; tools/v12build.sh still rebuilds them.)
set -e
python3 tools/v14proc.py > v14/proc.log
python3 tools/assemble13.py
python3 tools/build13.py > /dev/null 2>&1
