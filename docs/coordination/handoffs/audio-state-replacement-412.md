# Audio on game-state replacement (#412)

## 2026-11-04: repair the native precondition; retire discarded feedback (#421)

This continues draft PR413 on its existing branch. Claude's merged PR422
explicitly handed PR413/416 back after the full browser run found a real test
precondition race. Current main `2ba71a01` was merged with a merge commit;
published history is preserved. Claims 6608675053 (#412) and 6618662312 (#421)
were amended and verified before edits. No competing PR was opened.

Hosted run41733375995 retained two failures of the software-WebGL load case:
zero footsteps remained over 250 ms ahead by the time automation activated Load.
Mobile WebKit also rejects `page.mouse.wheel`. The corrected fixtures dispatch
the same wheel delta through the actual canvas listener. A one-shot native
source observer queues real Load/Quit controls in a microtask after a real
footstep is scheduled over 250 ms ahead, before another automation/render trip.
Native start/stop, audio/game clocks and cue deadlines are forwarded unchanged.
No sound is fabricated or delayed. Trigger walks click the actual destination;
ordinary warm-up/fresh walks still require their legal target position. Quit's
immediate state/ownership witness is captured before later title input.

The original future-source count, 250 ms threshold, retirement-before-deadline,
32 ms release, state equality, fresh-audio/backend checks and 60/360 s budgets
remain intact. Callback errors and completion are additionally asserted.
This is scheduling evidence; it does not establish physical input or listening.

The independent wait/save/load pass found #421: a loaded Dawn save retained the
discarded world's “Morning arrives.” toast. Loading now clears old feedback
before installing the saved state, so dismissal callbacks see the old game and
loaded-world feedback survives. Explicit toast clear also resets dedup memory;
otherwise a rapid second load could suppress its new “Game loaded.” message.
Normal duplicate suppression, toast lifetimes and dismissal callbacks remain.
The focused unit regressions failed before these respective corrections.

The new native feedback case proves the old Morning node is present, laid out
and unfaded at the actual load boundary, then disconnected synchronously. Its
immediate snapshot contains the fresh load confirmation; complete save equality,
journal time and a fresh Morning control remain checked. Real Wait/Load menu
controls run in one task, avoiding expiry between automation trips. Historical
visible Dawn/Morning contradiction and the original locator-only probe failure
are retained separately outside Git.

Exact final commit/tree, clean `ci:local`, native results and actual hosted jobs
are recorded in the PR and external receipts under
`/workspace/avatarrpg-env/audio-state-412/gate-correction20261104/`. A passing
earlier build does not transfer to a changed source tree. No new media, game
assets, shared helpers, budgets, configuration, dependencies or art are committed
by this correction. Main's merged evidence remains inherited history. WebKit
cannot run locally without a prohibited install; no hosted dispatch, merge,
deployment, formal approval or physical-device acceptance is claimed.

The sections below retain historical results for their named revisions.

Owner: Codex root. Branch: `codex/audio-state-replacement-412`, based on main
`207c8eec`. Initial session `audio-reset412-20261103`; Quit correction session
`audio-quit412-20261103` continues the same draft PR413.
Claim: [6608675053](https://github.com/jaredbahr/Avatarrpg/issues/412#issuecomment-6608675053),
amended and read back before the correction's edits.

Loading a save discarded animation while its future footsteps remained scheduled
on Web Audio. The four App replacement paths now clear animation and reuse
AudioBus's existing close/unlock behavior together: load, new game, enter village
preview and leave village preview. Its existing fade retires the previous
context, context identity rejects stale sample decodes, and volume/unlock guards
apply to the replacement context.

A subsequent check of published candidate `ee525061` found the omitted Quit path:
Pause → Quit to title → Quit during an ordinary long walk returned to title with
state null, Animator still busy, and two old decoded footsteps 1.470 and 3.720
seconds ahead. The same old context remained running with gain about 0.189.
This belongs to the existing discarded-state issue, so no competing issue or PR
was opened. Only the private PauseMenu Quit path additionally clears animation
and closes audio after modal dismissal, before discarding state and starting the
title. It opens no replacement context until a later gesture.

AudioBus, its existing 32 ms release, sample bytes, state/save data, the four App
reset paths' correction and ordinary cue timing are preserved. This adds no
public API, pause-policy change or event-listener redesign.

## Behavioral and native validation

The original real-AudioBus App regression has four reset failures and four Off
controls before its fix, then all eight passing. The two new real-PauseMenu Quit
cases fail on `ee525061`, then pass with the correction: queued warm sound,
pending cold decode, title ordering, no eager context, fresh gesture/audio and
Sound Off. All eight old cases remain unchanged. Together with six existing bus
cases the focused result is 16/16. Original failures remain outside Git.

The original Save/Load native fixture forwards real source start/stop, master
output automation and context close. Its paired main207c baseline fails on both
backends; the initial candidate passes both (producer `7f02a596`), retiring output
at 32 ms before the earliest old steps at about 549/721 ms, preserving the exact
stationary save and fresh subsequent walk. Its original diagnostic runs remain
separate. This is historical evidence, not a substitute for the final revision's
checks.

The new Quit fixture observes the actual old context/master before activating
Quit. It stores the immediate title/state/animation/ownership result and native
retirement evidence BEFORE later title input or Load can retire the old context
and mask the missing cleanup. A real future old footstep must exist. Successful
native automation's effective completion must precede each old deadline, with
its existing 32 ms fade measured from the native call. Actual title Load restores
the full saved state; a subsequent mouse walk schedules fresh audio in a new
running context. Raw evidence is attached even on failures.

Both fixtures use normal game/audio clocks, actual mouse walks and Save/Load
controls. The critical Pause/Load/Quit activations use the actual DOM controls
synchronously so software WebGL does not consume the queue on automation round
trips. Setup uses API new-game/debug village entry; this is not an uninterrupted
campaign, physical-input or audible-quality claim. Canvas and WebGL keep their
existing 60/360-second budgets, with zero local retries. No assertions, budgets
or gates are relaxed.

Root owns final clean-head `ci:local`, the combined native Save/Load and Quit
checks, an expected-head nonforce update of this SAME published PR, and actual
hosted job inspection. Exact final identities and results belong in the PR and
issue claim. Do not transfer an earlier check result to a different tree or push
while a required gate is red.

Reports/media remain outside Git at `/workspace/avatarrpg-env/audio-state-412/`,
with the correction's raw evidence in `quit-correction/`. Discoveries and retained
setup failures stay in `audio-load-discovery/` and `quit-audio-discovery/` next to
that directory. No binary attachment capability is claimed. WebKit/Safari/PWA,
physical Surface/iPad, audible quality and owner acceptance remain open. Keep
draft; no readiness, merge, deployment, dispatch, installation, art, paid request
or security change is authorized.
