"""v13 / tutorial pass: painted effects from PixelLab /vfx (lite artist), one per blow, plus looping ground flames.
Usage: python3 tools/t13vfx.py <name> [<name> ...]   -> assets/vfx13/<name>.png + .json"""
import sys, json, os; sys.path.insert(0, 'tools'); import pl
import urllib.request
TAIL = '; pixel art, crisp, no anti-aliasing, transparent background'
D = {
 'fire_ground_a': 'a small patch of flames burning on the ground, seen from a low top-down camera: three or four flame tongues in deep red, orange and a yellow core flickering upward from a dark glowing ember base, about as tall as wide, the base stays put; seamless loop of about 8 frames; fits in 24x32',
 'fire_ground_b': 'a low lick of flame burning on dirt, seen from a low top-down camera: two short flame tongues in red and orange with a small yellow tip, swaying and flickering above a few glowing embers; seamless loop of about 8 frames; fits in 16x24',
 'fire_ground_c': 'a roaring burst of flames rising from burning oil on the ground, seen from a low top-down camera: four or five tall licking flame tongues in deep red, orange and yellow, the tallest about twice as tall as it is wide, curling and flickering, the base stays put on a dark glowing patch; seamless loop of about 8 frames; fits in 32x48',
 'water_lash': 'a lash of water whipping to the right: a curved ribbon of clear blue water with white foam on its leading edge snaps forward and breaks into droplets; about 8 frames; fits in 64x32',
 'water_splash': 'a splash of water bursting on impact: blue and white droplets spray outward and fall; about 7 frames; fits in 32x32',
 'ice_burst': 'ice crystals bursting up from the ground in a short row, seen from a low top-down camera: pale blue and white shards spring up and glint, then settle with a few frost sparkles; about 8 frames; fits in 48x32',
 'heal': 'a gentle healing effect around a person: a soft rising column of pale green and aqua light with small sparkles and droplets drifting upward, then fading; about 10 frames; fits in 32x48',
 'rock_hit': 'a thrown rock smashing on impact: a grey-brown stone bursts into chunks and a puff of tan dust that falls and drifts; about 7 frames; fits in 32x32',
 'dust_ring': 'a burst of tan dust and small pebbles kicked up from the ground in a low ring, seen from a low top-down camera, about twice as wide as tall, settling quickly; about 8 frames; fits in 48x32',
 'club_hit': 'a heavy blunt impact: a white star flash with short dark impact lines and a little dust, very quick; about 5 frames; fits in 32x32',
 'slash': 'a fast sword slash: a thin bright white and silver crescent arc swept from upper left to lower right with a short trailing streak, very quick; about 5 frames; fits in 48x48',
 'bolt_hit': 'a crossbow bolt striking: a small burst of wood splinters and a short white flash, quick; about 5 frames; fits in 24x24',
 'slam_shock': 'a heavy ground slam seen from a low top-down camera: the earth cracks in a ring and a shockwave of tan dust and stone chips spreads outward along the ground, about twice as wide as tall; about 10 frames; fits in 96x48',
 'oil_splash': 'a small clay jar smashing on the ground: dark brown-black oil splashes outward with glossy highlights and a few orange clay shards; about 8 frames; fits in 48x32',
 'torch': 'a lit wooden torch tumbling end over end: a small orange and yellow flame on a short dark stick, flickering; seamless loop of about 6 frames; fits in 24x24',
 'debris': 'a large chunk of pale limestone crashing down: the rock lands, cracks and bursts into pale chunks and a big cloud of cream dust that settles; about 10 frames; fits in 64x64',
 'mud_churn': 'thick brown mud churning and splashing up from the ground in clumps, seen from a low top-down camera; about 8 frames; fits in 64x32',
 'drill_sparks': 'sparks and grit flying from a spinning steel drill bit grinding stone: bright yellow-white sparks and small grey chips spraying out to the left; seamless loop of about 6 frames; fits in 32x32',
 'exhaust': 'puffs of dark grey engine exhaust smoke rising from a short pipe and drifting up and right, fading; seamless loop of about 8 frames; fits in 24x40',
 'fire_punch': 'a burst of fire from a fist: a bright yellow-white flash that blooms into red-orange flame tongues pointing to the right, then breaks into embers; about 6 frames; fits in 48x48',
}
out = pl.HERE / 'assets' / 'vfx13'; out.mkdir(exist_ok=True)
for n in sys.argv[1:]:
    e, r = pl.run('/vfx', {'description': D[n] + TAIL, 'artist': 'lite', 'name': n}, 't13_vfx_' + n, estimate=3)
    lr = r['final'].get('last_response') or {}
    files = lr.get('files') or {}
    for fn, u in files.items():
        ext = fn.rsplit('.', 1)[1]
        if ext not in ('png', 'json'): continue
        with urllib.request.urlopen(u, timeout=120) as f: (out / f'{n}.{ext}').write_bytes(f.read())
    print(n, lr.get('frames'), lr.get('canvas'), lr.get('loop'), (lr.get('message') or '')[:100])
