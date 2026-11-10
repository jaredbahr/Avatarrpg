/**
 * Compile-time contracts for the save's JSON-shaped state. No runtime exports.
 *
 * KeysMatch checks structural keys, including optional keys, in both
 * directions. Primitive domains deliberately terminate traversal: an enum-like
 * string union and a schema string have the same keys, not the same validation
 * guarantees. Null, undefined, arrays, records and objects remain distinct.
 */

/** A type view only; this neither clones a value nor changes core immutability. */
export type DeepMutable<T> = T extends readonly unknown[]
  ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

export type RequireTrue<T extends true> = T;

type IsAny<T> = 0 extends 1 & T ? true : false;
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Every<Result> = false extends Result ? false : true;
type OptionalKeys<T extends object> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never;
}[keyof T];

type ObjectKeysMatch<A extends object, B extends object> =
  SameSet<keyof A, keyof B> extends true
    ? SameSet<OptionalKeys<A>, OptionalKeys<B>> extends true
      ? Every<
          {
            [K in keyof A]-?: K extends keyof B ? KeysMatch<A[K], B[K]> : false;
          }[keyof A]
        >
      : false
    : false;

/** Exclude array methods on either mutability view, retaining tuple indices. */
type ArrayOwnKeys<T extends readonly unknown[]> = Exclude<keyof T, keyof unknown[]>;
type ArrayKeysMatch<A extends readonly unknown[], B extends readonly unknown[]> =
  SameSet<ArrayOwnKeys<A>, ArrayOwnKeys<B>> extends true
    ? Every<
        {
          [K in ArrayOwnKeys<A>]-?: K extends keyof B ? KeysMatch<A[K], B[K]> : false;
        }[ArrayOwnKeys<A>]
      > extends true
      ? KeysMatch<A[number], B[number]>
      : false
    : false;

/** Compare individual union members, before testing all members both ways. */
type BranchKeysMatch<A, B> = A extends null
  ? B extends null
    ? true
    : false
  : A extends undefined
    ? B extends undefined
      ? true
      : false
    : A extends readonly unknown[]
      ? B extends readonly unknown[]
        ? ArrayKeysMatch<A, B>
        : false
      : A extends object
        ? B extends readonly unknown[]
          ? false
          : B extends object
            ? ObjectKeysMatch<A, B>
            : false
        : A extends string | number | boolean
          ? B extends string | number | boolean
            ? true
            : false
          : false;

type HasMatchingBranch<A, B> = true extends (B extends unknown ? BranchKeysMatch<A, B> : never)
  ? true
  : false;
type AllBranchesMatch<A, B> = Every<A extends unknown ? HasMatchingBranch<A, B> : never>;

/**
 * Exact recursive JSON key compatibility, ignoring readonly modifiers and
 * primitive value domains. Unknown/any cannot provide a known structural
 * contract; never matches only never. Every union member needs a counterpart.
 */
export type KeysMatch<A, B> =
  IsAny<A> extends true
    ? false
    : IsAny<B> extends true
      ? false
      : unknown extends A | B
        ? false
        : [A] extends [never]
          ? [B] extends [never]
            ? true
            : false
          : [B] extends [never]
            ? false
            : AllBranchesMatch<A, B> extends true
              ? AllBranchesMatch<B, A>
              : false;
