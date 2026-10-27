"""Variant A step 2: eight native rotations from the chosen native south (create-character-pro-flash, first_frame).

usage (repo root): python3 -I art/source/party-g1/tools/gen_a_rot.py SEED char=south-job [char=south-job ...]
e.g. kaya=a-south-kaya-s9102. Output raw/a-rot-<char>-s<SEED>/NN.png in the order S, SE, E, NE, N, NW, W, SW.
"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE / 'tools/chars.json'))


def one(char, south, seed):
    src = HERE / f'raw/{south}/00.png'
    payload = dict(first_frame=pl.b64(src), description=C[char]['description'], name=f'{char} G1 native (party-g1, {south})',
                   view='high top-down', seed=seed, template_id='mannequin')
    return pl.run('/create-character-pro-flash', payload, f'a-rot-{char}-s{seed}', inputs={'first_frame': f'raw/{south}/00.png'},
                  notes='variant A: native rotations at the world-px canvas')


if __name__ == '__main__':
    seed = int(sys.argv[1]); pairs = [a.split('=') for a in sys.argv[2:]]
    with ThreadPoolExecutor(3) as ex: list(ex.map(lambda p: one(p[0], p[1], seed), pairs))
