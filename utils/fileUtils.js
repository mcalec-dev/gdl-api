const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:utils:file');
const { normalizeString, normalizePath } = require('./pathUtils');
const { DISALLOWED_DIRS, DISALLOWED_FILES, DISALLOWED_EXTENSIONS, MAX_DEPTH } = require('../config');
async function safeReadJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    debug(`Error reading file ${filePath}:`, error);
    return null;
  }
}
function hasAllowedExtension(filePath, permission = 'default') {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (permission === 'all') return true;
  if (permission === 'admin') {
    return !DISALLOWED_EXTENSIONS?.some(pattern => {
      if (pattern.startsWith('*.')) return ext === pattern.slice(1);
      return ext === pattern;
    });
  }
  const isDisallowed = DISALLOWED_EXTENSIONS?.some(pattern => {
    if (pattern.startsWith('*.')) return ext === pattern.slice(1);
    return ext === pattern;
  });
  return !isDisallowed;
}
const safeDisallowedDirs = Array.isArray(DISALLOWED_DIRS) ? DISALLOWED_DIRS : [];
const safeDisallowedFiles = Array.isArray(DISALLOWED_FILES) ? DISALLOWED_FILES : [];
async function isExcluded(dirName, permission = 'visitor', isRoot = false) {
  if (!dirName) return true;
  const normalizeForDir = s => normalizeString(s).replace(/^\.*|\.*$|^\/|\/$/g, '').toLowerCase();
  const normalizedName = normalizeForDir(dirName);
  if (permission === 'all') return false;
  const segments = normalizedName.split(/[\\/]/);
  if (safeDisallowedDirs.some(pattern => {
      const normalizedPattern = normalizeForDir(pattern);
      return isRoot ?
        normalizedName === normalizedPattern :
        segments.includes(normalizedPattern);
    })) return true;
  if (safeDisallowedFiles.some(pattern => {
      if (pattern.startsWith('*.')) {
        return normalizedName.endsWith(pattern.slice(1));
      }
      return normalizedName === pattern.toLowerCase() || normalizedName.includes(pattern.toLowerCase());
    })) return true;
  return false;
}
function isFileExcluded(fileName, permission = 'visitor') {
  if (permission === 'all') return false;
  if (!fileName) return true;
  const normalized = normalizeString(fileName).toLowerCase();
  if (safeDisallowedFiles.some(pattern => {
      if (pattern.startsWith('*.')) {
        return normalized.endsWith(pattern.slice(1));
      }
      return normalized === pattern.toLowerCase() || normalized.includes(pattern.toLowerCase());
    })) return true;
  if (permission === 'admin') return false;
  return DISALLOWED_FILES.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(normalized);
    }
    return normalized.includes(pattern.toLowerCase());
  });
}
async function getAllDirectories(dirPath, relativePath = '', depth = 0, isAuthenticated = false) {
  if (depth >= MAX_DEPTH) return [];
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    const dirs = entries.filter(entry => entry.isDirectory() && !isExcluded(entry.name, isAuthenticated));
    let results = dirs.map(dir => {
      const dirRelativePath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
      return {
        name: dir.name,
        path: dirRelativePath,
        fullPath: path.join(dirPath, dir.name)
      };
    });
    for (const dir of results) {
      const subDirs = await getAllDirectories(dir.fullPath, dir.path, depth + 1, isAuthenticated);
      results = results.concat(subDirs);
    }
    return results;
  } catch (error) {
    debug('Error reading directory:', dirPath, error);
    return [];
  }
}
async function getAllDirectoriesAndFiles(dirPath, relativePath = '', depth = 0, topLevelOnly = false, isAuthenticated = false, permission = 'default') {
  if (depth >= MAX_DEPTH) return {
    items: [],
    total: 0
  };
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    const results = [];
    for (let i = 0; i < entries.length; i) {
      const batch = entries.slice(i, i);
      const batchPromises = batch.map(async entry => {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        if (await isExcluded(relPath, isAuthenticated, permission)) {
          return null;
        }
        try {
          const stats = await fs.stat(fullPath);
          if (entry.isDirectory()) {
            if (!topLevelOnly) {
              const subDirContents = await getAllDirectoriesAndFiles(
                fullPath,
                relPath,
                depth + 1,
                false,
                isAuthenticated,
                permission
              );
              if (subDirContents.items.length > 0) {
                return {
                  type: 'directory',
                  fullPath,
                  name: entry.name,
                  size: 0,
                  modified: stats.mtime,
                  contents: subDirContents.items
                };
              }
              return null;
            }
            return {
              type: 'directory',
              fullPath,
              name: entry.name,
              size: 0,
              modified: stats.mtime
            };
          } else if (!topLevelOnly && hasAllowedExtension(entry.name, isAuthenticated, permission)) {
            return {
              type: 'file',
              fullPath,
              name: entry.name,
              size: stats.size,
              modified: stats.mtime
            };
          }
        } catch (error) {
          debug('Error processing entry:', {
            entry: entry.name,
            error: error.message
          });
          return null;
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));
    }
    const sortedResults = results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return {
      items: sortedResults,
      total: sortedResults.length
    };
  } catch (error) {
    debug('Error scanning directory:', {
      dirPath,
      relativePath,
      error: error.message
    });
    return {
      items: [],
      total: 0
    };
  }
}
async function getCollections(basePath) {
  try {
    const dirs = await fs.readdir(basePath, {
      withFileTypes: true
    });
    return dirs
      .filter(dirent => dirent.isDirectory() && !isExcluded(dirent.name))
      .map(dirent => dirent.name)
      .sort();
  } catch (error) {
    debug('Error reading collections directory:', error);
    throw error;
  }
}
function isPathExcluded(pathStr) {
  if (!pathStr) return true;
  const normalizedPath = normalizePath(pathStr).toLowerCase();
  const segments = normalizedPath.split('/').filter(Boolean);
  for (const segment of segments) {
    const normalizedSegment = normalizeString(segment);
    for (const pattern of DISALLOWED_DIRS) {
      const normalizedPattern = pattern.toLowerCase().trim();
      if (normalizedPattern.includes('*')) {
        const regexPattern = normalizedPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(normalizedSegment)) {
          debug('Path excluded due to wildcard match:', {
            segment,
            pattern: normalizedPattern,
            fullPath: pathStr
          });
          return true;
        }
      }
      else if (
        normalizedSegment === normalizedPattern ||
        normalizedSegment.includes(normalizedPattern)
      ) {
        debug('Path excluded due to exact/partial match:', {
          segment,
          pattern: normalizedPattern,
          fullPath: pathStr
        });
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  safeReadJson,
  isExcluded,
  hasAllowedExtension,
  isFileExcluded,
  getAllDirectories,
  getAllDirectoriesAndFiles,
  getCollections,
  isPathExcluded
};