import json, sys
sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
from npc import NPC
NPC = dict(NPC, cat='small ginger tabby village cat with a white chest and a curled tail, walking on four legs')
for k in (sys.argv[1:] or ['shopkeeper', 'villager']):
    size = 32 if k == 'cat' else 48
    e, r = pl.run('/create-character-v3', {'description': NPC[k], 'image_size': {'width': size, 'height': size}, 'view': S['view'],
        'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'cat' if k == 'cat' else 'mannequin', 'seed': 11}, f'{k}_v3_{size}_v2', estimate=3)
    print(k, r['final']['last_response']['character_id'])
