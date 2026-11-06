"""v13 / tutorial pass: the new cast (create-character-v3, 48 px, 8 rotations, mannequin, seed 11: the forest cast's
settings), their clips, the old cast's four missing headings, and the per-ability poses. All skeleton-v3 posing.
Usage: python3 tools/t13chars.py create <key> | anim <key> <clip> | dl <key>"""
import sys, json, os, re; sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
IDS = 't13/ids.json'
ids = json.load(open(IDS)) if os.path.exists(IDS) else {}
ids.update({k: v for k, v in json.load(open('fc/ids.json')).items() if k not in ids})
ids.setdefault('kaya', json.load(open('assets/chars/kaya2/meta.json'))['id'])
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
NEW = {
 'deserter': (48, 'a Fire Nation army deserter, a lean hard-faced man in his forties, a short black topknot, a pale scar across one cheek, a faded dark red and black tunic with the sleeves torn off, a frayed maroon sash, dark grey trousers with wrapped shins, worn boots, a small clay oil jar hanging at his hip; tired and wary'),
 'qbender': (48, 'a quarry earthbender, a strong broad-shouldered woman in her thirties, tan skin, black hair tied back under a dusty olive headcloth, a sleeveless olive-green work tunic, a thick brown leather apron dusted with pale stone powder, brown wrapped forearms, baggy khaki trousers, heavy brown work boots; dusty and practical'),
 'merc': (48, 'a hired mercenary swordsman, a lean scarred man in his thirties, dark hair tied in a short tail, a charcoal-grey quilted jacket with a deep teal sash, one brown leather shoulder guard, a short curved sword in his right hand, dark trousers, tall dark boots; tidy and professional'),
 'xbow': (48, 'a hired mercenary crossbow woman, wiry, cropped dark hair, a charcoal-grey quilted jacket with a deep teal sash, a leather quiver of bolts at her right hip, holding a wooden crossbow across her body in both hands, dark trousers, tall dark boots; alert'),
 'ruon2': (48, 'a grizzled provincial guard captain in his fifties, short swept-back grey hair, a short grey stubble beard and moustache, tired weathered eyes, a long grey-brown wool trench coat with a high stand collar, brass buttons down the front, a squared shoulder epaulette and a faded patch, a brown leather strap crossing the chest from the shoulder, a curved sabre with a brass hand guard at his left hip, dark trousers, brown boots; dignified but weary'),
 'ruon': (48, 'a grizzled provincial guard captain in his fifties, short grey hair and a short grey beard, tired eyes, a dented olive-green and dull brass lamellar breastplate over a faded green tunic, a worn olive half-cloak, a curved sabre in a scabbard at his left hip, dark trousers, brown boots; dignified but weary'),
}
IDLE = 'standing at rest in a ready stance: the chest rises and falls slowly, a slight weight shift, arms relaxed; no effects'
ACT = {
 # the forest cast's original attack prompts (tools/fcanim.py), reused for their four new headings
 ('thug', 'attack'): 'swings the wooden club in a big overhead arc down in front of him, stepping into the blow, then recovers to stance',
 ('slinger', 'attack'): 'whirls the leather sling overhead once and snaps it forward, releasing a stone toward the front, then recovers to stance',
 ('bruiser', 'attack'): 'raises the heavy cudgel high with both hands and slams it down hard onto the ground in front of him, then straightens up',
 ('sura', 'attack'): 'a water-bending strike: sweeps both arms in one flowing circle and thrusts both open palms forward, then returns to a ready stance',
 ('bo', 'attack'): 'an earth-bending strike: lifts the left knee high, stamps the foot down hard, then punches forward with the left fist, then returns to stance',
 # one pose per ability (no effects drawn: the effects are /vfx)
 ('sura', 'ice'): 'an ice-bending sweep: bends low and sweeps the right arm along the ground in front of her, palm down, from one side to the other, then rises back to a ready stance; no effects',
 ('sura', 'heal'): 'a healing gesture: brings both hands together at the chest, then raises them slowly forward and up with the palms open and upward, calm and gentle, then lowers them to a ready stance; no effects',
 ('bo', 'wall'): 'an earth-bending wall raise: drops into a wide low horse stance and drives both fists down, then sweeps both forearms sharply upward in front of him, then returns to stance; no effects',
 ('bo', 'stance'): 'a defensive stance: plants both feet wide, sinks his weight and crosses both forearms in front of his chest, bracing firmly, holds, then relaxes to stance; no effects',
 ('kaya', 'blast'): 'a fire-bending blast: draws both fists back to her right hip, then thrusts both open palms forward together in one powerful push, leaning into it with a step, then recovers to a ready stance; no effects',
 ('deserter', 'attack'): 'a fire-bending punch: draws the right fist back to the hip, then drives it straight forward hard with a step, then returns to stance; no effects',
 ('deserter', 'throw'): 'throws a small jar underarm toward the front with the right hand, following through, then recovers to stance; no effects',
 ('qbender', 'attack'): 'an earth-bending throw: crouches and scoops both hands up from the ground, lifts them overhead, then hurls forward with both arms, then returns to stance; no effects',
 # fixes pass (2026-11-05): element words ("fire-bending", "earth-bending") made PixelLab paint flames and rocks INTO the frames, "no effects" or not.
 # These retakes describe pure body motion and say what is not in the hands.
 ('kaya', 'blast2'): 'a martial-arts double palm strike: draws both fists back to her right hip, then thrusts both open palms forward together in one powerful push, leaning into it with a step, then recovers to a ready stance. Pure body motion: her hands are plain and empty, no flames, no glow, no light, no particles',
 ('kaya', 'jab2'): 'a martial-arts punch: draws the right fist back to the hip, then drives it straight forward hard with a step, then recovers to a ready stance. Pure body motion: her fist is a plain fist, no flames, no glow, no light, no particles',
 ('kaya', 'stomp2'): 'a martial-arts ground stomp: shifts her weight, raises one knee high, stamps that foot down hard into a wide low stance with both fists sinking to her sides, then rises back to a ready stance. Pure body motion: nothing around her feet or hands, no flames, no glow, no light, no particles',
 ('deserter', 'punch2'): 'a martial-arts punch: draws the right fist back to the hip, then drives it straight forward hard with a step, then returns to stance. Pure body motion: a plain fist, no flames, no glow, no light, no particles',
 ('qbender', 'throw2'): 'a heavy two-handed throw: crouches low, scoops both empty hands up from knee height, lifts them overhead, then hurls both arms forward with a step, then returns to stance. Pure body motion: her hands are empty, nothing is held or thrown, no rocks, no dirt, no dust, no particles; her olive headcloth stays tied on her head the same in every frame',
 ('ruon2', 'attack'): 'a disciplined sabre cut: draws the sabre and steps forward with one diagonal cut across the front, then returns to a guard stance',
 ('merc', 'attack'): 'a quick low sword slash: steps forward and cuts the short sword in a low fast arc across the front, then recovers to a guard stance',
 ('xbow', 'attack'): 'raises the crossbow to the shoulder and aims to the front, the crossbow kicks back as it shoots, then lowers it to a ready stance',
 ('ruon', 'attack'): 'a disciplined sabre cut: draws the sabre and steps forward with one diagonal cut across the front, then returns to a guard stance',
}
def save(): json.dump(ids, open(IDS, 'w'), indent=1)
def create(k):
    size, desc = NEW[k]
    e, r = pl.run('/create-character-v3', {'description': desc, 'image_size': {'width': size, 'height': size}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11, 'name': f'Tutorial {k}'}, f't13_char_{k}', estimate=3)
    ids[k] = r['final']['last_response']['character_id']; save(); print(k, ids[k])
def anim(k, clip, dirs=None):
    cid = ids[k]; dirs = dirs or D8; name = f't13_{k}_{clip}'
    if clip == 'walk':
        body = {'character_id': cid, 'template_animation_id': 'walking-8-frames', 'mode': 'skeleton-v3', 'directions': dirs}
    else:
        act = IDLE if clip == 'idle' else ACT[(k, clip)]
        body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': act, 'frame_count': int(os.environ.get('FC') or (8 if clip == 'idle' else 10)), 'directions': dirs}
    grp = existing_group(k, clip)
    if grp: body['animation_group_id'] = grp
    e, r = pl.run('/characters/animations', body, name, estimate=3 * len(dirs) + 1)
    got = r['post'].get('directions') or dirs; rest = [d for d in dirs if d not in got]
    if rest:
        body = dict(body, directions=rest, animation_group_id=r['post']['animation_group_id'])
        pl.run('/characters/animations', body, name + '_rest', estimate=3 * len(rest) + 1)
    print(k, clip, 'asked', len(dirs), 'first job', len(got), 'rest', len(rest))
def existing_group(k, clip):
    """The forest cast's four-heading clips get their missing headings in the SAME animation group."""
    if k not in ('thug', 'slinger', 'bruiser', 'sura', 'bo') or clip not in ('idle', 'walk', 'attack'): return None
    m = json.load(open(f'assets/chars/fc_{k}/meta.json'))
    pre = {'idle': 'custom-standing at rest', 'walk': 'walking-8-frames', 'attack': 'custom-'}[clip]
    keys = [x for x in m['anims'] if x.startswith(pre) and (clip != 'attack' or not x.startswith('custom-standing'))]
    d = pl.req('GET', f'/characters/{ids[k]}')
    for a in d.get('animations') or []:
        if a['animation_type'] + '@' + a['animation_group_id'][:6] == keys[0]: return a['animation_group_id']
    return None
SAFE = re.compile(r'[^A-Za-z0-9._-]+')
def dl(k, folder=None):
    """Merge-download: new animation groups and new headings are added; frames already on disk are never rewritten."""
    folder = folder or ('kaya2' if k == 'kaya' else f'fc_{k}' if k in ('thug', 'slinger', 'bruiser', 'sura', 'bo') else f't13_{k}')
    out = pl.HERE / 'assets' / 'chars' / folder; out.mkdir(parents=True, exist_ok=True)
    mp = out / 'meta.json'; meta = json.load(open(mp)) if mp.exists() else {'id': ids[k], 'size': None, 'rot': {}, 'anims': {}}
    d = pl.req('GET', f'/characters/{ids[k]}'); meta['size'] = d['size']; added = 0
    for kk, u in d['rotation_urls'].items():
        if kk not in meta['rot']: pl.fetch(u).save(out / f'rot_{kk}.png'); meta['rot'][kk] = f'rot_{kk}.png'
    for a in d.get('animations') or []:
        t = a['animation_type'] + '@' + a['animation_group_id'][:6]
        for dd in a['directions']:
            if dd['direction'] in meta['anims'].get(t, {}): continue
            fs = []
            for i, u in enumerate(dd['frames']):
                f = SAFE.sub('_', f'{t}_{dd["direction"]}_{i}.png'); pl.fetch(u).save(out / f); fs.append(f)
            meta['anims'].setdefault(t, {})[dd['direction']] = fs; added += 1
    json.dump(meta, open(mp, 'w'), indent=1); print(k, folder, 'added', added, 'headings;', {t: len(v) for t, v in meta['anims'].items()})
if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'create': create(sys.argv[2])
    elif cmd == 'anim': anim(sys.argv[2], sys.argv[3], sys.argv[4].split(',') if len(sys.argv) > 4 else None)
    elif cmd == 'dl': dl(sys.argv[2])
