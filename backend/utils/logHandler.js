const chalk = require('chalk')
const util = require('util')
const config = require('../config')
/** @typedef {'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'} LogLevel */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
}
/**
 * @param {string | number | null | undefined} level
 * @returns {number}
 */
function parseLevel(level) {
  if (level === undefined || level === null || level === '')
    return LOG_LEVELS.DEBUG
  const n = Number(level)
  if (Number.isInteger(n) && n >= 0 && n <= 4) return n
  return (
    LOG_LEVELS[/** @type {LogLevel} */ (String(level).toUpperCase())] ??
    LOG_LEVELS.DEBUG
  )
}
let currentLogLevel = parseLevel(
  /** @type {string | number | null | undefined} */ (config.LOG_LEVEL)
)
/**
 * @param {unknown[]} args
 */
function formatArgs(args) {
  return args.map((arg) =>
    arg instanceof Error ? arg.stack || arg.message : arg
  )
}
/**
 * @param {LogLevel} level
 * @param {'debug' | 'info' | 'warn' | 'error'} method
 * @param {(str: string) => string} color
 * @param {unknown[]} args
 */
function writeLog(level, method, color, args) {
  if (currentLogLevel > LOG_LEVELS[level]) {
    return
  }
  const timestamp = new Date().toISOString()
  if (!args.length) {
    console[method](chalk.gray(timestamp), color(`[${level}]`))
    return
  }
  console[method](
    chalk.gray(timestamp),
    color(`[${level}]`),
    util.format(...formatArgs(args))
  )
}
const logger = {
  /** @param {string | number | null | undefined} level */
  setLevel(level) {
    currentLogLevel = parseLevel(level)
  },
  /** @param {...unknown} args */
  debug(...args) {
    writeLog('DEBUG', 'debug', chalk.cyan, args)
  },
  /** @param {...unknown} args */
  info(...args) {
    writeLog('INFO', 'info', chalk.green, args)
  },
  /** @param {...unknown} args */
  warn(...args) {
    writeLog('WARN', 'warn', chalk.yellow, args)
  },
  /** @param {...unknown} args */
  error(...args) {
    writeLog('ERROR', 'error', chalk.red, args)
  },
  /** @param {...unknown} args */
  fatal(...args) {
    writeLog('FATAL', 'error', chalk.magenta, args)
  },
}
module.exports = logger
