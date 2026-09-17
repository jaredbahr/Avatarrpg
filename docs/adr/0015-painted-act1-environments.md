# ADR 0015: Act 1 paintings and transparent prop sprites

**Status:** accepted, 2026-09-17

The five original Act 1 maps now use the backdrop contract from ADR 0009.
Combat paintings ship at 80 pixels per tile (1600×960), and the village at
64 (1536×1024). These sizes preserve the generated source without upscaling
or moving edges through an aspect crop. Texture and download budgets remain
unchanged. The existing riverside painting and its foreground masks are unchanged.

Paintings are registered to the existing rows and legend. Live water, oil and
mud remain renderer layers over dry substrate. Fixed cover, ledges and walls
belong to the painting; interactive barrels, flasks, braziers and carts do not.
Village houses use cutaway interiors so walkable floors and their occupants
stay visible. No collision, elevation, spawn, encounter or story rules change.

All six prop keys use existing `image` entries. PNGs are square 256-pixel RGBA
frames, proportionally fitted and seated on the existing 85% baseline. The
shared SpriteCache draws a contact shadow beneath loaded prop PNGs; procedural
fallback painters already draw theirs. Image loading and failed fetches retain
the matching prop silhouette instead of a generic loading disc. Both renderer
backends therefore use the same image, scale and shadow path.

The intake script reuses the existing alpha trim, box filter and baseline
placement. It refuses empty or opaque inputs. Prompt packs now describe the
map's actual shipped resolution when one exists. The gallery adds grid-on
captures of the quarry gate, cutting and quarry floor to the existing village
and forest views. This remains a 2D painted-map workflow, not a new geometry
or navigation system.

The runtime credits dialog imports the third-party list directly, allowing
build-only provenance for original assets to be removed from the game bundle.
The full credit registry still drives NOTICE and asset coverage validation.
The displayed attributions stay identical and the 300 KB JavaScript budget
is unchanged.
