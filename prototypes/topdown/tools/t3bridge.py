"""ADR 0104 T3: Ba Dan's canal footbridge, redrawn straight on (the owner, 2026-11-06: "Bridge needs to be fixed. It's visually
off": the v12 bridge was an oblique 3/4 drawing, too narrow, and short of the north kerb). create-object-pro-flash with the oven
as the one angle reference, like every other object; at most three takes, each booked in ledger.json under t3_.
The size is measured from the baked plate: the channel with both kerbs is 42 px north to south (plate y 426-468 at the bridge),
so the bridge is 56 px long to seat a short abutment on each bank; it is 60 px wide (1.5 cells), as wide as the lane it carries.
Usage (from prototypes/topdown): python3 tools/t3bridge.py <seed> [low|high] [wide]"""
import sys
sys.path.insert(0, 'tools'); import pl
import t3art
W, H = 60, 56
# take 3 asks for a canvas wider than tall: on 64 x 64 both takes came back about 32 px wide
CW, CH = (80, 64) if len(sys.argv) > 3 else (64, 64)
DESC = ('straight top-down view, horizontal base, no perspective; a short wooden footbridge crossing a narrow stone canal from north to south; '
        'deck planks run east-west, across the walking direction; low wooden rails on the east and west sides; a squat stone abutment on each bank, '
        f'at the top and bottom ends; about {W} px wide and {H} px long, a broad bridge wider than it is long, fills the canvas edge to edge, no empty margin; '
        'no water, grass or ground drawn under it, transparent background, no shadow. ')


def take(seed, view):
    name = f't3_obj_bridge_{view}_{seed}' + ('_wide' if CW > CH else '')
    body = {'description': DESC + t3art.S['style_suffix'], 'view': f'{view} top-down', 'n_directions': 1,
            'image_size': {'width': CW, 'height': CH}, 'style_image': t3art.REF,
            'target_palette': {'colors': t3art.S['palette'], 'name': 'village'}, 'seed': seed}
    if t3art.t3_spent() + 8 > t3art.CAP + 30: raise SystemExit('T3 cap')
    e, r = pl.run('/create-object-pro-flash', body, name, estimate=8, notes='T3 bridge redraw (owner: visually off)')
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print('no image', list(lr.keys())[:10]); return
    out = pl.HERE / 'assets' / 'objects_t3' / 'raw'; out.mkdir(parents=True, exist_ok=True)
    ims[0].save(out / f"bridge_{view}_{seed}{'_wide' if CW > CH else ''}.png"); print(name, ims[0].size, 'credits', e['credits'], 'balance diff', e['balance_diff'])


if __name__ == '__main__':
    take(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else 'low')
