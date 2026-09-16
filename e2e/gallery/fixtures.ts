import { test as base } from '@playwright/test';

/**
 * Per-project options for the gallery.
 *
 * `renderer` is which backend the page is asked for through `?renderer=`; the
 * projects in `playwright.gallery.config.ts` set it, and the beats read it to
 * build their URLs. A fixture option rather than an env var so one run can
 * capture both backends.
 */
export interface GalleryOptions {
  renderer: 'canvas' | 'webgl';
}

export const test = base.extend<GalleryOptions>({
  renderer: ['canvas', { option: true }],
});

export { expect } from '@playwright/test';
