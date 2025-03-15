const fs = require('fs').promises;
const path = require('path');
const { EXCLUDED_DIRS, EXCLUDED_FILES, ALLOWED_EXTENSIONS, MAX_DEPTH } = require('../config');
const { fsCache } = require('./cacheUtils');

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
  return EXCLUDED_DIRS.some(excludedDir => {
    if (excludedDir.includes('*')) {
      const pattern = new RegExp('^' + excludedDir.replace(/\*/g, '.*') + '$');
      return pattern.test(dirName);
    }
    return dirName === excludedDir;
  }) || dirName.toLowerCase() === 'pinterest';
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

module.exports = {
  safeReadJson,
  isExcluded,
  hasAllowedExtension,
  isFileExcluded,
  getAllDirectories,
  getAllDirectoriesAndFiles
};