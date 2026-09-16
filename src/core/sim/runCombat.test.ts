import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { DEFAULT_MAX_ROUNDS, SOLO_PARTY, STANDARD_PARTY, runCombat, seedFor } from './runCombat';
import { partyOfSize, runBalanceReport } from './balance';
import { encounterRoster } from '../state/createGame';

/**
 * These are the tests that would catch a rules bug before a family does.
 * Every encounter is run for real, many times, with assertions on the things
 * that must never happen rather than on exact numbers.
 */
describe('combat simulation', () => {
  const encounterIds = [...CONTENT.encounters.keys()];

  it('has encounters to run', () => {
    expect(encounterIds.length).toBeGreaterThan(0);
  });

  it.each(encounterIds)('terminates cleanly: %s', (encounterId) => {
    for (let trial = 0; trial < 12; trial++) {
      const result = runCombat(CONTENT, {
        seed: seedFor(`terminate-${encounterId}`, trial),
        encounterId,
        party: STANDARD_PARTY,
      });

      expect(result.anomalies, `${encounterId} trial ${trial}`).toEqual([]);
      expect(result.outcome).not.toBe('stalemate');
      expect(result.rounds).toBeLessThanOrEqual(DEFAULT_MAX_ROUNDS);
      expect(result.rounds).toBeGreaterThan(0);
    }
  });

  it.each(encounterIds)('is deterministic for a given seed: %s', (encounterId) => {
    const run = () =>
      runCombat(CONTENT, {
        seed: seedFor(`determinism-${encounterId}`, 7),
        encounterId,
        party: STANDARD_PARTY,
        recordEvents: true,
      });

    const a = run();
    const b = run();

    expect(a.signature).toBe(b.signature);
    expect(a.rounds).toBe(b.rounds);
    expect(a.outcome).toBe(b.outcome);
    expect(a.events.length).toBe(b.events.length);
    expect(a.events.map((e) => e.type).join(',')).toBe(b.events.map((e) => e.type).join(','));
  });

  it('produces different results for different seeds', () => {
    const signatures = new Set<string>();
    for (let trial = 0; trial < 8; trial++) {
      signatures.add(
        runCombat(CONTENT, {
          seed: seedFor('variety', trial),
          encounterId: 'enc_forest_road',
          party: STANDARD_PARTY,
        }).signature,
      );
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('never leaves a unit with impossible HP or AP', () => {
    for (const encounterId of encounterIds) {
      for (let trial = 0; trial < 6; trial++) {
        const result = runCombat(CONTENT, {
          seed: seedFor(`sanity-${encounterId}`, trial),
          encounterId,
          party: STANDARD_PARTY,
        });
        expect(result.anomalies).toEqual([]);
        expect(result.partyHpRemaining).toBeGreaterThanOrEqual(0);
        expect(result.partyHpRemaining).toBeLessThanOrEqual(result.partyHpTotal);
      }
    }
  });

  it('finishes even with a single party member', () => {
    for (const encounterId of encounterIds) {
      const result = runCombat(CONTENT, {
        seed: seedFor(`solo-${encounterId}`, 3),
        encounterId,
        party: SOLO_PARTY,
        // A solo run is meant to be lost, not to hang.
        maxRounds: DEFAULT_MAX_ROUNDS,
      });
      expect(result.outcome, encounterId).not.toBe('stalemate');
    }
  });
});

describe('encounter rosters', () => {
  const boss = CONTENT.encounters.get('enc_grumbler');
  const gate = CONTENT.encounters.get('enc_quarry_gate');

  it("puts Jin's mercenary at the boss in place of the quarry crew, not beside it", () => {
    expect(boss).toBeDefined();
    if (!boss) return;

    const jins = boss.variants.find((v) => v.id === 'jins_people');
    expect(jins, 'the traded-Ruon roster should be a variant').toBeDefined();
    if (!jins) return;

    const spared = encounterRoster(boss, { ruon_spared: true }, 3);
    const traded = encounterRoster(boss, { ruon_traded: true }, 3, jins);

    /*
     * The head count is the assertion. Trading Ruon away once stacked two
     * mercenaries on top of the authored roster and took the fight from a 62%
     * win rate to 9% — and because the balance harness set no story flags,
     * nothing measured it. A boss floor has no room for extra bodies: even one
     * measured 32-46% against 82%.
     */
    expect(traded.enemies.length).toBe(spared.enemies.length);
    expect(traded.enemies.filter((e) => e.enemyId.startsWith('merc_')).length).toBe(1);
    expect(traded.enemies.filter((e) => e.enemyId === 'bandit_earthbender').length).toBe(0);
    expect(spared.enemies.filter((e) => e.enemyId.startsWith('merc_')).length).toBe(0);
  });

  it('scales the roster with the number of people at the table', () => {
    expect(gate).toBeDefined();
    if (!gate) return;

    const sizes = [1, 2, 3, 4, 5, 6];
    const counts = sizes.map((size) => encounterRoster(gate, {}, size).enemies.length);

    // Monotone: nobody should ever face fewer enemies by bringing a friend.
    for (let i = 1; i < counts.length; i++) {
      const previous = counts[i - 1] ?? 0;
      const current = counts[i] ?? 0;
      expect(current, `size ${sizes[i]} vs ${sizes[i - 1]}`).toBeGreaterThanOrEqual(previous);
    }
    // At the baseline the authored roster is used exactly as written.
    expect(counts[2]).toBe(gate.enemies.length);
    // Never emptied out, however small the party.
    expect(counts[0]).toBeGreaterThanOrEqual(1);
  });

  it('keeps the teaching enemy when the roster is trimmed for a small table', () => {
    expect(gate).toBeDefined();
    if (!gate) return;
    const solo = encounterRoster(gate, {}, 1);
    // The deserter is authored first precisely so the oil lesson survives.
    expect(solo.enemies[0]?.enemyId).toBe('fire_deserter');
  });

  it('counts a story ally toward the table size', () => {
    const ambush = CONTENT.encounters.get('enc_ambush');
    expect(ambush).toBeDefined();
    if (!ambush) return;
    // Three players plus Ruon is a table of four, so one reinforcement shows up.
    expect(encounterRoster(ambush, {}, 3).enemies.length).toBe(ambush.enemies.length + 1);
  });
});

describe('balance', () => {
  /*
   * A small trial count keeps the suite fast; the printed report in CI uses more.
   *
   * `perVariant` is not optional here. An unpinned pass samples whichever roster
   * each seed happened to draw and never pins a *conditional* one at all, which
   * is how the traded-Ruon boss floor sat at a 9% win rate through a green
   * suite: every number published about that fight described the other branch.
   * Pinning each variant is what makes a roster nobody can beat fail here rather
   * than at somebody's kitchen table.
   */
  const report = runBalanceReport(CONTENT, { trials: 24, perVariant: true });

  it('reports no anomalies across every encounter', () => {
    expect(report.anomalies, `\n${report.anomalies.join('\n')}\n`).toEqual([]);
  });

  it('never stalemates', () => {
    for (const row of report.encounters) {
      expect(row.stalemates, row.encounterId).toBe(0);
    }
  });

  it('keeps every encounter winnable and non-trivial', () => {
    for (const row of report.encounters) {
      // Deliberately wide: this asserts "playable", not "tuned". The narrow
      // 70-85% band is a tuning goal reported by `npm run balance`, and is not
      // something a CI run should fail on while the AI is this simple.
      expect(row.winRate, `${row.encounterId} win rate`).toBeGreaterThan(0.4);
      expect(row.winRate, `${row.encounterId} win rate`).toBeLessThanOrEqual(1);
      expect(row.averageRounds, `${row.encounterId} length`).toBeGreaterThan(1);
      expect(row.averageRounds, `${row.encounterId} length`).toBeLessThan(40);
    }
  });

  it('makes the boss the hardest fight in the act', () => {
    const boss = report.encounters.find((e) => e.encounterId === 'enc_grumbler');
    const opener = report.encounters.find((e) => e.encounterId === 'enc_forest_road');
    expect(boss).toBeDefined();
    expect(opener).toBeDefined();
    if (!boss || !opener) return;
    expect(boss.averageRounds).toBeGreaterThan(opener.averageRounds);
  });

  /*
   * The table one player above the baseline, which is the first size that pulls
   * a reinforcement in — and the size this suite could not see.
   *
   * Everything above runs at STANDARD_PARTY, six players. The quarry gate spent
   * a long time with a 30-point hole at exactly four: 72% against 99.5% at
   * three, and 57.5% on the bluffed roster, because the reinforcement list led
   * with a slinger. A `cautious` ranged unit never closes and never presents a
   * target, so it just makes the fight longer, and on the oil map length is
   * what kills. Six players were fine, so CI was fine, and a family of four
   * walked into the one size nobody measured.
   *
   * Reinforcements are taken off the front of the list, so this is the pass
   * that proves the first one is survivable.
   */
  const plusOne = runBalanceReport(CONTENT, {
    trials: 20,
    perVariant: true,
    party: partyOfSize(4),
  });

  it('does not punish the table for bringing one more player', () => {
    for (const row of plusOne.encounters) {
      expect(row.winRate, `${row.label} at four players`).toBeGreaterThan(0.4);
      expect(row.stalemates, row.label).toBe(0);
    }
    expect(plusOne.anomalies, `\n${plusOne.anomalies.join('\n')}\n`).toEqual([]);
  });
});
