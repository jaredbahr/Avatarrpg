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
import { evaluate } from '../../core/story/conditions';
import {
  activeTriggers,
  visibleNpcs,
  worldObjective,
  worldObjectiveNpcId,
} from '../../core/story/world';
import { VillageLife } from '../village/VillageLife';
import type { App, CameraInfo, Scene } from '../App';
import type { GameEvent, GameState, Grid, MapDef, NpcDef, Unit, Vec2 } from '../../core/types';
import { buildGrid, distance, samePos } from '../../core/rules/grid';
import { Renderer, TILE } from '../../render/renderer';
import type { MapView, NpcMarker, RenderUnit } from '../../render/renderer';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { ambienceFx } from '../../content/fx';
import { ambientEmitters } from '../anim/ambience';
import { PartyTrail, placeParty } from '../anim/trail';
import type { FollowerRoute } from '../anim/trail';
import { button, clear, el, mark, motionReduced } from '../ui/dom';
import { UI_MARKS } from '../ui/marks';
import { partyRoster } from '../ui/PartyRoster';
import { SaveMenu } from '../ui/SaveMenu';
import { UnitInspector } from '../ui/UnitInspector';
import { TravelJournal } from '../ui/TravelJournal';
import { showGridLines } from '../storage/localSaves';
import { NextWalk, previewWalk } from '../world/walking';
import type { WalkPreview } from '../world/walking';
import { NearbyPlaces } from '../ui/NearbyPlaces';
import { LocalMap, LocalMapDialog } from '../ui/LocalMap';
import { courtyardEnvironment } from '../audio/environment';
import { partyScale } from '../anim/actorScale';
import { worldConversationFor } from '../../content/story/presentations';
import { conversationPanel } from '../ui/ConversationPanel';

/** How far Talk reaches, in tiles: across the square, not across the village. */
const TALK_RANGE = 3;

export class ExploreScene implements Scene {
  readonly name = 'explore';

  private life: VillageLife | null = null;
  private localMap: LocalMap | null = null;
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: Renderer | null = null;
  private detach: (() => void) | null = null;
  private frame = 0;
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
  private feedback: HTMLElement | null = null;
  private feedbackText: HTMLElement | null = null;
  private cancelNext: HTMLButtonElement | null = null;
  /** The last canvas box, so a reflow keeps the same world point in view. */
  private viewSize: { width: number; height: number } | null = null;
  /** True while a registered world conversation sits over this map. */
  private conversationMode = false;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    clear(host);
    this.conversationMode = Boolean(worldConversationFor(this.app.content, this.app.state));

    const scene = el('div', { class: 'scene explore-scene' });
    scene.appendChild(el('div', { class: 'top-bar explore-bar' }));

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
          el('div', { class: 'explore-objective' }),
          el('div', { class: 'explore-map-corner' }),
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
    this.renderChrome();
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
    this.localMap = null;
    this.life?.destroy();
    this.life = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.detach?.();
    this.detach = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.canvas = null;
    this.host = null;
  }

  sync(): void {
    const state = this.app.state;
    if (!state) return;
    const conversation = Boolean(worldConversationFor(this.app.content, state));
    const map = this.app.content.maps.get(state.location.mapId);
    if (map && map.id !== this.map?.id) {
      this.nextWalk.clear();
      this.walking = null;
      this.updateWalkFeedback();
      this.departing = null;
      this.app.animator.clear();
      this.map = map;
      this.app.animator.setProjection(map.projection ?? 'orthographic');
      this.setupLife();
      this.grid = buildGrid(map);
      this.trail = null;
      this.needsSettle = true;
      this.renderer?.resize({ width: map.width, height: map.height });
      if (this.renderer) this.renderer.camera.projection = map.projection ?? 'orthographic';
      this.renderer?.camera.fitExplore(map.projection ? 96 : 48);
      this.renderer?.camera.centreOn(state.location.pos);
      this.rememberViewSize();
    }
    this.setConversationMode(conversation);
    this.renderChrome();
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
        this.map?.projection === 'oblique'
          ? trail.planWalk(
              event.path,
              state.party.length,
              grid,
              visibleNpcs(this.map, state).map((npc) => npc.pos),
            )
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
        this.app.animator.push(now, [move], unitsBefore, { alongside: true });
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
          { alongside: index > 0, silentSteps: route.index !== 0, delayMs: route.delayMs },
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
        avoid: this.map ? visibleNpcs(this.map, state).map((npc) => npc.pos) : [],
      }),
    );
    this.trail = seated;
    return seated;
  }

  /** The camera as plain numbers, for the e2e suite to map a tile to a pixel. */
  cameraInfo(): CameraInfo | null {
    const camera = this.renderer?.camera;
    if (!camera) return null;
    return {
      projection: camera.projection,
      groundTransform: camera.groundMatrix(),
      tilePx: TILE * camera.scale,
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
    this.rememberViewSize();
  }

  private rememberViewSize(): void {
    const viewport = this.renderer?.camera.viewport;
    if (viewport) this.viewSize = { width: viewport.width, height: viewport.height };
  }

  private setConversationMode(active: boolean): void {
    const entered = active && !this.conversationMode;
    this.conversationMode = active;
    if (entered) this.app.animator.clear();
    if (active) {
      this.clearWorldIntent();
      this.needsSettle = false;
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

  /** DOM, all of it, rebuilt whenever the state changes: it is cheap and it is right. */
  private renderChrome(): void {
    this.renderBanner();
    this.renderRoster();
    this.renderHud();
    this.renderConversation();
  }

  private renderBanner(): void {
    const banner = this.host?.querySelector<HTMLElement>('.explore-bar');
    if (!banner) return;
    clear(banner);
    const objective = this.app.state ? worldObjective(this.app.content, this.app.state) : null;
    this.canvas?.setAttribute('aria-label', `${this.map?.name ?? 'World'} map`);
    banner.append(
      el('strong', { class: 'title-plate-name', text: this.app.placeLabel() }),
      el('span', {
        class: 'explore-mode hide-narrow',
        text: this.conversationMode ? 'Conversation' : 'Exploring',
      }),
      el('div', { class: 'spacer' }),
    );
    if (!this.conversationMode) {
      banner.append(
        button(
          'Travel journal',
          () => {
            if (!this.app.animator.busy(performance.now()))
              new TravelJournal(this.app).open(this.overlayHost());
          },
          { class: 'explore-header-action' },
        ),
        button('Save', () => new SaveMenu(this.app, { mode: 'save' }).open(this.overlayHost()), {
          class: 'explore-header-action',
          disabled: this.app.previewActive,
        }),
      );
    }
    banner.append(button('Pause', () => this.app.openPause(), { class: 'explore-header-action' }));
    const objectiveHost = this.host?.querySelector<HTMLElement>('.explore-objective');
    if (objectiveHost) {
      clear(objectiveHost);
      objectiveHost.hidden = this.conversationMode || !objective;
      if (objective)
        objectiveHost.append(
          el('strong', { class: 'tiny', text: 'Current objective' }),
          el('span', { class: 'title-plate-objective', text: objective }),
        );
      const gate = this.atGate();
      if (gate) objectiveHost.append(el('span', { class: 'tiny muted', text: gate }));
    }
    const corner = this.host?.querySelector<HTMLElement>('.explore-map-corner');
    const state = this.app.state;
    if (corner && state && this.map && this.grid) {
      clear(corner);
      corner.hidden = this.conversationMode || !!this.life;
      this.localMap = new LocalMap(this.map, this.grid, state);
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

  private followParty(): void {
    if (this.conversationMode) return;
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
    const exit = this.map?.exits?.find((item) => distance(state.location.pos, item.pos) <= 1);
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
    const npc = moving ? null : this.nearestNpc(state.location.pos);
    const inspect = npc?.sprite.startsWith('world.') ?? false;
    const context = el(
      'div',
      { class: 'explore-context' },
      mark(npc ? UI_MARKS.talk : UI_MARKS.move),
      el('strong', {
        text: npc ? `${inspect ? 'Inspect' : 'Speak with'} ${npc.name}` : 'Tap a path to move',
      }),
      el('span', {
        class: 'tiny muted',
        text:
          this.atGate() ??
          (npc
            ? `Tap ${inspect ? 'Inspect' : 'Talk'}, or choose another path.`
            : 'Drag to look around · Follow party to recenter'),
      }),
    );
    if (moving) clear(context);
    if (this.feedback) context.appendChild(this.feedback);
    this.updateWalkFeedback();
    hud.appendChild(context);
    const talk = button(inspect ? 'Inspect' : 'Talk', () => this.talkTo(npc), {
      class: 'action-button',
      disabled: !npc,
      title: npc
        ? `Walk over and ${inspect ? 'inspect' : 'talk to'} ${npc.name}`
        : 'Nobody is close enough to talk to',
    });
    talk.prepend(mark(UI_MARKS.talk));
    talk.appendChild(
      el('span', { class: 'action-sub', text: moving ? 'Walking' : (npc?.name ?? 'No one near') }),
    );
    row.appendChild(talk);

    const look = button(
      'Look around',
      () => {
        new NearbyPlaces(this.app, (pos) => this.requestWalk(pos)).open(this.overlayHost());
      },
      { class: 'action-button', title: 'Find nearby people and places along this path' },
    );
    look.prepend(mark(UI_MARKS.talk));
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
    const map = button(
      'Map',
      () => {
        if (!this.map || !this.grid) return;
        new LocalMapDialog(
          this.map,
          this.grid,
          state,
          this.app.content,
          this.partyPositions() ?? [state.location.pos],
          (pos) => this.requestWalk(pos),
          () => this.followParty(),
          worldObjectiveNpcId(this.app.content, state),
        ).open(this.overlayHost());
      },
      { class: 'action-button', title: 'Local map and routes' },
    );
    map.prepend(mark(UI_MARKS.recentre));
    row.insertBefore(map, look);
    bar.appendChild(row);
    hud.appendChild(bar);
  }

  private renderConversation(): void {
    const host = this.host?.querySelector<HTMLElement>('.explore-conversation');
    if (!host) return;
    const focused = document.activeElement;
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
    const target = refocusNext
      ? (host.querySelector<HTMLElement>('[data-conversation-control="next"]') ??
        host.querySelector<HTMLElement>('.choice-option:not([disabled])') ??
        panel)
      : refocusPanel
        ? panel
        : (host.querySelector<HTMLElement>('[data-conversation-control="next"]') ??
          host.querySelector<HTMLElement>('.choice-option:not([disabled])') ??
          panel);
    target?.focus({ preventScroll: true });
  }

  /** The villager nearest the leader within Talk's reach, if any. */
  private nearestNpc(from: Vec2): NpcDef | null {
    const state = this.app.state;
    if (!state || !this.map) return null;
    let best: NpcDef | null = null;
    let nearest = TALK_RANGE + 1;
    let proximity = Infinity;
    for (const npc of visibleNpcs(this.map, state)) {
      const gap = distance(from, npc.pos);
      const groundGap = Math.hypot(from.x - npc.pos.x, from.y - npc.pos.y);
      if (gap < nearest || (gap === nearest && gap <= TALK_RANGE && groundGap < proximity)) {
        best = npc;
        nearest = gap;
        proximity = groundGap;
      }
    }
    return best;
  }

  private talkTo(npc: NpcDef | null): void {
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
    this.app.animator.setProjection(this.renderer.camera.projection);
    this.renderer.camera.fitExplore(map.projection ? 96 : 48);
    this.renderer.camera.centreOn(state.location.pos);
    this.rememberViewSize();

    // The chrome round the map can still grow — a late web font, a longer
    // objective on the next node, the roster becoming a strip — and every
    // pixel the camera reports has to keep matching the pixels the backend
    // draws, or taps land a tile out.
    this.renderer.onViewportChange = () => this.refit();
    this.setupLife();

    this.detach = attachPointer(canvas, {
      onTap: (point) => this.handleTap(point.x, point.y),
      onDrag: (delta) => {
        if (this.conversationMode) return;
        this.renderer?.camera.panBy(delta.x, delta.y);
      },
      onPinch: (gesture) => {
        if (this.conversationMode) return;
        this.renderer?.camera.zoomAt(gesture.centre, gesture.step);
        this.renderer?.camera.panBy(gesture.delta.x, gesture.delta.y);
      },
      onWheel: (wheel) => {
        if (this.conversationMode) return;
        this.renderer?.camera.zoomAt(wheel.point, wheelZoomFactor(wheel));
      },
      onHover: (point) => {
        if (this.conversationMode) {
          this.hover = null;
          return;
        }
        this.hover = point ? (this.renderer?.camera.toTile(point.x, point.y) ?? null) : null;
      },
    });
  }

  private setupLife(): void {
    this.life?.destroy();
    this.life = null;
    const wrap = this.canvas?.parentElement;
    const active = this.map?.id === RIVERSIDE_ID;
    this.host?.querySelector('.explore-scene')?.classList.toggle('riverside-scene', active);
    if (active && wrap) this.life = new VillageLife(this.app, wrap);
  }

  private handleTap(x: number, y: number): void {
    if (this.conversationMode) return;
    const renderer = this.renderer;
    const state = this.app.state;
    if (!renderer || !state) return;
    const tile = renderer.camera.toTile(x, y);
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

  private requestWalk(pos: Vec2): void {
    const state = this.app.state;
    if (this.conversationMode) return;
    if (!state || state.screen !== 'explore' || state.location.mapId !== this.map?.id) return;
    if (this.life?.busy(performance.now())) return;
    if (this.app.animator.busy(performance.now())) {
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
    if (this.conversationMode) return;
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
    this.frame = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const state = this.departing ?? this.app.state;
    const map = this.map;
    const grid = this.grid;
    if (!renderer || !state || !map || !grid) return;

    const now = performance.now();
    // Long roaming sessions must retire old walk tracks just as combat does.
    this.app.animator.prune(now);
    // Never carry queued intent through a menu, a loaded save, a story/map
    // change, or a world conversation.
    if (this.conversationMode || document.hidden || document.querySelector('[role="dialog"]'))
      this.clearNextWalk();
    if (!this.conversationMode && !this.app.animator.busy(now)) {
      if (this.walking) {
        this.walking = null;
        this.updateWalkFeedback();
      }
      const next = this.nextWalk.take(state);
      if (next) {
        this.requestWalk(next);
        return;
      }
      if (
        this.needsSettle &&
        map.projection === 'oblique' &&
        !this.departing &&
        !document.querySelector('[role="dialog"]')
      ) {
        this.needsSettle = false;
        const trail = this.ensureTrail(state, grid);
        const routes = trail.settle(
          grid,
          visibleNpcs(map, state).map((npc) => npc.pos),
        );
        const batches: FollowerRoute[][] = [];
        for (const route of routes) (batches[route.batch ?? 0] ??= []).push(route);
        this.animatePartyBatches(batches, state, now);
      }
    }
    if (!this.conversationMode && this.life?.update(now)) return;
    if (this.hudMoving !== this.app.animator.busy(now)) this.renderHud();
    this.app.stats?.frame(now);

    // The whole party walks the village: the leader on the rules' tile, the
    // others in a line behind, each their own figure.
    const leader = state.party[0];
    const walking = leader ? this.app.animator.renderPos(now, leader.id) : undefined;
    if (document.hidden) this.app.audio.clearEnvironment();
    else
      this.app.audio.updateEnvironment(
        courtyardEnvironment(map.id, grid, walking ?? state.location.pos),
      );
    // The camera follows the walk and rests where it ends; a drag afterwards stays.
    if (walking) renderer.camera.centreOn(walking);
    const seats = this.ensureTrail(state, grid).positions(state.party.length);
    this.localMap?.update(
      seats.map(
        (seat, index) =>
          this.app.animator.renderPos(now, state.party[index]?.id ?? '') ??
          (index === 0 ? state.location.pos : seat),
      ),
    );
    const units: RenderUnit[] = state.party.map((member, index) => ({
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
      scale: partyScale(map.projection),
      renderPos: index === 0 ? walking : this.app.animator.renderPos(now, member.id),
      offset: this.app.animator.offset(now, member.id),
      clipTime: this.app.animator.unitPose(now, member.id)?.clipTime,
      ...this.app.animator.locomotion(now, member.id, 'rest'),
    }));

    const npcs: NpcMarker[] = [
      ...visibleNpcs(map, state).map((npc) => ({
        pos: npc.pos,
        sprite: npc.sprite,
        name: npc.name,
        scale: map.projection === 'oblique' ? 1.5 : 1,
      })),
      ...activeTriggers(map, state).flatMap((trigger) => {
        const pos = trigger.area[0];
        return pos ? [{ pos, sprite: trigger.sprite, name: trigger.label }] : [];
      }),
    ];

    // The air over the village is fidelity: WebGL only, and still under reduce motion.
    const ambient =
      renderer.capabilities.shaders && !motionReduced()
        ? ambientEmitters(ambienceFx(map.ambience), grid, now)
        : [];

    const cue = this.nextWalk.preview(state) ?? this.walking;
    const view: MapView = {
      grid,
      units: this.life ? [] : units,
      npcs: this.life ? [] : npcs,
      // Props are a combat concern: they are instantiated into a BattleState,
      // and there is no battle out here on the village map.
      props: [],
      overlays: [],
      path: cue?.path ?? [],
      pathFrom: motionReduced() ? null : (cue?.from ?? null),
      aimArc: null,
      emitters: ambient,
      floaters: [],
      cameraNudge: { x: 0, y: 0 },
      activeUnitId: leader?.id ?? null,
      selectedUnitId: null,
      hoverTile: this.hover,
      exit: map.exit ? { pos: map.exit.pos, label: map.exit.label } : null,
      exits: map.exits,
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      atmosphere: !this.life && !this.app.settings.highContrast,
      backdrop: this.app.backdropFor(map.id),
      scene: map.scene,
      time: now,
    };

    renderer.draw(view);
    this.life?.draw(units, renderer.camera, now);
  };
}
