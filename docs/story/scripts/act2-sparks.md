# Act II: Sparks — script for MQ-02 to MQ-05

**DRAFT for the owner (the writing pass, 2026-11-15). Nothing here is in the game.**

Sources: the bible's Part 04 (MQ-02 to MQ-05), its reveal ladder and DLG-04; the saga outline's beats 9 to 12 and
decisions 8 to 16, 19 and 24; the story bible's owner decisions (the cart, Parcel, Nala, Pella's letters). Where
the bible gives exact dialogue (DLG-04), it is used word for word and marked.

## How to read these scripts

- **One speaker per line.** Every line below is one dialogue node. `Narrator` lines are stage directions and are
  shown in the narrator frame.
- **`Party:` lines** are the table's side of a conversation. They are tappable choice text with no speaker and
  no portrait (owner, 2026-11-15). Where only one is offered, it is a single choice to tap. No `Party:` line
  needs a particular hero, and none is ever voiced by one.
- **Hero variants** are marked "If Kaya is in the party". They are extra, never needed. Every scene works with
  no hero speaking: delete all `Party:` and hero lines and the narrator and the locals still carry it.
- **Shown:** each scene is marked **found** (optional, by walking up to someone), **played** (dialogue in the
  game's own view) or **cutscene candidate** (two at most per act; the scene also works played).
- **VOTE** is a table vote. Each option says what it sets. Flag names are suggestions for the registry, not
  registered flags.
- **CARRY ON** is the branch after a lost fight when the table does not choose "Try again".
- **The driver.** After an Act I victory (`act1_complete`) Bo-shan drives the cart. After an Act I loss
  (`act1_lost`) Dorin drives it, Bo-shan and the four messengers are still held at the quarry, and Gao has
  patched the cart. Lines marked **Driver** are written twice.
- **Ruon.** `ruon_spared`: he is in Ba Dan under watch. `ruon_traded`: Jin has him.
- **What is already in the game.** Scenes 2.1 to 2.9, the arrival half of 3.1 (the cook, Tavi, Luli and her
  offer) and SF-2.1 are built word for word from this script (`src/content/regions/saltstepEmberwatch/`). The
  2026-11-17 edit pass left those lines alone; what it would change there is listed as proposals in the
  pass's report. Sura's and Wen's lines in 2.4 and Riko's in 2.6 are wired too (#900, 2026-11-19), each behind
  a `branchWhen` gate on the hero being in the party; Sura's culvert ending is a variant for a table that saw
  the culvert. Not yet wired, and so still edited here: Veyra's fight barks.

## What Act II may reveal

MQ-02: Emberwatch supplied the quarry, through a Commonworks contractor. MQ-03: the supply-control order is
signed "V. Sen, Director"; Marshal Rusk made it harsher. MQ-04: the Director is the engineer from the Saltstep
docks, and what she built is good. Nothing about the Works being unsafe, nothing about a refused shutdown, and
no spirit is named. The echoes are never explained.

## Trial slice (the first build)

The first region built from this script is **Saltstep market plus Emberwatch** (owner, 2026-11-15). It covers:

| In the slice                         | Scenes                                          |
| ------------------------------------ | ----------------------------------------------- |
| MQ-02, whole                         | 2.1 to 2.9                                      |
| Veyra's guest-ally fight             | 2.5 (needs the guest-ally ADR)                  |
| MQ-03, whole                         | 3.1 to 3.9                                      |
| One side fight                       | SF-2.1 "Wet ground", in Emberwatch's power yard |
| Teacher offers (the invitation only) | Luli and Edda in 3.1                            |
| Hero openings (first exchange only)  | Kaya's crates in 2.2; Wen's regulator in 3.1    |

Not in the slice: MQ-04, MQ-05, SF-2.2 and SF-2.3, the teacher stories and the personal quests. The slice ends
on Scene 3.9, the invitation to Causeway. The build list for it is at the end of this file.

## Cutscene candidates for this act

1. **The ferry under the lamps** (end of MQ-02): rope, water, the lamps coming on across the bay.
2. **The handwheel** (MQ-04, DLG-04): the child's hands on the wheel, Veyra's wet glove coming off.

Shot lists for both are in [cutscenes.md](cutscenes.md) (CS-2A, CS-2B), a proposal pending the trial
cutscene (#810).

---

## MQ-02 — Paper and Stone

**Theme card:** MQ-02, Paper and Stone

Themes: fairness, responsibility. A wage packet turns up in the wrong crate, and the people who earned it are
not there to claim it. A stranger shares her bowl and her work with the party before anyone knows what she is.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution
- [x] The other side's reasons are shown (the handlers are paid by the crate and the tide is turning)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

### Scene 2.1 — The coast road

**Shown:** played. **Where:** the cart, on the road down to Saltstep.

**Narrator:** The coast road drops out of the pines. Below it the bay is flat and grey. Far across the water, a
row of lamps is burning in broad daylight.

**Driver (Bo-shan):** Somebody over there forgot to put them out. Or they want us to look.

**Driver (Bo-shan):** Mira gave me this for you. She said read it before Saltstep, not after. She knows me.

**Narrator:** A folded note, tucked into the delivery book. Mira's handwriting leans to the left, like her
awning.

**Mira's note:** The rubbing goes to the harbour customs office. So do the back pages of Bo-shan's book, and
the mark Senn copied off those crates. Ask who shipped that machine. Write down who will not answer. Eat
something on the way. M.

**Narrator:** In the back of the delivery book, after the pages in the other hand, Senn has drawn the stencil
from the sealed crates beside the Driller: a lamp over a wavy line. Under it, in his tallyman's figures: "Not
the quarry company's. Not any carrier's I know."

**Driver (Bo-shan):** I've seen every stencil that comes up the coast road. I've sat on most of them. I've
never seen that one.

**Driver (Bo-shan):** Somebody counted crates out of my cart at night for two weeks and never wrote where they
went. I'd like to ask them about that.

> **Loss branch (Dorin drives).** Replace the Driver lines and the note:
>
> **Driver (Dorin):** Those lamps were not lit last month. I have that in the watch book. I did not know what to
> write next to it, so I wrote "lamps".
>
> **Driver (Dorin):** Gao gave me this for you. And a second water skin. He counted them out loud.
>
> **Narrator:** A delivery receipt, from the drawer where Gao keeps the debt slips. A stone carter left it on
> his counter. It is not for stone. "Received at Stoneback: six sealed crates. Sent on: stop fourteen, route
> nine, bell three." It is stamped with a mark nobody in Ba Dan knows: a lamp over a wavy line.
>
> **Driver (Dorin):** That is all we have. There is no rubbing. The machine is still running, and Bo-shan's
> delivery book is still up there with it. One receipt.
>
> **Driver (Dorin):** A receipt is half of something. The courier office in Saltstep keeps the other halves. If
> the two say the same thing, it is evidence. If they don't, it is two pieces of paper. I looked that up.
>
> **Driver (Dorin):** Bo-shan's customers are still waiting. Gao loaded what he could. I am going to deliver
> it. Nobody told me to.

> **If Jinu is in the party (loss branch) —**
> **Jinu:** Saltstep office, second drawer, under "returned, no such person". That's where a receipt's other
> half goes when nobody claims it. I've filed a hundred. I never once wondered what they were for.

**Narrator:** The road levels out. The ostrich horse slows down by himself at a water trough, and waits until
somebody notices.

**Driver (Bo-shan):** That's Parcel. He stops where he thinks stops should be. Mostly he's right.

> **Loss branch.** **Driver (Dorin):** That's Parcel. He stops when he likes. I have decided to call those
> inspections.

### Scene 2.2 — Saltstep, two bowls

**Shown:** found (free roam on arrival; the bowl-seller stands where the cart stops).

**Narrator:** Saltstep is a market on the water. Stalls sit on platforms that rise and drop with the tide. Tall
poles show the water level in bright paint. Two sellers are arguing from boats that are slowly drifting apart.

**Bowl-seller:** New faces. Sit. Here.

**Narrator:** She puts down two bowls of pepper broth. Then she taps the second one.

**Bowl-seller:** That one's not yours. First bowl you eat. Second bowl you carry to somebody. That's how it's
done here.

**Party:** Carry it to who?

**Bowl-seller:** Anybody who hasn't eaten. Today, the pump woman out on the freight pontoon. She's been out
there since the tide turned, and she never comes in.

**Bowl-seller:** Bring the bowl back. People will tell you this custom is about kindness. It's about me not
washing bowls on a pontoon.

> **If Tenzo is in the party —**
> **Tenzo:** Pepper, river fish, and something sour right at the end. Pickled plum?
>
> **Bowl-seller:** Pickled plum skin. The plum I eat myself.
>
> **Tenzo:** I'll wash both bowls.

**Found around the market (each one optional, each stands alone):**

- **Tavi Ren, at the ferry landing.**
  **Tavi:** Ferry goes when the tide says. The company wants it to go when the company says. So far the tide's
  winning.
  **Tavi:** You're from up the stone road. You'll want customs. It's the stall with the flag, the one that's
  drifting. Run.

- **A freight office with a clean brass plate: "Jin. Contracts and Carriage."** The shutter is half down.
  **Freight clerk:** She's across the bay. If it's about a bill, leave it under the door. If it's about a
  person, she'll want it in writing.

  > **If `ruon_traded` —** **Freight clerk:** Oh. It's you. She said if you came by, I was to say the receipt
  > still stands, and offer you tea. Do you want the tea?

- **A stack of lantern crates with a crooked-handle stamp.**
  **Narrator:** Lantern crates, stacked by the ferry. Each one is stamped with a lantern with a crooked handle.
  A chalked note says: "Miri's. Do not sit on these. This means you, Oko."

  > **If Kaya is in the party —**
  > **Kaya:** She's here. The shop's here. It's about forty steps that way.
  >
  > **Narrator:** Kaya does not take the forty steps. She reads the chalk again instead.
  >
  > **Kaya:** After customs. I'll go after customs.

### Scene 2.3 — The customs stall drifts off

**Shown:** played, then a short choice of approach (not a vote: the decider picks; all three arrive at 2.4).

**Narrator:** The customs office is a floating stall with a flag, a stool and a brass seal on a chain. A customs
clerk and a freight handler are shouting across a crate.

**Customs clerk:** It says nine crates. I count ten. I can count to ten. They test us.

**Freight handler:** Nine are freight. The tenth is safety materials. Safety materials don't get counted, they
get loaded. Tide's going.

**Customs clerk:** Everything gets counted. That's why they gave me a stool.

**Narrator:** The handler slaps the mooring post to make his point. The rope was only looped. The stall, the
clerk, the stool and the argument start to drift away from the quay.

**Customs clerk:** This happens. Keep talking, I can still hear you!

**Approach (decider picks one):**

- **Jump aboard now.** _Narrator:_ You land on the stall. It dips, the seal swings on its chain, and the clerk
  hands your papers back without looking. "Hold the flag. If the flag goes in the water I have to fill in
  the long form."
- **Follow along the pole walk.** _Narrator:_ You run the plank walk beside the level poles, past a wedding
  being argued about and a man selling one spoon. The stall stays level with you the whole way, close enough to
  shout at.
- **Ask Tavi for a tow.** _Tavi:_ Again? That's the third time this month. Get in. Sit low. Don't help.

**Narrator:** However you get there, the clerk reads the rubbing, and then Senn's drawing in the back of the
delivery book, while the stall turns in a slow circle.

**Customs clerk:** A Republic City plate. Came in four months back, in parts, on a Commonworks contractor's
manifest. I stamped it. "Excavation plant, public works."

**Customs clerk:** And that stencil, the lamp over the wave. That's Emberwatch stores. Everything the
contractor lands goes across the bay first and comes back with that on it.

**Driver (Bo-shan):** Commonworks. They put the lamps in at the Saltstep ferry. Good lamps. I've unloaded
cabbages under them at midnight and counted every one. I didn't know they sent drilling machines to people.

> **Loss branch.** Replace the four lines above:
>
> **Narrator:** However you get there, the clerk reads Gao's receipt while the stall turns in a slow circle. He
> sends a boy along the pole walk to the courier office. The boy comes back with the other half.
>
> **Customs clerk:** They match. Six sealed crates, landed here on a Commonworks contractor's manifest. That
> stamp, the lamp over the wave, is Emberwatch stores. Everything the contractor lands goes across the bay
> first and comes back with that on it.
>
> **Customs clerk:** Same contractor brought an excavating machine through in parts, four months back. From
> Republic City. I stamped that too.
>
> **Driver (Dorin):** Commonworks put the lamps in at the Saltstep ferry. I have stood under them. I did not
> know they also sent machines to quarries.

**Customs clerk:** I stamp what the paper says. If the paper said "cabbages" I'd have stamped that. I want that
understood before anybody is cross with me.

**Customs clerk:** The same contractor's loading at the freight pontoon right now. Ten crates. Nine on paper.

**Narrator:** The stall bumps to a stop against the freight pontoon.

### Scene 2.4 — The pump woman

**Shown:** played. **Where:** the freight pontoon. This is the party's first meeting with Veyra. She is named;
her job is not. Nobody asks it.

**Narrator:** A woman in a dark blue work coat is kneeling on the pontoon beside a crated pump. Her cuffs have
been mended more than once. So has the teapot beside her: there is a neat line of solder all the way round the
spout.

**Narrator:** She is trying to walk the pump crate onto a handcart alone, one corner at a time.

**Veyra:** If that's for me, put it on the bollard. If you're with the freight office, I already said no.

**Party:** It's a bowl of broth. The seller sent it.

**Veyra:** Did she say to bring the bowl back?

**Party:** Twice.

**Narrator:** She laughs. It is a good laugh, and a slightly awkward one.

**Veyra:** Then I'd better eat it. Veyra. Take that corner, would you? Not that one. The one that looks
heavier.

**Narrator:** You take the corner. It is heavier.

**Veyra:** This goes to the low end of Saltstep. Hand pump. One person can work it, any person. No waiting on a
crew to come and move the water for you.

**Veyra:** The last one I fitted, a girl of ten kept it going for an hour because she wanted to beat her
brother. I've stopped fitting them for adults in my head. I fit them for her.

**Driver (Bo-shan):** You've got the rope the wrong way round. It'll tip. I know tipping. I am a student of
tipping.

**Veyra:** Show me.

**Narrator:** Bo-shan shows her. The crate tips anyway, slowly, onto the handcart, exactly where it was meant to
go. They both look at it.

**Driver (Bo-shan):** That was on purpose.

**Narrator:** He laughs. It carries across the flat water of the harbour.

**Narrator:** A moment later, from under the pontoon, the water gives the same laugh back. Smaller. Just once.

**Veyra:** Odd. The piles do that some days. I keep meaning to look into it.

> **Loss branch (Dorin drives).** Replace the Driver lines and the echo:
>
> **Driver (Dorin):** Good morning. Dorin, gate guard, Ba Dan. I am away from my gate with a permit.
>
> **Veyra:** Good morning, Dorin, gate guard. Take the other corner.
>
> **Narrator:** Dorin takes the corner. The crate goes onto the handcart with a bump. He straightens his collar.
>
> **Narrator:** From under the pontoon, the water says it back: "Good morning." Smaller. Just once.
>
> **Driver (Dorin):** I heard that. I am not going to write it down.

> **If Sura is in the party —** (place before Veyra's "Odd.")
> **Sura:** There. Under the boards. Did nobody else hear that?
>
> **Veyra:** Hear what?
>
> **Sura:** It said it twice.
>
> _(If the party saw the culvert in the Cutting, `cutting_culvert`, Sura's first line ends: "It did that in the
> Cutting. Under the road." The culvert is optional in Act I, so the plain version asks nothing of it.)_

> **If Wen is in the party —**
> **Wen:** That's a lift-and-force pump with the handle on a long throw. And you've put the stop where a short
> person can reach it. Who thinks of that?
>
> **Veyra:** Somebody who watched a short person fail to reach it. You've built one?
>
> **Wen:** Regulators. Smaller. Mostly on napkins.
>
> **Veyra:** Napkins are where it starts. Come and find me if you're ever in Causeway. I mean that.

**Narrator:** She pours the last of her tea into the pot's lid, because there is only one cup, and holds the cup
out to you.

### Scene 2.5 — The sling

**Shown:** played, into a fight. **Fight:** the Saltstep freight pontoon. **Guest ally:** Veyra (AI-controlled;
pressure lance, signal flare; a non-bender). Needs the guest-ally ADR (outline decision 15).

**Win:** stop the winch (a party member or Veyra stands at the winch brake at the end of a round), **or**
defeat the handlers. **Lose:** the whole party is down, or the crate reaches the barge (the sling crosses the
pontoon in six rounds). Veyra cannot be lost: if she is brought down she sits behind the pump until the fight
ends. The handlers yield at low health; nobody is thrown in the harbour but the clerk.

**Narrator:** Across the pontoon, the freight handlers have the tenth crate in a crane sling. It swings out over
the water. One strap is already fraying.

**Customs clerk:** That's the one! Put it down! I haven't counted it!

**Freight handler:** We're paid by the crate and the tide's going. Count it at Emberwatch.

**Narrator:** The clerk grabs the sling rope. A handler shoves him. The clerk goes backwards off the stall into
the harbour, with the stool.

**Veyra:** Stop that winch. That strap is going. There are people under it.

**Freight handler:** Who are you to say?

**Veyra:** Somebody who can see a strap.

**Narrator:** They do not stop the winch. Two more handlers step in front of it. Veyra picks up a long brass
lance from beside the pump and thumbs a valve. It hisses.

**Veyra:** I'd rather not. Are you coming?

**Fight barks (Veyra, guest):**

- On her first turn: "Winch first. People second only if they insist."
- When she uses the lance: "It's air. It's only air. Sit down."
- When she fires the flare: "Tavi! Boat in the water!"
- When an ally is hurt: "Back behind the pump. It's cast iron. I promise it'll hold."
- On winning: "Now put it down. Gently. Thank you."

**After a win:**

**Narrator:** The handlers lower the sling. Tavi poles the clerk back to the pontoon. He is still holding the
seal.

**Freight handler:** We get docked for every crate that misses the tide. You know that? Every one.

**Veyra:** I do now. Who docks you?

**Freight handler:** The contract. Nobody. It just comes out.

**CARRY ON (the fight is lost):**

**Narrator:** The winch does not stop. The handlers swing the tenth crate onto their barge and push off. The
strap gives as it lands. Something small and white drops out of the split corner and into the water.

**Narrator:** Veyra hooks it out with the tip of the lance before it sinks. Tavi hauls the clerk aboard.

**Customs clerk:** I'll write you a duplicate manifest. Nine crates on paper, ten on the water, and the name of
the barge. Tavi will witness it. It takes a day. Everything takes a day.

_Sets `lost_saltstep_docks`. The crate has gone to Emberwatch. The envelope and the duplicate manifest carry the
same proof into Scene 2.6; the handlers were not stopped, so there are no handler witnesses in the public
branch of the vote._

### Scene 2.6 — Safety materials

**Shown:** played.

**Narrator:** The tenth crate has split along one corner. It is stencilled "safety materials". Inside there is
straw, a coil of chain, and a flat paper packet tied with red string.

> **After CARRY ON:** _Narrator:_ What Veyra hooked out of the water is a flat paper packet tied with red
> string. The ink has run, but not much.

**Customs clerk:** That's a pay packet. I know a pay packet. I get one.

**Narrator:** The clerk reads the front out loud, slowly.

**Customs clerk:** "Stoneback Quarry. Lower galleries crew. Wages, third month." The seal's never been broken.

**Narrator:** Nobody says anything. A rope creaks.

**Driver (Bo-shan):** I was in those galleries. We were told the pay was late on the road.

**Driver (Bo-shan):** It wasn't on the road. It was in a box.

> **Loss branch.** **Driver (Dorin):** Lower galleries. That is where they are keeping him. That is his crew's
> money, and it is sitting in a box with a chain.

**Veyra:** That shouldn't be in there. That's somebody's pay.

**Narrator:** She turns the packet over, reads the back, and hands it to the clerk, not to you.

**Veyra:** Log it. Properly. Date and weight. Whoever packed that crate should have to explain it to somebody
with a stamp.

**Narrator:** Across the harbour, the ferry bell rings. She looks at the pump, and at the tide.

**Veyra:** I have to get this fitted before dark or forty households carry water another night. Thank you for
the corner. And the bowl.

**Veyra:** Ask your questions loudly. People round here answer better when their neighbours are listening.

**Narrator:** She wheels the handcart away along the pontoon. She has left the bowl on the bollard, rinsed.

> **If Riko is in the party —**
> **Riko:** She gave the packet to the man with the stamp.
>
> **Narrator:** Riko watches the handcart all the way to the end of the pontoon.

### Scene 2.7 — VOTE: loud or quiet

**Shown:** played. **Where:** the customs stall, moored again.

**Customs clerk:** I can do this two ways. I can read that packet out at the level pole at noon, with the seal
in my hand. Everybody on the water will hear it. Including whoever packed it.

**Customs clerk:** Or I seal a copy, you carry it over the bay in your coat, and the first anyone at Emberwatch
knows is you standing in the doorway.

**Tavi:** Loud, and my crews will talk to you. Half of them have carried a crate they didn't like the weight of.
Quiet, and they'll wonder why you sat on a stolen pay packet. I'm only telling you how it'll go.

**VOTE — How does Ba Dan's complaint start?**

- **Read it out at the level pole.** The market hears it. Dock workers come forward as witnesses. Emberwatch is
  warned before you arrive. _Sets `inquiry_public`._
- **Seal a copy and carry it quietly.** Nobody at Emberwatch is warned. Some people here will think you kept it
  to yourselves. _Sets `inquiry_quiet`._

Footer: "Both ways cross the bay. The packet stays in the customs office either way."

**If `inquiry_public`:**

**Narrator:** At noon the clerk stands on his stool at the level pole and reads the packet out, front and back.
The boats stop drifting to listen.

**Dock worker:** I loaded one of those. "Safety materials." It clinked.

**Second dock worker:** Mine didn't clink. Mine was light as bread. I thought, safety must be mostly straw.

**Narrator:** By the time the clerk gets down, six people are waiting to give him their names.

> **After CARRY ON:** only the clerk and Tavi sign. _Narrator:_ The handlers have gone with the barge. The clerk
> signs. Tavi signs under him, in letters as square as a hull.

**If `inquiry_quiet`:**

**Narrator:** The clerk folds the copy small and seals it. A fish-seller at the next stall has stopped gutting
to watch.

**Fish-seller:** That's a quarry crew's wages you've got folded up in there. I'd have thought you'd shout.

**Party:** We want to see who's holding the rest of it.

**Fish-seller:** Mm. Well. You'd know.

**Narrator:** She goes back to her fish. She does not offer a second bowl.

### Scene 2.8 — What Jin hears

**Shown:** found (the freight office, after the vote).

**If `inquiry_public`:**
**Freight clerk:** I heard the whole thing from here. I've written it down and it goes over on the evening
boat. Don't look at me like that. Writing things down for her is the job.

**If `inquiry_quiet`:**
**Freight clerk:** Our handlers say a crate split and some strangers were stood round it. That goes over on the
evening boat. I don't know what was in it. I've found I sleep better.

### Scene 2.9 — The ferry

**Shown:** cutscene candidate 1 (also works played). **Where:** Tavi's ferry, at dusk. Shot list:
[cutscenes.md](cutscenes.md), CS-2A (a proposal, pending the trial).

**Narrator:** Parcel will not walk up the ferry ramp. He stands at the bottom of it with both feet planted and
looks at the sea.

**Tavi:** Give him a minute. First time on a boat, they all want to read the ramp.

**Narrator:** Tavi waits. Nobody pulls. After a while Parcel puts one foot on the plank, and then, as if it had
been his idea all along, the rest of himself.

**Tavi:** This crossing's called the Long Blink. Old pilots' name. Halfway over, you blink, and the shore you
left looks like the one you're going to.

**Tavi:** Nine years I've made it with that headland dark. I'm not saying dark was better.

**Narrator:** The rope comes off the post. Water opens between the ferry and the quay.

**Narrator:** Across the bay, on the old outpost, the lamps come on one after another, in a line.

**Driver (Bo-shan):** Pella would count them.

**Narrator:** He counts them.

> **Loss branch.** **Driver (Dorin):** Fourteen. No. Fifteen. I'll count again on the other side, in case some
> of them are for us.

_End of MQ-02. Next: MQ-03 on arrival at Emberwatch._

---

## MQ-03 — Lamps Across the Bay

**Theme card:** MQ-03, Lamps Across the Bay

Themes: responsibility, equality. A place that grows beans on a parade ground and stocks a real clinic is also
holding people who asked to go home. The same lamps light both. The order that allowed it has a careful
signature at the bottom.

- [x] No nation, element or culture stereotype (the outpost's old use is history; the people here are loaders,
      gardeners and mechanics)
- [x] Every valid party, non-benders included, has a real route through (inspection, a loader's key, or a
      ladder)
- [x] No instant forgiveness or absolution
- [x] The other side's reasons are shown (the guard sergeant; the order's own good sense)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

### Scene 3.1 — The parade ground

**Shown:** found (free roam on arrival).

**Narrator:** Emberwatch was built for soldiers. The parade ground is covered in beans, spread out to dry on
old tent canvas. More beans climb a rack that once held spears.

**Retired cook:** Mind the edge. Those are the red ones and they roll. The spear rack's the best trellis I ever
had. Somebody spent real money making sure it wouldn't fall over.

**Narrator:** Someone has painted over the slogans on the barracks wall. Where the paint is thin you can still
read one word of the old one, under the new one: "Sow by the second moon."

**Tavi:** Come and meet the two people who'll actually tell you things. Luli! Edda! I've brought you some
trouble with good manners.

**Found: Luli, at the power yard.**

**Luli:** Mind the line. It's live. That one lights the clinic, the ferry steps and forty kitchens over in
Saltstep.

**Narrator:** She laughs. It sounds like an engine trying to start.

**Luli:** Lightning into a wire, all day, in little careful pieces. Used to be a thing you did to show off. Now
somebody's grandmother can see her stairs. I'm proud of that. I'm also on my ninth day without a day off, so
ask me again tomorrow and I'll say something ruder.

> **If a firebender is in the party (Kaya or Tenzo) —** _Teacher offer, TR-01._
> **Luli:** You've got the hands for it. I'll teach you. Not today, and not as a dare. First lesson is when to
> stop. If you want the lesson where you show how brave you are, find somebody else.

**Found: Edda Coil, at the public workshop.**

**Edda:** Everything on this bench, you can pick up. Everything in that drawer is mine, and the drawer bites.

**Narrator:** There is a spring trap in the drawer, the kind for mice. It has a small paper flag on it that
says "told you".

**Edda:** People bring me machines they're not allowed to open. I open them, with the owner standing right
there, and I show them the inside. That's the whole trade.

> **If Wen is in the party —** _PQ-10 opens here._
> **Narrator:** On Edda's bench, a pressure regulator lies open. Wen stops walking.
>
> **Wen:** That's mine. Not mine. It's what mine turned into. The release lever's gone. There's a keyhole where
> it was.
>
> **Edda:** Company key. I've had three mechanics in here this month who can't service the vanes in their own
> district.
>
> **Edda:** So, before we start. Do you want to prove your invention was good? Or do you want to make this one
> safe? I can only help with one of those.

> **If a non-bender is in the party (Riko or Wen) —** _Teacher offer, TR-05._ **Edda:** There's a loading
> platform out the back with a lovely powered lift and a stop button no one under six foot can reach. Bring a
> spanner on Thursday. We're moving it.

**Found: the clinic supply room.**

**Narrator:** Shelves of clean bandage, fever bark, and soap by the crate. A chalk tally by the door counts what
went to Saltstep's low end this week. The tally is long.

**Supply clerk:** Take a look. It's all real. People think because it comes off a company boat there must be a
trick in it. There isn't a trick in soap.

> **If Nilak is in the party —**
> **Nilak:** Fever bark cut to one length, and kept off the floor. Whoever stocks this has nursed.
>
> **Supply clerk:** Eleven years on a ward. Then my knees went.
>
> **Nilak:** Then I'll stop inspecting your shelves.

### Scene 3.2 — The count is wrong

**Shown:** played.

**Narrator:** At the jetty, loaders are stacking crates under the lamps. A woman with a tally board keeps
counting the same stack and getting a different look on her face.

**Kesi:** You're the ones from the quarry village.

> **If `inquiry_public` —** **Kesi:** We heard about the pay packet before your ferry tied up. Somebody ran in
> shouting it. The sergeant's doubled the door watch since.

> **If `inquiry_quiet` —** **Kesi:** Nobody here's expecting you. That's good. Keep your voice down.

**Kesi:** Forty-one crates came off the evening barge. Thirty-six went on the stores ledger. I've counted it
four nights running. Five don't get written. They go through the door by the old dispatch room, and loaders
who ask about them get moved to "restricted duty".

**Party:** What's restricted duty?

**Kesi:** You sleep in the east barracks and you don't get a ferry token. Eleven of us so far. My brother's
one. He asked why a crate of safety materials needed a chain inside.

**Kesi:** There's three ways to that door and I'll tell you all of them. Then I never met you.

**Approach (decider picks one; all three reach Scene 3.4):**

- **The inspection.** **Kesi:** There's a notice by the gate: any stores handling public goods can be inspected
  for safety by any party with an inspector's tag. Edda has a box of tags. Nobody's used one in a year, because
  nobody reads notices.
  **Edda:** Take two. They're real. I'm a real trainer, and you're really going to look at whether it's safe.
  If anyone asks what you're inspecting, say "the door". It won't be a lie.
  _Sets `emberwatch_route_inspection`._
- **Kesi's key.** **Kesi:** Or I lend you my stores key at shift change and I happen to be looking at the sea.
  If they find it on you, I dropped it. I'd like it to be true, so I'm going to actually drop it. By the bean
  rack. Don't make me look for it.
  _Sets `emberwatch_route_loader`._
- **The rain cistern.** **Kesi:** Or there's the old rain cistern under the parade ground. There's a ladder
  down by the bean rack and a ladder up inside the stores. It's knee deep. A waterbender could walk it dry, but
  anyone can walk it wet.
  _Sets `emberwatch_route_cistern`._

### Scene 3.3 — One word

**Shown:** played, on the way in. On the cistern route it happens inside the cistern; on the other two, at the
cistern grate beside the dispatch-room door.

**Narrator (cistern route):** The cistern is a long stone room full of black water and the sound of drips. The
lamps above show through the grates as thin yellow bars.

**Narrator (other routes):** By the dispatch-room door there is an iron grate in the floor. Under it, black
water, and thin yellow bars of lamplight.

**Kesi:** Careful.

**Narrator:** She has only whispered it. The water under the grate says it again, a breath later, in her
voice: "Careful."

**Kesi:** It does that. Since spring. The old hands say the cistern's always talked. It hasn't. I've been here
since they reopened and it started this year.

> **If Sura is in the party —**
> **Sura:** That's three. The culvert, the harbour, here. It only ever takes one thing.
> _(If the culvert was not seen in Act I: "That's twice. The harbour, and here. It only ever takes one
> thing.")_
>
> **Kesi:** Takes?
>
> **Sura:** I don't have a better word yet. I'm working on it.

### Scene 3.4 — The door

**Shown:** played. Ends in talk or a fight.

**Narrator:** Two guards stand at the dispatch-room door, with a sergeant sitting on a crate between them. She
is mending a boot strap with a sailmaker's needle.

**Sergeant:** Stores are closed. Whatever it is, it'll be the same thing in the morning.

**On the inspection route:**

**Party:** Safety inspection. The notice by the gate says any stores handling public goods.

**Sergeant:** Nobody reads that notice.

**Party:** We read it.

**Narrator:** She looks at the tags for a long time. Then at the door. Then at the boot.

**Sergeant:** I get paid if the head count in the east barracks is the same in the morning as it was at night.
That's the whole of my orders. They don't say anything about doors.

**Sergeant:** Ten minutes. I'm going to check the jetty lamps. They don't need checking.

_The fight is skipped. Grants the fight's XP, as the Act I gate talk does._

**On the key route or the cistern route:**

**Sergeant:** You're not stores. And you didn't come by the gate, because I'd have heard the gate.

**Sergeant:** I'm not going to ask you to leave twice. I get paid on the head count staying the same and the
door staying shut. I've got two boys at home who eat like ostrich horses. Don't make this a long night.

**CHOICE (the decider; not a vote):**

- **"Eleven people in the east barracks asked to go home. Were you told why they can't?"**
  **Sergeant:** I was told "restricted departures". I was told it's temporary.
  **Party:** Since when?
  **Sergeant:** ...Since before the beans went in.
  **Narrator:** She puts the needle through the strap and leaves it there.
  **Sergeant:** Ten minutes. I'm checking the jetty lamps. _The fight is skipped; XP as above._
- **"Stand aside."** _Fight: the dispatch-room door._

**After a win:**

**Sergeant:** All right. All right! Sit down, Pao, it's finished. Go in. Read what you like. I've never read it.
I didn't want to know how long "temporary" was.

**CARRY ON (the fight is lost):**

**Narrator:** They put you out on the jetty, not roughly, and bar the stores door behind you. The sergeant
drops your things in a pile and sets the water skin on top so it won't roll.

**Narrator:** A while later, Kesi sits down beside you with her tally board. There is a sheet of paper under
the tally.

**Kesi:** I had ten minutes with that room once, last month. I copied the top page of the thing on the desk. I
can't read the long words but I can draw them.

**Kesi:** And the second one, you don't need the room for. It's nailed up inside the east barracks, where we
can all see it every morning. Signed and everything.

_Sets `lost_emberwatch`. Scene 3.5 plays from Kesi's copy and the barracks notice. Neri's warning is not seen
here; it surfaces in MQ-05 at the dispatch office instead. The guards now know the party's faces: at MQ-05 the
records start moving sooner (the same effect `inquiry_public` has)._

### Scene 3.5 — The dispatch room (twist one)

**Shown:** played.

**Narrator:** The dispatch room still has its old signal desk, with brass speaking-tubes that go nowhere now.
On it there is a ledger, a rack of stamped orders, and a cold cup of tea.

**Narrator:** The top order is three months old. It is typed, and somebody has corrected the typing in ink,
neatly, in two places.

**The order:** "Supply-control order. Quarries and stations listed below are critical to the Common Current.
Contractors may supervise their output and their dispatch until commissioning. Disputes go to this office.
Signed: V. Sen, Director, Commonworks."

**Narrator:** Stoneback Quarry is fourth on the list.

**Narrator:** Clipped behind it is a second sheet. It is one month newer, and it is not typed. The handwriting
is small and perfectly level.

**The instruction:** "To contractors at listed sites. Workers at critical sites may not leave before their
replacements arrive. No one has forbidden them to leave. We have suspended departures. Wages for suspended
workers are held against security costs. O. Rusk, Marshal, Commonworks Security."

**Narrator:** Somebody has underlined "held" in a different ink, and written beside it: "Held where?" There is
no answer under it.

**Narrator:** Under both, a single page with a water stain. "Pressure readings, canal vanes. These are steadier
than they should be. I would like this looked at before any more load goes on. N. Neri, safety." Nobody has
stamped it.

**Driver (Bo-shan):** "Supervise their output." That's a tidy way to say it. I was output for nearly three
weeks.

**Driver (Bo-shan):** V. Sen. I'd like to meet V. Sen. I've got a delivery book I want explained.

> **Loss branch.** **Driver (Dorin):** One of these says "supervise". The other says nobody leaves. They are
> clipped together. In my watch book that would count as one entry.

> **If Lin Mei is in the party —**
> **Lin Mei:** The first one is careful. Every word in it could be defended in front of a council.
>
> **Lin Mei:** I have written sentences like that. I know what they are for.

> **If Riko is in the party —**
> **Riko:** "Suspended." I've signed escort contracts with that word in. It means locked, said by someone who
> won't be there.

> **After CARRY ON:** the narrator reads Kesi's drawn copy of the first order ("the signature is copied line for
> line, like a picture of a signature: V. Sen, Director") and then the barracks notice, which is Rusk's
> instruction in full.

### Scene 3.6 — VOTE: the east barracks

**Shown:** played.

**Narrator:** The east barracks is not locked. It does not need to be. There is one ferry, and nobody in here
has a token for it. Eleven loaders are sitting on their bunks. Somebody has drawn a calendar on the wall and
stopped filling it in.

**Kesi's brother:** If you've come to tell us it's temporary, we've got a man for that already.

**Tavi:** I can take eleven tonight. No tokens. I'll say the ferry was light and I wanted ballast.

**Tavi:** Or. The lantern keeper and I sit in that dispatch room at dawn with the Compact's seal. Every one of
them walks onto the morning ferry with their name written down and why they were held.

**Tavi:** It's slower. One more night in here. But then it's on paper that it happened, and paper's what a
council reads.

**Kesi's brother:** One more night's nothing. We've done thirty. But ask us, don't tell us.

**VOTE — How do the loaders leave?**

- **Tonight, on Tavi's ferry.** They are home by midnight. Nothing is recorded; the stores will say they
  deserted. The loaders and their families will stand with you. _Sets `loaders_freed`._
- **At dawn, in front of witnesses.** One more night. Each name and reason is written down under the Ferrymen's
  seal, and there is a lawful witness to the holding. _Sets `loaders_witnessed`._

Footer: "They leave either way. Nobody stays in the east barracks after tomorrow."

**If `loaders_freed`:**

**Narrator:** Eleven people walk down to the jetty in the dark, carrying their blankets. Kesi's brother stops
at the bean rack and picks one red bean off the canvas.

**Kesi's brother:** I dried these. I want one.

**If `loaders_witnessed`:**

**Narrator:** At dawn the lantern keeper writes eleven names in a hand like a lighthouse log: who, how long,
what they asked before they were moved. Tavi presses the Compact's seal under each one.

**Lantern keeper:** I've logged every ship past this headland for nine years. This is the first page I've
wanted somebody to read.

### Scene 3.7 — Where Ruon is

**Shown:** played (short). Resolves his custody for Act II and III.

**If `ruon_spared`:**

**Narrator:** In the ledger there is a line for Stoneback: "Gate captain: absent. Believed in village custody.
Recover with papers." Somebody has put a question mark after "recover".

**Narrator:** A letter is waiting for you at the ferry steps, from Ba Dan, in clipped handwriting.

**Hanru's letter:** Ruon is in the guard hut. He mends the east road wall by day. I walk him there and back. He
has not asked for anything but a whetstone, for the wall chisels. I said no. He said that was correct. The
hearing waits until the people he held can sit through it. Two strangers asked for him at the gate. I told
them the gate was closed. It was open. They left. — H.

_Sets Ruon's custody: supervised, Ba Dan._

**If `ruon_traded`:**

**Narrator:** There is a light in the old signal tower. The door at the bottom is new, and it has a freight
company's lock on it. One of Jin's people sits outside, sewing a button.

**Jin's guard:** You can talk through the hatch. She said you might want to. She said to say it isn't a
kindness, it's that she doesn't mind.

**Narrator:** The hatch slides. Ruon is sitting on a camp bed with his boots beside it, side by side.

**Ruon:** You came across the water. I didn't expect that.

**Party:** Are you hurt?

**Ruon:** No. She feeds me. She counts the spoons after. I'd do the same.

**Ruon:** I'm on her freight list as "one passenger, held for client". If you want to do something, get that
line seen by someone with a seal. A man on a list is harder to lose than a man in a tower.

**Narrator:** He does not say anything else. After a moment, he slides the hatch shut himself.

_If `loaders_witnessed`, the lantern keeper adds Ruon's line from the freight list to the witnessed page. Sets
Ruon's custody: Jin's custody, publicly listed. Otherwise: Jin's custody, unlisted. (MQ-11 reads this.)_

### Scene 3.8 — Jin's terms (Jin's beat for Act II)

**Shown:** played. **Where:** the jetty office. Jin runs Emberwatch's freight.

**Narrator:** Jin is at a desk in the jetty office with a manifest book, a lamp, and a small dish of buttons.
She finishes the line she is writing before she looks up.

**Jin:** You've been in the dispatch room. Don't tell me how. I'd have to write it down.

> **If `ruon_traded` —** **Jin:** We've done business. You were prompt. I remember prompt.

> **If `ruon_spared` —** **Jin:** You kept the captain. I haven't forgotten. I haven't finished with it,
> either. It's a different page.

**Jin:** You have an order and an instruction. What you don't have is the count. Which crates, which sites,
which nights, and who signed at each end. Forty sites. I have that. I carried all of it.

**Jin:** I'll sell you a true copy. Here are the terms. They don't move.

**Jin:** One. You sign a statement that every crate my company carried was sealed when we took it and sealed
when we set it down. That is true. You saw the seals yourselves.

**Jin:** Two. The statement says nothing else about me. It doesn't say I'm innocent. I didn't ask for that. I
don't buy things I can't use.

**Jin:** Three. I keep the statement. You keep the manifest. Neither of us shows the other's paper without
telling them first. A day's notice.

**Party:** And if we don't sign?

**Jin:** Then you count forty sites by hand, and it takes you a season. And this manifest is still for sale.
There's another buyer. He writes very small and very level.

**VOTE — Jin's manifest**

- **Sign and take the manifest.** You get the true count for all forty sites now. Jin holds a paper with your
  names on it saying her crates were sealed. She may show it, with a day's notice. _Sets `jin_manifest_bought`._
- **Refuse.** You keep your names off her paper. The count has to be pieced together by hand, with the loaders'
  help. Jin sells the manifest to the Marshal's office, so he will know what you can prove.
  _Sets `jin_manifest_refused`._

Footer: "The order and the instruction are yours either way. Jin will do exactly what she said."

**If `jin_manifest_bought`:**

**Narrator:** She blots the statement, reads it once more, and files it in a tin box with a key. Then she
slides the manifest across. It is as thick as a brick.

**Jin:** It's all there. I don't sell short weight. That's not a virtue. Short weight is how you lose
customers.

**If `jin_manifest_refused`:**

**Jin:** That's a clean answer. I like those. They're cheap to file.

**Narrator:** She closes the manifest book. On the way out you pass a messenger coming in, in a pressed grey
coat, with an empty satchel.

**Kesi:** Forty sites? We can't get you forty. But between us on the jetty we've loaded for twelve. Bring
paper. Bring a lot.

### Scene 3.9 — An invitation

**Shown:** played. **Where:** the jetty, morning.

> Added 2026-11-20 (suggestions pass).
>
> **If `emberwatch_route_loader`, and not `lost_emberwatch` —** _(found, passing the bean rack on the way down
> to the jetty; it comes before the clerk and his card)_
>
> **Narrator:** You put Kesi's key back by the bean rack, where she said she would drop it. A minute later she
> walks past it. Then she walks past it again, slower.
>
> **Kesi:** Oh. Look. My key. On the ground. Where I must have dropped it.
>
> **Retired cook:** It was in my red ones. I nearly put it in the pot.

**Narrator:** A clerk in a clean Commonworks coat is waiting by the cart with a card. He has been waiting a
while; Parcel has eaten the corner of his notebook.

**Clerk:** For the party from Ba Dan. From the Director's office. I'm to say it is not a summons.

**The card:** "You have been asking about a supply order. So have I. Long-Light Evening is in four days at
Causeway. Come and see what the order was for, and then tell me to my face what it did. V. Sen."

**Narrator:** The handwriting is the same as the two corrections on the order. Neat, and in a hurry.

**Driver (Bo-shan):** "To my face." All right. I've got a face. Causeway's a day up the river road, if Parcel
agrees it is.

> **Loss branch.** **Driver (Dorin):** It says it is not a summons. I am going to treat it as one anyway. I
> know what to wear to a summons.

**Luli:** You'll like the lights. I mean that. Go and like them. Then come back and tell me who's getting the
bill.

_End of MQ-03. Next: MQ-04 at Causeway._

---

## MQ-04 — The Day the Lights Stayed On

**Theme card:** MQ-04, The Day the Lights Stayed On

Themes: equality, balance, responsibility. A child works a lift that used to need three strong specialists. The
woman who made that possible goes into the water for one worker and waves off another inside the same hour.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (the rescue needs hands, not an
      element)
- [x] No instant forgiveness or absolution (Veyra owns the order; nobody thanks her for it)
- [x] The other side's reasons are shown (this mission is her reasons)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

### Scene 4.1 — Long-Light Evening

**Shown:** found (three short festival tasks, any order; then the plot interrupts).

**Narrator:** Causeway is built in three layers. Water stairs at the bottom, workshops and crowded houses in
the middle, and tiled terraces on top. Tram wires run over all of it. Tonight every layer has paper streamers,
and the low streets have something they did not have last year: lamps.

**Task one — the bathhouse.**

**Bath attendant:** Towels! I need towels carried down, and I've got one pair of arms. First public bath on
the low landing in my lifetime, and we've run out of dry things in an hour.

**Narrator:** You carry towels down four flights. At the bottom an old man sits in the steam with his eyes
shut.

**Old bather:** Sixty-eight years I've washed in a bucket. Don't talk to me. I'm busy.

> **If Nima is in the party —**
> **Nima:** Four flights, every time? Lend me that rope. And the laundry basket. And ten minutes.
>
> **Narrator:** It takes him longer to rig the basket on the stair rail than it would have taken to carry the
> towels. The second load goes down in one go. The attendant keeps the rope.

**Task two — the lift.**

**Narrator:** A small goods lift runs between the water stairs and the market. It has a handwheel on a post,
low down. A girl of about eight has both hands on it. A supervisor stands close, with her arms folded so they
will not help.

**Supervisor:** Slow. Slower. There. You've got thirty pounds of turnips coming up, and you're doing it.

**Girl:** I know I'm doing it.

**Narrator:** She lets you take a turn. The wheel moves easily. A turnip-seller at the top applauds each
basket.

**Task three — the warm shelf.** _Six-Ladle Kitchen._

**Narrator:** The Six-Ladle Kitchen opens onto a landing. Along its outside wall there is a shelf of covered
dishes over a steam pipe.

**Dema:** That's the late shelf. Tram crews, lamp crews, bath crews. They come off at midnight and it's still
hot. First year we've had the steam to do it.

**Dema:** Take that tray out for me? My runner's gone to watch the Director's speech. So has everyone's
runner.

> **If Tenzo is in the party —** _PQ-02 opens here._
> **Tenzo:** Who cooks for the late shelf?
>
> **Dema:** We do. After our own shift.
>
> **Tenzo:** Paid?
>
> **Narrator:** Dema wipes his hands on his apron for longer than they need.
>
> **Dema:** Come back when the lamps are out and ask me again. Bring an appetite and no ideas.

**Found: Oru, on a small stage.**

**Oru:** "The ferry leaves at noon." No. "The FERRY leaves at noon." No. "The ferry... leaves." Which one
sounded like a man who has a ferry?

> **If an airbender is in the party (Nima or Jinu) —** _Teacher offer, TR-04._ **Oru:** I tune the weather
> bells, when I'm not doing this. Come by the coast mast. I'll show you how to put a sound exactly where you
> want it, and nowhere else. The second part is the hard part.

**Found: an immaculate officer and a cat.** _First sight of Rusk. He is not named unless asked._

**Narrator:** By the dispatch office, a man in a pressed grey coat is crouching beside a crate. A thin stray
cat is eating fish from his fingers. There is no mud on him anywhere, not even his knees.

**Party:** Is that your cat?

**Officer:** No one's. She comes when the yard is quiet. I've asked them to keep it quiet at this hour.

**Narrator:** He wipes his fingers on a folded handkerchief and stands.

**Officer:** Marshal Rusk. You'll be the visitors from the quarry village. Enjoy the evening. I do hope nobody
has told you that you can't go where you like. You can. We'd only ask to know.

### Scene 4.2 — The Director

**Shown:** played. **Where:** the demonstration canal. Twist: the face.

**Narrator:** A crowd has gathered along the demonstration canal. There is a new sluice gate, painted blue, and
a platform with a brass lever. A band stops playing in the middle of a bar.

**Announcer:** Residents of Causeway! The Director of Commonworks!

**Narrator:** A woman climbs onto the platform in a dark blue work coat. Her cuffs have been mended more than
once.

**Driver (Bo-shan):** That's the pump woman.

**Driver (Bo-shan):** I told the Director of Commonworks she had her rope on backwards.

> **Loss branch.** **Driver (Dorin):** That is the woman from the pontoon. I said good morning to her. I gave
> her my rank. She gave me a corner of a crate.

**Narrator:** She finds you in the crowd. She does not pretend otherwise. She nods, once, the way she nodded on
the pontoon when she asked you to take the heavier corner.

**Veyra:** I'll be short. You've got food going cold. Seven years ago, when the Blackreed came up, this landing
waited nine hours for a boat. The boat existed. The people who could work it existed. The permission existed.
They were in three different places.

**Veyra:** This gate is so that never has to line up again. One lever. Anyone trained can pull it. Tonight,
that's Tolo.

**Narrator:** She steps back. A young gate worker in a new cap steps up to the lever, grinning so hard his ears
move.

> **If Wen is in the party —**
> **Wen:** She said napkins are where it starts.
>
> **Narrator:** Wen has not blinked since the announcer spoke.

### Scene 4.3 — The gate jams

**Shown:** played, into a rescue encounter. **Encounter:** the demonstration canal (no enemies; the hazards are
the water, a jammed gate and a slipping counterweight; any party can clear it with hands and tools).

**Narrator:** The lever comes down. The blue gate lifts a hand's width, shudders, and stops. Water starts
forcing through the gap in a flat, hard sheet.

**Narrator:** The young worker runs down the gate steps to free it. The walkway under him folds. He goes in to
the waist, and the gate's counterweight chain drops across his legs.

**Gate crew:** Tolo! Tolo's under the chain!

**Narrator:** Veyra is already off the platform. She goes into the canal in her coat, sleeves shoved to the
elbow, and gets her shoulder under the chain.

**Veyra:** I've got the weight. I can't lift it and free him both. I need the gate off this chain, and I need
those people back from the edge. Now, please.

**Objectives (any two clear the encounter; all three give the best result):** wedge the gate; unhook the
counterweight; move the crowd back from the canal edge.

**Encounter barks:**

- **Veyra:** "Don't pull him. Take the load off first, then pull."
- **Veyra:** "Tolo. Look at me. Tell me what you had for breakfast. All of it."
- **Tolo:** "Rice. Egg. My mum's pickle. Two eggs. I said one, it was two."
- **A gate fitter (Bera), from the bank:** "The seal! It's the lower seal, it's swelled, I told them!"

> **If Kaya is in the party —** (on entering the water)
> **Kaya:** I've got the chain! I've got it! ...Which way does it unhook?
>
> **Gate crew:** Toward you!
>
> **Kaya:** Toward me. That's what I thought.

> **If Bo is in the party —**
> **Bo:** Crowd first. Twenty back from the edge, then twenty more. You, in the red, you're counting for me.

**Narrator (in the hush before the chain comes free):** For a moment the only sound is water. Then, somewhere
up on the terraces, a child laughs at something else entirely.

**Narrator:** The canal gives the laugh back, from down in the lock, a beat late.

**After a win:**

**Narrator:** The chain comes off. Tolo comes up out of the water between Veyra and the gate crew, coughing,
with both legs working.

**Tolo:** I said one egg. Why did I say one egg.

**Veyra:** Because you were frightened, and you still got to two. Sit down. Somebody get this man a towel.
There's a bathhouse full of them.

**CARRY ON (the encounter is lost):**

**Narrator:** The water takes your footing and puts you against the lock wall. Hands haul you out by the
collar. By the time you can see again, the gate crew have wedged the gate with a tram sleeper, and Veyra is
walking Tolo up the steps with his arm over her shoulder.

**Narrator:** She looks over at you, soaked, sitting on the bank.

**Veyra:** You went in. I saw that. Stay sitting.

_Sets `lost_canal_rescue`. The festival carries on; a section of the low landing stays roped off, and at MQ-10
the lower-landing residents remember that the gate failed on its first night. Nothing else is lost._

### Scene 4.4 — The other worker

**Shown:** played. Do not cut away between the rescue and this.

**Narrator:** The band starts again. People begin to clap, for Tolo, for the Director, for the towel.

**Narrator:** A gate fitter pushes through to the foot of the steps. She has grease to the elbows and a log
book open at a page.

**Bera:** Director. The lower seal. It was weeping yesterday. I logged it. I logged it the day before. It
swells when the canal pressure sits too steady, and the pressure's been sitting like a stone all week.

**Veyra:** Bera. He's alive. It held.

**Bera:** It didn't hold. You held it. That isn't the same thing, and there's six more of those seals between
here and the Works.

**Narrator:** Veyra is wringing out her sleeve. She does not stop.

**Veyra:** Log it again tomorrow. I'll read it tomorrow. Tonight these people get to have one evening where
the thing we built them works.

**Bera:** It's in the book.

**Veyra:** I know it's in the book.

**Narrator:** Bera stands there a moment longer. Then she closes the log and goes back down to the gate.

**Narrator:** Veyra looks up, and finds that you are four steps away, and have been the whole time.

### Scene 4.5 — DLG-04, Veyra at the handwheel

**Shown:** cutscene candidate 2 (also works played). **Where:** the goods lift from Scene 4.1. Shot list:
[cutscenes.md](cutscenes.md), CS-2B (a proposal, pending the trial).

The exchange from here to "Her answer is not immediate" is **bible DLG-04, word for word**. `Player` in the
bible is `Party` here. The party knows her supply order; it does not know of any refused shutdown.

**Narrator:** Veyra tests a handwheel. A child turns it from the other side with a supervisor standing close.
The little lift rises.

**Veyra:** Before this, there were three people in the district who could move that load. Everyone planned
their day around those three people.

**Party:** And now?

**Veyra:** Now the people with the load can choose when to move it.

> **If Riko is in the party —** **Riko:** Who gets the key?
>
> **Otherwise —** **Party:** Who controls access?

**Veyra:** The public workshop. A duplicate at the clinic. It is a good question. Keep asking it.

**Party:** We asked it at Ba Dan.

**Narrator:** She removes a wet work glove slowly.

**Veyra:** I signed the supply order. I did not authorize people to be held in a quarry.

**Party:** Your contractor did.

**Veyra:** Then I have more work to do than replacing a contractor.

**CHOICE (the decider; DLG-04's three):**

- **"Let the workers leave, and let us see the records."** Veyra agrees to issue a release instruction and
  inspection access. _Sets `veyra_release_promised`. Later scenes check whether it was obeyed: on the loss
  branch the quarry garrison ignores it until MQ-11, and Rusk's office "has not received it"._
- **"Show us what this project is supposed to do."** She gives the invitation without treating curiosity as
  agreement.
- **"We will inspect it independently."** She asks for accurate findings, offers access, and visibly dislikes
  giving up control.

**Veyra:** My mother once waited on a roof while three offices argued over whose boat it was.

**Narrator:** A pause. No joke follows.

**Veyra:** I wanted a world where the boat belonged to the rescue.

**Party:** Then help us make sure someone can launch it without asking you.

**Narrator:** Her answer is not immediate.

_End of DLG-04. Let the party walk the festival before the next conversation (a short free roam: the three
task-givers each have one new line, below)._

- **Old bather:** Somebody nearly drowned? I didn't hear. I was busy.
- **Girl at the lift:** I'd have got him out with the lift. If he'd been turnips.
- **Dema:** She went in after him herself. I'll give her that. I'll give her that, and I'll still want the
  late shelf paid.

> Added 2026-11-20 (suggestions pass).
>
> _A fourth person to find in the same free roam, for any party. He stands alone: nobody has to have done a
> festival task._
>
> **Narrator:** Tolo is sitting on the bathhouse steps in three towels. Only his cap and his ears show.
>
> **Tolo:** You're the ones who got the chain off me. Thank you. I've been practising saying it. It came out
> shorter than I practised.
>
> **Tolo:** My mum's on her way down. If she asks, it was one egg. She counts them.
>
> _(After `lost_canal_rescue`, his first line is instead: "You're the ones who went in after me. I saw you go
> past. You were going quite fast. Thank you." The egg line is the same.)_

### Scene 4.6 — VOTE: the commission

**Shown:** played. **Where:** the terrace above the canal, later that evening.

**Narrator:** Veyra has found a dry coat. It is the same blue. She has a folder, and two cups, and the mended
teapot. A carved wooden rule sticks out of her breast pocket. One end of it is worn pale.

> **Optional, any party** _(a `Party:` line the table may tap before she speaks; she saw the packet in 2.6
> on every route)_ **—**
> **Party:** You saw the pay packet at Saltstep.
>
> **Veyra:** I did. I had it logged. I asked my office who packed the crate.
>
> **Party:** And?
>
> **Veyra:** I was told it was being looked into. I accepted that. I'm telling you I accepted it, so you don't
> have to find it out.

**Veyra:** People saw a gate jam tonight. Next week they'll hear about a quarry. If I tell them it's in hand,
that's the Director saying the Director is fine.

**Veyra:** I want you to inspect the network. Three regions, any door, any ledger. A regional inspection
commission, with my signature under it. When you've seen the whole plan you'll understand why I couldn't let
one quarry stop it. I believe that. I'd like to be checked.

**Party:** And if what we find doesn't help you?

**Veyra:** Then I'd rather hear it from people who carried my pump than from people who want my job.

**VOTE — The commission**

- **Accept it, publicly, tonight.** Every Commonworks door opens to the badge. Residents and crews will see you
  as the Director's inspectors until you show them otherwise. _Sets `mandate_official`._
- **Accept it with terms in writing.** The table names them: you publish what you find without asking her; no
  one edits it; you can show it to residents first. She has to sign that. The doors open, and the terms are
  pinned up beside the badge. _Sets `mandate_independent`._
- **Decline the badge. Inspect with residents.** No Commonworks door opens to you. Residents, ferry crews and
  rail crews will show you their own doors. It is slower, and nobody can say she sent you.
  _Sets `mandate_residents`._

Footer: "All three reach the three valleys."

**If `mandate_official`:**

**Veyra:** Thank you. I won't pretend that isn't what I hoped.

**Narrator:** She signs. The pen is a workman's pencil in a brass holder.

**If `mandate_independent`:**

**Narrator:** She reads the terms twice. At "without asking her" her pencil stops.

**Veyra:** I don't like the third line.

**Party:** It stays.

**Veyra:** ...It should. I don't have to like it. I've signed worse things this year. You've read one of
them.

**If `mandate_residents`:**

**Veyra:** You'd rather knock than be let in.

**Narrator:** She closes the folder. She is not angry. She looks like someone re-measuring a wall.

**Veyra:** The offer doesn't expire. The doors might be heavier. I won't make them heavier on purpose. I
can't promise that for everyone who works for me, and you know which one I mean.

### Scene 4.7 — The first reliable light

**Shown:** played (quiet close; no choices).

**Narrator:** Late. The streamers are coming down. On the low landing, under the last lamp before the water
stairs, an old woman has carried a chair out of her house.

**Narrator:** She has a book. She holds it at arm's length, then closer, until the lamp is on the page.

**Hua:** Don't mind me. Seventy-three years my eyes have gone to bed when the sun did. I'm on page four.

**Hua:** It's not a very good book. I'm going to read every word of it.

**Narrator:** Behind her, in the lock, the water is moving the way water should. Mostly.

_End of MQ-04. Next: MQ-05 at the dispatch office in the morning._

---

## MQ-05 — Three Routes, One Promise

**Theme card:** MQ-05, Three Routes, One Promise

Themes: equality, belonging. A map of "everyone" is laid over a timetable, and three places fall through the
gap. A woman who cannot get her chair onto the cart says so. At the meal, a letter comes from a child who was
left at home.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution (Pella's letter)
- [x] The other side's reasons are shown (the dispatch clerk's forty wagons)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

### Scene 5.1 — The demonstration map

**Shown:** played. **Where:** Causeway dispatch office.

**Narrator:** The dispatch office has a wall-sized map of the Common Current, painted for Long-Light Evening.
Blue for water, red for power, black for rail. It is very handsome. Every line reaches a dot, and every dot
has a name.

**Narrator:** A woman in a wheeled chair is parked in front of it. She is not admiring it.

**Yenna:** Twenty-two years I worked the signal lamp at Pear Halt. Black line, north-west, between the viaduct
and the yard. Find it for me.

**Narrator:** You look. The black line runs from the viaduct to the yard without stopping.

**Yenna:** Thank you. I thought it was my eyes. My mother still lives there. She's eighty. As of last month
the train goes past her at speed and whistles.

**Dispatch clerk:** It's on the schedule as an unscheduled stop. That's a real category. I didn't invent it. I
have forty wagons and one line and the Works wants its stone by the tide.

> **If `mandate_official` or `mandate_independent` —** **Dispatch clerk:** That's the Director's badge. Then
> you can see the working timetables. They're in the back. They were in the back. Hold on.

> **If `mandate_residents` —** **Yenna:** They won't show you the working timetables. They don't have to. I
> know where the old ones are kept, because I wrote half of them.

**Narrator:** In the back room, two shelves are empty. There are clean rectangles in the dust. Through the
window, porters in grey are wheeling a hand-truck of ledgers across the tram yard.

**Dispatch clerk:** "Moved to the Works for safekeeping." I've just been handed the slip. Marshal's office.

> **If `inquiry_public`, `lost_emberwatch` or `jin_manifest_refused` —** _Narrator:_ The dust on the shelves has
> already settled. They started moving these yesterday. The last truck is nearly at the yard gate.
> _(The chase below starts one stage later: fewer turns to reach the truck.)_

### Scene 5.2 — The tram yard

**Shown:** played, into a chase fight. **Fight:** the tram yards (reach the hand-truck before it reaches the
Works gate; the porters are Rusk's records detail, with two security men).

**Yenna:** Go through the sheds, not round. Third shed has no back wall. I'm not telling you how I know.

**Head porter:** These are company records under a Marshal's slip. Step back, please. Nobody is saying you
can't read them. They're being moved.

**Fight barks:**

- **Head porter:** "Mind the ledgers! If one goes under a tram I have to explain it in writing!"
- **Security man:** "Slip says the Works. It doesn't say anything about you lot."
- **Yenna (from the shed door):** "Left! The points are set left! The truck can't take the right-hand rail!"

**After a win:**

**Head porter:** All right. All right. I'm setting it down. I move paper. I've got a bad knee and a slip. You
want the paper more than I want the knee.

**CARRY ON (the fight is lost):**

**Narrator:** The truck goes through the Works gate and the gate closes. The head porter looks back once,
rubbing his knee.

**Narrator:** In the dispatch office, the clerk is standing in front of the big slate where the day's trains
are chalked.

**Dispatch clerk:** They took the ledgers. Nobody said anything about the slate. I copy it from the ledgers
every morning. I've done it eleven years. Ask me a stop.

**Yenna:** And what he hasn't got in his head, I've got in mine. Fetch paper.

_Sets `lost_tram_yard`. The three inconsistencies are rebuilt from the slate, Yenna's memory and a note left at
the public dispatch desk; Scene 5.3 plays the same. The working ledgers are now inside the Works, so in MQ-09
there is one fewer place to find duplicates._

### Scene 5.3 — Three places

**Shown:** played.

**Narrator:** You lay the working timetable over the painted map. Yenna reads the stops aloud. The clerk puts a
pin in the map for each one.

**Yenna:** Viaduct. Pear Halt. Braking yard.

**Narrator:** The clerk holds the second pin over the map. There is nowhere to put it.

**Narrator:** By noon there are three pins lying on the table instead of standing in the wall.

**Dispatch clerk:** One. Pear Halt. Rail. On the old timetable, off the new one. About ninety people and an
orchard.

**Dispatch clerk:** Two. A water route through Reedglass. The ferry log calls it the Slow Channel. The
Commonworks survey has it as "no traffic, no dwellings". The ferry log has a school on it.

**Dispatch clerk:** Three. A weather bell on Bellweather. The Works log says "station reports calm". The
carters coming down say they were nearly blown off the switchbacks, twice, on days it reported calm.

**Driver (Bo-shan):** Hold on. Say those again. Slower.

**Narrator:** He has the delivery book open at the back, at the pages that are not in his handwriting.

**Driver (Bo-shan):** "Sealed crates, stop fourteen." "Sealed crates, route nine." "Sealed crates, bell three."
No names. I thought they were codes.

**Yenna:** Pear Halt was stop fourteen. It's painted on my lamp.

**Driver (Bo-shan):** Then my cart's been there. Somebody drove my cart to three places that aren't on the
wall.

**Driver (Bo-shan):** I want to go and see where I've been.

> **Loss branch.** Bo-shan's delivery book is still in the Driller's cab. Replace the Driver lines above:
>
> **Driver (Dorin):** Say those again, please. Slowly.
>
> **Narrator:** He has Gao's receipt out, the one the stone carter left on the counter.
>
> **Driver (Dorin):** "Sent on: stop fourteen, route nine, bell three." I have carried this all the way from Ba Dan
> and read it as arithmetic.
>
> **Yenna:** Pear Halt was stop fourteen. It's painted on my lamp.
>
> **Driver (Dorin):** Then crates that went through that quarry went on to three places that are not on this
> wall. Bo-shan's cart was at the quarry when they did. I would like to see where.
>
> **Driver (Dorin):** I am going to write it in the watch book, with the date, so he can read where his cart was
> sent without him.

> **If Lin Mei is in the party —**
> **Narrator:** Lin Mei has turned the painted map's corner over. On the back, in pencil, is the survey it was
> drawn from.
>
> **Lin Mei:** "Reedglass corridor. No permanent dwellings." That is my phrase. That is my hand.
>
> **Lin Mei:** I meant the houses move with the water. I wrote it the way the form asked.

> **After CARRY ON:** the clerk chalks the three places on the slate instead of pinning them. Nothing else
> changes.

**Yenna:** If you're going up to the Halt, I'd come. My mother's got opinions about all of this. But I'll say
it now so it isn't awkward later. I've seen your cart.

**Narrator:** She looks at the tailgate, and then at her chair, and then at Bo-shan.

**Driver (Bo-shan):** I could lift you. I lift everything.

**Yenna:** I am not a sack of cabbages. I'm told you're not good with those either.

**Driver (Bo-shan):** ...I'll write to someone.

> **Loss branch.** **Driver (Dorin):** The tailgate is two feet and one inch from the ground. I measured it
> just now. I'll write to Gao.

### Scene 5.4 — VOTE: who sees the findings first

**Shown:** played.

**Narrator:** Three places. One page of notes. By evening, three different people have asked for a copy.

**Edda:** Send it to the engineers first. Half of them don't know what's been left off. They'll open panels
for you that I can't.

**Yenna:** Send it to the people it's about. They'll tell you what else is missing. They've been keeping
lists for years. Nobody's asked to see them.

**Hesh:** Send it to the rail crews. We keep maintenance books back to my grandfather. We know what that line
carried before anyone painted it.

**Narrator:** Hesh is a broad old man with oil in the creases of his hands. His eyebrows do most of his
talking. They are currently saying that he does not expect to be picked.

**VOTE — Who reads the preliminary findings first?**

- **Commonworks engineers.** Technical access in the three valleys: panels, logs, gauges.
  _Sets `findings_engineers`._
- **The residents of the three places.** They add what the timetable never had: paths, names, seasons.
  _Sets `findings_residents`._
- **The rail and maintenance crews.** They add history: what each line and station used to do.
  _Sets `findings_guild`._

Footer: "The other two still get a copy. This is who you go to first."

### Scene 5.5 — Five teachers

**Shown:** found. All five are in Causeway or on its roads this week, before any level-five choice. Each is one
short invitation. The teacher stories themselves (TR-01 to TR-05) are separate scripts. Aru's table is here,
in Causeway, for MQ-05 (owner, 2026-11-15; a decided amendment to the bible, which keeps the outreach room
itself at Saltstep).

- **Luli** (fire; if not already offered at Emberwatch): **Luli:** I'm up from the bay for the lamp
  inspections. Offer stands. First lesson is stopping.
- **Aru** (water), at a folding table marked "Northern healing house, outreach":
  **Aru:** We see anyone who comes to the table. I'm supposed to add "with residency papers". I've stopped
  adding it out loud. If you want to learn, the first thing I teach is asking before you touch.

  > **If Nilak is in the party —** _PQ-03 opens here._
  > **Narrator:** Above the table hangs the healing-house emblem. Under it, a painted board: "Open treatment
  > for all."
  >
  > **Nilak:** Aru.
  >
  > **Aru:** You've seen the sign. Go on. Say it.
  >
  > **Nilak:** It says "all".
  >
  > **Aru:** You left because you could not accept it. I stayed because my father could not leave with me.
  > Please stop making those the same decision.

- **Hesh** (earth): **Hesh:** There's a bent hinge on the public lift by the annex. You could force it. Most
  would. Come and look at it with me first. Bring whoever uses the lift.
- **Oru** (air; if not already offered at the festival): **Oru:** Coast mast, any morning. Bring your lungs and
  leave your opinions about my whistling.
- **Edda** (non-benders; if not already offered at Emberwatch): **Edda:** The stop button's still out of reach.
  It's been waiting for you.

### Scene 5.6 — The meal, and VOTE: which road first

**Shown:** played. **Where:** the cart, drawn up by the river road outside Causeway. This and Scene 5.7 are one
evening and the act's quiet close: a meal and a view, the road chosen while the food is hot, and then a letter
(owner, 2026-11-19: the vote comes before the courier, and the act ends on the letter).

**Narrator:** Evening. The cart is pulled off the river road where you can see all three valleys at once:
rust-red hills to the left, a silver flatness of marsh to the right, and straight ahead, the heights, with
their heads in cloud.

**Narrator:** There is rice, and river cakes from the Six-Ladle, and the late shelf's leftover greens. Parcel
has his own heap and is guarding it from nobody.

> **If Tenzo is in the party —**
> **Narrator:** Tenzo has made a second sauce in case the first sauce is wrong. Nothing was wrong with the
> first sauce.
>
> **Tenzo:** Try both. Tell me which. Don't be kind.

**Narrator:** Three pins from the dispatch office are lying on the tailgate, between the rice and the river
cakes.

**Driver (Bo-shan):** Three stops left in the book. I'll take them in any order. You're the ones who've been
right about things. Mostly. Pick.

> **Loss branch.** **Driver (Dorin):** Three places. My permit says "the coast road and wherever it leads". I
> wrote it loosely on purpose. Choose.

**VOTE — Where does the cart go first?**

- **West, to Copper Orchard and Pear Halt** (MQ-06).
- **East, to Reedglass and the Slow Channel** (MQ-07).
- **North, to Bellweather and the weather bell** (MQ-08).

_Sets `first_spoke` (`orchard`, `marsh` or `heights`). All three are played in the end; this is only the order.
Nothing in Scene 5.7 reads it. Act III's first camp (C.1) does._

**Narrator:** You push a pin into the tailgate. Parcel lifts his head from his heap and looks down the road you
chose for some time before he agrees to it.

> **If the first spoke is Copper Orchard —** _Narrator:_ He agrees to this one very quickly. He seems to know
> where it goes.

### Scene 5.7 — A letter

**Shown:** played. **Where:** the same meal, a little later. Ends the act.

**Narrator:** A courier comes up the road at a trot, with a long bundle on one shoulder and a letter held out
in front like something hot.

**Courier:** Cart from Ba Dan? I've carried this from the coast. The girl who gave it to me made me say the
address back to her three times. Then she followed me to the gate saying it.

> **If Jinu is in the party —** replace the courier:
> **Jinu:** This one's been in my bag since Saltstep. She made me promise to hand it over at a meal, when he's
> sitting down, "so he can't walk off". I've carried royal seals with fewer instructions.

**Narrator:** The letter is addressed in thick pencil: "BO-SHAN. THE CART. WHEREVER IT IS."

**Driver (Bo-shan):** That's her writing. She presses so hard it comes through the other side.

**Narrator:** He opens it. He reads it out loud, because it is the kind of letter that has to be.

**Pella's letter (first):**

> Bo-shan. This is a list. It is not a letter.
>
> 1. You left your good socks. I am wearing them.
> 2. Aunt Nala says write. I said you don't have to if your hand is broken. Is your hand broken?
> 3. I am keeping the book on Grumbler. He owes forty-one days. Mira says I can, because my sums are best.
>    He made your cart a roof. I took two days off. He says it should be three. It is two.
> 4. Dorin says hello. He said it twice, in case the first one got lost.
> 5. I was at the shutter. You looked. I saw you look. You still went.
> 6. Does the cart come home when it's empty, or when you feel like it?
>
> Pella.
>
> To the ones in the back: he puts tall things on top of small things. Watch him.

**Narrator:** Bo-shan folds the letter along its old folds. Then he unfolds it and reads number five again, to
himself.

**Narrator:** Then he reads number six out loud once more, slowly.

**Driver (Bo-shan):** "Does the cart come home when it's empty."

**Narrator:** Down the bank, the river says it after him, very faintly: "...come home."

**Narrator:** Nobody at the meal moves. A river cake cools on its leaf.

**Driver (Bo-shan):** It's got three more stops in the book. Then it's empty.

**Driver (Bo-shan):** I'll write that. I'll write it tonight. Somebody lend me a pencil that isn't a stub.

> **If Sura is in the party —**
> **Sura:** It took the middle of the sentence that time. Not the end.
>
> **Narrator:** She is looking at the river. She has stopped eating.

**Narrator:** The long bundle is four poles, a roll of oiled cloth, and a bag of bolts. A note is tied to it
with wire, in cramped block letters.

**Grumbler's note:** Canopy. Four poles, one cloth, twelve bolts. I was given nine bolts. I made three. The
cloth is not square because the cloth I was given was not square. Do not stand on the rail to fit it. The rail
is not rated for standing. G.

**Narrator:** Underneath, in thick pencil: "He complained the whole time. Two days. P."

**Narrator:** You fit the canopy before the light goes. It is not square. It keeps the dew off.

> **Loss branch (Dorin drives).** Replace the letter, the echo and the canopy:
>
> **Narrator:** The letter is addressed in thick pencil: "DORIN. AND THE ONES IN THE BACK."
>
> **Pella's letter (first, loss branch):**
>
> > Dorin. This is a list.
> >
> > 1. Hanru is doing your gate. They don't salute. The gate is fine anyway. Sorry.
> > 2. The stone carts stop at Gao's trough every morning. I ask every carter. They are not allowed to say.
> >    One of them shook his head at me. I am counting that as "still alive". I know it is only a head.
> > 3. Aunt Nala says thank the ones in the back. I said I would when there was something to thank them for.
> >    She says that's rude. I've put it in anyway.
> > 4. Gao gave you his awning. He stands in the sun now and says he likes it.
> > 5. You said you would find out. That's not the same as Tuesday. I wrote it down next to Tuesday.
> > 6. When you find him, does he come home, or does he have to stay and finish something?
> >
> > Pella.
>
> **Driver (Dorin):** "Does he come home."
>
> **Narrator:** Down the bank, the river says it after him, very faintly: "...come home."
>
> **Driver (Dorin):** I do not have an answer to number six. I am going to write and say that I do not. She
> would rather have that than a guess.
>
> **Gao's note (with the canopy):** This was my awning. I want it back, with the cart, and the boy, and you. In
> that order if you have to choose. Don't let Dorin fit it alone. He'll measure it till dark.

_End of Act II._

---

## Optional side fights

Optional, XP-paying fights in every region (owner, 2026-11-15), so a table can level toward the discipline
path it wants. None is needed for the main line, none hides a main clue, and every one pays its XP on a win
and on "Carry on" alike. The people in them have reasons. Nobody is hurt past a bruise.

### SF-2.1 — Wet ground (Emberwatch power yard; in the trial slice)

**Who:** four laid-off line riggers, led by a woman called Sabi. **Where:** the power yard, at night, after
rain. The rain cistern has overflowed across the yard, and Luli's live line runs along one side of it.
**Why:** their quota pay stopped when the line was finished. A dead spur of copper cable still hangs at the
back of the yard, and copper sells. They are cutting it down. **The fight:** standing water carries a spark.
Anyone on wet ground beside the live line, on either side, takes the shock. (The combo is hinted here first:
"something in this yard reacts to water".)

**Luli:** Off the wet! All of you! That line is live, and I am not explaining a puddle to four families!

**Sabi:** We strung that spur. Nine weeks. Then they said the job was done and so were we. It's not stealing
if nobody paid for the hanging of it.

**Driver (Bo-shan):** Lightning goes straight across a puddle. I told Pella. I saw it happen to a whole crew.
She said ask someone else.

**Narrator (the first time a puddle sparks):** The spark goes across the standing water flat and blue, from
the line to the far wall. Every hair on Parcel's neck stands up.

**Driver (Bo-shan):** THERE. Somebody write that down. Somebody write "Bo-shan was right" and the date.

> **Loss branch.** **Driver (Dorin):** Pella told me Bo-shan says lightning can cross a puddle. She told me to
> ask someone else. Luli, I am asking. ...I see. I will write to her that he was right. She will not enjoy it.

**Win:** the riggers put down their cutters. **Luli:** I'm owed nine days off and nobody to cover them. Two of
you can splice. Come back at six. It's day wages. It's something. **Carry on:** they get away over the wall
with one coil. Luli has to drop forty kitchens for an evening to make the spur safe. **Luli:** I'd have given
them the scrap. They only had to ask in daylight.

### SF-2.2 — The tipping platform (Saltstep; sparring)

**Who:** Tavi's ferry apprentices and a crew of channel hands. **Where:** a spare market platform, moored
loose, at the midday lull. **Why:** nobody is angry. Losers wash the bowl-seller's bowls. The platform tips
toward whichever side has more people on it, and going in the water counts as out.

**Ferry apprentice:** You're the ones off the cabbage cart. We settle the midday on the loose platform, us and the
channel hands. Today we thought we'd be on the same side for once, and you'd be the other one.

**Ferry apprentice:** Losers wash the bowl-seller's bowls. There are sixty. Are you in?

**Tavi:** No bending the platform. Bend whatever else you like. If you fall in, swim to the left. The right's
where the fish-seller empties her bucket.

**Win:** **Channel hand:** Fair. We wash. You can dry, since you're so quick. **Carry on:** **Bowl-seller:**
Sixty bowls. Sand's in the tub. Don't stack them wet.

**Bout intro:** The midday lull. The spare platform rides loose on its moorings, and it leans toward whoever stands on
it. Half the market has found a reason to be near the rail.

**Tip:** A shove toward the water leaves a fighter teetering on the edge. Shove them again after their turn and they
are in, and out of the bout. If you are the one teetering, step back from the edge. Blue squares show where the deck
will tip when the round ends.

**Ferry apprentice** (enemy card): Poles a ferry all day and has the shoulders for it. Quick on a wet deck. Laughs when
it goes in. **Channel hand** (enemy card): Hauls barges through the channel for a living. Slow to move and very hard
to shift.

**The board:** The Loose Platform. The stall that stood there was a net-mender's, who moved ashore when the platform's
moorings went slack; nobody has claimed it since, which is why it is spare. Nobody says this in the bout.

### SF-2.3 — The bridge toll (the river road to Causeway)

**Who:** six guards from another quarry on the supply-control list, with a corporal. **Where:** a plank bridge
on the river road. **Why:** unpaid for two months, like Ruon's were. They have put a pole across the bridge and
are asking a "toll" in food.

**Corporal:** One sack off every cart. I'm not proud of it. I've got six who haven't eaten hot since the last
moon, and I'm the one they look at.

> Added 2026-11-21 (the writing pass; DRAFT for the owner). The build's choice had no words. These are in the
> game (`sf23.ts`, `riverRoad.ts`, the encounter's intro); the facts behind them, and the road's found scenes, are
> in [../rg02-places.md](../rg02-places.md).
>
> **Corporal:** That's the toll. A sack by the fire and the pole goes up. Don't make me think of something worse.
> I'm no good at it.
>
> - **Party:** These sacks are spoken for. Lift the pole. _A fight. His guards hold the bridge. The stream is
>   shallow at the ford, a little way downstream._
> - **Party:** Not yet. _No fight. The pole stays down and the corporal stays by his fire. You can come back._
>
> **Corporal** (if "Not yet"): Then we'll be here. That's not a threat. I just can't think where else we'd be.
>
> **Fight intro:** A pole lies across the plank bridge. Two guards stand behind it, as straight as guards are
> taught to stand. In the camp at their backs, a pot hangs over a cold fire.
>
> **Narrator** (win, after "the pole comes up"): A carter who has waited on the far bank all morning drives
> across. She slows beside the corporal and tells him where, in Causeway, a shelf of food is kept hot past
> midnight. _(So the corporal's "Where did you say?" has someone to answer on a table's first trip, before it
> has seen Causeway. Cut by deleting this line.)_
>
> **Narrator** (leaving Emberwatch for the road, after Scene 3.9): The cart turns its back on the bay. Ahead, the
> road finds the river and keeps beside it. Causeway is a day upstream. / Parcel walks like an ostrich horse who
> has already picked the place where he is going to stop.

**Win:** the pole comes up. **Corporal:** Where did you say? A kitchen with a late shelf? ...We'll walk it.
We'll keep our hands where the cook can see them. **Carry on:** they take one sack of cabbages and wave the
cart through. **Driver (Bo-shan):** That was the good sack. _(Loss branch:_ **Driver (Dorin):** "I have
entered it as a delivery. It was, in a sense, delivered.")

## Community trust in this act

Community trust replaces nation standing (owner, 2026-11-14; story bible C-25). Each community remembers how
it was treated. Lines read it; it never locks the main plot. These are the flags that feed it here.

| Community                  | Trust rises with                                                | Trust falls with                           |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Saltstep market and docks  | `inquiry_public`; winning 2.5; SF-2.2 played                    | `inquiry_quiet` (a little: "you'd know")   |
| The Emberwatch loaders     | `loaders_freed` (most); `loaders_witnessed`; SF-2.1 won         | `jin_manifest_bought` (a little)           |
| The Ferrymen's Compact     | `loaders_witnessed`; taking Tavi's tow                          | nothing in this act                        |
| Commonworks staff          | `mandate_official`; `mandate_independent`; `findings_engineers` | `mandate_residents` (wary, not hostile)    |
| Causeway's low landing     | `mandate_residents`; `findings_residents`; going into the canal | `mandate_official` (until shown otherwise) |
| Rail and maintenance crews | `findings_guild`                                                | nothing in this act                        |
| Ba Dan                     | carried from Act I (`ruon_spared`, the gate, the side stories)  | carried from Act I (`ruon_traded`)         |

## Jin's beat for this act

Scene 3.8 (the manifest). Scene 2.2 and 2.8 plant her office and her clerk at Saltstep, where she is from.

## The echo for each mission

| Mission | Where                        | What the water repeats                                |
| ------- | ---------------------------- | ----------------------------------------------------- |
| MQ-02   | Under the freight pontoon    | Bo-shan's laugh (loss branch: Dorin's "Good morning") |
| MQ-03   | The rain cistern             | One word, "Careful", in Kesi's voice                  |
| MQ-04   | The demonstration canal lock | A child's laugh from the terraces                     |
| MQ-05   | The river below the camp     | "...come home", from Pella's question, read out loud  |

Nobody explains any of them. Sura, when present, is the only one who keeps count. Her count starts at the
culvert in the Cutting only if the party saw it (`cutting_culvert`); otherwise it starts at the pontoon.

## Pella's letter for this act

Scene 5.7, with a loss-branch version addressed to Dorin.

## Hero moments in this act

| Hero    | Where                                                                           |
| ------- | ------------------------------------------------------------------------------- |
| Kaya    | 2.2 Miri's crates (PQ-01 planted; opens at Saltstep after MQ-03); 4.3 the chain |
| Tenzo   | 2.2 the bowl-seller; 4.1 Dema (PQ-02 opens); 5.6 the second sauce               |
| Nilak   | 3.1 the supply room; 5.5 Aru's table (PQ-03 opens, with the bible's line)       |
| Sura    | 2.4, 3.3, 5.7: she is the one counting the echoes                               |
| Bo      | 4.3 moving the crowd                                                            |
| Lin Mei | 3.5 the careful order; 5.3 her own phrase on the back of the map                |
| Nima    | 4.1 the towel basket; 4.1 Oru's offer                                           |
| Jinu    | 2.1 the courier-office copy (loss branch); 5.7 she carries Pella's letter       |
| Riko    | 2.6 the packet and the stamp; 3.5 "suspended"; 4.5 "Who gets the key?" (DLG-04) |
| Wen     | 2.4 the pump; 3.1 her regulator (PQ-10 opens); 4.2 "napkins"                    |

## Build list for MQ-02 and MQ-03 (the trial slice)

What a build session needs. Nothing here is made yet.

**Locations**

| Location                 | Used by             | Kind                                                                                              |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| The coast road           | 2.1                 | An interlude over a held view; no map                                                             |
| Saltstep market          | 2.2, 2.7, 2.8       | Explore map: platforms, level poles, bowl stall, ferry landing, Jin's office front, Miri's crates |
| The customs stall        | 2.3                 | Played on the market map, or an interlude if a drifting stall is not built                        |
| The freight pontoon      | 2.4, 2.5, 2.6       | Explore and fight map: pump crate, winch, crane sling, barge                                      |
| The ferry crossing       | 2.9                 | An interlude (cutscene candidate 1)                                                               |
| Emberwatch parade ground | 3.1, 3.2            | Explore map: beans on canvas, spear-rack trellis, barracks wall, jetty                            |
| The power yard           | 3.1, SF-2.1         | Explore and fight map: live line, cistern overflow, dead copper spur                              |
| The public workshop      | 3.1                 | A corner of the parade-ground map, or a small interior                                            |
| The clinic supply room   | 3.1                 | A door talk; no interior needed                                                                   |
| The rain cistern         | 3.3 (one route)     | A short walk-through map, or an interlude                                                         |
| The dispatch-room door   | 3.3, 3.4            | Fight map: door, crate, floor grate                                                               |
| The dispatch room        | 3.5                 | A small interior, or documents shown as cards                                                     |
| The east barracks        | 3.6                 | A small interior                                                                                  |
| The signal tower door    | 3.7 (`ruon_traded`) | A door talk                                                                                       |
| The jetty office         | 3.8, 3.9            | A small interior                                                                                  |

**New speaking characters**

| Character                      | Scenes           | Portrait                                     |
| ------------------------------ | ---------------- | -------------------------------------------- |
| Veyra (AN-01)                  | 2.4 to 2.6       | **Needed.** Also a fight sprite (guest ally) |
| Tavi Ren (NPC-09)              | 2.2 to 3.6       | **Needed**                                   |
| Luli (NPC-12)                  | 3.1, 3.9, SF-2.1 | **Needed**                                   |
| Edda Coil (NPC-15)             | 3.1, 3.2         | **Needed**                                   |
| Kesi                           | 3.2 to 3.8       | **Needed**                                   |
| The customs clerk              | 2.3 to 2.7       | **Needed** (he carries most of MQ-02)        |
| The sergeant                   | 3.4              | Wanted; the narrator frame will do           |
| Bowl-seller                    | 2.2              | Narrator frame                               |
| Freight handler                | 2.3, 2.5         | Narrator frame; a fight sprite               |
| Freight clerk (Jin's office)   | 2.2, 2.8         | Narrator frame                               |
| Dock workers, fish-seller      | 2.7              | Narrator frame                               |
| Retired cook, supply clerk     | 3.1              | Narrator frame                               |
| Kesi's brother, lantern keeper | 3.6              | Narrator frame                               |
| Jin's guard, Commonworks clerk | 3.7, 3.9         | Narrator frame                               |
| Sabi and the riggers           | SF-2.1           | Narrator frame; fight sprites                |

Already in the game: Bo-shan (portrait since #806), Dorin, Jin, Ruon. Letters shown as cards: Mira's note,
Hanru's letter, the Director's card.

**Other art:** the cart with Parcel in harness; the pump crate and the mended teapot; the "safety materials"
crate and the pay packet; the lamp-over-a-wave stencil; the order, the instruction and Neri's page as
readable cards.

**Engine work the slice needs:** the guest-ally system (its own ADR); a fight that can end on an objective
(the winch brake); a skipped fight that still pays XP (already done for the Act I gate); wet ground beside a
live line as a surface for SF-2.1.

## Decided (owner, 2026-11-15)

The owner accepted every item below on 2026-11-15, as recommended. Each item keeps its first wording, as the
record of what was accepted ("Recommend" lines are now decisions). Later corrections are marked.

1. **Names I invented.** Kesi (the Emberwatch loader), Tolo (the trapped gate worker), Bera (the fitter whose
   warning Veyra waves off; the outline says the epilogue may put Veyra under "the worker whose warning she
   brushed off", so she needs a name), Hua (the old woman reading under the lamp; she is the stranger who
   shelters the party in Act IV), Yenna (the former signal operator who uses a wheeled chair) and her mother
   Grandmother Ansa (the outline's "grandmother" at the erased stop). Also the place names Pear Halt, the Slow
   Channel and "the Long Blink" for the ferry crossing. Recommend: approve or rename; all were checked against
   the cast lists.
2. **How the party meets Veyra.** I used Saltstep's two-bowls custom: the party carries the second bowl to "the
   pump woman". She shows the mended teapot (bible AN-01) and hauls a pump with them (outline decision 14).
   Recommend: keep.
3. **Who the dock fight is against.** The bible only says "a dock skirmish". I made it Jin's freight handlers,
   who are paid by the crate and will not stop a failing sling. Veyra fights because people are under the
   crate, not because she knows anything. Recommend: keep; it gives the handlers a reason.
4. **Veyra sees the wage packet in MQ-02** and hands it to the customs clerk to be logged. She never lies and
   says nothing of her job. It gives MQ-04 an honest optional line ("I accepted that"). This is just inside the
   reveal ladder (MQ-02 proves the supply link, not her knowledge). Recommend: keep, but it is your call
   because it makes her slightly more culpable earlier.
5. **Rusk appears briefly at the festival** (MQ-04, feeding the cat) and by name in the MQ-03 instruction. The
   outline asks for earlier antagonist presence; the bible first shows his instruction in MQ-03. Recommend:
   keep.
6. **Jin's terms** (Scene 3.8) are mine: a signed statement that her crates were sealed. Buying it gives the
   count; refusing sends the manifest to Rusk. Recommend: keep.
7. **DLG-04's three choices and MQ-04's three commission options overlap** in the bible ("We will inspect it
   independently" against "accept with written independence"). I kept DLG-04 word for word as a decider's
   choice inside the conversation, then made the commission its own table vote. Recommend: keep both, or tell
   me to fold DLG-04's choice into the vote.
8. **The cart's ramp and Yenna.** The outline lists "a ramp for a passenger who uses a wheelchair" as an
   upgrade but names nobody. I introduce Yenna here so the ramp (Act III) has a person asking for it, and so
   she is already known when the assembly platform has only stairs (MQ-10). Recommend: keep.
9. **How upgrades reach the cart.** The outline has Grumbler working in Ba Dan's workshop while the cart is
   away. I have the canopy arrive as a bundle with Pella's letter. Recommend: keep (it also lets Pella's ledger
   line ride with each upgrade).
10. **Pella's letters on the loss branch.** The owner's decision assumes Bo-shan is driving. On the loss branch
    he is still held, so I wrote her letter to Dorin and the party instead, and her sharpness lands on them.
    Recommend: approve this variant.
11. **The loss-branch echo in MQ-02** is Dorin's greeting, since Bo-shan is not there to laugh. Recommend:
    approve.
12. **The cart's delivery book pays off here.** Its unnamed entries ("stop fourteen, route nine, bell three")
    turn out to be the three erased places. `reasons.ts` says "the erased places surface in MQ-05"; the exact
    numbers are mine. _Corrected 2026-11-15:_ after an Act I loss the book is still in the Driller's cab, so
    the same three numbers are on Gao's receipt instead, and the book comes out with Senn in MQ-11.
13. **`Party:` lines.** DLG-04 has a `Player` speaker. This game has no such speaker. _Decided:_ `Party:`
    lines are tappable choice text with no speaker, in all four acts.
14. **MQ-04 has no fight against people.** The gate rescue is an encounter against water and machinery. If the
    engine cannot do an objective-only encounter yet, the bible allows resolving it in dialogue; the scene is
    written so the barks can become narrator lines.
15. **Where the documents disagree (Act II):**
    - Bible MQ-02 starts in "Ba Dan cookhouse" with Mira asking; the shipped ending and the outline start it on
      the cart's first run. I start on the coast road and carry Mira's ask as a note.
    - Bible MQ-02's victory evidence is "a shipping plate and duplicate dispatch stub"; the shipped game has a
      maker's-plate rubbing and the delivery book. _Corrected 2026-11-15:_ there is no stub. MQ-02's evidence
      is the shipped rubbing, the delivery book and the crates' stencil; after a loss, only Gao's receipt.
    - The story bible says Pella's letter is carried by "Jinu, when he is in the party". Jinu is she/her (bible
      CH-08). I wrote "she".
    - The outline puts Jin's Act II beat at Emberwatch (MQ-03); the bible only has Jin "hear of the inquiry" in
      MQ-02. I did both (2.8 and 3.8).
    - The outline's MQ-03 set-piece lists two routes (cistern, bluffed inspection); the bible lists three
      (inspection, a worried loader, the cistern). I wrote three.
16. **Aru's table is at Causeway in MQ-05** (a decided amendment to the bible, which puts the outreach room
    at Saltstep; the room stays there, and Aru visits with a folding table).
17. **Veyra keeps Rusk; she still sees the wage packet in MQ-02; MQ-03 has three approaches; Jin has both Act
    II beats; DLG-04's choice and the commission vote both stand; Pella's extra sealed letters are kept.**

## Decided (owner, 2026-11-19)

1. **The act ends on the letter home.** The road vote is taken during the meal (Scene 5.6), before the
   courier arrives, and the act's last scene is Pella's letter, the river's "...come home." and the canopy
   going up (Scene 5.7). The events and the lines are the ones the owner approved on 2026-11-15, in a new
   order. What moved with them:
   - `first_spoke` is now set before the letter is read. Nothing in 5.7 reads it; its three values are named
     (`orchard`, `marsh`, `heights`) because Act III's first camp reads them.
   - One line was reworded. Parcel used to consider the chosen road "in the morning", which would now jump
     past the letter; he looks down it from his heap that evening instead. Scene 6.1 already plays the
     morning for the Orchard, and the other two spokes open on the road.
   - The pins lie "between the rice and the river cakes", so the vote is at the meal.
   - Scene numbers: Tenzo's second sauce stays in 5.6; Sura's echo count, Jinu's delivery and Pella's letter
     are 5.7 (the tables below, and PQ-04's note in `personal-quests-1.md`).
   - Nothing else reads the old order: Bo-shan's "three more stops in the book" answers the letter either
     way, Pella's second letter quotes it, and Act III opens on whichever road was pinned. No cutscene is
     touched (CS-2A and CS-2B are in MQ-02 and MQ-04). MQ-05 is not built, so the build changes nothing.

## Open, for the owner

1. **The stencil.** The shipped game says the crates carry "a stencil none of the workers know". I drew it as
   a lamp over a wavy line and made it Emberwatch stores' mark. Recommend: approve the design, or give me
   yours before the art is made.
2. **Gao's receipt.** The shipped game says only that it is "not for stone". I wrote its text ("six sealed
   crates; sent on: stop fourteen, route nine, bell three"). Recommend: approve.
3. **The side fights** (SF-2.1 to SF-2.3): Sabi's riggers, the tipping platform and the bridge toll are mine,
   and so is the name Sabi. SF-2.1 pays off Pella's shipped puddle line, as asked.
4. **The trust table** maps this act's flags to communities. The mapping is mine; the registry work is row
   C-25.
5. **MQ-04's rescue is an objective-only encounter.** If the engine cannot do one, it falls back to dialogue.
   This is a build question, not a story one.
6. **Not yet written:** the five teacher stories (TR-01 to TR-05) and the personal quests that open in this
   act (PQ-01, PQ-02, PQ-03, PQ-10).

## Edit pass, 2026-11-17 (awaiting the owner)

A script editor's pass over all four acts. What changed in this file; the reasons, the before-and-after lines
and the proposals not applied are in the pass's report.

1. **Left alone:** every line already built (2.1 to 2.9, the arrival half of 3.1, SF-2.1).
2. **Continuity:** the card in 3.9 and the map in 5.1 say "Long-Light Evening", not "Commissioning Day"
   (commissioning is the spring tide, in Act V). Dorin has carried Gao's receipt "all the way from Ba Dan",
   not "three weeks". Sura's echo count no longer assumes the optional culvert was seen. Veyra's carved rule
   is seen in 4.6, so Act IV can name it. The optional pay-packet exchange sits at the top of 4.6.
3. **Lines:** Kaya at the chain (4.3); Tavi's and Dorin's long turns split.
4. **Hero moments added:** Nilak in the supply room (3.1), Nima and the towel basket (4.1).
5. **Cutscenes:** pointers to [cutscenes.md](cutscenes.md) at 2.9 and 4.5.

## Suggestions added 2026-11-20 (the writing pass)

The owner asked for small improvements to be written in and listed (2026-11-20: "Just write them and tell
me"). Six additions across Acts II to IV. Each is additive: no existing line was changed, no scene's events
or choice outcomes change, and no flag is set. Each sits under a note line, `> Added 2026-11-20 (suggestions
pass).`, and is one quoted block. Nothing was added to the scenes already built (2.1 to 2.9, the arrival half
of 3.1, SF-2.1), so the game and the script still agree there.

| #   | File               | Scene                               | What it is for                                                                                                                                                                                 | To undo                                        |
| --- | ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `act2-sparks.md`   | 3.9, before the clerk's card        | Kesi's key is never mentioned again after 3.2. She "finds" it by the bean rack, acting badly. Only on `emberwatch_route_loader`, and not after `lost_emberwatch`. Funny.                       | Cut by deleting the marked lines               |
| 2   | `act2-sparks.md`   | 4.5, the free roam after DLG-04     | Nobody thanks the party for going into the canal. Tolo does, in three towels, and asks them to say it was one egg. A variant for `lost_canal_rescue`. Funny.                                   | Cut by deleting the marked lines               |
| 3   | `act3-currents.md` | 6.1, after Yenna's line             | Pella's "let it fall off, then tell me" gets a beat between her letter and 11.2's "You did. By post." Victory branch only, and only once C.1 has played. Funny.                                | Cut by deleting the marked lines               |
| 4   | `act3-currents.md` | C.1, The ramp                       | Latch on the tailgate tells Parcel the rule about the rope. It does not work. Only when C.1 follows MQ-07. Bo-shan answers after a win, Dorin (eleven watch-book entries) after a loss. Funny. | Cut by deleting the marked lines               |
| 5   | `act4-weight.md`   | 11.2, the east gate (both versions) | The turtle ducks, absent since Act I, and Dorin's watch book. After a win the duck is asleep on today's page; after a loss it has Dorin's stool and Hanru let it. Two blocks, one addition.    | Cut by deleting the marked lines (both blocks) |
| 6   | `act4-weight.md`   | 12.1, around the shed               | The shed is all adults. The girl from the goods lift (4.1) brings forty blankets up by herself. Warm, not a joke.                                                                              | Cut by deleting the marked lines               |

**Small facts invented** (none names a person or a place):

- Tolo's mother counts her eggs, and Tolo is given three towels.
- The retired cook found Kesi's key among the red beans.
- Bo-shan's load in Act III includes a tall basket of cabbages on a small crate.
- Parcel chews the ramp's rope handle. (Grumbler's note already warns against it.) Dorin has logged telling
  him off eleven times.
- A turtle duck sleeps at Dorin's gate in Act IV: on the watch book after a win, on his stool since the day
  he left after a loss. It is called Deputy only for a table that saw SQ-31.
- The goods lift carries blankets up to the tram shed the night before the tide, and the girl works it.

**Checked against:** Hanru is they/them and speaks in clipped facts; the driver is Bo-shan after a win and
Dorin after a loss, and the watch book is back under the cart seat by 10.8; Latch stays on the tailgate, so
its line holds for a party that refused it in SQ-10; no hero is voiced, so no addition depends on the party.
