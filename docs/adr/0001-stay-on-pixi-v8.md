# ADR 0001: Stay on Pixi v8

**Status:** accepted, 2026-09-15

## Context

The game is a Vite + TypeScript PWA. Rendering sits behind a three-method
backend interface (`src/render/backends/backend.ts`) with two implementations:
Pixi 8.20.1 on WebGL where it is accelerated, and a hand-written Canvas 2D
fallback. Pixi is imported in exactly one file. Every drawable is a
code-drawn painter today; there are no image assets.

The question was whether the current stack can reach a cel-shaded look with
sprite animation and particle effects on an iPad, or whether to switch engines
before Phase 2 content is authored.

## Decision

Stay on Pixi v8. Keep the Canvas 2D fallback (see ADR 0002).

| Option                | Cel-shaded 2D look                                                                                       | iPad Safari                                      | Keeps pure core, tests, simulator                         | Migration cost | Verdict  |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | -------------- | -------- |
| **Pixi v8 (current)** | Yes: spritesheets, AnimatedSprite, ParticleContainer, filters, WebGPU on iOS 26, Spine runtime available | Accelerated WebGL; ~140 KB already in the bundle | Untouched                                                 | None           | **Keep** |
| Phaser 3/4            | Yes, but its renderer is a peer of Pixi's; the tween and particle systems are ~600 lines in-house        | Yes                                              | Would replace the `src/app` scene layer too               | High           | No       |
| Godot 4 web export    | Yes for 2D                                                                                               | 30-40 MB wasm, threading caveats on Safari       | Rewrite in GDScript loses the core, 170 tests, sim and CI | Total          | No       |
| Unity WebGL           | Yes                                                                                                      | Heavy, memory-fragile on iOS Safari, licence     | Same rewrite                                              | Total          | No       |
| Three.js / Babylon    | 3D, not the look                                                                                         | Yes                                              | Renderer only                                             | High           | No       |
| Native / Flutter      | Yes                                                                                                      | Abandons web, PWA, hot-seat in any browser       | Rewrite                                                   | Total          | No       |

The engine is not what limits the art. What limits it is the absence of an
asset contract (ADR 0003) and an animation runtime (ADR 0004), both of which
are app-layer work that fits the existing architecture.

## Consequences

- No engine migration; Phase 2 content authoring is unblocked once ADR 0003 lands.
- Pixi upgrades stay routine: the four silent v8 behaviours in `CLAUDE.md` remain the known hazards.
- The 300 KB JavaScript budget stands; a Spine runtime is not planned and would need its own ADR.

## When this would be wrong

- Wanting a 3D or 2.5D presentation like the live-action series: Three.js, and a new ADR.
- Wanting App Store distribution: wrap the same web build with Capacitor. Still not an engine change.

## Budget amendment, 2026-09-24

ADR 0048 supersedes this ADR's 300 KB JavaScript ceiling with a 320 KB gzipped
gate. The engine and optional-registration decisions above are unchanged.

## Optional registrations, 2026-09-18

The production build omits Pixi's optional accessibility-overlay, federated-event
and DOM-container registration modules. The app already owns native DOM controls,
accessible dialogs, keyboard focus and canvas pointer handling; it does not use
Pixi's corresponding systems. A narrowly scoped Vite transform marks only those
three `init.mjs` modules as removable when their exports are unused. It does not
change the package, disable tree-shaking globally or alter the 300 KB gate.

Keep graphics, text, filters, particles and texture-source initialization. Both
rendering backends and the app's accessible controls remain supported. Recheck
production WebGL rendering, ground alignment and real pointer/inspector actions
when updating Pixi or this list. Adding Pixi-based interaction, DOM containers or
accessible display objects requires restoring the relevant registration first.
