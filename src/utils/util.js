const {URL} = require('url');

export function getDomain(url) {
  try {
    const objectUrl = new URL(url);
    return objectUrl.origin;
  } catch (e) {
    return null;
  }
}
