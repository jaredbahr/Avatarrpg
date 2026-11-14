"""Captain Ruon's surrender (owner, 2026-11-14): his sabre laid on the ground at his feet, his hands open and raised a
little, standing, for `ruon_surrender` and the table's vote on him (`ruon_choice`). Posed by skeleton-v3 from his own
top-down base (the T2 method of `t2clips.py`) in the one heading the staging draws (south, toward the table). Every job
is booked in ledger.json by pl.run under the `t15_` prefix.
Per art-lessons.md: pure body motion, no element words, and say what the hands hold.
Usage (from prototypes/topdown): python3 tools/t15ruon.py anim <clip> <dir,dir> [take] | dl | spent"""
import json, sys
sys.path.insert(0, 'tools'); import pl
import t2clips
from t2clips import dl

t2clips.FOLDER['ruon'] = 't13_ruon'
CAP = 30.0   # this task's PixelLab budget (orchestrator, 2026-11-14)
NOFX = 'nothing flies off, no particles, no dust, no glow, no light, no marks, the same clothes'
CLIPS = {
    'surrender': (8, 'a calm surrender: standing in place with the feet planted, he draws the curved sabre from his left '
                     'hip, bends down and lays it flat on the ground just in front of his boots, lets go of it, then '
                     'straightens up and raises both open empty hands to chest height, palms forward, and holds them '
                     'there. The sabre stays lying on the ground. Pure body motion; ' + NOFX),
    # The first take's hands stopped at the belt; the second asks for them up beside the shoulders, clear of the coat.
    'surrender2': (8, 'a calm surrender: standing in place with the feet planted, he draws the curved sabre from his '
                      'left hip, bends down and lays it flat on the ground just in front of his boots, lets go of it, '
                      'then straightens up and lifts both open empty hands up beside his shoulders, elbows bent, palms '
                      'facing forward, and holds them there, still. The sabre stays lying on the ground. Pure body '
                      'motion; ' + NOFX),
}


def spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t15_'))


def anim(clip, dirs, take=''):
    frames, act = CLIPS[clip]
    cid = json.load(open('assets/chars/t13_ruon/meta.json'))['id']
    est = 3 * len(dirs) + 1
    if spent() + est > CAP: raise SystemExit(f'cap: {spent()} spent, {est} more would pass {CAP}')
    body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': act, 'frame_count': frames,
            'directions': dirs}
    pl.run('/characters/animations', body, f't15_ruon_{clip}{take}', estimate=est)
    print('ruon', clip, 'spent', spent())


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'anim': anim(sys.argv[2], sys.argv[3].split(','), sys.argv[4] if len(sys.argv) > 4 else '')
    elif cmd == 'dl': dl('ruon')
    elif cmd == 'spent': print('t15 usage', spent())
