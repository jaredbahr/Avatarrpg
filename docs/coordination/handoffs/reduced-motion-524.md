# Reduced-motion idle rendering (#524)

The saved preference and the OS media query both reach the board renderer. The
Canvas and WebGL backends used the live view clock when a standing unit had no
explicit clip time. The shared renderer now supplies the first standing cel
under reduced motion. Authored frames and times, movement, and the scene clock
continue through the same draw path, including redraws after a resize.

The title's backdrop rule had higher specificity than the OS reduced-motion
override. That left the wash running an infinite one-millisecond cycle.
The OS override now targets the title backdrop at the same specificity
and applies the same iteration and scroll limits as the saved setting.

The browser spec separates the two reduced-motion preferences and checks that
Ba Dan still visibly animates with both off. It compares the full visible board
across real advancing frames, with state and camera held by ordinary idle play.
Combat samples start on the player's turn after the encounter caption clears.
Title and dialogue use normal screenshots and inspect running document
animations. The title fixture crosses its supported three-second art rotation
boundary. The old oblique mode was removed, so the legacy top-down query and
default use the same presentation.

At main `f2ecf6ba`, the exploration spec failed all four reduced-motion
Chromium cases at pixel equality and passed both motion-on controls. The
visible differences fell within Kaya's sprite area. The local standing-cel
change passed the original 12 exploration cases in Chromium and WebKit. The
expanded check remains the acceptance evidence for combat, title and dialogue.
[Issue and baseline evidence](https://github.com/jaredbahr/Avatarrpg/issues/524#issuecomment-6776886868)
