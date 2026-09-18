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
import { activeTriggers } from '../../core/story/world';
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
import { button, clear, el, mark, motionReduced } from '../ui/dom';
import { UI_MARKS } from '../ui/marks';
import { partyRoster } from '../ui/PartyRoster';
import { SaveMenu } from '../ui/SaveMenu';
import { UnitInspector } from '../ui/UnitInspector';
import { showGridLines } from '../storage/localSaves';

/** How far Talk reaches, in tiles: across the square, not across the village. */
const TALK_RANGE = 3;

export class ExploreScene implements Scene {
  readonly name = 'explore';

  private life: VillageLife | null = null;
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
  private departing: GameState | null = null;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    clear(host);

    const scene = el('div', { class: 'scene explore-scene' });
    scene.appendChild(el('div', { class: 'top-bar explore-bar' }));

    const canvas = el('canvas', { class: 'map-canvas', attrs: { 'aria-label': 'Village map' } });
    this.canvas = canvas;
    scene.appendChild(
      el('div', { class: 'explore-body' }, el('div', { class: 'map-wrap' }, canvas)),
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

    this.setupRenderer();
    this.renderChrome();
    this.loop();
  }

  unmount(): void {
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
    const map = this.app.content.maps.get(state.location.mapId);
    if (map && map.id !== this.map?.id) {
      this.departing = null;
      this.app.animator.clear();
      this.map = map;
      this.setupLife();
      this.grid = buildGrid(map);
      this.trail = null;
      this.renderer?.resize({ width: map.width, height: map.height });
      this.renderer?.camera.fitExplore();
      this.renderer?.camera.centreOn(state.location.pos);
    }
    this.renderChrome();
  }

  /**
   * The walk the rules reported for the leader, played for the followers
   * too: each takes the tiles the line held between its old place and its
   * new one, laid alongside the leader's track so the whole party moves at
   * once and stays a tile apart.
   */
  onEvents(events: readonly GameEvent[], now: number): void {
    const state = this.app.state;
    const grid = this.grid;
    if (!state || !grid) return;
    for (const event of events) {
      if (event.type !== 'partyWalked') continue;
      if (this.map && state.location.mapId !== this.map.id) {
        this.departing = {
          ...state,
          location: { mapId: this.map.id, pos: event.path[event.path.length - 1] ?? event.from },
        };
      }
      const trail = this.ensureTrail(state, grid, event.from);
      const before = trail.positions(state.party.length);
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
        avoid: this.map?.npcs.map((npc) => npc.pos) ?? [],
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
    this.renderer?.resize(map ? { width: map.width, height: map.height } : undefined);
    this.refit();
  }

  /**
   * Re-fits after the canvas box changed. `fitExplore` centres on the middle of
   * the map, which on a village larger than the viewport would throw the party
   * off screen, so put them back in the middle of the frame afterwards.
   */
  private refit(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    camera.fitExplore();
    const pos = this.departing?.location.pos ?? this.app.state?.location.pos;
    if (pos) camera.centreOn(pos);
  }

  /* ---------------------------------------------------------------- */
  /* Chrome: the banner, the roster, the hotbar                        */
  /* ---------------------------------------------------------------- */

  /** DOM, all of it, rebuilt whenever the state changes: it is cheap and it is right. */
  private renderChrome(): void {
    this.renderBanner();
    this.renderRoster();
    this.renderHud();
  }

  private renderBanner(): void {
    const banner = this.host?.querySelector<HTMLElement>('.explore-bar');
    if (!banner) return;
    clear(banner);
    const node = this.app.currentNode();
    const objective = this.map?.objective ?? (node?.kind === 'explore' ? node.objective : '');
    this.canvas?.setAttribute('aria-label', `${this.map?.name ?? 'World'} map`);
    // At the gate the banner says where it leads, which the map cannot.
    const line = this.atGate() ?? objective;

    banner.appendChild(
      el(
        'div',
        { class: 'title-plate' },
        el('strong', { class: 'title-plate-name', text: this.app.placeLabel() }),
        line
          ? el('span', { class: 'title-plate-objective', text: line, attrs: { title: line } })
          : null,
      ),
    );
    banner.appendChild(el('div', { class: 'spacer' }));
    banner.appendChild(
      el('span', { class: 'muted tiny hide-narrow', text: 'Tap to walk. Tap someone to talk.' }),
    );
    if (!this.life) {
      banner.appendChild(
        button('Follow party', () => {
          const state = this.departing ?? this.app.state;
          if (!state) return;
          const leader = state.party[0];
          const pos = leader
            ? (this.app.animator.renderPos(performance.now(), leader.id) ?? state.location.pos)
            : state.location.pos;
          this.renderer?.camera.centreOn(pos);
        }),
      );
    }
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
    clear(hud);
    if (this.life && this.renderer) {
      this.life.renderControls(hud, this.renderer.camera);
      return;
    }

    const bar = el('div', {
      class: 'hud-panel action-bar',
      attrs: { role: 'toolbar', 'aria-label': 'Party actions' },
    });
    const row = el('div', { class: 'action-row' });

    const npc = this.nearestNpc(state.location.pos);
    const inspect = npc?.sprite.startsWith('world.') ?? false;
    const talk = button(inspect ? 'Inspect' : 'Talk', () => this.talkTo(npc), {
      class: 'action-button',
      disabled: !npc,
      title: npc
        ? `Walk over and ${inspect ? 'inspect' : 'talk to'} ${npc.name}`
        : 'Nobody is close enough to talk to',
    });
    talk.prepend(mark(UI_MARKS.talk));
    talk.appendChild(el('span', { class: 'action-sub', text: npc?.name ?? 'No one near' }));
    row.appendChild(talk);

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

    const save = button(
      'Save',
      () => new SaveMenu(this.app, { mode: 'save' }).open(this.overlayHost()),
      {
        class: 'action-button',
        title: 'Save the game to a slot',
        disabled: this.app.previewActive,
      },
    );
    save.prepend(mark(UI_MARKS.save));
    row.appendChild(save);

    const pause = button('Pause', () => this.app.openPause(), {
      class: 'action-button',
      title: 'Settings, saves, and the way out',
    });
    pause.prepend(mark(UI_MARKS.pause));
    row.appendChild(pause);

    bar.appendChild(row);
    hud.appendChild(bar);
    const routes = el('div', {
      class: 'action-row',
      attrs: { role: 'navigation', 'aria-label': 'Routes from this area' },
    });
    for (const exit of this.map?.exits ?? []) {
      const open = evaluate(state, exit.requires);
      routes.appendChild(
        button(
          exit.label,
          () => {
            if (!this.app.animator.busy(performance.now()))
              this.app.dispatch({ type: 'walkTo', pos: exit.pos });
          },
          { title: open ? `Walk to ${exit.label}` : exit.lockedHint, disabled: !open },
        ),
      );
    }
    if (routes.childElementCount) hud.appendChild(routes);
  }

  /** The villager nearest the leader within Talk's reach, if any. */
  private nearestNpc(from: Vec2): NpcDef | null {
    let best: NpcDef | null = null;
    let nearest = TALK_RANGE + 1;
    for (const npc of this.map?.npcs ?? []) {
      const gap = distance(from, npc.pos);
      if (gap < nearest) {
        best = npc;
        nearest = gap;
      }
    }
    return best;
  }

  private talkTo(npc: NpcDef | null): void {
    if (!npc || this.app.animator.busy(performance.now())) return;
    // The rules walk the party up to the villager and open the conversation.
    this.app.dispatch({ type: 'walkTo', pos: npc.pos });
  }

  private inspect(unit: Unit): void {
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
    this.renderer.camera.fitExplore();
    this.renderer.camera.centreOn(state.location.pos);

    // The chrome round the map can still grow — a late web font, a longer
    // objective on the next node, the roster becoming a strip — and every
    // pixel the camera reports has to keep matching the pixels the backend
    // draws, or taps land a tile out.
    this.renderer.onViewportChange = () => this.refit();
    this.setupLife();

    this.detach = attachPointer(canvas, {
      onTap: (point) => this.handleTap(point.x, point.y),
      onDrag: (delta) => {
        this.renderer?.camera.panBy(delta.x, delta.y);
      },
      onPinch: (gesture) => {
        this.renderer?.camera.zoomAt(gesture.centre, gesture.step);
        this.renderer?.camera.panBy(gesture.delta.x, gesture.delta.y);
      },
      onWheel: (wheel) => this.renderer?.camera.zoomAt(wheel.point, wheelZoomFactor(wheel)),
      onHover: (point) => {
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
    const renderer = this.renderer;
    const state = this.app.state;
    if (!renderer || !state) return;
    // A tap mid-walk would put the party ahead of its own figure.
    if (this.app.animator.busy(performance.now())) return;
    const tile = renderer.camera.toTile(x, y);
    if (this.life?.handleTap(tile, performance.now())) return;
    this.app.dispatch({ type: 'walkTo', pos: tile });
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
    if (this.life?.update(now)) return;
    this.app.animator.prune(now);
    this.app.stats?.frame(now);

    // The whole party walks the village: the leader on the rules' tile, the
    // others in a line behind, each their own figure.
    const leader = state.party[0];
    const walking = leader ? this.app.animator.renderPos(now, leader.id) : undefined;
    // The camera follows the walk and rests where it ends; a drag afterwards stays.
    if (walking) renderer.camera.centreOn(walking);
    const seats = this.ensureTrail(state, grid).positions(state.party.length);
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
      renderPos: index === 0 ? walking : this.app.animator.renderPos(now, member.id),
      offset: this.app.animator.offset(now, member.id),
      clipTime: this.app.animator.unitPose(now, member.id)?.clipTime,
      ...this.app.animator.locomotion(now, member.id),
    }));

    const npcs: NpcMarker[] = [
      ...map.npcs.map((npc) => ({ pos: npc.pos, sprite: npc.sprite, name: npc.name })),
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

    const view: MapView = {
      grid,
      units: this.life ? [] : units,
      npcs: this.life ? [] : npcs,
      // Props are a combat concern: they are instantiated into a BattleState,
      // and there is no battle out here on the village map.
      props: [],
      overlays: [],
      path: [],
      pathFrom: null,
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
      time: now,
    };

    renderer.draw(view);
    this.life?.draw(units, renderer.camera, now);
  };
}
