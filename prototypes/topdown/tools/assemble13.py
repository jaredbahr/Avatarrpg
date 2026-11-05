"""Assemble src/game13.js from game7's shared engine sections and the v8 modules in src/v13/."""
g = open('src/game7.js').read().split('\n')
def idx(prefix, start=0):
    for i in range(start, len(g)):
        if g[i].startswith(prefix): return i
    raise SystemExit('missing ' + prefix)
head = '\n'.join(g[0:idx('// ---------- Ba Dan, top-down.')])
head = head.replace("const T = 32, MW = 32, MH = 22, PW = MW * T, PH = MH * T;", "const T = 32, MW = 39, MH = 31, PW = MW * T, PH = MH * T;   // the village's ground mass plus three tiles of void around it")
head = head.replace("// Ba Dan, top-down (v7): the whole village in the v2 style.", "// Ba Dan, top-down (v8): the village as a diorama, grounded by Imagination's art-direction rules (one shadow, plinths, sunk bases).\n// v7: the whole village in the v2 style.")
head += "\nloads.push(load('cliff', ASSETS.cliff.src));\n"
actors = '\n'.join(g[idx('// ---------- actors'):idx('// ---------- the people of Ba Dan')])
p0 = idx('// ---------- pathing'); p1 = next(i for i in range(p0, len(g)) if g[i].startswith('// a free spot beside') or g[i].startswith('// ---------- talk'))
pathin = '\n'.join(g[p0:p1])
# a path that grazes a solid's corner can pin Kaya in place: after a quarter second without progress she re-plans from where she stands
old_f = "    const sp = last ? Math.min(this.speed, 18 + d * 3.2) : this.speed;"
new_f = """    if (this === kaya) {
      if (Math.abs(this.x - (this.px0 ?? 0)) + Math.abs(this.y - (this.py0 ?? 0)) > 0.4) { this.px0 = this.x; this.py0 = this.y; this.stall = 0; }
      else if ((this.stall = (this.stall || 0) + dt) > 250) {
        this.stall = 0; const goal = this.path[this.path.length - 1], cx = Math.floor(this.x / NG), cy = Math.floor(this.y / NG);
        let best = null, bd = 1e9; for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (navFree(x, y)) { const q = Math.hypot(x * NG + 8 - this.x, y * NG + 11 - this.y); if (q < bd) { bd = q; best = [x * NG + 8, y * NG + 11]; } }
        const rest = astar(best ? best[0] : this.x, best ? best[1] : this.y, goal[0], goal[1]) || [];
        this.path = best ? [best, ...rest] : rest; return this.drive(0, 0, dt);
      }
    }
""" + old_f
assert old_f in actors; actors = actors.replace(old_f, new_f)
# the path grid keeps a little clearance, so a route never threads a corner that the per-axis collision then refuses
old_n = "!solidAt(cx * NG + 8, cy * NG + 11, FOOT_W + 2, FOOT_H + 2)"
assert old_n in pathin; pathin = pathin.replace(old_n, "!solidAt(cx * NG + 8, cy * NG + 13, FOOT_W + 6, FOOT_H + 8)")
m0, c0, d0, f0 = idx('// ---------- bending moves'), idx('// ---------- view and camera'), idx('// ---------- drawing'), idx('// a 3x5 pixel font')
moves, camera, drawing = '\n'.join(g[m0:c0]), '\n'.join(g[c0:d0]), '\n'.join(g[d0:f0])
old = "  if (ch.idle) return drawClip(a, 'idle', Math.floor((clock + (a.phase || 0)) / 130), a.heading);"
new = """  // the idle breathes slowly and barely: only the frames within 1 px of the rest pose, ping-ponged at ~4 s a breath
  if (ch.idle) { const calm = (ch.idle.calm || {})[a.heading] || [0]; const n = calm.length, k = Math.floor((clock + (a.phase || 0)) / 420) % (2 * n - 2 || 1); return drawClip(a, 'idle', calm[k < n ? k : 2 * n - 2 - k], a.heading); }"""
assert old in drawing; drawing = drawing.replace(old, new)
v = lambda f: open('src/v13/' + f).read()
# v13: the tutorial shell runs this page inside an iframe (srcdoc, no query string): window.AREA carries its mode and record flag
head = head.replace("const REC = Q.get('record') === '1';", "const AREA = window.AREA || null;\nconst REC = AREA ? !!AREA.rec : Q.get('record') === '1';")
assert 'const AREA' in head
js = '\n'.join([head, v('shadow.js'), v('geo.js'), v('objects.js'), v('ground.js'), actors, v('residents.js'), pathin, v('talk.js'), moves, camera, drawing, v('render.js'), v('tutorial.js')])
open('src/game13.js', 'w').write(js); print('game13.js', len(js.split('\n')), 'lines')
