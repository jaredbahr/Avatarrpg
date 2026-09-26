/** Riverside interactions use the existing reducer; only playback clocks live here. */
import type { App } from '../App';
import type { Vec2 } from '../../core/types';
import type { Camera } from '../../render/camera';
import type { RenderUnit } from '../../render/view';
import { VillageLayer } from '../../render/living/layer';
import type { VillageActor } from '../../render/living/layer';
import { FORM_DURATION, WAVE_DURATION } from '../../render/living/poses';
import { hitsPebble, hitsVillager, riversideWalkTime } from '../../render/living/geometry';
import { RIVERSIDE_ID, RIVERSIDE_SPOTS } from '../../content/maps/riverside';
import type { ResidentFigure } from '../world/residentMotion';
import { resolveResidents } from '../../core/story/residents';
import { phaseLabel } from '../world/journal';
import { button, el, motionReduced } from '../ui/dom';
import { WaitDialog } from '../ui/WaitDialog';
import { seatHere } from '../world/waiting';
import { verticalClip } from '../anim/direction';
import { drawnSprite } from './riversidePose';

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
type Activity = { kind: 'water' | 'fire' | 'wave'; unitId: string; started: number };
type Visit = 'otter' | 'tea' | 'shrine' | 'practice' | 'canopy' | 'wait';
/**
 * How the stage draws each resident's NpcDef sprite: the painted villager
 * figure and palette it has always used here. Placeholder art until the
 * character pipeline (ADR 0047 §7); an unknown sprite gets the generic figure.
 */
const LOOKS: Readonly<Record<string, readonly [string, string]>> = {
  'npc.elder': ['elder', 'neutral'],
  'npc.dorin': ['guard', 'earth'],
  'npc.kid': ['kid', 'air'],
};
export class VillageLife {
  private stage: VillageLayer;
  private activity: Activity | null = null;
  private pending: Visit | null = null;
  private teaStarted: number | null = null;
  private message: HTMLElement | null = null;
  private messageText = '';
  /** Until something else is said, the note is the opening line for the phase. */
  private opening = true;
  private controls: HTMLButtonElement[] = [];
  private petUntil = 0;
  /** When each resident last greeted the party, and who is near it now. */
  private greetings = new Map<string, number>();
  private near = new Set<string>();
  /** Dorin's drill is his midday relief at `rv.practice` (ADR 0047 D3, M7). */
  private dorinAtDrill = false;
  private elapsed = 0;
  private lastFrame: number | null = null;
  private drill: number | null = null;
  private creature: Vec2 = { ...RIVERSIDE_SPOTS.otter };
  private activitiesOpen = false;
  constructor(
    private app: App,
    host: HTMLElement,
    /** The scene's walk, which waits for a resident still on their way. */
    private walkTo: (pos: Vec2) => void,
  ) {
    this.stage = new VillageLayer(host);
  }
  destroy(): void {
    this.stage.destroy();
  }
  busy(now: number): boolean {
    return (
      this.activity !== null &&
      now < this.activity.started + (this.activity.kind === 'wave' ? WAVE_DURATION : FORM_DURATION)
    );
  }
  private leaveTea(): void {
    if (this.teaStarted === null) return;
    this.teaStarted = null;
    this.say('Tap the ground to walk, or choose another activity.');
  }
  private say(text: string): void {
    this.opening = false;
    this.messageText = text;
    if (this.message) this.message.textContent = text;
  }
  renderControls(host: HTMLElement, camera: Camera): void {
    this.controls = [];
    const state = this.app.state;
    if (this.opening && state)
      this.messageText = `${phaseLabel(state.world.clock.phase)} by the river. Tap the ground to walk; drag to look around.`;
    this.dorinAtDrill = Boolean(
      state &&
      resolveResidents(this.app.content, state).placements.some(
        (p) => p.id === 'lw.npc.dorin' && p.anchor === 'rv.practice',
      ),
    );
    if (!this.dorinAtDrill) this.drill = null;
    const panel = el('div', { class: 'hud-panel village-controls' });
    this.message = el('p', {
      class: 'village-note',
      text: this.messageText,
      attrs: { 'aria-live': 'polite' },
    });
    const row = el('div', {
      class: 'village-actions',
      attrs: { role: 'toolbar', 'aria-label': 'Riverside actions' },
    });
    const action = (label: string, fn: () => void, disabled = false) => {
      const b = button(label, fn, { disabled });
      this.controls.push(b);
      row.appendChild(b);
    };
    const party = this.app.state?.party ?? [];
    const activities = el('div', {
      class: 'village-secondary',
      id: 'riverside-activities',
      attrs: { role: 'group', 'aria-label': 'More riverside activities' },
    });
    activities.hidden = !this.activitiesOpen;
    const secondaryAction = (label: string, fn: () => void, disabled = false) => {
      const b = button(label, fn, { class: 'village-secondary-action', disabled });
      this.controls.push(b);
      activities.appendChild(b);
    };
    const activitiesToggle = button('Activities', () => {
      this.activitiesOpen = !this.activitiesOpen;
      activities.hidden = !this.activitiesOpen;
      activitiesToggle.setAttribute('aria-expanded', String(this.activitiesOpen));
    });
    activitiesToggle.classList.add('village-activities-toggle');
    activitiesToggle.setAttribute('aria-controls', 'riverside-activities');
    activitiesToggle.setAttribute('aria-expanded', String(this.activitiesOpen));
    row.appendChild(activitiesToggle);
    action('Water form', () => this.perform('water'), !party.some((p) => p.element === 'water'));
    action('Fire form', () => this.perform('fire'), !party.some((p) => p.element === 'fire'));
    action('Wave', () => this.perform('wave'));
    secondaryAction('Walk to Ba Dan', () => {
      this.leaveTea();
      this.pending = null;
      this.drill = null;
      this.app.dispatch({ type: 'walkTo', pos: { x: 10, y: 20 } });
    });
    secondaryAction('Under the banyan', () => this.visit('canopy'));
    secondaryAction('Meet Pebble', () => this.visit('otter'));
    secondaryAction('Visit the shrine', () => this.visit('shrine'));
    secondaryAction('Tea break', () => this.visit('tea'));
    // The porch is the riverside's seat for waiting (ADR 0047 D8): walk
    // there first, as Tea break does, then choose when to stop.
    secondaryAction('Wait until…', () => this.visit('wait'));
    if (this.dorinAtDrill)
      secondaryAction(
        "Dorin's drill",
        () => this.visit('practice'),
        !party.some((p) => p.element === 'water') || !party.some((p) => p.element === 'fire'),
      );
    if (this.app.previewActive)
      secondaryAction('Try a battle', () =>
        this.app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' }),
      );
    const utilities = el(
      'div',
      { class: 'village-utilities' },
      button('Follow party', () => {
        const pos = this.app.state?.location.pos;
        if (pos) camera.centreOn(pos);
      }),
      this.app.previewActive ? button('Leave preview', () => this.app.endVillagePreview()) : null,
    );
    const discoveries = [
      this.app.state?.flags.riverside_pet,
      this.app.state?.flags.riverside_shrine_found,
      this.app.state?.flags.riverside_tea,
    ].filter(Boolean).length;
    panel.append(
      el(
        'div',
        { class: 'village-caption' },
        el('span', { text: party.map((p) => p.name).join(' & ') }),
        el('span', { class: 'muted', text: `${discoveries}/3 little discoveries` }),
      ),
      this.message,
      row,
      activities,
      utilities,
    );
    host.appendChild(panel);
  }
  handleTap(point: Vec2, now: number): boolean {
    if (this.busy(now)) return true;
    this.leaveTea();
    if (hitsPebble(point, this.creature)) {
      this.visit('otter');
      return true;
    }
    // The people placed here now, where the stage draws them (ADR 0047 §7):
    // a tap on someone walking goes to where they are going.
    for (const who of this.residents()) {
      if (who.pos && hitsVillager(point, who.drawPos)) {
        this.walkTo(who.pos);
        return true;
      }
    }
    if (Math.abs(point.x - 31) < 1 && point.y >= 3.1 && point.y <= 4.9) {
      this.visit('shrine');
      return true;
    }
    this.pending = null;
    this.drill = null;
    return false;
  }
  /**
   * The people on the riverside now, as the walks draw them. The riverside's
   * only unbound NpcDef is the shrine, which is painted, so nobody else is drawn.
   */
  private residents(): ResidentFigure[] {
    return this.app.residents.figures();
  }
  private visit(place: Visit): void {
    if (this.app.animator.busy(performance.now()) || this.busy(performance.now())) return;
    if (place === 'practice' && !this.dorinAtDrill) return;
    // Already at the porch (tea included): no walk, just the choice.
    if (place === 'wait' && this.app.state && seatHere(this.app.content, this.app.state))
      return this.openWait();
    this.leaveTea();
    this.drill = null;
    const pos = RIVERSIDE_SPOTS[place === 'wait' ? 'tea' : place];
    this.pending = place === 'shrine' ? null : place;
    const events = this.app.dispatch({ type: 'walkTo', pos });
    if (events.some((e) => e.type === 'message')) this.pending = null;
  }
  private openWait(): void {
    new WaitDialog(this.app, () => this.visit('wait')).open(
      document.querySelector<HTMLElement>('.overlay-host') ?? document.body,
    );
  }
  private perform(kind: Activity['kind']): void {
    const now = performance.now();
    if (this.app.animator.busy(now) || this.busy(now)) return;
    const unit = this.app.state?.party.find((p) => kind === 'wave' || p.element === kind);
    if (!unit) return;
    this.leaveTea();
    this.pending = null;
    this.activity = { kind, unitId: unit.id, started: now };
    this.say(
      kind === 'wave'
        ? `${unit.name} waves to the neighbors.`
        : `${unit.name}: settle your feet, gather, release, breathe.`,
    );
  }
  /** Returns true if the update changed scenes, so the old scene stops drawing. */
  update(now: number, camera: Camera): boolean {
    const paused = document.hidden || Boolean(document.querySelector('[role="dialog"]'));
    if (this.lastFrame !== null) {
      const delta = now - this.lastFrame;
      if (paused) {
        if (this.activity) this.activity.started += delta;
        if (this.teaStarted !== null) this.teaStarted += delta;
        this.petUntil += delta;
        for (const [id, at] of this.greetings) this.greetings.set(id, at + delta);
      } else this.elapsed += Math.min(60, delta);
    }
    this.lastFrame = now;
    if (this.activity && !this.busy(now)) {
      const kind = this.activity.kind;
      this.activity = null;
      if (this.drill !== null && kind !== 'wave') {
        const sequence = ['water', 'fire', 'water'];
        if (kind === sequence[this.drill]) this.drill += 1;
        else this.drill = 0;
        if (this.drill === 3) {
          this.drill = null;
          this.app.dispatch({ type: 'setFlags', flags: { riverside_drill: true } });
          this.say('Dorin bows. “Flow, spark, flow. Nicely done.” Try it again whenever you like.');
        } else this.say(`Dorin's drill · ${this.drill}/3. Next: ${sequence[this.drill]} form.`);
      } else this.say('Try the other form, or follow the path across the bridge.');
    }
    const walkBusy = this.app.animator.busy(now);
    if (
      walkBusy ||
      (this.teaStarted !== null &&
        this.app.state &&
        distance(this.app.state.location.pos, RIVERSIDE_SPOTS.tea) > 0)
    )
      this.leaveTea();
    const locked = walkBusy || this.busy(now);
    for (const b of this.controls) {
      const element =
        b.textContent === 'Water form' ? 'water' : b.textContent === 'Fire form' ? 'fire' : null;
      b.disabled =
        locked || Boolean(element && !this.app.state?.party.some((p) => p.element === element));
      if (b.textContent === "Dorin's drill")
        b.disabled ||= !['water', 'fire'].every((e) =>
          this.app.state?.party.some((p) => p.element === e),
        );
    }
    if (this.pending && !locked) {
      const visit = this.pending;
      this.pending = null;
      if (visit === 'shrine') {
        this.app.dispatch({ type: 'enterNode', nodeId: 'riverside_shrine' });
        return true;
      }
      if (visit === 'canopy') {
        this.say(
          'The banyan shades the path. Sunlight reaches the paving stones beyond its branches.',
        );
      } else if (visit === 'otter') {
        this.petUntil = now + 3200;
        this.app.dispatch({ type: 'setFlags', flags: { riverside_pet: true } });
        this.say('Pebble leans into your hand. His shell is warm. He sniffs at your food pouch.');
      } else if (visit === 'tea') {
        this.teaStarted = now;
        this.app.dispatch({ type: 'setFlags', flags: { riverside_tea: true } });
        /*
         * The break seats the party on the veranda three tiles below where it
         * stands, and nothing walks them there, so the camera has to come along
         * or the player never sees the pair they just sat down. The tea spot is
         * the seat the leader takes; centring on it frames both figures.
         */
        camera.centreOn(RIVERSIDE_SPOTS.tea);
        this.say('A quiet break on the veranda with jasmine tea. The river runs below the steps.');
      } else if (visit === 'wait') {
        this.openWait();
      } else if (visit === 'practice') {
        this.drill = 0;
        this.say('Dorin sets a rhythm: water, fire, water. Finish each form before the next.');
      }
    }
    return false;
  }
  draw(units: readonly RenderUnit[], camera: Camera, now: number): void {
    const reduced = motionReduced();
    const time = reduced ? 0 : this.elapsed;
    const leader = units[0];
    const head = leader?.renderPos ?? leader?.pos;
    const actors: VillageActor[] = units.map((u) => {
      const member = this.app.state?.party.find((p) => p.id === u.id);
      const active = this.activity?.unitId === u.id ? this.activity : null;
      const tea =
        this.teaStarted !== null &&
        u.pos.x === 8 &&
        (u.pos.y === 18 || u.pos.y === 19) &&
        ['sura', 'kaya'].includes(member?.characterId ?? '');
      return {
        id: u.id,
        pos: u.renderPos ?? u.pos,
        variant: member?.characterId ?? 'sura',
        sprite: member ? drawnSprite(member, true) : u.sprite,
        palette: member?.element ?? 'water',
        facing: active ? 1 : (u.facing ?? 1),
        motion: tea ? 'tea' : (active?.kind ?? (u.renderPos ? 'walk' : 'idle')),
        ...(!tea && !active && u.clip ? { locomotionClip: u.clip } : {}),
        elapsed: tea
          ? now - (this.teaStarted ?? now)
          : active
            ? now - active.started
            : u.renderPos
              ? riversideWalkTime(
                  u.clipTime ?? 0,
                  ['sura', 'kaya'].includes(member?.characterId ?? ''),
                  u.clip !== undefined && verticalClip(u.clip),
                )
              : time,
        label: u.name,
      };
    });
    // The residents placed on the riverside in this phase (ADR 0047 §2, §7),
    // each greeting the party once as it comes near.
    // A resident walking in or out strides on the party's distance clock.
    this.residents().forEach((who, index) => {
      const at = who.drawPos;
      const near = Boolean(head && who.pos && !who.walking && distance(head, at) < 5);
      if (near && !this.near.has(who.id)) this.greetings.set(who.id, now);
      if (near) this.near.add(who.id);
      else this.near.delete(who.id);
      const since = now - (this.greetings.get(who.id) ?? -Infinity);
      const [variant, palette] = LOOKS[who.sprite] ?? [who.sprite, 'neutral'];
      actors.push({
        id: who.id,
        pos: at,
        variant,
        palette,
        villager: true,
        facing: who.walking ? who.facing : head && head.x < at.x ? -1 : 1,
        motion: who.walking ? 'walk' : since < WAVE_DURATION ? 'wave' : 'idle',
        elapsed: who.walking
          ? who.clipTime
          : since < WAVE_DURATION
            ? since
            : time + 600 + index * 200,
        label: near ? who.name : '',
        alpha: who.alpha,
      });
    });
    // A small loop on open bank tiles. Once befriended, Pebble notices the
    // party but stays on his bank instead of crossing cliffs or deep water.
    const t = time / 1000;
    const pet = now < this.petUntil;
    this.creature = {
      x: RIVERSIDE_SPOTS.otter.x + 0.65 + (pet ? 0 : Math.sin(t * 0.35) * 0.4),
      y: RIVERSIDE_SPOTS.otter.y - 0.3 + (pet ? 0 : Math.cos(t * 0.35) * 0.2),
    };
    this.stage.draw(
      {
        time,
        reduced,
        // The reducer can already be in Ba Dan while this departing walk finishes.
        backdrop: this.app.backdropFor(RIVERSIDE_ID),
        actors,
        creature: this.creature,
        friendly: Boolean(this.app.state?.flags.riverside_pet),
        creatureLabel: Boolean(head && distance(head, this.creature) < 5),
        pet,
        fireflies: Boolean(this.app.state?.flags.riverside_shrine_found),
      },
      camera,
    );
  }
}
