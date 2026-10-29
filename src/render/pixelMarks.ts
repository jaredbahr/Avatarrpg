/**
 * Small world-pixel masks for renderer overlays (G1, ADR 0085 / 0088).
 *
 * Geometry is authored in integer world-pixel coordinates relative to its
 * semantic anchor. Rasterization samples pixel centres and writes a flat
 * palette colour with one fixed alpha per operation. It has no canvas, device
 * pixel, camera, timer or random dependency, so Canvas and Pixi consume the
 * same mask. Backends use the existing pixel-sampling rule: nearest at whole
 * pixel stops and the camera's established smoothing policy in the overview.
 */

export const PIXEL_MARK_MAX_SIDE = 256;
export const PIXEL_MARK_CACHE_BYTES = 1024 * 1024;
export const PIXEL_MARK_CACHE_ENTRIES = 128;
const MAX_COMMANDS = 512;
const MAX_POINTS_PER_COMMAND = 2048;
const MAX_WORLD_SIDE = 16_384;
const MAX_CACHE_KEY_CHARS = 16_384;

export interface G1Point {
  readonly x: number;
  readonly y: number;
}

export interface G1Bounds {
  /** Pixel bounds relative to the semantic anchor. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface PixelOperationBase {
  readonly color: string;
}

export interface PixelLine extends PixelOperationBase {
  readonly kind: 'line';
  readonly points: readonly G1Point[];
  readonly width: 1 | 2;
  readonly dash?: {
    readonly on: number;
    readonly off: number;
    readonly phase: number;
  };
}

export interface PixelPolygon extends PixelOperationBase {
  readonly kind: 'polygon';
  readonly points: readonly G1Point[];
  readonly outline?: {
    readonly color: string;
    readonly width: 1 | 2;
  };
}

export interface PixelCircle extends PixelOperationBase {
  readonly kind: 'circle';
  readonly centre: G1Point;
  readonly radius: number;
  /** A filled circle has no separate edge; an outlined one is one or two pixels. */
  readonly fill: boolean;
  readonly width?: 1 | 2;
}

export type PixelOperation = PixelLine | PixelPolygon | PixelCircle;

export interface PixelMarkSpec {
  readonly bounds: G1Bounds;
  /** Named flat colours. Values are #rrggbb, rgb(), or rgba() strings. */
  readonly palette: Readonly<Record<string, string>>;
  /**
   * Operations form one paint layer; later ones replace earlier pixels.
   * Translucent fill and edge layers stay separate masks so normal
   * source-over compositing keeps their authored palette and alpha.
   */
  readonly operations: readonly PixelOperation[];
}

export interface PixelMarkRaster {
  /** Stable key for this exact geometry and palette. */
  readonly key: string;
  /** Row-major straight RGBA at one texel per world pixel. */
  readonly data: Uint8ClampedArray;
  /** Integer pixel offset from the semantic anchor. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
}

export interface PixelMarkPlacement {
  /** The top-left world-pixel coordinate at which to draw the raster. */
  readonly x: number;
  readonly y: number;
  /** The snapped semantic anchor, retained for renderer placement checks. */
  readonly anchor: G1Point;
}

export interface PixelMarkChunk {
  /** Stable, cached chunk mask; its world-pixel bounds are disjoint from its siblings. */
  readonly raster: PixelMarkRaster;
  /** The part of this mask inside the current visible clip, in anchor-relative G1 pixels. */
  readonly clip: G1Bounds;
}

interface ParsedColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Round a world point to its nearest G1 coordinate, with ties away from zero. */
export function snapWorldPixel(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Invalid world-pixel anchor: ${String(value)}`);
  return (value < 0 ? Math.ceil(value - 0.5) : Math.floor(value + 0.5)) + 0;
}

/** Put projected, floating-point world positions on the same G1 coordinate grid. */
export function snapWorldPoints(points: readonly G1Point[]): G1Point[] {
  return points.map(({ x, y }) => ({ x: snapWorldPixel(x), y: snapWorldPixel(y) }));
}

/** Place a cached, anchor-relative raster without changing its authored anchor. */
export function placePixelMark(raster: PixelMarkRaster, anchor: G1Point): PixelMarkPlacement {
  const x = snapWorldPixel(anchor.x);
  const y = snapWorldPixel(anchor.y);
  return { x: x + raster.left, y: y + raster.top, anchor: { x, y } };
}

/** Deterministically rasterize a small G1 mask. Coordinates and bounds are whole world pixels. */
export function rasterizePixelMark(spec: PixelMarkSpec): PixelMarkRaster {
  validateSpec(spec);
  return rasterizeValidated(spec, spec.bounds, canonicalKey(spec));
}

/**
 * Stream only the visible part of a large G1 contour or route as disjoint
 * bounded masks. Each output pixel belongs to exactly one chunk. Lines are
 * still walked from their original start, so dash phase is stable at seams;
 * a one-pixel geometry gutter supplies the second half of 2 px strokes.
 */
export function* pixelMarkChunks(
  spec: PixelMarkSpec,
  /** Visible clip in the same anchor-relative G1 coordinates as `spec.bounds`. */
  visible: G1Bounds,
  maxSide = PIXEL_MARK_MAX_SIDE,
  cache?: PixelMarkRasterCache,
): Generator<PixelMarkChunk> {
  validateSpec(spec, true);
  validateLargeBounds(visible, 'visible');
  integer(maxSide, 'chunk side');
  if (maxSide < 1 || maxSide > PIXEL_MARK_MAX_SIDE) {
    throw new Error(`Pixel-mark chunks must be 1..${PIXEL_MARK_MAX_SIDE} px per side`);
  }
  const sourceRight = spec.bounds.left + spec.bounds.width;
  const sourceBottom = spec.bounds.top + spec.bounds.height;
  const visibleRight = visible.left + visible.width;
  const visibleBottom = visible.top + visible.height;
  const left = Math.max(spec.bounds.left, visible.left);
  const top = Math.max(spec.bounds.top, visible.top);
  const right = Math.min(sourceRight, visibleRight);
  const bottom = Math.min(sourceBottom, visibleBottom);
  if (left >= right || top >= bottom) return;
  const firstX = Math.floor((left - spec.bounds.left) / maxSide);
  const firstY = Math.floor((top - spec.bounds.top) / maxSide);
  const afterLastX = Math.ceil((right - spec.bounds.left) / maxSide);
  const afterLastY = Math.ceil((bottom - spec.bounds.top) / maxSide);
  for (let row = firstY; row < afterLastY; row++) {
    for (let column = firstX; column < afterLastX; column++) {
      const x = spec.bounds.left + column * maxSide;
      const y = spec.bounds.top + row * maxSide;
      const bounds = {
        left: x,
        top: y,
        width: Math.min(maxSide, sourceRight - x),
        height: Math.min(maxSide, sourceBottom - y),
      };
      const clip = {
        left: Math.max(bounds.left, visible.left),
        top: Math.max(bounds.top, visible.top),
        width:
          Math.min(bounds.left + bounds.width, visibleRight) - Math.max(bounds.left, visible.left),
        height:
          Math.min(bounds.top + bounds.height, visibleBottom) - Math.max(bounds.top, visible.top),
      };
      if (clip.width <= 0 || clip.height <= 0) continue;
      yield { raster: cache ? cache.getChunk(spec, bounds) : rasterizeChunk(spec, bounds), clip };
    }
  }
}

function rasterizeChunk(spec: PixelMarkSpec, bounds: G1Bounds): PixelMarkRaster {
  const chunkSpec = { ...spec, bounds };
  return rasterizeValidated(spec, bounds, canonicalKey(chunkSpec));
}

/** Stable identity for a raster source, available before its CPU/GPU upload. */
export function pixelMarkRasterKey(spec: PixelMarkSpec, bounds = spec.bounds): string {
  validateSpec(spec, true);
  validateBounds(bounds, 'raster', PIXEL_MARK_MAX_SIDE);
  if (
    bounds.left < spec.bounds.left ||
    bounds.top < spec.bounds.top ||
    bounds.left + bounds.width > spec.bounds.left + spec.bounds.width ||
    bounds.top + bounds.height > spec.bounds.top + spec.bounds.height
  ) {
    throw new Error('Pixel-mark raster falls outside its source bounds');
  }
  return canonicalKey({ ...spec, bounds });
}

function rasterizeValidated(spec: PixelMarkSpec, bounds: G1Bounds, key: string): PixelMarkRaster {
  const data = new Uint8ClampedArray(bounds.width * bounds.height * 4);
  const colors = new Map<string, ParsedColor>();
  for (const [name, value] of Object.entries(spec.palette)) colors.set(name, parseColor(value));

  for (const operation of spec.operations) {
    const color = colors.get(operation.color);
    if (!color) throw new Error(`Unknown pixel-mark colour: ${operation.color}`);
    if (operation.kind === 'line') {
      const path = linePixels(operation.points, operation.dash, bounds, operation.width);
      for (const point of path) stamp(point.x, point.y, operation.width, color, data, bounds);
    } else if (operation.kind === 'polygon') {
      fillPolygon(operation.points, color, data, bounds);
      if (operation.outline) {
        const outline = colors.get(operation.outline.color);
        if (!outline) throw new Error(`Unknown pixel-mark colour: ${operation.outline.color}`);
        const loop = [...operation.points, operation.points[0] ?? { x: 0, y: 0 }];
        for (const point of linePixels(loop, undefined, bounds, operation.outline.width)) {
          stamp(point.x, point.y, operation.outline.width, outline, data, bounds);
        }
      }
    } else {
      drawCircle(operation, color, data, bounds);
    }
  }

  return {
    key,
    data,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    byteLength: data.byteLength + key.length * 2,
  };
}

/**
 * A least-recently-used CPU mask cache with explicit byte and entry budgets.
 * GPU textures are renderer-owned and follow the backend's existing lifetime.
 */
export class PixelMarkRasterCache {
  private readonly entries = new Map<string, PixelMarkRaster>();
  private usedBytes = 0;

  constructor(
    private readonly maxBytes = PIXEL_MARK_CACHE_BYTES,
    private readonly maxEntries = PIXEL_MARK_CACHE_ENTRIES,
  ) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
      throw new Error(`Invalid pixel-mark cache budget: ${maxBytes}`);
    }
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 0) {
      throw new Error(`Invalid pixel-mark cache entry limit: ${maxEntries}`);
    }
  }

  get(spec: PixelMarkSpec): PixelMarkRaster {
    validateSpec(spec);
    return this.getValidated(spec, spec.bounds);
  }

  getChunk(spec: PixelMarkSpec, bounds: G1Bounds): PixelMarkRaster {
    validateSpec(spec, true);
    validateBounds(bounds, 'chunk', PIXEL_MARK_MAX_SIDE);
    if (
      bounds.left < spec.bounds.left ||
      bounds.top < spec.bounds.top ||
      bounds.left + bounds.width > spec.bounds.left + spec.bounds.width ||
      bounds.top + bounds.height > spec.bounds.top + spec.bounds.height
    ) {
      throw new Error('Pixel-mark chunk falls outside its source bounds');
    }
    return this.getValidated(spec, bounds);
  }

  private getValidated(spec: PixelMarkSpec, bounds: G1Bounds): PixelMarkRaster {
    const key = canonicalKey({ ...spec, bounds });
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }

    const raster = rasterizeValidated(spec, bounds, key);
    if (
      raster.byteLength > this.maxBytes ||
      key.length > MAX_CACHE_KEY_CHARS ||
      this.maxEntries === 0
    ) {
      return raster;
    }
    while (
      this.usedBytes + raster.byteLength > this.maxBytes ||
      this.entries.size >= this.maxEntries
    ) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const removed = this.entries.get(oldest);
      this.entries.delete(oldest);
      this.usedBytes -= removed?.byteLength ?? 0;
    }
    this.entries.set(key, raster);
    this.usedBytes += raster.byteLength;
    return raster;
  }

  get size(): number {
    return this.entries.size;
  }

  get byteLength(): number {
    return this.usedBytes;
  }

  clear(): void {
    this.entries.clear();
    this.usedBytes = 0;
  }
}

function validateSpec(spec: PixelMarkSpec, allowLargeBounds = false): void {
  validateBounds(spec.bounds, 'bounds', allowLargeBounds ? MAX_WORLD_SIDE : PIXEL_MARK_MAX_SIDE);
  if (Object.keys(spec.palette).length === 0) throw new Error('Pixel-mark palette is empty');
  for (const [name, value] of Object.entries(spec.palette)) {
    if (!name) throw new Error('Pixel-mark palette names must be non-empty');
    parseColor(value);
  }
  if (spec.operations.length > MAX_COMMANDS)
    throw new Error(`Too many pixel-mark operations: ${spec.operations.length}`);

  const { left, top, width, height } = spec.bounds;
  const right = left + width;
  const bottom = top + height;
  for (const operation of spec.operations) {
    if (!Object.hasOwn(spec.palette, operation.color))
      throw new Error(`Unknown pixel-mark colour: ${operation.color}`);
    const points = operation.kind === 'circle' ? [operation.centre] : operation.points;
    if (points.length > MAX_POINTS_PER_COMMAND)
      throw new Error('Too many points in a pixel-mark operation');
    if (operation.kind === 'line' && points.length < 2)
      throw new Error('A pixel-mark line needs two points');
    if (operation.kind === 'polygon' && points.length < 3)
      throw new Error('A pixel-mark polygon needs three points');
    for (const point of points) {
      integer(point.x, 'point.x');
      integer(point.y, 'point.y');
      if (point.x < left || point.x > right || point.y < top || point.y > bottom) {
        throw new Error('Pixel-mark geometry falls outside its integer bounds');
      }
    }
    if (operation.kind === 'line') {
      validateWidth(operation.width);
      validateStrokeFits(operation.points, operation.width, spec.bounds);
      if (operation.dash) {
        integer(operation.dash.on, 'dash.on');
        integer(operation.dash.off, 'dash.off');
        integer(operation.dash.phase, 'dash.phase');
        if (operation.dash.on < 1 || operation.dash.off < 1 || operation.dash.phase < 0) {
          throw new Error('Pixel-mark dash values must be positive, with a non-negative phase');
        }
      }
    } else if (operation.kind === 'polygon' && operation.outline) {
      if (!Object.hasOwn(spec.palette, operation.outline.color)) {
        throw new Error(`Unknown pixel-mark colour: ${operation.outline.color}`);
      }
      validateWidth(operation.outline.width);
      validateStrokeFits(operation.points, operation.outline.width, spec.bounds);
    } else if (operation.kind === 'circle') {
      integer(operation.radius, 'circle.radius');
      if (operation.radius < 1) throw new Error('Pixel-mark circle radius must be positive');
      if (operation.width !== undefined) validateWidth(operation.width);
      if (!operation.fill) validateWidth(operation.width ?? 1);
      if (
        operation.centre.x - operation.radius < left ||
        operation.centre.x + operation.radius > right ||
        operation.centre.y - operation.radius < top ||
        operation.centre.y + operation.radius > bottom
      ) {
        throw new Error('Pixel-mark circle falls outside its integer bounds');
      }
    }
  }
}

function validateLargeBounds(bounds: G1Bounds, name: string): void {
  validateBounds(bounds, name, MAX_WORLD_SIDE);
}

function validateBounds(bounds: G1Bounds, name: string, maxSide: number): void {
  integer(bounds.left, `${name}.left`);
  integer(bounds.top, `${name}.top`);
  integer(bounds.width, `${name}.width`);
  integer(bounds.height, `${name}.height`);
  if (bounds.width < 1 || bounds.height < 1 || bounds.width > maxSide || bounds.height > maxSide) {
    throw new Error(`Pixel-mark ${name} must be 1..${maxSide} px per side`);
  }
}

function validateWidth(value: number): asserts value is 1 | 2 {
  if (value !== 1 && value !== 2)
    throw new Error(`Pixel-mark strokes must be 1 or 2 px, got ${value}`);
}

function validateStrokeFits(points: readonly G1Point[], width: 1 | 2, bounds: G1Bounds): void {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  if (
    minX < bounds.left ||
    minY < bounds.top ||
    maxX + width - 1 >= bounds.left + bounds.width ||
    maxY + width - 1 >= bounds.top + bounds.height
  ) {
    throw new Error('Pixel-mark stroke falls outside its integer bounds');
  }
}

function integer(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`Pixel-mark ${name} must be an integer`);
}

function parseColor(value: string): ParsedColor {
  const hex = /^#([\da-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const rgb = Number.parseInt(hex[1], 16);
    return { r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255, a: 255 };
  }
  const functional =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.exec(
      value,
    );
  if (functional) {
    const channels = [Number(functional[1]), Number(functional[2]), Number(functional[3])];
    if (channels.some((channel) => channel < 0 || channel > 255))
      throw new Error(`Invalid pixel-mark colour: ${value}`);
    const opacity = functional[4] === undefined ? 1 : Number(functional[4]);
    if (opacity < 0 || opacity > 1) throw new Error(`Invalid pixel-mark colour: ${value}`);
    return {
      r: channels[0] ?? 0,
      g: channels[1] ?? 0,
      b: channels[2] ?? 0,
      a: Math.round(opacity * 255),
    };
  }
  throw new Error(`Pixel-mark colours must be hex, rgb(), or rgba(): ${value}`);
}

function canonicalKey(spec: PixelMarkSpec): string {
  const palette = Object.keys(spec.palette)
    .sort()
    .map((name) => [name, spec.palette[name]]);
  const operations = spec.operations.map((operation) => {
    if (operation.kind === 'line') {
      const dash = operation.dash
        ? {
            on: operation.dash.on,
            off: operation.dash.off,
            phase: operation.dash.phase % (operation.dash.on + operation.dash.off),
          }
        : null;
      return [
        'line',
        operation.color,
        operation.width,
        operation.points.map(({ x, y }) => [x, y]),
        dash,
      ];
    }
    if (operation.kind === 'polygon') {
      return [
        'polygon',
        operation.color,
        operation.points.map(({ x, y }) => [x, y]),
        operation.outline ? [operation.outline.color, operation.outline.width] : null,
      ];
    }
    return [
      'circle',
      operation.color,
      operation.centre.x,
      operation.centre.y,
      operation.radius,
      operation.fill,
      operation.width ?? 1,
    ];
  });
  return JSON.stringify([
    spec.bounds.left,
    spec.bounds.top,
    spec.bounds.width,
    spec.bounds.height,
    palette,
    operations,
  ]);
}

function writePixel(
  x: number,
  y: number,
  color: ParsedColor,
  data: Uint8ClampedArray,
  bounds: G1Bounds,
): void {
  const px = x - bounds.left;
  const py = y - bounds.top;
  if (px < 0 || py < 0 || px >= bounds.width || py >= bounds.height || color.a === 0) return;
  const index = (py * bounds.width + px) * 4;
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = color.a;
}

function stamp(
  x: number,
  y: number,
  width: 1 | 2,
  color: ParsedColor,
  data: Uint8ClampedArray,
  bounds: G1Bounds,
): void {
  // A width-two mark is a deterministic 2 x 2 stair-step around each path pixel.
  for (let dy = 0; dy < width; dy++) {
    for (let dx = 0; dx < width; dx++) writePixel(x + dx, y + dy, color, data, bounds);
  }
}

function linePixels(
  points: readonly G1Point[],
  dash: PixelLine['dash'] | undefined,
  bounds: G1Bounds,
  width: 1 | 2,
): G1Point[] {
  const result: G1Point[] = [];
  let distance = 0;
  for (let segment = 0; segment + 1 < points.length; segment++) {
    const a = points[segment];
    const b = points[segment + 1];
    if (!a || !b) continue;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1;
    const sy = a.y < b.y ? 1 : -1;
    let error = dx - dy;
    let x = a.x;
    let y = a.y;
    for (;;) {
      const isEnd = x === b.x && y === b.y;
      const pattern = dash ? dash.on + dash.off : 0;
      const visible = !dash || (distance + dash.phase) % pattern < dash.on;
      // The path pixel just outside a chunk can stamp its second pixel into it.
      const inGutter =
        x >= bounds.left - (width - 1) &&
        x < bounds.left + bounds.width &&
        y >= bounds.top - (width - 1) &&
        y < bounds.top + bounds.height;
      const previous = result[result.length - 1];
      if (visible && inGutter && (previous?.x !== x || previous?.y !== y)) {
        result.push({ x, y });
      }
      if (isEnd) break;
      const twice = 2 * error;
      if (twice > -dy) {
        error -= dy;
        x += sx;
      }
      if (twice < dx) {
        error += dx;
        y += sy;
      }
      distance += 1;
    }
  }
  return result;
}

function fillPolygon(
  points: readonly G1Point[],
  color: ParsedColor,
  data: Uint8ClampedArray,
  bounds: G1Bounds,
): void {
  const minX = Math.max(bounds.left, Math.min(...points.map((point) => point.x)));
  const maxX = Math.min(bounds.left + bounds.width, Math.max(...points.map((point) => point.x)));
  const minY = Math.max(bounds.top, Math.min(...points.map((point) => point.y)));
  const maxY = Math.min(bounds.top + bounds.height, Math.max(...points.map((point) => point.y)));
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      if (insidePolygon(x + 0.5, y + 0.5, points)) writePixel(x, y, color, data, bounds);
    }
  }
}

function insidePolygon(x: number, y: number, points: readonly G1Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function drawCircle(
  operation: PixelCircle,
  color: ParsedColor,
  data: Uint8ClampedArray,
  bounds: G1Bounds,
): void {
  const { x: cx, y: cy } = operation.centre;
  const { radius } = operation;
  const width = operation.width ?? 1;
  const outerSq = radius * radius;
  const innerRadius = Math.max(0, radius - width);
  const innerSq = innerRadius * innerRadius;
  const minY = Math.max(cy - radius, bounds.top);
  const maxY = Math.min(cy + radius, bounds.top + bounds.height);
  const minX = Math.max(cx - radius, bounds.left);
  const maxX = Math.min(cx + radius, bounds.left + bounds.width);
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = dx * dx + dy * dy;
      if (distance <= outerSq && (operation.fill || distance >= innerSq))
        writePixel(x, y, color, data, bounds);
    }
  }
}
