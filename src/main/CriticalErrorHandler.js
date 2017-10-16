const {app, dialog, shell} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createErrorReport(err) {
  return `Application: ${app.getName()} ${app.getVersion()}\n` +
         `Platform: ${os.type()} ${os.release()} ${os.arch()}\n` +
         `${err.stack}`;
}

function bindWindowToShowMessageBox(win) {
  if (win && win.isVisible()) {
    return dialog.showMessageBox.bind(null, win);
  }
  return dialog.showMessageBox;
}

class CriticalErrorHandler {
  constructor() {
    this.mainWindow = null;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  windowUnresponsiveHandler() {
    const result = dialog.showMessageBox(this.mainWindow, {
      type: 'warning',
      title: `Unresponsive - ${app.getName()}`,
      message: 'The window is no longer responsive.\nDo you wait until the window becomes responsive again?',
      buttons: ['No', 'Yes'],
      defaultId: 0
    });
    if (result === 0) {
      throw new Error('BrowserWindow \'unresponsive\' event has been emitted');
    }
  }

  processUncaughtExceptionHandler(err) {
    const file = path.join(app.getPath('userData'), `uncaughtException-${Date.now()}.txt`);
    const report = createErrorReport(err);
    fs.writeFileSync(file, report.replace(new RegExp('\\n', 'g'), os.EOL));
    fs.writeSync(2, `See "${file}" to report the problem.\n`);

    if (app.isReady()) {
      const showMessageBox = bindWindowToShowMessageBox(this.mainWindow);
      const result = showMessageBox({
        type: 'error',
        title: `Error - ${app.getName()}`,
        message: `An internal error has occurred: ${err.message}\nThe application will quit.`,
        buttons: ['OK', 'Show detail'],
        defaultId: 0
      });
      if (result === 1) {
        shell.openExternal(file);
      }
    }
    throw err;
  }
}

module.exports = CriticalErrorHandler;
