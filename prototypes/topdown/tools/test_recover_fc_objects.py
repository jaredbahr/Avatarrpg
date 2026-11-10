"""Focused regression tests for the built-page object recovery tool."""

import base64
import json
import os
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

import recover_fc_objects as recovery


NAMES = [
    "earth_wall", "pine_a", "pine_b", "pine_c", "rubble", "boulder", "oil_flask",
    "hay_bale", "puddle", "stump", "cart_wheel", "milestone", "log",
]


def chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def png(width=2, height=3, pixel=0):
    row = bytes([0]) + bytes([pixel, 0, 0, 255]) * width
    pixels = row * height
    return (
        recovery.PNG_SIGNATURE
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(pixels))
        + chunk(b"IEND", b"")
    )


def builder_source(names=NAMES):
    return "OB = {k: f'fc/obj_{k}.png' for k in " + repr(names) + "}\n"


def page(names=NAMES, bad_base64=None, image=None):
    data = image if image is not None else png()
    objects = {}
    for name in names:
        source = "data:image/png;base64," + base64.b64encode(data).decode("ascii")
        if name == bad_base64:
            source = "data:image/png;base64,%%%"
        objects[name] = {"src": source, "w": 2, "h": 3}
    return "const ASSETS = " + json.dumps({"objects": objects}) + ";"


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "forest-combat.html").write_text(page(), encoding="utf-8")
        board = "<script>const ASSETS = " + json.dumps({"objects": {
            name: {"src": "data:image/png;base64," + base64.b64encode(png()).decode("ascii"), "w": 2, "h": 3}
            for name in NAMES
        }}) + ";</script>"
        (self.root / "tutorial-demo.html").write_text("const DOCS = " + json.dumps({"board": board}) + ";", encoding="utf-8")
        self.builder = self.root / "build_fc.py"
        self.builder.write_text(builder_source(), encoding="utf-8")
        self.builder_patch = patch.object(recovery, "BUILDER", self.builder)
        self.builder_patch.start()

    def tearDown(self):
        self.builder_patch.stop()
        self.temp.cleanup()

    def test_recovers_both_paths_and_is_idempotent(self):
        rows = recovery.recover(self.root)
        self.assertEqual(len(rows), 13)
        expected = png()
        for relative in ("assets/fc", "fc"):
            for name in NAMES:
                self.assertEqual((self.root / relative / f"obj_{name}.png").read_bytes(), expected)
        self.assertEqual(recovery.recover(self.root), rows)

    def test_bad_base64_fails_before_writing(self):
        (self.root / "forest-combat.html").write_text(page(bad_base64="earth_wall"), encoding="utf-8")
        with self.assertRaisesRegex(recovery.RecoveryError, "invalid base64"):
            recovery.recover(self.root)
        self.assertFalse((self.root / "assets").exists())

    def test_noncanonical_base64_padding_bits_fail(self):
        source = 'const ASSETS = {"objects":{"earth_wall":{"src":"data:image/png;base64,Zh==","w":1,"h":1}}};'
        with self.assertRaisesRegex(recovery.RecoveryError, "noncanonical base64"):
            recovery.page_objects(source, "fixture", {"earth_wall"})

    def test_missing_builder_object_fails(self):
        (self.root / "tutorial-demo.html").write_text(
            "const DOCS = " + json.dumps({"board": page(NAMES[1:])}) + ";", encoding="utf-8"
        )
        with self.assertRaisesRegex(recovery.RecoveryError, "missing builder objects"):
            recovery.recover(self.root)

    def test_unsafe_builder_name_fails(self):
        names = list(NAMES)
        names[0] = "bad name"
        self.builder.write_text(builder_source(names), encoding="utf-8")
        with self.assertRaisesRegex(recovery.RecoveryError, "unsafe object name"):
            recovery.recover(self.root)

    def test_trailing_json_content_fails(self):
        source = page()
        (self.root / "forest-combat.html").write_text(source[:-1] + " garbage;", encoding="utf-8")
        with self.assertRaisesRegex(recovery.RecoveryError, "not followed by its statement delimiter"):
            recovery.recover(self.root)

    def test_duplicate_json_keys_fail(self):
        with self.assertRaisesRegex(recovery.RecoveryError, "duplicate JSON key"):
            recovery.parse_json_after('const ASSETS = {"objects":{},"objects":{}};', "const ASSETS = ", "fixture")

    def test_declared_dimensions_must_match_png(self):
        source = page().replace('"w": 2', '"w": 9', 1)
        (self.root / "forest-combat.html").write_text(source, encoding="utf-8")
        with self.assertRaisesRegex(recovery.RecoveryError, "declared dimensions"):
            recovery.recover(self.root)

    def test_png_crc_and_truncation_fail(self):
        original = png()
        idat = original.find(b"IDAT")
        idat_length = struct.unpack_from(">I", original, idat - 4)[0]
        crc_offset = idat + 4 + idat_length
        bad_crc = bytearray(original)
        bad_crc[crc_offset] ^= 1
        for damaged, expected in ((bytes(bad_crc), "CRC mismatch"), (original[:-5], "truncated PNG chunk")):
            with self.subTest(expected=expected):
                (self.root / "forest-combat.html").write_text(page(image=damaged), encoding="utf-8")
                with self.assertRaisesRegex(recovery.RecoveryError, expected):
                    recovery.recover(self.root)

    def test_relative_root_is_normalized(self):
        relative_root = Path(os.path.relpath(self.root, Path.cwd()))
        self.assertEqual(len(recovery.recover(relative_root)), 13)

    def test_page_parity_mismatch_fails(self):
        board_html = page()
        board_html = board_html.replace(base64.b64encode(png()).decode("ascii"), base64.b64encode(png(pixel=1)).decode("ascii"), 1)
        (self.root / "tutorial-demo.html").write_text(
            "const DOCS = " + json.dumps({"board": board_html}) + ";", encoding="utf-8"
        )
        with self.assertRaisesRegex(recovery.RecoveryError, "bytes or dimensions differ"):
            recovery.recover(self.root)

    def test_different_existing_target_is_never_overwritten(self):
        target = self.root / "assets" / "fc" / "obj_earth_wall.png"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"existing file")
        with self.assertRaisesRegex(recovery.RecoveryError, "refusing to overwrite"):
            recovery.recover(self.root)
        self.assertEqual(target.read_bytes(), b"existing file")


if __name__ == "__main__":
    unittest.main()
