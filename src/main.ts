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
import { validateContent } from './content/schemas';
import { App } from './app/App';
import { bakeReview } from './render/sheets/review';
import { fxCelsReady, celReady } from './render/fx/atlas';
import { FX_CELS } from './content/fxCels';

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
 * production this is a no-op that costs a millisecond.
 */
if (import.meta.env.DEV) {
  const problems = validateContent(CONTENT_BUNDLE);
  if (problems.length > 0) {
    console.error(`Content validation found ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
  }
}

const app = new App(CONTENT, root, STORY_ENTRY);
app.start();

// Handy from the browser console, and how the e2e suite drives setup quickly.
// `bakeReview` is for the gallery's figure page: every placeholder sheet as a picture.
declare global {
  interface Window {
    fnt?: { app: App; bakeReview?: typeof bakeReview; loadedFxCels: typeof loadedFxCels };
  }
}
window.fnt = { app, bakeReview, loadedFxCels };
