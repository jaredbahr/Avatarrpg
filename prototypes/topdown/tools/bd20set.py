"""Pad the hung side gate so it stands on the baked open gate's base from a marker one cell south of it.

The open gate is baked on the fence cell (25, 2) (south edge y = 120 world px), and a marker cannot stand on a
blocked cell, so the hung gate's marker is the open cell below, (25, 3): its art's foot sits on that cell's foot line
(0.85 of a cell, y = 154). The 34 transparent rows put the gate's own base 34 px higher, on y = 120.

    python3 prototypes/topdown/tools/bd20set.py
"""
from pathlib import Path
from PIL import Image

OBJECTS = Path(__file__).resolve().parent.parent / "assets" / "objects_bd20"
PAD = 34  # (3 + 0.85) * 40 - 3 * 40

gate = Image.open(OBJECTS / "side_gate_hung.png").convert("RGBA")
out = Image.new("RGBA", (gate.width, gate.height + PAD), (0, 0, 0, 0))
out.paste(gate, (0, 0))
out.save(OBJECTS / "side_gate_hung_set.png")
print(out.size)
