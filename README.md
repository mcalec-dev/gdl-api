# gdl-api

**CONTENT REMOVAL: removals[at]mcalec[dot]dev**

A RESTful API I made for gallery-dl downloads. (it's poorly made)  

Swagger documentation accessible at `/docs`

Make sure to download [MongoDB](https://www.mongodb.com/try/download/community)

Sample `.env` file:

```env
# all values here are imported with config.js
# values with brackets '[]' are converted to json attributes (used for lists)

# set to development to see debugging info
NODE_ENV=production

# will bind all interfaces to this port
# default is 3030
PORT=3030

# name of your site
# default is gdl-api
NAME=gdl-api

# will check if either host is online and use it
HOST=
ALT_HOST=

# the base path that comes after the host
# leave as / if you dont know what to put
BASE_PATH=

# the path where your files are
BASE_DIR=

# never show these dirs
DISALLOWED_DIRS=[]

# never show these files
DISALLOWED_FILES=[]

# never show files with these extensions
DISALLOWED_EXTENSIONS=[]

# the url to your mongodb instance
# default is mongodb://127.0.0.1:27017/{your_db_name}
MONGODB_URL=mongodb://127.0.0.1:27017/gdl

# session secret for express-session
# change this to something else in production
SESSION_SECRET=devsecret

# github application credentials
# create an application at https://github.com/settings/developers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# discord application credentials
# create an application at https://discord.com/developers/applications
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# keep it on if you like big debugs
DEBUG=gdl-api:*
```

**Actual documentation coming soon**  

McAlec Development © 2025
