# gdl-api

**CONTENT REMOVAL: removals[at]mcalec[dot]dev**

A quick RESTful API I made for my gallery-dl downloads.  

PM2 is supported, `pm2 start gdl-api`. Edit your config in the `.env` file.  

Collections endpoint: `https://api.mcalec.dev/gdl/api/collections` (where the folders are)
files endpoint: `https://api.mcalec.dev/gdl/api/files` (where the files are actually hosted)

Example commands you can use:
PowerShell opens Firefox
`$request = irm https://api.mcalec.dev/gdl/api/{your-endpoint-here} && firefox $request.directUrl`

Bash curl also opens Firefox
`curl -s "https://api.mcalec.dev/gdl/api/{your-endpoint-here}" | jq -r '.directUrl' | xargs firefox`

There is a front end [api.mcalec.dev/gdl/](https://api.mcalec.dev/gdl/)

**Actual documentation coming soon**  

McAlec Development © 2022-2025
