'use strict';

const remote = require('electron').remote;
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

var createDefault = function() {
  var menu = new Menu();
  menu.append(new MenuItem({
    role: 'cut'
  }));
  menu.append(new MenuItem({
    role: 'copy'
  }));
  menu.append(new MenuItem({
    role: 'paste'
  }));
  menu.append(new MenuItem({
    role: 'selectall'
  }));
  return menu;
};

module.exports = {
  createDefault: createDefault
};
