const dotenv = require('dotenv');
const debug = require('debug')('gdl-api:exclusions');
const path = require('path');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3030;
const BASE_PATH = process.env.BASE_PATH || '/gdl';
const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR || path.join(__dirname, 'downloads');
const YT_DLP_DIR = process.env.YT_DLP_DIR || 'G:/yt-dlp/downloads';

if (!GALLERY_DL_DIR) {
  console.error('ERROR: GALLERY_DL_DIR environment variable is not set');
  process.exit(1);
}

if (!YT_DLP_DIR) {
  console.error('ERROR: YT_DLP_DIR environment variable is not set');
  process.exit(1);
}

// Helper function to safely parse JSON strings from environment variables
const parseJsonEnv = (envVar, defaultValue = []) => {
  if (!envVar) return defaultValue;
  
  try {
    // Try to parse it as JSON
    return JSON.parse(envVar);
  } catch (err) {
    // If it fails, log an error and return the default
    console.error(`Error parsing environment variable: ${err.message}`);
    return defaultValue;
  }
};

// Parse exclusion lists
const EXCLUDED_DIRS = parseJsonEnv(process.env.EXCLUDED_DIRS, []);
const EXCLUDED_FILES = parseJsonEnv(process.env.EXCLUDED_FILES, []);
const ALLOWED_EXTENSIONS = parseJsonEnv(process.env.ALLOWED_EXTENSIONS, []);

const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '15', 10);

// Add rate limit configuration
const RATE_LIMIT = {
  windowMs: (process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 7500, 10)
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
  YT_DLP_ALLOWED_EXTENSIONS,
  PAGE_SIZE: parseInt(process.env.PAGE_SIZE) || 50
};