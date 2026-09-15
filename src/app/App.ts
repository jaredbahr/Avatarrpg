/**
 * The application.
 *
 * Owns the single source of truth (`GameState`), routes it to a scene, and is
 * the only thing that calls `apply()`. Scenes render and raise intent; they
 * never edit state.
 *
 *   scene -> app.dispatch(command) -> core.apply() -> events -> animator
 *                                                  -> new state -> scene.sync()
 */

import type { Command, ContentIndex, GameEvent, GameState, StoryNode } from '../core/types';
import { apply } from '../core/state/reducer';
import { createGame } from '../core/state/createGame';
import type { PartySlot } from '../core/state/createGame';
import { Animator } from './animator';
import { Session } from './session';
import type { Player } from './session';
import type { Settings, SlotId } from './storage/localSaves';
import {
  AUTOSAVE_ID,
  applySettings,
  loadSettings,
  saveSettings,
  saveToSlot,
} from './storage/localSaves';
import { describeProgress } from '../core/save/serialize';
import { reconcileDisciplines } from '../core/save/reconcile';
import type { SessionMeta } from '../core/save/serialize';
import { announce, clear, el } from './ui/dom';
import { Toasts } from './ui/Toasts';
import { Stats } from './ui/Stats';
import { PauseMenu } from './ui/PauseMenu';
import { LevelUpDialog } from './ui/LevelUpDialog';
import { DisciplineDialog } from './ui/DisciplineDialog';
import { TitleScene } from './scenes/TitleScene';
import { PartySetupScene } from './scenes/PartySetupScene';
import { DialogueScene } from './scenes/DialogueScene';
import { ExploreScene } from './scenes/ExploreScene';
import { CombatScene } from './scenes/CombatScene';

/** What `rendererCamera()` reports: tile size and offset in CSS px, and whether the whole board is on screen. */
export interface CameraInfo {
  readonly tilePx: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly fitted: boolean;
}

export interface Scene {
  readonly name: string;
  mount(host: HTMLElement): void;
  unmount(): void;
  /** Called after every state change. */
  sync(): void;
  resize?(): void;
}

export class App {
  readonly animator: Animator;
  readonly session = new Session();
  readonly toasts: Toasts;
  /** Frame-time readout, present only with `?stats=1`. */
  readonly stats: Stats | null;

  settings: Settings;
  state: GameState | null = null;

  private host: HTMLElement;
  private sceneHost: HTMLElement;
  private overlayHost: HTMLElement;
  private scene: Scene | null = null;
  private pause: PauseMenu | null = null;
  private levelUp: LevelUpDialog | DisciplineDialog | null = null;
  /** Set while a battle is being resolved, so it cannot double-fire. */
  private resolving = false;
  private resizeQueued = false;

  constructor(
    readonly content: ContentIndex,
    root: HTMLElement,
    readonly storyEntry: string,
  ) {
    this.host = root;
    this.animator = new Animator(content);
    this.settings = loadSettings();
    applySettings(this.settings);

    clear(root);
    this.sceneHost = el('div', { class: 'scene-host' });
    this.overlayHost = el('div', { class: 'overlay-host' });
    root.appendChild(this.sceneHost);
    root.appendChild(this.overlayHost);

    this.toasts = new Toasts(this.overlayHost);
    this.stats = Stats.enabled() ? new Stats(this.overlayHost) : null;

    window.addEventListener('resize', () => this.requestResize());
    window.addEventListener('orientationchange', () => this.requestResize());
    // iOS Safari's toolbars come and go without a window resize; the visual
    // viewport is what actually changed.
    window.visualViewport?.addEventListener('resize', () => this.requestResize());
  }

  /**
   * Resizes the mounted scene once per frame however many signals ask for it:
   * a rotation fires resize, orientationchange, a visual-viewport change and
   * the map wrapper's ResizeObserver within the same tick.
   */
  requestResize(): void {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    requestAnimationFrame(() => {
      this.resizeQueued = false;
      this.scene?.resize?.();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Scenes                                                            */
  /* ---------------------------------------------------------------- */

  start(): void {
    this.showScene(new TitleScene(this));
  }

  showScene(scene: Scene): void {
    this.scene?.unmount();
    clear(this.sceneHost);
    this.scene = scene;
    this.host.dataset.scene = scene.name;
    scene.mount(this.sceneHost);
    scene.sync();
  }

  /** Picks the scene the current state calls for. Idempotent. */
  private routeToState(): void {
    const state = this.state;
    if (!state) return;

    const wanted =
      state.screen === 'combat'
        ? 'combat'
        : state.screen === 'explore'
          ? 'explore'
          : state.screen === 'dialogue' || state.screen === 'ended'
            ? 'dialogue'
            : 'title';

    if (this.scene?.name === wanted) {
      this.scene.sync();
      return;
    }

    switch (wanted) {
      case 'combat':
        this.showScene(new CombatScene(this));
        break;
      case 'explore':
        this.showScene(new ExploreScene(this));
        break;
      case 'dialogue':
        this.showScene(new DialogueScene(this));
        break;
      default:
        this.showScene(new TitleScene(this));
        break;
    }
  }

  goToSetup(): void {
    this.showScene(new PartySetupScene(this));
  }

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  newGame(players: readonly Player[], slots: readonly PartySlot[], seed?: string): void {
    const state = createGame(this.content, {
      seed: seed ?? `${Date.now()}-${players.map((p) => p.name).join('-')}`,
      party: slots,
      startNode: this.storyEntry,
    });

    this.session.setPlayers(
      players.map((player, index) => ({
        name: player.name,
        unitId: state.party[index]?.id ?? `p${index}`,
      })),
    );

    this.state = state;
    this.animator.clear();
    this.dispatch({ type: 'enterNode', nodeId: this.storyEntry });
  }

  /** Installs a loaded save, replacing everything. */
  adoptSave(state: GameState, session: SessionMeta | undefined): void {
    // A save can predate a discipline gate the kits have since gained; this
    // hands back any pick the party is owed rather than swallowing it.
    this.state = reconcileDisciplines(this.content, state);
    this.session.setPlayers(Session.fromMeta(session).players);
    this.animator.clear();
    this.closePause();
    this.routeToState();
    this.toasts.show('Game loaded.');
  }

  /**
   * The one place a command reaches the rules.
   *
   * Events are handed to the animator before the scene re-reads state, so a
   * move animates from where the unit was rather than snapping.
   */
  dispatch(command: Command): readonly GameEvent[] {
    const state = this.state;
    if (!state) return [];

    const unitsBefore = state.battle?.units ?? [];
    const result = apply(this.content, state, command);
    this.state = result.state;

    if (result.events.length > 0) {
      this.animator.push(performance.now(), result.events, unitsBefore);
    }

    this.announceImportant(result.events);
    this.routeToState();
    this.offerLevelUpIfPending();
    this.autosaveIfWorthIt(command, result.events);

    return result.events;
  }

  /** Reads out the events a player must not miss, for screen readers. */
  private announceImportant(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'battleEnded') {
        announce(event.outcome === 'victory' ? 'The fight is won.' : 'The party has fallen.');
      }
      if (event.type === 'message') this.toasts.show(event.text);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Level-up                                                          */
  /* ---------------------------------------------------------------- */

  offerLevelUpIfPending(): void {
    const state = this.state;
    if (!state || state.pendingChoices.length === 0) return;
    if (this.levelUp) return;
    // Never interrupt a fight with a menu; choices wait for the story beat.
    if (state.screen === 'combat') return;

    const choice = state.pendingChoices[0];
    if (!choice) return;

    const done = () => {
      this.levelUp = null;
      // More than one member may have levelled in the same fight.
      this.offerLevelUpIfPending();
    };

    this.levelUp =
      choice.kind === 'discipline'
        ? new DisciplineDialog(this, choice, done)
        : new LevelUpDialog(this, choice, done);
    this.levelUp.open(this.overlayHost);
  }

  /* ---------------------------------------------------------------- */
  /* Pause and settings                                                */
  /* ---------------------------------------------------------------- */

  openPause(): void {
    if (this.pause || !this.state) return;
    this.pause = new PauseMenu(this, () => {
      this.pause = null;
    });
    this.pause.open(this.overlayHost);
  }

  closePause(): void {
    this.pause?.close();
    this.pause = null;
  }

  updateSettings(next: Partial<Settings>): void {
    this.settings = { ...this.settings, ...next };
    applySettings(this.settings);
    saveSettings(this.settings);
    this.scene?.resize?.();
    this.scene?.sync();
  }

  /* ---------------------------------------------------------------- */
  /* Saving                                                            */
  /* ---------------------------------------------------------------- */

  currentNode(): StoryNode | undefined {
    const id = this.state?.story.nodeId;
    return id ? this.content.story.get(id) : undefined;
  }

  /** Human-readable "where are we", for save slot buttons and the pause menu. */
  placeLabel(): string {
    const state = this.state;
    if (!state) return 'No game';
    if (state.battle) {
      return this.content.encounters.get(state.battle.encounterId)?.name ?? 'In battle';
    }
    const map = this.content.maps.get(state.location.mapId);
    if (map) return map.name;
    const node = this.currentNode();
    if (node?.kind === 'dialogue' || node?.kind === 'choice') return node.speaker;
    return 'On the road';
  }

  saveSummary(): string {
    const state = this.state;
    if (!state) return '';
    return describeProgress(state, this.placeLabel());
  }

  saveTo(slot: SlotId, label?: string): boolean {
    const state = this.state;
    if (!state) return false;
    const result = saveToSlot(slot, state, {
      label: label ?? this.placeLabel(),
      summary: this.saveSummary(),
      session: this.session.toMeta(),
    });
    if (!result.ok && result.error) this.toasts.show(result.error, 'warn');
    return result.ok;
  }

  /**
   * Autosaves at the moments a family would be upset to lose: after a fight
   * resolves, and on entering a new story node. Not every command — writing
   * localStorage on every tile step would be wasteful and janky.
   */
  private autosaveIfWorthIt(command: Command, events: readonly GameEvent[]): void {
    if (!this.state) return;
    const worthwhile =
      command.type === 'resolveBattle' ||
      events.some((e) => e.type === 'storyNodeEntered' || e.type === 'battleEnded');
    if (!worthwhile) return;
    this.saveTo(AUTOSAVE_ID, `Autosave — ${this.placeLabel()}`);
  }

  /**
   * Current map camera, as plain numbers.
   *
   * Exposed so the e2e suite can work out which screen pixel a tile is under
   * and tap it the way a finger would, instead of guessing at fractions of the
   * canvas. Returns null when no map scene is mounted.
   */
  rendererCamera(): CameraInfo | null {
    const scene = this.scene as unknown as { cameraInfo?: () => CameraInfo | null };
    return scene?.cameraInfo?.() ?? null;
  }

  /**
   * Which rendering backend the mounted map scene chose. Null when no map is
   * up. Exposed so the e2e suite can assert on the choice rather than infer it.
   */
  rendererBackend(): 'webgl' | 'canvas' | null {
    const scene = this.scene as unknown as {
      renderer?: { backendName: 'webgl' | 'canvas' };
    };
    return scene?.renderer?.backendName ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* Battle resolution                                                 */
  /* ---------------------------------------------------------------- */

  /** Called by CombatScene once the player has read the result panel. */
  resolveBattle(): void {
    if (this.resolving) return;
    this.resolving = true;
    try {
      this.dispatch({ type: 'resolveBattle' });
    } finally {
      this.resolving = false;
    }
  }
}
