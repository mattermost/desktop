const deepmerge = require('deepmerge');

function deepMergeProxy(x, y, options) {
  if (process.env.TEST) {
    return deepmerge(x, y, options);
  }
  return deepmerge.default(x, y, options); // due to webpack conversion
}

module.exports = deepMergeProxy;
