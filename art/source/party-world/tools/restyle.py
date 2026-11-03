"""Step 2b: restyle each composite exactly as #317 restyled its figures (style-test-world-chars/tools/restyle.py, itself
the world's own settings from ba-dan-route-a/tools/world.py): edit-images-v2, edit_with_text, the world's style sentence,
seed 11, no reference image, at world px. 25 generations a 512 job of sixteen figures.

usage (repo root): python3 -I art/source/party-world/tools/restyle.py SEED JOB [JOB ...]  -> raw/r-job<J>-s<SEED>/00.png"""
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import importlib.util
sys.path.insert(0, str(Path(__file__).parent))
import pl   # this folder's: its ledger and raw/ are party-world's
# The style test's prompt, unchanged, loaded by path so its own pl.py is never imported in this one's place.
_spec = importlib.util.spec_from_file_location('st_restyle', Path(__file__).resolve().parents[2] / 'style-test-world-chars/tools/restyle.py')
st = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(st)
HERE = Path(__file__).resolve().parent.parent


def one(job, seed):
    src = f'inputs/job{job}.png'
    im = Image.open(HERE / src).convert('RGB'); w, h = im.size
    payload = {'method': 'edit_with_text', 'edit_images': [{'image': pl.b64(im), 'width': w, 'height': h}],
               'image_size': {'width': w, 'height': h}, 'description': st.PROMPT.format(n='Sixteen'), 'seed': seed}
    return pl.run('/edit-images-v2', payload, f'r-job{job}-s{seed}', inputs={'edit_images[0]': src},
                  notes="#317's world restyle settings on sixteen party roots (eight headings)")


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(3) as ex: list(ex.map(lambda j: one(int(j), seed), sys.argv[2:]))
