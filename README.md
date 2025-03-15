# gdl-api

**IF YOU WANT YOUR CONTENT REMOVED EMAIL: privacy[at]mcalec[dot]dev**

a quick restful api i made for my gallery-dl downloads.
t.w mostly furries and some trigger content for those (iykyk).  
*hopefully no nsfw, if there is, let me know if there is at hello[at]mcalec[dot]dev*  

pm2 is supported, `pm2 start gdl-api`. edit your config in the `.env` file.  

collections endpoint: `https://api.mcalec.dev/gdl/api/collections` (where the folders are)
files endpoint: `https://api.mcalec.dev/gdl/api/files` (where the files are actually hosted)

example commands you can use:

PowerShell opens firefox
`$request = irm https://api.mcalec.dev/gdl/api/{your-endpoint-here} && firefox $request.directUrl`

bash curl also opens firefox
`curl -s "https://api.mcalec.dev/gdl/api/{your-endpoint-here}" | jq -r '.directUrl' | xargs firefox`

**actual documentation coming soon**  

McAlec Development © 2022-2025
