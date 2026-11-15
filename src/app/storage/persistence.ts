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

/**
 * The line the title and the Save menu show while saves may be cleared, on a
 * browser that is not an iPad's or iPhone's. Chrome and Edge clear a site only
 * when the disk runs out, so the advice is a copy, not an install.
 */
export const EVICTION_WARNING =
  'This browser may clear saves if it runs out of room. Save a copy to a file to be safe.';

/**
 * The same line in a browser tab on an iPad or iPhone, where the rule is known
 * (`docs/device-matrix.md`, "Where the saves live"): WebKit deletes a site's
 * script-written storage after seven days of browser use without a tap on the
 * site, and exempts a Home Screen web app. The Home Screen app has storage of
 * its own, so the saves have to be carried over as a file: the line says so.
 */
export const TAB_EVICTION_WARNING =
  'Saves made in a browser tab can be cleared after a week without play. Save a copy, then add the game to the Home Screen and load it there.';

/**
 * True on an iPad or iPhone, in Safari and in every other browser there (all
 * of them are WebKit). Two signs, both needed: the platform's own
 * `navigator.standalone` flag is a boolean, and the device has a touch screen.
 * The flag alone is Apple's documented sign of iOS, but no source read for
 * #772 says a Mac's Safari never defines it, so the touch test keeps a Mac
 * (no touch points) on the general wording whatever its Safari does. A wrong
 * no here costs only the mention of the Home Screen, never the warning.
 */
export function onAppleMobile(win: Window | undefined = globalThis.window): boolean {
  const nav = win?.navigator as { standalone?: unknown; maxTouchPoints?: unknown } | undefined;
  return (
    typeof nav?.standalone === 'boolean' &&
    typeof nav.maxTouchPoints === 'number' &&
    nav.maxTouchPoints > 0
  );
}

/** The line to show for what the browser answered and how the game was opened, or null. */
export function evictionWarning(
  persisted: boolean | null,
  standalone: boolean,
  appleMobile: boolean,
): string | null {
  if (!shouldWarnAboutEviction(persisted, standalone)) return null;
  return appleMobile ? TAB_EVICTION_WARNING : EVICTION_WARNING;
}

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
  private answer: boolean | null = null;

  constructor(
    private readonly probe: PersistenceProbe | null,
    private readonly standalone: () => boolean,
    /** Called when the warning appears or goes away. */
    private readonly onChange: () => void = () => {},
    /** Whether this is an iPad or iPhone, which picks the wording. */
    private readonly appleMobile: () => boolean = () => false,
  ) {}

  /** The line to show, or null. */
  get warning(): string | null {
    return evictionWarning(this.persisted, this.standalone(), this.appleMobile());
  }

  /** Whether the browser keeps the storage, as it last said; null where it has not or cannot. */
  get kept(): boolean | null {
    return this.persisted;
  }

  /** What `persist()` answered this run; null until the game has asked and been answered. */
  get askAnswer(): boolean | null {
    return this.answer;
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
    this.answer = this.persisted;
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
