const mongoose = require('mongoose')
const fileTypeSchema = new mongoose.Schema(
  {
    count: { type: Number, required: true, default: 0 },
    size: { type: Number, required: true, default: 0 },
  },
  { _id: false }
)
const collectionDetailSchema = new mongoose.Schema(
  {
    files: { type: Number, required: true, default: 0 },
    size: { type: Number, required: true, default: 0 },
    modified: { type: Date, required: false, default: null },
    fileTypes: {
      type: Map,
      of: fileTypeSchema,
      default: () => new Map(),
    },
    sizes: {
      largest: { type: Number, required: true, default: 0 },
      smallest: { type: Number, required: false, default: null },
    },
  },
  { _id: false }
)
module.exports = mongoose.model(
  'Stats',
  new mongoose.Schema(
    {
      api: {
        version: { type: String, required: true },
        uptime: { type: Number, required: true },
        timestamp: { type: Date, required: true },
        node: { type: String, required: true },
        memory: {
          rss: { type: Number, required: true },
          external: { type: Number, required: true },
          arrayBuffers: { type: Number, required: true },
          heap: {
            total: { type: Number, required: true },
            used: { type: Number, required: true },
          },
          formatted: {
            heapUsed: { type: Number, required: true },
            rss: { type: Number, required: true },
          },
        },
      },
      collections: {
        total: { type: Number, required: true, default: 0 },
        totalSize: { type: Number, required: true, default: 0 },
        totalFiles: { type: Number, required: true, default: 0 },
        totalDirectories: { type: Number, required: true, default: 0 },
        averageFileSize: { type: Number, required: true, default: 0 },
        largestFileSize: { type: Number, required: true, default: 0 },
        smallestFileSize: { type: Number, required: false, default: null },
        fileTypes: {
          type: Map,
          of: fileTypeSchema,
          default: () => new Map(),
        },
        details: {
          type: Map,
          of: collectionDetailSchema,
          default: () => new Map(),
        },
      },
    },
    {
      _id: false,
      suppressReservedKeysWarning: true,
      versionKey: false,
    }
  )
)
