// @ts-ignore
import { BYTES_BITS } from '../settings.min.js'
// @ts-ignore
import prettyBytes from 'https://cdn.jsdelivr.net/npm/pretty-bytes/+esm'
// @ts-ignore
import prettyMs from 'https://cdn.jsdelivr.net/npm/pretty-ms/+esm'
// @ts-ignore
import * as utils from '../index.min.js'

/**
 * @param {number} bytes
 * @param {Object} [options]
 * @param {number} [options.minDecimalPlaces=0]
 * @param {number} [options.maxDecimalPlaces=2]
 * @returns {string|undefined}
 */
export function formatSize(
  bytes,
  { minDecimalPlaces = 0, maxDecimalPlaces = 2 } = {}
) {
  if (!bytes) return undefined
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return undefined
  }
  try {
    if (BYTES_BITS) {
      return prettyBytes(bytes, {
        signed: false,
        bits: false,
        binary: false,
        locale: true,
        minimumFractionDigits: minDecimalPlaces,
        maximumFractionDigits: maxDecimalPlaces,
        space: true,
        nonBreakingSpace: true,
        //fixedWidth: undefined,
      })
    }
    if (!BYTES_BITS) {
      return prettyBytes(bytes, {
        signed: false,
        bits: false,
        binary: true,
        locale: true,
        minimumFractionDigits: minDecimalPlaces,
        maximumFractionDigits: maxDecimalPlaces,
        space: true,
        nonBreakingSpace: true,
        //fixedWidth: undefined,
      })
    }
  } catch (error) {
    utils.handleError(error)
    return undefined
  }
}

/**
 * @param {number} ms
 * @returns {string|undefined}
 */
export function formatMs(ms) {
  if (!ms) return undefined
  if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
    return undefined
  }
  try {
    /*return prettyMs(ms, {
      secondsDecimalDigits: 0,
      millisecondsDecimalDigits: 0,
      keepDecimalsOnWholeSeconds: false,
      compact: false, // add settings option for this
      //unitCount: Infinity, // add settings option for this
      verbose: false, // add settings option for this too
      separateMilliseconds: false,
      formatSubMilliseconds: false,
      colonNotation: false,
      hideYears: false,
      hideYearAndDays: false,
      hideSeconds: true, // add settings option for this
      subSecondsAsDecimals: false, // add settings option for this
    })*/
    return prettyMs(ms)
  } catch (error) {
    utils.handleError(error)
    return undefined
  }
}

export default {
  formatSize,
  formatMs,
}
