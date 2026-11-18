# Cutscenes for Acts II to V, the personal quests and the teachers — shot lists

**PROPOSAL, pending the trial (issue #810). Nothing here is in the game, and no scene relies on it.**

The owner said "maybe" to cutscenes for this game and is judging one trial first (Mira's table, the fifth
bowl). Until he says yes, the held paintings of [story-cutscenes.md](../../story-cutscenes.md) stay this
game's story breaks, and every scene below also works **played**, exactly as its act script has it. If the
answer is no, this file is closed with the issue and nothing else changes.

It is written so that another session can make the frames without reading the act scripts first. The words
are the scripts' own: where a line is quoted here it is copied, and the script wins if the two ever differ.

## What a cutscene is for

The owner's rule (story bible, 2026-11-15): most of the story is found, the spine is played, and a few
moments get a cutscene, "closer than the board can go, for what the small figures cannot show (a face, a
hand)". So each one below was chosen because the 48 px top-down figures cannot show it: a key being set
down, a glove coming off, a pool that reflects nothing, lamps coming on across a mile of water.

Eight are proposed for the main story, two an act. Six more are for the personal quests and the teachers
("The quest cutscenes", below): three the owner approved as candidates on 2026-11-17, and three further
suggestions he has not seen. All fourteen are ranked together at the end.

## Rules for every shot

These come from what the trial found (#810) and from the story's own rules.

- **Frame:** 192 x 108 pixel art, in the style B portrait palette, from one first frame plus one small
  motion (the trial's `/create-image-pro-flash` first frame with a style image, then `/animate-pixminimax`).
  Plan every shot as **a still that moves a little**: a hand opens, a lamp comes on, water rings spread. No
  walking across frame, no lip movement, no camera move the tool has to invent. "Slow push" below means a
  crop that tightens by a few pixels over the hold, done in the player, not in the art.
- **No party hero is ever in frame** (with one exception, for a personal quest's own hero, set out under "The
  quest cutscenes"). A table has one to six heroes and any can be absent. Where the script
  gives a present hero a line, it is a caption over the shot and nothing else. The people who may be drawn
  are the ones who are there in every game: Veyra, Meren, Bera, Pella, Nala, Bo-shan (or Dorin), Latch, the
  Still Keeper, Fenn, the hosts.
- **Hands before faces.** The trial did not solve a face shot. Every shot list here works on hands, objects
  and backs. Where a face would be better, the entry says so and gives the hands-only version first.
- **Words** sit in the story-break caption bar along the bottom, one script line at a time, with the
  speaker's name on the left as in dialogue. `Narrator` lines have no name. `Party:` lines are shown as the
  table's tappable text, as everywhere else. A shot holds until its captions have been read; the seconds
  below are the least it should hold with no caption up.
- **Prompts.** Tapping advances a caption. A real choice (one that sets a flag) is never made inside a
  cutscene: the cutscene stops on a held frame, the normal choice appears over it, and play goes on.
- **Skipping.** Every cutscene can be skipped, and skipping lands on the played version of the same scene
  from its first line, so no line is lost. A second visit does not replay it.
- **Flags.** Each entry lists what it **reads** (to pick variants) and suggests one **seen** flag. The names
  are suggestions for the registry, like the flags in the act scripts.
- **Nothing early.** No shot shows what the reveal ladder has not reached: no Director's badge in Act II
  before Scene 4.2, no Still Keeper before Scene 7.5, no grey coat named before the party has the name.
- **Cost.** The trial put a six-shot cutscene at about 40 to 60 credits. The eight main-story cutscenes are
  about 45 shots and 12 variant shots: roughly 400 to 550 credits for the saga, before re-rolls. The six quest
  cutscenes are 31 shots and one variant shot: roughly 210 to 320 credits more, of which the three approved
  ones are 16 shots (110 to 160 credits).

## The eight

| ID    | Scene              | Plays                                                     | Shots | Variants                    |
| ----- | ------------------ | --------------------------------------------------------- | ----- | --------------------------- |
| CS-2A | 2.9, act2-sparks   | Leaving Saltstep on Tavi's ferry                          | 4     | None                        |
| CS-2B | 4.5, act2-sparks   | DLG-04, Veyra at the handwheel                            | 6     | None                        |
| CS-3A | 7.5, act3-currents | The audience at the mirror pool                           | 6     | Echo count; driver          |
| CS-3B | 9.8, act3-currents | The door in the rain (end of Act III)                     | 5     | Four doors                  |
| CS-4A | 10.6, act4-weight  | The refusal slip                                          | 6     | None                        |
| CS-4B | 11.10, act4-weight | The wheel pin, at Ba Dan's east gate                      | 6     | Act I result; Jinu's letter |
| CS-5A | 14.5 and 14.6      | The key on the ledge, then the valve (the prologue again) | 7     | Surrender or resistance     |
| CS-5B | 15.7, act5-balance | The last stop (the final image)                           | 6     | Act I result (the cart)     |

---

## CS-2A — The Long Blink

**Scene:** 2.9, the ferry. **Plays:** when the party boards Tavi's ferry at dusk, after the vote in 2.7.
**Reads:** `act1_lost` (captions only). **Suggested seen flag:** `seen_cs_long_blink`.
**Why a cutscene:** the board cannot show a mile of water or a headland lighting up lamp by lamp.
**Length:** about 25 seconds.

| #   | In frame                                                                                            | What moves                                           | Camera and hold       |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------- |
| 1   | The foot of the ferry ramp. Two ostrich-horse feet planted on the quay, the plank in front of them. | One foot lifts, hovers, comes down on the plank.     | Close, low. 4 s       |
| 2   | A mooring post with a rope looped on it; grey water beyond.                                         | The rope lifts off the post and drops out of frame.  | Close. 3 s            |
| 3   | Open water between the stern and the quay, widening. The market's level poles small at the top.     | The gap of water widens by a few pixels; small wake. | Wide, from above. 4 s |
| 4   | The bay at dusk, the far headland dark. A row of unlit lamps along the old outpost wall.            | The lamps come on left to right, one at a time.      | Wide. Slow push. 8 s  |

**Words.** Shot 1: the narrator's two Parcel lines and Tavi's "Give him a minute. First time on a boat, they
all want to read the ramp." Shot 2: "The rope comes off the post. Water opens between the ferry and the
quay." Shot 3: Tavi's two lines about the Long Blink and the dark headland. Shot 4: "Across the bay, on the
old outpost, the lamps come on one after another, in a line." Then the driver's line and "He counts them."
(after `act1_lost`: Dorin's "Fourteen. No. Fifteen.").

**Variants.** None in the art. The driver is never in frame, so Bo-shan and Dorin differ only in the caption.
The lamps in shot 4 number fifteen, to agree with Dorin's count.

**Do not show:** anyone at Emberwatch, a Commonworks mark, or Veyra.

---

## CS-2B — The glove

**Scene:** 4.5, DLG-04 at the goods lift. **Plays:** when the party follows Veyra to the lift after 4.4.
**Reads:** nothing for the art; `lost_canal_rescue` changes no shot (she went into the canal either way).
**Suggested seen flag:** `seen_cs_handwheel`.
**Why a cutscene:** the scene turns on a child's hands on a wheel and a wet glove coming off slowly. Neither
reads at 48 px.
**Length:** about 40 seconds, in two parts with DLG-04's choice between them.

| #   | In frame                                                                                                   | What moves                                      | Camera and hold      |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------- |
| 1   | The handwheel on its low post. A woman's wet work glove resting on the rim. Lamplight; streamers above.    | The gloved hand rocks the wheel a quarter turn. | Close. 3 s           |
| 2   | The far side of the same wheel: two small hands on it. Behind them, a supervisor's folded arms.            | The small hands turn the wheel, hand over hand. | Close. 4 s           |
| 3   | The little goods lift, with baskets of turnips, between the water stairs and the market.                   | The lift rises one basket's height.             | Wide. 4 s            |
| 4   | A dark blue coat sleeve with a mended cuff, wet to the elbow. One hand begins to peel the glove off.       | The glove comes off, a finger at a time.        | Close. 5 s           |
| 5   | The bare hand, the glove held in it, water dripping from the cuff onto the flags.                          | Two drops fall. Nothing else.                   | Close. Hold. 4 s     |
| 6   | The lift at the top, stopped. The wet glove left hanging on the wheel's rim. Past it, the canal, lamp-lit. | A streamer moves. The water in the canal moves. | Wide. Slow push. 6 s |

**Words.** DLG-04, word for word, as the act script has it. Shot 1: "Before this, there were three people in
the district who could move that load..." Shot 2: "And now?" and "Now the people with the load can choose
when to move it." Shot 3: the key question ("Who gets the key?" with Riko's name if she is present,
otherwise the party's "Who controls access?") and Veyra's answer. Shot 4: "We asked it at Ba Dan." and the
narrator's "She removes a wet work glove slowly." Shot 5: "I signed the supply order. I did not authorize
people to be held in a quarry." / "Your contractor did." / "Then I have more work to do than replacing a
contractor."

**Prompt.** Shot 5 holds. DLG-04's three-way choice appears over it in the normal choice box (it sets
`veyra_release_promised` on one answer, so it is a real choice and is made in play). Then shot 6 carries
the last four lines: "My mother once waited on a roof..." to "Her answer is not immediate."

**Variants.** None. Veyra is drawn from the shoulder down throughout; her face was shown, small, on the
platform in 4.2.

**Do not show:** the girl's face in close-up (the supervisor "stands close with her arms folded so they will
not help": the arms are the picture). No badge, no title.

---

## CS-3A — The pool that shows nothing

**Scene:** 7.5, the audience. **Plays:** when the party steps onto the bank of the mirror pool after Auntie
Silt. **Reads:** `act1_lost` (whose voice the harbour echo has), and whether MQ-06 or MQ-08 was finished
first (two more kept echoes). **Sets:** the script's `keeper_met`. **Suggested seen flag:** `seen_cs_mirror_pool`.
**Why a cutscene:** the Still Keeper is a heron as tall as a doorway, made of water, with a current turning
in its chest. The pool reflects nothing. A sprite on the board can show neither.
**Length:** the longest of the eight: about 90 seconds of reading. It is the centre of the saga's spirit
thread and the only cutscene that carries a whole scene.

| #   | In frame                                                                                                          | What moves                                                     | Camera and hold        |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| 1   | A round pool in tall reeds, seen from the bank. The water is flat grey: no reeds in it, no sky.                   | One ring of ripples spreads from the middle, three times over. | Wide. 6 s              |
| 2   | The heron, standing in the middle. Clear as glass; reeds show through it. A slow current turns in its chest.      | The current turns. The beak does not move.                     | Wide, low. 6 s         |
| 3   | The surface, close. Small bright rings, one for each thing it kept, each a different size.                        | The rings pulse in turn, like sound. Then all of them, once.   | Close, from above. 5 s |
| 4   | The Keeper's memory, in water colours: a pair of dry boots on a bank, a coat hem, a post with a round dial on it. | The dial's needle does not move. A reed sways. That is all.    | Close. 5 s             |
| 5   | A hand with chalk on the sleeve, holding a folded note over the water. The pool below it, still blank.            | The hand shakes slightly.                                      | Close. 4 s             |
| 6   | The heron again, nearer, head a little turned. Behind it, far off, a line of shut vanes like blinds.              | Shot 3's rings play again, exactly as before, to the frame.    | Wide. Slow push. 8 s   |

**Words.** The whole of 7.5, in the script's order. Shot 1: the two narrator lines. Shot 2: "You are the ones
who go by." to "Someone was pleased. I kept it." Shot 3: each kept echo, one ring each, with its caption
("The pool laughs. It is Bo-shan's laugh..."; "Careful."; "...come home."), then the driver's line and "Why
are you keeping them?" Shot 4: "The water came once and took a thousand roads..." through "It said: steady.
It said: good." Shot 5: Fenn's lines and the trial note ("A gauge. It promised a gauge."). Shot 6: from "The
child who laughed has stopped laughing by now" to "I will watch. I do not say yes. I said yes once."

**Variants.**

- **The rings in shots 3 and 6.** Four in every game (the harbour, the cistern, the canal, the river road).
  Five or six if MQ-06 or MQ-08 was finished first ("...forty years."; "Hold the rail."). Make the rings as
  separate small loops laid over one water plate, so the count is data, not six paintings.
- **The harbour echo's caption** is Bo-shan's laugh, or after `act1_lost` Dorin's "Good morning."
- **Hero lines** (Sura at the pool's edge, Wen on the gauge) are captions over shots 1 and 4. Sura's line
  "It does not show her face" is said over the blank water of shot 1; she is not drawn.

**Do not show:** a face on the human in shot 4, or a blue coat. It was a trial team, eighteen months ago,
not Veyra. Do not show the heron agreeing to anything: no nod, no bow.

**Note for the animator.** Shot 6 reusing shot 3's loop frame for frame is the point of the scene ("The same
laugh. The same length."). Do not re-roll it.

---

## CS-3B — The door in the rain

**Scene:** the end of 9.8, the fall. **Plays:** after Latch has gone, from "By afternoon it is raining."
**Reads:** `sheltered_by` (which door). **Sets:** nothing new. **Suggested seen flag:** `seen_cs_door_in_rain`.
**Why a cutscene:** it ends the act. The board can show a street; it cannot show a city turning its back, or
the last bowl being set down.
**Length:** about 35 seconds.

| #   | In frame                                                                                                           | What moves                                            | Camera and hold           |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------- |
| 1   | A lamp post with a printed notice pasted to it. The printing is very level. Rain.                                  | Rain runs down the paper. The lamp flickers once.     | Close. Slow push. 5 s     |
| 2   | Causeway's three levels from below: terraces, workshops, water stairs. Rain falls from each onto the next.         | The rain. Nothing else.                               | Wide. 5 s                 |
| 3   | A stair street. Shuttered windows either side. No one on it.                                                       | A shutter closes. Then another.                       | Wide, down the stair. 5 s |
| 4   | The foot of the stair: one door (four versions, below). A line of light under it.                                  | The door opens. Warm light falls across the wet step. | Wide. 6 s                 |
| 5   | Inside: one lamp, a pot on a stove, a pair of hands setting bowls on a table. The table's far end is out of frame. | A bowl is set down. Then one more, beside it.         | Close. Hold. 6 s          |

**Words.** Shot 1: the narrator's rain line. Shot 2: "You are on foot." Shot 3: "People who waved at the cart
last week look at the posters, and then at their shoes. A shutter closes. Another." Shot 4: "At the bottom of
a stair street, in the rain, there is one door." then the host's lines. Shot 5: "The door shuts behind you.
Inside there is one lamp, a pot on a stove, and bowls being counted out: one each, and then one more." Then
the act card.

**Variants (shot 4 only; shots 1 to 3 and 5 are shared).**

| `sheltered_by` | The door                                                                               |
| -------------- | -------------------------------------------------------------------------------------- |
| kitchen        | The Six-Ladle's back door, a stockpot's steam coming round the frame                   |
| rail crew      | The end door of a bunk wagon on a siding; stove glow in its one window                 |
| ferry          | Tavi's ferry under the low landing, lamp out; a hand lifts the awning flap from inside |
| stranger       | A narrow house on the low landing with a chair folded in the porch                     |

**Do not show:** the party on the stair (its size is not known), the poster's full text (the script reads it
earlier), or a count of bowls. Shot 5 frames only the last two set down, so it is true for one hero or six.

---

## CS-4A — The refusal slip

**Scene:** 10.6, on the platform. **Plays:** when the water stops rising (or, after `lost_assembly`, while
the courtyard is cleared round the platform). **Reads:** nothing for the art. **Sets:** the script's
`rusk_named` and `cart_recovered`. **Suggested seen flag:** `seen_cs_refusal_slip`.
**Why a cutscene:** an old hand, a small soft paper kept flat for seven years, and what Veyra does with her
hands when she has read it. This is the act's turn, and all of it is smaller than a sprite.
**Length:** about 45 seconds.

| #   | In frame                                                                                                        | What moves                                            | Camera and hold       |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- |
| 1   | A wet blue sleeve, the hand counting on its fingers. A whittled stick comes into frame.                         | The stick taps the arm, twice.                        | Close. 3 s            |
| 2   | Veyra's two hands, held out. An old hand puts the stick in one, then a short knife in the other.                | The stick, then the knife, are set in her hands.      | Close. 4 s            |
| 3   | The old hand, patched blue cuff, holding a small paper soft at the folds. A thumb covers the bottom line.       | The paper is unfolded. The thumb does not move yet.   | Close. Slow push. 6 s |
| 4   | The slip, filling the frame. The printed words are readable. The thumb slides off a small, level signature.     | The thumb slides. "O. Rusk."                          | Very close. Hold. 5 s |
| 5   | Across the platform: the rail, the wet backs of the crowd, and one dry grey cuff being straightened.            | Two fingers straighten the cuff.                      | Wide. 4 s             |
| 6   | Veyra's hands again, holding the slip, the stick and the knife all at once. The old hand takes back two things. | The knife is taken. The stick is taken. Not the slip. | Close. Hold. 6 s      |

**Words.** The scene's lines in order. Shot 1: "...Ma?" / "You've lost weight. Hold this." Shot 3: "Read it."
to Veyra reading the slip aloud. Shot 4: "Read the name at the bottom." and the narrator's line. Shot 5:
Meren's roof speech, "You never told me.", and Meren's two replies; then Rusk's "I followed the procedure
that existed..." and "It was." Shot 6: the cart and the notices, "And him?", "The tide is in four days. I
cannot replace the head of security in four days." / "No. I didn't think you could." and the last narrator
line.

**Variants.** None. After `lost_assembly` the backs in shot 5 are officers walking the crowd out instead of
people standing; if that costs a second plate, keep the standing one and let the caption carry it.

**A face, if the trial solves one.** Shot 5 is where Veyra's face would go, the moment she looks across the
platform. The hands-only version above does not need it: her hands are full of her mother's things, and that
is the picture.

**Do not show:** Meren's face in close-up, Rusk's face, or any party hero. The optional `Party:` exchange
("You said the boat should belong to the rescue.") is played after the cutscene ends.

---

## CS-4B — The wheel pin

**Scene:** 11.10, Ba Dan's east gate. **Plays:** on leaving Ba Dan for Causeway. **Reads:** `act1_lost`
(shot 1 and two captions), whether Jinu is in the party (shot 5b), `ba_dan_crew_sent` (wagons in shot 2).
**Suggested seen flag:** `seen_cs_wheel_pin`.
**Why a cutscene:** it answers the last image of Act I, a shutter open the width of a hand. Pella does not
wave; she checks the axle pin. A nine-year-old's hand knocking a pin home is the whole reunion.
**Length:** about 50 seconds.

| #   | In frame                                                                                                          | What moves                                     | Camera and hold      |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------- |
| 1   | A shutter in a house wall, open the width of a hand. Morning light. (After `act1_lost`: a shut door.)             | Nothing. It is a memory.                       | Close. 3 s           |
| 2   | The east gate, early. The cart loaded low and even: canopy, ramp, barrel. A small girl in the road.               | Parcel shifts a foot. The girl does not move.  | Wide. 5 s            |
| 3   | Pella from the shoulders down, arms folded, a ledger under one elbow.                                             | Her fingers tighten on her sleeve once.        | Close. 6 s           |
| 4   | The off-side wheel hub and its axle pin. A small hand comes in.                                                   | The heel of the hand knocks the pin. It seats. | Very close. 4 s      |
| 5   | Pella standing beside a broad woman with a walking stick. A hand comes to rest on Pella's head.                   | The hand settles. Pella's head does not duck.  | Close. 4 s           |
| 5b  | (Jinu present.) A sealed letter, addressed in thick pencil: "BO-SHAN. THE CART. FOR THE WORST BIT."               | A small hand lets go of it.                    | Very close. 3 s      |
| 6   | Looking back from the road: the gate small, a figure in it. In front, the canal: a leaf, a feather, a radish top. | The three things drift by on the water, once.  | Wide. Slow push. 8 s |

**Words.** Shot 1: "Last time, there was a shutter open the width of a hand." (after `act1_lost`: "Yesterday a
door banged.") Shot 2: "This time Pella is at the gate. She has her arms folded. She does not wave." Shot 3:
the whole exchange from "I'll write from every stop." to "I'm the cart." / "Say it again." / "I'm the cart."
Shot 4: "That was loose. Gao!" / "It wasn't loose!" / "It's not now." Shot 5: the Nala line. Shot 6: the
last two narrator paragraphs, ending "It says nothing about any of them."

**Variants.** Shot 1 as above. Shot 2 has stone wagons and a few waiting figures behind the cart when a crew
is going (`ba_dan_crew_sent`), and none otherwise. Shot 5b only with Jinu, and it shows the letter, never
Jinu. The canopy in shot 2 is Gao's shop awning after `act1_lost`.

**Do not show:** Pella waving, smiling, or crying. Bo-shan is a pair of hands on the reins at most. Water in
shot 6 that ripples twice: the scene's point is that it does not.

---

## CS-5A — The key on the ledge, and the valve

**Scenes:** 14.5 (part one) and 14.6 (part two), with the phase 3 fight played between them.
**Plays:** part one when the party reaches the main release having won phases 1 and 2; part two on the last
quarter-turn, in every game. **Reads:** `veyra_surrendered` or `veyra_removed` (the script's surrender and
resistance versions). **Suggested seen flags:** `seen_cs_key_on_ledge`, `seen_cs_valve`.
**Why a cutscene:** this is the prologue again with the lights on. The prologue's stills are a hand on a
valve wheel and water that ripples twice (`storm_valve`, `storm_ripple` in `interludes.ts`). Part two must
be drawn to match them, so the table sees the same hand and the same water, and this time one ripple.
**Length:** part one about 35 seconds; part two about 30.

**Part one (surrender only) — DLG-11**

| #   | In frame                                                                                                                  | What moves                                                                      | Camera and hold  |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| 1   | A fist with a key on a cord round the wrist. Scraped knuckles, a ring of grease worn into the thumb. Water sheeting past. | The fist tightens.                                                              | Close. 4 s       |
| 2   | A dry stone ledge at waist height, between two people's shadows.                                                          | The hand opens over the ledge, sets the key down, withdraws.                    | Close. Hold. 6 s |
| 3   | A small wheel, low on the wall. One wet hand holds another person's wrist, an arm greased to the shoulder.                | The first hand sets the second on the wheel, and lets go.                       | Close. Hold. 5 s |
| 4   | The key on the ledge. Beside it, something small made of reed and river shell, with a tail like a door latch.             | It turns round three times and stands still. Then a greased hand lifts the key. | Very close. 6 s  |

**Words.** DLG-11, word for word. Shot 1: "The manual release needs a second operator." to "You can teach
them." Shot 2: the narrator's key line, then "After this, they will ask whether I knew." to "I don't think it
is." Shot 3: "She turns her back on the key. She takes Bera's wrist and sets Bera's hand on the small wheel."
Shot 4: Latch's lines, "This is on an edge..." to "That is a thing I can do now.", then Bera picking up the
key and "Small wheel. Quarter turns. Wait for the needle each time..." Then the fight.

**Part two (every game) — the valve**

| #   | In frame                                                                                                      | What moves                                                           | Camera and hold      |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| 5   | The prologue's shot, redrawn: a hand on a large iron valve wheel, half in shadow. Now a second hand is on it. | The wheel turns a quarter. In the prologue it did not move.          | Close. 5 s           |
| 6   | The cistern lake under its roof, seen from the gallery. Flat black water, gate housings like house fronts.    | One long ripple goes out from the middle to the walls. Then nothing. | Wide. Hold. 10 s     |
| 7   | The middle of the lake. The heron folds its wings and walks toward a dark opening in the far wall.            | It walks out of frame. A leaf follows it on the water.               | Wide. Slow push. 8 s |

**Words.** Shot 5: "The last quarter-turn. A hand on a valve wheel..." Shot 6: "Far under your feet the vanes
open..." then, one caption each, with the water still: "Everybody waits for the second one." / "It does not
come." Shot 7: the Keeper's exit and "A leaf goes after it."

**Variants.**

- **Resistance (`veyra_removed`):** part one is not shown at all. The script is firm: "Do not use the
  key-on-the-ledge image in this branch." That scene is played. In part two, shot 5 is the outside release
  on the spillway wall instead: Bera's two hands on a rough cap, rain, the downstream side first. Shots 6
  and 7 are the same.
- **Jinu and Pella's third letter** (14.3) is played, not part of this cutscene.

**Do not show:** Veyra's face in part one. The scene's last direction is that she turns her back on the key;
the picture is the key left where another hand can reach. Latch must not touch the key. No second ripple in
shot 6, however small: hold the still water for the full ten seconds. It is the longest hold in the game on
purpose.

---

## CS-5B — The last stop

**Scene:** 15.7, the final image. **Plays:** after DLG-12 at Mira's table, before the card.
**Reads:** `act1_lost` (the cart's canopy and ramp). **Suggested seen flag:** `seen_cs_last_stop`.
**Why a cutscene:** it is the last thing the table sees. It needs the cart's four additions in one look, a
door opening somewhere no map names, and a chair moving at a table a long way west.
**Length:** about 40 seconds.

| #   | In frame                                                                                                       | What moves                                            | Camera and hold       |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- |
| 1   | The cart from behind, on a road nobody has driven: a canopy that is not square, a wide ramp, a barrel, a lamp. | The wheels turn. The lamp swings on its arm.          | Wide. 5 s             |
| 2   | Parcel's feet. They stop.                                                                                      | Dust settles.                                         | Close, low. 3 s       |
| 3   | A few plank houses, a well, a track down to a landing with one boat. Figures in the doorways, no further.      | Smoke from one chimney. Nobody moves.                 | Wide. 6 s             |
| 4   | The tailgate. Two hands lower it and hook the ramp onto its pins.                                              | The ramp drops into place.                            | Close. 4 s            |
| 5   | One of the doors, half open, a figure behind it.                                                               | The door opens the rest of the way.                   | Close. Hold. 5 s      |
| 6   | Mira's table from above, bowls on it. A pair of hands on the back of a chair. Past the awning, the canal.      | The chair is moved a hand's width. The water goes by. | Wide. Slow push. 10 s |

**Words.** Shot 1: the narrator's inventory of the cart. Shots 2 and 3: "Parcel stops by himself..." and
"People come to their doors. They do not come further." Shot 4: Bo-shan's line, whole: "Morning. I'm from
Ba Dan. I've got room. Has anybody here got a letter that wants taking? Or something that wants mending?
Or... is anyone going my way?" Shot 5: "For a moment nobody moves. Then a door opens the rest of the way."
Shot 6: "At Mira's table, a long way west, somebody moves a chair so somebody else can sit down." then
"Outside, the canal goes by the gate. It says nothing twice." Then the card.

**Variants.** After `act1_lost` the canopy in shot 1 is Gao's shop awning and the ramp's hinge is a door
hinge. Nothing else: Bo-shan drives in every game by now, and the three endings do not change this place,
because it was never on the network.

**Do not show:** who sits in the chair, whose hands move it, or any party hero at the table. No lamp in the
settlement in shot 3: nothing has reached it yet. The canal in shot 6 does not ripple twice.

---

## The quest cutscenes

**PROPOSAL, pending the same trial (#810).** The owner approved the first three as candidates on 2026-11-17
and said more could be suggested; the last three are suggestions. None is relied on: every one is a played
scene in its script, and the script wins if a line differs.

They keep every rule above, with one difference that needs saying:

- **The quest's own hero may be drawn, as hands and never as a face.** A personal quest exists only while its
  hero is in the party, so that hero is there in every game that plays it. Kaya's thumb, Tenzo's hand, Sura's
  knuckles, Lin Mei's hands and Wen's gauntlet are in frame below. Every other hero stays a caption. In a
  teacher story the student is one of two heroes, so the student is never drawn.
- **They are short.** A quest cutscene is one moment inside a played scene, 20 to 40 seconds. It starts on a
  named line and hands back to the played scene on a named line.

| ID      | Scene                  | Plays                                       | Shots | Variants            | Status    |
| ------- | ---------------------- | ------------------------------------------- | ----- | ------------------- | --------- |
| CS-PQ01 | K.3, personal-quests-1 | Kaya opens Miri's letter                    | 7     | None                | Approved  |
| CS-PQ04 | S.5, personal-quests-1 | Sura's "I heard you"                        | 5     | None                | Approved  |
| CS-PQ02 | T.4, personal-quests-1 | Tenzo's hand does not reach the salt        | 4     | None                | Approved  |
| CS-PQ06 | L.1, personal-quests-2 | The map with no way home on it              | 5     | None                | Suggested |
| CS-TR03 | T3.1, teachers         | Hesh moves the girl's thumb                 | 5     | None                | Suggested |
| CS-PQ10 | W.4, personal-quests-2 | Ruda's capitals in the middle of Wen's card | 5     | Bench or pump house | Suggested |

---

## CS-PQ01 — The letter

**Scene:** K.3, Miri's workshop. **Plays:** from "Kaya reaches into her sash", on every route (it is before
the vote), and hands back to the played scene at "I had a whole letter in my head." **Reads:** nothing.
**Suggested seen flag:** `seen_cs_kaya_letter`.
**Why a cutscene:** a wax seal that has never been broken, and a page four lines long that the table reads
for itself. At 48 px a letter is two pixels of white.
**Length:** about 35 seconds.

| #   | In frame                                                                                               | What moves                                            | Camera and hold       |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------- |
| 1   | A sash at a hip. A hand goes into the fold of it.                                                      | The hand draws out a folded letter.                   | Close. 3 s            |
| 2   | The letter on an open palm. The corners have gone round. The paper is soft as cloth. A whole wax seal. | The thumb comes to the edge of the seal and stops.    | Very close. Hold. 4 s |
| 3   | The workbench: two paste-stained hands flat on it. Behind, a shelf: brushes, cord, a roof tile.        | The hands lift a little and settle again.             | Close. 5 s            |
| 4   | The seal, filling the frame, with the thumb under its edge.                                            | The seal breaks.                                      | Very close. 3 s       |
| 5   | The page, opened flat. Four lines, readable, and "M."                                                  | The paper trembles very slightly.                     | Very close. Hold. 8 s |
| 6   | The same page, a little further off, held in both hands.                                               | A thumb travels from the last line back to the first. | Close. 4 s            |
| 7   | The letter lying open on the bench, beside a hammer. Above it the tile, black down one side.           | Straw shifts on the bench. Nothing else.              | Wide. Slow push. 5 s  |

**Words.** Shot 1: the narrator's two lines ("...the corners have gone round and the paper is soft as cloth.").
Shot 2: "The seal has never been broken." / "That's my seal." / "I kept it." / "You kept it shut." and Kaya's
"I knew what was in it..." Shot 3: "Open it." / "Miri..." / "I wrote it. I'd like somebody to read it. It's
been nine years." Shot 4: "Kaya breaks the seal. It is four lines long." Shot 5: no caption. The letter is
the picture, and it is drawn to be read: "Kaya. The roof goes back on Thursday. Father says bring gloves. I
say bring the ladder from your yard, ours is short. We open again the week after and Oko wants you to cut the
string. Are you coming? M." Shot 6: "Kaya reads it. Then she reads it again. It is still four lines long."
Shot 7: "You asked me to bring a ladder." / "Ours was short."

**Variants.** None. It plays the same on all three routes, because the vote comes two scenes later.

**A face, if the trial solves one.** Shot 6 is where Kaya's eyes going back to the top of the page would go.
The thumb does the same work.

**Do not show:** Kaya's face or Miri's; any other hero (Nilak's line at the door is played afterwards); the
chandler; fire of any kind. The tile is seen but nobody points at it.

---

## CS-PQ04 — "I heard you"

**Scene:** S.5, the pilots' landing. **Plays:** from the start of S.5, on every route, and hands back at
"After a while she nods at the pole." **Reads:** nothing (the pole is across Sura's knees on all three).
**Suggested seen flag:** `seen_cs_heard_you`.
**Why a cutscene:** the scene is two pairs of hands. One is being washed and dried a finger at a time while
the other holds a pole and says the true version for the first time. The board can show two figures on a
landing and nothing of either.
**Length:** about 35 seconds.

| #   | In frame                                                                                             | What moves                                      | Camera and hold       |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------- |
| 1   | A bucket on the landing boards. Two hands in it, black with tar to the wrists.                       | The hands rub. The water goes brown.            | Close. 4 s            |
| 2   | An upturned hull beside the bucket. Someone sits down on it: knees, and a sounding pole across them. | The pole settles. Two hands close round it.     | Close. 4 s            |
| 3   | The hands on the pole. Its depth marks are cut in rings. One thumb is on a ring.                     | The thumb rubs the ring, and stops.             | Very close. Hold. 8 s |
| 4   | The first hands again, out of the bucket, in the corner of a work apron.                             | They are dried, one finger at a time.           | Close. Hold. 6 s      |
| 5   | The landing from behind: two backs on the hull, small, and the channel going by at day's end.        | The water moves. One head tips toward the pole. | Wide. Slow push. 6 s  |

**Words.** Shot 1: "Vessa is washing tar off her hands in a bucket." Shot 2: "You said it was singing." / "I
did." Shot 3: Sura's speech, one caption a sentence: "I heard you. That's what I want to say." / "I've always
told it as if I didn't hear, or the wind took it, or ice always sings." / "I heard you say it. I knew what it
meant." / "I went anyway, because I'd been right the winter before." Shot 4: no caption for the first four
seconds. Then "...Yes. That's the one I hadn't had." Shot 5: "She does not say anything else about it. After
a while she nods at the pole."

**Variants.** None. What Vessa does about the pole (lends it, or takes it back) is played after the cutscene.

**A face, if the trial solves one.** Shot 3 is where Sura's face would go while she says it. The thumb on
the depth ring is the hands-only version, and the scene does not need more.

**Not this one.** The first draft's candidate was S.4, Sura cutting a hole in her own ice. Only one vote in
three sees it, so it is left as played.

**Do not show:** Vessa's stiff leg as the subject of any shot; a smile from either of them; ice.

---

## CS-PQ02 — The salt

**Scene:** T.4, the long table at the Six-Ladle. **Plays:** from "Yuna puts a bowl in front of him", on every
route, and hands back at Yuna's hand on his shoulder. **Reads:** nothing.
**Suggested seen flag:** `seen_cs_salt`.
**Why a cutscene:** the whole quest turns on a hand that goes toward a salt dish and is put down flat
instead. It is a movement the width of a finger.
**Length:** about 25 seconds. It is the cheapest cutscene in this file.

| #   | In frame                                                                                     | What moves                                                                    | Camera and hold  |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| 1   | A bowl set down on a scrubbed table by a cook's hands: river-fish stew with greens. A spoon. | Steam. The cook's hands go. Another hand takes the spoon.                     | Close. 5 s       |
| 2   | The middle of the table: a salt dish. A hand comes into frame toward it.                     | The hand stops a finger short of the dish.                                    | Close. Hold. 4 s |
| 3   | The bowl again. The same hand comes down flat on the table beside it.                        | The hand flattens. Then nothing.                                              | Close. Hold. 5 s |
| 4   | The bowl, empty. The flat hand still beside it. A shoulder at the edge of the frame.         | A cook's hand takes the bowl. Her other hand rests on the shoulder, and goes. | Close. 6 s       |

**Words.** Shot 1: "Yuna puts a bowl in front of him. It is a river-fish stew with greens, and it is not how
he would have done it." / "He tastes it. It wants salt." Shot 2: "His hand goes out toward the salt dish in
the middle of the table." Shot 3: "He puts his hand down flat beside the bowl, and he eats all of it." Shot
4: "Well?" / "Thank you. It's hot, and I didn't make it." / "That's not what I asked." / "I know. It's what
I've got." and the narrator's last line.

**Variants.** None. Sura's and Nilak's lines are played afterwards.

**Do not show:** Tenzo's face, Yuna's face, or salt going into anything.

---

## CS-PQ06 — No way home (suggested)

**Scene:** L.1, the step of the third reed house. **Plays:** from "That's ours. Can I see the map now?", in
every game that opens PQ-06, and hands back at "So do we." **Reads:** nothing.
**Suggested seen flag:** `seen_cs_no_way_home`.
**Why a cutscene:** the bible's three lines are about what is on a sheet of paper and what is not. The table
has to see the row of houses, the letter T beside each, the school raft, and the clean white paper between
them. On the board a survey sheet is a pale square.
**Length:** about 30 seconds.

| #   | In frame                                                                                                  | What moves                                                    | Camera and hold       |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------- |
| 1   | A reed-house step on its runners. A survey case is set down on it by two small arms.                      | The arms let go of the case.                                  | Close. 3 s            |
| 2   | The case, open. Two careful hands lift out a survey sheet and hold it low, at a child's height.           | The sheet tips toward us.                                     | Close. 4 s            |
| 3   | The sheet, filling the frame: fine black lines, soundings, a row of small houses, each with a "T".        | A small finger counts along the row and stops on the third.   | Very close. Hold. 6 s |
| 4   | The same. The school raft is drawn at the other side. Between it and the houses, white paper and a depth. | The finger goes out from the house into the white, and stops. | Very close. Hold. 6 s |
| 5   | The sheet lowered. Past its edge, the real thing: seven stumps in brown water, a rope, a log.             | Rings spread round one stump, where somebody has just hopped. | Wide. Slow push. 6 s  |

**Words.** Shot 1: "That's ours. Can I see the map now? Fenn said it's in there." Shot 2: the narrator's line
about the sheet. Shot 3: "You drew our house." / "Yes." Shot 4: "You didn't draw a way to get home." (the
bible's three lines, word for word). Shot 5: "Between them there is clean white paper, and a depth." / "A
route has to be in the same place for two seasons before it is entered. That is the standard. Yours moves." /
"So do we."

**Variants.** None.

**Do not show:** the child's face or Lin Mei's; a path on the sheet, however faint. The white has to be
white. Sura and Nima's lines come earlier and are played.

**Why it is suggested.** It is the line the whole quest is built to earn, every table with Lin Mei hears it,
and it is the same picture as DLG-06, which follows.

---

## CS-TR03 — The thumb (suggested)

**Scene:** T3.1, the lift gate at the rail annex. **Plays:** after the gate swings shut and the student's own
lines, from "Nanu's daughter has her hand on the hinge pin", to the end of the scene. **Reads:** nothing. The
student (Bo or Lin Mei) is never in frame, so it is one set of shots.
**Suggested seen flag:** `seen_cs_thumb`.
**Why a cutscene:** Hesh says "No" and moves a girl's thumb a little to the left. That is the scene, and it is
smaller than one pixel of the board. It also sets up the yoke in his locker in Scene 6.4.
**Length:** about 30 seconds.

| #   | In frame                                                                                         | What moves                                              | Camera and hold       |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------- |
| 1   | The gate's top hinge: an iron pin, filed bright at the collar. A girl's hand, flat on it.        | The fingers press, and ease.                            | Close. 4 s            |
| 2   | A man's two hands behind his back. On the ground by his boots: a hammer, a file, a flask of tea. | The hands unclasp.                                      | Close. 4 s            |
| 3   | The pin again. The girl's hand, low on it. A broad scarred hand beside hers, not touching.       | Her hand goes slowly up the pin, and stops.             | Close. Hold. 5 s      |
| 4   | The two hands on the pin, very close.                                                            | A finger and thumb move the girl's thumb a little left. | Very close. Hold. 6 s |
| 5   | The lift gate, hanging true. Two fish yokes lean on the cage, a large one and a small one.       | The gate swings shut by itself and stays.               | Wide. Slow push. 5 s  |

**Words.** Shot 1: "There's bits in it. Like sand." Shot 2: "Nobody speaks. Nanu looks at Hesh. Hesh looks at
the girl's hand for a long moment." Shot 3: "Lower. There. Now go up slowly. Tell me where it stops." Shot 4:
"She's not guild. We've nobody who'd speak for her." / "No." / "He does not say anything else. He moves the
girl's thumb a little to the left." Shot 5: "You two. Market days, when I'm on the coast. Then the yard at
the Orchard. Both of you." / "It is not clear which two he means. He does not make it clear."

**Variants.** None.

**Do not show:** the student, Hesh's face, a guild card, or anything bending. The pin does not move in this
cutscene; it moved in play.

---

## CS-PQ10 — Somebody else's capitals (suggested)

**Scene:** W.4, in either staging (the bench, or the pump house on Tanner's Stair). **Plays:** from "She picks
up Wen's card and a stub of pencil", in every game that reaches W.4, and hands back when the fitter takes the
pencil. **Reads:** where W.4 was played (shot 1's background only).
**Suggested seen flag:** `seen_cs_capitals`.
**Why a cutscene:** it is handwriting. Wen's large printing, and then five words in somebody else's square
capitals in the middle of it, on a card the size of a hand. It is the bible's growth image for her, and it
comes back in 12.2 and 15.4.
**Length:** about 30 seconds.

| #   | In frame                                                                                         | What moves                                                          | Camera and hold       |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------- |
| 1   | A steel repair gauntlet with geared knuckles, holding a card. Four printed lines, readable.      | A bare, oil-dark hand comes in and takes the card.                  | Close. 4 s            |
| 2   | The bare hand, the card, and a stub of pencil.                                                   | The pencil comes down between the second and third lines.           | Close. 3 s            |
| 3   | The card, filling the frame.                                                                     | Square capitals appear, a letter at a time: "SET YOUR SPANNER NOW." | Very close. Hold. 6 s |
| 4   | The card back in the gauntlet. Two handwritings. The steel thumb rests under the new line.       | The thumb moves off the line, so that it can be read.               | Close. Hold. 5 s      |
| 5   | The gauntlet, holding the pencil out. A third hand, with a ring of keys on a chain at the wrist. | The keyed hand waits, and then takes the pencil.                    | Close. 5 s            |

**Words.** Shot 1: "She picks up Wen's card and a stub of pencil." Shot 3: "Between step two and step three
she writes, in square capitals: 'SET YOUR SPANNER NOW.' She hands it back." Shot 4: "Wen reads it. Her own
printing, and then somebody else's in the middle of it. It is better." / "That's five steps." / "It was
always five. You'd missed one." Shot 5: "I'd add a sixth. 'Chalk the date on the housing.' So the next hand
knows it's been done." / "Wen holds out the pencil to him."

**Variants.** Shot 1's background is a bench top, or (in Causeway) the pump-house door with its brass plate.
One extra plate.

**Do not show:** Wen's face, Ruda's or the fitter's; the napkin (that is W.6, and it is found). The card's
four lines are the script's, letter for letter.

---

## If only some are made

All fourteen, in the order I would make them. A quest cutscene is seen only by tables that have that hero in
the party, and that is counted against it here; a main-story cutscene is seen by everyone.

| Rank | ID      | What                     | Shots | Why it sits here                                                             |
| ---- | ------- | ------------------------ | ----- | ---------------------------------------------------------------------------- |
| 1    | CS-5A   | The key and the valve    | 7     | It closes the prologue the game opens on. Without it the ending is narrated. |
| 2    | CS-3A   | The mirror pool          | 6     | The one scene the board truly cannot stage.                                  |
| 3    | CS-4B   | The wheel pin            | 6     | It pays off Act I's last picture, and it is all small hands.                 |
| 4    | CS-PQ01 | Kaya's letter            | 7     | The best single idea in the quests. No variants. The table reads the page.   |
| 5    | CS-2B   | The glove                | 6     | The first time the table likes Veyra and doubts her in the same minute.      |
| 6    | CS-PQ02 | The salt                 | 4     | The cheapest here, and exactly "a hand".                                     |
| 7    | CS-PQ04 | "I heard you"            | 5     | Plays on every route. Two pairs of hands carry an apology the board cannot.  |
| 8    | CS-5B   | The last stop            | 6     | The last thing the table sees.                                               |
| 9    | CS-PQ06 | No way home (suggested)  | 5     | The bible's line is about a sheet of paper. The table should see the paper.  |
| 10   | CS-TR03 | The thumb (suggested)    | 5     | One movement, no hero in frame, and it plants Scene 6.4.                     |
| 11   | CS-3B   | The door in the rain     | 5     | Four door plates make it the dearest for what it adds.                       |
| 12   | CS-PQ10 | The capitals (suggested) | 5     | Good, but a readable card in play would do most of it.                       |
| 13   | CS-4A   | The refusal slip         | 6     | Strong, but it works well played: the lines carry it.                        |
| 14   | CS-2A   | The Long Blink           | 4     | The existing held paintings already cover it.                                |

If the trial is approved and only a handful are made, make ranks 1 to 4 and then rank 6, which costs least.

## Considered and left as played

- **Twist two, memorandum fourteen (9.3).** It is two pages of text. The readable cards the build list
  already asks for do it better than a shot list would.
- **Mira's list (11.7).** It is a conversation at a table, and the table is the board's best set. A cutscene
  would take it out of the players' hands at the moment the village takes something back.
- **Ruon at the far end of the wall (13.2).** It happens inside a fight, and it should stay there.
- **The three endings (15.3).** The script already calls them "held views with short lines". If cutscenes
  are approved they are the natural next batch, one sequence per ending; if not, they are story-break
  paintings. They are not specified here because each has nine route variants.
- **Bo's hands on the jack handle (PQ-05, B.4).** It is inside a played lift with a prompt in the middle;
  taking it out of the table's hands would undo what the prompt is for.
- **The red flag from the cliff path (PQ-07, M.4)** and **the sky bison at first light.** Each is seen on one
  route in three.
- **Jinu and the half-door (PQ-08, J.4).** A sealed letter again, and CS-PQ01 is the better one.
- **Nilak asleep on the clinic step (PQ-03, N.5).** A 48 px figure can sit down and not get up, and the tin
  beside him reads on the board.
- **The red board and the boy's fingers (TR-04).** Close to CS-TR03 in kind. If a second teacher cutscene
  were wanted it would be this one: the board dropping three times and twice, and five fingers held up.
- **The hold (PQ-09, R.1).** Two bodies, which is what the board is for.
