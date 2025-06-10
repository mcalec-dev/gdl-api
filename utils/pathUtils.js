const path = require('path');

const normalizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().normalize('NFC');
};


const normalizePath = (pathStr) => {
  if (typeof pathStr !== 'string') return '';
  return pathStr
    .replace(/\\/g, '/') // Convert Windows backslashes
    .replace(/\/+/g, '/') // Replace multiple slashes
    .trim();
};

const normalizeAndEncodePath = (pathStr) => {
  if (typeof pathStr !== 'string') return '';
  const normalized = normalizePath(pathStr);
  return normalized.split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
};

const isSubPath = (childPath, parentPath) => {
  // Normalize both paths to use forward slashes and resolve any '..' or '.' segments
  const normalizedChild = path.resolve(childPath).replace(/\\/g, '/');
  const normalizedParent = path.resolve(parentPath).replace(/\\/g, '/');

  // Ensure parent path ends with a slash so we don't match partial directory names
  const normalizedParentWithSlash = normalizedParent.endsWith('/') ?
    normalizedParent :
    normalizedParent + '/';

  return normalizedChild.startsWith(normalizedParentWithSlash) || normalizedChild === normalizedParent;
};

module.exports = {
  normalizeString,
  normalizePath,
  normalizeAndEncodePath,
  isSubPath
};