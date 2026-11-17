# Act V: Balance — script for MQ-13 to MQ-15

**DRAFT for the owner (the writing pass, 2026-11-15). Nothing here is in the game.**

Sources: the bible's Part 04 (MQ-13 to MQ-15, the endings table and its modifiers), DLG-10, DLG-11 and DLG-12,
Part 05's epilogue variants; the saga outline's beats 22 to 24 and decisions 6, 7, 13, 15, 17, 19 and 21; the
story bible's proposed item 1 (the final mission is "The Engine in Revolt"; a lost final battle still plays the
vote). Where the bible gives exact dialogue it is used word for word and marked. The reading key is at the top
of [act2-sparks.md](act2-sparks.md).

## Where the act opens

The table has said "go". It is raining. Bo-shan drives the cart in both branches (Dorin went back to his gate
in MQ-11). Latch is on the tailgate. The party has promised to be at one front by the second bell, at the other
two before high water, and at the green door on the cistern gallery when the tide turns.

State this act reads most: `first_front`, `strategy_staged` or `strategy_reduced`, `command_commonworks` or
`command_shared`, `ba_dan_crew_sent`, the three spoke choices, and Ruon's and Jin's outcomes from MQ-11.

## What Act V reveals

Whether Veyra will put the key down. Nothing else is held back. No franchise mystery is answered.

## Cutscene candidates for this act

1. **The key on the ledge** (MQ-14, DLG-11): a hand on a valve wheel, a key set down on dry stone, and water
   that ripples once.
2. **The last stop** (MQ-15): the cart at a settlement that is on no map, and a chair being moved at Mira's
   table.

---

## MQ-13 — Three Ways to Hold a Night

**Theme card:** MQ-13, Three Ways to Hold a Night

Themes: responsibility, belonging, equality. The party can only be in one place. The other two places are held
by people it met on the way: apprentices, a rail yard, a marsh school. A man who once shut a gate is given six
people and the worst end of a wall, by one of the people he shut it on.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution (Ruon is given work, not thanks; Rusk is not excused by his calm)
- [x] The other side's reasons are shown (Rusk's are given whole; the relay guards'; Jin's terms)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**How the mission runs.** The front the table chose in MQ-12 plays in full (its **Full** scenes). The other
two play their **Short** scene, in the order the flags call them. Then Scene 13.5 (Jin), then Scene 13.6
(Rusk at the spillway), for every table. A front counts as **held** after a win or a Short scene, and as
**lost** after a CARRY ON. _Sets `front_landing`, `front_relay`, `front_spillway` to held or lost._

### Scene 13.1 — Second bell

**Shown:** played.

**Narrator:** Rain, and the flat fast bell. Lamps in every window of the low landing, though it is the middle
of the night. On the tram-shed roof a flag goes up and cuts sideways. Far off, another answers.

> **If `strategy_staged` —** _Narrator:_ Every lamp in Causeway is burning at full. Under the street the
> pumps are running flat out. You can feel them in your feet.

> **If `strategy_reduced` —** _Narrator:_ Half the streets are dark, on purpose. In the dark ones, people are
> already walking uphill with bundles, unhurried, two hours ahead of the water.

**Yenna:** Lamp says: landing, level rising, slow. Relay, hot. Marsh, first gate ready. That's all three. Go
where you said you'd go.

**Driver (Bo-shan):** Foot of Tanner's Stair. Ramp down. I'll be there till there's nobody left to fetch.

**Latch:** I will be on the edge. If something is dropped tonight, I will know whose it is. I have been
practising.

> **If Lin Mei is in the party —** _Narrator:_ On the shed door, Lin Mei's map has a second hand all down its
> margin now. Tanner's Stair is drawn one pace wide, with a pump housing in it. Runners are reading their
> streets off it and going.

### Scene 13.2 — The low landing

#### Full (if `first_front` is the low landing)

**Shown:** played, into an encounter. **Encounter:** the rising walkways (no enemies; bring people off four
walkways before each goes under; brace the landing wall).

**Narrator:** The low landing is a ladder of streets going down into black water. The bottom two are already
gone. Walkways have been run across the rooftops on trestles, and people are coming along them in single
file, carrying children, clocks, a cat in a pillowcase.

**Tavi:** Four apprentices, four boats. They're doing it right. I've checked each one twice and I'm going to
stop, because checking's making them worse.

**Dr. Iset:** Anyone cold and quiet comes to me first. The loud ones are fine. The loud ones are always fine.

> **If Nilak is in the party —**
> **Dr. Iset:** Nilak. Cold and quiet, second boat.
>
> **Nilak:** Going.
>
> **Narrator:** Some time after midnight she looks at him across a row of blankets. He sits down on an
> upturned crate and shuts his eyes for a count of one hundred, and gets up again at ninety.

**Narrator:** Along the landing wall, a line of people is setting stone and timber braces by lamplight. A
woman is walking the line with a chalk.

> **If `ba_dan_crew_sent` —**
> **Daiyu:** Mine are on the wall and it's holding. Far end's the worst. It's on made ground. I've put him
> there.
>
> **Narrator:** At the far end, six people are working under one voice. It is giving short orders, the kind
> that have been given before.
>
> **Daiyu:** He's run men. So he runs those six. And he answers to me. He asked me which six. I said the six
> I'd miss least. He said, "Then I'll bring all six back." We'll see.
>
> _(If Ruon is not working, drop Daiyu's "I've put him there" and her second line; the far-end gang is run by
> Little Bai, who talks the whole time. If only five came from Ba Dan, Ruon's six are from the city's public
> gang, and "the six I'd miss least" still stands.)_

> **Otherwise —**
> **Wall ganger:** Public works gang. Nine of us. We've not got anyone who knows old drains, so we're bracing
> everything and hoping. It's slower. It'll do.

**Encounter barks:**

- **Tavi's apprentice:** "Boat's full! I said it's full! I'm coming back, I promise I'm coming back!"
- **Dr. Iset:** "Blanket. Not that one, that's wet. They're all wet. The least wet one."
- **Yenna (by lamp, relayed):** "Third walkway's going in ten. That's ten. I don't round."
- **Hua (at her door, with a book under her arm):** "I've got it. I've got page two hundred and six. I'm not
  leaving it for the fish."
- **Ruon (far end, if present):** "Wedge. Now the other. Don't look at the water. Look at the wedge."

> **If Sura is in the party —**
> **Sura:** Ice across the front, shoulder high. And a gap. Tavi! How wide?
>
> **Tavi:** Two boats!
>
> **Narrator:** She leaves a gap two boats wide. The water finds it and goes through hard, where everyone can
> see it going, instead of over the top where nobody could.

> **If Bo is in the party —**
> **Narrator:** Bo is third from the left on the brace line, next to Little Bai. She has not stopped talking.
> He has not once looked along the line to count it.
> _(With no Ba Dan crew: "next to the yard foreman's nephew. He has not stopped talking.")_

**The far end (plays once, mid-encounter, if Ruon is present):**

**Narrator:** At the far end the made ground slumps. A brace kicks out. For a moment the wall leans.

**Narrator:** Ruon gets his back under the timber. He does not shout. He says six names, one after another,
and six people climb out past him along the top of the wall.

**Daiyu:** Ruon! Out! That's an order!

**Narrator:** He looks along the wall at her. Nineteen years, he gave orders. He lets go of the timber, and
climbs out, and stands where she is pointing.

**Daiyu:** Good. Second brace. Go.

**After a win:**

**Narrator:** The fourth walkway is empty when it goes under. The wall is standing. Along Tanner's Stair,
a cart is going up for the ninth time with its ramp down and eleven people on it who have no business fitting.

**Hua:** I've been lifted onto a vegetable cart by a boy. I'm seventy-three. Don't tell my neighbour.

**CARRY ON (the encounter is lost):**

**Narrator:** The third walkway goes with people still on the fourth. Nobody drowns: Tavi's apprentices take
them off the rooftops one roof at a time, for hours, in the dark. The landing wall slumps at the far end, and
two streets that might have stayed dry do not.

**Narrator:** Hua's house is one of them. She is sitting on the cart's tailgate in a blanket with her book on
her knee. The ribbon is still in it.

**Hua:** It was only a house. I'd read everything in it.

> **If `strategy_reduced` —** replace the first paragraph: _Narrator:_ The third walkway goes under with nobody
> on it. The bottom streets were walked out hours ago, in the dark, on purpose. What the water takes is the
> far end of the landing wall, and two streets of houses with their doors left open.

_Sets `front_landing` lost. Two more streets are flooded in every ending; the low landing's repair is the first
item on the public list in MQ-15._

#### Short (if the party reaches the landing second or third)

**Shown:** played (one beat; no encounter).

**Narrator:** By the time you reach the low landing, the fourth walkway is the only one still above water.
Tavi's apprentices are bringing the last boat in.

**Tavi:** Nineteen trips. Not one of them put a pole wrong. I taught two of them last month. I'm not going to
cry on a ferry. I'm going to do it later, on dry land, properly.

> **If `ba_dan_crew_sent` —** _Narrator:_ The wall has held. Daiyu is walking the line with her chalk, crossing
> off braces. At the far end, a man with no rank is checking six people's boots before he checks his own.

> **Otherwise —** _Narrator:_ The wall has held in most places. The public gang is still setting stone where
> it did not. A wall ganger asks if you can spare ten minutes. (You can: carry stone, and the wall is braced.)

**Driver (Bo-shan):** Ninth trip. Parcel's stopped objecting. I think he's decided it's a route.

### Scene 13.3 — The Orchard relay

#### Full (if `first_front` is the relay)

**Shown:** played, into a fight. **Fight:** the relay house (Rusk's loyalist detail is holding the relay
closed with workers inside; open the doors, get the line crew out, and let Luli trip the relay by hand).

**Narrator:** The relay house stands beside the rail in the orchard, a brick box humming like a kettle. Every
wire in the valley goes into it. The windows are glowing a colour that windows should not be.

**Narrator:** Eight men in grey are standing across its doors. Through the glass, you can see Luli and four
of her line crew inside, working with their sleeves over their faces.

**Loyalist corporal:** Orders are the relay stays closed. Full power to the Works, no interruptions. If it
trips, every pump in Causeway stops. I'm not having that on me.

**Luli (through the glass):** It's going to trip itself in ten minutes, you pressed fool, and when it does it
takes the roof! Let me OPEN it! Open's not the same as OFF!

**Loyalist corporal:** I don't know the difference. I've got an order that doesn't ask me to.

**Hesh:** I've known that lad since he was a wagon boy. He's not wicked. He's been told that if he thinks,
people drown.

**Fight barks:**

- **Luli:** "Left door! The left one opens outward! I've been saying that for an hour!"
- **Loyalist corporal:** "Hold the doors! Nobody said anything about holding them from people!"
- **Hesh:** "Mind the rail. It's live to the points."
- **Renn** _(if PQ-05 ended with trust)_**:** "Brace crew, on me! Roof beam first! Bo, you're on the jack, and
  I'm calling it!"
- **Yard foreman** _(otherwise)_**:** "Yard hands, roof beam! Anyone who's lost a finger on my yard, you know
  what careful looks like!"

> **If Bo is in the party and Renn is leading —**
> **Bo:** On the jack. Call it.
>
> **Narrator:** Renn calls it, by numbers. Bo lifts on the numbers and not before.

> **If Kaya or Tenzo is in the party and learned from Luli (TR-01) —**
> **Luli:** You! You know the first lesson! What's the first lesson?
>
> **Kaya / Tenzo:** When to stop.
>
> **Luli:** Then get in here and help me stop it!

**After a win:**

**Narrator:** The doors come open. Four line crew stumble out into the rain and sit down on the rails. Luli
throws the relay by hand. Every lamp in the valley goes out for one long breath, and then comes back on at
half.

**Luli:** That's open. That's not off. Does anyone want me to explain the difference now? No? Good.

**Narrator:** She laughs, like an engine that has finally caught.

**Loyalist corporal:** ...The pumps are still going.

**Luli:** At half. Which they can do all night. Sit down, son. You held a door. Nobody died of it. Don't
make a habit.

**CARRY ON (the fight is lost):**

**Narrator:** The relay trips itself. A sheet of white light, a bang that flattens the pear blossom, and half
the roof lifts. Luli's crew were already at the back wall; Hesh's hands pull them out through a window frame
with the glass gone.

**Narrator:** Every pump in Causeway stops. For an hour, people keep them going by hand, on the long
handles Veyra had fitted for exactly that. The water gains a street on them.

**Luli:** Hand cranks. She put hand cranks on every one. I used to think that was showing off.

> **If `strategy_reduced` —** replace the second paragraph: _Narrator:_ The pumps were already at half and the
> streets below them already empty. People work the long handles Veyra had fitted, and for an hour the hand
> cranks keep the water where it is.

_Sets `front_relay` lost. The pumps are hand-worked for an hour; one more street floods (none after
`strategy_reduced`); the relay house is a shell in MQ-15 in every ending._

#### Short

**Shown:** played (one beat).

**Narrator:** At the relay house the doors are standing open and the windows are an ordinary yellow. Eight
men in grey are sitting on the rail in a row, with their spears stacked, drinking tea out of the yard's
chipped cups.

**Hesh:** They'd been told to hold it shut. I asked the corporal whose mother lived on the low landing. Five
hands went up. Then Luli explained "open". Loudly.

**Luli:** I'd like it written down that I was right for a full hour before anyone listened. I'd like it
written large.

> **If Renn led the brace crew —** **Renn:** Roof beam's jacked and pinned. I called it. Nobody took the
> handle off me.

### Scene 13.4 — The marsh spillway

#### Full (if `first_front` is the spillway)

**Shown:** played, into an encounter. **Encounter:** the staged release (open the spillway in four stages; the
echo rule from MQ-07 is back and stronger: each move on the water repeats next round. Ripple spirits crowd the
gates and must be steered through.)

**Narrator:** Reedglass in the rain is a different place. Every walkway has been unpinned. The houses have
been let out on their long ropes, and ride like boats. The school raft has no children on it, only a bell.

**Narrator:** The Slow Channel is brown and high. And at the spillway gate it is doing the thing again: the
same surge, the same curl of foam, coming up, and coming up, and coming up.

> **If `marsh_corridor_wide` —** _Narrator:_ The wide crossing is open, with the old bell clapper swinging at
> its mouth. It is not wide enough for tonight.

> **If `marsh_crossing_scheduled` —** _Narrator:_ The narrow gate is up, an hour off its clock. Fenn is on it.
> She has been on it since noon.

**Narrator:** The Still Keeper is standing in the middle of the channel, where the water is fastest. The
current inside its chest is going round so quickly it has turned white.

**Still Keeper:** It is all moving. It is all moving at once. This is the night the roads broke. I know this
night. I am holding it.

**Fenn:** It's holding the surge back with both wings and it can't. Nobody could. We have to let it through a
piece at a time, and it has to let us.

**Pump keeper:** Four stages. I'll call the level. If I say stop, you stop, spirit or no spirit.

**Encounter barks:**

- **Old netmaker:** "Lift on the clap! First verse! Sing it, you'll keep time better!"
- **Pump keeper:** "Red mark's holding! Second stage, go!"
- **Still Keeper:** "That one went. And that one. I cannot count them. There are too many to keep."
- **Fenn:** "You don't have to count them! Just watch the next one! Only ever the next one!"
- **Latch (from a post):** "Auntie Silt says: let it take the pale part of the bank. She says she was tired
  of the pale part."

> **If Sura is in the party —**
> **Sura:** I'm not walling this. I'm putting ice on the banks, so the banks don't go, and leaving the middle
> alone. The middle's not mine.

> **The school path** _(one version plays; the gate is moved in all of them)_ **—**
>
> **If Lin Mei is in the party and walked the path (`pq06_open`), but it is on no map (`pq06_technical`, or
> the quest left open) —**
> **Lin Mei:** The path to the school is under the second gate's wash. It isn't on any map. I walked it. Move
> the second gate four paces left.
>
> **If Lin Mei is in the party, after `pq06_published` or `pq06_negotiated` —**
> **Lin Mei:** The path to the school is under the second gate's wash. It's on one map. Mine. Fenn drew the
> line. Move the second gate four paces left.
>
> **Otherwise** _(Lin Mei absent, or she never walked it)_ **—**
> **Fenn:** Not there! The children's path runs under that wash! Second gate, four paces left!

**After a win:**

**Narrator:** The fourth stage opens. The surge goes down the Slow Channel in one long brown shoulder, and
out, and away toward the sea. Behind it the water is fast and ordinary.

**Narrator:** The Still Keeper lowers its wings. The current in its chest slows, and clears.

**Still Keeper:** I did not hold it.

**Fenn:** No.

**Still Keeper:** It is still a river.

**CARRY ON (the encounter is lost):**

**Narrator:** The second stage opens early. The surge takes the east walkways off their piles and carries the
school raft away down the channel with its bell ringing. There is nobody aboard. The houses swing wide on
their ropes, and hold, because they were built to.

**Old netmaker:** We'll find the school at the three stumps in the morning. It always fetches up at the three
stumps. Count heads. Count them again.

**Narrator:** Everyone is counted. The Keeper is still standing in the channel with its wings out, holding a
piece of water that has already gone.

_Sets `front_spillway` lost. The east walkways and the school's mooring are gone in every ending; the Keeper is
harder to reach in MQ-14 (Scene 14.4 has a line for it)._

#### Short

**Shown:** played (one beat).

**Narrator:** At Reedglass the third stage is already open. The bypass crew is singing the route song to keep
the lift in time, and the netmaker's grandson is conducting with a boathook.

**Fenn:** We're through three. It let us. It stood in the middle shaking the whole time, and it let us.

**Narrator:** The Still Keeper is in the channel with its wings half raised. Each time a gate lifts, it
flinches. Each time, it lowers them again.

**Pump keeper:** Four marks on my wall, still. I looked before I came out. I'm going to look again when I go
in.

### Scene 13.5 — Jin's guarantee (Jin's beat for Act V)

**Shown:** played. **Where:** the foot of the shed's flag mast, between fronts.

**Narrator:** Jin is standing under the flag mast in an oilskin with a small trunk at her feet. It is the
first time you have seen her without a desk.

**Jin:** Your warning has to reach every landing downstream before the surge does. You have flags, a deaf
carpenter, a bell tuner, and four children in boats. It's a good system. It's slow.

**Jin:** I have thirty freight riders who know every back stair on this river, because I've delivered to
every one of them. They can have it done in two hours.

**Jin:** Terms. One. A written guarantee, signed by a name off that courtyard gate, that I leave the Reach on
the first ferry after the tide. Unheld. One trunk. Nobody sent after me.

**Jin:** Two. In return my riders carry your warning tonight to every landing on my delivery list.

**Jin:** Three. The list is the list. I deliver to what's written. I always have.

**Fenn:** _(or Bera)_ She's walking away from all of it. If I sign that, she never stands in that courtyard.

**Jin:** That's right. That's what I'm selling.

**Driver (Bo-shan):** Hold on. "What's written." Give me that list.

**Narrator:** He runs his thumb down it. Then he gets the delivery book out from under the seat and opens it
at the back.

**Driver (Bo-shan):** Pear Halt's not on here. Nor the Slow Channel. Nor the Low Bell camps. You carried
sealed crates to all three. You just never wrote where.

**Jin:** Then write them in. If they're written, they're on the list, and my riders go.

**Narrator:** She holds out her own pen.

**VOTE — Jin's guarantee**

- **Sign it.** The warning reaches every written landing in two hours, the three erased places included,
  because Bo-shan wrote them in. Jin leaves on the first ferry and never answers in public for her contract.
  _Sets `jin_guarantee_signed`; the downstream warning is secured in full._
- **Refuse.** Jin stays in reach of a hearing. The warning goes by flag, lamp and boat. It gets there. Some
  landings hear late, and lose boats and stores they would have moved.
  _Sets `jin_guarantee_refused`; the downstream warning is secured, late._

Footer: "The warning goes out either way. Nobody downstream is left untold."

**If signed:** **Jin:** Read it back. ..."Unheld." Good. _(Narrator: She whistles once. Riders come out of
the rain from three directions, as if they had been waiting for the pen to lift.)_

**If refused:** **Jin:** That's a clean answer. I said so the first time. _(Narrator: She picks up her trunk
and goes to stand under the shed eaves, out of the wet, where anyone who wants her can find her. Nel's niece
is already running for the flag rope.)_

### Scene 13.6 — Rusk at the spillway

**Shown:** played, into a fight. **Where:** the marsh spillway's gate wheel. Every table reaches this.

**Narrator:** A flag from Reedglass: up, sideways, and then a third move Oru never taught. Yenna reads it
twice.

**Yenna:** "Grey coats at the gate wheel." They've made up a new signal. They've made it up on the spot and I
understood it.

**Narrator:** At the spillway, Marshal Rusk is standing on the gate platform in the rain. He is as wet as
everyone else, and it has made no difference to how he stands. Twelve officers are with him. He has a company
key in the gate wheel.

**Narrator:** Below, on every loosened walkway and every tethered roof, the people of Reedglass are standing
with lamps.

**Rusk:** This is an unauthorised release from a critical works. I am closing it. I would ask the residents
to go indoors.

**Fenn:** If you shut that, the surge goes through our kitchens!

**Rusk:** If I leave it open, a marsh, a committee and a bird are deciding when a city floods. I have seen
what happens when nobody is in command. I was there.

**Narrator:** He does not raise his voice. He turns to the party as if you had come to his office.

**Rusk:** Seven years ago I held four boats because the paper said hold. People call that cruelty now. It was
obedience. I would do it again. Somebody has to be the one who does what the paper says, or there is no
paper.

**Rusk:** So. Show me the paper that says this gate stays open. Signed, and from an authority. I will open it
with my own hands.

**CHOICE (the decider; this sets how the fight can end):**

- **Show him the courtyard gate.** A copy of the names chalked in MQ-10, and the Director's signed order
  making the safety files public.
  **Rusk:** That is not an authority. That is a list of people.
  **Sergeant:** ...Sir. My mother's street is on that list. That's her hand. She can't hardly write, and
  she's written it.
  _Opens the objective "The sergeant": if the party holds the gate wheel for three rounds without striking
  the sergeant, he and half the squad stand down._
- **"There's no paper. There's four hundred people with lamps. Look at them."**
  **Rusk:** I have looked. Sergeant, close the gate.
  _The fight is to a finish._

**Fight:** the spillway platform (hold the gate wheel; Rusk fights, as an earthbender, with exact, economical
moves. He does not gloat.)

**Fight barks:**

- **Rusk:** "I am not angry with any of you. I would like that understood."
- **Rusk (when hurt):** "Noted."
- **Sergeant:** "Sir, the residents aren't dispersing." **Rusk:** "No. They have nowhere indoors to go. I do
  know that."
- **Still Keeper (once):** "That one wants it shut. I wanted it shut. I know that wanting."

> **If Riko is in the party and the sergeant's objective is open —**
> **Riko:** Sergeant. Nobody's asking you to hit him. Take your hand off the wheel and walk to the rail.
> That's all of it.

**How it ends (one of three):**

**Arrested** _(Rusk is beaten in the fight)._

**Narrator:** Rusk sits down on the gate platform, carefully, like a man lowering himself into a chair. He
takes the company key out of the wheel and holds it out, handle first.

**Rusk:** You'll want this logged. Date and hour. I would.

**Rusk:** There is a cat at the dispatch yard. She is fed at six. Nobody else knows that.

**Fenn:** ...I'll tell the yard.

**Narrator:** She says it flatly. She does not say it kindly. He nods as if that were the correct form.

_Sets `rusk_arrested`._

**Isolated** _(the sergeant objective is met)._

**Narrator:** The sergeant steps away from the wheel. Then five more. They do not join the party. They go and
stand at the platform rail with their backs to the Marshal, facing the people with the lamps.

**Sergeant:** I'm not arresting you, sir. I don't know how. I'm just not shutting it.

**Narrator:** Rusk looks at the six backs. For the first time, he has nothing to straighten. He takes the key
from the wheel himself and sets it on the rail.

**Rusk:** Then I am relieved. Somebody should write down by whom. I don't believe it was anybody.

_Sets `rusk_isolated`._

**CARRY ON — driven off** _(the fight is lost)._

**Narrator:** They put you off the platform. The gate comes half down, and the surge starts to climb the
walkway piles.

**Narrator:** And then nothing else happens. Rusk is standing with his hand on the wheel, and four hundred
people on rooftops are looking at him, each with a lamp. Nobody throws anything. Nobody shouts. They have all
simply come outside to see who it is.

**Narrator:** A written order, in a small level hand, has fallen from his coat onto the wet boards. Latch is
standing over it.

**Latch:** This fell. So it is lost. So I am giving it back. Whose is it? I will read the name. "O. Rusk."
Is there an O. Rusk?

**Narrator:** Rusk does not answer to it. He walks down the platform steps and away along the dyke toward the
Works, with the six who will still follow him. Fenn's crew has the gate back up inside the hour.

_Sets `rusk_driven_off` and `front_spillway` lost (even if it was held earlier: an hour of half-shut gate does
the damage). The dropped order is evidence, and it is kept._

### Scene 13.7 — Toward the green door

**Shown:** played (bridge).

**Narrator:** The tide is an hour from turning. From the dyke you can see the Stillwater Works: a hill of
brick and iron with water coming off it in sheets, and every window lit.

**Driver (Bo-shan):** Cistern gallery's the east side. I can get the cart to the door. Not through it.

**Narrator:** Somebody in the Works has opened a small green door and wedged it with a brick.

---

## MQ-14 — The Engine in Revolt

**Theme card:** MQ-14, The Engine in Revolt

Themes: balance, responsibility, equality. A machine that is good at its job is doing it too well. A spirit
that kept a promise is keeping it to death. A woman who can run the whole works is asked to teach somebody
else one wheel. Nothing is destroyed. A key is put down where another hand can reach it.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (four practical facts, not four
      elements)
- [x] No instant forgiveness or absolution (DLG-11: nobody reassures her)
- [x] The other side's reasons are shown (Veyra's, the Keeper's and the loyalists', each in their own words)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**The four facts.** The party cannot end the night until all four are true. Each can be secured by the party
or by a crew it met earlier; none needs a particular element.

| Fact                           | Secured by                                                               |
| ------------------------------ | ------------------------------------------------------------------------ |
| A relief route is open         | The marsh spillway (13.4, 13.6); Ba Dan's culvert line, if its crew came |
| Operators can stop the system  | The low district stop wheel (Fenn's key), and the main release (14.5)    |
| People downstream are warned   | Jin's riders or the flag line (13.5)                                     |
| The spirit passage is unsealed | The main vanes' manual release, behind the green door (14.5)             |

A lost front does not make a fact impossible; it makes it later and dearer, and Scene 14.7 counts it.

### Scene 14.1 — The inside of it

**Shown:** played. This is the prologue again, with the lights on.

**Narrator:** Inside the green door there is a locker room. Wet coats on hooks. A row of lunch tins with
names scratched in the lids. A tap in the wall with a tin cup on a chain, and a hand-lettered card over it:
"Tea water. Never missed a shift."

**Narrator:** Beyond that is the cistern gallery, and it is the biggest room you have ever stood in. A lake
under a roof. Gate housings like the fronts of houses. A turbine, somewhere below, screaming.

**Narrator:** Water is coming over the gallery floor in a sheet. And every few breaths, the whole lake
shivers, once, and then, exactly the same, once more.

**Narrator:** On the control gallery above, a woman in a blue coat is working three valve wheels with a crew
of four where there should be twenty. Her sleeves are rolled. She has a key on a cord round her wrist.

**Veyra:** If you've come to stop it, the stop is behind you, the green wheel, I told you where. If you've
come to help, the number two gate is jammed open and I can't leave these. Choose quickly. I'd choose the
gate.

### Scene 14.2 — Phase 1, the flood floor

**Shown:** played, into the fight. **Fight, phase 1:** the cistern floor (the Engine's gates open and close on
a count and move the water across the floor; Rusk's last loyalists hold the control desk and the walk to the
main release).

**Narrator:** Between you and the main release there is a control desk, and round it, nine men in grey with
the door barred behind them.

> **If `rusk_arrested` or `rusk_isolated` —**
> **Loyalist officer:** We hold the desk until the Marshal relieves us. Nobody's come. So we hold it.
>
> **Party:** The Marshal isn't coming.
>
> **Loyalist officer:** Then nobody can relieve us, can they. That's worse, not better. Stand back.

> **If `rusk_driven_off` —**
> **Narrator:** Rusk is at the desk, with six of his own. He has dried his face. His cuffs are straight.
>
> **Rusk:** The Director is tired and the works is failing. Somebody will be in command of this building at
> dawn. I intend that it should be somebody who has read the manual.
>
> _(He fights in this phase. Beaten here, he is arrested: the Scene 13.6 "Arrested" lines play, and
> `rusk_arrested` replaces `rusk_driven_off`.)_

**Fight barks:**

- **Veyra (from above):** "Gate two closes on my count! Be off the low side by three! One!"
- **Loyalist officer:** "Hold the desk! If we hold the desk it's still a works!"
- **Bera (arriving by the green door):** "Number two's my seal! I KNOW that seal! Somebody get me to it!"
- **Veyra:** "Bera? ...Get her to it. Whatever she says it needs, it needs."

> **If Wen is in the party —**
> **Wen:** That's my regulator on gate two. With a keyhole where the lever was. I need four minutes and
> somebody tall.

> **If Riko is in the party —**
> **Riko:** Nine at the desk. I only need them to sit down. Nobody here has to stay down.

> **If Kaya is in the party —**
> **Kaya:** Gate two, on three! ...Whose three? Mine or hers?
>
> **Veyra (from above):** MINE!
>
> **Kaya:** Hers. On hers. I'm waiting. Look at me waiting.

**After phase 1 (win):**

**Narrator:** The last of them sits down against the desk with his hands open. Bera has both arms inside the
number two gate housing, up to the shoulder.

**Loyalist officer:** I've got a lunch tin in that locker room. I've had the same hook for six years. I
didn't want it to stop being a works.

**Bera:** It's not going to stop being a works. It's going to stop being his.

### Scene 14.3 — Phase 2, the echo

**Shown:** played. **Fight, phase 2:** the same floor (no new enemies; the Still Keeper's repeating current
takes the machine. Every action taken on the floor repeats on the next round: a gate that was opened opens
again, a step taken is taken again by the water. The party must set up moves whose echo helps.)

**Narrator:** The lake shivers, and shivers. Then it does not stop shivering.

**Narrator:** Up through the middle of the cistern, where the vanes are shut, rises a heron as tall as a
doorway, made of water you can see through. The current inside its chest has gone white.

**Still Keeper:** It is all moving. I am keeping it. I am keeping all of it. I said yes.

**Narrator:** The gates begin to work by themselves. Open. And then, a breath later, open again.

**Veyra:** The Engine's taking its count from the water. Whatever the water did, the Engine does twice. I
have never seen this. I have seen the gauge that said it couldn't happen.

**What the water says during phase 2** _(one each round, as barks, in this order; only lines the party truly
heard are used)_**:**

| The echo                                  | Heard in | Used only if                       |
| ----------------------------------------- | -------- | ---------------------------------- |
| A dropped stone, and the same stone again | MQ-01    | the culvert beat was seen in Act I |
| Bo-shan's laugh                           | MQ-02    | `act1_complete`                    |
| "Good morning." (Dorin)                   | MQ-02    | `act1_lost`                        |
| "Careful." (Kesi)                         | MQ-03    | always                             |
| A child's laugh                           | MQ-04    | always                             |
| "...come home." (Pella's letter)          | MQ-05    | always                             |
| "...forty years." (Ansa)                  | MQ-06    | always                             |
| "Hold the rail."                          | MQ-08    | always                             |
| "We live there." (Fenn)                   | MQ-10    | always                             |
| "...when the tide turns." (the party)     | MQ-12    | always; it is the last one         |

**Narrator (with the last echo):** Your own promise comes back off the water. It is the only one of them that
has not happened yet.

> **If Sura is in the party —**
> **Sura:** I've counted every one since the first. It kept them all. It never lost a single one.
>
> **Narrator:** She wipes rain off her face with her wrist.
>
> **Sura:** That must have been so much to carry.

**At the green door (plays once in phase 2, only if Jinu is in the party and carried Pella's sealed letter):**

**Narrator:** At the green door, the cart is backed up with its ramp down. Jinu puts a letter into Bo-shan's
hand. It says "FOR THE WORST BIT."

**Jinu:** She said I'd know. I think I know.

**Narrator:** Bo-shan opens it. It is one line, pressed so hard it has come through the paper.

**Pella's letter (third):** "You said you are the cart. Carts come back. P."

**Narrator:** Behind him, the cistern takes the last two words and says them, over and over, getting quieter:
"...come back. ...come back."

**Driver (Bo-shan):** I heard. I heard the first time.

**After phase 2 (win):** the gates' doubled movement has been used to walk the party, and Bera, to the main
release. Go to 14.4.

### Scene 14.4 — DLG-10, the promise at the water

**Shown:** played. **When:** a physical bypass is open (the marsh spillway, however dearly). **Bible DLG-10,
word for word.** `Player` is `Party`.

> **If `front_spillway` is lost —** first: _Narrator:_ The Keeper does not turn its head when you speak. It has
> its wings out over a piece of water that went down the channel hours ago. Fenn's voice comes up the
> speaking-tube from the spillway gatehouse: "It's open! Tell it it's open! It won't look!" You have to say it
> three times.

**Still Keeper:** You said the water would stop changing.

**Party:** Someone promised that. They could not keep it.

**Still Keeper:** I kept it.

**Narrator:** The same leaf circles past for the third time.

**Party:** The leaf has nowhere to go.

**Still Keeper:** It has not been lost.

**VOTE (DLG-10's three; the table chooses how to ask):**

- **"Come and see the new passage."** Demonstrate a route that can be travelled, and name its caretakers.
  _(The narrator names them from the save: Fenn and the Reedglass crew; the netmaker's grandson; whoever
  holds the dawn gate.)_
- **"Tell us what you need to recognize the route when it changes."** Leads to markers, a yearly review, and
  an agreed meeting place. _(The bell clapper at the channel mouth, or the dawn gate, from MQ-07.)_
- **"We must release the pressure now. We will leave the passage open."** The direct crisis route. _(Offered
  only when the downstream warning is secured, which it always is by now, early or late.)_

> **If Sura is in the party —** **Sura:** A river can keep a path without keeping still. I had to learn that
> too.

> **If Nima is in the party —** **Nima:** We can promise to return. We can write down when.

**Still Keeper:** Humans write many things.

**Party:** Then judge us when we return.

**Narrator:** The leaf comes round once more. This time it does not turn. It slides through the opening and
away down the dark channel. The Still Keeper watches it go, and lowers one wing.

_End of DLG-10 (its spoken lines are word for word; its last stage direction is staged above as something
seen). The Keeper has not said yes in words._

### Scene 14.5 — Phase 3, letting go

**Shown:** played. **Fight, phase 3:** the main release (protect the operators at two wheels while the
release is worked in stages; the hazards are the water and the machine. No one is fought.)

**Narrator:** The main release is behind a second green door: a wheel as wide as a cartwheel, set low. Beside
it, a second, smaller wheel, on the far side of a gap that nobody could reach across alone.

Two versions. **Surrender** plays if the party reached this room by winning phases 1 and 2. **Resistance**
plays after any CARRY ON in this mission, or if two or more fronts were lost in MQ-13 (owner, 2026-11-15: her
choice stays tied to how the fights went). In Resistance she is removed from command and testifies later
(Scene 15.1), so in every ending she has given up command and testified (outline decision 17).

#### Surrender — DLG-11, Veyra lets go

**Cutscene candidate 1.** **Bible DLG-11, word for word.** `Player` is `Party`. The local operator is Bera.

**Narrator:** Veyra has come down from the control gallery. She is soaked, and she has the central control
key on its cord in her fist.

**Veyra:** The manual release needs a second operator.

**Party:** We have one.

**Veyra:** They don't know this station.

**Party:** You can teach them.

**Narrator:** Veyra looks at the central control key. She puts it on the dry ledge between them.

**Veyra:** After this, they will ask whether I knew.

**Party:** You can answer them.

**Veyra:** You make that sound very small.

**Party:** I don't think it is.

**Narrator:** She turns her back on the key. She takes Bera's wrist and sets Bera's hand on the small wheel.
Nobody in the room says anything to make it easier for her.

_End of DLG-11 (its spoken lines are word for word; its last stage direction is staged above as something
done)._

**Narrator:** On the dry ledge, beside the key, something small is turning round three times.

**Latch:** This is on an edge. Nobody is holding it.

**Narrator:** Everyone in the room goes still.

**Latch:** But it did not fall. I saw. She put it down on purpose, where another hand could reach. So it is
not lost. And it is not mine. It is being given, and not to me.

**Latch:** I will stand next to it until the one it is for picks it up. That is a thing I can do now.

**Narrator:** Bera takes her arm out of the gate housing, wipes her hand on her apron, and picks up the key.

**Veyra:** Small wheel. Quarter turns. Wait for the needle each time. It will want to be hurried. Don't let
it hurry you. I always let it hurry me.

**Bera:** It's in the book?

**Veyra:** It will be. You'll write it.

_Veyra joins as a guest for phase 3 with her MQ-02 kit (pressure lance, signal flare). She works the large
wheel. Sets `veyra_surrendered`._

**Phase 3 barks (surrender):**

- **Veyra:** "Quarter turn. Needle. Quarter turn. Good. You're slower than me. That's correct."
- **Bera:** "Seal's weeping on the left!" **Veyra:** "I see it. Log it. I'll read it tonight."
- **Veyra (flare, up the light well):** "That's for the shed roof. That says the vanes are opening."

#### Resistance

**Narrator:** Veyra has come down from the control gallery. She is soaked. The central control key is on its
cord in her fist, and her fist is against her chest.

**Veyra:** I can do both wheels. There's a pole. I've done it in drills.

**Party:** It needs two.

**Veyra:** It needs someone who knows it, and that's me. If I hand a stranger this station tonight and
they're a quarter-turn wrong, the low landing is gone. I have done the sum. I'm not being proud. I'm being
right.

**Narrator:** On the ledge beside her, Latch is looking at her closed hand.

**Latch:** She is holding it. I cannot take a thing from a hand. Nobody can. It has to be put down.

**Narrator:** She does not put it down.

**Bera:** Then we go round you. There's an outside release on the spillway wall. It's rougher. It's what
it's for.

**Veyra:** Bera. If you use the outside release, open it from the downstream side first. The upstream cap
sticks, and if you force it, it shears. Downstream first.

**Narrator:** It is good advice. It is given with the key still in her fist. Bera nods, and goes, and two
of the shed's crew stand between Veyra and the wheel until it is done.

_The release is worked from outside. Phase 3 is the same protect-the-operators fight, on the spillway wall,
without a guest. Sets `veyra_removed`. Do not use the key-on-the-ledge image in this branch._

### Scene 14.6 — The valve

**Shown:** played (both versions join here).

**Narrator:** The last quarter-turn. A hand on a valve wheel, and water coming over the gallery floor, and a
turbine, somewhere below, winding down from a scream to a hum.

**Narrator:** Far under your feet the vanes open, like shut blinds turned. The lake drops a hand's width. A
long ripple goes out across it from the middle to the walls.

**Narrator:** Everybody waits for the second one.

**Narrator:** It does not come.

**Narrator:** In the middle of the cistern the Still Keeper folds its wings. Then it walks, the way a heron
walks, through the open vanes and out into the dark of the old water road. It does not look back. It is not
that kind of animal.

**Narrator:** A leaf goes after it.

### Scene 14.7 — VOTE: the settlement

**Shown:** played. **Where:** the locker room, at first light. The table's last vote.

**Narrator:** First light comes through the green door. There are wet people sitting on every bench in the
locker room. Someone has found the tea tap. The tin cup is going round.

> **If Tenzo is in the party —** _Narrator:_ Tenzo has found half an onion in an open lunch tin. He has asked
> the whole room whose it is. Nobody is sure. He is holding the knife and waiting to be told.

**Bera:** It's safe till the next tide. That's twelve hours. Somebody has to say what it is after that, and
I'd sooner it was said now, with everyone too tired to make speeches.

**Neri:** _(or Edda)_ There are three shapes it can take. I've costed all three. None of them is free and
none of them is wrong.

**Neri:** One network, turned down. Everything stays joined. It runs at about six parts in ten. Every
district has a stop wheel and somebody trained to use it. The records are on the wall.

**Neri:** The old water road stays open and somebody keeps it. It only works if people turn up, every week, for
good.

**Fenn:** One network, at full, for one winter. The people who know it run it. The stop key stays outside
the Works, the records stay public, and there's a date on the gate when it all gets decided again. Lights
back in a week. And we spend the winter watching that date.

**Hesh:** Or you take it apart. Carefully. Each valley runs its own. Nobody over the hill can shut your gate
or leave your stop off a map. Some places will be dark a good while. So every district owes the next one a
crew when it's asked. In writing.

> **If one or more fronts were lost, or any phase of MQ-14 ended in CARRY ON —** **Bera:** And I'll say what
> last night cost, so nobody votes blind. _(She lists only what is true: "Two more streets under on the
> landing." "The relay house has no roof." "The east walkways are at the three stumps." "The main release
> was forced from outside; the upstream cap is sheared.")_ All three can still be done. Each starts further
> back.

**VOTE — What does the Common Current become?**

- **E-01, The Shared Current.** One network at reduced power, with public records, local stops, trained
  local operators, and the spirit road kept open. Less output, slower growth, and it needs people to staff it.
  _Sets `ending_shared`._
- **E-02, The Stewardship Winter.** Full service under experienced crews for one winter, with the stop key
  held outside the Works, public records, and a fixed review date. Quick relief; trust stays strained; the
  date has to be kept. _Sets `ending_stewardship`._
- **E-03, Many Small Lights.** Safe separation into local systems, bound by written mutual aid. No one valley
  can command another. Longer repairs, uneven light. _Sets `ending_small_lights`._

Footer: "All three keep the water clean and the passage open. Veyra does not command any of them."

**CARRY ON in MQ-14 (any phase lost).** There is no game-over. The party falls back to the green door; Bera
and the shed crews guide an emergency shutdown from the outside release (the Resistance version of 14.5, with
the party protecting them on the spillway wall as a short final stand that cannot itself be lost). Scenes 14.4
and 14.6 still play. The vote above is offered in full, with Bera's list of costs. _Sets `final_carried_on`; the
community modifier in MQ-15 drops one step._

---

## MQ-15 — What Happens Tomorrow

**Theme card:** MQ-15, What Happens Tomorrow

Themes: all six, carried by small things. A woman who ran everything mends one pump while somebody else holds
the list. A ledger reaches nothing. A cart stops where no map says to. Someone moves a chair.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution (nobody is pardoned; nobody is embraced who was not before)
- [x] The other side's reasons are shown (each antagonist ends as a person, with an outcome of their own)
- [x] The theme is never stated outright (no closing speech)
- [x] Absent heroes are never voiced

### Scene 15.1 — The accounting

**Shown:** played. **Where:** Causeway's assembly courtyard, a week later.

**Narrator:** The courtyard has dried out. The ramp is still there. Somebody has replaced the benches and
the office door with planed boards and put a rail on it. Nobody has put up a plaque.

> **If `strategy_staged` —** _Narrator:_ Every lamp that was lit that night is lit now. The crews who kept them
> lit look as if they have not sat down since.

> **If `strategy_reduced` —** _Narrator:_ Half the lamp posts round the courtyard are still dark. A chalk board
> by the gate gives the day each street comes back. The last one is three weeks off.

**Narrator:** People are speaking from the platform in turn. A clerk is writing all of it down, and a second
clerk is writing it down again, for the wall.

**Veyra — one of three:**

**If `veyra_surrendered`:**

**Narrator:** Veyra comes up the ramp. Not the steps. She has no key on her wrist. Her cuffs have been
mended again.

**Fenn:** Did you know the readings were unsafe?

> **After `demand_removal` —** Fenn's question is instead: "In this courtyard we asked you to leave command.
> You stayed. Did you know the readings were unsafe?"

**Veyra:** I was told on the fourth day of the first month. I decided on the ninth. For five days I knew and
had not decided. After the ninth I knew and had.

**Fenn:** Why?

**Veyra:** I've given my reasons. They're on the wall. I still think they were reasons. I don't think they
were enough. I'm not asking this room to tell me which.

**Narrator:** Nobody does. Meren Sen is in the fourth row, whittling. She does not look up, and she does not
leave.

**If `veyra_removed`, and she resisted only by refusing the key:**

**Narrator:** Veyra is brought up the ramp by two of the shed's crew. They are not holding her. They walk a
pace behind.

**Fenn:** Did you know?

**Veyra:** Yes. The fourth. I decided on the ninth. And at the wheel I would not give up the key. You went
round me. You were right to. I'd have said so then if I'd been able to open my hand.

**If `veyra_removed` and `final_carried_on`:**

**Narrator:** Veyra is not in the courtyard. Her statement is read out by a clerk. It is four pages. It is
complete, dated, and corrected in ink in two places.

**Clerk:** "...I will answer any question put to me in person, when I am asked. V. Sen."

**Narrator:** Bera has a list of questions. It is long. She folds it and puts it in her log book for the day
they are asked.

**Rusk — one of three:**

- **`rusk_arrested`:** _Narrator:_ The Marshal's own orders are read out, in order, by date. He is in the
  courtyard lock-up and has asked for nothing but a clothes brush. The yard hands feed the cat at six.
- **`rusk_isolated`:** _Narrator:_ The Marshal's own orders are read out. He attends, in a plain coat,
  between two of the officers who turned their backs. Asked if he disputes any of it, he says: "No. They are
  accurate. I kept good records." He is bound over for the council's hearing.
- **`rusk_driven_off`:** _Narrator:_ The Marshal's orders are read out, ending with the one he dropped on the
  spillway. He is not here. A carter saw him on the inland road, walking, with a small bag. A notice with his
  name on it has been posted on every lamp post. The printing is not as level as his was.

**Jin — one of two:**

- **`jin_guarantee_signed`:** _Narrator:_ Jin left on the first ferry after the tide, with one trunk. Her
  riders reached every landing that was written on her list. A hamlet below the Low Bell that nobody thought
  to write got its warning from Nel's flag instead, half an hour later. Jin's guarantee is pinned to the
  wall with everything else. It was kept, to the letter, by both sides.
- **`jin_guarantee_refused`:** _Narrator:_ Jin is called. She comes, with her tin box, and answers exactly
  what she is asked and nothing beside it. When the clerk reaches the end of his questions she asks if she is
  held. Nobody has a paper that says she is. She is on the afternoon ferry, with one trunk.

### Scene 15.2 — One repair

**Shown:** played. **CHOICE (the decider):** the party lends a morning to one job. Each is a short scene; the
other jobs are done by other people and seen in passing.

- **Re-hang the lamp at the bottom of Tanner's Stair.**
  **Hua:** A bit left. Left. That's it. I can see the page from the step now.
  _(If her house flooded:_ **Hua:** "I'm in my neighbour's back room till it dries. She snores. I read
  through it.")
- **Re-pin a Reedglass walkway.**
  **Old netmaker:** Leave the last pin loose. We take it out again in the spring. A walkway you can't take
  apart isn't finished.
- **Carry stone for the relay house** _(or its new roof, if it was lost)._
  **Luli:** I've had a day off. A whole one. I didn't know what to do with it. I came and looked at this.

### Scene 15.3 — The three endings

One plays, by the table's vote. Each is its own closing sequence, in held views with short lines. Then all
three continue to 15.4.

#### E-01 — The Shared Current

**Narrator:** The lamps of Causeway come on at dusk at six parts in ten. You can read by them. You have to
sit a little closer.

**Narrator:** On the low landing, the stop wheel has a roof over it now, and a rota nailed beside it. Seven
names for seven nights. Thursday's is blank. Under it somebody has written: "Still nobody. Ask Fenn." Under
that, in a different hand: "I'll do it. — Min."

**Narrator:** The bathhouse opens on alternate days. The old bather has learned which. He sits on the step
on the other days, in case.

**Narrator:** At Pear Halt, the signal lamp marked "14" is lit. The Thursday train stops.

> **If `rail_window_community` —** _Narrator:_ Hesh is on the regulator. Beside him, learning, is a woman
> nobody's father spoke for.

> **If `rail_service_council` —** _Narrator:_ The conductor steps down with the nurse's bag and hands it to
> Ansa himself, and writes the time in his book, and is not docked.

**Narrator:** At Reedglass, at dawn, the gate goes up.

> **If `marsh_corridor_wide` —** _Narrator:_ It has not come down since. The bell clapper swings at the
> channel mouth. A tall shape stands by it some mornings, and some mornings does not.

> **If `marsh_crossing_scheduled` —** _Narrator:_ A tall shape is already waiting in the mist when the crew
> arrives. It is always early. Fenn has stopped apologising for being on time.

**Narrator:** On Bellweather, a flag goes up and cuts sideways, for practice. Across the valley, another.

**Narrator (the community modifier, one line):**

- _All fronts held:_ The public list on the courtyard gate has nine repairs on it. Six are crossed off.
- _One front lost, or `final_carried_on`:_ The public list has nineteen repairs on it. Four are crossed off.
  There is a queue to sign up for the fifth.
- _Two or more lost:_ The public list runs onto a second board. People stand and read it the way they once
  read the posters. Then most of them pick up a tool.

**Veyra, in this ending:**

**Narrator:** At the low end of Saltstep, a hand pump has lost its prime. A woman in a blue coat is on her
knees beside it with the housing off. Another woman stands over her with a log book.

**Bera:** Seal first. Then the leather. Then you log it, and I read it today.

**Veyra:** Today.

**Narrator:** A girl of about ten is waiting with two buckets, watching to see if the pump woman knows what
she is doing.

_(If `veyra_removed`: the same scene, with one of the shed's crew sitting on the wall nearby, eating an
apple. Veyra works under a restriction and under Bera. She does not chat.)_

#### E-02 — The Stewardship Winter

**Narrator:** The lamps of Causeway come back in six days, every one, at full. The bathhouse steams. The
late shelf is hot at midnight. On the low landing people stand in their doorways for a minute, just looking
at their own street.

**Narrator:** On the courtyard gate, in chalk letters a foot high, there is a date. It is the first day of
spring. Under it: "REVIEW. EVERYONE. BRING A CHAIR."

**Narrator:** Every morning somebody rubs out the number under the date and writes one less. It is a
different somebody each morning.

**Narrator:** Fenn wears the stop key on a cord round her neck. She has not used it. She takes it off to
wash and puts it straight back on.

**Grandmother Ansa:** The train stops. The lamps are lovely. I'll believe the date when it's the day after
it.

**Narrator:** In the Works, Bera's crew runs the desk. The safety file is on a stand in the locker room,
open, with a pencil on a string. Anyone on shift can write in it. Most days somebody does.

**Narrator:** At Reedglass the crossing is kept, by the same people who opened it. On Bellweather the flags
are flown.

**Narrator (the community modifier, one line):**

- _All fronts held:_ In the tram shed, the cots have been stacked. Somebody has chalked on the door: "Not
  needed. Keep anyway."
- _One front lost, or `final_carried_on`:_ In the tram shed, sixty cots are still made up. The date on the
  gate is the date they are promised houses by.
- _Two or more lost:_ The tram shed is still full. The date on the gate matters most in here. A child has
  copied it onto the wall above her cot, with the wrong number of days, and nobody has corrected her.

**Veyra, in this ending:**

**Narrator:** Veyra is not in the Works. She is in a pump house on the low landing with her sleeves rolled,
re-seating a valve, because Bera's list said to. When it is done she writes the hour in the log and signs it
on the second line. The first line is for whoever checks it.

**Narrator:** On the way out she stops at the gate and reads the date. She reads it every day. It is her
review as well.

_(If `veyra_removed`: she is not allowed on the Works side of the gate at all. She re-seats the valve, signs
the second line, and is walked home.)_

#### E-03 — Many Small Lights

**Narrator:** The great relay is thrown for the last time, by hand, with thirty people watching. The lamps of
Causeway go out together.

**Narrator:** Then, a street at a time, other lights come on. A small engine in a tram shed. Forty lanterns
with crooked-handle stamps along the ferry steps. A water wheel on the Orchard stream, turning a single wire.
At Reedglass, fireflies, and one lamp on the school raft. On Bellweather, a lantern in every tent, and a red
flag by day.

**Narrator:** They are not the same brightness. From the dyke you can see which streets have them and which
are waiting.

**Narrator:** On the courtyard gate there is a board ruled in columns. "Owed to." "Owed by." "For what."
Pear Halt owes the low landing two days of stone-hauling. The low landing owes Reedglass a pump fitter. The
heights owe everybody flags, and have paid.

**Hesh:** Nobody over the hill can take our stop off a map again. Nobody over the hill is coming to mend our
viaduct, either. I've read that board every morning. So far everyone's paid.

**Narrator:** At the Slow Channel there are no vanes at all. The posts they stood on have been left in, for
herons.

**Narrator (the community modifier, one line):**

- _All fronts held:_ The dark streets on the low landing each have a date painted on the corner house. The
  first three dates have passed. The lamps came on those days.
- _One front lost, or `final_carried_on`:_ The dark streets each have a date painted on the corner house.
  Some of the dates are next year.
- _Two or more lost:_ Some dark streets have a date. Some have a question mark, and under it a list of what
  is needed first. People add to the lists. People cross things off.

**Veyra, in this ending:**

**Narrator:** There is no Works for her to be kept out of. There is a pump at the low end of Saltstep that
has lost its prime, and a district committee of five that has to approve any repair to it. Veyra waits on
the bench outside their door with her tools in her lap until they call her in.

**Bera:** They've said yes. They've said do the seal first. I'm to watch.

**Veyra:** Then watch closely. You'll be doing the next one.

_(If `veyra_removed`: Bera does the repair. Veyra hands her the tools, in order, and says what each is for.)_

### Scene 15.4 — One closing scene each

**Shown:** found. One per selected hero, wherever their thread ended. The first version plays if their
personal quest was resolved constructively; the second if it was skipped or left open (a credible next step,
not a sudden change). An absent hero has none.

**Kaya** _(the ferry steps at Saltstep, under Miri's lanterns)_

- _Resolved:_ **Narrator:** It is Thursday. Kaya is up a ladder, taking down forty lanterns and packing each
  one in straw so it won't chime. Miri is holding the ladder. Neither of them is talking. It is going very
  well.
- _Open:_ **Kaya:** I'll be... No. **Narrator:** She gets a pencil stub out and writes on the lid of the
  crate: "Back the ninth day of next month. Kaya." She reads it over. She adds the year.

**Tenzo** _(the Six-Ladle Kitchen)_

- _Resolved:_ **Narrator:** The kitchen is run by its cooks now. _(After `pq02_posted_terms`, where Ketu still
  holds the contract, this sentence is instead: "The terms are still on the wall beside the late shelf, with
  a season of initials down the margin.")_ Tenzo is at the long table with a bowl in front of him. Somebody is
  doing the rice differently from how he would. He eats it. He does not get up.
- _Open:_ **Dema:** There's a place. Sit. Before you say anything about the stock, I'm going to tell you how
  the wages went this month, and you're going to listen to all of it. **Tenzo:** ...I'm listening.

**Nilak** _(the Open Palm Clinic)_

- _Resolved:_ **Nilak:** She's stable. Fever's down. Dr. Iset has her from here. **Narrator:** He washes his
  hands, hangs up his apron, goes out to the bench in the yard, and is asleep before he has finished sitting
  down.
- _Open:_ **Narrator:** A letter, in Aru's hand. "I am in Causeway on the tenth. I would like to talk. I am
  not asking you to agree with me. Tea?" Nilak reads it twice, and then goes to find out which day the
  tenth is.

**Sura** _(the Reedglass landing)_

- _Resolved:_ **Sura:** Vessa. Before I go out. What's the channel doing today? **Vessa:** Fast on the left
  since the rain. Slack by the stumps. **Sura:** Left's fast. Stumps are slack. Thank you.
- _Open:_ **Narrator:** In Sura's pack, with the dried fish, is a route sketch of an ice crossing with a line
  through it. She has not thrown it away. She has written the date on it.

**Bo** _(the Orchard viaduct)_

- _Resolved:_ **Renn:** Bo, far jack. Wait for my count. **Narrator:** Bo takes the far jack. He waits for
  the count. His hands, between counts, stay at his sides.
- _Open:_ **Narrator:** Bo has a small job: one cracked sleeper. He looks at the crew. **Bo:** Who wants to
  run this one? **Narrator:** Nobody answers straight away. They are not used to the question. Then Feng
  puts his hand up, already talking.

**Lin Mei** _(the dispatch office)_

- _Resolved:_ **Narrator:** The painted map has come down. Lin Mei's new one is pinned up in its place, in
  pencil, with a wide margin. The margin is full: Yenna's block capitals, Fenn's chalky scrawl, a child's
  drawing of a path with "HERE" on it. Lin Mei has inked none of it over.
- _Open:_ **Narrator:** The shed-door map hangs over Lin Mei's desk. Its margin is still headed "What I need
  to ask". There is one line in it, in Yenna's hand. Under that, Lin Mei has written a second question
  herself, and a name to take it to.

**Nima** _(the listening terrace)_

- _Resolved:_ **Narrator:** Night. Everyone else has gone down to the valley for Returning Wind. Nima is on
  the flag watch with a blanket and a flask. Nothing happens for six hours. At dawn he writes "Quiet. All
  flags answered," and signs it.
- _Open:_ **Narrator:** Nima is writing a note. It has taken him three tries. "Sena. Leaving tomorrow for
  the coast. Back by the new moon. I am telling you before, this time. N." He gives it to a student going
  up, and then stands there until the student is out of sight.

**Jinu** _(the Bellweather mail shelter)_

- _Resolved:_ **Narrator:** Jinu hands a sealed letter across a half-door. The woman who takes it goes
  inside to read it. Jinu will never know what it said. She shoulders her bag. She is whistling.
- _Open:_ **Jinu:** I heard the funniest thing about the tram operator and that goose. Can I... I should ask
  him first. I'm going to go and ask him first. Don't go anywhere.

**Riko** _(the old passenger platform at the Orchard)_

- _Resolved:_ **Narrator:** Eight people on the platform: two rail hands, a loader, a clerk from Accounts, an
  old woman of seventy-three. Riko walks down the line turning each wrist a little. **Riko:** Thumb. Turn.
  And then? **All of them, raggedly:** Walk away. **Riko:** Again.
- _Open:_ **Riko:** I practise here at dawn. Alone, mostly. **Narrator:** She says it to Kesi, as if it were
  about the weather. **Riko:** You could come. If you wanted. I'd show you one thing.

**Wen** _(the public workshop)_

- _Resolved:_ **Narrator:** Min has Wen's regulator in pieces on the bench. She has moved the release lever
  to the other side. **Min:** It's better for left-handers. **Narrator:** Wen opens her mouth. She shuts it.
  She watches Min put it back together, and it is better.
- _Open:_ **Narrator:** Wen has a new drawing. Before she signs it she writes, across the top, larger than
  the title: "TO STOP: 1. Pull the red lever down. 2. Wait for the hiss. 3. That's all." Then her name,
  underneath, smaller.

### Scene 15.5 — Ba Dan

**Shown:** played. **Where:** Ba Dan, the workshop and then Mira's table.

**Narrator:** Ba Dan. Boots outside doors. Stone carts on the east road, with wages chalked on the notice
board before they leave. The board has four different hands on it this week.

**In the workshop:**

**Narrator:** Grumbler is fitting a lamp to the cart, on an iron arm over the driver's seat. Pella is on the
upturned bucket. The ledger is open at its last page.

**Grumbler:** Lamp. Hood, glass, oil well. The glass came from Saltstep with a chip in it. I did not chip
it. The arm is longer than I'd like because the canopy is in the way, and I did not make the canopy square,
because...

**Pella:** That's the last one.

**Narrator:** Grumbler stops.

**Pella:** The lamp is three days. You had three left. It says nothing owed.

**Narrator:** She turns the ledger round so he can see the bottom of the column. He looks at it for a long
time. His hands, for once, are not doing anything.

**Grumbler:** ...The sum's right.

**Pella:** I know it's right. I did it twice. It says nothing owed. It doesn't say anything else.

**Narrator:** She shuts the book. Grumbler tightens the last bolt on the lamp arm, tests it, and goes to
find Daiyu, to ask what he should do tomorrow.

> **Loss branch.** His ledger opened at ninety days in MQ-11, so it is nowhere near its last page. Replace
> from "That's the last one":
>
> **Pella:** The lamp is three days. That's sixty-nine.
>
> **Grumbler:** A lamp is four. There is glass in a lamp.
>
> **Pella:** You didn't make the glass. Sixty-nine.
>
> **Narrator:** He does not argue it further. He tightens the last bolt, tests it, and goes to find Daiyu, to
> ask what he should do tomorrow. Pella rules a line under the column and writes tomorrow's date at the top
> of a clean page.

**Ruon** _(by the guard hut; found)_**:**

- **Supervised repair** (every game but the one below; it is Mira's ruling in 11.6, whether or not the table
  asked him what he could offer): _Narrator:_ Ruon is sitting on the guard hut step with an awl, a pile of boots,
  and the six people from the far end of the wall. _(If no crew went to Causeway, or only five: "and a line of
  quarry hands".)_ He is fitting each of them in turn. **Ruon:** Stand. Walk to the gate and back. ...You're
  rolling out on the left. Give it here. _Narrator:_ He has no sabre and no rank, and a room in the guard hut
  that Hanru locks at night. Mira passes with a tray. She puts a bowl down on the step without stopping. She does
  not look at him. She has put it where he can reach.
- **He contests part of the hearing** (`ruon_traded`, and `ruon_offered_repair` not set): _Narrator:_ Ruon is
  mending the east road wall, alone, under Hanru's eye. He has written his own account, eleven pages, and asked
  that it be pinned beside the village's. It has been. He still fits boots, in the evenings, for anyone who asks.
  Two people have asked.

**Latch** _(on the tailgate; found)_**:**

**Latch:** I would like the lamp. For one night. There is a threshold at the marsh that has never had a
light on it, and I want to see what it looks like. I will bring it back before you leave.

**Driver (Bo-shan):** That's borrowing.

**Latch:** Is it? It is not lost, and nobody is giving it. It goes and it comes back. Yes. That is a fourth
kind. How many kinds are there?

**Driver (Bo-shan):** More than I know. Bring it back with oil in it.

**Narrator:** In the morning the lamp is on its arm. There is oil in it. There is also a small arrangement
of three shells on the driver's seat, which nobody is to move.

### Scene 15.6 — DLG-12, the chair

**Shown:** played. **Where:** Mira's table. **Bible DLG-12, word for word.**

**Pella:** Are you leaving again?

**CHOICE (the decider):** "Soon." / "After supper." / "We haven't decided."

- **After "Soon" — Mira:** I'll wrap something for the road.
- **After "After supper" — Mira:** I'll put another pot on.
- **After "We haven't decided" — Mira:** All right. There's room here tonight.

**Narrator:** Someone arrives carrying a bowl and finds the table full. Pella drags over a chair without
being asked.

**Narrator:** The chair rocks. Pella catches the bowl before anything spills.

**Pella:** Hold this a minute.

**Narrator:** She gives the bowl to its owner and crouches to fit a small wedge beneath the short leg. She
tests the seat before handing it back.

_The party can join the repair, keep eating while another resident helps, or quietly watch. End of DLG-12._

> **Who arrives with the bowl** _(the bible does not say; one plays, by what the party did)_**:** Hua, come to
> see "the village the cart was from" (if she sheltered the party); otherwise Yenna's mother, Grandmother
> Ansa, off a stone cart, with her basket; otherwise a quarry worker's cousin from the low landing whom
> nobody at the table has met before.

### Scene 15.7 — The last stop

**Shown:** cutscene candidate 2 (also works played). The final image.

**Narrator:** A road none of you has driven. The cart has a canopy that is not square, a ramp that is too
wide, a barrel with the tap on the left, and a lamp with a chip in the glass.

**Narrator:** Parcel stops by himself, at a place where nothing says to stop. A few plank houses. A well. A
track down to a landing with one boat. It is not in the delivery book. It is not on any wall.

**Narrator:** People come to their doors. They do not come further.

**Narrator:** Bo-shan gets down. He lowers the tailgate. He hooks on the ramp.

**Driver (Bo-shan):** Morning. I'm from Ba Dan. I've got room. Has anybody here got a letter that wants
taking? Or something that wants mending? Or... is anyone going my way?

**Narrator:** For a moment nobody moves. Then a door opens the rest of the way.

**Narrator:** At Mira's table, a long way west, somebody moves a chair so somebody else can sit down.

**Narrator:** Outside, the canal goes by the gate. It says nothing twice.

### Scene 15.8 — A letter (optional; after the card)

**Shown:** found (in free roam after the ending, at Ba Dan's notice board).

**Narrator:** A letter has come to the notice board from a long way off. The stamp is from a harbour none of
you knows.

**The letter:** "To whoever keeps the gate at Causeway now. We have a river and a works and an argument. We
heard you had the same and that nobody was thrown in the river. How did you write it down? Could somebody
come and show us? We can offer supper."

**Narrator:** Somebody has already pinned a second sheet under it, headed: "Who's going? Put your own name."

---

## Optional side fights

Optional, XP-paying fights in every region (owner, 2026-11-15), so a table can level toward the discipline
path it wants. None is needed for the main line, none hides a main clue, and every one pays its XP on a win
and on "Carry on" alike. The people in them have reasons. Nobody is hurt past a bruise.

Travel closes at the final commitment, so there are no side fights during the tide. These two open in the
aftermath (MQ-15) and stay open in free roam after the ending.

### SF-5.1 — The company store (Causeway's low landing)

**Who:** nine low-landing residents. **Where:** a flooded company store, guarded by two watchmen. **Why:**
their own goods are inside, left for safekeeping before the tide. The store's books went under, so the
watchmen will let nobody take anything without a receipt.

**Watchman:** I believe every one of you. I've got no paper says I can.

**Resident:** That's my mother's loom. I can describe every knot in it.

**Win:** the door is opened. **Watchman:** One at a time. Say what it is before you touch it. I'll write it
down as you go, and then there'll be a paper. **Carry on:** the door stays shut until the clerk from Accounts
arrives, at dusk, with a wet ledger and a pencil. Everything is given back by lamplight, slowly.

### SF-5.2 — Returning Wind bouts (Bellweather; sparring)

**Who:** anyone who turns up. **Where:** the sheltered pasture, with kites overhead. **Why:** a festival
bout. The prize is first cut of the plum cake.

**Oru:** In the left corner... no. In the corner nearest the tea... I'll just point.

**Win:** first cut of the cake. **Carry on:** second cut. It is the same cake.

## Community trust in this act

Read by lines, never a lock (see Act II). Here it feeds one thing: which of the three community lines each
ending shows (Scene 15.3).

| What feeds it                                         | Effect                                                   |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `front_landing`, `front_relay`, `front_spillway` held | each lost front moves the ending's community line a step |
| `final_carried_on`                                    | one step                                                 |
| `jin_guarantee_signed`                                | downstream landings warned in full; no step              |
| `jin_guarantee_refused`                               | downstream landings lose boats and stores; no step       |
| `rusk_isolated`                                       | Commonworks staff trust rises (his own people chose)     |
| `veyra_surrendered`                                   | Commonworks staff and the low landing both rise          |

## Jin's beat for this act

Scene 13.5: the downstream warning, sold for a written guarantee of her exit. Scene 15.1 shows the letter of
it kept.

## The echo in this act

| Mission | Where                  | What the water does                                                       |
| ------- | ---------------------- | ------------------------------------------------------------------------- |
| MQ-13   | The marsh spillway     | The same surge, over and over, until it is let through in stages          |
| MQ-14   | The Stillwater cistern | Every echo the party has heard since Act I (14.3). Then one ripple, alone |
| MQ-15   | Ba Dan's canal         | "It says nothing twice."                                                  |

## Cart upgrade for this act

The lamp (Scene 15.5). It is Grumbler's last line in Pella's ledger (after an Act I loss the ledger still has
sixty-nine days to run, and she starts a clean page).

## Latch across Acts III to V

Lost: the boot (MQ-07). Given: the shell (MQ-11). Not mine to take: the key on the ledge (MQ-14). Borrowed: the
lamp (MQ-15).

## Hero moments in this act

| Hero    | Where                                                                       |
| ------- | --------------------------------------------------------------------------- |
| Kaya    | 13.3 Luli's first lesson; 14.2 waiting for the count; 15.4 Thursday         |
| Tenzo   | 13.3 Luli's first lesson; 14.7 the onion; 15.4 the long table               |
| Nilak   | 13.2 a count of one hundred; 15.4 handing over a shift                      |
| Sura    | 13.2 the gap; 13.4 the banks; 14.3 counting ten; 14.4 her DLG-10 line       |
| Bo      | 13.2 not counting; 13.3 Renn's count; 15.4 the far jack                     |
| Lin Mei | 13.1 the map on the shed door; 13.4 the school path; 15.4 the margin        |
| Nima    | 14.4 his DLG-10 line; 15.4 the quiet watch                                  |
| Jinu    | 14.3 Pella's third letter; 15.4 the half-door                               |
| Riko    | 13.6 the sergeant's hand; 14.2 "nobody has to stay down"; 15.4 eight people |
| Wen     | 14.2 her regulator on gate two; 15.4 Min's lever                            |

## Decided (owner, 2026-11-15)

The owner accepted every item below on 2026-11-15, as recommended. Each item keeps its first wording, as the
record of what was accepted ("Recommend" lines are now decisions). Later corrections are marked.

1. **The final mission follows the story bible's proposed item 1** (_approved 2026-11-15_), which was marked
   "awaiting owner":
   the title is "The Engine in Revolt"; a lost final battle offers "Try again" or "Carry on"; "Carry on" plays
   the three-way vote with the lost fronts counted against it. I wrote it that way and did **not** write the
   bible's older rule (defeat forces E-03). Recommend: approve item 1 so this stands.
2. **What "counted against it" means.** I kept all three endings choosable after any loss. Each lost front,
   and a CARRY ON in MQ-14, adds named damage and moves the ending's community line one step (three steps are
   written for each ending). Nothing is locked. Recommend: approve; it matches the bible's "E-03 is not the
   bad ending" and the outline's "the fall must not undo choices".
3. **When Veyra gives up the key.** The outline says "if earned"; neither document says how. I made it: she
   puts the key down (DLG-11) if the party reaches the release by winning phases 1 and 2; she refuses if any
   phase was carried on or two or more fronts were lost. _Decided:_ it stays tied to how the fights went.
4. **Outline decision 17 against the bible's Veyra modifier.** The outline says that in every ending she "has
   given up command and testified". The bible keeps a branch where she refuses and is removed. I wrote both:
   in the refusal branch she is removed from command, her advice at the wheel is still good, and her testimony
   is given later (in person, or as a signed statement). In every ending she ends up mending a pump under
   Bera's direction, more closely supervised if she refused. _Decided:_ in the refusal branch she is removed
   and testifies later, so every ending meets outline decision 17.
5. **Bera is DLG-11's "local operator"** and the person Veyra later works under. The outline suggests "perhaps
   the worker whose warning she brushed off"; I made that definite.
6. **Latch and the key.** In DLG-11's branch Latch stands beside the key and does not take it ("it is being
   given, and not to me"). In the refusal branch Latch states the bible's own rule: it cannot take from a
   hand. The lamp in MQ-15 is "borrowed". This completes outline decision 13. Recommend: keep.
7. **Where Rusk's fight is.** The bible names the fronts as "lower landing, Copper Orchard relay, marsh
   spillway" and has Rusk "reclose the spillway"; the outline says his fight is "at the spillway" for every
   table. I put it at the marsh spillway after the three fronts, so every table gets it whichever front it
   chose. If he is only driven off, he is at the control desk in MQ-14 phase 1 and is arrested there.
8. **Rusk's three outcomes** are mapped to play: beaten (arrested); his sergeant stands down when shown the
   courtyard names (isolated); the fight is lost and four hundred residents with lamps simply watch him
   (driven off, with his dropped order kept as evidence). His case is given whole and calmly. The cat is fed.
   Recommend: approve.
9. **Ruon "leads a brace crew".** Outline decision 21 says he leads a crew under a worker he once guarded;
   the bible gives Renn a brace crew. I gave Ruon a gang of six at the bad end of the landing wall, under
   Daiyu, and kept Renn's crew at the relay (if PQ-05 earned it). _Decided:_ Ruon has two outcomes only
   (supervised repair; contests part of the hearing while serving restrictions). The bible's third modifier,
   "remains detained after unresolved testimony", is removed: MQ-11 always completes his account.
10. **Jin's Act V terms.** "The list is the list": her riders warn only what is written. Bo-shan writes the
    three erased places into her list from the delivery book, so the cart's ledger pays off one last time.
    Refusing costs time and property, never a life.
11. **Pella's third letter** ("Carts come back") plays only with Jinu, and is beyond the two letters decided.
    Recommend: approve or cut.
12. **The second relay opponent.** The relay front's fight is against a loyalist detail told to keep the
    relay shut; they do not know "open" from "off". Luli trips it by hand. The hand cranks on every pump, used
    on the loss, are Veyra's own design: one more thing she got right.
13. **Who arrives with the bowl in DLG-12.** The bible says "someone". I offer Hua, Ansa, or a stranger.
14. **The last stop** is a fourth place, in no book, not one of the three erased places the party already
    put back. Recommend: keep; it is what the outline's final image asks for.
15. **Names:** no new ones in this act beyond those listed in Acts II to IV.
16. **Where the documents disagree (Act V):**
    - MQ-14's title and its defeat rule: bible ("The Current We Keep"; defeat forces E-03) against the outline
      and the story bible's proposed item 1. See item 1.
    - Bible MQ-14 lets the final encounter be "a tactical struggle, a coordinated shutdown, or a mixed route";
      the outline fixes three phases. I wrote the three phases and kept the coordinated shutdown as the CARRY
      ON.
    - Outline decision 17 against the bible's Veyra modifier. See item 4.
    - Outline decision 21 (Ruon leads a brace crew) against bible MQ-13 (Renn leads one). See item 9.
    - Bible MQ-15's final image has "its driver" ask; the outline names Bo-shan. On the Act I loss branch the
      outline's decision 10 has Dorin hand back the reins in MQ-11, so it is Bo-shan in every game.
    - The outline says the echoes begin in Act I for every table; the culvert beat is optional in the shipped
      game. Phase 2 uses it only if it was seen.

## Open, for the owner

1. **Sura's line in DLG-10** ("A river can keep a path without keeping still. I had to learn that too.") was
   flagged as a possible statement of the theme. It is the bible's own optional line, word for word, so I
   left it in. Recommend: keep it (it is about her, and only plays with Sura); say so if you want it cut.
2. **The side fights** (SF-5.1 and SF-5.2) open only in the aftermath, because travel closes at the final
   commitment. If you want an XP fight before the finale, it belongs in Act IV's list.
3. **The trust table** here only feeds the three community lines per ending.
