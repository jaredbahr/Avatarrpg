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
      ? [...participants]
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

  /** "Nilak (Ava)" — the character, then the human. */
  labelFor(unit: Unit): string {
    const player = this.playerFor(unit.id);
    return player ? `${unit.name} (${player.name})` : unit.name;
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
