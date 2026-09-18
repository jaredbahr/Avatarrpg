# Courtyard environmental audio

Status: implementation candidate; audible mix and device acceptance remain open.

`src/app/audio/environment.ts` is the complete original source. It generates
seeded filtered noise for air and pond texture, with two quiet sinusoidal bird
phrases in each 47-second air loop. There are no recordings, borrowed samples,
AI-generated assets, external licences or downloads. Seeds, envelopes, filter
coefficients, durations and mix levels are reviewable in that file. The existing
repository licence applies. The bird is an impression, not a species recording.

The 47-second air and 29-second pond loops are mono 16 kHz Float32 buffers:
4,864,000 bytes of decoded sample data combined, plus Web Audio overhead. They
add zero bytes to the 4 MB audio download budget and only source code to the
25 MB precache budget. They are generated on scene audio activation, run as two
sources, and are released on scene departure or hidden-page transition.

Air gain is 0.24; pond gain is at most 0.13; both pass through the existing 0.6
master and volume setting. These deliberately low starting values preserve
footstep headroom, but numerical headroom is not proof of a good audible mix.
Pond presence falls linearly to zero at five tiles from the nearest actual water
cell. Camera panning does not move the listener. Rendering backend and reduced
motion do not affect audio.

## Integrated capture and listening gate

Gameplay owns ExploreScene wiring. After integrating the audio commit and hook:

1. Record the exact combined SHA, browser, renderer, volume, viewport and party.
   Start a normal campaign and unlock audio by a real tap. Record at least
   65 seconds so both sparse detail phrases and one air loop seam are included.
2. Capture the real canvas stream and the existing AudioBus master into the
   **same** MediaRecorder stream. Record standing near the entrance, walking to
   the actual pond, stopping, walking away, and taking the road exit. Keep the
   footsteps and environmental audio together. Do not combine separate takes.
3. During the take change volume, toggle Off/On, hide/show the page, and leave
   and re-enter exploration. Check no doubled bed, stale detail burst, abrupt
   pond-volume step, or environmental tail beyond the short scene release.
4. Listen to the resulting recording at ordinary playback volume: the air should
   read as soft outdoor space rather than static; water should stay local rather
   than sound like rain; distant bird detail should avoid a repetitive alarm;
   footsteps must remain clear. Revise synthesis or mix if any of these fail.
5. Repeat the route on Canvas and WebGL; check Surface and iPad-sized layouts.
   Real-device audio unlock, interruption/resume and speaker balance still need
   physical Surface/iPad listening. Browser emulation is not device evidence.

Unit tests establish graph lifecycle, mute ownership, deterministic finite signal
bounds, loop seams and map-derived proximity. They cannot establish timbre or
mix acceptance. Any previously recorded video predates this environment and
cannot be presented as evidence for its integrated sound.

Technical source measurements at 16 kHz (before layer/master/volume gains): air
peak 0.14147, RMS 0.02466; pond peak 0.31243, RMS 0.06650. Both are bounded below
full scale. These are deterministic source measurements, not integrated capture
or listening acceptance.
