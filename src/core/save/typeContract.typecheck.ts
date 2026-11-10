/** Type-only compiler fixtures. Included by tsc; never imported by the game. */
import type { BattleState, GameState, Unit, Vec2 } from '../types';
import type { SaveBlob, SaveStateKeyContract } from './serialize';
import type { DeepMutable, KeysMatch, RequireTrue } from './typeContract';

type SavedState = SaveBlob['state'];
type SavedBattle = NonNullable<SavedState['battle']>;
type SavedUnit = SavedState['party'][number];
type WithBattle<T> = Omit<SavedState, 'battle'> & { battle: T | null };
type WithParty<T> = Omit<SavedState, 'party'> & { party: T[] };
type WithReturnPositions<T> = Omit<SavedState, 'world'> & {
  world: Omit<SavedState['world'], 'returnPos'> & { returnPos: Record<string, T> };
};

export type CurrentProductionGuard = RequireTrue<SaveStateKeyContract>;
export type CurrentStateKeys = RequireTrue<KeysMatch<GameState, SavedState>>;
export type CurrentBattleKeys = RequireTrue<KeysMatch<BattleState, SavedBattle>>;
export type CurrentUnitKeys = RequireTrue<KeysMatch<Unit, SavedUnit>>;
export type MutableStateKeys = RequireTrue<KeysMatch<DeepMutable<GameState>, SavedState>>;
export type ReadonlyArrayKeys = RequireTrue<KeysMatch<readonly Vec2[], { x: number; y: number }[]>>;
export type ReadonlyRecordKeys = RequireTrue<
  KeysMatch<Readonly<Record<string, Vec2>>, Record<string, { x: number; y: number }>>
>;
export type OptionalKeys = RequireTrue<
  KeysMatch<{ readonly value?: readonly Vec2[] }, { value?: { x: number; y: number }[] }>
>;
export type NullableKeys = RequireTrue<
  KeysMatch<{ value: Vec2 | null }, { value: { x: number; y: number } | null }>
>;
export type UnionKeys = RequireTrue<
  KeysMatch<{ a: number } | { b: string }, { b: number } | { a: string }>
>;
export type ReadonlyTupleKeys = RequireTrue<
  KeysMatch<readonly [Vec2, { note?: string }], [{ x: number; y: number }, { note?: number }]>
>;

// This is explicitly a KEYS contract: broad schema strings and enum-like
// scalar unions keep their existing boundary. These do not prove equal values.
export type PrimitiveDomainsAreNotValidation = RequireTrue<
  KeysMatch<{ id: 'wet' | 'burning'; hp: number }, { id: string; hp: string }>
>;
export type ScalarUnionDomainsAreNotValidation = RequireTrue<KeysMatch<string | number, boolean>>;

// The writable view preserves array/tuple structure and optionality, and is
// assignable to the schema's wider string leaves without an unknown bridge.
type Assignable<From, To> = [From] extends [To] ? true : false;
export type WriterViewAssignable = RequireTrue<Assignable<DeepMutable<GameState>, SavedState>>;
export type MutableViewReturnsReadonly = RequireTrue<Assignable<DeepMutable<GameState>, GameState>>;
export type MutableArrayPreserved = RequireTrue<
  Assignable<DeepMutable<readonly Vec2[]>, { x: number; y: number }[]>
>;
export type MutableTuplePreserved = RequireTrue<
  Assignable<DeepMutable<readonly [Vec2, string?]>, [{ x: number; y: number }, string?]>
>;

// @ts-expect-error A missing root field must fail the real state contract.
export type MissingRoot = RequireTrue<KeysMatch<GameState, Omit<SavedState, 'log'>>>;
// @ts-expect-error Extra optional keys are not silently accepted structurally.
export type ExtraRoot = RequireTrue<KeysMatch<GameState, SavedState & { future?: number }>>;
export type MissingBattle = RequireTrue<
  // @ts-expect-error A missing nested battle field is not masked by battle|null.
  KeysMatch<GameState, WithBattle<Omit<SavedBattle, 'nextUnitSerial'>>>
>;
export type ExtraBattle = RequireTrue<
  // @ts-expect-error Extra optional battle fields fail in the reverse direction too.
  KeysMatch<WithBattle<SavedBattle & { future?: number }>, GameState>
>;
export type MissingUnit = RequireTrue<
  // @ts-expect-error Array item keys include deferred support AP.
  KeysMatch<GameState, WithParty<Omit<SavedUnit, 'pendingAp'>>>
>;
export type ExtraUnit = RequireTrue<
  // @ts-expect-error Extra unit keys cannot hide inside an array.
  KeysMatch<GameState, WithParty<SavedUnit & { future?: boolean }>>
>;
export type MissingRecordValue = RequireTrue<
  // @ts-expect-error Record values are traversed recursively.
  KeysMatch<GameState, WithReturnPositions<Omit<Vec2, 'y'>>>
>;
export type ExtraRecordValue = RequireTrue<
  // @ts-expect-error Optional extra fields inside record values must also fail.
  KeysMatch<GameState, WithReturnPositions<Vec2 & { z?: number }>>
>;
// @ts-expect-error Numeric record keys and string record keys are distinct.
export type RecordKeyDomain = RequireTrue<KeysMatch<Record<string, Vec2>, Record<number, Vec2>>>;
// @ts-expect-error A scalar replacing a structured value changes the shape.
export type ObjectToLeaf = RequireTrue<KeysMatch<{ value: Vec2 }, { value: number }>>;
// @ts-expect-error A structured replacement for a scalar is equally invalid.
export type LeafToObject = RequireTrue<KeysMatch<{ value: number }, { value: Vec2 }>>;
// @ts-expect-error A record cannot masquerade as an array.
export type ArrayToRecord = RequireTrue<KeysMatch<readonly Vec2[], Record<string, Vec2>>>;
// @ts-expect-error Nor can an object replace an array through its item type.
export type ArrayToObject = RequireTrue<KeysMatch<readonly Vec2[], Vec2>>;
// @ts-expect-error Nullability is retained even though primitives end traversal.
export type MissingNullBranch = RequireTrue<KeysMatch<BattleState | null, SavedBattle>>;
// @ts-expect-error Undefined is not interchangeable with null.
export type ChangedNullBranch = RequireTrue<KeysMatch<Vec2 | null, Vec2 | undefined>>;
export type ChangedOptionalMarker = RequireTrue<
  // @ts-expect-error Required-with-undefined and an optional property are distinct.
  KeysMatch<{ value?: Vec2 }, { value: Vec2 | undefined }>
>;
// @ts-expect-error Removing an optional property still removes a recursive key.
export type MissingOptionalKey = RequireTrue<KeysMatch<{ value?: Vec2 }, Record<never, never>>>;
export type MissingUnionMember = RequireTrue<
  // @ts-expect-error A member-only object key cannot disappear from a union.
  KeysMatch<{ a: number } | { b: number }, { a: number }>
>;
// @ts-expect-error Bidirectional matching rejects extra union members too.
export type ExtraUnionMember = RequireTrue<KeysMatch<{ a: number }, { a: number } | { b: number }>>;
export type OptionalUnionMemberKey = RequireTrue<
  // @ts-expect-error An optional extra key in just one member remains visible.
  KeysMatch<{ a: number } | { a: number; b?: string }, { a: number }>
>;
export type ArrayUnionMember = RequireTrue<
  // @ts-expect-error Arrays recurse into union members, not just keyof their union.
  KeysMatch<readonly ({ a: number } | { b: number })[], { a: number }[]>
>;
export type RecordUnionMember = RequireTrue<
  // @ts-expect-error Record values retain union member keys too.
  KeysMatch<Record<string, { a: number } | { b: number }>, Record<string, { a: number }>>
>;
export type ReorderedTupleKeys = RequireTrue<
  // @ts-expect-error Tuple positions retain their own recursive keys.
  KeysMatch<readonly [{ a: number }, { b: number }], [{ b: number }, { a: number }]>
>;
// @ts-expect-error Unknown provides no known structural contract.
export type UnknownShape = RequireTrue<KeysMatch<unknown, Vec2>>;
