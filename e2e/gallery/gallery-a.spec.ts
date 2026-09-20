// Slice A of the gallery. The beats are dealt into three files round robin
// because Playwright shards by file and one runner can no longer carry all
// 340 cases; see `suite.ts` and the gallery jobs in `.github/workflows/ci.yml`.
import { test } from './fixtures';
import { beatsInSlice, runGalleryBeat } from './suite';

for (const beat of beatsInSlice(0)) {
  test(`${beat.id} ${beat.title}`, async ({ page, renderer }, testInfo) => {
    await runGalleryBeat(beat, page, renderer, testInfo);
  });
}
