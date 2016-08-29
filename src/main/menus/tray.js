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
        click: (item, focusedWindow) => {
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
      label: process.platform !== 'darwin' ? 'Settings' : 'Preferences...',
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

var createMenu = function(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config));
};

function showOrRestore(window) {
  window.isMinimized() ? window.restore() : window.show();
}

module.exports = {
  createMenu: createMenu
};
