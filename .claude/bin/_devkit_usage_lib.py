"""Shared transcript-scanning primitives for devkit-usage and devkit-projects.

No I/O at import time. Callers pass search roots explicitly.
"""

from __future__ import annotations

import glob
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional


@dataclass(frozen=True)
class UsageEntry:
    timestamp: datetime
    session_id: str
    cwd: Optional[str]
    usage: dict


def parse_ts(ts_str: Optional[str]) -> Optional[datetime]:
    """Parse a Claude transcript ISO-8601 timestamp; returns None on invalid input."""
    if not ts_str:
        return None
    try:
        if isinstance(ts_str, str) and ts_str.endswith("Z"):
            ts_str = ts_str[:-1] + "+00:00"
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


_TOTAL_TOKEN_FIELDS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
)

_CONTEXT_TOKEN_FIELDS = (
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
)


def total_tokens(usage: Optional[dict]) -> int:
    """Sum input + output + cache_creation + cache_read tokens. Returns 0 for None or non-dict."""
    if not isinstance(usage, dict):
        return 0
    return sum(usage.get(field, 0) for field in _TOTAL_TOKEN_FIELDS)


def context_tokens_of(usage: Optional[dict]) -> int:
    """Tokens occupying the context window (exclude output — it's not in-context)."""
    if not isinstance(usage, dict):
        return 0
    return sum(usage.get(field, 0) for field in _CONTEXT_TOKEN_FIELDS)


def discover_search_roots() -> list[Path]:
    """Directories to glob for *.jsonl transcripts.

    Supports multiple Claude CLIs that share the Anthropic transcript format:
      - Vanilla Claude Code  ~/.claude/projects/
      - CCS                  ~/.ccs/shared/context-groups/<group>/projects/

    Extra paths can be added via DEVKIT_TRANSCRIPT_PATHS (colon-separated).
    """
    roots: list[Path] = []

    claude_dir = Path.home() / ".claude" / "projects"
    if claude_dir.is_dir():
        roots.append(claude_dir)

    ccs_base = Path.home() / ".ccs" / "shared" / "context-groups"
    if ccs_base.is_dir():
        try:
            for group in ccs_base.iterdir():
                proj = group / "projects"
                if proj.is_dir():
                    roots.append(proj)
        except OSError:
            pass

    for entry in os.environ.get("DEVKIT_TRANSCRIPT_PATHS", "").split(":"):
        entry = entry.strip()
        if entry and Path(entry).is_dir():
            roots.append(Path(entry))

    return roots


def iter_usage_entries(
    roots: list[Path],
    since: Optional[datetime] = None,
) -> Iterable[UsageEntry]:
    """Yield UsageEntry instances from every *.jsonl under the given roots.

    `since`: if set, files with mtime older than this are skipped, and entries
    whose parsed timestamp is older are filtered out.
    """
    if not roots:
        return

    since_ts = since.timestamp() if since else None

    for root in roots:
        for path in glob.iglob(str(root / "**" / "*.jsonl"), recursive=True):
            if since_ts is not None:
                try:
                    if os.path.getmtime(path) < since_ts:
                        continue
                except OSError:
                    continue

            try:
                fh = open(path, "r", encoding="utf-8", errors="ignore")
            except OSError:
                continue

            with fh:
                for line in fh:
                    if '"usage"' not in line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = entry.get("message") or {}
                    usage = msg.get("usage")
                    if not usage:
                        continue
                    timestamp = parse_ts(entry.get("timestamp"))
                    if timestamp is None:
                        continue
                    if since is not None and timestamp < since:
                        continue
                    yield UsageEntry(
                        timestamp=timestamp,
                        session_id=entry.get("sessionId") or "",
                        cwd=entry.get("cwd"),
                        usage=usage,
                    )


# Sentinel labels for the report. Wrapped in parens so they sort and display
# distinctly from real project names (which never start with '(' on a real fs).
OTHER_LABEL = "(other)"
PARENT_ROOT_LABEL = "(parent-root)"


def _is_under(child: str, parent: str) -> bool:
    """True if `child` equals `parent` or is a subdirectory of `parent`."""
    if child == parent:
        return True
    if not parent.endswith("/"):
        parent = parent + "/"
    return child.startswith(parent)


def attribute(cwd: Optional[str], parents: list[str], paths: list[str]) -> str:
    """Return the project label for `cwd`.

    Rules (first match wins):
      1. Explicit-path match → basename(p)
      2. Parent match (longest parent wins) → first directory component under P
      3. cwd == parent exactly → PARENT_ROOT_LABEL
      4. otherwise → OTHER_LABEL
    """
    if not cwd:
        return OTHER_LABEL

    for path in paths:
        if _is_under(cwd, path):
            return os.path.basename(path.rstrip("/")) or OTHER_LABEL

    matching_parent = None
    for parent in parents:
        if _is_under(cwd, parent):
            if matching_parent is None or len(parent) > len(matching_parent):
                matching_parent = parent

    if matching_parent is None:
        return OTHER_LABEL

    if cwd == matching_parent:
        return PARENT_ROOT_LABEL

    parent_norm = matching_parent if matching_parent.endswith("/") else matching_parent + "/"
    rest = cwd[len(parent_norm):]
    first_segment = rest.split("/", 1)[0]
    return first_segment or PARENT_ROOT_LABEL
