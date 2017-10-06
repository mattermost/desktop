const url = require('url');

function getOrigin(URL) {
  const obj = url.parse(URL);
  return `${obj.protocol}//${obj.host}`;
}

module.exports = {
  getOrigin
};
