'use strict';

const spawnSync = require('child_process').spawnSync;

const path7za = require('7zip-bin').path7za;

const pkg = require('../src/package.json');
const appVersion = pkg.version;
const productName = pkg.productName;

function renameInZip(zipPath, oldName, newName) {
  const result = spawnSync(path7za, ['rn', zipPath, oldName, newName]);
  return result.status === 0;
}

console.log('Manipulating 64-bit zip...');
if (!renameInZip(`release/${productName}-${appVersion}-win.zip`, 'win-unpacked', `${productName}-${appVersion}-win64`)) {
  throw new Error('7za returned non-zero exit code for 64-bit zip');
}

console.log('Manipulating 32-bit zip...');
if (!renameInZip(`release/${productName}-${appVersion}-ia32-win.zip`, 'win-ia32-unpacked', `${productName}-${appVersion}-win32`)) {
  throw new Error('7za returned non-zero exit code for 32-bit zip');
}
