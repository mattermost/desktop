import deepmerge from 'deepmerge';

export default function deepMergeProxy(x, y, options) {
  return deepmerge(x, y, options); // due to webpack conversion
}
