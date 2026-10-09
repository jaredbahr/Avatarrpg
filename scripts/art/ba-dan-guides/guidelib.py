"""Tiny 3D -> map-projection renderer for the Ba Dan paint guides.

Projection (the map's): ground tile corner (x, y) -> screen X = 64 * (x - y), Y = 32 * (x + y);
height z is in world px and rises straight up: Y -= z; everything is then multiplied by SC.  Horizontal units are tiles.
Every edge parallel to a tile axis therefore has slope exactly +-0.5, verticals are vertical.
"""
import math
import numpy as np
from PIL import Image, ImageDraw

SS = 4  # supersample factor
LINE = (66, 40, 26)  # thin dark brown
K_TOP, K_LEFT, K_RIGHT, K_ROOF_NEAR, K_ROOF_FAR, K_BAND = 1.12, 1.0, 0.75, 1.15, 0.80, 0.60


def mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c)


SC = 1.5  # output px per world px (round 3 renders at the game's 1.5x)


def proj(p):
    return (SC * 64.0 * (p[0] - p[1]), SC * (32.0 * (p[0] + p[1]) - p[2]))


def area2(pts2):
    s = 0.0
    for i in range(len(pts2)):
        a, b = pts2[i], pts2[(i + 1) % len(pts2)]
        s += a[0] * b[1] - b[0] * a[1]
    return s


class Piece:
    def __init__(self, name, w, d):
        self.name, self.w, self.d = name, w, d  # footprint tiles, origin tile (0,0)
        self.ops = []  # ('poly', pts3, fill, lw) | ('line', pts3, lw)
        self.foot_tag = []
        self.notes = []

    # --- primitives -------------------------------------------------
    def poly(self, pts, fill, lw=1.5, edge=True, tag=None):
        self.ops.append(('poly', [tuple(p) for p in pts], fill, lw if edge else 0, tag))

    def line(self, pts, lw=1.0, color=LINE):
        self.ops.append(('line', [tuple(p) for p in pts], lw, color))

    def box(self, x0, x1, y0, y1, z0, z1, col, lw=1.5, tag=None, shades=(K_TOP, K_LEFT, K_RIGHT)):
        kt, kl, kr = shades
        self.poly([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], mul(col, kl), lw, tag=tag)  # +y (left)
        self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], mul(col, kr), lw, tag=tag)  # +x (right)
        self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mul(col, kt), lw, tag=tag)  # top

    def stone_courses(self, x0, x1, y0, y1, z0, z1, rows, joint=0.5, faces='SE'):
        """Thin course + staggered joint lines on a box's visible side faces."""
        for r in range(rows + 1):
            z = z0 + (z1 - z0) * r / rows
            if 0 < r < rows:
                if 'S' in faces:
                    self.line([(x0, y1, z), (x1, y1, z)], 1.0)
                if 'E' in faces:
                    self.line([(x1, y0, z), (x1, y1, z)], 1.0)
        for r in range(rows):
            za, zb = z0 + (z1 - z0) * r / rows, z0 + (z1 - z0) * (r + 1) / rows
            off = 0.0 if r % 2 == 0 else joint / 2
            if 'S' in faces:
                u = x0 + off + joint
                while u < x1 - 1e-6:
                    self.line([(u, y1, za), (u, y1, zb)], 1.0)
                    u += joint
            if 'E' in faces:
                u = y0 + off + joint
                while u < y1 - 1e-6:
                    self.line([(x1, u, za), (x1, u, zb)], 1.0)
                    u += joint

    # --- projection helpers -----------------------------------------
    def front(self):
        return (self.w, self.d, 0.0)

    def all_points2(self):
        out = []
        for op in self.ops:
            for p in op[1]:
                out.append(proj(p))
        out.extend(proj(p) for p in self.footprint_poly())
        return out

    def footprint_poly(self):
        return [(0, 0, 0), (self.w, 0, 0), (self.w, self.d, 0), (0, self.d, 0)]

    # --- slope audit --------------------------------------------------
    def axis_edges(self):
        """Every drawn segment parallel to a tile axis or vertical, with its measured slope."""
        res = []
        segs = []
        for op in self.ops:
            pts = op[1]
            if op[0] == 'poly':
                n = len(pts)
                segs += [(pts[i], pts[(i + 1) % n]) for i in range(n)]
            else:
                segs += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        for a, b in segs:
            dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            if abs(dx) < 1e-9 and abs(dy) < 1e-9 and abs(dz) < 1e-9:
                continue
            pa, pb = proj(a), proj(b)
            if abs(dz) < 1e-9 and (abs(dx) < 1e-9) != (abs(dy) < 1e-9):
                res.append(('x' if abs(dy) < 1e-9 else 'y', (pb[1] - pa[1]) / (pb[0] - pa[0])))
            elif abs(dx) < 1e-9 and abs(dy) < 1e-9:
                res.append(('v', pb[0] - pa[0]))  # must be 0
        return res

    # --- rendering -----------------------------------------------------
    def render(self, margin=14):
        pts = self.all_points2()
        # front corner of the footprint is the anchor
        F = proj(self.front())
        minx = min(p[0] for p in pts)
        maxx = max(p[0] for p in pts)
        miny = min(p[1] for p in pts)
        maxy = max(p[1] for p in pts)
        # half a pixel for the outline
        ox = int(math.ceil(F[0] - minx)) + margin + 1
        oy = int(math.ceil(F[1] - miny)) + margin + 1
        W = int(ox + math.ceil(maxx - F[0])) + margin + 1
        H = int(oy + math.ceil(maxy - F[1])) + margin + 1
        self.size = (W, H)
        self._F = F
        self.anchor = (ox, oy)  # canvas pixel of the footprint's front corner (x1, y1, 0)

        def to_c(p, s=SS):
            q = proj(p)
            return ((q[0] - F[0] + ox) * s, (q[1] - F[1] + oy) * s)

        img = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        sil = Image.new('L', (W * SS, H * SS), 0)
        sd = ImageDraw.Draw(sil)
        tagimg = {}  # tag -> (image, draw)

        def strokes(draw, c2, lw, col):
            w = max(1, int(round(lw * SS)))
            draw.line(c2, fill=col, width=w, joint='curve')
            r = w / 2.0
            for (x, y) in (c2[0], c2[-1]):
                draw.ellipse([x - r, y - r, x + r, y + r], fill=col)

        for op in self.ops:
            if op[0] == 'poly':
                _, p3, fill, lw, tag = op
                c2 = [to_c(p) for p in p3]
                d.polygon(c2, fill=fill + (255,))
                sd.polygon(c2, fill=255)
                if tag:
                    if tag not in tagimg:
                        ti = Image.new('L', (W * SS, H * SS), 0)
                        tagimg[tag] = (ti, ImageDraw.Draw(ti))
                    tagimg[tag][1].polygon(c2, fill=255)
                if lw:
                    ring = c2 + [c2[0]]
                    strokes(d, ring, lw, LINE + (255,))
                    strokes(sd, ring, lw, 255)
            else:
                _, p3, lw, col = op
                c2 = [to_c(p) for p in p3]
                strokes(d, c2, lw, col + (255,))
                strokes(sd, c2, lw, 255)  # floating lines (chains, beams, mound arcs) belong to the silhouette too
        # premultiplied box downsample
        arr = np.asarray(img).astype(np.float64)
        a = arr[..., 3:4] / 255.0
        pm = np.concatenate([arr[..., :3] * a, a * 255.0], axis=2)
        pm = pm.reshape(H, SS, W, SS, 4).mean(axis=(1, 3))
        al = pm[..., 3:4]
        rgb = np.where(al > 0, pm[..., :3] / np.maximum(al / 255.0, 1e-9), 0)
        guide = np.concatenate([rgb, al], axis=2).round().clip(0, 255).astype(np.uint8)
        # outline strokes may extend the silhouette; the binary mask uses the same strokes
        s = np.asarray(sil).astype(np.float64).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0
        sil_bin = s >= 0.5
        guide[..., 3] = np.where(sil_bin, np.maximum(guide[..., 3], 255 * (s >= 0.5)), 0).astype(np.uint8)
        # inside the binary silhouette the guide is fully opaque, so colour bleed is not an issue
        self.guide = Image.fromarray(guide, 'RGBA')
        # mask: silhouette grey, plinth faces blue-ish, footprint quad red
        mk = np.zeros((H, W, 4), np.uint8)
        mk[sil_bin] = (96, 96, 96, 255)
        self.tagmask = {k: (np.asarray(v[0]).astype(np.float64).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0) >= 0.5
                        for k, v in tagimg.items()}
        bsm = self.tagmask['plinth'].astype(np.float64) if 'plinth' in self.tagmask else np.zeros((H, W))
        mk[(bsm >= 0.5) & sil_bin] = (40, 130, 255, 255)
        fimg = Image.new('L', (W * SS, H * SS), 0)
        ImageDraw.Draw(fimg).polygon([to_c(p) for p in self.footprint_poly()], fill=255)
        fm = np.asarray(fimg).astype(np.float64).reshape(H, SS, W, SS).mean(axis=(1, 3)) / 255.0
        self.foot_mask = fm >= 0.5
        self.foot_outside = int((self.foot_mask & ~sil_bin).sum())
        mk[self.foot_mask & sil_bin] = (255, 0, 0, 255)
        self.foot_px = [tuple(round(v / SS, 3) for v in to_c(p)) for p in self.footprint_poly()]
        self.mask = Image.fromarray(mk, 'RGBA')
        self.sil = sil_bin
        return self.guide, self.mask

    def _segments(self):
        segs = []
        for op in self.ops:
            pts = op[1]
            if op[0] == 'poly':
                n = len(pts)
                segs += [(pts[i], pts[(i + 1) % n]) for i in range(n)]
            else:
                segs += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        return segs

    def probe_slopes(self, min_len=40.0):
        """Rasterise each distinct tile-axis-parallel edge alone (1 px wide, 4x supersampled, same mapping
        as the guide) and least-squares fit its slope from the pixels.  Returns [(label, fitted slope)]."""
        W, H = self.size
        ox, oy = self.anchor
        F = self._F
        seen, out = set(), []
        for a, b in self._segments():
            dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            if abs(dz) > 1e-9 or (abs(dx) < 1e-9) == (abs(dy) < 1e-9):
                continue
            pa, pb = proj(a), proj(b)
            if abs(pb[0] - pa[0]) < min_len:
                continue
            key = tuple(sorted([tuple(round(v, 6) for v in a), tuple(round(v, 6) for v in b)]))
            if key in seen:
                continue
            seen.add(key)
            ca = ((pa[0] - F[0] + ox) * SS, (pa[1] - F[1] + oy) * SS)
            cb = ((pb[0] - F[0] + ox) * SS, (pb[1] - F[1] + oy) * SS)
            im = Image.new('L', (W * SS, H * SS), 0)
            ImageDraw.Draw(im).line([ca, cb], fill=255, width=SS)
            arr = np.asarray(im).astype(np.float64).reshape(H, SS, W, SS).mean(axis=(1, 3))
            x0, x1 = sorted([ca[0] / SS, cb[0] / SS])
            cols = range(int(np.ceil(x0)) + 2, int(np.floor(x1)) - 2)
            xs, ys = [], []
            for c in cols:
                col = arr[:, c]
                t = col.sum()
                if t > 0:
                    xs.append(c + 0.5)
                    ys.append((col * (np.arange(H) + 0.5)).sum() / t)
            if len(xs) < 20:
                continue
            slope = np.polyfit(xs, ys, 1)[0]
            out.append(((tuple(round(v, 3) for v in a), tuple(round(v, 3) for v in b)), float(slope)))
        return out
