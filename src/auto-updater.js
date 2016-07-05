const app = require('electron').app
const autoUpdater = require('electron').autoUpdater
const Menu = require('electron').Menu
const GhReleases = require('electron-gh-releases')

var state = 'checking'

let options = {
  repo: 'mattermost/desktop',
  currentVersion: app.getVersion()
}

const updater = new GhReleases(options)

exports.initialize = function() {
  if (process.mas) return

  // When an update has been downloaded
  updater.on('update-downloaded', (info) => {
    setStateAndUpdate('installed')
  })

  exports.checkForUpdates();
}

exports.checkForUpdates = function() {
  // Check for updates
  // `status` returns true if there is a new update available
  updater.check((err, status) => {
    if (!err && status) {
      setStateAndUpdate('checking')
        // Download the update
      updater.download()
    }
    else {
      setStateAndUpdate('no-update')
    }
  })
}

exports.quitAndInstall = function() {
  // Restart the app and install the update
  if (state === 'installed')
    updater.install()
}

function setStateAndUpdate(newState) {
  state = newState
  updateMenu()
}

function updateMenu() {
  if (process.mas) return

  var menu = Menu.getApplicationMenu()
  if (!menu) return

  menu.items.forEach(function(item) {
    if (item.submenu) {
      item.submenu.items.forEach(function(item) {
        switch (item.key) {
          case 'checkForUpdate':
            item.visible = state === 'no-update'
            break
          case 'checkingForUpdate':
            item.visible = state === 'checking'
            break
          case 'restartToUpdate':
            item.visible = state === 'installed'
            break
        }
      })
    }
  })
}
