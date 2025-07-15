# gdl-api

**CONTENT REMOVAL: removals[at]mcalec[dot]dev**

A RESTful API I made for gallery-dl downloads. (it's poorly made)  

Swagger documentation accessible at `/docs`

Be sure to edit your config in the `.env` file.  

Sample `.env` file:

```env
# all values here are imported with config.js
# values with brackets '[]' are converted to json attributes (used for lists)

# set to development to see debugging info
NODE_ENV=production

# will bind all interfaces to this port
# ie. localhost:3030 or 127.0.0.1:3030
PORT=

# name of your site
# ex. mcalec-api
NAME=

# will check if either host is online and use it
HOST=
ALT_HOST=

# the base path that comes after the host (ex. example.com/gdl)
BASE_PATH=

# the path where your files are
BASE_DIR=

# never show these dirs
DISALLOWED_DIRS=[]

# never show these files
DISALLOWED_FILES=[]

# never show files with these extensions
DISALLOWED_EXTENSIONS=[]

# database dir location
DB_DIR=./db

# just make it a random phrase or something
SESSION_SECRET=

# keep it on if you like big debugs
DEBUG=gdl-api:*
```

[api.mcalec.dev](https://api.mcalec.dev/)

**Actual documentation coming soon**  

McAlec Development © 2025
