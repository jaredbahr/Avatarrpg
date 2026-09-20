// Slice C of the gallery. See `gallery-a.spec.ts` and `suite.ts`.
import { test } from './fixtures';
import { beatsInSlice, runGalleryBeat } from './suite';

for (const beat of beatsInSlice(2)) {
  test(`${beat.id} ${beat.title}`, async ({ page, renderer }, testInfo) => {
    await runGalleryBeat(beat, page, renderer, testInfo);
  });
}
