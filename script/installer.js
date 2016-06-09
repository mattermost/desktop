#!/usr/bin/env node

const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const rimraf = require('rimraf')

deleteOutputFolder()
  .then(getInstallerConfig)
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig() {
  const rootPath = path.join(__dirname, '..')
  const outPath = path.join(rootPath, 'release')

  return Promise.resolve({
    appDirectory: path.join(outPath, 'Mattermost-win32-x64'),
    iconUrl: 'https://raw.githubusercontent.com/mattermost/desktop/master/resources/icon.ico',
    //loadingGif: path.join(rootPath, 'assets', 'img', 'loading.gif'),
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    setupExe: 'mattermost-setup.exe',
    setupIcon: path.join(rootPath, 'resources', 'icon.ico'),
    skipUpdateIcon: true,
    exe: 'Mattermost.exe'
  })
}

function deleteOutputFolder() {
  return new Promise((resolve, reject) => {
    rimraf(path.join(__dirname, '..', 'out', 'windows-installer'), (error) => {
      error ? reject(error) : resolve()
    })
  })
}
