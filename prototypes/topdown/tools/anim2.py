import json, sys
sys.path.insert(0, 'tools'); import pl
WALK = ('a relaxed natural walking cycle: the body rises and falls with each step, weight shifts from foot to foot, '
        'arms swing gently forward and back opposite the legs and stay close to the body, the coat hem and ponytail sway and trail with the motion')
def custom(name, cid, action, dirs, frames, group=None, estimate=None):
    body = {'character_id': cid, 'mode': 'skeleton-v3', 'action_description': action, 'frame_count': frames, 'directions': dirs}
    if group: body['animation_group_id'] = group
    return pl.run('/characters/animations', body, name, estimate=estimate or 4 * len(dirs))
if __name__ == '__main__':
    e, r = custom(sys.argv[1], sys.argv[2], WALK if sys.argv[3] == 'WALK' else sys.argv[3], sys.argv[4].split(','), int(sys.argv[5]))
    print(json.dumps(pl.strip(r['post']))[:600])
