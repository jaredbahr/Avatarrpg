import { describe, expect, it } from 'vitest';
import { precachePaths } from './precache-manifest';

const worker = new URL('https://example.test/demo/sw.js');

describe('the emitted precache manifest', () => {
  it('uses only the Workbox call and resolves revisioned URLs against the worker', () => {
    const source = `
      const text = "wb.precacheAndRoute([])";
      /* wb.precacheAndRoute([{url: "ignored"}]); */
      wb.precacheAndRoute([
        {url: "index.html", revision: "a"},
        {"url": "art/space%20here.png?variant=1#top", "revision": null},
        "/demo/assets/entry.js",
      ], {});
    `;
    expect([...precachePaths(source, worker)]).toEqual([
      '/demo/index.html',
      '/demo/art/space%20here.png',
      '/demo/assets/entry.js',
    ]);
  });

  it.each([
    'const x = []; wb.precacheAndRoute(x);',
    'wb.precacheAndRoute([]);',
    'wb.precacheAndRoute([{ revision: "a" }]);',
    'wb.precacheAndRoute([{ url: location.href }]);',
    'wb.precacheAndRoute(["https://other.test/image.png"]);',
    'wb.precacheAndRoute(["a"]); wb.precacheAndRoute(["b"]);',
    'const text = "wb.precacheAndRoute([])";',
  ])('fails closed for %s', (source) => {
    expect(() => precachePaths(source, worker)).toThrow(/precache/i);
  });
});
