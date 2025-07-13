const path = require('path');
const debug = require('debug')('gdl-api:utils:path');
const normalizeString = (str) => {
  if (typeof str !== 'string') return '';
  debug('Normalized string:', str)
  return str.trim().normalize('NFC');
};
const normalizePath = (pathStr) => {
  if (typeof pathStr !== 'string') return '';
  return pathStr
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim();
};
const normalizeAndEncodePath = (pathStr) => {
  if (typeof pathStr !== 'string') return '';
  const normalized = normalizePath(pathStr);
  debug('Normalized path:', normalized)
  return normalized.split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
};
const isSubPath = (childPath, parentPath) => {
  const normalizedChild = path.resolve(childPath).replace(/\\/g, '/');
  const normalizedParent = path.resolve(parentPath).replace(/\\/g, '/');
  const normalizedParentWithSlash = normalizedParent.endsWith('/') ? normalizedParent : normalizedParent + '/';
  return normalizedChild.startsWith(normalizedParentWithSlash) || normalizedChild === normalizedParent;
};
module.exports = {
  normalizeString,
  normalizePath,
  normalizeAndEncodePath,
  isSubPath
};