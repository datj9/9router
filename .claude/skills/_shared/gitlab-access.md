# GitLab Access — Shared Reference

Use this procedure whenever a skill needs to read data from GitLab (MR metadata, diffs, files, pipelines).

## Step 1 — Check memory

Look for a saved memory named `gitlab-auth-method`. If found, use the stored method and skip to Step 3.

## Step 2 — Discover access method

Try in order. **Stop at the first one that works:**

### Option A: GitLab MCP Server (best integration)

Check if a GitLab MCP server is configured by looking for available MCP tools with `gitlab` or `mcp_gitlab` in their names (e.g. `get_merge_request`, `list_merge_request_changed_files`).

If MCP tools are available, use them directly — they handle auth automatically:
```
# Fetch MR metadata
mcp: get_merge_request(project_id, merge_request_iid)

# Fetch MR diffs
mcp: get_merge_request_diffs(project_id, merge_request_iid)
# or: list_merge_request_changed_files / get_merge_request_file_diff

# Fetch file from branch
mcp: get_file_contents(project_id, file_path, ref)

# Post comment on MR
mcp: create_merge_request_thread(project_id, merge_request_iid, body)
# or: create_workitem_note

# Create MR
mcp: create_merge_request(project_id, source_branch, target_branch, title)
```

If no GitLab MCP is configured but the user wants this approach, **offer to set it up:**

> "Would you like to set up a GitLab MCP server? Three options:
>
> **1. Official GitLab HTTP endpoint** (recommended for self-managed GitLab):
> ```bash
> claude mcp add --transport http GitLab https://git.barebone.ringkas.co.id/api/v4/mcp
> ```
> Auth: OAuth 2.0 — browser opens on first use. No token config needed.
>
> **2. @zereight/mcp-gitlab** (full API coverage — files, pipelines, deployments, etc.):
> Add to `.claude/mcp-configs/mcp-servers.json`:
> ```json
> {
>   "mcpServers": {
>     "gitlab": {
>       "command": "npx",
>       "args": ["-y", "@zereight/mcp-gitlab"],
>       "env": {
>         "GITLAB_PERSONAL_ACCESS_TOKEN": "<your-token>",
>         "GITLAB_API_URL": "https://git.barebone.ringkas.co.id/api/v4"
>       }
>     }
>   }
> }
> ```
>
> **3. kopfrechner/gitlab-mr-mcp** (lightweight, MR review only):
> ```json
> {
>   "mcpServers": {
>     "gitlab-mr": {
>       "command": "npx",
>       "args": ["-y", "@kopfrechner/gitlab-mr-mcp"],
>       "env": {
>         "GITLAB_TOKEN": "<your-token>",
>         "GITLAB_API_URL": "https://git.barebone.ringkas.co.id/api/v4"
>       }
>     }
>   }
> }
> ```"

### Option B: glab CLI

```bash
glab --version 2>/dev/null
```
If available and authenticated, use glab commands directly. Skip to Step 3.

### Option C: GitLab API token

Check for a token in this order:
1. `$GITLAB_TOKEN` environment variable
2. `$GITLAB_PRIVATE_TOKEN` environment variable
3. `~/.config/glab-cli/config.yml` (glab stores tokens here)

### Option D: Ask the user

If no access method is found, **ask:**
> "I need GitLab access to fetch data. Which do you prefer?
> 1. Set up GitLab MCP server (best integration — see options above)
> 2. Install glab CLI: `brew install glab` then `glab auth login`
> 3. Provide a GitLab Personal Access Token — what env var or file path is it stored in?"

### Option E: No auth fallback (internal repos on VPN)

Try without auth header. If 401/403, go back to Option D.

## Step 3 — Save to memory (first time only)

After the first successful GitLab access, **save the working method to memory** so future sessions skip discovery:

```markdown
---
name: gitlab-auth-method
description: User's preferred GitLab access method and configuration for Ringkas GitLab
type: reference
---

GitLab host: <host>
Access method: <MCP server | glab CLI | API token>
Details: <MCP server name | "glab managed" | env var name | file path>
```

## Common operations (non-MCP fallbacks)

Use these when MCP is not available and you're using glab CLI or direct API calls.

### Fetch MR metadata
```bash
# glab
glab mr view ${MR_IID} --repo "${PROJECT_PATH}" --output json

# API
curl -s --header "PRIVATE-TOKEN: ${TOKEN}" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/merge_requests/${MR_IID}"
```

### Fetch MR diff
```bash
# glab
glab mr diff ${MR_IID} --repo "${PROJECT_PATH}"

# API
curl -s --header "PRIVATE-TOKEN: ${TOKEN}" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/merge_requests/${MR_IID}/changes"
```

### Fetch file from a branch
```bash
# API
curl -s --header "PRIVATE-TOKEN: ${TOKEN}" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/repository/files/${FILE_PATH_ENCODED}/raw?ref=${BRANCH}"
```

### Create MR
```bash
# glab
glab mr create --title "[${TICKET_ID}] ${SUMMARY}" \
  --description "${BODY}" \
  --source-branch "${SOURCE}" \
  --target-branch "${TARGET}" \
  --assignee "${ASSIGNEE}" \
  --reviewer "${REVIEWER1},${REVIEWER2}" \
  --label "${LABEL}"
```

### Post comment on MR
```bash
# glab
glab mr note ${MR_IID} --message "${COMMENT}"

# API
curl -s --request POST --header "PRIVATE-TOKEN: ${TOKEN}" \
  --header "Content-Type: application/json" \
  --data "{\"body\": \"${COMMENT}\"}" \
  "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/merge_requests/${MR_IID}/notes"
```
