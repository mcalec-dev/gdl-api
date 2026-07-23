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
