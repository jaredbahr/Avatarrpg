"""Dialogue portraits, style B (detailed pixel art, 160 px), owner-approved 2026-11-11.

Recipe: take the hand-drawn portrait (public/art/portraits/<id>.png), resize to 160x160 LANCZOS, run it through
PixelLab /edit-image-pro-flash (method 'text', the B description below, seed 11, about 10 credits each).
Run from this folder:  python3 portraits_b.py OUT_DIR id [id ...] [--seed N] [--base-dir DIR]
(--base-dir points at the pre-B hand-drawn portraits when redoing one; git show e1c545a7^:public/art/portraits/<id>.png)
Every call is booked in ../ledger.json as t9_portrait_<id>_B (a retry adds _s<seed>); `--prefix rg02_` books a region's
portraits under its own prefix instead (RG-02: rg02_portrait_<id>_B, tagged by PIXELLAB_REGION).
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
 'hanru': ('dorin.png', 'a sturdy middle-aged village watch keeper',
           'the upright spear and calm guard pose; this is a new person: a plain weathered face with steady patient eyes and a faint kind '
           'half-smile, short dark hair greying at the temples under a soft brown cloth cap, a knee-length muted olive-green padded coat '
           'with a plain leather belt, holding a plain wooden spear upright; practical, few words, kind without saying so; '
           'an androgynous look, neither clearly a man nor a woman, no moustache or beard'),
 'bo_shan': ('pella.png', 'a broad-shouldered nineteen-year-old young man, the village cart driver and a minor stone-mover',
             'his sister Pella\'s family look; he is a new person, not a child: light-brown skin, messy dark brown hair with a few straw bits in it, '
             'a big boastful grin with a chipped front tooth and warm, tired, big-hearted eyes, a muted moss-green work tunic with the sleeves rolled to '
             'the elbow, an ochre linen scarf, a worn brown leather harness strap across the chest, a coil of cart reins over one shoulder, '
             'and one hand held up showing off a small pebble of rock floating above his palm; no beard, no armour, no weapon'),
 'sen': ('gao.png', 'a tall lanky man in his thirties, the tea keeper',
         'his friendly pose; he is a new person: narrow kind face with a slightly wry smile, short dark hair under a grey headband, a slate-grey quilted vest over a brick-red shirt, a white towel over one shoulder, a tan sash, holding out a dented tin kettle in one hand and a chipped cup with a blue handle in the other'),

 # RG-02 (Saltstep and Emberwatch), 2026-11-15: four new people, each from the nearest existing portrait as Dema and Sen
 # were, described from the bible and the act II script and matched to their top-down sprites (`tools/rg02chars.py`).
 'veyra': ('jin.png', 'a woman engineer in her mid-forties, the director of a public-works cooperative',
           'the calm upright pose; she is a new person: light brown skin, a calm direct face with fine lines at the eyes and a '
           'faint wry half-smile, a long black braid threaded with silver-grey strands hanging over her left shoulder, a '
           'practical dark-blue work coat with lighter blue mended cuffs and the sleeves pushed up, a brown leather tool belt '
           'strap, a small carved wooden measuring rule held in one hand; no jewellery, no fur, no armour'),
 'tavi': ('hanru.png', 'a ferry pilot in their thirties',
          'the steady pose; this is a new person: an androgynous look, neither clearly a man nor a woman, sun-browned skin, '
          'short tousled black hair under a wide flat straw hat pushed back, weathered sea-green sleeveless jacket over a white '
          'shirt with rolled sleeves, a coil of rope over one shoulder, a long wooden ferry pole held upright; easy-going, '
          'patient, a small knowing smile; no beard, no moustache'),
 'luli': ('dema.png', 'a sturdy woman in her early forties who keeps the public power lines',
          'her strong build; she is a new person, with no hat: warm tan skin, a round cheerful tired face mid-laugh, short '
          'choppy black hair, a soot smudge on one cheek, a rust-red sleeveless work tunic over a dark grey long-sleeved shirt, '
          'a thick brown leather apron, black rubber work gloves tucked in her belt, a ring of brass keys'),
 'customs_clerk': ('sen.png', 'a fussy thin harbour customs clerk in his fifties',
                   'the upright pose; he is a new person: light skin, round wire spectacles, a neat grey moustache, a flat dark '
                   'blue official cap, a buttoned slate-blue clerk jacket with brass buttons, a big brass seal hanging on a chain '
                   'round his neck, a sheaf of papers held to his chest; earnest and indignant; no kettle, no cup, no towel'),
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
 # 2026-11-12 owner review: the B redraw lost the forearm, so the hand on the abacus floats.
 'gao': dict(keep='his warm smile, flat brown cap, grey-black beard, green shirt with a pale apron, string of red chillies, and the gourd on its strap; '
                  'his right forearm, with the white sleeve rolled to the elbow, comes in across the bottom left of the picture and joins the hand '
                  'that holds the abacus against his chest, so the arm runs unbroken from the sleeve to the hand; both arms clearly attached to his shoulders, '
                  'nothing cut off or floating',
             style_extra=' Anatomy must be whole: every hand connects to an arm.'),
  # RG-02, 2026-11-15: the seed-11 take kept Hanru's spearhead on Tavi's ferry pole.
 'tavi': dict(keep='the steady pose; this is a new person: an androgynous look, neither clearly a man nor a woman, sun-browned '
                   'skin, short tousled black hair under a wide flat straw hat pushed back, weathered sea-green sleeveless jacket '
                   'over a white shirt with rolled sleeves, a coil of rope over one shoulder, a long plain round wooden ferry pole '
                   'held upright with a blunt rounded top end, no blade, no spearhead, no metal tip; easy-going, patient, a small '
                   'knowing smile; no beard, no moustache',
              style_extra=' The pole is plain wood from end to end; it is not a weapon.'),
}

# Not a person: the narrator speaks as the places of the route (docs/art/prompts/portraits/narrator.md). Its base is a rough
# composition sketch (gate, quarry hill, low sun, empty cart) passed with --base-dir.
PLACE_STYLE = ('Highly detailed pixel art emblem of a place, in the style of a premium modern pixel-art RPG dialogue portrait: '
               'rich palette of about 48 colours, careful hand-placed shading with soft ramps, selective dithering, crisp 1 px outlines in darker material tones. '
               '{keep}. No people, no faces, no text. Plain light parchment sky, a full square picture with no circular crop. '
               'No anti-aliased blur; every pixel deliberate.')
PLACES = {
 'narrator': ('narrator_sketch.png', 'a village gate', 'A squat gate of cut warm grey-brown stone blocks with a heavy wooden double door and a wooden crossbeam, '
              'filling the middle of the picture; a muted green quarry hill with pale cut rock faces rising behind it under a low warm sun; '
              'a dusty road in front with one small empty wooden hand cart; calm, patient, a little foreboding'),
}


def make(pid, out, seed=11, base_dir=None, prefix='t9_'):
    base, who, keep = CAST[pid] if pid in CAST else PLACES[pid]
    style = PLACE_STYLE if pid in PLACES else STYLE
    if seed != 11 and pid in REDO:
        keep = REDO[pid]['keep']; style = STYLE + REDO[pid]['style_extra']
    src = Image.open((Path(base_dir) if base_dir else PORTRAITS) / base).convert('RGBA')
    bg = Image.new('RGBA', src.size, CREAM + (255,)); bg.alpha_composite(src)
    canvas = bg.convert('RGB').resize((160, 160), Image.LANCZOS)
    name = f'{prefix}portrait_{pid}_B' + ('' if seed == 11 else f'_s{seed}')
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
    prefix = 't9_'
    if '--prefix' in args:
        i = args.index('--prefix'); prefix = args[i + 1]; del args[i:i + 2]
    out, ids = args[0], args[1:]
    Path(out).mkdir(parents=True, exist_ok=True)
    for pid in ids: make(pid, out, seed, base_dir, prefix)
