import { describe, expect, it } from 'vitest';
import { Session, type Participant, type Player } from './session';
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
