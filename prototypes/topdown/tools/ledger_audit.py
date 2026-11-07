#!/usr/bin/env python3
"""Audit a PixelLab ledger snapshot without modifying it."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
MISMATCH_RATIO = Decimal("0.20")
PHASE_TOLERANCE = Decimal("0.000001")
PHASE_PREFIX_RE = re.compile(r"^([a-z]+[0-9]+_)", re.IGNORECASE)
PHASE_KEY_RE = re.compile(r"^([a-z]+[0-9]+_)(start_balance|end_balance|ledger_spent)$", re.IGNORECASE)
SNAPSHOT_CAVEAT = (
    "Per-job balance_diff values are balance snapshots and may overlap when jobs run in parallel. "
    "Their raw sum is shown for comparison, not as an exclusive charge or spend total."
)


class AuditError(ValueError):
    """Raised when the input ledger does not satisfy the expected data contract."""


def _reject_json_constant(value: str) -> None:
    raise AuditError(f"non-standard JSON number {value!r} is not allowed")


def _object_without_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise AuditError(f"duplicate JSON object key {key!r} is not allowed")
        result[key] = value
    return result


def _check_finite_tree(value: Any, location: str = "$") -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise AuditError(f"{location} must be a finite number")
    if isinstance(value, dict):
        for key, item in value.items():
            _check_finite_tree(item, f"{location}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _check_finite_tree(item, f"{location}[{index}]")


def _number(value: Any, location: str) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AuditError(f"{location} must be a JSON number (booleans and numeric strings are invalid)")
    if isinstance(value, float) and not math.isfinite(value):
        raise AuditError(f"{location} must be finite")
    try:
        return Decimal(str(value))
    except Exception as exc:  # Decimal can reject extreme or malformed representations.
        raise AuditError(f"{location} is not a usable finite number") from exc


def _json_number(value: Decimal | None) -> int | float | None:
    if value is None:
        return None
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def _ratio_exceeded(booked: Decimal, delta: Decimal) -> bool:
    if booked == 0 and delta == 0:
        return False
    if delta == 0:
        return booked != 0
    return abs(booked - delta) / abs(delta) > MISMATCH_RATIO


def _differs_over_tolerance(left: Decimal | None, right: Decimal | None) -> bool | None:
    if left is None or right is None:
        return None
    return abs(left - right) > PHASE_TOLERANCE


def _job_prefix(name: str) -> str | None:
    match = PHASE_PREFIX_RE.match(name)
    return match.group(1).casefold() if match else None


def audit(raw: bytes, ledger_path: Path) -> dict[str, Any]:
    try:
        ledger = json.loads(
            raw,
            parse_constant=_reject_json_constant,
            object_pairs_hook=_object_without_duplicate_keys,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditError(f"could not parse ledger JSON: {exc}") from exc
    _check_finite_tree(ledger)
    if not isinstance(ledger, dict):
        raise AuditError("ledger root must be a JSON object")
    rows = ledger.get("jobs")
    if not isinstance(rows, list):
        raise AuditError("ledger.jobs must be a JSON array")

    parsed_rows: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        where = f"jobs[{index}]"
        if not isinstance(row, dict):
            raise AuditError(f"{where} must be an object")
        name = row.get("name")
        if not isinstance(name, str) or not name.strip():
            raise AuditError(f"{where}.name must be a non-empty string")
        status = row.get("status")
        if not isinstance(status, str) or not status.strip():
            raise AuditError(f"{where}.status must be a non-empty string")
        if "credits" not in row:
            raise AuditError(f"{where}.credits is required")
        credits = _number(row["credits"], f"{where}.credits")
        delta = None
        if "balance_diff" in row:
            delta = _number(row["balance_diff"], f"{where}.balance_diff")
        after = None
        if "balance_after" in row:
            after = _number(row["balance_after"], f"{where}.balance_after")
        parsed_rows.append(
            {
                "index": index,
                "name": name,
                "status": status,
                "credits": credits,
                "delta": delta,
                "balance_after": after,
                "prefix": _job_prefix(name),
            }
        )

    metadata: dict[str, dict[str, Any]] = {}
    metadata_original_keys: dict[tuple[str, str], str] = {}
    unmapped_metadata_keys: list[str] = []
    all_phase_prefixes = {row["prefix"] for row in parsed_rows if row["prefix"] is not None}
    for key, value in ledger.items():
        if key == "jobs":
            continue
        prefix_match = PHASE_PREFIX_RE.match(key) if isinstance(key, str) else None
        mapped = PHASE_KEY_RE.match(key)
        if not mapped:
            unmapped_metadata_keys.append(key)
            if prefix_match:
                all_phase_prefixes.add(prefix_match.group(1).casefold())
            continue
        prefix = mapped.group(1).casefold()
        suffix = mapped.group(2).casefold()
        all_phase_prefixes.add(prefix)
        identity = (prefix, suffix)
        prior_key = metadata_original_keys.get(identity)
        if prior_key is not None:
            raise AuditError(
                f"case-folded phase metadata collision between {prior_key!r} and {key!r}"
            )
        metadata_original_keys[identity] = key
        amount = _number(value, key)
        metadata.setdefault(prefix, {})[suffix] = amount

    phases: list[dict[str, Any]] = []
    missing_phase_evidence: list[dict[str, Any]] = []
    all_job_mismatches: list[dict[str, Any]] = []
    mismatches_by_prefix: dict[str, list[dict[str, Any]]] = {}
    for row in parsed_rows:
        if row["delta"] is None or not _ratio_exceeded(row["credits"], row["delta"]):
            continue
        item = {
            "name": row["name"],
            "prefix": row["prefix"],
            "credits": _json_number(row["credits"]),
            "balance_diff": _json_number(row["delta"]),
            "denominator": "abs(balance_diff)",
            "threshold": 0.20,
        }
        all_job_mismatches.append(item)
        if row["prefix"] is not None:
            mismatches_by_prefix.setdefault(row["prefix"], []).append(item)
    for prefix in sorted(all_phase_prefixes):
        phase_rows = [row for row in parsed_rows if row["prefix"] == prefix]
        phase_meta = metadata.get(prefix, {})
        booked = sum((row["credits"] for row in phase_rows), Decimal(0))
        row_delta_sum = sum((row["delta"] for row in phase_rows if row["delta"] is not None), Decimal(0))
        missing_delta_count = sum(row["delta"] is None for row in phase_rows)
        start = phase_meta.get("start_balance")
        end = phase_meta.get("end_balance")
        declared = phase_meta.get("ledger_spent")
        phase_delta = start - end if start is not None and end is not None else None
        last_with_after = next((row for row in reversed(phase_rows) if row["balance_after"] is not None), None)
        end_mismatch = _differs_over_tolerance(
            end, last_with_after["balance_after"] if last_with_after else None
        )

        phase_flags = {
            "booked_credits_vs_phase_delta_differs_over_tolerance": _differs_over_tolerance(booked, phase_delta),
            "row_delta_sum_vs_phase_delta_differs_over_tolerance": _differs_over_tolerance(row_delta_sum, phase_delta),
            "booked_credits_vs_declared_ledger_spent_differs_over_tolerance": _differs_over_tolerance(booked, declared),
            "metadata_end_vs_last_listed_job_balance_after_differs_over_tolerance": end_mismatch,
        }
        missing = {
            "prefix": prefix,
            "no_jobs": not phase_rows,
            "missing_start_balance": start is None,
            "missing_end_balance": end is None,
            "missing_ledger_spent": declared is None,
        }
        if any(value for key, value in missing.items() if key != "prefix"):
            missing_phase_evidence.append(missing)

        phases.append(
            {
                "prefix": prefix,
                "job_count": len(phase_rows),
                "booked_credits": _json_number(booked),
                "row_balance_delta_sum": _json_number(row_delta_sum),
                "row_balance_delta_sum_semantics": "raw snapshot sum; may overlap, not proven exclusive spend",
                "missing_balance_diff_count": missing_delta_count,
                "phase_metadata": {
                    "start_balance": _json_number(start),
                    "end_balance": _json_number(end),
                    "phase_balance_delta_start_minus_end": _json_number(phase_delta),
                    "declared_ledger_spent": _json_number(declared),
                    "last_listed_job_name_with_balance_after": last_with_after["name"] if last_with_after else None,
                    "last_listed_job_balance_after": _json_number(last_with_after["balance_after"] if last_with_after else None),
                },
                "flags": phase_flags,
                "job_balance_mismatches": mismatches_by_prefix.get(prefix, []),
            }
        )

    unmapped_rows = [row for row in parsed_rows if row["prefix"] is None]
    all_booked = sum((row["credits"] for row in parsed_rows), Decimal(0))
    all_delta_sum = sum((row["delta"] for row in parsed_rows if row["delta"] is not None), Decimal(0))
    zero_credit_jobs = [row["name"] for row in parsed_rows if row["credits"] == 0]
    noncompleted_jobs = [row["name"] for row in parsed_rows if row["status"].casefold() != "completed"]
    missing_delta_jobs = [row["name"] for row in parsed_rows if row["delta"] is None]

    return {
        "schema_version": SCHEMA_VERSION,
        "input": {
            "path": str(ledger_path),
            "sha256": hashlib.sha256(raw).hexdigest(),
        },
        "policy": {
            "job_mismatch_ratio_threshold": 0.20,
            "phase_delta_comparison_tolerance_credits": float(PHASE_TOLERANCE),
            "recognized_prefix_pattern": "case-insensitive alphabetic label + digits + underscore (for example t2_, v12_, prop3_)",
            "ratio_denominator": "abs(balance_diff); zero vs zero is equal; nonzero booked credits vs zero delta is a mismatch",
            "row_delta_sum": "raw sum only; per-job balance snapshots may overlap and are not proven exclusive charges",
        },
        "summary": {
            "job_count": len(parsed_rows),
            "booked_credits": _json_number(all_booked),
            "row_balance_delta_sum": _json_number(all_delta_sum),
            "row_balance_delta_sum_semantics": "raw snapshot sum; may overlap, not proven exclusive spend",
            "missing_balance_diff_count": sum(row["delta"] is None for row in parsed_rows),
            "zero_credit_job_count": len(zero_credit_jobs),
            "noncompleted_job_count": len(noncompleted_jobs),
        },
        "phases": phases,
        "t3_evidence": {
            "present": bool(metadata.get("t3_")) or any(row["prefix"] == "t3_" for row in parsed_rows),
            "job_count": sum(row["prefix"] == "t3_" for row in parsed_rows),
            "has_phase_metadata": bool(metadata.get("t3_")),
        },
        "unmapped_jobs": [row["name"] for row in unmapped_rows],
        "unmapped_metadata_keys": sorted(unmapped_metadata_keys),
        "missing_phase_evidence": missing_phase_evidence,
        "exceptions": {
            "zero_credit_jobs": zero_credit_jobs,
            "noncompleted_jobs": noncompleted_jobs,
            "missing_balance_diff_jobs": missing_delta_jobs,
            "job_booked_vs_delta_over_20_percent": all_job_mismatches,
        },
        "caveats": [SNAPSHOT_CAVEAT],
    }


def _human_report(report: dict[str, Any]) -> str:
    source = report["input"]
    summary = report["summary"]
    lines = [
        "PixelLab ledger audit (read-only)",
        f"Source: {source['path']}",
        f"SHA-256: {source['sha256']}",
        f"Jobs: {summary['job_count']} | booked credits: {summary['booked_credits']} | raw row balance_diff sum: {summary['row_balance_delta_sum']} (may overlap; not proven exclusive spend)",
        f"Missing balance_diff: {summary['missing_balance_diff_count']} | zero-credit jobs: {summary['zero_credit_job_count']} | non-completed jobs: {summary['noncompleted_job_count']}",
        "",
        "Phase/prefix summary:",
    ]
    t3 = report["t3_evidence"]
    lines.append(
        f"T3 evidence: {'present' if t3['present'] else 'absent'} "
        f"(jobs={t3['job_count']}, recognized phase metadata={'yes' if t3['has_phase_metadata'] else 'no'})."
    )
    if not report["phases"]:
        lines.append("  No phase-prefixed jobs or metadata found.")
    for phase in report["phases"]:
        meta = phase["phase_metadata"]
        flags = [name for name, active in phase["flags"].items() if active]
        lines.append(
            f"  {phase['prefix']} jobs={phase['job_count']} booked={phase['booked_credits']} "
            f"row-delta-sum={phase['row_balance_delta_sum']} (may overlap) "
            f"phase-delta={meta['phase_balance_delta_start_minus_end']} declared-spent={meta['declared_ledger_spent']}"
        )
        if meta["end_balance"] is None:
            lines.append("    Missing phase end balance metadata.")
        elif meta["last_listed_job_balance_after"] is not None and phase["flags"]["metadata_end_vs_last_listed_job_balance_after_differs_over_tolerance"]:
            lines.append(
                f"    End-balance diagnostic: metadata end {meta['end_balance']} differs from last listed job "
                f"{meta['last_listed_job_name_with_balance_after']} after={meta['last_listed_job_balance_after']} (order-based)."
            )
        lines.append(f"    Flags: {', '.join(flags) if flags else 'none'}")
    exceptions = report["exceptions"]
    for key, label in (
        ("zero_credit_jobs", "Zero-credit jobs"),
        ("noncompleted_jobs", "Non-completed jobs"),
        ("missing_balance_diff_jobs", "Jobs missing balance_diff"),
        ("job_booked_vs_delta_over_20_percent", "Booked-vs-delta mismatches (>20% of abs(balance_diff))"),
    ):
        items = exceptions[key]
        lines.append("")
        lines.append(f"{label} ({len(items)}):")
        if not items:
            lines.append("  none")
        else:
            for item in items:
                if isinstance(item, dict):
                    lines.append(f"  {item['name']}: credits={item['credits']}, balance_diff={item['balance_diff']}")
                else:
                    lines.append(f"  {item}")
    if report["unmapped_jobs"]:
        lines.extend(["", "Unmapped jobs (no recognized phase prefix):", *[f"  {name}" for name in report["unmapped_jobs"]]])
    if report["unmapped_metadata_keys"]:
        lines.extend(["", "Unmapped metadata keys (not interpreted):", *[f"  {key}" for key in report["unmapped_metadata_keys"]]])
    if report["missing_phase_evidence"]:
        lines.extend(["", "Missing phase evidence:"])
        for item in report["missing_phase_evidence"]:
            gaps = [key.removeprefix("missing_").replace("_", " ") for key, missing in item.items() if key.startswith("missing_") and missing]
            if item["no_jobs"]:
                gaps.insert(0, "phase-prefixed jobs")
            lines.append(f"  {item['prefix']}: {', '.join(gaps) if gaps else 'none'}")
    lines.extend(["", *report["caveats"]])
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, help="ledger JSON path; relative paths resolve from the current directory")
    parser.add_argument("--json", action="store_true", help="print the versioned machine-readable report")
    args = parser.parse_args(argv)
    if args.ledger is None:
        ledger_path = Path(__file__).resolve().parents[1] / "ledger.json"
    else:
        ledger_path = args.ledger
    try:
        ledger_path = ledger_path.resolve(strict=True)
        if not ledger_path.is_file():
            raise AuditError(f"ledger path is not a file: {ledger_path}")
        raw = ledger_path.read_bytes()
        report = audit(raw, ledger_path)
    except (OSError, AuditError) as exc:
        print(f"ledger audit error: {exc}", file=sys.stderr)
        return 2
    if args.json:
        json.dump(report, sys.stdout, indent=2, ensure_ascii=False, allow_nan=False)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(_human_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
