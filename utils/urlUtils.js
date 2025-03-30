const path = require('path');

function normalizeUrl(req, relativePath, isDirectory = false) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    // Add trailing slash for directories if not present
    const dirPath = isDirectory && !normalizedPath.endsWith('/') ? 
        normalizedPath + '/' : normalizedPath;
        
    return {
        uri: `/gdl/api/files/${dirPath}`,
        url: `${baseUrl}/gdl/api/files/${dirPath}`
    };
}

module.exports = { normalizeUrl };