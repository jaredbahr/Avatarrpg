**DRAFT for the owner (the writing pass, 2026-11-17). Nothing here is in the game.**

# Personal quests, part 2 — scripts for PQ-06 to PQ-10

Lin Mei, Nima, Jinu, Riko and Wen. Part 1 ([personal-quests-1.md](personal-quests-1.md)) has Kaya, Tenzo,
Nilak, Sura and Bo, and the reading key for a personal quest: the quest exists only while its hero is in the
party; the rest of the party is optional variants; the turning point is a table vote on what the hero does;
each quest begins where an act script leaves off; a keepsake rides the cart's shelf and has no stats. The
general key (`Party:` lines, **Shown**, **VOTE**, **CARRY ON**, the **Driver**) is at the top of
[act2-sparks.md](act2-sparks.md).

Sources: the bible's Part 05 (PQ-06 to PQ-10) and DLG-06, each quoted line used word for word and marked; the
hero entries CH-06 to CH-10; the saga outline's "Why each hero keeps going"; the shipped Act I finds in
`src/content/story/reasons.ts`; and the act scripts that open and pay off each quest.

| Quest | Hero    | Opens                                       | Where it plays                            | Fight                      |
| ----- | ------- | ------------------------------------------- | ----------------------------------------- | -------------------------- |
| PQ-06 | Lin Mei | Reedglass, MQ-07 (opened in Scene 7.2)      | The school path, Fenn's raft              | No                         |
| PQ-07 | Nima    | Bellweather, MQ-08 (opened in Scene 8.2)    | The listening terrace, the night watch    | No (a night watch, played) |
| PQ-08 | Jinu    | Bellweather, MQ-08 (opened in Scene 8.2)    | The mail shelter, the lower camps         | No                         |
| PQ-09 | Riko    | Copper Orchard, MQ-06 (opened in Scene 6.4) | The old passenger platform                | Yes: the sign-up table     |
| PQ-10 | Wen     | Emberwatch, MQ-03 (opened in Scene 3.1)     | Edda's bench; in Causeway, Tanner's Stair | No (a repair, played)      |

---

## PQ-06 — What the Map Left Out (Lin Mei)

**Theme card:** PQ-06, What the Map Left Out

Themes: responsibility, equality. Lin Mei's survey of the marsh was accurate to a hand's width. It called
houses that move with the water "temporary", and it left off a path because the path is in a different place
every year. Somebody else used those two facts to write a removal notice. She did not write the notice. Her
mark is on it. From the owner's list, this quest carries: saying sorry isn't the end of it; owning it is the
start, and then there's the work.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (a measuring cord, a pencil and boots)
- [x] No instant forgiveness or absolution (Fenn wants the next map, not an apology)
- [x] The other side's reasons are shown (the corridor clerk has a map that says nobody lives here, and a
      maintenance boat that has to get through)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Reedglass, in Scene 7.2 of MQ-07, with Lin Mei in the party. Best played before MQ-09; still
open afterwards. **Other people:** Fenn, she/her, 32, the marsh schoolteacher; Twig, she/her, 8, one of her
pupils; a corridor clerk from the pump station. **What the party may know:** that the vanes went in and the
water changed (7.1, 7.2). Nothing about why.

**Planted earlier:** the gallery plan at the quarry, with a tunnel drawn straight through Lin Mei's hatching
(`reason.lin_mei`: "I thought the mark was enough"), and her own careful phrasing recognised in the order
(Scene 3.5).

> **The opening, already written (Act III, Scene 7.2):**
>
> **Narrator:** Fenn has a notice in her apron pocket, soft from folding. "Temporary structures in the
> Reedglass corridor are to be removed." There is a small survey mark in the corner.
>
> **Fenn:** I keep it on me. I don't know why. To be cross at.
>
> **Lin Mei:** That mark is mine.
>
> **Narrator:** Fenn looks at the mark, and at Lin Mei, and puts the notice back in her pocket very carefully.
>
> **Fenn:** Then tomorrow you'd better come and walk the path it left out. Bring boots you don't like.

### Scene L.1 — Boots you don't like

**Shown:** played. **Where:** the school path, from the reed houses to the school raft. _Sets `pq06_open`._

**Narrator:** Lin Mei has brought her survey case and her second-best boots. Fenn is waiting on the bank with
nine children and a coil of rope.

**Fenn:** Morning. This is the walk to school. You'll want your hands free. Is that case coming?

**Lin Mei:** It contains the original survey.

**Fenn:** Then it's coming. Twig, you carry the lady's case. Don't open it. Don't swing it.

**Narrator:** A girl of about eight takes the case in both arms, with great seriousness.

**Narrator:** The path begins as a plank. Then it is a row of cut stumps, a stride apart, standing in a foot
of brown water. Then a rope strung between two poles, to hold while you cross a log.

**Lin Mei:** This was not here when I surveyed.

**Fenn:** It was. It was forty paces that way. We move it when the water moves. Stumps come up, we cut new
ones.

**Lin Mei:** Then it is not the same path.

**Twig:** It's the same path. It goes from our house to school.

**Narrator:** Lin Mei does not have an answer to that. She steps onto the first stump.

**Narrator:** The children do not walk the stumps. They hop them, one foot only, and whoever touches water
goes back to the start. They have been doing it since they could stand.

**Twig:** You have to hop. Walking's cheating.

**Lin Mei:** I am not playing. I am measuring.

**Narrator:** She gets out her measuring cord. She measures the gap between the first two stumps. She
measures the second gap. She stands looking at the third.

**Lin Mei:** These are not even. The third gap is a hand longer. That is not a fair course.

**Twig:** It's the same for everybody.

**Lin Mei:** ...That is true.

**Narrator:** She puts the cord away. She tucks up her jacket. She hops.

**Narrator:** She makes the first gap, and the second. On the third she lands with her arms going round like
a windmill, and puts a foot down in the water to the ankle.

**Twig:** Back to the start.

**Lin Mei:** I had my weight wrong. I see what I did. Again.

**Fenn:** We've a school to get to.

**Lin Mei:** One more. I know the third gap now.

**Narrator:** She goes back to the start. Nine children wait for her without complaining, because this is
obviously more important than school.

**Narrator:** She clears all seven stumps on the second try and arrives at the rope slightly out of breath.
She does not look at anybody. She looks extremely pleased.

**Twig:** I do it backwards.

**Narrator:** Lin Mei looks at the stumps, and then at Fenn's face, and decides against it.

> **If Sura is in the party —**
> **Sura:** She went back. Did you all see? She went back to the start because a child told her to.
>
> **Lin Mei:** Those were the rules.
>
> **Sura:** I'm not teasing. I'd have argued for an hour that my foot was dry.

> **If Nima is in the party —**
> **Narrator:** Nima has done the stumps backwards, twice, and is being taught a version with your eyes shut
> by a boy of six.

**Narrator:** Past the log, the path runs along the back of a row of reed houses. Each one stands on a frame
of poles with a pair of long wooden runners under it, like a sledge.

_Cutscene candidate (suggested, not yet seen by the owner), from here to "So do we.": [cutscenes.md](cutscenes.md), CS-PQ06 (a proposal, pending the trial). The scene works played exactly as written._

**Narrator:** Twig stops at the third house and sets the case down on its step.

**Twig:** That's ours. Can I see the map now? Fenn said it's in there.

**Narrator:** Lin Mei opens the case. The survey sheet is on top: fine black lines, soundings, a neat scale.
She holds it so that Twig can see.

**Narrator:** Twig looks for a long time. She finds the row of houses. She finds the third one. Beside each
is a small letter T.

**Twig:** You drew our house.

**Lin Mei:** Yes.

**Twig:** You didn't draw a way to get home.

_(The three lines above are the bible's, word for word.)_

**Narrator:** Lin Mei looks at the sheet. The school raft is on it. The houses are on it. Between them there
is clean white paper, and a depth.

**Lin Mei:** A route has to be in the same place for two seasons before it is entered. That is the standard.
Yours moves.

**Twig:** So do we.

**Narrator:** She picks up the case again, because nobody has told her to stop carrying it, and goes on along
the path toward the school.

### Scene L.2 — The flood post

**Shown:** played. **Where:** the end of the row of houses, at a tall post.

**Narrator:** At the end of the row there is a post as thick as a mast, driven deep. It is notched all the
way up. Beside each notch somebody has painted a few words, in many different hands and many different
colours.

**Fenn:** High water. Every year, the day it tops out, whoever's nearest cuts it and says what year it was.

**Narrator:** Lin Mei reads up the post. "Twig born." "The two floods." "Year the eels were late." "Grandfather
Osk's last." "Roof came off the school; nobody hurt." It goes back further than the paint lasts.

**Narrator:** She takes out her own level book and holds it against the post. She reads from one to the
other for some time, with one finger.

**Lin Mei:** My ten-year line is here.

**Narrator:** She touches a place on the post. It is between two notches.

**Lin Mei:** I took it from three seasons of gauge readings and a calculation. It is within a hand of what you
cut with a knife. Yours goes back fifty years further than mine.

**Fenn:** We'd have shown you the post. Nobody came down this end.

**Lin Mei:** I was working from the bank. I had six days for the whole corridor.

**Narrator:** She turns to the houses on their runners.

**Lin Mei:** Everything below my line I marked T. Temporary structure. There is a box on the form. A
building that will be under water inside ten years goes in that box.

**Fenn:** It won't be under water. When the post says so, we hitch the house to a winch and drag it up the
bank. Then we drag it back down in autumn. That's what the runners are for.

**Lin Mei:** So the house is never below the line. It is only that the line and the house both move.

**Fenn:** Now you've got it.

**Narrator:** Lin Mei closes the level book.

> **If `reason.lin_mei` is set —**
> **Lin Mei:** At Stoneback I hatched a rock face as unsafe. A man drew his tunnel straight through the
> hatching. I thought then that nobody had read my mark.
>
> **Lin Mei:** Somebody read this one. They read it exactly as I wrote it. That is worse.

> **If Wen is in the party —**
> **Wen:** I had one like that. A part of mine that did just what the drawing said, in somebody else's
> machine.
>
> **Lin Mei:** What did you do about it?
>
> **Wen:** I'm still finding out. I'll tell you when I know.

### Scene L.3 — A survey correction (DLG-06)

**Shown:** played. **Where:** the step of Twig's house, with the notice. This is the bible's DLG-06, word for
word; only the choice at the end is set out as a vote.

**Narrator:** Lessons are over. Twig hands the survey case back with both arms, and Lin Mei is still holding
it when Fenn takes the notice out of her apron pocket and unfolds it on the step. Fenn puts one finger on the
small survey mark in the corner.

**Fenn:** That's your mark.

**Lin Mei:** It is.

**Fenn:** So when I tell them we live here, why do they keep showing me your map?

**Lin Mei:** I recorded the building. I marked it temporary.

**Fenn:** It is temporary. We move it when the water rises. We still live in it.

**Narrator:** Lin Mei sets down the survey case.

**Lin Mei:** I need to write that plainly.

> **If Bo is in the party —**
> **Bo:** We can fix the path.
>
> **Fenn:** That would help. I also want the next map to know we exist.

**Narrator:** There is a clerk coming along the plank from the pump station, in a clean corridor-office coat,
holding his own copy of the same sheet. He stops when he sees who is on the step.

**Corridor clerk:** I'm sorry to walk in on it. I'm the one who has to serve these. I've a maintenance boat
that must get down this corridor to the vanes every nine days, and a map that says nothing here is meant to
stay.

**Corridor clerk:** I've been told the map is very good.

**VOTE — What does Lin Mei do about her map?**

- **Amend it and publish it, with the residents named as contributors.** The omission goes up in public under
  her name, and the removal order is contested. _Sets `pq06_published`._
- **Negotiate an urgent correction, and commit to say it publicly afterwards.** A corrected route, agreed
  with the clerk today, quietly, so that nobody is moved this month. The public telling comes later, and she
  puts a date on it. _Sets `pq06_negotiated`._
- **Submit a technical correction only.** The sheet is fixed. Her name is not on what went wrong.
  _Sets `pq06_technical`._

Footer: "The path goes onto the map on all three. What differs is whose name is on the change."

**If `pq06_published` or `pq06_negotiated`** _(DLG-06, "if she accepts responsibility")_**:**

**Lin Mei:** I'll correct my map. Will you walk the route with me before I send it back?

**Fenn:** I walk it twice a day. I can manage a third.

**If `pq06_technical`** _(DLG-06, "if she remains defensive")_**:**

**Lin Mei:** The classification was standard.

**Fenn:** Who decides that? I want to speak to them.

### Scene L.4 — Other people's handwriting

**Shown:** played. **Where:** the school raft, at the big table, after lessons.

**If `pq06_published`:**

**Narrator:** Lin Mei pins a clean sheet to the school table. She rules the corridor again from her own
figures. It takes the afternoon. The children watch her sharpen a pencil as if it were a magic trick.

**Narrator:** When the lines are done she does something she has never done. She turns the sheet round and
pushes the pencil across the table.

**Lin Mei:** The path. Where it is today, and where it goes at high water. I have walked it once. You have
walked it every day.

**Narrator:** Fenn draws the path. Her line wobbles. Twig adds the seven stumps, as seven circles, with the
third gap drawn longer. The old netmaker comes in from the rail and puts a cross where the log is rotten.

**Narrator:** Lin Mei's hand moves toward the wobbling line, to true it. She puts the hand in her lap.

**Narrator:** Along the bottom, in her own small print, she writes: "Surveyed by Lin Mei. The first sheet
marked these houses temporary and showed no route between them and the school. Both were my omissions.
Corrected by:" and leaves the rest of the line empty.

**Fenn:** You want us to sign it.

**Lin Mei:** I want it to show who knew.

**Narrator:** They sign it: Fenn in chalky pencil, the netmaker with a net-knot for his mark, Twig in capitals
that take up most of the margin.

**Narrator:** The clerk has been standing in the doorway of the raft with his own copy rolled under his arm.

**Corridor clerk:** If that goes up the valley with your name on it, they'll ask why the first one was signed
off. They'll ask you. It won't be comfortable.

**Lin Mei:** The map is accurate. I am telling you what I failed to put on it.

**Narrator:** She hands him the new sheet. He reads it, down to the capitals.

**Corridor clerk:** I can't serve a removal on a house that's on the survey with a name beside it. I'd want
to. It'd make my nine days easier. I can't.

**Corridor clerk:** Somebody will have to tell me how my boat gets through.

**Twig:** You lift the rope. We lift it for the eel man. You only have to shout.

**If `pq06_negotiated`:**

**Narrator:** Lin Mei and the clerk spread both copies on the school table. She marks the path on his in red:
where it is now, where it goes at high water. She strikes out each T with one line and initials every strike.

**Corridor clerk:** I can hold the notices on that. A month. Longer, if nobody upstream asks why.

**Fenn:** And when somebody does ask why?

**Narrator:** Lin Mei takes a clean page from her level book. She writes four lines and a date, and gives it
to Fenn, not to the clerk.

**Lin Mei:** That says what I left out, and that I will say so in front of whoever is hearing the corridor's
business, by that date. If the date passes and I have not, you have it in my hand.

**Fenn:** That's a month off.

**Lin Mei:** It is. It was the earliest date I could be certain of. I did not want to write one I might
miss.

**Narrator:** Fenn folds it and puts it in her apron pocket, with the notice.

**Fenn:** I'll keep them together. So I'm cross at the right one.

**If `pq06_technical`:**

**Narrator:** Lin Mei files a correction slip at the pump station. It is one line: "Sheet 14: reclassify
structures 1 to 9; add footway, seasonal." There is a box for the surveyor's remarks. She leaves it empty.

**Narrator:** The clerk stamps it. The notices stop. The new sheet, when it comes back down the valley, has
the path on it, drawn with a ruler, forty paces from where the path is this year.

**Fenn:** It's wrong again.

**Lin Mei:** It was right on the day I measured it.

**Fenn:** I know it was. You'd have to live here to keep it right. Or ask someone who does.

**Narrator:** She goes back into the school. She does not shut the door on Lin Mei. She does not hold it,
either.

### Scene L.5 — A map of a place too small to need one

**Shown:** found (Twig, on the plank, as the party leaves). Plays after `pq06_published` or
`pq06_negotiated`.

**Narrator:** Twig is waiting at the first plank with a square of paper no bigger than her hand.

**Twig:** I made you one. It's from our step to the first stump. That's all it is.

**Narrator:** It is a map of four paces. It has a scale. The scale is a drawing of a foot.

**Lin Mei:** This is to scale.

**Twig:** It's my foot.

**Narrator:** Lin Mei holds it very carefully by the edges. For a moment her face does several things at
once.

**Lin Mei:** I collect these. Maps of places too small to need one. I have thirty-one. I have never been given
one by the person who lives on it.

**Lin Mei:** I would like to play you at the stumps again. Next time. Backwards. I will have practised.

**Twig:** You'll still lose.

**Lin Mei:** Very probably. I would still like to.

_Keepsake: **Twig's map of four paces**, pinned inside the lid of Lin Mei's survey case, which rides on the
cart (not after `pq06_technical`). Sets `pq06_done`._

### PQ-06: what it sets and where it pays off

| Sets              | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `pq06_open`       | Lin Mei walked the path                                          |
| `pq06_published`  | The amended map, under her name, with the residents' hands on it |
| `pq06_negotiated` | A quiet correction now and a dated promise to say it publicly    |
| `pq06_technical`  | A correction slip with the remarks box empty                     |
| `pq06_done`       | The quest is closed (any of the three)                           |

- **Trust:** Act III's table reads "PQ-06 owned" for Reedglass: that is `pq06_published` or `pq06_negotiated`.
- **MQ-09, Scene 9.1:** Lin Mei's line over the three sheets plays for every Lin Mei. After
  `pq06_published` the marsh sheet she traces is the one with the capitals in the margin.
- **MQ-10:** after `pq06_negotiated`, the assembly is where she keeps the dated promise. One line for her
  there is listed in "Open, for the owner".
- **MQ-13, Scene 13.4:** the school path "under the second gate's wash" is used to place the gate. The main
  line gets the same information from residents if this quest was skipped (bible).
- **MQ-12, Scene 12.2 and MQ-15, Scene 15.4:** the margin headed "What I need to ask". 15.4 plays "resolved"
  after `pq06_published` or `pq06_negotiated`, and "open" after `pq06_technical` or if never opened.

---

## PQ-07 — The Promise on the Wind (Nima)

**Theme card:** PQ-07, The Promise on the Wind

Themes: responsibility, belonging. Nima walked off a half-built roof to help strangers on a road, and the help
was real. He never sent word. For a week nobody at the sanctuary knew whether he was under the roof. What Sena
asks of him is one dull night in a hut, because an old man has done nine of them running. From the owner's
list, this quest carries: you show up for people.

- [x] No nation, element or culture stereotype (the sanctuary is one mixed household with a rota, not "Air
      culture")
- [x] Every valid party, non-benders included, has a real route through (the watch is a rope, a lamp and a
      card)
- [x] No instant forgiveness or absolution (Sena's thanks, at best, is a board game)
- [x] The other side's reasons are shown (the detour is truly wonderful, and Nima is not wrong to want it)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Bellweather, in Scene 8.2 of MQ-08, with Nima in the party. **Other people:** Sena, she/her, 45,
the sanctuary's caretaker; Hobb, he/him, sixties, a caretaker with bad knees; Kip, they/them, 15, a runner
from the lower camps. **What the party may know:** that bell three rings wrong after pressure tests (8.2).
This quest does not touch the mast or MQ-08's vote.

**Planted earlier:** the diverted supply crate at the quarry, tied with a sanctuary knot (`reason.nima`: "I
left there without telling anyone. I kept waiting for a good excuse to go back").

> **The opening, already written (Act III, Scene 8.2):**
>
> **Sena:** Nima.
>
> **Nima:** Sena. I, ah. I was going to send word.
>
> **Sena:** Eleven months ago you walked off the east shelter with the roof half on. We finished it in the
> rain.
>
> **Nima:** I did help someone.
>
> **Sena:** I believe you. I also needed to know you weren't under a fallen roof.
>
> _(The last two lines are the bible's, word for word.)_
>
> **Narrator:** She hands him the broom. It is not a punishment. It is just that she has two things to carry.

### Scene M.1 — The broom

**Shown:** played. **Where:** the listening terrace. _Sets `pq07_open`._

**Narrator:** The listening terrace is forty paces long and open to the wind on three sides. Nima sweeps the
first five paces in the ordinary way. Then he stops and looks at the other thirty-five.

**Narrator:** He looks at the wind ribbons on the rail. He looks at the broom. He takes off his sash.

**Narrator:** A quarter of an hour later the broom is hanging from a kite line strung between two ribbon
poles, with Nima's sash for a tail. Each gust walks it a little way down the terrace by itself, sweeping as
it goes. Nima sits against the wall with his eyes shut, nudging the gusts with two fingers.

**Narrator:** It works. It works very well for about twenty paces.

**Narrator:** Then a real gust comes down off the ridge. The broom goes the rest of the terrace in one swing,
and takes fourteen cushions and a board game off the end of it into the tea garden below.

**Narrator:** Sena has been watching from the kitchen door, holding a cup under a weighted lid.

**Sena:** That took you longer than sweeping it.

**Nima:** The first time. The second time it would take no time at all.

**Sena:** There won't be a second time. Those are my cushions.

**Narrator:** Nima goes down and fetches thirteen cushions. The fourteenth has gone on over the wall into the
cloud. He finds all the game pieces but one. He sweeps the last twenty paces with his hands on the broom.

> **If Bo is in the party —**
> **Narrator:** Bo has picked up the kite line and is running it through his fingers.
>
> **Bo:** This knot's good.
>
> **Nima:** It's a very good knot. It's the rest of the plan that fell off.

**Narrator:** When the terrace is done, Sena puts a second cup down on the wall, beside her own.

**Sena:** Who did you help?

**Nima:** A family on the pass road. Four of them and a grandmother. Their cart had lost a wheel and they
were trying to carry a stove.

**Nima:** I got them down to the valley. That was four days. Then at the bottom there was a man whose goats
had got out. And after the goats there was a bridge. There was always a next one.

**Sena:** I'm sure there was. Do you know who did your watches?

**Nima:** No.

**Sena:** Hobb. He was on the night watch one week in four. He took your week as well, and then the week of
the one who went looking for you.

**Nima:** Somebody went looking for me?

**Sena:** Of course somebody went looking for you. You'd left your bowl on the scaffold with rice in it.
We dug through the fallen thatch on the east side with our hands, in case.

**Narrator:** Nima puts his cup down.

**Nima:** I didn't think of the bowl.

**Sena:** No. I know you didn't. That's what I'm telling you.

> **If `reason.nima` is set —**
> **Narrator:** Nima unties something from his belt. It is a faded ribbon, tied in an odd flat knot.
>
> **Nima:** I came to tell you something as well. I found your crate.
>
> **Sena:** What crate?
>
> **Nima:** This was round it. One of ours: one pull and it's undone, and never by itself. It was at Stoneback
> Quarry, three valleys off, in a pile nobody had written down. Somebody had scraped the address off and
> painted over it.
>
> **Narrator:** Sena takes the ribbon. She turns it over.
>
> **Sena:** Roofing felt. For the east shelter. We waited six weeks for it. In the end we used tent canvas,
> and it's leaked on Hobb's bed every rain since.
>
> **Nima:** I can't tell you who took it. I can tell you where it went, and that it's still there, and that I
> looked.
>
> **Sena:** ...Well. That's the first word you've ever sent me. It's eleven months late and it's about a crate.
>
> **Narrator:** She puts the ribbon in her pocket, and does not give it back.

**Sena:** There's a wall down on the west shelter. Everyone who can lift is on it tonight. That leaves the
night watch. Hobb's done nine running.

**Sena:** It's a hut, a lamp, a rope and a book. Nothing happens. Hobb needs to lie down, and you're the one
who's here.

### Scene M.2 — The watch hut

**Shown:** played. **Where:** the night watch hut on the east shelter: a ladder to a lamp bracket, a flag
rope on a high cleat, a basket hoist down the cliff to the lower camps' path, and a log book.

**Narrator:** Hobb is in the hut. He is a big, slow man with a blanket round his shoulders, and he gets up
from the stool in three stages.

**Hobb:** You're the one with the bowl.

**Nima:** I'm the one with the bowl.

**Hobb:** I ate the rice. Seemed a waste. Right. Here's all of it.

**Hobb:** Lamp goes up the ladder to the bracket at dusk. Ribbon on the rail: if it goes flat, there's a gust
coming, and you run up the red flag so the path knows to get low. If somebody rings from the bottom of the
hoist, you send the basket down. Then you write it all in the book.

**Narrator:** He shows Nima the card nailed by the door. It is in Sena's hand, small, in the sanctuary's own
short way of writing: little hooks and bars.

**Nima:** I can read that. Can the volunteers from the camps?

**Hobb:** No. That's why it's always one of us seven. And I can't do the ladder any more, so I light the lamp
down here and it shows half as far. Don't tell Sena. She knows.

**Narrator:** Hobb goes off to lie down. Nima is alone in the hut with two hours of daylight and nothing to
do.

**Narrator:** He looks at the ladder. He looks at the high cleat. He looks at the card.

**Narrator:** There is a spare pulley in the hoist locker. Nima hangs it from the bracket and runs a cord
through. Now the lamp is lit at the bottom and hauled up from the stool.

**Nima:** No ladder. Hobb could do that sitting down. Anyone could do that sitting down.

**Narrator:** The flag rope ties off on a cleat above Nima's head. He moves the cleat down the post to the
height of a seated person's hand, and puts a wooden toggle on the rope's end so that it cannot run away
through cold fingers.

**Narrator:** Nima turns Sena's card over and draws on the back. A flat ribbon, an arrow, a flag going up. A
bell with two lines, an arrow, a basket going down. A lamp, an arrow, a hand writing in a book.

**Narrator:** They are not good drawings. Nobody could mistake what they mean.

**Narrator:** He stands back. It is finished. There is an hour of daylight left.

**Narrator:** He brings a second stool, to put his feet on. Then a cushion from the terrace. Then he notices
that the kettle is a long way from the stool, and ties a string to it.

**Narrator:** Sena comes by at dusk with the lamp oil. She looks at the pulley, the cleat, the card, the
cushion and the string.

**Sena:** You've built yourself somewhere to nap.

**Nima:** I've built somewhere a man with bad knees can sit till dawn.

**Narrator:** Sena looks at it again.

**Nima:** And nap. A little. Between things.

**Sena:** Hm. The cleat's good. Leave the cleat. I'll think about the string.

> **If Jinu is in the party —**
> **Jinu:** That card. That's a route slip. That's exactly what we pin up at a mail shelter for the relief
> runner, only ours has got words. Yours is better. Don't tell my office I said so.
>
> **Nima:** You've got a schedule for everything.
>
> **Jinu:** And you've just drawn one. With a little basket on it.

### Scene M.3 — VOTE: the meadow

**Shown:** played. **Where:** the watch hut, as the light goes.

**Narrator:** There are feet on the shelter stairs. A student comes up two at a time, with a lantern she has
forgotten to light.

**Student:** There's a sky bison on the landing meadow! A wild one! It came down out of the cloud and it's
just lying there! Everybody who isn't on the wall is going down. Sena says we can, if we're quiet. It'll go
at first light, off the high side. They never stay.

**Narrator:** She is gone again before she has finished.

**Narrator:** Nima has stood up. From the hut door he can see the path to the meadow, and lanterns going down
it in a line. He cannot see the meadow. The ridge is in the way.

**Nima:** I haven't been close to one since I was nine.

**Narrator:** Behind the student there has been somebody else on the stairs, more slowly: a runner from the
lower camps, about fifteen, with a carrying frame.

**Kip:** Is this the watch? I'm to say the oil carrier's late. She set off up the switchbacks at four and
she's not at the hoist. It's getting gusty. Somebody ought to walk down the east face and meet her. I would,
but I've done the climb twice today.

**Narrator:** Kip looks round the hut while they get their breath. They look at the card by the door, the
side with the pictures.

**Kip:** Ribbon, flag. Bell, basket. Lamp, book. Is that all it is? I thought you had to be one of you.

> **If Sura is in the party —**
> **Sura:** A sky bison. Go. I'll sit in your hut.
>
> **Nima:** Do you know what the ribbon means when it goes flat?
>
> **Sura:** ...No.
>
> **Nima:** Then you'd be sitting in a hut. That's not the same as the watch. I've only just worked that out.

**VOTE — What does Nima do with the watch?**

- **Keep it himself.** He stays in the hut all night and does every part of it. Kip is thanked and sent to
  rest by the stove, and nobody goes down to meet the carrier. From the hut he may see the bison go at first
  light, a long way off. The watch stays a job for the seven. _Sets `pq07_kept`._
- **Hand it over properly, and go down the switchbacks.** He teaches Kip the card and watches them do each
  thing once. He writes the handover in the book. Then he goes down the east face to meet the carrier. The
  meadow is on the other side of the ridge: he will not see the bison at all. _Sets `pq07_handed_over`._
- **Slip down to the meadow.** Ten minutes. Nothing ever happens. _Sets `pq07_slipped`._

Footer: "Nobody is hurt on any of these. On one of them, a delivery is missed."

### Scene M.4 — The night

**Shown:** played. **Where:** the watch hut and the cliff path.

**If `pq07_kept`:**

**Kip:** I could do the flag. It's only a picture of a flag.

**Nima:** You could. I said I'd do it, though. Tonight it has to be me.

**Kip:** So you do have to be one of you.

**Narrator:** Kip sits down by the stove, with their back to the card.

**Narrator:** Nima trims the lamp and hauls it up. He coils the hoist rope the way it will run. He opens the
book and writes the date. Then there is nothing to do.

**Narrator:** He counts the lanterns going down to the meadow. Nineteen. He invents a game where you guess
which will get there first. He wins twice and loses once, to himself.

**Narrator:** Some time after midnight the ribbon on the rail goes flat.

**Narrator:** He has the red flag up before the gust arrives. It comes down off the ridge like a hand. Far
below, on the path, a small light stops moving and gets low.

**Narrator:** When the gust has gone, a bell rings twice at the bottom of the hoist. Nima sends the basket
down. The rope runs clean, because he coiled it at dusk. It comes up heavy: two cans of lamp oil, and a note
tied to the handle.

**The note:** "Late. Sorry. Sat out the gusts under the overhang, by myself. Saw your flag. C."

**Narrator:** He writes it in the book. "Flat ribbon, flag up, one gust. Basket: two cans oil, from C. All
well." It is four lines. It is the whole night.

**Narrator:** At first light Kip shoulders the carrying frame and goes down to the camps. They do not look at
the card on the way out.

**Narrator:** The sky is going grey. Something pale comes up over the ridge from the meadow side, a long way
off, and turns north. Nima holds his thumb up at arm's length. It is no bigger than the nail. Then it is in
the cloud.

**Narrator:** He picks up the pencil and adds a fifth line: "First light: one sky bison, going north."

**Narrator:** Hobb comes up the shelter stairs in three stages, with nine hours' sleep in his face.

**Hobb:** Was it big?

**Nima:** From here? About so.

**Narrator:** He shows him the thumbnail.

**Hobb:** Hm. They tell me you could have put the kitchen in it.

**Nima:** I expect you could. I had the far end of it.

**If `pq07_handed_over`:**

**Narrator:** Nima takes Kip through the card. Ribbon, flag: Kip runs the flag up and down from the stool.
Bell, basket: Kip sends the basket down empty and brings it back. Lamp, book.

**Nima:** Do the flag again. I'm going to be on that path. I want to have seen it twice.

**Narrator:** Kip does the flag again. Nima opens the book and writes: "Watch handed to Kip, of the lower
camps, at dusk. Shown the card. Did each thing, and the flag twice. Nima gone down the switchbacks to meet the
oil carrier. Back by first light." He reads it over. He adds his name.

**Narrator:** He goes down the east face with a lantern. At the first turn he looks back. The lanterns on the
meadow path have gone behind the ridge, one after another. After that there is only rock, and the next turn.

**Narrator:** He finds the carrier at the seventh turn, sitting on her cans with her back to the rock.

**Oil carrier:** I'm not going round that corner alone. The wind's doing something round that corner.

**Nima:** Then we'll go round it together. When it gusts, we stop. There's somebody up top who'll tell us.

**Narrator:** At the corner the wind drops, all at once, to nothing. Nima looks up. High above, small and
red against the lamp, a flag is going up the pole.

**Nima:** Down. Now. Against the rock.

**Narrator:** The gust goes over them like a cart over a bridge. When it has passed they get up, and the
carrier laughs with relief.

**Oil carrier:** Whoever's on your watch is quick.

**Nima:** They learned it tonight. From a drawing.

**Narrator:** They come up the last turn at first light, a can each. The meadow path is full of people
walking home, talking in low, happy voices. The meadow is empty.

**Narrator:** In the hut, Kip is asleep on the two stools, with the string to the kettle round one finger. The
book has a new entry, in a round, careful hand: "Ribbon flat. Flag up. They got low. I saw them get low."

**Narrator:** Hobb comes up the shelter stairs in three stages, with nine hours' sleep in his face.

**Hobb:** Was it big?

**Nima:** I don't know. I was round the other side of the cliff.

**Hobb:** Hm. I was asleep.

**Narrator:** They both look at Kip.

**Hobb:** And that one was watching a ribbon. Well. Somebody will have seen it.

**If `pq07_slipped`:**

**Narrator:** Nima hauls the lamp up. He tells Kip to rest by the stove. Then he goes down the meadow path,
quickly, with no lantern.

**Narrator:** It is lying in the long grass with its six legs folded under it. Each breath lifts the whole
enormous side of it and lets it down again. A flying lemur is asleep in the fur behind its ear. Nineteen
people are sitting round it in the dark, not speaking.

**Narrator:** It is the best thing Nima has seen in a year. He stays a good deal longer than ten minutes.

**Narrator:** Up at the hut, the ribbon goes flat. Nobody runs up the flag. Kip has looked at the card, but
nobody has shown them the cleat.

**Narrator:** The oil carrier is on the last switchback when the gust comes. She has seen no flag, so she is
standing. It puts her against the rock and takes one of the cans off her frame. She hears it go, a long way
down.

**Narrator:** She rings at the hoist. Nobody sends a basket. She rings again. Then she turns round and goes
back down to the camps in the dark, because it is safer than waiting.

**Narrator:** When Nima comes up the path there is a light in the hut. Hobb is on the stool, with the
blanket round him, writing in the book.

**Hobb:** Tenth night.

**Nima:** Hobb, I...

**Hobb:** Was it big?

**Nima:** ...Yes. It was the biggest thing I've ever seen.

**Hobb:** Good. I'd hate it to have been small. West shelter's got no lamp oil. They're working on that
wall by one candle. Write that in. It's your entry, not mine.

**Narrator:** Nima takes the pencil. He writes it in. It takes him a long time to find a way to put it that
is true and short.

_Sets `lost_watch_delivery` (with `pq07_slipped` only). The carrier is unhurt. One can of oil is lost and the
west shelter is repaired a day late._

### Scene M.5 — A road and a date

**Shown:** played. **Where:** the listening terrace, in the morning.

**After `pq07_kept` or `pq07_handed_over`:**

**Narrator:** Sena reads the night's entry in the book, standing up, with her tea going cold.

**After `pq07_kept`:**

**Sena:** Five lines.

**Nima:** Nothing happened. One gust and two cans. The fifth one's not really the watch.

**Sena:** That's what a good night is. I've a shelf of these books, every one since the rebuilding. The good
ones are all four lines. You can keep the fifth.

**Narrator:** She turns back a page, and forward again.

**Sena:** The runner from the camps stopped me on the stairs. They asked why the card has pictures on it, if
it's only ever for us.

**Nima:** What did you say?

**Sena:** I hadn't an answer. You had one last night, and you sat on it till morning. I asked you to. I'm not
complaining. Hobb's back on tonight, that's all.

**After `pq07_handed_over`:**

**Sena:** You gave my watch to a child from the camps.

**Nima:** I gave it to somebody rested, who wanted it, and I watched them do it twice. And I wrote down that
I had. It's in the book.

**Sena:** I can see it's in the book. I've read it three times, looking for what's wrong with it.

**Narrator:** She shuts the book.

**Sena:** Kip can have the fourth night, if Kip wants it. Seven of us isn't enough. I've known that for a
year.

**Sena:** They tell me it was the size of the kitchen.

**Nima:** So I hear.

**Both:**

**Narrator:** She does not say thank you. She sets up the board game on the terrace wall, with a pebble for
the piece that is missing.

**Sena:** Sit down. I've nobody here who gives me a proper game, and you owe me a cushion.

**Narrator:** They play. Sena wins. It is not close.

**Nima:** The cart goes down the valley today. I'm going with it.

**Sena:** I thought you would be.

**Narrator:** Nima goes to the watch hut and opens the book at the back, where the caretakers write their
leave. He writes: "Nima. Gone with the Ba Dan cart. Road: down the tram line, then wherever the cart's book
says. Word from every mail shelter I pass. Back for Returning Wind."

**Narrator:** He looks at it. He takes a ribbon from the rail and ties it round the page, so that the book
will fall open there.

**Sena:** "Wherever the cart's book says" isn't a road.

**Nima:** It's the truest one I've got. The date's real. I'd rather write one real thing than two that sound
good.

**Sena:** ...Yes. All right. That's more than the bowl said.

**After `pq07_slipped`:**

**Narrator:** Sena reads the night's entry in the book. Nima's is under Hobb's. She reads it twice.

**Sena:** You wrote it down.

**Nima:** Hobb said it was my entry.

**Sena:** It was. I've known people who'd have left the page out.

**Narrator:** She closes the book. She does not get out the board game.

**Sena:** You can come back. You know that. But the next time I need one dull thing done, I'll ask somebody
else first, and you'll know why.

**Nima:** I saw it, Sena. I'm not sorry I saw it. I'm sorry how.

**Sena:** I know. Go and tell the carrier. She's at the bottom of the hoist, and she's a can short.

**Narrator:** He goes down the cliff path in daylight to tell her. It is every turn of the switchbacks, and
nobody goes with him.

_Keepsake: **a sanctuary ribbon in the one-pull knot**, tied to the cart's rail (after `pq07_kept` or
`pq07_handed_over`; Sena ties it there herself, and says only "So it comes undone when you mean it to").
Sets `pq07_done`._

### PQ-07: what it sets and where it pays off

| Sets                  | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| `pq07_open`           | Nima took the broom                                     |
| `pq07_kept`           | He kept the night watch himself; Kip was sent to rest   |
| `pq07_handed_over`    | He trained Kip, wrote the handover, and met the carrier |
| `pq07_slipped`        | He went to the meadow without a handover                |
| `lost_watch_delivery` | The oil was missed (with `pq07_slipped`)                |
| `pq07_done`           | The quest is closed (any of the three)                  |

- **Trust:** Act III's table reads "PQ-07 kept" for the Bellweather sanctuary: that is `pq07_kept` or
  `pq07_handed_over`. The lower camps rise a little with `pq07_handed_over` (Kip has the fourth night).
- **What each route costs.** After `pq07_kept` Nima sees the bison go, thumbnail-sized, from the hut; Kip
  goes home believing the watch is for the seven, and Hobb is back on the next night. After
  `pq07_handed_over` the sanctuary has an eighth watcher and the carrier was met; Nima did not see the bison
  at all. After `pq07_slipped` he saw it close, and a delivery was missed. Hobb asks "Was it big?" on all
  three, and gets a different answer each time; a table hears only one.
- **The watch hut** keeps Nima's pulley, cleat and picture card on every route. They do not depend on the
  vote.
- **MQ-12, Scene 12.2:** Sena gives Nima "the dullest one I've got". It plays for every Nima; after
  `pq07_slipped` her "It's the dullest one I've got" is her asking him first after all.
- **MQ-15, Scene 15.4:** "resolved" (the quiet flag watch) after `pq07_kept` or `pq07_handed_over`; "open"
  (the note that takes three tries) after `pq07_slipped` or if never opened.
- **Banter:** the bible's Bo and Nima exchange ("Your watch?" "My watch.") needs `pq07_kept` or
  `pq07_handed_over`, and PQ-05 shared or delegated.

---

## PQ-08 — Letters Are Not Yours (Jinu)

**Theme card:** PQ-08, Letters Are Not Yours

Themes: responsibility, respect for each other's differences. Two things are in the wrong pile. A private
letter has been tied in with the public post, and Jinu knows enough to guess what is in it. A storm warning
has been stamped "private", and nobody below the ridge has read it. One of them is hers to carry and not to
know. The other belongs to everyone under the wind. From the owner's list, this quest carries: saying sorry
isn't the end of it.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (sorting, asking and walking)
- [x] No instant forgiveness or absolution (on the route where Jinu opens the letter, Marda takes it and says
      "bring the next one shut")
- [x] The other side's reasons are shown (the young courier means well; the station clerk was told a posted
      warning "invites misunderstanding")
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Bellweather, in Scene 8.2 of MQ-08, with Jinu in the party. **Other people:** Ilo, he/him, 17,
the young courier at the mail shelter; Marda, she/her, sixties, a quilt-mender in the lower camps; the tram
operator from Scene 8.1. **What the party may know:** that gusts follow the ridge station's pressure tests
(8.2). The bulletin says the same thing and no more.

**Planted earlier:** the bundle of letters under a stone in the quarry's gate office (`reason.jinu`: "Nobody
opened them. Nobody sent them on, either. They just put a rock on them").

> **The opening, already written (Act III, Scene 8.2):**
>
> **Narrator:** In the mail shelter, a young courier is sorting a split bundle. A sealed private letter has
> been tied in with the public dispatches. One of the dispatches, a safety bulletin, is stamped "private".
>
> **Young courier:** I say we open the lot. In case it matters.
>
> **Jinu:** I know that seal. I know who she writes to, and I could tell you what's in it without touching
> it. I'm not going to.
>
> **Jinu:** I can deliver it. Whether I get to read it is a different question. The bulletin, though. Who
> marked a storm warning "private"? Hand me that one.

### Scene J.1 — Outside only

**Shown:** played. **Where:** the Bellweather mail shelter: a plank hut with a half-door, pigeonholes, and a
sorting table weighted with stones against the wind. _Sets `pq08_open`._

**Narrator:** The bundle has burst its string on the way up. There are thirty-odd pieces on the sorting table
and a stone on each.

**Jinu:** Right. What's your name?

**Ilo:** Ilo. Second month. I do the terraces. I've not done the camps yet.

**Jinu:** Ilo, here's the whole trade, and then I'll talk about roads for a while, because I can't help it.
You sort by the outside. Seal, hand, weight, where it's been. You never hold one up to a lamp.

**Narrator:** Ilo, who is holding one up to the lamp, puts it down.

**Jinu:** Public post, that pile. Anything with a station stamp. Private, that pile. Anything with a
person's name and a person's seal. If you can't tell, it's private till you can.

**Narrator:** They sort. Jinu sorts fast, with both hands, and talks the whole time.

**Jinu:** That one's come by the pass road. See the grit in the fold? I call that road the Shin-Barker. This
one's been down Old Regret, the ferry side. You can smell the tar. There's a decent privy at the halfway
hut on Old Regret, by the way. Third door. The first two are a lie.

**Ilo:** Does any of that help with the sorting?

**Jinu:** It tells me how late it is. The privy's just for you. You'll thank me.

**Narrator:** She picks up each private letter for a moment before she lays it down, as if she were weighing
it. Then she notices Ilo watching.

**Jinu:** I weigh them. I can't stop. This one's got a pressed flower in it. That one's two sheets and he's
written on both sides. I'm allowed weight. Weight's outside.

**Narrator:** The last piece on the table is the one with the seal she knew: grey wax, a little boat pressed
into it. It is addressed in a round hand: "Marda, quilt-mender. Third tent past the cistern. Lower camps,
Bellweather."

**Ilo:** You said you knew what was in it.

**Jinu:** That's Chun's seal. Ferry clerk at Saltstep. She writes to her mother once a month, and she's been
walking out with the customs man's nephew since autumn. Everybody on the pole walk knows it. And this one's
two sheets, where she only ever sends one.

**Jinu:** So it's a wedding. I'd put my bag on it. Spring, I'd say, and she wants her mother to come down
for...

**Narrator:** She stops in the middle of the word. Her hands, which have not been still since she came in,
go still.

**Ilo:** What?

**Jinu:** Nothing. I was telling you a letter I haven't read.

> **If `reason.jinu` is set —**
> **Jinu:** There was a bundle like this at the quarry. In the gate office, under a rock. A month's letters.
> Not one seal broken.
>
> **Ilo:** That's good, isn't it? They didn't open them.
>
> **Jinu:** I thought so, for about a minute. Then I thought: they didn't carry them, either. They just put
> a rock on them. There's two ways to do a letter wrong, and you were only about to do the one.

> **If Riko is in the party —**
> **Riko:** You stopped.
>
> **Jinu:** I did.
>
> **Riko:** You don't, as a rule.
>
> **Jinu:** No. I'd like you to notice it was me that did the stopping.

> **If Latch is on the tailgate —** (found, at the cart, if the letter is carried past it)
> **Latch:** It is shut. No one has opened it. So it is nobody's yet?
>
> **Jinu:** It's hers. Shut is how you can tell.
>
> **Latch:** Shut means somebody's. Open on an edge means for whoever is passing. I am learning these. They
> do not go the way I would have made them.

### Scene J.2 — The private storm

**Shown:** played. **Where:** the mail shelter, then the tram station.

**Narrator:** Jinu turns the other one over: a printed sheet, folded in three, with a ridge-station stamp.
Across the front, in red, somebody has added a second stamp: "PRIVATE. Station master only."

**Jinu:** A station stamp is public post. That's what a station stamp means. And then somebody's gone over
the top of it with a red one.

**Ilo:** So do we open that one? It's a warning. It's got "gusts" on the outside.

**Jinu:** It's addressed to the station master. So it goes to the station master. I don't open his post
because I think he'd want me to. But I can stand there while he reads it, and I can ask him a question
after.

**Narrator:** The tram operator is at the station, splicing a cable end, in a bad mood.

**Tram operator:** Post? At this hour? Give it here.

**Narrator:** He reads it. His face does not change. Then it does.

**Tram operator:** "Gusts from the east follow each pressure test within the hour. Suspend the car during
tests and for one hour after. Dates of tests below." There's twelve dates. Four of them have been and gone.

**Tram operator:** I ran the car on all four. The fourth was the day it hung.

**Jinu:** Who stamped it private?

**Narrator:** A clerk in the station office has stopped writing.

**Station clerk:** I did. Nine days ago, when it came in. The line office sent a note with it. A posted gust
warning with the ridge station's tests named on it "invites misunderstanding". So it was for the station
master's eyes, and he was to use his judgement. You were up the line. I put it in the up-bag.

**Tram operator:** I'd have used my judgement if I'd had the post! That bag's sat in a luggage cage for nine
days!

**Station clerk:** I didn't lose the bag. I only stamped it.

**Jinu:** I'm not after you. I'm asking whose it is.

**Jinu:** The order belongs to the people it affects. That letter belongs to the person whose name is on it.

_(The two sentences above are the bible's, word for word.)_

**Jinu:** This one's got twelve dates on it, and everybody who rides that car or sleeps under that ridge is
affected by all twelve. That's not a private letter. That's a notice with the wrong stamp.

**Tram operator:** It's addressed to me.

**Jinu:** It is. So it's not mine to pin on a wall. It's yours. Write it out fair, put the station seal on it
and your own name under it, and I'll carry copies to every board between here and the camps. Then it's yours
and it's true, and nobody can say a courier leaked it.

**Narrator:** The operator looks at the clerk. The clerk looks at the note from head office.

**Tram operator:** They can dock me for a late car. I'd like to see them dock me for reading my own post
out loud.

**Narrator:** He writes it out. The clerk, after a moment, gets the seal out of the drawer without being
asked, and warms the wax.

_Sets `pq08_bulletin_posted`. This happens on every route; the vote below is about the other letter._

**Narrator:** By dusk the notice is on the mail shelter's half-door, on the wind shelter, and on the biggest
tent pole in the lower camps, with the eight dates still to come.

> **If Nima is in the party —**
> **Jinu:** You. You're light and you've got nothing in your hands. Take four copies to the terraces.
>
> **Nima:** I was going to...
>
> **Jinu:** You were going to the terraces anyway. Now you're going with the mail. Welcome to the schedule.

### Scene J.3 — Third tent past the cistern

**Shown:** found. **Where:** the lower camps.

**Narrator:** There is no third tent past the cistern. There is a square of flattened grass, four peg holes,
and a ring of stones where a stove stood.

**Ilo:** She's gone. What now? If we opened it, there might be something inside to say where.

**Jinu:** There might. There's also a whole camp of people standing about who watched her take the tent
down. Go and ask. Ask where Marda's pitched now. Don't say who it's from. Don't say there's a letter. A
letter coming is news, and it's her news.

**Narrator:** It takes four conversations.

- **A woman at the cistern:** "Marda? Moved up out of the wet a fortnight back. Ask the quilt line."
- **A boy at the quilt line:** "These are all hers. She's not here. She's where it's warm."
- **Nel's niece:** "Nel says: wind shelter kitchen. Nel says: she's mending the big curtain. Nel says: why?"
- **Jinu, to Nel's niece:** "Tell Nel I've got something with her name on it, and that's all I'm allowed to
  have."

**Narrator:** Nel signs something short, and grins.

**Nel's niece:** Nel says: good.

**Narrator:** On the path up, Ilo is carrying the letter in both hands, in front of him.

**Ilo:** Why did you stop? In the shelter. When you were saying about the wedding.

**Narrator:** For some time Jinu does not answer. For Jinu, it is a very long time.

**Jinu:** Six years ago, up north. I'd a customer on my round who was lonely. An old lady. She liked to hear
about the street. So one day, to cheer her, I said the maid next door was as good as engaged. I'd seen her
twice with the same young man. I thought it was a nice thing to tell.

**Jinu:** She wasn't engaged. And the house she worked in didn't keep engaged maids. The old lady mentioned
it to the mistress over the fence. Kindly. She was out of her place by the end of the week.

**Ilo:** Did you say sorry?

**Jinu:** Oh, I said sorry. I said it straight away. I'm quick. And ever since, when I tell it, I say "it
was only a small mistake".

**Narrator:** She walks a few steps.

**Jinu:** It was small for me. I've never once gone back up that road to find out what size it was for her.

### Scene J.4 — VOTE: the half-door

**Shown:** played. **Where:** the wind shelter's kitchen door, which is a half-door. Inside, a grey-haired
woman is sewing a patch onto a canvas curtain as big as a sail.

**Narrator:** Jinu stops a few paces short of the door, with the letter in her hand. Two sheets. A grey
seal with a boat.

**Ilo:** She's right there. Just give it to her.

**Jinu:** I'm going to. I'm deciding how.

> **If Kaya is in the party —**
> **Kaya:** Is it a wedding or not? I can't stand it.
>
> **Jinu:** Neither can I. That's the entire difficulty.

**VOTE — How does Jinu deliver Marda's letter?**

- **Sealed, and ask nothing.** Hand it over the half-door. Go. _Sets `pq08_sealed`._
- **Sealed, and then ask her leave.** Hand it over. Tell her the post was mixed up and that couriers on this
  line have been guessing at it. Ask whether there is anything in it she wants known, and take no for an
  answer. _Sets `pq08_asked`._
- **Open it first, then tell her.** "In case it matters." Then give it to her open, and say who opened it.
  _Sets `pq08_opened`._

Footer: "The letter says the same thing whichever way it arrives. Opening it gains nothing."

**If `pq08_sealed`:**

**Jinu:** Marda? Post. It went round by the wrong pile. I'm sorry it's late.

**Narrator:** Marda puts down her needle. She takes the letter across the half-door, looks at the seal, and
smiles at it.

**Marda:** That's my girl's boat. Two sheets! She never sends two.

**Narrator:** She looks up. Jinu is standing with her mouth a little open, like someone about to speak.

**Marda:** Was there something else?

**Jinu:** No. That's all of it. Good evening.

**Narrator:** Marda goes in to the stove to read it. The half-door swings to. Through the gap, Jinu can see
the edge of the first sheet, and the old woman's hand, and nothing else.

**Narrator:** She stands there for the space of three breaths. Then she shoulders her bag.

**Ilo:** Don't you want to know?

**Jinu:** I want to know so badly my teeth hurt. Come on. There's a dozen more for the terraces, and I'm going
to weigh every one of them.

**If `pq08_asked`:**

**Jinu:** Marda? Post. It went round by the wrong pile, and I'm sorry it's late.

**Narrator:** Marda takes it across the half-door, and smiles at the seal.

**Jinu:** There's one thing more, and then I'll go. That letter was tied in with the public post. Couriers
have had it in their hands for nine days, and couriers talk. I'm one of them. I've been guessing what's in
it since noon.

**Jinu:** I haven't read it. Nobody has. But if there's anything in it you'd like the mail shelter to know,
or to stop saying, tell me and I'll see to it. And if there isn't, say "no", and that's the end of it.

**Narrator:** Marda looks at her for a moment. Then she breaks the seal, there at the door, and reads both
sheets through, slowly, with her lips moving.

**Marda:** Well. What had you guessed?

**Jinu:** A wedding. In spring.

**Narrator:** Marda laughs out loud.

**Marda:** She's thrown him over! Before the frost. Good riddance, he counted her spoons. No. She's been
made permanent on the ferry desk, and she's found a room with a stove, and she's not coming up for the
summer work after all. I'm to come down to her. Before the spring tide, she says. She's drawn me the stairs.

**Jinu:** I had every single part of that wrong.

**Marda:** You did. You can tell the mail shelter I'll want my post sent on to Saltstep from the new moon.
That's the only part that's theirs. The spoons are mine.

**Jinu:** The spoons are yours.

**If `pq08_opened`:**

**Narrator:** Jinu turns her back to the door. She slides a thumbnail under the grey seal. It comes away in
one piece, with the little boat whole.

**Narrator:** She reads both sheets. It takes her less time than it took to decide.

**Narrator:** There is no wedding in it. Chun has been made permanent on the ferry desk. She has a room with
a stove. She is not coming up for the summer work. She wants her mother to come down to her before the
spring tide, and she has drawn the stairs.

**Narrator:** Nothing in it mattered to anybody but Marda.

**Ilo:** Was it? A wedding?

**Jinu:** No. And don't ask me what it was.

**Narrator:** She goes to the half-door with the letter open in her hand.

**Jinu:** Marda. This is yours. It came by the wrong pile. And I opened it. Before you. I read it. Nobody
else has. I'm the one.

**Narrator:** Marda puts down her needle. She does not take the letter straight away.

**Marda:** Why?

**Jinu:** I told myself it was in case it mattered. It wasn't that. I wanted to know.

**Narrator:** Marda takes the letter. She looks at the broken seal, with the boat still whole.

**Marda:** Then you know before I do whether I ought to sit down.

**Jinu:** You needn't sit down. It's good.

**Marda:** I'd have liked to find that out from her.

**Narrator:** She goes in to the stove. At the inner door she stops, without turning round.

**Marda:** You came and said. Most wouldn't. Bring the next one shut.

**Narrator:** The half-door swings to. Jinu walks down as far as the cistern without a word. Ilo has never
heard her not say anything.

### Scene J.5 — What Ilo carved

**Shown:** found (the mail shelter, as the party leaves). Plays after any of the three.

**Narrator:** Ilo is at the sorting table with a knife and half a raw turnip. He has cut two words into the
flat face of it, backwards.

**Ilo:** It's a stamp. Watch.

**Narrator:** He presses it on the ink pad and then on the edge of the table. It says, a little crookedly:
"OUTSIDE ONLY".

**Ilo:** For the new ones. Every second-month who comes through. I'm going to stamp it on the back of their
hand.

**After `pq08_sealed` or `pq08_asked`:**

**Jinu:** Do my bag strap.

**Narrator:** He does her bag strap. She looks at it with her head on one side.

**Jinu:** It's crooked. I love it. Did you know a turnip was the first thing I ever delivered wrong? A whole
sack, to a man who'd ordered parsnips. I'll tell you on the stairs. That one's mine to tell. I'm the one who
got it wrong.

**After `pq08_opened`:**

**Jinu:** Do the back of my hand.

**Ilo:** Yours?

**Jinu:** Mine. Where I'll see it when I'm sorting.

**Narrator:** He stamps the back of her hand. She does not wash it off that night.

_Keepsake: **Ilo's turnip stamp print, "OUTSIDE ONLY"**, on Jinu's bag strap, which hangs on the cart's rail
(after `pq08_sealed` or `pq08_asked`). Sets `pq08_done`._

### PQ-08: what it sets and where it pays off

| Sets                   | Meaning                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `pq08_open`            | Jinu sorted the split bundle                                    |
| `pq08_bulletin_posted` | The gust warning is public, under the station master's own name |
| `pq08_sealed`          | Marda's letter delivered sealed; Jinu never learns what it said |
| `pq08_asked`           | Delivered sealed; Marda chose what to share                     |
| `pq08_opened`          | Opened first and owned to Marda                                 |
| `pq08_done`            | The quest is closed (any of the three)                          |

- **Trust:** the lower camps rise with `pq08_bulletin_posted`; a little more with `pq08_sealed` or
  `pq08_asked`.
- **The bulletin and the finale.** `pq08_bulletin_posted` is the bible's "public dispatch help improves
  finale warnings": in MQ-13 the heights' boards already carry verified notices, so the warning relay there
  starts a step ahead. It is never needed.
- **Banter:** the bible's Jinu and Riko exchange "after PQ-08" ("Are you allowed to tell me?" / "I asked.")
  needs `pq08_sealed` or `pq08_asked`.
- **MQ-12, Scene 12.2:** the boy and the button ("Then I know something about your letter and I'm going to
  stop there"). It plays for every Jinu.
- **MQ-15, Scene 15.4:** "resolved" (the sealed letter across a half-door) after `pq08_sealed` or
  `pq08_asked`; "open" ("I should ask him first") after `pq08_opened` or if never opened.

---

## PQ-09 — The Lesson You Keep (Riko)

**Theme card:** PQ-09, The Lesson You Keep

Themes: responsibility, equality. The woman who taught Riko how not to be hurt also taught company guards how
to hold a striker by the wrist until the pay clerk had gone home. It is the same hold. Seli is funny and proud
and sorry, and Riko loves her. From the owner's list, this quest carries: good people can cause harm.

- [x] No nation, element or culture stereotype (nothing here is about benders and non-benders; the holds were
      used by non-bender guards on non-bender workers)
- [x] Every valid party, non-benders included, has a real route through
- [x] No instant forgiveness or absolution (forgiveness stays Riko's to give, and no route makes her give it)
- [x] The other side's reasons are shown (Zan's account: the holds replaced sticks; the recruiter's hands
      are laid-off rail workers)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Copper Orchard, in Scene 6.4 of MQ-06, with Riko in the party. **Other people:** Seli, she/her,
52, Riko's former teacher, now a travelling theatre's movement coach; Haro, he/him, 36, the troupe's manager;
Zan, he/him, forties, a porter at Pear Halt; Tamsa, she/her, forties, an orchard picker; a recruiting sergeant
from Commonworks Security. **What the party may know:** everything through MQ-05, including the Marshal's name
and his instruction.

**Planted earlier:** the practice board by the guards' shelter at the quarry (`reason.riko`: "She told me it
was for keeping people from getting hurt").

> **The opening, already written (Act III, Scene 6.4):**
>
> **Narrator:** A travelling theatre has pitched on the old passenger platform. Backstage, a grey-haired woman
> is moving an actor's arm.
>
> **Movement coach:** No. Thumb behind the elbow. Then turn at the wrist. You're not hurting him. You're
> making it so he can't hurt you.
>
> **Narrator:** Riko has stopped in the wings. She knows that sentence. She has said it to herself, above a
> laundry, with the sheets drying round her.
>
> **Riko:** Seli.
>
> **Seli:** ...You've grown into your shoulders. Did you come for the play? It's dreadful. You'll love it.

### Scene R.1 — The Lamp at Midnight

**Shown:** played. **Where:** the old passenger platform, with a painted flat of a drawing room and a real
mantelpiece somebody has carried out of a house. _Sets `pq09_open`._

**Narrator:** The play is called "The Lamp at Midnight". A sign on an easel says so, and adds: "A Mystery in
Four Acts and a Thunderstorm."

**Narrator:** On stage, a Steward in a false moustache and an Inspector in a real one are having a fight to
the death. The Steward has a soup ladle. The Inspector has a brass candlestick.

**Narrator:** The Steward swings. He misses by the length of a cart. The Inspector falls over anyway, and
then remembers, and gets up, and waits to be hit.

**Haro:** No, no, no! He's meant to be a desperate man, not a man waiting for a tram! Seli, do something with
them!

**Narrator:** Haro has a hand puppet on his left hand, a small Inspector. It shakes its head whenever he
does.

**Seli:** They're frightened of the ladle. Give me a minute. Riko. Come up here. They'll believe it when they
see it done.

**Riko:** I'm watching.

**Seli:** You're standing at the back with your arms folded, counting the mistakes. I know how you watch.
Come up.

**Narrator:** Riko comes up. Seli holds the ladle out to her, handle first.

**Seli:** You're the Steward. Slowly. I'll be the Inspector.

**Narrator:** Riko swings the ladle at a walking pace. Seli steps inside it, puts a thumb behind Riko's
elbow, and turns. Riko turns with it and comes out the other side with Seli's wrist in her hand.

**Narrator:** Neither of them has had to think. They have done this a thousand times, in a room that smelled
of soap. The two actors have stopped breathing.

**Seli:** There. See? Nobody was hit, and you believed all of it. She's better than I am now. Don't tell her.

**Narrator:** Riko lets go of the wrist. She is very nearly smiling.

**Riko:** The Steward did it.

**Haro:** I beg your pardon?

**Riko:** Your murder. It was the Steward. It's the end of the first act, and it's the Steward.

**Haro:** That is not revealed until the thunderstorm!

**Riko:** Is it the Steward?

**Narrator:** The puppet looks at Haro. Haro looks at the puppet.

**Haro:** ...How?

**Riko:** In the first scene the candlestick's on the left of the mantel. He comes in, he goes out, and it's
on the right. Nobody else has crossed the room. And the Inspector's just picked it up off the right.

**Inspector:** It's always been on the right.

**Riko:** It was on the left ten minutes ago. I was at the back. Counting the mistakes.

**Narrator:** Haro walks to the mantel. He moves the candlestick to the left. He stands looking at it like a
man who has been shown a hole in his roof.

**Seli:** I told you you'd love it.

**Riko:** It's terrible.

**Seli:** You'll be here all four acts.

**Riko:** I'll stay for the thunderstorm.

> **If Kaya is in the party —**
> **Kaya:** You worked that out from a candlestick?
>
> **Riko:** Anyone would.
>
> **Kaya:** I was watching the ladle. Sit by me for the rest. Don't tell me things. Just nod when I'm wrong.

### Scene R.2 — A Seli wrist

**Shown:** played. **Where:** the same platform. A man in a grey coat has come up the steps at the far end
and stood watching.

**Narrator:** He is sixty or so, heavy in the shoulders, with a recruiting board under his arm and a
sergeant's braid sewn back onto a coat that had lost it.

**Recruiting sergeant:** That's a Seli wrist. I'd know it across a parade yard. Thumb behind the elbow. I had
that put on me in the drill shed at the Tin Cut, twenty-two years ago, by a woman half my size.

**Narrator:** Seli has not turned round.

**Seli:** You'll have the wrong woman. I coach actors.

**Recruiting sergeant:** You coached forty of us. We never had to raise a stick again after you. Best
instructor the companies ever paid for.

**Recruiting sergeant:** The Marshal's office is taking on. Rail hands, mostly, that the new signals have
put out. They're willing, but they're clumsy. They want teaching. It's paid, Seli. It's a roof.

**Seli:** I said you have the wrong woman.

**Narrator:** The sergeant looks at her for a moment, and then at Riko, and tips his cap to them both
equally.

**Recruiting sergeant:** I'm at the Halt till Friday, with a table. In case the right woman turns up.

**Narrator:** He goes down the steps. Haro has discovered something that urgently needs doing behind the
drawing room.

**Riko:** Who were the forty?

**Seli:** Is that a question, or is it the start of a hearing?

**Riko:** It's a question.

**Seli:** It was employment. Quarry companies hired gate guards. Gate guards hit people with sticks, because
nobody had shown them anything else. I showed them something else. A man who's held gets up afterwards. A
man who's been hit with a stick sometimes doesn't.

**Riko:** You told me you'd taught dancers.

**Seli:** I taught dancers as well.

> **If `reason.riko` is set —**
> **Riko:** There's a board at Stoneback Quarry, by the guards' shelter. Somebody's chalked your holds on it.
> Thumb behind the elbow, turn at the wrist. I'd know your drawing of a hand anywhere.
>
> **Seli:** I've never been to Stoneback.
>
> **Riko:** No. Somebody you taught, taught somebody. It's still your hand. It was ten paces from a barred
> door with people behind it.
>
> **Narrator:** Seli sits down on the edge of the stage. She is, for a moment, not standing like a teacher.

**Seli:** You were fifteen, and somebody had you by the hair in the lane behind the laundry. Do you want
that undone? Because I taught you with the same hands.

**Riko:** No. I don't want it undone.

**Seli:** Then what are you asking me?

**Riko:** I don't know yet. I'm going to go and find out what it was like from the other end. Then I'll ask.

> **If Bo is in the party —**
> **Bo:** The Tin Cut. I knew men who worked the Tin Cut. They didn't talk about the gate.
>
> **Riko:** Did you ask?
>
> **Bo:** No. I should have, I think.

### Scene R.3 — Two who were taught

**Shown:** found (two conversations at Pear Halt, either order; both are needed before R.4).

**Zan, the porter.**

**Narrator:** Zan is stacking pear crates on the Halt's platform, three high, each one squared to the one
below.

**Zan:** Seli? She's here? I'll be blowed. I'd shake her hand.

**Zan:** I was nineteen and they gave me a stick and a gate. First week, I broke a man's collarbone, because
he came at me and I didn't know anything else. I was sick behind the hut.

**Zan:** Then she came. Six weeks. After that I never hit anybody again, not once in fourteen years. You take
hold, you wait, they get tired, they go home. I've had drunks off the line that way, here, since. Two of them
would be dead under a wagon.

**Party:** And the people you held?

**Zan:** They went home. That's what I'm telling you. Every one of them went home.

**Tamsa, the picker.**

**Narrator:** Tamsa is up a ladder in the third row of the orchard. She comes down when she hears the name,
slowly, and stands with the picking bag held in front of her.

**Tamsa:** I was one of the forty. One of three women. Seli said I had the best wrists in the shed.

**Tamsa:** The year of the short pay, the hewers at the Tin Cut drew up a complaint. They were going to put
their marks on it in the yard, at noon, with the pay clerk there to see, so it would be on record.

**Tamsa:** We were told: no sticks, no bruises. Twelve of us went into that yard and took eleven hewers by
the wrist. Just held them. From noon until the clerk had packed his table and gone. Four hours.

**Tamsa:** Nobody had a mark on them. That was what we were for. No bruise, so nothing to show a magistrate.
And the paper never got marked, because you can't make your mark when somebody's got your hand.

**Narrator:** She shifts the picking bag.

**Tamsa:** Mine was a woman. She didn't fight. She kept saying her boy was at the school gate, and who'd
fetch him. She said it for four hours. I can do her voice.

**Tamsa:** He was all right. A neighbour took him. I went and found out, after. I handed my coat in the next
morning.

**Party:** Zan says everyone went home.

**Tamsa:** They did. Zan's not lying. They all went home, and they never got their pay, and nobody could
say a hand had been laid on them.

> **If Tenzo is in the party —**
> **Tenzo:** Would you say that again, in front of people? If they asked?
>
> **Tamsa:** I've said it to the trees for twenty years. I'd say it to people. Nobody's asked.

### Scene R.4 — The sign-up table

**Shown:** played, into a fight. **Where:** Pear Halt's platform and the old passenger platform beside it.

**Narrator:** The recruiting sergeant has set up his table on the Halt, under the lamp. Nine rail hands are
in a line in front of it. None of them looks eager.

**Narrator:** Beside the sergeant's elbow there is a tin box. It is full of small brass discs on strings.

**Rail hand:** That's my bunk token. That's all our bunk tokens. You had them off the wagon steward this
morning.

**Recruiting sergeant:** The company bunk wagon's for company employees. You're not employees. The signals
put you out, lad. I didn't. Sign with Security, and you're an employee again by supper, and your token's back
round your neck.

**Rail hand:** And if I don't?

**Recruiting sergeant:** Then tonight you sleep wherever you like. It's a big orchard.

**Narrator:** Three grey-coated hands stand behind him. Six months ago they were rail hands too. One of
them has taken hold of a boy at the front of the line: thumb behind the elbow, gently, to steady his hand
toward the pen.

**Narrator:** Seli has come to the edge of the passenger platform. She is watching that thumb.

**Recruiting sergeant:** There she is. Tell them, Seli. Tell them it's honest work. There's a clause in your
old contract, you know. You never did serve out your term. I've not mentioned it to anyone.

> **If Lin Mei is in the party —**
> **Lin Mei:** That is the third thing he has said that was shaped like a kindness.

**Riko:** Let go of his arm.

**Recruiting sergeant:** He's only being helped to the pen.

**Riko:** I know exactly what he's being. Let go.

**Fight:** the two platforms and the track between. **Against:** the recruiting sergeant and three Security
hands (staves; no bending). The hands use Seli's hold: a unit they take hold of cannot move on its next turn
unless an ally beside it breaks the hold, or it is Riko. They yield at low health.

**Win:** a party member stands on the token box at the end of a round, **or** the recruiters are beaten
down. **Lose:** the whole party is down, or six rail hands have signed (one signs each round while a
Security hand stands beside the table).

**Fight barks:**

- **Recruiting sergeant:** "Nobody's being hurt! Look at them! Not a mark on anyone!"
- **Riko** (the first time she breaks a hold): "Thumb's the weak part. She taught you the first half."
- **Seli** (round two, from the platform edge): "Turn toward the thumb! All of you in that line! Turn toward
  it, don't pull! I never taught the getting out. I'm teaching it now. Turn!"
- **Rail hand** (breaking free on Seli's call): "It worked! It just came off!"
- **A Security hand** (yielding): "I've got no bunk either if I lose this coat. You know that? Neither of us
  has."
- **Haro** (from behind the drawing room): "Is this in the play? It's better than the play!"

> **If Wen is in the party —** (on her first turn)
> **Wen:** The box! It's a tin box with a hasp. Somebody stand on it and I'll have it open before he's turned
> round.

**After a win:**

**Narrator:** The sergeant sits down heavily on his own table. Nine brass tokens go back round nine necks.
The boy at the front is rubbing his elbow and looking at Seli as if she had done a conjuring trick.

**Recruiting sergeant:** I'd nine to bring in by Friday. Now it's me that's short. You think the Marshal
keeps a sergeant who comes back with an empty board?

**Riko:** No. I think he finds another one. Go and sit by the stove in the foreman's hut. Hesh will have
something to say to you about bunks.

**Narrator:** One of the grey-coated hands has taken his coat off. He folds it and puts it on the table, on
top of the board.

**CARRY ON (the fight is lost):**

**Narrator:** Six rail hands sign. They do it quickly, not looking at anyone, and each gets a token back
round his neck. The sergeant boxes the other three tokens and takes the box with him.

**Narrator:** Three rail hands are left on the platform with nowhere to sleep. Grandmother Ansa comes out of
her door with a lamp.

**Grandmother Ansa:** There's the waiting room. It's not been a waiting room for a year. It'll remember how.

**Narrator:** Seli was shouting something from the platform edge throughout. In the noise, only the boy at
the front heard it. He is turning his own wrist over, slowly, trying it.

_Sets `lost_halt_recruiters`. The fight pays its XP either way. The six contracts are contested later by
Hesh and the yard foreman; three hands sleep in the Halt's waiting room. The vote still plays._

### Scene R.5 — VOTE: what you left out

**Shown:** played. **Where:** backstage, among the painted flats, after the Halt has gone quiet.

**Narrator:** Seli is sitting on a property trunk with a costume across her knees, sewing a button back on.
Her hands are not quite steady. She does not look up.

**Seli:** You went and asked them.

**Riko:** Zan would shake your hand. Tamsa can still do a woman's voice from twenty years ago.

**Seli:** Tamsa. Best wrists in the shed.

**Riko:** She said you'd said so.

**Narrator:** Seli pulls the thread tight.

**Seli:** I taught them so that nobody would be hit. I believed that. I still half believe it. And every
company that hired me knew exactly what a guard who leaves no bruise is worth. I knew they knew. I took the
money, and I told myself I was only teaching hands.

**Seli:** Then I taught you, for nothing, above a laundry. I think that was me trying to do it once the
right way round.

**Riko:** It was the right way round. It kept me alive.

**Riko:** You taught me where a body is vulnerable. You left out what that makes us responsible for.

_(The two sentences above are the bible's, word for word.)_

**Seli:** Are you asking me something, or telling me what I am?

**Riko:** I'm asking. I asked for a seat. You keep offering me a demonstration.

**Narrator:** Seli puts the costume down.

**Seli:** If I stand up in front of the yard and say I trained the Tin Cut forty, the troupe drops me by
morning. Haro's fond of me. He's fonder of being booked. And that sergeant's clause is real.

**Riko:** I know.

**Seli:** So what is it you want?

> **If Jinu is in the party —**
> **Narrator:** Jinu has been standing by the flats with her mouth shut, which is not usual. She catches
> Riko's eye, taps her own lips once, and goes out to the platform to wait.

**VOTE — What does Riko ask of Seli?**

- **Testify, and teach only in the open.** Seli gives her account to the yard and the Halt, in front of
  Tamsa and Zan, signed. After that she teaches on this platform, in daylight, to anyone, with the getting
  out taught first, and with the yard and the Halt deciding who learns what. _Sets `pq09_testify_program`._
- **Report it herself, and stop being Seli's student.** Riko takes Tamsa's account and Zan's (and the board at
  Stoneback, if `reason.riko` is set) to the yard and the Halt without Seli. It will be heard. The two of them
  will not be what they were. _Sets `pq09_reported`._
- **Take the apology, here, between the two of them.** Seli says it to Riko. Tamsa carries the public case
  herself, since she is willing; Riko is not part of it. _Sets `pq09_private`._

Footer: "Tamsa's account is heard on all three. What changes is who stands beside her."

**If `pq09_testify_program`:**

**Narrator:** Seli says it the next morning, on the old passenger platform, with the painted drawing room
still standing behind her. The yard is there. Half the Halt is there. Tamsa stands at the front with her
picking bag. Zan stands at the back.

**Seli:** My name is Seli. For eight years I trained gate guards for four quarry companies. I taught them to
hold a person without marking them. I knew what that was worth to the people who paid me.

**Seli:** I trained the twelve who held the Tin Cut hewers on the day of the complaint. One of them is
standing there. She handed in her coat the next day. I didn't hand in anything for another six years.

**Narrator:** She does not ask anyone for anything. When she has finished, she stays where she is.

**Tamsa:** That's all true. I was there for it.

**Narrator:** Zan turns his cap round in his hands.

**Zan:** I never broke another bone after you. I want that said as well. It doesn't cancel hers. I only
want it said.

**Hesh:** It's said. Both are down. Coach, if you teach on this yard, you teach where I can see it, and you
teach the letting go before the taking hold. Any hand who wants it. Guild card or none.

**Seli:** Yes.

**Narrator:** That afternoon there are thirteen people on the platform. Seli walks down the line turning each
wrist a little. Riko walks down it behind her.

**Seli:** She'll correct me. Let her. She's better than I am now.

**Riko:** I'm not correcting you. I'm watching.

**Seli:** I know how you watch.

**Narrator:** Riko has not said that anything is forgiven. She stays for the whole class.

**If `pq09_reported`:**

**Narrator:** Riko goes to the foreman's hut alone. She puts it on the table in order: what Tamsa said, what
Zan said. She gives the name.

> **If `reason.riko` is set —** **Narrator:** Last, she draws the board at Stoneback from memory: a thumb, an
> elbow, a wrist.

**Hesh:** That's your own teacher.

**Riko:** It is.

**Narrator:** Hesh's eyebrows go up, and come down again slowly.

**Hesh:** Then it'll be heard properly. I'll see to that.

**Narrator:** When she comes back to the platform, the troupe is striking the drawing room. Seli is folding
a costume into the trunk.

**Seli:** You didn't give me the chance to say it myself.

**Riko:** I gave you from yesterday until this morning. You sewed a button on.

**Narrator:** Seli shuts the trunk.

**Seli:** Your left shoulder drops when you turn. It always did. Nobody else will tell you.

**Riko:** I know it does. Thank you.

**Narrator:** They do not say goodbye. Riko watches the troupe's wagon as far as the bend. She stands the
way she was taught to stand.

**If `pq09_private`:**

**Narrator:** Seli says it there, among the flats, to Riko and nobody else.

**Seli:** I'm sorry. I lied to you about the dancers. I let you think those hands had only ever been for
keeping people safe. And I'm sorry about the woman at the Tin Cut, though it isn't you I owe that to.

**Riko:** No. It isn't.

**Riko:** I'll take the part that's mine. I can't take hers for her. Nobody gave me that to hand out.

**Narrator:** Next morning Tamsa goes up to the foreman's hut by herself, with her picking bag, and says it
to Hesh and the yard foreman. It is written down. Riko is not in the room.

**Narrator:** Afterwards Tamsa passes her on the platform steps.

**Tamsa:** I'd thought you might be in there.

**Riko:** I thought about it.

**Tamsa:** Mm. Well. It's said now. You've got her wrists, you know. I saw it yesterday.

**Narrator:** She goes back to her ladder. Riko stays on the steps for some time.

### Scene R.6 — The thunderstorm

**Shown:** found (the platform, that evening). Plays after `pq09_testify_program` or `pq09_private`; after
`pq09_reported` the troupe has gone and only the easel is left, with the playbill.

**Narrator:** "The Lamp at Midnight" plays to thirty people on pear crates. The candlestick is on the left of
the mantel. The Steward and the Inspector fight, and it is quite convincing, and the ladle is dented.

**Narrator:** Riko is in the back row with her arms folded. During the thunderstorm, which is Haro shaking a
sheet of tin, she leans forward with her elbows on her knees and does not lean back.

**Haro:** Well? You knew the ending.

**Riko:** I knew the ending.

**Haro:** And?

**Riko:** The Steward's glove was on the wrong hand in act three. Fix that. Otherwise it was dreadful, and
I'd see it again.

**Narrator:** Haro gives her a playbill. In the margin, in his own hand, he has written: "Candlestick: LEFT.
(R. was right.)"

_Keepsake: **the playbill for "The Lamp at Midnight"**, with Haro's note, folded in the cart's shelf (on
every route; after `pq09_reported` Riko takes it off the easel herself). Sets `pq09_done`._

### PQ-09: what it sets and where it pays off

| Sets                   | Meaning                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `pq09_open`            | Riko went up on the stage                                            |
| `lost_halt_recruiters` | Six rail hands signed; three sleep in the waiting room               |
| `pq09_testify_program` | Seli's public account, and open teaching under the yard and the Halt |
| `pq09_reported`        | Riko reported it without her; the two part                           |
| `pq09_private`         | A private apology; Tamsa carries the public case alone               |
| `pq09_done`            | The quest is closed (any of the three)                               |

- **Trust:** Pear Halt and the rail crews rise with winning R.4 and with `pq09_testify_program` or
  `pq09_reported`.
- **Seli afterwards.** After `pq09_testify_program` she is one of the people on the platform in Scene 15.4,
  at the back, being corrected like everyone else. After the other two she is not there.
- **MQ-12, Scene 12.2:** Riko teaches Hua one release, and "the lesson's no good if you leave off the end".
  It plays for every Riko.
- **MQ-15, Scene 15.4:** "resolved" (eight people on the platform) after `pq09_testify_program` or
  `pq09_reported`; "open" ("You could come. I'd show you one thing.") after `pq09_private` or if never
  opened. See "Open, for the owner", item 8.

---

## PQ-10 — The Right to Repair (Wen)

**Theme card:** PQ-10, The Right to Repair

Themes: equality, responsibility. Wen drew a regulator with a lever on it, so that the person standing next to
the machine could always let the pressure go. Somebody took the lever off and put a keyhole there, and they
had a reason. Wen cannot fix the reason by being clever at a bench. She has to write three steps that a
stranger can follow, and then stand with her hands in her pockets while the stranger does them. From the
owner's list, this quest carries: good people can cause harm.

- [x] No nation, element or culture stereotype
- [x] Every valid party, non-benders included, has a real route through (a bucket line, a shout and a pump
      handle; nothing here is bent)
- [x] No instant forgiveness or absolution (Ruda does not thank her; she corrects the card)
- [x] The other side's reasons are shown (the keyhole was fitted after a man was scalded by a lever pulled
      without warning)
- [x] The theme is never stated outright
- [x] Absent heroes are never voiced

**Opens:** at Emberwatch, in Scene 3.1 of MQ-03, with Wen in the party. Scene W.1 plays there. Scenes W.2 to
W.5 play wherever Edda is: Emberwatch through Act II, then the Copper Orchard scrap workshop or Causeway's
public workshop (the bible: "concludes in Copper Orchard or Causeway"). At Emberwatch and the Orchard they
play at her bench. In Causeway, W.2 and W.4 play on Tanner's Stair, at Ruda's own pump (owner, 2026-11-17). **Other people:** Edda
Coil, she/her, 47, the public-workshop trainer; Ruda, she/her, fifties, a district pump mechanic; a company
fitter. **What the party may know:** at W.1, only MQ-02. The later scenes have a line or two written twice,
for before and after MQ-04. Nothing here says the network is unsafe; this quest is about one regulator and
who may touch it.

**Planted earlier:** her own regulator inside the Driller, with the manual release taken out
(`reason.wen`: "Without it, this thing stops when somebody else decides it should").

> **The opening, already written (Act II, Scene 3.1):**
>
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

### Scene W.1 — Both. No. Safe.

**Shown:** played. **Where:** Edda's bench at Emberwatch. _Sets `pq10_open`._

**Wen:** Both.

**Narrator:** Edda waits.

**Wen:** No. Not both. Safe. Safe first. Ask me again in an hour, when I've stopped wanting both.

**Edda:** I'll ask you again in a week. An hour's optimistic.

**Narrator:** Wen unbuckles the cuff of her repair gauntlet. Folded inside it, flat and soft, is a paper
napkin with a tea ring on one corner. She spreads it on the bench beside the open regulator.

**Narrator:** It is a drawing, in pencil, gone over in ink. A valve, a spring, a chamber. On the side, drawn
larger than anything else, a lever with a round knob. An arrow points to it. The arrow is labelled, with
three underlines: "ANYONE."

**Edda:** You carry that about?

**Wen:** It's the only copy that's got the lever the right size. The patent clerk made me draw it smaller.
He said it "dominated the figure".

**Narrator:** They look from the napkin to the regulator on the bench. Valve, spring, chamber: the same.
Where the lever should be, a brass plate with a keyhole, and six words stamped round it: "Authorised
service only. Do not force."

> **If `reason.wen` is set —**
> **Wen:** There was one of these in the drilling machine at Stoneback. No lever. I had my arm in its housing
> once it had stopped. There was nothing in there anybody could have pulled while it ran.
>
> **Wen:** I'd drawn that machine a way to be stopped by whoever was closest. Somebody took the way out and
> left the closest person standing there.

**Edda:** Go on, then. You've got that look. What do you want to build?

**Wen:** A retrofit. A lever that bolts on over the plate and drives the key shaft from outside. No cutting.
You could fit it in ten minutes. Give me the bench till morning.

**Edda:** You can have the bench. Not the drawer.

**The next morning.**

**Narrator:** Wen has not slept. On the bench is a bolt-on release lever, filed and blued, with a spring
detent that clicks. It is a beautiful piece of work.

**Wen:** Watch. Pressure up. And...

**Narrator:** She closes her gauntlet round the lever and pulls. The regulator sighs. The gauge needle drops
to nothing.

**Wen:** There! Half a second! And it resets itself, look, the detent...

**Edda:** Lovely. Now me.

**Narrator:** Edda takes hold of the lever with her bare hand, and pulls. Nothing happens. She pulls with
both hands. The lever moves the width of a hair.

**Edda:** Stiff.

**Wen:** It's not stiff. It's sprung, so it can't be knocked by accident. It only needs a firm...

**Narrator:** She stops. She looks at her own right hand, in its steel gauntlet with the geared knuckles.

**Wen:** ...I sized the spring to the gauntlet.

**Edda:** You did.

**Wen:** So it can be stopped by anyone. Provided anyone is me.

**Narrator:** Edda says nothing. She opens the bench vice a turn, to be ready.

**Wen:** It works. Now we ask who can stop it. I should have asked that before I picked up a file. Softer
spring. Longer handle. And a different colour from everything else on it, so it can be found in the dark.
Give me an hour.

**Edda:** That one I'll believe.

**Narrator:** An hour later the lever is long, plain, and painted red with what was left in a tin. It is not
beautiful. Edda pulls it with two fingers.

> **If Riko is in the party —**
> **Wen:** Riko. Try it with your eyes shut. Cold. No warning.
>
> **Narrator:** Riko finds it by feel, and pulls it.
>
> **Riko:** It works. I had to hunt for it. You've only painted the side you were standing on.
>
> **Wen:** ...Red all the way round. Pass me the tin.

> **If Tenzo is in the party —**
> **Tenzo:** Can you pull it with a wet hand? A hand that's had oil on it?
>
> **Wen:** Why would... oh. Because that's what a hand has on it. Hold on. I need a cross-cut on the knob.

### Scene W.2 — Ruda's pump

**Shown:** played. **Where:** Edda's bench, at Emberwatch or the Orchard scrap workshop. **In Causeway** this
scene is not played at the bench: play "Scene W.2, in Causeway" below instead. The two never both play.

**Narrator:** A woman of fifty or so has come in with a canvas roll of tools under her arm. The roll has
been patched with three different cloths. She puts it on the bench and it lands with a weight that says
every tool in it is a good one.

**Edda:** Ruda. Low-landing pumps, nineteen years. Ruda, this is the one whose napkin it is.

**Ruda:** Is it.

**Narrator:** She looks at the napkin for some time. Then at the red lever. Then at Wen.

**Ruda:** The pump on Tanner's Stair's got one of your regulators in it now. It sticks. Every cold morning
since they fitted it. I can hear what's wrong from the top of the stair. It's the spring seat. It wants a
quarter turn and a drop of oil.

**Wen:** That's all it would want. That's exactly what it would want.

**Ruda:** I know. And I've a spanner in that roll older than the company that fitted it. But there's a plate
on it that says "Authorised service only", so I stand there. The fitter with the key comes on a nine-day
round. If it sticks on the second day, forty houses carry water for a week.

**Ruda:** I mended that pump for nineteen years. Now I report it.

**Narrator:** She puts one finger on the napkin, on the word with three underlines.

**Ruda:** You sold them a regulator.

**Wen:** I did.

**Ruda:** Now give us the part where we get to say no.

_(The three lines above are the bible's, word for word.)_

**Wen:** I licensed it to a city workshop. They sold it on. I didn't put the plate there.

**Ruda:** I didn't say you put the plate there. I said give us the part.

**Narrator:** Wen picks up the red lever from the bench and holds it out. Ruda does not take it.

**Ruda:** That's a lever. I can make a lever. What I haven't got is leave to fit it, or anybody's word for
what happens when I pull it. Have you written that down anywhere? What to do, in what order?

**Wen:** I've started a manual.

**Narrator:** She has. It is under the napkin. It is thirty-eight pages long, in a hand that gets smaller as it
gets more excited, and it begins with the history of the pressure valve.

**Ruda:** I've got seven minutes of lamp oil and a pump that's screaming. Which page do I want?

**Narrator:** Wen turns the pages. She turns quite a lot of pages.

**Wen:** ...Thirty-three. And a bit of nineteen. And you'd need the diagram on six.

**Ruda:** Then it's not a manual. It's a book about you.

**Narrator:** Edda has found something to do at the other end of the workshop. Her shoulders are shaking
slightly.

> **After MQ-04 —**
> **Wen:** There's a lift wheel on the low landing that a child of eight can turn. The Director built that.
> And the same office signed off on a keyhole.
>
> **Ruda:** It's one office. I pump water under both ends of it.

### Scene W.2, in Causeway — The bucket line

**Shown:** played, with a job for the table's hands (the bucket line). **Where:** Tanner's Stair, on the low
landing: forty houses on one steep stair, with the district pump house half-way up. It replaces the bench
version of W.2 whenever the quest is picked up in Causeway.

**The bucket line (a build suggestion).** Each hero in the party takes a place on the stair. Full buckets come
up from the canal steps on the wall side and empties go down on the rail side, one tap to take and one to
pass. The lines below are said between buckets. Nothing can be failed: a dropped bucket is a wet step and
somebody laughing. The job ends when the cistern at the top door is full.

**Edda:** Ruda won't come to a bench today. Her pump's stuck. She's on Tanner's Stair with a bucket, and so
is everyone she knows. Take your lever. Take the napkin too.

**Narrator:** Tanner's Stair is forty houses on one steep stair. Half-way up is a pump house the size of a
cupboard, with its door open. The pump inside is not running. It is making a noise like a kettle that cannot
boil.

**Narrator:** A line of people runs from the canal steps to the top door, passing buckets hand to hand. There
is a gap in the line beside the pump house. A woman of fifty or so is standing next to the gap with her arms
folded. At her feet is a canvas roll of tools, patched with three different cloths.

**Ruda:** If you've come to look, look from in the line. Full ones up the wall side. Empties down the rail.
Mind the fourth step.

**Narrator:** A full bucket arrives in Wen's hands. She passes it up. Another one arrives.

**Wen:** That's one of mine. In there. The regulator.

**Ruda:** Is it.

**Narrator:** She looks at Wen for the length of two buckets.

**Ruda:** It sticks. Every cold morning since they fitted it. I can hear what's wrong from the top of the
stair. It's the spring seat. It wants a quarter turn and a drop of oil.

**Wen:** That's all it would want. That's exactly what it would want.

**Ruda:** I know. And I've a spanner in that roll older than the company that fitted it. But there's a plate
on it that says "Authorised service only", so I stand here. The fitter with the key comes on a nine-day
round. He was here eight days ago. It stuck the morning after.

**Ruda:** I mended that pump for nineteen years. Now I report it.

**Narrator:** Wen hands her bucket up the stair. She unbuckles the cuff of her gauntlet, takes out the
napkin, and holds it flat against the pump-house door with her thumb. It is just under the brass plate.

**Narrator:** Ruda puts one finger on the napkin, on the word with three underlines.

**Ruda:** You sold them a regulator.

**Wen:** I did.

**Ruda:** Now give us the part where we get to say no.

_(The three lines above are the bible's, word for word.)_

**Resident (from two steps down):** Bucket!

**Narrator:** Wen takes the bucket. She passes it up. The napkin stays on the door, held by Ruda's finger.

**Wen:** I licensed it to a city workshop. They sold it on. I didn't put the plate there.

**Ruda:** I didn't say you put the plate there. I said give us the part.

**Narrator:** Wen takes the red lever out of her satchel and holds it out. Ruda does not take it. She takes
the next bucket instead.

**Ruda:** That's a lever. I can make a lever. What I haven't got is leave to fit it, or anybody's word for
what happens when I pull it. Have you written that down anywhere? What to do, in what order?

**Wen:** I've started a manual.

**Narrator:** She has. It is in the satchel under the lever. It is thirty-eight pages long, in a hand that
gets smaller as it gets more excited, and it begins with the history of the pressure valve.

**Ruda:** I've got forty houses on a stair and a pump that's screaming. Which page do I want?

**Narrator:** Wen turns the pages with one hand. A bucket arrives in the other. She turns quite a lot of
pages.

**Wen:** ...Thirty-three. And a bit of nineteen. And you'd need the diagram on six.

**Ruda:** Then it's not a manual. It's a book about you.

**Narrator:** Somebody lower down the stair laughs. The laugh comes up the line with the next bucket.

> **After MQ-04 —**
> **Wen:** There's a lift wheel on the low landing that a child of eight can turn. The Director built that.
> And the same office signed off on a keyhole.
>
> **Ruda:** It's one office. I pump water under both ends of it.

> **If Bo is in the party —**
> **Narrator:** Bo has taken the place below the loose step, so that every full bucket goes over it in his
> hands and not in anybody else's.

> **If Sura is in the party —**
> **Sura:** I could have that cistern full in one go.
>
> **Ruda:** You could. And tomorrow, when you've gone? Take the bucket.

**Narrator:** The last bucket goes in at the top door as the lamps come on. Ruda picks up her tool roll. She
has not unrolled it all day.

**Ruda:** Edda's bench. After supper. Bring the book about you. I want the back of it.

### Scene W.3 — The key had a reason

**Shown:** played. **Where:** Edda's bench, in every place (in Causeway, the public workshop, that evening,
with Ruda come up from the stair). A man in a company fitter's coat has come in with a tool bag and a ring of
keys on a chain.

**Narrator:** He sees the red lever, bolted over the brass plate, and stops with his bag half off his
shoulder.

**Company fitter:** Oh, no. No, no. Who's fitted that? Take that off.

**Edda:** It's on a bench, Pol. It's not on a pump. Sit down and have it explained to you.

**Company fitter:** I don't need it explained. I know what it is. It's the old release. They took those off
for a reason, and I was there for the reason.

**Narrator:** He does sit down. He puts the ring of keys on the bench in front of him.

**Company fitter:** Winter before last. Upper landing, a pump with the lever still on. Somebody's lad saw the
gauge up high and did the sensible thing. Pulled it. Dumped the lot.

**Company fitter:** And a man was working on the outfall, thirty paces down the pipe, with his arm in it. Got
the whole charge, hot, up to the shoulder. He kept the arm. He was off work till spring.

**Company fitter:** The lad did nothing wrong. He did what the lever was for. Nobody'd told him to look down
the pipe first. So the office said: no more levers. One key, one trained hand. And nobody's been scalded
since.

**Narrator:** Nobody at the bench says anything. Wen has gone the colour of the napkin.

**Wen:** That was mine. That lever. I drew it so anybody could pull it.

**Company fitter:** You're the napkin? Well. Anybody did pull it.

**Wen:** I drew the lever. I never drew the man down the pipe. I never wrote "shout first". It wasn't on the
napkin. It wasn't anywhere.

**Ruda:** So they were right to take it off.

**Company fitter:** Thank you.

**Ruda:** And wrong to give the only key to a man who comes every nine days. No offence, Pol.

**Company fitter:** Some taken. I do sixty pumps.

**Narrator:** Wen has pulled the thirty-eight pages toward her. She turns them face down. On the blank back of
the last one she writes a large figure 1.

**Wen:** What should he have done? The lad. Before he pulled. Say it the way you'd shout it down a stair.

**Company fitter:** "Pressure!" And then you wait till somebody shouts "Clear!" back. And if nobody shouts,
you go and look.

**Narrator:** Wen writes it down.

### Scene W.4 — Hands in pockets

**Shown:** played (a repair in four steps, with one prompt; not a fight). **Where:** the bench, with a
regulator under pressure, at Emberwatch or the Orchard. Edda, Ruda and the fitter are watching. This is the
bible's "demonstrate a safe repair under observation". **In Causeway** play "Scene W.4, in Causeway" below
instead.

**Narrator:** There is a card on the bench now, the size of a hand. It has four lines on it in Wen's
largest printing.

**The card:**

> TO STOP IT
>
> 1. Shout "PRESSURE!" Wait for "CLEAR!" No answer? Go and look.
> 2. Pull the red lever down.
> 3. Wait for the hiss to finish.
> 4. That's all. Now it's safe to open.

**Wen:** I'll do it once, slowly, and say each one. Then Ruda does it, and I don't touch anything.

**Narrator:** Wen does it once. She shouts "Pressure!" in a workshop with four people in it. Edda, gravely,
shouts "Clear!" back. The lever comes down. The hiss finishes. Wen opens the housing, gives the spring seat
a quarter turn and a drop of oil, and closes it.

**Wen:** Now you. I'm putting my hands in my pockets.

**Narrator:** She puts her hands in her pockets. The gauntlet does not fit in a pocket. She holds it behind
her back instead.

**Narrator:** Ruda reads the card through once, without hurrying. She shouts "Pressure!" The fitter shouts
"Clear!" before he can stop himself.

**Narrator:** Ruda pulls the lever. Then, while it is still hissing, she takes a spanner from the patched
roll and sets it on the housing nut, ready.

**Narrator:** That is not the order on the card. Wen's elbows move.

**PROMPT (the decider; two choices):**

- **"That's step four. You're on three."**
- **Say nothing. Watch what she does.**

**If "That's step four. You're on three.":**

**Wen:** Wait. That's four. You're still on three. It hasn't finished...

**Ruda:** I've not turned it. I've set it. So that when the hiss stops, I'm not hunting in a roll for a
spanner with a housing full of nothing but spring. Do you want me to do it your way, or do you want to see
how it's done on a stair in the dark?

**Narrator:** Wen shuts her mouth. It takes both hands, behind her back.

**Wen:** The stair. Sorry. Go on.

**If "Say nothing. Watch what she does.":**

**Narrator:** Wen bites the inside of her cheek. The hiss finishes. The spanner is already on the nut.
Ruda has the housing open two breaths sooner than Wen did.

**Wen:** You set the spanner during the hiss.

**Ruda:** You've time. It's only standing there otherwise. And then you're not fishing about with it open.

**Both:**

**Narrator:** Quarter turn. A drop of oil. Closed. Ruda lets the pressure back up and listens with her head
on one side. The regulator ticks over as quietly as a clock.

**Ruda:** There. That's Tanner's Stair, that sound. I've not heard it since they fitted the plate.

_Cutscene candidate (suggested, not yet seen by the owner), from here to the fitter taking the pencil: [cutscenes.md](cutscenes.md), CS-PQ10 (a proposal, pending the trial). The scene works played exactly as written._

**Narrator:** She picks up Wen's card and a stub of pencil. Between step two and step three she writes, in
square capitals: "SET YOUR SPANNER NOW." She hands it back.

**Narrator:** Wen reads it. Her own printing, and then somebody else's in the middle of it. It is better.

**Wen:** That's five steps.

**Ruda:** It was always five. You'd missed one.

**Company fitter:** I'd add a sixth. "Chalk the date on the housing." So the next hand knows it's been
done.

**Narrator:** Wen holds out the pencil to him.

### Scene W.4, in Causeway — Forty houses watching

**Shown:** played (a repair on the real pump, in steps the table carries out, with one prompt; not a fight).
**Where:** the pump house on Tanner's Stair, the next morning. It replaces the bench version of W.4. This is
the bible's "demonstrate a safe repair under observation", and the observers are the stair.

**What the table does (a build suggestion).** Three things, with their hands: send the shout down the stair
and listen for the answer; walk down and look when no answer comes; and work the pump handle at the end. The
steps cannot be done out of order, and nothing can be failed.

**Narrator:** It is a cold morning, and the pump is stuck again. People have come out onto their steps with
empty buckets. Nobody has started a line yet. They are waiting to see.

**Narrator:** Wen's red lever is bolted over the brass plate. The fitter is standing beside it with his keys
on their chain and his arms folded.

**Company fitter:** It's my day for this stair anyway. I'd have had it going by noon.

**Ruda:** After eight days of buckets.

**Company fitter:** ...Once. With me stood here. And it comes off again after, till somebody above me says
different. I'm writing down that I said so.

**Edda:** Write it large, Pol.

**Narrator:** Wen holds up a card the size of a hand. It has four lines on it in her largest printing. She
reads it out to the stair.

**The card:**

> TO STOP IT
>
> 1. Shout "PRESSURE!" Wait for "CLEAR!" No answer? Go and look.
> 2. Pull the red lever down.
> 3. Wait for the hiss to finish.
> 4. That's all. Now it's safe to open.

**Wen:** I'll do it once, slowly, and say each one. I'm only stopping it. I'm not opening it. It isn't my
pump.

**Wen:** The outfall's at the canal steps, thirty paces down. So the shout has to get there.

**Party:** PRESSURE!

**Narrator:** The shout goes down the stair, door to door. "Pressure!" "Pressure!" A very small child on the
ninth step shouts it twice.

**Narrator:** From the upper steps: "Clear!" From the middle: "Clear!" From the canal steps, nothing.

**Wen:** No answer.

**Narrator:** She looks at the lever. She looks at the card in her own hand.

**Wen:** "Go and look." I wrote that. Come on.

_(The party walks down the stair to the outfall.)_

**Narrator:** At the bottom, a boy of about ten is sitting on the outfall pipe with his feet in the canal,
scrubbing a bucket. The water is loud down here. He has not heard a thing.

**Party:** We're about to let the pump go. Where you're sitting.

**Boy:** This pipe? It never does anything.

**Narrator:** He gets off it all the same, and takes the bucket with him. Then he puts his hands round his
mouth.

**Boy:** CLEAR!

**Narrator:** It is the loudest one of the morning. It goes all the way back up.

> **If Nilak is in the party —**
> **Narrator:** Nilak has looked at the boy's arms and his feet, from habit. There is nothing wrong with any
> of them. He nods to himself and follows the others back up the stair.

**Narrator:** Wen pulls the red lever down. The pump sighs. Down at the canal steps, a fat jet of steam and
hot water comes out of the pipe where the boy was sitting, and stops.

**Narrator:** Nobody on the stair says anything for a moment. Then the hiss finishes.

**Wen:** That's all. Now it's safe to open. Ruda. I'm putting my hands in my pockets.

**Narrator:** She puts her hands in her pockets. The gauntlet does not fit in a pocket. She holds it behind
her back instead.

**Narrator:** Wen lets the pressure back up, so that Ruda starts where she did. Ruda reads the card through
once, without hurrying.

**Ruda:** Pressure!

**Narrator:** This time it comes back from every step, top to bottom, and last of all from the canal:
"CLEAR!" The fitter has shouted it too, before he could stop himself.

**Narrator:** Ruda pulls the lever. Then, while it is still hissing, she takes a spanner from the patched
roll and sets it on the housing nut, ready.

**Narrator:** That is not the order on the card. Wen's elbows move.

**PROMPT (the decider; two choices):**

- **"That's step four. You're on three."**
- **Say nothing. Watch what she does.**

**If "That's step four. You're on three.":**

**Wen:** Wait. That's four. You're still on three. It hasn't finished...

**Ruda:** I've not turned it. I've set it. So that when the hiss stops, I'm not hunting in a roll for a
spanner with a housing full of nothing but spring. Do you want it done your way, or the way it's done on
this stair in the dark?

**Narrator:** Wen shuts her mouth. It takes both hands, behind her back.

**Wen:** The stair. Sorry. Go on.

**If "Say nothing. Watch what she does.":**

**Narrator:** Wen bites the inside of her cheek. The hiss finishes. The spanner is already on the nut. Ruda
has the housing open before Wen has finished breathing in.

**Wen:** You set the spanner during the hiss.

**Ruda:** You've time. It's only standing there otherwise. And then you're not fishing about with it open.

**Both:**

**Narrator:** Quarter turn. A drop of oil. Closed. Ruda lets the pressure back up and listens with her head
on one side. The pump ticks over as quietly as a clock.

**Ruda:** There. That's Tanner's Stair, that sound. I've not heard it since they fitted the plate.

**Narrator:** She nods at the pump handle, and at the party.

**Ruda:** Go on. Somebody's got to find out if it's wet.

_(The party works the handle. Water comes at the spout on the third stroke.)_

**Narrator:** Water comes at the spout. The first bucket under it is the boy's. After that there is a queue,
and it moves.

_Cutscene candidate (suggested, not yet seen by the owner), from here to the fitter taking the pencil: [cutscenes.md](cutscenes.md), CS-PQ10 (a proposal, pending the trial). The scene works played exactly as written._

**Narrator:** Ruda picks up Wen's card and a stub of pencil. Between step two and step three she writes, in
square capitals: "SET YOUR SPANNER NOW." She hands it back.

**Narrator:** Wen reads it. Her own printing, and then somebody else's in the middle of it. It is better.

**Wen:** That's five steps.

**Ruda:** It was always five. You'd missed one.

**Company fitter:** I'd add a sixth. "Chalk the date on the housing." So the next hand knows it's been
done.

**Narrator:** Wen holds out the pencil to him. He writes it. Then he chalks the date on the housing himself,
and unbolts the red lever, and gives it to Ruda and not to Wen.

**Company fitter:** Till somebody says different.

**Ruda:** Somebody's about to.

### Scene W.5 — VOTE: who gets the card

**Shown:** played. **Where:** the bench (in Causeway, the pump-house step, with the stair still filling
buckets).

**Edda:** So there's a lever anybody can fit and a card anybody can read. I asked you something a while
back.

**Wen:** Whether I wanted to prove it was good, or make it safe.

**Edda:** And?

**Wen:** It wasn't good. Not all of it. It had a lever and no shout. I'd rather know that than be right.

**Edda:** Then it's a question of where the card goes. I can see three ways and I've a favourite, which I'm
not telling you.

**Ruda:** Print it. Give it to everyone. Nail it to every pump.

**Company fitter:** And the first fool who pulls it without reading the card? No. Let the company fit it,
properly, on terms.

**VOTE — How does Wen's fix go out?**

- **An open manual.** The card and the lever drawing are printed and given to anyone who asks. Edda's
  benches teach it in person, on a real regulator, to whoever turns up. Nobody owns it. Nobody can be made
  to answer for a pump where it was fitted badly. _Sets `pq10_open_manual`._
- **A district trust.** The design is held by a board in each district: residents, a mechanic, one company
  seat. The board keeps a list of who has been taught, and a key on a hook that any of them may take.
  Slower to set up. It can say no. _Sets `pq10_trust`._
- **Licensed to Commonworks, on written terms.** The company fits the lever to every regulator it runs. In
  return, in writing: anyone standing at a machine may stop it; any district may call in its own mechanic;
  every service is chalked on the housing and entered on a public sheet. Fastest, and widest. It rests on
  the company keeping its word, with the terms where everyone can read them. _Sets `pq10_licensed`._

Footer: "Tanner's Stair gets its quarter turn on all three." _(After W.4 in Causeway, where it has had the
quarter turn already: "Tanner's Stair gets its lever back on all three.")_

**If `pq10_open_manual`:**

**Narrator:** Edda runs the card off on the workshop's hand press: two hundred, on whatever paper there is.
Some are on the backs of old shipping bills. Wen signs none of them.

**Edda:** You don't want your name on it?

**Wen:** I want Ruda's line on it. Mine's the bit with the mistake in.

**Narrator:** The first class is the next morning. Nine people come, and a boy who has only come to work
the hand press. By noon the boy has pulled the red lever three times and shouted "Pressure!" a good many
more than three.

**Company fitter:** I can't stop you. I'm not sure I'd want to. But when one goes wrong, they'll come to me
and say "who fitted this?", and there'll be no name.

**Ruda:** There'll be a date chalked on it. That was your step.

**If `pq10_trust`:**

**Narrator:** It takes four evenings and a great deal of tea. At the end there is a board of five for the
low landing: three residents, Ruda, and a chair for the company, which the fitter sits in with his coat on.

**Narrator:** On the wall by the door there is a hook. On the hook is a key, cut by Edda from the fitter's
own, with his leave. Beside it is a list of names in different hands: everyone who has done the five steps
with Ruda watching.

**Company fitter:** I'll be asked why I let you copy it.

**Ruda:** Tell them the board voted. Four to one. You can say you were the one.

**Company fitter:** ...I'll say it was three to two. I'd like somebody to have been on my side.

**Narrator:** Wen has been asked to put her name at the top of the list. She writes it sixth, after the
five who learned it before she left.

**If `pq10_licensed`:**

**Narrator:** The terms take a page. Wen writes them, and Ruda crosses out every word a clerk could hide
behind. "Reasonable" goes. "Where practicable" goes. "Authorised" goes twice.

**The terms, as posted:** "1. Whoever is standing at the machine may stop it. 2. Any district may send for
its own mechanic. 3. Every service is chalked on the housing and written on the sheet by the door. 4. If
the company breaks 1, 2 or 3, this licence ends and the drawing is everybody's."

**Company fitter:** They'll not like four.

**Wen:** Four's the only one that makes the other three true. Without four, it's the napkin again. A good
idea, with somebody else holding it.

**Narrator:** The fitter takes the page up the valley on his round. It comes back nine days later with a
stamp, and with no word changed. The sheet goes up by the door of Tanner's Stair pump house. The first
entry on it is in Ruda's capitals.

> **After MQ-04 and before MQ-09 —**
> **Narrator:** Under the stamp, in a neat hand in a hurry, is one line: "Term 4 stays. A stop nobody can
> reach is not a stop. V. Sen."
>
> **Wen:** She agreed to it.
>
> **Ruda:** She agreed to one pump house. Count the rest before you frame that.

> **After MQ-09 —** **Narrator:** The page goes up the valley under Ruda's name and the district's. Wen's is
> left off it, at her own asking: a name on a wanted poster is no help to a pump house. It comes back stamped
> by a clerk, with no word changed and nothing added.

### Scene W.6 — The napkin

**Shown:** found (Edda, at the bench, as the party leaves). Plays after any of the three.

**Narrator:** Edda is holding the napkin up to the window, by its corners.

**Edda:** Do you want this back?

**Wen:** It's got the lever the right size.

**Edda:** It has. It's also got no shout on it, no spanner, no date, and a tea ring.

**Narrator:** Wen takes the napkin. She takes the pencil from behind her ear. Under the arrow marked
"ANYONE", in the small space that is left, she writes: "see card".

**Wen:** There. Now it's right.

**Narrator:** She pokes the pencil into Edda's drawer to put it back. There is a snap. The pencil comes out
again with something on the end of it.

**Narrator:** It is a mousetrap with a paper flag on it. The flag says "told you".

**Edda:** I said at Emberwatch that the drawer bites. That flag's been waiting for you ever since.

_Keepsake: **the first printed stop card, with Ruda's line pencilled in the middle**, tucked into the cart's
tool roll. Sets `pq10_done`._

### PQ-10: what it sets and where it pays off

| Sets               | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `pq10_open`        | Wen answered Edda's question                                  |
| `pq10_open_manual` | The card and drawing are free to all; Edda's benches teach it |
| `pq10_trust`       | District boards hold the design, a key and a list             |
| `pq10_licensed`    | Commonworks fits it under four posted terms                   |
| `pq10_done`        | The quest is closed (any of the three)                        |

- **Trust:** Causeway's low landing rises with all three; Commonworks staff rise with `pq10_licensed` and
  fall a little with `pq10_open_manual` (wary, not hostile).
- **"Extra local maintainers improve crisis recovery" (bible).** With `pq10_done`, MQ-13 and MQ-14 have
  named hands at the district stop wheels who already know the five steps: one fewer round to bring gate
  two's regulator under control in Scene 14.2. It is never needed.
- **MQ-09, Scene 9.1:** Wen's line ("I made the thing the ruler was holding") plays for every Wen.
- **MQ-12, Scene 12.2:** Wen's board of seven steps, and Min, who makes it eight. After this quest it is the
  second time someone has added a step, and she says "Then it was always eight and I missed one" as someone
  who has heard it said to her.
- **MQ-15, Scene 15.4:** "resolved" (Min moves the lever to the other side) after any of the three; "open"
  (the stop procedure written larger than the title) if the quest was never opened or was left before W.5.

---

## Community trust from these quests

Read by lines, never a lock (see Act II).

| Community                  | Trust rises with                                      | Trust falls with                    |
| -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| Reedglass                  | `pq06_published`; `pq06_negotiated`                   | nothing                             |
| The Bellweather sanctuary  | `pq07_kept`; `pq07_handed_over`                       | nothing (Sena's trust is in M.5)    |
| The lower camps            | `pq07_handed_over` (a little); `pq08_bulletin_posted` | nothing                             |
| Pear Halt                  | winning R.4; `pq09_testify_program`; `pq09_reported`  | nothing                             |
| Rail and maintenance crews | `pq09_testify_program`; `pq09_reported`               | nothing                             |
| Causeway's low landing     | `pq10_open_manual`; `pq10_trust`; `pq10_licensed`     | nothing                             |
| Commonworks staff          | `pq10_licensed`                                       | `pq10_open_manual` (wary, a little) |

## How each scene is shown

At most one cutscene candidate per quest, and none is relied on: every one also works played. None of these
five is approved. Two have suggested shot lists in [cutscenes.md](cutscenes.md) (CS-PQ06, CS-PQ10), pending
the trial in issue #810; why the others are left as played is at the end of that file.

| Quest | Found    | Played             | Cutscene candidate                                                                                          |
| ----- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| PQ-06 | L.5      | L.1 to L.4         | L.1: the map with no way home on it (CS-PQ06, suggested). It plays in every game; L.4's pencil on one route |
| PQ-07 | none     | M.1 to M.5         | None now. The flag and the bison are each seen on one route in three                                        |
| PQ-08 | J.3, J.5 | J.1, J.2, J.4      | None now. J.4's letter is close to Kaya's, which is the better one                                          |
| PQ-09 | R.3, R.6 | R.1, R.2, R.4, R.5 | None now. R.1's hold is two bodies, which the board can show                                                |
| PQ-10 | W.6      | W.1 to W.5         | W.4: Ruda's capitals going into the middle of Wen's card (CS-PQ10, suggested)                               |

## Decided (owner, 2026-11-17)

The owner read the edit pass's proposals on 2026-11-17. What he decided for this file, and where it is written:

1. **Which takeaway Wen's card names.** "Good people can cause harm" (her lever scalded a man, and the keyhole
   had a reason), in place of a second "saying sorry isn't the end of it". Approved as exchanged. Cards only.

2. **PQ-07's vote is a real choice.** Nima no longer glimpses the sky bison from the switchbacks. The two
   responsible routes now cost different things. Keeping the watch himself: he sees the bison leave at first
   light, the size of his thumbnail, but he has told Kip no, the carrier sat out the gusts by herself, and
   Hobb is back on the next night. Handing over: Kip has the fourth night and the carrier is walked up, but
   the east face is the wrong side of the ridge and he sees nothing. The vote text says both costs. Sena
   sets out the board game on both. Hobb's "Was it big?" is asked on all three routes, with three answers
   ("About so", a thumbnail; "I don't know. I was round the other side of the cliff"; and the old one).

3. **PQ-10's middle is off the bench in Causeway.** There, W.2 is played in a bucket line on Tanner's Stair,
   with the pump stuck and Ruda standing at it, and W.4 is played on the real regulator with forty houses
   watching. The table sends the shout down the stair, walks down to the outfall when no answer comes (a boy
   is sitting on the pipe), and works the pump handle at the end. Wen only stops the pump; Ruda opens it.
   The fitter allows the lever once and takes it off again, so the vote in W.5 still decides how it comes
   back. The bench versions stay for Emberwatch and the Orchard. W.3 and W.5 are unchanged but for where
   they stand. This closes open item 12.

4. **Dabi is now Twig.** Fenn's pupil in PQ-06 sat too close to Sabi, the rigger of SF-2.1. She is Twig in
   every line, on the flood post ("Twig born."), on the petition (in capitals) and on the keepsake (Twig's
   map of four paces). It is what the marsh calls her, like Wick and Latch, and no other name in the scripts
   sounds like it. Nothing else about her changed.
5. **Cutscene candidates.** None of this file's five is approved. Two are suggested, with shot lists in
   [cutscenes.md](cutscenes.md): the map with no way home on it (L.1, CS-PQ06) and Ruda's capitals in Wen's
   card (W.4, CS-PQ10). Both wait on the trial in issue #810.

## Open, for the owner

Everything below is written into the scripts as recommended, per the standing instruction.

1. **Names I invented.** Twig (Fenn's pupil; Dabi in the first draft); Hobb (the caretaker with bad knees) and Kip (the lower-camp
   runner); Ilo (the "young courier" of Scene 8.2), Marda and her daughter Chun; Zan and Tamsa (Seli's former
   trainees), and "the Tin Cut" for the quarry where they served; Ruda (the pump mechanic) and Pol (the
   company fitter); the play's title, "The Lamp at Midnight". All were checked against the cast lists and the
   identity locks. Recommend: approve.
2. **The child's line in PQ-06.** The bible gives "You drew our house." / "Yes." / "You didn't draw a way to
   get home." without a speaker for the first and third. I gave them to a child, Twig, and put DLG-06 with
   Fenn after it, since DLG-06 is set "after walking the omitted path". Recommend: approve.
3. **A corridor clerk in DLG-06.** DLG-06 has only Lin Mei, Fenn and Bo. I bring a clerk onto the plank after
   its last line so that the three choices have somebody to be made to, and so that the other side (a
   maintenance boat every nine days, and a map that says nobody lives here) is a person. No line of DLG-06 is
   changed. Recommend: keep.
4. **The sky bison.** The bible says only "a more exciting rumor". I used a wild sky bison resting on the
   landing meadow, since the bible lists visiting sky bison at Bellweather and the companion has one
   (Brindle) in a side story. Mine is unnamed and wild, so it does not use up Brindle's scene. Recommend:
   approve; if you would rather keep bison for that side story alone, the rumour can be a lantern-kite
   launch from the ridge with one line changed.
5. **Nima's Act I crate was the east shelter's roofing felt.** The outline says the ribbon pays off at
   Bellweather but not how. I made the diverted crate the felt for the roof he walked off, so what he brings
   back is news about the very thing he left. Recommend: approve.
6. **What is in Marda's letter.** The bible says "a changed family plan, not the final villain's secret".
   Mine: her daughter has a permanent ferry desk and a room at Saltstep, and wants Marda to come down before
   the spring tide. Jinu had guessed a wedding, which is the same kind of guess that cost a maid her place
   six years ago. Recommend: approve.
7. **The tram operator posts the bulletin himself.** The bible says "publish the official bulletin through a
   verified public copy". I had Jinu deliver it to its addressee and ask him to copy it out under his own
   name and the station seal, so that a courier never publishes somebody's post. This is fixed on every
   route (`pq08_bulletin_posted`); the vote is only about the private letter. Recommend: keep.
8. **Riko's "resolved" closing scene and `pq09_reported`.** Scene 15.4's resolved version (eight people on a
   platform, Riko correcting every wrist) reads as the public class. I let it play after
   `pq09_testify_program` (with Seli at the back of the line) and after `pq09_reported` (Riko's own class,
   without her). After `pq09_private` the "open" version plays, because the bible says that route gives
   "less direct participation". Recommend: approve this mapping.
9. **PQ-09's fight** is a Commonworks Security recruiter holding laid-off rail hands' bunk tokens until they
   sign. His three hands were rail hands six months ago. The hold mechanic (a held unit cannot move unless an
   ally breaks it, or it is Riko) is a build suggestion. Seli teaching the release aloud in round two is the
   scene's turn, and should survive however the fight is built. Recommend: keep.
10. **Why the keyhole exists (PQ-10).** The bible gives Commonworks no reason for replacing Wen's lever with a
    key. I gave it one: a boy pulled a lever correctly and scalded a man thirty paces down the pipe, because
    nobody had told him to shout first. It makes the fitter right about something, and it gives Wen something
    of her own to own (the napkin had a lever and no warning). It reveals nothing about the network.
    Recommend: approve.
11. **A line from Veyra in PQ-10.** On the `pq10_licensed` route, after MQ-04 and before MQ-09, the returned
    terms carry one line in her hand: "Term 4 stays. A stop nobody can reach is not a stop. V. Sen." It is in
    character (the bible: she "treats Wen seriously", and she builds controls a short person can reach) and
    Ruda undercuts it at once. The edit pass reworded it: the first draft had her say "I should have asked for
    it myself", which concedes more than she will until MQ-14, and it could play after MQ-09, when she has
    refused the shutdown and the party is on the posters. It is the only place in these three files where an
    antagonist is given new words. Recommend: keep, but it is your call; cutting the box loses nothing else.
12. **Where PQ-10 plays.** The bible says it "concludes in Copper Orchard or Causeway". I tied scenes W.2 to
    W.6 to Edda's bench rather than to a place, since the act scripts have Edda at Emberwatch in MQ-03, in
    Causeway in MQ-05 and MQ-09, and the bible has her at the Orchard annex. A table can finish the quest
    wherever it next finds her. Recommend: approve. _Decided (owner, 2026-11-17):_ approved, and in
    Causeway W.2 and W.4 move to Tanner's Stair.
13. **One line owed elsewhere.** After `pq06_negotiated`, Lin Mei's dated promise falls due at the assembly
    (MQ-10). Act IV has no line for it. Recommend adding to Scene 10.4, when it is built: **Lin Mei:** "Before
    the corridor's business is heard: sheet fourteen was mine. I marked nine homes temporary and left a path
    off. I said I would say so here. Fenn has it in my hand." If the date passes with Lin Mei out of the
    party, Fenn reads the page out herself.
14. **Where the documents disagree (PQ-06 to PQ-10):**
    - **MQ-13, Scene 13.4.** Lin Mei says the school path "isn't on any map. I walked it." After
      `pq06_published` or `pq06_negotiated` it is on one. Recommend a variant when 13.4 is built: "It's on one
      map. Mine. Fenn drew the line." If the quest was never opened she has not walked it, and the line should
      go to Fenn. _Decided:_ 13.4 gets a variant; the act scripts' edit applies it.
    - **Sena's line.** The bible prints "I did help someone." / "I believe you. I also needed to know you
      weren't under a fallen roof." as PQ-07's line; Act III already spends it in the opening (8.2). I do not
      repeat it; M.1 builds on it (the bowl left on the scaffold, the thatch dug through by hand).
    - **Nima's line "I said I'd be here. This time that is the whole plan."** is the bible's sample of his
      serious voice (CH-07), and Act IV uses it in 12.2. I kept it out of this quest so that it lands once.
    - **The young courier.** Act III leaves him unnamed and has him say "I say we open the lot." The bible
      calls him "another courier". I named him Ilo and made him second-month, so that Jinu is teaching, not
      scolding.
    - **PQ-09's timing.** The bible says "after MQ-04"; Act III opens it in MQ-06, which is always after
      MQ-04. No conflict in practice.
    - **Haro.** The companion's troupe manager (NPC-22) belongs to SQ-12 in Causeway, and the companion says
      the troupe "visits Copper Orchard" later, with Riko's story "handled separately". I have him introduce
      nothing and behave as someone the party may or may not know; if SQ-12 was played, one greeting line
      should be added when this is built.
    - **PQ-10's opening and the reveal ladder.** Edda's shipped opening line mentions "the vanes" at MQ-03,
      before the party has seen one. It is a word, not a reveal, and I have kept the quest to pumps and
      regulators until after MQ-04.
15. **Edit pass (2026-11-17): three names changed.** Bodi is now Zan (Bo and Bo-shan already need a naming
    lock), Ruvi is Tamsa (she alternated with Riko, line by line) and Hana is Chun (beside Hanru, Haro and
    Hua). Still close to an existing name, and left for you: Marda beside Mira, Miri and Meren. (Dabi, who
    sat beside Sabi, the rigger of SF-2.1, is now Twig: see "Decided".)
16. **Edit pass: the tram bulletin.** The station clerk stamped it nine days ago and sent it up the line in
    the up-bag, which is how a bulletin he had handled could sit unread; and the fourth of the test dates is
    the day the car hung (Scene 8.1).
