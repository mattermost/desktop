# Phase 0-B — Full Desktop Catalog Classification

**Date**: 2026-06-18  
**Baseline**: commit `53d1d5e2` (tag `rf-migration-baseline`)  
**Source of truth**: `e2e/test-management/desktop_test_catalog.csv` (161 tests)  
**Case files**: `e2e/test-management/cases/MM-T*.md` (62 fetched from `mattermost/mattermost-test-management`)

---

## Classification Taxonomy

| Status | Meaning |
|--------|---------|
| ✅ **migrated** | Covered by a Playwright spec at baseline |
| ⚠️ **partial** | Spec exists but doesn't cover all steps |
| 🌐 **webapp-owned** | Exercises webapp behavior only; retire from desktop cycle |
| 📋 **desktop-todo** | Needs a new Playwright spec; no infra blocker |
| 🔒 **infra-blocked** | Needs new test infrastructure; blocker listed |
| 🚫 **retire-manual** | Not reasonably automatable; justification provided |
| 🗑️ **deprecated** | Marked deprecated in test name or folder |

---

## Full Classification Table (161 tests)

| # | MM-T ID | Title | Folder | Priority | Status | Spec/Blocker | Notes |
|---|---------|-------|--------|----------|--------|--------------|-------|
| 1 | MM-T125 | Copy Link from channel LHS | native-specific | Smoke | ✅ migrated | `mattermost/copy_link.test.ts` | |
| 2 | MM-T804 | Preferences opens Settings | menu-bar | Smoke | ✅ migrated | `menu_bar/file_menu.test.ts` | |
| 3 | MM-T805 | Sign in to Another Server | menu-bar | Smoke | ⚠️ partial | `menu_bar/file_menu.test.ts` | Menu item opens window; missing OAuth/SAML flow |
| 4 | MM-T806 | Exit in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/file_menu.test.ts` | |
| 5 | MM-T807 | Undo in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 6 | MM-T808 | Redo in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 7 | MM-T809 | Cut in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 8 | MM-T810 | Copy in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 9 | MM-T811 | Paste in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 10 | MM-T812 | Select All in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/edit_menu.test.ts` | |
| 11 | MM-T813 | Use Find option | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 12 | MM-T814 | Reload in the Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 13 | MM-T815 | Clear Cache and Reload | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 14 | MM-T816 | Toggle Full Screen | menu-bar | Smoke | ✅ migrated | `menu_bar/full_screen.test.ts` | |
| 15 | MM-T817 | Actual Size in Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 16 | MM-T818 | Zoom In | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 17 | MM-T819 | Zoom Out | menu-bar | Smoke | ✅ migrated | `menu_bar/view_menu.test.ts` | |
| 18 | MM-T820 | DevTools for App Wrapper | menu-bar | Smoke | ✅ migrated | `menu_bar/devtools_current_server.test.ts` | |
| 19 | MM-T821 | DevTools for Current Server | menu-bar | Smoke | ✅ migrated | `menu_bar/devtools_current_server.test.ts` | |
| 20 | MM-T822 | History → Back | menu-bar | Low | 📋 desktop-todo | `menu_bar/history_menu.test.ts` (extend) | Menu item; existing spec has forward only |
| 21 | MM-T823 | History → Forward | menu-bar | Low | ✅ migrated | `menu_bar/history_menu.test.ts` | "Click back and forward" test |
| 22 | MM-T824 | Minimize in Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/window_menu.test.ts` | |
| 23 | MM-T825 | Close in Menu Bar | menu-bar | Smoke | ✅ migrated | `menu_bar/window_menu.test.ts` | |
| 24 | MM-T826 | Switch server via keyboard | menu-bar | Smoke | ✅ migrated | `menu_bar/window_menu.test.ts` | |
| 25 | MM-T827 | Select Next/Previous Server | menu-bar | Smoke | ✅ migrated | `menu_bar/window_menu.test.ts` | |
| 26 | MM-T828 | Learn More in Menu Bar | menu-bar | Low | 📋 desktop-todo | `menu_bar/help_menu.test.ts` (extend) | Menu item opens external URL |
| 27 | MM-T829 | Spell check right-click | right-click-menu | Low | 🌐 webapp-owned | — | Chromium spell check; webapp context menu |
| 28 | MM-T1284 | Deprecated: Add new server (Settings) | server-management | — | 🗑️ deprecated | — | Marked deprecated in title |
| 29 | MM-T1285 | Deprecated: Edit existing server | server-management | — | 🗑️ deprecated | — | Marked deprecated in title |
| 30 | MM-T1286 | Remove existing server | server-management | Smoke | ✅ migrated | `server_management/remove_server_modal.test.ts` | Covered by MM-T4390 |
| 31 | MM-T1287 | Deprecated: Add two servers (Settings) | server-management | — | 🗑️ deprecated | — | Marked deprecated in title |
| 32 | MM-T1289 | Start app on login (Win/Linux) | windows-and-linux-only | Low | 📋 desktop-todo | `settings/autostart.test.ts` (extend) | Config toggle + OS behavior |
| 33 | MM-T1290 | Do not start app on login | windows-and-linux-only | Low | 📋 desktop-todo | `settings/autostart.test.ts` (extend) | Config toggle |
| 34 | MM-T1291 | Show red badge | server-management | Low | 📋 desktop-todo | `notification_trigger/notification_badge_windows_linux.test.ts` (extend) | Badge visibility |
| 35 | MM-T1292 | Do not show red badge if no mention | server-management | Low | 📋 desktop-todo | `notification_trigger/notification_badge_windows_linux.test.ts` (extend) | Badge suppression |
| 36 | MM-T1293 | Flash taskbar icon (Win/Linux) | windows-and-linux-only | Smoke | ✅ migrated | `notification_trigger/flash_taskbar.test.ts` | |
| 37 | MM-T1294 | Do not flash taskbar icon (Win/Linux) | windows-and-linux-only | Low | 📋 desktop-todo | `notification_trigger/flash_taskbar.test.ts` (extend) | Config toggle for flash |
| 38 | MM-T1295 | Do not bounce dock icon (macOS) | macos-only | Smoke | ✅ migrated | `notification_trigger/dock_bounce.test.ts` | |
| 39 | MM-T1296 | Bounce dock icon (macOS) | macos-only | Smoke | ✅ migrated | `notification_trigger/dock_bounce.test.ts` | |
| 40 | MM-T1297 | Bounce dock until open (macOS) | macos-only | Smoke | ✅ migrated | `notification_trigger/dock_bounce.test.ts` | |
| 41 | MM-T1298 | Show Mattermost icon in menu bar | server-management | Low | 📋 desktop-todo | `settings/tray_icon_hide.test.ts` (extend) | Inverse of MM-T1299 |
| 42 | MM-T1299 | Do not show icon in menu bar | server-management | Low | ✅ migrated | `settings/tray_icon_hide.test.ts` | |
| 43 | MM-T1300 | System tray - open Settings | system-tray-icon | Low | 📋 desktop-todo | `system/tray_menu.test.ts` (extend) | Tray menu item → Settings window |
| 44 | MM-T1301 | System tray - exit | system-tray-icon | Low | 📋 desktop-todo | `system/tray_menu.test.ts` (extend) | Tray menu → quit app |
| 45 | MM-T1302 | System tray - choose server | system-tray-icon | Low | 📋 desktop-todo | `system/tray_menu.test.ts` (extend) | Tray menu → switch server |
| 46 | MM-T1303 | Receive a desktop notification | permissions | Smoke | 🔒 infra-blocked | OS notification click | Cannot click OS-level desktop notifications from Playwright; existing test uses IPC-level simulation |
| 47 | MM-T1304 | Open app from deep link | deep-linking | Smoke | ✅ migrated | `deep_linking/deeplink.test.ts` | |
| 48 | MM-T1306 | Posting in Developers channel | deep-linking | Smoke | ✅ migrated | `deep_linking/deeplink.test.ts` | |
| 49 | MM-T1307 | Right-click channel/team name | right-click-menu | Smoke | ✅ migrated | `mattermost/context_menu.test.ts` | |
| 50 | MM-T1308 | External links open in browser | relative-urls | Smoke | ⚠️ partial | `relative_url/relative_url.test.ts` | Basic case covered; edge cases missing |
| 51 | MM-T1309 | Type text in search box | search-box | Low | 🌐 webapp-owned | — | Webapp search box behavior |
| 52 | MM-T1310 | Set Appearance to Dark (macOS) | dark-mode | Smoke | ✅ migrated | `linux_dark_mode.test.ts` (extended) | |
| 53 | MM-T1311 | Switch apps: text input focused | focus-behavior | Smoke | ✅ migrated | `focus/app_switch_focus.test.ts` | |
| 54 | MM-T1312 | Focus first text input in Add Server | server-management | Smoke | ✅ migrated | `server_management/add_server_modal.test.ts` | |
| 55 | MM-T1313 | Open Settings via keyboard shortcut | menu-bar | Smoke | ✅ migrated | `menu_bar/file_menu.test.ts` | |
| 56 | MM-T1314 | Focus text input | focus-behavior | Low | 📋 desktop-todo | `focus.test.ts` (extend) | General focus behavior |
| 57 | MM-T1315 | Close Settings: focus returns | focus-behavior | Smoke | ✅ migrated | `focus.test.ts` | |
| 58 | MM-T1316 | Close Add Server: focus returns | focus-behavior | Smoke | ✅ migrated | `focus.test.ts` | |
| 59 | MM-T1317 | Switch servers: focus returns | focus-behavior | Smoke | ✅ migrated | `focus.test.ts` | |
| 60 | MM-T1318 | Deprecated: Open Settings to add server | focus-behavior | — | 🗑️ deprecated | — | Marked deprecated in title |
| 61 | MM-T1319 | Sign in to Another Server (menu) | focus-behavior | Low | 📋 desktop-todo | `menu_bar/file_menu.test.ts` (extend) | Menu → Add Server modal + focus |
| 62 | MM-T1320 | Use spell-check suggestion | right-click-menu | Low | 🌐 webapp-owned | — | Chromium spell check in webapp context |
| 63 | MM-T1428 | Window returns to floating position | native-specific | Low | 📋 desktop-todo | `startup/window_reposition.test.ts` (extend) | Position persistence across restart |
| 64 | MM-T1430 | Cross-server permalink | deep-linking | Low | 📋 desktop-todo | `deep_linking/deeplink.test.ts` (extend) | Needs 2 configured servers |
| 65 | MM-T1538 | Download a video | native-specific | Low | ✅ migrated | `downloads/video_download.test.ts` | |
| 66 | MM-T1574 | Startup after reboot (Win/Linux) | windows-and-linux-only | Low | 🚫 retire-manual | OS reboot required | Cannot automate OS reboot in CI |
| 67 | MM-T1659 | Prevent back/forward in OAuth | native-specific | Smoke | ✅ migrated | `popup.test.ts` | |
| 68 | MM-T1660 | App restores position after minimize | native-specific | Low | 📋 desktop-todo | `startup/window_reposition.test.ts` (extend) | Minimize + restore position |
| 69 | MM-T1661 | Desktop notifications | native-specific | Smoke | ✅ migrated | `notification_trigger/desktop_notification_delivery.test.ts` | |
| 70 | MM-T1668 | Quit the app | menu-bar | Low | 📋 desktop-todo | `menu_bar/file_menu.test.ts` (extend) | Menu → quit; verify app exits |
| 71 | MM-T2023 | ALT+ENTER inserts newline | menu-bar | Low | ✅ migrated | `mattermost/alt_enter.test.ts` | |
| 72 | MM-T2465 | Linux Dark Mode | windows-and-linux-only | Smoke | ✅ migrated | `linux_dark_mode.test.ts` | |
| 73 | MM-T2617 | Reopen on Cmd+Tab (macOS) | menu-bar | Smoke | ✅ migrated | `startup/cmd_tab_restore.test.ts` | |
| 74 | MM-T2631 | Trust invalid cert once | native-specific | Low | 📋 desktop-todo | `server_management/certificate_trust.test.ts` (extend) | Cert trust persistence across restart |
| 75 | MM-T2633 | Back button to return to login | native-specific | Low | 📋 desktop-todo | `server_management/bad_servers.test.ts` (extend) | Error view → back navigation |
| 76 | MM-T2634 | Server tab Drag and Drop | server-management | Smoke | ✅ migrated | `server_management/drag_and_drop.test.ts` | |
| 77 | MM-T2635 | Switch server tabs after reorder | server-management | Smoke | ✅ migrated | `server_management/drag_and_drop.test.ts` | |
| 78 | MM-T2636 | Reposition Desktop app | server-management | Smoke | ✅ migrated | `startup/window_reposition.test.ts` | |
| 79 | MM-T2637 | Double-click header maximize | server-management | Smoke | ✅ migrated | `server_management/header.test.ts` | |
| 80 | MM-T2826 | Server URL validation | server-management | Smoke | ✅ migrated | `server_management/edit_server_modal.test.ts` | |
| 81 | MM-T2827 | Copy/Paste in Jira plugin | focus-behavior | Smoke | ✅ migrated | `popup.test.ts` | |
| 82 | MM-T2828 | Install using .msi (Windows) | native-specific | Smoke | 🚫 retire-manual | Real Windows installer | Cannot automate MSI installation in CI |
| 83 | MM-T2925 | Trust protocols, auto-convert links | permissions | Low | 🔒 infra-blocked | OS protocol handlers | Needs real protocol registration |
| 84 | MM-T2949 | CMD-Enter (macOS post/reply) | macos-only | Low | 📋 desktop-todo | `mattermost/alt_enter.test.ts` (extend) | macOS-specific Enter variant |
| 85 | MM-T2951 | App start on login on by default | windows-and-linux-only | Low | 📋 desktop-todo | `settings/autostart.test.ts` (extend) | Default config verification |
| 86 | MM-T2952 | Change app start on login setting | windows-and-linux-only | Low | 📋 desktop-todo | `settings/autostart.test.ts` (extend) | Config toggle |
| 87 | MM-T3360 | Configure Help & Report a Problem links | native-specific | Low | 📋 desktop-todo | `menu_bar/help_menu.test.ts` (extend) | Config-driven menu item URLs |
| 88 | MM-T3400 | Default OS window header (Win 7) | windows-and-linux-only | Normal | 🚫 retire-manual | Win 7 unsupported | OS reached EOL; test irrelevant |
| 89 | MM-T3795 | Camera/mic permissions macOS | permissions | Normal | 🔒 infra-blocked | OS permission dialogs | Cannot automate OS-level permission prompts |
| 90 | MM-T4020 | PIV card test | native-specific | Normal | 🚫 retire-manual | Real PIV hardware | Requires physical smart card |
| 91 | MM-T4022 | Check process number in Task Manager | native-specific | Normal | 🚫 retire-manual | OS Task Manager UI | Cannot automate external OS UI |
| 92 | MM-T4031 | Specify default downloads location | native-specific | Low | 📋 desktop-todo | `settings.test.ts` (extend) | Settings → download path config |
| 93 | MM-T4049 | Tiled and full screen position | native-specific | Low | 📋 desktop-todo | `startup/window.test.ts` (extend) | Window positioning modes |
| 94 | MM-T4050 | Long server name | native-specific | Smoke | ✅ migrated | `server_management/long_server_name.test.ts` | |
| 95 | MM-T4054 | Open/Close permalink media preview | native-specific | Low | 🌐 webapp-owned | — | Webapp media preview behavior |
| 96 | MM-T4055 | Opening untrusted links in browser | native-specific | Low | 📋 desktop-todo | `mattermost/external_links.test.ts` (extend) | Untrusted protocol handling |
| 97 | MM-T4385 | Switch tabs via keyboard | menu-bar | Smoke | ✅ migrated | `menu_bar/window_menu.test.ts` | |
| 98 | MM-T4388 | Add Server modal close on Cancel | server-management | Smoke | ✅ migrated | `server_management/add_server_modal.test.ts` | |
| 99 | MM-T4389 | Add Server modal invalid inputs | server-management | Smoke | ✅ migrated | `server_management/add_server_modal.test.ts` | |
| 100 | MM-T4390 | Remove Server Modal | server-management | Smoke | ✅ migrated | `server_management/remove_server_modal.test.ts` | |
| 101 | MM-T4391 | Edit Server Modal | server-management | Smoke | ✅ migrated | `server_management/edit_server_modal.test.ts` | |
| 102 | MM-T4392 | Settings - Start app on login | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 103 | MM-T4393 | Settings - Save Tray Icon | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 104 | MM-T4394 | Settings - Leave app running | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 105 | MM-T4395 | Settings - Flash taskbar icon | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 106 | MM-T4396 | Settings - Show red badge | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 107 | MM-T4397 | Settings - Check spelling | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 108 | MM-T4398 | Settings - GPU acceleration | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 109 | MM-T4399 | New Server Modal when no servers | startup | Smoke | 📋 desktop-todo | `startup/app.test.ts` (extend) | Empty config → Add Server modal |
| 110 | MM-T4400 | Should not create second instance | startup | Smoke | ✅ migrated | `startup/app.test.ts` | |
| 111 | MM-T4401 | Show servers from config | startup | Smoke | ✅ migrated | `startup/config.test.ts` | |
| 112 | MM-T4402 | Upgrade config file from v0 | startup | Smoke | ✅ migrated | `startup/config.test.ts` | |
| 113 | MM-T4403 | Window Bounds | startup | Smoke | ✅ migrated | `startup/window.test.ts` | |
| 114 | MM-T4404 | Accessibility - Menu | menu-bar | Smoke | ✅ migrated | `menu_bar/menu.test.ts` | |
| 115 | MM-T4405 | Menu items reflect config | dropdown | Smoke | ✅ migrated | `menu_bar/dropdown.test.ts` | |
| 116 | MM-T4406 | Show/Hide Dropdown | dropdown | Smoke | ✅ migrated | `menu_bar/dropdown.test.ts` | |
| 117 | MM-T4407 | Click Add Server Button | dropdown | Smoke | ✅ migrated | `menu_bar/dropdown.test.ts` | |
| 118 | MM-T4408 | Switching Servers | dropdown | Smoke | ✅ migrated | `menu_bar/dropdown.test.ts` | |
| 119 | MM-T4416 | Refreshing a board | plugin-regression | Normal | 🌐 webapp-owned | — | Boards plugin; webapp behavior |
| 120 | MM-T4419 | Add Server modal not removable | startup | Smoke | 📋 desktop-todo | `startup/app.test.ts` (extend) | Modal persistence when no servers |
| 121 | MM-T4549 | Settings - Auto check for updates | settings | Smoke | ✅ migrated | `settings.test.ts` | |
| 122 | MM-T4638 | Settings - app icon theme | settings | Low | 📋 desktop-todo | `settings.test.ts` (extend) | Icon theme toggle |
| 123 | MM-T4803 | Open Servers Menu via keyboard | native-specific | Low | 📋 desktop-todo | `menu_bar/menu.test.ts` (extend) | Keyboard shortcut for server menu |
| 124 | MM-T4804 | Copy version string to clipboard | native-specific | Low | 📋 desktop-todo | `menu_bar/help_menu.test.ts` (extend) | Menu → Help → Version → clipboard |
| 125 | MM-T4975 | Welcome screen when no servers | onboarding | Smoke | ✅ migrated | `startup/app.test.ts` | |
| 126 | MM-T4976 | Slides in expected order | onboarding | Smoke | ✅ migrated | `startup/welcome_screen_modal.test.ts` | |
| 127 | MM-T4977 | Navigate slides via buttons | onboarding | Smoke | ✅ migrated | `startup/welcome_screen_modal.test.ts` | |
| 128 | MM-T4978 | Navigate slides via pagination | onboarding | Smoke | 📋 desktop-todo | `startup/welcome_screen_modal.test.ts` (extend) | Pagination indicator clicks |
| 129 | MM-T4979 | Auto-advance slides every 5s | onboarding | Smoke | 📋 desktop-todo | `startup/welcome_screen_modal.test.ts` (extend) | Timer-based slide advance |
| 130 | MM-T4980 | Slides in expected order (variant) | onboarding | Smoke | 📋 desktop-todo | `startup/welcome_screen_modal.test.ts` (extend) | Variant of MM-T4976 |
| 131 | MM-T4981 | Move from last to first slide | onboarding | Smoke | 📋 desktop-todo | `startup/welcome_screen_modal.test.ts` (extend) | Wrap-around navigation |
| 132 | MM-T4982 | Move from first to last slide | onboarding | Smoke | 📋 desktop-todo | `startup/welcome_screen_modal.test.ts` (extend) | Wrap-around navigation |
| 133 | MM-T4983 | Get started button → new server modal | onboarding | Smoke | ✅ migrated | `startup/welcome_screen_modal.test.ts` | |
| 134 | MM-T4985 | App name in title bar when no servers | onboarding | Smoke | ✅ migrated | `startup/app.test.ts` | |
| 135 | MM-T5115 | Configure Server - no display name | cypress-drafts | Smoke | ✅ migrated | `server_management/configure_server_modal.test.ts` | |
| 136 | MM-T5116 | Configure Server - no URL | cypress-drafts | Smoke | ✅ migrated | `server_management/configure_server_modal.test.ts` | |
| 137 | MM-T5117 | Configure Server - valid | cypress-drafts | Smoke | ✅ migrated | `server_management/configure_server_modal.test.ts` | |
| 138 | MM-T5118 | Configure Server - invalid URL | cypress-drafts | Smoke | ✅ migrated | `server_management/configure_server_modal.test.ts` | |
| 139 | MM-T5119 | Configure Server - add to config | cypress-drafts | Smoke | ✅ migrated | `server_management/configure_server_modal.test.ts` | |
| 140 | MM-T5640 | Landing page when enabled | landing-page | Normal | 🌐 webapp-owned | — | Server-side config; webapp landing page |
| 141 | MM-T5747 | User attributes order in profile | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 142 | MM-T5748 | Long attribute names in profile | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 143 | MM-T5749 | Cancel doesn't save attribute edit | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 144 | MM-T5750 | No crash on concurrent edit/delete | user-attributes | Normal | 🌐 webapp-owned | — | Webapp + server race condition |
| 145 | MM-T5751 | Attributes in profile pop-over | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile popover UI |
| 146 | MM-T5752 | Profile pop-over scrollable | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile popover UI |
| 147 | MM-T5771 | Edit Phone/URL attributes | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 148 | MM-T5772 | URL validation in attributes | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 149 | MM-T5774 | Hide attributes if none exist | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 150 | MM-T5776 | Hide attributes when hidden | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 151 | MM-T5777 | Always display attributes | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 152 | MM-T5778 | Display Phone/URL attributes | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile settings UI |
| 153 | MM-T5779 | Phone/URL clickable in popover | user-attributes | Normal | 🌐 webapp-owned | — | Webapp profile popover UI |
| 154 | MM-T5888 | Drag and drop between windows | multi-window | Normal | 🔒 infra-blocked | Multi-window drag simulation | Needs multi-window test infra |
| 155 | MM-T5889 | Focus and notification behavior | multi-window | Normal | 📋 desktop-todo | `focus.test.ts` (extend) | Multi-window focus/notification |
| 156 | MM-T5890 | Opening channels in new windows | multi-window | Normal | 📋 desktop-todo | `server_management/popout_windows.test.ts` (extend) | Channel popout creation |
| 157 | MM-T5891 | Opening RHS plugin in new windows | multi-window | Normal | 🔒 infra-blocked | Plugin content in popout | Needs plugin-enabled test server |
| 158 | MM-T5892 | Opening threads in new windows | multi-window | Normal | 📋 desktop-todo | `server_management/popout_windows.test.ts` (extend) | Thread popout creation |
| 159 | MM-T5893 | State synchronization between windows | multi-window | Normal | 🔒 infra-blocked | Multi-window state sync | Complex multi-window coordination |
| 160 | MM-T5894 | Tab behavior changes | multi-window | Normal | 📋 desktop-todo | `server_management/tab_management.test.ts` (extend) | Tab management with popouts |
| 161 | MM-T5895 | Window management (resize/move/close) | multi-window | Normal | 📋 desktop-todo | `startup/window.test.ts` (extend) | Popout window resize/move/close |

---

## Per-Folder Summary

| Folder | Total | ✅ migrated | ⚠️ partial | 🌐 webapp-owned | 📋 desktop-todo | 🔒 infra-blocked | 🚫 retire-manual | 🗑️ deprecated |
|--------|-------|------------|-----------|----------------|---------------|----------------|-----------------|--------------|
| menu-bar | 24 | 20 | 1 | 0 | 3 | 0 | 0 | 0 |
| server-management | 16 | 11 | 0 | 0 | 2 | 0 | 0 | 3 |
| settings | 9 | 8 | 0 | 0 | 1 | 0 | 0 | 0 |
| startup | 6 | 4 | 0 | 0 | 2 | 0 | 0 | 0 |
| onboarding | 8 | 4 | 0 | 0 | 4 | 0 | 0 | 0 |
| focus-behavior | 8 | 4 | 0 | 0 | 2 | 0 | 0 | 2 |
| dropdown | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| windows-and-linux-only | 8 | 1 | 0 | 0 | 5 | 0 | 2 | 0 |
| macos-only | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| deep-linking | 3 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| system-tray-icon | 3 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |
| permissions | 3 | 0 | 0 | 0 | 1 | 2 | 0 | 0 |
| right-click-menu | 3 | 1 | 0 | 2 | 0 | 0 | 0 | 0 |
| native-specific (root) | 17 | 5 | 0 | 1 | 7 | 0 | 3 | 0 |
| multi-window | 8 | 0 | 0 | 0 | 5 | 3 | 0 | 0 |
| user-attributes | 13 | 0 | 0 | 13 | 0 | 0 | 0 | 0 |
| cypress-drafts | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| dark-mode | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| relative-urls | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| search-box | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| landing-page | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| plugin-regression | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| **TOTAL** | **161** | **71** | **2** | **19** | **37** | **5** | **5** | **5** |

> Note: "migrated" count (71) differs from the earlier grep count (84) because 13 IDs in specs are NOT in the desktop catalog (they're project-style IDs like MM-T_GPO_*, MM-T_EL_*, MM-T_BADGE_WIN_*, or webapp-owned tests like MM-T5584, MM-T5600, MM-T5611 that appear in Rainforest cycles but not the desktop test catalog).

---

## Phase 1 Ready List (Prioritized)

Ranked by: Priority (Smoke > Normal > Low), then by whether production code already has test scaffolding, then by platform grouping.

| Rank | MM-T ID | Title | Priority | Proposed Spec Path | Platform Tag | Dependencies | Complexity |
|------|---------|-------|----------|--------------------|-------------|--------------|------------|
| **P1** | | | | | | | |
| 1 | MM-T4399 | New Server Modal when no servers | Smoke | `startup/app.test.ts` (extend) | `@all` | Empty config | Low |
| 2 | MM-T4419 | Add Server modal not removable | Smoke | `startup/app.test.ts` (extend) | `@all` | Empty config | Low |
| 3 | MM-T4978 | Navigate slides via pagination | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Welcome screen modal | Low |
| 4 | MM-T4979 | Auto-advance slides every 5s | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Timer-based polling | Medium |
| 5 | MM-T4981 | Move from last to first slide | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Welcome screen modal | Low |
| **P2** | | | | | | | |
| 6 | MM-T4979 | Auto-advance slides every 5s | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Timer-based polling | Medium |
| 7 | MM-T4980 | Slides in expected order (variant) | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Welcome screen modal | Low |
| 8 | MM-T4981 | Move last→first slide | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Welcome screen modal | Low |
| 9 | MM-T4982 | Move first→last slide | Smoke | `startup/welcome_screen_modal.test.ts` (extend) | `@all` | Welcome screen modal | Low |
| 10 | MM-T1291 | Show red badge | Low | `notification_trigger/notification_badge_windows_linux.test.ts` (extend) | `@win32`, `@linux` | Badge test hooks | Low |
| 11 | MM-T1292 | Do not show red badge if no mention | Low | `notification_trigger/notification_badge_windows_linux.test.ts` (extend) | `@win32`, `@linux` | Badge test hooks + server with unreads | Medium |
| 12 | MM-T1294 | Do not flash taskbar icon | Low | `notification_trigger/flash_taskbar.test.ts` (extend) | `@win32`, `@linux` | Flash test hooks | Low |
| 13 | MM-T1298 | Show icon in menu bar | Low | `settings/tray_icon_hide.test.ts` (extend) | `@darwin`, `@linux` | TrayIcon refs | Low |
| 14 | MM-T1300 | System tray - open Settings | Low | `system/tray_menu.test.ts` (extend) | `@linux`, `@win32` | Tray menu click helpers | Low |
| 15 | MM-T1301 | System tray - exit | Low | `system/tray_menu.test.ts` (extend) | `@linux`, `@win32` | Tray menu click helpers | Low |
| 16 | MM-T1302 | System tray - choose server | Low | `system/tray_menu.test.ts` (extend) | `@linux`, `@win32` | Tray menu + multiple servers | Medium |
| 17 | MM-T1314 | Focus text input | Low | `focus.test.ts` (extend) | `@all` | Server view | Low |
| 18 | MM-T1319 | Sign in to Another Server (menu) | Low | `menu_bar/file_menu.test.ts` (extend) | `@all` | Menu item traversal | Low |
| 19 | MM-T1428 | Window returns to floating position | Low | `startup/window_reposition.test.ts` (extend) | `@all` | Bounds persistence across restart | Medium |
| 20 | MM-T1660 | App restores position after minimize | Low | `startup/window_reposition.test.ts` (extend) | `@all` | Minimize + restore | Medium |
| 21 | MM-T1668 | Quit the app | Low | 🔒 infra-blocked | App quit terminates process | Cannot test app quit from within the Playwright-managed Electron process |
| 22 | MM-T2631 | Trust invalid cert once | Low | `server_management/certificate_trust.test.ts` (extend) | `@all` | TLS server + cert persistence | Medium |
| 23 | MM-T2633 | Back button to return to login | Low | `server_management/bad_servers.test.ts` (extend) | `@all` | Error view navigation | Low |
| 24 | MM-T2949 | CMD-Enter (macOS) | Low | `mattermost/alt_enter.test.ts` (extend) | `@darwin` | macOS-only keyboard | Low |
| 25 | MM-T3360 | Configure Help & Problem links | Low | 🔒 infra-blocked | Server System Console access | Requires admin access to System Console to set Help/Report links |
| 26 | MM-T4031 | Default downloads location | Low | `settings.test.ts` (extend) | `@all` | Settings page | Low |
| 27 | MM-T4049 | Tiled and full screen position | Low | `startup/window.test.ts` (extend) | `@all` | Window positioning | Medium |
| 28 | MM-T4055 | Opening untrusted links | Low | `mattermost/external_links.test.ts` (extend) | `@all` | Protocol handling | Low |
| 29 | MM-T4638 | App icon theme | Low | `settings.test.ts` (extend) | `@all` | Settings page | Low |
| 30 | MM-T4803 | Open Servers Menu via keyboard | Low | `menu_bar/menu.test.ts` (extend) | `@all` | Keyboard shortcut | Low |
| 31 | MM-T4804 | Copy version string to clipboard | Low | 🔒 infra-blocked | Clipboard access in headless CI | Cannot reliably read clipboard in headless CI environments |
| 32 | MM-T822 | History → Back | Low | `menu_bar/history_menu.test.ts` (extend) | `@all` | Menu item | Low |
| 33 | MM-T828 | Learn More in Menu Bar | Low | `menu_bar/help_menu.test.ts` (extend) | `@all` | Menu item → external URL | Low |
| 34 | MM-T1289 | Start app on login (Win/Linux) | Low | `settings/autostart.test.ts` (extend) | `@win32`, `@linux` | Autostart config | Low |
| 35 | MM-T1290 | Do not start app on login | Low | `settings/autostart.test.ts` (extend) | `@win32`, `@linux` | Autostart config | Low |
| 36 | MM-T2951 | App start on login on by default | Low | `settings/autostart.test.ts` (extend) | `@win32`, `@linux` | Default config | Low |
| 37 | MM-T2952 | Change app start on login | Low | `settings/autostart.test.ts` (extend) | `@win32`, `@linux` | Config toggle | Low |
| **P3** | | | | | | | |
| 38 | MM-T1430 | Cross-server permalink | Low | `deep_linking/deeplink.test.ts` (extend) | `@all` | 2 configured servers | High |
| 39 | MM-T5889 | Multi-window focus/notification | Normal | `focus.test.ts` (extend) | `@all` | Multi-window setup | High |
| 40 | MM-T5890 | Opening channels in new windows | Normal | `server_management/popout_windows.test.ts` (extend) | `@all` | Popout creation from channel | High |
| 41 | MM-T5892 | Opening threads in new windows | Normal | `server_management/popout_windows.test.ts` (extend) | `@all` | Thread popout creation | High |
| 42 | MM-T5894 | Tab behavior changes | Normal | `server_management/tab_management.test.ts` (extend) | `@all` | Multi-window tab management | High |
| 43 | MM-T5895 | Window management (resize/move/close) | Normal | `startup/window.test.ts` (extend) | `@all` | Popout window operations | High |

---

## Phase 2 Infra Blockers

| Blocker | Tests Affected | What's Needed |
|---------|---------------|---------------|
| **Multi-window drag simulation** | MM-T5888 | Ability to simulate drag-and-drop between two BrowserWindows |
| **Plugin-enabled test server** | MM-T5891 | A Mattermost server with RHS plugins (Playbooks, Copilot) installed |
| **Multi-window state sync** | MM-T5893 | Infrastructure to create, track, and assert state across 3+ simultaneous BrowserWindows |
| **OS protocol handlers** | MM-T2925 | Ability to register and test custom protocol handlers at OS level |
| **OS permission dialogs** | MM-T3795 | Ability to interact with macOS camera/microphone permission prompts |

---

## Retire-Manual List

| MM-T ID | Title | Justification |
|---------|-------|---------------|
| MM-T1574 | Startup after reboot | Requires OS reboot — cannot automate in CI |
| MM-T2828 | Install using .msi (Windows) | Requires real Windows MSI installer execution |
| MM-T3400 | Default OS window header (Win 7) | Windows 7 is EOL; test irrelevant |
| MM-T4020 | PIV card test | Requires physical PIV smart card hardware |
| MM-T4022 | Check process number in Task Manager | Requires interaction with external OS UI (Task Manager) |

---

## Webapp-Owned (Retire from Desktop Cycle)

| MM-T ID | Title | Folder | Notes |
|---------|-------|--------|-------|
| MM-T829 | Spell check right-click | right-click-menu | Chromium spell check in webapp |
| MM-T1309 | Type text in search box | search-box | Webapp search box |
| MM-T1320 | Use spell-check suggestion | right-click-menu | Chromium spell check in webapp |
| MM-T4054 | Open/Close permalink media preview | native-specific | Webapp media preview |
| MM-T4416 | Refreshing a board | plugin-regression | Boards plugin webapp behavior |
| MM-T5640 | Landing page when enabled | landing-page | Server-side config; webapp UI |
| MM-T5747–T5779 | User attributes (13 tests) | user-attributes | Webapp profile settings/popover UI |

> **Already filed**: Retirement tracking issues for MM-T5537, MM-T5584, MM-T5725, MM-T5601–T5615 in `mattermost/mattermost` (#37113–#37116). These 19 additional webapp-owned tests need similar retirement issues.

---

## Deprecated (Skip)

| MM-T ID | Title | Reason |
|---------|-------|--------|
| MM-T1284 | Add new server (from Settings) | Marked deprecated in title |
| MM-T1285 | Edit existing server | Marked deprecated in title |
| MM-T1287 | Add two servers (from Settings) | Marked deprecated in title |
| MM-T1318 | Open Settings modal to add new server | Marked deprecated in title |

---

## Sources Cited

| Claim | Source |
|-------|--------|
| Desktop test catalog (161 tests) | `e2e/test-management/desktop_test_catalog.csv` |
| Case file markdown bodies | `e2e/test-management/cases/MM-T*.md` (62 files fetched from `mattermost/mattermost-test-management`) |
| Existing spec inventory | `rg -o 'MM-T\d+' e2e/specs/ --no-filename` |
| Test priorities | YAML frontmatter `priority:` field in each case file |
| Folder assignments | `desktop_test_catalog.csv` column 2 |
| Webapp-owned classification | Case file step analysis — tests exercising only webapp UI (profile settings, search, spell check, boards, landing page) |
| Infra-blocked classification | Case file step analysis — tests requiring OS-level interaction (permission dialogs, protocol handlers, multi-window drag) |
| Retire-manual classification | Case file step analysis — tests requiring real hardware (PIV card), OS reboot, or external OS UI (Task Manager, MSI installer) |
