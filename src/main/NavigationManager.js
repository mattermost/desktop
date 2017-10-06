const {app, dialog} = require('electron');
const utils = require('../common/utils');

class NavigationManager {
  constructor() {
    this.allowedOrigin = [];
    this.parentWindow = null;
  }

  setWindowToPrompt(win) {
    this.parentWindow = win;
  }

  allowOrigin(origin) {
    if (this.allowedOrigin.indexOf(origin) === -1) {
      this.allowedOrigin.push(origin);
    }
  }

  onWillNavigate(event, url) {
    const origin = utils.getOrigin(url);
    if (this.allowedOrigin.indexOf(origin) > -1) {
      return;
    }
    const Yes = 'Yes';
    const No = 'No';
    const buttons = [No, Yes];
    const result = dialog.showMessageBox(this.parentWindow, {
      type: 'warning',
      title: `${app.getName()}`,
      message: `The application is navigating to "${origin}". Do you want to continue?`,
      buttons,
      defaultId: buttons.indexOf(No),
      cancelId: buttons.indexOf(No)
    });
    if (result === buttons.indexOf(Yes)) {
      this.allowedOrigin.push(origin);
    } else {
      event.preventDefault();
    }
  }
}

module.exports = NavigationManager;
