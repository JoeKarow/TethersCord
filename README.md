# TTRPG Discord Activity

A Discord Activity for running TTRPG sessions with a shared message board,
built with:

- Elm + Vite for the front-end (Activity iframe)
- Cloudflare Workers + Durable Objects + D1 for backend state
- Discord Embedded App SDK + OAuth2 for real user IDs and roles (DM vs player)

## Structure

- `client/` – Elm single-page app (Activity UI)
- `worker/` – Cloudflare Worker backend
  - Durable Object per table/session
  - D1 (SQLite) for messages and auth

## Prerequisites

- Node 18+ (or compatible)
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account
- Discord Developer Portal application configured as an Activity

## Setup

1. Install dependencies:

   ```bash
   cd client
   npm install
   cd ../worker
   npm install
   ```
