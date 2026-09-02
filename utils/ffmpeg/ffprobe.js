const { spawn } = require('child_process')
const ffprobeStatic = /** @type {{ path: string }} */ (
  // @ts-ignore - no types for ffprobe-static
  require('ffprobe-static')
)
const config = /** @type {{ USE_SYSTEM_FFMPEG: boolean, FFMPEG_PATH?: string }} */ (
  require('../../config')
)

const ffprobe = config.USE_SYSTEM_FFMPEG
  ? config.FFMPEG_PATH
    ? config.FFMPEG_PATH.replace(/ffmpeg(?:\.exe)?$/i, 'ffprobe$1')
    : 'ffprobe'
  : ffprobeStatic.path

/**
 * @param {string[]} args
 * @returns {import('child_process').ChildProcessWithoutNullStreams}
 */
function spawnFfprobe(args) {
  return /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
    /** @type {unknown} */ (
      spawn(String(ffprobe), args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    )
  )
}

module.exports = { spawnFfprobe }
