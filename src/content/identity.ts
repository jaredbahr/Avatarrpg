/**
 * The identity register (ADR 0047 W0).
 *
 * Reserves the design-key namespace ('lw.npc.<slug>') for every named person
 * the living-world guide expects, whether or not they have a runtime NpcDef
 * yet. Slice A's living cast (Mira, Gao, Pella, Dorin, Hanru) gets its
 * resident ids in a later work item (W4a) — this register exists ahead of
 * that so `validateContent` can already reject content that reaches for an
 * excluded name, or that collides two design identities that must stay
 * distinct (guide §00.5).
 *
 * Today's `dema` and `rest_keeper` NpcDefs (`src/content/maps/world.ts`) wear
 * borrowed names and sprites as placeholders. They are not bound to any entry
 * here, and must never be: `dema` is not `lw.npc.dema_cook`, and
 * `rest_keeper` is not `lw.npc.sen_tea`. `FORBIDDEN_BINDINGS` below records
 * that for W4a, the work item that does the real binding.
 *
 * A real runtime `NpcDef.id` is never the design key itself — it looks like
 * `dema` or `elder_mira`, not `lw.npc.dema_cook`. `runtimeSlugs` lists every
 * bare id an identity is known, or anticipated, to appear under; `names`
 * lists every display name it is known, or anticipated, to appear under.
 * Either one matching an excluded entry is a claim on that identity.
 */

export interface IdentityEntry {
  /** Reserved design key, e.g. 'lw.npc.dema_cook'. Never an NpcDef id. */
  readonly id: string;
  readonly name: string;
  /**
   * Display names (usually just `[name]`) that count as claiming this
   * identity when they show up as an `NpcDef.name`.
   */
  readonly names: readonly string[];
  /**
   * Bare runtime `NpcDef.id` values (no `lw.npc.` prefix) that count as
   * claiming this identity — either because a real NpcDef already uses one,
   * or because it is an anticipated future id worth reserving now.
   */
  readonly runtimeSlugs: readonly string[];
}

/**
 * The seven missing (ADR 0047 §8, and Hesh/Miri added under the W0-W3
 * review): no record, NpcDef or placement exists for them in Slice A, and
 * their keys are reserved so nothing can claim them by accident.
 */
export const EXCLUDED_RESIDENTS: readonly IdentityEntry[] = [
  { id: 'lw.npc.bo_shan', name: 'Bo-shan', names: ['Bo-shan'], runtimeSlugs: ['bo_shan'] },
  { id: 'lw.npc.leto', name: 'Leto', names: ['Leto'], runtimeSlugs: ['leto'] },
  { id: 'lw.npc.amri', name: 'Amri', names: ['Amri'], runtimeSlugs: ['amri'] },
  { id: 'lw.npc.hesra', name: 'Hesra', names: ['Hesra'], runtimeSlugs: ['hesra'] },
  { id: 'lw.npc.senn', name: 'Senn', names: ['Senn'], runtimeSlugs: ['senn'] },
  // The quarry bench carving (`src/content/story/discoveries.ts`) names
  // "Hesh" without ever placing them — distinct from Hesra above.
  { id: 'lw.npc.hesh', name: 'Hesh', names: ['Hesh'], runtimeSlugs: ['hesh'] },
  // Distinct from the bound elder, `lw.npc.mira` below.
  { id: 'lw.npc.miri', name: 'Miri', names: ['Miri'], runtimeSlugs: ['miri'] },
];

/**
 * The full register: the seven missing, plus every other identity that must
 * stay distinct from a name or sprite already in use elsewhere (guide
 * §00.5). `lw.npc.bo` is not `lw.npc.bo_shan`; the road's "Dema, road
 * keeper" placeholder (`runtimeSlugs: ['dema']`) is not `lw.npc.dema_cook`;
 * the rest stop's "Sen" placeholder is not `lw.npc.sen_tea`,
 * `lw.npc.senn_messenger` or `lw.npc.sena` — those three are three
 * different people who happen to share the coincidence of a name.
 */
export const IDENTITY_REGISTER: readonly IdentityEntry[] = [
  ...EXCLUDED_RESIDENTS,
  { id: 'lw.npc.bo', name: 'Bo', names: ['Bo'], runtimeSlugs: ['bo'] },
  {
    id: 'lw.npc.dema_cook',
    name: 'Dema (the cook)',
    names: ['Dema (the cook)'],
    runtimeSlugs: [],
  },
  {
    id: 'lw.npc.sen_tea',
    name: 'Sen (the tea keeper)',
    names: ['Sen (the tea keeper)'],
    runtimeSlugs: [],
  },
  {
    id: 'lw.npc.senn_messenger',
    name: 'Senn (a messenger)',
    names: ['Senn (a messenger)'],
    runtimeSlugs: [],
  },
  { id: 'lw.npc.sena', name: 'Sena', names: ['Sena'], runtimeSlugs: [] },
  // The bound elder — `elder_mira` (village) and `riverside_mira`
  // (riverside) are the same person on two maps. Distinct from Miri above.
  {
    id: 'lw.npc.mira',
    name: 'Mira',
    names: ['Mira', 'Elder Mira'],
    runtimeSlugs: ['elder_mira', 'riverside_mira'],
  },
  // The forest road's "Dema, road keeper" — distinct from the cook above.
  {
    id: 'lw.npc.dema_roadkeeper',
    name: 'Dema (the road-keeper)',
    names: ['Dema, road keeper'],
    runtimeSlugs: ['dema'],
  },
];

/**
 * Runtime NpcDef ids that must never be bound to the listed design
 * identities, because today's placeholder name is a coincidence, not a
 * claim (see the module doc). `validateContent` rejects the binding from
 * either side: a resident listing the runtime id, or the NpcDef's `resident`.
 */
export const FORBIDDEN_BINDINGS: Readonly<Record<string, readonly string[]>> = {
  dema: ['lw.npc.dema_cook'],
  rest_keeper: ['lw.npc.sen_tea'],
};

const REGISTER_IDS: ReadonlySet<string> = new Set(IDENTITY_REGISTER.map((entry) => entry.id));
const EXCLUDED_IDS: ReadonlySet<string> = new Set(EXCLUDED_RESIDENTS.map((entry) => entry.id));

/** True for any of the seven missing (ADR 0047 §8). */
export function isExcludedResident(id: string): boolean {
  return EXCLUDED_IDS.has(id);
}

/** True for any reserved design key, excluded or not. */
export function isReservedIdentity(id: string): boolean {
  return REGISTER_IDS.has(id);
}

/**
 * The excluded entry an NpcDef claims, by runtime id or by display name, or
 * undefined if it claims none. `npc.id` is checked both as-is (a real
 * runtime id, e.g. `bo_shan`) and as a design key (`lw.npc.bo_shan`), since
 * either would be a mistake.
 */
export function excludedResidentFor(npcId: string, npcName: string): IdentityEntry | undefined {
  return EXCLUDED_RESIDENTS.find(
    (entry) =>
      entry.id === npcId || entry.runtimeSlugs.includes(npcId) || entry.names.includes(npcName),
  );
}
