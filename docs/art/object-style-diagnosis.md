# Object style diagnosis (2026-10-13)

An independent art-direction diagnosis of why the village objects read as a different hand from the characters, written for the final object-style pass. Frames it refers to were in-game captures of the Ba Dan canal market at the time. Its fallback route (d), objects from the character generator, was tried (the primary route (f) needs a human artist the project does not have); the outcome is in [project direction](../direction.md#current-art-problem-objects-vs-characters).

**The objects are drawn as polished miniature display pieces; the characters are drawn as restrained, functional figures. Matching pixel resolution will not reconcile them. The next proof must change prop design, proportions, and shading together.**

**1. Diagnosis**

Ranked by contribution:

| Rank | Cause                                | What the supplied frames show                                                                                                                                                                                                                                           |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Rendering**                        | Fruit has rounded gradients, concentrated highlights, and dark circumference shading. Pottery has bright bands around its shoulders. Table planks have continuous golden bevel highlights. The figures use darker, quieter colour masses and selective stepped shading. |
| 2    | **Design and construction**          | Three matching baskets present three tidy pyramids of oversized produce. Tables, bench, crates, and barrels have the same heavy, polished woodworking treatment. These read as catalogue illustrations of “market objects,” with little evidence of use.                |
| 3    | **Scale and proportion**             | Produce and basket rims are inflated relative to heads and hands. Furniture thickness compounds that inflation. Table length and door height are substantially more defensible.                                                                                         |
| 4    | **Pixel grain and detail hierarchy** | Character detail resolves into small, purposeful colour clusters. Props combine fine repetitive weave and wood lines with smooth, inflated volumes. Equal pixel density conceals different drawing decisions.                                                           |
| 5    | **Composition**                      | Goods are individually exposed, evenly separated, and arranged for inspection. The scene has plenty of vegetation and surface weathering, but the merchandise remains conspicuously pristine and ordered.                                                               |
| 6    | **Lighting and contact**             | The broad light direction and grounding mostly work. The greater mismatch is how materials respond to that light: too many prop surfaces sparkle or glow along their edges.                                                                                             |

**Rendering is the strongest mismatch.** The basket rims, table edges, ceramic shoulders, and fruit all receive attention-grabbing highlights. A small object can contain almost the full dark-to-bright range of a whole figure. The result is apparent gloss even on materials that should be matte.

The characters are not strict two-tone sprites. They contain several values, softened raster edges, and fine detail. Flattening every prop into two colours would introduce another mismatch. The required change is fewer, deliberately placed value groups—not an arbitrary colour-count reduction.

A sampled comparison supports the colour diagnosis. In the canal frame, red-family pixels in the fruit ROI `(580,165)–(623,190)` had median HSV saturation/value of **77%/55%**, versus **66%/41%** in the red-clothing ROI `(210,135)–(236,190)`. These are rectangular samples with a red-family selection, not isolated material masks; they establish the local difference, not a universal palette statistic.

**The construction criticism needs precision.** The visible tables generally have understandable tops, aprons, and supports. These crops do not justify claiming that every table is physically impossible. The problem is exaggerated, generic construction: chunky legs, thick edges, uniformly finished planks, repeated containers, and decorative goods. The artist has described each object attractively without establishing what people do with it.

The pottery and sack groups reinforce that problem: complete silhouettes, regular spacing, conspicuous rims, and little overlap. Adding scratches would leave the underlying display arrangement intact.

**Measured scale**

Measurements below are approximate manual landmark readings from the **1368×715** canal frame, excluding markers and shadows. Allow roughly 2–4 pixels at ambiguous edges. These are projected screen dimensions, not reconstructed physical dimensions.

| Comparison                                  |                    Screen measurement | Interpretation                                                                                                           |
| ------------------------------------------- | ------------------------------------: | ------------------------------------------------------------------------------------------------------------------------ |
| Blue and red figures, hair to sole          |                  About **88 px** each | Useful local height standard, **H**.                                                                                     |
| Three tabletop baskets, outside width       |                    About **44–49 px** | Around **0.50–0.56H**.                                                                                                   |
| Slim figures’ apparent shoulder width       |                    About **18–22 px** | Baskets are roughly **2.0–2.7 shoulder widths**. Their side-facing poses narrow this measurement.                        |
| Broad apron figure’s apparent shoulder span |                    About **30–34 px** | Baskets remain around **1.3–1.6 shoulder widths**. Plausible as large stock baskets, excessive as ordinary hand baskets. |
| Individual prominent fruit                  |                    About **11–16 px** | Comparable to the nearby figures’ roughly **12–16 px head width**. This is the clearest scale failure.                   |
| Fruit table’s long top edge                 | About **172 px**, measured diagonally | About **1.95H**. A long market table is credible; its length alone is not the problem.                                   |
| Upper-right shop door, one vertical jamb    |                      About **118 px** | About **1.34H**. Credible adult doorway clearance. No case for shrinking everything uniformly.                           |

The baskets become especially toy-like because only a few enormous fruits fill each one. Smaller produce, more overlap, and less individual contour emphasis would change their reading substantially.

**Resolution is not the missing resource.** The documented pipeline already authors **1.5 painting pixels per world pixel**, matching the intended **1.5 screen pixels per world pixel**. More source pixels would sharpen the current rendering choices. They would not make those choices resemble the figures.

Also, the supplied comparison sheets have different enlargement factors: characters **4×**, props **3×**, despite the prop filename. Their displayed mark sizes cannot be compared directly.

**Buildings, trees, and ground**

- **Buildings share the problem moderately.** Roof tiles have repetitive highlights and rounded, almost glazed surfaces. However, structural planes, darker openings, wall wear, and larger quiet areas make them more convincing than the market goods. Doors are reasonably scaled.
- **Trees share the rounded shading**, particularly on trunks and crown lobes. They mostly escape the objection because irregular silhouettes, overlapping foliage, and broad shadow masses make that treatment less conspicuous.
- **Ground mostly escapes the “showpiece object” problem.** Its texture is dense and sometimes competes with figures, but it connects the scene rather than presenting isolated polished objects. It should remain the integration reference for contact, wear, and local colour.

There is also a **third character treatment**: the green figure beside the well has conspicuously thick outlines and simple flat fills. It is unlike the four detailed figures. Exclude it from the prop style standard; otherwise the brief has two incompatible character targets.

**The approved references have a gap, but a better-controlled one.** Across all three references, figures are simpler than architecture and vegetation. In the village reference, however, props and figures share muted earth colours, restrained highlights, and comparable contour weight. The carried basket is approximately shoulder-width, with produce resolving as small marks. Seated people establish table height; working people establish equipment scale.

The city and quarry references similarly embed objects in activity and overlapping functional groups. Their detailed backgrounds support simpler figures. The shipped market instead gives each commodity its own clean, brightly modelled presentation.

Those references are composed illustrations. They demonstrate a workable visual relationship, not proof that the current independently generated assets already share it.

**2. Pasteable painter’s brief**

> Match the four detailed in-game figures at the existing camera. Use **H = 88–95 screen px** for an adult; use a front/three-quarter shoulder span for **S**, not a narrow side pose.
>
> **Edges:** dark brown anchored to `#1b1410`; normally **1 screen px**, up to **2 px** at deep overlaps. Interior seams are thinner or interrupted. No uniform black border, pale fringe, or complete bright rim.
>
> **Values:** **3–5 deliberate tone groups per material**, excluding edge antialiasing. Fruit needs **2–3**. Shade planes and overlaps; no smooth spherical gradients or shaded bevel on every plank.
>
> **Palette:** warm muted wood, wicker, and cloth around existing earth/neutral anchors; cooler brown shadows. Starting HSV envelope for wood/wicker: **S 20–50%, V 30–75%**. Fruit accents: **S 40–65%, V 40–75%**. These are proof constraints, not measurements of every existing asset.
>
> **Highlights:** one broken lit-plane accent. No white fruit glints, continuous golden table edges, or luminous pottery rings. Glaze highlights belong only on deliberately glazed pottery.
>
> **Grain:** details resolve in **1–2 screen-pixel marks** and small coherent clusters. No enlarged block-pixel filter, blur, photographic grain, or all-over stippling. Suggest wicker with a few interrupted rows; wood grain follows boards and stays subordinate to their construction.
>
> **Scale:** ordinary baskets **0.22–0.32H** wide, roughly **0.8–1.2S**; larger stock baskets must read as such. Ordinary fruit **3–6 px**, generally under half a head-width. Table length **1.5–2H** is acceptable; top height at its support **0.45–0.55H**. Door clearance **1.2–1.5H**.
>
> **Build and use:** coherent plank thickness, supported corners, believable joints, attached handles, open gaps between legs, and goods resting on surfaces. Group stock by use, with overlap and unequal spacing. Include one purposeful wear/use cue per group. Preserve upper-left light and grounded shadows.

**3. Route**

Likelihood below means **passing a convincing integrated proof in one more round**. These are production judgments, not measured success rates. Costs are rough hands-on proof effort, excluding a full-village rollout.

| Route                                                                                      | One-round likelihood                              | Cost and decisive limitation                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Repaint in place, silhouettes fixed**                                                | **Low**                                           | Hours to a day. Can reduce gloss and texture, but retains oversized fruit, basket profiles, thick supports, and isolated arrangements. The constraint preserves major causes of rejection.                                                                                       |
| **(b) Repaint with silhouette/size changes**                                               | **Moderate**                                      | Roughly 1–3 days including geometry and integration. Addresses the right problems, but another generative pass can invent construction faults or drift elsewhere. Needs an explicit drawing of the replacement, not just style adjectives.                                       |
| **(c) Deterministic filtering**                                                            | **Low as a solution**                             | Hours for a diagnostic; longer for selective cleanup. Quantization creates contour bands from gradients. Edge detection outlines wicker, grass, and seams indiscriminately. Neither changes construction or scale. Whole-map filtering risks the approved greenery and lighting. |
| **(d) Separate props from the character generator**                                        | **Moderate**                                      | Roughly 1–3 days for a small set and integration. Better prospect of matching clusters and shading; the same generator does not guarantee correct object construction, projection, or scale. Cleaning the old objects and their shadows out of the ground is essential.          |
| **(e) Pull characters toward the painting**                                                | **Low; wrong priority**                           | Small sampling, palette, or shadow adjustments can help integration. Increasing outline thickness or globally enlarging figures would damage the chosen character treatment and would not fix produce or furniture.                                                              |
| **(f) Directly author the small prop set, then integrate it into the continuous painting** | **Highest, with a competent raster/pixel artist** | Roughly 1–2 artist-days for the proof, plus integration. Explicit control over every silhouette, join, value group, and pixel cluster. Requires actual drawing work rather than another prompt revision.                                                                         |

**Primary: (f).** Directly redraw one market ensemble at delivery scale with the figures visible beside it throughout. Permit local silhouette changes. Preserve the continuous painted scene by incorporating the finished objects, exposed ground, and coherent shadows into the source painting, then regenerate the corresponding geometry and cuts.

This avoids returning to the previously rejected appearance of independent pieces sitting on a lawn. Separate authoring is useful; visibly separate integration is not.

**Fallback: (d), with construction drawings and mandatory cleanup.** Use the character generator to produce candidates from an approved outline, exact size, and material brief. Judge them beside the actual figures before integration. Generator identity is not acceptance evidence.

Both routes need to update **alpha silhouettes, exposed ground, shadows, occlusion, and relevant footprints/depth data together**. The existing registration gate detects displacement; it does not judge style or construction. Painting a smaller basket inside the old upright silhouette can leave ground-coloured pixels incorrectly occluding a walking figure.

**Smallest decisive proof:** one unchanged village patch containing:

- The fruit table, with smaller produce and rebuilt baskets.
- One ceramic vessel, to test curved material shading.
- An actual detailed figure beside it and another behind it.
- Enough existing doorway, ground, canal edge, and vegetation to expose integration failure.

One basket alone is insufficient. It can look attractive in isolation while the table, light, and figure still disagree.

**4. Acceptance test**

Present **one before/after comparison at identical camera, framing, character scale, and poses**, without persuasive captions.

Use a roughly **600×350 screen-pixel crop** containing the complete ensemble, both figures, their contact shadows, and surrounding painted context. Do not trim away the ground to hide integration problems. Beside it, show a village-reference crop containing a person, basket, and table, resized so adult figure height matches—not so the buildings match.

Judge at **1× first**. Then inspect matching **4× nearest-neighbour crops** of:

- Basket, fruit, and a figure’s head/shoulder.
- Table corner, apron, leg, and ground contact.
- Pottery rim and shaded body.

Use the same enlargement for everything. Finally, verify a short in-game crossing behind and in front of the changed group; a static painting cannot establish correct cutouts.

The critic answers exactly three questions:

1. **Do the objects and figures appear drawn by the same hand at normal play size—especially in contour weight, tone grouping, and highlight treatment?**
2. **Can these people plausibly carry, reach, sit at, and build these objects, with believable sizes and visible construction?**
3. **Does the replacement belong to this existing place, with coherent contact, shadow, overlap, and evidence of use?**

**Any “no” fails the proof.** “Less glossy,” “sharper,” and “better than before” are not acceptance criteria.

I inspected both gameplay frames, both enlargement sheets, all three approved references, a character atlas, a region guide, and the relevant art/pipeline documentation. I checked image dimensions, calculated the stated landmark distances, and sampled screenshot colours. No art was generated, no gameplay test was run, and no file was changed.
