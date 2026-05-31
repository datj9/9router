#!/usr/bin/env bash
# devkit-state.sh — workflow state management for ringkas-devkit
# Returns JSON to stdout for every command. Orchestrator never reads STATE.md directly.
# Compatible with bash 3.2+ (macOS default).
set -euo pipefail

DEVKIT_DIR=".devkit"
STATE_FILE="$DEVKIT_DIR/STATE.md"
CHECKPOINT_FILE="$DEVKIT_DIR/continue-here.md"

# Clean up any leftover temp files on exit
trap 'rm -f "${STATE_FILE}.tmp" 2>/dev/null || true' EXIT

# ── Workflow definitions ────────────────────────────────────────────

workflow_steps() {
  case "$1" in
    feature) echo "planner coder tester reviewer security" ;;
    bugfix)  echo "diagnose coder tester reviewer" ;;
    review)  echo "reviewer security" ;;
    audit)   echo "security" ;;
    *)       return 1 ;;
  esac
}

# ── Model routing (balanced profile) ───────────────────────────────

model_for() {
  case "$1" in
    planner)  echo "opus" ;;
    coder)    echo "sonnet" ;;
    tester)   echo "sonnet" ;;
    reviewer) echo "sonnet" ;;
    security) echo "haiku" ;;
    diagnose) echo "sonnet" ;;
    *)        echo "sonnet" ;;
  esac
}

# ── Skip warnings ──────────────────────────────────────────────────

skip_warning_for() {
  case "$1" in
    planner)  echo "No plan — proceeding without architecture review." ;;
    coder)    echo "No auto-code — engineer will implement manually." ;;
    tester)   echo "No tests generated. Coverage may drop below 80%." ;;
    reviewer) echo "Code not reviewed against Ringkas conventions." ;;
    security) echo "ISO 27001 compliance not checked. Required for auth/PII changes." ;;
    diagnose) echo "No root cause analysis — proceeding without diagnosis." ;;
    *)        echo "" ;;
  esac
}

# ── Helpers ─────────────────────────────────────────────────────────

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  # Strip remaining control characters (0x00-0x1F except \n \r \t already handled)
  printf '%s' "$s" | tr -d '\000-\010\013\014\016-\037'
}

now_iso() { date -u +"%Y-%m-%dT%H:%M:%S"; }
now_time() { date -u +"%H:%M"; }
today() { date -u +"%Y%m%d"; }

gen_session_id() {
  local wf="$1"
  local prefix
  prefix="$(printf '%s' "$wf" | cut -c1)"
  local hex
  hex=$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c4)
  printf '%s-%s-%s' "$prefix" "$(today)" "$hex"
}

die() { printf '{"error": "%s"}\n' "$(json_escape "$1")" >&2; exit 1; }

require_state() {
  [[ -f "$STATE_FILE" ]] || die "No active session. Run: devkit-state.sh init <workflow> <ticket>"
}

# ── STATE.md readers ────────────────────────────────────────────────

read_frontmatter() {
  local key="$1"
  sed -n '/^---$/,/^---$/p' "$STATE_FILE" | grep "^${key}:" | head -1 | sed "s/^${key}: *//"
}

read_steps() {
  # Output: step|status|skipped|agent|started|completed  per line
  awk '/^\| Step /,0' "$STATE_FILE" \
    | tail -n +3 \
    | grep '^|' \
    | sed 's/^| *//;s/ *| */|/g;s/ *|$//'
}

get_step_field() {
  # $1=step_name $2=field_index (0-based: 0=step,1=status,2=skipped,3=agent,4=started,5=completed)
  local step="$1" idx="$2"
  read_steps | awk -F'|' -v s="$step" -v i="$((idx+1))" '$1==s {print $i}'
}

current_step_name() {
  read_steps | awk -F'|' '$2=="in_progress" {print $1; exit}'
}

next_pending_step() {
  read_steps | awk -F'|' '$2=="pending" {print $1; exit}'
}

# ── STATE.md writers ────────────────────────────────────────────────

update_step_status() {
  local step="$1" new_status="$2" time_field="$3" time_val="$4"
  local tmp="$STATE_FILE.tmp"
  awk -v step="$step" -v status="$new_status" -v tf="$time_field" -v tv="$time_val" '
  BEGIN { in_table=0 }
  /^\| Step / { in_table=1 }
  in_table && /^\|/ {
    n = split($0, parts, "|")
    gsub(/^ +| +$/, "", parts[2])
    if (parts[2] == step) {
      gsub(/^ +| +$/, "", parts[3])
      parts[3] = status
      gsub(/^ +| +$/, "", parts[4])
      gsub(/^ +| +$/, "", parts[5])
      gsub(/^ +| +$/, "", parts[6])
      gsub(/^ +| +$/, "", parts[7])
      if (tf == "started") { parts[6] = tv }
      if (tf == "completed") { parts[7] = tv }
      printf "| %s | %s | %s | %s | %s | %s |\n", parts[2], parts[3], parts[4], parts[5], parts[6], parts[7]
      next
    }
  }
  { print }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

mark_step_skipped() {
  local step="$1"
  local tmp="$STATE_FILE.tmp"
  awk -v step="$step" '
  BEGIN { in_table=0 }
  /^\| Step / { in_table=1 }
  in_table && /^\|/ {
    n = split($0, parts, "|")
    gsub(/^ +| +$/, "", parts[2])
    if (parts[2] == step) {
      gsub(/^ +| +$/, "", parts[5])
      gsub(/^ +| +$/, "", parts[6])
      gsub(/^ +| +$/, "", parts[7])
      printf "| %s | skipped | yes | %s | %s | %s |\n", parts[2], parts[5], parts[6], parts[7]
      next
    }
  }
  { print }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

append_decision() {
  local decision="$1"
  local ts
  ts="$(now_iso)"
  local tmp="$STATE_FILE.tmp"
  awk -v dec="$decision" -v ts="$ts" '
  /^## Decisions/ { print; found=1; next }
  found && /^\(none\)/ { print "- [" ts "] " dec; found=0; next }
  found && /^$/ && !printed { print "- [" ts "] " dec; printed=1 }
  { print }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

append_skipped() {
  local step="$1" reason="$2"
  local tmp="$STATE_FILE.tmp"
  awk -v s="$step" -v r="$reason" '
  /^## Skipped Steps/ { print; found=1; next }
  found && /^\(none\)/ { print "- **" s "**: " r; found=0; next }
  found && /^$/ && !printed { print "- **" s "**: " r; printed=1 }
  { print }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

# ── Commands ────────────────────────────────────────────────────────

cmd_init() {
  local workflow="" ticket="" coder_mode="auto"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --coder) coder_mode="$2"; shift 2 ;;
      *) if [[ -z "$workflow" ]]; then workflow="$1"
         elif [[ -z "$ticket" ]]; then ticket="$1"
         fi; shift ;;
    esac
  done

  [[ -n "$workflow" ]] || die "Usage: devkit-state.sh init <workflow> <ticket-id> [--coder auto|engineer]"
  [[ -n "$ticket" ]] || die "Usage: devkit-state.sh init <workflow> <ticket-id> [--coder auto|engineer]"

  local steps
  steps="$(workflow_steps "$workflow" 2>/dev/null)" || die "Unknown workflow: $workflow. Valid: feature, bugfix, review, audit"
  [[ "$coder_mode" == "auto" || "$coder_mode" == "engineer" ]] || die "Invalid coder mode: $coder_mode. Valid: auto, engineer"

  local session_id
  session_id="$(gen_session_id "$workflow")"
  local started
  started="$(now_iso)"
  local first_step="${steps%% *}"
  local first_model
  first_model="$(model_for "$first_step")"

  mkdir -p "$DEVKIT_DIR"

  # Add to .gitignore if not present
  if [[ -f .gitignore ]]; then
    grep -q '^\.devkit/' .gitignore 2>/dev/null || echo '.devkit/' >> .gitignore
  else
    echo '.devkit/' > .gitignore
  fi

  # Build table rows
  local table_rows=""
  local first=1
  for step in $steps; do
    local status="pending" step_started="—"
    if [[ $first -eq 1 ]]; then
      status="in_progress"
      step_started="$(now_time)"
      first=0
    fi
    local m
    m="$(model_for "$step")"
    table_rows="${table_rows}| ${step} | ${status} | — | ${m} | ${step_started} | — |
"
  done

  cat > "$STATE_FILE" <<EOF
---
workflow: ${workflow}
session_id: ${session_id}
started: ${started}
ticket: ${ticket}
coder_mode: ${coder_mode}
---

## Progress

| Step | Status | Skipped | Agent | Started | Completed |
|------|--------|---------|-------|---------|-----------|
${table_rows}
## Decisions
(none)

## Skipped Steps
(none)

## Blockers
(none)
EOF

  # Build steps JSON array
  local steps_json="["
  local sep=""
  for step in $steps; do
    steps_json="${steps_json}${sep}\"${step}\""
    sep=","
  done
  steps_json="${steps_json}]"

  printf '{"session_id":"%s","workflow":"%s","ticket":"%s","coder_mode":"%s","steps":%s,"current_step":"%s","current_model":"%s"}\n' \
    "$session_id" "$workflow" "$ticket" "$coder_mode" "$steps_json" "$first_step" "$first_model"
}

cmd_advance() {
  require_state
  local decision=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --decision) decision="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  local cur
  cur="$(current_step_name)"
  if [[ -z "$cur" ]]; then
    local next
    next="$(next_pending_step)"
    if [[ -z "$next" ]]; then
      printf '{"completed_step":null,"next_step":null,"next_agent_model":null,"workflow_complete":true}\n'
      return
    fi
    die "No step currently in progress. Use resume or init."
  fi

  # Mark current completed
  update_step_status "$cur" "completed" "completed" "$(now_time)"

  # Record decision if provided
  if [[ -n "$decision" ]]; then
    append_decision "$decision"
  fi

  # Activate next pending step
  local next
  next="$(next_pending_step)"
  local next_model=""
  local wf_complete="false"
  if [[ -n "$next" ]]; then
    update_step_status "$next" "in_progress" "started" "$(now_time)"
    next_model="$(model_for "$next")"
  else
    wf_complete="true"
  fi

  local next_json="null"
  local model_json="null"
  if [[ -n "$next" ]]; then
    next_json="\"$next\""
    model_json="\"$next_model\""
  fi

  printf '{"completed_step":"%s","next_step":%s,"next_agent_model":%s,"workflow_complete":%s}\n' \
    "$cur" "$next_json" "$model_json" "$wf_complete"
}

cmd_skip() {
  require_state
  local step_name="${1:-}"
  local reason="${2:-}"
  [[ -n "$step_name" ]] || die "Usage: devkit-state.sh skip <step-name> \"<reason>\""
  [[ -n "$reason" ]] || die "Usage: devkit-state.sh skip <step-name> \"<reason>\""

  local step_status
  step_status="$(get_step_field "$step_name" 1)"
  [[ -n "$step_status" ]] || die "Step not found: $step_name"

  if [[ "$step_status" == "completed" || "$step_status" == "skipped" ]]; then
    die "Step $step_name is already $step_status"
  fi

  # Mark as skipped
  mark_step_skipped "$step_name"

  # Log in skipped section
  append_skipped "$step_name" "$reason"

  # Activate next pending step if no step is currently in_progress
  local warning
  warning="$(skip_warning_for "$step_name")"
  local cur
  cur="$(current_step_name)"
  if [[ -z "$cur" ]]; then
    local np
    np="$(next_pending_step)"
    if [[ -n "$np" ]]; then
      update_step_status "$np" "in_progress" "started" "$(now_time)"
    fi
  fi

  local next_out
  next_out="$(current_step_name)"
  if [[ -z "$next_out" ]]; then
    next_out="$(next_pending_step)"
  fi

  local next_json="null"
  [[ -z "$next_out" ]] || next_json="\"$next_out\""

  printf '{"skipped":"%s","reason":"%s","warning":"%s","next_step":%s}\n' \
    "$step_name" "$(json_escape "$reason")" "$(json_escape "$warning")" "$next_json"
}

cmd_checkpoint() {
  require_state
  local reason="${1:-Paused}"
  local session_id workflow last_completed next_step

  session_id="$(read_frontmatter session_id)"
  workflow="$(read_frontmatter workflow)"

  last_completed="$(read_steps | awk -F'|' '$2=="completed" {last=$1} END {print last}')"
  next_step="$(current_step_name)"
  [[ -n "$next_step" ]] || next_step="$(next_pending_step)"

  local last_json="null"
  [[ -z "$last_completed" ]] || last_json="\"$last_completed\""
  local next_json="null"
  [[ -z "$next_step" ]] || next_json="\"$next_step\""

  cat > "$CHECKPOINT_FILE" <<EOF
# Continue Here

**Session:** ${session_id}
**Workflow:** ${workflow}
**Last completed:** ${last_completed:-none}
**Next step:** ${next_step:-none}
**Reason:** ${reason}
**Saved:** $(now_iso)

## To resume

\`\`\`bash
devkit-state.sh resume
\`\`\`
EOF

  printf '{"session_id":"%s","workflow":"%s","last_completed":%s,"next_step":%s,"checkpoint_file":"%s"}\n' \
    "$session_id" "$workflow" "$last_json" "$next_json" "$CHECKPOINT_FILE"
}

cmd_resume() {
  require_state
  local session_id workflow current_step current_model

  session_id="$(read_frontmatter session_id)"
  workflow="$(read_frontmatter workflow)"
  current_step="$(current_step_name)"

  if [[ -z "$current_step" ]]; then
    current_step="$(next_pending_step)"
    if [[ -n "$current_step" ]]; then
      update_step_status "$current_step" "in_progress" "started" "$(now_time)"
    fi
  fi

  current_model=""
  [[ -z "$current_step" ]] || current_model="$(model_for "$current_step")"

  # Pending steps
  local pending_json="["
  local sep=""
  local line
  while IFS= read -r line; do
    local name status
    name="$(echo "$line" | cut -d'|' -f1)"
    status="$(echo "$line" | cut -d'|' -f2)"
    if [[ "$status" == "pending" ]]; then
      pending_json="${pending_json}${sep}\"${name}\""
      sep=","
    fi
  done <<< "$(read_steps)"
  pending_json="${pending_json}]"

  local step_json="null" model_json="null"
  if [[ -n "$current_step" ]]; then
    step_json="\"$current_step\""
    model_json="\"$current_model\""
  fi

  printf '{"session_id":"%s","workflow":"%s","current_step":%s,"current_model":%s,"pending_steps":%s}\n' \
    "$session_id" "$workflow" "$step_json" "$model_json" "$pending_json"
}

cmd_complete() {
  require_state
  local session_id workflow started

  session_id="$(read_frontmatter session_id)"
  workflow="$(read_frontmatter workflow)"
  started="$(read_frontmatter started)"
  local completed_at
  completed_at="$(now_iso)"

  local steps_completed=0 steps_skipped=0
  local line
  while IFS= read -r line; do
    local name status
    name="$(echo "$line" | cut -d'|' -f1)"
    status="$(echo "$line" | cut -d'|' -f2)"
    case "$status" in
      completed) steps_completed=$((steps_completed + 1)) ;;
      skipped)   steps_skipped=$((steps_skipped + 1)) ;;
      in_progress)
        update_step_status "$name" "completed" "completed" "$(now_time)"
        steps_completed=$((steps_completed + 1))
        ;;
    esac
  done <<< "$(read_steps)"

  printf '{"session_id":"%s","workflow":"%s","started":"%s","completed_at":"%s","steps_completed":%d,"steps_skipped":%d}\n' \
    "$session_id" "$workflow" "$started" "$completed_at" "$steps_completed" "$steps_skipped"
}

cmd_status() {
  require_state
  local session_id workflow ticket current_step

  session_id="$(read_frontmatter session_id)"
  workflow="$(read_frontmatter workflow)"
  ticket="$(read_frontmatter ticket)"
  current_step="$(current_step_name)"

  local completed=0 total=0
  local line
  while IFS= read -r line; do
    local status
    status="$(echo "$line" | cut -d'|' -f2)"
    total=$((total + 1))
    case "$status" in
      completed|skipped) completed=$((completed + 1)) ;;
    esac
  done <<< "$(read_steps)"

  local progress_pct=0
  [[ $total -eq 0 ]] || progress_pct=$(( (completed * 100) / total ))

  local active="true"
  [[ -n "$current_step" ]] || active="false"
  local step_json="null"
  [[ -z "$current_step" ]] || step_json="\"$current_step\""

  printf '{"active":%s,"session_id":"%s","workflow":"%s","ticket":"%s","current_step":%s,"progress_pct":%d,"completed":%d,"total":%d}\n' \
    "$active" "$session_id" "$workflow" "$ticket" "$step_json" "$progress_pct" "$completed" "$total"
}

# ── Main ────────────────────────────────────────────────────────────

cmd="${1:-}"
shift || true

case "$cmd" in
  init)       cmd_init "$@" ;;
  advance)    cmd_advance "$@" ;;
  skip)       cmd_skip "$@" ;;
  checkpoint) cmd_checkpoint "$@" ;;
  resume)     cmd_resume "$@" ;;
  complete)   cmd_complete "$@" ;;
  status)     cmd_status "$@" ;;
  *)          die "Usage: devkit-state.sh {init|advance|skip|checkpoint|resume|complete|status}" ;;
esac
