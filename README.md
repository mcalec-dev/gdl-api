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

## Docker

The production image uses Node.js 24 (LTS) and listens on port `3030`. MongoDB is required;
Redis is used for caching and sessions when enabled.
The application also needs a writable directory mounted at `BASE_DIR` for filesystem scanning.
Uploaded file contents are stored in MongoDB GridFS.

Build and run the standalone image:

```sh
docker build -t gdl-api .
docker run --rm -p 3030:3030 \
  -e MONGODB_URL=mongodb://host.docker.internal:27017/gdl \
  -e SESSION_SECRET=replace-this-secret \
  -e HOST=localhost:3030 \
  -v "$(pwd)/data:/data" \
  gdl-api
```

For a local MongoDB and Redis stack, copy `.env.example` to `.env`, set a strong `SESSION_SECRET`, then run:

```sh
docker compose up --build
```

Compose uses the service names `mongodb` and `redis` automatically and persists application files and MongoDB data in named volumes.
Keep the API at one replica while the in-process cron tasks are enabled, since synchronization, statistics, cleanup, and session cleanup are started by every web process.

Set `BASE_PATH` when serving the application behind a URL prefix such as `/gdl`. The server routes and rendered frontend requests support that prefix;
the reverse proxy must forward the prefix unchanged and terminate HTTPS when production secure cookies are enabled.

The existing `GET /api/health/` endpoint (or `GET /<BASE_PATH>/api/health/` when prefixed) is a liveness check and returns HTTP `204`.
It confirms that the application is listening, but does not verify MongoDB or Redis readiness.
