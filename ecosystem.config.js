module.exports = {
  apps: [
    {
      name: 'gdl-api',
      script: './server.js',
      watch: true,
      ignore_watch: ['node_modules', 'logs'],
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        BASE_PATH: '/gdl',
        GALLERY_DL_DIR: 'F:/gallery-dl',
        YT_DLP_DIR: 'G:/yt-dlp/downloads',
        EXCLUDED_DIRS: JSON.stringify([
          "*.config*", ".git", "modules", "e621", "fauvfox", "pFluffySkeleton",
          "PotatoCatNSFW", "VerseSecret", "NukkirAD", "IxuNsfw", "KendoVirmir",
          "ixunsfw.bsky.social", "nukkir.bsky.social", "secretverse.bsky.social",
          "whygena.bsky.social", "Virmir", "drdragontim", "Snow Dragon", "DragonSnow4",
          "vk", "transformation", "transfur", "mid-transformation", "virmir",
          "artist_virmir", "artist_fauvfox", "artist_hydez", "hydez", "artist_dreamlite",
          "artist_showolmes", "dreamlite", "diesvolt", "rainbowraven", "xiamtheferret",
          "RaiinbowRaven", "dragonsnow.bsky.social", "AldyDerg", "tf",
          "Not only lazy, but smart too!!", "changed", "FauvFox", "*nsfw*"
        ]),
        EXCLUDED_FILES: JSON.stringify([
          ".DS_Store", "thumbs.db", "*.json", "urls.txt"
        ]),
        ALLOWED_EXTENSIONS: JSON.stringify([
          ".jpg", ".jpeg", ".png", ".gif", ".webp", ".webm", ".zip",
          ".pdf", ".txt", ".md", ".doc", ".docx", ".mp3", ".mp4"
        ]),
        MAX_DEPTH: 15,
        RATE_LIMIT_WINDOW_MINUTES: 15,
        RATE_LIMIT_MAX_REQUESTS: 7500,
        DEBUG: 'gdl-api:*'
      }
    }
  ]
};