const log = require('../logHandler')
const { getMimeType } = require('../file/mimeAndHash')
const { spawnFfmpeg } = require('../ffmpeg/ffmpeg')
/**
 * @typedef {'audio' | 'video' | 'video_audio'} TranscodeMode
 * @typedef {{mode: 'audio', audioCodec: string, container: string, muxer: string, extension: string} | {mode: 'video', videoCodec: string, container: string, muxer: string, extension: string} | {mode: 'video_audio', videoCodec: string, audioCodec: string, container: string, muxer: string, extension: string}} TranscodeOptions
 */

/**
 * Maps the public codec identifiers used by API clients to the encoder names that
 * the installed FFmpeg binary accepts. The public values remain stable for
 * compatibility, but the actual command arguments are valid for the runtime build.
 *
 * @param {string | undefined} codec Candidate codec identifier.
 * @returns {string} Actual FFmpeg encoder name or the original value.
 */
function resolveFfmpegEncoder(codec) {
  if (!codec || typeof codec !== 'string') return 'copy'
  const normalized = codec.trim().toLowerCase()
  /** @type {Record<string, string>} */
  const encoderMap = {
    h264: 'libx264',
    h265: 'libx265',
    vp9: 'libvpx-vp9',
    vp8: 'libvpx',
    av1: 'libaom-av1',
    aac: 'aac',
    mp3: 'libmp3lame',
    opus: 'libopus',
    vorbis: 'libvorbis',
    flac: 'flac',
    copy: 'copy',
  }
  return encoderMap[normalized] || normalized
}

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
  /** @type {Record<string, {codec: string, container: string, muxer: string, extension: string, type: 'audio' | 'video'}>} */
  const codecMap = {
    mp4: {
      codec: 'h264',
      container: 'mp4',
      muxer: 'mp4',
      extension: 'mp4',
      type: 'video',
    },
    h264: {
      codec: 'h264',
      container: 'mp4',
      muxer: 'mp4',
      extension: 'mp4',
      type: 'video',
    },
    h265: {
      codec: 'h265',
      container: 'mp4',
      muxer: 'mp4',
      extension: 'mp4',
      type: 'video',
    },
    vp9: {
      codec: 'vp9',
      container: 'webm',
      muxer: 'webm',
      extension: 'webm',
      type: 'video',
    },
    vp8: {
      codec: 'vp8',
      container: 'webm',
      muxer: 'webm',
      extension: 'webm',
      type: 'video',
    },
    av1: {
      codec: 'av1',
      container: 'mp4',
      muxer: 'mp4',
      extension: 'mp4',
      type: 'video',
    },
    mov: {
      codec: 'h264',
      container: 'mov',
      muxer: 'mov',
      extension: 'mov',
      type: 'video',
    },
    mkv: {
      codec: 'h264',
      container: 'mkv',
      muxer: 'matroska',
      extension: 'mkv',
      type: 'video',
    },
    webm: {
      codec: 'vp9',
      container: 'webm',
      muxer: 'webm',
      extension: 'webm',
      type: 'video',
    },
    aac: {
      codec: 'aac',
      container: 'm4a',
      muxer: 'ipod',
      extension: 'm4a',
      type: 'audio',
    },
    mp3: {
      codec: 'mp3',
      container: 'mp3',
      muxer: 'mp3',
      extension: 'mp3',
      type: 'audio',
    },
    opus: {
      codec: 'opus',
      container: 'opus',
      muxer: 'opus',
      extension: 'opus',
      type: 'audio',
    },
    vorbis: {
      codec: 'vorbis',
      container: 'ogg',
      muxer: 'ogg',
      extension: 'ogg',
      type: 'audio',
    },
    flac: {
      codec: 'flac',
      container: 'flac',
      muxer: 'flac',
      extension: 'flac',
      type: 'audio',
    },
    ogg: {
      codec: 'vorbis',
      container: 'ogg',
      muxer: 'ogg',
      extension: 'ogg',
      type: 'audio',
    },
    m4a: {
      codec: 'aac',
      container: 'm4a',
      muxer: 'ipod',
      extension: 'm4a',
      type: 'audio',
    },
  }

  const first = codecMap[tokens[0]]
  if (!first) return null

  if (tokens.length === 1) {
    if (first.type === 'audio') {
      return {
        mode: 'audio',
        audioCodec: first.codec,
        container: first.container,
        muxer: first.muxer,
        extension: first.extension,
      }
    }
    return {
      mode: 'video',
      videoCodec: first.codec,
      container: first.container,
      muxer: first.muxer,
      extension: first.extension,
    }
  }
  const second = codecMap[tokens[1]]
  if (!second || first.type !== 'video' || second.type !== 'audio') {
    return null
  }
  const validAudioForVideo = /** @type {Record<string, Set<string>>} */ ({
    mp4: new Set(['aac', 'mp3']),
    webm: new Set(['opus', 'vorbis']),
    mov: new Set(['aac', 'mp3']),
    mkv: new Set(['aac', 'mp3', 'opus', 'flac']),
  })
  if (!validAudioForVideo[first.container]?.has(tokens[1])) {
    return null
  }
  return {
    mode: 'video_audio',
    videoCodec: resolveFfmpegEncoder(first.codec),
    audioCodec: resolveFfmpegEncoder(second.codec),
    container: first.container,
    muxer: first.muxer,
    extension: first.extension,
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
 * Builds a codec-specific FFmpeg audio-transcoding command.
 *
 * @param {string} inputPath Source audio file.
 * @param {string} audioCodec Requested public codec identifier.
 * @param {string} container Output container.
 * @param {string} muxer Muxer to write through.
 * @returns {string[]} FFmpeg arguments for the requested audio conversion.
 */
function buildAudioArgs(inputPath, audioCodec, container, muxer) {
  const encoder = resolveFfmpegEncoder(audioCodec)
  const normalizedCodec = String(audioCodec || '')
    .trim()
    .toLowerCase()
  /** @type {Record<string, string>} */
  const codecAliasMap = {
    libmp3lame: 'mp3',
    libopus: 'opus',
    libvorbis: 'vorbis',
    aac: 'aac',
    flac: 'flac',
  }
  const normalizedAudioCodec = codecAliasMap[normalizedCodec] || normalizedCodec
  const args = ['-i', inputPath, '-vn']

  if (container === 'm4a' || container === 'mp4' || muxer === 'ipod') {
    args.push(
      '-c:a',
      encoder,
      '-movflags',
      'frag_keyframe+empty_moov+separate_moof',
      '-f',
      muxer || 'ipod'
    )
    return args.concat('pipe:1')
  }

  if (normalizedAudioCodec === 'mp3') {
    args.push('-c:a', encoder, '-b:a', '192k', '-f', muxer || container)
    return args.concat('pipe:1')
  }

  if (normalizedAudioCodec === 'opus') {
    args.push(
      '-c:a',
      encoder,
      '-b:a',
      '128k',
      '-vbr',
      'on',
      '-ar',
      '48000',
      '-f',
      muxer || 'opus'
    )
    return args.concat('pipe:1')
  }

  if (normalizedAudioCodec === 'vorbis') {
    args.push('-c:a', encoder, '-q:a', '5', '-f', muxer || 'ogg')
    return args.concat('pipe:1')
  }

  if (normalizedAudioCodec === 'flac') {
    args.push('-c:a', encoder, '-f', muxer || 'flac')
    return args.concat('pipe:1')
  }

  args.push('-c:a', encoder, '-q:a', '4', '-f', muxer || container)
  return args.concat('pipe:1')
}

/**
 * Builds a codec-specific FFmpeg video-transcoding command.
 *
 * @param {string} inputPath Source video file.
 * @param {string} videoCodec Requested public video codec identifier.
 * @param {string} audioCodec Requested public audio codec identifier or 'copy'.
 * @param {string} container Output container.
 * @param {string} muxer Muxer to write through.
 * @returns {string[]} FFmpeg arguments for the requested video conversion.
 */
function buildVideoArgs(inputPath, videoCodec, audioCodec, container, muxer) {
  const videoEncoder = resolveFfmpegEncoder(videoCodec)
  const audioEncoder =
    audioCodec === 'copy' ? 'copy' : resolveFfmpegEncoder(audioCodec)
  const args = [
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c:v',
    videoEncoder,
  ]

  if (audioCodec === 'copy') {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', audioEncoder)
  }

  if (container === 'mp4' || container === 'mov' || muxer === 'ipod') {
    args.push('-movflags', 'frag_keyframe+empty_moov+separate_moof')
  }

  if (container === 'webm' || muxer === 'webm') {
    args.push('-b:v', '2M', '-b:a', '128k')
  }

  args.push('-f', muxer || container, 'pipe:1')
  return args
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
function convertVideo(
  inputPath,
  videoCodec,
  audioCodec,
  container,
  muxer = container
) {
  const args = buildVideoArgs(
    inputPath,
    videoCodec,
    audioCodec,
    container,
    muxer
  )
  log.debug(
    `FFmpeg video conversion: ${videoCodec} video, ${audioCodec} audio -> ${container} (${muxer})`
  )
  const ffmpegProcess =
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
      /** @type {unknown} */ (spawnFfmpeg(args))
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
function convertAudio(inputPath, audioCodec, container, muxer = container) {
  const args = buildAudioArgs(inputPath, audioCodec, container, muxer)
  log.debug(
    `FFmpeg audio conversion: ${audioCodec} audio -> ${container} (${muxer})`
  )
  const ffmpegProcess =
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */ (
      /** @type {unknown} */ (spawnFfmpeg(args))
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
