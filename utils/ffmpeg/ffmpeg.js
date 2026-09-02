const { spawn } = require('child_process')
const ffmpegStatic = require('ffmpeg-static')
const config = require('../../config')

const ffmpeg = config.USE_SYSTEM_FFMPEG
  ? config.FFMPEG_PATH || 'ffmpeg'
  : ffmpegStatic

/**
 * @param {string[]} args
 * @returns {import('child_process').ChildProcessWithoutNullStreams}
 */
function spawnFfmpeg(args) {
  return /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
    /** @type {unknown} */ (
      spawn(String(ffmpeg), args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    )
  )
}

module.exports = { spawnFfmpeg }
