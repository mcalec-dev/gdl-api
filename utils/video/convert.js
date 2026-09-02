const log = require('../logHandler')
const { getMimeType } = require('../file/mimeAndHash')
const { spawnFfmpeg } = require('../ffmpeg/ffmpeg')
/**
 * @typedef {'audio' | 'video' | 'video_audio'} TranscodeMode
 * @typedef {{mode: 'audio', audioCodec: string, container: string} | {mode: 'video', videoCodec: string, container: string} | {mode: 'video_audio', videoCodec: string, audioCodec: string, container: string}} TranscodeOptions
 */
/**
 * @param {string | undefined} convertParam
 * @returns {TranscodeOptions | null}
 */
function parseConvertParam(convertParam) {
  if (!convertParam || typeof convertParam !== 'string') return null

  const tokens = convertParam
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0 || tokens.length > 2) return null
  /** @type {Record<string, {codec: string, container: string, type: 'audio' | 'video'}>} */
  const codecMap = {
    // Video
    mp4: { codec: 'h264', container: 'mp4', type: 'video' },
    h264: { codec: 'h264', container: 'mp4', type: 'video' },
    h265: { codec: 'hevc', container: 'mp4', type: 'video' },
    vp9: { codec: 'vp9', container: 'webm', type: 'video' },
    vp8: { codec: 'vp8', container: 'webm', type: 'video' },
    av1: { codec: 'av1', container: 'mp4', type: 'video' },
    mov: { codec: 'h264', container: 'mov', type: 'video' },
    mkv: { codec: 'h264', container: 'mkv', type: 'video' },
    webm: { codec: 'vp9', container: 'webm', type: 'video' },
    // Audio
    aac: { codec: 'aac', container: 'm4a', type: 'audio' },
    mp3: { codec: 'libmp3lame', container: 'mp3', type: 'audio' },
    opus: { codec: 'libopus', container: 'opus', type: 'audio' },
    vorbis: { codec: 'libvorbis', container: 'ogg', type: 'audio' },
    flac: { codec: 'flac', container: 'flac', type: 'audio' },
    ogg: { codec: 'libvorbis', container: 'ogg', type: 'audio' },
    m4a: { codec: 'aac', container: 'm4a', type: 'audio' },
  }

  const first = codecMap[tokens[0]]
  if (!first) return null

  if (tokens.length === 1) {
    if (first.type === 'audio') {
      return {
        mode: 'audio',
        audioCodec: first.codec,
        container: first.container,
      }
    }
    return {
      mode: 'video',
      videoCodec: first.codec,
      container: first.container,
    }
  }
  const second = codecMap[tokens[1]]
  if (!second || first.type !== 'video' || second.type !== 'audio') {
    return null
  }
  return {
    mode: 'video_audio',
    videoCodec: first.codec,
    audioCodec: second.codec,
    container: first.container,
  }
}
/**
 * @param {string | undefined} convertParam
 * @param {boolean} isVideoFile
 * @param {boolean} isAudioFile
 * @returns {TranscodeOptions | null}
 */
function getTranscodeOptions(convertParam, isVideoFile, isAudioFile) {
  const options = parseConvertParam(convertParam)
  if (!options) return null
  if (options.mode === 'audio') {
    return isAudioFile || isVideoFile ? options : null
  }
  return isVideoFile ? options : null
}
/**
 * @param {string | undefined} convertParam
 * @param {boolean} isVideoFile
 * @param {boolean} isAudioFile
 * @returns {boolean}
 */
function shouldConvertVideo(convertParam, isVideoFile, isAudioFile) {
  const options = getTranscodeOptions(convertParam, isVideoFile, isAudioFile)
  return Boolean(
    options && (options.mode === 'video' || options.mode === 'video_audio')
  )
}
/**
 * @param {string | undefined} convertParam
 * @param {boolean} isVideoFile
 * @param {boolean} isAudioFile
 * @returns {boolean}
 */
function shouldConvertAudio(convertParam, isVideoFile, isAudioFile) {
  const options = getTranscodeOptions(convertParam, isVideoFile, isAudioFile)
  return Boolean(
    options && (options.mode === 'audio' || options.mode === 'video_audio')
  )
}
/**
 * @typedef {{stream: NodeJS.ReadableStream, process: import('child_process').ChildProcessWithoutNullStreams}} TranscodeStream
 */
/**
 * @param {string} inputPath
 * @param {string} videoCodec
 * @param {string} audioCodec
 * @param {string} container
 * @returns {TranscodeStream}
 */
function convertVideo(inputPath, videoCodec, audioCodec, container) {
  /** @type {string[]} */
  const args = [
    '-i',
    inputPath,
    '-c:v',
    videoCodec,
    '-c:a',
    audioCodec,
    '-preset',
    'fast',
    '-movflags',
    'frag_keyframe+empty_moov',
    '-f',
    container,
    'pipe:1',
  ]
  log.debug(
    `FFmpeg video conversion: ${videoCodec} video, ${audioCodec} audio -> ${container}`
  )
  const ffmpegProcess =
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
      /** @type {unknown} */ (
        spawnFfmpeg(args)
      )
    )
  ffmpegProcess.on('error', (error) => {
    log.error('FFmpeg process error:', error)
  })
  ffmpegProcess.stderr.on('data', (data) => {
    const message = data.toString().trim()
    if (message) {
      log.debug('FFmpeg stderr:', message.slice(0, 200))
    }
  })
  return { stream: ffmpegProcess.stdout, process: ffmpegProcess }
}
/**
 * @param {string} inputPath
 * @param {string} audioCodec
 * @param {string} container
 * @returns {TranscodeStream}
 */
function convertAudio(inputPath, audioCodec, container) {
  /** @type {string[]} */
  const args = [
    '-i',
    inputPath,
    '-vn',
    '-c:a',
    audioCodec,
    '-q:a',
    '4', // quality (0-9 for VBR, lower is better)
    '-f',
    container,
    'pipe:1',
  ]
  log.debug(`FFmpeg audio conversion: ${audioCodec} audio -> ${container}`)
  const ffmpegProcess =
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
      /** @type {unknown} */ (
        spawnFfmpeg(args)
      )
    )
  ffmpegProcess.on('error', (error) => {
    log.error('FFmpeg process error:', error)
  })
  ffmpegProcess.stderr.on('data', (data) => {
    const message = data.toString().trim()
    if (message) {
      log.debug('FFmpeg stderr:', message.slice(0, 200))
    }
  })
  return { stream: ffmpegProcess.stdout, process: ffmpegProcess }
}
/**
 * @param {string} container
 * @returns {string}
 */
function getExtension(container) {
  /** @type {Record<string, string>} */
  const extensionMap = {
    mp4: 'mp4',
    webm: 'webm',
    mp3: 'mp3',
    m4a: 'm4a',
    ogg: 'ogg',
    opus: 'opus',
    flac: 'flac',
    mkv: 'mkv',
    mov: 'mov',
  }
  return extensionMap[container] || 'mp4'
}
module.exports = {
  parseConvertParam,
  getTranscodeOptions,
  shouldConvertVideo,
  shouldConvertAudio,
  convertVideo,
  convertAudio,
  getMimeType,
  getExtension,
}
