# Keyboard opening and forest route

Issue [#491](https://github.com/jaredbahr/Avatarrpg/issues/491) asks for a continuous keyboard route. This branch adds a browser regression for a fresh campaign with keyboard input through named party setup, the opening lines, Elder Mira, a real choice with Gao, and Dema on the Forest Road. It checks visible focus as the player makes selections and as the game replaces the focused scene or dialogue line.

Standalone dialogue now moves focus to its first control when it replaces a scene with visible keyboard focus. Retained dialogue layers still use their existing scene entry. The regression originally failed on both Chromium and WebKit immediately after Begin, because the first interlude Next had no focus. The later route also uses reverse tabbing after Wait and waits for the actual Forest Road board before selecting its conversation.

The map route to the quarry remains locked until the roadblock encounter is resolved. The existing keyboard controls can reach Dema but cannot move across the required board triggers. Combat tile targeting also requires a pointer. [Issue #753](https://github.com/jaredbahr/Avatarrpg/issues/753) records both input gaps and the proposed design. The browser spec stops at the locked route, leaving first-turn acceptance open.
