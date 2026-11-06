// v12 item 7 check: for every tree and bush, how far inside the grass lip does its trunk root, and how many canopy pixels hang over the void?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1248, height: 992 } });
  await p.goto(process.argv[2] + '?overview=1&zoom=1'); await p.waitForFunction(() => window.__ready);
  const res = await p.evaluate(() => {
    const g = ground.getContext('2d').getImageData(0, 0, PW, PH).data, vm = new Uint8Array(PW * PH), q = [];
    const dark = i => Math.max(g[i * 4], g[i * 4 + 1], g[i * 4 + 2]) < 48;
    const cliff = i => { const r = g[i * 4], gg = g[i * 4 + 1], bb = g[i * 4 + 2]; return r > gg + 12 && r > bb + 25 && r < 150; };
    for (let i = 0; i < PW * PH; i++) { const x = i % PW, y = (i / PW) | 0; if ((x === 0 || y === 0 || x === PW - 1 || y === PH - 1) && dark(i)) { vm[i] = 1; q.push(i); } }
    const depth = new Uint8Array(PW * PH);
    while (q.length) { const i = q.shift(), x = i % PW, y = (i / PW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= PW || ny >= PH) continue; const j = ny * PW + nx; if (!vm[j] && (dark(j) ? true : cliff(j) && depth[i] < 40)) { vm[j] = 1; depth[j] = dark(j) ? 0 : depth[i] + 1; q.push(j); } } }
    window.__vm = vm; const out = [];
    for (const o of OBJ) {
      if (o.kind !== 'tree') continue;
      const A = alphaOf(IMG['ob:' + o.k]); let over = 0, tot = 0;
      for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (A[y * o.w + x]) { const X = o.x + x, Y = o.y + y; tot++; if (X < 0 || Y < 0 || X >= PW || Y >= PH || vm[Y * PW + X]) over++; }
      const cx = Math.round(o.x + o.w / 2); let d = 999;
      for (let r = 0; r < 120 && d === 999; r++) { for (let dy = -r; dy <= r && d === 999; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const X = cx + dx, Y = o.base + dy; if (X < 0 || Y < 0 || X >= PW || Y >= PH || vm[Y * PW + X]) { d = r; break; } } }
      out.push({ k: o.k, cx, base: o.base, trunkToVoid: d, canopyOver: over, canopyPct: +(over / tot * 100).toFixed(1), h: o.h });
    }
    return out;
  });
  if (process.argv[3]) { const data = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'); x.drawImage(ground, 0, 0); const id = x.getImageData(0, 0, PW, PH); for (let i = 0; i < PW * PH; i++) if (window.__vm[i]) { id.data[i * 4] = 255; id.data[i * 4 + 1] = 0; id.data[i * 4 + 2] = 255; } x.putImageData(id, 0, 0); return c.toDataURL(); }); require('fs').writeFileSync(process.argv[3], Buffer.from(data.split(',')[1], 'base64')); }
  for (const r of res.sort((a, b) => a.trunkToVoid - b.trunkToVoid)) console.log(JSON.stringify(r));
  await b.close();
})();
