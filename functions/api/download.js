{
  "name": "tiktok-downloader",
  "version": "1.0.0",
  "description": "TikTok video downloader - Original quality, no watermark",
  "private": true,
  "scripts": {
    "dev": "wrangler pages dev . --port 8788",
    "deploy": "wrangler pages deploy . --project-name tiktok-downloader",
    "logs": "wrangler pages deployment tail"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
