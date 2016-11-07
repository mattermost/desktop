'use strict';

const {
  app,
  Menu
} = require('electron');

function createTemplate(mainWindow, config) {
  var template = [
    ...config.teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        click: () => {
          showOrRestore(mainWindow);
          mainWindow.webContents.send('switch-tab', i);

          if (process.platform === 'darwin') {
            app.dock.show();
            mainWindow.focus();
          }
        }
      };
    }), {
      type: 'separator'
    }, {
      label: process.platform === 'darwin' ? 'Preferences...' : 'Settings',
      click: () => {
        mainWindow.loadURL('file://' + __dirname + '/browser/settings.html');
        showOrRestore(mainWindow);

        if (process.platform === 'darwin') {
          app.dock.show();
          mainWindow.focus();
        }
      }
    }, {
      type: 'separator'
    }, {
      role: 'quit'
    }
  ];
  return template;
}

function createMenu(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config));
}

function showOrRestore(window) {
  if (window.isMinimized()) {
    window.restore();
  } else {
    window.show();
  }
}

module.exports = {
  createMenu
};
