module.exports = {
  apps: [
    {
      name: 'gdl-api',
      script: './server.js',
      watch: true,
      ignore_watch: ['node_modules', 'logs', 'public/thumbnails'],
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        BASE_PATH: '/gdl',
        GALLERY_DL_DIR: 'F:\\gallery-dl',
        EXCLUDED_DIRS: '.hidden,.config,*.git',
        EXCLUDED_FILES: '.DS_Store,thumbs.db,*.json,urls.txt',
        ALLOWED_EXTENSIONS: '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.ogg,.flac,.wav,.zip,.rar,.7z,.tar,.gz,.pdf,.txt,.md,.html,.htm,.json,.xml,.csv,.tsv,.xls,.xlsx,.ods,.doc,.docx,.odt,.ppt,.pptx,.odp,.mp3,.flac,.wav,.ogg,.mp',
        MAX_DEPTH: 15,
        RATE_LIMIT_WINDOW_MINUTES: 15,
        RATE_LIMIT_MAX_REQUESTS: 1000,
        DEBUG: 'gdl-api:*'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
        BASE_PATH: '/gdl',
        GALLERY_DL_DIR: 'F:\\gallery-dl',
        EXCLUDED_DIRS: '.hidden,.config,*.git',
        EXCLUDED_FILES: '.DS_Store,thumbs.db,*.json,urls.txt',
        ALLOWED_EXTENSIONS: '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.ogg,.flac,.wav,.zip,.rar,.7z,.tar,.gz,.pdf,.txt,.md,.html,.htm,.json,.xml,.csv,.tsv,.xls,.xlsx,.ods,.doc,.docx,.odt,.ppt,.pptx,.odp,.mp3,.flac,.wav,.ogg,.mp',
        MAX_DEPTH: 15,
        RATE_LIMIT_WINDOW_MINUTES: 15,
        RATE_LIMIT_MAX_REQUESTS: 1000
      }
    }
  ]
};