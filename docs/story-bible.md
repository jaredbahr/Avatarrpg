# Story bible: canon index and reconciliation

**Status: draft for the owner's review.** This page does not hold the canon itself. It points to it, records
the owner's decisions, maps the shipped demo onto the canon's IDs, lists every place where the two disagree as a
work list, and collects every gap filled here under [Proposed — awaiting owner](#proposed--awaiting-owner). It
changes only with the owner's yes.

## Order of authority

1. **The owner's direct instructions**, including the decisions recorded below.
2. **The story bible**, [`docs/story/the-common-current-bible.md`](story/the-common-current-bible.md)
   (narrative revision 1.2; the file still says "v1.0" in its original filename). Its Part 01 owns the era and
   the canon contract; Part 07 owns dialogue and humour; Part 09 owns the fact ledger and state vocabulary.
3. **The living-world companion**, [`docs/story/living-world-expansion.md`](story/living-world-expansion.md)
   ("A World Worth Wandering", companion draft 1.2), as it scopes itself: it inherits Parts 01 and 07 and adds
   people, animals and follow-up stories without overriding the bible.
4. **The shipped demo**, as implementation. Where it differs from 2 or 3, the demo is what changes
   ([Demo vs canon](#demo-vs-canon)). A line of code or an old prompt is never a canon source (bible, "Authority
   and scope").

**Superseded:** the living-world guide `Avatar-RPG-Living-Tidemark-Reach.md` and its handoff
`Avatar-RPG-World-Expansion-Agent-Handoff.md`, which ADR 0047 and some code comments cite. They were never in the
repo; the two documents above replace them (owner, 2026-11-14). Anything that came only from them is listed in
row C-26.

Both canon documents are committed verbatim as the owner supplied them and are excluded from Prettier so their
text never drifts. Do not edit them in place; record a change here and in the owner's next revision.

Read with:

- **Voice:** [writing-guide.md](writing-guide.md), which follows bible Part 07.
- **Staging:** [story-cutscenes.md](story-cutscenes.md).
- **State:** the flag registry, `src/content/story/flags.ts` (PR #736, on `main`).
- **Graph:** the generated diagrams in [docs/story/](story/README.md) (`npm run docs:story`). The two canon files
  share that folder but are not generated; the generator writes only its own files.

## Owner decisions (2026-11-14)

### Canon and scope

- **The uploaded docs are canon.** Where they differ from the shipped demo, the uploaded docs win.
- **Title: TBD.** "The Common Current" is a working title only. The game is Four Nations Tactics.
- **The demo is Act I**: MQ-01, The Quarry of Ba Dan (bible Part 04, "Act I — Stone").
- **The next region is RG-02, Saltstep and Emberwatch (MQ-02).** Its story is placeholder until it is drafted
  through the story workflow below.
- **After a Driller loss with "Carry on", the saga continues** from that state (the quarry still occupied, the
  five still held). This answers ADR 0047's open question and matches the bible: MQ-02 has independent evidence
  after a loss and MQ-11 frees the quarry.
- **The living-world guide and its handoff are superseded** by the two in-repo documents (question 13).

### Bringing the demo into line

- **Fix the demo now, before Emberwatch.** The [Demo vs canon](#demo-vs-canon) table is the work list; each row
  has an ID and a suggested PR group. Game content does not change in this PR.
- **Name clashes:** rename the demo's placeholders that the canon gives to someone else (the bench foreman
  "Hesh", the tea keeper "Sen", the road keeper "Dema"). The canon's characters keep their names. A check of every
  demo name against both canon documents found no other clash. Proposed replacements are in the proposed list.
- **Hanru** joins canon as Ba Dan supporting cast, NPC-25 (entry below, proposed).
- **Keep the Republic City maker's plate** on the Driller (question 14). Era references are allowed.
- **Community trust replaces nation standing** (question 10): trust held by specific communities (Ba Dan,
  Saltstep, the quarry workers, Commonworks and so on). Story lines read it; it never locks the main plot.
  `standing.nonbender` goes away. The engine, save and registry work is row C-25.

### Canon names

- **Era references only.** In-game text may mention Republic City or Korra's era as history. No canon character
  ever appears or speaks. Art prompts may cite the animated Avatar style. The `README.md` fan disclaimer stays.
  (The owner updates `CLAUDE.md`'s non-negotiable #4 in a separate PR.)

### How the next work runs

- **Trial scope: two tracks.** Track 1 does Ba Dan's side stories SQ-01 to SQ-03, plus MQ-02's shipping hook and
  one return visit (the bible's "first playable story slice"). Track 2 builds Saltstep and Emberwatch (MQ-02) as
  the pipeline-proof region (`docs/pipeline-proof-plan.md`, section 6).
- **Story workflow:** Claude drafts each mission's scenes and dialogue from the bible as a draft PR with a short,
  readable summary. The owner approves or redirects; then it merges.
- **Small gaps:** fill them here as **proposed** entries for the owner to approve with the rest, all collected
  in [Proposed — awaiting owner](#proposed--awaiting-owner).

## Fan-work rule

Non-commercial fan work; keep the `README.md` disclaimer intact. **Original characters only:** no canon character
ever appears or speaks, and there are no cameos, secret relatives of canon heroes or borrowed plot solutions
(owner, 2026-11-14; bible 01 §2). Canon places, nations, cultures, species and history are era references and may
be named accurately, in game text too: Republic City, the United Republic, the Water Tribes, the Fire Nation, the
Earth Kingdom, the Air Nation, Korra's era as history (01 §2, "The wider world stays present"). Art prompts may
cite the animated Avatar style; they still name no canon character. The canon documents name canon works and
figures only in this sense.

Originality is a required review (01 §3): summarise any new major story without Avatar terms; if it is still a
recognisable Avatar arc with new names, redesign it.

## Where things live in canon

| What                                        | IDs                                                                   | Bible section         |
| ------------------------------------------- | --------------------------------------------------------------------- | --------------------- |
| Era, canon contract, themes, powers, tone   | —                                                                     | Part 01               |
| Regions of the Tidemark Reach               | RG-01 to RG-07                                                        | Part 02               |
| Heroes                                      | CH-01 to CH-10                                                        | Part 03               |
| Supporting cast                             | NPC-01 to NPC-20 (companion NPC-21 to NPC-24; NPC-25 Hanru, proposed) | Part 03; companion §4 |
| Antagonists                                 | AN-01 Veyra Sen, AN-02 Olan Rusk, AN-03 Still Keeper                  | Part 03               |
| Main missions, endings, reveal ladder       | MQ-01 to MQ-15; E-01 to E-03                                          | Part 04               |
| Personal quests and teachers                | PQ-01 to PQ-10; TR-01 to TR-05                                        | Part 05               |
| Side missions                               | SQ-01 to SQ-30 (companion SQ-31 to SQ-34; SQ-35 retired)              | Part 06; companion §6 |
| Dialogue scenes                             | DLG-01 to DLG-12 (companion DLG-13 to DLG-16)                         | Part 07; companion §9 |
| World discoveries                           | EV-01 to EV-18                                                        | Part 08               |
| Fact ledger, state vocabulary, route checks | —                                                                     | Part 09               |

### The saga at a glance

| Act           | Missions                                                                             | Regions          |
| ------------- | ------------------------------------------------------------------------------------ | ---------------- |
| I: Stone      | MQ-01 The Quarry of Ba Dan (**the demo**)                                            | RG-01            |
| II: Sparks    | MQ-02 Paper and Stone (**next**), MQ-03 Lamps Across the Bay, MQ-04, MQ-05           | RG-02, RG-03     |
| III: Currents | MQ-06 to MQ-08 (three spokes, any order), MQ-09                                      | RG-04 to RG-06   |
| IV: Weight    | MQ-10, MQ-11 Back to the Stone (Ba Dan; frees the quarry after an Act I loss), MQ-12 | RG-03, RG-01     |
| V: Balance    | MQ-13, MQ-14, MQ-15; endings E-01, E-02, E-03                                        | RG-07 and return |

The region manifest's `ba_dan_valley` (`src/content/regions/baDanValley/`) is RG-01, "Ba Dan and Stoneback
Quarry".

## World

As canon sets it (Parts 01 and 02), with the demo's usage noted.

- **Era:** after the Korra finale and before Seven Havens and its cataclysm. Exact year, Korra's circumstances
  and the cataclysm's date are reserved (01 §2; 09, "Intentionally reserved decisions").
- **Where:** the **Tidemark Reach**, an original coastal watershed in the outer Earth Kingdom provinces,
  administered by several provincial councils (02, "Geographic premise"). The demo says "the province"; that is
  compatible, since Ruon is a provincial guard and "the province stopped paying" (DLG-08).
- **Elements:** fire, water, earth, air; non-benders are people with real skills, and "nonbender is not a
  nation" (01 §9). The demo's fifth "element" is a game element for kits and disciplines, nothing more.
- **Technology:** Korra-era. Cities have electric light, radios, trams and workshops; rural places stay modest
  and trade with them (01 §9). Republic City is named and real; Tenzo and Wen come from it, and the Driller
  carries a Republic City maker's plate.
- **Powers:** elemental limits hold. "Sound Bending" is a legacy game label, not canon; remote chi-blocking is
  held for redesign (01 §9).
- **Community trust** (owner, 2026-11-14) replaces nation standing: each community the party deals with (Ba Dan,
  Saltstep, the quarry workers, Commonworks and others) remembers how it was treated. Story lines read it; it
  never locks the main plot. This matches canon's "perception by a constituency, not a virtue meter" (09). The
  demo still ships `standing.<element>`, moving earth and fire only (row C-25).
- **Ba Dan's day:** dawn to night with resident routines (ADR 0047). Demo addition; canon is silent.

## Places

| Demo place       | Map id             | Canon                                        | Demo beats                              |
| ---------------- | ------------------ | -------------------------------------------- | --------------------------------------- |
| Ba Dan           | `ba_dan_village`   | RG-01, Ba Dan; Mira's table (Part 08)        | Hub; the welcome home and ending        |
| The Riverside    | `ba_dan_riverside` | Not in canon (demo addition)                 | Optional rest, before and after         |
| The Forest Road  | `forest_road`      | RG-01 "forest road"                          | First fight (guided); duck discoveries  |
| The quarry gate  | `quarry_gate`      | RG-01 Stoneback Quarry, gate yard            | The parley; the gate fight; Ruon's fate |
| The Cutting      | `ambush_road`      | RG-01 "ambush cutting"                       | Jin's ambush (escort); the tea          |
| The quarry floor | `quarry_floor`     | RG-01 Stoneback Quarry, quarry bowl          | The Driller; the rescue                 |
| Across the bay   | (none)             | RG-02 Emberwatch, reopened as a staging post | End-card teaser only                    |

Canon adds RG-01 spaces the demo lacks: the workers' cookhouse and a hidden maintenance culvert (02, RG-01).
Ba Dan sits on the western uplands above a sheltered bay; Saltstep Harbour is southwest at the river mouth and
Emberwatch on the eastern headland (02, "Geographic premise").

## Characters

### The party (1–6 per table; any can be absent)

Elements, looks and jobs come from `characters.ts`; canon adds ages, histories and personal quests (Part 03).

| Hero    | Canon | Element   | Age | Background (from `characters.ts`)                                           | Humour source / avoid (`writing-guide.md`)                 | Demo moment                | Portrait          | Personal quest |
| ------- | ----- | --------- | --- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- | ----------------- | -------------- |
| Kaya    | CH-01 | fire      | 23  | Grew up in a former Fire Nation colony; volunteers before hearing the job   | Commits too soon, saves face / not reckless, not quippy    | `after_forest`             | `portrait.kaya`   | PQ-01          |
| Tenzo   | CH-02 | fire      | 29  | Learned at his grandmother's stove in Republic City; dockside cook          | Overprepares meals / not food jokes in every line          | `cutting_tea`, defeat road | `portrait.tenzo`  | PQ-02          |
| Nilak   | CH-03 | water     | 25  | Northern healer who left a house that turned away the paperless             | Gentle mischief, bad drawings / never a patient's pain     | `riverside_mira`           | `portrait.nilak`  | PQ-03          |
| Sura    | CH-04 | water     | 24  | Southern ice-fisher on cold-storage work; learning to ask about local water | Adjusts fishing stories / not smug                         | `discover_runoff_marker`   | `portrait.sura`   | PQ-04          |
| Bo      | CH-05 | earth     | 30  | Ran a quarry crew until the wages stopped; counts heads                     | Packs for every contingency / not "load-bearing" jokes     | `gate_kinship`             | `portrait.bo`     | PQ-05          |
| Lin Mei | CH-06 | earth     | 26  | Surveys unstable ground for villages that cannot build twice                | Loses composure at low-stakes games / not always correct   | `forest_dema`              | `portrait.linmei` | PQ-06          |
| Nima    | CH-07 | air       | 22  | Raised at a rebuilt Air Temple; fine at meditation, not the meeting after   | Works hard at an easier way / not mock proverbs            | `discover_duck_nest`       | `portrait.nima`   | PQ-07          |
| Jinu    | CH-08 | air       | 27  | Courier for the northern provinces; knows who is waiting for letters        | Distracted by a memory mid-directions / not random         | `dorin_directions`         | `portrait.jinu`   | PQ-08          |
| Riko    | CH-09 | nonbender | 24  | Escort contracts; chi-blocking learned above a laundry; keeps promises      | Hides love of bad stage mysteries / not constant sneering  | `escort_chosen`            | `portrait.riko`   | PQ-09          |
| Wen     | CH-10 | nonbender | 28  | Republic City airship mechanic; her gauntlet began as a cable tester        | Demos miss an ordinary constraint / never risky to friends | `quarry_assessment`        | `portrait.wen`    | PQ-10          |

Pronouns: Kaya, Sura, Lin Mei, Jinu, Riko and Wen she/her; Tenzo, Nilak, Bo and Nima he/him (09 ledger). The
suggested first party is Kaya, Sura and Bo. **Bo is not Bo-shan** (CH-05 naming lock). Lin Mei's id is
`lin_mei`; her art keys use `linmei` (09 ledger). A hero speaks only while in the party with HP above 0; every
essential scene has a party-neutral version (01 §8).

### Ba Dan

| Person                  | Canon             | Element (proposed) | Role and voice (demo)                                                                   | Canon adds                                                     | Portrait         |
| ----------------------- | ----------------- | ------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| Elder Mira              | NPC-01, seventies | non-bender         | Specific questions and arrangements; warmth in what she offers                          | Favoured old quarry families; can share authority              | `portrait.mira`  |
| Gao                     | NPC-02, fifties   | non-bender         | Fussy practical advice; short and direct when angry; turns his plant to the light       | Absorbs neighbours' debts (SQ-03); puzzle boxes (companion §4) | `portrait.gao`   |
| Pella                   | NPC-03, about 9   | non-bender         | Notices what adults leave out; takes small contests seriously; stays in Ba Dan          | Never joins combat; nicknames adults by one mistake            | `portrait.pella` |
| Dorin                   | NPC-04, late 20s  | non-bender         | Rehearses, wants things done properly; keeps a watch book                               | Miniature parade floats; Deputy the turtle duck (SQ-31)        | `portrait.dorin` |
| Hanru                   | NPC-25 (proposed) | non-bender         | Night watch; few words, practical, kind without saying so                               | — (see the entry below)                                        | `portrait.hanru` |
| Bo-shan                 | NPC-08, 19        | earthbender        | Pella's brother; took vegetables up before the messengers: **the fifth missing person** | Easy humour, terrible packing; comes home tired, not a prize   | placeholder      |
| Leto, Amri, Hesra, Senn | DLG-01            | non-benders        | Mira's **four messengers**, held in the galleries; home after victory                   | Names fixed by DLG-01; sketches proposed below                 | placeholder      |
| Pebble                  | Not in canon      | —                  | Otter-turtle on the riverbank                                                           | Species conflicts with canon fauna rules (C-18)                | —                |

Every element in that column is **proposed** (question 3). The sprite palettes in
`src/content/assets/manifest.ts` (Pella `air`, Dorin `earth`) are colour choices, not elements.

### NPC-25 — Hanru (proposed)

Drafted from the demo (`src/content/story/baDanDay.ts`, `hanru_watch` and the handover; `return.ts`
`dorin_home`; `docs/art/prompts/portraits/hanru.md`; ADR 0047 D7). The owner's 2026-11-14 message says "him";
the demo, ADR 0047's D7 (the owner's 2026-09-22 decision) and the shipped portrait use **they/them**, so this entry
keeps they/them until the owner confirms which.

| Field                        | Entry                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                         | Ba Dan's night watch. Takes the gate from Dorin at evening and hands it back at dawn; asleep at home from morning through afternoon                                                                                                                           |
| Pronouns, age, element       | They/them (to confirm); middle-aged, about 45, greying at the temples; non-bender, with a plain wooden spear                                                                                                                                                  |
| Motivation and contradiction | Wants everyone who is out after dark to find the way home, and keeps the east-road lamp lit for them. Guards Ba Dan's privacy as carefully as its gate, their own included: the fish prints stay inside the hut, though Dorin wanted them on the notice board |
| Voice                        | Few words, practical, kind without saying so. Handover reports in clipped facts ("Quiet night. Two lamps left on at Mira's, both on purpose."); asks where people are going only when they look lost                                                          |
| Relationships                | Dorin's opposite shift and quiet ally: leaves his sticking parade float as it is and says so. Counts the workers in on the night they return because someone had to stay on the post                                                                          |
| Arc and limits               | A steady presence, not a project. A later scene may let the fish prints out by Hanru's own choice; nobody exposes them. Never comic relief for being taciturn, never a combatant, and never the one who solves Dorin's problems for him                       |

### On the road and at the quarry

| Person                   | Canon                    | Demo role                                                             | Canon status and proposal                                          | Portrait         |
| ------------------------ | ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------- |
| Captain Ruon             | NPC-05, he/him, fifties  | Provincial guard, nineteen years; surrenders and owns what he allowed | Accountable; testifies (DLG-08). Earth Kingdom (proposed)          | `portrait.ruon`  |
| Jin                      | NPC-06, she/her, forties | Mercenary leader; holds a "provincial bounty" on Ruon                 | Commonworks contractor (C-03). Earth Kingdom, Saltstep (proposed)  | `portrait.jin`   |
| Grumbler                 | NPC-07, he/him, late 30s | Ruon's quartermaster; drives the mecha-driller                        | Non-bender; the Driller's earth is its machine (proposed)          | none (boss unit) |
| The Fire Nation deserter | Not named in canon       | Stands by the oil barrels; steps back from a firebender's bluff       | **Hotaro** (proposed); a specific person's fear, never a rule (09) | none             |
| "Dema", road keeper      | Placeholder              | Forest Road verge; runoff and turtle ducks                            | Rename to **Lanfen** (proposed; C-04)                              | `portrait.dema`  |
| "Sen", tea keeper        | Placeholder              | The Cutting's rest stop; a lanky man in his thirties                  | Rename to **Kuan** (proposed; C-05)                                | `portrait.sen`   |
| "Hesh"                   | Placeholder              | A name on the Cutting's bench carving, under the foreman's name       | Rename to **Dunmo** (proposed; C-06)                               | none             |

Identity locks (09 ledger; `src/content/identity.ts`): Bo is not Bo-shan; Senn the messenger, Sena (NPC-20) and
Veyra Sen are different people; Hesra is not Hesh; Miri (PQ-01, Kaya's childhood neighbour) is not Mira.

### Not yet met

Act I may not name or reveal these (reveal ladder, Part 04): Director Veyra Sen (AN-01), Marshal Olan Rusk
(AN-02), the Still Keeper (AN-03), Commonworks, the supply-control order and the Common Current network.

## Factions: people with reasons

- **The quarry crews.** Unpaid; some hold the gate with slings, some rob the Forest Road. Workers, not
  villains. Canon: made to fill off-ledger shipments (02, "Local history", one month ago).
- **The provincial guard (Ruon).** Let his quartermaster shut the gate and kept his post while people were
  locked in. Canon: he fed and protected his unpaid guards by imposing on other workers (NPC-05).
- **Grumbler.** Barred the galleries and sent crews into unsafe workings. Surrenders when the drill jams.
- **Jin's mercenaries.** Demo: paid by a provincial bounty. Canon: Jin holds the Commonworks procurement and
  security contract and wants Ruon for the leverage of his testimony and records (02; NPC-06; 09 ledger).
- **The sponsor.** Demo: unrevealed, "somebody paid to bring that machine a long way". Canon: Commonworks.
  Veyra signed a supply-control order three months ago; Rusk expanded it into confinement and wage seizures;
  Emberwatch is its staging post (02, "Local history"; AN-02). **Not revealed in Act I.** MQ-02 proves the supply
  link; MQ-03 shows Veyra's order and Rusk's harsher instruction.

## Act I as shipped (MQ-01)

Arc: a village's missing deliveries → the people behind them → a choice about one man → a rescue → home. Every
defeat but the last rejoins the story with a cost and the XP it would have paid. MQ-01's question: "What do you
owe a stranger once they surrender?"

| Beat                    | Nodes                                                    | What happens                                                                                                            | Branches and flags                                                                                         | Canon                        |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1. The empty road       | `act1_open`, `mira_intro`                                | No stone cart for a month; Mira's four messengers have not returned.                                                    | —                                                                                                          | DLG-01                       |
| 2. Ba Dan before        | `village_explore`                                        | Talk to Gao, Pella, Dorin; riverside optional. Pella names Bo-shan: five missing.                                       | `pella_asked`                                                                                              | SQ-01 entry; SQ-02, SQ-03    |
| 3. The Forest Road      | `road_depart`, `battle_forest_road`                      | Guided first fight against robbers at the bend.                                                                         | win, or `lost_forest_road` (robbed)                                                                        | MQ-01                        |
| 4. Quarry dust          | `after_forest`                                           | The robbers are quarry workers. Optional: Dema, the duck nest, the runoff marker.                                       | `world.ducks_seen`, `world.discovered.*`                                                                   | 09 (Kaya only when present)  |
| 5. The gate             | `gate_parley`                                            | Knock and fight; a firebender bluffs the deserter aside; or an earthbender talks Ruon into opening it.                  | `gate_fire_bluff`; `gate_talked_through` + `ruon_respects_you`; or `lost_quarry_gate`; standing earth/fire | MQ-01; C-07, C-08, C-09      |
| 6. Ruon surrenders      | `ruon_surrender`, `ruon_choice`                          | His account of the wages and the galleries. **Table vote: escort him home for trial, or trade him to Jin for the key.** | `ruon_spared` or `ruon_traded` (+ `ruon_paid`); standing earth ±2                                          | MQ-01; C-03, C-11            |
| 7a. Escort: the Cutting | `escort_chosen`, `battle_ambush`, `after_ambush`         | Jin's people come for Ruon; he fights beside the party. On a loss he carries them out.                                  | `lost_ambush` + `ruon_carried_you`                                                                         | 09; C-10                     |
| 7b. Trade               | `trade_payment`, `trade_chosen`                          | Jin pays and takes Ruon; her crew is in the quarry.                                                                     | `ruon_paid`                                                                                                | 01 §5                        |
| 8. The quarry floor     | `quarry_descent`, `quarry_assessment`, `battle_grumbler` | The Driller. Pella's tip puts Bo-shan's cabbage cart on the floor; on the trade road Jin's people hold the rim.         | `pella_asked`, `ruon_traded` change the fight                                                              | MQ-01; SQ-01                 |
| 9a. Victory             | `act1_victory`, `act1_epilogue`                          | Drill jams; Grumbler surrenders; galleries opened; messengers and Bo-shan freed; maker's-plate rubbing.                 | `act1_complete`; evening falls                                                                             | MQ-01; C-13, C-15            |
| 9b. Defeat              | `defeat_boss`, `act1_epilogue_lost`                      | Mira and Dorin fetch the party home; the quarry keeps running. **The demo ends here; the saga will continue.**          | `act1_lost`                                                                                                | MQ-01; C-01, C-02, C-16      |
| 10. The walk home       | `quarry_after_explore` … `forest_return_arrival`         | The workers walk west with the party; Sen and Dema react.                                                               | —                                                                                                          | Demo addition                |
| 11. Welcome home        | `welcome_home_mira`, `_gao`, `_dorin`                    | The village comes out. Each speaker pays off one thing: Pella's reunion, Ruon's custody, how the gate fell.             | reads `pella_asked`, `ruon_traded`, gate flags                                                             | DLG-07; C-14                 |
| 12. The end card        | `demo_complete`                                          | "Home to Ba Dan", the recap of the party's choices, the bay teaser, then free roam.                                     | recap reads choices and optional scenes                                                                    | MQ-01 closing beat           |
| 13. After               | `village_return_explore`                                 | Homecomings with Mira (rubbing), Pella, Gao (warm or cold), Dorin; riverside.                                           | `rubbing_given`                                                                                            | RG-01 return changes; DLG-03 |

Optional demo scenes canon does not mention: Gao's plant chair and the gate handover (Ba Dan day, `scene.*`
flags), Hanru's watch, the school notice, Pebble, the veranda tea, Dorin's drill (`riverside_*`). Track 1 of the
trial adds canon's first slice: SQ-01, SQ-02, SQ-03, MQ-02's shipping hook and one return visit (bible, "The
first playable story slice").

## Open threads, with canon's answers

| Thread                                                                                         | Set up in                             | State to read                            | Canon answer (do not reveal early)                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| Who paid to bring the driller?                                                                 | Maker's plate; Mira's province report | `act1_complete`, `rubbing_given`         | Commonworks under Veyra's supply-control order; proven in MQ-02, shown in MQ-03             |
| The lit outpost across the bay                                                                 | Both end cards' teaser                | (none)                                   | Emberwatch, reopened as a Commonworks staging warehouse and signal post (02); MQ-03         |
| Who stopped the wages?                                                                         | Ruon's surrender                      | `ruon_spared` / `ruon_traded`            | Rusk diverted wages into security expenses (AN-02)                                          |
| Ruon's fate                                                                                    | Ruon choice; Mira, Gao                | `ruon_spared`, `ruon_traded`             | Custody resolved in MQ-03; hearing in MQ-11 (DLG-08); Ruon modifier in the endings          |
| Ruon's debts to the party                                                                      | Gate kinship; Cutting loss            | `ruon_respects_you`, `ruon_carried_you`  | `ruon_carried_you` belongs in his account (DLG-08); `ruon_respects_you` proposed for DLG-08 |
| Coin taken for a person                                                                        | Trade payment                         | `ruon_paid`                              | Morally serious; later repair possible, never erasing it (01 §5; DLG-03)                    |
| Grumbler's fate                                                                                | Victory epilogue                      | `act1_complete`                          | Individual outcome in MQ-15; may help repairs under oversight (NPC-07)                      |
| The silted stream and turtle ducks                                                             | Dema, runoff marker, duck nest        | `world.ducks_seen`, `world.discovered.*` | Not in canon; nearest are SQ-04 (turtle ducks, drainage) and SQ-31                          |
| The quarry still running after a defeat; five still held                                       | Defeat ending                         | `act1_lost`                              | Alive under continued control; MQ-02 has independent evidence; MQ-11 frees them             |
| How communities regard the party                                                               | Gate approach, Ruon choice            | `standing.earth`, `standing.fire` (C-25) | Community trust, read by story lines, never a lock (owner; 09)                              |
| Rare discipline teachers                                                                       | Level-5 gate                          | `learned_*` (pending)                    | TR-01 to TR-05, all introduced in Act II before the first level-5 choice                    |
| Small promises (water skins, skipping game, puzzle box, watch book, fish prints, parade float) | Ba Dan scenes                         | `scene.*`, `act1_complete`               | Partly echoed: Dorin's floats and Gao's puzzle boxes (companion §4)                         |
| Dorin's drill finished                                                                         | Riverside                             | `riverside_drill`                        | Not in canon; payoff proposed in SQ-02                                                      |

## Demo vs canon

**This table is the work list for bringing the demo into line before Emberwatch** (owner, 2026-11-14). Checked
against `main` at `abdc0bc0`. The bible's own Part 09 table ("Existing Act I issues") was written against snapshot
`3c3dcfb`; the rows it raised that today's code already meets are listed after the table. **Nothing here changes
in this PR, and no issues are filed.** The suggested PR groups follow the table.

| #    | Topic                                         | The demo ships                                                                                                                                                                                                                                                                                                                                                | Canon or owner says                                                                                                                                                                                                                                          | Change the game needs                                                                                                                                                                                                                              | PR  |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| C-01 | A Driller loss ends the story                 | `act1_epilogue_lost` is an `end` node with no `next` (`src/content/story/act1.ts` L616–628); `act1_lost` "the act ends there" (registry, `flags.ts`)                                                                                                                                                                                                          | Defeat leads onward: occupation continues, the captives are alive, MQ-02 has independent evidence, MQ-11 frees the quarry (MQ-01; 09 route checks). Owner decision 2026-11-14                                                                                | Make "Carry on" after the Driller resumable into a defeat-state Ba Dan and on to MQ-02; keep the end card as a chapter break; run `progression.test.ts` over the new route                                                                         | D   |
| C-02 | How the party escapes the Driller             | `defeat_boss`: the party scrambles up beside the driller and Mira and Dorin fetch them with a handcart (`act1.ts` L594–604)                                                                                                                                                                                                                                   | "A storm drainage route gets the party out." Ba Dan is not punished (MQ-01)                                                                                                                                                                                  | Rewrite the escape through the storm drain; Mira and Dorin can still meet them on the road                                                                                                                                                         | D   |
| C-03 | Jin's motive and employer                     | Ruon: "Jin holds a provincial bounty on me" (`act1.ts` L435); "her bounty" (L476); Jin: "The province wants him alive" (L556)                                                                                                                                                                                                                                 | Jin took the Commonworks procurement and security contract three months ago (02, "Local history"); she wants Ruon for the leverage his testimony and records give (NPC-06; 09 ledger); Rusk pushes her to make witnesses vanish into private custody (AN-02) | Recast the bounty as Jin's client wanting Ruon's records, without naming Commonworks in Act I (proposed wording below)                                                                                                                             | C   |
| C-04 | "Dema", the road keeper                       | A road keeper (she) on the Forest Road: `forest_dema`, `forest_dema_again` (`src/content/story/world.ts` L51–78), `dema_home` (`src/content/story/return.ts` L348–357), recap (`return.ts` L239), `maps/world.ts` L216, `partyVoices.ts` L46 and L98, `journal.ts` `ducks`, assets `npc.dema`/`portrait.dema`, `docs/art/prompts/portraits/dema.md`           | Dema is a he/him cook, 37, organising unpaid kitchen workers at Causeway's Six-Ladle Kitchen (PQ-02; companion §2). Owner: rename the demo's placeholder                                                                                                     | Rename the road keeper everywhere (lines, NpcDef, recap, journal, registry meanings, `identity.ts`'s `lw.npc.dema_roadkeeper`, portrait and sheet keys, prompt doc); proposed name Lanfen                                                          | A   |
| C-05 | "Sen", the tea keeper                         | The Cutting's rest-stop keeper: `cutting_tea`, `cutting_tea_again` (`world.ts` L80–107), `sen_home` (`return.ts` L360–369), objectives and recap (`return.ts` L60, L243), `maps/world.ts` L312 and L363, `partyVoices.ts` L11, `npc.sen`/`portrait.sen`, `docs/art/prompts/portraits/sen.md`                                                                  | "Sen" is the surname of Director Veyra Sen (AN-01) and her mother Meren Sen; a "Sen" in Act I hints at the antagonist before the reveal ladder allows. Owner: rename the demo's placeholder                                                                  | Rename the tea keeper everywhere, as for C-04; proposed name Kuan                                                                                                                                                                                  | A   |
| C-06 | "Hesh" on the bench                           | "Under the foreman's name: 'Wash your own cup, Hesh.'" (`src/content/story/discoveries.ts` L34); `identity.ts` excludes Hesh                                                                                                                                                                                                                                  | Hesh is NPC-11: 61, earth and metalbender, retired rail mechanic, the metalbending teacher (TR-03; SQ-32). Owner: rename the demo's placeholder                                                                                                              | Change the name in the carving; proposed name Dunmo                                                                                                                                                                                                | A   |
| C-07 | The earthbender talks the gate open           | Any earthbender unlocks the talk route (`gate_parley` option 3, `requires: { partyHas: earth }`, `act1.ts` L350–358); Ruon: "You know the galleries?" (`gate_kinship`, L370–382); registry: `ruon_respects_you` "as one stoneworker to another"                                                                                                               | Element alone is not a biography. Bo may claim his own crew experience; other parties earn it through workers, records or a prior conversation (09, "Existing Act I issues"; MQ-01)                                                                          | Gate the stonework talk on Bo, or on knowledge the party gathered, not on element; reword `ruon_respects_you`'s meaning. Bo's own voice there already fits (`partyVoices.ts` L36–42)                                                               | B   |
| C-08 | No neutral talk route at the gate             | Without a fire- or earthbender, the only way in is to fight (`gate_parley`, `act1.ts` L326–361)                                                                                                                                                                                                                                                               | "Add an earned neutral route based on pay records, shared labor knowledge, or a worker's introduction" (MQ-01)                                                                                                                                               | Add a party-neutral talk option, earned in play                                                                                                                                                                                                    | B   |
| C-09 | The fire bluff                                | "A Fire Nation deserter stands beside the oil barrels" (`act1.ts` L332); the comment calls it "trading on Fire Nation fear" and the option moves standing fire +1, earth −1 (L347–348)                                                                                                                                                                        | The bluff plays on one deserter's fear, with local consequences; never a rule about every firebender or Fire Nation person (MQ-01; 09)                                                                                                                       | Write the bluff to Hotaro's own fear (proposed name); its trust effect moves with C-25                                                                                                                                                             | B   |
| C-10 | The Cutting loss                              | `defeat_ambush` (`act1.ts` L488–499): Ruon pulls the party out; nothing is taken                                                                                                                                                                                                                                                                              | Jin's raiders seize **Ruon's dispatch satchel**, not Ruon; state it clearly. "Ruon gets you out through the scree, then goes back for anyone still trapped" (09, "Existing Act I issues"; route checks)                                                      | Add the satchel to the loss text; record it (a flag, or a meaning for `lost_ambush`)                                                                                                                                                               | C   |
| C-11 | The choice footer                             | `ruon_choice` footer: "Both routes reach the quarry floor." (`act1.ts` L465); `enc_grumbler` comment: "a choice the story explicitly says has no right answer" (`src/content/encounters.ts` L235)                                                                                                                                                             | "Both routes reach the quarry. Ruon will live with the choice." The branch "must not be described as morally indistinguishable" (09; MQ-01; 01 §5)                                                                                                           | Use canon's footer; fix the comment                                                                                                                                                                                                                | C   |
| C-12 | Gao after the trade                           | `gao_cold`: "Leave the water skins on the counter. We're done." (`act1.ts` L150–161)                                                                                                                                                                                                                                                                          | DLG-03: Gao is angry and still pushes a water skin over: "I am. Drink anyway." Consequence without permanent condemnation; he acknowledges a later repair                                                                                                    | Rewrite `gao_cold` from DLG-03                                                                                                                                                                                                                     | C   |
| C-13 | The five are named                            | `mira_intro` never names the messengers or shows the fifth bowl; Pella says "five" in a separate talk (`act1.ts` L62–74, L171–184); the rescue says "Mira's four messengers" (L647)                                                                                                                                                                           | DLG-01: at Mira's table Pella corrects "four" to "Five"; Mira names Leto, Amri, Hesra and Senn when asked; Bo-shan's covered bowl stays on the table. The victory accounts for all five by name (09)                                                         | Stage DLG-01 at Mira's table; name the five in the rescue                                                                                                                                                                                          | E   |
| C-14 | The reunion                                   | Told second-hand by Mira and Pella (`welcome_home_mira` variant and `pella_home`, `return.ts` L104–121, L264–298)                                                                                                                                                                                                                                             | DLG-07: Pella and Bo-shan meet at Mira's table ("You said Tuesday"); the covered bowl; it ends on sitting down. MQ-01 closes on Pella asking "Does he come home now?"                                                                                        | Play DLG-07 in the welcome home                                                                                                                                                                                                                    | E   |
| C-15 | The driller's evidence                        | A Republic City maker's plate and a rubbing for the province (`act1.ts` L116, L624, L648; `journal.ts` `maker_plate`; `rubbing_given`)                                                                                                                                                                                                                        | Keep the maker's plate (owner, 2026-11-14). Canon adds off-ledger cargo markings that make it "larger than an unpaid crew" (MQ-01 closing beat; 09); Wen recognises a familiar coupling (CH-10)                                                              | Add the off-ledger cargo markings beside the plate; give a present Wen the coupling                                                                                                                                                                | E   |
| C-16 | Defeat-state Ba Dan                           | None exists (follows from C-01)                                                                                                                                                                                                                                                                                                                               | After a loss Ba Dan is inhabited with crowded tables, people ask for a return date, and no success feast plays (RG-01 return changes; Part 08 tables); SQ-31's shelter waits (companion §6)                                                                  | Author the "occupied" return state for Ba Dan                                                                                                                                                                                                      | D   |
| C-17 | Healing discipline text                       | Flavour "The house took anyone who asked. She still does." (`src/content/disciplines.ts` L103); hint "Ask at the northern water tribes" (L105)                                                                                                                                                                                                                | A neutral line about the house, or Nilak's he/him (09); healing is taught at the Saltstep outreach room, no polar voyage (TR-02; MQ-05)                                                                                                                      | Rewrite both lines                                                                                                                                                                                                                                 | F   |
| C-18 | Pebble the otter-turtle                       | Riverside's Pebble, an "otter-turtle" (`riverside_pet`; `journal.ts` `pebble` L20; `riverside.ts` `riverside_dorin`)                                                                                                                                                                                                                                          | Use established Avatar species or ordinary wildlife; invented hybrids are retired (02, "Food, creatures"; companion §3)                                                                                                                                      | Make Pebble an ordinary river turtle (proposed), or confirm the species against an animated reference                                                                                                                                              | F   |
| C-19 | Lightning discipline hint                     | "Find someone willing to teach the separation. Very few are." (`disciplines.ts` L75)                                                                                                                                                                                                                                                                          | Lightning has visible Korra-era working uses; a training gate does not make it a forgotten art (01 §9). Luli teaches it at Emberwatch (TR-01)                                                                                                                | Rewrite the hint                                                                                                                                                                                                                                   | F   |
| C-20 | Sound Bending                                 | Path name, "a strike that goes straight through armour", hint "The temples do not teach it" (`disciplines.ts` L157–165)                                                                                                                                                                                                                                       | "Sound Bending" is a legacy label; no armour penetration, no universal temple ban; write it as air pressure and practical acoustics (01 §9; TR-04)                                                                                                           | Rename the path (proposed: Air Projection), rewrite its text, and review `shatterpoint`'s armour bypass with the balance report                                                                                                                    | F   |
| C-21 | Disruptor Array                               | Ranged 5×5 blast that may Chi-Block (`src/content/abilities/nonbender.ts` L211–228); flavour "No bending required. That was always the argument."                                                                                                                                                                                                             | Remote chi-blocking is an unresolved lore problem held for redesign; no universal suppression (01 §9). The flavour echoes the anti-bending movement canon steers away from (01 §3)                                                                           | Make the effect a shock that interrupts, not bending removal; replace the flavour; rerun the balance report                                                                                                                                        | F   |
| C-22 | Species spelling                              | "turtle-duck" (`world.ts`, `partyVoices.ts`, `journal.ts`, registry) and "ostrich-horse" (`act1.ts` L179)                                                                                                                                                                                                                                                     | "turtle duck", "ostrich horse" (02; companion §3)                                                                                                                                                                                                            | Respell in player-facing text                                                                                                                                                                                                                      | A   |
| C-23 | Cutscene notes                                | `docs/story-cutscenes.md` still lists "The distant wake (SQ-35)" as an optional world moment, and its Deputy exchange follows the companion's draft 1.0                                                                                                                                                                                                       | SQ-35 is retired; do not stage its wake (companion §6; 09 ledger). DLG-13 (revision 1.2) has Pella name Deputy and Dorin tell the duck to move its head                                                                                                      | Remove the SQ-35 entry; update the Deputy summary                                                                                                                                                                                                  | H   |
| C-24 | ADR 0047's open question                      | "Jared to decide whether, and in which slice, an Act I loss becomes resumable" (`docs/adr/0047-ba-dan-day.md`, "Open question for Jared")                                                                                                                                                                                                                     | Decided 2026-11-14: the saga continues                                                                                                                                                                                                                       | Record the answer in the ADR alongside C-01                                                                                                                                                                                                        | D   |
| C-25 | Nation standing → community trust             | `standing.<element>` flags (`src/core/story/conditions.ts` L16–75, `STANDING_PREFIX`); the `standing` condition (`src/content/schemas.ts` L189; `src/core/types.ts`; `src/core/story/storyEngine.ts`); option `adjust` (`schemas.ts` L870–909; `act1.ts` L348, L358, L454, L462); registry `standing.*` including `standing.nonbender`                        | Owner, 2026-11-14: community trust held by specific communities, read by story lines, never locking the main plot; `standing.nonbender` goes away. Canon: perception by a constituency (09); "nonbender is not a nation" (01 §9)                             | Replace the standing model with per-community trust in `src/core` (condition, adjust, keys), migrate saved `standing.*` flags in `src/core/save`, update the registry and the four act1 adjusts; needs an ADR. `CLAUDE.md`'s standing note follows | G   |
| C-26 | Code that came only from the superseded guide | `src/content/identity.ts`: `lw.npc.sen_tea` ("Sen (the tea keeper)") exists only because the guide named one, and the file's comments cite "guide §00.5"; comments in `src/content/residents/baDan.ts` (L17–29, L118) and `src/content/story/baDanDay.ts` (L5–6, "guide §04.2") cite guide sections; the Ba Dan day scene ids `LW-S-BD-01`/`-03` come from it | The guide and its handoff are superseded (owner, 2026-11-14); Hanru, also from it, is adopted as NPC-25 (proposed)                                                                                                                                           | Drop `lw.npc.sen_tea`; re-cite the comments to the canon or ADR 0047; keep the Ba Dan day scenes as demo additions unless the owner drops them                                                                                                     | A   |
| C-27 | Art prompts may name the style                | `src/content/prompts.test.ts` (L26–27, the word list at L103–119, the test at L190) and `docs/art-bible.md` L262 forbid any franchise name in prompt text                                                                                                                                                                                                     | Owner, 2026-11-14: art prompts may cite the animated Avatar style; still no canon characters (bible 09 "Existing Act I issues", art-prompt row)                                                                                                              | Allow style references ("the animated Avatar style") in prompts and the test; keep the character-name ban                                                                                                                                          | H   |

### Suggested PR groups

Each group is one PR, drafted under the story workflow where it changes story text. Suggested order: A, B, C, E,
D, F, G, H.

| Group | Rows                         | Title (suggested)                          | Notes                                                                                     |
| ----- | ---------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| A     | C-04, C-05, C-06, C-22, C-26 | Rename the demo's placeholder names        | Names approved first; touches lines, NpcDefs, assets keys, prompt docs and `identity.ts`  |
| B     | C-07, C-08, C-09             | Open the quarry gate to any party          | New earned talk route; `progression.test.ts` must still hold                              |
| C     | C-03, C-10, C-11, C-12       | Ruon and Jin as canon tells it             | Text only, plus a satchel flag registered first                                           |
| D     | C-01, C-02, C-16, C-24       | Carry on after the Driller                 | Story graph change and an occupied Ba Dan; needs ADR 0047's answer recorded               |
| E     | C-13, C-14, C-15             | Mira's table and the reunion               | Stages DLG-01 and DLG-07; overlaps Track 1's SQ-01                                        |
| F     | C-17 to C-21                 | Discipline and fauna lore                  | C-20 and C-21 change effects: balance report with `BALANCE_VARIANTS=1`                    |
| G     | C-25                         | Community trust replaces nation standing   | `src/core`, save migration and an ADR; the largest; can follow Emberwatch's start if need |
| H     | C-23, C-27                   | Docs and prompt rules for the canon policy | Docs and one test; independent of the owner's `CLAUDE.md` PR                              |

**Already fixed since the bible's snapshot** (its Part 09 rows that today's code meets): Bo-shan is the fifth
missing person, not one of the four (`pella_tips`); `after_forest` gives Kaya's line only when she is in the
party; "Forty years after the Avatar Korra" is gone; Nilak's bio says the house _promised_ to treat anyone; the
Cutting loss no longer says Jin got what she wanted or counts the party; the defeat card no longer claims nobody in
the province could build the machine; Pella no longer appears in a defeat line.

**Demo additions canon does not mention** (proposed to keep unless the owner says otherwise): the Riverside
(Pebble, the veranda, the shrine, Dorin's drill); the Ba Dan day scenes; the road keeper's and tea keeper's roles
(as distinct from their names); the turtle ducks in the road keeper's washing; the welcome home and end card.
Hanru is adopted (NPC-25).

**Canon names the demo does not use yet:** the Tidemark Reach, Stoneback Quarry, the cookhouse and the maintenance
culvert; the bowls set out for absent workers and the notice board (RG-01).

## State vocabulary vs the flag registry

Bible Part 09 ("State vocabulary for writers") is prose, not a save schema; it asks that engine flags be mapped
to it deliberately. Checked against `src/content/story/flags.ts` as merged to `main` by PR #736. The registry
is not changed here.

**Present in both.** All thirteen flags canon says must stay recognisable (`pella_asked`, `lost_forest_road`,
`gate_fire_bluff`, `gate_talked_through`, `ruon_respects_you`, `lost_quarry_gate`, `ruon_spared`,
`ruon_traded`, `ruon_paid`, `lost_ambush`, `ruon_carried_you`, `act1_lost`, `act1_complete`) and the five
teacher flags (`learned_lightning`, `learned_healing`, `learned_metalbending`, `learned_soundbending`,
`learned_engineering`).

**Canon or the owner names a state the registry lacks:**

- **Quarry result "freed later".** Canon's three values are freed in Act I, occupied after Act I, freed later
  (preserving the loss). The registry has only `act1_complete` and `act1_lost`.
- **Ruon's current custody** (supervised Ba Dan custody, Jin's custody, transferred for hearing, under public
  restrictions), kept separate from the original choice. The registry has only the choice.
- **Jin holds Ruon's dispatch satchel** after a Cutting loss (C-10). Nothing records it.
- **Community trust** per community (owner; C-25). The registry has nation standing instead.
- **Acts II–V outcomes**, none needed by the demo: inquiry approach (public or quiet; MQ-02), inspection
  mandate, the three regional proofs, exposure timing, crisis command, pre-crisis strategy, the four final
  practical conditions, the settlement (E-01 to E-03), and the Veyra, Ruon and community modifiers.
- **Optional quest outcome** (unseen, invited, underway, resolved with a named variant, declined, deferred) and
  **hero personal outcome** (unstarted, confronted, constructive, defensive, unresolved). The registry's
  `scene.*` strings and `world.discovered.*` booleans are a different, smaller shape.

**The registry has a state canon or the owner contradicts:**

- All five `standing.*` keys: replaced by community trust; `standing.nonbender` goes away (C-25).
- `act1_lost`: "the act ends there" (C-01). `ruon_respects_you`: "as one stoneworker to another" (C-07).
- `learned_soundbending`: "opens the Sound Bending path" (C-20).
- `world.ducks_seen` and `world.tea_shared` name Dema and Sen in their meanings (C-04, C-05).
- Demo-only families with no canon counterpart (no conflict): `rubbing_given`, `world.*`, `riverside_*`,
  `scene.*`, `guidance.*`.

## The questions from #735

Answered by the owner or canon:

1. **The earlier bible.** In the repo, canon, and it outranks the demo; title TBD.
2. **What comes next.** The demo is Act I (MQ-01). Next is RG-02 Saltstep and Emberwatch, MQ-02 "Paper and
   Stone"; the bay outpost is Emberwatch, MQ-03.
3. **The sponsor and the wages.** Commonworks, through Veyra's supply-control order; Rusk diverted the wages.
   Revealed in MQ-02 and MQ-03, never in Act I (02; AN-01; AN-02; reveal ladder).
4. **Names.** Rename the demo's "Dema", "Sen" and "Hesh"; canon's characters keep theirs. Replacements proposed.
5. **The province, the bay and the quarry.** The Tidemark Reach, under several provincial councils; Stoneback
   Quarry; the bay between Ba Dan, Saltstep Harbour and Emberwatch (02).
6. **Nation standing.** Replaced by community trust; `standing.nonbender` goes away (C-25).
7. **The defeat ending.** The saga continues (MQ-01, MQ-11).
8. **The third source.** The living-world guide and its handoff are superseded (C-26).
9. **The driller's maker.** Keep the Republic City maker's plate.
10. **Demo-only people and places.** Hanru is adopted as NPC-25 (proposed entry); the rest are proposed to keep.

Filled with proposals for the owner (see the list below): 3 (elements), 4 (Ruon's and Jin's nations, Jin's Act I
claim), 7 (the messengers), 9 (`ruon_respects_you`, `riverside_drill`), 11 (the deserter).

## Tone rules

Canon owns these (01 §7; Part 07; `writing-guide.md`); in short:

- Wonder leads. Humour comes from character, timing, practical inconvenience and affectionate disagreement.
  Serious scenes stay serious: no quip after a confession, surrender, testimony or defeat.
- Give a person an immediate want; let their approach make the comic turn. Give the joke an owner; make
  something happen; stop after the strongest beat.
- Most turns under 35 words; two to four turns a display. Read aloud. No objects with opinions or stock filler.
- Bandits and contractors are people with reasons. Choice text states consequences without calling options
  equal; NPCs may judge, the UI never moralises.
- Violence is stylised; surrender, rescue and withdrawal are normal. No gore, torture or child-death stakes.
  Defeat costs evidence, position or trust, never a child's life or hours of optional work (01 §8).

## Continuity checklist for a new region

1. **Canon first.** Read Part 01, the record of every speaker (Part 03), and the mission; extract the brief Part
   09 asks for ("Boundaries for future writers and agents", items 1 and 11).
2. **Story workflow:** draft the mission's scenes and dialogue as a draft PR with a short readable summary; the
   owner approves or redirects before it merges.
3. **Flags:** every flag the region reads is in the registry and can be set on every route into the region; every
   new flag is registered first, mapped to canon's state vocabulary.
4. **Branches:** handle `ruon_spared` and `ruon_traded`, both Act I results (victory and `act1_lost`, which
   continues), and each gate outcome if referenced (09, "Critical route checks").
5. **Speakers:** a hero speaks only if present with HP above 0; every essential scene has a neutral version; NPCs
   know only what they could have seen. Pella stays in Ba Dan. Honour the identity locks above.
6. **Reveals:** follow the reveal ladder (Part 04). MQ-02 may prove the Emberwatch supply link, not Veyra's
   knowledge.
7. **Optional content** never assumes another optional scene was heard, and a callback needs an actual
   resolution (09).
8. **Levels:** run `progression.test.ts`; every defeat that rejoins pays its fight's XP.
9. **Fan-work and originality:** original names only, checked against the party, the cast, canon's NPC list,
   `identity.ts` and canon Avatar names; run the originality summary test (01 §3).
10. **Gates** go through `Condition`, never a bare flag. Community trust is read by lines, never a main-plot lock.

## Proposed — awaiting owner

Every gap this page fills. Nothing here is canon until the owner approves it; approve, change or drop each one.

**Names** (original, Earth Kingdom province in feel, checked against both canon documents, the demo cast and the
canon Avatar names this page could think of):

1. **Lanfen** (she), the road keeper, replacing the demo's "Dema" (C-04).
2. **Kuan** (he, thirties), the tea keeper, replacing the demo's "Sen" (C-05).
3. **Dunmo**, the foreman's name on the Cutting bench, replacing "Hesh": "Wash your own cup, Dunmo." (C-06).
4. **Hotaro** (he, late twenties), the Fire Nation deserter at the quarry gate: a former merchant-ship guard who
   left a bad contract and took the only paid work going. No link to Emberwatch, which canon says held no secret
   garrison (02).

**Hanru**

5. **NPC-25 Hanru**, the entry above: night watch, about 45, non-bender, voice and limits as drafted.
6. **Hanru's pronouns:** they/them, as the demo, ADR 0047 D7 and the shipped portrait have it; the 2026-11-14
   message said "him". Confirm which.

**Elements (question 3):**

7. **Mira:** non-bender.
8. **Gao:** non-bender.
9. **Pella:** non-bender.
10. **Dorin:** non-bender; his riverside "forms" are footwork drills.
11. **Hanru:** non-bender.
12. **Bo-shan:** earthbender, a minor one who hauls his own carts, which is where his boasts come from.
13. **Grumbler:** non-bender; the Driller's `earth` unit element stands for the machine.

**Nations and motives:**

14. **Ruon:** Earth Kingdom, from the Reach; nineteen years in the provincial guard.
15. **Jin:** Earth Kingdom, from the Saltstep waterfront; her contracting work runs out of the harbour, which
    makes her a natural thread into RG-02.
16. **Jin's Act I claim on Ruon** (C-03): she says her client wants Ruon and the papers he signed for, and pays
    for both. No "provincial bounty", and Commonworks is not named until MQ-02. Ruon: "Jin's client wants me, and
    what I signed for."

**People and threads:**

17. **The four messengers** (question 7): **Leto** (he, 30s), Ba Dan's cart driver, who knows every rut on the
    east road; **Amri** (she, 40s), the village's best walker, who carries Mira's letters and argues with her about
    them; **Hesra** (she, early 20s), an apprentice mason, eager and quick to volunteer; **Senn** (he, 50s), a
    retired quarry tallyman who still knows the old ledgers. All non-benders. Each comes home tired, with their own
    preferences (09).
18. **`ruon_respects_you`** (question 9): read in Ruon's account (DLG-08), where he credits the party's
    knowledge of the galleries.
19. **`riverside_drill`** (question 9): Dorin's finished drill pays off in SQ-02, when he corrects an evacuation
    instruction instead of repeating it.
20. **Pebble** (C-18): an ordinary river turtle, keeping his name and habits.
21. **Sound Bending's new name** (C-20): Air Projection, after TR-04's wording.
22. **The demo additions** canon does not mention (the Riverside, the Ba Dan day scenes, the welcome home and end
    card): keep them as RG-01 texture.
23. **Suggested PR groups and order** for the demo fixes: A, B, C, E, D, F, G, H (table above).
