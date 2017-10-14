const REGEXP_DOMAIN = /(?:[^/]*\/){3}/;

export function getDomain(url) {
  const matched = url.match(REGEXP_DOMAIN);
  return matched ? matched[0] : null;
}
