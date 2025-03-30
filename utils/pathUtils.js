/**
 * Utilities for path and string normalization
 */
const path = require('path');

/**
 * Normalizes a string by trimming and using Unicode normalization
 */
const normalizeString = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().normalize('NFC');
};

/**
 * Normalizes a path by converting backslashes and cleaning up slashes
 */
const normalizePath = (pathStr) => {
    if (typeof pathStr !== 'string') return '';
    return pathStr
        .replace(/\\/g, '/')    // Convert Windows backslashes
        .replace(/\/+/g, '/')   // Replace multiple slashes
        .trim();
};

/**
 * Normalizes and encodes a path for URL usage
 */
const normalizeAndEncodePath = (pathStr) => {
    if (typeof pathStr !== 'string') return '';
    const normalized = normalizePath(pathStr);
    return normalized.split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
};

module.exports = {
    normalizeString,
    normalizePath,
    normalizeAndEncodePath
};