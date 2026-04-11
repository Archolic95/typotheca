# Typotheca Frontend

Next.js 16 (App Router) + Tailwind CSS v4 + Supabase + Cloudflare R2.

## Commands

```bash
nvm use 20           # requires Node 20+
npm run dev          # start dev server
npm run build        # production build
```

## Architecture

5 routes:
- `/gallery` — Server-rendered filterable grid/list of objects, infinite scroll
- `/database` — Client-rendered virtualized table (13.6K rows), inline editing
- `/monitor` — Client-rendered dashboard with Supabase Realtime subscriptions
- `/watchlist` — Client-rendered priority product tracker with 30s polling
- `/feed` — Server-rendered chronological drop feed with cursor pagination

## Data

- Supabase `objects` table (13.6K rows) — main data, public SELECT via RLS
- Supabase `monitor_state` table — live monitor state, RLS disabled
- Supabase `scraper_health` — monitor health checks
- Cloudflare R2 bucket `typotheca` — 35K product images at `{site}/{slug}/image-N.ext`

## Supabase Clients

Three clients for three contexts:
- `src/lib/supabase/client.ts` — Browser (anon key, singleton)
- `src/lib/supabase/server.ts` — Server components (anon key via @supabase/ssr)
- `src/lib/supabase/service.ts` — API routes only (service key, for writes)

## API Route

`/api/objects/[id]` — GET (full object with relations) and PATCH (inline edits, field-whitelisted).

## Env Vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_R2_PUBLIC_URL=
```
