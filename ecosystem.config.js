module.exports = {
  apps: [
    {
      name: 'gdl-api',
      script: './server.js',
      watch: false,
      ignore_watch: [
        "node_modules",
        "client",
        "bot",
        "public",
        "logs",
        "views",
      ],
      env: {
        NODE_ENV: "development",
        DEBUG: "gdl-api:*"
      },
      log_file: "./logs/all.log",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: false,
      log_date_format: "MM-DD-YYYY HH:mm:ss Z"
    },
  ],
};