"""Ba Dan geometry helpers: tile -> painting px (1.5 painting px per world px, origin (-200,-100))."""
def world(tx, ty):
    return ((tx - ty + 16) * 64.0, (tx + ty) * 32.0)
def paint(tx, ty):
    wx, wy = world(tx, ty)
    return ((wx + 200) * 1.5, (wy + 100) * 1.5)
def wpaint(wx, wy):
    return ((wx + 200) * 1.5, (wy + 100) * 1.5)
