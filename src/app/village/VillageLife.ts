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
import { visibleNpcs } from '../../core/story/world';
import { button, el, motionReduced } from '../ui/dom';
import { WaitDialog } from '../ui/WaitDialog';
import { verticalClip } from '../anim/direction';

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
type Activity = { kind: 'water' | 'fire' | 'wave'; unitId: string; started: number };
type Visit = 'otter' | 'tea' | 'shrine' | 'practice' | 'canopy';
export class VillageLife {
  private stage: VillageLayer;
  private activity: Activity | null = null;
  private pending: Visit | null = null;
  private teaStarted: number | null = null;
  private message: HTMLElement | null = null;
  private messageText = 'An afternoon by the river. Tap the ground to walk; drag to look around.';
  private controls: HTMLButtonElement[] = [];
  private petUntil = 0;
  private greeting = -10000;
  private wasNearMira = false;
  private elapsed = 0;
  private lastFrame: number | null = null;
  private drill: number | null = null;
  private creature: Vec2 = { ...RIVERSIDE_SPOTS.otter };
  private activitiesOpen = false;
  constructor(
    private app: App,
    host: HTMLElement,
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
    this.messageText = text;
    if (this.message) this.message.textContent = text;
  }
  renderControls(host: HTMLElement, camera: Camera): void {
    this.controls = [];
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
    // The porch is the riverside's seat for waiting (ADR 0047 D8).
    secondaryAction('Wait until…', () =>
      new WaitDialog(this.app).open(
        document.querySelector<HTMLElement>('.overlay-host') ?? document.body,
      ),
    );
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
    // Only the people placed here now, at their resolved tiles (ADR 0047 §2).
    // The drawn actors still come from the stage until W7 moves them.
    const map = this.app.content.maps.get(RIVERSIDE_ID);
    const state = this.app.state;
    for (const npc of map && state ? visibleNpcs(this.app.content, map, state) : []) {
      if (npc.id === 'riverside_shrine') continue;
      if (hitsVillager(point, npc.pos)) {
        this.app.dispatch({ type: 'walkTo', pos: npc.pos });
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
  private visit(place: Visit): void {
    if (this.app.animator.busy(performance.now()) || this.busy(performance.now())) return;
    this.leaveTea();
    this.drill = null;
    const pos = place === 'otter' ? RIVERSIDE_SPOTS.otter : RIVERSIDE_SPOTS[place];
    this.pending = place === 'shrine' ? null : place;
    const events = this.app.dispatch({ type: 'walkTo', pos });
    if (events.some((e) => e.type === 'message')) this.pending = null;
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
        this.greeting += delta;
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
    const near = Boolean(head && distance(head, RIVERSIDE_SPOTS.mira) < 5);
    if (near && !this.wasNearMira) this.greeting = now;
    this.wasNearMira = near;
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
        sprite: ['sura', 'kaya'].includes(member?.characterId ?? '')
          ? `unit.village.${member?.characterId}`
          : u.sprite,
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
    actors.push({
      id: 'mira',
      pos: RIVERSIDE_SPOTS.mira,
      variant: 'elder',
      palette: 'neutral',
      villager: true,
      facing: 1,
      motion: now - this.greeting < WAVE_DURATION ? 'wave' : 'idle',
      elapsed: now - this.greeting < WAVE_DURATION ? now - this.greeting : time + 800,
      label: near ? 'Elder Mira' : '',
    });
    actors.push({
      id: 'dorin',
      pos: { x: 32, y: 12 },
      variant: 'guard',
      palette: 'earth',
      villager: true,
      facing: -1,
      motion: 'idle',
      elapsed: time + 600,
      label: head && distance(head, { x: 32, y: 12 }) < 5 ? 'Dorin' : '',
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
