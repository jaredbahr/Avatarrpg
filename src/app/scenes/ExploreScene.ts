/**
 * The village.
 *
 * Tap a tile to walk, tap an NPC to talk, tap the glowing gate to leave. The
 * camera pans by drag because the village is bigger than the viewport, and the
 * objective sits in a banner at the top so nobody has to remember what they
 * were doing when they picked the tablet back up.
 */

import type { App, Scene } from '../App';
import type { Grid, MapDef, Vec2 } from '../../core/types';
import { buildGrid } from '../../core/rules/grid';
import { Renderer } from '../../render/renderer';
import type { MapView, NpcMarker, RenderUnit } from '../../render/renderer';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { button, clear, el } from '../ui/dom';
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
      this.renderer?.resize({ width: map.width, height: map.height });
      this.renderer?.camera.fitExplore();
      this.renderer?.camera.centreOn(state.location.pos);
    }
    const banner = this.host?.querySelector<HTMLElement>('.explore-bar');
    if (banner) this.buildBanner(banner);
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
    const tile = renderer.camera.toTile(x, y);
    this.app.dispatch({ type: 'walkTo', pos: tile });
    const after = this.app.state;
    if (after) renderer.camera.centreOn(after.location.pos);
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

    // The party is drawn as its leader — one figure to move around a village.
    const leader = state.party[0];
    const units: RenderUnit[] = leader
      ? [
          {
            id: leader.id,
            pos: state.location.pos,
            size: 1,
            sprite: leader.sprite,
            name: leader.name,
            faction: 'party',
            hp: leader.hp,
            maxHp: leader.base.maxHp,
            statuses: [],
            fallen: false,
            // A health bar over someone strolling round a village is noise.
            showHealth: false,
            renderPos: this.app.animator.renderPos(now, leader.id),
            offset: this.app.animator.offset(now, leader.id),
            facing: this.app.animator.facing(leader.id) ?? 1,
          },
        ]
      : [];

    const npcs: NpcMarker[] = map.npcs.map((npc) => ({
      pos: npc.pos,
      sprite: npc.sprite,
      name: npc.name,
    }));

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
      fx: [],
      floaters: [],
      activeUnitId: leader?.id ?? null,
      selectedUnitId: null,
      hoverTile: this.hover,
      exit: map.exit ? { pos: map.exit.pos, label: map.exit.label } : null,
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      time: now,
    };

    renderer.draw(view);
  };
}
