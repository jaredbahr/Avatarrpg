"""Combat sound effects through PixelLab /sound-effects (owner, 2026-11-13: try Suno, then PixelLab).
Run from this folder:  python3 sfx_pl.py OUT_DIR key [key ...]   Every call is booked in ../ledger.json as t9_sfx_<key>.
"""
import subprocess, sys
sys.path.insert(0, '.')
import pl
from pathlib import Path

SFX = {
 'fire': ('a short punchy burst of flame thrown from a fist: quick ignition crackle then a roaring whoosh that cuts off', 1.0),
 'water': ('a rope of water whipped through the air, a wet lash then a splash on impact', 1.0),
 'earth': ('a slab of stone ripped out of the ground: a short gritty grind then a heavy solid thud', 1.2),
 'air': ('a sharp gust of wind pushed from open palms: a quick airy snap and rushing whoosh', 1.0),
 'lightning': ('a small crackling lightning bolt from fingertips: a bright electric snap and zap, not a sci-fi laser', 0.8),
 'rock': ('a fist-sized stone thrown hard, a short whoosh then a sharp crack against a target', 1.0),
 'sling': ('a leather sling whirling once and releasing, a small stone zipping away with a thin whistle', 1.0),
 'crossbow': ('a wooden crossbow firing: a crisp string twang and a bolt thwipping away through the air', 0.8),
}

def make(key, out):
    prompt, secs = SFX[key]
    e, r = pl.run('/sound-effects', {'prompt': prompt, 'seconds': secs, 'name': f'fnt-{key}'}, f't9_sfx_{key}', estimate=5)
    post = r.get('post') or {}
    sid = (post.get('sound_effect') or {}).get('id') or ((r.get('final') or {}).get('last_response') or {}).get('sound_generation_id')
    info = pl.req('GET', f'/sound-effects/{sid}', None)
    url = info.get('audio_url'); path = Path(out) / f'{key}.wav'
    subprocess.run(['curl', '-sSf', '-o', str(path), url], check=True)  # the file host refuses urllib's agent; print(key, info.get('duration_ms'), e.get('credits'), path)

if __name__ == '__main__':
    out = sys.argv[1]; Path(out).mkdir(parents=True, exist_ok=True)
    for k in sys.argv[2:]: make(k, out)
