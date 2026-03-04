# Testing MDM managed preferences on macOS

This folder contains an example plist you can install so the Mattermost desktop app reads managed preferences (same keys as Windows GPO).

## Install

1. Copy the plist into Managed Preferences using the app’s bundle ID as the filename:

   ```bash
   sudo cp example-managed-preferences.plist "/Library/Managed Preferences/Mattermost.Desktop.plist"
   ```

2. Ensure the file is readable by the user running the app:

   ```bash
   sudo chmod 644 "/Library/Managed Preferences/Mattermost.Desktop.plist"
   ```

3. Launch (or relaunch) the Mattermost desktop app. It will read `DefaultServerList`, `EnableServerManagement`, and `EnableAutoUpdater` from this plist via CFPreferences.

## Uninstall

```bash
sudo rm "/Library/Managed Preferences/Mattermost.Desktop.plist"
```

## Customizing the example

Edit `example-managed-preferences.plist` before copying:

- **DefaultServerList**: Array of dicts with `name` (string) and `url` (string). Add more `<dict>…</dict>` entries for extra servers.
- **EnableServerManagement**: `true` or `false`.
- **EnableAutoUpdater**: `true` or `false`.

The bundle ID (`com.Mattermost.Desktop`) must match the built app; it comes from `electron-builder.json` (mac `appId`).
