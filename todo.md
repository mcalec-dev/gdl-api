# todo

- integration with gallery-dl (via pwsh script or exe)
- finish mime handling in `files.js` for every transformed and streamed response, using detected MIME values instead of extension-only fallbacks
- npm packages to evaluate and integrate where useful; `moment`, `pm2`, `async`, `sitemap`, `rollup`, `sanitize-url`, `slugify`
- app using native frameworks
- search autocomplete for frontend
- implement google oauth
- configurable grid layout for frontend files
- rollup with nexe
- npm package `emailvalid` for email validation in user registrations
- backend typescript rewrite (planned for v1.0.0)
- replace the separate `:uuid` endpoint with model specific uuid endpoints that return the related database entry ex. `/files/:uuid` or `/directories/:uuid`
- add persistent "Last Accessed" and "Last Scanned" timestamps to file and directory models, update them from access and scan workflows, and use them for cleanup/management
- cron tasks for:
  - file integrity and duplicate checks
  - processing gallery-dl imports and retries
  - purging expired cache entries after cache invalidation support is added
  - queued metadata and MIME/hash processing
  - sidecar metadata file checks and updates
- token management via `express-jwt`
- use `create-torrent` and `parse-torrent` to generate `.torrent` files for `/files/<path-to-file>/torrent` and `/files/<path-to-folder>/torrent`
- add cache control configuration for `sendResponse`

- bug with files cron task deleting all records for a cleanup, counting them as "stale" when they are not, needs to be fixed
