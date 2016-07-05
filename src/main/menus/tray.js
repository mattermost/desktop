'use strict';

const {
  app,
  Menu,
  MenuItem
} = require('electron');

function createTemplate(mainWindow, config) {
  var template = [
    ...config.teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click: (item, focusedWindow) => {
          mainWindow.show(); // for OS X
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
      label: 'Quit',
      click: function(item) {
        app.quit();
      }
    }
  ];
  return template;
}

var createMenu = function(mainWindow, config) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config));
};

module.exports = {
  createMenu: createMenu
};
