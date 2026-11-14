/**
 * Whether the browser has agreed to keep this game's saves (#772).
 *
 * Every save lives in `localStorage`, and a browser may clear that for a site
 * it has not been asked to keep: Safari on iPadOS does so after days without a
 * visit, unless the game runs from a Home Screen icon. A family that plays
 * every other weekend in a tab could come back to an empty title screen.
 *
 * So the app asks once, after the first save it writes, for persistent
 * storage (`navigator.storage.persist()`), and when the answer is no and the
 * game is not running as an installed app, the title and the Save menu say so
 * in one plain line. A browser without `navigator.storage` behaves exactly as
 * before: no question, no line. None of this is game state; it never reaches
 * `src/core` or a save.
 */

/** The two calls of `navigator.storage` this needs, so tests can stand in for it. */
export interface PersistenceProbe {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
}

/** The line the title and the Save menu show while saves may be cleared. */
export const EVICTION_WARNING =
  'This browser may clear saves it has not been asked to keep. Add the game to the Home Screen to keep them, or export a copy.';

/** `navigator.storage`, when it has both calls; null where it does not exist. */
export function storageProbe(
  nav: Navigator | undefined = globalThis.navigator,
): PersistenceProbe | null {
  const manager = nav?.storage;
  if (!manager || typeof manager.persisted !== 'function' || typeof manager.persist !== 'function')
    return null;
  return {
    persisted: () => manager.persisted(),
    persist: () => manager.persist(),
  };
}

/** True when the game runs as an installed app (a Home Screen icon, an installed PWA). */
export function runningStandalone(win: Window | undefined = globalThis.window): boolean {
  if (!win) return false;
  // iOS Safari's own flag for a Home Screen launch.
  if ((win.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  try {
    return win.matchMedia?.('(display-mode: standalone)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Whether to warn that saves may be cleared: only when the browser has said
 * the storage is not persistent and the game is not running standalone. An
 * unknown answer (no API, or the call failed) never warns.
 */
export function shouldWarnAboutEviction(persisted: boolean | null, standalone: boolean): boolean {
  return persisted === false && !standalone;
}

export class SavePersistence {
  /** The browser's last answer; null until it has given one, or where it cannot. */
  private persisted: boolean | null = null;
  private asked = false;

  constructor(
    private readonly probe: PersistenceProbe | null,
    private readonly standalone: () => boolean,
    /** Called when the warning appears or goes away. */
    private readonly onChange: () => void = () => {},
  ) {}

  /** The line to show, or null. */
  get warning(): string | null {
    return shouldWarnAboutEviction(this.persisted, this.standalone()) ? EVICTION_WARNING : null;
  }

  /** Reads whether storage is already persistent, without asking for it. */
  async check(): Promise<void> {
    const probe = this.probe;
    if (!probe) return;
    await this.settle(() => probe.persisted());
  }

  /**
   * After a save was written: asks the browser to keep the storage, once per
   * run of the app. A browser that grants it without a prompt (or remembers an
   * earlier grant) answers true; one that declines answers false.
   */
  async afterSave(): Promise<void> {
    const probe = this.probe;
    if (!probe || this.asked || this.persisted === true) return;
    this.asked = true;
    await this.settle(() => probe.persist());
  }

  private async settle(read: () => Promise<boolean>): Promise<void> {
    const before = this.warning;
    try {
      this.persisted = (await read()) === true;
    } catch {
      // A browser that throws here is one we know nothing about: no warning.
      this.persisted = null;
    }
    if (this.warning !== before) this.onChange();
  }
}
