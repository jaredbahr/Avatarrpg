// every surface kind on one board per level, native pixels (overview mode): node tools/s13sheet.js page.html outprefix [reach]
const { chromium } = require('playwright'); const fs = require('fs');
const SET = {
  floor: { fire: [[3,3],[4,3],[3,4],[4,4]], water: [[6,3],[7,3],[6,4],[7,4]], ice: [[0,7],[1,7],[0,8],[1,8]], steam: [[3,7],[4,7],[3,8],[4,8]], mud: [[5,7],[6,7],[5,8],[6,8],[6,9]], oil: [[14,3],[15,3],[14,4]] },
  forest: { fire: [[4,6],[5,6],[4,7],[5,7]], water: [[8,3],[9,3],[8,4],[9,4]], ice: [[12,6],[13,6],[12,7],[13,7]], steam: [[2,4],[3,4],[2,5],[3,5]], mud: [[15,6],[16,6],[15,7],[16,7]], oil: [[6,3],[7,3],[6,4]] },
  gate: { fire: [[3,7],[4,7],[3,8],[4,8]], water: [[6,3],[7,3],[6,4]], ice: [[14,3],[15,3],[14,4],[15,4]], steam: [[2,4],[3,4],[2,5],[3,5]], mud: [[15,8],[16,8],[15,9],[16,9]], oil: [] },
};
(async () => {
  const [,, page, pre, reach] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 680 } });
  for (const level of Object.keys(SET)) {
    const errs = []; p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message));
    await p.goto(`file://${page}?overview=1&zoom=1&level=${level}`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    const u = await p.evaluate(([set, reach]) => {
      for (const [id, cs] of Object.entries(set)) for (const [x, y] of cs) { const c = cellOf(BOARD, x, y); if (c && !c.blocked) c.surface = { id, dur: 3, spread: 0 }; }
      surfDirty = true; render();
      if (reach) { const cells = new Set(); for (let y = 2; y < 9; y++) for (let x = 0; x < 8; x++) { const c = cellOf(BOARD, x, y); if (c && !c.blocked && c.elev === 0) cells.add(x + ',' + y); } previewKey = ''; bakePreview(cells, [242, 196, 120], 'x'); ctx.drawImage(PREVIEW, GX - cam.rx, GY - cam.ry); }
      return document.getElementById('c').toDataURL('image/png');
    }, [SET[level], !!reach]);
    fs.writeFileSync(`${pre}_${level}.png`, Buffer.from(u.split(',')[1], 'base64')); console.log(level, errs);
  }
  await b.close();
})();
