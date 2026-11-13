/**
 * The table vote on a story choice (#621).
 *
 * Presentation only. Everybody at the table picks in secret, one after the
 * other on the shared screen; the most votes wins, and a tie goes to today's
 * rotating decider. Whatever wins is sent as the ordinary `chooseOption`
 * command, so the rules, the decider rotation and the save are exactly what
 * they were before the vote existed. A vote in progress is not saved: loading
 * a game at a choice simply opens a fresh vote.
 */

/** The "Story choices" setting: a table vote, or the rotating decider alone. */
export type StoryChoices = 'vote' | 'turns';

/**
 * Whether a choice goes to a vote. One player, one road open, or a table that
 * asked to take turns: the choice behaves exactly as it always has.
 */
export function holdsVote(mode: StoryChoices, people: number, available: number): boolean {
  return mode === 'vote' && people >= 2 && available >= 2;
}

/**
 * The order the table votes in: the decider first, then round the table.
 * Starting at the decider rotates the order with every choice, as the
 * decider already does.
 */
export function voteOrder<T>(people: readonly T[], deciderIndex: number): T[] {
  const count = people.length;
  if (count === 0) return [];
  const start = ((deciderIndex % count) + count) % count;
  return people.flatMap((_, index) => {
    const person = people[(start + index) % count];
    return person === undefined ? [] : [person];
  });
}

export interface Tally {
  /** Votes per option index. */
  readonly counts: readonly number[];
  /** The option indices with the most votes; more than one is a tie. */
  readonly leaders: readonly number[];
}

export function tallyVotes(votes: readonly number[], optionCount: number): Tally {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const vote of votes)
    if (vote >= 0 && vote < optionCount) counts[vote] = (counts[vote] ?? 0) + 1;
  const top = Math.max(0, ...counts);
  const leaders = top === 0 ? [] : counts.flatMap((count, index) => (count === top ? [index] : []));
  return { counts, leaders };
}

/** The option that won outright, or undefined while it is tied (or empty). */
export function outright(tally: Tally): number | undefined {
  return tally.leaders.length === 1 ? tally.leaders[0] : undefined;
}

/**
 * The vote in progress at one choice. `ready` is false between voters, while
 * the screen asks for the hand-off; the first voter needs none.
 */
export interface Ballot {
  readonly key: string;
  readonly votes: readonly number[];
  readonly ready: boolean;
}

let ballot: Ballot | null = null;

/** A loaded game replaces the choice, even when its ballot key is unchanged. */
export function resetBallot(): void {
  ballot = null;
}

/** The ballot for this choice, starting a fresh one when the choice is new. */
export function ballotFor(key: string): Ballot {
  if (ballot?.key !== key) ballot = { key, votes: [], ready: true };
  return ballot;
}

export function castVote(key: string, optionIndex: number): Ballot {
  const current = ballotFor(key);
  ballot = { key, votes: [...current.votes, optionIndex], ready: false };
  return ballot;
}

/** The next voter has the screen. */
export function takeOver(key: string): Ballot {
  ballot = { ...ballotFor(key), ready: true };
  return ballot;
}
