import sys, json; sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
R = {
 'mira':  (48, 'Elder Mira, an elderly woman in her seventies, weathered brown skin and a lined stern face, white hair in a tight bun, a large green shawl with ochre-yellow stripes over her shoulders, long dark brown tunic, simple dark trousers, flat brown shoes, a gentle stoop'),
 'gao':   (48, 'Gao, a round olive-skinned merchant in his fifties, broad waist and sturdy short legs, short grey-flecked dark beard, brown soft flat cap, green tunic with rolled sleeves under a long cream apron, charcoal trousers, brown cloth shoes, friendly face'),
 'pella': (36, 'Pella, a small nine-year-old girl with natural child proportions, messy dark brown pigtails, light-brown skin, gap-toothed grin, cream loose tunic with a patched green sash, calf-length brown trousers, simple flat shoes'),
 'dorin': (48, 'Dorin, a lanky tall thin young man in his late twenties, long face, large ears, short tousled brown hair, wispy moustache, earnest expression, long green provincial guard coat with a brass clasp, dark trousers, brown boots, no helmet'),
 'hanru': (48, 'Hanru, a sturdy middle-aged village watchman, plain weathered face, practical soft brown cloth cap, knee-length muted olive-green padded coat with a plain leather belt, earth-brown trousers, brown wrapped boots, holding a plain wooden spear upright'),
 'household': (48, 'a practical rural village woman in her thirties, weathered friendly face, dark brown hair tied back in a low knot, muted moss-green work tunic with rolled sleeves, ochre linen apron, plain earth-brown trousers, worn brown shoes, a small woven basket at her hip'),
}
k = sys.argv[1]; size, desc = R[k]
e, r = pl.run('/create-character-v3', {'description': desc, 'image_size': {'width': size, 'height': size}, 'view': S['view'],
    'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11, 'name': f'BaDan v7 {k}'}, f'v7_char_{k}', estimate=3)
print(k, r['final']['last_response']['character_id'])
