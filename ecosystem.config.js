module.exports = {
  apps: [
    {
      name: 'gdl-api',
      script: './server.js',
      instances: "max",
      exec_mode: "cluster",
      watch: true,
      ignore_watch: [
        "node_modules",
        "client",
        "bot",
        "views",
        ".env",
      ],
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      log_file: "./logs/all.log",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      log_date_format: "MM-DD-YYYY HH:mm:ss Z"
    },
  ],
};