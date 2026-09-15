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
}

export class Session {
  private roster: Player[];

  constructor(players: readonly Player[] = []) {
    this.roster = [...players];
  }

  get players(): readonly Player[] {
    return this.roster;
  }

  get count(): number {
    return this.roster.length;
  }

  /** Solo play skips the hand-off banner entirely. */
  get solo(): boolean {
    return this.roster.length <= 1;
  }

  setPlayers(players: readonly Player[]): void {
    this.roster = [...players];
  }

  playerFor(unitId: string | null | undefined): Player | undefined {
    if (!unitId) return undefined;
    return this.roster.find((p) => p.unitId === unitId);
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
  decider(state: GameState): Player | undefined {
    if (this.roster.length === 0) return undefined;
    const index =
      ((state.story.deciderIndex % this.roster.length) + this.roster.length) % this.roster.length;
    return this.roster[index];
  }

  /** Who decides after this one — shown so the table knows the rotation is real. */
  nextDecider(state: GameState): Player | undefined {
    if (this.roster.length === 0) return undefined;
    const index =
      (((state.story.deciderIndex + 1) % this.roster.length) + this.roster.length) %
      this.roster.length;
    return this.roster[index];
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
    return previous?.name !== next.name;
  }

  toMeta(): SessionMeta {
    return {
      players: this.roster.map((p) => ({ name: p.name, unitId: p.unitId })),
      soloPlay: this.solo,
    };
  }

  static fromMeta(meta: SessionMeta | undefined): Session {
    if (!meta) return new Session();
    return new Session(meta.players.map((p) => ({ name: p.name, unitId: p.unitId })));
  }
}

/** Default names when somebody cannot be bothered to type one. */
export function defaultPlayerName(index: number): string {
  return `Player ${index + 1}`;
}
