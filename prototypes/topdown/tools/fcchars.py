"""Forest combat cast: create-character-v3 with Kaya's v7 settings (48 px, 8 rotations, mannequin template)."""
import sys, json; sys.path.insert(0, 'tools'); import pl
S = json.load(open('style.json'))
R = {
 'thug': (48, 'a road bandit thug, a lean rough man in his thirties, stubbled scowling face, a ragged rust-red headscarf, a torn dusty brown sleeveless jerkin over a faded rust tunic, one leather bracer, patched brown trousers, worn wrapped boots, holding a thick wooden club in his right hand; ragged and asymmetric'),
 'slinger': (48, 'a road bandit slinger, a wiry young woman, a dusty rust-red hood and a cloth mask over her lower face, a short patched tan coat with a pouch of stones at her belt, leather sling in her right hand, dark trousers, wrapped boots; ragged and asymmetric'),
 'bruiser': (56, 'a road bandit bruiser, a huge heavy-set man, broad shoulders and a big belly, shaved head and a thick dark beard, a battered rust-brown leather vest over bare thick arms, a heavy iron-banded wooden cudgel in both hands, a wide belt, baggy dusty trousers, heavy boots; ragged and asymmetric'),
 'sura': (48, 'Sura, a young woman, slim, deep brown skin, dark brown-black hair in one long thick braid tied with a small blue bead hanging over her right shoulder, muted slate-blue knee-length wrap tunic with cream trim and cream fur elbow cuffs over dark navy under-sleeves, wide brown belt with a round clasp, pale grey-blue front skirt panel with a white spiral, loose dark navy trousers, dark brown boots with cream fur tops'),
 'bo': (48, 'Bo, a young man, clean-shaven, stocky and broad-shouldered, tan skin, short tousled black hair, moss-green sleeveless long tunic over mustard elbow sleeves, brown forearm wraps and a wide sash with a bronze ring, cream trousers, brown wrapped boots'),
}
k = sys.argv[1]; size, desc = R[k]
e, r = pl.run('/create-character-v3', {'description': desc, 'image_size': {'width': size, 'height': size}, 'view': S['view'],
    'outline': S['character_outline'], 'detail': S['detail'], 'template_id': 'mannequin', 'seed': 11, 'name': f'Forest combat {k}'}, f'fc_char_{k}', estimate=3)
cid = r['final']['last_response']['character_id']; ids = json.load(open('fc/ids.json')) if __import__('os').path.exists('fc/ids.json') else {}
print(k, cid)
