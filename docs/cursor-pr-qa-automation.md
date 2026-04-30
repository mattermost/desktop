# Cursor PR QA automation (pointer)

The **full mission prompt** for human-style desktop PR QA (E2E triage, Mattermost + desktop runs, visual verification table, security rules, report format) lives in **Cursor → Automations** for this repository — not in this file. That keeps iteration in one place and avoids duplicating a long prompt in git.

**Technical ground truth for any agent** (build, E2E env, branch policy, no `SKIP_SERVER`, `waitForLoggedIn`, etc.):

- Root [`AGENTS.md`](../AGENTS.md) — Cursor Cloud, `build-test`, Docker / Matterwick, Linux display
- [`e2e/AGENTS.md`](../e2e/AGENTS.md) — Playwright fixtures, failure classification, commands
- [`.cursor/rules/e2e-agents.mdc`](../.cursor/rules/e2e-agents.mdc) — E2E-focused rules when editing `e2e/**`

When updating behavior, edit the **automation instructions** in Cursor; update **this repo** only when build or E2E facts change.
