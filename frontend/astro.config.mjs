// @ts-check
import { defineConfig } from 'astro/config';
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
import dotenv from 'dotenv';
dotenv.config();
const HOST = process.env.HOST;
const siteUrl = HOST?.startsWith('http') ? HOST : `https://${HOST}`;
// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  integrations: [svelte(), sitemap()],
});