const chalk = require('chalk')
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
}
let currentLogLevel = LOG_LEVELS.DEBUG
const timestamp = new Date().toISOString()
const logger = {
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level]
    }
  },
  debug(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(
        chalk.gray(timestamp),
        chalk.cyan('[DEBUG]'),
        message,
        data || ''
      )
    }
  },
  info(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(
        chalk.gray(timestamp),
        chalk.green('[INFO]'),
        message,
        data || ''
      )
    }
  },
  warn(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.log(
        chalk.gray(timestamp),
        chalk.yellow('[WARN]'),
        message,
        data || ''
      )
    }
  },
  error(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.log(
        chalk.gray(timestamp),
        chalk.red('[ERROR]'),
        message,
        data || ''
      )
    }
  },
  fatal(message, data = null) {
    if (currentLogLevel <= LOG_LEVELS.FATAL) {
      console.log(
        chalk.gray(timestamp),
        chalk.magenta('[FATAL]'),
        message,
        data || ''
      )
    }
  },
}
module.exports = logger
