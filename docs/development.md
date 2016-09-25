# Mattermost Desktop Development Guides

## Build instructions

### Prerequisites
- C++ environment which supports C++11 (e.g. VS 2015, Xcode, GCC)
- Python 2.7
- Node.js 4.2.0 or later
- Git

### Installing dependencies
`npm install` is executed twice to install dependencies of `src/` directory.

```
$ npm install
```

### Building
Build JavaScript codes with `webpack`, and copy other assets into `dist/` directory.

```
$ npm run build
```

After building is done, you can execute the application with `npm start`.

### Tests
Execute automated tests.

```
$ npm test
```

There are two steps in `npm test`.

Test functionality:

```
$ npm run test:app
```

Test coding style:

```
$ npm run test:code
```

### Helper commmands

#### `npm run watch`
Reload the application automatically when you have saved source codes.

#### `mpm run prettify`
Format the source codes to pass `npm test`.

#### `npm run package`
You can package this application with following commands. Packages will be created in `release/` directory.

```
$ npm run package (for your platform)
$ npm run package:windows (Requires Windows or Wine)
$ npm run package:osx (Requires macOS or Linux)
$ npm run package:linux
$ npm run package:all (Packages for all platform)
```

Create a windows installer with the following command. It will appear in the `release\windows-installer` directory.

```
$ npm run installer
```

## Directory Structure

```
Mattermost Desktop
├── docs/ - Documentations.
├── resources/ - Resources which are used outside of the application codes.
├── scripts/ - Helper scripts.
├── src/ - Application source code.
│   ├── browser/ - Implemtation of Electron's renderer process.
│   │   ├── components/ - React.js components.
│   │   ├── css/ - Stylesheets.
│   │   ├── js/ - Helper JavaScript modules.
│   │   └── webview/ - Injection code for Electron's <webview> tag.
│   ├── common/ - Common JavaScript modules for both Electron's processes.
│   ├── main/ - Implemtation of Electron's main process.
│   │   └── menus/ - Application menu.
│   └── resources/ - Resources which are loaded from the application codes.
└── test/ - Automated tests.
    ├── modules/ - Scripts which are commonly used in tests.
    └── specs/ - Test scripts.
```

### Other directories
- **dist/** - Built application code and asset.
- **node_modules/** - Third party Node.js modules to build the application.
- **release/** - Packaged distributable applications.
- **src/node_modules/** - Third party Node.js modules to use in the application.
