import { getFileExtension } from './strings.js'

/**
 * @typedef {'image' | 'video' | 'audio' | 'text' | 'other'} MediaKind
 */

/**
 * @typedef {'codec' | 'container'} TranscodeCategory
 */

/**
 * @typedef {{value: string, label: string, kind: 'video' | 'audio', category: TranscodeCategory, contentType: string}} TranscodeFormat
 */

/** @type {ReadonlyArray<TranscodeFormat>} */
export const VIDEO_TRANSCODE_FORMATS = Object.freeze([
  {
    value: 'h264',
    label: 'H.264 (MP4)',
    kind: 'video',
    category: 'codec',
    contentType: 'video/mp4; codecs="avc1.42E01E"',
  },
  {
    value: 'h265',
    label: 'H.265 / HEVC (MP4)',
    kind: 'video',
    category: 'codec',
    contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"',
  },
  {
    value: 'vp9',
    label: 'VP9 (WebM)',
    kind: 'video',
    category: 'codec',
    contentType: 'video/webm; codecs="vp9"',
  },
  {
    value: 'vp8',
    label: 'VP8 (WebM)',
    kind: 'video',
    category: 'codec',
    contentType: 'video/webm; codecs="vp8"',
  },
  {
    value: 'av1',
    label: 'AV1 (MP4)',
    kind: 'video',
    category: 'codec',
    contentType: 'video/mp4; codecs="av01.0.05M.08"',
  },
  {
    value: 'mov',
    label: 'QuickTime container (H.264)',
    kind: 'video',
    category: 'container',
    contentType: 'video/quicktime; codecs="avc1.42E01E"',
  },
  {
    value: 'mkv',
    label: 'Matroska container (H.264)',
    kind: 'video',
    category: 'container',
    contentType: 'video/x-matroska; codecs="avc1.42E01E"',
  },
  {
    value: 'webm',
    label: 'WebM container (VP9)',
    kind: 'video',
    category: 'container',
    contentType: 'video/webm; codecs="vp9"',
  },
])

/** @type {ReadonlyArray<TranscodeFormat>} */
export const AUDIO_TRANSCODE_FORMATS = Object.freeze([
  {
    value: 'aac',
    label: 'AAC (M4A)',
    kind: 'audio',
    category: 'codec',
    contentType: 'audio/mp4; codecs="mp4a.40.2"',
  },
  {
    value: 'mp3',
    label: 'MP3',
    kind: 'audio',
    category: 'codec',
    contentType: 'audio/mpeg',
  },
  {
    value: 'opus',
    label: 'Opus',
    kind: 'audio',
    category: 'codec',
    contentType: 'audio/ogg; codecs="opus"',
  },
  {
    value: 'flac',
    label: 'FLAC',
    kind: 'audio',
    category: 'codec',
    contentType: 'audio/flac',
  },
])

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
])
const VIDEO_EXTENSIONS = new Set([
  'avi',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'ogv',
  'webm',
])
const AUDIO_EXTENSIONS = new Set([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'weba',
])

/**
 * Determines the display media type from a MIME type.
 *
 * @param {unknown} mime MIME type value.
 * @returns {MediaKind} Display media kind.
 */
export function getMediaKindFromMime(mime) {
  if (typeof mime !== 'string') return 'other'
  const normalized = mime.toLowerCase()
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('video/') || normalized === 'application/mp4') {
    return 'video'
  }
  if (normalized.startsWith('audio/')) return 'audio'
  if (normalized.startsWith('text/')) return 'text'
  return 'other'
}

/**
 * Determines the display media type from a file name or path.
 *
 * @param {unknown} value File name or path.
 * @returns {MediaKind} Display media kind.
 */
export function getMediaKind(value) {
  const extension = getFileExtension(value)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (['json', 'md', 'txt', 'xml', 'yaml', 'yml'].includes(extension)) {
    return 'text'
  }
  return 'other'
}

/**
 * Checks playback support for a concrete codec/container format.
 *
 * @param {TranscodeFormat} format Candidate output format.
 * @returns {Promise<boolean>} Whether the browser can play the format.
 */
export async function canDecodeFormat(format) {
  const element = document.createElement(format.kind)
  const fallback = element.canPlayType(format.contentType) !== ''

  if (typeof navigator.mediaCapabilities?.decodingInfo !== 'function') {
    return fallback
  }

  try {
    const result =
      format.kind === 'audio'
        ? await navigator.mediaCapabilities.decodingInfo({
            type: 'file',
            audio: {
              contentType: format.contentType,
              channels: '2',
              bitrate: 128000,
              samplerate: 44100,
            },
          })
        : await navigator.mediaCapabilities.decodingInfo({
            type: 'file',
            video: {
              contentType: format.contentType,
              width: 1280,
              height: 720,
              bitrate: 2500000,
              framerate: 24,
            },
          })
    return result.supported
  } catch {
    return fallback
  }
}

/**
 * Returns browser-playable formats for a transcode selector.
 *
 * @param {'video' | 'audio'} kind Target media kind.
 * @returns {Promise<TranscodeFormat[]>} Supported formats in display order.
 */
export async function getSupportedTranscodeFormats(kind) {
  const formats =
    kind === 'video' ? VIDEO_TRANSCODE_FORMATS : AUDIO_TRANSCODE_FORMATS
  const supported = await Promise.all(
    formats.map(async (format) =>
      (await canDecodeFormat(format)) ? format : null
    )
  )
  return supported.filter((format) => format !== null)
}
