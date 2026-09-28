/**
 * The runtime validator: the slice of zod's v3 API that the shipped modules use.
 *
 * Save files, fx recipes, sounds and the combat tuning parse at runtime, and
 * zod cost about 10 KB gzipped of a 320 KB JavaScript gate for the dozen
 * combinators they need (ADR 0060). Everything validated only in CI and dev —
 * `content/schemas.ts`, the bend packer's schemas — stays on real zod.
 *
 * The contract is zod's own, for every combinator here: what passes, the data
 * that comes out (unknown keys stripped, defaults filled, key order), and the
 * order and paths of the issues, because `deserialize` names the first issue's
 * path to the player. `schema.test.ts` holds that line by running the real
 * save, fx, sound and tuning schemas through both this module and zod. Issue
 * messages are plainer than zod's; nothing shows them to a player.
 *
 * A parse returns `ABORT` where zod's result is aborted (the value is not even
 * the right type) and records issues without aborting where zod's is only
 * dirty (a failed bound). The difference is visible: an object with an aborted
 * field skips its refinements, while a dirty one still runs them.
 */

type Path = (string | number)[];

export interface Issue {
  readonly path: Path;
  readonly message: string;
}

export type SafeParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SchemaError };

export class SchemaError extends Error {
  constructor(readonly issues: readonly Issue[]) {
    super(JSON.stringify(issues, null, 2));
  }
}

const ABORT = Symbol('abort');

type Parse = (value: unknown, path: Path, issues: Issue[]) => unknown;

function abort(issues: Issue[], path: Path, message: string): typeof ABORT {
  issues.push({ path, message });
  return ABORT;
}

/** zod's "object": not null, not an array. Everything parsed here is JSON-shaped. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class Schema<O, I = O> {
  declare readonly _output: O;
  declare readonly _input: I;

  constructor(readonly _parse: Parse) {}

  safeParse(value: unknown): SafeParseResult<O> {
    const issues: Issue[] = [];
    const data = this._parse(value, [], issues);
    return issues.length > 0
      ? { success: false, error: new SchemaError(issues) }
      : { success: true, data: data as O };
  }

  parse(value: unknown): O {
    const result = this.safeParse(value);
    if (!result.success) throw result.error;
    return result.data;
  }

  optional(): Schema<O | undefined, I | undefined> {
    return new Schema((v, p, i) => (v === undefined ? v : this._parse(v, p, i)));
  }

  nullable(): Schema<O | null, I | null> {
    return new Schema((v, p, i) => (v === null ? v : this._parse(v, p, i)));
  }

  /** As zod: the default is parsed like any input, so an array comes out a fresh copy. */
  default(value: Exclude<I, undefined>): Schema<Exclude<O, undefined>, I | undefined> {
    return new Schema((v, p, i) => this._parse(v === undefined ? value : v, p, i));
  }

  refine(
    ok: (value: O) => boolean,
    options: { readonly message: string; readonly path?: Path },
  ): Schema<O, I> {
    return new Schema((v, p, i) => {
      const out = this._parse(v, p, i);
      if (out !== ABORT && !ok(out as O)) {
        i.push({ path: [...p, ...(options.path ?? [])], message: options.message });
      }
      return out;
    });
  }
}

type AnySchema = Schema<unknown, unknown>;
type Check<T> = readonly [failed: (value: T) => boolean, message: string];

/** A primitive: a type test that aborts, then bounds that only mark the result dirty. */
function leaf<T>(
  type: string,
  is: (value: unknown) => boolean,
  checks: readonly Check<T>[],
  body?: (value: T, path: Path, issues: Issue[]) => unknown,
): Parse {
  return (v, p, i) => {
    if (!is(v)) return abort(i, p, `Expected ${type}`);
    for (const [failed, message] of checks) if (failed(v as T)) i.push({ path: p, message });
    return body ? body(v as T, p, i) : v;
  };
}

class NumberSchema extends Schema<number> {
  constructor(private readonly checks: readonly Check<number>[] = []) {
    super(leaf('number', (v) => typeof v === 'number' && !Number.isNaN(v), checks));
  }
  private check(failed: (n: number) => boolean, message: string): NumberSchema {
    return new NumberSchema([...this.checks, [failed, message]]);
  }
  int(): NumberSchema {
    return this.check((n) => !Number.isInteger(n), 'Expected an integer');
  }
  finite(): NumberSchema {
    return this.check((n) => !Number.isFinite(n), 'Expected a finite number');
  }
  min(bound: number): NumberSchema {
    return this.check((n) => n < bound, `Expected at least ${bound}`);
  }
  max(bound: number): NumberSchema {
    return this.check((n) => n > bound, `Expected at most ${bound}`);
  }
  gt(bound: number): NumberSchema {
    return this.check((n) => n <= bound, `Expected more than ${bound}`);
  }
  positive(): NumberSchema {
    return this.gt(0);
  }
}

class StringSchema extends Schema<string> {
  constructor(private readonly checks: readonly Check<string>[] = []) {
    super(leaf('string', (v) => typeof v === 'string', checks));
  }
  min(length: number): StringSchema {
    return new StringSchema([...this.checks, [(s) => s.length < length, `Too short`]]);
  }
  max(length: number): StringSchema {
    return new StringSchema([...this.checks, [(s) => s.length > length, `Too long`]]);
  }
}

class ArraySchema<T extends AnySchema> extends Schema<T['_output'][], T['_input'][]> {
  constructor(
    private readonly item: T,
    private readonly checks: readonly Check<unknown[]>[] = [],
  ) {
    super(
      leaf('array', Array.isArray, checks, (items, p, i) => {
        let aborted = false;
        const out = items.map((v, k) => {
          const r = item._parse(v, [...p, k], i);
          if (r === ABORT) aborted = true;
          return r;
        });
        return aborted ? ABORT : out;
      }),
    );
  }
  min(length: number): ArraySchema<T> {
    return new ArraySchema(this.item, [...this.checks, [(a) => a.length < length, 'Too few']]);
  }
  max(length: number): ArraySchema<T> {
    return new ArraySchema(this.item, [...this.checks, [(a) => a.length > length, 'Too many']]);
  }
}

type Shape = Record<string, AnySchema>;
type OptionalKeys<T> = { [K in keyof T]: undefined extends T[K] ? K : never }[keyof T];
type Flatten<T> = { [K in keyof T]: T[K] } & {};
/** zod's `addQuestionMarks`: a key whose value may be undefined may be absent. */
type Keyed<T> = Flatten<
  { [K in Exclude<keyof T, OptionalKeys<T>>]: T[K] } & { [K in OptionalKeys<T>]?: T[K] }
>;
type ObjectOutput<S extends Shape> = Keyed<{ [K in keyof S]: S[K]['_output'] }>;
type ObjectInput<S extends Shape> = Keyed<{ [K in keyof S]: S[K]['_input'] }>;
type AllOptional<S extends Shape> = {
  [K in keyof S]: Schema<S[K]['_output'] | undefined, S[K]['_input'] | undefined>;
};

class ObjectSchema<S extends Shape> extends Schema<ObjectOutput<S>, ObjectInput<S>> {
  constructor(
    readonly shape: S,
    strict = false,
  ) {
    const fields = Object.entries(shape);
    const keys = Object.keys(shape);
    super((v, p, i) => {
      if (!isObject(v)) return abort(i, p, 'Expected object');
      const out: Record<string, unknown> = {};
      let aborted = false;
      for (const [key, field] of fields) {
        const r = field._parse(v[key], [...p, key], i);
        if (r === ABORT) aborted = true;
        // As zod: an undefined result is kept only when the input had the key.
        else if (r !== undefined || key in v) out[key] = r;
      }
      if (strict) {
        const extra: string[] = [];
        for (const key in v) if (!keys.includes(key)) extra.push(key);
        if (extra.length > 0)
          i.push({ path: p, message: `Unrecognized keys: ${extra.join(', ')}` });
      }
      return aborted ? ABORT : out;
    });
  }
  strict(): ObjectSchema<S> {
    return new ObjectSchema(this.shape, true);
  }
  partial(): ObjectSchema<AllOptional<S>> {
    const shape: Record<string, AnySchema> = {};
    for (const [key, schema] of Object.entries(this.shape)) shape[key] = schema.optional();
    return new ObjectSchema(shape as AllOptional<S>);
  }
}

export function number(): NumberSchema {
  return new NumberSchema();
}

export function string(): StringSchema {
  return new StringSchema();
}

export function boolean(): Schema<boolean> {
  return new Schema(leaf('boolean', (v) => typeof v === 'boolean', []));
}

export function literal<const T extends string | number | boolean>(value: T): Schema<T> {
  return new Schema((v, p, i) => (v === value ? v : abort(i, p, `Expected ${String(value)}`)));
}

function enumType<const T extends readonly [string, ...string[]]>(values: T): Schema<T[number]> {
  return new Schema((v, p, i) =>
    typeof v === 'string' && values.includes(v) ? v : abort(i, p, `Expected one of ${values}`),
  );
}

export function array<T extends AnySchema>(item: T): ArraySchema<T> {
  return new ArraySchema(item);
}

export function object<S extends Shape>(shape: S): ObjectSchema<S> {
  return new ObjectSchema(shape);
}

/** zod v3's single-argument record: string keys, `__proto__` dropped. */
export function record<T extends AnySchema>(
  value: T,
): Schema<Record<string, T['_output']>, Record<string, T['_input']>> {
  return new Schema((v, p, i) => {
    if (!isObject(v)) return abort(i, p, 'Expected object');
    const out: Record<string, unknown> = {};
    let aborted = false;
    for (const key in v) {
      const r = value._parse(v[key], [...p, key], i);
      if (r === ABORT) aborted = true;
      else if (key !== '__proto__') out[key] = r;
    }
    return aborted ? ABORT : out;
  });
}

export function tuple<T extends [AnySchema, ...AnySchema[]]>(
  items: T,
): Schema<{ [K in keyof T]: T[K]['_output'] }, { [K in keyof T]: T[K]['_input'] }> {
  return new Schema((v, p, i) => {
    if (!Array.isArray(v)) return abort(i, p, 'Expected array');
    if (v.length < items.length) return abort(i, p, 'Too few');
    if (v.length > items.length) i.push({ path: p, message: 'Too many' });
    let aborted = false;
    const out = items.map((item, k) => {
      const r = item._parse(v[k], [...p, k], i);
      if (r === ABORT) aborted = true;
      return r;
    });
    return aborted ? ABORT : out;
  });
}

/**
 * The first option that passes cleanly; else, as zod, the first that failed
 * only a bound, with its issues; else one issue at the union itself.
 */
export function union<const T extends readonly AnySchema[]>(
  options: T,
): Schema<T[number]['_output'], T[number]['_input']> {
  return new Schema((v, p, i) => {
    let dirty: [unknown, Issue[]] | undefined;
    for (const option of options) {
      const local: Issue[] = [];
      const r = option._parse(v, p, local);
      if (local.length === 0) return r;
      if (r !== ABORT) dirty ??= [r, local];
    }
    if (!dirty) return abort(i, p, 'Invalid input');
    i.push(...dirty[1]);
    return dirty[0];
  });
}

/** Chooses the option by its literal `key`; an unknown key is one issue at that key. */
export function discriminatedUnion<const T extends readonly ObjectSchema<Shape>[]>(
  key: string,
  options: T,
): Schema<T[number]['_output'], T[number]['_input']> {
  return new Schema((v, p, i) => {
    if (!isObject(v)) return abort(i, p, 'Expected object');
    const option = options.find((o) => {
      const discriminator = o.shape[key];
      return discriminator !== undefined && discriminator._parse(v[key], [], []) !== ABORT;
    });
    return option ? option._parse(v, p, i) : abort(i, [...p, key], 'Invalid discriminator');
  });
}

type Infer<T extends AnySchema> = T['_output'];
type Input<T extends AnySchema> = T['_input'];

export { enumType as enum };
export type { Infer as infer, Input as input };
