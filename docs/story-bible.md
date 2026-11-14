# Story bible

**Status: draft for the owner's review.** Built only from what the game ships today (the demo, Ba Dan to the
quarry and home). Nothing here is new lore; where the repo is silent, the gap is listed under
[Open questions](#open-questions-for-the-owner). Once approved, this page is canon and changes only with the
owner's yes (`docs/pipeline-proof-plan.md`, "Story workflow").

Read with:

- **State:** the [flag registry](../src/content/story/flags.ts): every flag, what sets it, what reads it.
  `flags.test.ts` fails if content and registry disagree.
- **Graph:** the generated diagrams in [docs/story/](story/README.md) (`npm run docs:story`).
- **Voice:** [writing-guide.md](writing-guide.md). **Staging:** [story-cutscenes.md](story-cutscenes.md).

## Fan-work rule

Non-commercial fan work. **Original characters only: no canon character names, cameos or borrowed plot
solutions.** Canon places, nations and the era's technology may be used as setting (Republic City, the Earth
Kingdom, the Fire Nation, the Water Tribes, the Air Temples). Keep the `README.md` disclaimer intact. No new
bending powers, species or spirit superweapons (`story-cutscenes.md`, `writing-guide.md`).

## World

- **Era:** after Korra, before Seven Havens; the exact year is reserved (`writing-guide.md`).
- **Elements as used:** fire, water, earth, air, and **nonbender** as a fifth "element" with its own disciplines.
  Bending is ordinary work: cooking, fishing, surveying, hauling stone. Non-benders have real skills.
- **Technology:** Republic City machinery reaches the provinces (the mecha-driller, airships, an electrified
  gauntlet). Industry affects the people who work around it and the water downstream.
- **Order:** villages report to a **province**; the province keeps a guard (Ruon) and posts bounties.
  Mercenaries collect them.
- **Nation standing:** each nation remembers how the party treats it, from -5 hostile to 5 trusted
  (`standing.<element>` flags). The demo moves only earth and fire; nothing reads standing yet.

## Places

| Place            | Map id             | What it is                                                                                | Demo beats                              |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------- |
| Ba Dan           | `ba_dan_village`   | Earth Kingdom village of pale limestone below the quarry; canal, Gao's shop, Mira's house | Hub; the welcome home and ending        |
| The Riverside    | `ba_dan_riverside` | Ba Dan's river path: practice ground, bridge, shrine, veranda, Pebble's bank              | Optional rest, before and after         |
| The Forest Road  | `forest_road`      | The east road through rain-wet pines; Dema's verge; a silted stream                       | First fight (guided); duck discoveries  |
| The quarry gate  | `quarry_gate`      | Walled gate held by unpaid crews; oil barrels; the Fire Nation deserter                   | The parley; the gate fight; Ruon's fate |
| The Cutting      | `ambush_road`      | Narrow cut with ledges and a pool; the crews' rest stop with Sen's kettle                 | Jin's ambush (escort); the tea          |
| The quarry floor | `quarry_floor`     | Stone ledges down to barred galleries; the mecha-driller                                  | The Driller boss; the rescue            |
| Across the bay   | (none)             | A Fire Nation outpost closed nine years ago, lamps lit again, a supply boat at its jetty  | Ending teaser only                      |

Ba Dan's day runs dawn, morning, midday, afternoon, evening, night; residents keep routines (ADR 0047). The walk
home lands in the evening.

## Characters

### The party (playable, 1–6 per table; any can be absent)

| Hero    | Element   | Background (from `characters.ts`)                                           | Humour source / avoid (`writing-guide.md`)                 | Demo moment                | Portrait          |
| ------- | --------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- | ----------------- |
| Kaya    | fire      | Grew up in a former Fire Nation colony; volunteers before hearing the job   | Commits too soon, saves face / not reckless, not quippy    | `after_forest`             | `portrait.kaya`   |
| Tenzo   | fire      | Learned at his grandmother's stove in Republic City; dockside cook          | Overprepares meals / not food jokes in every line          | `cutting_tea`, defeat road | `portrait.tenzo`  |
| Nilak   | water     | Northern healer who left a house that turned away the paperless             | Gentle mischief, bad drawings / never a patient's pain     | `riverside_mira`           | `portrait.nilak`  |
| Sura    | water     | Southern ice-fisher on cold-storage work; learning to ask about local water | Adjusts fishing stories / not smug                         | `discover_runoff_marker`   | `portrait.sura`   |
| Bo      | earth     | Ran a quarry crew until the wages stopped; counts heads                     | Packs for every contingency / not "load-bearing" jokes     | `gate_kinship`             | `portrait.bo`     |
| Lin Mei | earth     | Surveys unstable ground for villages that cannot build twice                | Loses composure at low-stakes games / not always correct   | `forest_dema`              | `portrait.linmei` |
| Nima    | air       | Raised at a rebuilt Air Temple; fine at meditation, not the meeting after   | Works hard at an easier way / not mock proverbs            | `discover_duck_nest`       | `portrait.nima`   |
| Jinu    | air       | Courier for the northern provinces; knows who is waiting for letters        | Distracted by a memory mid-directions / not random         | `dorin_directions`         | `portrait.jinu`   |
| Riko    | nonbender | Escort contracts; chi-blocking learned above a laundry; keeps promises      | Hides love of bad stage mysteries / not constant sneering  | `escort_chosen`            | `portrait.riko`   |
| Wen     | nonbender | Republic City airship mechanic; her gauntlet began as a cable tester        | Demos miss an ordinary constraint / never risky to friends | `quarry_assessment`        | `portrait.wen`    |

The suggested first party is Kaya, Sura and Bo. **Bo is not Bo-shan.** Party voices are listed in
`writing-guide.md`; a line belongs to a hero only while that hero is in the party with HP above 0.

### Ba Dan

| Person                  | Role and voice                                                                                         | Relationships                                                | Portrait         |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------- |
| Elder Mira              | Village elder. Specific questions and arrangements; warmth in what she offers (rice, beds, washing)    | Sent the four messengers; writes the province report         | `portrait.mira`  |
| Gao                     | Shopkeeper. Fussy practical advice; short and direct when angry. Turns his plant to the light daily    | Lends water skins; will not forgive trading Ruon             | `portrait.gao`   |
| Pella                   | Child. Notices what adults leave out; takes small contests seriously. Stays in Ba Dan                  | Bo-shan's sister; under Mira's eye; skipping-stone rivalries | `portrait.pella` |
| Dorin                   | Gate guard. Rehearses, wants things done properly; keeps a watch book; practises footwork by the river | Went as far as the gate alone; hands the watch to Hanru      | `portrait.dorin` |
| Hanru                   | Night watch (they/them). Few words, practical, kind without saying so; keeps fish prints private       | Takes the watch from Dorin at evening, returns it at dawn    | `portrait.hanru` |
| Bo-shan                 | Pella's brother; took vegetables up before the messengers went: **the fifth missing person**           | Boasts (lifting an ostrich-horse, the driller)               | placeholder      |
| Leto, Amri, Hesra, Senn | Mira's **four messengers**, held in the galleries; home after victory                                  | No lines yet; placeholder art                                | placeholder      |
| Pebble                  | Otter-turtle on the riverbank; accepts a scratch, eyes your lunch                                      | Dorin cannot move him                                        | —                |

### On the road

| Person                   | Role and voice                                                                                                                                                   | Where                          | Portrait         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------- |
| Dema                     | Road keeper. Irritation grounded in what she deals with: runoff, her washing, turtle-ducks in it                                                                 | Forest Road verge              | `portrait.dema`  |
| Sen                      | Keeps the crews' rest stop and kettle for absent workers; offers company by finding a practical task                                                             | The Cutting                    | `portrait.sen`   |
| Captain Ruon             | Provincial guard, nineteen years. Military habits, uncomfortable specifics, some defensiveness. Lays down his sabre and owns what he allowed                     | Gate, Cutting, Ba Dan (escort) | `portrait.ruon`  |
| Jin                      | Mercenary leader (she). Brief and businesslike; the terms reveal her priorities. Holds Ruon's bounty                                                             | Gate (trade), quarry rim       | `portrait.jin`   |
| Grumbler                 | Ruon's quartermaster; the crews' nickname ("could find something wrong with a day off"). Shut the gate, locked people in the galleries, drives the mecha-driller | Quarry floor                   | none (boss unit) |
| The Fire Nation deserter | Unnamed; stands by the gate's oil barrels; can light the oil; steps back from a firebender's bluff                                                               | Quarry gate                    | none             |
| Hesh                     | Named only in a bench carving ("Wash your own cup, Hesh") under the foreman's name                                                                               | The Cutting                    | none             |

## Factions: people with reasons

- **The quarry crews.** Their pay stopped, then the guards' pay stopped. Holding the stone was meant to make
  somebody listen. Some hold the gate with slings; some rob the Forest Road with clubs. Stone dust on their
  cuffs and hammer calluses give them away. They are workers, not villains.
- **The provincial guard (Ruon).** Let his quartermaster shut the gate and kept his post while people were
  locked in. Surrenders, asks after the wounded, and will answer to the families. The table decides his fate.
- **Grumbler.** The quartermaster who escalated: barred the galleries and sent crews back into unsafe workings.
  Surrenders with his hands raised when the drill jams.
- **Jin's mercenaries.** Paid by the province's bounty on Ruon; "securing the equipment" in the quarry. On the
  trade road they wait at the boss; on the escort road they ambush the Cutting.
- **Whoever paid for the driller.** A Republic City maker's plate; "somebody paid to bring that machine a long
  way." Unrevealed (see open threads).

## The demo plot

Arc: a village's missing deliveries → the people behind them → a choice about one man → a rescue → home.
Every defeat but the last rejoins the story with a cost and the XP it would have paid.

| Beat                    | Nodes                                                    | What happens                                                                                                            | Branches and flags                                                                                         |
| ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. The empty road       | `act1_open`, `mira_intro`                                | No stone cart for a month; Mira's four messengers have not returned.                                                    | —                                                                                                          |
| 2. Ba Dan before        | `village_explore`                                        | Talk to Gao, Pella, Dorin; riverside optional. Pella names Bo-shan: five missing.                                       | `pella_asked`                                                                                              |
| 3. The Forest Road      | `road_depart`, `battle_forest_road`                      | Guided first fight against robbers at the bend.                                                                         | win, or `lost_forest_road` (robbed)                                                                        |
| 4. Quarry dust          | `after_forest`                                           | The robbers are quarry workers. Optional: Dema, the duck nest, the runoff marker.                                       | `world.ducks_seen`, `world.discovered.*`                                                                   |
| 5. The gate             | `gate_parley`                                            | Knock and fight; a firebender bluffs the deserter aside; or an earthbender talks Ruon into opening it.                  | `gate_fire_bluff`; `gate_talked_through` + `ruon_respects_you`; or `lost_quarry_gate`; standing earth/fire |
| 6. Ruon surrenders      | `ruon_surrender`, `ruon_choice`                          | His account of the wages and the galleries. **Table vote: escort him home for trial, or trade him to Jin for the key.** | `ruon_spared` or `ruon_traded` (+ `ruon_paid`); standing earth ±2                                          |
| 7a. Escort: the Cutting | `escort_chosen`, `battle_ambush`, `after_ambush`         | Jin's people come for Ruon; he fights beside the party. On a loss he carries them out.                                  | `lost_ambush` + `ruon_carried_you`                                                                         |
| 7b. Trade               | `trade_payment`, `trade_chosen`                          | Jin pays and takes Ruon; her crew is in the quarry.                                                                     | `ruon_paid`                                                                                                |
| 8. The quarry floor     | `quarry_descent`, `quarry_assessment`, `battle_grumbler` | The Driller. Pella's tip puts Bo-shan's cabbage cart on the floor; on the trade road Jin's people hold the rim.         | `pella_asked`, `ruon_traded` change the fight                                                              |
| 9a. Victory             | `act1_victory`, `act1_epilogue`                          | Drill jams; Grumbler surrenders; galleries opened; messengers and Bo-shan freed; maker's-plate rubbing.                 | `act1_complete`; evening falls                                                                             |
| 9b. Defeat              | `defeat_boss`, `act1_epilogue_lost`                      | Mira and Dorin fetch the party home; the quarry keeps running; carts bypass Ba Dan. **The act ends here.**              | `act1_lost`                                                                                                |
| 10. The walk home       | `quarry_after_explore` … `forest_return_arrival`         | The workers walk west with the party; Sen and Dema react.                                                               | —                                                                                                          |
| 11. Welcome home        | `welcome_home_mira`, `_gao`, `_dorin`                    | The village comes out. Each speaker pays off one thing: Pella's reunion, Ruon's custody, how the gate fell.             | reads `pella_asked`, `ruon_traded`, gate flags                                                             |
| 12. The end card        | `demo_complete`                                          | "Home to Ba Dan", the recap of the party's choices, the bay teaser, then free roam.                                     | recap reads choices and optional scenes                                                                    |
| 13. After               | `village_return_explore`                                 | Homecomings with Mira (rubbing), Pella, Gao (warm or cold), Dorin; riverside.                                           | `rubbing_given`                                                                                            |

Optional scenes that matter later: Gao's plant chair and the gate handover (Ba Dan day, `scene.*` flags), Hanru's
watch, the school notice, Pebble, the veranda tea, Dorin's drill (`riverside_*`).

## Open threads and setups for later regions

| Thread                                                                                                                                                                                                                     | Set up in                             | State to read                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| Who paid to bring a Republic City driller to a provincial quarry?                                                                                                                                                          | Maker's plate; Mira's province report | `act1_complete`, `rubbing_given`         |
| The Fire Nation outpost across the bay, closed nine years, lamps lit, supply boat                                                                                                                                          | Both end cards' teaser                | (none)                                   |
| Who stopped the crews' wages, then the guards'?                                                                                                                                                                            | Ruon's surrender                      | `ruon_spared` / `ruon_traded`            |
| Ruon's fate: Ba Dan's court (statement taken by Dorin) or delivered by Jin to the province                                                                                                                                 | Ruon choice; Mira, Gao                | `ruon_spared`, `ruon_traded`             |
| Ruon's debts to the party                                                                                                                                                                                                  | Gate kinship; Cutting loss            | `ruon_respects_you`, `ruon_carried_you`  |
| Coin taken for a person                                                                                                                                                                                                    | Trade payment                         | `ruon_paid`                              |
| Grumbler's fate after surrender                                                                                                                                                                                            | Victory epilogue                      | `act1_complete`                          |
| The silted stream and blocked settling pit; Dema's turtle-ducks; stakes marked, nobody digging                                                                                                                             | Dema, runoff marker, duck nest        | `world.ducks_seen`, `world.discovered.*` |
| The quarry still running after a defeat; five still held                                                                                                                                                                   | Defeat ending                         | `act1_lost`                              |
| Nation standing (earth, fire)                                                                                                                                                                                              | Gate approach, Ruon choice            | `standing.earth`, `standing.fire`        |
| Rare discipline teachers (lightning, healing, metal, sound, engineering)                                                                                                                                                   | Level-5 gate                          | `learned_*` (pending)                    |
| Small promises: Gao's water skins; Pella and Bo-shan's unfinished skipping game; Gao's puzzle box's third drawer; Dorin's watch book ("mecha-driller" with a dash?); Hanru's fish prints; the parade float's sticking roof | Ba Dan scenes                         | `scene.*`, `act1_complete`               |
| Dorin's drill finished; no payoff yet                                                                                                                                                                                      | Riverside                             | `riverside_drill`                        |

## Tone rules

- A warm adventure: humour and friendship, real stakes, nothing grim. Families and kids 7–12 play together.
- Bandits are people with reasons. Choice text states consequences; NPCs may judge, the UI never moralises.
- Situation first: give a person an immediate want; let their approach make the comic turn. Sincere moments
  (reunion, surrender, defeat, confession) stay sincere.
- Turns fit about 35 words. Read aloud; cut the extra comeback; no objects with opinions or filler tags.
- Kindness costs a little effort (washing a cup, waiting for a straggler). Machinery affects water and workers.
- Defeat text works whatever attacks happened; losing never makes a child cry and never strands the table.

## Continuity checklist for a new region

1. **Flags:** every flag the region reads is in the [registry](../src/content/story/flags.ts) and can be set on
   every route into the region; every new flag is registered first, with its meaning and arc.
2. **Branches:** handle both `ruon_spared` and `ruon_traded`, a victory and an `act1_lost` start if reachable,
   and each gate outcome if referenced.
3. **Speakers:** a hero speaks only if present with HP above 0; NPCs know only what they could have seen.
   Pella stays in Ba Dan. Bo is not Bo-shan; Senn the messenger, Sena and the guide's Sen are different
   people; the shipped road keeper and tea keeper are placeholders, not the guide's Dema the cook or Sen the
   tea keeper; Hesh is not Hesra; Miri is not Mira (`src/content/identity.ts`).
4. **Optional content** never assumes another optional scene was heard. Journal notes stay within what the
   player has learned.
5. **Reveals:** do not answer an open thread above without the owner's beat sheet.
6. **Levels:** run `progression.test.ts`; every defeat that rejoins pays its fight's XP.
7. **Fan-work:** original names only; check new names against the party, the cast and `identity.ts`.
8. **Gates** go through `Condition`, never a bare flag; standing through the `standing` condition.

## Open questions for the owner

1. **The earlier bible.** `story-cutscenes.md` and the writing guide cite "The Common Current" Story Bible
   v1.0 (17 September 2026) and the companion "A World Worth Wandering", which are not in the repo. Should
   this page absorb them? Where they differ from the shipped demo, which wins? Is "The Common Current" the
   saga's title?
2. **What comes next.** Is the bay outpost the next region (the cutscene notes name MQ-02 and "Emberwatch")?
   Is the demo "Act 1" of the saga, or its prologue?
3. **Bending in Ba Dan.** Mira, Gao, Pella, Dorin, Hanru, Bo-shan and the messengers have no stated element.
   Dorin practises "forms"; which element? Is Grumbler an earthbender, or is the Driller's earth its machine?
4. **Ruon and Jin.** Ruon's nation and what the province does with him on each road. Jin's nation, who she
   works for, and whether she returns.
5. **The sponsor and the wages.** Who paid for the driller and who stopped the pay, and when the saga reveals it.
6. **Names.** The road keeper ("Dema") and tea keeper ("Sen") wear placeholder names that the living-world
   guide gives to other people (Dema the cook, Sen the tea keeper; Senn is a messenger). Keep or rename?
   Who is Hesh, the foreman on the bench?
7. **The four messengers and Bo-shan.** Personalities, ages, jobs and voices (all have placeholder art and no
   lines). How old are Pella and Bo-shan?
8. **The province and the bay.** Do Ba Dan's province, the bay and the quarry have names?
9. **Unread memories.** `lost_ambush`, `ruon_carried_you`, `ruon_respects_you`, `ruon_paid` and
   `riverside_drill` are saved but never mentioned. Should the welcome home or a later region pay them off?
10. **Nation standing.** Should later regions gate on standing, and how should water, air and non-benders'
    standing move? Is "nonbender" a nation for standing purposes?
11. **The deserter.** Named? Does the Fire Nation deserter connect to the bay outpost?
12. **The defeat ending.** After `act1_lost` the demo ends with the five still held. Does the saga continue
    from that state, or is it a stopping point only?
