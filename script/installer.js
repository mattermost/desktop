#!/usr/bin/env node

const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const rimraf = require('rimraf')

const archList = ['ia32', 'x64'];
archList.forEach((arch) => {
  deleteOutputFolder(arch)
    .then(getInstallerConfig)
    .then(createWindowsInstaller)
    .catch((error) => {
      console.error(error.message || error)
      process.exit(1)
    })
})

function getInstallerConfig(arch) {
  const rootPath = path.join(__dirname, '..')
  const outPath = path.join(rootPath, 'release')

  return Promise.resolve({
    appDirectory: path.join(outPath, `Mattermost-win32-${arch}`),
    authors: 'Mattermost, Inc.',
    owners: 'Mattermost, Inc.',
    iconUrl: 'https://raw.githubusercontent.com/mattermost/desktop/master/resources/icon.ico',
    //loadingGif: path.join(rootPath, 'assets', 'img', 'loading.gif'),
    noMsi: true,
    outputDirectory: path.join(outPath, `windows-installer-${arch}`),
    setupExe: `mattermost-setup-${arch}.exe`,
    setupIcon: path.join(rootPath, 'resources', 'icon.ico'),
    skipUpdateIcon: true,
    exe: 'Mattermost.exe'
  })
}

function deleteOutputFolder(arch) {
  return new Promise((resolve, reject) => {
    rimraf(path.join(__dirname, '..', 'out', `windows-installer-${arch}`), (error) => {
      error ? reject(error) : resolve(arch)
    })
  })
}
