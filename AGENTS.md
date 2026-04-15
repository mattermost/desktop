# AGENTS.md

## Cursor Cloud-specific instructions

### Overview

Mattermost Desktop is an Electron app (v40.x) wrapping the Mattermost web app. See `CLAUDE.md` for full architecture and commands reference.

### Node version

The project requires Node.js v20.15.0 (specified in `.nvmrc`). Use `nvm` to switch:

```bash
source ~/.nvm/nvm.sh && nvm use 20.15.0
```

### Key dev commands

All standard commands are documented in `CLAUDE.md` and `package.json`. Quick reference:

| Command | Purpose |
|---|---|
| `npm run check` | Lint + type-check + unit tests (parallel) |
| `npm run build` | Dev build (main + preload + renderer) |
| `npm run watch` | Dev mode with auto-rebuild and Electron restart |
| `npm run test:unit` | Jest unit tests (73 suites, 1118 tests) |

### Running on headless Linux (Cloud VM)

- The VM has an X server on display `:1`. Set `DISPLAY=:1` before launching Electron.
- Chrome sandbox requires root ownership: `sudo chown root:root ./node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 ./node_modules/electron/dist/chrome-sandbox`. This is normally handled by `npm run linux-dev-setup` (called by `npm start` and `npm run watch`), but that script uses `sudo` which may prompt.
- To launch the built app directly: `DISPLAY=:1 npx electron dist/ --disable-dev-mode --no-sandbox`
- DBus errors in the container logs are expected and harmless (no system bus in containers).
- The "Failed to load configuration file" message on first run is normal — the app creates defaults.

### E2E tests

E2E tests live in `e2e/` with a separate `package.json`. See `e2e/AGENTS.md` for detailed guidance. Server-backed E2E tests require a running Mattermost server and env vars `MM_TEST_SERVER_URL`, `MM_TEST_USER_NAME`, `MM_TEST_PASSWORD`. Startup/UI-only E2E tests can run without a server.

### Cursor secrets required for E2E fix agents

When a Cursor cloud agent is launched by `e2e-fix-trigger.yml` or `e2e-cursor-commands.yml` to fix failing E2E tests, it needs credentials to connect to the provisioned Mattermost test servers. Add the following secrets in the Cursor Dashboard (Cloud Agents → Secrets):

| Secret name | Value |
|---|---|
| `MM_DESKTOP_E2E_USER_NAME` | The admin username for the Matterwick-provisioned E2E servers (same value as the `MM_DESKTOP_E2E_USER_NAME` GitHub repo secret) |
| `MM_DESKTOP_E2E_USER_CREDENTIALS` | The admin password for the Matterwick-provisioned E2E servers (same value as the `MM_DESKTOP_E2E_USER_CREDENTIALS` GitHub repo secret) |

These are exposed to the agent directly as environment variables. The agent uses them verbatim as `MM_TEST_USER_NAME` and `MM_TEST_PASSWORD` when running specs. `MM_TEST_SERVER_URL` is still injected into the agent prompt from the server-info PR comment (it is not secret).

### Running E2E tests locally on this Linux VM

To run a single spec file against a live server:

```bash
source ~/.nvm/nvm.sh && nvm use 20.15.0
npm ci && cd e2e && npm ci && cd ..
npm run build-test

cd e2e
export DISPLAY=:1
export MM_TEST_SERVER_URL=<server-url>
export MM_TEST_USER_NAME="${MM_DESKTOP_E2E_USER_NAME}"
export MM_TEST_PASSWORD="${MM_DESKTOP_E2E_USER_CREDENTIALS}"
xvfb-run --auto-servernum --server-args='-screen 0 1280x960x24' \
  npx playwright test <spec-file-relative-to-e2e/> --reporter=list --workers=1
cd ..
```

If a run leaves Electron hanging: `killall Electron 2>/dev/null || true`

### Native modules

The `postinstall` script runs `electron-builder install-app-deps` to rebuild native modules (registry-js, cf-prefs, etc.) for the current Electron version. If you see native module errors after `npm install`, ensure postinstall completed successfully.

---

## GitHub Actions coding practice

Every rule below was derived from a concrete CodeRabbit or DryRun Security finding raised on PRs in this repository. Violating any of these will cause the same review comment to re-appear.

### Security — script injection

**Rule: Never interpolate `${{ inputs.* }}` or `${{ steps.*.outputs.* }}` directly inside a `github-script` `script:` block.**

Interpolation happens before the JS is parsed. A single-quote in the value breaks out of the string literal and executes arbitrary JavaScript on the runner.

```yaml
# WRONG — ${{ inputs.foo }} is injected into JS source text
script: |
  doSomething('${{ inputs.foo }}');

# CORRECT — pass via env:, read as process.env.*
env:
  FOO: ${{ inputs.foo }}
script: |
  doSomething(process.env.FOO);
```

The **only** safe interpolation inside `script:` is for trusted internal job outputs (e.g. `${{ needs.job.outputs.value }}` that was produced by your own workflow step, not derived from user input).

**Rule: When passing a JSON array from a job output into a `github-script`, use `env:` + `JSON.parse()`.**

```yaml
# WRONG
script: |
  const platforms = ${{ needs.prepare-matrix.outputs.platforms }};

# CORRECT
env:
  PLATFORMS: ${{ needs.prepare-matrix.outputs.platforms }}
script: |
  const platforms = JSON.parse(process.env.PLATFORMS);
```

### Security — Markdown injection in PR comments

**Rule: Always sanitize values before inserting them into Markdown tables or fenced blocks.**

Unsanitized `platform` or `url` values can inject pipe characters to break a table, or inject HTML/links. Use a helper like:

```js
const sanitizeMd = (str) => String(str ?? '').
  replace(/[\r\n]/g, ' ').      // no newline injection
  replace(/&/g, '&amp;').       // no HTML entities
  replace(/</g, '&lt;').
  replace(/>/g, '&gt;').
  replace(/[|`[\]]/g, (ch) => `\\${ch}`); // no table/code breaks
```

### Permissions — least privilege

**Rule: Declare `issues: write` and `pull-requests: write` at job level only, never at workflow top level.**

Top-level permissions apply to every job in the file, including jobs that only need `contents: read`. Grant write scopes only on the specific job that calls the API:

```yaml
# WRONG — every job gets write access to issues and PRs
permissions:
  contents: read
  statuses: write
  issues: write
  pull-requests: write

# CORRECT — broad reads at top level, writes scoped to the job that needs them
permissions:
  contents: read
  statuses: write

jobs:
  post-comment:
    permissions:
      issues: write
      pull-requests: write
```

**Rule: Disabled/noop jobs must set `permissions: {}` and `if: ${{ false }}`.**

A noop job that still has `issues: write` holds a live permission unnecessarily. If a job is disabled, clear its permissions and gate it with `if: false` so it never allocates a runner:

```yaml
noop:
  runs-on: ubuntu-22.04
  if: ${{ false }}
  permissions: {}
  steps:
    - run: echo "disabled"
```

### Fault tolerance — `continue-on-error` on auxiliary steps

**Rule: Auxiliary side-effect steps (posting comments, removing labels, sending notifications) must set `continue-on-error: true`.**

A comment-posting failure is not a test failure. If the auxiliary step throws, it should warn but not mark the entire job as failed:

```yaml
- name: Post PR comment
  uses: actions/github-script@...
  continue-on-error: true   # ← required for all non-critical steps
  with:
    script: |
      try {
        await postComment(...);
      } catch (err) {
        core.warning(`Comment failed: ${err.message}`);
      }
```

### Job condition gates

**Rule: Do not gate a job on `inputs.pr_number != ''` if the job has fallback resolution logic that can find the PR without the input.**

Gating on an optional input prevents the fallback from ever running, silently skipping the job for valid runs where the input was not provided:

```yaml
# WRONG — skips even when findPrNumber() can resolve via branch/SHA lookup
if: ${{ !inputs.nightly && inputs.pr_number != '' }}

# CORRECT — only skip nightly runs; let the fallback handle missing pr_number
if: ${{ !inputs.nightly }}
```

### Dead code in workflow files

**Rule: Do not leave commented-out job blocks in workflow YAML files.**

Git history preserves the implementation. Commented blocks drift from the live logic, mislead future readers, and generate repeated review noise. Remove the block entirely and add a one-line comment pointing to git history if the reason needs explaining:

```yaml
# WRONG — 60 lines of commented-out job YAML
# remove-e2e-label:
#   runs-on: ubuntu-22.04
#   steps:
#     ...

# CORRECT — single explanatory line
# remove-e2e-label is intentionally omitted: see e2e-label-cleanup.yml for context.
```

### Input validation in JavaScript utilities

**Rule: Always use strict positive-integer validation when parsing PR numbers or other numeric inputs.**

`parseInt("123abc", 10)` returns `123`. `parseInt("-42", 10)` returns `-42`. Both pass a truthiness check. Use the pattern below:

```js
// WRONG
const n = parseInt(input, 10);
if (n) { use(n); }

// CORRECT
const trimmed = String(input ?? '').trim();
if ((/^\d+$/).test(trimmed)) {
  const parsed = Number(trimmed);
  if (Number.isInteger(parsed) && parsed > 0) {
    use(parsed);
  }
}
```

**Rule: Do not fall back to `prs.data[0]` when a SHA-based match fails.**

Falling back to the first open PR on a branch can post to the wrong PR if multiple PRs share the same head branch. Return `null` and skip the action:

```js
// WRONG — may post to wrong PR
return (matching || prs.data[0]).number;

// CORRECT — return null and let caller skip
return matching ? matching.number : null;
```

### `workflow_run` execution context

**Rule: `workflow_run` workflows always execute from the DEFAULT BRANCH, not from the triggering PR branch.**

This means: any JS utility called via `require('./e2e/utils/...')` inside a `workflow_run` workflow will be the version on `master`, not the PR branch version — unless the checkout step explicitly checks out the triggering commit. When disabling label-removal or other behavior, the change must land on the default branch to take effect.

### Fenced code blocks in Markdown

**Rule: Always specify a language tag on fenced code blocks.**

Bare triple-backtick blocks are flagged by markdown linters and render without syntax highlighting. Use `bash`, `yaml`, `typescript`, `js`, etc.:

```markdown
<!-- WRONG -->
\```
npm install
\```

<!-- CORRECT -->
\```bash
npm install
\```
```
