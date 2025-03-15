function normalizePath(pathStr) {
  return pathStr.replace(/\\/g, '/');
}

function normalizeAndEncodePath(pathStr) {
  return encodeURIComponent(pathStr.replace(/\\/g, '/'));
}

module.exports = {
  normalizePath,
  normalizeAndEncodePath
};