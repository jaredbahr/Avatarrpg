#!/usr/bin/env python3
"""Suggest seamless loop points for a music master (ADR 0108).

    python3 scripts/audio/find-loop.py <master.mp3> --bpm 85 [--min 60] [--max 130] [--tail 12]

Decodes the master to mono with ffmpeg, finds the beat grid for the given tempo from an onset envelope,
and scores every pair of bar starts (start, end) whose distance is a whole number of bars inside
[--min, --max] seconds and whose end stays --tail seconds clear of the fade-out. A pair scores well when
the spectrum and the level a few seconds either side of `start` match those around `end`, which is what
makes the jump from `end` back to `start` inaudible. It prints the best candidates; a person picks one and
writes it into `audio/source/music/loops.json`.

    python3 scripts/audio/find-loop.py <master.mp3> --refine <start> --min 60 --max 100

then measures the true period near a chosen start: the lag, at 6 ms resolution, at which the per-band
onsets in the 8 s around `start` best repeat. A Suno master does not always play at its prompt's tempo
(the road theme runs at 95.5, not 96), and a beat grid a fraction off drifts by a few hundred ms over a
long loop, so the end in loops.json is start + this period. Only numpy is needed. Nothing here is shipped.
"""
import argparse
import subprocess
import numpy as np

RATE = 11025
HOP = 256
WIN = 1024


def decode(path):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def spectrogram(x):
    frames = 1 + (len(x) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(frames)[:, None]
    mag = np.abs(np.fft.rfft(x[idx] * np.hanning(WIN), axis=1))
    # Log-spaced bands, roughly perceptual, so a bass line weighs as much as the hiss above it.
    edges = np.unique(np.geomspace(2, mag.shape[1] - 1, 41).astype(int))
    bands = np.stack([mag[:, a:b].sum(axis=1) for a, b in zip(edges[:-1], edges[1:])], axis=1)
    return np.log1p(bands * 10)


def beat_phase(spec, bpm):
    flux = np.maximum(np.diff(spec, axis=0), 0).sum(axis=1)
    fps = RATE / HOP
    period = 60 / bpm * fps
    best, phase = -1, 0.0
    for p in np.linspace(0, period, 200, endpoint=False):
        ticks = np.arange(p, len(flux) - 1, period).astype(int)
        score = flux[ticks].sum()
        if score > best:
            best, phase = score, p
    return phase / fps


def refine(x, start, lo, hi):
    hop, win = 64, 1024
    frames = 1 + (len(x) - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    mag = np.abs(np.fft.rfft(x[idx] * np.hanning(win), axis=1))
    edges = np.unique(np.geomspace(4, mag.shape[1] - 1, 41).astype(int))
    bands = np.log1p(np.stack([mag[:, a:b].sum(axis=1) for a, b in zip(edges[:-1], edges[1:])], axis=1) * 10)
    flux = np.maximum(np.diff(bands, axis=0), 0)
    fps = RATE / hop
    ctx = int(4 * fps)
    for s in (start - 0.6, start - 0.3, start, start + 0.3, start + 0.6):
        si = int(s * fps)
        a = flux[si - ctx:si + ctx].ravel()
        a = (a - a.mean()) / np.linalg.norm(a - a.mean())
        best = (-1.0, 0.0)
        for ei in range(int((s + lo) * fps), int((s + hi) * fps)):
            if ei + ctx > len(flux):
                break
            b = flux[ei - ctx:ei + ctx].ravel()
            b = b - b.mean()
            c = float(a @ b / np.linalg.norm(b))
            if c > best[0]:
                best = (c, ei / fps)
        print(f'  from {s:8.3f}: repeats at {best[1]:8.3f}, period {best[1] - s:7.3f} s, corr {best[0]:.3f}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('master')
    ap.add_argument('--bpm', type=float, help='the tempo, for the bar grid (not needed with --refine)')
    ap.add_argument('--beats', type=int, default=4, help='beats per bar')
    ap.add_argument('--min', type=float, default=60)
    ap.add_argument('--max', type=float, default=130)
    ap.add_argument('--tail', type=float, default=12, help='seconds of fade-out to keep clear of')
    ap.add_argument('--head', type=float, default=2, help='earliest start, seconds')
    ap.add_argument('--top', type=int, default=8)
    ap.add_argument('--refine', type=float, help='a chosen start: measure the period from it')
    args = ap.parse_args()

    x = decode(args.master)
    if args.refine is not None:
        refine(x, args.refine, args.min, args.max)
        return
    if args.bpm is None:
        ap.error('--bpm is needed to find candidates')
    spec = spectrogram(x)
    fps = RATE / HOP
    duration = len(x) / RATE
    phase = beat_phase(spec, args.bpm)
    bar = 60 / args.bpm * args.beats
    starts = np.arange(phase, duration, bar)
    level = spec.mean(axis=1)
    ctx = int(2.0 * fps)

    def window(t):
        i = int(round(t * fps))
        return spec[i - ctx:i + ctx] if i - ctx >= 0 and i + ctx <= len(spec) else None

    rows = []
    for i, s in enumerate(starts):
        if s < args.head:
            continue
        ws = window(s)
        if ws is None:
            continue
        for e in starts[i + 1:]:
            if e - s < args.min or e - s > args.max or e > duration - args.tail:
                continue
            we = window(e)
            if we is None:
                continue
            a, b = ws.ravel() - ws.mean(), we.ravel() - we.mean()
            corr = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
            ls = level[int(s * fps) - ctx:int(s * fps) + ctx].mean()
            le = level[int(e * fps) - ctx:int(e * fps) + ctx].mean()
            rows.append((corr - abs(ls - le), corr, abs(ls - le), s, e))
    rows.sort(reverse=True)
    print(f'{args.master}: {duration:.2f} s, beat phase {phase:.3f} s, bar {bar:.4f} s')
    for score, corr, dl, s, e in rows[:args.top]:
        print(f'  start {s:8.3f}  end {e:8.3f}  length {e - s:7.3f} ({round((e - s) / bar)} bars)'
              f'  corr {corr:.3f}  level step {dl:.3f}  score {score:.3f}')


if __name__ == '__main__':
    main()
