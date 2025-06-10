const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:files');
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

async function loadBlockedDirPatterns(permission = 'default') {
  if (permission === 'admin') {
    // Admin: use admin blocklist if it exists
    const adminBlockedPath = path.join(__dirname, '../blocked/admin/directories.txt');
    try {
      const data = await fs.readFile(adminBlockedPath, 'utf8');
      return data.split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(pattern => new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, m => m === '*' ? '.*' : `\\${m}`), 'i'));
    } catch {
      return [];
    }
  } else if (permission === 'all') {
    // All: no blocklist
    return [];
  } else {
    // Default: use main blocklist
    try {
      const data = await fs.readFile('utf8');
      return data.split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(pattern => new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, m => m === '*' ? '.*' : `\\${m}`), 'i'));
    } catch {
      return [];
    }
  }
}

async function isBlockedDirectory(dirName, permission = 'default') {
  const patterns = await loadBlockedDirPatterns(permission);
  return patterns.some(re => re.test(dirName));
}

function hasAllowedExtension(filePath, permission = 'default') {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase();

  // All permission can access any extension
  if (permission === 'all') return true;

  // Admin can access any extension except those in DISALLOWED_EXTENSIONS
  if (permission === 'admin') {
    return !DISALLOWED_EXTENSIONS?.some(pattern => {
      if (pattern.startsWith('*.')) return ext === pattern.slice(1);
      return ext === pattern;
    });
  }

  // Default users and non-authenticated users must follow both ALLOWED_EXTENSIONS and DISALLOWED_EXTENSIONS
  // If ALLOWED_EXTENSIONS is not defined or includes '*', all extensions are allowed except those in DISALLOWED_EXTENSIONS
  const isDisallowed = DISALLOWED_EXTENSIONS?.some(pattern => {
    if (pattern.startsWith('*.')) return ext === pattern.slice(1);
    return ext === pattern;
  });

  return !isDisallowed;
}

// Defensive: ensure DISALLOWED_DIRS and DISALLOWED_FILES are always arrays
const safeDisallowedDirs = Array.isArray(DISALLOWED_DIRS) ? DISALLOWED_DIRS : [];
const safeDisallowedFiles = Array.isArray(DISALLOWED_FILES) ? DISALLOWED_FILES : [];

async function isExcluded(dirName, permission = 'visitor', isRoot = false) {
  if (!dirName) return true;

  // Normalize for robust matching
  const normalizeForDir = s => normalizeString(s).replace(/^\.*|\.*$|^\/|\/$/g, '').toLowerCase();
  const normalizedName = normalizeForDir(dirName);

  // All permission can access everything
  if (permission === 'all') return false;

  // Check disallowed directories from .env for all users
  const segments = normalizedName.split(/[\\/]/);
  if (safeDisallowedDirs.some(pattern => {
      const normalizedPattern = normalizeForDir(pattern);
      return isRoot ?
        normalizedName === normalizedPattern :
        segments.includes(normalizedPattern);
    })) return true;

  // Check permission-specific blocked directories
  if (permission === 'admin') {
    // Admin: check admin-specific blocked directories
    if (await isBlockedDirectory(dirName, 'admin')) return true;
  } else {
    // Default/visitor: check default blocked directories
    if (await isBlockedDirectory(dirName, 'default')) return true;
  }

  // Check disallowed files from .env for all users
  if (safeDisallowedFiles.some(pattern => {
      if (pattern.startsWith('*.')) {
        return normalizedName.endsWith(pattern.slice(1));
      }
      return normalizedName === pattern.toLowerCase() || normalizedName.includes(pattern.toLowerCase());
    })) return true;

  return false;
}

function isFileExcluded(fileName, permission = 'visitor') {
  // All permission can access everything
  if (permission === 'all') return false;

  if (!fileName) return true;

  // Check disallowed files from .env for all users
  const normalized = normalizeString(fileName).toLowerCase();
  if (safeDisallowedFiles.some(pattern => {
      if (pattern.startsWith('*.')) {
        return normalized.endsWith(pattern.slice(1));
      }
      return normalized === pattern.toLowerCase() || normalized.includes(pattern.toLowerCase());
    })) return true;

  // For admin, only check .env disallowed files
  if (permission === 'admin') return false;

  // For others, check excluded files list
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
    debug(`Error reading directory ${dirPath}:`, error);
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

    // Process entries in batches
    for (let i = 0; i < entries.length; i) {
      const batch = entries.slice(i, i);
      const batchPromises = batch.map(async entry => {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);

        // Check if entry should be excluded based on permissions
        if (await isExcluded(relPath, isAuthenticated, permission)) {
          return null;
        }

        try {
          const stats = await fs.stat(fullPath);
          if (entry.isDirectory()) {
            // For directories, check permission-based access
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

  // Check each directory segment against exclusion patterns
  for (const segment of segments) {
    const normalizedSegment = normalizeString(segment);

    // Check against each exclusion pattern
    for (const pattern of DISALLOWED_DIRS) {
      const normalizedPattern = pattern.toLowerCase().trim();

      // Handle wildcard patterns
      if (normalizedPattern.includes('*')) {
        // Convert glob pattern to regex pattern
        const regexPattern = normalizedPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
          .replace(/\*/g, '.*'); // Convert * to regex .*

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
      // Handle exact matches and includes
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
  isPathExcluded,
  isBlockedDirectory
};