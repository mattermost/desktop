'use strict';

const electron = require('electron');
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;

var createDefault = function() {
  var menu = new Menu();
  menu.append(new MenuItem({
    label: 'Quit',
    click: function(item) {
      require('app').quit();
    }
  }));
  return menu;
}

module.exports = {
  createDefault: createDefault
};
