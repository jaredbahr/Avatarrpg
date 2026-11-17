# CSS token guard (#488)

The changes on `codex/issue-488-css-tokens-01a1b3cc` start from
`91745537bd4e0795eb6edac82ee907b403d1f4cf`. The work is tracked in
[#488](https://github.com/jaredbahr/Avatarrpg/issues/488), with the
[scope claim](https://github.com/jaredbahr/Avatarrpg/issues/488#issuecomment-6904801890).

`node scripts/check-css-tokens.mjs` checks the shipped stylesheets and
`src/app/**/*.ts` inline styles. The standard Vitest suite checks the whole
repository and plants violations in CSS and TypeScript fixtures. The checker
uses the PostCSS already locked for Vite and TypeScript already in the project.
Measurements passed from the viewport or canvas use the exact exceptions
listed in the checker. Existing media query lengths use relative units.

The stylesheet edits keep the original values. The fixed root font size,
decorative outlines, focus spacing, pill rounding, and objective-pointer cap
remain fixed through Large text. The high-contrast hairline changes from one to
two pixels as before. Reduced motion keeps its 1 ms animation duration and
zero-duration transitions. Black and white alpha tints keep their original
percentages.

Exact-head full `npm run ci:local` and rendered before/after evidence are
pending. Compare the title and dialogue, a combat HUD with visible focus,
local-map labels, interlude layers, and the objective pointer at matching
Chrome and WebKit viewports. Exercise the existing Large-text, high-contrast
and reduced-motion settings. Attach a diff summary to the PR.
