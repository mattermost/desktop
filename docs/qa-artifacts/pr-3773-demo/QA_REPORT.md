# QA exploration report (demo run)

**PR:** [#3773](https://github.com/mattermost/desktop/pull/3773)  
**Branch:** `cursor/setup-agents-md-c5d4`  
**Environment:** Linux headless (`xvfb-run`), Playwright, test build (`npm run build-test`).  
**Server:** Matterwick URL from `MM_TEST_SERVER_URL` (credentials via `MM_TEST_USER_NAME` / `MM_TEST_PASSWORD` — not recorded here).

## Screenshots (this folder)

| File | What it shows |
|------|----------------|
| [01-main-window.png](01-main-window.png) | Application wrapper after login (tab bar, chrome) |
| [02-server-webcontents.png](02-server-webcontents.png) | Embedded Mattermost view (`webContents.capturePage`) |
| [03-after-new-tab-click.png](03-after-new-tab-click.png) | Wrapper after **New tab** was triggered |

## Scenarios exercised (Playwright)

| Area | Spec | Result |
|------|------|--------|
| Network resilience + login | `e2e/specs/network_resilience/reconnect.test.ts` | **Pass** (1 test) |
| Server / tab management | `e2e/specs/server_management/tab_management.test.ts` | **Pass** (3 tests) |
| Demo capture (this report) | `e2e/specs/qa_demo/pr_exploration_screenshots.test.ts` | **Pass** (1 test) |

**Failures during this exploration run:** none.

## Limits

- Linux only in this run; macOS/Windows not covered.
- Exploration is **automated** (targeted specs), not manual QA of every surface.
