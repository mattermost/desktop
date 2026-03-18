# src/main/notifications/ — Notification Manager

`NotificationManager` manages OS notifications for mentions, downloads, and upgrade prompts.

- Respects Do Not Disturb per platform: macOS (`macos-notification-state`), Windows (`windows-focus-assist`), Linux (no DND detection via `dnd-linux.ts`).
- Tracks active notifications per channel to avoid duplicates.
- Encodes server and channel IDs in notification payload for click routing.
- Sound files live in `src/assets/sounds/`.

## Notification types

Each type is a separate class in its own file:

- **`Mention`** (`Mention.ts`): Channel mention notifications from server push.
- **`DownloadNotification`** (`Download.ts`): File download completion notifications.
- **`NewVersionNotification`** / **`UpgradeNotification`** (`Upgrade.ts`): App update and upgrade-required prompts.

