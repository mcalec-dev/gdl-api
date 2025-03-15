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

function isExcluded(dirName) {
  const excludedDirs = EXCLUDED_DIRS.map(dir => dir.trim()).filter(Boolean);
  
  const isExcluded = excludedDirs.some(excludedDir => {
    if (excludedDir.includes('*')) {
      const regex = new RegExp('^' + excludedDir.replace(/\*/g, '.*') + '$', 'i');
      const matches = regex.test(dirName);
      if (matches) {
        debug(`Directory "${dirName}" excluded by pattern "${excludedDir}"`);
      }
      return matches;
    }
    const matches = dirName.toLowerCase() === excludedDir.toLowerCase();
    if (matches) {
      debug(`Directory "${dirName}" excluded by exact match "${excludedDir}"`);
    }
    return matches;
  });

  return isExcluded;
}

function hasAllowedExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function isFileExcluded(fileName) {
  return EXCLUDED_FILES.some(excludedFile => {
    if (excludedFile.includes('*')) {
      const pattern = new RegExp('^' + excludedFile.replace(/\*/g, '.*') + '$');
      return pattern.test(fileName);
    }
    return fileName === excludedFile;
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

async function getAllDirectoriesAndFiles(dirPath, relativePath = '', depth = 0) {
  const cacheKey = `dir-files-${dirPath}-${depth}`;
  const cached = fsCache.get(cacheKey);
  if (cached) return cached;

  if (depth >= MAX_DEPTH) return [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const dirs = entries.filter(entry => entry.isDirectory() && !isExcluded(entry.name));
    const files = entries.filter(entry => entry.isFile() && hasAllowedExtension(entry.name) && !isFileExcluded(entry.name));
    
    let results = dirs.map(dir => {
      const dirRelativePath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
      return {
        type: 'directory',
        name: dir.name,
        path: dirRelativePath,
        fullPath: path.join(dirPath, dir.name)
      };
    });
    
    results = results.concat(files.map(file => {
      const fileRelativePath = relativePath ? `${relativePath}/${file.name}` : file.name;
      return {
        type: 'file',
        name: file.name,
        path: fileRelativePath,
        fullPath: path.join(dirPath, file.name)
      };
    }));
    
    for (const dir of dirs) {
      const subDirsAndFiles = await getAllDirectoriesAndFiles(path.join(dirPath, dir.name), `${relativePath}/${dir.name}`, depth + 1);
      results = results.concat(subDirsAndFiles);
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

module.exports = {
  safeReadJson,
  isExcluded,
  hasAllowedExtension,
  isFileExcluded,
  getAllDirectories,
  getAllDirectoriesAndFiles,
  getCollections
};