# Cloud Agent Guide: GUI Testing the Desktop App

This directory holds the Cursor Cloud Agent environment (`Dockerfile`, `environment.json`, `scripts/`) and the setup notes in [`SETUP.md`](./SETUP.md).

This guide covers driving the built Desktop App through its GUI with the `computerUse` subagent against a real, loggable Mattermost server running in the same VM. `SETUP.md` has the mandatory build, launch and server setup steps. This file adds what is and isn't possible, the extra setup the repo scripts don't do, and the failure modes we hit.

Findings come from a manual session against Desktop App 43.3.0 and Mattermost server 11.9.0 on Xvfb `:99`.

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
| Mattermost server release (pinned, about 780 MB) | `cloud-agent-install.sh` | Extracted to `~/mattermost`. Set `CLOUD_AGENT_MATTERMOST_VERSION` to change the version. |
| PostgreSQL | `Dockerfile` (apt) | Started, and the `mmuser` role and `mattermost_test` database created, by the start script. |
| `/dev/shm` remount at 2G | `cloud-agent-start.sh` | The 64M default causes `ERR_INSUFFICIENT_RESOURCES` once a real server loads. |
| Mattermost server running and seeded | `cloud-agent-start.sh` | Log at `/tmp/mattermost-server.log`. Set `CLOUD_AGENT_SKIP_LOCAL_SERVER=true` to skip it. |

Set these to `true` (or `1`/`yes`) to shorten startup for narrow tasks, following the convention in the `mattermost/mattermost` `.cursor/` hooks:
- `CLOUD_AGENT_SKIP_LOCAL_SERVER`: skips the server download (install) and Postgres and Mattermost startup (start).
- `CLOUD_AGENT_SKIP_E2E_DEPS`: skips `npm --prefix e2e ci`.

Not set up by the scripts:
- **The app itself.** Launch it as described in `SETUP.md`.
- **A window manager.** The VM we used ran `xfwm4` from its desktop layer, not from these scripts, and it was not Openbox. Start `xfwm4 --compositor=off` if none is running.

Accounts seeded by `cloud-agent-start.sh` (and by `SETUP.md` if you set up the server by hand): `sysadmin` / `Sys@dmin-sample1` (system admin), `user-1` / `User-Test-123!`, team `main`. Add `http://localhost:8065` as a server in the app. `localhost` here is the VM's own loopback, because the server and the app run in the same VM.

## Running the E2E suite against the local server

With the server from `SETUP.md` running and the `sysadmin` account seeded, server-backed Playwright specs work as documented in `e2e/AGENTS.md`:

```bash
npm run build-test              # outputs to e2e/dist/
npm --prefix e2e ci             # once; e2e/ has its own package.json
cd e2e && env MM_TEST_SERVER_URL=http://localhost:8065 MM_TEST_USER_NAME=sysadmin MM_TEST_PASSWORD='Sys@dmin-sample1' \
  npx playwright test specs/search_box/search_box.test.ts --reporter=list --workers=1
```

- Each spec launches its own Electron with an isolated `userDataDir`, so it does not touch `~/.config/Electron` or a manually started app. It does use the same `e2e/dist/` build, so don't rebuild while a manual session is running from it.
- `specs/search_box/search_box.test.ts` (logs in with the env vars) and `specs/server_management/popout_windows.test.ts` both passed this way on Xvfb `:99`.
- The seeded `sysadmin` password must match `MM_TEST_PASSWORD`. `SETUP.md` seeds `Sys@dmin-sample1`, the value used throughout `e2e/AGENTS.md`.

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
| `ERR_CONNECTION_REFUSED` for `localhost:8065` | A server entry exists but Mattermost isn't running or hasn't finished starting. | Start the server first. The app retries every 5 seconds. |
| The server is reachable at `localhost:8065` on the developer's own machine | Cursor's Auto-Forward Ports forwarded the VM's listening port. | In Cursor, open the Agents Window, then the editor panel, then Forwarded Ports, and turn off Auto-Forward Ports. If a forward persists, restart the listener. The seeded credentials are weak and the server is a throwaway, so keep it in the VM. |
| Benign noise | GTK accel-group assertions, one-time `ENOENT bounds-info.json`, `Failed to connect to the bus: /run/dbus/system_bus_socket`. | Ignore. |

## Prompt preamble for `computerUse`

```
The Mattermost Desktop app is already running on DISPLAY :99 (NODE_ENV=test build from e2e/dist).
Do NOT start another electron/npm process, do NOT open a browser to work around problems, and NEVER
use windowkill/xkill/kill on windows or processes. Close windows with their close button, Escape,
or Ctrl+W when focused. Do not change Settings > General checkboxes ("Launch app minimized").

Local test server (this VM): http://localhost:8065, sysadmin / Sys@dmin-sample1 (second user
user-1 / User-Test-123!), team "Main Team" (url name "main"). Log in to this local server only.

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
- The full setup run as one script. The steps were run one at a time.
