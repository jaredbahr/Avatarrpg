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
import type { Ability, BattleState, Unit, Vec2 } from '../../core/types';
import {
  canUseAbility,
  isValidTarget,
  knownAbilities,
  previewAbility,
  targetableTiles,
  affectedTiles,
} from '../../core/rules/abilities';
import { pathCost, posKey, reachable, samePos } from '../../core/rules/grid';
import { effectiveStats, isAlive } from '../../core/rules/stats';
import { activeUnit, upcomingOrder } from '../../core/rules/turnOrder';
import { Renderer, TILE } from '../../render/renderer';
import type { AimArc, MapView, OverlayLayer, RenderProp, RenderUnit } from '../../render/renderer';
import { CONTENT } from '../../content';
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
import { UnitInspector } from '../ui/UnitInspector';
import { partyScale } from '../anim/actorScale';
import { createMovementThreatQuery } from '../ui/movementThreats';

type Mode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'move' }
  | { readonly kind: 'aim'; readonly abilityId: string };

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
  private inspector: UnitInspector | null = null;
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
  private overlayMemo: {
    battle: BattleState;
    key: string;
    overlays: OverlayLayer[];
    path: readonly Vec2[];
  } | null = null;
  private aiScheduled = false;
  private resultShown = false;
  private logOpen = false;

  constructor(private app: App) {
    this.movementThreatQuery = createMovementThreatQuery(app.content);
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  mount(host: HTMLElement): void {
    this.host = host;
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
    this.detach?.();
    this.detach = null;
    this.inspector?.close();
    this.inspector = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.canvas = null;
    this.host = null;
  }

  resize(): void {
    const battle = this.battle();
    this.renderer?.resizeAndRedraw(
      () => this.refit(),
      battle ? { width: battle.grid.width, height: battle.grid.height } : undefined,
    );
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
      camera.clamp();
    }
    this.syncRecentre();
  }

  /** Restore readable oblique framing, or the fitted orthographic board. */
  private recentre(): void {
    const camera = this.renderer?.camera;
    if (!camera) return;
    this.manualCamera = false;
    if (camera.projection === 'oblique') {
      // Key off the browser viewport and text setting, rather than the canvas
      // height: HUD panels change the latter during aim mode, while rotation
      // and accessibility settings are genuine framing changes.
      const frameKey = `${window.innerWidth}x${window.innerHeight}:${this.app.settings.largeText}`;
      if (this.preferredCombatFrameKey !== frameKey) {
        this.preferredCombatFrameKey = frameKey;
        this.preferredCombatTilePx = window.innerWidth < 600 || window.innerHeight < 840 ? 40 : 96;
      }
      camera.fitExplore(this.preferredCombatTilePx ?? 96);
    } else camera.fit();
    const unit = this.active();
    if (!camera.fitted && unit) camera.centreOn(unit.pos);
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
    camera.centreOn({ x: unit.pos.x + (unit.size - 1) / 2, y: unit.pos.y });
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
    this.renderer.resize({ width: battle.grid.width, height: battle.grid.height });
    this.renderer.camera.projection =
      this.app.content.maps.get(battle.mapId)?.projection ?? 'orthographic';
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
        this.hover = point ? (this.renderer?.camera.toTile(point.x, point.y) ?? null) : null;
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

  private active(): Unit | undefined {
    const battle = this.battle();
    return battle ? activeUnit(battle) : undefined;
  }

  private isPlayerTurn(): boolean {
    const unit = this.active();
    return !!unit && unit.faction === 'party' && isAlive(unit);
  }

  private reachableCells() {
    const battle = this.battle();
    const unit = this.active();
    if (!battle || !unit)
      return new Map<string, { pos: Vec2; cost: number; path: readonly Vec2[] }>();

    const blocked = new Set<string>();
    for (const other of battle.units) {
      if (!isAlive(other) || other.id === unit.id) continue;
      blocked.add(posKey(other.pos));
      if (other.size === 2) blocked.add(posKey({ x: other.pos.x + 1, y: other.pos.y }));
    }

    return reachable(
      {
        grid: battle.grid,
        blocked,
        surfaces: this.app.content.surfaces,
        size: unit.size,
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
        blocked.add(posKey(other.pos));
        if (other.size === 2) blocked.add(posKey({ x: other.pos.x + 1, y: other.pos.y }));
      }
    }
    return {
      grid: battle?.grid ?? { width: 0, height: 0, tiles: [] },
      blocked,
      surfaces: this.app.content.surfaces,
      size: unit.size,
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

    const tile = renderer.camera.toTile(x, y);

    if (this.mode.kind === 'idle') {
      // Tapping a unit in idle mode inspects it; that is the only tap that
      // does anything, so a stray tap never costs AP.
      const unit = battle.units.find((u) => isAlive(u) && samePos(u.pos, tile));
      if (unit) this.openInspector(unit);
      return;
    }

    this.pending = tile;
    this.renderHud();
  }

  private onLongPress(x: number, y: number): void {
    const renderer = this.renderer;
    const battle = this.battle();
    if (!renderer || !battle) return;
    const tile = renderer.camera.toTile(x, y);
    const unit = battle.units.find(
      (u) =>
        samePos(u.pos, tile) || (u.size === 2 && samePos({ x: u.pos.x + 1, y: u.pos.y }, tile)),
    );
    if (unit) this.openInspector(unit);
  }

  private openInspector(unit: Unit): void {
    this.inspector?.close();
    this.inspector = new UnitInspector(this.app, unit, () => {
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

    const unit = this.active();
    const activeId = unit?.id ?? null;

    if (activeId !== this.lastActiveId) {
      this.lastActiveId = activeId;
      this.mode = { kind: 'idle' };
      this.pending = null;
      this.aiScheduled = false;

      // A new player's turn needs the hand-off card before anything is shown.
      if (unit && unit.faction === 'party' && !this.app.session.solo) {
        this.handedOffTo = null;
      }
      if (unit) announce(`${this.app.session.labelFor(unit)}'s turn.`);

      // Where the board cannot fit, whoever is acting is what to look at.
      const camera = this.renderer?.camera;
      if (unit && camera && !camera.fitted) camera.centreOn(unit.pos);
    }

    if (battle.phase !== 'active' && !this.resultShown) {
      this.resultShown = true;
    }

    this.renderTopBar();
    this.renderTurnStrip();
    this.renderHud();
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
    clear(bar);

    const encounter = this.app.content.encounters.get(battle.encounterId);
    // The encounter's name on a plate, in the display face, with the round under it.
    bar.appendChild(
      el(
        'div',
        { class: 'title-plate' },
        el('strong', { class: 'title-plate-name', text: encounter?.name ?? 'Battle' }),
        el('span', { class: 'title-plate-round', text: `Round ${battle.round}` }),
      ),
    );
    bar.appendChild(el('div', { class: 'spacer' }));

    const recentre = button('Recentre', () => this.recentre(), {
      class: 'btn-ghost',
      title: 'Reset the battlefield view around the acting unit',
    });
    recentre.prepend(mark(UI_MARKS.recentre, 'mark-inline'));
    recentre.hidden = this.renderer?.camera.fitted ?? true;
    this.recentreButton = recentre;
    bar.appendChild(recentre);
    const actor = button(
      'Acting unit',
      () => {
        const unit = this.active();
        if (unit) this.focusUnit(unit.id);
      },
      { class: 'btn-ghost', title: 'Return to the acting unit without changing zoom' },
    );
    actor.hidden = this.renderer?.camera.fitted ?? true;
    this.actorButton = actor;
    bar.appendChild(actor);

    if (encounter) {
      const tipButton = button('Tip', () => this.app.toasts.show(encounter.tip, 'info', 6000), {
        class: 'btn-ghost',
        title: encounter.tip,
      });
      tipButton.prepend(mark(UI_MARKS.tip, 'mark-inline'));
      bar.appendChild(tipButton);
    }
    const logButton = button(
      this.logOpen ? 'Hide log' : 'Log',
      () => {
        this.logOpen = !this.logOpen;
        this.renderTopBar();
        this.renderHud();
      },
      { class: 'btn-ghost' },
    );
    logButton.prepend(mark(UI_MARKS.log, 'mark-inline'));
    bar.appendChild(logButton);
    const pauseButton = button('Pause', () => this.app.openPause(), { class: 'btn-ghost' });
    pauseButton.prepend(mark(UI_MARKS.pause, 'mark-inline'));
    bar.appendChild(pauseButton);
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
      chip.title = `${unit.name}: ${unit.hp}/${unit.base.maxHp} HP. Focus on the battlefield.`;
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
    const canMoveNow = unit.move > 0;
    const moveButton = button(`Move`, () => this.selectMove(), {
      class: `action-button${moveActive ? ' selected' : ''}`,
      disabled: !interactive || !canMoveNow,
      title: !interactive
        ? 'Player controls are locked while another unit acts'
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
    this.mode = this.mode.kind === 'move' ? { kind: 'idle' } : { kind: 'move' };
    this.pending = null;
    this.renderHud();
  }

  private selectAbility(ability: Ability): void {
    this.mode =
      this.mode.kind === 'aim' && this.mode.abilityId === ability.id
        ? { kind: 'idle' }
        : { kind: 'aim', abilityId: ability.id };
    this.pending = null;
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
    this.pending = null;
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
          this.pending = null;
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
    for (const entry of preview.targets) {
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
      chips.appendChild(
        el('span', {
          class: `chip ${entry.friendly ? 'chip-friendly' : 'chip-hostile'}${entry.lethal ? ' chip-lethal' : ''}`,
          text: `${entry.name}: ${parts.join(' · ')}${entry.lethal ? ' — lethal' : ''}`,
        }),
      );
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
      const destination = `(${shove.to.x + 1},${shove.to.y + 1})`;
      const landingEffects = shove.landingSurfaces.map(
        (id) => this.app.content.surfaces.get(id)?.name ?? id,
      );
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
          text: shove.blocked
            ? `${shove.name}: stops at ${destination} (${shove.movedDistance}/${shove.distance}; blocked)${landing}`
            : `${shove.name}: ${shove.mode}s to ${destination}${landing}`,
        }),
      );
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
      this.pending = null;
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
        button('Move instead', () => this.selectMove(), { disabled: unit.move <= 0 }),
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
    const confirm = button('Confirm', () => onConfirm?.(), {
      class: 'btn-primary btn-ok btn-large',
      disabled: onConfirm === null,
    });
    confirm.prepend(mark(UI_MARKS.check, 'mark-inline'));
    return el(
      'div',
      { class: 'confirm-bar' },
      body,
      el(
        'div',
        { class: 'row' },
        this.cancelButton(() => {
          this.pending = null;
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

    const interactive = this.isPlayerTurn() && !this.needsHandoff() && !this.app.animator.busy(now);

    if (interactive && unit) {
      const key = `${this.mode.kind}|${this.mode.kind === 'aim' ? this.mode.abilityId : ''}|${
        this.pending ? posKey(this.pending) : ''
      }|${unit.id}`;
      const memo = this.overlayMemo;
      if (memo && memo.battle === battle && memo.key === key) {
        overlays = memo.overlays;
        path = memo.path;
      } else {
        const built = this.buildOverlays(battle, unit);
        this.overlayMemo = { battle, key, ...built };
        overlays = built.overlays;
        path = built.path;
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
            from: { x: unit.pos.x + unit.size / 2, y: unit.pos.y + 0.5 },
            to: { x: target.x + 0.5, y: target.y + 0.5 },
            arc: lob,
            color: paletteFor(ability.element).light,
          };
        }
      }
    }

    const units: RenderUnit[] = battle.units.map((u) => ({
      id: u.id,
      pos: u.pos,
      size: u.size,
      sprite: u.sprite,
      name: u.name,
      faction: u.faction,
      hp: u.hp,
      maxHp: u.base.maxHp,
      statuses: u.statuses.map((s) => s.id),
      fallen: !isAlive(u),
      renderPos: this.app.animator.renderPos(now, u.id),
      ...this.poseFields(now, u.id, u.faction === 'enemy' ? -1 : 1, u.faction === 'party'),
    }));

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
      path,
      pathFrom: unit?.pos ?? null,
      aimArc,
      emitters: [...this.app.animator.emitters(now), ...ambient],
      floaters: this.app.animator.floaters(now),
      cameraNudge: this.app.animator.cameraNudge(now),
      activeUnitId: unit?.id ?? null,
      selectedUnitId: null,
      hoverTile: interactive ? this.hover : null,
      exit: null,
      hatch: this.app.settings.hatchSurfaces,
      gridLines: showGridLines(this.app.settings),
      crispOverlays: this.app.settings.highContrast,
      atmosphere: !this.app.settings.highContrast,
      backdrop: this.app.backdropFor(battle.mapId),
      scene: this.app.content.maps.get(battle.mapId)?.scene,
      time: now,
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
  ): Pick<
    RenderUnit,
    'offset' | 'facing' | 'clip' | 'clipTime' | 'clipFrame' | 'scale' | 'alpha' | 'flash'
  > {
    const pose = this.app.animator.unitPose(now, unitId);
    const walked = this.app.animator.facing(unitId);
    const movement = directional ? this.app.animator.locomotion(now, unitId) : undefined;
    const mapId = this.app.state?.battle?.mapId;
    const projection = mapId ? this.app.content.maps.get(mapId)?.projection : undefined;
    const scale = directional ? partyScale(projection, pose?.scale) : (pose?.scale ?? 1);
    if (!pose) return { ...(movement ?? { facing: walked ?? restFacing }), scale };
    return {
      offset: pose.offset,
      facing: pose.facing ?? walked ?? restFacing,
      clip: pose.clip,
      clipTime: pose.clipTime,
      ...(pose.frame !== undefined ? { clipFrame: pose.frame } : {}),
      scale,
      alpha: pose.alpha,
      flash: pose.flash,
      ...(pose.clip === 'walk' && movement ? movement : {}),
    };
  }

  private buildOverlays(
    battle: BattleState,
    unit: Unit,
  ): { overlays: OverlayLayer[]; path: readonly Vec2[] } {
    const overlays: OverlayLayer[] = [];
    let path: readonly Vec2[] = [];

    if (this.mode.kind === 'move') {
      const reach = this.reachableCells();
      const cells = [...reach.values()].filter((c) => c.cost > 0);
      overlays.push({ kind: 'move', tiles: cells.map((c) => c.pos) });
      if (this.pending) {
        const chosen = reach.get(posKey(this.pending));
        if (chosen) path = chosen.path;
      }
    } else if (this.mode.kind === 'aim') {
      const ability = this.app.content.abilities.get(this.mode.abilityId);
      if (ability) {
        overlays.push({
          kind: 'target',
          tiles: targetableTiles(this.app.content, battle, unit, ability),
        });
        if (this.pending) {
          overlays.push({
            kind: 'area',
            tiles: affectedTiles(battle.grid, unit, ability, this.pending),
          });
        }
      }
    }

    return { overlays, path };
  }
}
