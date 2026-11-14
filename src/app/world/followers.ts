/**
 * Who walks with the party without being in it (#696): the followers whose
 * story condition holds now, in authored order. The exploration scene seats
 * the walking ones on the end of the party's line, after every member, and
 * stands a staged one on its station's tile.
 */

import type { GameState, Vec2 } from '../../core/types';
import { evaluate } from '../../core/story/conditions';
import { FOLLOWERS } from '../../content/story/followers';
import type { FollowerDef } from '../../content/story/followers';
import type { ClipName } from '../../content/assets/clips';

export function activeFollowers(
  state: GameState,
  followers: readonly FollowerDef[] = FOLLOWERS,
): readonly FollowerDef[] {
  return followers.filter((follower) => evaluate(state, follower.when));
}

export interface PlacedFollowers {
  /** In the line, in order, after the party. */
  readonly walking: readonly FollowerDef[];
  /** Staged on a tile of the map the party is on. */
  readonly standing: readonly { readonly follower: FollowerDef; readonly pos: Vec2 }[];
}

/** The active followers, split into those who walk in the line and those staged on this map. */
export function placeFollowers(
  state: GameState,
  followers: readonly FollowerDef[] = FOLLOWERS,
): PlacedFollowers {
  const walking: FollowerDef[] = [];
  const standing: { follower: FollowerDef; pos: Vec2 }[] = [];
  for (const follower of activeFollowers(state, followers)) {
    const station = follower.stations?.find(
      (station) => station.mapId === state.location.mapId && evaluate(state, station.when),
    );
    if (station) standing.push({ follower, pos: station.pos });
    else walking.push(follower);
  }
  return { walking, standing };
}

/** The animator ids of everyone in the line, leader first: the party, then the walking followers. */
export function lineIds(state: GameState, walking: readonly FollowerDef[]): string[] {
  return [...state.party.map((member) => member.id), ...walking.map((who) => who.id)];
}

/** The pose a follower standing still holds now, if one of its `poses` holds; undefined plays its idle. */
export function followerPose(state: GameState, follower: FollowerDef): ClipName | undefined {
  return follower.poses?.find((pose) => evaluate(state, pose.when))?.clip;
}
