const {app, BrowserWindow, ipcMain} = require('electron');

function setEvent(win, eventName) {
  ipcMain.on(eventName, (event) => {
    if (event.sender === win.webContents) {
      win.emit(eventName);
    }
  });
}

function createUpdaterWindow(options) {
  const windowWidth = 480;
  const windowHeight = 240;
  const windowOptions = {
    title: `${app.getName()} Updater`,
    maximizable: false,
    show: false,
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    autoHideMenuBar: true
  };
  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }

  const win = new BrowserWindow(windowOptions);
  win.once('ready-to-show', () => {
    win.show();
  });
  const updaterURL = (global.isDev ? 'http://localhost:8080' : `file://${app.getAppPath()}`) + '/browser/updater.html';
  win.loadURL(updaterURL);

  setEvent(win, 'click-release-notes');
  setEvent(win, 'click-skip');
  setEvent(win, 'click-remind');
  setEvent(win, 'click-install');

  return win;
}

module.exports = {
  createUpdaterWindow
};
