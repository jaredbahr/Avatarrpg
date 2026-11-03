"""Copy the chosen variant A takes from raw/ to a/<char>/<kind>/<dir>/NN.png (96x96 native canvas, untouched pixels).

usage (repo root): python3 -I art/source/party-g1/tools/select_a.py
The choice is assembly.json: {char: {"idle/<dir>": "<raw job>", "walk/<dir>": "<raw job>"}}.
"""
import json, shutil
from pathlib import Path
HERE = Path(__file__).resolve().parent.parent
for char, takes in json.load(open(HERE / 'assembly.json'))['a'].items():
    for clip, job in takes.items():
        out = HERE / f'a/{char}/{clip}'; out.mkdir(parents=True, exist_ok=True)
        for f in sorted((HERE / 'raw' / job).glob('*.png')): shutil.copy(f, out / f.name)
        print(char, clip, '<-', job)
