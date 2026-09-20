# ADR 0030: Retain the live map for bounded world conversations

## Status

Accepted for the Avatar RPG village-to-quarry slice.

## Decision

Ordinary NPC and roadside discovery conversations opt into a world presentation
through an explicit registry keyed by story node. Each entry names the exact map
id that owns the conversation. Discovery entries are generated from the
authored `DISCOVERIES` list so marker and dialogue ownership cannot drift.

`App` retains `ExploreScene` only while the saved state is a dialogue node with
world metadata, the current location matches the metadata map, no battle is
active, and the node is not a staged interlude. Any missing node, unknown map,
map mismatch, battle, interlude, or other invalid state uses `DialogueScene`.
The logical state remains `screen: 'dialogue'`; saves therefore resume from the
existing location and story line cursor without adding a conversation session.

The shared conversation panel owns party-aware line resolution, choice gating
and lock explanations, decider labels, and one guarded advance command.
`DialogueScene` places that panel in its existing illustrated stage, while
`ExploreScene` places its compact form over the live renderer. Conversation mode
clears walk intent and hover state, hides or inerts world controls, and guards
both DOM input and pointer/keyboard handlers. The renderer, camera, trail, and
map ambience stay alive for the return to roaming.

## Consequences

Content authors must register each ordinary map NPC node and route explicitly;
validation checks node, map, and map-owned NPC references. Staged opening,
departure, descent, epilogue, and unknown or mismatched nodes keep the existing
visual-novel playback and controls. No second renderer or screenshot backdrop is
needed, and the save shape remains unchanged.
