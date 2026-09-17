# Following the paths

The connected region now gives ground taps visible feedback. The dotted route
and destination use a preview of the real `walkTo` command, including NPC
approaches and the first active encounter. Both renderers use their existing
path drawing. This is presentation only: no save or combat rule changes.
Exploration now retires completed animation tracks each frame, keeping long
roaming sessions from accumulating every previous walk in the animator.

While a stroll is playing, tap another walkable tile to queue one next walk.
The latest valid tap replaces it; a wall tap explains the refusal without
erasing a valid destination. The party finishes its current animation before
the queued command runs. Cancel next walk or Escape clears the intent. Opening
a dialog, hiding the tab, changing the game state or crossing into another map
also discards it. No intent is saved or resumed after a load. Riverside forms
and special interactions keep their existing activity guards.

Look around offers reachable people and objects within six tiles on the
current map. A landmark behind an active story crossing is withheld until the
crossing is resolved. Visiting one walks the normal path; discovering a name
does not set a flag or pay a reward.

The integrated roaming build connects the riverside to the campaign paths,
adds front and back walking poses for the whole roster, and gives each bending
style its own anticipation and recovery. The travel journal also remembers
the three roadside inspections alongside the riverside and traveller stories.
Riverbank side-view poses keep their eight-frame cadence; front and back
walks use the same distance-based four-frame cadence as the rest of the party.

## Playtest

- In Ba Dan, tap down the road and tap a different nearby path before arriving.
  See the next route, then watch the party finish both walks without jumping.
- Replace the queued destination, cancel it, tap a roof, and open Pause during
  the first walk. The party must never continue into an unintended next walk.
- Enter Forest Road and use Look around to find Dema. After the roadside
  discoveries are available, they appear through the same content-driven UI.
- Tap past a visible encounter. The drawn destination must stop at that event.
- Check Canvas and WebGL, reduced motion, large text and portrait layout.

The new controls cover the existing connected region. More regions, moving
enemy patrols and continuous keyboard movement remain separate work.
