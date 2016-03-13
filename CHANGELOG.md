# Mattermost Desktop Application Changelog

## IN PROGRESS: Release v1.0.8 (Beta)

The `electron-mattermost` project is now the official desktop application for the Mattermost open source project.

### Changes
- Renaming project from `electron-mattermost` to  `desktop`

### Fixes
- On **Settings Page** added validation so that **Name** field value is required before team site can be added.

### Known issues

- Windows and Linux: **File** > **About** does not bring up version number dialog
- Windows 10: Application does not appear in Windows volume mixer
- All platforms: Embedded markdown images with `http://` do not render
