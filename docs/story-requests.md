# Story requests: when to file an issue or call the writing pass

**Status: DRAFT for Jared (the writing pass, 2026-11-19).** For every agent that builds Four Nations Tactics and is not the
writing pass. It says what counts as story work, what you may do yourself, and exactly when to file an issue or
send a message. It adds detail to the one-owner rule (Jared, 2026-11-14); it does not replace it.

The short version: **build from what is written, never write or reword story yourself, never let a missing line stop
your build, and always leave a trail.**

## What counts as story work

The writing pass owns these. If your task needs one, you do not write it.

- Anything a character says, and all narration.
- Names: people, places, shops and brands, items, enemies, abilities and anything else a player reads as a name.
  (Ids, keys, file names and other code names are not story names.)
- Descriptions and flavour: look-at and examine lines, journal and lore text, item and shop blurbs, signs and
  notices in the world, end cards and recaps.
- Facts about the world: who lives where, how old someone is, what happened and when, what a place is for.
- Scene plans and cutscene shot lists: what happens in a scene, in what order, and who is present.
- **Any change to an existing line:** rewording, trimming to fit, splitting, merging, reordering or cutting.
- Choosing between two story documents that disagree.

Where it lives: `src/content/story/`, `src/content/regions/`, `src/content/journal.ts`, the names and descriptions in `src/content/` (characters, enemies, abilities, maps, residents), and story strings in `src/app/` (end cards, recaps, objectives).

Sources, in order: `docs/story-bible.md` (its owner-decision sections win), then `docs/story/the-common-current-bible.md`, `docs/writing-guide.md`, the scripts in `docs/story/scripts/` and the place facts in `docs/story/ba-dan-places.md`.

## What you may do yourself (Jared, 2026-11-19)

1. **Fix a typo or a spelling slip** in existing text, without changing what the line says.
2. **Write plain interface wording:** buttons, menus, settings, error messages, control prompts such as "Press E to
   talk". If the words would sound different coming from a different character, they are story.
3. **Write a marked placeholder** so your build can go ahead: `PLACEHOLDER (story): <what is needed>`. Say what the line is for, not what it
   should say.
4. **Copy a line from a script word for word.** No rewording and no trimming. If it is in a script, use it as it
   stands and you need no issue.

## What to do, by situation

| Situation                                                                                                                                           | What you do                                                                                             | Issue?                      | Message?                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- |
| The line you need is in a script                                                                                                                    | Copy it word for word                                                                                   | No                          | No                               |
| You need words that do not exist                                                                                                                    | Placeholder, say so in your PR, keep building                                                           | Yes                         | Only if blocked                  |
| A written line does not fit (too long for the box, the scene changed, a prop moved)                                                                 | Keep the line in, or a placeholder if it cannot display. Say so in your PR. **Never trim or reword it** | Yes                         | No                               |
| You need a fact or a name the documents do not give                                                                                                 | Build round it with a placeholder                                                                       | Yes                         | Only if blocked                  |
| Two story documents disagree                                                                                                                        | Do not choose. Build to the source that ranks higher above                                              | Yes                         | No                               |
| You found a continuity error, a stale document or a line that contradicts a decision                                                                | Leave it as it is                                                                                       | Yes                         | Yes, if players can see it today |
| Your change alters **what happens** in a scene (cutting a beat, adding or removing a choice or a vote, changing who is present, changing an ending) | **Stop that piece.** Carry on with the rest of your task                                                | Yes                         | Yes                              |
| You are about to build a scene                                                                                                                      | Check open pull requests and issues first for a writing-pass draft of the same scene                    | No                          | No                               |
| You have an idea for the story                                                                                                                      | Do not build it                                                                                         | Yes, marked as a suggestion | No                               |
| A playtest note from Jared is about story or wording                                                                                                | Do not act on the wording                                                                               | Yes, quoting him            | No                               |

"Blocked" means you cannot finish the task you were given without the answer. A placeholder on screen is not
blocked.

## How to file a story issue

One issue per scene, place or character, not one per line. Title it **"Story: ..."** and label it `agent:claude`.

Give the writing pass what it needs to write the line without opening your code:

1. **What you are building**, with the issue or pull request number and the branch.
2. **Each thing needed**, as a list. For every line: its id or key; who speaks, or that it is narration; where the
   player sees it (speech box, sign, journal, card); when it shows and under what condition; who is present; what
   the player already knows at that point; and any length limit.
3. **What you have put in meanwhile:** the placeholders, by id.
4. **Whether you are blocked**, and what on.
5. **Anything you noticed** that the writing pass should know: a document that disagrees, a line that no longer
   fits the picture.

## When to send a message as well

File the issue first, every time: an issue is still there when no writing session is running. Then send a message
only if:

- you are blocked now; or
- a line players can see today is wrong; or
- your change would alter what happens in a scene.

Send it to the Claude Code session titled **"Writing pass"** (find it with the session list tool), give the issue
number and say in one or two sentences what you need. If there is no such session, the issue is enough: carry on
with placeholders and say in your pull request what is waiting.

## What comes back

- **Lines** arrive as a story PR with a theme card, or as a pull request against your branch when your work has not merged yet. Every
  changed line is listed before and after.
- **Small facts** (a minor name, who lives in which house, a look-at line) the writing pass decides and lists for
  Jared to overrule. You may build from them.
- **Big ones wait for Jared's yes:** a new named character, anything that touches a reveal, an ending or a death,
  and any change to what happens in a scene. Until then the text is a draft; build from it only if Jared has said
  to ship it.
- The writing pass changes words. It does not change your code, ids or layout unless you ask it to.

## Two examples from this project

- The Ba Dan blockout added three props that needed look-at lines. It shipped each with the placeholder, told the writing pass which node ids they were and what each prop shows, and the lines arrived as a PR against its branch (#875, #882).
- Mira's table was built twice by two sessions, once with a table vote and once without (#805, #807). Removing or adding a vote changes what happens in a scene. That is a "stop and call" case.

## Notes for this repository

- **Hero lines:** every line for a hero other than the scene's own is guarded on that hero being in the party, and an absent hero is never voiced. If you add a `branchWhen` gate for a hero, the words still come from the script.
- **Ids:** a story issue should name the node ids you created; the writing pass keeps them. A retired id needs a row in `src/content/idAliases.ts`.
