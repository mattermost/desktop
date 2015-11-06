'use strict';

var remote = require('remote');
var Menu = remote.require('menu');
var MenuItem = remote.require('menu-item');

var createDefault = function() {
  var menu = new Menu();
  menu.append(new MenuItem({
    label: 'Cut',
    role: 'cut'
  }));
  menu.append(new MenuItem({
    label: 'Copy',
    role: 'copy'
  }));
  menu.append(new MenuItem({
    label: 'Paste',
    role: 'paste'
  }));
  menu.append(new MenuItem({
    label: 'Select All',
    role: 'selectall'
  }));
  return menu;
}

module.exports = {
  createDefault: createDefault
};
