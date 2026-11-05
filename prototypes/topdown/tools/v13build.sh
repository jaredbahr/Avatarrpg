#!/bin/sh
# v13 Ba Dan: the houses' depth cues (objects_bd13 from objects12), then the game and the page. Run from the topdown folder.
# (v12's objects12 are an input here and are not rebuilt; tools/v12build.sh still rebuilds them.)
set -e
python3 tools/v13houses.py > v12/houses13.log
python3 tools/assemble13.py
python3 tools/build13.py > /dev/null
