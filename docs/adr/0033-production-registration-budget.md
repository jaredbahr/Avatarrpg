# ADR 0033: Omit unused content and atlas initialization

**Status:** accepted, 2026-09-19

The combined 0.2.1 candidate exceeded the unchanged 300 KiB aggregate gzipped
JavaScript budget at 305.2 KiB, including worker and service-worker scripts.

Load `validateContent` dynamically inside the existing development-only branch.
Production never called this validator, but its static import retained schema
initialization. CI still validates all content; runtime save, audio and effect
schemas and their error messages remain intact.

Extend the existing optional Pixi registration exclusion to `spritesheet/init`.
The game parses atlas JSON through `src/render/sheets/atlasJson.ts` and loads
shared sheets for both backends. It does not use Pixi Assets or Spritesheet.
Keep all texture-source, graphics, text, particle and filter registrations.
Using Pixi's atlas loader in future requires restoring its registration first.

The production build retains its original dynamic chunks and minifier settings.
No dependency files, validation messages, budgets or CI checks change. The local
candidate totals 297.8 KiB with PWA output present. Renderer and offline checks
must pass on the integrated candidate before release.
