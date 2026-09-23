import { RUBBLE_CHIP, SURFACE_STYLES, WATER_BED } from '../palettes';
import { SURFACE_BANK, SURFACE_POOL, SURFACE_RIM } from '../surfaceRendering';

const glslColor = (hex: string): string =>
  `vec3(${[1, 3, 5].map((offset) => (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(5)).join(', ')})`;

/** The static materials share their wash and rim palette with Canvas. */
const MATERIAL_STYLES = (['ice', 'mud', 'oil', 'rubble'] as const)
  .map((id, i) => {
    const style = SURFACE_STYLES[id];
    const index = [2, 4, 6, 7][i];
    return `if (surface == ${index}) { tint = ${glslColor(style.fill)}; rim = ${glslColor(style.edge)}; detail = ${glslColor(style.detail)}; opacity = ${style.alpha.toFixed(3)}; }`;
  })
  .join('\n');

/**
 * GLSL for the WebGL backend.
 *
 * The whole ground — terrain and every elemental surface on it — is one draw
 * call. Per-tile state arrives as a small RGBA data texture (one texel per
 * tile, nearest-sampled): red is the terrain index, green the surface index,
 * blue the surface intensity. The shader does the rest, which is why fire
 * animates and water ripples without the CPU touching a tile.
 *
 * Indices here must match TERRAIN_INDEX and SURFACE_INDEX in `pixi.ts`.
 */

/**
 * Pixi v8 chooses the GLSL version by string-matching "#version 300 es" in the
 * FRAGMENT source. Without it the shader is compiled as WebGL1 and fails at
 * link time without throwing, so every fragment shader here opens with it.
 */
export const FILTER_VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}`;

/*
 * Deliberately sin-free. The usual `fract(sin(dot(p, k)) * big)` hash costs a
 * transcendental per corner, which at four corners per octave and several
 * octaves per pixel runs to tens of millions of sin() calls a frame. That is
 * invisible on a GPU and ruinous without one — and the machines without one
 * include every CI runner this suite goes through.
 */
const NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}`;

/** Base colour per terrain, mirroring TERRAIN_STYLES in palettes.ts. */
const TERRAIN_COLORS = `
vec3 terrainBase(int t) {
  if (t == 0) return vec3(0.435, 0.620, 0.298); // grass
  if (t == 1) return vec3(0.702, 0.565, 0.392); // dirt
  if (t == 2) return vec3(0.702, 0.565, 0.392); // road
  if (t == 3) return vec3(0.847, 0.796, 0.690); // stone
  if (t == 4) return vec3(0.659, 0.596, 0.502); // sand
  if (t == 5) return vec3(0.420, 0.310, 0.200); // wood
  if (t == 6) return vec3(0.122, 0.290, 0.369); // water_deep
  if (t == 7) return vec3(0.227, 0.208, 0.184); // wall
  return vec3(0.078, 0.063, 0.047);             // pit
}`;

export const GROUND_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uMap;
uniform vec2 uGrid;
uniform vec2 uGroundOrigin;
uniform vec4 uGroundInverse;
uniform float uTileSize;
uniform float uTime;
uniform float uHatch;
uniform float uGridLines;
${/* Partial authored scenes use a terrain-only base pass, followed by a */ ''}
${/* surfaces-only pass over their localized ground regions. */ ''}
uniform float uSurfaces;
${/* 1 while a painting sits under the pass: the terrain is left to it and only */ ''}
${/* the surfaces, the hatch, the firelight and the grid are drawn, over it. */ ''}
uniform float uBackdrop;
${/* Set by Pixi's filter system, not by our uniform group: the pooled input */ ''}
${/* texture's logical size and the output frame, both in CSS pixels. */ ''}
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
out vec4 fragColor;
${NOISE}
${TERRAIN_COLORS}

/** The surface index packed into a map texel, or -1 off the map. */
int surfaceAt(vec2 cell) {
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) return -1;
  int packed = int(texture(uMap, (cell + 0.5) / uGrid).r * 255.0 + 0.5);
  return packed - (packed / 8) * 8;
}

/*
 * Everything the pass paints accumulates as premultiplied colour and
 * coverage. Bare ground starts as the terrain at full coverage, so every step
 * below is the plain mix it always was; over a painting it starts clear, and
 * each step lays its tint over the painting with the same weight, so a puddle
 * tints painted ground exactly as it tints procedural ground.
 */
void lay(inout vec4 acc, vec3 tint, float k) {
  acc.rgb = mix(acc.rgb, tint, k);
  acc.a = mix(acc.a, 1.0, k);
}
/** Scales everything under the pixel by m, the painting included. */
void dim(inout vec4 acc, float m) {
  acc.rgb *= m;
  acc.a = 1.0 - m * (1.0 - acc.a);
}

/** Diagonal / cross / dot hatching, for the colourblind setting. */
float hatchPattern(int s, vec2 p) {
  if (s == 1) return step(0.5, fract((p.x + p.y) * 7.0));            // water: diagonal
  if (s == 2) return step(0.5, fract((p.x - p.y) * 8.0));            // ice
  if (s == 3) return step(0.5, fract(p.y * 9.0));                    // fire: vertical
  if (s == 4) return step(0.72, vnoise(p * 26.0));                   // mud: dots
  if (s == 5) return max(step(0.6, fract(p.x * 8.0)), step(0.6, fract(p.y * 8.0)));
  if (s == 6) return step(0.5, fract((p.x + p.y) * 6.0));            // oil
  return step(0.74, vnoise(p * 22.0));                               // rubble
}

void main(void) {
  vec4 quad = texture(uTexture, vTextureCoord);
  if (quad.a < 0.01) { fragColor = vec4(0.0); return; }

  /*
   * The quad is screen-sized and lives outside the camera transform, and tile
   * coordinates are derived from the camera uniforms rather than from the
   * quad's own UVs. A filter renders only the CLIPPED VISIBLE bounds of what it
   * is attached to, so a world-sized quad running off the edge of the screen
   * would hand us UVs covering the visible part alone — which silently
   * rescales the whole board.
   *
   * Nor do the UVs span 0..1 over the quad. Pixi pools filter textures at the
   * next power of two, so vTextureCoord runs from 0 to frame / texture on
   * each axis: at 1368x912 and half resolution that is 0.67 by 0.89, and
   * multiplying by the viewport drew the board wide, tall and offset on every
   * device. uInputSize is the pooled texture's logical size and uOutputFrame
   * the frame's origin, which together put the fragment back in CSS pixels.
   */
  vec2 screen = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 delta = screen - uGroundOrigin;
  vec2 tileUv = vec2(dot(uGroundInverse.xy, delta), dot(uGroundInverse.zw, delta)) / uTileSize;
  vec2 cell = floor(tileUv);
  vec2 f = fract(tileUv);

  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.x || cell.y >= uGrid.y) {
    fragColor = vec4(0.0);
    return;
  }

  /*
   * Terrain and surface share the red channel (terrain * 8 + surface) so that
   * blue can carry precomputed firelight and alpha can stay at 255 — a canvas
   * with partial alpha is premultiplied on upload, which would corrupt the
   * other channels.
   */
  vec4 data = texture(uMap, (cell + 0.5) / uGrid);
  int packed = int(data.r * 255.0 + 0.5);
  int terrain = packed / 8;
  int surface = packed - terrain * 8;
  float intensity = data.g;
  float firelight = data.b;

  ${/* World-space noise coordinates, so texture does not swim when the map pans. */ ''}
  vec2 w = (cell + f) * 0.5;

  vec4 acc = vec4(0.0);
  if (uBackdrop < 0.5) {
    ${/* One fbm and one cheap octave, reused by every terrain branch below. Each */ ''}
    ${/* extra call here is paid on every pixel of the board. */ ''}
    vec3 col = terrainBase(terrain);
    float macro = fbm(w * 0.7);
    float detail = vnoise(w * 3.1);
    col *= 0.82 + 0.36 * (macro * 0.6 + detail * 0.4);

    if (terrain == 0) {
      ${/* grass: blades run vertically, so stretch the noise */ ''}
      col += vec3(0.05, 0.08, 0.03) * (vnoise(w * vec2(3.0, 11.0)) - 0.5);
    } else if (terrain == 1 || terrain == 2) {
      ${/* dirt and road: grit and the occasional pebble */ ''}
      float grit = vnoise(w * 20.0);
      col *= 0.92 + 0.16 * grit;
      col += vec3(0.05) * smoothstep(0.86, 1.0, grit);
    } else if (terrain == 3 || terrain == 7) {
      ${/* stone and wall: cracks */ ''}
      float crack = smoothstep(0.42, 0.40, abs(macro - 0.5));
      col *= 1.0 - 0.30 * crack;
    } else if (terrain == 6) {
      ${/* deep water: slow swell */ ''}
      float swell = fbm(w * 2.0 + vec2(uTime * 0.06, uTime * 0.04));
      col += vec3(0.02, 0.05, 0.07) * (swell - 0.4);
    }
    ${/* The bed under standing water, mirroring paintWaterBed in painters/tiles.ts: the terrain keeps its grain and is carried toward the contract's bed tone before the film above it, because a 0.4 wash over light packed earth reads grey. Deep water, wall and pit are already dark and are left alone; the painting's own bed is left alone too, because this branch does not run under one. */ ''}
    if (surface == 1 && terrain != 6 && terrain != 7 && terrain != 8) {
      float bedMottle =
        ${(1 - WATER_BED.mottle).toFixed(3)} +
        ${(2 * WATER_BED.mottle).toFixed(3)} * vnoise(w * 5.0);
      col = mix(col, ${glslColor(WATER_BED.fill)}, ${WATER_BED.weight.toFixed(3)} * bedMottle * intensity);
    }
    acc = vec4(col, 1.0);
  }

  if (uSurfaces > 0.5) {
  /* ---------------- surfaces ---------------- */

  vec3 tint = vec3(0.0), rim = vec3(0.0), detail = vec3(0.0);
  float opacity = 0.0;
  ${MATERIAL_STYLES}

  /*
   * How far this pixel is from the material's own boundary, as Canvas measures
   * it: the footprint stays the full square tile, but the bank wanders inside
   * it by world noise so a pool never wears a ruled rim. Four texel reads, paid
   * on the pixels of a pooled material and nowhere else — a software
   * rasteriser runs this quad for the whole board.
   */
  float edgeDistance = 1.0;
  float wash = 1.0;
  if (opacity > 0.0) {
    if (surfaceAt(cell - vec2(0.0, 1.0)) != surface) edgeDistance = min(edgeDistance, f.y);
    if (surfaceAt(cell + vec2(0.0, 1.0)) != surface) edgeDistance = min(edgeDistance, 1.0 - f.y);
    if (surfaceAt(cell - vec2(1.0, 0.0)) != surface) edgeDistance = min(edgeDistance, f.x);
    if (surfaceAt(cell + vec2(1.0, 0.0)) != surface) edgeDistance = min(edgeDistance, 1.0 - f.x);
    edgeDistance = max(0.0, edgeDistance + (vnoise(w * 2.0) - 0.5) * ${SURFACE_RIM.spread});
    float washDepth =
      ${SURFACE_RIM.wash.min} + ${SURFACE_RIM.wash.span} * vnoise(w * 2.0 + vec2(3.1, 7.4));
    wash =
      ${SURFACE_RIM.coat.base} +
      ${SURFACE_RIM.coat.interior} * smoothstep(0.0, washDepth, edgeDistance);
  }

  if (surface == 1) {                 // water
    float ripple = fbm(w * 4.0 + vec2(uTime * 0.25, uTime * 0.17));
    vec3 tint = mix(vec3(0.153, 0.424, 0.482), vec3(0.243, 0.561, 0.690), ripple);
    lay(acc, tint, 0.42 * intensity);
    acc.rgb += vec3(0.10, 0.16, 0.18) * smoothstep(0.62, 0.92, ripple) * intensity;
    ${/* Foam where the pool meets ground: only the sides whose neighbour is not */ ''}
    ${/* water, so a puddle reads as one pool with a lapping bank, not a grid of */ ''}
    ${/* rimmed squares. Four texel reads, paid on water pixels alone. */ ''}
    float bank = 0.0;
    if (surfaceAt(cell - vec2(0.0, 1.0)) != 1) bank = max(bank, 1.0 - f.y / 0.2);
    if (surfaceAt(cell + vec2(0.0, 1.0)) != 1) bank = max(bank, 1.0 - (1.0 - f.y) / 0.2);
    if (surfaceAt(cell - vec2(1.0, 0.0)) != 1) bank = max(bank, 1.0 - f.x / 0.2);
    if (surfaceAt(cell + vec2(1.0, 0.0)) != 1) bank = max(bank, 1.0 - (1.0 - f.x) / 0.2);
    bank = clamp(bank, 0.0, 1.0);
    float lap = 0.55 + 0.45 * vnoise(w * 9.0 + vec2(uTime * 0.6, -uTime * 0.3));
    lay(acc, vec3(0.80, 0.92, 0.95), bank * bank * lap * 0.22 * intensity);
  } else if (surface == 2) {          // ice
    ${/* Continuous world-space frost, not quantised square facets. Fine veins */ ''}
    ${/* suggest ice without replacing the underlying painted stone texture. */ ''}
    float frost = vnoise(w * 3.5);
    lay(acc, tint, opacity * (0.88 + 0.12 * frost) * wash * intensity);
    float vein = 1.0 - smoothstep(0.012, 0.030, abs(vnoise(w * 6.0) - 0.52));
    lay(acc, rim, vein * 0.23 * intensity);
  } else if (surface == 3) {          // fire
    vec2 q = w * vec2(2.4, 1.7);
    q.y -= uTime * 1.15;
    vec2 warp = vec2(fbm(q + vec2(0.0, uTime * 0.4)), fbm(q + vec2(5.2, 1.3)));
    float n = fbm(q + warp * 1.3);
    ${/* Kept inside 0..1 by construction. Letting flame run past the top of the */ ''}
    ${/* ramp and then adding it to the ground blows the whole patch out to white. */ ''}
    float flame = clamp(n * 1.55 * (0.62 + 0.38 * intensity), 0.0, 1.0);
    vec3 fire = vec3(0.30, 0.040, 0.012);
    fire = mix(fire, vec3(0.78, 0.25, 0.06), smoothstep(0.24, 0.46, flame));
    fire = mix(fire, vec3(0.96, 0.58, 0.16), smoothstep(0.44, 0.66, flame));
    fire = mix(fire, vec3(1.00, 0.86, 0.52), smoothstep(0.70, 0.94, flame));
    ${/* Blended over the scorched ground, not added to it. */ ''}
    dim(acc, 0.45);
    lay(acc, fire, smoothstep(0.06, 0.42, flame));
    float ember = smoothstep(0.94, 1.0, vnoise(w * vec2(26.0, 14.0) - vec2(0.0, uTime * 2.4)));
    lay(acc, vec3(1.0, 0.80, 0.45), ember * 0.7 * intensity);
  } else if (surface == 4) {          // mud
    float churn = fbm(w * 5.0);
    lay(acc, tint, opacity * (0.88 + 0.12 * churn) * wash * intensity);
    float streak = smoothstep(0.70, 0.84, vnoise(w * vec2(9.0, 17.0)));
    lay(acc, detail, streak * 0.21 * intensity);
  } else if (surface == 5) {          // steam
    float billow = fbm(w * 2.2 + vec2(uTime * 0.16, -uTime * 0.22));
    lay(acc, vec3(0.85, 0.86, 0.87), (0.45 + 0.35 * billow) * intensity);
  } else if (surface == 6) {          // oil
    float sheenBand = vnoise(w * vec2(3.0, 5.0));
    lay(acc, tint, opacity * wash * intensity);
    ${/* A restrained sage sheen, rather than moving rainbow colour over stone. */ ''}
    float sheen = 1.0 - smoothstep(0.025, 0.070, abs(sheenBand - 0.55));
    lay(acc, detail, sheen * 0.14 * intensity);
    float glint = 1.0 - smoothstep(0.008, 0.022, abs(sheenBand - 0.57));
    lay(acc, mix(rim, vec3(0.68, 0.68, 0.56), 0.35), glint * 0.25 * intensity);
  } else if (surface == 7) {          // rubble
    float chunk = vnoise(w * 11.0);
    lay(acc, tint, opacity * wash * intensity);
    lay(acc, ${glslColor(RUBBLE_CHIP)}, smoothstep(0.74, 0.87, chunk) * 0.28 * intensity);
  }

  if (opacity > 0.0) {
    ${/* The actual footprint stays square and complete; only its outer bank is */ ''}
    ${/* accented. Same-material neighbours do not acquire internal tile rims. */ ''}
    if (surface == 4 || surface == 6) {
      float depth = ${SURFACE_POOL.depth} * (0.2 + 0.8 * vnoise(w * 13.0));
      float pool = 1.0 - smoothstep(depth * 0.45, depth, edgeDistance);
      lay(acc, tint * 0.62, pool * ${SURFACE_POOL.alpha} * intensity);
    }
    float bank = 1.0 - smoothstep(0.0, ${SURFACE_BANK.width}, edgeDistance);
    float line = 1.0 - smoothstep(${SURFACE_BANK.line * 0.5}, ${SURFACE_BANK.line}, edgeDistance);
    lay(acc, rim, max(bank * 0.12, line * ${SURFACE_BANK.alpha}) * intensity);
  }

  if (uHatch > 0.5 && surface > 0) {
    dim(acc, 1.0 - 0.225 * hatchPattern(surface, w) * intensity);
  }

  /* ---------------- light thrown by nearby fire ---------------- */

  ${/* Accumulated per tile on the CPU when the map changes, because it only */ ''}
  ${/* changes when fire does. Gathering it here instead would cost 25 texture */ ''}
  ${/* samples on every pixel of every frame, which is ruinous without a GPU. */ ''}
  float flicker = 0.88 + 0.12 * vnoise(vec2(uTime * 2.3, cell.x * 0.7 + cell.y * 1.3));
  acc.rgb += vec3(1.0, 0.55, 0.22) * firelight * 0.42 * flicker;
  acc.rgb = min(acc.rgb, vec3(1.0));

  /* ---------------- grid ---------------- */

  ${/* Off by default (ADR 0007); the Show grid setting and High contrast turn it */ ''}
  ${/* on. A darkening, so it shows on a painting as it does on the terrain. */ ''}
  vec2 gw = fwidth(tileUv) * 1.2;
  vec2 edge = min(f, 1.0 - f);
  float line = 1.0 - smoothstep(0.0, max(gw.x, gw.y), min(edge.x, edge.y));
  dim(acc, 1.0 - 0.21 * line * uGridLines);

  ${/* Premultiplied, as Pixi blends: over bare ground the coverage is 1 and this */ ''}
  ${/* is the colour as ever; over a painting it is only what was laid on it. */ ''}
  }
  fragColor = acc * quad.a;
}`;
