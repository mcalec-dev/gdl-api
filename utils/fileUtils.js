const fs = require('fs').promises;
const path = require('path');
const { EXCLUDED_DIRS, EXCLUDED_FILES, ALLOWED_EXTENSIONS, MAX_DEPTH } = require('../config');
const { fsCache } = require('./cacheUtils');
const debug = require('debug')('gdl-api:fileUtils');

async function safeReadJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Update these functions
function isExcluded(dirName) {
  if (!dirName) return true;
  
  // Normalize path separators and trim
  const normalized = dirName.replace(/\\/g, '/').trim();
  
  return EXCLUDED_DIRS.some(pattern => {
    // Normalize pattern
    pattern = pattern.trim().replace(/\\/g, '/');
    
    if (pattern.includes('*')) {
      // Convert glob pattern to regex
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
      return regex.test(normalized);
    }
    
    return normalized.toLowerCase() === pattern.toLowerCase();
  });
}

function hasAllowedExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Update these functions
function isFileExcluded(fileName) {
  if (!fileName) return true;
  
  // Normalize and trim filename
  const normalized = fileName.replace(/\\/g, '/').trim();
  
  return EXCLUDED_FILES.some(pattern => {
    // Normalize pattern
    pattern = pattern.trim().replace(/\\/g, '/');
    
    if (pattern.includes('*')) {
      // Convert glob pattern to regex
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
      return regex.test(normalized);
    }
    
    return normalized.toLowerCase() === pattern.toLowerCase();
  });
}

async function getAllDirectories(dirPath, relativePath = '', depth = 0) {
  if (depth >= MAX_DEPTH) return [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const dirs = entries.filter(entry => entry.isDirectory() && !isExcluded(entry.name));
    
    let results = dirs.map(dir => {
      const dirRelativePath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
      return {
        name: dir.name,
        path: dirRelativePath,
        fullPath: path.join(dirPath, dir.name)
      };
    });
    
    for (const dir of results) {
      const subDirs = await getAllDirectories(dir.fullPath, dir.path, depth + 1);
      results = results.concat(subDirs);
    }
    
    return results;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

// Update the getAllDirectoriesAndFiles function
async function getAllDirectoriesAndFiles(dirPath, relativePath = '', depth = 0) {
  if (depth >= MAX_DEPTH) return [];

  const cacheKey = `dir-files-${dirPath}-${depth}`;
  const cached = fsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let results = [];

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      
      // Skip if path is excluded
      if (isPathExcluded(entryRelativePath)) {
        debug(`Excluded path: ${entryRelativePath}`);
        continue;
      }

      if (entry.isDirectory()) {
        if (!isExcluded(entry.name)) {
          const fullPath = path.join(dirPath, entry.name);
          results.push({
            type: 'directory',
            name: entry.name,
            path: entryRelativePath,
            fullPath: fullPath
          });

          // Recursively get contents
          const subItems = await getAllDirectoriesAndFiles(
            fullPath,
            entryRelativePath,
            depth + 1
          );
          results = results.concat(subItems);
        }
      } else if (entry.isFile()) {
        if (hasAllowedExtension(entry.name) && !isFileExcluded(entry.name)) {
          const fullPath = path.join(dirPath, entry.name);
          results.push({
            type: 'file',
            name: entry.name,
            path: entryRelativePath,
            fullPath: fullPath
          });
        }
      }
    }

    fsCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

async function getCollections(basePath) {
    try {
        const dirs = await fs.readdir(basePath, { withFileTypes: true });
        return dirs
            .filter(dirent => dirent.isDirectory() && !isExcluded(dirent.name))
            .map(dirent => dirent.name)
            .sort();
    } catch (error) {
        console.error('Error reading collections directory:', error);
        throw error;
    }
}

// Update the isPathExcluded function
function isPathExcluded(pathStr) {
  if (!pathStr) return true;

  // Normalize path
  const normalized = pathStr.replace(/\\/g, '/').trim();
  const parts = normalized.split('/').filter(Boolean);

  // Check each path component against exclusion rules
  return parts.some(part => {
    // Check directory exclusions
    if (isExcluded(part)) return true;

    // Check file exclusions
    if (isFileExcluded(part)) return true;

    return false;
  });
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