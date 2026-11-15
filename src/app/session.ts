/**
 * Hot-seat.
 *
 * Everything about *people* lives here. The rules core knows only units and
 * factions — it has no idea how many humans are in the room, whose turn it is
 * socially, or who gets to decide the next branch. That separation is
 * deliberate: giving everyone their own phone later would change this file and
 * nothing in `src/core`.
 */

import type { GameState, Unit } from '../core/types';
import type { SessionMeta } from '../core/save/serialize';
import { isGuest, isTableControlled } from '../core/rules/guests';

export interface Player {
  /** What the turn banner says. "Ava", not "Player 2". */
  readonly name: string;
  /** The party unit this person controls, by unit id. */
  readonly unitId: string;
  /** Stable human identity; display names are not unique. */
  readonly participantId?: string;
}

export interface Participant {
  readonly id: string;
  readonly name: string;
  /**
   * What the table typed on the optional names step after the suggested
   * party. Presentation only, and shown in one place: the combat hand-off
   * card ("Hand the tablet to Maya"). The story vote, the decider and the
   * ending keep `name`, so a table that skips the step plays exactly as before.
   */
  readonly handoffName?: string;
}

/** The longest name the hand-off card will show, in characters. */
export const HANDOFF_NAME_MAX = 12;

/**
 * Trims, folds runs of whitespace, drops control characters and caps a typed
 * name at `HANDOFF_NAME_MAX` characters (code points, so an emoji is never cut
 * in half). Returns `undefined` for a name that is empty once cleaned.
 */
export function sanitiseHandoffName(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const cleaned = [
    ...raw
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ]
    .slice(0, HANDOFF_NAME_MAX)
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export class Session {
  private roster: Player[] = [];
  private people: Participant[] = [];
  private explicitPeople = false;

  constructor(players: readonly Player[] = [], participants?: readonly Participant[]) {
    this.setPlayers(players, participants);
  }

  get players(): readonly Player[] {
    return this.roster;
  }

  get count(): number {
    return this.people.length;
  }

  get participants(): readonly Participant[] {
    return this.people;
  }

  /** Solo play skips the hand-off banner entirely. */
  get solo(): boolean {
    return this.people.length <= 1;
  }

  setPlayers(players: readonly Player[], participants?: readonly Participant[]): void {
    this.explicitPeople =
      participants !== undefined || players.some((player) => player.participantId !== undefined);
    this.roster = players.map((player, index) => ({
      ...player,
      participantId:
        player.participantId ?? participants?.[index]?.id ?? `legacy-player-${index + 1}`,
    }));
    this.people = participants
      ? participants.map(({ handoffName, ...person }) => {
          const clean = sanitiseHandoffName(handoffName);
          return clean ? { ...person, handoffName: clean } : person;
        })
      : [
          ...new Map(
            this.roster.map((player) => [
              player.participantId!,
              { id: player.participantId!, name: player.name },
            ]),
          ).values(),
        ];
  }

  restoreMeta(meta: SessionMeta | undefined): void {
    this.setPlayers(
      meta?.players.map((player) => ({
        name: player.name,
        unitId: player.unitId,
        participantId: player.participantId,
      })) ?? [],
      meta?.participants,
    );
  }

  playerFor(unitId: string | null | undefined): Player | undefined {
    if (!unitId) return undefined;
    return this.roster.find((p) => p.unitId === unitId);
  }

  participantForUnit(unitId: string | null | undefined): Participant | undefined {
    const player = this.playerFor(unitId);
    return player ? this.people.find((person) => person.id === player.participantId) : undefined;
  }

  /**
   * Who the combat hand-off card asks for: the optional name typed after the
   * suggested party, or, without one, the same player name the card always used.
   */
  handoffNameFor(unitId: string | null | undefined): string | undefined {
    const person = this.participantForUnit(unitId);
    return person?.handoffName ?? this.playerFor(unitId)?.name;
  }

  /** "Nilak (Ava)" — the character, then the human. */
  labelFor(unit: Unit): string {
    const player = this.playerFor(unit.id);
    return player ? `${unit.name} (${player.name})` : unit.name;
  }

  /**
   * Who takes a table-controlled guest's turn (ADR 0116).
   *
   * Nobody owns a guest, so it passes round the table: one person a round,
   * starting from whoever has the story decision and moving on each round,
   * with a second guest one seat further on so two guests are not always the
   * same person's. It is worked out from the saved round and decider index
   * alone, so a loaded save hands the same turn to the same person.
   */
  guestControllerFor(state: GameState, unitId: string | null | undefined): Participant | undefined {
    const battle = state.battle;
    const count = this.people.length;
    if (!battle || !unitId || count === 0) return undefined;
    const guests = battle.units.filter((unit) => isGuest(unit) && isTableControlled(unit));
    const seat = guests.findIndex((unit) => unit.id === unitId);
    if (seat < 0) return undefined;
    const index = state.story.deciderIndex + battle.round - 1 + seat;
    return this.people[((index % count) + count) % count];
  }

  /** The person who takes `unitId`'s turn: its player's, or a table guest's of the round. */
  controllerFor(
    state: GameState | null,
    unitId: string | null | undefined,
  ): Participant | undefined {
    return (
      this.participantForUnit(unitId) ??
      (state ? this.guestControllerFor(state, unitId) : undefined)
    );
  }

  /** The name the hand-off card asks for when `unitId` is next to act. */
  controllerHandoffName(
    state: GameState | null,
    unitId: string | null | undefined,
  ): string | undefined {
    if (this.playerFor(unitId)) return this.handoffNameFor(unitId);
    const person = state ? this.guestControllerFor(state, unitId) : undefined;
    return person?.handoffName ?? person?.name;
  }

  /**
   * Whether a hand-off card is needed before `unitId` acts, given the person
   * who last took the tablet. The same rule as `needsHandoff`, extended to a
   * table guest, whose controller changes with the round rather than the unit.
   */
  needsHandoffTo(
    previousParticipantId: string | null,
    state: GameState | null,
    unitId: string | null,
  ): boolean {
    if (this.solo) return false;
    const next = this.controllerFor(state, unitId);
    if (!next) return false;
    return previousParticipantId !== next.id;
  }

  /**
   * Whose turn it is to make a story choice.
   *
   * The index lives on `GameState.story.deciderIndex` and is bumped by the
   * rules every time a choice resolves, so the rotation survives a save and
   * does not depend on anything the UI remembers.
   */
  decider(state: GameState): Participant | undefined {
    if (this.people.length === 0) return undefined;
    const index =
      ((state.story.deciderIndex % this.people.length) + this.people.length) % this.people.length;
    return this.people[index];
  }

  /** Who decides after this one — shown so the table knows the rotation is real. */
  nextDecider(state: GameState): Participant | undefined {
    if (this.people.length === 0) return undefined;
    const index =
      (((state.story.deciderIndex + 1) % this.people.length) + this.people.length) %
      this.people.length;
    return this.people[index];
  }

  /**
   * Whether a hand-off banner is needed before `unitId` acts.
   *
   * Only when the controlling human changes: back-to-back turns by the same
   * person, and every enemy turn, pass without interrupting anyone.
   */
  needsHandoff(previousUnitId: string | null, nextUnitId: string | null): boolean {
    if (this.solo) return false;
    const previous = this.playerFor(previousUnitId);
    const next = this.playerFor(nextUnitId);
    if (!next) return false;
    return previous?.participantId !== next.participantId;
  }

  toMeta(): SessionMeta {
    return {
      players: this.roster.map((p) => ({
        name: p.name,
        unitId: p.unitId,
        ...(this.explicitPeople ? { participantId: p.participantId } : {}),
      })),
      ...(this.explicitPeople
        ? { participants: this.people.map((person) => ({ ...person })) }
        : {}),
      soloPlay: this.solo,
    };
  }

  static fromMeta(meta: SessionMeta | undefined): Session {
    const session = new Session();
    session.restoreMeta(meta);
    return session;
  }
}

/** Default names when somebody cannot be bothered to type one. */
export function defaultPlayerName(index: number): string {
  return `Player ${index + 1}`;
}
