# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Mattermost Desktop is an Electron app (v40.x) wrapping the Mattermost web app. See `CLAUDE.md` for full architecture and commands reference.

### Node version

The project requires Node.js v20.15.0 (specified in `.nvmrc`). Use `nvm` to switch:

```
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

### Native modules

The `postinstall` script runs `electron-builder install-app-deps` to rebuild native modules (registry-js, cf-prefs, etc.) for the current Electron version. If you see native module errors after `npm install`, ensure postinstall completed successfully.
