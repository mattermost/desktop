/* eslint-disable no-process-exit */

const {spawn} = require('child_process');

const {path7za} = require('7zip-bin');

const cwd = process.argv[2];

spawn(path7za, ['e', '-y', '*.zip'], {
  cwd,
  stdio: 'inherit',
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
}).on('close', (code) => {
  process.exit(code);
});
