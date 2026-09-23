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
 * `rest_keeper` is not `lw.npc.sen_tea`.
 */

export interface IdentityEntry {
  /** Reserved design key, e.g. 'lw.npc.dema_cook'. Never an NpcDef id. */
  readonly id: string;
  readonly name: string;
}

/**
 * The five missing (ADR 0047 §8): no record, NpcDef or placement exists for
 * them in Slice A, and their keys are reserved so nothing can claim them by
 * accident.
 */
export const EXCLUDED_RESIDENTS: readonly IdentityEntry[] = [
  { id: 'lw.npc.bo_shan', name: 'Bo-shan' },
  { id: 'lw.npc.leto', name: 'Leto' },
  { id: 'lw.npc.amri', name: 'Amri' },
  { id: 'lw.npc.hesra', name: 'Hesra' },
  { id: 'lw.npc.senn', name: 'Senn' },
];

/**
 * The full register: the five missing, plus every other identity that must
 * stay distinct from a name or sprite already in use elsewhere (guide §00.5).
 * `lw.npc.bo` is not `lw.npc.bo_shan`; the road's "Dema" placeholder is not
 * `lw.npc.dema_cook`; the rest stop's "Sen" placeholder is not
 * `lw.npc.sen_tea`, `lw.npc.senn_messenger` or `lw.npc.sena` — those three
 * are three different people who happen to share the coincidence of a name.
 */
export const IDENTITY_REGISTER: readonly IdentityEntry[] = [
  ...EXCLUDED_RESIDENTS,
  { id: 'lw.npc.bo', name: 'Bo' },
  { id: 'lw.npc.dema_cook', name: 'Dema (the cook)' },
  { id: 'lw.npc.sen_tea', name: 'Sen (the tea keeper)' },
  { id: 'lw.npc.senn_messenger', name: 'Senn (a messenger)' },
  { id: 'lw.npc.sena', name: 'Sena' },
];

const REGISTER_IDS: ReadonlySet<string> = new Set(IDENTITY_REGISTER.map((entry) => entry.id));
const EXCLUDED_IDS: ReadonlySet<string> = new Set(EXCLUDED_RESIDENTS.map((entry) => entry.id));

/** True for any of the five missing (ADR 0047 §8). */
export function isExcludedResident(id: string): boolean {
  return EXCLUDED_IDS.has(id);
}

/** True for any reserved design key, excluded or not. */
export function isReservedIdentity(id: string): boolean {
  return REGISTER_IDS.has(id);
}
