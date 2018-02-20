const AutoLaunch = require('auto-launch');
const {app} = require('electron');

function shouldQuitApp(cmd) {
  if (process.platform !== 'win32') {
    return false;
  }
  return ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'].includes(cmd);
}

async function setupAutoLaunch(cmd) {
  const appLauncher = new AutoLaunch({
    name: app.getName(),
    isHidden: true,
  });
  if (cmd === '--squirrel-uninstall') {
    // If we're uninstalling, make sure we also delete our auto launch registry key
    return appLauncher.disable();
  } else if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    // If we're updating and already have an registry entry for auto launch, make sure to update the path
    const enabled = await appLauncher.isEnabled();
    if (enabled) {
      return appLauncher.enable();
    }
  }
  return async () => true;
}

function squirrelStartup() {
  if (process.platform === 'win32') {
    const cmd = process.argv[1];
    setupAutoLaunch(cmd).then(() => {
      require('electron-squirrel-startup'); // eslint-disable-line global-require
    });
    return shouldQuitApp(cmd);
  }
  return false;
}

module.exports = squirrelStartup;
