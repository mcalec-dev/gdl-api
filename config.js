const dotenv = require('dotenv');
const debug = require('debug')('gdl-api:config');
dotenv.config();
const parseJsonEnv = (envVar) => {
  try {
    return JSON.parse(envVar) || null;
  } catch (error) {
    debug(`Error parsing JSON from environment variable: ${error.message}`);
    return null;
  }
};
const NODE_ENV = process.env.NODE_ENV; 
debug('Node environment:', NODE_ENV);
const PORT = process.env.PORT; 
debug('Port:', PORT);
const BASE_PATH = process.env.BASE_PATH; 
debug('Base path:', BASE_PATH);
const HOST = process.env.NODE_ENV === 'production' ? process.env.HOST : process.env.ALT_HOST; 
debug('Host:', HOST);
const GALLERY_DL_DIR = process.env.GALLERY_DL_DIR; 
debug('Gallery-dl directory:', GALLERY_DL_DIR);
const DISALLOWED_DIRS = parseJsonEnv(process.env.DISALLOWED_DIRS); 
debug('Disallowed directories:', DISALLOWED_DIRS);
const DISALLOWED_FILES = parseJsonEnv(process.env.DISALLOWED_FILES); 
debug('Disallowed files:', DISALLOWED_FILES);
const DISALLOWED_EXTENSIONS = parseJsonEnv(process.env.DISALLOWED_EXTENSIONS);
debug('Disallowed extensions:', DISALLOWED_EXTENSIONS);
const MAX_DEPTH = process.env.MAX_DEPTH; 
debug('Max depth:', MAX_DEPTH);
const SESSION_SECRET = process.env.SESSION_SECRET; 
debug('Session secret:', SESSION_SECRET);
const RATE_LIMIT = { 
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) * 60 * 1000, 
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) 
}; 
debug('Rate limit:', RATE_LIMIT);
module.exports = {
  NODE_ENV,
  PORT,
  BASE_PATH,
  HOST,
  GALLERY_DL_DIR,
  DISALLOWED_DIRS,
  DISALLOWED_FILES,
  DISALLOWED_EXTENSIONS,
  MAX_DEPTH,
  SESSION_SECRET,
  RATE_LIMIT,
  debug
};