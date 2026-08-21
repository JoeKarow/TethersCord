# TethersCord Instructions

## Project layout

- `client/` is an Elm 0.19 application built with Vite.
- `worker/` is a TypeScript Cloudflare Worker using Wrangler.
- Keep client and worker responsibilities separate.
- Prefer existing project patterns and minimal, focused changes.
- Goal is to make a Discord Application to run my custom TTRPG with my friends. The application will be used to manage the game, including character sheets, dice rolls, and other game mechanics.

## Elm

- Use idiomatic Elm architecture: model, message, update, view.
- Avoid JavaScript interop unless required; keep ports narrow and typed.
- Run client checks after Elm changes:
  - `cd client && npm run build`
  - Run Elm tests when present.

## Worker

- Keep request validation and authorization explicit.
- Preserve TypeScript strictness and Cloudflare Worker compatibility.
- Run `cd worker && npm run build` after Worker changes.
- Use `cd worker && npx wrangler dev` for local runtime verification.
- Only run `npm run deploy` when explicitly asked.

## General

- Do not modify generated files in `elm-stuff/`.
- Do not change migrations already applied; create a new migration instead.
- Before editing, inspect the relevant local code and tests.
- After edits, run the narrowest relevant validation command.
- Do not commit, push, reset, or discard unrelated workspace changes unless explicitly asked.
