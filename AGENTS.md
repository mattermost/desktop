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
| `npm run test:unit` | Jest unit tests |

### Running on headless Linux (Cloud VM)

- The VM has an X server on display `:1`. Set `DISPLAY=:1` before launching Electron.
- Chrome sandbox requires root ownership: `sudo chown root:root ./node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 ./node_modules/electron/dist/chrome-sandbox`. This is normally handled by `npm run linux-dev-setup` (called by `npm start` and `npm run watch`), but that script uses `sudo` which may prompt.
- To launch the built app directly: `DISPLAY=:1 npx electron dist/ --disable-dev-mode --no-sandbox`
- DBus errors in the container logs are expected and harmless (no system bus in containers).
- The "Failed to load configuration file" message on first run is normal — the app creates defaults.

### Native modules

The `postinstall` script runs `electron-builder install-app-deps` to rebuild native modules (registry-js, cf-prefs, etc.) for the current Electron version. If you see native module errors after `npm install`, ensure postinstall completed successfully.

---

## E2E testing

E2E tests live in `e2e/` with a separate `package.json`. See `e2e/AGENTS.md` for detailed test design and debugging guidance.

### Starting a local Mattermost server with Docker

Server-backed E2E tests require a running Mattermost instance. Use Docker to spin one up locally:

```bash
# Install Docker if not already present (Cloud VM may need fuse-overlayfs + iptables-legacy)
# See the Cursor Cloud system instructions for the full Docker install recipe.

# Start the Mattermost preview image (server + database in one container)
docker run -d \
  --name mattermost-e2e \
  -p 8065:8065 \
  --restart unless-stopped \
  mattermost/mattermost-preview:latest

# Wait for the server to be ready (polls /api/v4/system/ping)
until curl -sf http://localhost:8065/api/v4/system/ping >/dev/null 2>&1; do
  echo "Waiting for Mattermost to start..."
  sleep 3
done
echo "Mattermost is ready at http://localhost:8065"
```

On first launch the container creates an admin account — default credentials `admin` / `admin`. If the server prompts for initial setup at `http://localhost:8065`, create the admin user through the API:

```bash
# Create the initial admin user and team via the local-mode API
curl -sf http://localhost:8065/api/v4/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","username":"admin","password":"admin","auth_service":""}' || true

# Login and create a team so tests don't land on /select_team
TOKEN=$(curl -sf http://localhost:8065/api/v4/users/login \
  -H 'Content-Type: application/json' \
  -d '{"login_id":"admin","password":"admin"}' \
  -D - 2>/dev/null | grep -i '^token:' | awk '{print $2}' | tr -d '\r')

curl -sf http://localhost:8065/api/v4/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"e2e-team","display_name":"E2E Team","type":"O"}' || true
```

### Running E2E tests

```bash
source ~/.nvm/nvm.sh && nvm use 20.15.0

# Install and build the test bundle
npm ci
cd e2e && npm ci && cd ..
npm run build-test

# Run a single spec against the local server
cd e2e
export DISPLAY=:1
export MM_TEST_SERVER_URL=http://localhost:8065
export MM_TEST_USER_NAME=admin
export MM_TEST_PASSWORD=admin
npx playwright test <spec-file> --reporter=list --workers=1
cd ..
```

If a run leaves Electron hanging: `killall Electron 2>/dev/null || true`

### Fixing E2E tests (for `@cursoragent fix e2e` or CI-failure agents)

When asked to fix E2E failures — whether triggered by a `@cursoragent` comment or by observing CI failures on a PR:

1. **Start the Mattermost server** using the Docker instructions above.
2. **Read the CI logs** to identify which spec files failed and the error messages. Use `gh run view --job <job-id> --log-failed` or download JUnit artifacts.
3. **Build the test bundle**: `npm run build-test`
4. **Reproduce** each failure locally before editing. Run the failing spec file and confirm it fails.
5. **Fix the test** — see `e2e/AGENTS.md` for the classification (test bug vs product bug) and design rules.
6. **Re-run the spec** to confirm the fix, then commit.
7. For server-backed tests that use `waitForLoggedIn()`: this helper polls `ServerManager.isLoggedIn` in the main process. If login never completes, check whether the server is reachable and the admin user has a team.

### Login state propagation (common E2E flake)

After `loginToMattermost()` completes, the desktop app's `isLoggedIn` flag must travel through a multi-hop IPC chain before the renderer enables tab-bar interactions (`#newTabButton`). The `waitForLoggedIn()` helper in `e2e/helpers/login.ts` polls the main-process `ServerManager` directly, which is more reliable than waiting for the DOM element. Use it in `beforeAll` blocks for any test that interacts with the tab bar after login.
