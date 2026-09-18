# Village NPC idle illustrations

Four original full-body illustrations generated with OpenAI image generation on
2026-09-18, each referencing its approved `public/art/portraits/<name>.png`.
Exact generation prompts are in `npc-idle-prompts.json`. Mira retains her white
bun, shawl, pendant and staff; Gao his cap, beard, apron and merchant equipment;
Pella her child proportions, pigtails and cabbage; Dorin his green coat, keys and
spear. These are static idle sprites, using the existing square image contract.
No animation clips, timing, footprint or gameplay rules change.

Regenerate one transparent full-body image per prompt, save it under
`art/raw/npc.<archetype>/idle/0.png`, and pack with:

```sh
npx tsx scripts/art/npc.ts mira art/raw/npc.elder/idle/0.png
npx tsx scripts/art/npc.ts gao art/raw/npc.shopkeeper/idle/0.png
npx tsx scripts/art/npc.ts pella art/raw/npc.kid/idle/0.png
npx tsx scripts/art/npc.ts dorin art/raw/npc.dorin/idle/0.png
```

Packing preserves source alpha and aspect ratio, trims transparent margins and
places feet at the existing 85% baseline in a 256-square image. Adults occupy
at most 80% of a tile's height; Pella occupies 58%. Original villager painters
remain the loading and failed-image fallback on both renderers.

## Scope and remaining sharing

Mira/Dema still share `npc.elder` and `portrait.mira`; Gao/Sen still share
`npc.shopkeeper` and `portrait.gao`. This preserves the current shared archetypes,
not a claim that those separately named characters have distinct approved art.
The riverside invitation uses Pella's sprite because Pella speaks its dialogue.
Only named village guard Dorin uses `npc.dorin`; generic road/gate guards retain
`npc.guard`. The separate optional living-riverside actor system retains its
procedural Mira/Dorin motion and is outside this static map batch.

Output terms checked 2026-09-18:
<https://openai.com/policies/row-terms-of-use/>. No exclusive copyright in
generated output is claimed. Credits cover `art/npcs` through `src/content/credits.ts`.
