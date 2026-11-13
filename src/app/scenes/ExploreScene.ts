/**
 * The village.
 *
 * Tap a tile to walk, tap someone to talk, tap the glowing gate to leave. The
 * party and their health sit in the bottom dock beside the available actions.
 * The world uses the full screen width, and the objective sits in
 * the banner at the top so nobody has to remember what they were doing when
 * they picked the tablet back up. The camera pans by drag because the village
 * is bigger than the viewport.
 */

import { RIVERSIDE_ID } from '../../content/maps/riverside';
import { npcPresentationScale, triggerPresentationScale } from './exploreMarkerScale';
import { evaluate } from '../../core/story/conditions';
import {
  activeTriggers,
  backgroundFigures,
  visibleNpcs,
  worldObjective,
  worldObjectiveTargetId,
} from '../../core/story/world';
import type { PlacedNpc } from '../../core/story/world';
import { VillageLife } from '../village/VillageLife';
import type { App, CameraInfo, Scene } from '../App';
import type { GameEvent, GameState, Grid, MapDef, Unit, Vec2 } from '../../core/types';
import { buildGrid, distance, samePos } from '../../core/rules/grid';
import { Renderer } from '../../render/renderer';
import { exploreTilePx, usesIntegerZoom } from '../../render/projection';
import type { MapView, NpcMarker, RenderUnit } from '../../render/renderer';
import { createRoutePreview, displayedRoute, updateRoutePreview } from '../../render/routePreview';
import { idlePhase } from '../../render/sheets/store';
import { resolveAsset, sheetLocomotion } from '../../content/assets/manifest';
import { authoredForBothSides } from '../../content/assets/clips';
import { FOOT_LINE } from '../../render/sheets/bake';
import { placeFrame } from '../../render/sheets/placement';
import { npcClip } from '../../render/view';
import { npcPipLift } from '../../render/npcPip';
import type { RoutePreview } from '../../render/routePreview';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { ambienceFx } from '../../content/fx';
import { ambientEmitters, waterCells } from '../anim/ambience';
import { PartyTrail, placeParty } from '../anim/trail';
import type { FollowerRoute } from '../anim/trail';
import { append, button, clear, el, mark, motionReduced } from '../ui/dom';
import { ABILITY_MARKS, UI_MARKS } from '../ui/marks';
import { partyRoster } from '../ui/PartyRoster';
import { SaveMenu } from '../ui/SaveMenu';
import { UnitInspector } from '../ui/UnitInspector';
import { TravelJournal } from '../ui/TravelJournal';
import { WaitDialog } from '../ui/WaitDialog';
import { showGridLines } from '../storage/localSaves';
import { NextWalk, previewWalk } from '../world/walking';
import type { WalkPreview } from '../world/walking';
import { nearbyExits, nearbyExploreTarget, TALK_RANGE } from '../world/guidance';
import { partyWalkPhase } from '../animator';
import {
  createExploreObjectivePresentation,
  syncExploreObjective,
  toggleExploreObjective,
  walkExploreObjective,
} from './exploreObjective';
import { drawObjectivePointer, resolveObjectivePointerTarget } from './objectivePointer';
import { handoverBark } from '../world/barks';
import { seatHere } from '../world/waiting';
import { phaseLabel } from '../world/journal';
import { NearbyPlaces } from '../ui/NearbyPlaces';
import { LocalMap, LocalMapDialog } from '../ui/LocalMap';
import { courtyardEnvironment } from '../audio/environment';
import { partyScale } from '../anim/actorScale';
import { worldConversationFor } from '../../content/story/presentations';
import { conversationPanel } from '../ui/ConversationPanel';
import { sheets } from '../../render/sheets/store';
import { backdrops } from '../../render/backdrops';
import { sceneImages } from '../../render/scene';
import {
  hasPractice,
  practiceAt,
  PRACTICE_GLIDE_MS,
  glidePoint,
  practiceCasts,
  practiceEvents,
  practiceFrame,
  practiceSources,
  practiceUnits,
} from '../world/practice';

export class ExploreScene implements Scene {
  readonly name = 'explore';

  private life: VillageLife | null = null;
  private localMap: LocalMap | null = null;
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: Renderer | null = null;
  private detach: (() => void) | null = null;
  private frame = 0;
  private suspended = false;
  private paintingStill = false;

  /**
   * The units of the last published frame, so a resize can repaint the life
   * layer without waiting for the render loop to come round again.
   */
  private lastLife: { units: readonly RenderUnit[]; now: number } | null = null;
  private hover: Vec2 | null = null;
  private map: MapDef | null = null;
  /** Built once per map, not once per frame: the village never changes shape. */
  private grid: Grid | null = null;
  /**
   * Where the followers stand: the leader's tile and the tiles it came from,
   * one member each. Presentation only, never saved; stood up again behind
   * the leader whenever the party lands somewhere without walking there.
   */
  private trail: PartyTrail | null = null;
  private needsSettle = true;
  private hudMoving = false;
  private departing: GameState | null = null;
  private nextWalk = new NextWalk();
  private walking: WalkPreview | null = null;
  private routePreview: RoutePreview | null = null;
  private feedback: HTMLElement | null = null;
  private feedbackText: HTMLElement | null = null;
  private cancelNext: HTMLButtonElement | null = null;
  /** The last canvas box, so a reflow keeps the same world point in view. */
  private viewSize: { width: number; height: number } | null = null;
  private framingArrival = false;
  /** True while a registered world conversation sits over this map. */
  private conversationMode = false;
  /**
   * The people drawn last frame, each with the tile a tap on them walks to
   * (ADR 0047 §7): a walking resident's rules tile, so a tap targets where
   * they are going. Someone walking off the map has none and is not listed.
   */
  private targets: { readonly at: Vec2; readonly scale: number; readonly to: Vec2 }[] = [];
  /** The markers drawn last frame; the e2e suite reads them. */
  lastNpcs: readonly NpcMarker[] = [];
  /** This scene warmed the party's bends for a practice ground, and lets them go on leaving. */
  private warmedBends = false;
  /** A bending practice is playing (issue #284); presentation only. */
  private practising = false;
  /**
   * The camera's glide onto a practice and back: at the explore zoom the
   * leader alone fills the view, so the camera frames the benders and their
   * mark while they bend, then returns to the leader.
   */
  private practiceCamera: { from: Vec2; to: Vec2; start: number; back: boolean } | null = null;
  /** Whether the HUD last drew the practice action ready, so it redraws once the bends are in. */
  private practiceShown: boolean | null = null;
  /** Objective presentation is ephemeral and keyed by objective text, never saved. */
  private objectivePresentation = createExploreObjectivePresentation();
  private objectiveButton: HTMLButtonElement | null = null;
  private objectivePointer: HTMLDivElement | null = null;
  private npcNames: HTMLDivElement | null = null;
  private mapCorner: HTMLDivElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;

  constructor(private app: App) {}

  drawnMapId(): string | null {
    return this.map?.id ?? null;
  }

  /** The map's painting and every piece of its scene, loaded or failed. */
  firstFrameReady(): Promise<unknown> {
    const map = this.map;
    if (!map) return Promise.resolve();
    const backdrop = this.app.backdropFor(map.id);
    const pieces = map.scene ? [...map.scene.ground, ...map.scene.scenery] : [];
    return Promise.all([
      backdrop ? backdrops.whenLoaded(backdrop.url) : Promise.resolve(true),
      ...[...new Set(pieces.map((piece) => piece.url))].map((url) => sceneImages.whenLoaded(url)),
    ]);
  }

  firstFrameSheetKeys(): readonly string[] {
    const { content, state } = this.app;
    const map = this.map;
    if (!state || !map) return [];
    // In-place travel asks before the first draw of the destination.
    return [
      ...state.party.map((member) => member.sprite),
      ...visibleNpcs(content, map, state).map((npc) => npc.sprite),
      ...backgroundFigures(content, map, state).map((role) => role.sprite),
      ...activeTriggers(map, state).map((trigger) => trigger.sprite),
      ...this.lastNpcs.map((npc) => npc.sprite),
    ];
  }

  mount(host: HTMLElement): void {
    this.suspended = false;
    this.host = host;
    clear(host);
    this.conversationMode = Boolean(worldConversationFor(this.app.content, this.app.state));

    const scene = el('div', { class: 'scene explore-scene' });
    this.objectiveButton = button('', () => this.toggleObjective(), {
      class: 'explore-objective',
    });
    this.objectiveButton.setAttribute('aria-expanded', 'true');
    this.objectiveButton.hidden = true;
    scene.appendChild(
      el(
        'div',
        { class: 'top-bar explore-bar' },
        el('div', { class: 'explore-bar-main' }),
        this.objectiveButton,
      ),
    );

    const canvas = el('canvas', { class: 'map-canvas', attrs: { 'aria-label': 'Village map' } });
    this.canvas = canvas;
    scene.appendChild(
      el(
        'div',
        { class: 'explore-body' },
        el(
          'div',
          { class: 'map-wrap' },
          canvas,
          (this.objectivePointer = el('div', {
            class: 'objective-edge-pointer',
            hidden: true,
            attrs: { role: 'img' },
          })),
          (this.npcNames = el('div', {
            class: 'explore-npc-names',
            attrs: { 'aria-hidden': 'true' },
          })),
          (this.mapCorner = el('div', { class: 'explore-map-corner' })),
          el('div', { class: 'explore-conversation', hidden: true }),
        ),
      ),
    );
    scene.appendChild(
      el(
        'div',
        { class: 'explore-dock' },
        el('div', { class: 'roster' }),
        el('div', { class: 'hud explore-hud' }),
      ),
    );

    host.appendChild(scene);

    this.feedbackText = el('span', { attrs: { role: 'status', 'aria-live': 'polite' } });
    this.cancelNext = button('Cancel next walk', () => this.clearNextWalk());
    this.feedback = el('div', { class: 'walk-feedback' }, this.feedbackText, this.cancelNext);
    this.feedback.hidden = true;
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.setupRenderer();
    this.renderChrome(this.preserveFocus(true));
    this.loop();
  }

  unmount(): void {
    this.app.audio.clearEnvironment();
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.nextWalk.clear();
    this.walking = null;
    this.feedback = null;
    this.feedbackText = null;
    this.cancelNext = null;
    this.viewSize = null;
    this.framingArrival = false;
    this.localMap = null;
    this.life?.destroy();
    this.life = null;
    this.lastLife = null;
    this.lastNpcs = [];
    this.practising = false;
    this.practiceCamera = null;
    this.practiceShown = null;
    this.objectiveButton = null;
    this.objectivePointer = null;
    this.npcNames = null;
    this.mapCorner = null;
    this.pauseButton = null;
    this.objectivePresentation = createExploreObjectivePresentation();
    // Outside a practice ground nothing here bends: let the decoded pages go (ADR 0055).
    if (this.warmedBends) sheets.releaseBends();
    this.warmedBends = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.suspended = false;
    this.detach?.();
    this.detach = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.canvas = null;
    this.host = null;
  }

  suspend(): void {
    if (this.suspended) return;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    // Publish the state that opened dialogue, but do not queue another frame.
    this.paintingStill = true;
    this.loop();
    this.paintingStill = false;
    this.suspended = true;
    this.app.audio.clearEnvironment();
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    const now = performance.now();
    this.app.residents.tick(now, true);
    this.life?.resync(now);
    this.loop();
    this.preserveFocus(true)();
  }

  sync(): void {
    const state = this.app.state;
    if (!state) return;
    const restoreFocus = this.preserveFocus();
    const conversation = Boolean(worldConversationFor(this.app.content, state));
    const map = this.app.content.maps.get(state.location.mapId);
    if (map && map.id !== this.map?.id) {
      this.nextWalk.clear();
      this.walking = null;
      this.updateWalkFeedback();
      this.departing = null;
      this.app.animator.clear();
      this.map = map;
      this.lastNpcs = [];
      this.app.animator.setProjection(map.projection ?? 'orthographic');
      this.practising = false;
      this.practiceCamera = null;
      this.warmPractice();
      this.setupLife();
      this.grid = buildGrid(map);
      this.trail = null;
      this.needsSettle = true;
      this.renderer?.resize({ width: map.width, height: map.height });
      if (this.renderer) {
        this.renderer.camera.projection = map.projection ?? 'orthographic';
        this.renderer.camera.integerZoom = usesIntegerZoom(map.projection ?? 'orthographic');
        this.renderer.camera.centreMargin = map.cameraCentreMargin;
        this.renderer.camera.viewExtent = map.scene?.paintExtent;
      }
      this.renderer?.camera.fitExplore(
        exploreTilePx(map.projection ?? 'orthographic', this.renderer.camera.viewport.width),
      );
      this.frameArrival(state);
      this.rememberViewSize();
    }
    this.setConversationMode(conversation);
    this.renderChrome(restoreFocus);
  }

  /**
   * The walk the rules reported for the leader, played for the followers
   * too: each takes the tiles the line held between its old place and its
   * new one, laid alongside the leader's track so the whole party moves at
   * once and stays a tile apart.
   */
  onEvents(events: readonly GameEvent[], now: number): boolean {
    const state = this.app.state;
    const grid = this.grid;
    if (!state || !grid || !events.some((event) => event.type === 'partyWalked')) return false;
    const objective = worldObjective(this.app.content, state);
    this.objectivePresentation = walkExploreObjective(this.objectivePresentation, objective);
    this.renderObjective(objective);
    for (const event of events) {
      if (event.type !== 'partyWalked') continue;
      this.needsSettle = true;
      this.nextWalk.clear();
      this.walking = { from: event.from, path: event.path, label: 'the path', refusal: null };
      this.updateWalkFeedback();
      if (this.map && state.location.mapId !== this.map.id) {
        this.departing = {
          ...state,
          location: { mapId: this.map.id, pos: event.path[event.path.length - 1] ?? event.from },
        };
      }
      const trail = this.ensureTrail(state, grid, event.from);
      const before = trail.positions(state.party.length);
      const plan =
        this.map?.projection === 'oblique' || this.map?.projection === 'topdown'
          ? trail.planWalk(event.path, state.party.length, grid, this.standing(state))
          : null;
      if (plan) {
        this.animatePartyBatches(plan.batches, state, now);
        continue;
      }
      this.app.animator.push(now, [event], []);
      const routes = trail.walk(event.path, state.party.length);
      if (routes.length === 0) continue;
      const unitsBefore: Unit[] = state.party.map((member, index) => ({
        ...member,
        pos: before[index] ?? event.from,
        size: 1,
      }));
      // One push per follower: moves in a single push play one after another,
      // and these all start where the leader's did.
      for (const route of routes) {
        const member = state.party[route.index];
        if (!member) continue;
        const move: GameEvent = {
          type: 'partyWalked',
          unitId: member.id,
          from: before[route.index] ?? event.from,
          path: route.path,
        };
        this.app.animator.push(now, [move], unitsBefore, {
          alongside: true,
          walkPhase: partyWalkPhase(route.index),
        });
      }
    }
    this.app.animator.push(
      now,
      events.filter((event) => event.type !== 'partyWalked'),
      [],
    );
    return true;
  }

  private animatePartyBatches(
    batches: readonly (readonly FollowerRoute[])[],
    state: GameState,
    now: number,
  ): void {
    for (const batch of batches) {
      for (const [index, route] of batch.entries()) {
        const member = state.party[route.index];
        if (!member) continue;
        this.app.animator.push(
          now,
          [
            {
              type: 'partyWalked',
              unitId: member.id,
              from: route.from,
              path: route.path,
            },
          ],
          [],
          {
            alongside: index > 0,
            silentSteps: route.index !== 0,
            delayMs: route.delayMs,
            walkPhase: partyWalkPhase(route.index),
          },
        );
      }
    }
  }

  /**
   * The line the party stands in, seated afresh behind the leader when there
   * is none yet, the map changed, the party changed size, or the leader is
   * somewhere the line did not walk to (a loaded save, a story jump).
   */
  private ensureTrail(state: GameState, grid: Grid, head = state.location.pos): PartyTrail {
    const count = state.party.length;
    const current = this.trail;
    if (current?.head && samePos(current.head, head) && current.positions(count).length === count) {
      return current;
    }
    const seated = new PartyTrail(
      placeParty(grid, head, count, {
        awayFrom: this.map?.exit?.pos,
        avoid: this.standing(state),
      }),
      { climbCost: this.app.content.tuning.climbCost },
    );
    this.trail = seated;
    return seated;
  }

  /**
   * Where people stand, residents and background roles alike, and where a
   * routine has taken someone: nobody is seated there.
   */
  private standing(state: GameState): Vec2[] {
    const map = this.map;
    if (!map) return [];
    const { content } = this.app;
    return [
      ...[...visibleNpcs(content, map, state), ...backgroundFigures(content, map, state)].map(
        (who) => who.pos,
      ),
      ...this.app.residents.errandTiles(),
    ];
  }

  /** The camera as plain numbers, for the e2e suite to map a tile to a pixel. */
  cameraInfo(): CameraInfo | null {
    const camera = this.renderer?.camera;
    if (!camera) return null;
    return {
      projection: camera.projection,
      groundTransform: camera.groundMatrix(),
      tilePx: camera.tile * camera.scale,
      tile: camera.tile,
      offsetX: camera.offsetX,
      offsetY: camera.offsetY,
      fitted: camera.fitted,
    };
  }

  /** Where each member is drawn, leader first, for the e2e suite to check against the rules. */
  partyPositions(): readonly Vec2[] | null {
    const state = this.app.state;
    const grid = this.grid;
    if (!state || !grid) return null;
    const seats = this.ensureTrail(state, grid).positions(state.party.length);
    return seats.map((seat, index) => (index === 0 ? state.location.pos : seat));
  }

  resize(): void {
    const map = this.map;
    this.renderer?.resizeAndRedraw(
      () => this.refit(),
      map ? { width: map.width, height: map.height } : undefined,
    );
  }

  /** Keep the player's map focus and tile size when the dock changes the canvas box. */
  private refit(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    const previous = this.viewSize;
    if (previous) {
      camera.offsetX += (previous.width - camera.viewport.width) / 2;
      camera.offsetY += (previous.height - camera.viewport.height) / 2;
    }
    camera.clamp();
    // A dpr change (a window dragged to another screen) leaves the zoom off the
    // device-pixel grid; put it back on the nearest whole scale.
    camera.resnap();
    if (this.framingArrival && this.app.state) this.frameArrival(this.app.state);
    this.frameConversationSpeaker();
    this.rememberViewSize();
    this.redrawLife();
  }

  /**
   * Repaint the life layer in the same turn as the resize that moved its box.
   *
   * The layer sizes its backing store from the camera's viewport, so a resize
   * that repaints the board but leaves this layer until the next animation
   * frame leaves a store that disagrees with the box it is shown in: the
   * browser stretches the old frame, and every measurement taken in backing
   * pixels — a tap, or the suite's crop of the seated party — lands outside
   * the bitmap and reads as empty canvas. `Renderer.resizeAndRedraw` already
   * redraws the board in this turn for exactly that reason; give the layer the
   * units of the last published frame and the camera that was just refitted,
   * so the two never come apart however slowly the runner hands back frames.
   */
  private redrawLife(): void {
    const last = this.lastLife;
    const camera = this.renderer?.camera;
    // The frame's own timestamp, not a fresh read: this is a repaint of the
    // frame the renderer was last handed, at the camera that just refitted.
    if (this.life && last && camera) this.life.draw(last.units, camera, last.now);
  }

  private rememberViewSize(): void {
    const viewport = this.renderer?.camera.viewport;
    if (viewport) this.viewSize = { width: viewport.width, height: viewport.height };
  }

  private setConversationMode(active: boolean): void {
    const entered = active && !this.conversationMode;
    if (entered) {
      // A panned or cursor-zoomed view must not leave the party clipped while
      // conversation locks map gestures. Keep the player's chosen tile size.
      // Do not clear the party's in-flight legal route: conversation can open
      // as soon as the leader reaches an NPC, before the followers settle.
      this.followParty();
    }
    this.conversationMode = active;
    if (active) {
      this.clearWorldIntent();
    }
    const scene = this.host?.querySelector<HTMLElement>('.explore-scene');
    scene?.classList.toggle('is-conversation', active);
    const canvas = this.canvas;
    if (canvas) {
      if (active) {
        canvas.setAttribute('aria-disabled', 'true');
        canvas.setAttribute('aria-hidden', 'true');
      } else {
        canvas.removeAttribute('aria-disabled');
        canvas.removeAttribute('aria-hidden');
      }
    }
    const dock = this.host?.querySelector<HTMLElement>('.explore-dock');
    if (dock) {
      dock.hidden = active;
      dock.inert = active;
    }
  }

  private clearWorldIntent(): void {
    this.nextWalk.clear();
    this.walking = null;
    this.hover = null;
    this.updateWalkFeedback();
  }

  /* ---------------------------------------------------------------- */
  /* Chrome: the banner, the roster, the hotbar                        */
  /* ---------------------------------------------------------------- */

  private preserveFocus(entry = false): () => void {
    const scene = this.host?.querySelector<HTMLElement>('.explore-scene');
    if (!scene) return () => undefined;
    const previous = document.activeElement;
    const owned = previous && scene?.contains(previous) && !previous.closest('[hidden], [inert]');
    const key = (control: Element) =>
      control.getAttribute('aria-label') ??
      control.getAttribute('data-conversation-control') ??
      [...control.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)?.textContent ??
      control.textContent;
    const identity = previous && key(previous);
    const usable = (control: Element) =>
      !control.matches(':disabled, [aria-disabled="true"]') &&
      !control.closest('[hidden], [inert], [aria-hidden="true"]') &&
      control.getClientRects().length > 0;
    return () => {
      if (
        (!owned && !entry) ||
        !scene?.isConnected ||
        scene.closest('[inert]') ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active.isConnected &&
        (!scene.contains(active) || usable(active))
      )
        return;
      const controls = [...scene.querySelectorAll<HTMLElement>('button, [tabindex]')].filter(
        usable,
      );
      const fallback = controls.find((control) =>
        control.matches(
          this.conversationMode
            ? '[data-conversation-control="next"], .choice-option'
            : '.explore-hud button',
        ),
      );
      (controls.find((control) => key(control) === identity) ?? fallback ?? controls[0])?.focus({
        preventScroll: true,
      });
    };
  }

  /** DOM, all of it, rebuilt whenever the state changes: it is cheap and it is right. */
  private renderChrome(restoreFocus: () => void): void {
    this.renderBanner();
    this.renderRoster();
    this.renderHud();
    this.renderConversation();
    restoreFocus();
  }

  private renderBanner(): void {
    const banner = this.host?.querySelector<HTMLElement>('.explore-bar-main');
    if (!banner) return;
    clear(banner);
    const state = this.app.state;
    this.canvas?.setAttribute('aria-label', `${this.map?.name ?? 'World'} map`);
    const clock = state?.world.clock;
    append(banner, [
      el(
        'div',
        { class: 'explore-title' },
        el('strong', { class: 'title-plate-name', text: this.app.placeLabel() }),
        clock ? el('span', { class: 'explore-phase', text: phaseLabel(clock.phase) }) : null,
      ),
      // The time of day stands where 'Exploring' did; a conversation still says so.
      this.conversationMode || !clock
        ? el('span', {
            class: 'explore-mode hide-narrow',
            text: this.conversationMode ? 'Conversation' : 'Exploring',
          })
        : null,
      el('div', { class: 'spacer' }),
    ]);
    if (!this.conversationMode) {
      banner.append(
        button(
          'Travel journal',
          () => {
            if (!this.app.animator.busy(performance.now()))
              new TravelJournal(this.app).open(this.overlayHost());
            else this.app.toasts.show('Let the party finish, then open the journal.');
          },
          { class: 'explore-header-action' },
        ),
        button('Save', () => new SaveMenu(this.app, { mode: 'save' }).open(this.overlayHost()), {
          class: 'explore-header-action',
          disabled: this.app.previewActive,
        }),
      );
    }
    this.pauseButton = button(
      'Pause',
      () =>
        this.app.openPause(() => {
          // Settings can rebuild the banner. Resolve its current button only on return.
          const target = this.pauseButton;
          if (
            this.host?.isConnected &&
            target?.isConnected &&
            this.host.contains(target) &&
            !target.matches(':disabled, [aria-disabled="true"]') &&
            !target.closest('[hidden], [inert], [aria-hidden="true"]') &&
            target.getClientRects().length > 0 &&
            getComputedStyle(target).visibility === 'visible'
          ) {
            target.focus({ preventScroll: true });
          }
        }),
      { class: 'explore-header-action' },
    );
    banner.append(this.pauseButton);
    this.renderObjective(state ? worldObjective(this.app.content, state) : null);
    const corner = this.mapCorner;
    if (corner && state && this.map && this.grid) {
      clear(corner);
      corner.hidden = this.conversationMode || !!this.life;
      this.localMap = new LocalMap(this.app.content, this.map, this.grid, state);
      this.localMap.update(this.partyPositions() ?? [state.location.pos]);
      const follow = button('Follow party', () => this.followParty(), {
        class: 'local-map-follow',
        title: 'North-up map. Recenter the camera on your party.',
      });
      follow.setAttribute('aria-label', 'Follow party');
      follow.prepend(
        this.localMap.element,
        el('span', { class: 'local-map-north', text: 'N ↑', attrs: { 'aria-hidden': 'true' } }),
      );
      corner.append(follow);
    }
  }

  private renderObjective(objective: string | null): void {
    const button = this.objectiveButton;
    if (!button) return;
    this.objectivePresentation = syncExploreObjective(this.objectivePresentation, objective);
    button.hidden = !objective || this.conversationMode || !!this.life;
    // Riverside and conversations hide the chip, but its text still follows the
    // story, so it is current the moment it shows again.
    clear(button);
    if (!objective) return;

    const gate = this.atGate();
    const expanded = this.objectivePresentation.expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', `Current objective: ${objective}${gate ? `. ${gate}` : ''}`);
    button.title = expanded ? 'Hide objective details' : 'Show the full objective';
    button.classList.toggle('is-collapsed', !expanded);
    if (expanded)
      button.append(
        el('strong', { class: 'explore-objective-label tiny', text: 'Current objective' }),
      );
    button.append(el('span', { class: 'title-plate-objective', text: objective }));
    if (gate)
      button.append(
        el('span', {
          class: 'explore-objective-gate tiny muted',
          text: expanded ? gate : ` · ${gate}`,
        }),
      );
  }

  private toggleObjective(): void {
    const state = this.app.state;
    const objective = state ? worldObjective(this.app.content, state) : null;
    this.objectivePresentation = toggleExploreObjective(this.objectivePresentation, objective);
    if (!objective) return;
    this.renderObjective(objective);
  }

  /**
   * Keep what the conversation is about above the actual dialogue panel: the
   * person or tiles its presentation stages (#628), else the pinned NPC's
   * whole drawn body.
   */
  private frameConversationSpeaker(npcs = this.lastNpcs): boolean {
    const camera = this.renderer?.camera;
    if (!this.conversationMode || camera?.projection !== 'topdown') return false;
    const state = this.app.state;
    const map = this.map;
    const presentation = state ? worldConversationFor(this.app.content, state) : undefined;
    if (!state || !map || !presentation) return false;
    const stage = presentation.stage;
    if (stage && 'tiles' in stage) {
      const corners = stage.tiles.flatMap((tile) => {
        const box = camera.toScreen(tile);
        return [
          { x: box.x, y: box.y },
          { x: box.x + box.size, y: box.y + box.size },
        ];
      });
      return this.keepAbovePanel(corners);
    }
    const pin = state.world.talk;
    const npcId = stage?.npc ?? (pin?.mapId === map.id ? pin.npcId : null);
    if (!npcId) return false;
    const placed = visibleNpcs(this.app.content, map, state).find((npc) => npc.id === npcId);
    if (!placed) return false;
    const figure = placed.resident
      ? this.app.residents
          .figures()
          .find((who) => who.id === placed.resident && who.npcId === placed.id)
      : undefined;
    if (placed.resident && !figure) return false;
    const npc = npcs.find((marker) => marker.id === (figure?.id ?? placed.id));
    if (!npc || npc.quiet || (npc.alpha ?? 1) <= 0) return false;
    if (figure && !samePos(npc.renderPos ?? npc.pos, figure.drawPos)) return false;
    const { dpr } = camera.viewport;
    const entry = resolveAsset(npc.sprite);
    const footprint = entry.kind === 'sheet' && entry.footprint.w === 2 ? 2 : 1;
    const box = camera.spriteBox(npc.renderPos ?? npc.pos, footprint, false);
    // Top-down actors have no elevation lift. Use the same anchored frame and
    // pose transforms as their existing backends, including the snapped bob.
    const foot = { x: box.x + (footprint * box.size) / 2, y: box.y + FOOT_LINE * box.size };
    const scale = npc.scale ?? 1;
    const clip = npcClip(npc);
    const frame =
      entry.kind === 'sheet'
        ? sheets.frame(
            npc.sprite,
            clip,
            npc.clipTime ?? 0,
            undefined,
            box.size * dpr * scale,
            footprint,
          )
        : null;
    const rect = frame
      ? placeFrame(frame, 0, 0, box.size)
      : {
          x: (-footprint * box.size) / 2,
          y: -FOOT_LINE * box.size,
          w: footprint * box.size,
          h: box.size,
        };
    const facing =
      entry.kind === 'sheet' && entry.facing === 'both' && authoredForBothSides(clip)
        ? 1
        : (npc.facing ?? 1);
    const pose = scale * (npc.poseScale ?? 1);
    const bob = Math.round((npc.offset?.y ?? 0) * box.size * dpr) / dpr;
    const cosine = Math.cos(npc.lean ?? 0),
      sine = Math.sin(npc.lean ?? 0);
    const corners = (
      [
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x, rect.y + rect.h],
        [rect.x + rect.w, rect.y + rect.h],
      ] as const
    ).map(([x, y]) => {
      const dx = x * pose * facing,
        dy = y * pose;
      return { x: foot.x + dx * cosine - dy * sine, y: foot.y + bob + dx * sine + dy * cosine };
    });
    return this.keepAbovePanel(corners);
  }

  /** Pans the least distance that puts every corner inside the map above the dialogue panel. */
  private keepAbovePanel(corners: readonly { x: number; y: number }[]): boolean {
    const camera = this.renderer?.camera;
    if (!camera || !corners.length) return false;
    const panel = this.host?.querySelector<HTMLElement>(
      '.explore-conversation .conversation-panel',
    );
    const canvas = this.canvas?.getBoundingClientRect();
    if (!panel?.getClientRects().length || !canvas?.width || !canvas.height) return false;
    const { dpr, width, height } = camera.viewport;
    const pixel = 1 / dpr;
    // Round inward by one device pixel: offset snapping must not put a body
    // back under the panel. This never changes zoom or the camera's bounds.
    const bottom =
      Math.floor(
        Math.min(
          height,
          ((panel.getBoundingClientRect().top - canvas.top) * height) / canvas.height,
        ) * dpr,
      ) /
        dpr -
      pixel;
    if (bottom <= pixel || width <= 2 * pixel) return false;
    const pan = (low: number, high: number, min: number, max: number): number => {
      // An oversized body has one stable best-effort alignment, rather than
      // alternating its two clipped edges. Existing clamps remain authoritative.
      if (high - low > max - min) return Math.round(((min + max - low - high) * dpr) / 2) / dpr;
      if (low < min) return Math.ceil((min - low) * dpr) / dpr;
      if (high > max) return Math.floor((max - high) * dpr) / dpr;
      return 0;
    };
    const dx = pan(
      Math.min(...corners.map((p) => p.x)),
      Math.max(...corners.map((p) => p.x)),
      pixel,
      width - pixel,
    );
    const dy = pan(
      Math.min(...corners.map((p) => p.y)),
      Math.max(...corners.map((p) => p.y)),
      pixel,
      bottom,
    );
    if (dx || dy) camera.panBy(dx, dy);
    return true;
  }

  private drawNpcNames(npcs: readonly NpcMarker[], pos: Vec2 | null): void {
    const layer = this.npcNames;
    const camera = this.renderer?.camera;
    if (!layer || !camera) return;
    let count = 0;
    if (pos && camera.projection === 'topdown') {
      for (const npc of npcs) {
        if (
          npc.quiet ||
          (npc.alpha ?? 1) < 1 ||
          npc.id.startsWith('trigger:') ||
          npc.sprite.startsWith('world.') ||
          distance(pos, npc.pos) > TALK_RANGE
        )
          continue;
        const { x, y, size } = camera.spriteBox(npc.renderPos ?? npc.pos);
        const left = x + size / 2;
        const top = y + (FOOT_LINE - npcPipLift(npc.sprite, npc.scale ?? 1)) * size;
        if (
          left < 0 ||
          left > camera.viewport.width ||
          y + FOOT_LINE * size < 0 ||
          y > camera.viewport.height
        )
          continue;
        const tag = layer.children[count] as HTMLElement | undefined;
        const label = tag ?? layer.appendChild(el('span'));
        if (label.textContent !== npc.name) label.textContent = npc.name;
        const half = label.offsetWidth / 2;
        const labelX = Math.max(half, Math.min(left, camera.viewport.width - half));
        const labelY = Math.max(top, label.offsetHeight + 6);
        const corner = this.mapCorner;
        if (corner && labelX + half > corner.offsetLeft && labelY < corner.offsetHeight + 6) {
          label.remove();
          continue;
        }
        label.style.translate = `${labelX}px ${labelY}px`;
        count++;
      }
    }
    while (layer.children.length > count) layer.lastElementChild?.remove();
  }

  private frameArrival(state: GameState): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    const { mapId, pos } = state.location;
    this.framingArrival =
      camera.projection === 'topdown' &&
      mapId === 'forest_road' &&
      pos.x === 1 &&
      pos.y === 4 &&
      !state.story.visited.includes('road_depart');
    if (this.framingArrival) {
      // Fit Dema and the party between the objective and dock, keeping whole
      // pixel zoom and the camera's normal minimum tile size.
      const { width, height, dpr } = camera.viewport;
      const tilePx = (Math.floor((height * dpr) / (4.25 * camera.tile)) * camera.tile) / dpr;
      camera.fitExplore(Math.min(exploreTilePx('topdown', width), tilePx));
    }
    const vergeFits =
      this.framingArrival && camera.viewport.height >= 4.25 * camera.tile * camera.scale;
    camera.centreOn(vergeFits ? { x: pos.x, y: 2.25 } : pos);
  }

  private followParty(): void {
    if (this.conversationMode) return;
    this.framingArrival = false;
    const state = this.departing ?? this.app.state;
    if (!state) return;
    const leader = state.party[0];
    const pos = leader
      ? (this.app.animator.renderPos(performance.now(), leader.id) ?? state.location.pos)
      : state.location.pos;
    this.renderer?.camera.centreOn(pos);
  }

  /** The exit's label while the leader stands on or beside it. */
  private atGate(): string | null {
    const state = this.app.state;
    if (!state) return null;
    const exit = this.map ? nearbyExits(this.map, state.location.pos)[0] : undefined;
    if (exit)
      return evaluate(state, exit.requires)
        ? exit.label
        : (exit.lockedHint ?? 'This route is not open yet.');
    const legacy = this.map?.exit;
    return legacy && distance(state.location.pos, legacy.pos) <= 1 ? legacy.label : null;
  }

  private renderRoster(): void {
    const current = this.host?.querySelector<HTMLElement>('.roster');
    const state = this.app.state;
    if (!current || !state) return;
    current.parentElement?.classList.toggle('solo-party', state.party.length === 1);
    const leader = state.party[0];
    current.replaceWith(
      partyRoster(this.app, state.party, leader?.id ?? null, (unit) => this.inspect(unit)),
    );
  }

  /** What the party can do out here: real actions, every one of them. */
  private renderHud(): void {
    const restoreFocus = this.preserveFocus();
    this.buildHud();
    restoreFocus();
  }

  private buildHud(): void {
    const hud = this.host?.querySelector<HTMLElement>('.explore-hud');
    const state = this.app.state;
    if (!hud || !state) return;
    // Keep the frame edge in sync even when Riverside owns the action panel.
    // Village controls are updated in place while the animator runs, but the
    // loop still uses this edge to decide when a HUD refresh is needed. If it
    // stays false during a walk, every frame replaces the controls and a
    // button such as Leave preview can never complete a DOM click.
    this.hudMoving = this.app.animator.busy(performance.now());
    clear(hud);
    if (this.conversationMode) return;
    if (this.life && this.renderer) {
      this.life.renderControls(hud, this.renderer.camera);
      return;
    }

    const bar = el('div', {
      class: 'hud-panel action-bar',
      attrs: { role: 'toolbar', 'aria-label': 'Party actions' },
    });
    const row = el('div', { class: 'action-row' });

    const moving = this.hudMoving;
    // The handover's bark (ADR 0047 §8) as a subtitle, once per watch, on arrival.
    const bark = moving || !this.map ? null : handoverBark(this.app.content, this.map, state);
    const watch = `${state.world.clock.day}:${state.world.clock.phase}`;
    if (bark && this.app.barkedWatch !== watch) {
      this.app.barkedWatch = watch;
      this.app.toasts.show(bark, 'info', 5000);
    }
    const target =
      moving || !this.map ? null : nearbyExploreTarget(this.app.content, this.map, state);
    const exit = target?.kind === 'exit' ? target : null;
    const npc = target?.kind === 'npc' ? target.npc : null;
    const inspect = target?.kind === 'npc' ? target.inspect : false;
    const context = el(
      'div',
      { class: 'explore-context' },
      mark(exit || !npc ? UI_MARKS.move : UI_MARKS.talk),
      el('strong', {
        text: exit
          ? `Walk to ${exit.destination}`
          : npc
            ? `${inspect ? 'Inspect' : 'Speak with'} ${npc.name}`
            : 'Tap a path to move',
      }),
      el('span', {
        class: 'tiny muted',
        text:
          exit?.exit.label ??
          this.atGate() ??
          (npc
            ? `Tap ${inspect ? 'Inspect' : 'Talk'}, or choose another path.`
            : 'Drag to look around · Follow party to recenter'),
      }),
    );
    if (moving && !this.practising) clear(context);
    if (this.practising)
      context.replaceChildren(
        mark(ABILITY_MARKS.gust),
        el('strong', { text: 'Bending practice' }),
        el('span', { class: 'tiny muted', text: 'Each bender throws toward the open canal.' }),
      );
    if (this.feedback) context.appendChild(this.feedback);
    this.updateWalkFeedback();
    hud.appendChild(context);
    const primary = exit
      ? button('Walk', () => this.requestWalk(exit.exit.pos), {
          class: 'action-button',
          title: `Walk to ${exit.destination}`,
        })
      : button(inspect ? 'Inspect' : 'Talk', () => this.talkTo(npc), {
          class: 'action-button',
          disabled: !npc,
          title: npc
            ? `Walk over and ${inspect ? 'inspect' : 'talk to'} ${npc.name}`
            : 'Nobody is close enough to talk to',
        });
    primary.prepend(mark(exit ? UI_MARKS.move : UI_MARKS.talk));
    primary.appendChild(
      el('span', {
        class: 'action-sub',
        text: moving
          ? this.practising
            ? 'Bending'
            : 'Walking'
          : (exit?.destination ?? npc?.name ?? 'No one near'),
      }),
    );
    row.appendChild(primary);

    // At a seat (ADR 0047 D8), waiting takes Look around's place. The dock is
    // laid out for four actions: a fifth wraps the iPad dock to twice its
    // height and pushes one off a phone at Largest text. Look around is one
    // step away; away from a seat the journal says where waiting is possible.
    const seat = !moving && seatHere(this.app.content, state);
    // At a practice ground (issue #284), practice takes it the same way, and
    // stays put, disabled, while the party bends.
    const ground =
      seat || (moving && !this.practising) ? null : practiceAt(this.map?.id, state.location.pos);
    const ready = ground ? this.practiceReady(state) : false;
    this.practiceShown = ground ? ready : null;
    const look = seat
      ? button(
          'Wait',
          () => new WaitDialog(this.app, (pos) => this.requestWalk(pos)).open(this.overlayHost()),
          { class: 'action-button', title: `Wait until later at ${seat.label}` },
        )
      : ground
        ? button('Practice', () => this.practise(), {
            class: 'action-button practice-button',
            disabled: !ready || moving,
            title: `Practice bending by the ${ground.label.toLowerCase()}`,
          })
        : button(
            'Look around',
            () => {
              new NearbyPlaces(this.app, (pos) => this.requestWalk(pos)).open(this.overlayHost());
            },
            { class: 'action-button', title: 'Find nearby people and places along this path' },
          );
    look.prepend(mark(seat ? UI_MARKS.wait : ground ? ABILITY_MARKS.gust : UI_MARKS.talk));
    if (seat) look.appendChild(el('span', { class: 'action-sub', text: seat.label }));
    if (ground)
      look.appendChild(
        el('span', {
          class: 'action-sub',
          text: this.practising ? 'Bending' : ready ? ground.label : 'Getting ready',
        }),
      );
    row.appendChild(look);

    const leader = state.party[0];
    const party = button(
      'Party',
      () => {
        if (leader) this.inspect(leader);
      },
      { class: 'action-button', title: 'Who the party are and what they can do' },
    );
    party.prepend(mark(UI_MARKS.party));
    party.appendChild(el('span', { class: 'action-sub', text: `${state.party.length} strong` }));
    row.appendChild(party);
    // Departure playback can still draw the old map after the rules have moved on.
    const mapState = () => {
      const current = this.app.state;
      return current?.screen === 'explore' && current.location.mapId === this.map?.id
        ? current
        : null;
    };
    const map = button(
      'Map',
      () => {
        const current = mapState();
        if (!current || !this.map || !this.grid) return;
        new LocalMapDialog(
          this.map,
          this.grid,
          current,
          this.app.content,
          this.partyPositions() ?? [current.location.pos],
          (pos) => this.requestWalk(pos),
          () => this.followParty(),
          worldObjectiveTargetId(this.app.content, current),
        ).open(this.overlayHost());
      },
      { class: 'action-button', title: 'Local map and routes', disabled: !mapState() },
    );
    map.prepend(mark(UI_MARKS.recentre));
    row.insertBefore(map, look);
    bar.appendChild(row);
    hud.appendChild(bar);
  }

  private renderConversation(): void {
    const host = this.host?.querySelector<HTMLElement>('.explore-conversation');
    if (!host) return;
    const focused = host.closest('[inert]') ? null : document.activeElement;
    const refocusNext =
      focused instanceof HTMLElement &&
      host.contains(focused) &&
      focused.dataset.conversationControl === 'next';
    const refocusPanel =
      focused instanceof HTMLElement &&
      host.contains(focused) &&
      focused.classList.contains('conversation-panel');
    clear(host);
    const panel = this.conversationMode ? conversationPanel(this.app, { compact: true }) : null;
    host.hidden = panel === null;
    host.inert = panel === null;
    if (!panel) {
      if (refocusNext || refocusPanel) {
        const scene = this.host?.querySelector<HTMLElement>('.explore-scene');
        const target =
          scene?.querySelector<HTMLElement>('.explore-hud .action-button:not([disabled])') ??
          scene?.querySelector<HTMLElement>('.explore-bar button');
        target?.focus({ preventScroll: true });
      }
      return;
    }
    host.appendChild(panel);
    if (refocusNext) {
      const target =
        host.querySelector<HTMLElement>('[data-conversation-control="next"]') ??
        host.querySelector<HTMLElement>('.choice-option:not([disabled])') ??
        panel;
      target.focus({ preventScroll: true });
    } else if (refocusPanel) panel.focus({ preventScroll: true });
  }

  private talkTo(npc: PlacedNpc | null): void {
    if (this.conversationMode) return;
    if (!npc) return;
    // The rules walk the party up to the villager and open the conversation.
    this.requestWalk(npc.pos);
  }

  private inspect(unit: Unit): void {
    if (this.conversationMode) return;
    new UnitInspector(this.app, unit, () => undefined).open(this.overlayHost());
  }

  private overlayHost(): HTMLElement {
    return document.querySelector<HTMLElement>('.overlay-host') ?? document.body;
  }

  /* ---------------------------------------------------------------- */
  /* The map                                                           */
  /* ---------------------------------------------------------------- */

  private setupRenderer(): void {
    const canvas = this.canvas;
    const state = this.app.state;
    if (!canvas || !state) return;

    const map = this.app.content.maps.get(state.location.mapId);
    if (!map) return;
    this.map = map;
    this.grid = buildGrid(map);

    this.renderer = new Renderer(canvas, { width: map.width, height: map.height });
    this.renderer.resize({ width: map.width, height: map.height });
    this.renderer.camera.projection = map.projection ?? 'orthographic';
    // The oblique and top-down maps are pixel art: whole device pixels per world pixel (ADR 0088, 0104).
    this.renderer.camera.integerZoom = usesIntegerZoom(map.projection ?? 'orthographic');
    this.renderer.camera.centreMargin = map.cameraCentreMargin;
    this.renderer.camera.viewExtent = map.scene?.paintExtent;
    this.app.animator.setProjection(this.renderer.camera.projection);
    this.renderer.camera.fitExplore(
      exploreTilePx(map.projection ?? 'orthographic', this.renderer.camera.viewport.width),
    );
    this.frameArrival(state);
    this.rememberViewSize();

    // The chrome round the map can still grow — a late web font, a longer
    // objective on the next node, the roster becoming a strip — and every
    // pixel the camera reports has to keep matching the pixels the backend
    // draws, or taps land a tile out.
    this.renderer.onViewportChange = () => this.refit();
    this.warmPractice();
    this.setupLife();

    this.detach = attachPointer(canvas, {
      onTap: (point) => this.handleTap(point.x, point.y),
      onDrag: (delta) => {
        if (this.conversationMode) return;
        this.framingArrival = false;
        this.renderer?.camera.panBy(delta.x, delta.y);
      },
      onPinch: (gesture) => {
        if (this.conversationMode) return;
        this.framingArrival = false;
        this.renderer?.camera.zoomAt(gesture.centre, gesture.step);
        this.renderer?.camera.panBy(gesture.delta.x, gesture.delta.y);
      },
      onWheel: (wheel) => {
        if (this.conversationMode) return;
        this.framingArrival = false;
        this.renderer?.camera.zoomAt(wheel.point, wheelZoomFactor(wheel));
      },
      onHover: (point) => {
        if (this.conversationMode) {
          this.hover = null;
          return;
        }
        this.hover = point
          ? (this.renderer?.camera.pickTile(point.x, point.y, this.grid) ?? null)
          : null;
      },
    });
  }

  /**
   * A map with a bending practice ground loads the party's bends and the
   * painted effects on arrival, as combat does at its start, so the first
   * practice does not wait on them (ADR 0055, step 7).
   */
  private warmPractice(): void {
    const state = this.app.state;
    if (!state || !hasPractice(this.map?.id)) return;
    for (const member of state.party) sheets.preloadBend(member.sprite);
    this.app.preloadBendFx();
    this.warmedBends = true;
  }

  /** Whether every bend a practice here would play has loaded. */
  private practiceReady(state: GameState): boolean {
    if (!this.app.bendFxReady) return false;
    return state.party.every((member) => {
      const load = sheets.bendState(member.sprite);
      return load === 'loaded' || load === 'none' || load === 'failed';
    });
  }

  /**
   * The party practises at the ground the leader stands on: each bender, in
   * party order, throws their bend at the mark from where they stand. The
   * casts go to the animator only; the rules never hear of them.
   */
  private practise(): void {
    const state = this.app.state;
    const grid = this.grid;
    const now = performance.now();
    if (!state || !grid || this.conversationMode || this.app.animator.busy(now)) return;
    const ground = practiceAt(this.map?.id, state.location.pos);
    if (!ground) return;
    const positions = this.ensureTrail(state, grid).positions(state.party.length);
    const casts = practiceCasts(this.app.content, state.party, positions, ground);
    if (casts.length === 0) {
      this.app.toasts.show('Nobody in the party bends.', 'info');
      return;
    }
    this.clearNextWalk();
    this.app.animator.push(now, practiceEvents(casts), practiceUnits(state.party, positions), {
      waterSources: practiceSources(casts),
    });
    this.practising = true;
    this.practiceCamera = {
      from: state.location.pos,
      to: practiceFrame(positions, ground.mark),
      start: now,
      back: false,
    };
    this.renderHud();
  }

  private setupLife(): void {
    this.life?.destroy();
    this.life = null;
    const wrap = this.canvas?.parentElement;
    const active = this.map?.id === RIVERSIDE_ID;
    this.host?.querySelector('.explore-scene')?.classList.toggle('riverside-scene', active);
    if (active && wrap) this.life = new VillageLife(this.app, wrap, (pos) => this.requestWalk(pos));
  }

  private handleTap(x: number, y: number): void {
    if (this.conversationMode) return;
    const renderer = this.renderer;
    const state = this.app.state;
    if (!renderer || !state) return;
    // A tap on someone walks to them, wherever their figure is drawn.
    const tile = this.figureAt(x, y) ?? renderer.camera.pickTile(x, y, this.grid);
    // Ground taps can plan the next stroll without interrupting the current animation.
    if (this.app.animator.busy(performance.now())) {
      this.requestWalk(tile);
      return;
    }
    const origin = renderer.camera.toScreen({ x: 0, y: 0 });
    const point = { x: (x - origin.x) / origin.size, y: (y - origin.y) / origin.size };
    if (this.life?.handleTap(point, performance.now())) return;
    this.requestWalk(tile);
  }

  /**
   * The tile of the person whose drawn figure is under the point, front-most
   * first, or null: upright bounds over the drawn feet, as the riverside's
   * `hitsVillager` has them.
   */
  private figureAt(x: number, y: number): Vec2 | null {
    const camera = this.renderer?.camera;
    if (!camera) return null;
    let best: { to: Vec2; foot: number } | null = null;
    for (const who of this.targets) {
      const box = camera.spriteBox(who.at);
      const size = box.size * who.scale;
      const foot = box.y + box.size * 0.86;
      const hit =
        Math.abs(x - box.x - box.size / 2) <= size * 0.28 &&
        y <= foot + box.size * 0.12 &&
        y >= foot - size * 0.9;
      if (hit && (!best || foot > best.foot)) best = { to: who.to, foot };
    }
    return best?.to ?? null;
  }

  private requestWalk(pos: Vec2): void {
    const state = this.app.state;
    if (this.conversationMode) return;
    if (!state || state.screen !== 'explore' || state.location.mapId !== this.map?.id) return;
    if (this.life?.busy(performance.now())) return;
    // Someone still walking to their place: set off now for the tile beside
    // where they are going, and talk once they are there, so no conversation
    // opens with the speaker mid-stride (ADR 0047 §7, W8).
    if (!this.app.animator.busy(performance.now()) && this.app.residents.walkingTo(pos)) {
      const beside = previewWalk(this.app.content, state, pos).path.at(-1);
      if (beside) this.app.dispatch({ type: 'walkTo', pos: beside });
      if (this.app.state) this.nextWalk.set(this.app.content, this.app.state, pos);
    } else if (this.app.animator.busy(performance.now())) {
      const preview = this.nextWalk.set(this.app.content, state, pos);
      if (preview.refusal) this.app.toasts.show(preview.refusal);
    } else {
      this.nextWalk.clear();
      const preview = previewWalk(this.app.content, state, pos);
      const events = this.app.dispatch({ type: 'walkTo', pos });
      if (events.some((event) => event.type === 'partyWalked')) this.walking = preview;
    }
    this.updateWalkFeedback();
  }

  private clearNextWalk(): void {
    this.nextWalk.clear();
    this.updateWalkFeedback();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.conversationMode || this.app.state?.screen !== 'explore') return;
    if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) this.clearNextWalk();
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.clearNextWalk();
      this.app.audio.clearEnvironment();
    }
  };

  private updateWalkFeedback(): void {
    if (!this.feedback || !this.feedbackText || !this.cancelNext) return;
    const state = this.app.state;
    const next = state ? this.nextWalk.preview(state) : null;
    const moving = this.app.animator.busy(performance.now());
    this.feedback.hidden = !next && !this.walking && !moving;
    this.cancelNext.hidden = !next;
    const text = next
      ? `Next: ${next.label}`
      : this.walking
        ? this.walking.label === 'the path'
          ? 'Following the path'
          : `Walking to ${this.walking.label}`
        : moving
          ? 'Gathering the party'
          : '';
    if (this.feedbackText.textContent !== text) this.feedbackText.textContent = text;
  }

  /* ---------------------------------------------------------------- */

  private loop = (): void => {
    if (this.suspended) return;
    if (!this.paintingStill) this.frame = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const state = this.departing ?? this.app.state;
    const map = this.map;
    const grid = this.grid;
    if (!renderer || !state || !map || !grid) return;

    const now = performance.now();
    const animator = this.app.animator;
    // Long roaming sessions must retire old walk tracks just as combat does.
    animator.prune(now);
    const dialogOpen = !!document.querySelector('[role="dialog"]');
    const held = this.conversationMode || document.hidden || dialogOpen;
    // Never carry queued intent through a menu, a loaded save, a story/map
    // change, or a world conversation.
    if (held) this.clearNextWalk();
    // Residents walk to their new places after any command (ADR 0047 §7).
    // Nothing moves, and nothing is planned, while a conversation is open.
    const residents = this.app.residents;
    residents.tick(now, held);
    const live = !this.departing && !this.conversationMode && state.screen === 'explore';
    const trail = this.ensureTrail(state, grid);
    let seats = trail.positions(state.party.length);
    // A routine keeps clear of the party: its tiles, where it is drawn, the way it walks.
    const clear = [...seats, ...(this.walking?.path ?? [])];
    for (const member of state.party) {
      const drawn = animator.renderPos(now, member.id);
      if (drawn) clear.push({ x: Math.round(drawn.x), y: Math.round(drawn.y) });
    }
    // A follower on a tile someone is walking to steps aside.
    if (residents.update(map, state, seats, live, clear)) this.needsSettle = true;
    if (!animator.busy(now)) {
      if (!this.conversationMode) {
        if (this.walking) {
          this.walking = null;
          this.routePreview = null;
          this.hover = null;
          this.updateWalkFeedback();
        }
        const queued = this.nextWalk.target(state);
        const next =
          queued && this.app.residents.walkingTo(queued) ? null : this.nextWalk.take(state);
        if (next) {
          this.requestWalk(next);
          return;
        }
      }
      if (
        this.needsSettle &&
        (map.projection === 'oblique' || map.projection === 'topdown') &&
        !this.departing &&
        !dialogOpen
      ) {
        this.needsSettle = false;
        const routes = trail.settle(grid, this.standing(state), {
          beside: map.projection === 'topdown',
        });
        const batches: FollowerRoute[][] = [];
        for (const route of routes) (batches[route.batch ?? 0] ??= []).push(route);
        this.animatePartyBatches(batches, state, now);
        seats = trail.positions(seats.length);
      }
    }
    if (!this.conversationMode && this.life?.update(now, renderer.camera)) return;
    if (this.practising && !animator.busy(now)) {
      this.practising = false;
      if (this.practiceCamera)
        this.practiceCamera = {
          from: this.practiceCamera.to,
          to: state.location.pos,
          start: now,
          back: true,
        };
    }
    if (
      this.hudMoving !== animator.busy(now) ||
      (this.practiceShown !== null && this.practiceShown !== this.practiceReady(state))
    )
      this.renderHud();
    this.app.stats?.frame(now);

    // The whole party walks the village: the leader on the rules' tile, the
    // others in a line behind, each their own figure.
    const leader = state.party[0];
    const walking = leader ? animator.renderPos(now, leader.id) : undefined;
    if (document.hidden) this.app.audio.clearEnvironment();
    else
      this.app.audio.updateEnvironment(
        courtyardEnvironment(map.id, grid, walking ?? state.location.pos),
      );
    const scale = partyScale(map.projection);
    const units: RenderUnit[] = state.party.map((member, index) => {
      // A practising bender draws their bend's cels, as combat does (ADR 0055).
      const bend = animator.bendPose(now, member.id);
      const pose = animator.unitPose(now, member.id, member.sprite);
      const unit: RenderUnit = {
        id: member.id,
        pos: index === 0 ? state.location.pos : (seats[index] ?? state.location.pos),
        size: 1,
        sprite: member.sprite,
        name: member.name,
        faction: 'party',
        hp: member.hp,
        maxHp: member.base.maxHp,
        statuses: [],
        fallen: false,
        // A health bar over someone strolling round a village is noise.
        showHealth: false,
        shadow: true,
        scale,
        renderPos: index === 0 ? walking : animator.renderPos(now, member.id),
        offset: animator.offset(now, member.id, member.sprite),
        clipTime: pose?.clipTime,
        ...animator.locomotion(now, member.id, 'rest', member.sprite),
      };
      if (!bend) return unit;
      return {
        ...unit,
        facing: 1,
        clip: 'stance',
        bend,
        flash: pose?.flash,
      };
    });
    this.localMap?.update(units.map((unit) => unit.renderPos ?? unit.pos));

    // Residents and background roles come from the walks, in their drawn
    // places; signs and other unbound NpcDefs stand where they are defined.
    const people = residents.figures();
    const npcs: NpcMarker[] = [
      ...visibleNpcs(this.app.content, map, state)
        .filter((npc) => !npc.resident)
        .map((npc) => ({
          id: npc.id,
          pos: npc.pos,
          sprite: npc.sprite,
          name: npc.name,
          scale: npcPresentationScale(npc.sprite, map.projection),
          // Someone at a post on a G sheet faces the camera on its idle loop.
          ...(sheetLocomotion(npc.sprite)?.headings === 8
            ? { clip: 'idleSouthEast' as const, clipTime: now + idlePhase(npc.id) }
            : {}),
        })),
      ...people.map((who) => ({
        id: who.id,
        npcId: who.npcId ?? undefined,
        pos: who.pos ?? who.drawPos,
        sprite: who.sprite,
        name: who.name,
        scale: npcPresentationScale(who.sprite, map.projection),
        renderPos: who.drawPos,
        offset: who.offset,
        facing: who.facing,
        alpha: who.alpha,
        clipTime: who.clipTime,
        walking: who.walking,
        clip: who.clip,
        poseScale: who.poseScale,
        lean: who.lean,
        quiet: !who.npcId || !who.pos,
      })),
      ...activeTriggers(map, state).flatMap((trigger) => {
        const pos = trigger.area[0];
        return pos
          ? [
              {
                id: `trigger:${trigger.id}`,
                pos,
                sprite: trigger.sprite,
                name: trigger.label,
                scale: triggerPresentationScale(map, trigger.sprite),
              },
            ]
          : [];
      }),
    ];
    const gone = new Set(people.filter((who) => !who.pos).map((who) => who.id));
    this.targets = npcs
      .filter((npc) => !gone.has(npc.id))
      .map((npc) => ({ at: npc.renderPos ?? npc.pos, scale: npc.scale ?? 1, to: npc.pos }));
    this.lastNpcs = npcs;
    // A conversation frames its real speaker while legal party tracks finish.
    // Otherwise keep the existing walk/practice camera behavior.
    if (!this.frameConversationSpeaker(npcs)) {
      const glide = this.practiceCamera;
      if (glide) {
        const ms = motionReduced() ? 0 : PRACTICE_GLIDE_MS;
        const to = glide.back ? (walking ?? state.location.pos) : glide.to;
        renderer.camera.centreOn(glidePoint(glide.from, to, now - glide.start, ms));
        if (glide.back && now - glide.start >= ms) this.practiceCamera = null;
      } else if (walking) {
        this.framingArrival = false;
        renderer.camera.centreOn(walking);
      }
    }

    // The air over the village and the light on its painted canal are fidelity,
    // drawn on both backends. Under reduce motion the motes and glints go and
    // the chimney smoke is one still wisp.
    const ambient = ambientEmitters(
      ambienceFx(map.ambience),
      grid,
      now,
      map.scene?.chimneys,
      motionReduced(),
      map.scene?.paintedWater ? waterCells(grid) : [],
      map.scene?.canopies,
      { sources: map.scene?.ambienceSources, phase: state.world.clock.phase },
    );

    // Finish the legal route already in flight before previewing queued intent.
    const cue = displayedRoute(this.walking, this.nextWalk.preview(state));
    if (
      cue &&
      (!this.routePreview ||
        this.routePreview.from !== cue.from ||
        this.routePreview.path !== cue.path)
    ) {
      this.routePreview = createRoutePreview(cue.from, cue.path);
    } else if (!cue) {
      this.routePreview = null;
    }
    const route = this.routePreview
      ? updateRoutePreview(this.routePreview, walking ?? cue?.from ?? this.routePreview.from)
      : null;
    const view: MapView = {
      grid,
      units: this.life ? [] : units,
      npcs: this.life ? [] : npcs,
      // Props are a combat concern: they are instantiated into a BattleState,
      // and there is no battle out here on the village map.
      props: [],
      overlays: [],
      path: route?.path ?? [],
      pathFrom: route?.from ?? null,
      pathOrigin: route?.origin ?? null,
      pathStart: route?.startIndex ?? 0,
      calmPath: true,
      aimArc: null,
      // A practice's casts (issue #284) play their own effects over the ambience.
      emitters: [...ambient, ...animator.emitters(now)],
      bendFx: animator.bendFx(now),
      floaters: [],
      cameraNudge: animator.cameraNudge(now),
      activeUnitId: leader?.id ?? null,
      selectedUnitId: null,
      hoverTile: this.hover,
      exit: map.exit ?? null,
      exits: map.exits,
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      atmosphere: !this.life && !this.app.settings.highContrast,
      backdrop: this.app.backdropFor(map.id),
      scene: map.scene,
      time: now,
      reducedMotion: motionReduced(),
    };

    renderer.draw(view);
    this.lastLife = { units, now };
    this.life?.draw(units, renderer.camera, now);
    this.drawNpcNames(npcs, !held && live && !this.life ? state.location.pos : null);
    const target =
      !held && live && !this.practiceCamera && this.objectiveButton?.hidden === false
        ? resolveObjectivePointerTarget(
            worldObjectiveTargetId(this.app.content, state),
            map.exits,
            npcs,
          )
        : null;
    drawObjectivePointer(this.objectivePointer, this.mapCorner, renderer.camera, target);
  };
}
