# Cutscenes for Acts II to V — shot lists

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

Eight are proposed, two an act. They are ranked at the end; the first four carry most of the weight.

## Rules for every shot

These come from what the trial found (#810) and from the story's own rules.

- **Frame:** 192 x 108 pixel art, in the style B portrait palette, from one first frame plus one small
  motion (the trial's `/create-image-pro-flash` first frame with a style image, then `/animate-pixminimax`).
  Plan every shot as **a still that moves a little**: a hand opens, a lamp comes on, water rings spread. No
  walking across frame, no lip movement, no camera move the tool has to invent. "Slow push" below means a
  crop that tightens by a few pixels over the hold, done in the player, not in the art.
- **No party hero is ever in frame.** A table has one to six heroes and any can be absent. Where the script
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
- **Cost.** The trial put a six-shot cutscene at about 40 to 60 credits. The eight below are about 45 shots
  and 12 variant shots: roughly 400 to 550 credits for the saga, before re-rolls.

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

## If only some are made

In the order I would make them:

1. **CS-5A, the key and the valve.** It closes the prologue the game opens on. Without it the ending's best
   image is told in the narrator frame.
2. **CS-3A, the mirror pool.** The one scene the board truly cannot stage.
3. **CS-4B, the wheel pin.** It pays off Act I's last picture, and it is all small hands.
4. **CS-2B, the glove.** The first time the table is asked to like Veyra and doubt her in one minute.
5. **CS-5B, the last stop.**
6. **CS-3B, the door in the rain.** Four door plates make it the dearest for what it adds.
7. **CS-4A, the refusal slip.** Strong, but it works well played: the lines carry it.
8. **CS-2A, the Long Blink.** The existing held paintings already cover it.

## Considered and left as played

- **Twist two, memorandum fourteen (9.3).** It is two pages of text. The readable cards the build list
  already asks for do it better than a shot list would.
- **Mira's list (11.7).** It is a conversation at a table, and the table is the board's best set. A cutscene
  would take it out of the players' hands at the moment the village takes something back.
- **Ruon at the far end of the wall (13.2).** It happens inside a fight, and it should stay there.
- **The three endings (15.3).** The script already calls them "held views with short lines". If cutscenes
  are approved they are the natural next batch, one sequence per ending; if not, they are story-break
  paintings. They are not specified here because each has nine route variants.
