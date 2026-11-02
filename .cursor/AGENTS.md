# Cloud Agent Guide: GUI Testing the Desktop App

This directory holds the Cursor Cloud Agent environment (`Dockerfile`, `environment.json`, `scripts/`) and the setup notes in [`SETUP.md`](./SETUP.md).

This guide covers driving the built Desktop App through its GUI with the `computerUse` subagent against the shared cloud test server. `SETUP.md` has the mandatory build and launch steps. This file adds what is and isn't possible, the extra setup the repo scripts don't do, and the failure modes we hit.

Findings come from a manual session against Desktop App 43.3.0 on Xvfb `:99`, using a local Mattermost 11.9.0 server before the move to the cloud test server.

## What `computerUse` can and can't do

`computerUse` sees the X display through screenshots, can click, type and press key combinations, and can run shell commands. It sees only what is painted on the display.

### Can do

- **App-drawn UI:** welcome screen, Add Server modal, Settings (all tabs), the server dropdown, the tab bar, the three-dot menu (File, Edit, View, History, Window, Help and the Developer Tools submenu), the downloads dropdown and the quit-confirmation dialog.
- **Server web content in the `WebContentsView`:** render, scroll, hover, click. Right-click in a text field shows a context menu. Typing works with the procedure below.
- **Keyboard accelerators:** `Ctrl+,`, `Ctrl+T`, `Ctrl+N`, `Ctrl+Tab`, `Ctrl+1`, `Ctrl+Shift+1`, `Ctrl+Shift+S`, `Ctrl+R`, `Ctrl+W`, `Ctrl+Shift+W`, `F12`, `Ctrl+Shift+I`, and zoom (`Ctrl+=`, `Ctrl+-`, `Ctrl+0`).
- **Extra X windows:** new window (`Ctrl+N`), tab "Move to new window", thread popout, detached DevTools and the file manager opened by Help > Run diagnostics. Count them with `DISPLAY=:99 xwininfo -root -tree`.
- **Native GTK dialogs:** the file chooser opened by the attachment button works (type a path with `Ctrl+L`).
- **Downloads and external links:** download an attachment and use the Downloads dropdown. Clicking a link opens the system browser.
- **Shell verification:** `xwininfo`, `xdotool`, `ps`, and `~/.config/Electron/logs/main.log`.

### Can't do or unreliable

- **Raw clicks inside the server web content do not reliably move keyboard focus.** Typed text can silently go nowhere. See "Typing into the server view".
- **Not covered:** Calls (including the Call Widget devtools), system tray, native notifications, SSO, camera, microphone and screen sharing.
- **No visible effect in testing:** `Ctrl+F` (no find bar), `F11` (no fullscreen), the `Alt+F`/`Alt+V` menu mnemonics, and `Alt+Left`/`Alt+Right` (nothing to go back to). Check these by hand before calling them bugs.
- **Right-click on the page body** showed no menu. Right-click on a text field and on a tab (once logged in) did.
- **Popouts are not listed** in three-dot menu > Window.
- **Single screenshots can mislead.** Early passes reported the three-dot menu as invisible and several shortcuts as dead. After the window manager and hidden-window problems below were fixed, the menu rendered and those shortcuts worked. Re-check any "can't" result, and prefer `xwininfo` window lists and logs as evidence.
- **Never kill windows or processes.** `xdotool windowkill` on a DevTools window took down the window manager and the app.

## What the environment scripts set up

| Step | Where | Notes |
|---|---|---|
| `npm ci`, `npm --prefix e2e ci`, `npm run linux-dev-setup` | `cloud-agent-install.sh` | `e2e/` has its own `package.json`. |
| `npm run build-test` | `cloud-agent-install.sh` | A `NODE_ENV=test` build skips the blocking native "Permission Requested" dialog. Output is `e2e/dist/`, not `dist/`. Launch with `./node_modules/.bin/electron e2e/dist/ --disable-dev-mode`, and rebuild after pulling source changes. |
| `xfwm4 --compositor=off` | `cloud-agent-start.sh` | Started if not already running, so windows get frames and focus. |
| `/dev/shm` remount at 2G | `cloud-agent-start.sh` | The 64M default causes `ERR_INSUFFICIENT_RESOURCES` once a real server loads. |
| Cloud test server added to the app config | `cloud-agent-start.sh` | Only when `DESKTOP_MATTERMOST_URL` is set. See "Cloud test server". |

Set `CLOUD_AGENT_SKIP_E2E_DEPS=true` to skip `npm --prefix e2e ci`.

Not set up by the scripts:
- **The app itself.** Launch it in its own tmux session so it outlives the shell, and only once (`ps -ef | grep -i electron` first):

  ```bash
  tmux -f /exec-daemon/tmux.portal.conf new-session -d -s mm-desktop -c /workspace
  tmux -f /exec-daemon/tmux.portal.conf send-keys -t mm-desktop:0.0 \
    'npm run linux-dev-setup && ./node_modules/.bin/electron e2e/dist/ --disable-dev-mode' C-m
  ```

  The main window title is "Mattermost Desktop App" (`DISPLAY=:99 xwininfo -root -tree`).

If the VM did not boot from this `Dockerfile` (symptoms: no `node_modules`, no `e2e/dist`), run `bash .cursor/scripts/cloud-agent-install.sh` and then `bash .cursor/scripts/cloud-agent-start.sh`. Both are safe to re-run.

## Cloud test server

The only Mattermost server the agent logs into. Five repository secrets describe a shared test server:

| Secret | Use |
|---|---|
| `DESKTOP_MATTERMOST_URL` | Server URL |
| `DESKTOP_MATTERMOST_ADMIN_USERNAME`, `DESKTOP_MATTERMOST_ADMIN_PASSWORD` | Admin account |
| `DESKTOP_MATTERMOST_USERNAME`, `DESKTOP_MATTERMOST_USER_PASSWORD` | Normal user account |

**Never print, log, screenshot or paste these values** (no `echo`, `env`, `printenv`, `set -x`, or typing them in a `computerUse` prompt). Refer to them by name and read them only inside scripts.

1. `cloud-agent-start.sh` adds the server to `~/.config/Electron/config.json` (named `cloud-test-server`, as the active server) and checks that it answers a ping, without logging the URL. Run it before launching the app, since the app overwrites its config on exit. An existing server entry for the same URL is reused, and other existing servers are kept (the script warns, and `cloud-agent-login.sh` won't run until they are removed).
2. After launching the app (see above), run `bash .cursor/scripts/cloud-agent-login.sh user` (or `admin`). It reloads the page so focus starts in the username field, then types the credentials with `xdotool` straight from the environment, so neither the agent nor the screenshots ever see the values. It refuses to type, and exits non-zero, unless the app config contains only the cloud test server, exactly one Electron window is visible (close popouts and DevTools first), and the login page is showing (not already signed in or still loading). It exits 0 only once the signed-in app appears. If the login doesn't complete it clears the username and password fields before exiting 1, because a failed login leaves the username visible. It exits with an error naming the missing variable if a secret isn't set. Log in before adding any other server.
3. Tell `computerUse` to take over only after the script exits 0, and take no screenshot of the login page before that.

The VM needs network egress to the server. If the start script reports that the server did not answer a ping, check the environment's egress policy.

Without the secrets, the agent can only test public servers (for example `https://community.mattermost.com`, not logged in) and UI that doesn't need a server (Settings, the Add Server modal, menus).

### Running E2E specs against it

Pass the variables straight through so they are not expanded into your command output:

```bash
npm run build-test              # outputs to e2e/dist/
npm --prefix e2e ci             # once; e2e/ has its own package.json
cd e2e && env MM_TEST_SERVER_URL="$DESKTOP_MATTERMOST_URL" MM_TEST_USER_NAME="$DESKTOP_MATTERMOST_ADMIN_USERNAME" \
  MM_TEST_PASSWORD="$DESKTOP_MATTERMOST_ADMIN_PASSWORD" npx playwright test <spec> --reporter=list --workers=1
```

Each spec launches its own Electron with an isolated `userDataDir`, so it does not touch `~/.config/Electron` or a manually started app. It does use the same `e2e/dist/` build, so don't rebuild while a manual session is running from it. Specs that assume the `sysadmin` / `main` team fixtures from `e2e/AGENTS.md` may not match this server.

## Typing into the server view

The server renders in a `WebContentsView` whose `focus()` is gated on the main window being focused (`src/app/views/MattermostWebContentsView.ts`).

1. Click once on the app's own chrome (the tab bar or server tab at the top), not inside the web content.
2. Use keyboard only: `Tab` between fields, type, `Enter`.
3. Do not click inside the web content a second time. Clicking another field drops focus with no error logged.
4. To type somewhere else later, click the top bar again first.

Include this in every `computerUse` prompt.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Window is black or not on screen after a restart | "Launch app minimized" was toggled in Settings. That sets `hideOnStart: true` in `~/.config/Electron/config.json`, so the main window is never shown (`xwininfo` reports `IsUnMapped`). | With the app stopped, set `"hideOnStart": false` and restart. Tell `computerUse` not to touch the General checkboxes. |
| Black screen, no window frames, focus broken | The window manager died (for example after `xdotool windowkill`). | Restart `xfwm4 --compositor=off`. Never use `windowkill`, `xkill` or `kill`. |
| `xfwm4` warns `Unsupported GL renderer (llvmpipe)` | Software GL in Xvfb. | Use `--compositor=off`. |
| Typing does nothing in the login page | WebContentsView focus gating. | See "Typing into the server view". |
| `cloud-agent-login.sh` reports a variable is not set | The `DESKTOP_MATTERMOST_*` secrets weren't injected into this run. | Add them as Cloud Agent secrets for this repo and start a new run. GitHub Actions secrets aren't visible to cloud agents. |
| Benign noise | GTK accel-group assertions, one-time `ENOENT bounds-info.json`, `Failed to connect to the bus: /run/dbus/system_bus_socket`. | Ignore. |

## Prompt preamble for `computerUse`

```
The Mattermost Desktop app is already running on DISPLAY :99 (NODE_ENV=test build from e2e/dist).
Do NOT start another electron/npm process, do NOT open a browser to work around problems, and NEVER
use windowkill/xkill/kill on windows or processes. Close windows with their close button, Escape,
or Ctrl+W when focused. Do not change Settings > General checkboxes ("Launch app minimized").

Cloud test server: already added as "cloud-test-server". Do not ask for or type its credentials; the
login is done by `bash .cursor/scripts/cloud-agent-login.sh user`. Never print the DESKTOP_MATTERMOST_*
environment variables. If no cloud server is configured, test only public servers and UI that doesn't
need a server (Settings, Add Server modal, menus).

Typing into the server view: click once on the app's top bar/tab area (not inside the web content),
then use keyboard only (Tab, type, Enter). Do not click inside the web content a second time.

Verify with screenshots plus `DISPLAY=:99 xwininfo -root -tree` and the logs
(~/.config/Electron/logs/main.log). Re-check any "cannot" before reporting it. At the end confirm
exactly one electron process tree and the window manager are still running.
```

## Not yet tested

- Calls and the Call Widget.
- System tray, native notifications, SSO and screen sharing.
- `Ctrl+F`, `F11` and the `Alt` menu mnemonics (no effect observed; worth a manual check).
