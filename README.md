# Kliq

Desktop monitor for one YouTube channel. It keeps a local history, compares each Monday–Sunday week with the previous one, and can summarize that week with a model key you supply.

The interface is English or Spanish. On first launch it follows the operating system language.

## Run

```bash
npm install
npm run dev
```

If Linux refuses to start the Chromium sandbox, launch with:

```bash
npx electron-vite dev -- --no-sandbox
```

The renderer sandbox stays on. Tests:

```bash
npm test
```

A Linux AppImage and `.deb` land in `release/` after:

```bash
npm run dist
```

## YouTube sign-in

Create an OAuth client of type **Desktop** in Google Cloud Console and enable YouTube Data API v3 and YouTube Analytics API. In Kliq, open Connection, paste the client id and secret, and choose Connect. The system browser returns to `http://127.0.0.1` on a free port. The refresh token is stored in the OS keychain.

Scopes are read-only: `youtube.readonly` and `yt-analytics.readonly`.

If Google does not return a refresh token, remove Kliq at [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and connect again.

## Your own model key

The weekly summary uses a key you enter on the Connection page. Anthropic and OpenAI require a key. An OpenAI-compatible server (Ollama, LM Studio) can run without one. The window only shows the last four characters. An external agent does not receive this key.

## Agent access (MCP)

Off by default. When you enable it, Kliq listens on `127.0.0.1` only (port 47321 unless you change it) and requires a bearer token. Rotate the token from Connection, then copy the Cursor config. It looks like this:

```json
{
  "mcpServers": {
    "kliq": {
      "url": "http://127.0.0.1:47321/mcp",
      "headers": {
        "Authorization": "Bearer <token shown once in Kliq>"
      }
    }
  }
}
```

The tools can read the channel, start a sync, fetch retention, and import a Studio impressions CSV. They cannot run SQL, disconnect the account, or return tokens and API keys.

## While the app is open

A sync runs at minute 7 of the hour you set (default 06:07 in `America/Argentina/Buenos_Aires`). It does not run after you quit. The first sync pulls 120 days. Later syncs refresh 28 days.

Impressions and click-through rate are not in the API. Export them from YouTube Studio and import the CSV on the Connection page.

The database is `monitor.db` in Electron's userData directory. Secrets live in the OS keychain, not in that file.
