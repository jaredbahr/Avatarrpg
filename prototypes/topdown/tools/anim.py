import json, sys, time
sys.path.insert(0, 'tools'); import pl
from sheet import sheet
def animate(name, cid, template, directions, mode='template', estimate=8, extra=None):
    body = {'character_id': cid, 'template_animation_id': template, 'mode': mode, 'directions': directions}
    body.update(extra or {})
    e, r = pl.run('/characters/animations', body, name, estimate=estimate)
    return e, r
def frames(name, cid, group_name=None):
    """Fetch the character and save each animation's frames per direction."""
    d = pl.req('GET', f'/characters/{cid}')
    json.dump(pl.strip(d), open(pl.RAW / name / 'character_after.json', 'w'), indent=1)
    return d
if __name__ == '__main__':
    name, cid, template, mode = sys.argv[1:5]; dirs = sys.argv[5].split(',')
    e, r = animate(name, cid, template, dirs, mode)
    print(json.dumps(pl.strip(r['final']))[:2500])
