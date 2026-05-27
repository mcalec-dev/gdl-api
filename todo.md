# todo

- integration with gallery-dl (via pwsh script or exe)
- `files.js` doesn't append the metadata even if it doesn't have an url param
- proper MIME setter in `files.js` (for each file)
- npm packages to utilize; moment, pm2, async, sitemap, glob, rollup
- app using native frameworks
- autocomplete for search frontend (like google)
- implement google oauth with passport
- configurable grid layout for frontend files
- rollup with nexe
- npm package `emailvalid` for email validation in user registrations
- backend typescript rewrite
- finish adding the quality settings/params to the files endpoint with sharp (imageUtils & fileUtils)
- instead of having a seperate `:uuid` endpoint, each db model should have a `:uuid` endpoint that returns the data correlated to its database entry. ex. `/files/:uuid`, `/directories/:uuid`, etc.
- implement tasks/queues for long-running processes (ex. file scanning, session management, metadata processing, etc.)
- implement checks for file integrity and duplicates (ex. using checksums or hashes) to prevent storing multiple copies of the same file and to ensure data integrity.
- add last accessed/scanned timestamps to files and directories for better management and cleanup of old or unused files.
