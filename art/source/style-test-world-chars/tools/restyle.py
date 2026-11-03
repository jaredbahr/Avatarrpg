"""Step 2: restyle the composite exactly as the world was restyled (ba-dan-route-a/tools/world.py): edit-images-v2,
edit_with_text, the world's style sentence, no reference image (a reference pastes ghost figures), at world px.
The only change to the world's prompt: "No people" becomes an instruction to keep the people and render them in the
ground's hand.

usage (repo root): python3 -I art/source/style-test-world-chars/tools/restyle.py NAME SEED [input.png]
(the walk probe's input holds twenty-four figures; the roots' sixteen)"""
import sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent

STYLE = ('fine-grain pixel art: 1 px dark brown outline (#1b1410) only on silhouettes and deep overlaps, '
         '3-5 flat tone groups per material, matte surfaces, no glossy highlights, no white glints, no bevels, warm key light from the upper left, '
         'cool brown shadows down-right, muted earth palette, calm low-detail ground')
PEOPLE = ('{n} people stand on the ground in four rows. Keep every person exactly where they stand, at the same size, pose and facing, '
          'with the same hair, face and costume colours; render each person with the same painterly pixel texture, tone clusters, '
          'warm upper-left light and soft outline as the ground and buildings around them, so they belong to this scene. '
          'Do not add or remove anyone.')
KEEP = 'Keep the exact composition, camera angle (2:1 isometric, high top-down), every outline and shape position; change only the rendering.'
PROMPT = 'Redraw as ' + STYLE + '. ' + PEOPLE + ' ' + KEEP
COUNT = {'inputs/composite.png': 'Sixteen'}

if __name__ == '__main__':
    name, seed = sys.argv[1], int(sys.argv[2])
    src = sys.argv[3] if len(sys.argv) > 3 else 'inputs/composite.png'
    im = Image.open(HERE / src).convert('RGB'); w, h = im.size
    prompt = PROMPT.format(n=COUNT.get(src, 'Twenty-four'))
    payload = {'method': 'edit_with_text', 'edit_images': [{'image': pl.b64(im), 'width': w, 'height': h}],
               'image_size': {'width': w, 'height': h}, 'description': prompt, 'seed': seed}
    pl.run('/edit-images-v2', payload, name, inputs={'edit_images[0]': src}, notes='world restyle settings on the figure composite')
