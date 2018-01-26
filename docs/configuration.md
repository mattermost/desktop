# Mattermost Desktop Configuration Guides

## Build-time Configuration
You can customize and distribute your own Mattermost Desktop application
by configuring `src/common/config/buildConfig.js`.
To build the application, please follow
[Mattermost Desktop Development Guides](./development.md).

### Parameters

#### `defaultTeams`
`Array<Object(Team)>`

Servers which are initially added to the application.
They are displayed prior to user-defined servers and users can't modify them.

##### `Team.name`
`String`

The tab name for the server.

##### `Team.url`
`String`

The URL for the server.

#### `helpLink`
`String | null`

The URL to open when clicking "Help->Learn More..." menu item.
If null is specified, the menu disappears.

#### `enableServerManagement`
`Boolean`

Whether users can edit servers configuration.
Specify at least one server for `defaultTeams` when `enableServerManagement` is
set to false.
Otherwise, users can't interact with any servers.
