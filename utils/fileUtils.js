const path = require('path');
const fs = require('fs').promises;
const debug = require('debug')('gdl-api:files');
const { fsCache } = require('./cacheUtils');
const { normalizeString, normalizePath } = require('./pathUtils');
const { 
    EXCLUDED_DIRS, 
    EXCLUDED_FILES, 
    MAX_DEPTH, 
    ALLOWED_EXTENSIONS, 
    PAGE_SIZE 
} = require('../config');

async function safeReadJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

function hasAllowedExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

function isExcluded(dirName) {
    if (!dirName) return true;
    
    const normalizedName = normalizeString(dirName).toLowerCase();
    return EXCLUDED_DIRS.some(pattern => {
        const normalizedPattern = pattern.toLowerCase().trim();
        return normalizedName === normalizedPattern || 
               normalizedName.includes(normalizedPattern);
    });
}

function isFileExcluded(fileName) {
    if (!fileName) return true;
    
    const normalized = normalizeString(fileName).toLowerCase();
    return EXCLUDED_FILES.some(pattern => {
        if (pattern instanceof RegExp) {
            return pattern.test(normalized);
        }
        return normalized.includes(pattern.toLowerCase());
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

async function getAllDirectoriesAndFiles(dirPath, relativePath = '', depth = 0, topLevelOnly = false, page = 1) {
    if (depth >= MAX_DEPTH) {
        debug('Max depth reached:', depth);
        return { items: [], total: 0 };
    }

    try {
        // Early return if the current path is excluded
        if (isPathExcluded(dirPath)) {
            debug('Path excluded:', dirPath);
            return { items: [], total: 0 };
        }

        // Generate a cache key based on the parameters
        const cacheKey = `dir:${dirPath}:${relativePath}:${depth}:${topLevelOnly}:${page}`;
        
        // Check cache first
        const cached = fsCache.get(cacheKey);
        if (cached) {
            debug('Returning cached results for:', cacheKey);
            return cached;
        }

        const results = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryName = entry.name;
            const fullPath = path.join(dirPath, entryName);

            // Skip if the path or its parent directories are excluded
            if (isPathExcluded(fullPath)) {
                debug('Excluded entry:', fullPath);
                continue;
            }

            // Skip if the file itself is excluded
            if (isFileExcluded(entryName)) {
                debug('Excluded file:', entryName);
                continue;
            }

            const stats = await fs.stat(fullPath).catch(() => null);
            if (!stats) continue;

            if (entry.isDirectory()) {
                results.push({
                    type: 'directory',
                    fullPath,
                    name: entryName,
                    size: null,
                    modified: stats.mtime
                });
            } else if (!topLevelOnly && entry.isFile() && hasAllowedExtension(entryName)) {
                results.push({
                    type: 'file',
                    fullPath,
                    name: entryName,
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }

        // Sort results
        const sortedResults = results.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        // Handle pagination
        const startIndex = (page - 1) * PAGE_SIZE;
        const paginatedResults = sortedResults.slice(startIndex, startIndex + PAGE_SIZE);

        const response = {
            items: paginatedResults,
            total: sortedResults.length,
            totalPages: Math.ceil(sortedResults.length / PAGE_SIZE),
            currentPage: page
        };

        // Cache the results
        fsCache.set(cacheKey, response, 60); // Cache for 1 minute
        return response;

    } catch (error) {
        debug('Error scanning directory:', {
            error: error.message,
            code: error.code,
            dirPath
        });
        throw error;
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

function isPathExcluded(pathStr) {
    if (!pathStr) return true;
    
    const normalizedPath = normalizePath(pathStr).toLowerCase();
    const segments = normalizedPath.split('/').filter(Boolean);
    
    // Check each directory segment against exclusion patterns
    for (const segment of segments) {
        const normalizedSegment = normalizeString(segment);
        
        // Check against each exclusion pattern
        for (const pattern of EXCLUDED_DIRS) {
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
  isPathExcluded
};