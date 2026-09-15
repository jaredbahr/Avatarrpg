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

import type { App, Scene } from '../App';
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
import type { MapView, OverlayLayer, RenderProp, RenderUnit } from '../../render/renderer';
import { CONTENT } from '../../content';
import { resolvePainter } from '../../render/painters/registry';
import { attachPointer } from '../input/pointer';
import { announce, button, clear, el, painterCanvas } from '../ui/dom';
import { reactionNotes } from '../ui/ReactionNote';
import { UnitInspector } from '../ui/UnitInspector';

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
  private inspector: UnitInspector | null = null;

  /** Unit whose hand-off banner has been acknowledged. */
  private handedOffTo: string | null = null;
  private bannerShownFor: string | null = null;
  private lastActiveId: string | null = null;
  private aiScheduled = false;
  private resultShown = false;
  private logOpen = false;

  constructor(private app: App) {}

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
    this.renderer?.resize(
      battle ? { width: battle.grid.width, height: battle.grid.height } : undefined,
    );
    this.renderer?.camera.fit();
  }

  private setupRenderer(): void {
    const canvas = this.canvas;
    const battle = this.battle();
    if (!canvas || !battle) return;

    this.renderer = new Renderer(canvas, { width: battle.grid.width, height: battle.grid.height });
    this.renderer.resize({ width: battle.grid.width, height: battle.grid.height });
    this.renderer.camera.fit();

    // The map is the only thing that flexes, so it is still the wrong size
    // here: the turn strip and the HUD fill in after mount, and the log panel
    // and the Large-text setting move them again later. Re-fit whenever the
    // canvas box actually changes, or the camera drifts from what is drawn.
    this.renderer.onViewportChange = () => this.renderer?.camera.fit();

    this.detach = attachPointer(canvas, {
      onTap: (point) => this.onTap(point.x, point.y),
      onLongPress: (point) => this.onLongPress(point.x, point.y),
      onHover: (point) => {
        this.hover = point ? (this.renderer?.camera.toTile(point.x, point.y) ?? null) : null;
      },
    });
  }

  /** Camera geometry as plain numbers, for tests that need tile -> pixel. */
  cameraInfo(): { tilePx: number; offsetX: number; offsetY: number } | null {
    const camera = this.renderer?.camera;
    if (!camera) return null;
    return {
      tilePx: TILE * camera.scale,
      offsetX: camera.offsetX,
      offsetY: camera.offsetY,
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
    bar.appendChild(
      el(
        'div',
        { class: 'stack tight' },
        el('strong', { text: encounter?.name ?? 'Battle' }),
        el('span', { class: 'muted tiny', text: `Round ${battle.round}` }),
      ),
    );
    bar.appendChild(el('div', { class: 'spacer' }));
    if (encounter) {
      bar.appendChild(
        button('Tip', () => this.app.toasts.show(encounter.tip, 'info', 6000), {
          class: 'btn-ghost',
          title: encounter.tip,
        }),
      );
    }
    bar.appendChild(
      button(
        this.logOpen ? 'Hide log' : 'Log',
        () => {
          this.logOpen = !this.logOpen;
          this.renderTopBar();
          this.renderHud();
        },
        { class: 'btn-ghost' },
      ),
    );
    bar.appendChild(button('Pause', () => this.app.openPause(), { class: 'btn-ghost' }));
  }

  private renderTurnStrip(): void {
    const strip = this.host?.querySelector<HTMLElement>('.turn-strip');
    const battle = this.battle();
    if (!strip || !battle) return;
    clear(strip);

    for (const unit of upcomingOrder(battle, 9)) {
      const isActive = unit.id === this.active()?.id;
      const player = this.app.session.playerFor(unit.id);
      const portraitKey = unit.characterId
        ? (this.app.content.characters.get(unit.characterId)?.portrait ?? unit.sprite)
        : unit.sprite;

      const chip = el(
        'div',
        {
          class: `turn-chip faction-${unit.faction}${isActive ? ' active' : ''}`,
          title: `${unit.name}${player ? ` (${player.name})` : ''} — ${unit.hp}/${unit.base.maxHp} HP`,
        },
        painterCanvas(portraitKey, 2.4, (ctx, size) => {
          resolvePainter(portraitKey).draw(ctx, { x: 0, y: 0, size });
        }),
        el('span', { class: 'tiny', text: player?.name ?? unit.name }),
      );
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
    hud.appendChild(this.actionBar(unit));
    if (this.logOpen) hud.appendChild(this.logPanel());

    if (this.pending) {
      overlays.appendChild(this.confirmBar(unit));
    } else {
      const hint = this.aimHint(unit);
      if (hint) overlays.appendChild(hint);
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

    return el(
      'div',
      { class: `hud-panel unit-panel element-${unit.element}` },
      el(
        'div',
        { class: 'row tight' },
        el(
          'div',
          { class: 'stack tight' },
          el('strong', { text: unit.name }),
          player ? el('span', { class: 'tiny muted', text: player.name }) : null,
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
        ...unit.statuses.map((s) =>
          el('span', {
            class: 'chip chip-status',
            text: this.app.content.statuses.get(s.id)?.name ?? s.id,
            title: this.app.content.statuses.get(s.id)?.description ?? '',
          }),
        ),
      ),
    );
  }

  private actionBar(unit: Unit): HTMLElement {
    const bar = el('div', { class: 'hud-panel action-bar', attrs: { role: 'toolbar' } });

    const moveActive = this.mode.kind === 'move';
    const canMoveNow = unit.move > 0;
    const moveButton = button(`Move`, () => this.selectMove(), {
      class: `action-button${moveActive ? ' selected' : ''}`,
      disabled: !canMoveNow,
      title: canMoveNow ? 'Walk to a highlighted tile' : 'No move points left this turn',
    });
    moveButton.appendChild(el('span', { class: 'action-sub', text: `${unit.move} left` }));
    bar.appendChild(moveButton);

    for (const ability of knownAbilities(this.app.content, unit)) {
      bar.appendChild(this.abilityButton(unit, ability));
    }

    const endButton = button('End turn', () => this.endTurn(unit), {
      class: 'action-button end-turn',
      title: 'Finish this turn. One unused AP carries over.',
    });
    if (unit.ap > 0)
      endButton.appendChild(el('span', { class: 'action-sub', text: `${unit.ap} AP left` }));
    bar.appendChild(endButton);

    return bar;
  }

  private abilityButton(unit: Unit, ability: Ability): HTMLElement {
    const check = canUseAbility(this.app.content, unit, ability);
    const selected = this.mode.kind === 'aim' && this.mode.abilityId === ability.id;
    const cooldown = unit.cooldowns[ability.id] ?? 0;

    const node = button(ability.name, () => this.selectAbility(ability), {
      class: `action-button element-${ability.element}${selected ? ' selected' : ''}`,
      disabled: !check.ok,
      title: check.ok ? ability.description : check.reason,
    });

    const pips = el('span', { class: 'pips pips-small' });
    for (let i = 0; i < ability.apCost; i++) pips.appendChild(el('span', { class: 'pip pip-on' }));
    node.appendChild(pips);

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
      return this.confirmShell(
        el(
          'div',
          { class: 'row row-wrap chips' },
          el('span', { class: 'chip', text: `${cost} move` }),
          el('span', { class: 'chip', text: `${Math.max(0, unit.move - cost)} left after` }),
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
    if (preview.targets.length === 0) {
      chips.appendChild(el('span', { class: 'chip', text: 'Nobody in the area' }));
    }
    for (const entry of preview.targets) {
      const parts: string[] = [];
      if (entry.hitChance !== null) parts.push(`${entry.hitChance}%`);
      if (entry.damage > 0) parts.push(`~${entry.damage} dmg`);
      if (entry.heal > 0) parts.push(`+${entry.heal} hp`);
      for (const status of entry.statuses) {
        const name = this.app.content.statuses.get(status.id)?.name ?? status.id;
        parts.push(status.chance >= 1 ? name : `${Math.round(status.chance * 100)}% ${name}`);
      }
      chips.appendChild(
        el('span', {
          class: `chip ${entry.friendly ? 'chip-friendly' : 'chip-hostile'}${entry.lethal ? ' chip-lethal' : ''}`,
          text: `${entry.name}: ${parts.join(' · ')}${entry.lethal ? ' — lethal' : ''}`,
        }),
      );
    }
    for (const note of preview.terrain) {
      chips.appendChild(el('span', { class: 'chip chip-terrain', text: note }));
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

    const tiles = targetableTiles(this.app.content, battle, unit, ability);
    if (tiles.length > 0) {
      return el(
        'div',
        { class: 'confirm-bar aim-hint' },
        el('span', { text: `${ability.name}: tap a highlighted tile.` }),
        el(
          'div',
          { class: 'row' },
          el('div', { class: 'spacer' }),
          button(
            'Cancel',
            () => {
              this.mode = { kind: 'idle' };
              this.renderHud();
            },
            { class: 'btn-ghost' },
          ),
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
        button(
          'Cancel',
          () => {
            this.mode = { kind: 'idle' };
            this.renderHud();
          },
          { class: 'btn-ghost' },
        ),
      ),
    );
  }

  private confirmShell(body: HTMLElement, onConfirm: (() => void) | null): HTMLElement {
    return el(
      'div',
      { class: 'confirm-bar' },
      body,
      el(
        'div',
        { class: 'row' },
        button(
          'Cancel',
          () => {
            this.pending = null;
            this.renderHud();
          },
          { class: 'btn-ghost' },
        ),
        el('div', { class: 'spacer' }),
        button('Confirm', () => onConfirm?.(), {
          class: 'btn-primary btn-large',
          disabled: onConfirm === null,
        }),
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
            : 'You wake up somewhere safe, whole and a little embarrassed. The road is still there.',
        }),
        button(victory ? 'Continue' : 'Try again', () => this.app.resolveBattle(), {
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
    this.app.animator.prune(now);

    const unit = this.active();
    const overlays: OverlayLayer[] = [];
    let path: readonly Vec2[] = [];

    const interactive = this.isPlayerTurn() && !this.needsHandoff() && !this.app.animator.busy(now);

    if (interactive && unit) {
      if (this.mode.kind === 'move') {
        const cells = [...this.reachableCells().values()].filter((c) => c.cost > 0);
        overlays.push({ kind: 'move', tiles: cells.map((c) => c.pos) });
        if (this.pending) {
          const chosen = this.reachableCells().get(posKey(this.pending));
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

    const view: MapView = {
      grid: battle.grid,
      units,
      npcs: [],
      props,
      overlays,
      path,
      fx: this.app.animator.fx(now),
      floaters: this.app.animator.floaters(now),
      activeUnitId: unit?.id ?? null,
      selectedUnitId: null,
      hoverTile: interactive ? this.hover : null,
      exit: null,
      hatch: this.app.settings.hatchSurfaces,
      time: now,
    };

    renderer.draw(view);
  };
}
