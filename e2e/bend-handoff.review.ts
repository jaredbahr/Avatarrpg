/**
 * Local review of the step 7 combat handoff (ADR 0055): Kaya, Sura and Bo
 * each cast their single-target bending attack in real combat, on both
 * backends, at range 2 and 5, along a grid axis (screen south-east) and a
 * grid diagonal (screen east), captured at anticipation, launch, mid-flight,
 * impact and recovery, then standing after. Units are staged, rules
 * untouched: the cast is pushed through the animator as the reducer's events.
 * Beside the crops it writes `table.md`: per frame, the caster's bend
 * heading, cel, whether it is held, and the throw's pitch.
 *
 * Run: npx playwright test -c playwright.bend-handoff.config.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type * as StoreModule from '../src/render/sheets/store';
import type * as ChoreoModule from '../src/app/anim/bendChoreo';
import type * as TrajectoryModule from '../src/render/fx/trajectory';
import { pauseClock, resetStorage, settleLayout, startGame } from './helpers';

const OUT = process.env.FNT_REVIEW_OUT ?? 'test-results/bend-handoff';

const CASTS = [
  { character: 'kaya', sprite: 'unit.fire.kaya', ability: 'fire_jab' },
  { character: 'sura', sprite: 'unit.water.sura', ability: 'water_whip' },
  { character: 'bo', sprite: 'unit.earth.bo', ability: 'rock_throw' },
] as const;
const DIRS = [
  { name: 'cardinal', step: { x: 1, y: 0 } },
  { name: 'diagonal', step: { x: 1, y: -1 } },
] as const;
const RANGES = [2, 5] as const;

/** A tile's ground point on the page, in CSS pixels (as combat-clips.review.ts measures). */
async function tilePoint(page: Page, at: { x: number; y: number }) {
  return page.evaluate((at) => {
    const camera = window.fnt!.app.rendererCamera()!;
    const m = camera.groundTransform;
    const x = (at.x + 0.5) * 64;
    const y = (at.y + 0.5) * 64;
    const rect = document.querySelector('.map-canvas')!.getBoundingClientRect();
    return { x: rect.left + m.a * x + m.c * y + m.tx, y: rect.top + m.b * x + m.d * y + m.ty };
  }, at);
}

interface Row {
  file: string;
  phase: string;
  sceneMs: number;
  heading: string;
  cel: number | string;
  held: boolean | string;
  drawn: boolean;
  pitchDeg: string;
  aimDeg: string;
}

for (const backend of ['canvas', 'webgl'] as const) {
  test(`bend handoff review (${backend})`, async ({ page }) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await resetStorage(page, `?renderer=${backend}`);
    await startGame(page, ['Ana', 'Ben', 'Cy'], ['kaya', 'sura', 'bo'], 'bend-handoff', {
      reduceMotion: false,
    });
    await page.evaluate(() =>
      window.fnt!.app.dispatch({ type: 'enterNode', nodeId: 'battle_forest_road' }),
    );
    await settleLayout(page);
    const ready = page.getByRole('button', { name: "I'm ready" });
    if (await ready.isVisible()) await ready.click();
    await settleLayout(page);
    expect(await page.evaluate(() => window.fnt!.app.rendererBackend())).toBe(backend);

    // Combat preloads the bends and decodes the effect pages at its start.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const store = (await import(
              /* @vite-ignore */ `/src/render/sheets/${'store'}.ts`
            )) as typeof StoreModule;
            const app = window.fnt!.app as unknown as { bendFx?: unknown };
            return (
              ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo'].every(
                (key) => store.sheets.bendState(key) === 'loaded',
              ) && app.bendFx !== undefined
            );
          }),
        { timeout: 60_000 },
      )
      .toBe(true);
    await pauseClock(page);
    await page.clock.runFor(500);

    const rows: Row[] = [];
    for (const cast of CASTS)
      for (const range of RANGES)
        for (const dir of DIRS) {
          const tag = `${backend}-${cast.character}-r${range}-${dir.name}`;
          const staged = await page.evaluate(
            async ({ cast, range, step }) => {
              const choreo = (await import(
                /* @vite-ignore */ `/src/app/anim/${'bendChoreo'}.ts`
              )) as typeof ChoreoModule;
              const traj = (await import(
                /* @vite-ignore */ `/src/render/fx/${'trajectory'}.ts`
              )) as typeof TrajectoryModule;
              const app = window.fnt!.app;
              const state = app.state!;
              const battle = state.battle!;
              const { width, height } = battle.grid;
              const from = { x: 2, y: Math.min(height - 2, 7) };
              const to = { x: from.x + step.x * range, y: from.y + step.y * range };
              const caster = battle.units.find((u) => u.sprite === cast.sprite)!;
              const target = battle.units.find((u) => u.faction === 'enemy')!;
              // Everyone else stands out of the lane, along the far edge.
              let spare = 0;
              const units = battle.units.map((u) => {
                if (u.id === caster.id) return { ...u, pos: from };
                if (u.id === target.id) return { ...u, pos: to, hp: u.base.maxHp };
                const pos = { x: width - 1 - (spare % width), y: height - 1 };
                spare++;
                return { ...u, pos };
              });
              app.state = { ...state, battle: { ...battle, units } };
              app.resync();
              app.animator.clear();
              const scene = (app as unknown as { scene: Record<string, unknown> }).scene as {
                renderer: { camera: { centreOn: (p: { x: number; y: number }) => void } };
                manualCamera: boolean;
              };
              scene.manualCamera = true;
              scene.renderer.camera.centreOn({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
              const now = performance.now();
              app.animator.push(
                now,
                [
                  {
                    type: 'abilityUsed',
                    unitId: caster.id,
                    abilityId: cast.ability,
                    target: to,
                    tiles: [to],
                  },
                  {
                    type: 'damaged',
                    unitId: target.id,
                    amount: 3,
                    crit: false,
                    damageType: 'fire',
                    sourceId: caster.id,
                  },
                ],
                units,
              );
              const { tracks } = (
                app.animator as unknown as {
                  timeline: {
                    tracks: { kind: string; start: number; plan: ChoreoModule.BendPlan }[];
                  };
                }
              ).timeline;
              const track = tracks.find((t) => t.kind === 'bend');
              if (!track) return null;
              const { plan } = track;
              const starts = plan.facing.frameMs.map((_, i) =>
                plan.facing.frameMs.slice(0, i).reduce((a, b) => a + b, 0),
              );
              const key = (role: string) =>
                Object.values(plan.facing.keyFrames).find((k) => k.role === role)?.frame ?? 0;
              const at = (p: number) => choreo.bendSceneAt(plan, p);
              const last = plan.shot.releases.length - 1;
              const launch = plan.shot.releases[last]!.launchAt;
              const arrival = plan.arrivals[last] ?? launch;
              const phases: [string, number][] = [
                ['anticipation', at(starts[key('anticipation')] ?? 0) + 10],
                ...(last > 0
                  ? ([['launch-first', at(plan.shot.releases[0]!.launchAt) + 10]] as [
                      string,
                      number,
                    ][])
                  : []),
                ['launch', at(launch) + 10],
                ['midflight', (at(launch) + at(arrival)) / 2],
                ['impact', at(arrival) + 10],
                ['recovery', at(plan.wait.at + plan.wait.ms) + 10],
                ['after', plan.duration + 300],
              ];
              const socket = plan.shot.releases[last]!.socket;
              const hand = socket[socket.length - 1] ?? plan.shot.from;
              const aim = traj.aimDeg(hand, plan.shot.to);
              return {
                casterId: caster.id,
                from,
                to,
                offset: track.start - now,
                heading: plan.heading,
                aim,
                phases: phases.sort((a, b) => a[1] - b[1]),
              };
            },
            { cast, range, step: dir.step },
          );
          if (!staged) throw new Error(`${tag}: the cast did not bend`);
          const a = await tilePoint(page, staged.from);
          const b = await tilePoint(page, staged.to);
          const size = page.viewportSize()!;
          const x0 = Math.max(0, Math.min(a.x, b.x) - 150);
          const y0 = Math.max(0, Math.min(a.y, b.y) - 260);
          const clip = {
            x: x0,
            y: y0,
            width: Math.min(size.width - x0, Math.max(a.x, b.x) + 150 - x0),
            height: Math.min(size.height - y0, Math.max(a.y, b.y) + 80 - y0),
          };
          let elapsed = 0;
          for (const [index, [phase, t]] of staged.phases.entries()) {
            const target = staged.offset + t;
            await page.clock.fastForward(Math.max(1, target - elapsed));
            elapsed = Math.max(elapsed + 1, target);
            const pose = await page.evaluate(
              async ({ id, sprite }) => {
                const store = (await import(
                  /* @vite-ignore */ `/src/render/sheets/${'store'}.ts`
                )) as typeof StoreModule;
                const app = window.fnt!.app;
                const now = performance.now();
                const bend = app.animator.bendPose(now, id);
                const stance = app.animator.locomotion(now, id, 'stance', sprite).clip;
                return {
                  bend: bend ?? null,
                  stance,
                  drawn: bend
                    ? store.sheets.bendFrame(sprite, bend.heading, bend.index) !== null
                    : false,
                };
              },
              { id: staged.casterId, sprite: cast.sprite },
            );
            const file = `${tag}-${index}-${phase}.png`;
            writeFileSync(join(OUT, file), await page.screenshot({ clip }));
            const pitch = -staged.aim;
            rows.push({
              file,
              phase,
              sceneMs: Math.round(t),
              heading: pose.bend?.heading ?? `stance: ${pose.stance}`,
              cel: pose.bend?.index ?? '-',
              held: pose.bend ? pose.bend.held : '-',
              drawn: pose.drawn,
              pitchDeg: (Math.abs(pitch) > 90
                ? Math.sign(pitch) * (180 - Math.abs(pitch))
                : pitch
              ).toFixed(1),
              aimDeg: staged.aim.toFixed(1),
            });
          }
          await page.clock.fastForward(1500);
        }

    const table = [
      `# Caster facing and pitch per frame (${backend})`,
      '',
      'heading: the bend heading drawn (or the stance clip once it is over); cel: play index;',
      'held: inside a hit-stop; drawn: the bend cel resolved for the renderer; aim: the',
      'damage release from its launch socket to the landing point, degrees clockwise of',
      'screen +x; pitch: that aim above the horizontal toward the throw side (+ up).',
      '',
      '| file | phase | scene ms | heading | cel | held | drawn | aim ° | pitch ° |',
      '| --- | --- | ---: | --- | ---: | --- | --- | ---: | ---: |',
      ...rows.map(
        (r) =>
          `| ${r.file} | ${r.phase} | ${r.sceneMs} | ${r.heading} | ${r.cel} | ${r.held} | ${r.drawn} | ${r.aimDeg} | ${r.pitchDeg} |`,
      ),
      '',
    ].join('\n');
    writeFileSync(join(OUT, `table-${backend}.md`), table);
    expect(errors).toEqual([]);
  });
}
