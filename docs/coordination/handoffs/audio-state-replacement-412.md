# Audio on game-state replacement (#412)

Owner: Codex root, session `audio-reset412-20261103`. Branch:
`codex/audio-state-replacement-412`, based on main `207c8eec`.
Claim: [6608675053](https://github.com/jaredbahr/Avatarrpg/issues/412#issuecomment-6608675053).

Loading a save discarded animation while its future footsteps remained scheduled
on Web Audio. A normal-clock Canvas reproduction restored the exact stationary
save at 3,7 while three old step sources remained scheduled 0.827–2.327 seconds
later. This is scheduling evidence; audible and physical-device quality are not
claimed.

The four whole-state reset paths now clear animation and reuse AudioBus's
existing close/unlock behavior together: load, new game, enter village preview
and leave village preview. Its existing fade retires the previous context,
context identity rejects stale sample decodes, and volume/unlock guards apply to
the replacement context. AudioBus itself, asset bytes, state/save data, scene
behavior and ordinary cue timing are unchanged.

## Verification and continuation

The new App regression uses the real audio bus with a native-context stand-in,
including a warm future step, a pending different sample, fresh cues and Sound
Off across all four paths. Before the change, four reset cases fail while four
Sound Off controls pass. After the change, all eight pass together with the
existing bus and App reward tests (27 total).

The dedicated browser fixture observes and forwards real Web Audio start/stop
calls. It uses the normal game clock, mouse walking and Save controls; its
Pause → Load → slot activations run synchronously through the existing DOM
controls so software WebGL does not spend the whole walk between automation
round trips. It requires a real future old-state step at replacement, its
cancellation, exact loaded state, idle animation and fresh audio from a subsequent
mouse walk. These DOM activations are not physical-input acceptance. Setup uses
a normal new-game roster and debug entry to the village, not an uninterrupted
campaign.

Paired native validation uses the unchanged main207c production build and one
identical final fixture. Both baseline cases fail (five stale Canvas cues, three
WebGL cues). Both candidate cases pass: the captured old master reaches zero at
32 ms, before the earliest pending cue at about 549 ms / 721 ms respectively.
Exact loaded state and idle animation, actual backends, a fresh subsequent walk
and no browser errors are checked. Native producer is `7f02a596`; source and E2E
bytes remain identical in the final revision. Root inspected both rendered
stills. Independent SOL source and fixture review found no remaining blocker;
two observer timing flaws were corrected before the paired final run, with the
original failed run retained. No assertions, budgets or retries were weakened.

Root owns exact clean-head `ci:local`, one draft publication and actual hosted
job inspection; exact final identities/results belong in the PR. Do not push
while a required check fails or transfer an earlier result to a different tree.
See the issue claim and PR for final exact identities and results.

Review media and generated reports remain outside Git under
`/workspace/avatarrpg-env/audio-state-412/`; the initial discovery and its two
retained off-screen-target setup failures are under
`/workspace/avatarrpg-env/audio-load-discovery/`. No binary attachment upload is
claimed. WebKit/Safari/PWA, physical Surface/iPad, audible quality and owner
acceptance remain follow-ups. No merge, deployment, install, new art, paid
assistance or security change is authorized by this delivery.
