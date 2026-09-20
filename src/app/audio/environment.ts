import type { Grid, Vec2 } from '../../core/types';
import { mulberry32 } from '../../render/fx/rng';

export interface EnvironmentMix {
  readonly courtyard: boolean;
  readonly pond: number;
}

/** Actual water cells are the only pond source; no second map or painted guess. */
export function courtyardEnvironment(mapId: string, grid: Grid, listener: Vec2): EnvironmentMix {
  if (mapId !== 'ba_dan_village') return { courtyard: false, pond: 0 };
  let nearest = Infinity;
  grid.tiles.forEach((tile, index) => {
    if (tile.terrain !== 'water_deep' && tile.surface?.id !== 'water') return;
    nearest = Math.min(
      nearest,
      Math.hypot((index % grid.width) - listener.x, Math.floor(index / grid.width) - listener.y),
    );
  });
  return { courtyard: true, pond: Math.max(0, 1 - nearest / 5) };
}

/** Original procedural source: no recordings, external assets or runtime fetching. */
export function environmentSamples(kind: 'air' | 'pond', rate = 16000): Float32Array {
  const duration = kind === 'air' ? 47 : 29;
  const samples = new Float32Array(duration * rate);
  const random = mulberry32(kind === 'air' ? 0xba_da_01 : 0xba_da_02);
  let low = 0;
  let slow = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    const white = random() * 2 - 1;
    low += 0.055 * (white - low);
    slow += 0.008 * (white - slow);
    const breeze =
      0.65 +
      0.2 * Math.sin((2 * Math.PI * t) / duration) +
      0.15 * Math.sin((6 * Math.PI * t) / duration);
    let value =
      kind === 'air'
        ? slow * breeze
        : (low - slow) * (0.7 + 0.3 * Math.sin((4 * Math.PI * t) / duration) ** 2);
    if (kind === 'air') {
      // Two distant bird phrases per 47 seconds, never triggered by steps or frames.
      for (const at of [8.1, 31.7]) {
        const local = t - at;
        if (local >= 0 && local < 0.42) {
          const envelope = Math.sin((Math.PI * local) / 0.42) ** 4;
          value += 0.022 * envelope * Math.sin(2 * Math.PI * (1850 * local + 440 * local * local));
        }
      }
    }
    // Flat-zero seam with a short raised-cosine taper, avoiding loop clicks.
    const edge = Math.min(1, t / 0.2, (duration - t) / 0.2);
    samples[i] = value * (0.5 - 0.5 * Math.cos(Math.PI * edge));
  }
  return samples;
}

/** Two persistent loops, owned by the existing bus and never by a renderer. */
export class CourtyardEnvironment {
  private layers: { source: AudioBufferSourceNode; gain: GainNode; target: number }[];

  constructor(
    private ctx: AudioContext,
    output: AudioNode,
  ) {
    this.layers = (['air', 'pond'] as const).map((kind) => {
      const samples = environmentSamples(kind);
      const buffer = ctx.createBuffer(1, samples.length, 16000);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(output);
      source.start();
      return { source, gain, target: 0 };
    });
  }

  update(mix: EnvironmentMix, volume: number): void {
    const levels = [0.24, 0.13 * Math.max(0, Math.min(1, mix.pond))];
    this.layers.forEach((layer, index) => {
      const target = mix.courtyard ? (levels[index] ?? 0) * Math.max(0, Math.min(1, volume)) : 0;
      if (Math.abs(target - layer.target) < 0.0001) return;
      layer.target = target;
      layer.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.22);
    });
  }

  stop(): void {
    for (const { source, gain } of this.layers) {
      gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      source.stop(this.ctx.currentTime + 0.6);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    }
    this.layers = [];
  }
}
