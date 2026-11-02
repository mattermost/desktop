## Cursor Cloud specific instructions

**Every instruction below is mandatory and must be followed exactly, in full, no matter what.** Do not skip, abbreviate, or substitute a step even if the app appears to work without it — issues from a skipped step (e.g. blank/`ERR_INSUFFICIENT_RESOURCES` views, blocking dialogs, stray processes) often only surface later and are hard to attribute back to the missing step.

- A virtual display is already running (`DISPLAY=:99` via Xvfb) with `xfwm4` as the window manager. GUI/manual testing of the app's internal UI (onboarding, settings, modals, tab bar) works out of the box.
- Passwordless sudo is available and required by `npm run linux-dev-setup` (sets the chrome-sandbox setuid bit).
- `npm start` runs `linux-dev-setup` then launches `electron dist/ --disable-dev-mode`.
- Benign on startup, not bugs: GTK accel-group assertion warnings, one-time `ENOENT bounds-info.json` on first launch, and isolated `net::ERR_FAILED` from first-launch requests that have no configured server yet (e.g. update checks before any server is added). Treat `net::ERR_FAILED` (and other network errors) as **actionable** when connecting to a configured Mattermost server URL or any other resource the task depends on.
- Reset app to the fresh onboarding screen: `rm -rf ~/.config/Electron`.
- The base image has **no Docker daemon and no Go toolchain**. Don't try to build the server from source or run `docker`/`docker-compose`; use the cloud test server (see below).
- `/dev/shm` defaults to a **64MB tmpfs**, which is too small for Electron/Chromium once a real Mattermost server is loaded in a `WebContentsView` (each renderer process shares it). This surfaces as `ERR_INSUFFICIENT_RESOURCES` in the view instead of the loaded web app, even though host RAM is plentiful — it's not a memory-sizing problem, it's this mount. Remount it larger before launching the app: `sudo mount -o remount,size=2G /dev/shm`.
- **Manual/GUI testing (including computer-use) needs a `NODE_ENV=test` build**, not a plain `npm run build` + `npm start`. `webpack.config.base.js`'s `DefinePlugin` inlines `process.env.NODE_ENV` into the bundle at **build time**, so setting `NODE_ENV=test` only when launching has no effect on an already-built `dist/`. Without a test build, connecting to a server pops a blocking native "Permission Requested" (notifications) dialog on top of the app that computer-use/`xdotool` cannot reliably click through, since `dialog.showMessageBox` is only skipped when the build itself was compiled with `NODE_ENV=test` (`src/main/security/permissionsManager.ts`). Build and launch instead:

  ```bash
  npm run build-test               # NODE_ENV=test — outputs to e2e/dist/, NOT dist/
  npm run linux-dev-setup && ./node_modules/.bin/electron e2e/dist/ --disable-dev-mode
  ```
- Do **not** pass `--no-sandbox` when launching manually. Combined with this environment's zygote setup it reliably crashes the app (`GPU process launch failed: error_code=1002`, `Network service crashed`, sometimes a fatal `GPU process isn't usable. Goodbye.` that kills the whole process). The plain launch above works fine because `npm run linux-dev-setup` already configures a real, working `chrome-sandbox` setuid binary — the sandbox doesn't need to be disabled here. If you want extra renderer stability, `--disable-gpu` alone (without `--no-sandbox`) is safe.
- **Never open Chrome (or any other browser) to work around a stuck or blank app window**, and never let a manual-testing/computer-use session spawn its own second `npm start` or `electron` process from a terminal. A stray second instance — especially one still pointed at the stale `dist/` build instead of `e2e/dist/` — produces confusing symptoms that look like app regressions but are really just two instances fighting each other (the notification dialog reappearing, GPU crashes, focus jumping between windows). Before and after manual GUI testing, confirm exactly one Electron process tree is running and pointed at the intended build dir: `ps -ef | grep -i electron`.

### Typing into a server view (WebContentsView)

Each server renders in a `WebContentsView` whose `webContents.focus()` is gated on the main window being focused (`src/app/views/MattermostWebContentsView.ts`). A synthetic click (computer use / `xdotool`) landing *inside* the WebContentsView content (e.g. directly on the login form) does not reliably transfer OS/Electron-level keyboard focus to it, even though the outer `BrowserWindow` and the window manager both report the window as focused — this is not a missing-window-manager issue.

Working procedure for manual/GUI keyboard entry into a server view (e.g. the login form):

1. Click once on the app's own internal chrome — the tab bar / server-tab area at the very top of the window, above the WebContentsView content — before typing anything. This is what actually triggers the app to call `view.focus()` and forward keyboard focus to the WebContentsView; it also lands on whatever element already has autofocus inside it (e.g. the login form's "Email or Username" field).
2. From there, use **keyboard only** — `Tab` to move between fields, type, `Enter` to submit. Do **not** click a second time inside the WebContentsView content: a raw click on a different field (e.g. clicking directly into the password field after typing the username) silently drops focus from the whole view, and any further typed text goes nowhere with no error logged.

This is a manual-testing/computer-use-specific quirk — real users with a physical mouse don't hit it. For scripted (non-GUI) testing, the E2E harness avoids it entirely by driving `webContents` via Playwright/CDP (`loginToMattermost` / `ServerView` helper, see `e2e/AGENTS.md` and `e2e/helpers/`) instead of OS-level synthetic input.

### Cloud test server

The agent logs into the shared cloud test server described by the `DESKTOP_MATTERMOST_*` secrets. `cloud-agent-start.sh` adds `DESKTOP_MATTERMOST_URL` to the app config, and `bash .cursor/scripts/cloud-agent-login.sh [user|admin]` logs in with the credentials from the environment. **Never print or log those values**; see `.cursor/AGENTS.md` ("Cloud test server"). Without them, only public servers and UI that doesn't need a server can be tested.
