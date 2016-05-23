'use strict';

const {
  app,
  Menu,
  MenuItem
} = require('electron');

function createDefault(mainWindow) {
  return Menu.buildFromTemplate([{
    label: `Open ${app.getName()}`,
    click: () => {
      mainWindow.show();
    }
  }, {
    type: 'separator'
  }, {
    label: 'Quit',
    click: function(item) {
      app.quit();
    }
  }]);
}

module.exports = {
  createDefault: createDefault
};
