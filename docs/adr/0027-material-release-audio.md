# Material release audio

## Decision

Add bounded `layers` sound recipes (one to three existing procedural voices),
with all voices sharing their cue's audio-clock deadline. Coalescing, mute,
context ownership and the separate hit/miss cues remain at the cue boundary.
An optional `body` envelope point retains a fraction of peak amplitude at 35%
of decay. The default zero preserves existing voices exactly.

## Reason

The slice's Fire Jab previously used the same envelope as every fire technique.
Rock Throw's lowpass fell from 420 to 90 Hz and relied on the generic broadband
crack for its transient. Both exponential envelopes rapidly lost their body.
Fire Jab now combines compact ignition with low flame body. Rock Throw combines
low stone weight with quieter midrange grit, without a release crack implying a
successful hit. These two named cues are the bounded change; unrelated actions
and environment loops retain their current recipes.

## Limits and evidence

No asset files, fetches, dependencies or persistent audio loops are added. A cue
can create at most three voices; sources stop after their envelopes. Recipes are
source-designed candidates, not claimed recordings or approved listening results.
Chromium OfflineAudioContext renders through the actual AudioBus measure less
peak-heavy energy and more body. The task handoff records values and reproducible
A/B renders. Existing clock/mute tests plus layered scheduling coverage guard the
contract. Integrated combat listening and physical tablet-speaker review remain
required before subjective sound acceptance.
