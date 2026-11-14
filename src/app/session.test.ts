import { describe, expect, it } from 'vitest';
import {
  HANDOFF_NAME_MAX,
  sanitiseHandoffName,
  Session,
  type Participant,
  type Player,
} from './session';
import type { GameState } from '../core/types';

const story = (deciderIndex: number) => ({ story: { deciderIndex } }) as unknown as GameState;

describe('hot-seat participant ownership', () => {
  const participants: Participant[] = [
    { id: 'person-1', name: 'Alex' },
    { id: 'person-2', name: 'Alex' },
    { id: 'person-3', name: 'Sam' },
    { id: 'person-4', name: 'Jo' },
  ];
  const players: Player[] = [
    { unitId: 'kaya', name: 'Alex', participantId: 'person-1' },
    { unitId: 'sura', name: 'Alex', participantId: 'person-2' },
    { unitId: 'bo', name: 'Alex', participantId: 'person-1' },
  ];

  it('keeps three hero owners separate from the full story rotation', () => {
    const session = new Session(players, participants);
    expect(session.players).toHaveLength(3);
    expect(session.participants).toHaveLength(4);
    expect(session.count).toBe(4);
    expect(session.solo).toBe(false);
    expect(session.participantForUnit('bo')).toEqual(participants[0]);
    expect(session.decider(story(0))).toEqual(participants[0]);
    expect(session.nextDecider(story(0))).toEqual(participants[1]);
    expect(session.decider(story(2))).toEqual(participants[2]);
    expect(session.nextDecider(story(3))).toEqual(participants[0]);
  });

  it('requests handoff when human identity changes, including duplicate names', () => {
    const session = new Session(players, participants);
    expect(session.needsHandoff('kaya', 'bo')).toBe(false);
    expect(session.needsHandoff('kaya', 'sura')).toBe(true);
    expect(session.needsHandoff('sura', 'unowned')).toBe(false);
  });

  it('round-trips participant ids and keeps legacy rows as distinct people', () => {
    const current = new Session(players, participants);
    const restored = Session.fromMeta(current.toMeta());
    expect(restored.toMeta()).toEqual(current.toMeta());

    const legacyMeta = {
      players: [
        { name: 'Alex', unitId: 'one' },
        { name: 'Alex', unitId: 'two' },
      ],
    };
    const legacy = new Session();
    legacy.restoreMeta(legacyMeta);
    expect(legacy.participants).toEqual([
      { id: 'legacy-player-1', name: 'Alex' },
      { id: 'legacy-player-2', name: 'Alex' },
    ]);
    expect(legacy.count).toBe(2);
    expect(legacy.needsHandoff('one', 'two')).toBe(true);
    expect(legacy.toMeta()).toEqual({
      players: [
        { name: 'Alex', unitId: 'one' },
        { name: 'Alex', unitId: 'two' },
      ],
      soloPlay: false,
    });
  });
});

describe('optional hand-off names', () => {
  const participants: Participant[] = [
    { id: 'player-1', name: 'Player 1', handoffName: 'Maya' },
    { id: 'player-2', name: 'Player 2' },
    { id: 'player-3', name: 'Player 3', handoffName: '  Theo  ' },
  ];
  const players: Player[] = [
    { unitId: 'kaya', name: 'Player 1', participantId: 'player-1' },
    { unitId: 'sura', name: 'Player 2', participantId: 'player-2' },
    { unitId: 'bo', name: 'Player 3', participantId: 'player-3' },
  ];

  it('cleans what was typed: trimmed, one space, no control characters, 12 characters', () => {
    expect(sanitiseHandoffName(undefined)).toBeUndefined();
    expect(sanitiseHandoffName('   ')).toBeUndefined();
    expect(sanitiseHandoffName('  Maya  ')).toBe('Maya');
    expect(sanitiseHandoffName('Ma\u0000ya\n  Rose')).toBe('Ma ya Rose');
    expect(sanitiseHandoffName('Bartholomew the Brave')).toBe('Bartholomew');
    expect(sanitiseHandoffName('Abcdefghijklmnop')).toHaveLength(HANDOFF_NAME_MAX);
    // Twelve characters, not twelve UTF-16 units: an emoji is never split.
    expect(sanitiseHandoffName('🐉'.repeat(14))).toBe('🐉'.repeat(12));
    expect(sanitiseHandoffName('<b>Jo</b>')).toBe('<b>Jo</b>');
  });

  it('names the hand-off card and nothing else', () => {
    const session = new Session(players, participants);
    expect(session.handoffNameFor('kaya')).toBe('Maya');
    expect(session.handoffNameFor('bo')).toBe('Theo');
    // No name typed for this seat: the card keeps the wording it always had.
    expect(session.handoffNameFor('sura')).toBe('Player 2');
    expect(session.handoffNameFor('enemy')).toBeUndefined();
    // The story rotation and every other label keep the player names.
    expect(session.decider(story(0))?.name).toBe('Player 1');
    expect(session.playerFor('kaya')?.name).toBe('Player 1');
  });

  it('survives a save and loads an older save that has none', () => {
    const restored = Session.fromMeta(new Session(players, participants).toMeta());
    expect(restored.handoffNameFor('kaya')).toBe('Maya');
    expect(restored.handoffNameFor('bo')).toBe('Theo');
    expect(restored.participants[1]).toEqual({ id: 'player-2', name: 'Player 2' });

    const older = Session.fromMeta({
      players: players.map(({ name, unitId }) => ({ name, unitId })),
      soloPlay: false,
    });
    expect(older.handoffNameFor('kaya')).toBe('Player 1');
    expect(older.handoffNameFor('sura')).toBe('Player 2');
  });
});
