# gdl-api

an express api thing i made mainly for gallery-dl downloads.  

Swagger documentation accessible at `/docs/`

make sure to download [MongoDB](https://www.mongodb.com/try/download/community)

your local directory sturcture should be look similar this:

```text
base-dir/
└─ collection/
  └─ author/
    ├─ files.png
    ├─ files.mp4
    └─ etc...
```

sample `.env` file:

```env
# imported with config.js
# values with brackets are json values

# set to development to see debugging info
NODE_ENV=production

# will bind all interfaces to this port
# default is 3030
PORT=3030

# name of your site
NAME=

# will check if either host is online and use it
HOST=
ALT_HOST=

# the base path that comes after the host
# leave blank if you want the default
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
# e.g mongodb://127.0.0.1:27017/{your_db_name}
MONGODB_URL=

# secrets for sessions and csrf
# change this to something else in production
SESSION_SECRET=
CSRF_SECRET=

# session & csrf max cookie age
# in days, hours, minutes, etc
# ex. 30d, 30m, 12h, 1h
COOKIE_MAX_AGE=

# the max depth for recursive scanning
MAX_DEPTH=

# the rate limit time window in minutes
# e.g 1m, 10m, 30m, etc
RATE_LIMIT_WINDOW=

# max amount of requests per window
RATE_LIMIT_MAX=

# trolling middleware values
TROLLING_CHANCE=
TROLLING_TERMS=[]

# bot/crawler user agents
BOT_USER_AGENTS=[]

# boolean value (true/false)
# turn off if you want to scan when directory or file is accessed
# else leave on for a full fs database scan
AUTO_SCAN=

# github application credentials
# create an application at https://github.com/settings/developers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# discord application credentials
# create an application at https://discord.com/developers/applications
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# turns on debugging features (boolean)
DEBUG=
```

**actual documentation coming soon**  

McAlec Development © 2025
