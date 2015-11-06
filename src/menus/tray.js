'use strict';

var Menu = require('menu');
var MenuItem = require('menu-item');

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
