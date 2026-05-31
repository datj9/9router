"""Number formatting + table rendering for devkit-projects report.

Pure functions, no I/O. Importable both from devkit-projects.py and tests.
"""

from __future__ import annotations

SYNTHETIC = {"(other)", "(parent-root)"}

COLUMNS = [
    ("REPO",     "repo",     "<", 14),
    ("5H",       "5h",       ">",  9),
    ("7D",       "7d",       ">",  9),
    ("30D",      "30d",      ">",  9),
    ("ALL-TIME", "all",      ">", 12),
    ("SESSIONS", "sessions", ">", 10),
]


def format_count(n: int) -> str:
    """Format a token count: 0–999 raw, 1K–999K, 1.0M+, 1.0B+."""
    sign = "-" if n < 0 else ""
    n = abs(n)
    if n < 1_000:
        return f"{sign}{n}"
    if n < 1_000_000:
        return f"{sign}{n / 1_000:.1f}K"
    if n < 1_000_000_000:
        return f"{sign}{n / 1_000_000:.1f}M"
    return f"{sign}{n / 1_000_000_000:.1f}B"


def _format_cell(value, key: str) -> str:
    if key == "repo":
        return str(value)
    if key == "sessions":
        return str(int(value))
    return format_count(int(value))


def _sort_key(row: dict, sort_by: str):
    """Ascending key: synthetic last, then -value (so larger values come first)."""
    is_synthetic = 1 if row["repo"] in SYNTHETIC else 0
    return (is_synthetic, -int(row.get(sort_by, 0)), row["repo"])


def render_report(rows: list[dict], sort_by: str = "7d") -> str:
    """Render the per-repo usage table. `rows` is a list of dicts with keys
    matching COLUMNS' second tuple element."""
    if not rows:
        return "(empty) no usage data found.\nTip: register a parent dir with: devkit-projects register --parent <path>\n"

    sorted_rows = sorted(rows, key=lambda r: _sort_key(r, sort_by))

    totals = {
        key: sum(int(row.get(key, 0)) for row in sorted_rows)
        for _, key, _, _ in COLUMNS
        if key != "repo"
    }

    lines = []

    header_parts = []
    for header, _, align, width in COLUMNS:
        if align == "<":
            header_parts.append(f"{header:<{width}}")
        else:
            header_parts.append(f"{header:>{width}}")
    lines.append("  ".join(header_parts))

    for row in sorted_rows:
        parts = []
        for _, key, align, width in COLUMNS:
            cell = _format_cell(row.get(key, 0), key)
            if align == "<":
                parts.append(f"{cell:<{width}}")
            else:
                parts.append(f"{cell:>{width}}")
        lines.append("  ".join(parts))

    sep_width = sum(width for _, _, _, width in COLUMNS) + 2 * (len(COLUMNS) - 1)
    lines.append("─" * sep_width)

    total_parts = []
    for header, key, align, width in COLUMNS:
        if key == "repo":
            cell = "TOTAL"
        else:
            cell = _format_cell(totals[key], key)
        if align == "<":
            total_parts.append(f"{cell:<{width}}")
        else:
            total_parts.append(f"{cell:>{width}}")
    lines.append("  ".join(total_parts))

    return "\n".join(lines) + "\n"
