const url = require('url');

function getDomain(inputURL) {
  const parsedURL = url.parse(inputURL);
  return `${parsedURL.protocol}//${parsedURL.host}`;
}

module.exports = {getDomain};
