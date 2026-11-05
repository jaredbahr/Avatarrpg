#!/bin/sh
# v12: objects12 sprites (outline fix, house depth cues, the new bridge), then the game and the page. Run from the topdown folder.
set -e
python3 tools/v12outline.py > v12/outline.log
python3 tools/v12houses.py > /dev/null
python3 tools/v12bridge_place.py > /dev/null
python3 tools/assemble12.py
python3 tools/build12.py > /dev/null
