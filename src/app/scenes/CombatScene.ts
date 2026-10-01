/**
 * Combat.
 *
 * The interaction loop, in the order a player experiences it:
 *
 *   hand-off banner -> pick Move or an ability -> valid tiles light up
 *   -> tap a tile -> the area and the hit/damage/status chips appear
 *   -> Confirm -> the events play -> repeat until End Turn
 *
 * The confirm step is not friction, it is the whole teaching mechanism. It is
 * where a nine-year-old finds out that the cone catches their sister, that the
 * shot is only 60% because of the cover, and that the target is Wet so the
 * lightning does double. Nothing is committed until it has been shown.
 */

import type { App, Scene, CameraInfo } from '../App';
import type { Ability, BattleState, PropInstance, Unit, Vec2 } from '../../core/types';
import {
  canUseAbility,
  heightReachBonus,
  isValidTarget,
  knownAbilities,
  previewAbility,
  targetableTiles,
  affectedTiles,
} from '../../core/rules/abilities';
import {
  distance,
  climbSurcharge,
  occupiedCells,
  pathCost,
  posKey,
  reachable,
  samePos,
  tileAt,
  unitAt,
  type ReachableCell,
} from '../../core/rules/grid';
import { canMove, effectiveStats, isAlive, statusDefs } from '../../core/rules/stats';
import { SQUARE_FOOTPRINTS, footprintCells, footprintFoot } from '../../core/rules/footprint';
import { activeUnit, upcomingOrder } from '../../core/rules/turnOrder';
import { encounterText } from '../../core/story/encounterText';
import { Renderer, TILE } from '../../render/renderer';
import type { AimArc, MapView, OverlayLayer, RenderProp, RenderUnit } from '../../render/renderer';
import { cliffEdgesFor, type TargetReticleCue } from '../../render/view';
import { weatherAt } from '../../core/rules/obscurement';
import {
  obscuringTiles,
  weatherChipShortText,
  weatherChipText,
} from '../../core/rules/obscurementPresentation';
import { CONTENT } from '../../content';
import { COMBAT_CAMERA_RING_TILES } from '../../content/maps/combat';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { ambienceFx, resolveFx } from '../../content/fx';
import { ambientEmitters } from '../anim/ambience';
import { announce, button, clear, el, mark, motionReduced, painterCanvas, tip } from '../ui/dom';
import { assetCanvas } from '../ui/assetCanvas';
import { portraitKeyFor } from '../ui/PartyRoster';
import { UI_MARKS, markKindFor } from '../ui/marks';
import { iconMarkup } from '../ui/icons';
import { paletteFor } from '../../render/palettes';
import { paintElementGlyph } from '../../render/painters/glyphs';
import { showGridLines } from '../storage/localSaves';
import { reactionNotes } from '../ui/ReactionNote';
import {
  formatHitBreakdownRows,
  formatLedgeDrop,
  formatShoveMovement,
} from '../ui/combatPreviewText';
import { UnitInspector } from '../ui/UnitInspector';
import { PropInspector } from '../ui/PropInspector';
import { enemyScale, partyScale } from '../anim/actorScale';
import { partyBendSprites } from '../anim/bendHandoff';
import { sheetLocomotion } from '../../content/assets/manifest';
import { sheets } from '../../render/sheets/store';
import { createMovementThreatQuery } from '../ui/movementThreats';
import { flushTime } from './flockFlush';

type Mode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'move' }
  | { readonly kind: 'aim'; readonly abilityId: string };

/** A non-target tap must not pin the reticle while pointer hover keeps moving. */
export function overlayMemoHoverKey(
  aiming: boolean,
  pendingIsValidTarget: boolean,
  hover: Vec2 | null,
  movingSquare = false,
): string {
  return ((aiming && !pendingIsValidTarget) || movingSquare) && hover ? posKey(hover) : '';
}

/** Preserve the old horizontal midpoint for the legacy 2x1 boss. */
export function combatFocusPosition(unit: Pick<Unit, 'pos' | 'size'>, square = SQUARE_FOOTPRINTS) {
  return square ? unit.pos : { x: unit.pos.x + (unit.size - 1) / 2, y: unit.pos.y };
}

/** Cells painted by the move-hover ghost; exported for pointer/overlay unit coverage. */
export function moveHoverFootprint(
  anchor: Vec2 | null,
  size: 1 | 2,
  square = SQUARE_FOOTPRINTS,
): readonly Vec2[] {
  return anchor ? footprintCells(anchor, size, square) : [];
}

/**
 * Which way a held knockout is drawn. A G knockout is authored per heading, so
 * it is never mirrored; the bare `ko` of a mirrored sheet (ADR 0069) lies the
 * way the unit was facing when it fell.
 */
export function fallenFacing(clip: string, facing: 1 | -1): 1 | -1 {
  return clip === 'ko' ? facing : 1;
}

/**
 * The unit standing on `tile`, living or defeated, on any footprint cell.
 *
 * The long-press inspector deliberately includes the fallen: holding on a body
 * is how a player reads why it dropped. `unitAt` filters to `hp > 0`, so it
 * finds nobody there. Footprint-aware like `unitAt`, so a large unit is picked
 * on each cell of its footprint rather than only its anchor. The living win: a
 * unit standing where another fell is the one a hold on that tile opens.
 */
export function occupiedUnitAt(units: readonly Unit[], tile: Vec2): Unit | undefined {
  return (
    unitAt(units, tile) ??
    units.find((unit) => occupiedCells(unit).some((cell) => samePos(cell, tile)))
  );
}

export type InspectTarget =
  | { readonly kind: 'unit'; readonly unit: Unit }
  | { readonly kind: 'prop'; readonly prop: PropInstance };

/** Unit-first battlefield lookup; taps omit fallen units while holds include them. */
export function inspectTargetAt(
  units: readonly Unit[],
  props: readonly PropInstance[],
  tile: Vec2,
  includeFallen: boolean,
): InspectTarget | undefined {
  const unit = includeFallen ? occupiedUnitAt(units, tile) : unitAt(units, tile);
  if (unit) return { kind: 'unit', unit };
  const prop = props.find((candidate) => samePos(candidate.pos, tile));
  return prop ? { kind: 'prop', prop } : undefined;
}

interface OverlayBuild {
  readonly overlays: OverlayLayer[];
  readonly path: readonly Vec2[];
  readonly climbMarkers: NonNullable<MapView['climbMarkers']>;
  readonly cliffEdges: NonNullable<MapView['cliffEdges']>;
  readonly rangeBonusTiles: readonly Vec2[];
  readonly targetReticle: TargetReticleCue | null;
}

export class CombatScene implements Scene {
  readonly name = 'combat';

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: Renderer | null = null;
  private detach: (() => void) | null = null;
  private frame = 0;

  private mode: Mode = { kind: 'idle' };
  private pending: Vec2 | null = null;
  private hover: Vec2 | null = null;
  /** How high each ability's flight lobs, or null when nothing flies; read once from its recipe. */
  private lobs = new Map<string, number | null>();
  private inspector: UnitInspector | PropInspector | null = null;
  private readonly movementThreatQuery: ReturnType<typeof createMovementThreatQuery>;

  /** Unit whose hand-off banner has been acknowledged. */
  private handedOffTo: string | null = null;
  private bannerShownFor: string | null = null;
  private lastActiveId: string | null = null;
  private recentreButton: HTMLButtonElement | null = null;
  private actorButton: HTMLButtonElement | null = null;
  /** True after a user zoom/pan; HUD reflows must preserve that manual framing. */
  private manualCamera = false;
  /**
   * The last pending move target revealed for a particular viewport. A
   * confirmation dock can shorten the canvas after the target was selected;
   * remember the reveal so later observer deliveries do not undo a deliberate
   * pan while the confirmation is open.
   */
  private lastPendingMoveReveal: {
    target: Vec2;
    width: number;
    height: number;
    dpr: number;
  } | null = null;
  /**
   * The compact oblique frame is chosen from the first settled combat canvas,
   * before an ability or log panel changes its height. Keeping that choice for
   * the scene prevents aim-mode reflow from zooming the board in and out.
   */
  private preferredCombatTilePx: number | null = null;
  private preferredCombatFrameKey: string | null = null;
  /**
   * The reachable set and the target/area tiles are rebuilt only when the
   * inputs that decide them change, not every frame: on a tablet the
   * flood-fill is the one per-frame cost that shows up.
   */
  private overlayMemo:
    | ({
        battle: BattleState;
        key: string;
      } & OverlayBuild)
    | null = null;
  /** Surface cells are immutable with the battle grid, so do not rescan them every frame. */
  private obscurementMemo: { grid: BattleState['grid']; tiles: readonly Vec2[] } | null = null;
  private aiScheduled = false;
  private resultShown = false;
  private logOpen = false;
  /** The phone header's More list, and the listeners that close it. */
  private moreOpen = false;
  private moreDismiss: (() => void) | null = null;
  /** What the header last drew, so a sync that changes none of it leaves it alone. */
  private topBarKey = '';
  private layoutMeasuredAfterSync = false;
  /** When the scene's birds burst out of the trees: once, as a fresh fight is first seen. */
  private flushedAt: number | null = null;

  constructor(private app: App) {
    this.movementThreatQuery = createMovementThreatQuery(app.content);
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  mount(host: HTMLElement): void {
    this.host = host;
    this.layoutMeasuredAfterSync = false;
    this.flushedAt = null;
    clear(host);

    const scene = el('div', { class: 'scene combat-scene' });
    scene.appendChild(el('div', { class: 'top-bar combat-bar' }));
    scene.appendChild(el('div', { class: 'turn-strip' }));
    const canvas = el('canvas', { class: 'map-canvas', attrs: { 'aria-label': 'Battlefield' } });
    this.canvas = canvas;
    scene.appendChild(
      el('div', { class: 'map-wrap' }, canvas, el('div', { class: 'combat-overlays' })),
    );
    scene.appendChild(el('div', { class: 'hud' }));
    host.appendChild(scene);

    this.setupRenderer();
    this.loop();
    this.sync();
  }

  unmount(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.recentreButton = null;
    this.actorButton = null;
    this.moreDismiss?.();
    this.moreDismiss = null;
    this.moreOpen = false;
    this.topBarKey = '';
    this.detach?.();
    this.detach = null;
    this.inspector?.close();
    this.inspector = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.canvas = null;
    this.host = null;
    // Nothing outside combat bends: let the decoded bend pages go (ADR 0055).
    sheets.releaseBends();
  }

  resize(): void {
    const battle = this.battle();
    this.renderer?.resizeAndRedraw(
      () => this.refit(),
      battle ? { width: battle.grid.width, height: battle.grid.height } : undefined,
    );
  }

  /**
   * The first HUD render can change the canvas before ResizeObserver delivers.
   * Measure after that render, then leave later identical reducer syncs alone;
   * the renderer's observer handles genuine box changes.
   */
  private resizeAfterHud(): void {
    const renderer = this.renderer;
    const canvas = this.canvas;
    const battle = this.battle();
    if (!renderer || !canvas || !battle) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const viewport = renderer.viewport;
    if (
      this.layoutMeasuredAfterSync &&
      viewport.width === width &&
      viewport.height === height &&
      viewport.dpr === dpr
    )
      return;
    this.layoutMeasuredAfterSync = true;
    renderer.resizeAndRedraw(() => this.refit(), {
      width: battle.grid.width,
      height: battle.grid.height,
    });
  }

  /**
   * Re-fits after the canvas box changed. The HUD changes it on most turns (a
   * confirm bar appears, the log opens) and the Renderer's observer reports
   * each change through onViewportChange. A board the player zoomed keeps its
   * zoom; a fitted one refits, and so does one a rotation has left smaller
   * than it could be.
   */
  private refit(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    if (!this.manualCamera) this.recentre();
    else {
      camera.scale = Math.max(camera.scale, camera.fitScale());
      camera.clampToPanBounds();
    }
    this.revealPendingMoveAfterViewportChange();
    this.syncRecentre();
    if (this.moreOpen) this.measureMoreRoom();
  }

  /**
   * Keep the selected move tile reachable after a real HUD/viewport reflow.
   * This runs from refit(), which is called by ResizeObserver or an explicit
   * resize, rather than from the render loop. The camera keeps its scale and
   * only pans the smallest amount needed to put the tile centre inside the
   * usable viewport. Once that viewport/target pair has been handled, a user
   * pan during confirmation is left alone.
   */
  private revealPendingMoveAfterViewportChange(): void {
    const camera = this.renderer?.camera;
    const target = this.pending;
    if (!camera || !target || this.mode.kind !== 'move') return;

    const viewport = camera.viewport;
    const previous = this.lastPendingMoveReveal;
    if (
      previous &&
      previous.target.x === target.x &&
      previous.target.y === target.y &&
      previous.width === viewport.width &&
      previous.height === viewport.height &&
      previous.dpr === viewport.dpr
    ) {
      return;
    }

    const point = camera.project({ x: target.x + 0.5, y: target.y + 0.5 });
    const padding = Math.min(16, viewport.width / 2, viewport.height / 2);
    const desiredX = Math.min(viewport.width - padding, Math.max(padding, point.x));
    const desiredY = Math.min(viewport.height - padding, Math.max(padding, point.y));
    camera.panBy(desiredX - point.x, desiredY - point.y);

    // A non-rectangular reachable-set projection can push the requested pan
    // back along a diagonal edge. If that leaves the selected tile outside
    // the padded viewport, use its programmatic centre as the final point on
    // the same reachable set. centreOn() is deliberately used here instead
    // of writing offsets: it shares the camera's exact centring arithmetic.
    const revealed = camera.project({ x: target.x + 0.5, y: target.y + 0.5 });
    const revealTolerance = 0.5;
    if (
      camera.clampToProgrammaticReachableSet &&
      (revealed.x < padding - revealTolerance ||
        revealed.x > viewport.width - padding + revealTolerance ||
        revealed.y < padding - revealTolerance ||
        revealed.y > viewport.height - padding + revealTolerance)
    ) {
      camera.centreOn(target, 1);
    }

    this.lastPendingMoveReveal = {
      target: { ...target },
      width: viewport.width,
      height: viewport.height,
      dpr: viewport.dpr,
    };
  }

  private clearPending(): void {
    this.pending = null;
    this.lastPendingMoveReveal = null;
  }

  /** Restore readable oblique framing, or the fitted orthographic board. */
  private recentre(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    this.manualCamera = false;
    if (camera.projection === 'oblique') {
      // Key off both the layout and visual viewports and the text setting,
      // then use the first settled canvas height to account for the full
      // decision dock. iOS toolbars can change the visual viewport while the
      // layout viewport stays put; HUD panels change only the canvas during
      // aim mode and must keep the player's framing.
      const visualViewport = window.visualViewport;
      const visualWidth = Math.round(visualViewport?.width ?? window.innerWidth);
      const visualHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const frameKey = `${window.innerWidth}x${window.innerHeight}:${visualWidth}x${visualHeight}:${this.app.settings.largeText}`;
      const hudAllowance = this.app.settings.largeText === 'huge' ? 220 : 200;
      const decisionHeight = camera.viewport.height - hudAllowance;
      const compact = decisionHeight < 360;
      const preferredTilePx = compact
        ? this.app.settings.largeText === 'huge' || window.innerWidth < 600
          ? 40
          : 64
        : 96;
      const idleFrameCorrection =
        this.mode.kind === 'idle' && this.preferredCombatTilePx !== preferredTilePx;
      if (this.preferredCombatFrameKey !== frameKey || idleFrameCorrection) {
        this.preferredCombatFrameKey = frameKey;
        // The action/preview panel takes a predictable slice of the first
        // settled canvas. Reserve that full dock before choosing the readable
        // 96px frame; Huge text needs the larger allowance.
        this.preferredCombatTilePx = preferredTilePx;
      }
      camera.fitExplore(this.preferredCombatTilePx ?? 96);
    } else camera.fit();
    const unit = this.active();
    if (!camera.fitted && unit) camera.centreOn(unit.pos, unit.size);
    this.syncRecentre();
  }

  private zoomBy(factor: number, at: { x: number; y: number }): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    const before = camera.scale;
    camera.zoomAt(at, factor);
    if (camera.scale !== before) this.manualCamera = true;
    this.syncRecentre();
  }

  private pan(dx: number, dy: number): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    const before = { x: camera.offsetX, y: camera.offsetY };
    camera.panBy(dx, dy);
    if (camera.offsetX !== before.x || camera.offsetY !== before.y) this.manualCamera = true;
  }

  /** Camera navigation never selects a target or spends an action. */
  private focusUnit(id: string): void {
    const unit = this.battle()?.units.find(
      (candidate) => candidate.id === id && isAlive(candidate),
    );
    const camera = this.renderer?.camera;
    if (!unit || !camera) return;
    camera.centreOn(combatFocusPosition(unit), unit.size);
    this.manualCamera = true;
    this.syncRecentre();
  }

  /** The Recentre button only exists while there is something off screen. */
  private syncRecentre(): void {
    const button = this.recentreButton;
    if (!button) return;
    const fitted = this.renderer?.camera.fitted ?? true;
    if (button.hidden !== fitted) button.hidden = fitted;
    if (this.actorButton) this.actorButton.hidden = fitted;
  }

  private setupRenderer(): void {
    const canvas = this.canvas;
    const battle = this.battle();
    if (!canvas || !battle) return;

    this.renderer = new Renderer(canvas, { width: battle.grid.width, height: battle.grid.height });
    // Bends are owned by party unit assets. Preload only those at the combat
    // boundary so the first eligible cast does not arrive mid-clip; enemies
    // and legacy-only units stay untouched (ADR 0055, step 7).
    for (const sprite of partyBendSprites(battle.units)) sheets.preloadBend(sprite);
    this.app.preloadBendFx();
    this.renderer.resize({ width: battle.grid.width, height: battle.grid.height });
    this.renderer.camera.projection =
      this.app.content.maps.get(battle.mapId)?.projection ?? 'orthographic';
    this.renderer.camera.clampRingTiles = COMBAT_CAMERA_RING_TILES[
      battle.mapId as keyof typeof COMBAT_CAMERA_RING_TILES
    ] ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    this.renderer.camera.clampToProgrammaticReachableSet =
      this.app.content.maps.get(battle.mapId)?.cameraPaint?.kind === 'convex-hull';
    this.app.animator.setProjection(this.renderer.camera.projection);
    if (this.renderer.camera.projection === 'oblique') this.renderer.camera.fitExplore(96);
    else this.renderer.camera.fit();

    // The map is the only thing that flexes, so it is still the wrong size
    // here: the turn strip and the HUD fill in after mount, and the log panel
    // and the Large-text setting move them again later. Re-fit whenever the
    // canvas box actually changes, or the camera drifts from what is drawn —
    // through refit(), so a pinch zoom survives the reflow.
    this.renderer.onViewportChange = () => this.refit();

    this.detach = attachPointer(canvas, {
      onTap: (point) => this.onTap(point.x, point.y),
      onLongPress: (point) => this.onLongPress(point.x, point.y),
      // Panning is a no-op while the whole board fits: the camera clamps it
      // away, so a stray drag at fit scale never moves anything.
      onDrag: (delta) => this.pan(delta.x, delta.y),
      onPinch: (gesture) => {
        this.zoomBy(gesture.step, gesture.centre);
        this.pan(gesture.delta.x, gesture.delta.y);
      },
      onWheel: (wheel) => this.zoomBy(wheelZoomFactor(wheel), wheel.point),
      onHover: (point) => {
        this.hover = point
          ? (this.renderer?.camera.pickTile(point.x, point.y, this.battle()?.grid) ?? null)
          : null;
      },
    });
  }

  /** Camera geometry as plain numbers, for tests that need tile -> pixel. */
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

  /* ---------------------------------------------------------------- */
  /* State helpers                                                     */
  /* ---------------------------------------------------------------- */

  private battle(): BattleState | null {
    return this.app.state?.battle ?? null;
  }

  private obscuringTilesFor(battle: BattleState): readonly Vec2[] {
    if (this.obscurementMemo?.grid === battle.grid) return this.obscurementMemo.tiles;
    const tiles = obscuringTiles(this.app.content, battle.grid);
    this.obscurementMemo = { grid: battle.grid, tiles };
    return tiles;
  }

  private active(): Unit | undefined {
    const battle = this.battle();
    return battle ? activeUnit(battle) : undefined;
  }

  private movementBlockReason(unit: Unit): string | null {
    if (canMove(this.app.content, unit)) return null;
    const blocker = statusDefs(this.app.content, unit).find(
      (status) => status.preventsMove || status.skipsTurn,
    );
    return blocker
      ? `${blocker.name}: ${blocker.description}`
      : `${unit.name} cannot move right now.`;
  }

  private isPlayerTurn(): boolean {
    const unit = this.active();
    return !!unit && unit.faction === 'party' && isAlive(unit);
  }

  private reachableCells() {
    const battle = this.battle();
    const unit = this.active();
    if (!battle || !unit) return new Map<string, ReachableCell>();

    const blocked = new Set<string>();
    for (const other of battle.units) {
      if (!isAlive(other) || other.id === unit.id) continue;
      for (const cell of occupiedCells(other)) blocked.add(posKey(cell));
    }

    return reachable(
      {
        grid: battle.grid,
        blocked,
        surfaces: this.app.content.surfaces,
        size: unit.size,
        climbCost: this.app.content.tuning.climbCost,
      },
      unit.pos,
      unit.move,
    );
  }

  private moveContext(unit: Unit) {
    const battle = this.battle();
    const blocked = new Set<string>();
    if (battle) {
      for (const other of battle.units) {
        if (!isAlive(other) || other.id === unit.id) continue;
        for (const cell of occupiedCells(other)) blocked.add(posKey(cell));
      }
    }
    return {
      grid: battle?.grid ?? { width: 0, height: 0, tiles: [] },
      blocked,
      surfaces: this.app.content.surfaces,
      size: unit.size,
      climbCost: this.app.content.tuning.climbCost,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */

  private onTap(x: number, y: number): void {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;
    if (this.app.animator.busy(performance.now())) return;
    if (!this.isPlayerTurn()) return;
    if (this.needsHandoff()) return;

    const tile = renderer.camera.pickTile(x, y, battle.grid);

    if (this.mode.kind === 'idle') {
      // Tapping a unit or prop in idle mode inspects it; that is the only tap
      // that does anything, so a stray tap never costs AP.
      const target = inspectTargetAt(battle.units, battle.props, tile, false);
      if (target?.kind === 'unit') this.openUnitInspector(target.unit);
      if (target?.kind === 'prop') this.openPropInspector(target.prop);
      return;
    }

    this.pending = tile;
    this.renderHud();
  }

  private onLongPress(x: number, y: number): void {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;
    const tile = renderer.camera.pickTile(x, y, battle.grid);
    const target = inspectTargetAt(battle.units, battle.props, tile, true);
    if (target?.kind === 'unit') this.openUnitInspector(target.unit);
    if (target?.kind === 'prop') this.openPropInspector(target.prop);
  }

  private openUnitInspector(unit: Unit): void {
    this.inspector?.close();
    this.inspector = new UnitInspector(this.app, unit, () => {
      this.inspector = null;
    });
    this.inspector.open(document.querySelector('.overlay-host') ?? document.body);
  }

  private openPropInspector(prop: PropInstance): void {
    const def = this.app.content.props.get(prop.propId);
    if (!def) return;
    this.inspector?.close();
    this.inspector = new PropInspector(def, prop, this.app.content.statuses, () => {
      this.inspector = null;
    });
    this.inspector.open(document.querySelector('.overlay-host') ?? document.body);
  }

  /* ---------------------------------------------------------------- */
  /* Turn flow                                                         */
  /* ---------------------------------------------------------------- */

  private needsHandoff(): boolean {
    const unit = this.active();
    if (!unit || unit.faction !== 'party') return false;
    if (this.app.session.solo) return false;
    return this.handedOffTo !== unit.id;
  }

  sync(): void {
    const battle = this.battle();
    if (!battle) return;

    if (this.inspector instanceof PropInspector) {
      const inspector = this.inspector;
      const prop = battle.props.find((candidate) => candidate.id === inspector.propId);
      inspector.update(prop);
    } else if (this.inspector instanceof UnitInspector) {
      const inspector = this.inspector;
      const unit = battle.units.find((candidate) => candidate.id === inspector.unitId);
      inspector.update(unit, battle.grid);
    }

    const unit = this.active();
    const activeId = unit?.id ?? null;

    if (activeId !== this.lastActiveId) {
      this.lastActiveId = activeId;
      this.mode = { kind: 'idle' };
      this.clearPending();
      this.aiScheduled = false;

      // A new player's turn needs the hand-off card before anything is shown.
      if (unit && unit.faction === 'party' && !this.app.session.solo) {
        this.handedOffTo = null;
      }
      if (unit) announce(`${this.app.session.labelFor(unit)}'s turn.`);
      // The More list was opened for the last turn; the next player at the
      // table finds it closed. The rebuild below hands focus to the toggle.
      this.setMoreOpen(false, false);

      // Where the board cannot fit, whoever is acting is what to look at.
      const camera = this.renderer?.camera;
      if (unit && camera && !camera.fitted) camera.centreOn(unit.pos, unit.size);
    }

    if (battle.phase !== 'active' && !this.resultShown) {
      this.resultShown = true;
    }

    this.renderTopBar();
    this.renderTurnStrip();
    this.renderHud();
    this.maybeRunAi();
    // The first ResizeObserver delivery can happen before this sync fills the
    // turn strip and decision dock. Measure after those panels exist so a
    // short tablet chooses its compact readable frame; later identical syncs
    // leave the backend alone.
    this.resizeAfterHud();
  }

  /**
   * Enemy and ally turns run themselves, but only once the current playback has
   * finished — otherwise six bandits resolve in one frame and the table sees
   * nothing but the aftermath.
   */
  private maybeRunAi(): void {
    const battle = this.battle();
    const unit = this.active();
    if (!battle || battle.phase !== 'active' || !unit) return;
    if (unit.faction === 'party' || this.aiScheduled) return;

    this.aiScheduled = true;
    const delay = Math.max(0, this.app.animator.finishesAt - performance.now()) + 260;
    window.setTimeout(() => {
      if (this.app.state?.battle?.phase !== 'active') return;
      if (activeUnit(this.app.state.battle)?.id !== unit.id) return;
      this.app.dispatch({ type: 'runAiTurn' });
    }, delay);
  }

  /* ---------------------------------------------------------------- */
  /* Rendering: chrome                                                 */
  /* ---------------------------------------------------------------- */

  private renderTopBar(): void {
    const bar = this.host?.querySelector<HTMLElement>('.combat-bar');
    const battle = this.battle();
    if (!bar || !battle) return;
    // An AI turn syncs several times a second, and a rebuild that moved focus
    // onto a new button would have a screen reader announce it each time. So
    // the header is rebuilt only when something it draws has changed: More's
    // open state and the view buttons' visibility are updated in place, by
    // setMoreOpen and syncRecentre.
    const weather = weatherAt(this.app.content, battle.encounterId, battle.round);
    const weatherText = weatherChipText(this.app.content.tuning, weather);
    const weatherShortText = weatherChipShortText(this.app.content.tuning, weather);
    const key = `${battle.encounterId}|${battle.variantId ?? ''}|${battle.round}|${weatherText ?? ''}|${this.logOpen}`;
    if (key === this.topBarKey && bar.childElementCount > 0) return;
    this.topBarKey = key;
    // On a rebuild, the button that had focus is found again by its key, so a
    // keyboard or switch user reading the More list is not dropped to the page.
    const active = document.activeElement;
    const focusedKey =
      active instanceof HTMLElement && bar.contains(active) ? active.dataset.key : undefined;
    clear(bar);

    const encounter = this.app.content.encounters.get(battle.encounterId);
    // The encounter's name on a plate, in the display face, with the round under it.
    bar.appendChild(
      el(
        'div',
        { class: 'title-plate' },
        el('strong', {
          class: 'title-plate-name',
          text: encounter?.name ?? 'Battle',
          title: encounter?.name ?? 'Battle',
        }),
        el(
          'div',
          { class: 'title-plate-meta' },
          el('span', { class: 'title-plate-round', text: `Round ${battle.round}` }),
          ...(weatherText
            ? [
                el(
                  'span',
                  { class: 'weather-chip', title: weatherText },
                  el('span', { class: 'weather-chip-full', text: weatherText }),
                  el('span', {
                    class: 'weather-chip-short',
                    text: weatherShortText ?? weatherText,
                  }),
                ),
              ]
            : []),
        ),
      ),
    );
    bar.appendChild(el('div', { class: 'spacer' }));

    // On a phone the header keeps only its title and Pause; the view and help
    // buttons fold behind More, so the title never scrolls off. Wider screens
    // lay the same buttons inline and never show the toggle (`.combat-more`).
    // The toggle is its mark alone, named for a screen reader: the plate
    // needs the width.
    const toggle = button('', () => this.setMoreOpen(!this.moreOpen, true), {
      class: 'btn-ghost combat-more-toggle',
      title: 'View and help',
    });
    toggle.append(mark(UI_MARKS.more), el('span', { class: 'visually-hidden', text: 'More' }));
    toggle.setAttribute('aria-controls', 'combat-more');
    toggle.setAttribute('aria-expanded', String(this.moreOpen));
    toggle.dataset.key = 'more';
    bar.appendChild(toggle);
    // `data-toast-clear`: toasts move their band clear of the list while it is open.
    const more = el('div', {
      class: `combat-more${this.moreOpen ? ' open' : ''}`,
      id: 'combat-more',
      attrs: { role: 'group', 'aria-label': 'View and help', 'data-toast-clear': '' },
    });
    bar.appendChild(more);
    // A folded button closes the list and hands focus back to More.
    const folded = (action: () => void) => () => {
      this.setMoreOpen(false, true);
      action();
    };

    const recentre = button(
      'Recentre',
      folded(() => this.recentre()),
      { class: 'btn-ghost', title: 'Reset the battlefield view around the acting unit' },
    );
    recentre.prepend(mark(UI_MARKS.recentre, 'mark-inline'));
    recentre.hidden = this.renderer?.camera.fitted ?? true;
    recentre.dataset.key = 'recentre';
    this.recentreButton = recentre;
    more.appendChild(recentre);
    const actor = button(
      'Acting unit',
      folded(() => {
        const unit = this.active();
        if (unit) this.focusUnit(unit.id);
      }),
      { class: 'btn-ghost', title: 'Return to the acting unit without changing zoom' },
    );
    actor.hidden = this.renderer?.camera.fitted ?? true;
    actor.dataset.key = 'actor';
    this.actorButton = actor;
    more.appendChild(actor);

    if (encounter) {
      const advice = encounterText(encounter, battle.variantId).tip;
      const tipButton = button(
        'Tip',
        folded(() => this.app.toasts.show(advice, 'info', 6000)),
        { class: 'btn-ghost', title: advice },
      );
      tipButton.prepend(mark(UI_MARKS.tip, 'mark-inline'));
      tipButton.dataset.key = 'tip';
      more.appendChild(tipButton);
    }
    const logButton = button(
      this.logOpen ? 'Hide log' : 'Log',
      () => {
        // Focus stays on Log through the rebuild, or on More where the list folded it.
        this.setMoreOpen(false, false);
        this.logOpen = !this.logOpen;
        this.renderTopBar();
        this.renderHud();
      },
      { class: 'btn-ghost' },
    );
    logButton.prepend(mark(UI_MARKS.log, 'mark-inline'));
    logButton.dataset.key = 'log';
    more.appendChild(logButton);
    // The label is its own span so a phone at Large text can show the mark alone.
    const pauseButton = button(
      '',
      () => {
        this.setMoreOpen(false, false);
        this.app.openPause();
      },
      { class: 'btn-ghost combat-pause' },
    );
    pauseButton.append(
      mark(UI_MARKS.pause, 'mark-inline'),
      el('span', { class: 'combat-pause-label', text: 'Pause' }),
    );
    pauseButton.dataset.key = 'pause';
    bar.appendChild(pauseButton);

    if (focusedKey) {
      // Back to the same button if it is still on screen; if the list it sat
      // in has closed, to the toggle that reopens it.
      const shown = (key: string) => {
        const found = bar.querySelector<HTMLElement>(`[data-key="${key}"]`);
        return found && found.getClientRects().length > 0 ? found : null;
      };
      (shown(focusedKey) ?? shown('more'))?.focus({ preventScroll: true });
    }
  }

  /**
   * How far the More list may drop before it meets the foot of the scene.
   * Written on the bar, which outlives every rebuild of the list inside it.
   */
  private measureMoreRoom(): void {
    const bar = this.host?.querySelector<HTMLElement>('.combat-bar');
    if (!bar || !this.host) return;
    const room = this.host.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom;
    bar.style.setProperty('--more-room', `${Math.max(0, Math.round(room))}px`);
  }

  /**
   * Opens or closes the header's More list. Open, a tap outside or Escape
   * closes it; with `focus`, focus moves to the first button on the way in
   * and back to the toggle on the way out, as a dialog's does.
   */
  private setMoreOpen(open: boolean, focus: boolean): void {
    if (this.moreOpen === open) return;
    this.moreOpen = open;
    this.moreDismiss?.();
    this.moreDismiss = null;
    const bar = this.host?.querySelector<HTMLElement>('.combat-bar');
    if (!bar) return;
    const list = bar.querySelector<HTMLElement>('.combat-more');
    const toggle = bar.querySelector<HTMLElement>('.combat-more-toggle');
    // The room is written before the list is shown: Chromium resolves a list
    // opened in the same step as its room with the fallback, the whole screen,
    // until something else restyles it, and so draws it off the foot.
    if (open) this.measureMoreRoom();
    list?.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (!open) {
      // Focus never stays behind in a list that has just been hidden.
      if (focus || list?.contains(document.activeElement)) toggle?.focus({ preventScroll: true });
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !bar.contains(event.target))
        this.setMoreOpen(false, false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.setMoreOpen(false, true);
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    this.moreDismiss = () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
    if (focus) list?.querySelector<HTMLElement>('button:not([hidden])')?.focus();
  }

  private renderTurnStrip(): void {
    const strip = this.host?.querySelector<HTMLElement>('.turn-strip');
    const battle = this.battle();
    if (!strip || !battle) return;
    clear(strip);

    for (const unit of upcomingOrder(battle, battle.units.length).filter(isAlive)) {
      const isActive = unit.id === this.active()?.id;
      const player = this.app.session.playerFor(unit.id);

      // The element class puts the unit's colour in --el, for the party's ring.
      const chip = el(
        'button',
        {
          class: `turn-chip faction-${unit.faction} element-${unit.element}${isActive ? ' active' : ''}`,
          attrs: { type: 'button', 'aria-label': `Focus ${unit.name}` },
          onClick: () => this.focusUnit(unit.id),
        },
        assetCanvas(portraitKeyFor(this.app.content, unit), 2.4),
        el('span', { class: 'tiny', text: player?.name ?? unit.name }),
      );
      // A phone shows the waiting chips as faces alone and a long name
      // ellipses anywhere, so the full name always rides on the chip itself.
      const who = player && player.name !== unit.name ? `${unit.name} (${player.name})` : unit.name;
      chip.title = `${who}: ${unit.hp}/${unit.base.maxHp} HP. Focus on the battlefield.`;
      strip.appendChild(chip);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Rendering: HUD                                                    */
  /* ---------------------------------------------------------------- */

  private renderHud(): void {
    const hud = this.host?.querySelector<HTMLElement>('.hud');
    const overlays = this.host?.querySelector<HTMLElement>('.combat-overlays');
    const battle = this.battle();
    if (!hud || !overlays || !battle) return;

    clear(hud);
    clear(overlays);

    if (battle.phase !== 'active') {
      overlays.appendChild(this.resultPanel(battle));
      return;
    }

    if (this.needsHandoff()) {
      overlays.appendChild(this.handoffBanner());
      return;
    }

    const unit = this.active();
    if (!unit) return;

    if (this.mode.kind === 'move' && this.movementBlockReason(unit)) {
      this.mode = { kind: 'idle' };
      this.clearPending();
    }

    if (unit.faction !== 'party') {
      overlays.appendChild(
        el(
          'div',
          { class: 'enemy-turn-banner' },
          el('span', {
            text: unit.faction === 'enemy' ? 'Enemies are moving…' : `${unit.name} is moving…`,
          }),
        ),
      );
    }

    hud.appendChild(this.unitPanel(unit));
    const actions = this.actionBar(unit);
    hud.appendChild(actions);
    if (this.logOpen) hud.appendChild(this.logPanel());

    if (this.pending) {
      actions.appendChild(this.confirmBar(unit));
    } else {
      const hint = this.aimHint(unit);
      if (hint) actions.appendChild(hint);
    }
  }

  private unitPanel(unit: Unit): HTMLElement {
    const stats = effectiveStats(this.app.content, unit);
    const player = this.app.session.playerFor(unit.id);

    const apPips = el('div', {
      class: 'pips',
      attrs: { 'aria-label': `${unit.ap} action points` },
    });
    for (let i = 0; i < Math.max(stats.maxAp, unit.ap); i++) {
      apPips.appendChild(el('span', { class: `pip${i < unit.ap ? ' pip-on' : ''}` }));
    }

    const hpFraction = Math.max(0, unit.hp / Math.max(1, unit.base.maxHp));

    // The portrait sits beside the readouts, not above them, so the panel
    // keeps its height and the map keeps its rows. Square, framed in ink and
    // the element, with the element's glyph as a badge on its corner.
    const palette = paletteFor(unit.element);
    const portrait = el(
      'div',
      { class: 'unit-portrait-frame' },
      assetCanvas(portraitKeyFor(this.app.content, unit), 4.5, 'unit-portrait square'),
      el(
        'span',
        { class: 'portrait-badge', attrs: { 'aria-hidden': 'true' } },
        painterCanvas(`glyph.${unit.element}`, 1.1, (ctx, px) =>
          paintElementGlyph(ctx, { x: 0, y: 0, size: px }, palette, unit.element),
        ),
      ),
    );
    return el(
      'div',
      { class: `hud-panel unit-panel element-${unit.element}` },
      el(
        'div',
        { class: 'row tight unit-panel-body' },
        portrait,
        el(
          'div',
          { class: 'stack tight grow' },
          el(
            'div',
            { class: 'row tight' },
            el(
              'div',
              { class: 'stack tight' },
              el('strong', { class: 'unit-name', text: unit.name }),
              player && player.name !== unit.name
                ? el('span', { class: 'tiny muted', text: player.name })
                : null,
            ),
            el('div', { class: 'spacer' }),
            el('span', { class: 'tiny muted', text: `Level ${unit.level}` }),
          ),
          el(
            'div',
            { class: 'bar' },
            el('div', {
              class: 'bar-fill',
              style: { width: `${hpFraction * 100}%` },
            }),
            el('span', { class: 'bar-label', text: `${unit.hp} / ${unit.base.maxHp}` }),
          ),
          el(
            'div',
            { class: 'row row-wrap tight' },
            apPips,
            el('span', { class: 'chip', text: `Move ${unit.move}` }),
            ...unit.statuses.map((s) => {
              const def = this.app.content.statuses.get(s.id);
              const chip = el('span', { class: 'chip chip-status', text: def?.name ?? s.id });
              tip(chip, def?.description ?? '', (text) => this.app.toasts.show(text));
              return chip;
            }),
          ),
        ),
      ),
    );
  }

  private actionBar(unit: Unit): HTMLElement {
    const bar = el('div', { class: 'hud-panel action-bar', attrs: { role: 'toolbar' } });
    bar.appendChild(this.abilityHeader(unit));
    const row = el('div', { class: 'action-row' });
    const interactive = unit.faction === 'party' && this.isPlayerTurn();

    const moveActive = this.mode.kind === 'move';
    const movementReason = this.movementBlockReason(unit);
    const canMoveNow = unit.move > 0 && !movementReason;
    const moveButton = button(`Move`, () => this.selectMove(), {
      class: `action-button${moveActive ? ' selected' : ''}`,
      disabled: !interactive || !canMoveNow,
      title: !interactive
        ? 'Player controls are locked while another unit acts'
        : movementReason
          ? movementReason
          : canMoveNow
            ? 'Walk to a highlighted tile'
            : 'No move points left this turn',
    });
    moveButton.prepend(mark(UI_MARKS.move));
    moveButton.appendChild(el('span', { class: 'action-sub', text: `${unit.move} left` }));
    row.appendChild(moveButton);

    for (const ability of knownAbilities(this.app.content, unit)) {
      row.appendChild(this.abilityButton(unit, ability, interactive));
    }

    const endButton = button('End turn', () => this.endTurn(unit), {
      class: 'action-button end-turn',
      title: 'Finish this turn. One unused AP carries over.',
      disabled: !interactive,
    });
    endButton.prepend(mark(UI_MARKS.end));
    if (unit.ap > 0)
      endButton.appendChild(el('span', { class: 'action-sub', text: `${unit.ap} AP left` }));
    row.appendChild(endButton);

    bar.appendChild(row);
    return bar;
  }

  /**
   * What the player is doing, above the buttons: the chosen ability's mark,
   * name, cost and what it does; the move left while walking; a prompt
   * otherwise. Always present, so the HUD keeps its height and the board
   * its rows whichever mode the turn is in.
   */
  private abilityHeader(unit: Unit): HTMLElement {
    const header = el('div', { class: 'ability-header' });
    if (this.mode.kind === 'aim') {
      const ability = this.app.content.abilities.get(this.mode.abilityId);
      if (ability) {
        header.classList.add(`element-${ability.element}`);
        header.append(
          mark(iconMarkup(markKindFor(ability))),
          el('strong', { text: ability.name }),
          el('span', { class: 'header-cost', text: `· ${ability.apCost} AP` }),
          el('span', { class: 'header-desc', text: ability.description }),
        );
        return header;
      }
    }
    if (this.mode.kind === 'move') {
      header.append(
        mark(UI_MARKS.move),
        el('strong', { text: 'Move' }),
        el('span', { class: 'header-cost', text: `· ${unit.move} left` }),
        el('span', { class: 'header-desc', text: 'Walk to a highlighted tile.' }),
      );
      return header;
    }
    header.append(
      el('span', {
        class: 'header-desc',
        text: `${unit.name}: choose an action, or end the turn.`,
      }),
    );
    return header;
  }

  private abilityButton(unit: Unit, ability: Ability, interactive = true): HTMLElement {
    const check = canUseAbility(this.app.content, unit, ability);
    const selected = this.mode.kind === 'aim' && this.mode.abilityId === ability.id;
    const cooldown = unit.cooldowns[ability.id] ?? 0;

    const node = button(ability.name, () => this.selectAbility(ability), {
      class: `action-button element-${ability.element}${selected ? ' selected' : ''}`,
      disabled: !interactive || !check.ok,
      title: !interactive
        ? 'Player controls are locked while another unit acts'
        : check.ok
          ? ability.description
          : check.reason,
    });

    // The ability's own mark above its name, in its element's colour; the
    // cost as words under it.
    node.prepend(mark(iconMarkup(markKindFor(ability))));
    node.appendChild(el('span', { class: 'action-sub', text: `${ability.apCost} AP` }));

    if (cooldown > 0) {
      node.appendChild(el('span', { class: 'cooldown-ring', text: String(cooldown) }));
    }

    // Long-press an ability for its full card, same as long-pressing a unit.
    let timer: number | null = null;
    node.addEventListener('pointerdown', () => {
      timer = window.setTimeout(() => {
        this.app.toasts.show(`${ability.name}: ${ability.description}`, 'info', 5000);
      }, 480);
    });
    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    node.addEventListener('pointerup', cancel);
    node.addEventListener('pointerleave', cancel);

    return node;
  }

  private selectMove(): void {
    const unit = this.active();
    const movementReason = unit ? this.movementBlockReason(unit) : null;
    if (!unit || unit.move <= 0 || movementReason) {
      this.mode = { kind: 'idle' };
      this.clearPending();
      this.renderHud();
      return;
    }
    this.mode = this.mode.kind === 'move' ? { kind: 'idle' } : { kind: 'move' };
    this.clearPending();
    this.renderHud();
  }

  private selectAbility(ability: Ability): void {
    this.mode =
      this.mode.kind === 'aim' && this.mode.abilityId === ability.id
        ? { kind: 'idle' }
        : { kind: 'aim', abilityId: ability.id };
    this.clearPending();
    this.renderHud();
  }

  private endTurn(unit: Unit): void {
    if (unit.ap > 0 && !this.confirmedEndTurn) {
      this.confirmedEndTurn = true;
      this.app.toasts.show(
        `${unit.name} still has ${unit.ap} AP. Tap End turn again to finish anyway.`,
        'warn',
      );
      window.setTimeout(() => {
        this.confirmedEndTurn = false;
      }, 4000);
      return;
    }
    this.confirmedEndTurn = false;
    this.mode = { kind: 'idle' };
    this.clearPending();
    this.handedOffTo = null;
    this.app.dispatch({ type: 'endTurn', unitId: unit.id });
  }

  private confirmedEndTurn = false;

  /* ---------------------------------------------------------------- */
  /* Confirm step                                                      */
  /* ---------------------------------------------------------------- */

  private confirmBar(unit: Unit): HTMLElement {
    const battle = this.battle();
    const target = this.pending;
    if (!battle || !target) return el('div');

    if (this.mode.kind === 'move') {
      const movementReason = this.movementBlockReason(unit);
      if (movementReason) {
        return this.confirmShell(el('span', { class: 'warn-note', text: movementReason }), null);
      }
      const cell = this.reachableCells().get(posKey(target));
      if (!cell) {
        return this.confirmShell(
          el('span', { class: 'warn-note', text: 'Too far to walk this turn.' }),
          null,
        );
      }
      const cost = pathCost(this.moveContext(unit), unit.pos, cell.path) ?? cell.cost;
      const threat = this.movementThreatQuery(battle, unit.id, target);
      const movementChips = el(
        'div',
        { class: 'row row-wrap chips' },
        el('span', { class: 'chip', text: `${cost} move` }),
        el('span', { class: 'chip', text: `${Math.max(0, unit.move - cost)} left after` }),
      );
      const threatNotice = threat.warning
        ? el('span', { class: 'warn-note movement-threat-warning', text: threat.warning })
        : el('span', {
            class: 'tiny muted movement-threat-empty',
            text: 'No immediate direct attack found',
          });
      return this.confirmShell(
        el(
          'div',
          { class: 'stack tight' },
          movementChips,
          threatNotice,
          el('span', {
            class: 'tiny muted movement-threat-qualification',
            text: threat.qualification,
          }),
        ),
        () => {
          this.app.dispatch({ type: 'move', unitId: unit.id, path: cell.path });
          this.clearPending();
          this.mode = { kind: 'idle' };
          this.renderHud();
        },
      );
    }

    if (this.mode.kind !== 'aim') return el('div');

    const ability = this.app.content.abilities.get(this.mode.abilityId);
    if (!ability) return el('div');

    const valid = isValidTarget(this.app.content, battle, unit, ability, target);
    if (!valid.ok) {
      return this.confirmShell(el('span', { class: 'warn-note', text: valid.reason }), null);
    }

    const preview = previewAbility(this.app.content, battle, unit, ability, target);

    const chips = el('div', { class: 'row row-wrap chips preview-chips' });
    if (
      preview.targets.length === 0 &&
      preview.props.length === 0 &&
      preview.shoves.length === 0 &&
      preview.surfaceContacts.length === 0
    ) {
      chips.appendChild(el('span', { class: 'chip', text: 'Nobody in the area' }));
    }
    for (const [entryIndex, entry] of preview.targets.entries()) {
      const parts: string[] = [];
      if (entry.hitChance !== null) parts.push(`${entry.hitChance}%`);
      if (entry.damage > 0) parts.push(`~${entry.damage} dmg`);
      if (entry.heal > 0) parts.push(`+${entry.heal} hp`);
      else if (entry.healAtCapacity) parts.push('at full health');
      for (const status of entry.statuses) {
        const requested = this.app.content.statuses.get(status.id)?.name ?? status.id;
        const applied = status.appliedStatus
          ? (this.app.content.statuses.get(status.appliedStatus)?.name ?? status.appliedStatus)
          : requested;
        const outcome = applied !== requested ? `${applied} (from ${requested})` : applied;
        parts.push(status.chance >= 1 ? outcome : `${Math.round(status.chance * 100)}% ${outcome}`);
        for (const cleared of status.clearedStatuses ?? []) {
          const name = this.app.content.statuses.get(cleared)?.name ?? cleared;
          parts.push(`clears ${name}`);
        }
      }
      for (const cleared of entry.clearedStatuses) {
        const name = this.app.content.statuses.get(cleared)?.name ?? cleared;
        if (!parts.some((part) => part === `clears ${name}`)) parts.push(`clears ${name}`);
      }
      const breakdownRows = formatHitBreakdownRows(entry.hitBreakdown);
      const label = `${entry.name}: ${parts.join(' · ')}${entry.lethal ? ' — lethal' : ''}`;
      const chipClass = `chip ${entry.friendly ? 'chip-friendly' : 'chip-hostile'}${
        entry.lethal ? ' chip-lethal' : ''
      }`;
      if (breakdownRows.length === 0) {
        chips.appendChild(el('span', { class: chipClass, text: label }));
        continue;
      }

      const breakdownId = `hit-breakdown-${entryIndex}`;
      const breakdown = el(
        'div',
        { class: 'hit-breakdown', id: breakdownId },
        ...breakdownRows.map((row) => el('span', { text: row })),
      );
      breakdown.hidden = true;
      const targetChip = button(
        label,
        () => {
          const expanded = targetChip.getAttribute('aria-expanded') !== 'true';
          targetChip.setAttribute('aria-expanded', String(expanded));
          breakdown.hidden = !expanded;
        },
        { class: `${chipClass} preview-target-chip` },
      );
      targetChip.setAttribute('aria-expanded', 'false');
      targetChip.setAttribute('aria-controls', breakdownId);
      chips.append(targetChip, breakdown);
    }
    for (const contact of preview.surfaceContacts) {
      const surface = this.app.content.surfaces.get(contact.surface)?.name ?? contact.surface;
      const effects: string[] = [];
      if (contact.damage > 0) effects.push(`${contact.damage} damage`);
      if (contact.status) {
        const requested = contact.status.requestedStatus
          ? (this.app.content.statuses.get(contact.status.requestedStatus)?.name ??
            contact.status.requestedStatus)
          : null;
        const applied = contact.status.appliedStatus
          ? (this.app.content.statuses.get(contact.status.appliedStatus)?.name ??
            contact.status.appliedStatus)
          : requested;
        if (applied) {
          const outcome = applied !== requested ? `${applied} (from ${requested})` : applied;
          effects.push(
            contact.status.chance >= 1
              ? outcome
              : `${Math.round(contact.status.chance * 100)}% ${outcome}`,
          );
        }
        for (const cleared of contact.status.clearedStatuses) {
          const name = this.app.content.statuses.get(cleared)?.name ?? cleared;
          effects.push(`clears ${name}`);
        }
      }
      chips.appendChild(
        el('span', {
          class: `chip ${contact.friendly ? 'chip-friendly' : 'chip-terrain'}`,
          text: `${contact.name}: ${surface} contact${effects.length ? ` — ${effects.join(', ')}` : ''}`,
        }),
      );
    }
    for (const note of preview.terrain) {
      chips.appendChild(el('span', { class: 'chip chip-terrain', text: note }));
    }

    for (const prop of preview.props) {
      const from = `(${prop.from.x + 1},${prop.from.y + 1})`;
      const destination = prop.to ? `to (${prop.to.x + 1},${prop.to.y + 1})` : 'breaks here';
      const affected = [...prop.affectedAllies, ...prop.affectedEnemies]
        .map((unit) => unit.name)
        .join(', ');
      const consequence = prop.destroyed
        ? (prop.breakLabel ?? `${prop.name} breaks`)
        : prop.moved
          ? `${prop.name} ${destination}`
          : prop.hpAfter !== null && prop.hpAfter < prop.hpBefore
            ? `${prop.name} takes ${prop.hpBefore - prop.hpAfter} damage (${prop.hpAfter} hp left)`
            : `${prop.name} holds here`;
      const cover = prop.coverRemoved ? ' (cover removed)' : '';
      const suffix = `${cover}${affected ? ` — affects ${affected}` : ''}`;
      chips.appendChild(
        el('span', {
          class: 'chip chip-terrain',
          text: `${prop.name} at ${from}: ${consequence}${suffix}`,
        }),
      );
    }

    for (const shove of preview.shoves) {
      const movementText = formatShoveMovement(
        shove.name,
        shove.mode,
        shove.movedDistance,
        shove.distance,
        shove.stopReason,
        shove.landingSurfaces,
        shove.originKind,
      );
      const landingEffects = shove.landingSurfaces
        .filter((id) => id !== 'water')
        .map((id) => this.app.content.surfaces.get(id)?.name ?? id);
      if (shove.landingDamage > 0) landingEffects.push(`${shove.landingDamage} damage`);
      for (const status of shove.landingStatuses) {
        const name = this.app.content.statuses.get(status.id)?.name ?? status.id;
        landingEffects.push(
          status.chance >= 1 ? name : `${Math.round(status.chance * 100)}% ${name}`,
        );
      }
      const landing = landingEffects.length ? ` — lands on ${landingEffects.join(', ')}` : '';
      chips.appendChild(
        el('span', {
          class: `chip ${shove.friendly ? 'chip-friendly' : 'chip-terrain'}`,
          text: `${movementText}${landing}`,
        }),
      );
      const dropText = formatLedgeDrop(
        shove.name,
        shove.ledgeDropTiers,
        shove.ledgeDropDamage,
        this.app.content.tuning.ledgeDropDamage,
      );
      if (dropText) {
        chips.appendChild(
          el('span', {
            class: `chip shove-drop-forecast ${shove.friendly ? 'chip-friendly' : 'chip-terrain'}`,
            text: dropText,
          }),
        );
      }
    }

    for (const status of preview.statuses) {
      if (status.kind !== 'apply' || !status.requestedStatus) continue;
      if (preview.targets.some((entry) => entry.unitId === status.unitId)) continue;
      const requested =
        this.app.content.statuses.get(status.requestedStatus)?.name ?? status.requestedStatus;
      const applied = status.appliedStatus
        ? (this.app.content.statuses.get(status.appliedStatus)?.name ?? status.appliedStatus)
        : requested;
      const suffix =
        status.clearedStatuses.length > 0
          ? `; clears ${status.clearedStatuses
              .map((id) => this.app.content.statuses.get(id)?.name ?? id)
              .join(', ')}`
          : '';
      const chance = status.chance >= 1 ? '' : `${Math.round(status.chance * 100)}% `;
      chips.appendChild(
        el('span', {
          class: `chip ${status.friendly ? 'chip-friendly' : 'chip-hostile'}`,
          text: `${status.name}: ${chance}${applied}${applied !== requested ? ` (from ${requested})` : ''}${suffix}`,
        }),
      );
    }

    const body = el('div', { class: 'stack tight' }, chips);

    // What the ground is about to do, in the combo table's own words. This is
    // the part that used to say "Leaves Fire" over a puddle.
    for (const note of reactionNotes(this.app.content, preview.reactions)) {
      body.appendChild(note);
    }

    if (preview.hitsFriendly) {
      body.appendChild(
        el('span', { class: 'warn-note', text: 'This will also hit your own side.' }),
      );
    }

    return this.confirmShell(body, () => {
      this.app.dispatch({
        type: 'useAbility',
        unitId: unit.id,
        abilityId: ability.id,
        target,
      });
      this.clearPending();
      this.mode = { kind: 'idle' };
      this.renderHud();
    });
  }

  /**
   * Tapping an ability that can reach nothing used to light up an empty map
   * and leave the player wondering what they did wrong. Say it instead.
   */
  private aimHint(unit: Unit): HTMLElement | null {
    const battle = this.battle();
    if (!battle) return null;

    if (this.mode.kind === 'move') {
      const movementReason = this.movementBlockReason(unit);
      if (movementReason) {
        return el(
          'div',
          { class: 'confirm-bar aim-hint' },
          el('span', { class: 'warn-note', text: movementReason }),
        );
      }
      if (unit.move > 0) return null;
      return el(
        'div',
        { class: 'confirm-bar aim-hint' },
        el('span', { class: 'warn-note', text: 'No move points left this turn.' }),
      );
    }

    if (this.mode.kind !== 'aim') return null;
    const ability = this.app.content.abilities.get(this.mode.abilityId);
    if (!ability) return null;

    // The ability itself is described in the action bar's header; this only
    // says what to do next, and offers the way out.
    const tiles = targetableTiles(this.app.content, battle, unit, ability);
    if (tiles.length > 0) {
      return el(
        'div',
        { class: 'confirm-bar aim-hint' },
        el(
          'div',
          { class: 'row' },
          el('span', { class: 'muted', text: 'Tap a highlighted tile.' }),
          el('div', { class: 'spacer' }),
          this.cancelButton(() => {
            this.mode = { kind: 'idle' };
            this.renderHud();
          }),
        ),
      );
    }

    const needsUnit = ability.targeting.shape === 'unit';
    const movementReason = this.movementBlockReason(unit);
    return el(
      'div',
      { class: 'confirm-bar aim-hint' },
      el('span', {
        class: 'warn-note',
        text: needsUnit
          ? `Nothing is within ${ability.range} tiles of ${unit.name}. Move closer first.`
          : `${ability.name} cannot reach anywhere useful from here.`,
      }),
      el(
        'div',
        { class: 'row' },
        el('div', { class: 'spacer' }),
        button('Move instead', () => this.selectMove(), {
          disabled: unit.move <= 0 || Boolean(movementReason),
          title: movementReason ?? 'Walk to a highlighted tile',
        }),
        this.cancelButton(() => {
          this.mode = { kind: 'idle' };
          this.renderHud();
        }),
      ),
    );
  }

  /** The ghost Cancel with its cross, the same wherever a decision can be backed out of. */
  private cancelButton(onCancel: () => void): HTMLButtonElement {
    const node = button('Cancel', onCancel, { class: 'btn-ghost' });
    node.prepend(mark(UI_MARKS.cancel, 'mark-inline'));
    return node;
  }

  private confirmShell(body: HTMLElement, onConfirm: (() => void) | null): HTMLElement {
    body.classList.add('confirm-body');
    const confirm = button('Confirm', () => onConfirm?.(), {
      class: 'btn-primary btn-ok btn-large',
      disabled: onConfirm === null,
    });
    confirm.prepend(mark(UI_MARKS.check, 'mark-inline'));
    return el(
      'div',
      { class: 'confirm-bar confirm-dialog' },
      body,
      el(
        'div',
        { class: 'row' },
        this.cancelButton(() => {
          this.clearPending();
          this.renderHud();
        }),
        el('div', { class: 'spacer' }),
        confirm,
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Banners and panels                                                */
  /* ---------------------------------------------------------------- */

  private handoffBanner(): HTMLElement {
    const unit = this.active();
    if (!unit) return el('div');
    const player = this.app.session.playerFor(unit.id);

    if (this.bannerShownFor !== unit.id) {
      this.bannerShownFor = unit.id;
      announce(`Hand the tablet to ${player?.name ?? unit.name}.`);
    }

    return el(
      'div',
      { class: 'handoff-banner' },
      el(
        'div',
        { class: 'panel center' },
        el('p', { class: 'muted', text: 'Hand the tablet to' }),
        el('h1', { text: player?.name ?? unit.name }),
        el('p', { class: 'muted', text: `Playing ${unit.name}` }),
        button(
          "I'm ready",
          () => {
            this.handedOffTo = unit.id;
            this.renderHud();
          },
          { class: 'btn-primary btn-large' },
        ),
      ),
    );
  }

  private resultPanel(battle: BattleState): HTMLElement {
    const victory = battle.phase === 'victory';
    return el(
      'div',
      { class: 'handoff-banner' },
      el(
        'div',
        { class: 'panel center result-panel' },
        el('h1', { text: victory ? 'The fight is won' : 'Driven back' }),
        el('p', {
          class: 'muted',
          text: victory
            ? 'Everyone who went down is patched up. The party keeps what it earned.'
            : 'The fight is lost. Continue to see what happens next.',
        }),
        button('Continue', () => this.app.resolveBattle(), {
          class: 'btn-primary btn-large',
        }),
      ),
    );
  }

  private logPanel(): HTMLElement {
    const state = this.app.state;
    const lines = state?.log.slice(-40) ?? [];
    const list = el('div', { class: 'log-lines scroll' });
    for (const line of lines) list.appendChild(el('p', { class: 'tiny', text: line }));
    // Newest at the bottom, scrolled into view.
    window.setTimeout(() => {
      list.scrollTop = list.scrollHeight;
    }, 0);
    return el(
      'div',
      { class: 'hud-panel log-panel' },
      el('strong', { text: 'What happened' }),
      list,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                             */
  /* ---------------------------------------------------------------- */

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;

    const now = performance.now();
    this.app.stats?.frame(now);
    this.app.animator.prune(now);

    const unit = this.active();
    let overlays: readonly OverlayLayer[] = [];
    let path: readonly Vec2[] = [];
    let climbMarkers: MapView['climbMarkers'] = [];
    let cliffEdges: MapView['cliffEdges'] = [];
    let rangeBonusTiles: readonly Vec2[] = [];
    let targetReticle: TargetReticleCue | null = null;

    const interactive = this.isPlayerTurn() && !this.needsHandoff() && !this.app.animator.busy(now);

    if (interactive && unit) {
      const pending = this.pending;
      const ability =
        this.mode.kind === 'aim' ? this.app.content.abilities.get(this.mode.abilityId) : undefined;
      const pendingIsValidTarget = Boolean(
        ability && pending && isValidTarget(this.app.content, battle, unit, ability, pending).ok,
      );
      const hoverKey = overlayMemoHoverKey(
        this.mode.kind === 'aim',
        pendingIsValidTarget,
        this.hover,
        SQUARE_FOOTPRINTS && this.mode.kind === 'move' && unit.size === 2,
      );
      const key = `${this.mode.kind}|${this.mode.kind === 'aim' ? this.mode.abilityId : ''}|${
        this.pending ? posKey(this.pending) : ''
      }|${hoverKey}|${unit.id}`;
      const memo = this.overlayMemo;
      if (memo && memo.battle === battle && memo.key === key) {
        overlays = memo.overlays;
        path = memo.path;
        climbMarkers = memo.climbMarkers;
        cliffEdges = memo.cliffEdges;
        rangeBonusTiles = memo.rangeBonusTiles;
        targetReticle = memo.targetReticle;
      } else {
        const built = this.buildOverlays(battle, unit);
        this.overlayMemo = { battle, key, ...built };
        overlays = built.overlays;
        path = built.path;
        climbMarkers = built.climbMarkers;
        cliffEdges = built.cliffEdges;
        rangeBonusTiles = built.rangeBonusTiles;
        targetReticle = built.targetReticle;
      }
    }

    // The throw being aimed, drawn to the tapped target or, with a mouse, the
    // hovered one, but only to a tile the ability can actually reach.
    let aimArc: AimArc | null = null;
    if (interactive && unit && this.mode.kind === 'aim') {
      const ability = this.app.content.abilities.get(this.mode.abilityId);
      const lob = ability ? this.lobFor(ability) : null;
      if (ability && lob !== null) {
        const targets = overlays.find((layer) => layer.kind === 'target')?.tiles ?? [];
        const target = [this.pending, this.hover].find(
          (p): p is Vec2 => p !== null && targets.some((t) => samePos(t, p)),
        );
        if (target) {
          aimArc = {
            from: footprintFoot(unit.pos, unit.size),
            to: { x: target.x + 0.5, y: target.y + 0.5 },
            arc: lob,
            color: paletteFor(ability.element).light,
          };
        }
      }
    }

    const units: RenderUnit[] = battle.units.map((u) => {
      const health = this.app.animator.unitHealth(now, u);
      return {
        id: u.id,
        pos: u.pos,
        size: u.size,
        sprite: u.sprite,
        name: u.name,
        faction: u.faction,
        hp: health.hp,
        maxHp: u.base.maxHp,
        statuses: u.statuses.map((s) => s.id),
        fallen: health.fallen,
        renderPos: this.app.animator.renderPos(now, u.id),
        ...this.poseFields(
          now,
          u.id,
          u.faction === 'enemy' ? -1 : 1,
          u.faction === 'party',
          u.sprite,
          health.fallen,
        ),
      };
    });

    // Resolved here, not in the renderer: the renderer never reads content.
    const props: RenderProp[] = battle.props.map((p) => {
      const def = CONTENT.props.get(p.propId);
      return {
        id: p.id,
        pos: p.pos,
        sprite: def?.sprite ?? 'prop.crate',
        name: def?.name ?? 'Something',
        hp: p.hp,
        maxHp: def?.hp ?? p.hp,
      };
    });

    // "They step out of the trees": the birds go first.
    this.flushedAt = flushTime(this.flushedAt, battle, this.needsHandoff(), now);

    // The air over the board is fidelity: WebGL only, and still under reduce motion.
    const ambient =
      renderer.capabilities.shaders && !motionReduced()
        ? ambientEmitters(
            ambienceFx(this.app.content.maps.get(battle.mapId)?.ambience ?? ''),
            battle.grid,
            now,
          )
        : [];

    const view: MapView = {
      grid: battle.grid,
      units,
      npcs: [],
      props,
      overlays,
      obscuringTiles: this.obscuringTilesFor(battle),
      weatherIntensity: weatherAt(this.app.content, battle.encounterId, battle.round),
      climbMarkers,
      cliffEdges,
      rangeBonusTiles,
      targetReticle,
      path,
      pathFrom: unit?.pos ?? null,
      aimArc,
      emitters: [...this.app.animator.emitters(now), ...ambient],
      bendFx: this.app.animator.bendFx(now),
      floaters: this.app.animator.floaters(now),
      cameraNudge: this.app.animator.cameraNudge(now),
      activeUnitId: unit?.id ?? null,
      selectedUnitId: null,
      hoverTile:
        interactive && !(SQUARE_FOOTPRINTS && this.mode.kind === 'move' && unit?.size === 2)
          ? this.hover
          : null,
      exit: null,
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      atmosphere: !this.app.settings.highContrast,
      backdrop: this.app.backdropFor(battle.mapId),
      scene: this.app.content.maps.get(battle.mapId)?.scene,
      time: now,
      reducedMotion: motionReduced(),
      flushedAt: this.flushedAt,
    };

    renderer.draw(view);
  };

  /**
   * The lob of an ability's flight in tiles, or null when nothing flies to
   * the target: a strike up close, something cast on oneself, an effect that
   * simply appears. Read from the same recipe the choreography plays, so the
   * arc shown is the arc thrown.
   */
  private lobFor(ability: Ability): number | null {
    const cached = this.lobs.get(ability.id);
    if (cached !== undefined) return cached;
    const melee = ability.range <= 1 && ability.targeting.shape === 'unit';
    const travel = resolveFx(ability.fx).travel;
    const lob = travel && ability.targeting.shape !== 'self' && !melee ? travel.arc : null;
    this.lobs.set(ability.id, lob);
    return lob;
  }

  /** The animator's pose for a unit, as the view fields the renderer reads. */
  private poseFields(
    now: number,
    unitId: string,
    restFacing: 1 | -1,
    directional: boolean,
    sprite: string,
    fallen = false,
  ): Pick<
    RenderUnit,
    | 'offset'
    | 'facing'
    | 'clip'
    | 'clipTime'
    | 'clipFrame'
    | 'meleeDirection'
    | 'scale'
    | 'alpha'
    | 'flash'
    | 'bend'
  > {
    const pose = this.app.animator.unitPose(now, unitId, sprite);
    const mapId = this.app.state?.battle?.mapId;
    const projection = mapId ? this.app.content.maps.get(mapId)?.projection : undefined;
    // A bend draws its own cels at the party's scale, where the plan put its sockets.
    const bend = this.app.animator.bendPose(now, unitId);
    if (bend) {
      return {
        facing: 1,
        clip: 'stance',
        bend: { heading: bend.heading, index: bend.index },
        scale: partyScale(projection),
        ...(pose ? { flash: pose.flash } : {}),
      };
    }
    const walked = this.app.animator.facing(unitId);
    // The party stands in its fighting stance between moves (ADR 0052); an
    // enemy on an eight-way sheet (the thug, ADR 0059) idles and walks by
    // heading the same way.
    const movement =
      directional || sheetLocomotion(sprite)?.headings === 8
        ? this.app.animator.locomotion(
            now,
            unitId,
            directional ? 'stance' : 'idle',
            sprite,
            restFacing,
          )
        : undefined;
    const scale = directional
      ? partyScale(projection, pose?.scale)
      : enemyScale(sprite, pose?.scale, projection);
    // Once a G knockout has played, the body stays where it fell (ADR 0059).
    const down = !pose && fallen ? this.app.animator.fallenPose(unitId, sprite) : undefined;
    if (down) return { ...down, facing: fallenFacing(down.clip, walked ?? restFacing), scale };
    if (!pose) return { ...(movement ?? { facing: walked ?? restFacing }), scale };
    return {
      offset: pose.offset,
      facing: pose.facing ?? walked ?? restFacing,
      clip: pose.clip,
      clipTime: pose.clipTime,
      ...(pose.frame !== undefined ? { clipFrame: pose.frame } : {}),
      ...(pose.meleeDirection ? { meleeDirection: pose.meleeDirection } : {}),
      scale,
      alpha: pose.alpha,
      flash: pose.flash,
      ...(pose.clip === 'walk' && movement ? movement : {}),
    };
  }

  private buildOverlays(battle: BattleState, unit: Unit): OverlayBuild {
    const overlays: OverlayLayer[] = [];
    let path: readonly Vec2[] = [];
    let climbMarkers: NonNullable<MapView['climbMarkers']> = [];
    let cliffEdges: NonNullable<MapView['cliffEdges']> = [];
    let rangeBonusTiles: readonly Vec2[] = [];
    let targetReticle: TargetReticleCue | null = null;

    if (this.mode.kind === 'move') {
      if (this.movementBlockReason(unit)) {
        return { overlays, path, climbMarkers, cliffEdges, rangeBonusTiles, targetReticle };
      }
      const reach = this.reachableCells();
      const cells = [...reach.values()].filter((c) => c.cost > 0);
      overlays.push({ kind: 'move', tiles: cells.map((c) => c.pos) });
      const ghost = moveHoverFootprint(this.hover, unit.size);
      if (SQUARE_FOOTPRINTS && ghost.length > 1) overlays.push({ kind: 'hover', tiles: ghost });
      const moveContext = this.moveContext(unit);
      const occupied = new Set(
        battle.units.flatMap((candidate) =>
          isAlive(candidate) ? occupiedCells(candidate).map(posKey) : [],
        ),
      );
      climbMarkers = cells.flatMap((cell) => {
        const from = cell.path.length > 1 ? cell.path[cell.path.length - 2] : unit.pos;
        if (!from || occupied.has(posKey(cell.pos))) return [];
        const surcharge = climbSurcharge(moveContext, from, cell.pos) ?? 0;
        return surcharge > 0 ? [{ pos: cell.pos, surcharge }] : [];
      });
      cliffEdges = cliffEdgesFor(battle.grid);
      if (this.pending) {
        const chosen = reach.get(posKey(this.pending));
        if (chosen) path = chosen.path;
      }
    } else if (this.mode.kind === 'aim') {
      const ability = this.app.content.abilities.get(this.mode.abilityId);
      if (ability) {
        const targets = targetableTiles(this.app.content, battle, unit, ability);
        overlays.push({
          kind: 'target',
          tiles: targets,
        });
        if (this.pending) {
          overlays.push({
            kind: 'area',
            tiles: affectedTiles(this.app.content, battle.grid, unit, ability, this.pending),
          });
        }
        const originTile = tileAt(battle.grid, unit.pos);
        rangeBonusTiles = targets.filter((pos) => {
          const targetTile = tileAt(battle.grid, pos);
          return Boolean(
            originTile &&
            targetTile &&
            heightReachBonus(
              this.app.content,
              ability,
              originTile.elevation,
              targetTile.elevation,
            ) > 0 &&
            distance(unit.pos, pos) > ability.range,
          );
        });
        if (rangeBonusTiles.length > 0) {
          overlays.push({ kind: 'rangeBonus', tiles: rangeBonusTiles });
        }
        const aimed = [this.pending, this.hover].find(
          (pos): pos is Vec2 => pos !== null && targets.some((target) => samePos(target, pos)),
        );
        if (aimed) {
          const target = battle.units.find(
            (candidate) =>
              isAlive(candidate) && occupiedCells(candidate).some((cell) => samePos(cell, aimed)),
          );
          if (target) {
            const preview = previewAbility(this.app.content, battle, unit, ability, aimed);
            const breakdown = preview.targets.find(
              (entry) => entry.unitId === target.id,
            )?.hitBreakdown;
            if (breakdown) {
              targetReticle = {
                pos: target.pos,
                elevation:
                  breakdown.elevation > 0 ? 'above' : breakdown.elevation < 0 ? 'below' : null,
                obscured: breakdown.obscurement.total < 0,
              };
            }
          }
        }
      }
    }

    return { overlays, path, climbMarkers, cliffEdges, rangeBonusTiles, targetReticle };
  }
}
