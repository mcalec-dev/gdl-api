# gdl-api

> [!WARNING]
> Any version below `v0.3.0` is no longer maintained. Please use any version above `v0.4.0`.
> Docker Compose support is in the testing phase. Report any bugs to the issue tracker.

an express api made for gallery-dl downloads.

openapi documentation accessible at the `/docs/` path

install [MongoDB](https://www.mongodb.com/try/download/community) for database storage and [Redis](https://redis.io/download) for caching.

your local directory structure should look like this:

```text
root/              # defined with `BASE_DIR`
└─ collection/
  └─ author/
    ├─ subdir/         # support for subdirectories (`MAX_DEPTH`)
    ├─ image.png       # supports resizing and other image processing (`MAX_BUFFER_SIZE` `MAX_SCALE` `MAX_PIXELS`)
    ├─ image.png.json  # sidecar json (`SIDECAR_FILE` `SIDECAR_FILE_EXTENSION`)
    ├─ video.mp4       # transcoding suppport via ffmpeg (`TRANSCODE_VIDEO` `TRANSCODE_AUDIO`)
    ├─ audio.wav
    └─ ...
```

an example dotenv file is in `.env.example`

## Development checks

Requires Node.js 24 or newer. NODE_ENV accepts development, production, and testing.

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs lint, formatting, and API and browser typechecks. The browser typecheck currently reports existing strict-type errors.

## Scheduled maintenance

The default schedules limit repeated full-tree and per-file checks. Times use the server's local timezone.

| Task | Default schedule |
| --- | --- |
| sync | At startup and daily at 00:00 |
| stats | Daily at 02:00 |
| cleanup | Daily at 03:00 |
| session-cleanup | Daily at 04:00 |
| check-files | Daily at 05:00 |
| sidecar-metadata | Daily at 06:00 |

The stats, cleanup, file-check, and sidecar tasks walk or inspect stored files, so they do not run at startup. Edit cron.json to tune freshness and I/O for slow or network-mounted storage. The startup sync remains enabled to populate the initial inventory; set its startup field to false if startup disk activity is a higher priority than immediate inventory freshness.

## Docker

The production image uses Node.js 24 (LTS) and listens on port `3030`. MongoDB is required;
Redis is used for caching and sessions when enabled.
The application also needs a writable directory mounted at `BASE_DIR` for filesystem scanning.
Uploaded file contents are stored in MongoDB GridFS.

Build and run the standalone image:

```sh
cp .env.example .env
# Set SESSION_SECRET and adjust MONGODB_URL / REDIS_URL for the standalone container.
docker build -t gdl-api .
docker run --rm --env-file .env \
  -e BASE_DIR=/data \
  -p "3030:${PORT:-3030}" \
  -v "$(pwd)/data:/data" \
  gdl-api
```

For a local MongoDB and Redis stack, set `MONGODB_URL=mongodb://mongodb:27017/gdl` and `REDIS_URL=redis://redis:6379` in `.env`, set a strong `SESSION_SECRET`, then run:

```sh
docker compose up --build
```

Compose uses the service names `mongodb` and `redis` automatically and persists application files and MongoDB data in named volumes.
Keep the API at one replica while the in-process cron tasks are enabled, since synchronization, statistics, cleanup, and session cleanup are started by every web process.

Set `BASE_PATH` when serving the application behind a URL prefix such as `/gdl`. The server routes and rendered frontend requests support that prefix;
the reverse proxy must forward the prefix unchanged and terminate HTTPS when production secure cookies are enabled.

The existing `GET /api/health/` endpoint (or `GET /<BASE_PATH>/api/health/` when prefixed) is a liveness check and returns HTTP `204`.
It confirms that the application is listening, but does not verify MongoDB or Redis readiness.
