const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const electron = require('electron');
const {app, dialog} = electron;

function downloadURL(browserWindow, URL, callback) {
  const {net} = electron;
  const request = net.request(URL);
  request.setHeader('Accept-Encoding', 'gzip,deflate');
  request.on('response', (response) => {
    const file = getAttachmentName(response.headers);
    const dialogOptions = {
      defaultPath: path.join(app.getPath('downloads'), file),
    };
    dialog.showSaveDialog(browserWindow, dialogOptions, (filename) => {
      if (filename) {
        saveResponseBody(response, filename, callback);
      }
    });
  }).on('error', callback);
  request.end();
}

function getAttachmentName(headers) {
  if (headers['content-disposition']) {
    const contentDisposition = headers['content-disposition'][0];
    const matched = contentDisposition.match(/filename="(.*)"/);
    if (matched) {
      return path.basename(matched[1]);
    }
  }
  return '';
}

function saveResponseBody(response, filename, callback) {
  const output = fs.createWriteStream(filename);
  output.on('close', callback);
  switch (response.headers['content-encoding']) {
  case 'gzip':
    response.pipe(zlib.createGunzip()).pipe(output).on('error', callback);
    break;
  case 'deflate':
    response.pipe(zlib.createInflate()).pipe(output).on('error', callback);
    break;
  default:
    response.pipe(output).on('error', callback);
    break;
  }
}

module.exports = downloadURL;
