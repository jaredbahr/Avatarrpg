<!-- Reading edition, narrative revision 1.2. Canon and dialogue reviews applied here; full modular and runtime integration remains pending. -->

<a id="overview"></a>

# Four Nations Tactics: The Common Current

## Narrative source of truth — version 1.2

**Created:** 17 September 2026. **Canon review:** 17 September 2026. **Dialogue review:** 18 September 2026. **Audience:** the owner, writers, quest designers, environment artists, and agents working on Avatarrpg. **Spoilers:** complete campaign and endings.

This is the authored narrative baseline for the next stage of Four Nations Tactics. It extends the existing cast and The Quarry of Ba Dan; it does not describe content already implemented. This revision strengthens character voices, replaces formulaic banter, and preserves the canon and art requirements of revision 1.1. Editing this document does not implement its scenes or animations. The opening and quarry dialogue pass is a separate repository change; the full campaign and modular integration remain pending. The filename is retained for existing references; this is revision 1.2.

### The promise

You help a stone village get its missing people home. Following the machinery that trapped them leads to a beautiful, imperfect valley where a public-works project is making everyday life better. Its director wants essential services to survive unreliable officials, absent specialists, and the daily friction between neighboring towns. She has also decided that nobody may refuse her plan.

The adventure is about finding a better answer than dependence or domination. Ride a temperamental mountain tram. Rescue an overqualified delivery animal. Eat at a market that floats away during arguments. Learn why a spirit keeps returning people's shoes. Fight through a storm inside a giant waterworks, then face the harder question: who gets to decide what happens tomorrow?

**Central dramatic question:** Can people share power without giving one person the right to choose everyone else's life?

**Emotional destination:** The heroes become people who make room for others to act. The final victory is a community capable of continuing without them.

### Read in this order

| Document | What it owns |
| --- | --- |
| [01 — Canon and themes](#part-01) | Authority, timeline, boundaries, tone, and thematic rules |
| [02 — World atlas](#part-02) | Geography, history, institutions, cultures, spirits, travel |
| [03 — Characters](#part-03) | Ten heroes, original supporting cast, antagonists, relationships |
| [04 — Main campaign](#part-04) | Fifteen main missions, reveals, branches, climax, endings |
| [05 — Personal stories and teachers](#part-05) | Ten personal quests and five discipline-teacher stories |
| [06 — Side missions](#part-06) | Thirty authored side missions with resolutions and callbacks |
| [07 — Dialogue](#part-07) | Voice rules, playable scenes, banter, reaction variants |
| [08 — Living world](#part-08) | Optional discoveries, repeat visits, festivals, environmental storytelling |
| [09 — Continuity and handoff](#part-09) | Truth ledger, state vocabulary, current-content conflicts, authoring workflow |

### Authority and scope

- **Existing:** a fact recovered from the repository. This records implementation, not proof of Avatar canon. Preserve character identity and branch history; resolve lore conflicts against the owner’s direction and verified source material.
- **Established here:** a new creative decision in this bible. Treat it as the default for future writing, not as official franchise canon or an implemented feature.
- **Branch-dependent:** true only after the named player choice or outcome.
- **Reserved:** intentionally undecided; do not fill the gap with a convenient invention.

The owner’s direct instructions outrank this bible. Within the owner’s requirement to stay in Avatar lore, verified animated-continuity facts constrain original additions. Part 01 owns the shared era and canon contract; other sections and the living-world companion inherit it. Technical ADRs govern implementation, not fictional history. A conflicting old prompt, generated image, or line of code is an integration issue, not a new canon source. See document 09 before adapting existing story text.

### Working scale

Five acts; fifteen main missions; ten personal quests; five teacher stories; thirty side missions; eighteen small world discoveries. Suggested scope is approximately 18–25 hours for a focused campaign and 30–40 with substantial optional exploration. These are writing targets, not measured playtime or a release commitment. Individual family sessions should reach a satisfying stop in 20–40 minutes, with breaks inside longer missions.

All ten existing heroes receive full narrative treatment. A playthrough uses the selected one-to-six-character party. Unselected heroes are not invisible extra party members and never speak from nowhere. The cast does not require one representative of every element.

### The first playable story slice

Keep the existing quarry adventure. Deepen Ba Dan with SQ-01, SQ-02, and SQ-03; give each selected hero one introductory exchange; add MQ-02's shipping evidence and one return visit. This creates a complete emotional loop before the world expands. The full campaign remains the source for foreshadowing even when only that slice is being built.

### Version record

| Version | Change |
| --- | --- |
| 1.2 | Applies the owner's request for better humor: distinct sources of comedy, fewer interchangeable retorts, physical and situational scene beats, a rewritten travel-banter set, and revised dialogue samples. Canon, quest IDs, prerequisites, and campaign outcomes are retained. |
| 1.1 | Applies the owner’s post-Korra / pre-Seven Havens setting; retires the unsupported fixed date; anchors the four nations, United Republic, spirits, technology, and visual references; replaces provisional fauna with established species or ordinary background wildlife; flags unsupported power claims for implementation review. Reading edition corrected; repository and modular integration pending. |
| 1.0 | Original campaign expansion grounded in repository snapshot `3c3dcfbad652b49185232f0a0ab41b1f94f43967`; preserves the roster and Act 1 outcomes, establishes the Tidemark Reach and Commonworks conflict. |

**Owner's originality direction, incorporated in this version:** borrow Avatar's themes and emotional range; do not repeat, closely parallel, or rename its plots. The originality checks in document 01 apply to every future expansion.


---

<a id="part-01"></a>

# 01 — Canon, themes, and the narrative contract

## 1. What remains established

The project is Four Nations Tactics, a family-oriented, one-to-six-player tactical RPG in the Avatar animated continuity, after the events of The Legend of Korra and before Avatar: Seven Havens. Its ten playable characters are Kaya, Tenzo, Nilak, Sura, Bo, Lin Mei, Nima, Jinu, Riko, and Wen. None has met an Avatar. Their existing visual identities, elements, and core biographies remain intact.

The story begins in Ba Dan. A quarry has stopped supplying the village for one month. Elder Mira sent four people to investigate; they have not returned. Pella's brother Bo-shan was already missing after a produce delivery and is an additional missing person, not one of those four. Captain Ruon commands the gate, Jin wants him, and Grumbler operates an imported mecha-driller. The player can escort Ruon for trial or trade him to Jin. Winning or losing the quarry finale leads onward. Across the bay, a former Fire Nation outpost, decommissioned nine years earlier, has its lamps lit.

Those facts are the foundation, not disposable tutorial scenery.

## 2. Continuity boundary

**Project era:** after the animated Korra finale and before Seven Havens, while the familiar world of the four nations and Republic City remains the setting. For this campaign, that also means before the world-shattering cataclysm described in the official Seven Havens announcement. The placement is the owner’s design constraint; it is not an official date assigned to this fan project. The earlier “forty years after Korra” assumption is withdrawn. Exact calendar year, Korra’s current circumstances, and the date or cause of the later cataclysm remain reserved.

Use the animated Avatar shows and verified compatible comics for continuity. Do not mix in the live-action adaptations. Use official information about Seven Havens only where it is actually established; trailers, rumors, fan timelines, and a model’s recollection cannot silently become campaign history. No later catastrophe, next-Avatar reveal, or canon-character rescue is needed for this regional story.

There are no onstage canon characters or secret relatives of canon heroes in the current campaign plan. This does not prohibit accurate names for established places, cultures, historical people, or events. Say **Republic City** when Republic City is meant. Tenzo and Wen come from it; it is not merely an unnamed city across the sea. A historical achievement provides context without delivering a famous rescuer.

### The wider world stays present

| Setting anchor | Binding writing and art rule |
| --- | --- |
| Water Tribes | Keep Northern and Southern communities culturally and geographically distinct. Their residents have varied jobs, beliefs, and abilities. A polar journey requires an actual voyage and an appropriate environment. |
| Earth Kingdom territories | Tidemark is an original coastal region within this known cultural world. Korra-era political change matters; leave unresolved nationwide leadership and borders unspecified instead of assuming every province shares one current government. |
| Fire Nation | It remains part of the world, with civilian life, trade, and its own cultural identity. A local former military outpost does not imply a renewed Fire Nation invasion or inherited guilt. |
| Air Nation | Use the rebuilt Air Nation and the changes following Harmonic Convergence as the baseline. Airbenders, Air Acolytes, temple residents, and visitors are not interchangeable categories. Airbending does not automatically establish a person’s upbringing, vows, or mastery. |
| United Republic and Republic City | Republic City is the capital of the United Republic of Nations, not a replacement name for all four nations or for Causeway. Keep its mixed population, industrial life, cultural activity, and spirit presence recognizable. It exists in the world even before a playable city region is built. |
| Spirits and the Spirit World | The post-Korra relationship between humans and spirits is part of everyday setting history. Spirits can exist in the physical world; spiritual places are not automatically new portals. A local spirit route does not grant the party teleportation or free access to the Spirit World. |

These are setting anchors, not claims that all these destinations are already playable. A map’s limit is not the edge of the fictional world.

### Evidence and invention

Every consequential addition must be identified in its authoring brief as **canon-supported**, **compatible original fiction**, **gameplay abstraction**, or **unverified / held**. A new resident or village can be compatible original fiction without appearing in the shows. A new element, world government, species ability, or universal law of spirits needs stronger evidence; calling it original does not waive a conflict with canon. Held ideas cannot enter narration, prompts, or cutscenes as facts.

The primary era reference reviewed for this revision is Nickelodeon’s [Seven Havens announcement](https://www.prnewswire.com/news-releases/nickelodeon-announces-all-new-animated-series-avatar-seven-havens-set-in-the-world-of-avatar-the-last-airbender-302381232.html), which establishes the later cataclysmic setting and an Earth Avatar after Korra. It does not by itself fix our date. Korra’s [Book One](https://www.paramountplus.com/shows/the-legend-of-korra/episodes/1/) supplies the Republic City baseline; [Book Three](https://www.paramountplus.com/shows/the-legend-of-korra/episodes/3/) anchors the rebuilding Air Nation after Harmonic Convergence. Detailed powers and animal designs must be checked against the relevant episode or published reference before production.

The original Kaya and Jin are the project's existing characters, not canon characters with similar names. Do not change their identities to manufacture a connection. The existing non-commercial fan-work notice remains authoritative.

## 3. Inspiration, transformed into original drama

These are editorial readings of the source works, not claims that our new people, places, or mechanics are canon.

| Inspiration | What we take | What we make our own |
| --- | --- | --- |
| The Last Airbender's journeys and village-scale episodes | The pleasure of traveling with funny people; local needs that make a big world personal | A valley whose ferries, kitchens, festivals, and ridiculous animals become worth protecting |
| The Last Airbender's treatment of inherited duty | Power brings obligations, but children do not inherit guilt for their ancestors | Kaya's mixed-home identity and Ruon's personal accountability, without hereditary blame |
| The Rift | A way to ask difficult questions about tradition, industry, and spiritual relationships | A functioning water-and-power network whose design erases migration routes and local knowledge |
| Imbalance | Equality tested in everyday life, not merely declared in a speech | Doors, wages, training, transport, and public services that exclude people without making an entire population villains |
| The Legend of Korra, Book One | A grievance can be real even when a leader's methods are wrong | Useful public reforms remain worth preserving after coercion is stopped; this campaign has no anti-bender movement |
| The Legend of Korra, Books Three and Four | Rebuilding communities, competing visions of order, and the work after a crisis | A regional political settlement involving workers, residents, and spirits, without repeating an empire's conquest |
| Turf Wars and Ruins of the Empire | Public consequences continue after the spectacular victory | A playable aftermath about displaced households, hearings, repairs, and power changing hands |

The publisher's authorized [Legend of Korra comics edition](https://www.webtoons.com/en/action/the-legend-of-korra/list?title_no=7823) provides an accessible source anchor for Turf Wars and Ruins of the Empire. Use the works themselves for detailed franchise continuity, not this thematic table. No existing dialogue is reproduced here.

### Originality is a required review, not an optional aspiration

The owner specifically wants thematic inspiration without repeating Avatar stories. The table above is a record of thematic questions, not a set of plot assignments. Do not map an act, a villain, or a hero to a franchise equivalent. A scene should survive removal of its franchise references because the new people's motives and local facts still make it work.

The distinctive foundation here is **maintenance, consent, and mutual dependence**: ordinary services become reliable by quietly removing the people and exceptions that make them hard to schedule. The investigation starts with a missing delivery and discovers a model that has edited out real lives. Victory means changing who can correct that model while preserving what people need. It is an original regional civic adventure with traveling friendships, physical danger, local absurdity, and negotiated relationships with bounded spirits.

| Similarity risk | Required distinction |
| --- | --- |
| A non-bender opponent could evoke an anti-bending movement | Veyra seeks dependable services across all backgrounds. She neither blames benders as a class nor wants powers removed. Her staff, supporters, and critics are mixed. Her non-bending identity is one biographical fact, not the conflict's organizing principle. |
| A forceful reformer could become another conquering unifier | No territorial conquest, imperial reunification, succession claim, or national throne. Veyra's authority comes from contracts and emergency permissions within one watershed. Workers and residents can withdraw that authority. |
| Industry and spirits could repeat a nature-versus-factory plot | The pumps genuinely reduce illness. The spirit's imposed repetition also creates harm. Residents need sanitation and living waterways together. Specific operating arrangements resolve a conflict of uses; defeating an angry nature guardian does not. |
| A large machine could become another final superweapon | The Stillwater Engine is civil infrastructure the party must make safe. It cannot fire spirit energy, conquer a city, or permanently suppress bending. Destroying its operator does not solve the engineering problem. |
| A traveling ensemble could become replacement Team Avatar | No chosen-one protagonist, four-element mastery journey, fixed comic-relief companion, or matching romance web. Ten optional adult heroes have working lives and different relationships. |
| An antagonist's loss could become a familiar revenge explanation | Veyra's mother survived the old flood. Her overreach developed through rewarded professional decisions and repeated institutional shortcuts, not a secret revenge mission or one tragedy that explains everything. |
| Familiar animals, cabbages, or aphorisms could become imitation | Preserve the existing Pella thread as a sibling story. Do not repeat iconic catchphrases, recreate famous scenes, or turn every joke into a reference. New humor comes from these people's jobs and flaws. |

Before adding a major story: summarize it without Avatar terminology. If the summary is still recognizably a specific existing Avatar arc with replacement names, redesign its motive, causal chain, and resolution. Cosmetic differences are insufficient. Broad shared themes are intentional; matching sequences, reveals, character functions, and set pieces are not.

## 4. Responsibility

Responsibility means noticing who lives with the result of your action, admitting your part, and doing repair that costs something. It is not the belief that the strongest person must do every job alone.

Show it through actions: returning after a rescue; asking a prisoner whether he is injured; putting a name beside a decision on a public plan; letting a capable apprentice try; paying a worker before announcing a monument. Ruon can do something courageous and still face trial. Veyra can save a district and still lose authority. The heroes can make a mistake and still make a difference.

Never convert one good deed into instant absolution. Never use a traumatic confession to require another character's forgiveness.

## 5. Equality

Equal worth does not mean identical abilities. A waterbender and a non-bender may solve a rescue differently; both must have meaningful agency. Discrimination appears in a crane with no manual control, an apprenticeship restricted to a prestigious family, or a clinic's registration rule. That makes it legible to younger players without reducing it to a lecture.

Non-benders include engineers, healers using ordinary medicine, organizers, artists, cowards, and brave people. Benders include laborers as well as elites. A poor bender is not secretly privileged in every situation; a wealthy non-bender is not powerless in every situation. Nationality, occupation, element, and personality are separate facts.

Justice does not require a perfectly symmetrical blame assignment. Trading a surrendered person into private custody is morally serious. We will show the pressure that made it tempting without claiming all options are equally kind. Later repair is possible but does not erase what happened.

## 6. Balance

Balance is the ongoing work of sharing a changing world. It is not equal quantities of kindness and cruelty, a midpoint between abuse and safety, or a machine that holds everyone still. Sometimes balance requires refusing an exploitative arrangement, restoring a damaged wetland, or giving up convenient power.

The spirits also have interests and limitations. A spirit may be insightful about seasons and disastrously ignorant about a family's need for a warm house. Human and spirit testimony can both be incomplete. Listening starts negotiation; it does not end it.

## 7. Tone and audience

Wonder leads. Humor comes from character, timing, practical inconveniences, and affectionate disagreement. Serious scenes concern missing people, unfair treatment, broken trust, coercion, injury, and loss of home. Violence is stylized, with surrender, rescue, and withdrawal as normal outcomes. No gore, sexual content, torture sequences, or child-death stakes.

Give a confession room to land. Do not put a quip in the next line after someone reveals a bereavement. Follow an intense mission with food, a view, a small success, or a safe conversation. The world is threatened because it is valuable; it should not already feel uniformly miserable.

Comedy can be broad: an elaborate boast undone by an ordinary task, an overcommitted performance, a harmless physical mishap, or a game taken much too seriously. Give the person a reason to persist and let the situation develop. Wen can discover that her improved stove handle is unreachable beneath Tenzo's actual cooking pot. Lin Mei can demand a rematch before her opponent has finished celebrating. Avoid routine cabbage-meme imitation. Pella's cart detail belongs to her relationship with Bo-shan. Part 07 defines the dialogue review standard.

## 8. Agency and cooperation

Selected heroes are protagonists, not disciples of the “real” hero. There is no mandatory leader, romance, or moral spokesperson. Rotate moments of initiative. Named-hero lines require that hero to be present; every essential scene also has a party-neutral version. Personality suggestions are not permission to choose on behalf of a player.

Every main mission has a route for any valid party. A specialist may create a distinctive, useful shortcut or reveal, but a missing element must not make the story impossible. Where a device needs operation, a recruited local can perform the specialist labor after the party secures access. That local does not become an unselected playable hero.

Defeat changes circumstances without making a family replay the same misery. It can cost evidence, position, convenience, or trust. It does not secretly kill a child or erase hours of optional work. State the consequences before an irreversible choice when the characters could reasonably know them.

## 9. Powers and technology

Preserve elemental limits. No ordinary person gains a second element. Chi-blocking and engineering disruption are temporary tactical limitations, not removal of identity or permanent bending. Ordinary medicine matters alongside water healing. Neither resurrects the dead or fixes every lasting condition.

**Air techniques:** write Oru’s lessons as controlled air pressure, breath, projection, and the practical acoustics of bells. “Sound Bending” is a legacy game label, not an established canonical subdiscipline or a new element. Do not derive internal-organ attacks, automatic armor penetration, mind control, private-conversation recovery, or omniscience from it. Existing `sound_bending`, `learned_soundbending`, and related ability IDs are implementation references only; revising their presentation or effects needs a deliberate code change.

**Engineering:** electrical incapacitation and mechanical tools fit the Korra-era baseline. The existing Disruptor Array’s ranged `chiBlocked` effect is a separate, unresolved lore problem. Limited range alone does not make remote chi removal canonical. Hold that fictional explanation for redesign; distinguish an electric shock that interrupts action from a device that removes bending. Neither the array nor the Current may become a universal suppression field.

**Combat abstraction:** levels, cooldowns, status durations, and team-wide healing effects are game rules. They do not establish that water healing cures every condition, that all metals are bendable, or that a teacher instantly grants mastery. Lightning and metalbending have visible Korra-era working uses; a local training gate does not make them forgotten arts known only to one family.

**Technology and visual era:** use the animated Avatar world directly as the reference, especially Korra for contemporary urban life. Urban streets can contain electric lighting, radios, telephones, trams, Satomobiles, industrial workshops, and steel-framed buildings where their local economy supports them. Rural places can remain modest and traditional while trading with those cities. A new district connection is not the invention of electricity. Avoid an unexplained leap to digital networks or a generic medieval setting.

Preserve the shows’ drawn character shapes, expressive faces, cel shading, culturally specific clothing and architecture, and rich environment composition. Name the animated Avatar references in art briefs when useful. Reference images must be labeled by work and scene; a style reference does not authorize importing that scene’s date, person, or geography. Use verified Seven Havens material only for compatible visual observations, not its later ruined-world setting. National identity is not a rigid clothing-color chart, and “nonbender” is not a nation.

The Common Current uses ordinary turbines, pumps, cables, steam plant, and mechanical controls. Its harm comes from where infrastructure is built, who controls it, and how it interferes with living routes. It is not powered by bottled souls. The finale never requires a new superpower or all four elements in the party.


---

<a id="part-02"></a>

# 02 — The Tidemark Reach

## Geographic premise

The Tidemark Reach is an original, modest-sized coastal watershed in the outer Earth Kingdom provinces. It is not an undiscovered fifth nation. Several provincial councils administer it; coastal trade has brought families from all four nations. Earth Kingdom names remain in ordinary speech even where current local government is elected or independently administered. The campaign does not settle the constitutional arrangement of every Earth territory.

Ba Dan lies on the western uplands above a sheltered bay. Saltstep Harbour sits southwest at the river mouth. Emberwatch occupies the opposite, eastern shore; its headland overlooks the narrow approach to the bay. Upriver, Causeway City stands where the inland roads and river meet. Copper Orchard occupies the mineral hills northwest of Causeway; Reedglass Marsh spreads to the northeast; Bellweather Heights rises north above both. Water and freight routes converge near Causeway's new Stillwater Works.

Republic City is a named trade and cultural connection: Saltstep handles manifests from its merchants, repair shops recognize its manufacturers, and Tenzo and Wen can remember different neighborhoods and working lives. A radio in a public café can carry a brief, locally relevant city item once that item’s date and facts are checked. Visiting people from the Water Tribes, Fire Nation, Earth territories, and Air Nation bring their own interests rather than serving as one-person summaries of an entire culture. These links do not relocate Republic City onto the bay or invent exact intercontinental travel times.

Typical travel is a few hours between neighboring destinations, a day from coast to Causeway, and another day to the heights. These are story distances, not real-time waiting requirements. The party can return to earlier places. A voyage to a polar homeland would be a separate adventure, not a quick walk north.

| Region ID | Place | Identity | Main access and return |
| --- | --- | --- | --- |
| RG-01 | Ba Dan and Stoneback Quarry | Warm stone, pine roads, family labor, damaged trust | Existing village and quarry roads; coastal wagon route opens into RG-02 |
| RG-02 | Saltstep and Emberwatch | Floating stalls, old military architecture reused by civilians | Shore road from Ba Dan; public ferry across bay; upstream road to RG-03 |
| RG-03 | Causeway City | Layered bridges, shared kitchens, bright new public works | The central hub; spokes to RG-04, RG-05, RG-06; works restricted until Act IV |
| RG-04 | Copper Orchard | Rust-red rail cuts, fruit trees, repair yards | Rail or maintenance footpath west of Causeway |
| RG-05 | Reedglass Marsh | Reed houses, moving water, luminous night insects | Ferry channels or raised walkways east of Causeway |
| RG-06 | Bellweather Heights | Wind terraces, rebuilt sanctuary, cable tram | Switchback trail or tram north of Causeway |
| RG-07 | Stillwater Works | A vast inhabited civil-engineering site | Connected to Causeway; final act opens its sealed lower galleries |

## Local history

All entries below are new project history. Dates are relative to the opening, avoiding unsupported franchise dates.

| When | Event and surviving evidence |
| --- | --- |
| More than sixty years ago | Ba Dan's quarry began sending cut stone down the east road. Old ledgers and the first cart axle survive. “Three generations” describes family labor, not exactly three workers. |
| Earlier era, exact date reserved | An intergovernmental coastal-security lease allowed a Fire Nation outpost at Emberwatch. It did not make the entire Reach Fire Nation territory. Local people retain conflicting feelings about its presence. |
| Nine years ago | Emberwatch was formally decommissioned after coastal duties moved elsewhere. The civilian ferry and lantern shrine remained. No secret army has occupied it continuously. |
| Seven years ago | The Blackreed Flood cut bridges and isolated several districts. In one place rescue crews waited for a specialist; in another, a council held equipment behind jurisdictional paperwork. Veyra helped evacuate residents, including her mother, who survived and later challenged her daughter's growing appetite for control. The damage had several causes, not an evil element. |
| Six years ago | Veyra founded Commonworks as a cross-district public-works cooperative. Her first manual-control pump gave a low-lying neighborhood clean water without hiring a bending crew for every shift. |
| Three years ago | Councils authorized the Common Current network: linked waterworks, public power, rail improvements, and flood defenses. Costs rose. Temporary emergency powers outlasted the emergency. |
| Eighteen months ago | Trials of pressure-control vanes began near spirit migration channels. Surveyors reported water behaving strangely. Some reports were dismissed as folklore, others delayed by poor recordkeeping. |
| Three months ago | Veyra signed a supply-control order permitting contractor supervision of “critical” quarries and stations. Rusk expanded that authority into confinement and wage seizures. Jin accepted the procurement and security contract. |
| One month ago | Ba Dan's stone deliveries stopped. Ruon's unpaid guards took control of the gate. Grumbler brought the driller into the lower galleries. Workers were made to fulfill off-ledger shipments. |
| Opening week | Commonworks prepares a public demonstration at Causeway. Reopened Emberwatch serves as a staging warehouse and signal post. A seasonal spring tide, known in advance, becomes the deadline for full network commissioning. |

The Blackreed Flood predates the vane trials by years. The new machine did not cause the event that motivated its invention. No time loop or retroactive mastermind reveal is allowed.

## RG-01 — Ba Dan

**First impression:** warm stone walls; laundry tied between a shrine and the guard hut; a square that sounds wrong without cart wheels. Someone has set bowls out for workers who may still come home.

Mira's public table is under a patched awning. It is where requests are heard, food is shared, and people argue over whose bucket belongs to whom. It is not a throne. Gao's shop has a drawer of debt slips which he keeps mostly to remember whom to check on. Dorin practices firm greetings beside a gate almost everyone walks around.

Stoneback Quarry has upper cutting terraces, a gate yard, and lower galleries. Its stone is valued for ordinary durability, not a mystical property. Old drainage culverts were mapped by generations of workers. Grumbler's new machine cuts faster but makes some of those galleries unsafe.

**Social fault:** families with old quarry shares have a louder voice than hired workers and newcomers. Mira is admired and has also allowed this imbalance to persist.

**Play spaces:** village square; forest road; ambush cutting; quarry gate; quarry bowl; workers' cookhouse; hidden maintenance culvert. Existing five map identities stay intact. Added spaces are concepts until authored.

**Return changes:** workers' boots appear outside occupied houses after rescue. Under continued occupation, the same houses stay inhabited but their tables are crowded. Later self-government shows up first as a notice board written in more than one hand.

## RG-02 — Saltstep and Emberwatch

Saltstep is a market built around tidal platforms. Bargainers tend to move their boats mid-argument, forcing people to decide whether a discount is worth paddling after. Poles show the water level in bright paint. Every child knows the emergency bell pattern; several adults insist on arguing about it.

Fishers, dock workers, and recently arrived families share the shore without automatically sharing influence. Waterbenders are sought after for heavy channel work; non-bender pilots know currents and routes just as well. Both resent company schedules that ignore weather. The floating market's busy practicality contrasts with Emberwatch's empty parade ground.

Emberwatch has barracks converted into storage, an old signal tower, a rain cistern, and a parade-ground vegetable garden. Volunteers have painted over command slogans with planting dates. Its lamps now signal Commonworks shipments. Some crates contain genuinely helpful pumps; others contain restraints, sealed contracts, and mislabeled machine parts. This juxtaposition matters.

**Local custom:** a new arrival is offered two bowls: one meal now, one to carry to somebody else. Residents argue about whether this is hospitality or a conspiracy to avoid washing pots.

**Return changes:** fair charter means separate loading lanes and posted rescue priority. Company control means faster cargo service and barriers around public landing places. Neither variant erases the market's comedy.

## RG-03 — Causeway City

Causeway is a compact industrial regional city with an Earth Kingdom cultural foundation. Bridges are also streets; kitchens open onto landings; electric tram wires pass tiled roofs, brick workshops, broad factory windows, and a few taller commercial buildings. A repair garage, radio shop, and busy passenger platform make its era readable. At dusk new public lights illuminate a previously underserved neighborhood; wealthier streets already had them. Let the player enjoy that improvement before questioning its price. Keep the river terraces and local construction distinctive while using Korra-era city life as the technological reference.

The city has three everyday levels: low water stairs and ferry landings; middle workshops and dense homes; high civic terraces. During a surge, the same geography reveals unequal risk. Wealth alone does not determine morality, but elevation has quietly determined which lives planners considered easy to protect.

**Important places:** the Six-Ladle Kitchen; assembly courtyard; public demonstration canal; dispatch office; Open Palm Clinic; Copper Orchard passenger platform; Stillwater intake bridge. The assembly has space for public witnesses, but its speaking platform is reached only by steps until someone changes it.

**Civic fact:** Commonworks runs crucial services under council contracts. It does not own the whole city and does not automatically represent all citizens. Its staff includes committed public servants, frightened workers, and willing enforcers.

**Return changes:** who serves food, who speaks at meetings, and whether help reaches the lower landings reveal governance more convincingly than a faction badge.

## RG-04 — Copper Orchard

Ore-colored slopes surround fruit orchards planted by retired rail crews. In spring, petals drift through iron gantries. Maintenance sheds have walls repaired with mismatched metal panels. An outdoor chess table vibrates whenever a freight train passes; locals insist that moving pieces are a legitimate rule.

The rail town depends on a route that Commonworks wants to automate and reserve for heavy cargo. A new system could make work safer and travel cheaper. Its current schedule would strand a small settlement, close informal clinics on the route, and make experienced workers redundant without a transition.

**Social fault:** the old metalbending guild excludes capable applicants through family recommendations. Company reform removes that restriction while cutting worker control. Neither status quo is enough.

**Play spaces:** orchard viaduct, braking yard, foreman's hut, freight carriage, abandoned passenger platform, scrap workshop. The “moving train” mission can be staged at stops; a moving vehicle system is not assumed.

**Return changes:** a repaired passenger bell, classes at a public workbench, or a platform turned into a workers' sleeping shelter. The scenery remembers the decision.

## RG-05 — Reedglass Marsh

Tall translucent reeds catch sunset. Homes stand on piles. Walkways detach deliberately so the water can pass; visitors call this bad carpentry until somebody explains flood season. Nets have gaps for migrating animals. At night the water reflects a few lights with no lamps above them.

Residents maintain agreements with local spirits: not written treaties from the beginning of time, but practical habits renegotiated across generations. Offerings may be food, a cleared channel, a period of quiet, or a story told at the right place. Some households no longer know why a custom matters; some customs have outlived their purpose.

New pumps are reducing stagnant water near homes. The vanes that make the pumps predictable are also blocking a seasonal spirit route. There is no correct solution that requires returning to preventable illness. A bypass and changed operating schedule can preserve both benefits, with real labor and some reduced peak output.

**Play spaces:** reed village, floating school, abandoned eel traps, mirror pool, pumping station, spirit crossing. No generic glowing-purple corruption texture: disturbance appears as repetitive ripples, unseasonal stillness, and animals avoiding familiar paths.

## RG-06 — Bellweather Heights

Wind-carved terraces and long ribbons above a valley of cloud. A rebuilt sanctuary shelters airbenders, non-bending caretakers, travelers, and students whose families do not share the same inherited traditions. It is not the headquarters of all Air culture.

The sanctuary maintains a bell network for weather warnings and lost travelers. New pressure equipment changes the wind corridors and makes some bells ring at the wrong time. The old network also failed people before: one warning code is audible from the terraces but not understood in the lower migrant camps.

**Local tension:** whether stewardship means remaining above political disputes or participating in them responsibly. Nobody speaks for every airbender. Jinu's working courier culture and Nima's temple upbringing reveal differences within a tradition.

**Play spaces:** cable tram station, listening terrace, sheltered pasture, broken bell mast, wind shelter, a kitchen whose recipes are weighted against gusts. A small memorial garden is calm rather than haunted.

## RG-07 — Stillwater Works

This is an inhabited machine: locker rooms, a canteen, maintenance rails, a clinic annex, control galleries, turbine housings, spillways, and a vast tidal cistern. Hundreds of ordinary lives depend on it. Destroying everything would flood some districts and cut clean water to others.

The **Stillwater Engine** coordinates gates and loads across the network. It does not generate supernatural energy. The **quieting vanes** are pressure-control equipment built across a place where water movement and a spirit passage overlap. Engineers discovered that blocking the passage stabilized readings; they treated that stability as success. Continued blockage creates a worsening physical and spiritual feedback problem: pressure backs up, routes repeat, and displaced spirits interfere with the few channels still open.

A local spirit, the Still Keeper, accepted a promise of “no more sudden changes” and has been trying to keep the canal's current in one repeated pattern. Veyra knows the promise affects the station but initially misunderstands how far that effect can reach. By Act IV she has enough evidence to know full commissioning is unsafe and orders it anyway. That is a choice, not possession.

## Institutions and factions

| Group | Legitimate need | What they offer | Internal fault | What earns trust |
| --- | --- | --- | --- | --- |
| Commonworks | Reliable public services beyond bending elites | Skills, machinery, jobs, emergency coordination | Emergency authority becoming permanent control | Preserve services while exposing abuse with evidence |
| Reach councils | Local accountability and autonomy | Legal recognition, regional knowledge, crews | Delays, old-family influence, evasive responsibility | Show up for unglamorous repair and include excluded residents |
| Open Hand Assembly | Residents and workers need a say in decisions | Local organizing and mutual aid | Meetings can favor confident speakers and people with spare time | Give people practical ways to participate; honor dissent |
| Ferrymen's Compact | Safe navigation and fair access | Boats, pilots, flood routes | Established captains protect their own licenses | Respect expertise while opening training |
| Copper Orchard guild | Skilled, safe work | Metalwork and rail maintenance | Inherited access and resistance to outsiders | Demonstrate shared teaching, not merely defeat a guild champion |
| Bellweather sanctuary | Shelter, learning, continuity of tradition | Weather knowledge, food, patient witnesses | “Neutrality” can shelter the powerful from criticism | Accept a duty without claiming ownership of others' lives |
| Local spirit neighbors | Routes, seasons, space, agreements kept | Knowledge of living geography; limited cooperation | Some mistake change for harm or one human for all humans | Learn the specific relationship; keep a specific promise |

The Open Hand Assembly is an original local residents' organization, not the Equalists, a secret army, or a faction of every non-bender. Benders and non-benders belong to it.

## Spirit rules and recurring beings

**Latch** is a small reed-and-shell spirit with a long nose, a latch-shaped tail, and six fussy feet. They collect objects left at thresholds. They cannot steal an object from a person's hand, cross a threshold after a clear refusal, or read minds. They mistake “lost” for “unclaimed” until taught otherwise. Funny, proud, and capable of apologizing without becoming human.

**The Still Keeper** resembles a broad, translucent marsh heron with water circling inside its chest. It can repeat a current within its own connected habitat, including an echo of a sound carried by that water. It cannot rewind time, resurrect anyone, or freeze the world. It experienced the flood as the breaking of a thousand routes and believes stillness is protection. It must learn that movement can be cared for rather than abolished.

**Auntie Silt** is an affectionate local title for a grumbling, low mound of mud, roots, and blinking stones. It remembers riverbanks, not everyone's ancestry. It can move within wet silt and is bad at understanding property lines. Its humor comes from intense enthusiasm for boring mud facts. It sometimes gives wrong advice about people.

**The Last Lantern** is a mothlike spirit that follows lights left for someone expected home. It keeps company; it does not guarantee a return or impersonate dead people. Its optional scene permits grief without a supernatural cure.

These four named spirits are compatible original project characters, not creatures presented as established franchise canon. Their limits apply to them individually, not to all spirits. “Spirit passage” means their local route through the Reach; it is not an additional portal between worlds. Spirit encounters must establish what a being perceives and can do before relying on that ability. No surprise omniscient spirit may solve the investigation. Spirits may be comic, ordinary, frightening, or indifferent; none automatically certifies a human policy as morally correct.

## Food, creatures, and material life

Food includes pan-crisped river cakes, pepper broth, plum buns, steamed root parcels, kelp dumplings, and Sura's aggressively salty travel fish. Households borrow recipes; mixed culture is ordinary life rather than a problem requiring a single correct identity.

Use established Avatar species as the principal wildlife: **turtle ducks** at sheltered water, **ostrich horses** on working roads, **flying lemurs** around suitable roosts, visiting **sky bison** at Bellweather, and rare **badgermoles** in the mineral hills. Local populations, names, and habits are compatible original placements, not official Tidemark geography. Check each animal’s silhouette and anatomy against its animated reference before making an asset.

**Parcel is an ostrich horse.** Chewing a loose label and preferring an old route are this individual’s comic habits, not new species abilities. Ordinary river fish, geese, frogs, and fireflies can supply background life without invented hybrid names or supernatural behavior. The earlier mossback otter-goat, kitefin skimmer, lantern beetle, and clapper-goose designs are retired from the active draft. Do not reintroduce them from an older prompt.

**Lion turtles:** historical depictions and discussion may refer to their established role in Avatar lore. There is no living lion-turtle encounter in this campaign. Aang’s encounter does not establish a new post-Korra population or whereabouts; this restriction also does not assert a newly invented extinction date. SQ-35 in the companion is retired.

Most homes have good tools and improvised repairs rather than fantasy treasure. Money exists in the fiction, but this bible does not require an inventory or shop economy. Rewards can be access, trust, a changed service, a public skill, a rescue crew, or a remembered kindness. Do not turn every warm encounter into a transaction.


---

<a id="part-03"></a>

# 03 — People worth traveling with

## Roster rules

The ten heroes' elements, appearances, and original occupations come from the repository. Ages below are newly established writing ages, consistent with their young-adult art direction. Personal histories extend the bios without replacing them. Pronouns follow the existing portrait descriptions where explicit; Wen uses she/her, as in her biography.

All are capable adults. Players can enjoy them at different ages without being asked to role-play adult romance. Relationships begin with professional curiosity, irritation, and friendship. No romance is required or secretly canonical. A quest may challenge a hero's belief, but the player retains the decisive action.

An absent hero's personal quest can be deferred. Essential campaign information always has another source. New equipment mentioned in a story is a prop or narrative detail unless separately approved for the game.

## CH-01 — Kaya

**Existing identity:** firebender; lean young woman, high dark ponytail, red sash; grew up in a former Fire Nation colony and keeps proving she belongs. **Writing age:** 23. **Pronouns:** she/her.

**At the start:** Kaya responds to Mira's appeal because waiting feels too much like being told she is not wanted. She wants to become the person nobody questions when trouble starts. Her strength is immediate courage; her flaw is treating hesitation as rejection.

**Private history:** as a teenager she intervened when a neighbor was being bullied, scorched the shop behind him, and remembered the accusations more clearly than the neighbor's thanks. She learned the wrong lesson: do the good thing faster, then leave before anyone can decide what it means.

**Need:** stay for the repair and allow people to disagree without interpreting it as exile. She can be right to act and still accountable for how she acts.

**Ordinary delight:** competitive rooftop races, ugly handmade lucky charms, and being astonishingly good at braiding other people's hair. **Comic engine:** announces that she has a plan just before acquiring one. She is not stupid and does not destroy everything she touches.

**Voice:** quick verbs, short challenges, affection disguised as a dare. Under stress she talks faster; in shame she becomes abruptly practical. “I can get us through. I am asking whether through is where we want to go.”

**Connections:** Tenzo frustrates her because his patience works. Riko respects her courage and refuses her excuses. Dorin's earnestness makes her kinder than she expects.

**Personal quest:** PQ-01, The Place You Stay. **Growth image:** Kaya remains after the cheering to replace a damaged roof tile. A quieter ending does not turn her timid: she still goes first, but now checks who is coming with her.

## CH-02 — Tenzo

**Existing identity:** firebender; broad young man with swept-back black hair and short sleeves; Republic City dockside cook taught by his grandmother. **Writing age:** 29. **Pronouns:** he/him.

**At the start:** he is transporting preserved food to dock contacts when Ba Dan's need interrupts the route. He wants every person in a room fed and every argument cooled. He can manage a crisis precisely; he is less good at admitting that an argument needs to happen.

**Private history:** his grandmother kept their kitchen open through a labor dispute. He remembers her feeding both sides and omits the part where she publicly refused the foreman's conditions. He has mistaken kindness for making everyone comfortable.

**Need:** refuse an unjust demand without deciding the person making it is beyond care. A hot meal is not an acceptable substitute for paying someone fairly.

**Ordinary delight:** tiny carved animals, judging ovens by sound, and the occasional food pun he knows is terrible. **Comic behavior:** treats a casual meal as an occasion worth preparing for; his urge to feed people can produce too many dishes or an unnecessary second tasting. A bad pun is an occasional choice of his, not the script's default. He can get angry. When he does, his language becomes simpler rather than louder.

**Voice:** hospitable questions, exact instructions, kitchen comparisons used sparingly. “You may eat here. You may not threaten the people serving you.”

**Connections:** Nilak recognizes his habit of giving away rest. Sura disputes his preservation recipes. Wen's stove improvements sometimes solve a problem he does not have; they test them together before cooking.

**Personal quest:** PQ-02, A Table Is Not a Truce. **Growth image:** a kitchen that continues running while he sits down to eat with everyone else.

## CH-03 — Nilak

**Existing identity:** waterbender and healer; young man with topknot and fur-trimmed navy hood; trained at a Northern healing house, left over exclusion. **Writing age:** 25. **Pronouns:** he/him.

**At the start:** follows reports of untreated quarry injuries. He wants to be the healer nobody is turned away from. His attention makes people feel seen; his fear of becoming like his former teachers makes him promise more than he can deliver.

**Clarification of the existing bio:** “takes anyone who asks” was the healing house's stated ideal. In practice, residency papers and sponsorship determined access to sustained care. Nilak left when the contradiction became undeniable. His departure was principled, not evidence that all Northern healers are cruel.

**Private history:** he left behind his friend and fellow apprentice Aru, who was caring for a sick parent and could not afford to leave. Nilak's proud version of his own departure has made it hard to speak to Aru without sounding accusatory.

**Need:** establish boundaries, teach others, and distinguish triage from discrimination. He cannot heal everyone personally, and needing help is not a betrayal of his vow.

**Ordinary delight:** ridiculous sea-creature drawings; memorizes people's favorite warm drinks. **Comic behavior:** readily admits he cannot draw, then gets attached to one especially unconvincing creature. With friends he can be gently mischievous. During care his attention stays on the patient; pain and disability are not setups for a clever diagnosis.

**Voice:** asks permission, names observable details, avoids false reassurance. “I can ease the pain. I cannot promise what I haven't checked.”

**Connections:** Sura sees through his polite evasions. Bo trusts him but dislikes being ordered to rest. Dr. Iset treats him as a colleague, not a miracle.

**Personal quest:** PQ-03, The Door That Said Everyone. **Growth image:** Nilak leaves a patient safely in another practitioner's care, goes outside, and finally sleeps.

## CH-04 — Sura

**Existing identity:** waterbender; young woman with long braid and water skin; Southern ice-fisher, direct and cheerful. **Writing age:** 24. **Pronouns:** she/her.

**At the start:** brings a cold-storage shipment inland and discovers that its destination has stopped answering. She wants to show that she can handle bigger work than her family's fishing routes. She excels at immediate survival and is less practiced at listening to expertise that does not look like hers.

**Private history:** she once saved a crew by choosing a dangerous ice crossing correctly. Since then she has treated uncertainty as something other people do when they lack nerve. A later failed crossing injured a friend, who recovered but no longer accepts Sura's casual assurances.

**Need:** distinguish decisiveness from certainty. Asking how the river works is not surrendering command to it.

**Ordinary delight:** invents increasingly implausible fishing stories, then produces proof of the least plausible one. **Comic behavior:** becomes invested in convincing a particular listener; their practical questions make her adjust the story. She enjoys being caught when everyone knows it is a game. Her fishing and cold-weather skills remain reliable; freezing every object is not a recurring gag.

**Voice:** concrete comparisons, blunt questions, delighted approval of good ideas regardless of their source. “Fine. I was wrong about the bridge. I remain right about your socks.”

**Connections:** Tenzo's salted-fish criticism is an ongoing sporting rivalry. Lin Mei makes her slow down. Auntie Silt regards her as a young person who has never met a proper mudbank.

**Personal quest:** PQ-04, The River Does Not Keep Still. **Growth image:** Sura deliberately leaves an opening in a beautiful ice barrier for something she cannot command.

## CH-05 — Bo

**Existing identity:** earthbender; broad young foreman, green tunic over mustard sleeves; from three towns away, his unpaid crew needs food. **Writing age:** 30. **Pronouns:** he/him.

**At the start:** understands Ba Dan's crisis as his own with different names. He wants enough steady work to keep his crew together. He is a superb protector and a poor delegator.

**Private history:** an older foreman once left during a wage dispute, and Bo inherited a crew he feared would scatter. He began doing every unpleasant task himself. They admire him; some also feel he never believes they are ready.

**Need:** protection includes letting people choose risks and develop skills. He cannot call them equals while reserving every hard decision for himself.

**Ordinary delight:** delicate sugar sculpture and painted festival masks. These are real skills, not a joke about a large man's body. **Comic behavior:** quietly prepares for far more possibilities than anyone requested, or fusses over a tiny decorative detail while claiming he has finished. He can appreciate a poem or a cake without turning it into a building metaphor.

**Voice:** slow, concrete, few wasted words; occasional unexpected elegance. “A brace holds while you build. It isn't supposed to become the whole house.”

**Connections:** Lin Mei sees the hazard he absorbs. Riko pushes back when he automatically stands in front of her. Pella is impressed by his sweets rather than his bending, which delights him.

**Personal quest:** PQ-05, Somebody Else's Hands. **Growth image:** he watches his apprentice supervise a lift and keeps his hands at his sides until asked.

**Naming lock:** Bo is not Bo-shan. They are unrelated people with different jobs.

## CH-06 — Lin Mei

**Existing identity:** earthbender and surveyor; slight young woman, jaw-length hair and small topknot, cropped green jacket; quiet, precise. **Writing age:** 26. **Pronouns:** she/her. **Existing ID:** `lin_mei`; art keys use `linmei`.

**At the start:** investigates ground instability associated with the new quarry equipment. She wants to produce a map accurate enough that no one can dismiss it. She notices what others miss and hides behind qualification when someone needs a clear warning.

**Private history:** she submitted an early corridor survey for Commonworks. The data were accurate, but her report treated seasonal dwellings as “temporary structures” and marked only officially registered routes. The design team used those omissions to justify relocation. She did not authorize that policy; she did help make its victims invisible.

**Need:** evidence includes people whose knowledge does not arrive in her preferred format. Owning an omission makes her work more trustworthy, not less.

**Ordinary delight:** fiercely competitive board games, tiny paper maps of places too small to need one. **Comic behavior:** her composure slips over low-stakes competition; she recalls an inconvenient rule, rehearses a move, or immediately asks to play again. Precision occasionally punctures a boast, but she also makes mistakes, enjoys company, and loses fairly.

**Voice:** measured, precise, dry. When moved, she abandons the qualifier. “The map is accurate. I am telling you what I failed to put on it.”

**Connections:** Sura tests her capacity for improvisation. Wen understands the embarrassment of seeing one's work misused. Veyra admires her and assumes that shared technical standards mean shared political priorities.

**Personal quest:** PQ-06, What the Map Left Out. **Growth image:** a map with residents' annotations in other handwriting, deliberately left visible.

## CH-07 — Nima

**Existing identity:** airbender; young man with cropped hair, short orange cape; raised at a rebuilt Air Temple by a newly established generation of practitioners. **Writing age:** 22. **Pronouns:** he/him.

**At the start:** volunteers for a service journey and takes the longest possible route to every obligation. He wants to be free without becoming careless. His flexibility lets him escape bad assumptions; it also lets him escape chores and difficult commitments.

**Private history:** he left a sanctuary construction project to help strangers on the road. The help was worthwhile. He never sent word back, leaving other volunteers to cover work he had promised to do. He has been defending the first fact to avoid answering for the second.

**Need:** a freely chosen commitment can be an expression of freedom. He does not need to become rigid or abandon humor to become dependable.

**Ordinary delight:** inventing harmless games out of waiting; knowing the best place to nap in every building. **Comic behavior:** puts surprising effort into an easier way to do a chore, then becomes too invested in the method. He can invite others into an absurd game. Avoid attaching a mock spiritual proverb to every nap; sometimes he just wants to lie down.

**Voice:** playful redirection, literal questions that expose contradictions. Serious Nima is startlingly plain. “I said I'd be here. This time that is the whole plan.”

**Connections:** Jinu's working schedule challenges his idea of wandering. Bo is both bemused and annoyed by him. Sura appreciates that he will actually try the absurd plan.

**Personal quest:** PQ-07, The Promise on the Wind. **Growth image:** Nima staying on an unglamorous night watch while somebody else has the adventure.

## CH-08 — Jinu

**Existing identity:** airbender and northern-provinces courier; young woman with two curly buns and fringed sash; talks and fidgets constantly. **Writing age:** 27. **Pronouns:** she/her.

**At the start:** carries a backlog of letters to the Reach, including one whose recipient is missing at the quarry. She wants her routes reliable enough that distance never becomes abandonment. Her sociability makes connection effortless; she sometimes mistakes access to news for ownership of it.

**Private history:** she once repeated an apparently harmless engagement rumor while comforting a lonely customer. The rumor was wrong, and the person concerned lost a job tied to household expectations. She apologized but still tells herself it was only a small mistake.

**Need:** listening includes protecting another person's right not to be explained. She can expose wrongdoing without turning private lives into material.

**Ordinary delight:** invents names for ugly roads; knows where every decent public toilet is. **Comic engine:** conversational footnotes that get longer than the original point. Under real fear she suddenly goes quiet.

**Voice:** rapid observations, affectionate specificity, unexpected recall. “I can deliver it. Whether I get to read it is a different question.”

**Connections:** Nima teases her schedule until she makes him carry the mail. Riko values her competence and distrusts her curiosity. Latch is fascinated by sealed envelopes and requires firm boundaries.

**Personal quest:** PQ-08, Letters Are Not Yours. **Growth image:** carrying a letter whose contents she never learns, and being satisfied when it arrives.

## CH-09 — Riko

**Existing identity:** non-bender and chi-blocker; young woman with jaw-length dark hair, thin temple braid, maroon jacket; no blanket grudge against benders. **Writing age:** 24. **Pronouns:** she/her.

**At the start:** works occasional escort contracts and follows a rumor that her former teacher passed through the Reach. She wants respect without having to demonstrate she can defeat the strongest person present. Her perceptiveness exposes hypocrisy; her reflexive independence can prevent solidarity.

**Private history:** her teacher, Seli, concealed her own history training abusive private guards. Riko suspects the secret and dreads hearing the truth because the teaching helped her survive. The lesson being useful does not make its origin harmless.

**Need:** skill can be reclaimed through accountable use and shared teaching. She need not be solitary, ideologically anti-bender, or “one of the good ones” to count.

**Ordinary delight:** terrible stage mysteries; guesses the ending immediately and loves watching anyway. **Comic behavior:** conceals how invested she has become, then remembers a minor stage detail no casual observer would know. She may give a friend a brief, pointed answer, but does not exist to score the final line in their conversations.

**Voice:** concise, pointed, unexpectedly gentle when somebody is ashamed. “I asked for a seat. You keep offering me a demonstration.”

**Connections:** respects Kaya's nerve; questions Veyra without denying what she built; gives Pella the firmest and clearest boundaries around dangerous techniques.

**Personal quest:** PQ-09, The Lesson You Keep. **Growth image:** a mixed group practicing escape and de-escalation together, with Riko correcting everyone's stance equally.

## CH-10 — Wen

**Existing identity:** non-bender Republic City machinist; stocky young woman with short blond hair, goggles, blue work jacket, repair gauntlet. **Writing age:** 28. **Pronouns:** she/her.

**At the start:** recognizes a familiar coupling in the quarry machinery and wants to know who modified it. She wants her inventions to make ordinary people less dependent on experts. She loves elegant solutions and sometimes underestimates how different ownership changes their use.

**Private history:** an early pressure regulator of hers was licensed through a city workshop. Commonworks incorporated a modified version into its vanes. She did not invent the whole network and is not secretly responsible for every harm. Her choices now concern disclosure, repair, and who can service the design.

**Need:** accessible technology requires accessible knowledge, maintainable parts, and someone permitted to say no. A benevolent inventor is not enough.

**Ordinary delight:** rescuing bad machines from scrap, collecting inaccurate instruction diagrams. **Comic behavior:** solves an intricate design problem before checking an obvious practical constraint; a demonstration reveals the omission, and she fixes it. Her enthusiasm can also make a tiny, successful repair feel momentous. Test jokes use safe, reversible inconveniences, never a concealed risk to a friend.

**Voice:** enthusiastic specifics, little bursts of self-correction, immediate blame acceptance when evidence is clear. “It works. Now we ask who can stop it.”

**Connections:** Lin Mei shares the discomfort of a useful report misused. Tenzo is a willing, demanding equipment tester whose cooking exposes things her bench tests miss. She initially idolizes Veyra, who treats her seriously in a way prestigious city workshops did not.

**Personal quest:** PQ-10, The Right to Repair. **Growth image:** Wen deliberately hands over a design with clear instructions and lets somebody else improve it.

## Existing supporting cast

| ID / person | Motivation and contradiction | Voice / human detail | Arc and limits |
| --- | --- | --- | --- |
| NPC-01 Elder Mira, she/her, seventies | Wants Ba Dan safe and self-governing; accustomed to deciding what others can bear to hear | Warmth expressed through practical orders; keeps broken cups because they are familiar | Admits she favored old quarry families. Can share authority without being exposed as secretly villainous. |
| NPC-02 Gao, he/him, fifties | Wants neighbors cared for; uses generosity to avoid admitting his own need | Kind until a boundary is crossed; impeccable memory for birthdays, poor memory for his own debts | Condemns the Ruon trade; can acknowledge later repair without pretending it did not happen. His shop prices are fiction until an economy exists. |
| NPC-03 Pella, she/her, about nine | Wants Bo-shan home and adults to speak plainly; treats usefulness as permission to go everywhere | Blunt, funny, specific; gives adults nicknames based on one mistake | Helps with safe messages and naming missing people. Never joins combat or needs a perilous rescue to make the story matter. |
| NPC-04 Dorin, he/him, late twenties | Wants to do his job properly; thinks rules provide an answer to every conflict | Rehearses official lines, then abandons them to help; proud of an unconvincing moustache | Learns discretion and reports his own errors. Remains a competent local protector, not merely a cowardly joke. |
| NPC-05 Captain Ruon, he/him, fifties | Fed and protected his unpaid guards by imposing on other workers; wants the harm understood without denying it | Tired, direct, proud; notices ill-fitting boots before flags | Can testify and do repair under supervision. Courage does not restore his rank automatically. Never turns into a universally adored mentor. |
| NPC-06 Jin, she/her, forties | Wants leverage, solvent contracts, and an exit before the bill arrives | Polite, economical, unsettlingly practical; hates loose buttons and vague promises | Will bargain over evidence; may honor precise terms. She benefits from coercion and is not a secret philanthropic rescuer. |
| NPC-07 Grumbler, he/him, late thirties | Former quartermaster given real power and afraid to lose it; wants machines to solve human conflict | Long complaints about small defects, abrupt silence about big moral ones | Relief at surrender is genuine. His workshop competence may help repairs under oversight; it does not cancel confinement of workers. |
| NPC-08 Bo-shan, he/him, 19 | Wants a life bigger than produce deliveries, loves Pella, embarrassed that his own job mattered so much | Easy humor, terrible packing judgment, makes promises too casually | Comes home as a person with fatigue and preferences, not a reward object. Bo is not his older self or relative. |

## New supporting cast

| ID / person | Role and reason to care | Contradiction and voice | Payoff |
| --- | --- | --- | --- |
| NPC-09 Tavi Ren, they/them, 34, non-bender | Ferry pilot; wants safe access for residents as well as freight | Knows every current; dislikes changing an inherited licensing system. “The river does not care whose uncle signed it.” | Opens training to new pilots if challenged constructively; runs an evacuation route. |
| NPC-10 Dr. Iset, she/her, 56, non-bender | Runs Open Palm Clinic; ordinary medicine, sanitation, patient advocacy | Fiercely competent, bad at asking for supplies before a crisis. Has two husbands who take turns reminding her to eat. | Gives Nilak collegial support; coordinates care with or without a waterbender. |
| NPC-11 Hesh, he/him, 61, earth/metalbender | Retired rail mechanic and teacher | Defends guild standards but knows family sponsorship excludes talent; expressive eyebrows, minimal praise | Teaches safety and shared skill. Never grants expertise instantly as a reward for flattery. |
| NPC-12 Luli, she/her, 41, fire/lightningbender | Maintains public power lines | Proud of power for ordinary homes, privately exhausted by production quotas; laughs like a coughing engine | Shows the moral difference between providing power and demanding unlimited labor. |
| NPC-13 Oru, he/him, 38, airbender | Bell tuner and traveling performer; studies air pressure and practical acoustics | Loves an audience, knows when to become quiet; cannot whistle in tune | Teaches controlled air projection within airbending and builds warnings that people can actually understand. |
| NPC-14 Aru, they/them, 26, waterbender | Nilak's former colleague; assigned to the Northern healing-house outreach room at Saltstep | Stayed to care for a parent; has changed the institution incrementally and resents being treated as a coward | Reconciliation can be respectful disagreement; supplies advanced healing instruction. |
| NPC-15 Edda Coil, she/her, 47, non-bender | Public-workshop trainer at Copper Orchard's Saltstep annex | Wants open designs but guards her own prized tools; fond of very small practical jokes | Engineering teacher, accountable service model, alternate technical witness if Wen is absent. |
| NPC-16 Renn, he/him, 21, earthbender | Bo's former apprentice, leading unpaid workers | Wants Bo back and wants him to stop taking over; stubbornly good at sugar work too | Leads a rescue crew after earning trust. |
| NPC-17 Seli, she/her, 52, non-bender | Riko's former teacher, now hiding as a stage movement coach | Regrets abusive guard training but fears consequences; still redirects questions as if they were attacks | Can testify and accept restricted teaching conditions; forgiveness remains Riko's choice. |
| NPC-18 Fenn, she/her, 32, non-bender | Marsh schoolteacher and Open Hand organizer | Welcomes every voice, inadvertently favors people who like meetings; laughs hardest at her own poor jokes | Makes participation practical through shift meetings, accessible notices, and paid childcare in the fiction. |
| NPC-19 Neri, he/him, 43, waterbender | Commonworks safety engineer | Has evidence of the vanes' danger; delayed whistleblowing to protect his team and career | Survives to testify if protected, otherwise evidence remains through copies; never carries the sole copy of the plot. |
| NPC-20 Sena, she/her, 45, non-bender | Sanctuary caretaker and Nima's former supervisor | Loves spiritual discussion but distrusts grand speeches about chores; formidable at board games | Shows commitment through ordinary labor and allows Nima to disagree honestly. |

## AN-01 — Director Veyra Sen

**Identity:** woman, 46, non-bender; practical dark-blue work coat with repaired cuffs, silver-threaded black braid, a carved wooden measuring rule from her mother. New visual concept; do not overwrite existing art.

Veyra built pumps, public baths, lighting, and accessible controls that changed people's lives. She remembers a rescue waiting while equipment, skilled people, and permission sat in three different places. Her mother survived that flood. Her deepest promise is that essential services should function even when a gifted person is absent or an official is unhelpful. This is a problem of dependence on unreliable systems, not hostility toward bending.

She is right that reliable institutions matter. She is wrong that her competence entitles her to make everyone obey. Her position hardened through many choices: suppress a troubling report until after funding clears; classify a worker protest as an interruption to essential supply; decide that a local agreement cannot be allowed to delay a regional good.

**What she wants now:** commission the Common Current before the spring tide and demonstrate that the Reach can protect itself. **What she fears:** admitting uncertainty will return people to the old, unequal dependence. **What she conceals:** she signed the supply-control order; she knows contractors exceeded it; she has suppressed a shutdown recommendation.

**Humanity:** has a good, slightly awkward laugh, remembers former apprentices' names, repairs her own teapot, and cannot gracefully lose a game. Her mother, Meren Sen, she/her, 71, lives upriver and sends blunt letters about neighborhood needs; she is neither a hostage nor a secret moral solution. Veyra can offer the heroes valuable work without lying about every benefit. She will save a trapped worker even while resisting arrest.

**Voice:** lucid, specific, persuasive. No constant sinister hints. “The old system called it generosity when somebody chose to help. I wanted people to have a right to it.” Later: “Every delay has a name attached to it. You show me yours. I will show you mine.”

**Escalation:** idealist with dangerous authority → deliberate suppressor of evidence → accountable opponent making a final choice. She is never mind-controlled. Rusk's worst abuses are his, but she cannot shift responsibility for enabling him. A sympathetic ending requires surrender of command, release of records, and acceptance of public judgment. Tears alone do not unlock it.

**Originality lock:** no masked movement, anti-bending doctrine, conquest campaign, spirit-energy weapon, lost-power identity twist, or revelation that her mother secretly caused the disaster. What undoes Veyra is a pattern of decisions that made a tidy plan more important than the people it served.

## AN-02 — Marshal Olan Rusk

**Identity:** man, 52, earthbender; regional Commonworks security chief, always immaculate where workers are covered in mud.

Rusk believes order should be visible and disobedience expensive. He prefers a world where an efficient chain of command lets him decide who counts as a disruption. He admires Veyra's competence and thinks her compassion is a design defect.

He expanded the supply-control order into confinement, diverted wages into security expenses, and pressures Jin to make witnesses disappear into private custody. He needs Ruon because the captain's records connect the quarry to the official order. He does not have supernatural powers, a secret royal claim, or an excuse that erases his choices.

**Voice:** courteous administrative threats. “No one has forbidden them to leave. We have suspended departures.” **Human detail:** patiently feeds a stray cat. This does not mean he is secretly kind; people can be gentle in one relationship and abusive in another.

His defeat can be arrest, retreat after public exposure, or a tactical surrender under pressure. He does not return in every ending as an immortal sequel hook.

## AN-03 — The Still Keeper

See the atlas for appearance and power limits. This spirit's desire is legibility: it wants a route that remains recognizable and a promise that humans cannot reinterpret overnight. It has mistaken a repeated current for safety because it experiences change through waterways, not households.

It regards a floodgate as a sentence humans keep revising. Its comedy is literal and occasional; its grief is not a puzzle the party solves by choosing “be nice.” It has contributed to the feedback crisis and must also change its behavior. A pact requires a traversable route, a seasonal operating schedule, and a way to renegotiate. Humans do not offer a person as payment.

## Relationship turns

| Pair | Early friction | Shared turning point | Late possibility |
| --- | --- | --- | --- |
| Kaya / Tenzo | Speed versus caution | A rescue succeeds because one acts and one holds the exit | They coordinate without pretending to share a temperament |
| Nilak / Sura | Careful promise versus confident improvisation | A patient needs both cooling and a realistic recovery plan | Sura asks; Nilak answers directly |
| Bo / Lin Mei | Strong intuition versus measured evidence | Workers reveal what neither strength nor survey captured | Their plan credits local knowledge by name |
| Nima / Jinu | Wandering versus schedule | A storm delivery needs improvisation and keeping a promise | They trade duties instead of insults |
| Riko / Wen | Personal skill versus technical solution | A public safety system needs an accessible manual release | Both stop treating self-sufficiency as the only form of strength |
| Wen / Veyra | Admiration versus authority | A design revision helps people and conceals a dangerous limit | Respect survives only if Veyra accepts accountability |
| Mira / Ruon | Betrayed trust | A hearing names the harmed workers before the captain's explanations | Cooperation under limits, never automatic reconciliation |


---

<a id="part-04"></a>

# 04 — The main campaign

## Structure and pacing

**Act I: Stone** — a village needs its people back. **Act II: Sparks** — the wider project is attractive, useful, and compromised. **Act III: Currents** — three regions reveal the cost of treating a living world as a diagram. **Act IV: Weight** — the party must take a public position and return to people affected by earlier choices. **Act V: Balance** — rescue, confrontation, and a settlement that outlives the heroes.

Each mission below identifies dramatic purpose, playable action, choice, consequence, and recovery. A required clue never exists in only one breakable object or optional conversation. Named heroes supply distinctive reactions only when selected. The neutral party and local specialists can complete every mission.

The deadline is staged by story commitments, not an unseen real-time clock. Free exploration does not secretly advance a flood. Before MQ-12's final commitment the party hears exactly which regions and optional scenes will become temporarily unavailable. Return access resumes after the crisis unless an explicitly chosen local consequence changes it.

## Act I — Stone

### MQ-01 — The Quarry of Ba Dan

**Status:** existing adventure; new connective and aftermath writing. **Locations:** Ba Dan, forest road, quarry gate, ambush cutting, quarry floor. **Question:** What do you owe a stranger once they surrender?

Begin with human absence: idle carts, dinner places, Pella wanting her brother named. The existing road encounter reveals quarry workers pressed into violence. Ruon surrenders after combat or negotiation. The escort-versus-trade branch remains; it must not be described as morally indistinguishable.

Preserve the existing elemental gate options. When adapting the expanded story, add an earned neutral route based on pay records, shared labor knowledge, or a worker's introduction. An earthbender's identity is not automatic proof of quarry experience. A firebender's intimidation reflects the particular guard's fear, not a universal national reaction.

The driller finale is visually spectacular: oil, falling braces, cut stone, a machine larger than its operator. Narrative objective is to end the coercion and free the workers. If existing combat cannot yet support evacuation objectives, put their rescue in the victory scene rather than pretending new mechanics exist.

**Victory:** Grumbler surrenders; four messengers, Bo-shan, and confined workers are accounted for. **Defeat:** occupation continues and rescue is deferred, with messages confirming that the missing people remain alive. A storm drainage route gets the party out. Ba Dan does not burn down as punishment.

**Closing beat:** the imported machine and off-ledger cargo markings make this larger than an unpaid crew. Pella asks a practical question: “Does he come home now?” Answer honestly according to the outcome.

## Act II — Sparks

### MQ-02 — Paper and Stone

**Locations:** Ba Dan cookhouse and Saltstep docks. **Question:** What counts as proof when people would rather call an abuse an accident?

Mira asks the party to find the quarry's sponsor. On victory, workers recover a shipping plate and duplicate dispatch stub. On defeat, Gao has a delivery receipt and Jinu's courier office—or a local runner when she is absent—has a second copy. Both point to reopened Emberwatch and a Commonworks contractor. The evidence proves a supply relationship, not yet Veyra's full knowledge.

At Saltstep, the party must identify a shipment while an argument sends the floating customs stall drifting away. Board the stall, follow from the shore, or persuade Tavi to tow it. The comedy ends when a separated wage envelope appears in a crate labeled “safety materials.”

**Choice:** make the initial accusation public or keep inquiry quiet. Public action earns worker witnesses and warns Rusk; quiet action preserves access but makes some locals doubt the party. Neither route destroys evidence needed later. Jin hears of the inquiry either through a public complaint or her own freight agents, not magical knowledge.

**Recovery:** losing a dock skirmish means a duplicate manifest must be requested through Tavi; no repeated fight is mandatory. **Payoff:** the ferry crosses under a suddenly bright line of lamps.

### MQ-03 — Lamps Across the Bay

**Location:** Emberwatch. **Question:** Can a useful institution conceal an ugly bargain?

The supposedly ominous outpost contains gardeners, a clinic supply room, mechanics, and an old parade ground covered in drying beans. Let players enjoy finding civilian uses for military spaces. Tavi introduces the party to Luli and Edda, who demonstrate real public-benefit work.

Follow a mismatch between crates unloaded and crates recorded. Routes include a legitimate safety inspection, persuading a worried loader, or entering by the rain cistern. Bending changes the approach; ladders, keys, and local cooperation keep it available to everyone. Guards can be talked down or overcome.

The sealed dispatch room contains Veyra's supply-control order and a later Rusk instruction authorizing restricted departures. Rusk's instruction is harsher; Veyra's original still enabled coercion. Neri's name appears on a warning about pressure readings. Ruon's custody is resolved here: he is either under Ba Dan's supervision, held by Jin, or reachable through a guarded transfer.

**Choice:** free detained loaders immediately, or arrange a witnessed transfer that preserves a broader investigation. State the risks; neither option requires leaving people in indefinite captivity. **Consequence:** rescued loaders support the party, while the witnessed route adds a legal witness. **Exit:** Veyra invites the party to see Causeway's commissioning festival and explain what they found.

### MQ-04 — The Day the Lights Stayed On

**Location:** Causeway festival. **Question:** What if the person you suspect has built something people genuinely need?

Begin with joy: a public bath, music under new lamps, a lift with a handwheel that a child can operate under supervision, food that stays warm for late workers. Three short festival tasks let the party experience ordinary benefit before the plot interrupts.

A demonstration gate jams. Veyra joins the rescue in rolled-up sleeves. The party clears access, organizes spectators, or helps stabilize equipment; no named hero or element is required. Her willingness to risk herself is genuine. So is the way she dismisses a frightened worker's warning afterward.

Veyra acknowledges the quarry supply order, promises an inquiry into contractors, and offers a regional inspection commission. She needs credible outsiders to restore confidence and believes their findings will support the network once they see the whole plan. She does not know everything they will discover.

**Choice:** accept publicly, accept with written independence and publication rights, or decline official credentials and investigate with residents. All reach MQ-05. The independent-terms option requires naming terms, not passing a charm check. **Payoff:** that evening, an old resident reads outside under the first reliable light she has had in years.

### MQ-05 — Three Routes, One Promise

**Locations:** Causeway dispatch office and connected workshop quarter. **Question:** Who gets included when someone says “everyone”?

The party compares a demonstration map with actual service schedules. Three inconsistencies emerge: rail service that no longer stops where people live; a marsh water route reported as empty; a bell station showing safe conditions while travelers report dangerous gusts. The investigation opens three spokes, MQ-06 through MQ-08, in any order.

Before departure, offer the five teacher stories. Luli, Aru, Hesh, Oru, and Edda are reachable in the coast-to-city corridor through the Saltstep annex or visiting work teams; there is no required voyage to a polar nation before the level-five choice. The player should see these opportunities before committing to specialization.

**Choice:** whom to trust with preliminary findings. Commonworks engineers can provide technical access, residents supply omitted routes, and guild crews supply maintenance history. This is a relationship emphasis, not a mutually exclusive faction lock.

**Recovery:** missing a witness sends a note to the public dispatch desk; clues do not disappear when the party changes maps. **Quiet close:** everyone shares a meal and marks their chosen next destination. The campaign opens out rather than immediately escalating again.

## Act III — Currents

### MQ-06 — The Train That Forgot a Town

**Location:** Copper Orchard. **Question:** Does a service count as improved if it stops serving the people who need it?

The party boards a freight route converted from mixed passenger service. A grandparent with a basket of medicine is told that her settlement is now an “unscheduled stop.” In the yard, a runaway maintenance wagon starts a brisk rescue encounter among fruit crates and shunting signals. The party can stop it, guide it into a sand siding, or clear its path and recover it later; children are never used as impact targets.

Crew testimony and schedules show that automation is useful but the cargo targets leave no allowance for passengers or repair time. Hesh admits the old guild also excluded outsiders. A contested line must be given either a community-run passenger window or a council-guaranteed service with independent crew oversight. Both require resources and displease someone who wanted exclusive use.

**Proof gained:** the network's official capacity assumes removal of “nonessential” local uses. **Consequence:** rail crews can support the finale, with different levels of independence. **Defeat recovery:** passengers shelter in an orchard while the party uses a maintenance trail; the settlement survives, but cargo leverage is lost. **Personal opportunities:** Bo and Riko, if present.

### MQ-07 — A River with No Reflection

**Location:** Reedglass Marsh. **Question:** Whose knowledge belongs in a plan?

The party arrives by a channel that flows upstream in a short repeating loop. The school bell rings twice without being struck twice; no time has actually reversed. Follow physical observations, residents' route songs, and pump logs. Each describes a different part of the same system.

Latch steals a dropped inspection tag, leading to Auntie Silt and then a limited audience with the Still Keeper. The spirit believes the humans promised unchanging water. Residents never made that promise; a trial team did. A maintenance note shows Veyra's office was told the trial's steady readings depended on keeping the passage blocked.

**Action:** reopen a temporary crossing while keeping drinking-water pumps working. The party can secure a bypass crew or manually stage water releases under guidance. A spirit encounter involves defending access and calming disruption, not killing a sacred creature for loot.

**Choice:** prioritize a wider spirit corridor with reduced peak pumping, or a narrower scheduled crossing with tighter human operating duties. Both require consent and review; neither is a perfect forever solution. **Proof gained:** blocked passage causes repeated currents and unstable pressure. **Recovery:** if the first bypass fails, residents evacuate one walkway and try a smaller safe release. **Personal opportunities:** Sura, Lin Mei, Nilak.

### MQ-08 — The Mountain That Wouldn't Listen

**Location:** Bellweather Heights. **Question:** Can refusing to take sides become a choice for the people already in charge?

A cable tram stops beneath a windy terrace. Rescue passengers through a maintenance platform, controlled descent, or a local volunteer team's lift. Nobody needs an airbender; the right training or equipment is present through sanctuary staff. A goose honks over the spoken warning at precisely the wrong moment; it is ordinary noise, not a copied signal.

Oru and Sena show how Commonworks pressure shifts have changed the wind near a bell mast. The sanctuary had reported the changes quietly but declined to support the affected lower camps publicly. The old warning pattern also assumes one shared language and hearing range.

**Choice:** restore the mast under the old sanctuary structure with a public reporting duty, or share its operation with lower-camp crews and accept a loss of sanctuary control. Teach visual warning signals either way. Tradition may continue; exclusion need not.

**Proof gained:** full commissioning amplifies the disturbances seen in the marsh. **Recovery:** a failed rescue costs a tram carriage and requires shelter overnight; all passengers have a safe retreat. **Payoff:** a silent line of flags carries a warning across the valley, answering a bell that no longer works alone. **Personal opportunities:** Nima and Jinu.

### MQ-09 — The Map Under the Map

**Location:** Causeway's old maintenance archive. **Prerequisite:** all three spoke missions resolved, in any order. **Question:** When does ignorance become a decision?

Overlay schedules, water logs, and wind measurements. The missing human routes correspond to the blocked spirit passage. The network works on paper because its model excludes inconvenient people and movement. The heroes have not discovered an ancient curse; they have discovered a series of omissions becoming policy.

Neri supplies his dated recommendation for a staged shutdown. Duplicate records remain in the dispatch archive if he cannot appear. Lin Mei or Wen can recognize their own contribution when present; Edda explains the same technical relationship otherwise. A recorded reply shows Veyra rejected postponement after she had enough evidence. Rusk then ordered the warning copies collected.

**Action:** escape a document seizure through archive galleries, or hold a lawful public inspection while witnesses copy the records. Copies are physical, imperfect, and made by people; no magic broadcast.

**Choice:** publish immediately or first negotiate worker protection and an evacuation guarantee. Immediate exposure is justified but disrupts services; preparation protects staff but gives Rusk time to fortify the works. Both routes lead to a contested assembly. **Quiet close:** the party sees the lamps still on and knows what a careless shutdown would cost.

## Act IV — Weight

### MQ-10 — Everyone in the Room

**Location:** Causeway assembly and lower landing. **Question:** What does accountability look like when the person responsible is still useful?

Residents, workers, Commonworks, councils, and sanctuary witnesses gather. The meeting is playable through short conversations, assembling a clear claim, and choosing which concrete demands to put forward. It must not become a long unbroken political monologue.

Core demands are release of confined workers, public safety records, and independent control of emergency shutdowns. Veyra may accept contractor restraints and disclosure while resisting shared control. If the party tries to humiliate her instead of naming terms, she hardens, but later cooperation is still possible through facts and action.

Rusk attempts to seize the assembly under a safety pretext. A sudden pump malfunction creates a real emergency he exploits. Defend the exit, keep opponents from being trampled, or outmaneuver his order through witnesses and local guards. The malfunction is not a scripted “villain was right” punishment for speaking out.

**Choice:** place immediate operations under a constrained Commonworks team or a provisional shared response group. Both have named responsibilities. **Consequence:** the finale's command structure changes. **Recovery:** if the party loses the confrontation, witnesses escape with copies and reconvene at Six-Ladle Kitchen. The public case survives; custody and access become harder.

### MQ-11 — Back to the Stone

**Location:** Ba Dan. **Question:** Did helping a place once entitle you to speak for it forever?

Return because the lower-gallery drainage route and quarry stone are needed for emergency works, not because Mira has been kidnapped. The village has changed according to MQ-01 and the Ruon choice.

If the quarry was freed, workers are debating whether another emergency will consume their wages and safety. If occupation continued, Rusk has begun pulling guards toward Causeway. The party can negotiate withdrawal using the documented supply chain, support a worker-led release, or fight a reduced garrison. The missing five return here if they did not earlier.

Ruon's public account is heard in this chapter if it has not been heard through a local hearing. If he was traded, rescue or lawful transfer from Jin is available; he may testify without forgiving the party. Bo-shan gets his own reunion, with space for Pella's anger as well as delight.

**Choice:** ask Ba Dan to contribute a crew and risk the route, or accept supplies and local defense while finding another crew. The story respects a refusal. **Consequence:** volunteers join the crisis by choice; no town is drafted as a resource. **Closing image:** a place at Mira's table is finally used by its intended person.

### MQ-12 — The Night Before the Tide

**Location:** Causeway's shelter quarter. **Question:** Can you commit without pretending you can save everything personally?

The seasonal tide is approaching; forecast disturbances confirm a dangerous overlap with full commissioning. The party plans three fronts: lower-landing evacuation, rail-and-power stabilization, and reopening the spirit passage. Local teams can staff every front. Side-story help improves shelter capacity, communication, or recovery rather than deciding whether a child lives.

Offer short private conversations, a meal, completion opportunities for nearby unfinished threads, and an explicit final-commitment prompt. State which travel is temporarily closed. There is no hidden countdown while the family reads or takes a break.

The party assigns itself one first-response route; other teams begin their tasks. It can visit the remaining fronts in a authored sequence without pretending all heroes are simultaneously everywhere. Solo play uses the same fiction with smaller objectives and support crews.

**Choice:** preserve maximum service through a staged intervention, or reduce output early to give the evacuation more margin. Both are viable; the latter causes a longer recovery, the former demands closer cooperation. **Payoff:** the heroes make a promise specific enough to keep. The first rain begins after the player commits.

## Act V — Balance

### MQ-13 — Three Ways to Hold a Night

**Locations:** lower landing, Copper Orchard relay, marsh spillway. **Question:** Can a community do together what no hero can do alone?

The fronts are short, distinct chapters: a rescue through rising walkways; a tactical fight around a power relay with workers inside; a strange passage where water repeats the same movement and must be released in stages. The selected first front gets the full playable encounter; later fronts get a shorter intervention or acknowledgment of the team that completed them. Do not repeat three identical defend-the-switch battles.

Earlier relationships appear in concrete ways: Tavi's apprentices ferry residents, Renn leads a brace crew, quiet warning flags work when bells fail, Gao's reconciled suppliers feed shelters. With little optional help, baseline public crews still act; the cost is slower repair and more damaged property, not a punitive body count.

Rusk tries to reclose the spillway and restore exclusive control. He can be arrested after a fight, isolated by his own personnel when shown the public orders, or driven off with evidence preserved. He is not the final moral argument; he is an immediate obstacle.

**Recovery:** a lost front becomes a salvage scene with local assistance. Damage affects the epilogue. The party still reaches the works with enough information to choose.

### MQ-14 — The Current We Keep

**Location:** Stillwater Engine and connected cistern. **Question:** What are you willing to stop controlling?

Veyra is physically holding the works together with a depleted crew. The Still Keeper is repeating the channel's current, trying to prevent another destructive surge. Both are making the situation worse while trying to preserve something real.

First stabilize a safe working area. Then confront the conflicting promises. The final encounter can be a tactical struggle against malfunctioning equipment and Rusk's remaining loyalists, a coordinated shutdown under threat, or a mixed route in which Veyra surrenders command during the fight. No dialogue option simply skips the physical problem.

The party must secure four practical facts, not four elemental keys: a relief route is open; operators can stop the system; people downstream have been warned; the spirit passage is no longer sealed. Those facts can come from baseline crews or better prepared allies. The Still Keeper accepts a moving route when it is physically demonstrated and an ongoing point of contact is offered. It does not obey because a hero gives the perfect speech.

The structural choice is between a reduced shared network, a temporary constrained central service, or safe regional separation. See endings below. Veyra's accountability is a separate choice from retaining useful infrastructure. Arresting her does not require destroying water supplies; accepting her technical help does not restore her authority.

**Defeat recovery:** evacuate the control floor and make a guided emergency shutdown from the external release. The resulting Regional Separation ending carries more rebuilding work. It is a complete conclusion, not a game-over loop.

### MQ-15 — What Happens Tomorrow

**Locations:** Causeway, Ba Dan, and selected return scenes. **Question:** Who gets to live in the answer?

The danger is over. Play a brief aftermath: hear a public accounting, help with one modest repair, visit someone whose life changed, and share a meal. Veyra, Rusk, Jin, Ruon, and Grumbler have individual outcomes rather than one faction-wide pardon. Legal judgments beyond the campaign's evidence remain with local proceedings; the party is not judge of the entire nation.

Each selected hero receives a short personal closing scene based on their quest. Unfinished personal arcs end with a credible next step, not sudden offscreen transformation. A lost tram can still be awaiting repair; a healed friendship may still include disagreement.

**Final image:** the first post-crisis public cart stops at a small settlement that had been erased from the service map. Its driver asks whether anyone has a letter, a repair request, or space for another passenger. At Mira's table, somebody moves a chair so somebody else can sit down.

The sequel hook is optional: mail arrives from another region asking how the Reach changed its agreements. It invites another adventure without undoing the victory or declaring a new world-ending threat.

## Endings and accountable compromise

| Ending | How it is chosen | What gets better | Cost and unfinished duty |
| --- | --- | --- | --- |
| E-01 — The Shared Current | Choose reduced operation with public records, locally accessible stops, trained operators, and a maintained spirit bypass | Reliable services survive; authority is divided and reviewable | Less peak output; slower industrial expansion; residents must actually staff and fund oversight |
| E-02 — The Stewardship Winter | Choose temporary central coordination under independently held shutdown authority, published records, and a fixed review date | Essential services return quickly using experienced crews | Trust remains strained; temporary authority may outlast its deadline unless people remain engaged |
| E-03 — Many Small Lights | Choose safe separation into local systems, or arrive through emergency shutdown after defeat | Coercive regional control ends; local consent and spirit routes become easier to protect | Some districts face longer repairs and uneven capacity; mutual-aid obligations prevent autonomy becoming abandonment |

E-01 is the most thematically complete synthesis, not a secret reward for selecting “nice” at every prompt. MQ-12 provides baseline means for any party to choose it if they accept its work and cost. Optional quests improve how convincing and comfortable it feels. E-02 can be a responsible transitional choice; it does not let Veyra police herself. E-03 is hopeful and viable, not the “bad ending.”

**Veyra modifier:** cooperative surrender and testimony / arrest after resistance / refusal followed by removal from operations. In every version her authorization and suppression are documented. **Ruon modifier:** accepts supervised repair / contests parts of the hearing while serving restrictions / remains detained after unresolved testimony. **Community modifier:** strong shared networks / adequate but strained recovery / fractured recovery with a visible repair agenda. None erases a person's prior choices.

## Reveal ladder — do not leak early

| Earliest mission | The party can know | What remains unknown |
| --- | --- | --- |
| MQ-01 | Quarry coercion, imported machine, Jin's interest in Ruon | Sponsor, purpose of shipments, network risk |
| MQ-02 | Emberwatch supply connection | Whether the director approved specific abuses |
| MQ-03 | Veyra authorized supply control; Rusk expanded coercion | Why safety warnings matter regionally |
| MQ-04 | The network helps people and Veyra is personally committed | Whether postponement is genuinely necessary |
| MQ-06–08 | Three different omissions and disturbances | Combined failure mechanism; exact refusal date |
| MQ-09 | The combined danger and Veyra's informed refusal | Whether she will surrender control under crisis |
| MQ-14 | The practical cost of every viable repair | No reserved franchise mysteries are answered |



---

<a id="part-05"></a>

# 05 — Personal stories and the people who teach

## Use and timing

Personal quests are optional story arcs for selected heroes, not prerequisites for finishing the campaign. Introduce their emotional question early, develop it in the listed region, and give a small ending in MQ-15. The player chooses the hero's action; the author supplies believable tensions and reactions.

A party-neutral main route always exists. Absent heroes neither complete their quests offscreen nor receive unearned growth. When a hero is present but their quest is unfinished, their epilogue offers a next step. Personal-quest resolutions change dialogue, relationships, and local support; they do not automatically choose a discipline or grant new bending.

## PQ-01 — The Place You Stay / Kaya

**Available:** after MQ-03 in Saltstep, with Kaya present. **Other character:** Miri, she/her, 24, a childhood neighbor now running a lantern workshop.

Miri asks Kaya to help hang festival lanterns, then asks why she never replied to a letter about the old shop fire. Kaya assumes it contained blame. It actually asked her to help with repairs and attend the shop's reopening. Miri still thinks her intervention was brave; she also thinks leaving was hurtful.

**Beats:** awkward reunion during a ladder mishap; discover that Miri kept one scorched roof tile; defend the workshop from a predatory supply seizure; decide whether Kaya will speak publicly about both the rescue and the damage.

**Choices:** acknowledge the whole incident and stay to repair; offer private material help while declining the public telling; or refuse the conversation and leave. The first two permit reconciliation at different levels of intimacy. Money alone does not substitute for an apology, and no currency system is needed: the help is labor and access to supplies.

**Return:** Miri uses the scorched tile as a lantern weight rather than a shrine to grievance. If Kaya left again, the workshop recovers without her; the door remains open but the greeting is cooler.

**Line:** “You keep asking whether you belong here. I asked whether you were coming on Thursday.”

## PQ-02 — A Table Is Not a Truce / Tenzo

**Available:** after MQ-04, Six-Ladle Kitchen. **Other character:** Dema, he/him, 37, a cook organizing unpaid kitchen workers.

Tenzo offers a reconciliation dinner between workers and their contractor. Dema asks whether they will be paid for cooking the dinner at which everybody discusses paying them. Tenzo recognizes that he has made the vulnerable people do the work of making the dispute pleasant.

**Beats:** prepare a meal with short, funny kitchen tasks; discover the unpaid shifts; keep the kitchen open during a walkout without coercing the strikers; confront the contractor with the workers present.

**Choices:** support a negotiated staffed kitchen with posted conditions; help workers establish their own public meal service; or keep personal mediation private and accept that some workers leave. All feed people tonight. Only the first two change who bears the cost tomorrow.

**Payoff:** a functioning kitchen helps MQ-12 shelters, but basic food provision never depends solely on this quest. Tenzo is offered a meal made by somebody else and must accept it.

**Line:** “I wanted everyone at the same table.” / “Then stop making us stand behind it.”

## PQ-03 — The Door That Said Everyone / Nilak

**Available:** Saltstep outreach room after MQ-03; develops at Causeway clinic. **Other character:** Aru, with Dr. Iset.

Nilak recognizes the healing-house emblem above a public notice promising open treatment. Aru explains the continuing registration barriers and the small reforms they have achieved. Nilak must face the fact that leaving was defensible and staying to care for a parent was also defensible.

**Beats:** treat a manageable queue with consent and triage; interview a patient repeatedly turned away; document how the rule works; find an arrangement that funds follow-up care without residency exclusion.

**Choices:** publish the discrepancy and help build an independent partnership; support Aru's open-admission reform with external monitoring; or leave with supplies for a temporary clinic and accept its limited reach. Emergency care is provided on all routes. No patient dies to punish the wrong conversation.

**Payoff:** Nilak learns to hand over care. Aru's advanced instruction remains available regardless of whether they agree about the best institution, provided mutual professional safety is respected.

**Line:** “You left because you could not accept it. I stayed because my father could not leave with me. Please stop making those the same decision.”

## PQ-04 — The River Does Not Keep Still / Sura

**Available:** Reedglass after meeting local pilots. **Other character:** Vessa, she/her, 25, the friend injured on Sura's later crossing; now a boat-repair worker with a lasting limp.

Vessa has not come for an apology tour. She needs a shipment moved and refuses to use Sura's proposed ice route. Sura can interpret this as an insult or ask what Vessa knows about the water. Vessa's knowledge comes from work, not a mystical lesson delivered by disability.

**Beats:** survey competing routes; discover a channel that changes after warm rain; perform a cooperative rescue of stranded cargo animals; return to finish the original delivery.

**Choices:** follow Vessa's safer boat plan; adapt an ice route together with tested escape openings; or insist on the original plan and suffer a recoverable cargo loss. The joint ice solution preserves Sura's creativity while changing her method.

**Payoff:** Vessa may trust Sura professionally before forgiving her personally. No healing scene removes the limp as a reward. In MQ-13 Sura can suggest a barrier with an intentional release.

**Line:** “I don't need you to be frightened of rivers. I need you to believe they exist when you aren't looking at them.”

## PQ-05 — Somebody Else's Hands / Bo

**Available:** Copper Orchard; Renn has brought Bo's former crew to seek work.

Bo finds Renn directing a repair and instinctively takes over. The crew's affection makes the problem harder to see. They have come to work with him, not wait while he carries everything heavy and decides everything difficult.

**Beats:** inspect an orchard viaduct; hear workers' practical concerns; arrange a lift through a confined work area; let a named crew member direct the sequence while Bo performs a limited assigned task.

**Choices:** share leadership and credit; remain foreman with explicit delegated authority and a review; or do the job alone and finish with an exhausted Bo and a crew that finds other work. The third result is a relationship cost, not collapse and mass injury.

**Payoff:** Renn can lead a finale crew if trusted. If not, a baseline crew handles the work with more delay. Bo's closing scene can be proud, uneasy, or the beginning of another attempt.

**Line:** “You trust us with your life.” / “Of course.” / “Try trusting us with the schedule.”

## PQ-06 — What the Map Left Out / Lin Mei

**Available:** Reedglass; use before MQ-09 for maximum effect, still available afterward.

Fenn recognizes Lin Mei's survey mark on an eviction notice. The underlying map labeled inhabited seasonal dwellings as temporary structures and left out an unregistered footpath used to reach the school. Lin Mei can explain the professional standard; the explanation does not erase the result.

**Beats:** walk the omitted path with residents; compare official measurements with flood markers; redraw the route using both; present an amended report carrying Lin Mei's name and the residents' authorship.

**Choices:** publish the omission and contest the relocation order; negotiate a corrected route privately to obtain faster relief, then commit to later disclosure; or file a technical correction without accepting personal responsibility. The last fixes part of the plan but leaves trust low.

**Payoff:** the revised map becomes practical evacuation evidence. The main campaign can obtain equivalent data through residents if this quest is skipped; Lin Mei's personal acknowledgment cannot be replaced by another hero.

**Line:** “You drew our house.” / “Yes.” / “You didn't draw a way to get home.”

## PQ-07 — The Promise on the Wind / Nima

**Available:** Bellweather Heights; Sena recognizes Nima immediately.

Sena gives Nima a deliberately dull task: keep the night warning watch while other volunteers repair a shelter. A more exciting rumor offers a tempting detour. The task is meaningful because someone actually needs rest, not because obedience itself is the lesson.

**Beats:** make amends for leaving without word; improve the watch's accessibility; choose whether to stay, arrange a real replacement, or slip away; handle a small night emergency using preparation rather than spectacle.

**Choices:** keep the watch personally; arrange a willing, trained substitute and take an urgent outside task; or leave without a handoff and cause a missed delivery and strained trust. The first two show responsibility in different ways. Duty does not require sacrificing all freedom or remaining in one place forever.

**Payoff:** Nima writes a route and return date before traveling again. The sanctuary gains a warning volunteer, not a magically perfected institution.

**Line:** “I did help someone.” / “I believe you. I also needed to know you weren't under a fallen roof.”

## PQ-08 — Letters Are Not Yours / Jinu

**Available:** Bellweather mail shelter; a Saltstep courier can introduce it earlier.

A sealed personal letter is wrongly bundled with public dispatches. Jinu knows enough gossip to guess its contents. Another courier wants to open it “in case it matters.” At the same time, an official safety bulletin in the bag has been deliberately marked private. The story distinguishes privacy from institutional secrecy.

**Beats:** sort the misrouted bundle without reading private contents; locate addressees through permitted clues; obtain consent for any personal disclosure; publish the official bulletin through a verified public copy.

**Choices:** deliver the personal letter sealed; ask the addressee to authorize shared reading after delivery; or open it first and confess. Opening gives no unique power or superior ending. Concealment can delay reconciliation; honest admission permits repair without forcing forgiveness.

**Payoff:** the private letter concerns a changed family plan, not the final villain's secret. Jinu's growth is caring about delivery when curiosity remains unsatisfied. Public dispatch help improves finale warnings separately.

**Line:** “The order belongs to the people it affects. That letter belongs to the person whose name is on it.”

## PQ-09 — The Lesson You Keep / Riko

**Available:** Copper Orchard traveling theater, after MQ-04.

Riko finds Seli correcting actors' movements backstage. An old guard recognizes their technique and asks whether Seli will train security crews again. Seli initially presents the past as ordinary employment. Testimony reveals that her training helped guards immobilize workers during abusive detentions.

**Beats:** a comic rehearsal with obviously bad stage combat; an uncomfortable recognition; interview two former trainees with different experiences; stop a current coercive recruitment attempt; decide what testimony and future teaching require.

**Choices:** persuade Seli to testify and teach only under an accountable public program; report the evidence without preserving the relationship; or accept a private apology while other witnesses pursue the public case. The last gives Riko personal closure at the cost of less direct participation, not a pardon issued on victims' behalf.

**Payoff:** Riko can keep the skill while rejecting its misuse. There is no revelation that she was a villain all along or must stop being a non-bender combatant to become good.

**Line:** “You taught me where a body is vulnerable. You left out what that makes us responsible for.”

## PQ-10 — The Right to Repair / Wen

**Available:** Emberwatch workshop; concludes in Copper Orchard or Causeway.

Wen recognizes a derivative of her regulator inside the vane controls. Her original had an accessible manual release; the licensed version requires a company key. Edda asks whether Wen wants to prove that her invention was good or make this version safe.

**Beats:** compare the designs; meet a mechanic barred from servicing equipment in her own district; demonstrate a safe repair under observation; decide how to distribute the corrected design and train maintainers.

**Choices:** publish an open repair manual with supervised demonstrations; place it in a public-service trust with resident-held access; or license the fix to Commonworks under enforceable external service terms. The last is acceptable only with independent stop authority and public records; another vague promise repeats the problem.

**Payoff:** extra local maintainers improve crisis recovery. Wen can criticize her own design without accepting responsibility for decisions made by other people. She does not cure the whole network with a wrench in one cutscene.

**Line:** “You sold them a regulator.” / “I did.” / “Now give us the part where we get to say no.”

## Discipline teacher stories

These five stories establish access to the existing rare paths; they are not mandatory for a viable build. All five are introduced in Act II before the first level-five commitment opportunity. Teachers maintain reachable hours or a contact route afterward. Never require a randomly found object, a particular moral ending, or a different party member's element to qualify.

The existing game may require an implementation decision about holding or revisiting a specialization choice. That is explicitly pending; this document does not assert that respecialization exists. The narrative must not encourage a player to choose blindly and discover the desired teacher much later.

| ID / teacher | Scene and lesson | Available route and result | Existing flag |
| --- | --- | --- | --- |
| TR-01 — A Safe Place for Thunder / Luli | A training line powers festival lamps. The student must recognize when to stop, ground the apparatus safely with the crew, and practice separation and release under instruction. Luli refuses a “prove your bravery” stunt. | At Emberwatch's power yard after MQ-03. Accessible noncombat practice; optional supervised defense scene. Fire students become eligible for the lightning path; power is still developed through the existing progression. | `learned_lightning` |
| TR-02 — Ask Before You Heal / Aru | An outreach patient wants pain relief but declines one proposed treatment. Observe, explain, obtain consent, and choose an appropriate intervention with ordinary medicine available. | Northern healing-house outreach room at Saltstep, no polar travel. Water students receive advanced instruction; respectful institutional disagreement does not close it. Nilak's prior basic training remains valid. | `learned_healing` |
| TR-03 — The Earth in the Hinge / Hesh | A public lift's bent hinge can be forced open or carefully understood. Hesh teaches how impurities, material limits, and inspection matter. A worker's observation supplies the key clue. | Hesh visits the Saltstep rail annex in Act II; later at Copper Orchard. Earth students demonstrate supervised control, not instant mastery. | `learned_metalbending` |
| TR-04 — The Note You Leave Out / Oru | A bell test overwhelms bystanders. Practice controlled airflow and learn how the bell carries sound, then construct a warning with quiet space and a visual alternative. | Oru performs at the festival and teaches at the coastal weather mast before returning to Bellweather. Air students practice air projection; any gameplay unlock must first receive the power review in Part 01. No new canonical discipline, universal temple ban, or mind-reading ability is implied. | `learned_soundbending` |
| TR-05 — A Switch Anyone Can Reach / Edda | A loading platform has excellent powered operation and an unreachable emergency stop. Reposition controls, test a manual fallback, and teach another person to use it. | Public workshop annex after MQ-03. Non-benders gain access to engineering; no claim that benders are incapable of learning ordinary engineering outside playable kits. | `learned_engineering` |

Teachers can decline unsafe behavior and offer another supervised attempt. They do not refuse the entire campaign's only training opportunity because a child chose a teasing line. A learned flag records access; it is not a universal declaration that every character has completed years of practice.

## Personal epilogue variants

| Hero | If the central lesson was acted on | If the quest was skipped or unresolved |
| --- | --- | --- |
| Kaya | Makes a return appointment and keeps it | Stops herself before saying “I'll be back”; writes an actual date |
| Tenzo | Eats at a worker-run table without supervising | Dema offers a place and asks him to listen first |
| Nilak | Hands over a shift and rests | Aru sends an invitation to talk without asking for agreement |
| Sura | Asks a pilot for the latest river conditions | Keeps a damaged route sketch instead of pretending the mistake never happened |
| Bo | Renn directs the repair; Bo takes the assigned task | Bo asks who wants to lead the next small job |
| Lin Mei | Gives residents space to correct her map | Leaves a blank margin headed “What I need to ask” |
| Nima | Keeps a quiet promise no one applauds | Sends the message he should have sent earlier |
| Jinu | Delivers a sealed letter, never learning its contents | Asks permission before telling an amusing story about someone else |
| Riko | Shares a skill with clear duties attached | Invites another person to a practice session instead of training alone |
| Wen | Watches someone modify her design successfully | Adds a readable stop procedure before her own signature |



---

<a id="part-06"></a>

# 06 — Thirty side missions

## Authoring rules

These are authored optional stories, not thirty mandatory tasks on a map. Give at most a few local invitations at once. Discover them through people, objects, and visible oddities. Most should take 10–25 minutes; quieter scenes can take less. They may overlap main locations so the world feels inhabited rather than divided into quest rooms.

Each mission has a concrete desire, an action beyond selecting a moral label, and a changed detail on return. Rewards below are narrative benefits, not unimplemented inventory items or guaranteed numerical bonuses. A failed optional story must not block a main clue or make a campaign ending impossible. No party composition is required; named heroes add reactions, not mandatory solutions.

## Ba Dan and the quarry

### SQ-01 — Too Many Cabbages

**Hook:** Pella insists the party identify Bo-shan's cart by its disastrous stacking. **Available:** MQ-01; existing `pella_asked` conversation remains the entry.

**Play:** follow cabbage leaves from an overturned delivery sled; use a packing list to distinguish Bo-shan's cargo from company supplies; find a note in the cart rail saying he went down to help trapped workers. The cart can appear at the existing finale as already designed; its combat use does not decide whether Bo-shan survives.

**Choice:** return the cabbage shipment to hungry families or reserve part as food for the rescue crew. Either can be generous if the party explains the need. Taking all of it for leverage hurts trust.

**Payoff:** Bo-shan is found in the victory rescue, or returns at MQ-11 after an Act I loss. Pella first hugs him, then berates his packing. If the player investigated, she names the party in a corrected list of everyone who helped. **Persistent change:** his later cart has a sensible lower stack and one absurd ceremonial cabbage on top.

### SQ-02 — A Very Official Gate

**Hook:** Dorin refuses to open an empty side gate because the key register says it is already open.

**Play:** inspect the register, ask who changed the hinge, and follow a chicken through a gap beside the fence. The gate was rehung backward during repairs, and nobody updated the notation. Dorin is following a real accountability rule badly, not protecting a villain.

**Choice:** quietly fix the register and hardware, or help Dorin publicly explain the mistake. Mocking him opens the gate but makes him reluctant to admit the next error. A supportive public explanation teaches him that accountability can survive embarrassment.

**Payoff:** a shortcut to the village garden; later he corrects a bad evacuation instruction instead of mechanically repeating it. **Return line:** “I checked both sides of the gate this time.” Kaya, if present, desperately tries not to grin. **Failure:** losing the key requires a brief supervised handoff; no lockout from the village.

### SQ-03 — Gao's Other Ledger

**Hook:** Gao keeps sending food away while claiming his storeroom is full.

**Play:** deliver two ordinary parcels, notice an overdue wholesale invoice, and ask whether the recipients were charged. Gao has been quietly absorbing other families' debts. He does not want their private circumstances announced in the square.

**Choice:** arrange a discreet supplier extension; invite neighbors to create a mutual food fund with consent; or publicly celebrate Gao's generosity against his wishes. Public praise gets donations but strains his trust and embarrasses recipients. The quieter routes let them contribute without naming who needed help.

**Payoff:** Gao accepts assistance instead of remaining the limitless generous merchant. A healthy supply arrangement adds comfort at the finale shelters. Basic shelter food exists regardless. **Return detail:** a new jar labeled “For whoever needs it; no speeches.” **Ruon-trade variant:** he accepts help for neighbors but still refuses to pretend he approves of the party's earlier action.

### SQ-04 — The House Beneath the Steps

**Hook:** an elderly resident hears tapping beneath her front steps and insists the house is complaining.

**Play:** investigate crawlspace noises and discover turtle ducks resting in a dry recess beside an old drainage culvert. A discarded chisel taps against stone where backed-up runoff reaches it. The birds did not collect the tools or cause the blockage. The blocked drain also threatens the foundation.

**Choice:** prepare a quiet sheltered bank with the local keeper, or rebuild the steps around safe access to the existing recess while clearing drainage. Let the birds move of their own accord. Shooing them off leaves the tapping and drain problem unresolved; they settle inconveniently beside Gao’s doorway.

**Payoff:** a practical culvert sketch later contributes to MQ-11's preparations, though workers can supply the required main-route knowledge independently. **Return detail:** small webbed tracks on a purpose-built ramp; the resident now boasts of owning “a house with tenants.” **Tone:** mostly funny, with a satisfying physical repair and no secret conspiracy.

### SQ-05 — Load-Bearing Dessert

**Hook:** the village festival's stacked plum cake keeps leaning; three bakers blame one another's fillings.

**Play:** sample competing layers, inspect the crooked table, and discover that a repair wedge was removed to prop open the pantry. Let heroes contribute through observation, cooking, craft, or asking the child who saw it happen. No firebender is required to make a cake.

**Choice:** restore the original towering cake, or invite a collaborative redesign into several smaller cakes. Both can win affection. Secretly adding stone support makes an impressive display and an inedible lower layer; the response is comic disappointment, not injury.

**Payoff:** a festival mural and a recurring recipe argument. Bo, if present, decorates whichever arrangement the party chose. He keeps adjusting one tiny sugar leaf while the bakers wait to start serving; someone finally hands him a plate and asks him to choose a slice. **Return:** the bakers keep a little plaque for the winning design. The quest has no necessary main-plot connection; people deserve an afternoon that is only about cake.

## Saltstep and Emberwatch

### SQ-06 — Permit for a Goose

**Hook:** a goose has occupied the customs stool and lunges at the official seal whenever it is lifted.

**Play:** watch where it goes when the desk is quiet, discover its displaced nesting platform among the parade decorations, and ask the handler why it keeps returning. Carry the platform back or clear an appropriate nearby space under the handler’s advice. Chasing it creates a harmless market commotion. Its honking is not an imitation of bells or speech.

**Choice:** return the old nesting spot and reroute one stall, or construct a safer nearby platform with the handler's help. An honorary permit is an optional joke after the animal's need is met, not a magical legal solution.

**Payoff:** the customs officer finally stamps a form reading “Reason for delay: goose.” On a later visit the bird is peacefully preening while the officer checks that the stool is clear. **Persistent change:** a small no-stall zone beside the nesting place. The goose gains no signaling or speech ability.

### SQ-07 — The Fish That Owed Money

**Hook:** a fisher claims a river fish stole his lucky copper and now owes him interest.

**Play:** reconstruct his escalating story, inspect the net, and discover the copper is a washer from the dock winch. He has been covering up dropping a borrowed tool into the water. A simple retrieval becomes a small navigation puzzle around feeding fish.

**Choice:** help him admit the mistake and repair the winch, or quietly replace the part while insisting he tell the owner. If the party joins the embellished fish story, it entertains the market but leaves a friendship strained when the truth emerges.

**Payoff:** he later tells the accurate story with even more theatrical flourishes. Sura appreciates a lie that has become craftsmanship but still makes him apologize. **Return detail:** a hand-painted sign, “All debts settled except to fish.” No combat, no unique equipment reward, and no tie to Veyra's scheme.

### SQ-08 — A Wedding at Low Tide

**Hook:** two families have planned incompatible wedding customs on adjacent floating platforms.

**Play:** interview the couple before mediating relatives, help anchor both platforms, and test a route between the ceremonies before the tide rises. One family wants a quiet lantern vow; the other wants a loud public meal. The couple wants time together rather than perfect historical correctness.

**Choice:** sequence both customs, invent a joint ceremony the couple approves, or protect their wish for a small private vow and a later feast. No option is inherently the “authentic” one. The party is not entitled to overrule the couple for faction standing.

**Payoff:** a warm celebration with optional awkward dancing. Tenzo can cook, Jinu can announce, and any party can carry chairs and listen. **Return detail:** a picture painted by a young guest includes whichever arrangement actually happened. A happy local story provides respite after Emberwatch's evidence.

### SQ-09 — The Lighthouse Has a Day Off

**Hook:** Emberwatch's civilian lantern keeper asks for one afternoon away, then returns three times to check whether the party understands.

**Play:** learn the ordinary signal schedule, clean a lens, and sort a misleading company signal from a real ferry message using the posted code. The keeper wants to visit an estranged brother at a market, not attend a secret meeting.

**Choice:** cover the shift, arrange a trained replacement, or persuade the keeper to cancel the visit out of caution. The first two support both service and a private life; the third preserves safety but delays reconciliation.

**Payoff:** if encouraged, the brother later comes to help maintain the lantern. A trained backup contributes to clearer crisis communications. **Return detail:** two cups by the lens-cleaning bench. No real-time endurance minigame is required; use a few authored tasks and a time transition.

### SQ-10 — The Noodle Thief at the Door

**Hook:** bowls vanish only when left on doorsteps, while food on occupied tables is untouched.

**Play:** compare doorways, put an agreed test bowl at a clear threshold, and meet Latch. They think unattended threshold gifts are for travelers between places. One shopkeeper has been leaving a bowl for a neighbor, not a spirit.

**Choice:** establish a marked offering place with clear consent, or politely refuse the practice and escort Latch to a willing host. Attempting a humiliating trap makes them scatter the stolen spoons but never justifies beating them.

**Payoff:** Latch returns bowls and learns to ask. They appear later only if welcomed; their absence never blocks the marsh investigation. **Return line:** “This bowl is for you. This bowl is for Mara.” / “Shall I wait until she gets hers?” Latch has noticed that Mara keeps arriving after dinner has gone. A small misunderstanding gives the player a usable spirit rule before a high-stakes negotiation.

## Causeway City

### SQ-11 — First in Line

**Hook:** patients argue when a well-dressed man is taken through the clinic queue.

**Play:** ask Dr. Iset what happened before accusing anyone. The man has urgent symptoms; his clothes caused an incorrect assumption. A second patient has actually been waiting through repeated administrative referrals. The scene contains both legitimate triage and real exclusion.

**Choice:** help clarify the queue with privacy-preserving explanations and direct the stranded patient to care, or simply demand first-come-first-served order. The latter feels fair but disrupts clinical priority; Iset explains and retains responsibility for treatment. The player cannot force unsafe medical decisions.

**Payoff:** pictorial queue cards and a volunteer who explains the process without disclosing diagnoses. Nilak can learn without becoming the institution's sole savior. **Return:** the argumentative pair recognize each other and share a seat. **Failure:** an irritated conversation can be repaired; nobody dies as a moral lesson.

### SQ-12 — Heroes, Approximately

**Hook:** a street troupe is performing the quarry adventure with one wildly inaccurate hero representing the entire party.

**Play:** watch enough to learn that the supposed villain is a talking wheel, help repair a prop, and discover the troupe is using the show to fund a public meal. They have mixed rumor with invention, including an account of the Ruon decision that may contradict the save.

**Choice:** permit affectionate exaggeration while correcting the harmful factual claim; demand a factual documentary, producing a hilariously flat rehearsal; or join a deliberately labeled fantasy version. The troupe must not state the opposite of the actual custody decision as historical fact after correction.

**Payoff:** a personalized comic scene and a local reputation grounded in the party's real actions. Riko loves the terrible mystery subplot. **Return detail:** a small sign distinguishes “inspired by events” from the public notice summarizing what actually happened.

### SQ-13 — The Wrong Apology

**Hook:** two schoolchildren have been ordered to apologize for the same broken wall, and both refuse.

**Play:** inspect the damage, speak to each child separately, and find that one made an unsafe bending practice attempt while the other loosened a brace to retrieve a trapped toy. A teacher assumed the bender did everything. The non-bender is ashamed of being ignored and afraid of the real consequence.

**Choice:** organize an honest shared repair with different responsibilities, or ask adults to handle the repair while children give truthful accounts. Do not force equal blame simply because there are two children. A public shame performance is rejected by the teacher once the facts are understood.

**Payoff:** a repaired practice space with clear safety boundaries and manual tools. **Return detail:** both children argue over whose new warning picture is easier to understand. The story distinguishes ability from character without treating children as ideological symbols.

### SQ-14 — The Meeting Upstairs

**Hook:** an organizer asks the party why several invited residents never attend the assembly.

**Play:** deliver invitations and listen. One resident cannot manage the stairs, another works during the meeting, another cannot read the notice, and another simply disagrees with the organizer. Resolve access problems without assuming attendance is owed.

**Choice:** move the meeting and split its hours, or create genuinely representative small meetings with recorded questions and accountable messengers. Both require more effort than building one ramp. The dissenter may still decline and must remain a legitimate neighbor.

**Payoff:** broader testimony at MQ-10 and a visible change to the assembly courtyard. Fenn admits she confused an open invitation with a practical chance to participate. **Return detail:** the former stair-only platform stores chairs; speakers now stand on the same level as listeners. No magical consensus follows.

### SQ-15 — A Lantern for Someone

**Hook:** an old boatbuilder lights a lantern every evening and refuses to explain whom it is for.

**Play:** repair the lantern frame, walk quietly to the water, and encounter the Last Lantern spirit. The boatbuilder eventually chooses to say that her sister died years ago. The ritual is company for memory, not denial awaiting the party's correction.

**Choice:** sit in silence, share a memory with permission, or help her leave the lantern and go to dinner. None is the single healthy answer. Do not demand a confession or have the spirit mimic the dead sister.

**Payoff:** an unhurried scene in which nothing is solved and someone feels less alone. The spirit may follow the warm light for a few steps and leave. **Return detail:** a second chair appears, whether or not it is occupied. There is no combat reward, hidden main clue, or sarcastic companion line.

## Copper Orchard

### SQ-16 — Return to Sender, Eventually

**Hook:** an ostrich horse named Parcel has eaten its delivery labels and is refusing all destinations.

**Play:** identify parcels from external clues and permitted inspection with senders, follow Parcel's old route, and learn that its handler has changed the order without changing its routine. A fragile pot, a sack of work gloves, and an extremely aromatic cheese provide recognizable clues. Do not open private letters.

**Choice:** retrain the route patiently or redesign deliveries around a second handler. Dragging Parcel from stop to stop completes the immediate job badly and earns a comic boycott: it sits down whenever the party appears.

**Payoff:** a reliable ordinary delivery service; Parcel may carry shelter bedding later if treated well. It never becomes a summoned combat pet. **Return detail:** pictorial tags clipped beyond nibbling height. Jinu, if present, becomes professionally offended that the animal has fewer complaints than she does.

### SQ-17 — The Longest Shortcut

**Hook:** two rail workers each swear their route through the yard is faster; neither has timed a complete trip.

**Play:** follow both routes, account for signal waits, help a slow handcart through a narrow turn, and identify a third route that is longer in distance but reliably open. The puzzle is observation and sequencing, not a timed test that excludes younger players.

**Choice:** designate the reliable route for public use, retain the shorter specialist path with clear conditions, or post both honestly. No single route must be best for everyone. A worker with a walking aid reveals a constraint the original competition ignored.

**Payoff:** a shortcut for return visits and a very modest prize: the right to name it. **Return detail:** the sign reads the chosen name, followed by somebody's dissent in smaller writing. Lin Mei considers the argument excellent fieldwork.

### SQ-18 — A Union of One

**Hook:** a potter has declared a strike against himself and refuses to explain the placards.

**Play:** discover that he accepted too many orders, works through every meal, and blames his apprentice for being slower. His comic protest is an admission that the employer and the overworked worker are the same man, but the apprentice is still genuinely affected.

**Choice:** renegotiate deadlines with customers and guarantee the apprentice's hours; recruit temporary help with fair terms; or finish urgent orders personally while leaving the underlying schedule unresolved. The third is kind tonight and insufficient tomorrow, shown on return.

**Payoff:** a workshop that either adopts a sane rhythm or asks for help again. No “lazy worker” punch line. Tenzo and Bo may recognize themselves without delivering a moral lecture. **Return detail:** the potter frames the apprentice's first independent bowl instead of his own production record.

### SQ-19 — The Unbreakable Cup

**Hook:** a ceramic artist offers a cup she claims cannot break. Hesh declines to test it because he knows her too well.

**Play:** try harmless demonstrations, spot the switched cups, and learn that her struggling workshop sells beauty rather than durability. She fears nobody will pay for something that can fail. A buyer actually wants a meaningful retirement gift, not indestructible crockery.

**Choice:** help her describe the work honestly and repair the misleading sale, or stage an explicitly comic demonstration with a disclosed trick. Concealing the deception produces a later complaint and a chance to apologize, not permanent ruin.

**Payoff:** a little exhibition on repaired objects. Wen values a clear repair guide; Lin Mei admires the truthful label. **Return detail:** one cracked cup holds flowers beside a sign reading “Still useful.” The object is environmental, not mandatory inventory loot.

### SQ-20 — The Orchard That Rings

**Hook:** fruit trees ring faintly when freight passes, and workers disagree about whether the orchard is haunted.

**Play:** triangulate the sound, discover metal fruit guards installed by a retired crew, and find an elderly gardener's unfinished tune hidden in their arrangement. The guards also frighten pests. Their accidental music is a material phenomenon, not a spirit encounter.

**Choice:** restore the gardener's intended tune or work with current residents to compose a new one. Preserve a quiet interval for neighboring homes either way. The old gardener may prefer the new version and surprise everyone who expected resistance.

**Payoff:** a short ambient melody on later rail visits and a peaceful place for a personal conversation. Any party can rearrange the guards with ladders and help. Oru or an air hero adds insight, not exclusive access. **Failure:** a terrible first tune becomes an affectionate local joke and another attempt.

## Reedglass Marsh

### SQ-21 — Lessons That Float

**Hook:** the floating school's lessons keep arriving at the wrong bank.

**Play:** trace a changed mooring pattern, ask families about working hours, and rebuild the school route with two safe gathering points. Fenn assumed the old route was traditional; it was actually a convenient improvisation from a flood years ago.

**Choice:** move the school between banks on a predictable schedule or establish smaller shared lessons with a rotating teacher. Residents choose how to share the work. The party cannot solve education by donating one stack of books and leaving.

**Payoff:** children draw the route correctly, and adults can find a dependable meeting place. This can help assembly access without making a political speech the school's purpose. **Return detail:** lessons on the board include practical navigation and a spectacularly inaccurate drawing of the heroes. No child is put in combat danger.

### SQ-22 — The Frog Choir Auditions

**Hook:** a musician insists that local frogs have rejected him as conductor.

**Play:** listen at different pools, notice that he has blocked the animals' evening route with his stage, and shift the platform. The frogs have not formed a political organization; their chorus follows ordinary habitat and timing. The musician keeps interpreting it theatrically.

**Choice:** adapt the performance around natural pauses or abandon the choir idea and write a piece inspired by it. Attempting to force the chorus with loud noise sends the frogs away until the next quiet evening.

**Payoff:** an absurdly earnest concert or a smaller, better song. Sura initially suggests ice seating, which works only if it stays out of the habitat. **Return detail:** a tiny stage sign credits “The Frogs, whenever available.” The story exists for delight and environmental attentiveness, with no mastermind behind it.

### SQ-23 — Auntie's Moving House

**Hook:** Auntie Silt has moved a mudbank—and the edge of somebody's garden—three paces to the left.

**Play:** walk the old and new bank, learn that the spirit follows a natural wet-silt route, and inspect the gardener's clogged drainage trench. Both have a real need: passage and a secure home. The spirit did not understand a fence as a request.

**Choice:** create a damp corridor around the garden with a clear marker Auntie can perceive, or move part of the planting onto a raised bed and agree on seasonal space. A human deed alone does not compel the spirit; an old spirit route alone does not erase the resident.

**Payoff:** a practical small agreement that foreshadows the main spirit negotiation. **Return detail:** Auntie proudly calls the new drainage trench “excellent architecture.” A party that mocked either participant must first repair trust through useful work, not choose an apology keyword.

### SQ-24 — The Water Said It Twice

**Hook:** a pond repeats one embarrassing sentence, and three residents want it stopped for different reasons.

**Play:** identify a localized repeated current associated with the blocked passage, discover when the sentence was spoken, and learn that it was a private rehearsal of an apology rather than a public insult. The water contains one carried echo, not a library of the town's secrets.

**Choice:** redirect the tiny loop discreetly, ask the speaker whether to let the intended recipient hear it, or leave without intervening. Revealing it without consent hurts trust even if the apology is sweet.

**Payoff:** an optional early demonstration of the Still Keeper's bounded effect. Required understanding remains available in MQ-07. **Return detail:** normal frog calls replace the repeated sentence. Jinu has a particularly pointed reaction if she has completed PQ-08. No past event changes when the echo ends.

### SQ-25 — A Perfectly Ordinary Fishing Trip

**Hook:** an exhausted marsh worker invites the party to sit on a bank and explicitly asks them not to solve anything.

**Play:** choose bait, watch fish, tell or listen to an optional story, and help untangle a line without turning it into a crisis. One party member insists something suspicious must be happening. Nothing suspicious is happening.

**Choice:** fish, sketch, cook, or simply sit. Let the decider choose the tone of a short conversation: funny, reflective, or quiet. The worker can decline questions about the network and remain friendly.

**Payoff:** a shared memory, a meal if appropriate, and a later greeting by name. No hidden optimal reward is attached to catching the biggest fish. **Return detail:** a familiar place to pause after a difficult mission. If Sura boasts, a local may beat her catch without undermining her expertise. Not every moment must prove the world's thesis.

## Bellweather Heights

### SQ-26 — Tea Against the Wind

**Hook:** a mountain tea stall serves every cup half empty because the owner's dramatic pouring routine spills the rest.

**Play:** carry cups between windbreaks, compare different stall positions, and discover that the owner values the view more than efficient service. Customers value both. A beautifully simple folding screen solves more than an elaborate new machine.

**Choice:** build a movable windbreak preserving the view, relocate the service table a few paces, or openly advertise a small tasting portion with an ordinary refill. The last is honest theater instead of fraud.

**Payoff:** a warm rest point overlooking the valley. Tenzo is professionally pained; Nima offers an unnecessary but stylish air-assisted solution. Any party can assemble the screen. **Return detail:** the owner names a tea after the chosen solution and dramatically denies ever spilling anything.

### SQ-27 — The Kite with No Bender

**Hook:** a non-bender child's kite has been excluded from a competition because its unusual stabilizer is deemed an unfair aid.

**Play:** read the actual contest rules, compare how competitors already use bending, and help test the kite in a safe field. The child designed it with a grandparent and wants credit for the engineering, not pity or a rigged win.

**Choice:** propose a common unassisted category, establish clearly labeled open and craft categories, or stage a public exhibition separate from the contest. Do not guarantee first place merely because the cause is sympathetic.

**Payoff:** a fairer event and visible recognition of the child's work. Wen can be delighted without taking over the design. **Return detail:** the kite may win, place, or simply fly well according to the authored exhibition outcome; the important change is a transparent rule. No real-time precision challenge is necessary.

### SQ-28 — The Crooked Statue

**Hook:** caretakers argue over straightening a sanctuary founder's leaning statue.

**Play:** inspect its footing, read differing recollections, and learn that the statue was intentionally carved slightly off-center because the founder used a walking stick and disliked heroic poses. It now also has a real foundation fault. Respecting the original does not mean ignoring the hazard.

**Choice:** stabilize the footing while keeping the intended stance, or make a new support visibly commemorating later caretakers' work. Recarving a generic perfect hero is allowed as a contested local proposal but should meet informed resistance, not be presented as automatic improvement.

**Payoff:** a small ceremony thanking the people who did maintenance rather than one flawless founder. **Return detail:** a new plaque credits the mason who first noticed the crack. Nima can admit that tradition occasionally contains better jokes than he expected.

### SQ-29 — Loud Enough for Everyone

**Hook:** a new alarm bell is painfully loud near the tower and still ineffective for some lower households.

**Play:** walk the warning route, ask residents how they receive messages, and test flags, lanterns, and a runner relay alongside the bell. Include a deaf carpenter, Nel, they/them, 36, as a skilled collaborator with their own preferences; no healing cure is proposed.

**Choice:** build a layered signal network with local operators, or adopt smaller district signals linked to the sanctuary. Both require agreed meanings and maintenance. Simply increasing volume is shown to be inadequate without humiliating the person who suggested it.

**Payoff:** the silent flag line in MQ-13 reaches more people and earns a callback. The campaign supplies a baseline warning system if this quest is skipped. **Return detail:** Nel corrects Oru's visual demonstration and then teases him about his whistling. Access is practical collaboration, not a charity medal.

### SQ-30 — Who Sweeps the Sky?

**Hook:** a popular viewpoint remains spotless, but no one knows who cleans it.

**Play:** follow a trail of repaired broom bindings, meet an elderly caretaker and two students working before dawn, and learn that visitors attribute the cleanliness to “temple harmony.” The workers are amused until the party realizes their tools are failing and their labor is unrecognized.

**Choice:** organize a voluntary rotating cleanup, pay for a stable caretaker arrangement through the sanctuary budget in the fiction, or make a one-time personal effort and leave the larger question open. Do not recruit coerced children or make unpaid service proof of spiritual worth.

**Payoff:** a public work rota, better tools, or a sincere but temporary thank-you. **Return detail:** a little sign reads “The sky was here already. We swept the steps.” The campaign's idea of responsibility lands through ordinary work after so many spectacular rescues.

## Side-story callback index

| Main scene | Optional stories it may remember | Baseline if skipped |
| --- | --- | --- |
| MQ-04 festival | SQ-05, SQ-06, SQ-08, SQ-10 | Ordinary vendors, handlers, and musicians still populate it |
| MQ-10 assembly | SQ-03, SQ-11, SQ-12, SQ-14, SQ-21 | Required witnesses and an accessible basic meeting remain available |
| MQ-11 Ba Dan return | SQ-01, SQ-02, SQ-03, SQ-04 | Main route still accounts for the missing people and drainage knowledge |
| MQ-12 shelter planning | SQ-03, SQ-09, SQ-16, SQ-18 | Public crews provide minimum food, signals, and transport |
| MQ-13 crisis | SQ-09, SQ-14, SQ-21, SQ-23, SQ-29 | All fronts have a viable basic response; more property damage and slower recovery are possible |
| MQ-15 epilogue | Any completed local story | Never falsely claim the party did a quest it skipped |



---

<a id="part-07"></a>

# 07 — Dialogue and scene reference

## Voice and delivery

These are original authored scene drafts. They establish voice and intended branching; they are not drop-in engine data. Implementers may split them into shorter screens, preserve their meaning, and use only the speakers present. A scene's prerequisites outrank a good line.

Keep most turns under 35 words and most displays to two to four short turns. Leave room for a player choice, a physical action, or silence. Do not have every character explain the theme. A blunt request about a gate can carry more than a paragraph about equality.

Use accents through vocabulary and rhythm, never phonetic caricature. National origin does not determine intelligence, politeness, or worldview. Jinu's digressions, Lin Mei's quiet precision, Tenzo's hospitality, and Riko's economy must sound distinct even without nameplates.

The narrator notices concrete things and lets the reader discover what is funny. It does not append a sarcastic verdict to every mishap, announce who is morally correct, reveal private thoughts without perspective, or describe absent party members acting. Use “the party” or “you” without a fixed count; solo play must still make sense.

### Humor and natural speech — revision 1.2

Start with what someone wants right now: to serve dinner, finish a model, win a game, impress a visitor, or avoid admitting a small mistake. The funny turn should follow from how that person pursues it. A character can be perfectly sincere while the situation is ridiculous.

- **Give the joke an owner.** Hide the nameplates. If five characters could deliver the same line unchanged, rewrite the exchange around a particular habit, relationship, or piece of shared history.
- **Make something happen.** A demonstration, interruption, misplaced object, overambitious performance, or change of position can carry the laugh. Physical comedy can grow large when the consequences remain appropriate. Avoid inserting a witty comment where the action already works.
- **Vary the rhythm.** Not every exchange needs a setup, correction, comeback, and final comeback. A reply can be useful, affectionate, embarrassed, or absent. Stop after the strongest beat; do not explain why it was funny.
- **Keep people capable.** A specialist can overlook a mundane constraint without forgetting their profession. A guard can enjoy a turtle duck and still protect the village. Another person's fear or injury is not a prop for demonstrating how witty a hero is.
- **Leave room for ordinary talk.** Requests, disagreements, half-finished thoughts, enthusiasm, and quiet company help the cast feel alive. A line does not need a metaphor or a lesson to earn its place.
- **Use callbacks that develop.** Return to a specific experience with a changed circumstance. Do not repeat a catchphrase, food complaint, official form, or boast with a different noun indefinitely.
- **Respect the scene's stakes.** Resolve immediate danger before comic business. A reunion may contain an awkward smile if the people initiate it, but grief, surrender, testimony, and defeat do not require an authorial punchline.

Watch for stock filler such as “Well, that happened,” “That's reassuring,” “Technically…,” “I meant to do that,” and “which is somehow worse”; also watch for grand proverbs about trivial chores, bureaucracy applied to every animal, and objects assigned sarcastic human opinions. These are diagnostic patterns, not a word blacklist. Keep a line only if this scene earns it. Replacing the noun in a familiar template is not a new joke.

**Review aloud:** establish the want; follow the cause of the comic turn; check whether the voices are distinct; cut a redundant final tag; check that the exchange still feels like people responding to one another. If removing the joke improves the scene, remove it. If a physical beat is essential, put it in the production brief; until staged, use a short, clearly attributed narrative description rather than pretending the animation exists.

## DLG-01 — Mira's table

**When:** MQ-01, first conversation. **Purpose:** a human obligation before the mystery. **Speakers:** Mira, Pella, player; Kaya optional.

*A fifth bowl sits beneath the table, covered with a cloth. Pella nudges it into view with one shoe.*

**Mira:** The quarry stopped sending stone a month ago. I sent four people to ask why. None came back.

**Pella:** Five.

**Mira:** Pella—

**Pella:** Bo-shan went before them. Before still counts.

*Mira places the covered bowl on the table.*

**Mira:** Yes. Five people from this village. And the crews who were already working there.

**Player choices:**

- **“Tell us their names.”** Mira names her four messengers: Leto, Amri, Hesra, and Senn. Pella supplies Bo-shan before she can finish. These names become established here; do not swap them in later rescue scenes.
- **“What can you tell us about the gate?”** Mira describes posted guards and cut communication; Pella asks the player to remember the cart as well.
- **“We can look. We can't promise the result.”** Mira answers below. This is honesty, not a cold choice deserving a penalty.

**Mira:** Then tell me what you find. Even if you have to come back without them.

**Optional Kaya:** We can leave now.

**Mira:** You can eat first.

**Pella:** Don't take that bowl. That's his.

*Mira slides another bowl toward the player. The covered one stays where Pella can see it.*

*Leave the names available through conversation history or journal prose; do not quiz the player later.*

## DLG-02 — The cook and the first night

**When:** after a safe return from a regional mission; Tenzo present. **Optional partner:** Wen. **Purpose:** friendship through ordinary friction.

*If Wen's repair scene occurred, she demonstrates a new handle on the cold stove. It turns smoothly. Tenzo sets his usual cooking pot on top; the pot covers the handle.*

**Tenzo:** How do I reach it?

**Wen:** Lift the pot a little.

*He does. She turns the handle. He lowers the pot, then fills it from a water jug. Wen watches the water rise.*

**Wen:** Is all of that going in?

**Tenzo:** And the potatoes.

*Wen takes her spanner back out.*

**Wen:** Leave it there. I need to measure round it.

*The stove stays unlit while she moves the handle. Later she checks that Tenzo can reach both the control and the shutoff with the pot in place.*

**Solo or absent-Wen variant:** Tenzo cooks with the innkeeper and asks which pan they normally use. They exchange a practical cooking tip. If Wen is present but no repair occurred, let her ask about the stove; do not invent a repair for the joke. A comic replacement is not mandatory.

**Player close:** ask about Tenzo's grandmother / help chop vegetables / sit and listen. These are pacing choices, not hidden approval scores.

## DLG-03 — After the trade

**When:** Ruon was traded and Gao knows through a returning witness. **Purpose:** consequence without permanent condemnation. **Speakers:** Gao and player.

**Gao:** You handed him to Jin.

**Player:** We needed the key.

**Gao:** I know what you needed. I'm asking what she is allowed to do with him now.

**Player choices:**

- **“We made a bad bargain. We intend to find him.”**
- **“We were trying to reach the people inside.”**
- **“Ruon hurt people. He should answer for it.”**

**Gao, first response:** Then find him. Don't ask me to call it settled before he gets a say.

**Gao, second response:** I wanted them home too. But you left a prisoner with Jin, and now nobody here can check on him.

**Gao, third response:** Then bring him before Mira and the people he kept in there. Let them hear his account.

*He pushes a water skin toward the party.*

**Gao:** That's for the road.

**Player:** I thought you were angry.

**Gao:** I am. Drink anyway.

**Later repair variant:** after a lawful transfer or rescue, Gao says, “I heard you went back. That matters.” He does not say the original trade was secretly wise or forget it in unrelated dialogue.

## DLG-04 — Veyra at the handwheel

**When:** MQ-04 after the demonstration rescue. **Knowledge limit:** the party knows her supply order, not yet the combined danger or rejected shutdown recommendation.

*Veyra tests a handwheel. A child turns it from the other side with a supervisor standing close. The little lift rises.*

**Veyra:** Before this, there were three people in the district who could move that load. Everyone planned their day around those three people.

**Player:** And now?

**Veyra:** Now the people with the load can choose when to move it.

**Optional Riko:** Who gets the key?

**Neutral player option with the same meaning:** “Who controls access?”

**Veyra:** The public workshop. A duplicate at the clinic. It is a good question. Keep asking it.

**Player:** We asked it at Ba Dan.

*She removes a wet work glove slowly.*

**Veyra:** I signed the supply order. I did not authorize people to be held in a quarry.

**Player:** Your contractor did.

**Veyra:** Then I have more work to do than replacing a contractor.

**Player choices:**

- **“Let the workers leave, and let us see the records.”** Veyra agrees to issue a release instruction and inspection access; later scenes check whether the instruction was actually obeyed.
- **“Show us what this project is supposed to do.”** Veyra gives the invitation without treating curiosity as endorsement.
- **“We will inspect it independently.”** Veyra asks for accurate findings, offers access, and visibly dislikes giving up control.

**Veyra:** My mother once waited on a roof while three offices argued over whose boat it was.

*A pause. No joke follows.*

**Veyra:** I wanted a world where the boat belonged to the rescue.

**Player:** Then help us make sure someone can launch it without asking you.

*Her answer is not immediate. End the display here. Let the player move through the working festival before the next conversation.*

## DLG-05 — Latch learns “mine”

**When:** SQ-10, before a threshold agreement. **Speakers:** Latch, shopkeeper, player.

**Latch:** You put dinner out again.

**Shopkeeper:** For Mara. She lives upstairs.

*Latch looks up, still holding the bowl.*

**Latch:** She never comes down.

**Shopkeeper:** You never leave it long enough.

**Player choices:**

- **“Ask before you take it.”**
- **“We'll make a marked place for gifts, if the shop agrees.”**
- **“This doorway isn't an offering place.”**

**Latch, on being asked to ask:** Every time?

**Player:** Until you have an agreement.

*Latch holds out the bowl. The shopkeeper takes it and puts it back beside the step.*

**Latch:** Does Mara know it is for Mara?

**Shopkeeper:** I'll go and tell her.

*Latch waits while the shopkeeper calls upstairs. For once, Mara reaches her supper first.*

**Other choices:** the marked offering place is established only with the shopkeeper's consent; a refusal leads to the willing-host route in SQ-10. Returning this bowl does not itself settle whether future food will be offered.

**Boundary:** Latch learns a local rule. This does not make them an expert on all human property or permanently bound to serve the party.

## DLG-06 — A survey correction

**When:** PQ-06, after walking the omitted path; Lin Mei present. **Speakers:** Lin Mei, Fenn; Bo optional.

**Fenn:** That's your mark.

**Lin Mei:** It is.

**Fenn:** So when I tell them we live here, why do they keep showing me your map?

**Lin Mei:** I recorded the building. I marked it temporary.

**Fenn:** It is temporary. We move it when the water rises. We still live in it.

*Lin Mei sets down the survey case.*

**Lin Mei:** I need to write that plainly.

**Optional Bo:** We can fix the path.

**Fenn:** That would help. I also want the next map to know we exist.

**Player choices for Lin Mei's action:** amend and publish with named resident contributors / negotiate urgent correction and commit to public follow-up / submit only a technical correction. The scene continues according to PQ-06; no fixed line forces the player's apology.

**If she accepts responsibility:** “I'll correct my map. Will you walk the route with me before I send it back?” Publication and credit still follow the player's selected PQ-06 outcome.

**If she remains defensive:** “The classification was standard.” Fenn replies, “Who decides that? I want to speak to them.”

## DLG-07 — The reunion

**When:** Bo-shan has actually been released, in MQ-01 victory or MQ-11 recovery. **Speakers:** Pella, Bo-shan, Mira. **Purpose:** fulfill the opening promise.

*Pella reaches him at a run. Her first attempt to speak fails. She hugs him hard enough that he winces; she notices and loosens her grip.*

**Bo-shan:** I'm all right.

**Pella:** You're shaking.

**Bo-shan:** I know. Let me sit down a minute.

*She keeps hold of his sleeve as they reach the table.*

**Pella:** You said Tuesday.

**Bo-shan:** I did.

**Pella:** I waited by the road.

**Bo-shan:** I'm sorry.

*Mira places his covered bowl on the table.*

**Mira:** Careful. It's hot.

**Bo-shan:** Thank you.

**Pella:** She kept making it. In case you came back hungry.

*Let the scene end on sitting down. No new villain reveal, quest reward tally, or combat tutorial line interrupts it.*

## DLG-08 — Ruon's account

**When:** MQ-11 or an earlier lawful local hearing; Ruon present and able to speak. **Speakers:** Ruon, a named worker witness, Mira, player.

**Ruon:** The province stopped paying. My guards still had families. I thought keeping the gate gave us something to bargain with.

**Worker:** You bargained with our way out.

**Ruon:** Yes.

**Mira:** Did you know people were being held below?

**Ruon:** Before the end of the first week. I told myself I was keeping Grumbler from making it worse.

**Worker:** You could have opened the gate.

**Ruon:** Yes.

**Player choices:** ask him to identify the order and signatories / ask what repair he can offer under supervision / press him on a specific harm. A protective player can insist on fair treatment without calling him innocent.

**If `ruon_carried_you` is true:** the player may mention the rescue. Mira answers, “That belongs in the account. So does the gate.”

**If traded:** Ruon may add, “You can want a fair hearing now. I would have liked one when I was cheaper than a key.” Do not force him to forgive the party before he provides truthful evidence.

## DLG-09 — The assembly: one clear demand

**When:** MQ-10 after the proof is public. **Purpose:** dramatize a choice through concrete terms. **Speakers:** Veyra, Fenn, player; Riko optional.

**Veyra:** If you stop the works tonight, the low district loses its pumps.

**Fenn:** We know. We live there.

**Veyra:** Then you understand why this cannot become a room full of people taking turns at the controls.

**Player options:**

- **“Keep trained operators. Give residents an independent way to stop unsafe operation.”** Names a workable accountability demand.
- **“Publish the readings and let a mixed safety team decide the next stage.”** Prioritizes evidence and staged operation.
- **“You concealed the warning. You must leave command now.”** Legitimate removal demand; a replacement team must be named in the following action.

**Veyra:** And if they make the wrong call?

**Optional Riko:** You had the warning. You kept the works running.

**Neutral reply:** “Then the records stay public, and they answer for it too.”

**Fenn:** We need a stop control in the low district. If something goes wrong at night, we can't wait for someone from your office.

*Do not conclude with automatic applause or universal agreement. A pump alarm interrupts. The player's credibility is tested by helping the whole room, including opponents, leave safely.*

## DLG-10 — The promise at the water

**When:** MQ-14, after a physical bypass is open. **Speakers:** Still Keeper, player; Sura or Nima optional.

**Still Keeper:** You said the water would stop changing.

**Player:** Someone promised that. They could not keep it.

**Still Keeper:** I kept it.

*The same leaf circles past for the third time.*

**Player:** The leaf has nowhere to go.

**Still Keeper:** It has not been lost.

**Player choices:**

- **“Come and see the new passage.”** Demonstrate a traversable route and name its caretakers.
- **“Tell us what you need to recognize the route when it changes.”** Leads to markers, seasonal review, and an agreed meeting place.
- **“We must release the pressure now. We will leave the passage open.”** Direct crisis route; requires the downstream warning already secured.

**Optional Sura:** A river can keep a path without keeping still. I had to learn that too.

**Optional Nima:** We can promise to return. We can write down when.

**Still Keeper:** Humans write many things.

**Player:** Then judge us when we return.

*The leaf moves through the opening. The spirit's choice is shown in the water before it is explained in words.*

## DLG-11 — Veyra lets go

**When:** MQ-14 cooperative-surrender branch only; relief, warning, stop control, and passage are secured. **Purpose:** accountability through an action.

**Veyra:** The manual release needs a second operator.

**Player:** We have one.

**Veyra:** They don't know this station.

**Player:** You can teach them.

*Veyra looks at the central control key. She puts it on the dry ledge between them.*

**Veyra:** After this, they will ask whether I knew.

**Player:** You can answer them.

**Veyra:** You make that sound very small.

**Player:** I don't think it is.

*She begins explaining the release procedure to the local operator. The party does not reassure her that everyone will forgive her.*

**Resistance variant:** she refuses to relinquish the key; the party secures external release access and removes her from command. Her final useful technical warning may still be genuine. Do not reuse the surrender image or imply she consented.

## DLG-12 — The chair

**When:** MQ-15, Ba Dan; all required missing-person resolutions have occurred. **Speakers:** Mira, Pella, player, selected heroes through optional tags.

**Pella:** Are you leaving again?

**Player choices:** “Soon.” / “After supper.” / “We haven't decided.”

**Mira, after “Soon”:** I'll wrap something for the road.

**Mira, after “After supper”:** I'll put another pot on.

**Mira, after “We haven't decided”:** All right. There's room here tonight.

*Someone arrives carrying a bowl and finds the table full. Pella drags over a chair without being asked.*

*The chair rocks. Pella catches the bowl before anything spills.*

**Pella:** Hold this a minute.

*She gives the bowl to its owner and crouches to fit a small wedge beneath the short leg. She tests the seat before handing it back.*

*The party can join the repair, keep eating while another resident helps, or quietly watch. The final image works because the village has people besides the heroes who will answer.*

## Travel and camp banter

Each exchange plays only when both listed heroes are selected, nearby, and free to speak. Use sparingly; never interrupt new testimony, grief, or an urgent instruction. Once a personal quest changes a relationship, prefer its later variant.

| Pair / context | Exchange |
| --- | --- |
| Kaya / Lin Mei, unstable bridge | **Lin Mei:** “Wait. That edge has moved since yesterday.” *Kaya steps back from it.* **Kaya:** “Show me.” Let a useful warning be useful. |
| Tenzo / Sura, trail lunch | **Tenzo:** “Just a taste.” *Sura offers him a piece of dried fish. While she folds the packet, he reaches for another. She opens it again without a word.* |
| Bo / Nima, carrying supplies | **Bo:** “Take the blanket roll.” *Nima balances it on his head. After three careful steps it falls. He starts again; Bo keeps walking.* **Nima:** “Wait. I've nearly got it.” |
| Jinu / Riko, first road together | **Jinu:** “Left at the mill. There used to be a sign, but the miller's daughter painted over it. Lovely painting. Useless if you need the mill.” **Riko:** “This left?” **Jinu:** “Yes! That one.” |
| Wen / Lin Mei, a board game | *Wen reaches to put the pieces away.* **Lin Mei:** “Leave them.” **Wen:** “We said one game.” **Lin Mei:** “I know. I'm asking for another.” |
| Nilak / Kaya, minor bruise | **Nilak:** “Can you bend your elbow?” *Kaya tries and stops.* **Kaya:** “Not all the way.” **Nilak:** “All right. Let me look.” |
| Nima / Jinu, departing late | *Nima arrives carrying a breakfast bun.* **Jinu:** “I've got your bag. Eat while we walk.” *He breaks the bun and offers her half.* |
| Riko / Bo, preparing to pass a blind corner | **Bo:** “I'll go first.” **Riko:** “You watch the path. I'll check above us.” **Bo:** “All right.” |
| Sura / Wen, a stuck box lid | *Sura holds the box steady while Wen works the latch.* **Wen:** “Pull.” *They both pull toward themselves.* **Sura:** “Which way?” *Wen lets go, laughing, and shows her.* |
| Tenzo / Nilak, both overworking | **Tenzo:** “Sit down. I'll bring you a bowl.” **Nilak:** “Bring yours too.” *Tenzo starts to answer, then gets a second bowl.* |
| Kaya / Riko, watching a mystery | **Kaya:** “You said the steward did it.” **Riko:** “He did.” **Kaya:** “They arrested the gardener.” **Riko:** “There's another act.” *She settles back into her seat.* |
| Lin Mei / Nima, a game at a safe rest stop | **Nima:** “Closest pebble to the stick wins.” *Lin Mei crouches to inspect the two closest stones.* **Nima:** “You can just look.” *She is already reaching for her measuring cord.* |
| Jinu / Sura, a fishing story | **Sura:** “Wouldn't fit in the boat.” **Jinu:** “How did you get it home?” **Sura:** “Towed it.” **Jinu:** “Through the ice?” *Sura takes a drink. Jinu waits.* |
| Wen / Riko, manual control | **Wen:** “Try it with the power off.” *Riko opens the gate by hand.* **Riko:** “Stiff at the end.” **Wen:** “Show me where.” |
| Bo / Tenzo, cake contest | *Bo places a tiny sugar leaf on the cake, removes it, and turns it around.* **Tenzo:** “The judging's started.” **Bo:** “I know.” *He turns the leaf back.* |
| Nima / Nilak, safe rest | *Nilak sits down and finds a folded cloak behind his head.* **Nilak:** “Is this yours?” **Nima:** “Keep it there. I'm taking the grass.” |
| Kaya / Wen, a repaired toy boat | *Kaya places a pebble aboard. The toy lists. Wen moves the pebble to the middle; it rights itself. Kaya adds another.* **Wen:** “How many passengers are you planning?” *Kaya shows her the handful she has ready.* |
| Sura / Lin Mei, after PQ-04 | **Sura:** “Tell me what I'm missing.” **Lin Mei:** “The southern channel.” **Sura:** “Good. We start there.” |
| Jinu / Riko, after PQ-08 | **Jinu:** “I heard something you might like.” **Riko:** “Are you allowed to tell me?” **Jinu:** “I asked.” **Riko:** “Then I'm listening.” |
| Bo / Nima, after both personal quests | **Bo:** “Your watch?” **Nima:** “My watch.” **Bo:** “Wake me if you need help.” **Nima:** “I will. You can actually sleep.” |

For solo play, use location observations or a brief exchange with an actually present local. Silence is preferable to inventing an absent companion.

These are scene seeds, including ordinary and sincere exchanges, not a queue of jokes to fire whenever walking begins. Physical beats need staging or concise narration before integration. Safe-rest and performance contexts must actually exist; do not play a board-game exchange during travel or invent a performance the party has not attended.

## Reaction precedence

When more than one line could play, choose: immediate danger → new consequence of a player choice → current personal-quest turn → first visit → ordinary banter. A joke should never overwrite a needed acknowledgment. Check the information timeline before selecting a confident accusation or a technical explanation.



---

<a id="part-08"></a>

# 08 — A world between missions

## Environmental direction

The Reach should feel like somewhere people already live. Put hooks in ordinary activity: a line that moves wrong, a delivery animal who knows where to go, a public stair everyone has learned to work around. A useful object should look handled. The new works can be beautiful without being morally innocent; an old tradition can be beautiful without being beyond change.

This document supplies narrative art direction only. The existing art bible, portraits, map geometry, camera, and asset specifications remain authoritative. No new mechanic or moving environment is assumed. A tide, train journey, festival, or weather change can be expressed through alternate authored scenes and map states.

## Eighteen discoveries with no compulsory quest log

| ID / discovery | What the player sees or does | What makes it worth finding |
| --- | --- | --- |
| EV-01 — The bench with a view of nothing | A bench faces a plain wall. An older worker explains that the afternoon sun warms it out of the wind; “the view is for people who haven't been looking at things all day.” | Rest as a real local preference. Leave the bench where it is. |
| EV-02 — Quarry lunch whistles | Two workers disagree about a three-note lunch signal. A younger worker uses a hand sign and both instantly understand. | Old and new practice cooperating without a speech. Add a quiet echo later during rescue work. |
| EV-03 — The repaired stone lion | A village ornament has a mismatched ear repaired by a child. The adult mason has signed beneath the child's name. | Shared credit, visible affection, a humorous lopsided face. No secret dungeon switch. |
| EV-04 — Rain on the empty cart | Under a shelter, rain hits the cart rails like a simple instrument. The player can pause and hear a few notes. After Bo-shan returns, his cargo changes the sound. | A tiny sensory consequence of the main rescue. |
| EV-05 — The spoon auction | Two market sellers compete over which bent spoon was owned by a famous unnamed sailor. A child bends a third spoon accidentally. | Good-natured fraud ends in a cheap meal and laughter, without a famous-character cameo. |
| EV-06 — A floating argument | Two neighbors argue from boats that slowly separate. By the time they drift back together, each has forgotten the exact wording of the dispute. | Playful geography. Their friendship is the stable fact, not the argument. |
| EV-07 — The outpost garden | Beans climb an old spear rack. A retired cook explains which military fittings make excellent trellises. | History being reused rather than erased; visual proof the outpost's civilian activity is real. |
| EV-08 — A public light for mending | At dusk, people gather under a new lamp to mend clothes, read, and play games. The player can help thread a needle. | Show why the network matters before asking players to change it. |
| EV-09 — Two menus | A stall's handwritten menu and picture menu list the same meals. A literate customer uses the pictures because they are clearer. | Accessibility as competent ordinary design, not a special lesson. |
| EV-10 — The stair that became a shelf | After SQ-14, the old assembly stair stores cups and blankets. Its former exclusivity has acquired a useful, funny second life. | Local decisions change objects, not just dialogue counters. |
| EV-11 — Chess at the freight yard | A passing train moves the board's pieces. Two players calmly negotiate which shifts count; a third newcomer insists this cannot be the real game. | Regional playfulness. Let the player join without inventing a complete chess engine. |
| EV-12 — The work-glove tree | Retiring rail workers tie an old glove to a sheltered beam beside a tree. A new apprentice hangs a tiny practice glove prematurely. | Affectionate anticipation of a working life; returning after guild reform adds different hands. |
| EV-13 — Waterline family marks | Flood-height marks include household names and dates. One family adds a mark for the day their new boat first floated, lower than the disaster lines. | A history that records joy as well as harm. No mandatory lore dump. |
| EV-14 — Lights in the reeds | Fireflies brighten the reeds while a vendor finishes packing. The party can stay for the view; the insects are neither a spirit sign nor a weather instrument. | A little beauty with no assignment attached. |
| EV-15 — Auntie Silt's favorite pebble | A pebble is displayed on a muddy plinth. Auntie says it has improved considerably over the last two hundred years and refuses to elaborate. | Spirit priorities need not all be human-sized or plot-relevant. |
| EV-16 — A cloud's bad portrait | Sanctuary students sketch the same cloud. One draws an exact rectangle and insists it captures the cloud's mood. | Young people being funny without every conversation teaching philosophy. |
| EV-17 — The bell's quiet shadow | A terrace sheltered from the bell allows visitors to see it move without hearing much. A caretaker likes the sight and never attends the loud demonstration. | Different experiences of a landmark can be equally meaningful. |
| EV-18 — The best machine in the works | A worker points past the giant turbines to a reliable tea-water tap. “Never missed a shift.” Veyra, if present before the confrontation, agrees. | Scale is not the measure of value. The machine remains useful in every ending. |

## Five places for simply spending time

**The Bent Ladle:** a small Saltstep lunch boat with six mismatched seats. It rocks whenever the proprietor becomes emphatic. Conversations stop for the same passing ferry every afternoon. Use it for humorous debriefs and small reconciliations.

**The Orchard Underpass:** sunlight and petals through iron beams; occasional freight rumble; warm stone ledges. Characters can discuss work or say nothing. Avoid placing combat on every peaceful return.

**The Listening Terrace:** high air, low voices, worn cushions, tea kept under a weight. Use after Bellweather's rescue. It can hold a thoughtful conversation without becoming a mandatory philosophy lecture.

**Mira's Table:** familiar and crowded, with changing dishes and repaired chairs. It is the emotional home base even when Ba Dan is politically complicated. People eat before resolving every disagreement.

**The Little Reed Landing:** a safe bench above a marsh channel, frogs and ordinary insects, one gently swinging lamp. Use after the grief scene or a difficult apology. Leave pauses in the dialogue.

## A season of small celebrations

| Celebration | Activity | Emotional role | Change after the campaign |
| --- | --- | --- | --- |
| First Cart Supper, Ba Dan | Shared meal when reliable quarry deliveries resume | A victory people can eat and sit inside | On a delayed rescue, the meal happens later; never play a success feast during occupation |
| Low-Tide Market, Saltstep | Temporary stalls on exposed platforms; absurd bargaining | Movement, invention, cultural mixing | New access arrangements alter docking space without making the market sterile |
| Long-Light Evening, Causeway | Games, reading, mending, performances under public lamps | Make a technological gain emotionally concrete | Lights remain in all endings where local generation is working; shortages are shown honestly through rotating service |
| Orchard Wind Day, Copper Orchard | Fruit guards ring; repair crews share food | Pride in maintenance and intergenerational skill | Open training adds new names to the workbench register |
| Returning Wind, Bellweather | Kites, route flags, modest family picnics | Joy in change and motion | Signals and customs include the people who helped redesign them |

These events are local inventions. Do not market them in the fiction as ancient canonical festivals or assign one national meaning to every participant.

## What a return visit should show

At least one visual detail, one changed activity, and one relationship response should reflect a substantial local resolution. Prefer a small dependable set of authored changes over dozens of generic praise lines.

| Place | Before | After constructive involvement | After unresolved or costly outcome |
| --- | --- | --- | --- |
| Ba Dan | Waiting bowls, stalled carts, rumors | Occupied seats, rebuilt cart, workers speaking at the table | Mutual-aid meal, guarded shipments, people asking for a return date |
| Emberwatch | Mixed public supplies and guarded crates | Posted manifests and shared keys | Locked office but public clinic still operating; investigation unfinished |
| Copper Orchard | Empty passenger platform, busy freight | Predictable passenger window and training bench | Longer foot traffic, temporary shelters, workers planning the next negotiation |
| Reedglass | Repeated ripples, disputed passages | Water moving through a marked crossing; revised pump schedule | Temporary bypass under supervision, reduced service and visible repair work |
| Bellweather | Conflicting bells, inaccessible warning practice | Flags, lamps, trained local relays | Caretakers working extra shifts while a mast awaits repair |
| Causeway | Bright centralized service, unequal access | Public records, staffed local controls, meals served by a wider team | Limited hours, open repair meetings, a credible agenda rather than instant perfection |

Do not erase all unpleasantness on a good route or all joy on a difficult one. A community is more than a verdict on the player.

## Encounter variety without mandatory feature expansion

The narrative can support a runaway wagon, a stalled tram rescue, document seizure, a crowded assembly evacuation, a spirit crossing, and a workshop defense. Each needs a distinct objective and rhythm. Where the current engine only supports a normal battle, choose one honest adaptation: resolve the noncombat objective in adjacent dialogue, author it with supported map interactions, or mark the feature as future work. Do not promise a dynamic flood simulation, moving trains, escort AI, or mass civilian pathfinding because a paragraph describes one.

Human opposition includes private guards, desperate workers, opportunistic thieves, and frightened personnel. Defeat usually means disarm, retreat, capture, or surrender. Hostile spirits can be avoided, redirected, or calmed after a physical objective; do not make every spirit attack proof of inherent evil. Wildlife should rarely be a lethal enemy. There is no need for disposable monsters in every empty patch of grass.

## Discovery rhythm

Within a typical region visit, aim for one striking view, one funny complication, one conversation that changes an assumption, one optional quiet moment, and a satisfying action sequence if the visit needs one. This is a pacing guide, not a compulsory repeated formula. Some visits can be almost entirely peaceful. A family should be able to say, “Let's go back to the noodle boat,” without that trip becoming another urgent rescue.



---

<a id="part-09"></a>

# 09 — Continuity, decisions, and handoff

## Status and authority

This package is narrative design, version 1.0, created at the owner's request on 17 September 2026. Its new story decisions are the default source for further writing. They are not statements that the game already supports or contains this material. All plot developments, quests, NPCs, and regional locations added here are original project fiction.

The owner's instruction to create this story bible supersedes the older roadmap sentence postponing further story writing pending visual review. It authorizes narrative development; it does not itself authorize replacing the renderer, adding mechanics, or discarding the art direction. No game code is part of this work.

If a later owner decision changes a fact, update its owning document and this ledger together. If an agent finds a technical limitation, preserve the intended story outcome and report a concrete adaptation rather than quietly rewriting a character or branch. Do not treat a sample line as authority over a stated character fact.

## Repository evidence used

Reviewed snapshot: **`3c3dcfbad652b49185232f0a0ab41b1f94f43967`** in `jaredbahr/Avatarrpg`. Later repository work may have changed implementation; compare before integrating.

| Source | Facts preserved |
| --- | --- |
| [README.md](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/README.md) | Four Nations Tactics, family play, one to six participants, post-Korra era, original-character fan work, rotating decider |
| [characters.ts](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/src/content/characters.ts) | Ten hero names, identities, elements, jobs, motivations, exact IDs |
| [act1.ts](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/src/content/story/act1.ts) | Ba Dan, missing workers, Ruon branches, Jin, Grumbler, loss routes, outpost teaser |
| [disciplines.ts](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/src/content/disciplines.ts) | Existing discipline names, level-five commitment, five story-gated paths and flags, viable default paths |
| [Art bible](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/docs/art-bible.md) and individual portrait briefs in `docs/art/prompts/portraits/` | Existing silhouettes, appearances, age ranges, presentation tone; explicit pronouns where provided |
| [ADR 0011](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/docs/adr/0011-free-roam-world-model.md) | Region-based exploration direction, persistent consequences, journal derived from story conditions; inventory/economy outside current scope |
| [Roadmap](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/docs/roadmap.md) and [working guide](https://github.com/jaredbahr/Avatarrpg/blob/3c3dcfbad652b49185232f0a0ab41b1f94f43967/CLAUDE.md) | Current project boundaries, original cast requirement, content/implementation separation, current phase status |

The user explicitly clarified that inspiration must remain thematic and that the game should not repeat or closely parallel Avatar plots. Document 01's originality section is a binding writing constraint for this version.

## Immutable fact ledger for this version

| Fact | Owner document / rule |
| --- | --- |
| Era is after Korra and before Seven Havens, before its cataclysm, by owner’s setting choice | 01; exact year and current Avatar circumstances reserved; old forty-year assumption withdrawn |
| Four nations and the United Republic remain explicit world anchors; Republic City is named and distinct from Causeway | 01, 02; no claim that every destination is already playable |
| Parcel is an ostrich horse; SQ-04 uses turtle ducks; the old novel species are retired | 02, SQ-04, SQ-06, SQ-07, SQ-16, EV-14 |
| No living lion turtle appears; companion SQ-35 is retired | 02; historical references do not prove contemporary survival or extinction |
| The local spirit passage is not a new world portal | 01, 02; the named spirits have individual limits |
| Sound Bending and the Disruptor Array remain code integration issues, not canon precedent | 01; do not extend their unsupported lore claims |
| No canon character appears or rescues the party | 01 |
| No playable character is secretly the Avatar or a canon hero's relative | 01 |
| Ba Dan has five specifically identified missing residents at opening | 01 and DLG-01: four messengers, plus Bo-shan who went earlier |
| Four messengers are Leto, Amri, Hesra, and Senn | 07; additional unnamed quarry workers are a separate group |
| Bo-shan and Bo are unrelated people | 03 |
| Lin Mei's display name has a space; game ID is `lin_mei`; portrait/sprite keys use `linmei` | 03; do not unify these by guessing |
| Nilak is a young man using he/him | 03; portrait and character description control over a stray discipline flavor line |
| Nima uses he/him; Jinu uses she/her; Wen uses she/her | 03; preserve existing identities |
| Ruon is responsible for the gate occupation; his rescue of the party does not absolve him | 03, 04, 07 |
| Jin wants Ruon for the leverage his testimony and records provide | 03, 04; she is not his relative or secret benevolent custodian |
| Grumbler was Ruon's quartermaster and knowingly ran coercive quarry operations | 03 |
| Emberwatch was decommissioned nine years before opening and has recently been reused | 02; no uninterrupted secret garrison |
| Veyra signed supply control; Rusk expanded it; Veyra later suppressed a warranted shutdown | 02, 03, 04; none may transfer all blame to the other |
| Veyra's mother, Meren, survived the Blackreed Flood | 02, 03; no later revenge-origin retcon |
| Blackreed Flood was seven years ago; vane trials began eighteen months ago | 02; trials cannot cause the earlier flood |
| The Current is civil water/power/transport infrastructure | 02; no spirit-energy cannon, empire, or permanent bending removal |
| Still Keeper repeats local current patterns, not time | 02, 07 |
| Latch respects a clear threshold refusal and cannot read minds | 02 |
| Originality is thematic, with no one-to-one Avatar character or episode template | 01 |

## Plot causality in plain language

1. Public services in the Reach depend on inconsistent local arrangements. Veyra builds useful alternatives and earns trust.
2. Expanding the network requires stone, labor, reliable schedules, and controllable water. Her model treats exceptions as obstacles.
3. Supply-control authority lets Rusk and contractors seize labor and material. Ba Dan experiences the consequences before it understands the cause.
4. The network's vanes interfere with a local spirit passage. The Still Keeper's attempt to preserve an unchanging route further destabilizes the works.
5. Separate rail, marsh, and wind problems initially appear local. Their combined evidence proves the regional commissioning plan unsafe.
6. Veyra receives sufficient warning and chooses to continue, believing delay will restore the old unreliable arrangements. That makes the final accountability personal as well as institutional.
7. The party mobilizes local knowledge, opens physical relief routes, protects service users, and changes who can stop and revise the system.
8. The crisis ends through action and a workable agreement. A hearing and continuing maintenance prevent victory from depending on a hero's permanent presence.

Rusk does not engineer every neighborhood problem. Jin does not own every thief. Veyra did not cause the flood that preceded her project. Some side stories are simply people living their lives.

## Existing Act I issues and the authored resolution

These are narrative integration notes, not claims that source code was changed. Use them when the corresponding content is next edited.

| Current ambiguity or conflict | Adopted narrative resolution |
| --- | --- |
| Pella's brother can be read as one of Mira's four or as an additional missing person | He went missing before the four messengers were sent. Five named residents, plus existing quarry crews. Use DLG-01 to make it clear. |
| `after_forest` makes Kaya speak even when she was not selected | Named Kaya version only when present; otherwise the narrator or a selected speaker notices the workers' hands. A hero's voice is not a disembodied narrator. |
| Gate kinship assumes any earthbender has quarry experience | Bo may claim his own experience. Other parties establish relevant knowledge through workers, records, or prior conversation. Element alone does not confer a biography. |
| Gate intimidation risks equating firebending with a uniform national identity | It plays on a specific deserter's fear and has local consequences. It must not establish a universal rule about every firebender or Fire Nation person. |
| Ruon's trade prompt says both options have no right answer while other text condemns selling him | Keep the hard choice and its urgency; replace the moral-equivalence footer with “Both routes reach the quarry. Ruon will live with the choice.” No automatic absolution and no permanent player condemnation. |
| Lost ambush text says Jin got what she wanted while Ruon remains with the party | In the expansion, Jin's raiders seize Ruon's dispatch satchel, not Ruon. Ruon carries the party to safety and remains on the escort route. Her later interest in his testimony continues. State the satchel clearly. |
| Lost ambush refers to a fixed number of party members | Use “Ruon gets you out through the scree, then goes back for anyone still trapped.” Do not imply a solo hero has five invisible companions. |
| Ruon is escorted for trial but the initial chapter does not show a completed trial | Custody is supervised during the journey; safe transfer to Ba Dan is acknowledged before the coast crossing. The substantive hearing occurs in MQ-11 or a documented earlier local scene. |
| Boss loss leaves workers' fate and onward route unclear | They remain alive under continued control. MQ-02 has independent evidence; MQ-11 resolves liberation. Do not play the victory cart epilogue after a loss. |
| Victory does not explicitly name every missing person as returned | The expanded rescue accounts for Leto, Amri, Hesra, Senn, and Bo-shan; their injuries and preferences may differ. SQ-01 enhances the reunion, not survival. |
| Pella appears in a defeat line though she was refused permission to join | She helps in Ba Dan when the party is brought back or visited; she is never part of the combat group. Add the location transition before her reaction. |
| Nilak's bio says the house takes anyone and then says it excluded people | The first statement is its public ideal, contradicted by registration and sponsorship rules. PQ-03 develops this deliberately. |
| A healing discipline flavor uses “she” for a healer despite Nilak's established male portrait | Use a neutral statement about the house or preserve Nilak's he/him where the line specifically refers to him. |
| Sound bending and disruption may read as official lore | Reframe Oru’s teaching within airbending; review armor-bypassing and remote chi-blocking effects before production. Renaming a path alone does not resolve an unsupported mechanic. |
| Act I still says “Forty years after the Avatar Korra” | Use “After Korra’s era of upheaval, the outer Earth Kingdom provinces are finding their own ways forward.” Exact dating remains reserved. |
| Driller epilogues say nobody in the province could build, buy, or drive the machine | Identify an unaccounted-for imported machine through records and modifications, not a claim that an entire province lacks industrial competence. |
| Art prompts prohibit franchise names while the owner requests Avatar’s animated visual language | Update prompt rules and associated checks together to allow accurate animated Avatar references. Preserve original cast identities and evaluate backgrounds and characters against labeled references. |
| Cutscene planning includes SQ-35’s distant living wake | Remove that proposed scene from the active production list; preserve its ID as retired. Existing derived art requires review before reuse. |
| Late teachers could make desired specializations unreachable at the commitment moment | Introduce all teachers in the Act II corridor before that moment. Implementation must decide safe commitment/revisit handling; do not promise a feature that has not been added. |
| Nation standing might be used as a global virtue meter | Treat it as perception by a constituency, not objective goodness or unanimous opinion. New community trust is narrative design until supported. |

## State vocabulary for writers

The following is a prose specification for mutually intelligible outcomes. It is not a new save schema. Existing engine flags must be mapped deliberately during implementation. New labels below should not be added as arbitrary contradictory booleans.

| Story fact | Allowed meanings | Required exclusions or precedence |
| --- | --- | --- |
| Quarry result | Freed in Act I / occupied after Act I / freed later | Act I victory and Act I loss cannot both describe the same result. Later liberation preserves the history of initial loss. |
| Ruon's initial disposition | Escort chosen / traded to Jin | Exclusive at the original choice. Later rescue does not erase a trade. |
| Ruon's current custody | Supervised Ba Dan custody / Jin's custody / transferred for hearing / under public restrictions | Current state is separate from the original choice. A rescue scene changes it explicitly. |
| Ambush result | Won / lost / not encountered | `ruon_carried_you` applies only to the established loss rescue, never a skipped ambush. |
| Inquiry approach | Public accusation / quiet investigation | Changes attention and access; never sole main-clue availability. |
| Inspection mandate | Official / written-independent / residents' investigation | All enable the three regional investigations. |
| Regional proofs | Rail proof obtained; marsh proof obtained; wind proof obtained | MQ-09 requires all three; order arbitrary. Optional personal quests do not substitute for or gate these main outcomes. |
| Exposure timing | Immediate / after protection arrangements | Determines local pressure, not the truth of the evidence. |
| Crisis command | Constrained Commonworks team / shared response group | Any central role requires independent stop authority. |
| Pre-crisis strategy | Staged intervention / early reduced output | Selected explicitly in MQ-12; no hidden real-time deadline. |
| Final practical conditions | Relief open; stop control independent; downstream warned; passage open | All four secured before negotiated stable operation. Emergency shutdown is the fallback. They are operational facts, not elemental artifacts. |
| Settlement | E-01 / E-02 / E-03 | One structural ending. Veyra's response and local recovery modify it separately. |
| Optional quest outcome | Unseen / invited / underway / resolved with named variant / declined / deferred | Only an actual resolution earns its callback. Declining need not be hostile. |
| Hero personal outcome | Unstarted / confronted / constructive choice / defensive choice / unresolved | Never award a completed arc to an absent or unplayed hero. |

### Existing flags that must remain recognizable

`pella_asked`, `lost_forest_road`, `gate_fire_bluff`, `gate_talked_through`, `ruon_respects_you`, `lost_quarry_gate`, `ruon_spared`, `ruon_traded`, `ruon_paid`, `lost_ambush`, `ruon_carried_you`, `act1_lost`, `act1_complete`.

Teacher access: `learned_lightning`, `learned_healing`, `learned_metalbending`, `learned_soundbending`, `learned_engineering`.

`ruon_spared` is the existing escort-choice flag, not proof that a later trial acquitted him. `ruon_paid` records the trade payment, not compensation Ruon received. Lack of `act1_complete` alone does not prove defeat; an unfinished chapter is also possible. Read the actual flags and progression together before writing a summary.

## Critical route checks for future content integration

| Situation to walk through | Required narrative result |
| --- | --- |
| One non-bender, no optional quests | Can obtain all main proof, reach each region, resolve the physical finale, and choose a viable settlement |
| Six heroes with duplicate elements | No assumption that all four elements are available; individual voices remain distinct |
| Kaya absent | No Kaya line or action appears without her; the road observation still reaches the player |
| Act I victory + escort + ambush win | Workers return early; Ruon remains accountable under supervision; no stolen-satchel line |
| Act I victory + escort + ambush loss | Ruon helped the party; Jin has the satchel; Ruon himself remains with the escort route |
| Act I victory + trade | Jin has Ruon; Gao reacts only after hearing; lawful transfer or rescue can occur later |
| Act I loss + either Ruon branch | Ba Dan remains inhabited; captives remain alive; independent evidence opens Act II; liberation occurs in MQ-11 |
| Three spokes in any order | Their local scenes do not assume another spoke's private revelation; MQ-09 combines all three |
| Optional teacher skipped | A viable default discipline remains; main plot does not demand rare techniques |
| Nilak has basic healing but skips advanced training | His history and basic skill remain true; the advanced path is still gated |
| No preparation side quests | Baseline rescue teams exist; additional damage/recovery differs; main ending is not locked behind chores |
| Ruon traded then rescued | Original trade remembered; current custody updated; no “you always protected me” line |
| Veyra arrested but infrastructure retained | Services and accountability coexist; no false surrender scene |
| Final encounter lost | Emergency shutdown and E-03 continue to an authored aftermath |

## Boundaries for future writers and agents

1. Read the index, canon document, character records for every speaker, and the relevant mission before adding dialogue.
2. Label new work as established proposal, branch-dependent scene, or optional seed. Do not bury a world-changing fact in incidental banter.
3. Keep stable IDs. New main missions continue `MQ-`; personal quests `PQ-`; teacher stories `TR-`; side stories `SQ-`; dialogue scenes `DLG-`; world discoveries `EV-`. Never reuse an existing ID for a different story.
4. Record who knows a fact, how they learned it, and the earliest scene in which they may mention it. A shipping seal is evidence of a connection, not proof of every later accusation.
5. Supply a party-neutral route and an absent-character fallback for every necessary scene. An NPC specialist can assist but must be introduced and have a reason to help.
6. Show practical consequences and keep them proportional. A rude answer does not doom a district. Choosing repair does not guarantee instant forgiveness.
7. Give local people preferences unrelated to the campaign. A person can refuse a meeting, dislike a hero, enjoy a silly song, and still have a worthwhile life.
8. Preserve the originality rule. Do not translate a favorite Avatar episode into this setting with different names or assign each hero a canon counterpart.
9. Update the owning section, this ledger, and every affected callback when changing a fact. This review changes the available reading edition. The modular package was not found in the reviewed main-branch tree; reconcile these changes into that package if recovered. Do not claim that an unedited modular copy or the runtime is synchronized.
10. Separate narrative intent from feature requests. Document any unsupported interaction explicitly rather than writing as if it already works.
11. Before drafting, extract the relevant Part 01 rules into the brief with source anchors, location, relative date, participants, branch prerequisites, permitted powers, and animal identity. Uncertainty stays visible until resolved.
12. Before accepting prose or art, check era, culture, technology, creature anatomy, spirit limits, character identity, and player-state continuity against that brief. Update downstream dialogue, journals, cutscenes, prompts, and maps together. Automated text checks can catch old labels; they cannot certify visual or narrative canon.

## A complete quest brief should answer

Who wants something? Why now? What do they misunderstand? What does the player actually do? What can any party do? What changes with a specialist? Which choice is informed? What immediate outcome follows? What is visible on return? What happens after defeat or refusal? What must not be revealed yet? Which existing fact must stay true?

A practical extension template can use those questions as headings. Do not fill a quest with repeated generic fields that say nothing about the person involved. “Retrieve three objects for reward” is insufficient until the objects, request, and aftermath tell a story.

## Intentionally reserved decisions

| Reserved item | What writers should do meanwhile |
| --- | --- |
| Exact calendar year, Korra’s current circumstances, and the later cataclysm’s date or cause | Use the post-Korra / pre-Seven Havens, pre-cataclysm setting; do not invent a substitute answer |
| Romance between playable heroes | Write friendship and optional warmth without claiming a relationship |
| Exact XP, encounter tuning, currency values, and item statistics | Use narrative benefits and existing progression requirements; hand numerical decisions to implementation |
| Technical handling of revisiting a specialization commitment | Ensure teachers are introduced before the choice; flag any remaining UI/progression requirement |
| Voice acting, dynamic vehicles, simulation of tides, complex civilian movement | Write supported scene alternatives; do not assume these features |
| Additional regions beyond the Reach | Use the optional final letter without establishing a new campaign's catastrophe |

These reservations do not block the current story. They prevent later agents from inventing answers accidentally.

## Recommended production sequence

**First:** integrate the Ba Dan continuity clarifications, three early side stories, and the shipping hook. **Second:** author the coast-to-Causeway corridor, Veyra's first scene, and the five teacher opportunities. **Third:** build one complete regional spoke with its return states, then extend the remaining two. **Fourth:** write the assembly and Ba Dan return against all existing outcomes. **Fifth:** implement crisis scenes and endings with baseline support before adding optional-quest embellishments.

The full bible supplies foreshadowing and intent from the start. It does not require building thirty side missions before a playable story can be reviewed.
