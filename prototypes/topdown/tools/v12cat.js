// v12 item 6 check: walk the cat for a while; report every sample where it overlaps an object's sprite (opaque pixel in its 14x10 body box), stands on a
// solid, or off walkable ground. argv: url [x0,y,x1,y]  (overrides the route)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1248, height: 992 } });
  await p.goto(process.argv[2] + '?overview=1&zoom=1'); await p.waitForFunction(() => window.__ready);
  const route = process.argv[3] ? JSON.parse(process.argv[3]) : null;
  const res = await p.evaluate(route => {
    if (route) { catRoute[0] = route[0]; catRoute[1] = route[1]; cat.x = route[0][0]; cat.y = route[0][1]; cat.path = []; catLeg = 1; catSit = 0; }
    const hits = {}; let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    const A = {}; for (const o of OBJ) if (!o.flat) A[o.k] = A[o.k] || alphaOf(IMG['ob:' + o.k]);
    for (let t = 0; t < 120000; t += 33) {
      updateCat(33); n++; minx = Math.min(minx, cat.x); maxx = Math.max(maxx, cat.x); miny = Math.min(miny, cat.y); maxy = Math.max(maxy, cat.y);
      if (solidAt(cat.x, cat.y, 10, 4)) hits['solid'] = (hits['solid'] || 0) + 1;
      for (const o of OBJ) {
        if (o.flat) continue;
        let c = 0;
        for (let y = cat.y - 10; y < cat.y; y += 2) for (let x = cat.x - 7; x < cat.x + 7; x += 2) { const lx = Math.round(x - o.x), ly = Math.round(y - o.y); if (lx >= 0 && ly >= 0 && lx < o.w && ly < o.h && A[o.k][ly * o.w + lx]) c++; }
        if (c) { const k = o.k + '@' + o.x + ',' + o.base + (cat.y < o.base ? ' behind' : ' front'); hits[k] = (hits[k] || 0) + c; }
      }
    }
    return { n, box: [minx, miny, maxx, maxy].map(Math.round), hits };
  }, route);
  console.log(JSON.stringify(res)); await b.close();
})();
