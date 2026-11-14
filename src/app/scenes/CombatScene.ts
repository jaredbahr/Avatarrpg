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
import type {
  Ability,
  BattleState,
  Command,
  GameEvent,
  GameState,
  PropInstance,
  Unit,
  Vec2,
} from '../../core/types';
import {
  canUseAbility,
  heightReachBonus,
  isValidTarget,
  knownAbilities,
  previewAbility,
  resolveAim,
  targetableTiles,
  affectedTiles,
} from '../../core/rules/abilities';
import {
  distance,
  findPath,
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
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import { coverCue } from './coverCue';
import { activeUnit, upcomingOrder } from '../../core/rules/turnOrder';
import { encounterText } from '../../core/story/encounterText';
import { Renderer } from '../../render/renderer';
import { usesIntegerZoom } from '../../render/projection';
import type { Camera } from '../../render/camera';
import { footprintFoot } from '../../core/rules/footprint';
import type { AimArc, MapView, OverlayLayer, RenderProp, RenderUnit } from '../../render/renderer';
import { cliffEdgesFor, placeFloaters, type TargetReticleCue } from '../../render/view';
import { weatherAt } from '../../core/rules/obscurement';
import {
  obscuringTiles,
  weatherChipShortText,
  weatherChipText,
} from '../../core/rules/obscurementPresentation';
import { attachPointer, wheelZoomFactor } from '../input/pointer';
import { ambienceFx, resolveFx } from '../../content/fx';
import { ambientEmitters } from '../anim/ambience';
import { burningPropEmitters } from '../anim/propFire';
import { announce, button, clear, el, mark, motionReduced, painterCanvas, tip } from '../ui/dom';
import { assetCanvas } from '../ui/assetCanvas';
import { portraitKeyFor } from '../ui/PartyRoster';
import { victoryNote, victoryResults, type VictoryRow } from '../ui/victoryResults';
import { UI_MARKS, markKindFor } from '../ui/marks';
import { iconMarkup } from '../ui/icons';
import { paletteFor } from '../../render/palettes';
import { paintElementGlyph } from '../../render/painters/glyphs';
import { showGridLines } from '../storage/localSaves';
import { reactionNotes } from '../ui/ReactionNote';
import {
  formatPropConsequence,
  formatPropPreviewLabel,
  formatHitBreakdownRows,
  formatLedgeDrop,
  formatShoveMovement,
} from '../ui/combatPreviewText';
import { UnitInspector } from '../ui/UnitInspector';
import { PropInspector } from '../ui/PropInspector';
import type { ToastHandle } from '../ui/Toasts';
import { enemyScale, partyScale } from '../anim/actorScale';
import { sheetLocomotion } from '../../content/assets/manifest';
import { idlePhase, sheets } from '../../render/sheets/store';
import { createMovementThreatQuery } from '../ui/movementThreats';
import { partyWalkPhase } from '../animator';
import type { Animator } from '../animator';
import type { SoundCue } from '../anim/choreography';
import { TOPDOWN_PRESENTATION_TIMING } from '../anim/choreography';
import { PresentationClock, type CombatSpeed } from './presentationClock';
import { flushTime } from './flockFlush';
import { resolveCombatBodyPick } from './combatBodyPick';
import { actorBodyBounds } from '../../render/geometry/actorSilhouette';
import { applyTopdownFollow, topdownFollow } from '../../render/topdownFollow';
import {
  actorKeepInViewDelta,
  combatCameraGlidePoint,
  combatCameraFollowDecision,
  shouldFollowAnimatedLargeActor,
  type CombatCameraGlide,
  type CombatCameraFollowState,
} from './combatCameraFollow';
import {
  advanceVictoryBeat,
  beginVictoryBeat,
  frameLivingParty,
  livingPartyFocus,
  pauseVictoryBeat as pauseVictoryBeatClock,
  type VictoryBeatClock,
  victoryActorBounds,
} from './victoryBeat';
import {
  FIRST_FIGHT_GUIDANCE,
  combatTipCopy,
  combatTipEvents,
  combatTipFeatures,
  firstFightStage,
  nextFirstFightStage,
  unseenCombatTips,
  type CombatTipFeature,
} from './combatGuidance';

export function actingTurnCopy(unit: Pick<Unit, 'faction' | 'name'>): string {
  return unit.faction === 'ally' ? `Ally turn · ${unit.name} is acting` : `${unit.name} is acting`;
}

const COMBAT_OPENING_HOLD_MS = 700;
const COMBAT_OPENING_FOCUS_MS = 320;
const VICTORY_BEAT_HOLD_MS = 1000;
/** Turn changes use a gentle, short presentation glide. */
const COMBAT_TURN_GLIDE_MS = 420;
/** Give the render loop a frame to settle an expired glide before AI playback. */
const COMBAT_AI_GLIDE_RETRY_MS = 16;

type CameraFrame = readonly [scale: number, offsetX: number, offsetY: number];

type Mode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'move' }
  | { readonly kind: 'aim'; readonly abilityId: string };

type BattleOpeningState =
  | {
      readonly kind: 'hold';
      readonly startedAt: number | null;
      readonly frame: CameraFrame;
      readonly focus: CameraFrame;
    }
  | {
      readonly kind: 'focus';
      readonly startedAt: number;
      readonly frame: CameraFrame;
      readonly focus: CameraFrame;
    };

/** Inputs which decide which movement/target tiles the overlay memo contains. */
export function overlayMemoInputKey(mode: Mode, pending: Vec2 | null, unitId: string): string {
  return `${mode.kind}|${mode.kind === 'aim' ? mode.abilityId : ''}|${
    pending ? posKey(pending) : ''
  }|${unitId}`;
}

/** A non-target tap must not pin the reticle while pointer hover keeps moving. */
export function overlayMemoHoverKey(
  aiming: boolean,
  pendingIsValidTarget: boolean,
  hover: Vec2 | null,
  movingSquare = false,
): string {
  return ((aiming && !pendingIsValidTarget) || movingSquare) && hover ? posKey(hover) : '';
}

/** Preserve the old horizontal midpoint for the gate-off 2x1 compatibility shape. */
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

/** Sound cues a top-down skip still plays: the ones that tell how a blow or the fight ended. */
const OUTCOME_CUES: ReadonlySet<string> = new Set(['ko', 'victory', 'defeat']);
export class CombatScene implements Scene {
  readonly name = 'combat';

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: Renderer | null = null;
  private readonly sceneAnimator: Animator | null;
  private readonly presentationClock: PresentationClock | null;
  private topdownSoundQueue: SoundCue[] = [];
  private guidanceTipQueue: CombatTipFeature[] = [];
  private guidanceTipTimer: number | null = null;
  private guidanceTipHandle: ToastHandle | null = null;
  private guideReleaseTimer: number | null = null;
  private topdownBlowPoints: Vec2[] = [];
  private topdownBlowEndsAt = 0;
  private aiDueAt: number | null = null;
  private detach: (() => void) | null = null;
  private frame = 0;
  private suspended = false;
  /** Pause menu hold: dispatch stays parked without touching presentation. */
  private aiHeld = false;
  private paintingStill = false;
  private aiTimer: number | null = null;

  private mode: Mode = { kind: 'idle' };
  private pending: Vec2 | null = null;
  private hover: Vec2 | null = null;
  /** How high each ability's flight lobs, or null when nothing flies; read once from its recipe. */
  private lobs = new Map<string, number | null>();
  private inspector: UnitInspector | PropInspector | null = null;
  private readonly movementThreatQuery: ReturnType<typeof createMovementThreatQuery>;

  /** Party unit whose owner last acknowledged the hand-off banner. */
  private handedOffTo: string | null = null;
  private bannerShownFor: string | null = null;
  private lastActiveId: string | null = null;
  private recentreButton: HTMLButtonElement | null = null;
  private actorButton: HTMLButtonElement | null = null;
  /** Set by App only for a newly-created battle; saves never carry this. */
  private freshBattleEntry = false;
  /** One presentation-only formation frame before the first hand-off. */
  private battleOpening: BattleOpeningState | null = null;
  /** The victory card's rows, worked out once per finished battle. */
  private resultShownFor: BattleState | null = null;
  private victoryRows: { battle: BattleState; rows: VictoryRow[] } | null = null;
  /** Keeps the first combat frame on the last explore seats until the curtain lifts. */
  private approachPositions: ReadonlyMap<string, Vec2> | null = null;
  private approachEndsAt = 0;
  /** True after a user zoom/pan; HUD reflows must preserve that manual framing. */
  private manualCamera = false;
  /** Explicit top-down overview survives resize until the next actor turn. */
  private topdownOverview = false;
  /**
   * True after a user zoom/pan/focus until the next turn change or Recentre:
   * the camera stops following a moving actor. Kept apart from `manualCamera`,
   * which must outlive turn changes so a HUD reflow keeps the player's zoom.
   */
  private followSuspended = false;
  private cameraFollow: CombatCameraFollowState = { kind: 'idle' };
  private cameraGlide: CombatCameraGlide | null = null;
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

  firstFrameSheetKeys(): readonly string[] {
    return this.battle()?.units.map((unit) => unit.sprite) ?? [];
  }
  /**
   * The reachable set and the target/area tiles are rebuilt only when the
   * inputs that decide them change, not every frame: on a tablet the
   * flood-fill is the one per-frame cost that shows up.
   */
  private overlayMemo:
    | ({
        battle: BattleState;
        key: string;
        inputKey: string;
      } & OverlayBuild)
    | null = null;
  /** Surface cells are immutable with the battle grid, so do not rescan them every frame. */
  private obscurementMemo: { grid: BattleState['grid']; tiles: readonly Vec2[] } | null = null;
  private aiScheduled = false;
  private aiDueUnitId: string | null = null;
  private resultShown = false;
  private victoryPending = false;
  private victoryBeat: VictoryBeatClock | null = null;
  private victoryFocus: Vec2 | null = null;
  private presentationHeld = false;
  private logOpen = false;
  /** The phone header's More list, and the listeners that close it. */
  private moreOpen = false;
  private moreDismiss: (() => void) | null = null;
  /** What the header last drew, so a sync that changes none of it leaves it alone. */
  private topBarKey = '';
  private layoutMeasuredAfterSync = false;
  /** When the scene's birds burst out of the trees: once, as a fresh fight is first seen. */
  private flushedAt: number | null = null;
  private endTurnConfirmation: ToastHandle | null = null;
  private endTurnConfirmationTimer: number | null = null;
  private lastPresentationFrameAt: number | null = null;

  constructor(private app: App) {
    this.movementThreatQuery = createMovementThreatQuery(app.content);
    const battle = app.state?.battle;
    const projection = battle
      ? (app.content.maps.get(battle.mapId)?.projection ?? 'orthographic')
      : 'orthographic';
    if (projection === 'topdown') {
      this.presentationClock = new PresentationClock(performance.now());
      this.sceneAnimator = app.createPresentationAnimator({
        actionQueue: true,
        timingProfile: TOPDOWN_PRESENTATION_TIMING,
        onSounds: (cues) => this.topdownSoundQueue.push(...cues),
      });
    } else {
      this.presentationClock = null;
      this.sceneAnimator = null;
    }
  }

  private get animatorForBoard(): Animator {
    return this.sceneAnimator ?? this.app.animator;
  }

  private presentationNow(wallNow = performance.now()): number {
    return this.presentationClock?.now(wallNow) ?? wallNow;
  }

  private boardActionReadyAt(unitId?: string): number {
    const animator = this.animatorForBoard;
    if (!this.presentationClock) return animator.finishesAt;
    return Math.max(animator.actionReadyAt, unitId ? animator.actorFinishesAt(unitId) : 0);
  }

  private boardActionBusy(now: number, unitId?: string): boolean {
    const animator = this.animatorForBoard;
    if (!this.presentationClock) return animator.busy(now);
    return (
      animator.actionBusy(now) || (unitId !== undefined && animator.actorFinishesAt(unitId) > now)
    );
  }

  private syncPresentationClock(wallNow = performance.now()): void {
    if (!this.presentationClock) return;
    if (this.suspended || this.presentationHeld) this.presentationClock.pause(wallNow);
    else this.presentationClock.resume(wallNow);
  }

  private deliverTopdownSounds(presentationNow: number, wallNow: number): void {
    if (!this.sceneAnimator || this.topdownSoundQueue.length === 0) return;
    const due: SoundCue[] = [];
    const pending: SoundCue[] = [];
    for (const cue of this.topdownSoundQueue) {
      if (cue.at <= presentationNow) due.push({ ...cue, at: wallNow });
      else pending.push(cue);
    }
    this.topdownSoundQueue = pending;
    if (due.length > 0) this.app.audio.play(due, wallNow);
  }

  private cycleCombatSpeed(): void {
    const clock = this.presentationClock;
    if (!clock) return;
    const next = ((clock.rate % 3) + 1) as CombatSpeed;
    clock.setRate(next, performance.now());
    this.renderTopBar();
  }

  presentationBusy(): boolean {
    return this.sceneAnimator?.busy(this.presentationNow()) === true;
  }

  private skipPresentation(): void {
    const clock = this.presentationClock;
    if (!clock) return;
    const wallNow = performance.now();
    const now = clock.now(wallNow);
    if (!this.boardActionBusy(now, this.active()?.id)) return;
    const readyAt = this.boardActionReadyAt(this.active()?.id);
    clock.skipTo(readyAt, wallNow);
    // A skip must not burst every passed cue at once: keep only the ones that say how it ended.
    this.topdownSoundQueue = this.topdownSoundQueue.filter(
      (cue) => cue.at > readyAt || OUTCOME_CUES.has(cue.key),
    );
  }

  /** Own top-down event playback so one Animator never mixes clock domains. */
  onEvents(events: readonly GameEvent[], wallNow: number, unitsBefore: readonly Unit[]): boolean {
    this.queueCombatTips(combatTipEvents(events));
    if (!this.sceneAnimator || !this.battle()) return false;
    this.sceneAnimator.push(this.presentationNow(wallNow), events, unitsBefore);
    const endpoints: Vec2[] = [];
    const unitCentre = (id: string): Vec2 | undefined => {
      const unit = unitsBefore.find((candidate) => candidate.id === id);
      return unit ? { x: unit.pos.x + unit.size / 2, y: unit.pos.y + unit.size / 2 } : undefined;
    };
    for (const event of events) {
      if (event.type === 'abilityUsed') {
        const source = unitCentre(event.unitId);
        if (source) endpoints.push(source);
        endpoints.push({ x: event.target.x + 0.5, y: event.target.y + 0.5 });
      } else if (event.type === 'damaged' || event.type === 'attackMissed') {
        const sourceId = event.type === 'damaged' ? event.sourceId : event.unitId;
        const targetId = event.type === 'damaged' ? event.unitId : event.targetId;
        const source = sourceId ? unitCentre(sourceId) : undefined;
        const target = unitCentre(targetId);
        if (source) endpoints.push(source);
        if (target) endpoints.push(target);
      }
    }
    if (endpoints.length > 0) {
      this.topdownBlowPoints = endpoints;
      this.topdownBlowEndsAt = this.sceneAnimator.actionReadyAt;
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  mount(host: HTMLElement): void {
    this.suspended = false;
    this.aiHeld = false;
    this.presentationHeld = false;
    this.syncPresentationClock();
    this.host = host;
    if (this.app.state)
      this.queueCombatTips(combatTipFeatures(this.app.state, this.app.content.props));
    this.freshBattleEntry = this.app.consumeFreshCombatEntry?.() ?? false;
    const approach = this.freshBattleEntry
      ? this.app.consumeCombatApproach(this.app.state?.battle?.mapId ?? '')
      : null;
    const party = this.app.state?.battle?.units.filter((unit) => unit.faction === 'party') ?? [];
    const positions = new Map<string, Vec2>();
    if (approach && !motionReduced()) {
      for (const [index, unit] of party.entries()) {
        const from = approach[index];
        if (from) positions.set(unit.id, from);
      }
    }
    this.approachPositions = positions.size > 0 ? positions : null;
    this.approachEndsAt = 0;
    this.battleOpening = null;
    this.resultShown = false;
    this.victoryPending = false;
    this.victoryBeat = null;
    this.victoryFocus = null;
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
    this.sync();
    this.loop();
  }

  unmount(): void {
    this.clearEndTurnConfirmation();
    this.stopAiTimer();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.suspended = false;
    this.aiHeld = false;
    this.presentationHeld = false;
    this.syncPresentationClock();
    this.aiDueAt = null;
    this.aiDueUnitId = null;
    this.topdownSoundQueue = [];
    this.guidanceTipQueue = [];
    if (this.guideReleaseTimer != null && typeof window !== 'undefined')
      window.clearTimeout(this.guideReleaseTimer);
    this.guideReleaseTimer = null;
    if (this.guidanceTipTimer != null && typeof window !== 'undefined')
      window.clearTimeout(this.guidanceTipTimer);
    this.guidanceTipTimer = null;
    if (this.guidanceTipHandle) this.app?.toasts?.dismiss(this.guidanceTipHandle);
    this.guidanceTipHandle = null;
    this.topdownBlowPoints = [];
    this.topdownBlowEndsAt = 0;
    this.sceneAnimator?.clear();
    this.battleOpening = null;
    this.victoryPending = false;
    this.victoryBeat = null;
    this.victoryFocus = null;
    this.setVictoryBeatMarker(false);
    this.cameraGlide = null;
    this.setCameraGlideMarker(false);
    this.freshBattleEntry = false;
    this.approachPositions = null;
    this.approachEndsAt = 0;
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
  }

  suspend(): void {
    if (this.suspended) return;
    // A retained combat scene may be covered by a conversation before its
    // opening hold completes. Resolve it now so returning to that same scene
    // never replays a fresh-battle introduction.
    if (this.battleOpening) this.skipBattleOpening();
    this.pauseVictoryBeat();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.paintingStill = true;
    this.loop();
    this.paintingStill = false;
    this.suspended = true;
    this.syncPresentationClock();
    this.stopAiTimer();
  }

  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.syncPresentationClock();
    this.pauseVictoryBeat();
    this.loop();
    this.maybeRunAi();
  }

  /**
   * The pause menu's own hold. Unlike `suspend` it changes no presentation:
   * the establishing view, camera, selection and preview all stay put, only
   * enemy dispatch is parked.
   */
  holdAi(): void {
    if (this.aiHeld) return;
    this.aiHeld = true;
    this.stopAiTimer();
  }

  /** Releases the pause hold and re-arms one enemy turn if the scene still wants one. */
  releaseAi(): void {
    if (!this.aiHeld) return;
    this.aiHeld = false;
    this.maybeRunAi();
  }

  pausePresentation(): void {
    this.presentationHeld = true;
    this.syncPresentationClock();
    this.pauseVictoryBeat();
  }

  resumePresentation(): void {
    this.presentationHeld = false;
    this.syncPresentationClock();
    this.pauseVictoryBeat();
    this.maybeRunAi();
  }

  private stopAiTimer(): void {
    if (this.aiTimer !== null) window.clearTimeout(this.aiTimer);
    this.aiTimer = null;
    this.aiScheduled = false;
    this.aiDueAt = null;
    this.aiDueUnitId = null;
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
    if (this.victoryPending) {
      // Clearing the decision dock may resize the canvas while the last hit
      // is still playing. Keep its camera frame until playback has finished.
      this.syncRecentre();
      return;
    }
    if (this.battle()?.phase === 'victory' && motionReduced()) {
      // Reduced motion keeps the exact frame even when the terminal HUD gives
      // the canvas more room; clamping would recenter a fitted board here.
      this.syncRecentre();
      return;
    }
    if (this.victoryBeat && this.victoryFocus) {
      camera.clamp();
      const battle = this.battle();
      if (battle) this.victoryFocus = this.frameVictoryParty(camera, battle) ?? this.victoryFocus;
      this.syncRecentre();
      return;
    }
    if (this.battleOpening) {
      // A HUD reflow during the hold must not snap the formation back to the
      // actor. Keep the opening's frame intact and let the normal clamp absorb
      // the small viewport change; the first settled frame was measured after
      // the hand-off dock existed.
      camera.clamp();
      this.syncRecentre();
      return;
    }
    if (this.cameraGlide) this.retargetCameraGlide();
    else if (!this.manualCamera) {
      if (camera.projection === 'topdown' && this.topdownOverview) camera.fit();
      else if (camera.projection === 'topdown') this.fitTopdownCombat(camera);
      else this.recentre();
    }
    // A zoomed board keeps its zoom; one a rotation left under its fit rises
    // to it, on whole device pixels on the pixel-art boards (ADR 0088).
    else camera.raiseToFit();
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

  /**
   * Restore the whole board: the fitted orthographic board, and on the top-down board (ADR 0104) the largest whole
   * scale that shows all of it, never under a fingertip (`Camera.fit`).
   */
  private recentre(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    this.cancelCameraGlide();
    this.manualCamera = false;
    this.topdownOverview = camera.projection === 'topdown';
    // Recentre is the whole-board overview on top-down maps. Hold that framing
    // until a later actor turn explicitly re-arms follow.
    this.followSuspended = camera.projection === 'topdown';
    camera.fit();
    const unit = this.active();
    if (!camera.fitted && unit) camera.centreOn(unit.pos, unit.size);
    this.syncRecentre();
  }

  /** Initial and resize framing at top-down combat N=2, respecting minimum taps. */
  private fitTopdownCombat(camera: Camera): void {
    camera.fitExplore(80 / camera.viewport.dpr, 12, 'floor');
    const unit = this.active();
    if (!camera.fitted && unit) camera.centreOn(unit.pos, unit.size);
    this.syncRecentre();
  }

  private zoomBy(factor: number, at: { x: number; y: number }): void {
    const camera = this.renderer?.camera;
    if (!camera || this.victoryPending || this.victoryBeat) return;
    const cancelledGlide = this.cameraGlide !== null;
    this.cancelCameraGlide();
    if (cancelledGlide) {
      this.manualCamera = true;
      this.followSuspended = true;
      this.topdownOverview = false;
    }
    if (this.battleOpening) this.skipBattleOpening();
    const before = camera.scale;
    camera.zoomAt(at, factor);
    if (camera.scale !== before) {
      this.manualCamera = true;
      this.followSuspended = true;
      this.topdownOverview = false;
    }
    this.syncRecentre();
  }

  private pan(dx: number, dy: number): void {
    const camera = this.renderer?.camera;
    if (!camera || this.victoryPending || this.victoryBeat) return;
    const cancelledGlide = this.cameraGlide !== null;
    this.cancelCameraGlide();
    if (cancelledGlide) {
      this.manualCamera = true;
      this.followSuspended = true;
      this.topdownOverview = false;
    }
    if (this.battleOpening) this.skipBattleOpening();
    const before = { x: camera.offsetX, y: camera.offsetY };
    camera.panBy(dx, dy);
    if (camera.offsetX !== before.x || camera.offsetY !== before.y) {
      this.manualCamera = true;
      this.followSuspended = true;
      this.topdownOverview = false;
    }
  }

  /** Camera navigation never selects a target or spends an action. */
  private focusUnit(id: string): void {
    if (this.victoryPending || this.victoryBeat) return;
    this.cancelCameraGlide();
    if (this.battleOpening) this.skipBattleOpening();
    const unit = this.battle()?.units.find(
      (candidate) => candidate.id === id && isAlive(candidate),
    );
    const camera = this.renderer?.camera;
    if (!unit || !camera) return;
    camera.centreOn(combatFocusPosition(unit), unit.size);
    this.manualCamera = true;
    this.followSuspended = true;
    this.topdownOverview = false;
    this.syncRecentre();
  }

  /** The Recentre button only exists while there is something off screen. */
  private syncRecentre(): void {
    const button = this.recentreButton;
    if (!button) return;
    const whole = this.renderer?.camera.showsWholeGrid ?? true;
    if (button.hidden !== whole) button.hidden = whole;
    if (this.actorButton) this.actorButton.hidden = whole;
  }

  private frameVictoryParty(camera: Camera, battle: BattleState): Vec2 | null {
    const now = this.presentationNow();
    return frameLivingParty(camera, battle.units, (unit) => {
      const pose = this.poseFields(now, unit.id, 1, true, unit.sprite, false);
      return victoryActorBounds(camera, unit, {
        pos: this.animatorForBoard.renderPos(now, unit.id) ?? unit.pos,
        scale: pose.scale ?? partyScale(),
        frameHeadroom: sheets.silhouetteHeadroom(unit.sprite),
        ...(pose.offset ? { offset: pose.offset } : {}),
      });
    });
  }

  private startVictoryBeat(battle: BattleState, now: number): void {
    this.victoryPending = false;
    // The beat owns the camera from here; a turn glide must not keep moving it.
    this.cancelCameraGlide();
    this.inspector?.close();
    this.inspector = null;
    this.setMoreOpen(false, false);
    // Reduced motion keeps the last camera frame and reveals the existing
    // card only after the final knockout has finished playing.
    if (motionReduced()) {
      this.renderTopBar();
      this.renderHud();
      return;
    }
    this.victoryFocus = this.renderer
      ? this.frameVictoryParty(this.renderer.camera, battle)
      : livingPartyFocus(battle.units);
    if (this.victoryFocus && this.renderer) {
      this.manualCamera = true;
      this.followSuspended = true;
    }
    this.victoryBeat = this.victoryFocus
      ? beginVictoryBeat(
          now,
          this.presentationClock ? TOPDOWN_PRESENTATION_TIMING.victoryBeat : VICTORY_BEAT_HOLD_MS,
        )
      : null;
    // The first framed render begins the hold; fitting the camera never eats
    // into the visible beat.
    this.pauseVictoryBeat();
    this.setVictoryBeatMarker(this.victoryBeat !== null);
    this.renderTopBar();
    this.renderHud();
  }

  private pauseVictoryBeat(): void {
    if (this.victoryBeat) this.victoryBeat = pauseVictoryBeatClock(this.victoryBeat);
  }

  private updateVictoryBeat(now: number): void {
    const battle = this.battle();
    if (battle?.phase !== 'victory') {
      if (!this.victoryPending && !this.victoryBeat) return;
      this.victoryPending = false;
      this.victoryBeat = null;
      this.victoryFocus = null;
      this.setVictoryBeatMarker(false);
      this.renderTopBar();
      this.renderHud();
      return;
    }
    if (this.victoryPending) {
      if (
        this.animatorForBoard.busy(now) ||
        this.suspended ||
        this.presentationHeld ||
        this.paintingStill
      )
        return;
      this.startVictoryBeat(battle, now);
    }
    const beat = this.victoryBeat;
    if (!beat) return;

    const step = advanceVictoryBeat(
      beat,
      now,
      this.suspended || this.presentationHeld || this.paintingStill,
      motionReduced(),
    );
    this.victoryBeat = step.complete ? null : step.clock;
    if (step.complete) {
      this.setVictoryBeatMarker(false);
      this.renderTopBar();
      this.renderHud();
    }
  }

  private skipVictoryBeat(): void {
    if (!this.victoryBeat || this.battle()?.phase !== 'victory') return;
    this.victoryBeat = null;
    this.setVictoryBeatMarker(false);
    this.renderTopBar();
    this.renderHud();
  }

  private setVictoryBeatMarker(active: boolean): void {
    const scene = this.host?.querySelector<HTMLElement>('.combat-scene');
    if (!scene) return;
    if (active) scene.dataset.victoryBeat = 'active';
    else delete scene.dataset.victoryBeat;
  }

  private setupRenderer(): void {
    const canvas = this.canvas;
    const battle = this.battle();
    if (!canvas || !battle) return;

    this.renderer = new Renderer(canvas, { width: battle.grid.width, height: battle.grid.height });
    this.renderer.resize({ width: battle.grid.width, height: battle.grid.height });
    this.renderer.camera.projection =
      this.app.content.maps.get(battle.mapId)?.projection ?? 'orthographic';
    // The top-down board is pixel art at one art px per world px (ADR 0104): it draws at a whole
    // number of device pixels per world pixel (ADR 0088), at N >= dpr.
    this.renderer.camera.integerZoom = usesIntegerZoom(this.renderer.camera.projection);
    this.animatorForBoard.setProjection(this.renderer.camera.projection);
    if (this.renderer.camera.projection === 'topdown') this.fitTopdownCombat(this.renderer.camera);
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
        this.hover = point ? (this.resolvePointer(point.x, point.y, 'tap')?.tile ?? null) : null;
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
      tilePx: camera.tile * camera.scale,
      tile: camera.tile,
      offsetX: camera.offsetX,
      offsetY: camera.offsetY,
      fitted: camera.fitted,
    };
  }

  /** The same positions supplied to the renderer, including the curtain reveal. */
  partyPositions(): readonly Vec2[] | null {
    const battle = this.battle();
    if (!battle) return null;
    const now = this.presentationNow();
    return battle.units
      .filter((unit) => unit.faction === 'party')
      .map((unit) => this.renderPosition(unit, now) ?? unit.pos);
  }

  private renderPosition(unit: Unit, now: number): Vec2 | undefined {
    return this.approachPositions?.get(unit.id) ?? this.animatorForBoard.renderPos(now, unit.id);
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

  /** The one pointer-to-battlefield resolution path used by taps, hovers and holds. */
  private resolvePointer(x: number, y: number, intent: 'tap' | 'inspect') {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return null;
    const groundTile = renderer.camera.toTile(x, y);
    const active = this.active();
    const point = { x, y };
    const eligible = battle.units.filter((unit) => {
      if (intent !== 'inspect' && !isAlive(unit)) return false;
      const scale = unit.faction === 'party' ? partyScale() : enemyScale(unit.sprite, 1);
      if (!SQUARE_FOOTPRINTS || unit.size !== 2 || scale <= 1) return false;
      const pos = this.animatorForBoard.renderPos(this.presentationNow(), unit.id) ?? unit.pos;
      const box = renderer.camera.spriteBox(pos, unit.size, true);
      const bounds = actorBodyBounds(
        { ...box, width: box.size * unit.size },
        unit.size,
        null,
        scale,
      );
      return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    });
    if (eligible.length === 0) return { tile: groundTile };

    const protectedTiles = new Set<string>();
    const inputKey = overlayMemoInputKey(this.mode, this.pending, active?.id ?? '');
    const memo =
      this.overlayMemo?.battle === battle && this.overlayMemo.inputKey === inputKey
        ? this.overlayMemo
        : null;
    if (intent === 'tap' && (this.mode.kind === 'move' || this.mode.kind === 'aim')) {
      const kind = this.mode.kind === 'move' ? 'move' : 'target';
      const tiles = memo?.overlays.find((layer) => layer.kind === kind)?.tiles;
      // The render pass normally established this memo. Until it has, ground
      // picking is safer than letting a body steal a meaningful rules tile.
      if (!tiles) return { tile: groundTile };
      for (const tile of tiles) protectedTiles.add(posKey(tile));
    }
    const now = this.presentationNow();
    const geometryFor = (units: readonly Unit[]) =>
      units.map((unit) => {
        const health = this.animatorForBoard.unitHealth(now, unit);
        const pose = this.poseFields(
          now,
          unit.id,
          unit.faction === 'enemy' ? -1 : 1,
          unit.faction === 'party',
          unit.sprite,
          health.fallen,
        );
        const scale = pose.scale ?? 1;
        const pos = this.animatorForBoard.renderPos(now, unit.id) ?? unit.pos;
        const box = renderer.camera.spriteBox(pos, unit.size, SQUARE_FOOTPRINTS);
        if (pose.offset) {
          box.x += pose.offset.x * box.size;
          box.y += pose.offset.y * box.size;
        }
        return {
          unit,
          scale,
          box,
          frameHeadroom: sheets.silhouetteHeadroom(unit.sprite),
        };
      });
    const actors = geometryFor(eligible);
    const eligibleIds = new Set(eligible.map((unit) => unit.id));
    const otherActorBounds = geometryFor(
      battle.units.filter((unit) => isAlive(unit) && !eligibleIds.has(unit.id)),
    ).map(({ unit, box, scale, frameHeadroom }) => ({
      unitId: unit.id,
      ...actorBodyBounds({ ...box, width: box.size * unit.size }, unit.size, frameHeadroom, scale),
    }));
    const ability =
      intent === 'tap' && this.mode.kind === 'aim' && active
        ? this.app.content.abilities.get(this.mode.abilityId)
        : undefined;
    return resolveCombatBodyPick({
      point,
      groundTile,
      actors,
      units: battle.units,
      props: battle.props,
      protectedTiles,
      caster: active?.pos ?? null,
      ...(ability && active
        ? {
            isLegalAim: (cell: Vec2) =>
              isValidTarget(this.app.content, battle, active, ability, cell).ok,
          }
        : {}),
      otherActorBounds,
      squareFootprints: SQUARE_FOOTPRINTS,
    });
  }

  private onTap(x: number, y: number): void {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;
    if (this.skipBattleOpening()) return;
    if (this.victoryBeat || battle.phase !== 'active') return;
    if (this.boardActionBusy(this.presentationNow(), this.active()?.id)) {
      // Top-down: a tap on a busy board skips to the end of the playing action (the prototype's x6).
      this.skipPresentation();
      return;
    }
    if (!this.isPlayerTurn()) return;
    if (this.needsHandoff()) return;

    const resolved = this.resolvePointer(x, y, 'tap');
    if (!resolved) return;
    const tile = resolved.tile;

    if (this.mode.kind === 'idle') {
      // Tapping a unit or prop in idle mode inspects it; that is the only tap
      // that does anything, so a stray tap never costs AP.
      const target = resolved.unit
        ? ({ kind: 'unit', unit: resolved.unit } as const)
        : inspectTargetAt(battle.units, battle.props, tile, false);
      if (target?.kind === 'unit') this.openUnitInspector(target.unit);
      if (target?.kind === 'prop') this.openPropInspector(target.prop);
      return;
    }

    const unit = this.active();
    const ability =
      this.mode.kind === 'aim' ? this.app.content.abilities.get(this.mode.abilityId) : undefined;
    this.pending =
      unit && ability ? resolveAim(this.app.content, battle, unit, ability, tile) : tile;
    this.renderHud();
  }

  private onLongPress(x: number, y: number): void {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;
    if (this.skipBattleOpening()) return;
    if (this.victoryBeat || battle.phase !== 'active') return;
    const resolved = this.resolvePointer(x, y, 'inspect');
    if (!resolved) return;
    const target = resolved.unit
      ? ({ kind: 'unit', unit: resolved.unit } as const)
      : inspectTargetAt(battle.units, battle.props, resolved.tile, true);
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

  private openingFrame(camera: Renderer['camera']): CameraFrame {
    return [camera.scale, camera.offsetX, camera.offsetY];
  }

  private setBattleOpeningMarker(phase: BattleOpeningState['kind'] | null): void {
    const scene = this.host!.querySelector<HTMLElement>('.combat-scene')!;
    if (phase) scene.dataset.battleOpening = phase;
    else delete scene.dataset.battleOpening;
  }

  /**
   * Start the one-shot formation frame after the first settled HUD measurement.
   * The marker comes from App's ephemeral battle-entry event; a loaded state
   * never claims it, and a retained scene does not mount again on conversation
   * return.
   */
  private maybeStartBattleOpening(): void {
    if (!this.freshBattleEntry || this.battleOpening) return;
    this.freshBattleEntry = false;
    this.cancelCameraGlide();
    const camera = this.renderer!.camera;
    // A board already wholly in view has nothing to establish.
    if (motionReduced() || (camera.fitted && !this.approachPositions)) return;

    // `centreOn` is the same focus path used by turn changes and the Acting
    // unit button. Capture its result as the eased destination, then restore
    // the formation frame for the hold.
    const active = this.active()!;
    camera.centreOn(active.pos, active.size);
    const focus = this.openingFrame(camera);
    // The formation hold is a still frame, so it stands on whole device pixels
    // too (ADR 0088); only the ease from it to the actor passes between them.
    camera.scale = camera.snapScale(
      Math.max(0.35, Math.min(camera.scale, camera.fitScale(32))),
      'floor',
    );
    camera.centre();
    this.cameraFollow = { kind: 'idle' };
    this.battleOpening = {
      kind: 'hold',
      startedAt: null,
      frame: this.openingFrame(camera),
      focus,
    };
    this.setBattleOpeningMarker('hold');
  }

  /** Play the explore trail into the unchanged authored combat seats. */
  private startApproach(now: number): void {
    const positions = this.approachPositions;
    const battle = this.battle();
    this.approachPositions = null;
    if (!positions || !battle) return;
    const party = battle.units.filter((unit) => unit.faction === 'party');
    for (const [index, unit] of party.entries()) {
      const from = positions.get(unit.id);
      if (!from || samePos(from, unit.pos)) continue;
      const route = findPath(
        {
          grid: battle.grid,
          blocked: new Set(
            battle.units
              .filter((other) => other.faction !== 'party')
              .map((other) => posKey(other.pos)),
          ),
          surfaces: this.app.content.surfaces,
          size: 1,
          climbCost: this.app.content.tuning.climbCost,
        },
        from,
        unit.pos,
        battle.grid.width * battle.grid.height * 4,
      );
      const path = route?.path ?? [unit.pos];
      this.animatorForBoard.push(
        now,
        [{ type: 'partyWalked', unitId: unit.id, from, path }],
        battle.units,
        {
          alongside: true,
          silentSteps: true,
          walkPhase: partyWalkPhase(index),
        },
      );
    }
    this.approachEndsAt = this.animatorForBoard.finishesAt;
  }

  private skipBattleOpening(): boolean {
    if (!this.battleOpening) return false;
    this.battleOpening = null;
    this.setBattleOpeningMarker(null);
    this.cameraFollow = { kind: 'idle' };
    this.followSuspended = false;
    this.centreOnActiveUnit(this.active());
    this.renderHud();
    this.maybeRunAi();
    return true;
  }

  private updateBattleOpening(now: number): void {
    const opening = this.battleOpening;
    const camera = this.renderer?.camera;
    if (!opening || !camera) return;
    if (opening.kind === 'hold') {
      if (opening.startedAt === null) {
        if (this.app.curtainBusy) return;
        this.startApproach(now);
        this.battleOpening = { ...opening, startedAt: now };
        return;
      }
      const hold = this.presentationClock
        ? TOPDOWN_PRESENTATION_TIMING.openingHold
        : COMBAT_OPENING_HOLD_MS;
      if (now - opening.startedAt < hold || now < this.approachEndsAt) return;
      this.battleOpening = {
        kind: 'focus',
        startedAt: now,
        frame: this.openingFrame(camera),
        focus: opening.focus,
      };
      this.setBattleOpeningMarker('focus');
      return;
    }

    const focus = this.presentationClock
      ? TOPDOWN_PRESENTATION_TIMING.openingFocus
      : COMBAT_OPENING_FOCUS_MS;
    const fraction = (now - opening.startedAt) / focus;
    const t = Math.max(0, Math.min(1, fraction));
    const eased = t * t * (3 - 2 * t);
    camera.scale = opening.frame[0] + (opening.focus[0] - opening.frame[0]) * eased;
    camera.offsetX = opening.frame[1] + (opening.focus[1] - opening.frame[1]) * eased;
    camera.offsetY = opening.frame[2] + (opening.focus[2] - opening.frame[2]) * eased;
    camera.clamp();
    if (fraction >= 1) {
      this.battleOpening = null;
      this.setBattleOpeningMarker(null);
      this.followSuspended = false;
      this.renderHud();
      this.maybeRunAi();
    }
  }

  private needsHandoff(): boolean {
    const unit = this.active();
    if (!unit || unit.faction !== 'party') return false;
    if (this.app.session.solo) return false;
    return this.app.session.needsHandoff(this.handedOffTo, unit.id);
  }

  sync(): void {
    const battle = this.battle();
    if (!battle) return;
    if (
      !this.app.settings?.combatGuidance ||
      battle.phase !== 'active' ||
      battle.encounterId === 'enc_forest_road'
    ) {
      this.guidanceTipQueue = [];
      if (this.guidanceTipTimer != null && typeof window !== 'undefined')
        window.clearTimeout(this.guidanceTipTimer);
      this.guidanceTipTimer = null;
      if (this.guidanceTipHandle) this.app?.toasts?.dismiss(this.guidanceTipHandle);
      this.guidanceTipHandle = null;
    }

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
      this.clearEndTurnConfirmation();
      if (this.battleOpening) this.skipBattleOpening();
      this.cancelCameraGlide();
      this.lastActiveId = activeId;
      this.mode = { kind: 'idle' };
      this.clearPending();
      this.stopAiTimer();

      // Keep the last acknowledged human across unit and enemy turns; only a
      // change of human ownership needs another hand-off card.
      if (unit) {
        announce(
          unit.faction === 'party'
            ? `${this.app.session.labelFor(unit)}'s turn.`
            : actingTurnCopy(unit),
        );
      }
      // The More list was opened for the last turn; the next player at the
      // table finds it closed. The rebuild below hands focus to the toggle.
      this.setMoreOpen(false, false);

      // Where the board cannot fit, whoever is acting is what to look at.
      const camera = this.renderer?.camera;
      // A turn change re-arms follow after any manual action. An animation
      // already owned by follow keeps ownership until its release frame. The
      // player's zoom (`manualCamera`) is theirs until they press Recentre.
      this.followSuspended = false;
      this.topdownOverview = false;
      const followedStillMoving =
        this.cameraFollow.kind === 'following' &&
        this.animatorForBoard.renderPos(this.presentationNow(), this.cameraFollow.unitId) !==
          undefined;
      // Establish the initial actor immediately so the first settled HUD
      // measurement can choose compact framing before later turns glide.
      // Top-down turn changes hand ownership to the per-frame margin follow;
      // the centring glide is reserved for the orthographic board.
      if (battle.phase === 'active' && !followedStillMoving && camera?.projection !== 'topdown')
        this.centreOnActiveUnit(unit, camera, this.layoutMeasuredAfterSync);
    }

    if (battle.phase === 'active') this.resultShown = false;
    if (battle.phase !== 'active' && !this.resultShown) {
      this.resultShown = true;
      if (battle.phase === 'victory') this.victoryPending = true;
    } else if (battle.phase !== 'victory' && (this.victoryPending || this.victoryBeat)) {
      this.victoryPending = false;
      this.victoryBeat = null;
      this.victoryFocus = null;
      this.setVictoryBeatMarker(false);
    }

    this.renderTopBar();
    this.renderTurnStrip();
    this.renderHud();
    // The first ResizeObserver delivery can happen before this sync fills the
    // turn strip and decision dock. Measure after those panels exist so a
    // short tablet chooses its compact readable frame; later identical syncs
    // leave the backend alone.
    this.resizeAfterHud();
    this.maybeStartBattleOpening();
    // Do not let the first hand-off card cover the establishing view. This
    // rerender happens in the same sync, before the first RAF can paint it.
    if (this.battleOpening) this.renderHud();
    // A fresh opening owns the first enemy turn too; later turns use the
    // unchanged scheduling path below. This keeps the first formation frame
    // visible instead of letting a 260 ms AI timer cut it short.
    this.maybeRunAi();
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
    if (this.suspended || this.aiHeld || this.battleOpening) return;
    if (unit.faction === 'party') return;

    if (this.presentationClock) {
      if (this.aiDueAt === null) {
        this.aiDueUnitId = unit.id;
        this.aiDueAt =
          Math.max(this.presentationNow(), this.boardActionReadyAt(unit.id)) +
          TOPDOWN_PRESENTATION_TIMING.enemyGap;
        this.aiScheduled = true;
      }
      return;
    }
    if (this.aiScheduled) return;

    this.aiScheduled = true;
    const delay = Math.max(0, this.animatorForBoard.finishesAt - performance.now()) + 260;
    const schedule = (wait: number): void => {
      const timer = window.setTimeout(() => {
        // A canceled callback must not clear a newer actor's owned timer.
        if (this.aiTimer !== timer) return;
        this.aiTimer = null;
        // The pause menu can freeze or hold the scene between scheduling and
        // this callback; a parked fight must not advance behind the menu.
        if (this.suspended || this.aiHeld) return;
        if (this.app.state?.battle?.phase !== 'active') return;
        if (activeUnit(this.app.state.battle)?.id !== unit.id) return;
        const glide = this.cameraGlide;
        if (glide) {
          // The ordinary action delay may end before the incoming actor is
          // revealed. Wait for the render loop to finish that reveal, even if
          // its wall-clock deadline has passed before the next frame arrives.
          const remaining = glide.startedAt + glide.duration - performance.now();
          schedule(Math.max(COMBAT_AI_GLIDE_RETRY_MS, remaining));
          return;
        }
        this.app.dispatch({ type: 'runAiTurn' });
      }, wait);
      this.aiTimer = timer;
    };
    schedule(delay);
  }

  /** Top-down AI is sequenced once at the end of a frame on presentation time. */
  private advanceTopdownAi(now: number): void {
    if (!this.presentationClock || this.aiDueAt === null || this.aiDueUnitId === null) return;
    // suspend() paints one final still frame before setting `suspended`; that
    // frame may cross a due deadline, but must never advance the battle behind
    // the scene that is about to cover it.
    if (
      this.paintingStill ||
      this.suspended ||
      this.aiHeld ||
      this.battleOpening ||
      this.presentationHeld
    )
      return;
    // If a future explicit top-down reveal glide is introduced, keep the
    // existing due deadline parked until that camera motion has completed.
    if (this.cameraGlide) return;
    const battle = this.battle();
    const unit = this.active();
    if (!battle || battle.phase !== 'active' || !unit || unit.faction === 'party') {
      this.stopAiTimer();
      return;
    }
    if (unit.id !== this.aiDueUnitId) {
      this.stopAiTimer();
      this.maybeRunAi();
      return;
    }
    if (now < this.aiDueAt) return;
    this.aiDueAt = null;
    this.aiDueUnitId = null;
    this.aiScheduled = false;
    this.app.dispatch({ type: 'runAiTurn' });
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
    const key = `${battle.encounterId}|${battle.variantId ?? ''}|${battle.round}|${weatherText ?? ''}|${this.logOpen}|${battle.phase}|${this.victoryPending}|${Boolean(this.victoryBeat)}|${this.presentationClock?.rate ?? 1}`;
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
    const victoryBeat = this.victoryPending || this.victoryBeat !== null;
    const toggle = button('', () => this.setMoreOpen(!this.moreOpen, true), {
      class: 'btn-ghost combat-more-toggle',
      title: 'View and help',
      disabled: victoryBeat,
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
      {
        class: 'btn-ghost',
        title:
          this.renderer?.camera.projection === 'topdown'
            ? 'Show the whole battlefield'
            : 'Reset the battlefield view around the acting unit',
        disabled: victoryBeat,
      },
    );
    recentre.prepend(mark(UI_MARKS.recentre, 'mark-inline'));
    recentre.hidden = this.renderer?.camera.showsWholeGrid ?? true;
    recentre.dataset.key = 'recentre';
    this.recentreButton = recentre;
    more.appendChild(recentre);
    const actor = button(
      'Acting unit',
      folded(() => {
        const unit = this.active();
        if (unit) this.focusUnit(unit.id);
      }),
      {
        class: 'btn-ghost',
        title: 'Return to the acting unit without changing zoom',
        disabled: victoryBeat,
      },
    );
    actor.hidden = this.renderer?.camera.showsWholeGrid ?? true;
    actor.dataset.key = 'actor';
    this.actorButton = actor;
    more.appendChild(actor);

    if (this.presentationClock) {
      const speed = button(
        `Speed ${this.presentationClock.rate}×`,
        folded(() => this.cycleCombatSpeed()),
        {
          class: 'btn-ghost',
          title: 'Change combat presentation speed',
        },
      );
      speed.setAttribute('aria-label', `Combat speed ${this.presentationClock.rate} times`);
      speed.dataset.key = 'speed';
      more.appendChild(speed);
      const skip = button(
        'Skip animation',
        folded(() => this.skipPresentation()),
        { class: 'btn-ghost', title: 'Finish the current presentation only' },
      );
      skip.dataset.key = 'skip';
      more.appendChild(skip);
    }

    if (encounter) {
      const advice = encounterText(encounter, battle.variantId).tip;
      const tipButton = button(
        'Tip',
        folded(() => this.app.toasts.show(advice, 'info', 6000)),
        { class: 'btn-ghost', title: advice, disabled: victoryBeat },
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
      { class: 'btn-ghost', disabled: victoryBeat },
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
    strip.classList.toggle('guidance-target', this.guideStage() === 3);

    for (const unit of upcomingOrder(battle, battle.units.length).filter(isAlive)) {
      // Once the fight is over nobody is acting, so no chip is plated.
      const isActive = battle.phase === 'active' && unit.id === this.active()?.id;
      const player = this.app.session.playerFor(unit.id);
      const definition = unit.enemyId
        ? this.app.content.enemies.get(unit.enemyId)
        : unit.characterId
          ? this.app.content.characters.get(unit.characterId)
          : undefined;
      const chipName = definition?.shortName ?? unit.name;

      // The element class puts the unit's colour in --el, for the party's ring.
      const chip = el(
        'button',
        {
          class: `turn-chip faction-${unit.faction} element-${unit.element}${isActive ? ' active' : ''}`,
          attrs: {
            type: 'button',
            'aria-label': `Focus ${unit.name}`,
            ...(this.victoryPending || this.victoryBeat ? { disabled: '' } : {}),
          },
          onClick: () => this.focusUnit(unit.id),
        },
        assetCanvas(portraitKeyFor(this.app.content, unit), 2.4),
        el('span', { class: 'tiny', text: chipName }),
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
      if (battle.phase === 'victory' && this.victoryPending) return;
      if (battle.phase === 'victory' && this.victoryBeat) {
        overlays.appendChild(
          el(
            'div',
            { class: 'victory-beat-overlay', onClick: () => this.skipVictoryBeat() },
            button('Show result', () => this.skipVictoryBeat(), { class: 'btn-ghost' }),
          ),
        );
        return;
      }
      // A caption left over from the fight's last beat would sit over the card.
      if (this.resultShownFor !== battle) {
        this.resultShownFor = battle;
        this.app.toasts.clear();
      }
      overlays.appendChild(this.resultPanel(battle));
      return;
    }

    if (this.battleOpening) return;

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
      hud.appendChild(
        el(
          'div',
          { class: `enemy-turn-card element-${unit.element}`, attrs: { 'aria-hidden': 'true' } },
          assetCanvas(
            portraitKeyFor(this.app.content, unit),
            3,
            'unit-portrait square enemy-turn-portrait',
          ),
          el('span', { class: 'enemy-turn-copy', text: actingTurnCopy(unit) }),
        ),
      );
      const guidance = this.guideStage() === 3 ? this.firstFightGuidance() : null;
      if (guidance) hud.appendChild(guidance);
      if (this.logOpen) hud.appendChild(this.logPanel());
      return;
    }

    hud.appendChild(this.unitPanel(unit));
    const actions = this.actionBar(unit);
    hud.appendChild(actions);
    const guidance = this.firstFightGuidance();
    if (guidance) hud.appendChild(guidance);
    if (this.logOpen) hud.appendChild(this.logPanel());

    if (this.pending) {
      actions.appendChild(this.confirmBar(unit));
    } else {
      const hint = this.aimHint(unit);
      if (hint) actions.appendChild(hint);
    }
  }

  /**
   * The guide's stage as shown. Stage 1 asks for an attack only once an enemy
   * is in reach; until then it is cue 4, which points at End turn (#697): the
   * Forest Road opens with the bandits out of every hero's range.
   */
  private guideStage(): number | null {
    const stage =
      this.app.settings?.combatGuidance && this.app.state ? firstFightStage(this.app.state) : null;
    const unit = stage === 1 ? this.active() : undefined;
    const battle = this.battle();
    const content = this.app.content;
    return unit?.faction === 'party' &&
      battle &&
      !knownAbilities(content, unit).some(
        (ability) =>
          canUseAbility(content, unit, ability).ok &&
          targetableTiles(content, battle, unit, ability).some(
            (tile) => unitAt(battle.units, tile)?.faction === 'enemy',
          ),
      )
      ? 4
      : stage;
  }

  private firstFightGuidance(): HTMLElement | null {
    const stage = this.guideStage();
    const copy = [
      'Choose Move, then tap a highlighted tile.',
      'Choose an ability, then tap an enemy.',
      "When you're done, End turn.",
      'The strip above shows whose turn comes next.',
      'No enemy is in reach yet. Move closer, or End turn.',
    ][stage ?? -1];
    if (!copy) return null;
    if (stage === 3) this.scheduleGuideRelease();
    return el(
      'div',
      { class: 'combat-guidance', attrs: { role: 'status', 'aria-live': 'polite' } },
      el('span', { text: copy }),
      button(
        'Skip guidance',
        () => {
          this.finishFirstFightGuide();
        },
        { class: 'btn-ghost' },
      ),
    );
  }

  private scheduleGuideRelease(delay = 7000): void {
    if (this.guideReleaseTimer !== null) return;
    this.guideReleaseTimer = window.setTimeout(() => {
      this.guideReleaseTimer = null;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        this.scheduleGuideRelease(700);
        return;
      }
      if (this.guideStage() === 3) this.finishFirstFightGuide();
    }, delay);
  }

  private finishFirstFightGuide(): void {
    if (this.guideReleaseTimer !== null) window.clearTimeout(this.guideReleaseTimer);
    this.guideReleaseTimer = null;
    this.saveGuidanceFlags({ [FIRST_FIGHT_GUIDANCE.stage]: 'done' });
    this.renderHud();
  }

  private saveGuidanceFlags(flags: Readonly<Record<string, boolean | number | string>>): void {
    const state = this.app.state;
    if (!state) return;
    // Guidance is presentation state. Preserve it in the saved GameState
    // without sending a no-op reducer command through App's scene router.
    this.app.state = { ...state, flags: { ...state.flags, ...flags } };
  }

  private advanceGuideForAction(
    command: Command,
    events: readonly GameEvent[],
    before: GameState | null,
  ): void {
    if (!before || !this.app.settings.combatGuidance) return;
    const stage = firstFightStage(before);
    if (stage === null) return;
    const next = nextFirstFightStage(stage, command, events, before);
    if (next !== null) {
      this.saveGuidanceFlags({ [FIRST_FIGHT_GUIDANCE.stage]: next });
      this.renderHud();
    }
  }

  private queueCombatTips(features: readonly CombatTipFeature[]): void {
    if (features.length === 0) return;
    const state = this.app.state;
    if (
      !state ||
      !state.battle ||
      state.battle.phase !== 'active' ||
      state.battle.encounterId === 'enc_forest_road' ||
      !this.app.settings?.combatGuidance
    )
      return;
    const unseen = unseenCombatTips(features, state.flags).filter(
      (feature) => !this.guidanceTipQueue.includes(feature),
    );
    this.guidanceTipQueue.push(...unseen);
    this.scheduleCombatTip();
  }

  private scheduleCombatTip(delay = 700): void {
    if (
      this.guidanceTipTimer !== null ||
      this.guidanceTipHandle ||
      this.guidanceTipQueue.length === 0
    )
      return;
    this.guidanceTipTimer = window.setTimeout(() => {
      this.guidanceTipTimer = null;
      this.showNextCombatTip();
    }, delay);
  }

  private showNextCombatTip(): void {
    const state = this.app.state;
    if (
      !this.host ||
      !state?.battle ||
      state.battle.phase !== 'active' ||
      state.battle.encounterId === 'enc_forest_road' ||
      this.guidanceTipQueue.length === 0
    ) {
      this.guidanceTipQueue = [];
      return;
    }
    if (!this.app.settings.combatGuidance) {
      this.guidanceTipQueue = [];
      return;
    }
    if (this.battleOpening || this.needsHandoff()) {
      this.scheduleCombatTip(500);
      return;
    }
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
      this.scheduleCombatTip(500);
      return;
    }
    const feature = this.guidanceTipQueue.shift();
    if (!feature) return;
    if (state.flags[`guidance.tip.${feature}`] === true) {
      this.scheduleCombatTip(200);
      return;
    }
    this.guidanceTipHandle = this.app.toasts.show(combatTipCopy(feature), 'info', 5200, () => {
      this.guidanceTipHandle = null;
      this.scheduleCombatTip(350);
    });
    if (this.guidanceTipHandle) {
      this.saveGuidanceFlags({ [`guidance.tip.${feature}`]: true });
    } else {
      this.guidanceTipQueue.unshift(feature);
      this.scheduleCombatTip(900);
    }
  }

  private unitPanel(unit: Unit): HTMLElement {
    const stats = effectiveStats(this.app.content, unit);
    const player = this.app.session.participantForUnit(unit.id);

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
    const cue = this.guideStage();

    const moveActive = this.mode.kind === 'move';
    const movementReason = this.movementBlockReason(unit);
    const canMoveNow = unit.move > 0 && !movementReason;
    const moveButton = button(`Move`, () => this.selectMove(), {
      class: `action-button${moveActive ? ' selected' : ''}${cue === 0 ? ' guidance-target' : ''}`,
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
      class: `action-button end-turn${cue === 2 || cue === 4 ? ' guidance-target' : ''}`,
      title: 'Finish this turn. One unused AP carries over.',
      disabled: !interactive,
    });
    endButton.prepend(mark(UI_MARKS.end));
    if (unit.ap > 0)
      endButton.appendChild(el('span', { class: 'action-sub', text: `${unit.ap} AP left` }));
    row.appendChild(endButton);
    if (cue === 1) row.classList.add('guidance-target');

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
    // The guide's own End turn cue takes one tap; spare AP is not a slip there.
    if (unit.ap > 0 && !this.confirmedEndTurn && this.guideStage() !== 4) {
      this.confirmedEndTurn = true;
      const confirmation = this.app.toasts.show(
        `${unit.name} still has ${unit.ap} AP. Tap End turn again to finish anyway.`,
        'warn',
        2600,
        () => this.clearEndTurnConfirmation(),
      );
      if (!confirmation) {
        this.confirmedEndTurn = false;
        return;
      }
      this.endTurnConfirmation = confirmation;
      this.endTurnConfirmationTimer = window.setTimeout(() => {
        this.endTurnConfirmationTimer = null;
        this.clearEndTurnConfirmation();
      }, 4000);
      return;
    }
    this.clearEndTurnConfirmation();
    this.mode = { kind: 'idle' };
    this.clearPending();
    const command = { type: 'endTurn', unitId: unit.id } as const;
    const before = this.app.state;
    const events = this.app.dispatch(command);
    this.advanceGuideForAction(command, events, before);
  }

  private confirmedEndTurn = false;

  private clearEndTurnConfirmation(): void {
    this.confirmedEndTurn = false;
    if (this.endTurnConfirmationTimer !== null) {
      window.clearTimeout(this.endTurnConfirmationTimer);
      this.endTurnConfirmationTimer = null;
    }
    const toast = this.endTurnConfirmation;
    this.endTurnConfirmation = null;
    if (toast) this.app.toasts.dismiss(toast);
  }

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
          const command = { type: 'move', unitId: unit.id, path: cell.path } as const;
          const before = this.app.state;
          const events = this.app.dispatch(command);
          this.advanceGuideForAction(command, events, before);
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

    const battlefieldProps = battle.props.map((prop) => ({
      id: prop.id,
      name: this.app.content.props.get(prop.propId)?.name ?? prop.propId,
      from: prop.pos,
    }));
    for (const prop of preview.props) {
      const affected = [...prop.affectedAllies, ...prop.affectedEnemies]
        .map((unit) => unit.name)
        .join(', ');
      const consequence = formatPropConsequence(prop);
      const cover = prop.coverRemoved ? ' (cover removed)' : '';
      const suffix = `${cover}${affected ? ` — affects ${affected}` : ''}`;
      chips.appendChild(
        el('span', {
          class: 'chip chip-terrain',
          text: `${formatPropPreviewLabel(prop, battlefieldProps)}: ${consequence}${suffix}`,
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
    for (const note of reactionNotes(this.app.content, preview.reactions, this.app.comboReveal())) {
      body.appendChild(note);
    }

    if (preview.hitsFriendly) {
      body.appendChild(
        el('span', { class: 'warn-note', text: 'This will also hit your own side.' }),
      );
    }

    return this.confirmShell(body, () => {
      const command = {
        type: 'useAbility',
        unitId: unit.id,
        abilityId: ability.id,
        target,
      } as const;
      const before = this.app.state;
      const events = this.app.dispatch(command);
      this.advanceGuideForAction(command, events, before);
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
    // The one place the optional names from setup appear; without one this is
    // the player name the card has always shown.
    const who = this.app.session.handoffNameFor(unit.id) ?? unit.name;

    if (this.bannerShownFor !== unit.id) {
      this.bannerShownFor = unit.id;
      announce(`Hand the tablet to ${who}.`);
    }

    return el(
      'div',
      { class: 'handoff-banner' },
      el(
        'div',
        { class: 'panel center' },
        el('p', { class: 'muted', text: 'Hand the tablet to' }),
        el('h1', { text: who }),
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
    const anyFell = battle.units.some((unit) => unit.faction === 'party' && !isAlive(unit));
    const state = this.app.state;
    // A lost fight is the table's call (#620): Try again from the opening board,
    // or Carry on down the story's defeat branch. The rotating decider has it.
    const decider = !victory && state && !this.app.session.solo && this.app.session.decider(state);
    const retry = !victory && battle.openingRng !== null;
    return el(
      'div',
      { class: 'handoff-banner result-banner' },
      el(
        'div',
        { class: 'panel center result-panel' },
        el('h1', { text: victory ? 'The fight is won' : 'Driven back' }),
        victory ? this.victoryList(battle) : null,
        victory && !anyFell
          ? null
          : el('p', {
              class: 'muted',
              text: victory
                ? 'Everyone who went down is back on their feet.'
                : retry
                  ? 'Nobody is badly hurt. Catch your breath and try again, or carry on with the story.'
                  : 'Nobody is badly hurt. Carry on to see what happens next.',
            }),
        decider ? el('p', { text: `${decider.name} decides.` }) : null,
        el(
          'div',
          { class: 'row row-wrap' },
          retry
            ? button('Try again', () => this.app.retryBattle(), {
                class: 'btn-primary btn-large',
              })
            : null,
          button(victory ? 'Continue' : 'Carry on', () => this.app.resolveBattle(), {
            class: retry ? 'btn-large' : 'btn-primary btn-large',
          }),
        ),
      ),
    );
  }

  /**
   * One row per hero: the XP this fight paid, how near the next level is, and
   * any level-up with what it brought (#630). Read off a dry run of the real
   * resolve, once per finished battle.
   */
  private victoryList(battle: BattleState): HTMLElement | null {
    const state = this.app.state;
    if (!state) return null;
    if (this.victoryRows?.battle !== battle) {
      this.victoryRows = { battle, rows: victoryResults(this.app.content, state) };
    }
    const rows = this.victoryRows.rows;
    if (rows.length === 0) return null;
    return el(
      'ul',
      { class: 'victory-list', attrs: { 'aria-label': 'What the party earned' } },
      ...rows.map((row) => {
        // One person playing the whole party needs no names beside the heroes.
        const player = this.app.session.solo ? undefined : this.app.session.playerFor(row.unit.id);
        return el(
          'li',
          { class: `victory-row element-${row.unit.element}` },
          assetCanvas(portraitKeyFor(this.app.content, row.unit), 2.4),
          el(
            'div',
            { class: 'victory-row-body' },
            el(
              'div',
              { class: 'victory-row-head' },
              el('strong', { text: row.unit.name }),
              player && player.name !== row.unit.name
                ? el('span', { class: 'muted', text: player.name })
                : null,
              el('span', { class: 'victory-xp', text: `+${row.xp} XP` }),
              row.newLevel !== null
                ? el('span', { class: 'victory-level', text: `Level ${row.newLevel}!` })
                : null,
            ),
            el(
              'div',
              { class: 'bar victory-bar', attrs: { 'aria-hidden': 'true' } },
              el('div', { class: 'bar-fill', style: { width: `${row.progress * 100}%` } }),
            ),
            el('span', { class: 'victory-note', text: victoryNote(row) }),
          ),
        );
      }),
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
    if (this.suspended) return;
    if (!this.paintingStill) this.frame = requestAnimationFrame(this.loop);
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;

    const wallNow = performance.now();
    const now = this.presentationNow(wallNow);
    this.app.stats?.frame(wallNow);
    this.animatorForBoard.prune(now);
    const deltaMs =
      this.lastPresentationFrameAt === null ? 16 : Math.max(0, now - this.lastPresentationFrameAt);
    this.lastPresentationFrameAt = now;
    this.updateBattleOpening(now);
    this.updateVictoryBeat(now);
    if (battle.phase === 'active') this.keepAnimatedLargeActorInView(now, battle, deltaMs);

    const unit = this.active();
    let overlays: readonly OverlayLayer[] = [];
    let path: readonly Vec2[] = [];
    let climbMarkers: MapView['climbMarkers'] = [];
    let cliffEdges: MapView['cliffEdges'] = [];
    let rangeBonusTiles: readonly Vec2[] = [];
    let targetReticle: TargetReticleCue | null = null;

    const interactive =
      battle.phase === 'active' &&
      this.isPlayerTurn() &&
      !this.needsHandoff() &&
      !this.boardActionBusy(now, unit?.id);

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
      const inputKey = overlayMemoInputKey(this.mode, this.pending, unit.id);
      const key = `${inputKey}|${hoverKey}`;
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
        this.overlayMemo = { battle, key, inputKey, ...built };
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
            from: footprintFoot(unit.pos, unit.size, SQUARE_FOOTPRINTS),
            to: { x: target.x + 0.5, y: target.y + 0.5 },
            arc: lob,
            color: paletteFor(ability.element).light,
          };
        }
      }
    }

    const units: RenderUnit[] = battle.units.map((u) => {
      const health = this.animatorForBoard.unitHealth(now, u);
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
        renderPos: this.renderPosition(u, now),
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
    const floaters = placeFloaters(
      this.animatorForBoard.floaters(now),
      undefined,
      this.app.settings.largeText === 'huge'
        ? 1.5
        : this.app.settings.largeText === 'on'
          ? 1.25
          : 1,
    );

    // Resolved here, not in the renderer: the renderer never reads content.
    const props: RenderProp[] = battle.props.map((p) => {
      const def = this.app.content.props.get(p.propId);
      return {
        id: p.id,
        kind: p.propId,
        pos: p.pos,
        sprite: def?.sprite ?? 'prop.crate',
        name: def?.name ?? 'Something',
        hp: p.hp,
        maxHp: def?.hp ?? p.hp,
        ...(p.burning !== undefined ? { burning: p.burning } : {}),
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
      // A wall still to rise, or rising, on a top-down board carries how far it is out (#590).
      raisedWalls: battle.temporaryWalls.map(({ pos }) => {
        const rise = this.animatorForBoard.wallRise(now, pos);
        return rise === undefined ? pos : { ...pos, rise };
      }),
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
      emitters: [
        ...this.animatorForBoard.emitters(now),
        ...burningPropEmitters(props, now, renderer.camera.projection, motionReduced()),
        ...ambient,
      ],
      bendFx: this.animatorForBoard.bendFx(now),
      floaters,
      cameraNudge: this.animatorForBoard.cameraNudge(now),
      activeUnitId: battle.phase === 'active' ? (unit?.id ?? null) : null,
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
    this.deliverTopdownSounds(now, wallNow);
    this.advanceTopdownAi(now);
  };

  /**
   * Automatic combat framing follows only an enlarged animated body. Manual
   * pan/zoom deliberately suspends it, and ordinary actors retain the shipped
   * turn-start centring behavior.
   */
  private keepAnimatedLargeActorInView(now: number, battle: BattleState, deltaMs: number): void {
    const renderer = this.renderer;
    if (!renderer) return;
    if (this.battleOpening) return;
    const camera = renderer.camera;
    const projection = camera.projection;

    let followed: {
      unit: Unit;
      pos: Vec2;
      scale: number;
      pose: ReturnType<CombatScene['poseFields']>;
    } | null = null;
    type FollowCandidate = {
      unit: Unit;
      pos: Vec2;
      scale: number;
      pose: ReturnType<CombatScene['poseFields']>;
    };
    const topdownCandidates: FollowCandidate[] = [];
    const animatedPoints: Vec2[] = [];
    let activeFallback: FollowCandidate | null = null;
    const activeId = this.active()?.id;
    for (const unit of battle.units) {
      const movingPos = this.animatorForBoard.renderPos(now, unit.id);
      if (projection !== 'topdown' && !movingPos) continue;
      const activePose =
        projection === 'topdown'
          ? this.animatorForBoard.unitPose(now, unit.id, unit.sprite)
          : undefined;
      if (!movingPos && !activePose && !(projection === 'topdown' && unit.id === activeId))
        continue;
      const pos = movingPos ?? unit.pos;
      const health = this.animatorForBoard.unitHealth(now, unit);
      const pose = this.poseFields(
        now,
        unit.id,
        unit.faction === 'enemy' ? -1 : 1,
        unit.faction === 'party',
        unit.sprite,
        health.fallen,
      );
      const scale = pose.scale ?? 1;
      if (projection === 'topdown') {
        const candidate = { unit, pos, scale, pose };
        if (movingPos || activePose) {
          animatedPoints.push(
            camera.project({ x: pos.x + unit.size / 2, y: pos.y + unit.size / 2 }),
          );
          topdownCandidates.push(candidate);
        } else activeFallback = candidate;
      } else if (
        !shouldFollowAnimatedLargeActor({
          size: unit.size,
          scale,
          squareFootprints: SQUARE_FOOTPRINTS,
        })
      )
        continue;
      else {
        followed = { unit, pos, scale, pose };
        break;
      }
    }
    if (projection === 'topdown')
      followed =
        topdownCandidates.find((candidate) => candidate.unit.size === 2) ??
        topdownCandidates[0] ??
        activeFallback;
    const reducedMotion = motionReduced();
    const decision = combatCameraFollowDecision(this.cameraFollow, {
      animatedUnitId: followed?.unit.id ?? null,
      activeUnitId: this.active()?.id ?? null,
      followSuspended: this.followSuspended,
      // Top-down reduce-motion still reveals an off-frame actor, but does it
      // in one device-snapped correction rather than easing toward margins.
      reducedMotion: projection === 'topdown' ? false : reducedMotion,
    });
    this.cameraFollow = decision.state;
    let owner = decision.owner;
    if (projection === 'topdown' && owner === 'recentre') {
      if (followed && !this.followSuspended) {
        this.cameraFollow = { kind: 'following', unitId: followed.unit.id };
        owner = 'follow';
      } else {
        this.cameraFollow = { kind: 'idle' };
        owner = 'idle';
      }
    }
    if (owner === 'follow') this.cancelCameraGlide();
    if (owner === 'recentre') {
      this.centreOnActiveUnit(this.active(), camera, true);
      return;
    }
    if (owner !== 'follow' || !followed) {
      this.updateCameraGlide(now, camera);
      return;
    }

    const { unit, pos, scale, pose } = followed;
    const box = camera.spriteBox(pos, unit.size, true);
    if (pose.offset) {
      box.x += pose.offset.x * box.size;
      box.y += pose.offset.y * box.size;
    }
    const frame = sheets.frame(
      unit.sprite,
      pose.clip ?? 'idle',
      pose.clipTime ?? now + idlePhase(unit.id),
      pose.clipFrame,
      box.size * renderer.viewport.dpr * scale,
      unit.size,
      pose.meleeDirection,
      unit.size,
    );
    const body = actorBodyBounds(
      { ...box, width: box.size * unit.size },
      unit.size,
      frame?.headroom ?? null,
      scale,
    );
    if (projection === 'topdown') {
      const result = topdownFollow({
        focus: { x: (body.left + body.right) / 2, y: (body.top + body.bottom) / 2 },
        blowEndpoints:
          now <= this.topdownBlowEndsAt && this.topdownBlowPoints.length > 0
            ? this.topdownBlowPoints.map((point) => camera.project({ x: point.x, y: point.y }))
            : animatedPoints,
        body,
        viewport: camera.viewport,
        deltaMs: reducedMotion ? Number.POSITIVE_INFINITY : deltaMs,
      });
      if (now > this.topdownBlowEndsAt) this.topdownBlowPoints = [];
      applyTopdownFollow(camera, body, result);
      this.syncRecentre();
      return;
    }
    const delta = actorKeepInViewDelta(body, camera.viewport);
    if (delta.x !== 0 || delta.y !== 0) camera.panBy(delta.x, delta.y);
  }

  /** Shared turn-change and follow-release centring path. */
  private centreOnActiveUnit(
    unit: Unit | undefined,
    camera = this.renderer?.camera,
    animate = false,
  ): void {
    if (!unit || !camera || camera.fitted) return;
    if (!animate || motionReduced()) {
      this.cancelCameraGlide();
      camera.centreOn(unit.pos, unit.size);
      return;
    }

    const from = { x: camera.offsetX, y: camera.offsetY };
    camera.centreOn(unit.pos, unit.size);
    const to = { x: camera.offsetX, y: camera.offsetY };
    camera.offsetX = from.x;
    camera.offsetY = from.y;
    if (from.x === to.x && from.y === to.y) {
      this.cancelCameraGlide();
      return;
    }
    this.cameraGlide = {
      from,
      to,
      startedAt: this.presentationNow(),
      duration: COMBAT_TURN_GLIDE_MS,
    };
    this.setCameraGlideMarker(true);
  }

  private updateCameraGlide(now: number, camera = this.renderer?.camera): void {
    const glide = this.cameraGlide;
    if (!glide || !camera) return;
    if (camera.fitted) {
      camera.clamp();
      this.cancelCameraGlide();
      return;
    }
    const elapsed = now - glide.startedAt;
    if (elapsed >= glide.duration || motionReduced()) {
      camera.offsetX = glide.to.x;
      camera.offsetY = glide.to.y;
      this.cameraGlide = null;
      this.setCameraGlideMarker(false);
      return;
    }
    const point = combatCameraGlidePoint(glide, now);
    camera.offsetX = point.x;
    camera.offsetY = point.y;
  }

  private retargetCameraGlide(): void {
    const glide = this.cameraGlide;
    const camera = this.renderer?.camera;
    const active = this.active();
    if (!glide || !camera || !active) return;
    const now = this.presentationNow();
    const elapsed = Math.max(0, now - glide.startedAt);
    const remaining = Math.max(0, glide.duration - elapsed);
    const from = { x: camera.offsetX, y: camera.offsetY };
    if (camera.fitted) {
      camera.clamp();
      this.cancelCameraGlide();
      return;
    }
    camera.centreOn(active.pos, active.size);
    const to = { x: camera.offsetX, y: camera.offsetY };
    camera.offsetX = from.x;
    camera.offsetY = from.y;
    if (motionReduced() || remaining === 0) {
      camera.offsetX = to.x;
      camera.offsetY = to.y;
      this.cancelCameraGlide();
      return;
    }
    this.cameraGlide = { from, to, startedAt: now, duration: remaining };
  }

  private cancelCameraGlide(): void {
    if (!this.cameraGlide) return;
    this.cameraGlide = null;
    this.setCameraGlideMarker(false);
  }

  private setCameraGlideMarker(active: boolean): void {
    const scene = this.host?.querySelector<HTMLElement>('.combat-scene');
    if (!scene) return;
    if (active) scene.dataset.cameraGlide = 'active';
    else delete scene.dataset.cameraGlide;
  }

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
  > {
    const pose = this.animatorForBoard.unitPose(now, unitId, sprite);
    const walked = this.animatorForBoard.facing(unitId);
    // The party idles and walks by heading between moves, and so does an enemy
    // on an eight-way sheet (ADR 0059).
    const movement =
      directional || sheetLocomotion(sprite)?.headings === 8
        ? this.animatorForBoard.locomotion(now, unitId, 'idle', sprite, restFacing)
        : undefined;
    const scale = directional ? partyScale(pose?.scale) : enemyScale(sprite, pose?.scale);
    // Once a G knockout has played, the body stays where it fell (ADR 0059).
    const down =
      !pose && fallen ? this.animatorForBoard.fallenPose(unitId, sprite, restFacing) : undefined;
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
                cover: coverCue(this.app.content, battle.grid, unit, target, ability, battle.units),
              };
            }
          }
        }
      }
    }

    return { overlays, path, climbMarkers, cliffEdges, rangeBonusTiles, targetReticle };
  }
}
