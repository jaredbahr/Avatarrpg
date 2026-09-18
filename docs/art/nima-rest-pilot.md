# Nima exploration rest pilot

Original generated artwork, 18 September 2026, using the built-in OpenAI image
generation tool. Identity reference: `assets/reference/character-poses/nima.png`.
Source: `exec-16c7aeda-17eb-4767-b34c-351fcc95c2f0.png` in the task's generated
images directory. Existing OpenAI-generated unit credit applies to this updated
Nima atlas; usage follows the project's recorded OpenAI terms review.

Prompt: Production game sprite pose sheet for EXACT young adult original man
shown in reference: brown tousled hair, orange gold asymmetric layered travel
robe, dark red waist sash and hanging long cloth, cream loose trousers, brown
boots, wraps. Preserve identity and costume. Create THREE relaxed exploration
REST poses, arranged three equal cells in ONE horizontal row on transparent
1536x768 canvas, generous clear gutters. Cell 1: full body three-quarter facing
SCREEN RIGHT, feet naturally near hip width, weight resting one leg, arms relaxed
low, curious calm face, NOT fighting stance. Cell 2: same adult full body
three-quarter BACK view facing up-right, arms relaxed, same neutral stance.
Cell 3: same adult full body three-quarter FRONT view facing down-right, calm
face arms relaxed. Same head size and adult 6.5–7 head proportions, same clothing
details and body height in all three, feet at 85% cell height, no cropping.
Elevated three-quarter orthographic camera consistent with 2:1 isometric ground.
Clean fine brown ink #1b1410, flat cel base + one shadow tone, subtle warm upper
left light, no gradients/no photographic texture. No weapons/effects, no ground
shadow, no scenery, text, frames or labels. Characters must look quietly standing
in a village, not braced legs/raised fists or an attack pose. Reference is identity
only; replace combat body language with natural rest.

Packing: `npx tsx scripts/art/rest-poses.ts nima <source.png>` splits the three
cells, trims transparent margins, uniformly scales all three together, and
places them on the existing baseline. The packer asserts unchanged old frames.
The pilot does not constitute approval of the entire scene or other heroes.
