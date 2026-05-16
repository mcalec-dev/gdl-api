# todo

- add file checkers (ex. duplicate files, no extensions, etc.)
- integration with gallery-dl (via pwsh script or exe)
- add filters and pagination to `files` and `search` endpoints and frontend
- add github actions (ci pipeline) for auditing dependencies, and linting
- translations for the frontend (refer to discord bots)
- `files.js` doesn't append the metadata even if it doesn't have an url param
- proper MIME setter in `files.js` (for each file)
- npm packages to utilize; moment, pm2, async, sitemap, glob, rollup
- app using native frameworks
- autocomplete for search frontend (like google)
- implement google oauth with passport
- configurable grid layout for frontend files
- rollup with nexe
- `AUTO_SCAN` even if its on, it should upsert directories when accessed too
- npm package `emailvalid` for email validation in user registrations
- backend typescript rewrite
- finish adding the quality settings/params to the files endpoint with sharp (imageUtils & fileUtils)
