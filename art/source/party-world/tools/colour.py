"""OKLab helpers and the hue lock: keep a restyle's lightness and texture, take hue (and part of the chroma) from the source
figure, so the world's rendering cannot pull Sura's blue toward the grass green or Kaya's red toward brown."""
import numpy as np


def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def to_oklab(rgb):
    l = srgb_to_lin(rgb.astype(np.float64))
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(l @ M1.T)
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ M2.T


def from_oklab(lab):
    M2i = np.array([[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]])
    lms = (lab @ M2i.T) ** 3
    M1i = np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965],
                    [-0.0041960863, -0.7034186147, 1.7076949654]])
    return lin_to_srgb(lms @ M1i.T)


def hue_lock(restyled, source, chroma_keep=0.45, min_c=0.02):
    """restyled, source: HxWx3 uint8. Lightness from the restyle; hue from the source where the source has colour;
    chroma a blend (chroma_keep of the source's)."""
    A = to_oklab(restyled); B = to_oklab(source)
    Ca = np.hypot(A[..., 1], A[..., 2]); Cb = np.hypot(B[..., 1], B[..., 2])
    hb = np.arctan2(B[..., 2], B[..., 1]); ha = np.arctan2(A[..., 2], A[..., 1])
    use = Cb > min_c
    h = np.where(use, hb, ha)
    C = np.where(use, (1 - chroma_keep) * Ca + chroma_keep * Cb, Ca)
    out = np.stack([A[..., 0], C * np.cos(h), C * np.sin(h)], -1)
    return np.clip(from_oklab(out) + 0.5, 0, 255).astype(np.uint8)
