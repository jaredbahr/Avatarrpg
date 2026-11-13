import { describe, expect, it } from 'vitest';
import {
  ballotFor,
  castVote,
  holdsVote,
  outright,
  resetBallot,
  takeOver,
  tallyVotes,
  voteOrder,
} from './tableVote';

describe('table vote', () => {
  it('lets the majority win', () => {
    const tally = tallyVotes([2, 0, 2], 3);
    expect(tally.counts).toEqual([1, 0, 2]);
    expect(tally.leaders).toEqual([2]);
    expect(outright(tally)).toBe(2);
  });

  it('leaves a tie for the decider, naming only the tied options', () => {
    expect(outright(tallyVotes([0, 1, 2], 3))).toBeUndefined();
    expect(tallyVotes([0, 1, 2], 3).leaders).toEqual([0, 1, 2]);
    // Four players, two against two: the third option is out of it.
    const tally = tallyVotes([1, 0, 1, 0], 3);
    expect(tally.leaders).toEqual([0, 1]);
    expect(outright(tally)).toBeUndefined();
  });

  it('ignores votes for options that do not exist', () => {
    expect(tallyVotes([5, -1], 2)).toEqual({ counts: [0, 0], leaders: [] });
  });

  it('votes from the decider round the table, so the order rotates with it', () => {
    const people = ['Ava', 'Ben', 'Cleo'];
    expect(voteOrder(people, 0)).toEqual(['Ava', 'Ben', 'Cleo']);
    expect(voteOrder(people, 1)).toEqual(['Ben', 'Cleo', 'Ava']);
    expect(voteOrder(people, 5)).toEqual(['Cleo', 'Ava', 'Ben']);
    expect(voteOrder([], 3)).toEqual([]);
  });

  it('skips the vote for one player, one open road, or a table that takes turns', () => {
    expect(holdsVote('vote', 3, 2)).toBe(true);
    expect(holdsVote('vote', 2, 3)).toBe(true);
    expect(holdsVote('vote', 1, 3)).toBe(false);
    expect(holdsVote('vote', 0, 3)).toBe(false);
    expect(holdsVote('vote', 4, 1)).toBe(false);
    expect(holdsVote('turns', 4, 3)).toBe(false);
  });

  it('keeps one ballot per choice and asks for the hand-off between voters', () => {
    const key = 'gate_parley|0|a|b|c';
    expect(ballotFor(key)).toEqual({ key, votes: [], ready: true });
    expect(castVote(key, 1)).toEqual({ key, votes: [1], ready: false });
    // A re-render reads the same ballot back.
    expect(ballotFor(key)).toEqual({ key, votes: [1], ready: false });
    expect(takeOver(key)).toEqual({ key, votes: [1], ready: true });
    // The next choice (the decider has moved) starts fresh.
    expect(ballotFor('gate_parley|1|a|b|c')).toEqual({
      key: 'gate_parley|1|a|b|c',
      votes: [],
      ready: true,
    });
  });

  it('starts fresh after replacement even when the choice and voters have the same key', () => {
    const key = 'gate_parley|0|replacement-a|replacement-b|replacement-c';
    castVote(key, 1);
    takeOver(key);
    const previous = castVote(key, 0);
    expect(previous).toEqual({ key, votes: [1, 0], ready: false });

    resetBallot();
    const fresh = ballotFor(key);
    expect(fresh).toEqual({ key, votes: [], ready: true });
    expect(fresh).not.toBe(previous);
    expect(ballotFor(key)).toBe(fresh);
    expect(castVote(key, 0)).toEqual({ key, votes: [0], ready: false });
    expect(takeOver(key)).toEqual({ key, votes: [0], ready: true });

    // Replacing an already cleared vote is safe, including before its first render.
    resetBallot();
    resetBallot();
    expect(ballotFor(key)).toEqual({ key, votes: [], ready: true });
  });
});
