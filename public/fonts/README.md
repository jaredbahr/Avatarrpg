# Fonts

The one self-hosted face: the display typeface for headings. Body text stays
on the system stack (`docs/art-bible.md`, Fonts). It lives here rather than
on a font CDN so the service worker precaches it and a table with no signal
still sees the right heading.

| Field   | Value                                                                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Family  | Shippori Mincho                                                                                                                                                                                           |
| Weight  | 700                                                                                                                                                                                                       |
| File    | `shippori-mincho-700-latin.woff2` (28,720 bytes)                                                                                                                                                          |
| Subset  | Google Fonts' `latin` slice: `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD` |
| Source  | `https://fonts.gstatic.com/s/shipporimincho/v17/VdGDAZweH5EbgHY6YExcZfDoj0B4Z9CW45sP.woff2`, the `/* latin */` block of `https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@700`               |
| Fetched | 2026-09-15                                                                                                                                                                                                |
| SHA-256 | `b72c8f55b753b95b239e7ed4da63317c99407e1dffddf4232a16e75d46c8b35d`                                                                                                                                        |
| Licence | SIL Open Font License 1.1, `OFL-ShipporiMincho.txt`. Copyright 2021 The Shippori Mincho Project Authors (https://github.com/fontdasu/ShipporiMincho)                                                      |

The `@font-face` is `src/styles/fonts.css`; the token that applies it is
`--font-display` in `src/styles/base.css`. To swap the face, replace the file,
update those two and this table, and keep the licence file next to the font:
the OFL requires it to travel with the font, and `public/` is copied verbatim
into the build.
