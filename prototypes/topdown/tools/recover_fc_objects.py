"""Recover the byte-exact Forest Road object PNGs from the built HTML pages.

The forest builder still reads these files from ``fc/``. ``assets/fc/`` is the
canonical asset location, so recovery writes the same verified bytes to both.
This script only reads the built pages and the builder's literal object list;
it never imports or runs the packer.
"""

from __future__ import annotations

import ast
import base64
import binascii
import json
import os
import re
import struct
import sys
import tempfile
import zlib
from pathlib import Path


HERE = Path(__file__).resolve().parent.parent
BUILDER = HERE / "tools" / "build_fc.py"
SAFE_NAMES = re.compile(r"[^A-Za-z0-9._-]+")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
EXPECTED_NAMES = (
    "earth_wall", "pine_a", "pine_b", "pine_c", "rubble", "boulder", "oil_flask",
    "hay_bale", "puddle", "stump", "cart_wheel", "milestone", "log",
)


class RecoveryError(ValueError):
    """Raised when a source page or output target is not safe to recover."""


def safe_name(name: str) -> str:
    return SAFE_NAMES.sub("_", name)


def decode_base64(payload: str, name: str, label: str) -> bytes:
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise RecoveryError(f"{label}: invalid base64 for {name}") from exc
    if base64.b64encode(raw).decode("ascii") != payload:
        raise RecoveryError(f"{label}: noncanonical base64 for {name}")
    return raw


def object_without_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise RecoveryError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result


def builder_object_names(source: str) -> list[str]:
    """Read the forest object's literal key list without executing the builder."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise RecoveryError(f"cannot parse {BUILDER.name}: {exc}") from exc

    assignment = next(
        (
            node
            for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "OB" for target in node.targets)
        ),
        None,
    )
    if assignment is None or not isinstance(assignment.value, ast.DictComp):
        raise RecoveryError("build_fc.py no longer declares OB as a literal-key comprehension")

    comp = assignment.value
    if not (isinstance(comp.key, ast.Name) and comp.key.id == "k"):
        raise RecoveryError("build_fc.py OB keys are not the expected literal variable")
    value = comp.value
    if not (
        isinstance(value, ast.JoinedStr)
        and len(value.values) == 3
        and isinstance(value.values[0], ast.Constant)
        and value.values[0].value == "fc/obj_"
        and isinstance(value.values[1], ast.FormattedValue)
        and isinstance(value.values[1].value, ast.Name)
        and value.values[1].value.id == "k"
        and value.values[1].conversion == -1
        and value.values[1].format_spec is None
        and isinstance(value.values[2], ast.Constant)
        and value.values[2].value == ".png"
    ):
        raise RecoveryError("build_fc.py OB filename template changed")
    if len(comp.generators) != 1:
        raise RecoveryError("build_fc.py OB must have one literal-key generator")
    generator = comp.generators[0]
    if not (
        isinstance(generator.target, ast.Name)
        and generator.target.id == "k"
        and isinstance(generator.iter, ast.List)
        and not generator.ifs
        and generator.is_async == 0
        and all(isinstance(item, ast.Constant) and isinstance(item.value, str) for item in generator.iter.elts)
    ):
        raise RecoveryError("build_fc.py OB keys must remain a literal string list")
    names = [item.value for item in generator.iter.elts]
    if len(names) != len(set(names)):
        raise RecoveryError("build_fc.py OB contains duplicate keys")
    for name in names:
        if not name or safe_name(name) != name:
            raise RecoveryError(f"unsafe object name in build_fc.py: {name!r}")
    if tuple(names) != EXPECTED_NAMES:
        raise RecoveryError("build_fc.py OB key list differs from the 13 recovery issue targets")
    return names


def parse_json_after(text: str, marker: str, label: str) -> object:
    start = text.find(marker)
    if start < 0:
        raise RecoveryError(f"{label}: missing {marker!r}")
    if text.find(marker, start + len(marker)) >= 0:
        raise RecoveryError(f"{label}: ambiguous repeated {marker!r}")
    start += len(marker)
    try:
        value, end = json.JSONDecoder(object_pairs_hook=object_without_duplicate_keys).raw_decode(text, start)
    except json.JSONDecodeError as exc:
        raise RecoveryError(f"{label}: malformed JSON after {marker!r}: {exc}") from exc
    if not text[end:].lstrip().startswith(";"):
        raise RecoveryError(f"{label}: JSON after {marker!r} is not followed by its statement delimiter")
    return value


def page_objects(page_html: str, label: str, wanted: set[str]) -> dict[str, tuple[bytes, tuple[int, int]]]:
    assets = parse_json_after(page_html, "const ASSETS = ", label)
    if not isinstance(assets, dict) or not isinstance(assets.get("objects"), dict):
        raise RecoveryError(f"{label}: ASSETS.objects is missing or not an object")
    found: dict[str, tuple[bytes, tuple[int, int]]] = {}
    for name, entry in assets["objects"].items():
        if not isinstance(name, str) or safe_name(name) != name:
            raise RecoveryError(f"{label}: unsafe object key {name!r}")
        if name not in wanted:
            continue
        if not isinstance(entry, dict):
            continue
        uri = entry.get("src")
        if not isinstance(uri, str) or not uri.startswith("data:image/png;base64,"):
            continue
        raw = decode_base64(uri.partition(",")[2], name, label)
        width, height = validate_png(raw, name, label)
        if type(entry.get("w")) is not int or type(entry.get("h")) is not int or entry["w"] != width or entry["h"] != height:
            raise RecoveryError(f"{label}: declared dimensions for {name} do not match PNG IHDR")
        found[name] = (raw, (width, height))
    return found


def validate_png(data: bytes, name: str, label: str) -> tuple[int, int]:
    if not data.startswith(PNG_SIGNATURE) or len(data) < 33:
        raise RecoveryError(f"{label}: {name} is not a complete PNG")
    pos = len(PNG_SIGNATURE)
    width = height = 0
    saw_idat = False
    saw_iend = False
    chunk_index = 0
    while pos < len(data):
        if pos + 12 > len(data):
            raise RecoveryError(f"{label}: truncated PNG chunk in {name}")
        length = struct.unpack_from(">I", data, pos)[0]
        end = pos + 12 + length
        if end > len(data):
            raise RecoveryError(f"{label}: truncated PNG chunk data in {name}")
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        expected_crc = struct.unpack_from(">I", data, pos + 8 + length)[0]
        if (zlib.crc32(kind + payload) & 0xFFFFFFFF) != expected_crc:
            raise RecoveryError(f"{label}: PNG CRC mismatch for {name}")
        if chunk_index == 0:
            if kind != b"IHDR" or length != 13:
                raise RecoveryError(f"{label}: {name} does not start with a PNG IHDR")
            width, height = struct.unpack_from(">II", payload)
            if width == 0 or height == 0:
                raise RecoveryError(f"{label}: {name} has zero dimensions")
        elif kind == b"IHDR":
            raise RecoveryError(f"{label}: duplicate PNG IHDR in {name}")
        elif kind == b"IDAT":
            saw_idat = True
        pos = end
        chunk_index += 1
        if kind == b"IEND":
            if length != 0 or not saw_idat or pos != len(data):
                raise RecoveryError(f"{label}: malformed PNG IEND or trailing data in {name}")
            saw_iend = True
            break
    if not saw_iend:
        raise RecoveryError(f"{label}: PNG has no IEND for {name}")
    return width, height


def decode_page_sources(forest_path: Path, tutorial_path: Path, wanted: set[str]) -> tuple[dict, dict]:
    try:
        forest_text = forest_path.read_text(encoding="utf-8")
        tutorial_text = tutorial_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RecoveryError(f"cannot read built page: {exc}") from exc

    forest = page_objects(forest_text, forest_path.name, wanted)
    docs = parse_json_after(tutorial_text, "const DOCS = ", tutorial_path.name)
    if not isinstance(docs, dict) or not isinstance(docs.get("board"), str):
        raise RecoveryError(f"{tutorial_path.name}: DOCS.board is missing or not a string")
    board = page_objects(docs["board"], f"{tutorial_path.name}:DOCS.board", wanted)
    return forest, board


def recover(root: Path) -> list[tuple[str, int, int, int]]:
    root = Path(root).resolve()
    html_dir = root
    builder = BUILDER.read_text(encoding="utf-8")
    names = builder_object_names(builder)
    forest, board = decode_page_sources(
        html_dir / "forest-combat.html", html_dir / "tutorial-demo.html", set(names)
    )

    missing = sorted(name for name in names if name not in forest or name not in board)
    if missing:
        raise RecoveryError(f"built pages are missing builder objects: {', '.join(missing)}")

    payloads: dict[str, tuple[bytes, tuple[int, int]]] = {}
    for name in names:
        first = forest[name]
        second = board[name]
        if first != second:
            raise RecoveryError(f"built-page bytes or dimensions differ for {name}")
        payloads[name] = first

    targets = [root / "assets" / "fc", root / "fc"]
    for directory in targets:
        current = directory
        while current != root:
            if current.is_symlink():
                raise RecoveryError(f"refusing symlink output path: {current}")
            current = current.parent
    conflicts: list[Path] = []
    for directory in targets:
        for name, (data, _dims) in payloads.items():
            path = directory / f"obj_{name}.png"
            if path.is_symlink() or (path.exists() and (not path.is_file() or path.read_bytes() != data)):
                conflicts.append(path)
    if conflicts:
        raise RecoveryError("refusing to overwrite different existing files: " + ", ".join(map(str, conflicts)))

    for directory in targets:
        directory.mkdir(parents=True, exist_ok=True)
    staged: list[tuple[Path, Path]] = []
    try:
        for directory in targets:
            for name, (data, _dims) in payloads.items():
                target = directory / f"obj_{name}.png"
                if target.exists():
                    continue
                with tempfile.NamedTemporaryFile(
                    mode="wb", prefix=f".obj_{name}.", suffix=".tmp", dir=directory, delete=False
                ) as temp:
                    temp_path = Path(temp.name)
                    staged.append((temp_path, target))
                    temp.write(data)
                    temp.flush()
                    os.fsync(temp.fileno())
        for temp_path, target in staged:
            temp_path.replace(target)
    finally:
        for temp_path, _target in staged:
            if temp_path.exists():
                temp_path.unlink()

    rows = []
    for name in names:
        data, (width, height) = payloads[name]
        for directory in targets:
            written = (directory / f"obj_{name}.png").read_bytes()
            if written != data:
                path = directory / f"obj_{name}.png"
                raise RecoveryError(f"read-back verification failed for {path}")
        rows.append((name, width, height, len(data)))
    return rows


def main() -> int:
    try:
        rows = recover(HERE)
    except (OSError, RecoveryError) as exc:
        print(f"recovery failed: {exc}", file=sys.stderr)
        return 1
    print("Recovered 13/13 byte-identical PNGs from forest-combat.html and tutorial-demo.html:")
    print("name           dimensions   bytes")
    for name, width, height, size in rows:
        print(f"{name:<14} {width:>3}x{height:<3}      {size}")
    print(
        "Verified builder coverage, canonical base64 round-trip, PNG CRC/IHDR dimensions, "
        "cross-page parity, and read-back bytes; wrote 13 PNGs to each output path (26 files total)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
