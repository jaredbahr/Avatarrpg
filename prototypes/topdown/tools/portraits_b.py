"""Dialogue portraits, style B (detailed pixel art, 160 px), owner-approved 2026-11-11.

Recipe: take the hand-drawn portrait (public/art/portraits/<id>.png), resize to 160x160 LANCZOS, run it through
PixelLab /edit-image-pro-flash (method 'text', the B description below, seed 11, about 10 credits each).
Run from this folder:  python3 portraits_b.py OUT_DIR id [id ...] [--seed N] [--base-dir DIR]
(--base-dir points at the pre-B hand-drawn portraits when redoing one; git show e1c545a7^:public/art/portraits/<id>.png)
Every call is booked in ../ledger.json as t9_portrait_<id>_B (a retry adds _s<seed>).
"""
import sys
sys.path.insert(0, '.')
import pl
from PIL import Image
from pathlib import Path

PORTRAITS = Path(__file__).resolve().parents[3] / 'public/art/portraits'
CREAM = (240, 228, 208)

STYLE = ('Highly detailed pixel art bust portrait of {who}, in the style of a premium modern pixel-art RPG dialogue portrait: '
         'rich palette of about 48 colours, careful hand-placed shading with soft ramps, selective dithering, crisp 1 px outlines in darker material tones, '
         'detailed hair strands, eyes with highlights, fabric folds and gold trim. Keep {keep}. '
         'Plain light background, a full square picture with no circular crop. No anti-aliased blur; every pixel deliberate.')

# id -> (base image, who, what to keep)
CAST = {
 'kaya': ('kaya.png', 'the same young woman', 'her face, ponytail with red tie, crimson high-collar jacket, black shoulder guards, and the small flame in her raised hand'),
 'sura': ('sura.png', 'the same young woman', 'her face, blue eyes, long dark braid with blue beads, teal and navy fur-trimmed water-tribe tunic, and the small ice crystals by her raised hand'),
 'bo': ('bo.png', 'the same young man', 'his face, green eyes, short messy black hair, green vest over yellow sleeves, brown sash with a ring buckle, wrapped wrist, and the small rock floating above his raised hand'),
 'tenzo': ('tenzo.png', 'the same young man', 'his face, spiky black hair, red high-collar short-sleeved jacket with gold buttons and black panels, red sash, and the small flame in his open hand'),
 'nilak': ('nilak.png', 'the same young man', 'his face, blue eyes, dark topknot with a blue tie, navy parka with white fur collar and blue swirl patterns, and the ribbon of water around his hand'),
 'mira': ('mira.png', 'the same elderly woman', 'her weathered face, white hair in a bun, green and yellow shawl, leaf pendant, and her hand resting on a cane'),
 'gao': ('gao.png', 'the same stout middle-aged man', 'his warm smile, flat brown cap, grey-black beard, green shirt with a pale apron, string of red chillies, and the abacus and gourd he holds'),
 'dorin': ('dorin.png', 'the same thin young man', 'his face, big ears, short dark hair, thin moustache, green high-collar tunic with a key pendant, and the spear he holds'),
 'jin': ('jin.png', 'the same woman', 'her face, dark hair in a bun, purple coat with a dark fur collar, the brass key and the book she holds'),
 'jinu': ('jinu.png', 'the same young woman', 'her face, curly dark hair, orange and red cloak with a spiral clasp over yellow, the peace sign, and the falling leaves'),
 'linmei': ('linmei.png', 'the same young woman', 'her face, green eyes, short dark hair with a small topknot, green short jacket with gold trim, and her raised fist with the small rock'),
 'nima': ('nima.png', 'the same young man', 'his face, short spiked black hair with shaved sides, orange-red cape with spiral clasp over yellow, wrist wrap, and the small swirl of air by his hand, with the shoulders and clothes running off the bottom and side edges so the picture fills all four corners of the square'),
 'pella': ('pella.png', 'the same child', 'her cheeky gap-toothed grin, dark pigtails with green ties, smudged cheeks, patched green vest, and the cabbage she hugs'),
 'riko': ('riko.png', 'the same young woman', 'her face, short dark hair with a thin braid, plum-purple high-collar jacket with light trim, and the two raised fingers'),
 'ruon': ('ruon.png', 'the same older man', 'his weary face, grey-streaked hair, stubble, brown military coat with a worn patch, and his hand on a sword hilt'),
 'wen': ('wen.png', 'the same young man', 'his grin, messy blond hair, goggles on a headband, blue vest with brown straps, and the mechanical glove with the blue glow'),
 'enemy.bruiser': ('enemy.bruiser.png', 'the same burly bandit', 'his bald head with a red headband, short stubbled beard, gruff but human face, and torn red vest, with the shoulders and clothes running off the bottom and side edges so the picture fills all four corners of the square'),
 'enemy.crossbow': ('enemy.crossbow.png', 'the same bandit crossbowman', 'his steel helmet, red leather armour with shoulder plates, and the crossbow'),
 'enemy.deserter': ('enemy.deserter.webp', 'the same man', 'his short black hair, serious tired face, red high-collar tunic and dark shoulder strap'),
 'enemy.quarrybender': ('enemy.quarrybender.png', 'the same quarry bandit', 'his messy dark hair with a green headband, torn green robe and yellow sash, with the shoulders and clothes running off the bottom and side edges so the picture fills all four corners of the square'),
 'enemy.slinger': ('enemy.slinger.png', 'the same bandit slinger', 'his red hood and red scarf, dark hair and focused face, with the shoulders and clothes running off the bottom and side edges so the picture fills all four corners of the square'),
 'enemy.thug': ('enemy.thug.png', 'the same scruffy bandit', 'his red bandana, dark hair, short goatee, crooked grin, and torn red vest'),
 'enemy.grumbler': ('enemy.grumbler.png', 'the same steam-powered tracked drilling machine', 'its brass and rust-red boiler body, glowing amber window, caterpillar tracks and big grey drill cone, no person'),
 'dema': ('mira.png', 'a weathered woman in her forties, the road keeper',
          'her strong build; she is a new person: tan weathered skin with laugh lines, a wide conical straw hat shading her face, an oatmeal-coloured tunic with the sleeves rolled to the elbow, a rust-orange sash at the waist, a warm practical expression with a small knowing smile'),
 'sen': ('gao.png', 'a tall lanky man in his thirties, the tea keeper',
         'his friendly pose; he is a new person: narrow kind face with a slightly wry smile, short dark hair under a grey headband, a slate-grey quilted vest over a brick-red shirt, a white towel over one shoulder, a tan sash, holding out a dented tin kettle in one hand and a chipped cup with a blue handle in the other'),
}


# Redo wording (2026-11-11 owner review, seed != 11). Pella: calm hair, little dithering. Jinu: her real hair is two
# high round puffs of tight curls with small red ties plus a few loose ringlets at the temples (docs/art/prompts/portraits/jinu.md,
# her top-down sprite), not two smooth buns.
REDO = {
 'pella': dict(keep='her cheeky gap-toothed grin, dark pigtails with green ties, smudged cheeks, patched green vest, and the cabbage she hugs; '
                    'draw the hair as a few large, calm, smooth shapes with one or two clean highlight bands and a clean outline, '
                    'with no scattered stray pixels or flyaway noise, and use dithering only very sparingly, mostly flat colour ramps',
               style_extra=' Clean, calm shapes; minimal dithering; no speckle.'),
 'jinu': dict(keep='her face, grey eyes, orange and red cloak with a spiral clasp over yellow, the peace sign, and the falling leaves; '
                   'her hair is dark and tightly curly, gathered into two high round puffs of tight spiral curls each tied with a small red tie, '
                   'with a few loose spiral ringlets at her temples; draw the curls as clustered curl shapes with highlights, not as two smooth buns, '
                   'with a clean outline and no scattered stray pixels',
              style_extra=' Clean, calm hair shapes; sparing dithering.'),
}


def make(pid, out, seed=11, base_dir=None):
    base, who, keep = CAST[pid]
    style = STYLE
    if seed != 11 and pid in REDO:
        keep = REDO[pid]['keep']; style = STYLE + REDO[pid]['style_extra']
    src = Image.open((Path(base_dir) if base_dir else PORTRAITS) / base).convert('RGBA')
    bg = Image.new('RGBA', src.size, CREAM + (255,)); bg.alpha_composite(src)
    canvas = bg.convert('RGB').resize((160, 160), Image.LANCZOS)
    name = f't9_portrait_{pid}_B' + ('' if seed == 11 else f'_s{seed}')
    e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(canvas), 'method': 'text', 'description': style.format(who=who, keep=keep),
                                            'no_background': False, 'seed': seed}, name, estimate=10)
    lr = r['final'].get('last_response') or r['final']; ims = []; pl.images(lr, ims)
    if not ims:
        for k in ('image_url', 'url'):
            if lr.get(k): ims.append(pl.fetch(lr[k]))
    path = Path(out) / f'{pid}_B_s{seed}.png'
    ims[0].save(path); print(pid, ims[0].size, e.get('credits'), path)


if __name__ == '__main__':
    args = sys.argv[1:]; seed = 11
    if '--seed' in args:
        i = args.index('--seed'); seed = int(args[i + 1]); del args[i:i + 2]
    base_dir = None
    if '--base-dir' in args:
        i = args.index('--base-dir'); base_dir = args[i + 1]; del args[i:i + 2]
    out, ids = args[0], args[1:]
    Path(out).mkdir(parents=True, exist_ok=True)
    for pid in ids: make(pid, out, seed, base_dir)
