# src/common/config/ — Configuration System

`Config` (`index.ts`) reads/writes `config.json`, merging build config, policy-managed config (GPO/MDM), and user preferences into a single resolved configuration.

## Config versioning

Supports V0 through V4 with automatic migration via `upgradePreferences.ts`. Additionally, `migrationPreferences.ts` handles one-time item-level migrations tracked via a separate JSON file.

## Policy-managed configuration (`policyConfigLoader.ts`)

- **Windows**: Registry keys set by Group Policy. GPO templates in `resources/windows/gpo`.
- **macOS**: CFPreferences set by MDM profiles via `cf-prefs`.

Policy values override user preferences and cannot be changed by the user.

## Build config (`buildConfig.ts`)

Compile-time constants: `defaultServers`, `enableServerManagement`, `enableUpdateNotifications`, `updateNotificationURL`, `managedResources`, `allowedProtocols`, and various external links. Used for white-labelling.

## Config directory

| Platform | Path |
|---|---|
| Windows | `%userprofile%\AppData\Roaming\Mattermost` |
| Linux | `~/.local/share/Mattermost` or `~/.config/Mattermost` |
| macOS (DMG) | `~/Library/Application Support/Mattermost` |
| macOS (App Store) | `~/Library/Containers/Mattermost.Desktop/Data/Library/Application Support/Mattermost` |

In dev mode, the app name is `Electron`, so the directory is `Electron` instead of `Mattermost`. This does not affect Mac App Store.

## Adding a new config property

1. Add the field to the `ConfigV4` type in `src/types/config.ts`.
2. Set its default value in `defaultPreferences.ts`.
3. Add a Joi validation rule in `src/common/Validator.ts` under the appropriate config schema.
4. If it should be policy-managed, add the registry/MDM key mapping in `policyConfigLoader.ts`.
5. If it needs a migration from an older format, add a migration step in `migrationPreferences.ts`.
6. Access via `Config.propertyName` — the `Config` class dynamically exposes all `CombinedConfig` fields through a getter proxy.

Example — adding an `enableMyFeature` boolean:

```typescript
// 1. src/types/config.ts — add to ConfigV4:
enableMyFeature: boolean;

// 2. defaultPreferences.ts — set default:
const defaultPreferences: ConfigV4 = {
    // ...existing fields...
    enableMyFeature: true,
};

// 3. Validator.ts — add to the configV4DataSchemaV4 Joi object:
enableMyFeature: Joi.boolean().default(true),

// 6. Usage anywhere in the main process:
import Config from 'common/config';
if (Config.enableMyFeature) { /* ... */ }
```
