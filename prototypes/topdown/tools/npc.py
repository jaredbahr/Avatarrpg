import json, sys
sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
NPC = {
 'shopkeeper': 'elderly shopkeeper woman, slightly hunched, grey hair in a small bun, kind wrinkled face, cream long-sleeved tunic, olive green apron, long brown skirt, brown slippers',
 'villager': 'young village man, short black hair, slate blue sleeveless tunic over a cream shirt, rope belt, tan trousers, brown sandals',
}
if __name__ == '__main__':
  for k in (sys.argv[1:] or NPC):
    e, r = pl.run('/create-character-v3', {'description': NPC[k], 'image_size': {'width': 32, 'height': 32}, 'view': S['view'],
    'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11}, f'{k}_v3_32', estimate=3)
    print(k, r['final']['last_response']['character_id'])
