/**
 * Entry point.
 *
 * Wires the content bundle to the app and starts it. Deliberately thin: if
 * something here is more than a few lines, it belongs in `src/app`.
 */

import './styles/fonts.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/interludes.css';
import './styles/a11y.css';

import { CONTENT, CONTENT_BUNDLE, STORY_ENTRY } from './content';
import { App } from './app/App';
import { bakeReview } from './render/sheets/review';
import { liftCost } from './render/geometry/lift';
import { fxCelsReady, celReady } from './render/fx/atlas';
import { FX_CELS } from './content/fxCels';
import { useTopDownStyle, useWorldStyleTest } from './content/assets/manifest';
import { loadTopDownPresentations, withTopDownMaps } from './content/topdown';
import { loadTopdownVfx } from './content/assets/topdownVfx';
import { assetUrl } from './render/spriteCache';
import type { ContentIndex } from './core/types';

/** Gallery checks await decoded pixels, not just successful HTTP requests. */
async function loadedFxCels() {
  await fxCelsReady();
  return FX_CELS.filter(celReady);
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app mount point in index.html');

/*
 * Content is validated in CI, but a dev build can be run with a half-finished
 * ability. Failing loudly here beats a blank screen ten minutes later — and in
 * production the validation module is omitted entirely.
 */
if (import.meta.env.DEV) {
  void import('./content/schemas').then(({ validateContent }) => {
    const problems = validateContent(CONTENT_BUNDLE);
    if (problems.length > 0) {
      console.error(`Content validation found ${problems.length} problem(s):`);
      for (const problem of problems) console.error(`  - ${problem}`);
    }
  });
}

// `?style=world`: the world-style figure test (art/source/style-test-world-chars), never the default.
// `?style=topdown`: the top-down port (ADR 0104): its sheets, and its maps for those it has drawn.
const style = new URLSearchParams(window.location.search).get('style');
if (style === 'world') useWorldStyleTest();
if (style === 'topdown') useTopDownStyle();
if (style === 'topdown') void loadTopdownVfx(style, import.meta.env.BASE_URL);

function boot(content: ContentIndex): void {
  if (!root) return;
  const app = new App(content, root, STORY_ENTRY);
  app.start();
  window.fnt = { app, bakeReview, loadedFxCels, liftCost };
}

if (style === 'topdown') {
  // The top-down scenes are assets (ADR 0104), fetched before the app boots; without them the
  // maps keep their oblique look.
  loadTopDownPresentations(async (url) => {
    const response = await fetch(assetUrl(url));
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return (await response.json()) as unknown;
  })
    .then(
      (presentations) => withTopDownMaps(CONTENT, presentations),
      (error: unknown) => {
        console.error('The top-down scenes did not load; drawing the oblique maps.', error);
        return CONTENT;
      },
    )
    .then(boot);
} else boot(CONTENT);

// Handy from the browser console, and how the e2e suite drives setup quickly.
// `bakeReview` is for the gallery's figure page: every placeholder sheet as a picture.
declare global {
  interface Window {
    fnt?: {
      app: App;
      bakeReview?: typeof bakeReview;
      loadedFxCels: typeof loadedFxCels;
      liftCost: typeof liftCost;
    };
  }
}
