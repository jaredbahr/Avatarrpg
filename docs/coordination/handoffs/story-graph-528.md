# Generated story graphs (#528)

Codex owns `codex/story-graph-528`, based on main
`85ad186880063b707dbf46808349c35b340409b1`.
[Issue](https://github.com/jaredbahr/Avatarrpg/issues/528) and
[verified claim / latest checks](https://github.com/jaredbahr/Avatarrpg/issues/528#issuecomment-6737022948).
The draft PR records the exact delivered head, complete tree and final results.

`npm run docs:story` generates six Mermaid story-file diagrams and their index
under `docs/story/`. It reads effective runtime nodes and the six authoritative
source arrays, failing on duplicate, missing or ambiguous membership. The current
output covers 102 nodes, 119 authored edges, four fights, eight flag branches and
four choices. Fights show their encounter and expected level; entries and
cross-file exits are marked. Files over 80 owned nodes split deterministically
from entry points with explicit continuation links and complete coverage.

Labels preserve real condition descriptions, flag values, standing changes,
resident profiles, phase and XP effects. Long option text truncates separately
from full gate/mutation metadata. Battle victory and defeat paths, optional
ending continuations and cycles remain present. Party voice dialogue variants
are presentation alternatives, not extra edges.

The diagrams distinguish authored legacy/XP-audit `explore.next` links from live
connected-map travel. Effective map NPC/trigger references mark possible entries
without inventing edges or bypassing visibility, route-order or resident gates.
These are story-transition graphs, not a complete physical-world travel map.
No story content, runtime, core, renderer, art or dependencies change.

Both local and hosted verify gain the same `docs:story -- --check` freshness gate.
No triggers, permissions, deployment/security rules, existing tests or budgets
change. The README links the index. Check mode reports stale/missing files and
performs no writes.

Initial checks pass: 15 focused tests, typecheck, a byte-identical second
generation and read-only freshness check. Independent source/output review
found 102 unique owned declarations, 119 edges and no undefined diagram targets.
Tests include 161-node cyclic splitting, separate entries, order-independent
bytes, escaping and stale/missing-output negative controls. These checks precede
final metadata; exact clean-head `npm run ci:local` remains required before push.

**Open acceptance gate:** GitHub Mermaid rendering/readability has not been
observed. No browser/CUA control is exposed in this session and no Mermaid
renderer is installed. No software, CDN renderer or alternate executor was used.
Static syntax review and freshness tests do not establish GitHub SVG rendering.
A small diagram can be included in the draft PR for visual review; keep #528
unaccepted and the PR in DRAFT until its required preview has been checked.
Long effect labels, especially the victory resident-profile edge, need that
visual judgment. Do not claim they render merely because generation passed.

Source snapshots, test logs, receipts and generated-file hashes are retained
outside Git at `/workspace/avatarrpg-env/story-graph528/`. Current results and
remaining gates belong in the linked claim/PR. No merge, deployment, dispatch,
installation, credential/permission change or DeepSeek request is included.
