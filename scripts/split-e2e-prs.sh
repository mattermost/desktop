#!/usr/bin/env bash
# Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE="${SOURCE:-migrate_RF_desktop}"
BASE="${BASE:-origin/master}"

if ! git rev-parse --verify "$SOURCE" >/dev/null 2>&1; then
  echo "Source branch $SOURCE not found" >&2
  exit 1
fi

git fetch origin master 2>/dev/null || true

checkout_slice() {
  local label="$1"
  shift
  if [[ $# -eq 0 ]]; then
    echo "No files for $label" >&2
    exit 1
  fi
  git checkout "$SOURCE" -- "$@"
  git add "$@"
}

commit_if_needed() {
  local msg="$1"
  if git diff --cached --quiet; then
    echo "Nothing to commit (already applied?)"
  else
    git commit -m "$msg"
  fi
}

create_pr() {
  local branch="$1"
  local base="$2"
  local title="$3"
  local body="$4"

  git push -u origin "$branch" --force-with-lease

  if gh pr view "$branch" >/dev/null 2>&1; then
    gh pr edit "$branch" --title "$title" --body "$body"
    gh pr view "$branch" --json url -q .url
  else
    gh pr create --base "$base" --head "$branch" --title "$title" --body "$body"
  fi
}

# PR 1
git checkout -B e2e/01-harness-ci "$BASE"
checkout_slice "PR1" \
  .github/actions/install-os-dependencies/action.yaml \
  .github/workflows/e2e-functional-template.yml \
  .github/workflows/e2e-functional.yml \
  e2e/AGENTS.md \
  e2e/fixtures/index.ts \
  e2e/global-setup.ts \
  e2e/global-teardown.ts \
  e2e/helpers/appReadiness.ts \
  e2e/helpers/cleanup.ts \
  e2e/helpers/config.ts \
  e2e/helpers/electronApp.ts \
  e2e/package-lock.json \
  e2e/package.json \
  e2e/playwright.config.ts \
  e2e/utils/analyze-flaky-test.js
commit_if_needed "$(cat <<'EOF'
E2E: Playwright harness, fixtures, and CI wiring (1/10).

Part 1 of splitting #3847 — core Playwright config, fixtures, electronApp
teardown, and GitHub Actions E2E workflow updates. No new specs yet.
EOF
)"
PR1_URL="$(create_pr e2e/01-harness-ci master "E2E: Playwright harness and CI wiring (1/10)" "$(cat <<'EOF'
## Summary
Stacked PR **1/10** splitting #3847.

- Playwright config, fixtures, global setup/teardown
- `electronApp` launch/teardown helpers
- GitHub Actions E2E workflow updates

## Test plan
- [ ] CI E2E job starts (existing specs only)
- [ ] `npm run check` passes

## Stack
Next: `e2e/02-main-hooks` → this branch
EOF
)")"
echo "PR1: $PR1_URL"

# PR 2
git checkout -B e2e/02-main-hooks e2e/01-harness-ci
checkout_slice "PR2" \
  src/main/app/initialize.ts \
  src/main/app/initialize.test.js \
  src/main/testMessageBoxStub.ts \
  src/main/notifications/index.ts \
  e2e/helpers/directLaunch.ts \
  e2e/helpers/testRefs.ts \
  e2e/helpers/dialog.ts \
  e2e/helpers/login.ts \
  e2e/helpers/serverMap.ts \
  e2e/helpers/serverView.ts \
  e2e/helpers/overlayWindows.ts \
  e2e/helpers/prepareServerView.ts \
  e2e/helpers/notificationEffects.ts \
  e2e/helpers/tray.ts \
  package-lock.json \
  package.json
commit_if_needed "$(cat <<'EOF'
E2E: Main-process test hooks and shared launch helpers (2/10).

Exposes __e2eTestRefs, message-box stub, tray/deep-link hooks (NODE_ENV=test
only) plus directLaunch, testRefs, and shared helper updates.
EOF
)"
PR2_URL="$(create_pr e2e/02-main-hooks e2e/01-harness-ci "E2E: Main-process test hooks and shared helpers (2/10)" "$(cat <<'EOF'
## Summary
Stacked PR **2/10** splitting #3847.

- Main-process E2E hooks (`initialize.ts`, message-box stub, flash effects)
- Shared helpers: `directLaunch`, `testRefs`, `dialog`, `tray`, etc.

## Test plan
- [ ] `npm run test:unit -- src/main/app/initialize.test.js`
- [ ] E2E smoke on existing specs

## Stack
Base: `e2e/01-harness-ci` · Next slices branch from this PR
EOF
)")"
echo "PR2: $PR2_URL"

make_slice_pr() {
  local num="$1"
  local branch="$2"
  local title="$3"
  local commit_msg="$4"
  local body="$5"
  shift 5

  git checkout -B "$branch" e2e/02-main-hooks
  checkout_slice "PR$num" "$@"
  commit_if_needed "$commit_msg"
  local url
  url="$(create_pr "$branch" e2e/02-main-hooks "$title" "$body")"
  echo "PR$num: $url"
}

make_slice_pr 3 e2e/03-mattermost-shell \
  "E2E: Mattermost shell helpers — bookmarks, custom groups (3/10)" \
  "E2E: Mattermost shell helpers and bookmarks/custom groups specs (3/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **3/10** — `mattermostShell`, `team` helpers + bookmarks/custom groups specs.

## Test plan
- [ ] `e2e/specs/mattermost/bookmarks.test.ts`
- [ ] `e2e/specs/mattermost/custom_groups.test.ts`
EOF
)" \
  e2e/helpers/mattermostShell.ts \
  e2e/helpers/team.ts \
  e2e/specs/mattermost/bookmarks.test.ts \
  e2e/specs/mattermost/custom_groups.test.ts

make_slice_pr 4 e2e/04-mattermost-ui \
  "E2E: Channel menu helper and Mattermost UI specs (4/10)" \
  "E2E: channelMenu helper and Mattermost UI specs (4/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **4/10** — channelMenu helper + context menu, copy link, alt+enter, etc.

## Test plan
- [ ] `e2e/specs/mattermost/context_menu.test.ts`
- [ ] `e2e/specs/mattermost/copy_link.test.ts`
- [ ] `e2e/specs/mattermost/alt_enter.test.ts`
EOF
)" \
  e2e/helpers/channelMenu.ts \
  e2e/specs/mattermost/context_menu.test.ts \
  e2e/specs/mattermost/alt_enter.test.ts \
  e2e/specs/mattermost/window_close.test.ts \
  e2e/specs/mattermost/copy_link.test.ts \
  e2e/specs/mattermost/external_links.test.ts

make_slice_pr 5 e2e/05-downloads \
  "E2E: Downloads coverage (5/10)" \
  "E2E: Downloads helpers and specs (5/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **5/10** — downloads helpers + all download specs.

## Test plan
- [ ] `e2e/specs/downloads/`
EOF
)" \
  e2e/helpers/downloads.ts \
  e2e/helpers/downloadsDropdown.ts \
  e2e/specs/downloads/download_cancel.test.ts \
  e2e/specs/downloads/download_clear_all.test.ts \
  e2e/specs/downloads/download_completion.test.ts \
  e2e/specs/downloads/download_open.test.ts \
  e2e/specs/downloads/downloads_dropdown_items.test.ts \
  e2e/specs/downloads/downloads_manager.test.ts \
  e2e/specs/downloads/downloads_menubar.test.ts \
  e2e/specs/downloads/video_download.test.ts

make_slice_pr 6 e2e/06-server-management \
  "E2E: Server management and certificate trust (6/10)" \
  "E2E: Server management, bad servers, certificate trust (6/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **6/10** — errorView helper, bad_servers, certificate trust, server modals.

## Test plan
- [ ] `e2e/specs/server_management/bad_servers.test.ts`
- [ ] `e2e/specs/server_management/certificate_trust.test.ts`
EOF
)" \
  e2e/helpers/errorView.ts \
  e2e/specs/server_management/add_server_modal.test.ts \
  e2e/specs/server_management/bad_servers.test.ts \
  e2e/specs/server_management/certificate_trust.test.ts \
  e2e/specs/server_management/configure_server_modal.test.ts \
  e2e/specs/server_management/edit_server_modal.test.ts \
  e2e/specs/server_management/header.test.ts \
  e2e/specs/server_management/long_server_name.test.ts \
  e2e/specs/server_management/remove_server_modal.test.ts \
  e2e/specs/server_management/tab_management.test.ts

make_slice_pr 7 e2e/07-popout-startup \
  "E2E: Popout, drag-drop, and startup specs (7/10)" \
  "E2E: Popout, drag-drop, startup, and Linux specs (7/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **7/10** — popout windows, drag-and-drop, startup/window specs, Linux dark mode.

## Test plan
- [ ] `e2e/specs/server_management/popout_windows.test.ts`
- [ ] `e2e/specs/startup/`
EOF
)" \
  e2e/specs/server_management/popout_windows.test.ts \
  e2e/specs/server_management/drag_and_drop.test.ts \
  e2e/specs/startup/app.test.ts \
  e2e/specs/startup/cmd_tab_restore.test.ts \
  e2e/specs/startup/config_integrity.test.ts \
  e2e/specs/startup/config.test.ts \
  e2e/specs/startup/session_persistence.test.ts \
  e2e/specs/startup/welcome_screen_modal.test.ts \
  e2e/specs/startup/window_reposition.test.ts \
  e2e/specs/startup/window.test.ts \
  e2e/specs/linux_dark_mode.test.ts \
  e2e/specs/linux/wayland_launch.test.ts

make_slice_pr 8 e2e/08-notifications-focus-calls \
  "E2E: Notifications, focus, and Calls (8/10)" \
  "E2E: Notifications, focus, and Calls specs (8/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **8/10** — notification trigger specs, focus, Calls functionality.

## Test plan
- [ ] `e2e/specs/notification_trigger/`
- [ ] `e2e/specs/calls/calls_functionality.test.ts`
EOF
)" \
  e2e/specs/calls/calls_functionality.test.ts \
  e2e/specs/focus.test.ts \
  e2e/specs/focus/app_switch_focus.test.ts \
  e2e/specs/notification_trigger/desktop_notification_delivery.test.ts \
  e2e/specs/notification_trigger/dock_bounce.test.ts \
  e2e/specs/notification_trigger/flash_taskbar.test.ts \
  e2e/specs/notification_trigger/notification_badge_in_dock.test.ts \
  e2e/specs/notification_trigger/notification_badge_windows_linux.test.ts \
  e2e/specs/notification_trigger/notification_click.test.ts

make_slice_pr 9 e2e/09-menu-bar \
  "E2E: Menu bar specs (9/10)" \
  "E2E: Menu bar and permissions IPC specs (9/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **9/10** — menu bar specs + permissions IPC.

## Test plan
- [ ] `e2e/specs/menu_bar/`
EOF
)" \
  e2e/specs/menu_bar/clear_all_data.test.ts \
  e2e/specs/menu_bar/devtools_current_server.test.ts \
  e2e/specs/menu_bar/diagnostics.test.ts \
  e2e/specs/menu_bar/edit_menu.test.ts \
  e2e/specs/menu_bar/file_menu.test.ts \
  e2e/specs/menu_bar/full_screen.test.ts \
  e2e/specs/menu_bar/help_menu.test.ts \
  e2e/specs/menu_bar/menu.test.ts \
  e2e/specs/menu_bar/view_menu.test.ts \
  e2e/specs/menu_bar/window_menu.test.ts \
  e2e/specs/permissions/permissions_ipc.test.ts

make_slice_pr 10 e2e/10-tray-settings-deeplink \
  "E2E: Tray, settings, and deep linking (10/10)" \
  "E2E: Tray, settings, deep linking, and misc specs (10/10)." \
  "$(cat <<'EOF'
## Summary
Stacked PR **10/10** — final slice: tray, settings, deep linking, policy, popup.

Completes the #3847 split when merged after PRs 1–9.

## Test plan
- [ ] `e2e/specs/system/tray_menu.test.ts`
- [ ] `e2e/specs/deep_linking/`
- [ ] `e2e/specs/settings/`
EOF
)" \
  e2e/helpers/deeplink.ts \
  e2e/specs/deep_linking/deeplink_running.test.ts \
  e2e/specs/deep_linking/deeplink.test.ts \
  e2e/specs/deep_linking/oauth_callback.test.ts \
  e2e/specs/policy/policy.test.ts \
  e2e/specs/popup.test.ts \
  e2e/specs/settings.test.ts \
  e2e/specs/settings/autostart.test.ts \
  e2e/specs/settings/tray_icon_hide.test.ts \
  e2e/specs/system/tray_menu.test.ts \
  e2e/specs/system/tray_restore.test.ts \
  e2e/specs/system/window_close_tray.test.ts

git checkout migrate_RF_desktop
echo "Done. All 10 stacked PR branches created."
