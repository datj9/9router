#!/usr/bin/env python3
"""devkit-projects: per-repository token-usage report and registry CLI.

Subcommands:
  register --parent <path>   Register a parent dir (subdirs become projects).
  register --path <path>     Register an explicit project path.
  list                       Show registered parents and paths.
  remove <path>              Remove a registered parent or path.
  report [--sort-by 5h|7d|30d|all] [--json] [--no-cache]
                             Print per-repo token usage table.

Registry file: ~/.claude/devkit-projects.json (override with DEVKIT_PROJECTS_REGISTRY).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Pick up the shared lib next to this file.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _devkit_usage_lib import (  # noqa: E402
    attribute,
    discover_search_roots,
    iter_usage_entries,
    total_tokens,
)
from devkit_projects_render import render_report  # noqa: E402


REGISTRY_VERSION = 1

_DEFAULT_CACHE_PATH = Path("/tmp") / "devkit-projects-report.json"
CACHE_TTL_SEC = 10


def _cache_path() -> Path:
    """Return the cache file path. Override via DEVKIT_REPORT_CACHE_PATH for tests."""
    override = os.environ.get("DEVKIT_REPORT_CACHE_PATH")
    if override:
        return Path(override)
    return _DEFAULT_CACHE_PATH


WINDOWS = (
    ("5h",  timedelta(hours=5)),
    ("7d",  timedelta(days=7)),
    ("30d", timedelta(days=30)),
    ("all", None),
)


def _now() -> datetime:
    """`now` in UTC. Override via DEVKIT_FAKE_NOW (ISO-8601) for tests."""
    fake = os.environ.get("DEVKIT_FAKE_NOW")
    if fake:
        try:
            parsed = datetime.fromisoformat(fake)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def compute_per_repo_report(parents: list[str], paths: list[str], now: datetime) -> list[dict]:
    """Scan all transcripts, attribute each usage entry to a repo, sum per window."""
    cutoffs = {label: (now - delta) if delta else None for label, delta in WINDOWS}

    repos: dict[str, dict] = {}

    for entry in iter_usage_entries(discover_search_roots(), since=None):
        label = attribute(entry.cwd, parents, paths)
        bucket = repos.setdefault(label, {
            "5h": 0, "7d": 0, "30d": 0, "all": 0, "sessions": set(),
        })
        tok = total_tokens(entry.usage)
        bucket["all"] += tok
        if entry.session_id:
            bucket["sessions"].add(entry.session_id)
        for win_label, cutoff in cutoffs.items():
            if win_label == "all":
                continue
            if cutoff is not None and entry.timestamp >= cutoff:
                bucket[win_label] += tok

    rows = []
    for label, bucket in repos.items():
        rows.append({
            "repo": label,
            "5h": bucket["5h"],
            "7d": bucket["7d"],
            "30d": bucket["30d"],
            "all": bucket["all"],
            "sessions": len(bucket["sessions"]),
        })
    return rows


def _read_cache() -> list[dict] | None:
    try:
        cache = _cache_path()
        if not cache.is_file():
            return None
        if time.time() - cache.stat().st_mtime >= CACHE_TTL_SEC:
            return None
        with cache.open("r", encoding="utf-8") as fh:
            return json.load(fh).get("rows")
    except (OSError, json.JSONDecodeError):
        return None


def _write_cache(rows: list[dict]) -> None:
    try:
        cache = _cache_path()
        tmp = cache.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as fh:
            json.dump({"rows": rows}, fh)
        os.replace(tmp, cache)
    except OSError:
        pass


def cmd_report(args: argparse.Namespace) -> int:
    reg_path = registry_path()
    data = load_registry(reg_path)

    rows: list[dict] | None = None if args.no_cache else _read_cache()
    if rows is None:
        rows = compute_per_repo_report(data["parents"], data["paths"], _now())
        if not args.no_cache:
            _write_cache(rows)

    if args.json:
        json.dump({"rows": rows}, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    if not data["parents"] and not data["paths"]:
        sys.stdout.write(
            "Note: no project paths registered. All sessions grouped under (other).\n"
            "Register a parent dir to see a per-repo breakdown:\n"
            f"     {Path(sys.argv[0]).name} register --parent <path>\n\n"
        )

    sort_by = args.sort_by
    sys.stdout.write(render_report(rows, sort_by=sort_by))
    return 0


def registry_path() -> Path:
    override = os.environ.get("DEVKIT_PROJECTS_REGISTRY")
    if override:
        return Path(override)
    return Path.home() / ".claude" / "devkit-projects.json"


def load_registry(path: Path) -> dict:
    """Load the registry. Missing → empty registry. Malformed → raise."""
    if not path.exists():
        return {"version": REGISTRY_VERSION, "parents": [], "paths": []}
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"error: registry at {path} is not valid JSON: {exc}")
    data.setdefault("version", REGISTRY_VERSION)
    data.setdefault("parents", [])
    data.setdefault("paths", [])
    return data


def save_registry(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def _canon(raw: str) -> str:
    """Canonicalize a path: absolute + symlinks resolved."""
    return str(Path(raw).expanduser().resolve())


def cmd_register(args: argparse.Namespace) -> int:
    path = registry_path()
    data = load_registry(path)

    target = _canon(args.parent or args.path)

    if args.parent:
        existing = data["parents"]
        # Warn on overlap with another parent (sub or super).
        for other in existing:
            if target == other:
                continue
            if target.startswith(other + "/") or other.startswith(target + "/"):
                print(
                    f"warning: parent {target!r} overlaps existing parent {other!r}; "
                    "longest match wins at attribution time",
                    file=sys.stderr,
                )
                break
        if target not in existing:
            existing.append(target)
            existing.sort()
            save_registry(path, data)
            print(f"Registered parent: {target}")
        else:
            print(f"Already registered (parent): {target}")
        return 0

    existing = data["paths"]
    if target not in existing:
        existing.append(target)
        existing.sort()
        save_registry(path, data)
        print(f"Registered path: {target}")
    else:
        print(f"Already registered (path): {target}")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    path = registry_path()
    data = load_registry(path)

    rows = []
    for entry in data["parents"]:
        marker = "" if Path(entry).is_dir() else " (missing)"
        rows.append(("parent", entry + marker))
    for entry in data["paths"]:
        marker = "" if Path(entry).is_dir() else " (missing)"
        rows.append(("path", entry + marker))

    if not rows:
        print("(empty registry)")
        print("Tip: register a parent dir with:")
        print(f"     {Path(sys.argv[0]).name} register --parent <path>")
        return 0

    width = max(len(kind) for kind, _ in rows)
    for kind, value in rows:
        print(f"{kind:<{width}}  {value}")
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    path = registry_path()
    data = load_registry(path)
    target = _canon(args.path)

    removed = False
    if target in data["parents"]:
        data["parents"].remove(target)
        removed = True
        kind = "parent"
    elif target in data["paths"]:
        data["paths"].remove(target)
        removed = True
        kind = "path"

    if not removed:
        print(f"error: {target!r} is not registered", file=sys.stderr)
        return 1

    save_registry(path, data)
    print(f"Removed {kind}: {target}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="devkit-projects", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_reg = sub.add_parser("register", help="Register a parent dir or explicit project path")
    group = p_reg.add_mutually_exclusive_group(required=True)
    group.add_argument("--parent", help="Parent directory; subdirs become projects")
    group.add_argument("--path", help="Explicit project path")
    p_reg.set_defaults(func=cmd_register)

    p_list = sub.add_parser("list", help="Show registered parents and paths")
    p_list.set_defaults(func=cmd_list)

    p_rem = sub.add_parser("remove", help="Remove a registered entry")
    p_rem.add_argument("path")
    p_rem.set_defaults(func=cmd_remove)

    p_rep = sub.add_parser("report", help="Print per-repo token usage table")
    p_rep.add_argument("--sort-by", choices=["5h", "7d", "30d", "all"], default="7d")
    p_rep.add_argument("--json", action="store_true", help="Machine-readable output")
    p_rep.add_argument("--no-cache", action="store_true", help="Bypass 10s cache")
    p_rep.set_defaults(func=cmd_report)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
