import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { enterNode, resetStorage, startGame } from './helpers';

// Focused exploration segment of #491. Fixture APIs skip separately owned
// setup and opening-mount gates; actions under test use real keyboard input.
async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await expect(target).toBeInViewport();
  const ring = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(':focus-visible'),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      color: style.outlineColor,
    };
  });
  expect(ring.visible).toBe(true);
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThan(0);
  expect(ring.color).not.toMatch(/^(transparent|rgba\([^)]*, 0\))$/);
}
async function tabTo(page: Page, target: Locator) {
  await expect(target).toHaveCount(1);
  for (let i = 0; i < 40; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await visibleFocus(target);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${await target.textContent()}`);
}
async function activate(page: Page, target: Locator) {
  await tabTo(page, target);
  await page.keyboard.press('Enter');
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const next = (page: Page) => page.locator('[data-conversation-control="next"]');
async function fixture(page: Page, explore = true) {
  const backend = test.info().project.name.includes('webgl') ? 'webgl' : 'canvas';
  await resetStorage(page, `?renderer=${backend}`);
  await startGame(page, ['Jared', 'Morgan'], ['kaya', 'nilak'], 'exploration-focus-491', {
    reduceMotion: false,
  });
  if (explore) {
    await enterNode(page, 'village_explore');
    expect(await page.evaluate(() => window.fnt?.app.rendererBackend())).toBe(backend);
  }
}
async function idle(page: Page) {
  await page.waitForFunction(() => {
    const app = window.fnt?.app;
    return app?.state?.screen === 'explore' && !app.animator.busy(performance.now());
  });
}
async function talkToMira(page: Page) {
  await activate(page, button(page, 'Map'));
  await activate(page, button(page, 'Walk to Elder Mira'));
  await page.waitForFunction(() => window.fnt?.app.state?.story.nodeId === 'mira_intro');
}

test('final opening Continue places visible focus on the exploration HUD', async ({
  page,
}, info) => {
  await fixture(page, false);
  // Opening mount focus is pending its DialogueScene owner handoff. Once on
  // its actual Next, assert transitions before any recovery Tab can mask loss.
  await activate(page, page.locator('[data-interlude-control="next"]'));
  await visibleFocus(page.locator('[data-interlude-control="next"]'));
  await page.keyboard.press('Enter');
  await visibleFocus(page.locator('[data-interlude-control="next"]'));
  await page.keyboard.press('Enter');
  await idle(page);
  await visibleFocus(button(page, 'Map'));
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('village_explore');
  await expect(page.locator('.explore-scene .map-canvas')).toBeVisible();
  await page.screenshot({ path: info.outputPath('opening-to-exploration.png') });
});

test('keyboard Map walk, Mira conversation and return retain visible world focus', async ({
  page,
}, info) => {
  await fixture(page);
  await talkToMira(page);
  await visibleFocus(next(page));
  expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({ x: 10, y: 5 });
  for (let line = 1; line < 4; line++) {
    await page.keyboard.press('Enter');
    await visibleFocus(next(page));
  }
  await page.keyboard.press('Enter');
  await idle(page);
  await visibleFocus(page.locator('.explore-hud .action-button:not([disabled])').first());
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe('village_explore');
  await page.screenshot({ path: info.outputPath('conversation-return-focus.png') });
});

test('settings retains its own focus while the underlying conversation syncs', async ({
  page,
}, info) => {
  await fixture(page);
  await talkToMira(page);
  await activate(page, button(page, 'Pause'));
  await activate(page, button(page, 'Settings'));
  await activate(page, page.getByRole('radio', { name: 'Large', exact: true }));
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await visibleFocus(settings.getByRole('heading', { name: 'Settings', exact: true }));
  expect(await page.evaluate(() => window.fnt?.app.settings.largeText)).toBe('on');
  await page.screenshot({ path: info.outputPath('settings-keeps-focus.png') });
});

test('movement completion retains focused Map after replacing the HUD', async ({ page }, info) => {
  await fixture(page);
  // Only skip the already-covered conversation in fixture setup. The seat
  // route, normal animation and movement-completion HUD rebuild remain real.
  await enterNode(page, 'mira_intro');
  await enterNode(page, 'village_explore');
  await activate(page, button(page, 'Look around'));
  // Observe both facts in the same browser task: slow software-WebGL command
  // round trips must not turn an already completed walk into a false failure.
  // This observer never changes game state, focus, animation or input.
  const witness = await page.evaluateHandle(() => {
    const samples: { moving: boolean; mapFocused: boolean }[] = [];
    const record = () =>
      samples.push({
        moving: Boolean(window.fnt?.app.animator.busy(performance.now())),
        mapFocused:
          document.activeElement ===
          document.querySelector('.explore-hud button[title="Local map and routes"]'),
      });
    const observer = new MutationObserver(record);
    const hud = document.querySelector('.explore-hud');
    if (!hud) throw new Error('Missing exploration HUD');
    observer.observe(hud, { childList: true, subtree: true });
    document.addEventListener('focusin', record);
    return {
      samples,
      stop: () => {
        observer.disconnect();
        document.removeEventListener('focusin', record);
      },
    };
  });
  await activate(page, page.getByRole('button', { name: /Sit and wait/ }));
  // Closing Look around restores its action; Map is its preceding control.
  await page.keyboard.press('Shift+Tab');
  await tabTo(page, button(page, 'Map'));
  await idle(page);
  await visibleFocus(button(page, 'Map'));
  const samples = await witness.evaluate((value) => {
    value.stop();
    return value.samples;
  });
  await info.attach('movement-focus-samples', {
    body: JSON.stringify(samples),
    contentType: 'application/json',
  });
  expect(samples).toContainEqual({ moving: true, mapFocused: true });
  expect(samples).toContainEqual({ moving: false, mapFocused: true });
  await witness.dispose();
  expect(await page.evaluate(() => window.fnt?.app.state?.location.pos)).toEqual({ x: 10, y: 5 });
  await page.screenshot({ path: info.outputPath('movement-hud-focus.png') });
});

test('retained exploration resumes after a staged conversation without stealing layer focus', async ({
  page,
}, info) => {
  await fixture(page);
  await enterNode(page, 'forest_explore');
  // This ordinary dialogue retains the live world; illustrated road_depart
  // deliberately does not. Fixture preparation does not claim title-flow play.
  await enterNode(page, 'defeat_forest');
  const stagedNext = page.locator('.dialogue-layer [data-conversation-control="next"]');
  await expect(page.locator('.explore-scene')).toHaveAttribute('inert', '');
  await tabTo(page, stagedNext);
  for (let line = 0; line < 3; line++) {
    await visibleFocus(stagedNext);
    await page.keyboard.press('Enter');
  }
  // The retained scene resumes into after_forest's world conversation.
  const worldNext = page.locator('.explore-conversation [data-conversation-control="next"]');
  await visibleFocus(worldNext);
  await expect(page.locator('.dialogue-layer')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await visibleFocus(worldNext);
  await page.keyboard.press('Enter');
  await idle(page);
  await visibleFocus(page.locator('.explore-hud .action-button:not([disabled])').first());
  expect(await page.evaluate(() => window.fnt?.app.state?.story.nodeId)).toBe(
    'forest_after_explore',
  );
  await page.screenshot({ path: info.outputPath('retained-world-resume-focus.png') });
});
