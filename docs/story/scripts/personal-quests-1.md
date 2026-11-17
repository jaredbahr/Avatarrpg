**DRAFT for the owner (the writing pass, 2026-11-17). Nothing here is in the game.**

# Personal quests, part 1 — scripts for PQ-01 to PQ-05

Kaya, Tenzo, Nilak, Sura and Bo. Part 2 ([personal-quests-2.md](personal-quests-2.md)) has Lin Mei, Nima,
Jinu, Riko and Wen. The five teacher stories are in [teachers.md](teachers.md).

Sources: the bible's Part 05 (PQ-01 to PQ-05, with each quoted line used word for word and marked), the hero
entries CH-01 to CH-05, the supporting cast, and the reveal ladder; the saga outline's "Why each hero keeps
going"; the shipped Act I finds in `src/content/story/reasons.ts`; and the four act scripts, which open each
quest and pay it off (Scene 12.2 the night before, Scene 15.4 the closing scenes).

## How to read these scripts

The reading key at the top of [act2-sparks.md](act2-sparks.md) holds here: one speaker per line, `Narrator`
lines as stage directions, `Party:` lines as tappable choice text with no speaker, **Shown**, **VOTE**, **CARRY
ON**, and the **Driver** (Bo-shan, or Dorin on the Act I loss branch). Five things are particular to a personal
quest:

- **The quest only exists while its hero is in the party.** Its marker stands on the map only then. This is the
  one place a hero speaks at length, so the hero's lines are the spine and are not optional. If the hero leaves
  the party (or is at 0 HP) part-way through, the quest waits where it stopped.
- **The rest of the party** is written as optional variants ("If Riko is in the party"). An absent hero is
  never voiced. Every scene works with the quest's hero alone.
- **The table still chooses.** The turning point of each quest is a table vote on what the hero does. The
  hero's lines after the vote follow the vote. No fixed line forces an apology the table did not choose.
- **Each quest begins where an act script leaves off.** The opening exchange is already written there and is
  quoted here in a box, not rewritten.
- **A quest reveals nothing early.** Each one says when it opens and keeps inside what the main story has
  shown by then. Where a later mission changes what a line may say, the line is written twice.
- **When there is no cart.** From the end of MQ-09 until MQ-11 the cart is impounded and the party is on foot,
  with the Driver walking beside it (Act IV). A quest played then loses only its cart lines: variants that
  name the cart, the tailgate or Parcel do not play, and a keepsake goes into the hero's pack and onto the
  shelf when the cart comes back.

**What a quest gives.** Trust with one community, lines that change in later scenes, and a **keepsake**: a
small object that rides on the cart's shelf and is seen at camp. A keepsake has no stats and is never needed.
A quest does not choose a discipline or teach bending (bible, Part 05). A quest left unfinished is named in
MQ-12's "what is still in reach" list, and the hero's closing scene in MQ-15 plays its "open" version.

**Flag names** are suggestions for the registry, as in the act scripts.

| Quest | Hero  | Opens                                       | Where it plays                    | Fight                         |
| ----- | ----- | ------------------------------------------- | --------------------------------- | ----------------------------- |
| PQ-01 | Kaya  | Saltstep, any visit after MQ-03             | The ferry steps, Miri's workshop  | Yes: the collectors' handcart |
| PQ-02 | Tenzo | Causeway, after MQ-04 (opened in Scene 4.1) | The Six-Ladle Kitchen             | No                            |
| PQ-03 | Nilak | Causeway, MQ-05 (opened in Scene 5.5)       | Aru's table, the Open Palm Clinic | No                            |
| PQ-04 | Sura  | Reedglass, MQ-07 (opened in Scene 7.2)      | The pilots' landing, the channel  | A rescue, no enemies          |
| PQ-05 | Bo    | Copper Orchard, MQ-06 (opened in Scene 6.4) | The viaduct, the crew's fire      | No (a lift, played)           |

---

## PQ-01 — The Place You Stay (Kaya)

**Theme card:** PQ-01, The Place You Stay

Themes: responsibility, belonging. Kaya did a brave thing at fourteen and burned a corner off a roof doing it.
She has carried a letter about it for nine years without opening it. The letter was four lines long and asked
her to bring a ladder. What she is offered now is a job list and a day of the week. From the owner's list, this
quest carries: saying sorry isn't the end of it.

- [x] No nation, element or culture stereotype (the street's unkindness belongs to one chandler, and Miri says
      so)
- [x] Every valid party, non-benders included, has a real route through (Kaya is always present; the fight can
      be won by standing on a handcart)
- [x] No instant forgiveness or absolution (the best ending is a ladder to hold and a date)
- [x] The other side's reasons are shown (the collectors are paid by the crate and docked for the shortfall)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Saltstep, on any visit after MQ-03, with Kaya in the party. The ferry back from Emberwatch lands
here, so most tables meet it then. **Other people:** Miri, she/her, 24, Kaya's childhood neighbour, who runs
the lantern workshop; Oko, he/him, 21, Miri's brother. **What the party may know:** the supply-control order
and its signature (MQ-03). Nothing in this quest goes past that.

**Planted earlier:** the crate with the crooked-handle stamp at the quarry (`reason.kaya`), and Miri's crates
by the ferry, where Kaya read the chalk twice and said "After customs" (Scene 2.2).

### Scene K.1 — Forty steps

**Shown:** found (the lantern crates by the ferry, the same marker as Scene 2.2). _Sets `pq01_open`._

**Narrator:** The lantern crates are still stacked by the ferry. The chalk has been gone over since you were
last here: "Miri's. Do not sit on these. This means you, Oko. YES, STILL."

**Narrator:** A broad young man is sitting on the top crate, eating a plum bun.

**Kaya:** Oko?

**Oko:** ...Kaya? Kaya from two doors down?

**Narrator:** He gets off the crate. He is a head taller than she is.

**Oko:** You got shorter.

**Kaya:** I did not get shorter.

**Oko:** Somebody did something. Last time I saw you I was looking at your elbow.

**Kaya:** You're sitting on her crates.

**Oko:** I'm guarding them. From people who'd sit on them.

**Kaya:** Is she...

**Oko:** Forty steps that way, up a ladder. She's been up it since breakfast, so mind yourself. Go on. She'll
want to see you. She won't say so. She'll say something about the ladder.

**Narrator:** Kaya looks at the forty steps.

**Kaya:** Right. I've got a plan.

**Party:** What's the plan?

**Kaya:** I'm getting one. Walk with me. If I stop, don't say anything. Just keep walking, so I look silly
standing there by myself.

> **If `reason.kaya` is set —**
> **Kaya:** I found one of her crates up at the quarry. Lamp glass, packed in straw. I've been walking round
> with that for weeks, like a stone in my boot.

> **If Tenzo is in the party —**
> **Tenzo:** We could wait a little. Let her finish what she's doing.
>
> **Kaya:** If I wait I'll think. Don't let me think. Walk.

**Driver (Bo-shan):** I'll stay with the crates. I won't sit on them. I'll lean. Leaning isn't sitting.

**Oko:** That's what I told her.

> **Loss branch.** **Driver (Dorin):** I will remain with the crates. Standing. I want that noted, since there
> is a notice.

### Scene K.2 — The ladder

**Shown:** played. **Where:** the ferry steps. A ladder is tied to a level pole. Strings of paper-and-glass
lanterns wait in loops on a hook rail beside it.

**Narrator:** A young woman is at the top of the ladder with a hammer in her belt and a mouthful of nails. She
is hanging a string of lanterns across the steps, one hook at a time.

**Narrator:** Kaya walks thirty-eight steps. Then she runs the last two.

**Kaya:** I'll hold the ladder!

**Narrator:** The ladder is tied to the pole in three places. It does not need holding. Kaya grabs it anyway,
and her shoulder goes through the loops on the hook rail.

**Narrator:** A whole string of lanterns slides off the rail and settles over her like a shawl. She stands
very still. Nothing breaks.

**Narrator:** The woman on the ladder takes the nails out of her mouth.

**Miri:** Hello, Kaya.

**Kaya:** Hello.

**Miri:** Don't move.

**Kaya:** I'm not moving.

**Miri:** You've got eleven of my lanterns on.

**Kaya:** I counted twelve.

**Miri:** One's down your back.

**Narrator:** Miri comes down the ladder. She lifts the string off Kaya one lantern at a time, without
hurrying, and hangs it back on the rail.

**Miri:** Nine years, and you came in holding a ladder that was already tied.

**Kaya:** It looked loose.

**Miri:** It's never been loose. I tie things.

**Narrator:** The cord between the lanterns is braided, flat, in four strands. One end has frayed. Kaya's
hands have already started on it.

**Kaya:** You still braid in four.

**Miri:** You taught me four. You said three comes undone, and you were ten and very sure, so I never checked.

**Narrator:** Kaya finishes the end and pulls it tight. It is better than the rest of the cord. Miri looks at
it for a moment longer than she needs to.

**Miri:** I've got two hundred of these to get up before the lantern season opens, and one brother, who sits.
There's a second ladder. Are you staying an hour, or are you only passing?

**Party:** We can stay an hour.

**Kaya:** I can stay an hour.

**Three short jobs (any order; then the scene goes on):**

**Job one — carrying.**

**Narrator:** The lanterns travel in straw. You carry them from the crates to the rail four at a time. They
make no sound at all.

**Kaya:** She packs them so they won't chime. Her father did it. He said a lantern that rings in the cart has
a crack in it by the time it arrives.

> **If Bo is in the party —**
> **Narrator:** Bo has stopped by the rail. One paper panel has a painted heron on it, and the heron's leg has
> smudged. He is looking for a brush.
>
> **Miri:** That one's a second. It goes at the back.
>
> **Bo:** It doesn't have to.
>
> **Narrator:** He finds a brush. The heron gets its leg back. Miri moves the lantern to the front without
> saying anything.

**Job two — lighting.**

**Miri:** Wicks need a first light, or they sulk on the night. I use a taper. It takes me the morning.

**Narrator:** Kaya holds up one finger. A flame the size of a grain of rice sits on the end of it.

**Miri:** Smaller.

**Kaya:** That is small.

**Miri:** They're paper, Kaya.

**Narrator:** The flame gets smaller. Kaya goes down the rail touching each wick, with her tongue between her
teeth. Forty wicks. Not one panel so much as browns.

**Kaya:** There. Forty. How long does the taper take?

**Miri:** I'm not telling you. You'd be unbearable.

**Job three — the race.**

**Oko:** First to hang ten. Me on that ladder, her on this one. Miri calls it.

**Miri:** I'm not calling anything. I'm working.

**Oko:** Ready...

**Narrator:** Kaya is three rungs up.

**Oko:** I hadn't said go!

**Kaya:** You said ready! I was ready!

**Narrator:** She hangs ten lanterns while Oko hangs seven. Hers are evenly spaced. She climbs down looking
at nobody, very pleased.

**Miri:** You went on "ready".

**Kaya:** There wasn't a rule.

**Miri:** There's never a rule. You're always halfway up before anybody's said what we're doing.

**Narrator:** She says it lightly. Nobody on the steps takes it lightly. Kaya picks up the hammer.

**Kaya:** This hook's loose. Second from the pole. Have you got longer nails?

**Miri:** I wrote to you. After the fire.

**Kaya:** The short ones won't hold in this wood. It's gone soft with the salt.

**Miri:** Kaya.

**Kaya:** I know you wrote.

**Miri:** You never wrote back.

**Kaya:** I knew what it said.

**Miri:** Did you.

**Narrator:** Miri puts the nails in her apron pocket.

**Miri:** Come inside. There's something on my shelf I want you to look at. Bring the hammer, since you've
found a use for it.

> **If Riko is in the party —**
> **Riko:** The hook isn't loose.
>
> **Kaya:** It's a bit loose.
>
> **Narrator:** Riko tries the hook with two fingers. It does not move. She says nothing else about it.

> **If Sura is in the party —** (to Oko, on the steps, while the others go in)
> **Sura:** Lanterns. At home we light the ice from underneath. One lamp, under the ice, and the whole bay
> glows green. You can see the fish go past like people in a street.
>
> **Oko:** How do you get the lamp under the ice?
>
> **Sura:** You cut a hole.
>
> **Oko:** Then it's not under the ice. It's in a hole.
>
> **Sura:** ...It's a small hole. I like him. He can stay.

### Scene K.3 — The tile

**Shown:** played. **Where:** Miri's workshop, which was her father's paper shop: frames on pegs, a paste pot,
panes of lamp glass stood on edge in straw.

**Narrator:** On a shelf above the bench, between a jar of brushes and a ball of cord, there is one clay roof
tile. It is black down one side.

**Narrator:** Kaya sees it. She puts the hammer down. She picks up a broom.

**Miri:** Put my broom down.

**Kaya:** There's straw all over your...

**Miri:** There's meant to be straw. It's a lantern shop. Put it down.

**Narrator:** Kaya puts the broom down. She does not seem to know what to do with her hands after that.

**Miri:** That's from the corner over the awning. That corner, there. Father wanted it thrown out with the
rest. I kept one.

**Kaya:** So you'd remember what I did.

**Miri:** So I'd remember the day. All of the day. Oko came through that door with his shirt torn up the back
and the week's takings still shut in his fist. That's on the tile too.

**Party:** What happened?

**Narrator:** Kaya starts to answer, and Miri lets her.

**Kaya:** Three boys from the tannery had him against your shutter. He was twelve. They wanted the takings. I
was on the wall.

**Miri:** You were always on the wall.

**Kaya:** I came down off it and I threw fire at their feet. Only at their feet. To make them jump.

**Miri:** They jumped.

**Kaya:** And the awning went up. And then the corner of the roof. And your father's paper. The whole winter's
paper, he'd only just had it in.

**Miri:** You put most of it out yourself. With your sleeves.

**Kaya:** I don't remember that.

**Miri:** No. You remember the chandler in the road, shouting "Somebody get that girl off our street."

**Narrator:** Kaya says nothing for a moment.

**Kaya:** Our street. I was born on it.

**Miri:** I know where you were born. I was two doors down and a year old, and my mother says I wouldn't sleep
for the noise you made.

**Kaya:** My uncle's barge was going upriver that night. I asked to be on it. Nobody said no.

**Narrator:** Kaya reaches into her sash. What she takes out is a folded letter. It has been carried so long
that the corners have gone round and the paper is soft as cloth.

**Narrator:** The seal has never been broken.

**Miri:** That's my seal.

**Kaya:** I kept it.

**Miri:** You kept it shut.

**Kaya:** I knew what was in it. The awning, and the roof, and the paper, and what the street was calling me.
All true. I didn't need to read it to know it.

**Miri:** Open it.

**Kaya:** Miri...

**Miri:** I wrote it. I'd like somebody to read it. It's been nine years.

**Narrator:** Kaya breaks the seal. It is four lines long.

**Miri's letter:**

> Kaya. The roof goes back on Thursday. Father says bring gloves. I say bring the ladder from your yard, ours
> is short. We open again the week after and Oko wants you to cut the string. Are you coming? M.

**Narrator:** Kaya reads it. Then she reads it again. It is still four lines long.

**Kaya:** You asked me to bring a ladder.

**Miri:** Ours was short.

**Kaya:** I had a whole letter in my head. Pages. I've been answering it for nine years.

**Miri:** What did I say, in that one?

**Kaya:** That I'd wrecked it. That I should have fetched someone. That people like me...

**Narrator:** She stops there.

**Miri:** I never wrote "people like you" in my life. I don't know any people like you. There's the one.

**Kaya:** Did they want me there, though? On the Thursday. The street.

**Miri:** Some did. The chandler didn't. Father did. Oko had the scissors ready a week early.

**Kaya:** But if I'd come, would I have been...

**Miri:** You keep asking whether you belong here. I asked whether you were coming on Thursday.

_(The line above is the bible's, word for word.)_

**Narrator:** Outside, on the steps, somebody drops a crate of something that does not chime.

**Miri:** It was brave. I've never once said different. Oko tells it every lantern season, and you're taller
in it every year.

**Miri:** And then you were gone before the tiles were cold, and I put a roof on with a short ladder. Both of
those happened. I'm not going to pick one for you.

**Narrator:** The workshop door bangs open.

**Oko:** Miri. There's a handcart at the crates. Four men and a paper.

> **If Nilak is in the party —** (before Oko comes in)
> **Narrator:** Nilak has been standing by the door with his hands folded. He looks at Kaya's sleeves, which
> are whole, and at Kaya, and decides not to ask about nine-year-old burns just now.

### Scene K.4 — Sixteen crates

**Shown:** played, into a fight. **Where:** the ferry steps and the quay below them.

**Narrator:** Four collectors in freight-office aprons have a handcart backed up to Miri's crates. One of
them, an older man with a pencil behind his ear, is holding a paper at arm's length to read it.

**Collection foreman:** Lantern workshop, Saltstep. Lamp glass, for public works. I'm to collect and you're to
have a slip. Payment on account.

**Miri:** I've got three of your slips from the spring. "On account." I can't pay a glassblower with "on
account". I've tried. She laughed.

**Collection foreman:** I don't write the slips, miss. I'm paid by the crate. If I go back short, the
shortfall comes out of the four of us.

**Narrator:** He turns the paper round so she can see it. It is a typed sheet, headed "Supply-control order.
Sites critical to the Common Current: collections." Half-way down: "Lantern workshop, Saltstep. Lamp glass. 6
crates each season." In front of the 6 there is a 1. The 1 is in pencil.

**Miri:** That says six. It's said six since the spring.

**Collection foreman:** It says sixteen.

**Miri:** It says six, and somebody's leaned a one against it. In pencil. You can see where they pressed.

**Collection foreman:** I collect what it says, miss.

> **If `reason.kaya` is set —**
> **Kaya:** Your spring crates went up to a quarry. I've seen one. It was sitting in the dust next to a
> drilling machine. Nobody up there was hanging lanterns.
>
> **Collection foreman:** I load the barge, miss. Where the barge goes after is a question for somebody with a
> desk.

**Narrator:** Two of the collectors lift the first crate. The straw inside does not make a sound.

**Narrator:** Kaya has stepped between the handcart and the stack. Her hands are already up. Then she looks
back over her shoulder.

**Kaya:** I can get us through them. I'm asking whether through is where we want to go.

**Kaya:** It's your shop, Miri. What do you want?

**Narrator:** Miri looks at the strings of paper lanterns hanging over everybody's heads.

**Miri:** I want my glass on my steps and nobody's sleeve on fire. In that order.

**Kaya:** In that order.

**Fight:** the ferry steps. **Against:** the collection foreman and three collectors (clubs and cargo hooks,
no bending; they yield at low health and nobody is hurt past a bruise).

**Win:** a party member stands on the handcart at the end of a round with no collector beside it, **or** the
collectors are beaten down. **Lose:** the whole party is down, or ten crates reach the barge (the collectors
load one crate a round between them unless the one carrying it is stopped).

**The strings.** Four strings of lit paper lanterns hang across the steps. A fire ability aimed across a
strung tile burns that string. Burned strings do not lose the fight. They are counted, and the count changes
two lines afterwards.

**Fight barks:**

- **Miri** (from the workshop door): "Not near the paste pot! Anything but the paste pot!"
- **Oko:** "I'm sitting on them! Look! I'm sitting on them on purpose!"
- **Collection foreman:** "Nobody wants this, miss. Stand off and it's one trip."
- **Kaya** (when she uses fire and no string burns): "Small. See? Small."
- **Kaya** (when a string burns): "That one's mine. I'll make it again. I'll make it again!"
- **A collector** (yielding): "I've got a boy at home. I'm putting it down. Look. It's down."

> **If Riko is in the party —** (on her first turn)
> **Riko:** The cart. Never mind them. Somebody stand on the cart.

**After a win:**

**Narrator:** The collectors sit down on the bottom step. The customs clerk has arrived at a run, with his
stool under one arm and the brass seal swinging on its chain.

**Customs clerk:** I heard there was a list. Give it here. I like a list.

**Narrator:** He reads the paper. Then he holds it up to the light.

**Customs clerk:** The typing's an order. I've seen the order and I can't do anything about the order. The
pencil's a different matter. Pencil isn't an order. Pencil's a suggestion.

**Customs clerk:** And that's a six with a one drawn on. I do numbers all day. I know a one that wasn't
invited.

**Collection foreman:** I didn't draw it.

**Customs clerk:** I didn't say you did. Somebody between the desk and the dock did, and you'd have been the
one caught with sixteen. You want to think about who hands you your paper.

**Narrator:** The foreman takes the pencil from behind his ear, looks at it, and puts it in his pocket.

**Customs clerk:** Six is what's typed, miss. Six I have to let go. I'll watch them count six, and I'll stamp
the slip myself, so "on account" has got a date on it and a witness. It's not money. It's a slip that's harder
to lose.

**Miri:** Six. Not sixteen.

**Narrator:** Six crates go onto the handcart. The collectors carry them one at a time, carefully, the way
Miri carries them. The foreman stops at the bottom of the steps.

**Collection foreman:** They'll dock us the ten.

**Miri:** I know they will. Come back Friday. There's frames want sanding and I pay in dinner. That's all I've
got and it's hot.

**Narrator:** He nods once, and does not say whether he will.

> **If one or more strings burned —**
> **Narrator:** A string of lanterns hangs across the steps in black ribs, with a little paper left at each
> end. Kaya is standing under it. She does not look away from it.

> **If no string burned —**
> **Narrator:** Miri counts the strings over the steps. Four. She counts them again.
>
> **Miri:** Huh.

**CARRY ON (the fight is lost):**

**Narrator:** The collectors get ten crates to the barge before anyone can stop them. The barge pushes off.
The foreman does not look pleased about it. He leaves a slip on the top step, under a stone.

**Narrator:** The customs clerk arrives at a run, too late, and reads the paper on the quay with the seal
still swinging.

**Customs clerk:** That's a six with a one drawn on. In pencil. Ten of those crates were never on any order.
I'll write it up. Barge name, crate count, time of tide. It takes a day. Everything takes a day.

**Narrator:** Miri sits down on the step beside the six crates she has left.

**Miri:** Two hundred lanterns and glass for sixty.

**Narrator:** Along the pole walk, a shutter opens. The bowl-seller comes out with a tray of empty pickle
jars, washed.

**Bowl-seller:** They're glass. They've got a hole in the top. I don't see the difficulty.

**Narrator:** By dusk there are jars on the bottom step from nine households, and a bottle shaped like a fish.

_Sets `lost_miri_crates`. The fight pays its XP either way. The workshop is short of glass for the season, and
the lanterns on the ferry steps are part glass and part pickle jar from here on. The vote still plays._

### Scene K.5 — The steps at dusk

**Shown:** played. **Where:** the ferry steps. The noise has brought people out.

**Narrator:** Half the pole walk has come to look. Somebody has told somebody who Kaya is. It goes along the
steps ahead of her.

**Old ferryman:** That's her? The one from Oko's story? Went over a wall at three great lads and sent them
running?

**Oko:** That's her! Tell them, Kaya. Tell them about the wall. I do it every year but I do the voices wrong.

**Narrator:** People are smiling. Somebody starts to clap. It is the easy half of the story, and they would
like to hear it from her.

**Narrator:** Miri is on the top step with the letter in her apron pocket. She is not smiling and she is not
frowning. She is waiting to see.

> **If one or more strings burned —** **Narrator:** The burned string is still hanging over the old
> ferryman's head. Nobody has looked up yet.

> **If Riko is in the party —**
> **Riko:** You're looking at the ferry.
>
> **Kaya:** I'm looking at the water.
>
> **Riko:** The ferry's on the water.

> **If Tenzo is in the party —**
> **Tenzo:** Whatever you say, say it slower than you want to.
>
> **Kaya:** I hate that that's good advice.

**VOTE — What does Kaya do?**

- **Tell all of it, here on the steps, and stay for the work.** The rescue and the roof, in front of
  everyone. Then the second ladder. _Sets `pq01_whole_story`._
- **Help quietly, and keep the telling between her and Miri.** No speech. Glass, labour, and the rest of the
  story said in the workshop with the door shut. _Sets `pq01_quiet_help`._
- **Go.** The ferry is loading. _Sets `pq01_left`._

Footer: "Miri's lanterns go up whichever way this goes."

**If `pq01_whole_story`:**

**Narrator:** Kaya goes up two steps, so that people can see her, and then comes back down one, because two
felt like a stage.

**Kaya:** I was fourteen. Three boys had Oko by the shirt. I went over the wall. That's the half he tells.

**Kaya:** Here's the other half. I threw fire in a street that had a paper shop on it.

**Kaya:** The awning went. Then a corner of the roof. Then her father's paper, the whole winter's worth.

**Narrator:** The clapping has stopped. Oko has sat down on a crate without noticing that he has.

**Kaya:** Then I went. I didn't stay to hold a ladder. Miri wrote and asked me to. I never opened it. She put
that roof back on without me, and I've only just found out the ladder was short.

**Kaya:** I'd go over the wall again. I'd do it better than I did. That's all I've got to say about the first
half.

> **If one or more strings burned —**
> **Kaya:** And that string up there is mine as well. Today's. I'm not doing nine years over that one. I'm
> making it again tonight.

**Narrator:** Nobody says anything. Then the old ferryman scratches his chin.

**Old ferryman:** Well. Are you any good on a ladder?

**Kaya:** I'm excellent on a ladder.

**Miri:** She's fast on a ladder. We'll find out about good.

**Narrator:** Miri comes down the steps and puts the hammer in Kaya's hand.

**Miri:** I'm not telling you it's mended. I'm telling you there are a hundred and sixty lanterns still in
straw, and somebody has to cut glass tonight.

**Kaya:** I can cut glass.

**Miri:** You can't. I'll show you. You'll be bad at it till about midnight.

**Narrator:** They work until the lamps across the bay come on. Kaya is bad at it until about midnight.

**Narrator:** Some time after that, Miri speaks without looking up from the frame she is pasting.

**Miri:** Thursday we take the high string down and check every hook. It's a two-ladder job.

**Kaya:** The cart leaves in the morning. We're a day up the river road by Thursday.

**Miri:** I didn't ask where the cart was going.

**Narrator:** Kaya opens her mouth. She shuts it. She finds a pencil stub on the bench and writes on the lid
of the nearest crate, in letters big enough to read from the door: "THURSDAY. HIGH STRING. KAYA."

**Kaya:** There. It's written on something of yours. Now you can hold it up at me.

**Miri:** I will, too.

**If `pq01_quiet_help`:**

**Narrator:** Kaya shakes her head at Oko, once. She picks up a crate and carries it up the steps and into
the workshop. After a moment the crowd finds other things to look at.

**Oko:** I'll do the voices, then.

**Narrator:** Inside, Kaya shuts the door behind her.

**Kaya:** I'm not standing on a step for them. I can't do it with a crowd. I'll say it to you.

**Miri:** Go on.

**Kaya:** I threw fire in a street with a paper shop on it. Your awning, your roof, your father's paper.
Then I went, and you wrote, and I never opened it. That's the rest of it. I've never said it out loud to
anyone before.

**Miri:** No. You haven't.

**Narrator:** Miri straightens a pane of glass in its straw.

**Miri:** It's less than I wanted. I wanted them to hear it from you. It's still more than nine years of
nothing.

**Kaya:** I can get you glass. The glassblower on the east quay wants a firebender for her furnace day. One
day of my heat, a crate of her seconds. I asked her on the way up the steps.

**Miri:** You asked her before you knew what I'd say?

**Kaya:** I was halfway up. You know what I'm like.

**Narrator:** Miri very nearly laughs.

**Miri:** Thursday the high string comes down. It's a two-ladder job. I'm not asking twice in one lifetime.
It's there if you want it.

**Kaya:** ...I'll write it down.

**Narrator:** Out on the steps, Oko is telling it with the voices. In his version, this year, there are four
boys.

**If `pq01_left`:**

**Kaya:** The ferry's loading.

**Miri:** It is.

**Narrator:** The crowd waits a moment longer. Oko looks from one of them to the other.

**Kaya:** I'm sorry about the roof.

**Miri:** I know you are. You've been sorry for nine years, in a letter you didn't open.

**Narrator:** Kaya holds out the letter. Miri does not take it.

**Miri:** Keep it. It's yours. It always only said the one thing.

**Narrator:** Kaya goes down the steps to the ferry. She walks fast. She does not run.

**Oko:** She was just here. She hung ten.

**Miri:** She did. Evenly, too. Pass me the nails.

### Scene K.6 — What Kaya carries off

**Shown:** found (Oko, by the crates, as the party leaves). Plays after `pq01_whole_story` or
`pq01_quiet_help`.

**Narrator:** Oko is waiting by the crates with something shut in his fist, the way he must once have held a
week's takings.

**Oko:** I made you this. I made it a while ago, in case.

**Narrator:** It is a lump of green lamp-glass slag on a braided cord. It has two dents that might be eyes.

**Kaya:** What is it?

**Oko:** A turtle duck.

**Kaya:** It's a lump.

**Oko:** It's a turtle duck that's asleep.

**Narrator:** Kaya holds it up to the light. It is the ugliest thing she has seen all year. She ties it to
her sash with a knot that will not come undone.

**Kaya:** It's perfect. Don't make another one. I want the only one.

_Keepsake: **Oko's sleeping turtle duck**, hung from the cart's shelf. Sets `pq01_done`._

### Scene K.7 — A later visit

**Shown:** found (the ferry steps, on any later visit to Saltstep).

**Narrator (every version):** The lanterns are up, the whole length of the ferry steps. The last one on the
high string has a weight tied under it to keep it from swinging in the harbour wind. The weight is a clay
roof tile, black down one side.

**If `pq01_whole_story`:**

**Narrator:** The crate lid with "THURSDAY" on it has been nailed up inside the workshop door.

**Miri:** There you are. Second ladder's where you left it. I've moved nothing.

**Kaya:** You've put the tile on a string.

**Miri:** It's a good weight. It was only on a shelf because I'd nowhere to use it.

**If `pq01_quiet_help`:**

**Miri:** Kaya. The seconds came, a full crate. She says your heat was even, and she doesn't say that.

**Kaya:** Is the high string...

**Miri:** It's Thursday tomorrow. You know where the ladder is.

**If `pq01_left`:**

**Narrator:** The workshop has a new shutter and a second bench. A girl of about twelve is pasting panels at
it, quickly and well.

**Miri:** Kaya. It's six a string if you're buying, and I've a new apprentice, so mind her elbows.

**Narrator:** She is perfectly polite. She goes back to her frame.

> **If `lost_miri_crates` —** **Narrator:** Every third lantern on the steps is a pickle jar. One is a bottle
> shaped like a fish. The children of the pole walk have decided the fish is the best one.

### PQ-01: what it sets and where it pays off

| Sets               | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `pq01_open`        | Kaya has taken the forty steps                    |
| `lost_miri_crates` | The fight was lost and carried on                 |
| `pq01_whole_story` | She told both halves in public and stayed to work |
| `pq01_quiet_help`  | She told Miri alone and paid in labour and glass  |
| `pq01_left`        | She took the ferry                                |
| `pq01_done`        | The quest is closed (any of the three)            |

- **Trust:** Saltstep market and docks rises with `pq01_whole_story` (most) and `pq01_quiet_help`; it does not
  fall with `pq01_left`. Winning K.4 raises it a little; the collectors remember being offered Friday.
- **Keepsake:** Oko's sleeping turtle duck (not after `pq01_left`).
- **MQ-12, Scene 12.2:** Miri's forty lanterns arrive at the shed with "Thursday, if you're alive. M." That
  scene plays for every Kaya and already works with all three outcomes: after `pq01_left`, "She's written
  'Thursday' again" means Miri asked a second time after all.
- **MQ-15, Scene 15.4:** the "resolved" version (Kaya on the ladder, Miri holding it) plays after
  `pq01_whole_story` or `pq01_quiet_help`; the "open" version (the date on the crate lid) after `pq01_left` or
  if the quest was never opened.

---

## PQ-02 — A Table Is Not a Truce (Tenzo)

**Theme card:** PQ-02, A Table Is Not a Truce

Themes: fairness, responsibility. Tenzo's answer to an argument is to feed it. The cooks he wants to help are
the ones who would have to cook that dinner. The contractor who is not paying them is not cruel; he kept the
shelf open because he thought that was the kind thing, which is Tenzo's mistake in a better coat. From the
owner's list, this quest carries: good people can cause harm.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution (Dema puts him on washing-up, not on a pedestal)
- [x] The other side's reasons are shown (Ketu is paid by the dish and is three months behind himself)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** in Causeway after MQ-04, with Tenzo in the party. **Other people:** Dema, he/him, 37, a cook at the
Six-Ladle Kitchen; Yuna, she/her, sixties, pot-washer; Bash, he/him, twenties, on the ovens; Ketu, he/him,
fifties, the provisioning contractor. **What the party may know:** the Director's face and what she built
(MQ-04). Nothing here goes past that.

**Planted earlier:** the ration crates at the quarry, signed for and never opened (`reason.tenzo`: "I'm
keeping the receipt"), and Dema at the late shelf.

> **The opening, already written (Act II, Scene 4.1):**
>
> **Tenzo:** Who cooks for the late shelf?
>
> **Dema:** We do. After our own shift.
>
> **Tenzo:** Paid?
>
> **Narrator:** Dema wipes his hands on his apron for longer than they need.
>
> **Dema:** Come back when the lamps are out and ask me again. Bring an appetite and no ideas.

### Scene T.1 — No ideas

**Shown:** played. **Where:** the back door of the Six-Ladle Kitchen, after the lamps are out. _Sets
`pq02_open`._

**Narrator:** The kitchen is still hot. Five ladles hang on a rail over the stockpot, each a different size.
Where a sixth should hang there is a boat paddle.

**Narrator:** Tenzo has brought an appetite. He has also brought a sheet of wrapping paper, folded in four,
with writing on it.

**Dema:** What's that?

**Tenzo:** Nothing.

**Dema:** It's got headings.

**Tenzo:** It's a menu.

**Dema:** I said no ideas. A menu is six ideas with a soup at the front. Put it in your pocket. You can work
for your answer like anybody else.

**Three short jobs (in order; each is one beat):**

**Job one — the paddle.**

**Dema:** Stock wants turning every quarter hour or it catches. Use the sixth ladle.

**Tenzo:** The paddle.

**Dema:** The sixth ladle. The pot got bigger and the ladles didn't. Don't call it a paddle where Yuna can
hear you.

**Narrator:** Tenzo turns the stock with a boat paddle. He does it properly, from the bottom. Nobody remarks
on it. He would have liked someone to.

**Job two — the leaves.**

**Narrator:** An old woman is folding river-cake leaves at the long table, flat and square and very fast. She
pushes a stack toward Tenzo without looking up.

**Narrator:** Tenzo folds one the way his grandmother did: two tucks and a twist, so that it stands up like a
little boat.

**Yuna:** That's lovely.

**Tenzo:** Thank you. It holds the steam in.

**Yuna:** That's four you've done. I've done thirty.

**Narrator:** Tenzo looks at his four little boats. He folds the fifth one flat.

**Job three — the oven.**

**Narrator:** Tenzo stops by the big oven, puts his ear near the door, and knocks twice on the brick.

**Tenzo:** It's running hot on the left.

**Bash:** It's always run hot on the left.

**Tenzo:** You could re-lay the back course. Half a day. I'd...

**Bash:** We put the things that like it hot on the left.

**Narrator:** Bash slides a tray in. The left side is all river cakes. The right side is the buns. Tenzo
shuts his mouth.

> **If Wen is in the party —**
> **Wen:** There's a flue damper you could... no. No, they've solved it with where they put the buns. That's
> better than a damper. That's free.

**Narrator:** Dema takes a sheet of paper off a nail by the door and puts it on the table in front of Tenzo.

**Dema:** You asked if the late shelf's paid. Read it yourself.

**Narrator:** It is the kitchen's wage sheet. Day shift: names, hours, a figure. Underneath: "Late shelf." The
same names. The hours are filled in. Where the figure should be, each line says the same word: "Goodwill."

**Tenzo:** How long?

**Dema:** The Commonworks contract pays the kitchen for every covered dish on that shelf. It doesn't say who
covers them. First week, he asked us as a favour. For the festival. That was thirty-one nights ago.

**Yuna:** Thirty-two. You're not counting tonight.

**Narrator:** Tenzo gets the wrapping paper back out of his pocket. He cannot help it.

**Tenzo:** Then let me do this. One dinner. Everybody at one table, your contractor too. I cook. Six dishes,
river cakes to start. People say things over a good meal that they'd never say across a desk.

**Dema:** Who preps it?

**Tenzo:** I'd prep it.

**Dema:** Six dishes for thirty? In whose kitchen? On whose shift?

**Narrator:** Tenzo does not answer.

**Dema:** And who clears? Who washes up, after the dinner where we all talk about who's paid to wash up? Will
we be paid for cooking the dinner where everybody discusses paying us?

**Tenzo:** I wanted everyone at the same table.

**Dema:** Then stop making us stand behind it.

_(The two lines above are the bible's, word for word.)_

**Narrator:** Yuna folds another leaf. Tenzo folds the wrapping paper, smaller than it was, and this time it
stays in his pocket.

> **If `reason.tenzo` is set —**
> **Narrator:** His hand comes out of the pocket with a different paper: a receipt, creased, with quarry dust
> still in the folds.
>
> **Tenzo:** I've been carrying this since Stoneback. Rations for a workers' cookhouse. Signed for. Never
> opened. Whose hand is that?
>
> **Narrator:** Dema reads the signature. It is very neat.
>
> **Dema:** "Received in full. K. Ketu, Provisions." That's him. That's ours. He signs everything like that.
> You could hang it on a wall.

> **If Kaya is in the party —**
> **Kaya:** So we go and find this Ketu.
>
> **Tenzo:** Not tonight.
>
> **Kaya:** Why not tonight?
>
> **Tenzo:** Because I very nearly made thirty people cook their own apology. Give me a night to stop being
> embarrassed.

### Scene T.2 — The cold shelf

**Shown:** played. **Where:** the landing outside the Six-Ladle, the next evening.

**Narrator:** At the end of the day shift, the cooks take off their aprons. All of them. They hang them on
the rail under the five ladles, and they come out and sit on the landing wall.

**Narrator:** The late shelf is empty. The steam pipe under it ticks.

**Dema:** We're not asking you for anything. I want that understood before you start being helpful.

**Tenzo:** Tram crews come off at midnight. Lamp crews. The bath attendants.

**Dema:** I know who comes. I've fed them for thirty-two nights.

**Tenzo:** I could cook it.

**Dema:** You could. And you'd be marvellous, in there by yourself, for nothing. And at midnight nobody would
know we'd stopped. That's the one thing you could do tonight that would hurt us.

**Narrator:** Tenzo looks at the empty shelf, and at the people on the wall, for a long moment.

**Tenzo:** Then I won't do it in there. And I won't do it quietly.

**Approach (the decider picks one; every one of them feeds the late crews tonight):**

- **One pot on the landing, with a sign.** The party cooks outside the door, in plain sight, from its own
  stores off the cart. _Sets `pq02_night_pot`._
- **Bread and cold broth, and the reason said to every crew.** No cooking. Each crew is told at the shelf why
  it is cold. _Sets `pq02_night_told`._
- **Ask the crews to bring what they have and share the fire.** The party keeps a fire on the landing; the
  crews put in what is in their pockets. _Sets `pq02_night_shared`._

**Whichever is picked:**

**Narrator:** Tenzo finds a slate and writes on it, in the careful hand he uses for labels: "TONIGHT'S SHELF IS
NOT THE SIX-LADLE'S. THE COOKS ARE OWED THIRTY-TWO NIGHTS." He props it where the dishes usually go.

**If `pq02_night_pot`:**

**Tenzo:** A broth. Then a rice. And if there's time, a quick pickle to go with the...

**Yuna:** One pot.

**Narrator:** She is sitting on an upturned pail, eating a pear, on strike.

**Tenzo:** A pot and one small...

**Yuna:** One pot, cook.

**Narrator:** Tenzo makes one pot. It is the hardest thing he has done since the quarry. Twice his hand goes
toward a second pan, and twice it comes back.

**If `pq02_night_told` or `pq02_night_shared`:**

**Narrator:** Tenzo stands at the shelf with his arms folded so that they will not start cooking. It does not
come naturally. Yuna, on an upturned pail, watches him do it and eats a pear.

**Then, at midnight (every approach):**

**Narrator:** The tram crew comes down the stair street first, six of them, with their caps pushed back.

**Tram conductor:** Where's Dema's greens?

**Party:** Read the slate.

**Narrator:** She reads the slate. She reads it to the others, because two of them have not got their
spectacles.

**Tram conductor:** Thirty-two nights? I thought the company paid for the shelf.

**Dema** (from the wall): It does. It pays for the dishes.

**Tram conductor:** ...And not for you.

**Narrator:** She eats what there is, standing up. So do the others. Before she goes she takes the chalk off
the slate's ledge and writes under Tenzo's line: "Tram crew, yard four. Six of us. We didn't know."

**Narrator:** By the end of the night there are four crews' names on the slate, and the chalk is a stub.

> **If Bo is in the party —**
> **Bo:** My crew went eleven weeks on a word like "goodwill". Ours was "shortly".
>
> **Dema:** Did "shortly" ever come?
>
> **Bo:** No. I stopped waiting for it and went to find it.

**Narrator:** Dema has not moved from the wall all night. Now he comes over and reads the slate from top to
bottom.

**Dema:** You wrote "owed".

**Tenzo:** Is that wrong?

**Dema:** No. He's never once let us use the word. It looks different written down.

**Dema:** What did your grandmother do? The famous one. You've brought her up twice and I've only known you
two days.

**Tenzo:** There was a strike at the docks. She kept the kitchen open the whole way through and fed both
sides. Dockers at one table, the foreman's men at the other. Nobody on our street went hungry.

**Dema:** And that fixed it?

**Narrator:** Tenzo starts to say yes. Then he stands there with the ladle in his hand.

**Tenzo:** No. She fed the foreman. And then she got up, in front of his men, still with the ladle, and told
him she wouldn't cook another meal on his terms. She said it so the whole room could hear.

**Tenzo:** I always tell it up to the soup. I've told it that way so long I'd forgotten there was more.

### Scene T.3 — The neat signature

**Shown:** played. **Where:** the Six-Ladle, the next morning. The cooks are present, in their own clothes.

**Narrator:** The contractor arrives at nine with a ledger under his arm. He is a tidy grey man in a tidy grey
coat, and he wipes his feet before he comes in.

**Ketu:** I'm told my shelf was cold, and then I'm told it wasn't, and that there's a slate. I've read the
slate. I'd like to know who's been writing "owed" on my landing.

**Tenzo:** I wrote it.

**Ketu:** And you are?

**Tenzo:** A cook. I don't work here. They didn't ask me to come.

**Narrator:** Ketu opens the ledger on the long table. Every line in it is ruled. Every figure sits exactly
in its column.

**Ketu:** Then let me show a cook some arithmetic. The company pays me by the covered dish. So much a dish,
not a coin over. And it pays me a quarter late. I am three months behind on my own money this morning.

**Ketu:** If I put late wages on that sheet, the shelf runs at a loss from the first night. So I had two
things I could do. Close it, and four crews go home hungry at midnight. Or keep it open on goodwill until the
company paid up.

**Ketu:** I kept it open. I thought that was the kind thing. I still think so.

**Narrator:** Nobody answers him at once. It is not a stupid thing to have said.

**Dema:** You kept it open on our backs, Ketu. You never once asked us. You told us it was a favour, and then
you put it on a sheet.

**Ketu:** There are forty cooks on the low landing who'd have those aprons on by noon. I've not sent for one
of them. I'd like that remembered.

**Narrator:** Tenzo puts both hands flat on the table. When he speaks, the words are short.

**Tenzo:** You may eat here. You may not threaten the people serving you.

**Ketu:** I didn't threaten...

**Tenzo:** You counted the people who'd take their jobs, out loud, in their kitchen. Don't.

**Narrator:** Ketu closes his mouth. Bash has stopped pretending to wipe the same patch of table.

> **If `reason.tenzo` is set —**
> **Narrator:** Tenzo lays the quarry receipt on top of the ruled ledger.
>
> **Tenzo:** Is that your hand?
>
> **Ketu:** It is. Stoneback cookhouse. Rice, beans, salt fish. Received in full. I provision that cookhouse.
> The carter's tally matched, so I signed.
>
> **Tenzo:** You signed from here. Nobody ever opened them. They sat in their seals for a month, with a hungry
> crew barred in on the other side of a door.
>
> **Ketu:** I signed for what the tally said had arrived.
>
> **Tenzo:** Did you go and look?
>
> **Ketu:** I'm not paid to look.
>
> **Narrator:** He hears it as he says it. He straightens the receipt so that its edge lines up with the
> ledger's, and then he leaves his hand on it.

**Yuna:** Well. He's here, we're here, and nobody's had to cook for it. What are we asking for?

**Dema:** That's for us to say. But the cook's got a slate with four crews' names on it, and those crews will
ask him what he thinks. So he might as well think it out loud.

**VOTE — What does Tenzo put his weight behind?**

- **Posted terms.** The late shelf becomes a paid shift, with its hours and its pay written on the wall beside
  the shelf where the crews can read them. Ketu signs it. A tram crew reads the sheet every month. Ketu keeps
  the contract. _Sets `pq02_posted_terms`._
- **The cooks' own shelf.** The cooks run the late service themselves, from the landing, under their own
  name. The crews deal with them directly. Ketu keeps the day kitchen and loses the shelf. _Sets
  `pq02_cooks_shelf`._
- **A quiet word.** Tenzo talks to Ketu alone. Ketu pays the back nights to those who ask, and nothing goes on
  a wall. _Sets `pq02_quiet_word`._

Footer: "The late crews are fed tonight whichever way this goes."

**If `pq02_posted_terms`:**

**Narrator:** Ketu rules a fresh sheet himself, because he cannot bear anyone else's lines. Hours. Rate. Who
is on. He signs it, very neatly, and Dema nails it up beside the shelf at a height a tired person can read.

**Ketu:** It'll run at a loss until the company pays its quarter.

**Dema:** Then it runs at your loss. It's been running at ours.

**Narrator:** The tram conductor reads it that night at midnight, moving her lips. She initials the bottom
corner. Nobody asked her to do that either.

**If `pq02_cooks_shelf`:**

**Narrator:** The cooks carry the late shelf out onto the landing, steam pipe and all. Bash paints a new
board for it. The first one says "THE SEVENTH LADLE". Yuna makes him do it again without the flourish.

**Ketu:** You'll find the buying harder than you think. I can tell you who short-weighs on the rice. If you
want it. I'd rather you didn't learn that the way I did.

**Dema:** ...Write it down. I'll read it. That's as far as I'll go this morning.

**If `pq02_quiet_word`:**

**Narrator:** Tenzo and Ketu talk in the store room with the door shut, for most of an hour. When they come
out, Ketu has agreed to pay the back nights to anyone who brings him their hours.

**Narrator:** He does. Eleven cooks bring their hours, and are paid, quietly, in the store room, one at a
time.

**Narrator:** Bash does not bring his. On the third day his apron is on the rail and he is not under it.

**Dema:** He's gone to the foundry canteen. Two others with him. They said they weren't going to ask for it
like a loan.

**Tenzo:** I got them paid.

**Dema:** You got it for the ones who'd ask. You did it kindly, and you did it without us. I'm not ungrateful.
I'm telling you what it was.

### Scene T.4 — Somebody else's cooking

**Shown:** played. **Where:** the long table at the Six-Ladle. Plays after any of the three.

**Narrator:** Tenzo is tying on an apron. Dema takes it off him from behind and hangs it back on the rail.

**Dema:** Sit.

**Tenzo:** I was only going to...

**Dema:** You're on the wall as washing-up, third shift. Until then you're a customer. Sit down.

**Narrator:** Tenzo sits. Yuna puts a bowl in front of him. It is a river-fish stew with greens, and it is
not how he would have done it.

**Narrator:** He tastes it. It wants salt. His hand goes out toward the salt dish in the middle of the table.

**Narrator:** He puts his hand down flat beside the bowl, and he eats all of it.

**Yuna:** Well?

**Tenzo:** Thank you. It's hot, and I didn't make it.

**Yuna:** That's not what I asked.

**Tenzo:** I know. It's what I've got.

**Narrator:** Yuna snorts, and takes the bowl, and for the first time puts her hand on his shoulder for a
moment on the way past.

> **If Sura is in the party —**
> **Sura:** It needed salt.
>
> **Tenzo:** Don't.
>
> **Sura:** I've got some of my fish in my pack. That'd have fixed it.
>
> **Tenzo:** Your fish would fix a harbour wall.

> **If Nilak is in the party —**
> **Narrator:** Nilak has been given a bowl too. He watches Tenzo sit all the way through a meal without
> getting up, and says nothing, and looks as though he is taking notes.

**Narrator (after `pq02_posted_terms` or `pq02_cooks_shelf`):** When the party leaves, Bash runs out after the
cart with something wrapped in a cloth.

**Bash:** For your pot. We've a rail of six again. I carved another last night. This one was spare.

_Keepsake: **a dented ladle with a "7" scratched on the handle**, hung by the cart's cooking pot (not after
`pq02_quiet_word`). Sets `pq02_done`._

### PQ-02: what it sets and where it pays off

| Sets                                                     | Meaning                                      |
| -------------------------------------------------------- | -------------------------------------------- |
| `pq02_open`                                              | Tenzo has come back after the lamps were out |
| `pq02_night_pot`, `pq02_night_told`, `pq02_night_shared` | How the walkout night was fed (flavour only) |
| `pq02_posted_terms`                                      | A paid late shift with its terms on the wall |
| `pq02_cooks_shelf`                                       | The cooks run the late shelf themselves      |
| `pq02_quiet_word`                                        | Private back pay; three cooks leave          |
| `pq02_done`                                              | The quest is closed (any of the three)       |

- **Trust:** Causeway's low landing rises with `pq02_posted_terms` and `pq02_cooks_shelf`; the late crews
  remember the slate on every route.
- **Act III, the door in the rain (Scene 9.8):** "If PQ-02 was resolved (either constructive way)" reads
  `pq02_posted_terms` or `pq02_cooks_shelf`. Dema's line there ("I've also read my wage sheet") is the sheet
  from T.1.
- **MQ-12:** a working late kitchen feeds the shelters faster. Food at the shelters never depends on this
  quest (bible).
- **MQ-12, Scene 12.2:** Dema puts Tenzo on the rota for washing-up, which T.4 begins.
- **MQ-15, Scene 15.4:** "resolved" after `pq02_posted_terms` or `pq02_cooks_shelf`; "open" after
  `pq02_quiet_word` or if never opened. See "Open, for the owner", item 9, about the wording of the resolved
  version.

---

## PQ-03 — The Door That Said Everyone (Nilak)

**Theme card:** PQ-03, The Door That Said Everyone

Themes: equality, responsibility. A sign says "all" and a register says who "all" is. Nilak left the house
over that and has told the story ever since in a way that makes the friend who stayed into a coward. Aru
stayed and got one word changed in three years. Neither of them ever looked at what went out under the
house's name. From the owner's list, this quest carries: you show up for people; you go and look, and you come
back and tell them what you found.

- [x] No nation, element or culture stereotype (the house is one institution with a rule; Aru and its other
      healers are not cruel)
- [x] Every valid party, non-benders included, has a real route through (ordinary medicine does half the
      queue)
- [x] No instant forgiveness or absolution (Aru hears the apology and says they will wait and see)
- [x] The other side's reasons are shown (Aru's father; why the house needs the company's freight space)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Aru's table in Causeway, MQ-05, with Nilak in the party. **Other people:** Aru, they/them, 26,
waterbender, of the Northern healing house's outreach room; Dr. Iset, she/her, 56, of the Open Palm Clinic;
Odi, she/her, forties, a net-loft worker. **What the party may know:** everything through MQ-04. Nothing here
goes past that.

**Planted earlier:** the crate at the quarry with the healing-house emblem and nothing in it but straps
(`reason.nilak`: "They put my house's name on this").

**Where it plays.** The bible opens this quest at the Saltstep outreach room. The owner moved Aru's table to
Causeway for MQ-05 (2026-11-15). This script plays the whole quest in Causeway, at the table and at the Open
Palm Clinic across the landing. The Saltstep room stays where it is and is where TR-02 is taught.

> **The opening, already written (Act II, Scene 5.5):**
>
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
>
> _(Aru's last line is the bible's, word for word.)_

### Scene N.1 — What "all" means this year

**Shown:** played. **Where:** Aru's folding table, on the clinic landing. _Sets `pq03_open`._

**Narrator:** Nilak has not answered. A queue is forming behind him. Aru pulls a second stool out from under
the table with one foot.

**Aru:** Sit down. You're blocking the people the sign is for.

**Narrator:** Nilak sits.

**Nilak:** How is your father?

**Aru:** Better in summer. He asks after you. He asks whether you're eating.

**Nilak:** I'm eating.

**Aru:** I'll tell him you said so. He won't believe me.

**Narrator:** Aru turns the register round on the table. It is a bound book with ruled columns: name, complaint,
treatment, and a last column headed "Residency / sponsor".

**Aru:** Here's what "all" means this year. Anyone who comes to the table gets a first treatment. No paper, no
questions. That part is true, and I made it true.

**Aru:** A second visit goes in the last column. Residency paper, or a chit from an employer who'll stand
sponsor. An empty last column means the house won't pay for my time, and I'm to send them away kindly.

**Nilak:** Three years, and the sign still says "all" over a book like that.

**Aru:** Say that again. Slowly. I'd like to hear how you meant it.

**Narrator:** Nilak hears it himself. He looks at the table.

**Aru:** Children are exempt from the last column. Since last winter. That's mine. It took eleven letters and
one very long tea with the house steward.

**Nilak:** Eleven letters for children.

**Aru:** Yes. That's what it costs from inside. You wouldn't know. You went.

**Narrator:** A man in the queue coughs, not from illness.

**Aru:** I've got fourteen waiting and one pair of hands. You were the best in our year at a burn. Are you
going to sit there being right at me, or are you going to wash?

**Nilak:** ...Where's the basin?

### Scene N.2 — The queue

**Shown:** played. **Where:** the clinic landing, between Aru's table and the Open Palm Clinic's open door.
Three people, taken in the order the decider picks. No order is wrong and nobody is harmed by waiting.

**Narrator:** The Open Palm Clinic is across the landing: a long whitewashed room with its doors wedged open
and a line of boiled cloths drying in the sun. A grey-haired woman in a doctor's apron is counting bottles on
the step and getting a number she does not like.

**Dr. Iset:** You're the healer off the vegetable cart. Good. Don't glow at anybody until you've asked them.
Half my landing thinks waterbending is something that's done to you.

**The greaser.**

**Narrator:** A tram greaser, with a burn across the back of his forearm from a hot axle box. He has wrapped
it in a rag that was not clean.

**Nilak:** I'm Nilak. I can cool that and help it close. It'll feel cold, then tight, then like nothing. May
I?

**Tram greaser:** Will it scar?

**Nilak:** It might, a little. I can ease the pain now. I can't promise what I haven't checked. Let me see it
with the rag off first.

**Narrator:** The greaser holds out his arm. It takes the time it takes to drink a cup of tea.

**Tram greaser:** That's the first time anyone's told me what they were going to do before they did it. The
company surgeon just grabs.

**The ferryman.**

**Narrator:** An old bargeman with a cough like a boat scraping a quay. Nilak listens to his chest with his
ear, and then with two fingers of water, and then he sits back.

**Nilak:** There's nothing here for me to move. It's the damp, and forty years of it. Dr. Iset?

**Dr. Iset:** Thyme and honey syrup, a spoon at night, and he's to sleep with his head up. I've been telling
him since the spring.

**Old bargeman:** I thought the glowing would be quicker.

**Nilak:** It wouldn't be. It would only look quicker. Take the syrup.

**The girl.**

**Narrator:** A girl of six or seven is waiting on the bench with her grandfather. She is not ill. He is: a
bad knee, and a long wait ahead. She has run out of things to look at.

**Narrator:** Nilak takes a stub of charcoal from his sleeve and the back of an old dressing list. He draws
for some time, with great care.

**Nilak:** There. That's a turtle seal. They live on the ice at home. That's his flipper.

**Girl:** It's a bun.

**Nilak:** It's got flippers.

**Girl:** It's a bun with flippers.

**Narrator:** Nilak turns the paper round and studies it. He turns it back.

**Nilak:** ...His name is Bun. He's very dignified. You may hold him while I look at your grandfather's knee,
but I'd like him back.

**Narrator:** He does not get him back.

**After all three:**

**Narrator:** The grandfather's knee wants a week of treatment, a little each day. Nilak has his hand on it
and his mouth open.

**Nilak:** Come back tomorrow. And the day after. I'll see to all of it, I...

**Dr. Iset:** Will you be here tomorrow?

**Narrator:** She has not looked up from her bottles.

**Nilak:** We're on the road at dawn.

**Dr. Iset:** Then don't give him your tomorrow. You haven't got one to give. Give him mine. I'm here every
day but the ninth.

**Narrator:** Nilak takes his hand off the knee. It is harder than the burn was.

**Nilak:** Dr. Iset will see you tomorrow. She'll have my notes. She's better at knees than I am.

**Dr. Iset:** I'm not. But I'm here, which is most of knees.

> **If Sura is in the party —**
> **Sura:** You were going to promise him a week you haven't got.
>
> **Nilak:** I was going to find the week.
>
> **Sura:** Where? In your sleep? You've given that away already. I've seen you.

> **If Bo is in the party —**
> **Narrator:** Bo has been sent to the bench to wait his turn for a pulled shoulder. He has not sat down.
>
> **Nilak:** Sit, Bo.
>
> **Bo:** There are people ahead of me.
>
> **Nilak:** That's what the bench is for.

### Scene N.3 — Four polite slips

**Shown:** played. **Where:** the end of the queue.

**Narrator:** The last person in the queue has been letting others go ahead of her all morning. She has a
net-maker's hands, and she holds the left one in the right as if it were something she was carrying for
someone.

**Odi:** I'm not here for the first treatment. I've had the first treatment. I've had it four times.

**Narrator:** She puts four paper slips on the table, in a row. Each has the emblem at the top. Each is in a
different hand.

**Odi:** Shoulder, down into the hand. From hauling wet net over a beam, nine years. The first treatment
works. For about six days I can close my fingers. Then it goes back.

**Nilak:** It needs a course. Six sessions, close together, and then rest.

**Odi:** That's what all four of them said. Then they looked in the book.

**Narrator:** Nilak reads the slips. Each one says, in slightly different words, that the house regrets it
cannot continue treatment without a residency paper or a sponsor's chit, and wishes her a full recovery.

**Nilak:** They're all very polite.

**Odi:** They are. I've kept them for that. I came down from the marsh two winters ago. Nobody gives you a
residency paper for a bunk in a net loft. And the loft master won't sponsor. If I'm sponsored and I'm slow,
it's on his name.

**Party:** Did you write this one, Aru?

**Narrator:** Aru picks up the third slip.

**Aru:** That's my hand. In the spring. I remember your shoulder.

**Odi:** You were the nicest of the four.

**Narrator:** Aru puts the slip down as though it were hot.

**Aru:** That isn't the comfort you'd think.

> **If Riko is in the party —**
> **Riko:** Four slips and nobody's signed them with a name. Just the emblem.
>
> **Aru:** We're told to. So it reads as the house and not as a person.
>
> **Riko:** I know why you're told to.

**Nilak:** Odi. May I write down how this went? Dates, what you were told, what the book said. With your name
or without it. You choose that. I don't.

**Odi:** With. I've been "the net-loft woman" on four slips. Put Odi.

### Scene N.4 — Forty labels

**Shown:** played. **Where:** behind the table, at Aru's supply chest. This scene plays only if
`reason.nilak` is set; otherwise go to N.5.

**Narrator:** Aru's supply chest is stencilled "medical supplies" under the emblem. Nilak stands looking at
the stencil for some time.

**Nilak:** I saw that stencil at Stoneback Quarry. On a crate. I opened it.

**Aru:** Bandage? Fever bark?

**Nilak:** Wrist straps. Buckled cuffs. Nothing else. Not one bandage.

**Narrator:** Aru goes very still.

**Aru:** That can't be ours. We don't ship to quarries. We barely ship to Saltstep.

**Nilak:** How does a crate get that mark?

**Aru:** With a label. Anybody can cut a stencil. The label is what a customs clerk reads: the emblem,
printed, and the outreach room's mark under it. The house has an exemption. Anything under that label crosses
the bay uncounted, because it's medicine and nobody wants medicine held up on a quay.

**Aru:** We can't afford a boat. So the company's contractor carries our crates on theirs. In exchange they
asked for labels. For bandage of their own, they said. For their clinic at Emberwatch.

**Narrator:** Nobody says anything for a moment.

**Nilak:** How many labels?

**Aru:** Forty. In the spring. I signed them blank.

**Narrator:** Aru sits down on the supply chest.

**Aru:** I didn't look. They said bandage, and there is a clinic at Emberwatch, and it does have bandage in
it. I've seen it. So I signed forty and I didn't look where the other thirty-nine went.

**Nilak:** There was a label on that crate, under the dust. I saw the emblem and I didn't read the mark. I
walked out of that house three years ago, and I never once asked what the room I'd left turned into. I was too
busy telling people why I'd gone.

**Narrator:** Dr. Iset has come over with a bottle in each hand. She has heard all of it.

**Dr. Iset:** Well. That's two of you who didn't look, and one of me who's been wondering since spring why a
crate of "medical supplies" clinked at the ferry. I didn't ask either. I had forty patients.

**Dr. Iset:** Sit there feeling dreadful for the length of one cup of tea. Then get up, because the woman
with the shoulder is still waiting.

### Scene N.5 — VOTE: a name on it

**Shown:** played. **Where:** the clinic step, with Aru, Dr. Iset and Odi.

**Aru:** I can take a petition to the house. Open admission, no last column. I've wanted to for a year. On my
own they'll pat my head. With an outside name on it, counting who we turn away, they'd have to answer.

**Dr. Iset:** Or you stop asking the house. I've got a room, a boiler and no waterbender. Anyone trained who
wants to treat here can, and there's no last column in my book. But somebody has to say out loud why it's
needed, and the house won't thank them.

**Odi:** Or you do my shoulder from the back of your cart while you're in town, and it's six days again. I'm
not sneering at six days. I've taken them four times.

**VOTE — What does Nilak put his name to?**

- **Publish it, and build the partnership.** Odi's slips and the register rule go up on the clinic door and
  the dispatch board (and, if N.4 played, the forty labels). Follow-up care moves to the Open Palm, with any
  trained healer who will come. The house is embarrassed in public. _Sets `pq03_published`._
- **Back Aru's petition, with Dr. Iset keeping count.** Nilak signs Aru's open-admission petition as a
  house-trained healer. Dr. Iset keeps an outside tally of everyone the table turns away, and posts it monthly
  until the column goes. Slower. The house keeps its good name while it changes. _Sets `pq03_monitored`._
- **Take supplies and run a cart clinic.** Aru gives what the chest can spare. Nilak treats from the tailgate
  for as long as the cart is in Causeway. It helps the people who find it, this week. _Sets `pq03_tent`._

Footer: "Odi's shoulder is treated today whichever way this goes."

**If `pq03_published`:**

**Narrator:** Nilak writes it out fair: four dates, four slips, one column. Odi's name is at the top because
she said to put it there. Dr. Iset nails it to the clinic door with a dressing pin.

**Aru:** The steward will write to me. It won't be a short letter.

**Nilak:** I know. I'm sorry that it lands on you and not on me.

**Aru:** It always did. You could at least watch it land this time.

**Narrator:** Aru reads the sheet on the door, all the way down. Then they take the chalk and write, under
Nilak's name, a second one.

**Aru:** I'm not agreeing with you. I think you've burned a year of my work to do in a morning what I'd have
done by next spring. I'm signing because it's true. Those are different.

> **If N.4 played —** **Narrator:** A third sheet goes up beside it: "Forty supply labels, issued blank,
> spring. One found at Stoneback Quarry on a crate of restraints. Thirty-nine not accounted for. Signed by the
> one who issued them: Aru."

**If `pq03_monitored`:**

**Narrator:** Aru's petition is two pages, and has been ready in the bottom of the supply chest for a year.
Nilak reads it. He changes nothing. He signs under Aru, smaller.

**Dr. Iset:** I'll keep the count. One mark for everyone your table sends away, on my door, where your
steward's visitors can't miss it. I'm not doing it to shame you. I'm doing it because nobody's ever had the
number.

**Aru:** It'll take a year.

**Nilak:** You've already done three.

**Aru:** I'd have liked you to say that at any point in them.

**If `pq03_tent`:**

**Narrator:** Aru fills a basket from the chest: clean cloth, fever bark, a jar of the cold salve. Nilak
treats from the cart's tailgate until dark, and again at dawn, and people do find it.

**Aru:** And when the cart goes?

**Nilak:** Then it stops.

**Aru:** Yes. I'm not saying don't. I'm saying you'll be the fifth polite slip, and a nicer one than mine.

**Narrator:** Nilak has no answer to that. He does not pretend he has.

### Scene N.6 — Handing over

**Shown:** played. **Where:** the Open Palm Clinic, late in the day. Plays after any of the three.

**Narrator:** Odi sits on the clinic bench with her sleeve rolled. Nilak has given the first session. Her
fingers close, and open, and close.

**Narrator:** There is a young nurse beside her with a basin, and Aru on the other side, and a sheet of paper
on the bench between them in Nilak's small handwriting.

**Nilak:** Six sessions. Tomorrow is the second. Cold cloth for a count of two hundred first, every time.
That part needs no bending, and it matters as much as the rest.

**Nurse:** Two hundred. Then?

**Nilak:** Then Aru, or whoever is at the table, works from the shoulder down. Not from the hand up. I've
drawn it.

**Narrator:** The nurse looks at the drawing.

**Nurse:** Is that her arm?

**Nilak:** It's an arm.

**Aru:** It's a river with a mitten on. I can read it. I sat next to him for four years.

**Narrator (after `pq03_tent`):** In this version the paper goes to Odi herself, with the cold-cloth count
underlined twice, because there is nobody at the table who is allowed to do the rest.

**Narrator:** Nilak stands there with nothing in his hands. Odi is being looked after. It is not by him.

**Nilak:** I should stay for the...

**Dr. Iset:** You should go and sit on my step. I'll call you if she falls off the bench. She isn't going to.

**Narrator:** Nilak goes out and sits on the clinic step in the last of the sun. He means to stay a minute.

**Narrator:** A grey-haired man comes along the landing with a covered tin. He looks at the doctor through
the door, and at the stranger asleep on the step, and puts the tin down beside the stranger instead.

**Dr. Iset:** That's my husband. The Friday one. He's decided you need it more. He isn't often wrong.

**Later, at the table (any of the three):**

**Narrator:** Aru is folding the table. Nilak takes the other end without being asked.

**Nilak:** I've told it for three years as "I left because I couldn't bear it." Every time I told it, you
were in the story as the one who could bear it.

**Nilak:** That wasn't fair and it wasn't true, and I said it to a great many people. I'm sorry. I'm going to
stop telling it that way.

**Aru:** Good. Start now. I'll hear how the new one goes, a few times, before I say anything back.

**Narrator:** They carry the table inside between them. It is not a long way.

**Aru:** I still teach, you know. Here at the table this week, and mornings at the Saltstep room once I'm
back. You were always quick. You'd say "may I?" with the water already on your hands. I teach the question
that comes before that one. Come and be taught, or send whoever you travel with. That's not about any of this.

_(Aru's teaching is TR-02. It stays open after every outcome, as the bible requires.)_

_Keepsake: **Bun, the turtle seal**, a second drawing, which Nilak made that night to replace the one he did
not get back. It is pinned inside the cart's canopy. It looks no more like a turtle seal than the first. Sets
`pq03_done`._

### PQ-03: what it sets and where it pays off

| Sets             | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `pq03_open`      | Nilak sat down at Aru's table                                      |
| `pq03_published` | The rule (and the labels) made public; follow-up moves to the Palm |
| `pq03_monitored` | Aru's petition, co-signed, with Dr. Iset's outside tally           |
| `pq03_tent`      | A cart clinic for as long as the cart stays                        |
| `pq03_done`      | The quest is closed (any of the three)                             |

- **Trust:** Causeway's low landing rises with `pq03_published` (most) and `pq03_monitored`.
- **TR-02:** not gated by any of this.
- **MQ-12, Scene 12.2:** Dr. Iset schedules Nilak to rest. N.6 is the first time he does it.
- **MQ-15, Scene 15.4:** "resolved" after `pq03_published` or `pq03_monitored`; "open" after `pq03_tent` or if
  never opened.

---

## PQ-04 — The River Does Not Keep Still (Sura)

**Theme card:** PQ-04, The River Does Not Keep Still

Themes: responsibility, balance. Sura was right once, on bad ice, and six people got home. So the second time
nobody argued, and her friend walked out onto ice she had just said was singing. Vessa does not want an
apology. She wants forty sacks moved, and she wants Sura to go and look at a channel twice in one day and come
back and say what it did. From the owner's list, this quest carries: you show up for people; you go and look,
and you come back and tell them what you found.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (poles, boats and a sounding stick do
      most of it)
- [x] No instant forgiveness or absolution (Vessa offers work tomorrow and nothing else)
- [x] The other side's reasons are shown (Vessa's "no" is a working judgement, not a grudge)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Reedglass, in Scene 7.2 of MQ-07, with Sura in the party. It can be played at any point after
that opening, before or after the audience at the mirror pool; two lines are written twice for that reason.
**Other people:** Vessa, she/her, 25, boat-mender, Sura's friend from home. **What the party may know:** that
the water here loops and repeats (7.1, 7.2). Before `keeper_met`, nobody in this quest can say why.

**Vessa's leg.** She works around a stiff left leg and it is written plainly. Nobody heals it, nobody
remarks on it as a lesson, and it is not why she knows the channel. She knows the channel because she has
mended boats on it for two years.

**Planted earlier:** Sura is the one who has been counting what the water says twice, since the culvert in
Act I (`cutting_culvert`; Scenes 2.4, 3.3, 5.6).

> **The opening, already written (Act III, Scene 7.2):**
>
> **Sura:** Vessa.
>
> **Vessa:** I heard you were on a vegetable cart. I didn't believe it. I've got forty sacks of lime to get to
> the far bank and one barge that keeps going round in a circle.
>
> **Sura:** I can lay ice straight across. An hour.
>
> **Vessa:** No.
>
> **Narrator:** She does not look up from the tar brush.
>
> **Vessa:** Not over ice. Not yours. Ask me what the water does here after warm rain, and then we can talk.

### Scene S.1 — The fish that towed the boat

**Shown:** found. **Where:** the pilots' landing, beside Vessa's upturned hull. _Sets `pq04_open`._

**Narrator:** Sura has not asked. She has gone twenty paces down the landing instead, to where three marsh
pilots are eating their noon rice on an overturned punt, and sat down with them as if she had been invited.

**Sura:** You call this cold? At home we fish through the ice. I had a fish on the line once so big it pulled
the boat.

**Narrator:** A pole-boy of about ten stops chewing.

**Pole-boy:** What boat? You said you were on ice.

**Sura:** The boat was on the ice. We drag it out to the hole.

**Pole-boy:** Then how did a fish pull it? Fish is under the ice. Boat's on top.

**Sura:** ...It pulled it along the ice. From underneath. By the line.

**Pole-boy:** How far?

**Sura:** To the next bay.

**Old pilot:** How wide's the hole, then? For a fish that size to come up through.

**Sura:** We had to make it wider.

**Old pilot:** While it was towing you.

**Sura:** We were very quick.

**Narrator:** Vessa has not turned round. She draws the tar brush down a seam, slowly.

**Vessa:** It was a seal.

**Narrator:** The pilots look at her. So does Sura.

**Vessa:** It was a seal. It was my boat. And it towed us backwards.

**Narrator:** Sura's whole face opens up.

**Sura:** Backwards! I'd forgotten it was backwards! That's much better. Why have I been telling it forwards?

**Vessa:** Because you were in the front.

**Narrator:** The pole-boy laughs so hard he has to put his bowl down. For a moment it is easy on the landing.
Sura comes back along it, grinning, and stops beside the hull.

**Sura:** You could have let me have the fish.

**Vessa:** I let you have the fish for years. I'm out of practice.

> **If Jinu is in the party —**
> **Jinu:** Wait. Is this the one you told me? The one that wouldn't fit in the boat?
>
> **Sura:** That was a different one.
>
> **Vessa:** There's only ever been the seal.

**Narrator:** The grin goes, slowly. Sura looks out at the Slow Channel. It is flat and brown and not very
wide.

**Sura:** I've crossed worse than that on worse ice.

**Vessa:** I know. I was on it.

**Narrator:** The tar brush stops. A frog starts up somewhere in the reeds, and stops again.

**Party:** What happened?

**Narrator:** Sura waits to see whether Vessa will say it. Vessa goes on waiting too. So Sura does.

**Sura:** Three winters ago. Coming home ahead of weather with a full sledge. There was a long way round the
bay and a short way over it. I picked the short way.

**Vessa:** The ice was singing.

**Sura:** Ice always sings.

**Vessa:** That's what you said then. Those words. I told you it was singing, and you said "it always
sings", and you were already walking.

**Sura:** It went under the sledge. Not under us. The runner came round and caught her leg against the edge.

**Vessa:** She had me out and on a plate of new ice before I'd finished shouting. I'll say that. Nobody's
faster. It set crooked anyway.

**Narrator:** Vessa shifts her weight onto the other leg, and dips the brush.

**Vessa:** The winter before that, she took six of us over the strait when the old hands said wait. She was
right. We all got home. So the second time, nobody argued. I didn't argue. I said it was singing and then I
walked on it, because it was her.

**Narrator:** Sura takes a breath to speak.

**Vessa:** No. I've had that one. You said it very well at the time, with soup. I've got forty sacks of lime
on the wrong bank. Are you going to ask me?

**Narrator:** It costs Sura something. It shows.

**Sura:** Fine. What does the water do here after warm rain?

**Vessa:** It moves. A bar comes up where there was a boat's depth yesterday, and the deep goes somewhere
else. It doesn't tell anybody. You find it with a pole or you find it with your hull.

**Vessa:** And since the spring, it goes round. The barge leaves the three stumps and comes back to the three
stumps. That part's new. That part I don't know.

**Narrator:** She pulls a long ash pole out from under the hull. It is notched every hand's width, and the
notches are worn smooth.

**Vessa:** There are three stakes across the channel. Sound it at each. Now, and again after the rain. There'll
be rain by noon; you can smell it. Then come back and tell me what it did.

**Sura:** I can feel a channel bottom from the bank. I don't need a stick.

**Vessa:** You'll feel what you expect to. The stick doesn't expect anything. No bending. Go and look.

> **If Lin Mei is in the party —**
> **Lin Mei:** May I come? I'd like to see how she marks the pole. Hands are not a standard measure.
>
> **Vessa:** They're my hands. They've been the same size for years.
>
> **Lin Mei:** ...That is, in fact, a standard.

> **If Nilak is in the party —**
> **Nilak:** Vessa. I'm a healer. May I ask about the leg, or would you rather I didn't?
>
> **Vessa:** You can ask. It's healed. This is what healed looks like.
>
> **Nilak:** Understood. Thank you for telling me.

### Scene S.2 — Nine, six, eleven

**Shown:** played, in two visits. **Where:** the Slow Channel, at three stakes, from a flat punt.

**Morning.**

**Narrator:** The Driver poles you out. Sura stands in the bow with Vessa's pole. She holds it the way she
would hold a fishing spear, which is wrong, and after the first stake she changes her grip without being
told.

**Sura:** First stake! Nine hands!

**Narrator:** Her voice carries flat across the water. A breath later, from under the punt, the channel says
it back in her own voice, smaller: "...nine."

**Before `keeper_met`:**

> **Sura:** There. It said it back. Did nobody else... Of course you did. Nobody ever says.
>
> **Driver (Bo-shan):** I heard it. I'm not saying I heard it. I'm poling.
>
> **Loss branch.** **Driver (Dorin):** I heard that. I have a page for those now. I have headed it "water".

**After `keeper_met`:**

> **Sura:** There you are. Good morning. Yes. Nine. Keep it if you like.

**Sura:** Middle stake! Six! Far stake! Eleven!

**Narrator:** She cuts a notch in the punt's rail for each one with her fishing knife. Nine, six, eleven.

**Narrator:** On the way back she decides to save time by stepping from the punt straight onto the bank. The
bank at that spot is a pale, smooth grey.

**Narrator:** She goes in to the knee. When she pulls, the leg comes out. The boot does not.

**Sura:** ...It was dry! It looked dry!

**Narrator:** From the landing, without raising her voice:

**Vessa:** That's the pale part. You stand on the dark part. The pale part's still setting.

**Narrator:** Sura lies down on her front on the punt and fishes for her boot with both arms. She gets it.
She pours it out.

**Sura:** Fine. I was wrong about the bank. I remain right about your socks.

**Vessa:** I'm not wearing any.

**Sura:** That is what I am right about! Bare feet in a boat! Two pairs of wool, always, my grandmother...

**Vessa:** Wool rots here in a week. Look at yours.

**Narrator:** Sura looks at hers. She says nothing further about socks.

> **If Tenzo is in the party —**
> **Tenzo:** I'll dry that boot by the fire. Slowly. If you bake it, it cracks.
>
> **Sura:** I know how to dry a boot.
>
> **Tenzo:** You know how to salt a fish, too, and look what happens there.
>
> **Vessa:** He's right about your salt.
>
> **Sura:** You've known him an hour!

**Noon.**

**Narrator:** The rain comes at noon, as Vessa said. It is warm, and heavy, and over in the time it takes to
eat. The channel goes from brown to the colour of milky tea.

**After the rain.**

**Narrator:** You pole out again. Nothing looks different. The three stakes stand where they stood.

**Narrator:** Sura puts the pole down at the first stake. It stops almost at once. She pulls it up and looks
at the wet line on it, and puts it down again in the same place.

**Sura:** Three.

**Narrator:** She says it quietly. Then she remembers the morning, and calls it.

**Sura:** First stake. Three hands!

**Narrator:** A breath later, from under the punt, the channel answers in her own voice. It does not say
three.

**Narrator:** "...nine."

**Before `keeper_met`:**

> **Sura:** No. It's three. I've got the pole in it. It was nine this morning and it's three now.
>
> **Narrator:** The water says nothing more. Sura stares down at it.
>
> **Sura:** It's wrong. It was right this morning and now it's wrong, and it sounds exactly as sure.

**After `keeper_met`:**

> **Sura:** No. That was this morning. Look, I've got the pole in it. It's three now.
>
> **Narrator:** The water says nothing more.
>
> **Sura:** You'd rather it was still nine. I know. So would I. I had a plan for nine.

**Narrator:** The middle stake is six, as it was. The far stake takes the whole pole and wants more: fourteen,
and still soft at the bottom.

**Narrator:** Sura cuts three new notches under the first three. Nine, six, eleven. Three, six, fourteen. She
looks at them all the way back to the landing.

**Narrator:** Vessa is fitting a plank. She does not stop.

**Vessa:** Well?

**Sura:** Nine, six, eleven this morning. Three, six, fourteen now.

**Vessa:** Go on.

**Sura:** The near side's come up six hands in half a day. There's a bar there that wasn't. The far side's
gone down three and it's scouring. That's where the deep went.

**Sura:** At noon I'd have laid ice bank to bank and called it an hour's work. One end sat on a bar that's
still growing. The other end over a hole that's still opening. Forty sacks and four people pulling.

**Narrator:** She puts the pole down across the hull, carefully, as if it might go off.

**Sura:** Maybe I don't put ice on rivers. Maybe that's the answer. Sea ice I know. This...

**Vessa:** No. Don't you do that. That's the same thing turned inside out.

**Vessa:** I don't need you to be frightened of rivers. I need you to believe they exist when you aren't
looking at them.

_(The two sentences above are the bible's, word for word.)_

**Narrator:** Sura picks the pole up again. She looks at the six notches on the rail of the punt.

**Sura:** The middle one didn't change. Six and six. Why didn't the middle change?

**Narrator:** Vessa stops work. She turns all the way round, for the first time today.

**Vessa:** There. That's a question.

**Vessa:** Old ferry piling, under the mud. Somebody drove a row of oak across there a hundred years back. The
channel can't shift it. Everything either side moves. The stakes are what's left showing.

**Sura:** So the stakes hold. And what's between them doesn't.

**Vessa:** Now you're telling me things. Keep going. I want to hear where that gets to.

**Narrator:** She is interrupted. Out on the channel somebody is shouting, and something is making a noise
like four very large, very offended hinges.

### Scene S.3 — Give them a minute

**Shown:** played, into an encounter. **Encounter:** the new bar in the Slow Channel (a rescue; no enemies).

**Narrator:** A carter's barge is aground on the new bar, tipped over on one side. On its deck, four ostrich
horses in harness are standing as far up the slope as they can get, screeching. The far side of the barge is
hanging out over the scour.

**Carter:** It was a boat's depth this morning! I came through here this morning!

**Vessa:** It's not a boat's depth now. Sura. Punt, with me. You do what I say out there and nothing I don't.
Can you?

**Sura:** Yes.

**Vessa:** I want a ramp. Barge rail to my punt. Not a bridge to the bank, a ramp, as long as a door. And
don't you hold the water still under us. Let it run. If you stop it here it'll go round and take the bar.

**Sura:** A ramp. Let it run.

**Vessa:** And it gets a hole in it. At the low end. So if the bar goes, the ramp breaks there and not under
a bird.

**Narrator:** Sura looks at her for one breath.

**Sura:** A hole. At the low end.

**How it plays.** Four ostrich horses must reach the bank. The party poles two punts; Sura (and any other
waterbender) can lay short ice ramps. Each round the bar shifts one tile and the scour widens. Ice laid from
stake to stake holds. Ice laid over open channel breaks at the end of the next round, at its hole if it has
one (nothing on it is lost), or all at once if it has none (whatever is on it goes in the water and must be
fished out, which costs a round).

**The ostrich horses.** A bird will not step onto a ramp the round it is laid. It stands and looks at it.
Pulling the halter makes it sit down. Left alone for one round, it walks across by itself.

**Win:** all four birds on the bank within eight rounds. **Lose:** the barge rolls (round eight) with a bird
still aboard.

**Encounter barks:**

- **Vessa:** "Stake to stake! If it isn't touching a stake, I don't trust it and neither do you!"
- **Carter:** "Don't pull him! He sits when he's pulled! He'll sit till winter!"
- **Sura** (laying a ramp with a hole): "There's your hole. It looks terrible. I hate it."
- **Sura** (when a bird balks): "Go on. Go ON. It's ice, it's good ice, I made it. ...Why won't it go?"
- **Driver (Bo-shan):** "Give him a minute. They all want to read the ramp. Tavi told me that. It's the one
  thing I know."
- **Loss branch, Driver (Dorin):** "The ferry pilot's advice was to wait. I wrote it down. It says 'wait'."
- **Sura** (when a bird walks across by itself): "...Oh. It just wanted to be asked."
- **Vessa** (when a ramp breaks at its hole): "There. That's what the hole's for. Lay another."

> **If the Driver has brought the cart to the bank —** _Narrator:_ Parcel stands on the dark part of the bank
> and looks at the barge, perfectly calm. The first bird off the ramp walks straight to him. The others come
> after it faster.

> **If Nima is in the party —**
> **Nima:** I'll ride the ramp across first. So they can see something's done it and lived.
>
> **Vessa:** That's a daft idea.
>
> **Narrator:** The nearest ostrich horse watches Nima slide the length of the ramp on his front. It follows
> him at once.
>
> **Vessa:** ...Do that again for the next one.

**After a win:**

**Narrator:** The fourth bird steps onto the dark part of the bank and shakes itself. Behind it, the barge
groans, slides off the bar and settles, upright, in the scour. Empty, it floats.

**Carter:** They've never walked on ice in their lives.

**Sura:** They've never been left alone on it. I was pulling.

**Narrator:** One of the ostrich horses has taken a liking to Sura's braid. It follows her up the landing
with the end of it in its beak. She lets it.

**CARRY ON (the rescue is lost):**

**Narrator:** The barge rolls. The last ostrich horse goes into the channel with it, harness and all, and
comes up swimming hard for the wrong bank.

**Narrator:** Vessa has the punt across it before it has gone a length. Sura gets a plate of ice under its
chest, and between them they walk it back, blowing and furious and whole.

**Narrator:** The barge is on its side on the bar with its cargo of wool bales drifting off down the channel,
one after another, like a line of sheep.

**Carter:** That's my season. That's my whole season going round the bend.

**Vessa:** It'll come back. Everything here comes back to the three stumps by evening. Bring a boathook and
a lot of patience.

_Sets `lost_slow_channel_rescue`. Every bird is safe. The encounter pays its XP either way. The carter spends
three days hooking wet bales out at the stumps, and says so in S.5._

### Scene S.4 — VOTE: forty sacks

**Shown:** played. **Where:** the landing, by the forty sacks.

**Narrator:** The lime is stacked on the near bank in forty paper sacks, under a tarred cloth. It is for the
pile-heads of the school raft, and it has to stay dry to be any use.

**Vessa:** Two ways I'd do it. Flat boats along the reed edge, the long way, where it's shallow and I can see
the bottom. Ten sacks a trip. Four trips. It's dark before we're done and nobody gets wet.

**Vessa:** Or what you were starting to say before the birds. Go on. Finish it.

**Sura:** Ice. But not a bridge. Three pans: bank to first stake, stake to stake, stake to far bank. Every
pan sits on oak at both ends. A gap at each stake, a hand wide, so that each one's on its own.

**Sura:** And one sledge on a pan at a time. And before a sack goes on it, we drag a sledge of stones over
it, and you walk behind with the pole and knock. Where you say cut, I cut.

**Vessa:** That's slower than your hour.

**Sura:** It's three hours. I've done the sum. I didn't like it.

**Narrator:** Out on the channel the light is going gold. Upstream, over the heights, there is another bank
of cloud.

**Sura:** Or I lay it straight, right now, bank to bank, and we're across before that cloud gets here. I
could. I know I could. Probably.

**Vessa:** I'm not going to tell you which. It's my lime. It's your ice. I'll tell you which ones I'll walk
on.

**VOTE — How do the forty sacks cross?**

- **Vessa's boats, along the reed edge.** Slow, dry, and Sura learns to pole. _Sets `pq04_boat_plan`._
- **Three pans and two gaps, tested first, built together.** Sura's ice, Vessa's pole, one sledge at a time.
  _Sets `pq04_joint_ice`._
- **One straight bridge, now, before the cloud.** Sura's first plan. Vessa will not walk on it. _Sets
  `pq04_own_bridge`._

Footer: "Nobody is hurt on any of these. On one of them, some of the lime is lost."

**If `pq04_boat_plan`:**

**Narrator:** Four trips. Sura poles the second boat. She is bad at it for the first trip and passable by the
third. On the fourth, in the dark, she finds the shallow by the eel traps without being told where it is.

**Vessa:** You read that off the reeds.

**Sura:** They lean where it's shallow. I've been watching them lean for three trips. I didn't know that I
was.

**Narrator:** The last sack goes up the far bank by lantern light. Sura's hands are blistered in a new
place. She looks at them with some interest.

**Sura:** I didn't lay a finger of ice all day.

**Vessa:** No. And you'd have been right to, tomorrow, if we'd tested it. I want you to know I know that. We
had the day for the boats, so I took the boats.

**If `pq04_joint_ice`:**

**Narrator:** Sura lays the first pan from the bank to the near stake. It is clear and green and perfectly
flat. It is the best ice she has made since she left home, and she stands looking at it.

**Narrator:** Vessa walks out on it with the pole. She has not stood on ice since that winter. She puts the
stiff leg down first, and waits, and then the other.

**Narrator:** She knocks her way along it. Knock. Knock. Near the stake she stops, and knocks twice more.

**Vessa:** Here. It's ringing different. Open it here.

**Sura:** That's the middle of the pan. It'll spoil the...

**Narrator:** Vessa waits.

**Narrator:** Sura kneels down and cuts a hole in her own ice, a hand wide, right across. The water comes up
in it and runs. The pan either side of it holds.

**Sura:** There. It's ugly.

**Vessa:** It's a boat with a bilge. Nobody ever called a bilge pretty. Stones first.

**Narrator:** The sledge of stones goes over. Then the sacks, one sledge to a pan, with Vessa calling each one
on by name of the puller. It takes three hours.

**Narrator:** On the thirty-first sack, the far pan drops. The scour has opened under it. It breaks at the
gap by the stake, tips, and slides away downstream in one piece, with nothing on it.

**Narrator:** The sledge that was next is standing on the middle pan, dry, with its puller holding the rope
and breathing hard.

**Sura:** It broke.

**Vessa:** It broke where we told it to. Lay another. Shorter. The stake's still there.

**Narrator:** Sura lays another, shorter. The last nine sacks go over it by the last of the light.

**If `pq04_own_bridge`:**

**Narrator:** Sura lays it in one sweep, bank to bank, wide enough for two sledges. It takes her less than a
quarter of an hour, and it is beautiful: a clear green road across brown water.

**Narrator:** Vessa stays in the punt, alongside, with the boathook across her knees.

**Narrator:** Twenty-eight sacks cross. Sura is on the bridge herself, walking beside the lead sledge. She
has stopped looking at the cloud.

**Narrator:** The rain that fell on the heights an hour ago arrives all at once, warm, under the ice. The
bridge lifts in the middle, a hand's width. Then it cracks from the far bank to the near stake with a noise
like a plank breaking.

**Vessa:** Off! Everybody off! Leave the sledge!

**Narrator:** They leave the sledge. Three pullers and Sura run for the far bank and reach it. The middle of
the bridge turns over. Twelve sacks of lime go into the Slow Channel and sink onto the bar.

**Narrator:** Vessa hooks the sledge itself before it drifts. Nobody is in the water. For a moment nobody
says anything either.

**Sura:** It lifted. From underneath. I couldn't see it from on top.

**Vessa:** No. You can't. That's why I asked you what the water does here after warm rain.

**Narrator:** In the morning the twelve sacks are still on the bar, in a foot of water. The paper has gone.
What is left of each one is a pale grey boulder, with the maker's stamp set into it backwards.

**Vessa:** Lime sets when it's wet. I've got twelve rocks that say "Best Quality" on them. They'll do for the
pile-heads if we break them up. It's three more days' work, with hammers.

**Sura:** I'll break them.

**Vessa:** Yes. You will.

### Scene S.5 — The one she hadn't had

**Shown:** played. **Where:** the landing, at the end of whichever day it was.

**Narrator:** Vessa is washing tar off her hands in a bucket. Sura sits down on the upturned hull beside her,
with the pole across her knees.

**Sura:** You said it was singing.

**Vessa:** I did.

**Sura:** I heard you. That's what I want to say. I've always told it as if I didn't hear, or the wind took
it, or ice always sings. I heard you say it. I knew what it meant. I went anyway, because I'd been right the
winter before.

**Narrator:** Vessa dries her hands on her apron, one finger at a time.

**Vessa:** ...Yes. That's the one I hadn't had.

**Narrator:** She does not say anything else about it. After a while she nods at the pole.

**After `pq04_joint_ice` or `pq04_boat_plan`:**

**Vessa:** That's mine. I want it back. But not yet. Take it up the valleys with you, and sound whatever you
cross, and bring it back and tell me what was under it. Lent. Not given.

**Vessa:** There's a hull wants turning tomorrow at first light. Two-person job. I'm not asking as a friend.
I'm asking because you're strong and you listen now. The friend part I'll think about.

**Sura:** First light. Do I bring my own gloves?

**Vessa:** Bring your own breakfast. I know what you eat. I'm not sharing a boat with that fish.

**After `pq04_own_bridge`:**

**Vessa:** I'll have the pole back.

**Narrator:** Sura hands it over. Vessa slides it under the hull, where it lives.

**Vessa:** Three days of hammers. I'll be here. I'm not sending you off. I'm telling you I'm not lending you
my pole until I've watched you use your eyes for three days.

**Sura:** That's fair.

**Vessa:** I know it's fair. I wasn't asking.

> **If `lost_slow_channel_rescue` —**
> **Narrator:** Down at the three stumps, the carter is sitting in a punt with a boathook, waiting. A wet wool
> bale comes round the bend, as Vessa said it would. He hooks it. He looks up the channel for the next.

> **If the party has met Auntie Silt (Scene 7.4) —** (found on the mudbank, afterwards)
> **Auntie Silt:** That one. With the braid. She stood on my pale part.
>
> **Sura:** I've said sorry to the bank.
>
> **Auntie Silt:** Did you? I didn't hear it. Say it to the dark part. The pale part's too young to follow.

_Keepsake: **Vessa's sounding pole, on loan**, lashed along the cart's side rail (after `pq04_joint_ice` or
`pq04_boat_plan`). After `pq04_own_bridge`: **a lump of set lime with "Best Quality" on it backwards**, which
Sura keeps in her pack. Sets `pq04_done`._

### PQ-04: what it sets and where it pays off

| Sets                       | Meaning                                                   |
| -------------------------- | --------------------------------------------------------- |
| `pq04_open`                | Sura asked what the water does after warm rain            |
| `lost_slow_channel_rescue` | The barge rolled; the birds are safe; the wool went round |
| `pq04_boat_plan`           | The sacks crossed by Vessa's boats                        |
| `pq04_joint_ice`           | Three pans and two gaps, built and tested together        |
| `pq04_own_bridge`          | Sura's straight bridge; twelve sacks lost and recovered   |
| `pq04_done`                | The quest is closed (any of the three)                    |

- **Trust:** Reedglass rises with `pq04_joint_ice` and `pq04_boat_plan`, and with winning S.3.
- **The echo.** S.2 is this quest's own: the channel gives the morning's number back in the afternoon. It is
  not explained before `keeper_met`. It is not added to the act's echo table, which lists main missions only.
- **MQ-12, Scene 12.2:** Sura and Tavi at the sand tray ("I leave a gap." "How wide?"). It plays for every
  Sura. After `pq04_joint_ice` she has already cut one.
- **MQ-13:** Sura's "And a gap. Tavi! How wide?" and "I'm not walling this" play for every Sura, as written.
  The bible says she "can suggest a barrier with an intentional release" after this quest; see "Open, for the
  owner", item 10.
- **Banter:** the bible's Sura and Lin Mei exchange "after PQ-04" ("Tell me what I'm missing." / "The southern
  channel." / "Good. We start there.") is unlocked by `pq04_joint_ice` or `pq04_boat_plan`.
- **MQ-15, Scene 15.4:** "resolved" (asking Vessa what the channel is doing) after `pq04_joint_ice` or
  `pq04_boat_plan`; "open" (the route sketch with a line through it) after `pq04_own_bridge` or if never
  opened.

---

## PQ-05 — Somebody Else's Hands (Bo)

**Theme card:** PQ-05, Somebody Else's Hands

Themes: equality, responsibility. Bo's crew love him and walked three towns to find him. He has taken every
bad corner of every job for six years so that none of them would have to, and it has never occurred to him
that this was a thing he was taking. From the owner's list, this quest carries: good people can cause harm;
you can admire someone and still tell them to stop.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (the lift is jacks, wedges and a
      count)
- [x] No instant forgiveness or absolution (the crew review him, in writing, and one of the three notes
      stings)
- [x] The other side's reasons are shown (Bo's fear that a crew scatters; the crew's affection, which is real)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Copper Orchard, in Scene 6.4 of MQ-06, with Bo in the party. **Other people:** Renn, he/him, 21,
earthbender, Bo's former apprentice; Osha, she/her, thirties, the crew's rigger; Wick, he/him, sixties, the
oldest hand; Feng, he/him, twenties; two more in mustard sleeves. **What the party may know:** everything
through MQ-05.

**Planted earlier:** the labour roster in the Driller's cab with Renn's name first on next month's shift
(`reason.bo`: "He doesn't know yet what he'd be coming to").

> **The opening, already written (Act III, Scene 6.4):**
>
> **Narrator:** Under the viaduct, six people in familiar mustard sleeves are raising a jack under a cracked
> beam. A young man is calling the lift, steady, by numbers.
>
> **Bo:** Renn.
>
> **Narrator:** Bo is across the cut and has both hands on the jack handle before he has finished saying it.
>
> **Renn:** I had it.
>
> **Bo:** I know. I was only...
>
> **Renn:** You were only. Six years of only. We walked here to work with you. Let go of the handle.

### Scene B.1 — Sizes

**Shown:** played. **Where:** under the Orchard viaduct. _Sets `pq05_open`._

**Narrator:** Bo lets go of the handle. It takes him a moment. Then the crew are all round him at once.

**Osha:** Foreman! Look at you. You've got thin.

**Wick:** He's not got thin. He's got a cart. Did you eat? Have you been eating?

**Feng:** We heard you'd gone to fight a drilling machine. Wick said you'd have tried to lift it.

**Bo:** I didn't try to lift it.

**Narrator:** He considers this.

**Bo:** I looked at where you'd put the jacks.

**Narrator:** They laugh, all six. Bo has his pack off and open. He takes out a bundle wrapped in oilcloth and
begins handing things round.

**Narrator:** Work gloves. Six pairs. Each pair is a different size.

**Osha:** These fit.

**Bo:** I guessed.

**Wick:** You didn't guess. Mine have got the short thumb. You remembered my thumb.

**Narrator:** There is also a tin of hoof salve, a spare jack pin, a coil of the good cord, and a bag of
dried pears, in case there were no pears.

**Feng:** We're in an orchard, foreman.

**Bo:** I didn't know that when I packed.

**Narrator:** Renn has not taken his gloves yet. He is holding a stick with a pear on it, made of pulled
sugar, pale gold, with one leaf. There is a tray of them on a crate behind him.

**Renn:** We've been selling these at the Halt to eat. Osha boils. I pull.

**Narrator:** Bo takes the sugar pear and turns it to the light. It is good work. He turns it again.

**Bo:** The leaf's facing wrong.

**Renn:** The leaf's fine.

**Bo:** It should follow the stem. It's fighting the stem. If you warm it a moment and...

**Renn:** It's my leaf, Bo.

**Narrator:** Bo's thumb is already on the leaf. He takes it off. He gives the pear back, with the leaf
facing the way Renn made it.

> **If `reason.bo` is set —**
> **Narrator:** Bo takes a folded sheet from inside his tunic and holds it out to Renn.
>
> **Bo:** This was pinned up in the cab of that machine. Next month's shift, at Stoneback. Your name's first.
> All six of you are on it.
>
> **Renn:** A man came round in the spring. Steady work, he said, Ba Dan way, start of next month. We signed.
> We'd have gone, if the Orchard hadn't come up first.
>
> **Bo:** There's a column for what each of you would be owed. It's empty all the way down.
>
> **Narrator:** Renn reads down the empty column.
>
> **Bo:** I'd have found you behind a barred door.
>
> **Renn:** You would. And you'd have taken the door off by yourself, and carried it home, and not let any of
> us hold an end.
>
> **Narrator:** The crew laugh again. Renn does not, quite.

> **If Riko is in the party —**
> **Narrator:** Bo has moved, without noticing, to stand between Riko and the cracked beam.
>
> **Riko:** Bo.
>
> **Bo:** Hm?
>
> **Riko:** You're doing it to me now.
>
> **Narrator:** Bo looks at where his feet are. He moves them.

### Scene B.2 — The third arch

**Shown:** played. **Where:** the viaduct's third arch, and the crew's fire that evening.

**Narrator:** The yard foreman has given Renn's crew a real job, on trial: the cracked beam under the third
arch. A new one has to go in before the stone trains run on Monday.

**Narrator:** The third arch is the bad one. Between the pier and an old water tank there is a bay hardly
wider than a door. The beam has to go in through it. Only one person fits at the far jack.

**Narrator:** Bo walks the job with them. He walks it properly: he looks up before he looks down, and he
puts his hand flat on the pier and keeps it there.

**Bo:** The pier's sound. The tank footing's sound. The far jack sits on fill.

**Osha:** That's what I said this morning. It's on fill, not rock. It'll take the weight, but it wants
somebody watching it. Watching. Not lifting. If it settles a finger, the caller has to know that breath.

**Wick:** I can't do the ladder any more. Knees. But I can see all four jacks from the top of the tank, and
I've the voice to say so.

**Feng:** And can I say it? Every job we've ever done with a pinch in it, foreman goes in the pinch. Every
one. And we stand outside it holding his coat.

**Osha:** Feng.

**Feng:** I'm only saying. I've been six years on this crew and I've never been in the bad bay. I don't know
if I'm any good in a bad bay. Nobody knows. I'd like to find out before I'm forty.

**Narrator:** Bo does not answer that. He is looking at the bay.

**That night, at the fire.**

**Narrator:** Renn has chalked the lift on a slate: who is on which jack, who wedges, who watches, in what
order. He leaves it leaning on a crate and goes to his blanket.

**Narrator:** Some time after midnight he wakes. The slate has been rubbed out and written again. The hand is
square and careful. Bo is at the far jack. Bo is also on the wedges. Bo is calling. There are six other names,
down the side, under "standing by".

**Narrator:** Bo is asleep sitting up, with the chalk in his hand.

**Renn:** Bo.

**Bo:** Hm. I was up. I fixed the order. The far jack's on fill, so that should be me, and if it's me there
then the wedges are nearest, and from there I can see enough to...

**Renn:** You trust us with your life.

**Bo:** Of course.

**Renn:** Try trusting us with the schedule.

_(The three lines above are the bible's, word for word.)_

**Narrator:** Bo looks at the slate. He reads his own name three times down it. Round the fire the others are
awake now, and pretending not to be.

**Bo:** There was a foreman before me. He walked off in a wage fight, in the night, and left fourteen of us. I
was twenty-four. In the morning they were all looking at me.

**Bo:** I thought, if nobody ever has to do the bad part, nobody will ever want to go.

**Wick:** Nobody wanted to go, lad. We followed you three towns. Feng just wants a turn in the hole.

**Feng:** I do, though.

> **If Lin Mei is in the party —**
> **Lin Mei:** Renn's order was correct. I checked it against the pier last night. I also checked yours. Yours
> is correct as well, for a crew of one.

> **If Nima is in the party —**
> **Nima:** I could take the far jack. I'm light. I'd fit.
>
> **Bo:** Do you know what you'd be watching for?
>
> **Nima:** No.
>
> **Bo:** Then you'd be in the way. So would I be, in most of those places. I've only just seen it.

### Scene B.3 — VOTE: whose lift

**Shown:** played. **Where:** the fire, in the small hours, with the slate between them.

**Renn:** I'll say what I want, and then it's yours to say back. I want to run it. My order, my name at the
top. You on one post, and I pick the post. And when the yard foreman asks who did the third arch, the answer
is the crew, and the caller was Renn.

**Osha:** Or you stay foreman. I wouldn't mind that. But then write it down, properly. Who decides what. And
afterwards we sit you on that crate and tell you how you did. Out loud. And you write that down as well.

**Narrator:** Bo looks at the bay under the third arch. It is black in there.

**Bo:** Or you all go back to sleep, and I go in now and do it by myself. It'd be in before the tea's hot.

**Narrator:** Nobody says he could not.

**VOTE — How does this crew run the lift?**

- **Renn runs it.** His order and his name. Bo takes the post Renn gives him. The crew gets the credit, and
  Renn is named as caller. _Sets `pq05_shared`._
- **Bo stays foreman, in writing, with a review.** Bo writes down who decides what before the lift. Renn
  calls it. Afterwards the crew tell Bo how he did, and he writes that down too. _Sets `pq05_delegated`._
- **Bo does it alone.** Tonight, while they sleep. _Sets `pq05_alone`._

Footer: "The beam goes in on all three. Nobody is hurt on any of them."

### Scene B.4 — The lift

**Shown:** played (a lift in six counts, with one prompt; not a fight). **Where:** the third arch.

**If `pq05_shared` or `pq05_delegated`:**

> **After `pq05_delegated`, first —**
> **Narrator:** Bo writes on the slate, slowly, with the crew reading over his shoulder. "Order of lift: Renn
> decides. Stop the lift: anyone. Go again: Renn. Foreman: far jack, watches the fill, lifts on the count."
> He looks at the last line for some time, and then he underlines "on the count".

**Narrator:** Renn puts Bo at the far jack, in the bay. Feng is beside him on the wedges, in the bad bay at
last, grinning like a man at a festival. Wick is up on the tank, where he can see all four jacks.

**Renn:** Bo. You watch the fill. If it settles, say so. Say how much. You lift on my number and not before
it. Nothing else is yours. Have you got that?

**Bo:** Watch the fill. Lift on the number.

**Renn:** One!

**Narrator:** Four jacks rise together, a finger's width. The old beam comes off its seat.

**Wick:** Level! All four!

**Renn:** Two! Three!

**Narrator:** The new beam slides into the bay on rollers. It is very close on both sides.

**Renn:** Four!

**Narrator:** The beam stops. It has bound against the pier, on the near side, a long way from Bo. Everybody
feels it stop.

**Narrator:** Osha is nearest. She has not seen it yet. Bo has. He could reach it. He would have to leave his
jack.

**Narrator:** Every head on the crew has turned, out of six years' habit, to look at Bo.

**PROMPT (the decider; two choices):**

- **Leave the jack and free the beam.**
- **Stay on the jack and call what you see.**

**If "Leave the jack and free the beam":**

**Narrator:** Bo is across the bay in two strides. He puts his shoulder to the beam and his hand on the pier,
and the stone gives a thumb's width, and the beam runs free.

**Narrator:** Behind him, the far jack is standing by itself on the fill.

**Feng:** Fill's going! Half a finger! I've got it, I've got a wedge under it, it's stopped!

**Narrator:** Renn has not called five. He walks down the length of the beam and looks at the far jack, and at
Feng's wedge, and then at Bo.

**Renn:** Five is when the foreman's back on his post.

**Narrator:** Bo goes back to his post. It is a long walk for six paces.

**Renn:** Five. Six. Down.

**Narrator:** The beam seats. It is a good beam. Nobody cheers straight away.

**Renn:** It's in.

**Bo:** It's in.

**Renn:** Feng held your jack.

**Bo:** I know he did. Feng. That was the right wedge, and it was quick.

**Feng:** I've been wanting to hear that for six years. I'd have liked it not to be because you'd gone.

_Sets `pq05_left_post`._

**If "Stay on the jack and call what you see":**

**Narrator:** Bo's hands close on the jack handle and stay there.

**Bo:** Renn. It's bound on the pier. Near side, a hand back from the lip. Osha's closest.

**Renn:** Heard. Osha, bar. Lever it off the stone, don't lift it. Everybody else hold.

**Narrator:** Osha gets a bar in. It takes her three tries. It is slower than Bo would have been. Bo watches
all three tries with his jaw set.

**Narrator:** Under his own jack, the fill gives a little sigh.

**Bo:** Fill's settling. My side. A finger. No more than a finger.

**Renn:** Heard. Feng, wedge the far jack, on five. Wick?

**Wick:** Level!

**Renn:** Five!

**Narrator:** The beam runs free. Feng's wedge goes in. Bo lifts on the number and not before it.

**Renn:** Six! Down!

**Narrator:** The beam seats. Osha yells. Feng yells. Somebody throws a glove in the air and it lands in the
water tank.

**Narrator:** Bo lets go of the handle. He stands there with his hands at his sides. They do not seem to
belong anywhere.

**Renn:** You called the fill before I'd have seen it.

**Bo:** That's what you put me there for.

**Renn:** It is. I wasn't sure you'd stay there.

**Bo:** Neither was I. It was only six counts. It felt like a shift.

_Sets `pq05_kept_post`._

**If `pq05_alone`:**

**Narrator:** Nobody argues. They go back to their blankets. Bo goes into the bay in the dark, with three
jacks and a lantern. He bends the pier a thumb's width to make room and bends it back. He seats the beam by
feel. It takes until the sky is grey.

**Narrator:** It is good work. It is better than good. The beam sits as though it had grown there.

**Narrator:** When the crew wake, Bo is asleep against the pier, with stone dust in his hair, and the job is
done.

**Feng:** Well. That's that, then.

**Narrator:** Osha is already rolling her blanket.

**Osha:** The yard foreman's hiring porters at the Halt. Day rate. There's things to carry and nobody carries
them for you.

**Bo:** I only wanted you to have it done. Monday's close. I thought...

**Wick:** We know what you thought, lad. You've thought it every job for six years. It's a kind thought. You
can't raise a family on it.

**Narrator:** Four of the six go down to the Halt that morning. Wick stays, because of his knees. Renn stays
one more day.

**Renn:** It's a good beam.

**Bo:** Thank you.

**Renn:** It's always a good beam, Bo.

### Scene B.5 — After

**Shown:** played. **Where:** the crew's fire. Plays after `pq05_shared` or `pq05_delegated`.

**After `pq05_shared`:**

**Narrator:** The yard foreman comes down with his ledger to sign off the third arch.

**Yard foreman:** That's seated true. Who do I put?

**Narrator:** Bo opens his mouth, from habit. He shuts it and looks at Renn.

**Renn:** Put the crew. All seven names. And put "caller: Renn". And "far jack: Bo".

**Yard foreman:** Far jack. You? I'd heard you were the foreman.

**Bo:** I was. Today I was the far jack. I'd like it written the way he said it.

**After `pq05_delegated`:**

**Narrator:** They sit Bo on the crate. He has the slate on his knee and the chalk ready, and he looks like a
man waiting for a tooth to be pulled.

**Osha:** One. The gloves were a kindness and they fit. Write that.

**Narrator:** Bo writes it.

**Feng:** Two. You wrote down who decides what, and then you stuck to it. Mostly. Write "mostly".

**Narrator:** Bo writes "mostly".

**Wick:** Three. You hovered.

**Bo:** I stood still. I was on my post the whole...

**Wick:** You stood still very loudly, lad. I could hear you standing still from the top of the tank.

**Narrator:** The crew are trying not to laugh. Bo looks at the slate. He writes: "3. Hovered. (Loudly.)"

**Bo:** Is there a four?

**Renn:** Four's for next time. That's what the review's for. There's a next time.

> **If `pq05_left_post` —** add, in either version:
> **Feng:** And you left your jack.
>
> **Bo:** I left my jack.
>
> **Feng:** I'm not cross. I'm saying it so it's said. You'd have said it to me.
>
> **Bo:** I would. I'd have said it worse.

**Both versions end:**

**Narrator:** Renn holds out a stick. On it is a pulled-sugar pear, with one leaf, facing the way Renn makes
them.

**Renn:** For the cart. Don't fix it.

**Narrator:** Bo takes it. He looks at the leaf for a long moment. He wraps it in oilcloth exactly as it is.

**Renn:** If there's ever a big one. A real one, with a lot of crews. I'd want to call a piece of it. I'm
telling you now, so you can't say nobody asked.

**Bo:** I'll remember you said it.

**Renn:** Don't remember it. Write it down. You've got a slate.

_Keepsake: **Renn's sugar pear, with the leaf facing wrong**, in oilcloth on the cart's shelf (after
`pq05_shared` or `pq05_delegated`). After `pq05_alone`: **six pairs of work gloves, less two**, which come
back to the cart in Bo's pack. Sets `pq05_done`._

### PQ-05: what it sets and where it pays off

| Sets                               | Meaning                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `pq05_open`                        | Bo let go of the handle                                  |
| `pq05_shared`                      | Renn ran the lift; the crew is credited and Renn named   |
| `pq05_delegated`                   | Bo stayed foreman in writing, and was reviewed           |
| `pq05_alone`                       | Bo did it in the night; four of the crew took other work |
| `pq05_left_post`, `pq05_kept_post` | What Bo did when the beam bound (changes lines only)     |
| `pq05_done`                        | The quest is closed (any of the three)                   |

- **Trust:** rail and maintenance crews rise with `pq05_shared` and `pq05_delegated` (the yard foreman saw a
  visiting crew do the third arch properly).
- **"If PQ-05 ended with trust"** in MQ-12 (Renn at the relay: "Bo knows. Bo's letting me.") and MQ-13 (Renn
  leading the brace crew; "Bo lifts on the numbers and not before") reads `pq05_shared` or `pq05_delegated`.
  After `pq05_alone` or with the quest unplayed, a baseline crew does that work, later (bible).
- **MQ-12, Scene 12.2:** Bo hands Daiyu the chalk. It plays for every Bo.
- **MQ-15, Scene 15.4:** "resolved" (Renn: "Bo, far jack. Wait for my count.") after `pq05_shared` or
  `pq05_delegated`; "open" ("Who wants to run this one?") after `pq05_alone` or if never opened.
- **Banter:** the bible's Bo and Nima exchange "after both personal quests" needs `pq05_done` (not
  `pq05_alone`) and PQ-07 kept or handed over.

---

## Community trust from these quests

Read by lines, never a lock (see Act II).

| Community                  | Trust rises with                                                            | Trust falls with |
| -------------------------- | --------------------------------------------------------------------------- | ---------------- |
| Saltstep market and docks  | `pq01_whole_story` (most); `pq01_quiet_help`; winning K.4                   | nothing          |
| Causeway's low landing     | `pq02_posted_terms`; `pq02_cooks_shelf`; `pq03_published`; `pq03_monitored` | nothing          |
| Reedglass                  | `pq04_joint_ice`; `pq04_boat_plan`; winning S.3                             | nothing          |
| Rail and maintenance crews | `pq05_shared`; `pq05_delegated`                                             | nothing          |

No personal quest lowers a community's trust. A quest that goes badly costs the hero something with one
person, and that is written in the scenes.

## How each scene is shown

At most one cutscene candidate per quest, and none is relied on: every one also works played.

| Quest | Found         | Played             | Cutscene candidate                                      |
| ----- | ------------- | ------------------ | ------------------------------------------------------- |
| PQ-01 | K.1, K.6, K.7 | K.2, K.3, K.4, K.5 | K.3, the letter: the unbroken seal, and four lines      |
| PQ-02 | none          | T.1, T.2, T.3, T.4 | T.4, the hand that does not reach the salt              |
| PQ-03 | none          | N.1 to N.6         | None                                                    |
| PQ-04 | S.1           | S.2, S.3, S.4, S.5 | S.4 (`pq04_joint_ice`): cutting the hole in her own ice |
| PQ-05 | none          | B.1 to B.5         | B.4, Bo's hands on the jack handle while the beam binds |

## Open, for the owner

Everything below is written into the scripts as recommended, per the standing instruction.

1. **Names I invented.** Oko is Miri's brother (the name was already chalked on her crates in Scene 2.2; I
   made him the boy Kaya rescued). Yuna and Bash (Six-Ladle cooks), Ketu (the provisioning contractor), Odi
   (the net-loft worker), and Renn's crew: Osha, Wick and Feng. All were checked against the cast lists and
   the identity locks. Recommend: approve.
2. **Who Kaya rescued.** The bible says she "intervened when a neighbor was being bullied, scorched the shop
   behind him". I made the neighbour Miri's younger brother and the shop Miri's father's lantern shop, so the
   roof tile, the letter and the "reopening" all belong to one family. Recommend: approve.
3. **Kaya never opened the letter.** The bible says she "assumes it contained blame". I made that literal: she
   has carried it sealed for nine years, and it is four lines long. The bible's line about Thursday then
   answers what the letter actually asked. This also explains Act IV's "She's written 'Thursday' again".
   Recommend: approve.
4. **PQ-01's fight** is a collection crew working from a copy of the supply-control order with Miri's workshop
   added in pencil and a six made into sixteen. A win still costs Miri the six crates the typed order allows,
   because the order is real. The paper-lantern strings (a fire ability across one burns it, and it is
   counted, not punished) are a build suggestion; if the engine cannot count them, drop the two lines that
   read the count. Recommend: keep.
5. **Keepsakes.** Each quest gives one small object for the cart's shelf, with no stats: Oko's glass turtle
   duck, the seventh ladle, Bun the turtle seal, Vessa's pole (on loan), Renn's sugar pear. The bible says a
   quest's rewards are trust and changed lines, and that new equipment is "a prop or narrative detail". The
   brief asked what each quest unlocks, so I used props. Recommend: approve as cart dressing, in the spirit of
   outline decision 12.
6. **Ketu's signature is the "very neat signature" on Tenzo's quarry receipt.** The outline says the ration
   crates pay off at the Six-Ladle but not how. I made the contractor who delivered them, in full and on time,
   the same man who runs the late shelf on goodwill: he does what he is paid for and never goes back to look.
   Recommend: approve.
7. **Tenzo's grandmother.** The bible says he "omits the part where she publicly refused the foreman's
   conditions". I have him tell the story "up to the soup" and then remember the rest (T.2). Scene C.1 in Act
   III (DLG-02) lets the table ask about his grandmother; if C.1 plays after T.2 he should tell the whole
   story there, and if before, the short one. Recommend: add that one condition to C.1 when it is built.
8. **The forty blank labels (PQ-03).** The outline says Nilak's crate pays off in his quest but not how. I
   gave the outreach room a customs exemption and had Aru sign forty blank supply labels for the contractor's
   boat in exchange for freight space. It makes Aru answerable for something real without making them a
   villain, and it is inside the reveal ladder (MQ-02 already has uncounted "safety materials"). Recommend:
   approve; it is the largest invention in this file.
9. **Scene 15.4's "resolved" line for Tenzo** says "The kitchen is run by its cooks now." That is true after
   `pq02_cooks_shelf` but not after `pq02_posted_terms`, where Ketu still holds the contract. Recommend: when
   15.4 is built, give the posted-terms route its own first sentence ("The terms are still on the wall beside
   the shelf, with a year of initials down the margin.") and keep the rest.
10. **Sura's gap in MQ-13.** The bible says that after PQ-04 Sura "can suggest a barrier with an intentional
    release". Acts IV and V give her the gap for every Sura (12.2 and 13.2), with the insight arriving at
    Tavi's sand tray. I left those as they are: 12.2 "resolves no personal quest", and a Sura who cut the hole
    in S.4 reads as someone doing it a second time. Recommend: keep; no gating.
11. **PQ-04's echo.** The channel gives Sura's morning sounding ("nine") back in the afternoon, when the
    depth is three. Earlier echoes repeat something just said; this one repeats something said hours ago. It
    is never explained in the quest, and it fits what MQ-07 later says the Keeper is doing. Recommend: keep.
    If you would rather no echo outside the main missions, cut the four echo lines in S.2; the scene still
    works.
12. **The "cargo animals" in PQ-04** are four harnessed ostrich horses on a carter's barge (the bible's list
    of principal wildlife), and the rescue turns on leaving them alone for a round, which calls back to Tavi
    and Parcel at the ferry ramp (Scene 2.9). Recommend: approve.
13. **PQ-05's lift has a decider's prompt** in the middle of it ("leave the jack" or "stay and call what you
    see"). It changes lines only. I wanted the table to feel Bo's hands, not just vote on them. Recommend:
    keep.
14. **Where the documents disagree (PQ-01 to PQ-05):**
    - **PQ-03's place.** The bible and the outline's hero table put it at the Saltstep outreach room; the
      owner's 2026-11-15 decision puts Aru's table in Causeway for MQ-05, and Act II opens the quest there. I
      play the whole quest in Causeway and leave the Saltstep room for TR-02.
    - **PQ-01's timing.** Act III's hero table says Kaya has no main-line moment in Act III because "her PQ-01
      runs at Saltstep". After MQ-05 the cart does not pass Saltstep again unless the table goes back. I open
      it on the ferry's return from Emberwatch, between MQ-03 and MQ-04, so most tables meet it without a
      detour, and leave it open afterwards.
    - **"Festival lanterns".** The bible has Miri hanging "festival lanterns"; the only festival in the
      scripts is Causeway's Long-Light Evening. I call it "the lantern season" on the Saltstep ferry steps, so
      the scene reads the same before and after MQ-04.
    - **Little Bai.** Act IV (11.x and 12.2) puts Little Bai in Daiyu's lower-gallery crew from Stoneback; Act
      V's 15.4 "open" scene for Bo puts her in Bo's crew at the Orchard. I kept her out of Renn's crew.
      Recommend: in 15.4, change "Little Bai" to "Feng" ("Then Feng puts his hand up, already talking").
    - **Tenzo's find.** `reasons.ts` has Tenzo assume the neat signature belongs to whoever "let the cookhouse
      go cold". The receipt as I have used it carries the supplier's signature. Both can be true (he assumed);
      no shipped line needs to change.
    - **Dema's name.** The demo's old road keeper was a placeholder "Dema", since renamed Lanfen; the
      shipped portrait key is still `portrait.dema`. The canon Dema is the Six-Ladle cook. Nothing to fix
      here; a build session should not reuse that portrait for him.
