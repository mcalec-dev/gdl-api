# gdl-api

> [!WARNING]
> Don't use any <=0.3.x api versions as they are no longer supported/maintained. Please use >=0.4.x versions.

an express api made for gallery-dl downloads.

openapi documentation accessible at the `/docs/` path

install [MongoDB](https://www.mongodb.com/try/download/community) for database storage and [Redis](https://redis.io/download) for caching.

your local directory structure should look like this:

```text
base-dir/ # defined with `BASE_DIR`
└─ collection/
  └─ author/
    ├─ subdir/ # support for subdirectories (`MAX_DEPTH`)
    ├─ files.png
    ├─ files.png.json # sidecar json (`SIDECAR_FILE` and `SIDECAR_FILE_EXTENSION`)
    ├─ files.mp4
    └─ ...etc
```

example dotenv file is in `.env.example`

McAlec Development © 2025
