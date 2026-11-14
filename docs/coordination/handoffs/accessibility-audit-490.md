# Eight-screen accessibility audit

Issue [#490](https://github.com/jaredbahr/Avatarrpg/issues/490) tracks the WCAG 2.1 AA audit. The Playwright spec uses the production build and the real title, setup, Settings, exploration, dialogue, combat targeting, earned reward and ending screens. It attaches every axe result, fails on serious and critical violations, and separately checks the map and battlefield names and the combat log text.

The first Chromium run used a 1194 × 834 viewport on main `f2ecf6ba` with the audit applied. Five screens passed the severity gate. The report records these remaining findings:

- Exploration has visible label text missing from the accessible names of the objective, Follow and roster controls.
- The dialogue panel presents itself as a button around a second button. It also fails the visible-label check.
- The combat action-point pips put an ARIA label on a generic element.
- The shared viewport declaration disables user zoom. Axe classifies this as moderate.

Chromium and iPad landscape WebKit each ran all eight scans with the same violations and targets. The JSON receipts are `497AFB23BE6319FCA52A27B1863C341EBA4762F31A770A32CADCCE1D4A2E6F47` for Chromium and `0CD1FDEBD78109254F68B44DD00B82656E21E41652129D8F7EABC104AA22D604` for WebKit. Coordinate the exploration, combat and dialogue fixes with the open PRs. The regular PR workflow can report a successful browser aggregate without running the tests. Verify the repaired screens on the actual browser jobs when they execute.
