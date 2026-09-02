const fs = require('fs').promises
const path = require('path')
const { pathToFileURL } = require('url')
const cron = require('node-cron')
const log = require('./logHandler')
const configPath = path.join(__dirname, '..', 'cron.json')
const tasksPath = path.join(__dirname, '..', 'tasks')

/** @type {Map<string, RegisteredTask>} */
let registeredTasks = new Map()

/**
 * @typedef {{ name: string, enabled?: boolean, startup?: boolean, manual?: boolean, interval?: string | null }} CronTaskDefinition
 * @typedef {{ enabled?: boolean, tasks: CronTaskDefinition[] }} CronConfig
 * @typedef {{ definition: CronTaskDefinition, handler: Function, timer?: import('node-cron').ScheduledTask, running: boolean }} RegisteredTask
 */

/** @param {CronTaskDefinition} task */
function assertTaskDefinition(task) {
  if (!task || typeof task !== 'object') {
    throw new TypeError('Each cron task must be an object')
  }
  if (typeof task.name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(task.name)) {
    throw new TypeError('Each cron task must have a valid name')
  }
  if (task.enabled !== undefined && typeof task.enabled !== 'boolean') {
    throw new TypeError(`Invalid enabled value for cron task: ${task.name}`)
  }
  if (task.startup !== undefined && typeof task.startup !== 'boolean') {
    throw new TypeError(`Invalid startup value for cron task: ${task.name}`)
  }
  if (task.manual !== undefined && typeof task.manual !== 'boolean') {
    throw new TypeError(`Invalid manual value for cron task: ${task.name}`)
  }
  if (
    task.interval !== undefined &&
    task.interval !== null &&
    typeof task.interval !== 'string'
  ) {
    throw new TypeError(`Invalid interval for cron task: ${task.name}`)
  }
  if (typeof task.interval === 'string' && !cron.validate(task.interval)) {
    throw new TypeError(`Invalid cron expression for task: ${task.name}`)
  }
}

/** @returns {Promise<CronConfig>} */
async function loadConfig() {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  if (!config || typeof config !== 'object' || !Array.isArray(config.tasks)) {
    throw new TypeError('cron.json must contain a tasks array')
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new TypeError('cron.json enabled must be a boolean')
  }
  config.tasks.forEach(assertTaskDefinition)
  /** @type {CronConfig} */
  return config
}

/** @param {string} name */
async function loadTask(name) {
  const taskModule = await import(
    pathToFileURL(path.join(tasksPath, `${name}.mjs`)).href
  )
  const handler = taskModule.default || taskModule.run
  if (typeof handler !== 'function') {
    throw new TypeError(
      `Task ${name} must export a default function or a named run function`
    )
  }
  return handler
}

/** @param {string} name */
async function executeTask(name) {
  const task = registeredTasks.get(name)
  if (!task || task.running) return false
  task.running = true
  try {
    await task.handler()
    return true
  } catch (error) {
    log.error(`Cron task failed: ${name}`, error)
    return false
  } finally {
    task.running = false
  }
}

/** @returns {Promise<void>} */
async function startCron() {
  if (registeredTasks.size > 0) return
  const config = await loadConfig()
  if (config.enabled === false) {
    log.info('Cron tasks disabled')
    return
  }
  for (const definition of config.tasks) {
    if (definition.enabled === false) continue
    const handler = await loadTask(definition.name)
    /** @type {RegisteredTask} */
    const task = { definition, handler, running: false }
    registeredTasks.set(definition.name, task)
    if (definition.startup === true) {
      await executeTask(definition.name)
    }
    if (typeof definition.interval === 'string') {
      task.timer = cron.schedule(definition.interval, () => {
        void executeTask(definition.name)
      })
    }
  }
  log.info(`Registered ${registeredTasks.size} cron task(s)`)
}

/** @param {string} name */
async function runTask(name) {
  const task = registeredTasks.get(name)
  if (!task) throw new Error(`Cron task is not registered: ${name}`)
  if (task.definition.manual !== true) {
    throw new Error(`Cron task is not enabled for manual execution: ${name}`)
  }
  return executeTask(name)
}

function stopCron() {
  for (const task of registeredTasks.values()) {
    if (!task.timer) continue
    task.timer.stop()
  }
  registeredTasks.clear()
}

module.exports = { startCron, stopCron, runTask }
