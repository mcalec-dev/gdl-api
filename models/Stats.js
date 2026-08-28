const mongoose = require('mongoose')
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
          heapTotal: { type: Number, required: true },
          heapUsed: { type: Number, required: true },
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
        fileTypes: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
        details: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      },
    },
    {
      suppressReservedKeysWarning: true,
      versionKey: false,
    }
  )
)
