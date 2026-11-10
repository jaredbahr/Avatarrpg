import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { CONTENT } from '../src/content';
import { apply } from '../src/core/state/reducer';
import { resolveDialogue } from '../src/core/story/storyEngine';
import { enterNode, resetStorage, setLargeText, startGame } from './helpers';

// This bounded #492 regression covers body/option text, not the separately
// owned speaker-name truncation (#378) or the complete all-screen audit.
const profiles = [
  { name: 'phone Large', viewport: { width: 390, height: 844 }, size: 'on' },
  { name: 'phone Largest', viewport: { width: 390, height: 844 }, size: 'huge' },
  { name: 'short Largest', viewport: { width: 844, height: 390 }, size: 'huge' },
  { name: 'tablet Large', viewport: { width: 834, height: 1194 }, size: 'on' },
] as const;
const nodes = ['pella_tips', 'ruon_surrender', 'ruon_choice', 'gate_parley'] as const;
const inventory = [...CONTENT.story.values()]
  .flatMap((node) => {
    if (node.kind === 'dialogue')
      return [
        ...node.lines.map((text, index) => ({
          node: node.id,
          index,
          length: text.length,
          variant: false,
        })),
        ...(node.variants ?? []).flatMap((variant) =>
          (variant.lines ?? []).map((text, index) => ({
            node: node.id,
            index,
            length: text.length,
            variant: true,
          })),
        ),
      ];
    return [];
  })
  .sort((a, b) => b.length - a.length);

async function sample(panel: Locator) {
  return panel.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const texts = [
      ...element.querySelectorAll<HTMLElement>(
        '.dialogue-line, .choice-option strong, .choice-option > span, :scope > p.tiny',
      ),
    ];
    const fragments = texts.flatMap((text, index) => {
      const range = document.createRange();
      range.selectNodeContents(text);
      return [...range.getClientRects()]
        .filter((r) => r.width > 0)
        .map((r, line) => {
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const option = text.closest('.choice-option');
          const optionBox = option?.getBoundingClientRect();
          return {
            key: `${index}:${line}`,
            text: text.textContent,
            left: r.left,
            right: r.right,
            insideOption:
              !optionBox ||
              (r.left >= optionBox.left &&
                r.right <= optionBox.right &&
                r.top >= optionBox.top &&
                r.bottom <= optionBox.bottom),
            visible:
              r.top >= box.top &&
              r.bottom <= box.bottom &&
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              Boolean(hit && (text.contains(hit) || hit === option)),
          };
        });
    });
    return {
      panel: {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        overflowY: getComputedStyle(element).overflowY,
      },
      stageHeadBottom:
        element.closest('.stage')?.querySelector('.stage-head')?.getBoundingClientRect().bottom ??
        null,
      text: texts.map((text) => ({
        label: text.textContent,
        width: text.clientWidth,
        scrollWidth: text.scrollWidth,
        height: text.clientHeight,
        scrollHeight: text.scrollHeight,
        ellipsis: getComputedStyle(text).textOverflow === 'ellipsis',
      })),
      fragments,
    };
  });
}

async function readAll(page: Page, panel: Locator) {
  let first = await sample(panel);
  if (first.panel.scrollTop > 0) {
    await page.mouse.move(
      (first.panel.left + first.panel.right) / 2,
      (first.panel.top + first.panel.bottom) / 2,
    );
    await page.mouse.wheel(0, -5000);
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
    first = await sample(panel);
  }
  expect(
    first.panel.scrollTop,
    'read from the beginning, including text before the focused Next',
  ).toBe(0);
  expect(first.fragments.length, 'authored text produces real line fragments').toBeGreaterThan(0);
  expect(first.text.length).toBeGreaterThan(0);
  if (first.stageHeadBottom !== null)
    expect(
      first.panel.top,
      'staged heading cannot cover its reading scrollport',
    ).toBeGreaterThanOrEqual(first.stageHeadBottom);
  expect(first.panel.scrollWidth).toBeLessThanOrEqual(first.panel.width + 1);
  expect(first.panel.left).toBeGreaterThanOrEqual(0);
  expect(first.panel.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  for (const text of first.text) {
    expect(text.scrollWidth, text.label ?? '').toBeLessThanOrEqual(text.width + 1);
    expect(text.scrollHeight, text.label ?? '').toBeLessThanOrEqual(text.height + 1);
    expect(text.ellipsis).toBe(false);
  }
  for (const fragment of first.fragments) {
    expect(fragment.left).toBeGreaterThanOrEqual(first.panel.left);
    expect(fragment.right).toBeLessThanOrEqual(first.panel.right);
    expect(
      fragment.insideOption,
      'text stays in its own choice rather than overlapping adjacent options',
    ).toBe(true);
  }
  if (first.panel.scrollHeight > first.panel.height + 1) expect(first.panel.overflowY).toBe('auto');
  const visible = new Set(
    first.fragments.filter((fragment) => fragment.visible).map((fragment) => fragment.key),
  );
  const samples = [first];
  await page.screenshot({ path: test.info().outputPath('reading-start.png') });
  // Use physical wheel input at the panel, with overlapping viewfuls. Neither
  // DOM scroll assignment nor forced focus can make an obscured line pass.
  await page.mouse.move(
    (first.panel.left + first.panel.right) / 2,
    (first.panel.top + first.panel.bottom) / 2,
  );
  for (let step = 0; step < 80; step++) {
    const previous = samples[samples.length - 1]!;
    if (previous.panel.scrollHeight - previous.panel.height - previous.panel.scrollTop <= 1) break;
    await page.mouse.wheel(0, Math.max(48, Math.floor(first.panel.height / 3)));
    await expect
      .poll(() => panel.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(previous.panel.scrollTop);
    const next = await sample(panel);
    expect(next.fragments.map((fragment) => fragment.key)).toEqual(
      first.fragments.map((fragment) => fragment.key),
    );
    next.fragments
      .filter((fragment) => fragment.visible)
      .forEach((fragment) => visible.add(fragment.key));
    samples.push(next);
  }
  const last = samples[samples.length - 1]!;
  await test
    .info()
    .attach('reading-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
  expect(last.panel.scrollHeight - last.panel.height - last.panel.scrollTop).toBeLessThanOrEqual(1);
  for (const fragment of first.fragments)
    expect(visible.has(fragment.key), `readable fragment: ${fragment.text}`).toBe(true);
  if (first.panel.scrollHeight > first.panel.height + 1)
    expect(last.panel.scrollTop).toBeGreaterThan(first.panel.scrollTop);
  return { samples, visibleFragments: visible.size, expectedFragments: first.fragments.length };
}

async function tapVisible(page: Page, panel: Locator, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const point = await control.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const panel = button.closest('.conversation-panel')!.getBoundingClientRect();
    const x =
      (Math.max(box.left, panel.left, 0) + Math.min(box.right, panel.right, innerWidth)) / 2;
    const y =
      (Math.max(box.top, panel.top, 0) + Math.min(box.bottom, panel.bottom, innerHeight)) / 2;
    return { x, y, hit: button.contains(document.elementFromPoint(x, y)) };
  });
  expect(point.hit, 'the actual choice/Next receives the touch').toBe(true);
  await expect(panel).toBeVisible();
  await page.touchscreen.tap(point.x, point.y);
}

for (const profile of profiles)
  test.describe(profile.name, () => {
    test.use({ viewport: profile.viewport });
    for (const id of nodes)
      test(`${id} body and options remain fully readable by scrolling`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const node = CONTENT.story.get(id);
        if (!node || (node.kind !== 'dialogue' && node.kind !== 'choice'))
          throw new Error('Missing authored conversation');
        await resetStorage(page, '?renderer=canvas');
        await startGame(page, ['Tala', 'Mina'], ['sura', 'riko'], 'long-conversation-layout');
        await setLargeText(page, profile.size);
        await enterNode(page, id === 'gate_parley' ? 'gate_escort_explore' : 'village_explore');
        await enterNode(page, id);
        const panel = page.locator('.conversation-panel');
        if (node.kind === 'dialogue') {
          const index = node.lines.reduce(
            (best, line, index) => (line.length > (node.lines[best]?.length ?? 0) ? index : best),
            0,
          );
          for (let line = 0; line < index; line++)
            await panel.locator('[data-conversation-control="next"]').tap();
          expect(await page.evaluate(() => window.fnt!.app.state!.story.lineIndex)).toBe(index);
          expect(inventory[0]?.node).toBe('pella_tips');
        }
        await page.evaluate(() => document.fonts.ready);
        const before = await page.evaluate(() => window.fnt!.app.state!);
        const resolved = resolveDialogue(before, node);
        await expect(panel.locator('.dialogue-line')).toHaveText(
          node.kind === 'dialogue'
            ? resolved.lines[before.story.lineIndex]!
            : (resolved.lines[0] ?? node.prompt),
        );
        if (node.kind === 'choice') {
          await expect(panel.locator('.choice-option')).toHaveCount(node.options.length);
          for (const [index, option] of node.options.entries()) {
            const control = panel.locator('.choice-option').nth(index);
            await expect(control.locator('strong')).toHaveText(option.label);
            if (option.detail) await expect(control).toContainText(option.detail);
            if (id === 'gate_parley' && index > 0) {
              await expect(control).toBeDisabled();
              await expect(control.locator('.locked-hint')).toHaveText(option.lockedHint!);
            }
          }
        }
        const reading = await readAll(page, panel);
        expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(before);
        await info.attach('long-conversation-layout', {
          body: JSON.stringify({ id, profile, inventory: inventory.slice(0, 3), reading }),
          contentType: 'application/json',
        });
        await page.screenshot({ path: info.outputPath('read-to-end.png') });
        const optionIndex = id === 'ruon_choice' ? 1 : 0;
        const command =
          node.kind === 'dialogue'
            ? { type: 'advanceDialogue' as const }
            : { type: 'chooseOption' as const, optionIndex };
        const expected = apply(CONTENT, before, command).state;
        const target =
          node.kind === 'dialogue'
            ? panel.locator('[data-conversation-control="next"]')
            : panel.locator('.choice-option').nth(optionIndex);
        await tapVisible(page, panel, target);
        expect(await page.evaluate(() => window.fnt!.app.state!)).toEqual(expected);
        expect(errors).toEqual([]);
      });
  });
