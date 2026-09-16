# Work someone else made

Most of the art here is generated from the packs beside this file. Some of it
does not have to be: icons, ground textures, interface ornaments and sound are
all things other people have already made well and given away, and taking one
is often better than generating a worse copy of it.

This file says which of those are allowed in, how they get here, and what each
one costs us once it is in.

## The two licences we accept

| Licence      | What it asks                        | What it costs us                                                               |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| CC0 1.0      | Nothing. Public domain.             | Nothing. Credit it anyway, because it is polite and it keeps the record whole. |
| CC BY (3, 4) | Name the author wherever it is used | A row in the credits, which then shows in the game as well as the repository.  |

Anything else is out: no "free for personal use", no "free with a link back",
no unstated licence, no asset whose page does not say plainly what you may do
with it. If you cannot quote the licence, we do not ship the file.

**Read the licence that travels in the download**, not the summary on the page
that led you to it. Where they differ, the file wins.

## Credit is data, not prose

`src/content/credits.ts` is the one list. It feeds three things:

- the Credits screen in the pause menu, which is what an attribution licence
  actually asks for, since the game is where the work is used;
- `NOTICE.md` at the repository root, written by `npm run credits`;
- the check that nothing ships uncredited: a test walks everything under
  `public/` and fails on any file no entry accounts for.

So adding art is two steps that belong in one commit: put the files under
`public/`, and add the entry that covers them. Forget the entry and the build
tells you, by name, before anyone else sees it.

After editing the list, run `npm run credits && npx prettier --write NOTICE.md`.
A test compares the generated file with the list, ignoring the padding prettier
adds, so a forgotten regeneration fails just as loudly.

## Where it comes from

This container can reach npm and GitHub and very little else, so a source that
lives in one of those is one we can take ourselves:

| Kind            | Where it lives                                          |
| --------------- | ------------------------------------------------------- |
| Icons           | an npm package of the icon set, read at build time only |
| Ground textures | a public-domain texture repository on GitHub            |
| Sound           | public-domain sound packs mirrored on GitHub            |

Anything else — a marketplace, an asset site, a download page — is blocked
here. Fetch it yourself and bring it in the way generated art comes in: push
it to the `art-intake` branch under `art/incoming/`, described in
`README.md` beside this file. The same inventory and the same guards apply,
and the raw download never reaches the main branch.

## What is not worth taking

Two things look tempting and are not:

- **Figures.** Ours are specific people with their own silhouettes, written
  down in the packs and drawn from reference figures. A stock set of poses
  would be a different cast wearing our names, and the rule that two
  characters of one element must read apart at forty pixels would go with it.
- **Whole map paintings.** A painting here has to put every road edge and
  every bank on a tile line of one particular grid. Nothing made for someone
  else's map will, and nudging one until it does is more work than painting
  it. Ground textures are the part of this that is worth taking, because they
  sit under the grid rather than describing it.

## Before the commit

- [ ] The licence is CC0 or CC BY, quoted from the file that came with the download
- [ ] An entry in `src/content/credits.ts` covers every path the commit adds
- [ ] `npm run credits` has been run and `npm run verify` passes
- [ ] The work is named in the game, not only in the repository, if its licence asks
- [ ] `npm run check:assets` still passes: art is budgeted per folder
- [ ] Nothing under `art/raw/` or `art/incoming/` is committed; a dated folder of original source art under `art/` is fine, and is not a shipped asset until it is under `public/`
