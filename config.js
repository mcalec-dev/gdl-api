const dotenv = require('dotenv');
const debug = require('debug')('gdl-api:exclusions');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3030;
const BASE_PATH = process.env.BASE_PATH || '/gdl';
const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR || '/path/to/your/gallery-dl/downloads';
const YT_DLP_DIR = process.env.YT_DLP_DIR || 'G:/yt-dlp/downloads';

if (!GALLERY_DL_DIR) {
  console.error('ERROR: GALLERY_DL_DIR environment variable is not set');
  process.exit(1);
}

if (!YT_DLP_DIR) {
  console.error('ERROR: YT_DLP_DIR environment variable is not set');
  process.exit(1);
}

// Parse the JSON arrays from environment variables
function parseEnvArray(envVar, defaultValue = []) {
  try {
    // Remove any whitespace and ensure proper JSON format
    const cleaned = envVar ? envVar.trim().replace(/\n\s*/g, '') : '[]';
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(`Error parsing environment variable: ${error.message}`);
    return defaultValue;
  }
}

// Parse exclusion lists
const EXCLUDED_DIRS = parseEnvArray(process.env.EXCLUDED_DIRS, []);
const EXCLUDED_FILES = parseEnvArray(process.env.EXCLUDED_FILES, []);
const ALLOWED_EXTENSIONS = parseEnvArray(process.env.ALLOWED_EXTENSIONS, []);

const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '10', 10);

// Add rate limit configuration
const RATE_LIMIT = {
  windowMs: (process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100, 10)
};

// Add YT-DLP specific configurations
const YT_DLP_ALLOWED_DIRS = ['video', 'audio', 'subtitle'];
const YT_DLP_ALLOWED_EXTENSIONS = {
  video: ['.mp4', '.webm', '.mkv', '.avi'],
  audio: ['.mp3', '.m4a', '.ogg', '.wav'],
  subtitle: ['.srt', '.vtt', '.ass']
};

// Log parsed exclusion patterns
debug('Excluded directories:', EXCLUDED_DIRS);
debug('Excluded files:', EXCLUDED_FILES);
debug('Allowed extensions:', ALLOWED_EXTENSIONS);

module.exports = {
  PORT,
  BASE_PATH,
  GALLERY_DL_DIR,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  ALLOWED_EXTENSIONS,
  MAX_DEPTH,
  RATE_LIMIT,
  debug,
  YT_DLP_DIR,
  YT_DLP_ALLOWED_DIRS,
  YT_DLP_ALLOWED_EXTENSIONS
};