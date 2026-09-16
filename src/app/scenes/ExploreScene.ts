/**
 * The village.
 *
 * Tap a tile to walk, tap an NPC to talk, tap the glowing gate to leave. The
 * camera pans by drag because the village is bigger than the viewport, and the
 * objective sits in a banner at the top so nobody has to remember what they
 * were doing when they picked the tablet back up.
 */

import type { App, Scene } from '../App';
import type { GameEvent, GameState, Grid, MapDef, Unit, Vec2 } from '../../core/types';
import { buildGrid, samePos } from '../../core/rules/grid';
import { Renderer } from '../../render/renderer';
import type { MapView, NpcMarker, RenderUnit } from '../../render/renderer';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { ambienceFx } from '../../content/fx';
import { ambientEmitters } from '../anim/ambience';
import { PartyTrail, placeParty } from '../anim/trail';
import { button, clear, el, motionReduced } from '../ui/dom';
import { showGridLines } from '../storage/localSaves';

export class ExploreScene implements Scene {
  readonly name = 'explore';

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
   * one member each. Presentation only, never saved; stood up again round the
   * leader whenever the party lands somewhere without walking there.
   */
  private trail: PartyTrail | null = null;

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    clear(host);

    const scene = el('div', { class: 'scene explore-scene' });

    const banner = el('div', { class: 'top-bar explore-bar' });
    scene.appendChild(banner);

    const canvas = el('canvas', { class: 'map-canvas', attrs: { 'aria-label': 'Village map' } });
    this.canvas = canvas;
    scene.appendChild(el('div', { class: 'map-wrap' }, canvas));

    host.appendChild(scene);

    this.buildBanner(banner);
    this.setupRenderer();
    this.loop();
  }

  unmount(): void {
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
      this.map = map;
      this.grid = buildGrid(map);
      this.trail = null;
      this.renderer?.resize({ width: map.width, height: map.height });
      this.renderer?.camera.fitExplore();
      this.renderer?.camera.centreOn(state.location.pos);
    }
    const banner = this.host?.querySelector<HTMLElement>('.explore-bar');
    if (banner) this.buildBanner(banner);
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
        const move: GameEvent = { type: 'unitMoved', unitId: member.id, path: route.path, cost: 0 };
        this.app.animator.push(now, [move], unitsBefore, { alongside: true });
      }
    }
  }

  /**
   * The line the party stands in, seated afresh round the leader when there
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
    const pos = this.app.state?.location.pos;
    if (pos) camera.centreOn(pos);
  }

  /* ---------------------------------------------------------------- */

  private buildBanner(banner: HTMLElement): void {
    clear(banner);
    const node = this.app.currentNode();
    const objective = node?.kind === 'explore' ? node.objective : '';

    banner.appendChild(
      el(
        'div',
        { class: 'stack tight' },
        el('strong', { text: this.app.placeLabel() }),
        objective ? el('span', { class: 'muted tiny', text: objective }) : null,
      ),
    );
    banner.appendChild(el('div', { class: 'spacer' }));
    banner.appendChild(
      el('span', { class: 'muted tiny hide-narrow', text: 'Tap to walk. Tap someone to talk.' }),
    );
    banner.appendChild(button('Pause', () => this.app.openPause(), { class: 'btn-ghost' }));
  }

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

    // The banner above the map can still grow — a late web font, or a longer
    // objective on the next node — and every pixel the camera reports has to
    // keep matching the pixels the backend draws, or taps land a tile out.
    this.renderer.onViewportChange = () => this.refit();

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

  private handleTap(x: number, y: number): void {
    const renderer = this.renderer;
    const state = this.app.state;
    if (!renderer || !state) return;
    // A tap mid-walk would put the party ahead of its own figure.
    if (this.app.animator.busy(performance.now())) return;
    const tile = renderer.camera.toTile(x, y);
    this.app.dispatch({ type: 'walkTo', pos: tile });
  }

  /* ---------------------------------------------------------------- */

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const state = this.app.state;
    const map = this.map;
    const grid = this.grid;
    if (!renderer || !state || !map || !grid) return;

    const now = performance.now();
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
      facing: this.app.animator.facing(member.id) ?? 1,
    }));

    const npcs: NpcMarker[] = map.npcs.map((npc) => ({
      pos: npc.pos,
      sprite: npc.sprite,
      name: npc.name,
    }));

    // The air over the village is fidelity: WebGL only, and still under reduce motion.
    const ambient =
      renderer.capabilities.shaders && !motionReduced()
        ? ambientEmitters(ambienceFx(map.ambience), grid, now)
        : [];

    const view: MapView = {
      grid,
      units,
      npcs,
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
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      atmosphere: !this.app.settings.highContrast,
      backdrop: this.app.backdropFor(map.id),
      time: now,
    };

    renderer.draw(view);
  };
}
