/**
 * The title screen's rotating key art.
 *
 * Two stacked layers: the one showing, and the one behind it, which holds only
 * the *next* painting so first paint never waits on all three. While the title
 * sits idle the front layer fades out over the next one; Reduce motion keeps
 * the per-visit pick and never fades.
 */

import { el, motionReduced } from './dom';
import {
  TITLE_ART,
  pickTitleArt,
  titleArtById,
  type TitleArtDef,
  type TitleArtFile,
} from '../titleArt';
import { loadLastTitleArt, saveLastTitleArt } from '../storage/localSaves';

/** How long the title sits on one painting before fading to the next. */
export const TITLE_ART_HOLD_MS = 12000;
const FADE_FALLBACK_MS = 1500;

export interface TitleArtOptions {
  /** Forces the first painting (the test hook behind `?titleArt=`). */
  readonly force?: string | null;
  /** Idle time per painting; 0 never rotates (`?titleArtHold=`). */
  readonly holdMs?: number;
  /** Called as a fade to `next` begins, with the fade's length. */
  readonly onChange?: (next: TitleArtDef, previous: TitleArtDef, fadeMs: number) => void;
}

/** `--dur-title-fade` as milliseconds: the token in base.css is the one place the length lives. */
function fadeMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-title-fade');
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return FADE_FALLBACK_MS;
  return raw.trim().endsWith('ms') ? value : value * 1000;
}

function picture(file: TitleArtFile, portrait: TitleArtFile, base: string): HTMLElement {
  return el(
    'picture',
    {},
    el('source', {
      attrs: {
        media: '(max-aspect-ratio: 9/10)',
        srcset: `${base}${portrait.file}`,
        width: String(portrait.width),
        height: String(portrait.height),
      },
    }),
    el('img', {
      attrs: {
        src: `${base}${file.file}`,
        alt: '',
        width: String(file.width),
        height: String(file.height),
        decoding: 'async',
      },
    }),
  );
}

export class TitleArtRotator {
  /** The decoration: hidden from assistive tech, no alt text. */
  readonly element: HTMLElement;
  private readonly layers: [HTMLElement, HTMLElement];
  private readonly base = `${import.meta.env.BASE_URL}art/title/`;
  private readonly holdMs: number;
  private front: 0 | 1 = 0;
  private shown: TitleArtDef;
  private upcoming: TitleArtDef;
  private timer: number | undefined;
  private settle: number | undefined;
  private stopped = false;

  constructor(private readonly options: TitleArtOptions = {}) {
    this.holdMs = options.holdMs ?? TITLE_ART_HOLD_MS;
    const forced = titleArtById(options.force);
    this.shown = forced ?? pickTitleArt(loadLastTitleArt(), Math.random);
    saveLastTitleArt(this.shown.id);
    this.upcoming = pickTitleArt(this.shown.id, Math.random);

    this.layers = [
      el('div', { class: 'title-art-layer' }),
      el('div', { class: 'title-art-layer' }),
    ];
    this.element = el(
      'div',
      { class: 'title-art', attrs: { 'aria-hidden': 'true' } },
      ...this.layers,
    );
    this.fill(0, this.shown);
    this.layers[0].dataset.active = 'true';
    this.element.dataset.current = this.shown.id;
  }

  get current(): TitleArtDef {
    return this.shown;
  }

  /** Begins the idle timer, and loads the next painting once this one has landed. */
  start(): void {
    if (this.holdMs <= 0 || TITLE_ART.length < 2) return;
    const img = this.layers[0].querySelector('img');
    const preload = () => {
      if (this.stopped) return;
      // Reduce motion never fades, so it never needs the next painting; if it is
      // switched off later, advance() fills the layer on demand.
      if (!motionReduced()) this.fill(1, this.upcoming);
      this.schedule();
    };
    if (!img || img.complete) preload();
    else {
      img.addEventListener('load', preload, { once: true });
      img.addEventListener('error', preload, { once: true });
    }
  }

  stop(): void {
    this.stopped = true;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.settle);
  }

  private fill(layer: 0 | 1, art: TitleArtDef): void {
    const node = this.layers[layer];
    node.dataset.art = art.id;
    node.style.setProperty('--art-focus', art.focus);
    node.style.setProperty('--art-portrait-focus', art.portraitFocus);
    node.replaceChildren(picture(art.wide, art.portrait, this.base));
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.advance(), this.holdMs);
  }

  private advance(): void {
    if (this.stopped) return;
    // A hidden tab, or Reduce motion switched on since the last tick: stay put.
    if (document.hidden || motionReduced()) {
      this.schedule();
      return;
    }
    const back: 0 | 1 = this.front === 0 ? 1 : 0;
    if (this.layers[back].dataset.art !== this.upcoming.id) this.fill(back, this.upcoming);
    const previous = this.shown;
    this.shown = this.upcoming;
    saveLastTitleArt(this.shown.id);
    const ms = fadeMs();
    this.options.onChange?.(this.shown, previous, ms);
    this.layers[this.front].dataset.active = 'false';
    this.layers[back].dataset.active = 'true';
    this.element.dataset.current = this.shown.id;
    this.front = back;

    // Once the fade is done the layer that went out takes the painting after next.
    this.upcoming = pickTitleArt(this.shown.id, Math.random);
    window.clearTimeout(this.settle);
    this.settle = window.setTimeout(() => {
      if (!this.stopped) this.fill(this.front === 0 ? 1 : 0, this.upcoming);
    }, ms);
    this.schedule();
  }
}
