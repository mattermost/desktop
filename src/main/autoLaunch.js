const AutoLaunch = require('auto-launch');

async function upgradeAutoLaunch() {
  if (process.platform === 'darwin') {
    return;
  }
  const appLauncher = new AutoLaunch({
    name: 'Mattermost',
    isHidden: true
  });
  const enabled = await appLauncher.isEnabled();
  if (enabled) {
    await appLauncher.enable();
  }
}

module.exports = {upgradeAutoLaunch};
