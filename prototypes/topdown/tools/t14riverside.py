"""The riverside's tea break and wave for Kaya and Sura (owner, 2026-11-13): the poses the oblique G1 sheets carried
(`tea`: seated, sipping; `wave`: a friendly wave) redrawn on the top-down characters, posed by skeleton-v3 from the
character's own base (the T2 method of `t2clips.py`), in the headings the riverside draws. Every job is booked in
ledger.json by pl.run under the `t14_` prefix.
Per art-lessons.md: pure body motion, no element words, and say what the hands hold.
Usage (from prototypes/topdown): python3 tools/t14riverside.py anim <who> <tea|wave> <dir,dir> | dl <who> | spent"""
import json, sys
sys.path.insert(0, 'tools'); import pl
from t2clips import FOLDER, dl

CAP = 80.0   # this task's PixelLab budget
NOFX = 'nothing flies off, no particles, no steam, no glow, no light, no marks, the same clothes'
CLIPS = {
    'tea': (6, 'seated tea: she sits cross-legged on the ground and stays seated the whole time, holding a small round '
               'clay tea cup in both hands in her lap; calmly lifts the cup to her lips, takes a small sip, and lowers it '
               'back to her lap. Gentle and slow. Pure body motion; ' + NOFX),
    # Kaya's first tea lost her hair ribbon and recoloured the cup on the sip; the retake keeps her seated from the start.
    'tea2': (6, 'seated tea: she is already sitting cross-legged on the ground at the start and stays seated, holding a '
                'small round clay tea cup in both hands at her chest; she slowly raises the cup to her lips, sips, and '
                'lowers it again. Only the arms and head move; the hair, ribbon and clothes stay the same. Pure body '
                'motion; ' + NOFX),
    'wave': (6, 'a friendly wave: standing in place with the feet planted, she raises one open hand beside her head, '
                'palm out, and waves it gently side to side, then lowers it to her side. The other arm stays relaxed. '
                'Pure body motion: her hands are plain and empty; ' + NOFX),
    # The first wave kept the hand at the chin; the second asks for the arm up high, clear of the face.
    'wave2': (6, 'a big friendly hello wave: standing in place with the feet planted, she lifts one arm high up beside '
                 'her head, the elbow bent and the open hand raised well above her head, palm forward, and swings the '
                 'raised hand left and right twice, smiling. The other arm hangs relaxed at her side. Pure body motion: '
                 'her hands are plain and empty; ' + NOFX),
}


def spent():
    return sum((j.get('credits') or 0) for j in pl.ledger()['jobs'] if j['name'].startswith('t14_'))


def anim(who, clip, dirs, take=''):
    frames, act = CLIPS[clip]
    cid = json.load(open(f'assets/chars/{FOLDER[who]}/meta.json'))['id']
    est = 3 * len(dirs) + 1
    if spent() + est > CAP: raise SystemExit(f'cap: {spent()} spent, {est} more would pass {CAP}')
    body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': act, 'frame_count': frames,
            'directions': dirs}
    pl.run('/characters/animations', body, f't14_{who}_{clip}{take}', estimate=est)
    print(who, clip, 'spent', spent())


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'anim': anim(sys.argv[2], sys.argv[3], sys.argv[4].split(','), sys.argv[5] if len(sys.argv) > 5 else '')
    elif cmd == 'dl': dl(sys.argv[2])
    elif cmd == 'spent': print('t14 usage', spent())
