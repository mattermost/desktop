/* eslint-disable no-process-exit */

const {spawn} = require('child_process');
const {path7za} = require('7zip-bin');

spawn(path7za, process.argv.slice(2), {
  stdio: 'inherit'
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
}).on('close', (code) => {
  process.exit(code);
});
