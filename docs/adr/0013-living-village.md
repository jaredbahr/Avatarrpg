# ADR 0013: A living village above both map renderers

Status: accepted for the riverside prototype.

The next visual test is about wanting to walk around a place: deliberate steps,
expressive greetings, readable bending stances, flowing water and animals.
A larger grid alone cannot answer that question.

The riverside uses an original painted background and a transparent Canvas 2D
animation stage above either existing renderer. The stage receives a view model
of positions, actor specifications, motion states and presentation clocks. It
never receives GameState. The app resolves character identities and flags;
walking, conversations and discoveries still use App.dispatch and the reducer.
There are no new game rules, save fields or runtime dependencies. The existing
locked Terser build dependency is declared directly and used for production
minification to keep the complete JavaScript download below 300 KB gzip.

The stage samples the existing figure rig at twelve held poses per second.
Walking translation remains smooth, while waving and water/fire forms use
explicit preparation, gather, release and recovery poses. Reduced motion keeps
still figures and suppresses the ribbons, butterflies and ambient movement.
Presentation clocks pause under dialogs or a hidden document. All scene changes
remove the stage. The same figures and interactions appear over Canvas and WebGL.

The title preview uses a temporary Sura/Kaya party, suspends all saves and restores
the previous state and session when it closes. The normal campaign can enter the
same map through Pella beside the village's east path. Pause offers a route out of
the preview from other scenes. Deferred exploration routing is cancelled when a
new scene or session replaces it, preventing a walk callback reopening a closed
preview.

This is an animation-direction prototype, not finished frame-by-frame character
art. It retains tap-to-walk, a party following a path and turn-based campaign
combat. The bending forms and Dorin's sequence exercise are cosmetic practice:
they do not deal damage or alter surfaces. A future combat animation pass can
reuse the pose vocabulary, but must synchronize its impacts with battle events.
The preview also links to the existing forest-road encounter, with a Pause route
back to the riverside. It exercises the current tactical combat while the new
movement vocabulary is judged; its battle art has not changed in this pass.

The map is 36 by 24 cells. Conservative blocked spans trace the painting's roofs,
large tree, banks and stream; only the bridge crosses the river. The generated
picture is an art-first prototype, so it is not a claim that every painted edge
snaps exactly to a grid cell. Future areas should author geometry first and use
the generated map layout as a composition reference.

Tests cover reachable activities, the bridge crossing, blocked landmarks, shrine
return state, both renderers' interactions, preview save isolation and the Pause
exit. Gallery beat 20 captures the village and both bending forms.
