import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { enterNode, resetStorage } from './helpers';

// Deliberately no firebender: the same authored refusal stays available to
// check at every table size. Names and characters are picked through setup.
const roster = [
  { name: 'Ava', characterId: 'bo', character: 'Bo', element: 'earth' },
  { name: 'Ben', characterId: 'nilak', character: 'Nilak', element: 'water' },
  { name: 'Cleo', characterId: 'riko', character: 'Riko', element: 'nonbender' },
  { name: 'Dara', characterId: 'nima', character: 'Nima', element: 'air' },
  { name: 'Eli', characterId: 'sura', character: 'Sura', element: 'water' },
  { name: 'Faye', characterId: 'lin_mei', character: 'Lin Mei', element: 'earth' },
] as const;

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = window.fnt?.app;
      return (
        app &&
        !app.curtainBusy &&
        !app.animator.busy(performance.now()) &&
        !document.querySelector('.combat-scene[data-battle-opening]') &&
        document.querySelector('.combat-scene')?.getAttribute('data-camera-glide') !== 'active'
      );
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function observe(page: Page) {
  return page.evaluate(() => {
    const app = window.fnt?.app;
    const state = app?.state;
    if (!app || !state) throw new Error('Expected an active named session');
    const battle = state.battle;
    const activeId = battle?.order[battle.turnIndex];
    return {
      screen: state.screen,
      story: state.story,
      flags: state.flags,
      players: app.session.players,
      participants: app.session.participants,
      party: state.party.map(({ id, characterId, name }) => ({ id, characterId, name })),
      battle,
      active: battle?.units.find((unit) => unit.id === activeId) ?? null,
      owner: document.querySelector('.handoff-banner h1')?.textContent ?? null,
      decider: document.querySelector('.decider-banner')?.textContent ?? null,
      controls: [...document.querySelectorAll<HTMLButtonElement>('.action-bar button')].map(
        (control) => ({ text: control.textContent, disabled: control.disabled }),
      ),
    };
  });
}

async function evidence(page: Page, info: TestInfo, label: string): Promise<void> {
  await settled(page);
  await info.attach(`${label}.json`, {
    body: JSON.stringify(await observe(page), null, 2),
    contentType: 'application/json',
  });
  await info.attach(`${label}.png`, { body: await page.screenshot(), contentType: 'image/png' });
}

async function setupNamedParty(page: Page, size: number) {
  await resetStorage(page, '?renderer=canvas');
  // Use the player's settings control, keeping rules/UI assertions separate
  // from animation duration without changing the existing timeout budgets.
  await page.getByRole('button', { name: /^Settings$/ }).click();
  const reducedMotion = page.getByRole('switch', { name: 'Reduce motion', exact: true });
  if ((await reducedMotion.getAttribute('aria-checked')) !== 'true') await reducedMotion.click();
  await page.getByRole('button', { name: /^Done$/ }).click();

  await page.getByRole('button', { name: /new game/i }).click();
  await page
    .getByRole('button', { name: `${size} player${size === 1 ? '' : 's'}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Choose your own', exact: true }).click();
  const configured = roster.slice(0, size);
  for (const [index, member] of configured.entries()) {
    const handoff = page.getByRole('button', { name: "I've got it", exact: true });
    if (size === 1) await expect(handoff).toHaveCount(0);
    else {
      await expect(page.locator('.setup-panel')).toContainText(`Player ${index + 1} of ${size}`);
      await handoff.click();
    }
    await page.getByRole('textbox', { name: 'Your name', exact: true }).fill(member.name);
    await page.getByRole('button', { name: /^Next$/ }).click();
  }
  const heroes = roster.slice(0, 3);
  for (const [index, member] of heroes.entries()) {
    const ownerIndex = index % size;
    const owner = configured[ownerIndex];
    if (!owner) throw new Error('Missing configured hero owner');
    const handoff = page.getByRole('button', { name: "I've got it", exact: true });
    if (size > 1) await handoff.click();
    await page.locator(`.pick-card.element-${member.element}`).click();
    await page.getByRole('button', { name: /^Next$/ }).click();
    await page
      .locator('.character-card')
      .filter({ has: page.getByRole('heading', { name: member.character, exact: true }) })
      .click();
    await page.getByRole('button', { name: /^Confirm$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'The party', exact: true })).toBeVisible();
  await expect(page.locator('.party-summary-card .tagline')).toHaveText(
    heroes.map((_, index) => configured[index % size]!.name),
  );
  await expect(page.locator('.party-summary-card h3')).toHaveText(
    heroes.map((member) => member.character),
  );
  await page.getByRole('button', { name: /^Begin$/ }).click();
  await settled(page);
  const started = await observe(page);
  expect(started.party.map((member) => member.characterId)).toEqual(
    heroes.map((member) => member.characterId),
  );
  const expectedPlayers = heroes.map((member, index) => {
    const unit = started.party[index];
    const owner = configured[index % size];
    if (!unit || !owner) throw new Error(`Missing setup character for ${member.name}`);
    return { name: owner.name, unitId: unit.id, participantId: `player-${(index % size) + 1}` };
  });
  expect(started.players).toEqual(expectedPlayers);
  expect(started.participants).toEqual(
    configured.map((person, index) => ({ id: `player-${index + 1}`, name: person.name })),
  );
  expect(started.story.deciderIndex).toBe(0);
  return { configured, heroes, expectedPlayers };
}

async function assertChoiceOwner(page: Page, size: number, index: number): Promise<void> {
  await settled(page);
  expect((await observe(page)).story.deciderIndex).toBe(index);
  const banner = page.locator('.decider-banner');
  if (size === 1) {
    await expect(banner).toHaveCount(0);
    await expect(page.locator('.choice-option').first()).toBeEnabled();
    return;
  }
  const current = roster[index % size];
  const next = roster[(index + 1) % size];
  if (!current || !next) throw new Error('Missing configured story owner');
  await expect(banner.locator('strong')).toHaveText(current.name);
  await expect(banner.locator('span').last()).toHaveText(`Next choice: ${next.name}`);
}

async function saveAndReload(page: Page): Promise<void> {
  await settled(page);
  const pause = page.getByRole('button', { name: /^Pause$/ });
  if (await pause.count()) await pause.click();
  else {
    // A retained-world conversation can omit DialogueScene's top bar. This
    // public pause entry only opens the same menu; slots/load remain real UI.
    await page.evaluate(() => window.fnt?.app.openPause());
  }
  await page.getByRole('button', { name: /^Save game$/ }).click();
  const slot = page.locator('.slot').filter({ hasText: 'Slot 1' });
  await slot.getByRole('button', { name: /^Save here$/ }).click();
  await expect(slot).toHaveClass(/slot-full/);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.fnt?.app));
  await page.getByRole('button', { name: /load a save/i }).click();
  await page
    .locator('.slot')
    .filter({ hasText: 'Slot 1' })
    .getByRole('button', { name: /^Load$/ })
    .click();
  await settled(page);
}

async function atChoice(page: Page, node: string, size: number, index: number): Promise<void> {
  // Public story commands skip travel/narration outside this contract. They
  // never assign the decider index, players, units, or a synthetic story node.
  await enterNode(page, node);
  await expect.poll(async () => (await observe(page)).story.nodeId).toBe(node);
  await assertChoiceOwner(page, size, index);
}

async function finishGaoSeat(page: Page): Promise<void> {
  for (let line = 0; line < 4; line++) {
    await expect.poll(async () => (await observe(page)).story.nodeId).toBe('plant_chair_seat');
    await page.locator('[data-conversation-control="next"]').click();
  }
  await expect.poll(async () => (await observe(page)).story.nodeId).toBe('plant_chair_talk');
}

async function partyTurn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const app = window.fnt?.app;
      const battle = app?.state?.battle;
      const id = battle?.order[battle.turnIndex];
      return (
        app &&
        !app.curtainBusy &&
        battle?.phase === 'active' &&
        battle.units.some((unit) => unit.id === id && unit.faction === 'party') &&
        !app.animator.busy(performance.now()) &&
        !document.querySelector('.combat-scene[data-battle-opening]')
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  await settled(page);
}

async function assertHudOwner(page: Page, character: string, name: string): Promise<void> {
  const characterName = page.locator('.unit-panel .unit-name');
  await expect(characterName).toHaveText(character);
  await expect(characterName.locator('..').locator(':scope > span.tiny.muted')).toHaveText(name);
}

for (const size of [1, 2, 4, 6]) {
  test(`${size} named players keep story ownership through refusal, a wrap and reload`, async ({
    page,
  }, info) => {
    const { configured, expectedPlayers } = await setupNamedParty(page, size);
    await atChoice(page, 'gate_parley', size, 0);
    const locked = page.locator('.choice-option').nth(1);
    await expect(locked).toBeDisabled();
    await expect(locked).toContainText('You need a firebender');
    const beforeRefusal = await observe(page);
    await locked.click({ force: true });
    expect((await observe(page)).story).toEqual(beforeRefusal.story);
    // Also send the refused command through App, exercising the rules guard
    // rather than assuming a disabled button is the only protection.
    await page.evaluate(() => window.fnt?.app.dispatch({ type: 'chooseOption', optionIndex: 1 }));
    const refused = await observe(page);
    expect(refused.story).toEqual(beforeRefusal.story);
    expect(refused.flags).toEqual(beforeRefusal.flags);
    await assertChoiceOwner(page, size, 0);
    await evidence(page, info, 'story-refusal-owner-unchanged');

    await atChoice(page, 'plant_chair', size, 0);
    await evidence(page, info, 'story-first-owner');
    await page.locator('.choice-option').first().click();
    await finishGaoSeat(page);
    await assertChoiceOwner(page, size, 1);
    const saved = await observe(page);
    await saveAndReload(page);
    const loaded = await observe(page);
    expect(loaded.story).toEqual(saved.story);
    expect(loaded.flags).toEqual(saved.flags);
    expect(loaded.party).toEqual(saved.party);
    expect(loaded.players).toEqual(expectedPlayers);
    expect(loaded.participants).toEqual(
      configured.map((person, index) => ({ id: `player-${index + 1}`, name: person.name })),
    );
    await assertChoiceOwner(page, size, 1);
    await evidence(page, info, 'story-midrotation-loaded');

    // The first two choices are a natural authored pair. The later fixtures
    // cover four distinct authored choice nodes and enough accepted choices
    // to pass the last named player and wrap back to the first at every size.
    let index = 1;
    const totalChoices = Math.max(size + 1, 4);
    while (index < totalChoices) {
      const step = index % 4;
      if (step === 0) await atChoice(page, 'plant_chair', size, index);
      else if (step === 1) await assertChoiceOwner(page, size, index);
      else await atChoice(page, step === 2 ? 'gate_parley' : 'ruon_choice', size, index);
      await page
        .locator('.choice-option')
        .nth(step === 2 ? 2 : 0)
        .click();
      index++;
      const accepted = await observe(page);
      expect(accepted.story.deciderIndex).toBe(index);
      expect(accepted.story.nodeId).toBe(
        ['plant_chair_seat', 'plant_chair_leaf', 'gate_kinship', 'escort_chosen'][step],
      );
      if (step === 0) await finishGaoSeat(page);
      // Every accepted choice moves exactly once; node entry does not rotate.
      if (step !== 0) await atChoice(page, 'plant_chair_talk', size, index);
      else await assertChoiceOwner(page, size, index);
    }
    await assertChoiceOwner(page, size, totalChoices);
    expect((await observe(page)).players).toEqual(expectedPlayers);
    await evidence(page, info, 'story-after-wrap');
  });

  test(`${size} named players receive their own combat turns before and after reload`, async ({
    page,
  }, info) => {
    const { configured, heroes, expectedPlayers } = await setupNamedParty(page, size);
    // Earn a nonzero story rotation before entering the combat fixture, so a
    // combat save must preserve both kinds of ownership at once.
    await atChoice(page, 'plant_chair', size, 0);
    await page.locator('.choice-option').first().click();
    expect((await observe(page)).story.deciderIndex).toBe(1);
    await enterNode(page, 'battle_forest_road');

    const witnessed = new Set<string>();
    let reloaded = false;
    let acknowledgedOwner: string | null = null;
    for (let turn = 0; turn <= 3; turn++) {
      await partyTurn(page);
      const before = await observe(page);
      const actor = before.active;
      if (!actor || actor.faction !== 'party' || !before.battle) {
        throw new Error('Expected a living party activation');
      }
      expect(actor.hp).toBeGreaterThan(0);
      expect(before.battle.round).toBeLessThanOrEqual(2);
      const member = heroes.find((candidate) => candidate.characterId === actor.characterId);
      if (!member) throw new Error(`Unexpected party character ${actor.characterId}`);
      const owner = expectedPlayers.find((candidate) => candidate.unitId === actor.id);
      expect(owner?.unitId).toBe(actor.id);
      const ownerIndex = Number(owner?.participantId?.slice('player-'.length)) - 1;
      expect(owner?.name).toBe(configured[ownerIndex]?.name);
      expect(before.players).toEqual(expectedPlayers);
      expect(before.story.deciderIndex).toBe(1);
      witnessed.add(member.name);

      const banner = page.locator('.handoff-banner');
      const needsHandoff = size > 1 && acknowledgedOwner !== owner?.participantId;
      if (!needsHandoff) {
        await expect(banner).toHaveCount(0);
      } else {
        await expect(banner.getByRole('heading')).toHaveText(owner?.name ?? '');
        await expect(banner).toContainText(`Playing ${member.character}`);
        await expect(page.locator('.action-bar')).toHaveCount(0);
        const map = await page.locator('.map-canvas').boundingBox();
        if (!map) throw new Error('Missing map behind the handoff card');
        // An incidental ground tap checks card/state stability, without
        // claiming to exercise a particular canvas action or inspector guard.
        await page.touchscreen.tap(map.x + map.width * 0.15, map.y + map.height * 0.15);
        const afterGroundTap = await observe(page);
        expect(afterGroundTap.battle).toEqual(before.battle);
        await expect(banner.getByRole('heading')).toHaveText(owner?.name ?? '');
      }

      // Capture the actual owner card, then the actionable turn for that same
      // unit. These screenshots wait for the public curtain/animator state.
      if (turn <= 1) await evidence(page, info, `combat-turn-${turn}-before-ready`);
      if (needsHandoff)
        await banner.getByRole('button', { name: "I'm ready", exact: true }).click();
      acknowledgedOwner = owner?.participantId ?? null;
      await expect(banner).toHaveCount(0);
      await expect(page.locator('.action-bar')).toBeVisible();
      await expect(page.locator('.end-turn')).toBeEnabled();
      await assertHudOwner(page, member.character, owner?.name ?? '');
      const ready = await observe(page);
      expect(ready.battle).toEqual(before.battle);
      if (turn <= 1) await evidence(page, info, `combat-turn-${turn}-after-ready`);

      // Save after an actual completed human turn (and any intervening enemy
      // AI), while the next party activation is ready but has not acted.
      if (turn === 1) {
        await saveAndReload(page);
        const loaded = await observe(page);
        expect(loaded.battle).toEqual(ready.battle);
        expect(loaded.story).toEqual(ready.story);
        expect(loaded.players).toEqual(expectedPlayers);
        expect(loaded.participants).toEqual(
          configured.map((person, index) => ({ id: `player-${index + 1}`, name: person.name })),
        );
        expect(loaded.party).toEqual(ready.party);
        if (size > 1) {
          await expect(banner.getByRole('heading')).toHaveText(owner?.name ?? '');
          await evidence(page, info, 'combat-loaded-correct-owner');
          await banner.getByRole('button', { name: "I'm ready", exact: true }).click();
          acknowledgedOwner = owner?.participantId ?? null;
        } else await expect(banner).toHaveCount(0);
        await expect(page.locator('.end-turn')).toBeEnabled();
        await assertHudOwner(page, member.character, owner?.name ?? '');
        expect((await observe(page)).battle).toEqual(ready.battle);
        await evidence(page, info, 'combat-loaded-after-ready');
        reloaded = true;
      }

      // The real unused-AP confirmation requires two taps. No toast text or
      // timeout is used as the oracle, and no turn is advanced by a fixture.
      const previousActivation = `${before.battle.round}:${before.battle.turnIndex}:${actor.id}`;
      const end = page.locator('.end-turn');
      await end.click();
      if (actor.ap > 0) {
        expect((await observe(page)).battle).toEqual(ready.battle);
        await end.click();
      }
      // Include solo and the last iteration: a disabled/no-op confirmed End
      // turn must fail even when no subsequent owner-card assertion follows.
      await expect
        .poll(async () => {
          const battle = (await observe(page)).battle;
          if (!battle) throw new Error('Lost the battle while ending a turn');
          return `${battle.round}:${battle.turnIndex}:${battle.order[battle.turnIndex]}`;
        })
        .not.toBe(previousActivation);
    }
    expect([...witnessed].sort()).toEqual(heroes.map((member) => member.name).sort());
    expect(reloaded).toBe(true);
  });
}
