# Winter Arc

A mobile-first habit tracker built with React, Vite, TypeScript, Tailwind CSS, and Supabase.

## Project structure

- `src/App.tsx` — authentication, onboarding, responsive dashboard, and habit flows
- `src/services/tracker.ts` — Supabase reads and writes scoped to the signed-in user
- `src/lib/calculations.ts` — date, daily completion, and streak calculations
- `src/types.ts` — shared app data types
- `supabase/schema.sql` — tables, indexes, ownership checks, and RLS for new projects
- `supabase/migrations/20260930_add_profile_motto.sql` — adds the optional profile motto to an existing project

## Supabase setup

1. Create a Supabase project.
2. For a new project, run `supabase/schema.sql` in the project's SQL Editor. For an existing project, apply `supabase/migrations/20260930_add_profile_motto.sql` once instead of rerunning the schema.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key.
4. In Supabase Authentication settings, configure the site URL and email confirmation behavior for your environment.
5. Start the app with `npm run dev`.

The frontend uses the public anon key only. Never put a service-role key in a `VITE_` variable. Row Level Security policies bind profiles, habits, and completions to `auth.uid()`. `.env.local` is ignored by Git; configure deployment variables in the hosting provider instead of committing local credentials.

## Deploy to Vercel

1. Push the project to a Git provider and import the repository in Vercel.
2. Keep the detected Vite settings: build command `npm run build`, output directory `dist`, and install command `npm install`.
3. In **Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production (and Preview if wanted). Use only the Supabase public anon/publishable key, never the service-role key.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the production URL and add preview URLs to Redirect URLs if using email confirmation there.
5. Deploy. `vercel.json` sends app routes such as `/progress`, `/calendar`, and `/settings` to the SPA entry point.

## Deploy to Netlify

1. Import the repository from Git in Netlify.
2. Set build command `npm run build` and publish directory `dist`.
3. In **Site configuration → Environment variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the deploy context. Use only the public anon/publishable key.
4. Add the production URL and any email-confirmation redirects under Supabase **Authentication → URL Configuration**.
5. Deploy. `public/_redirects` provides the SPA fallback for direct app routes.

Vite embeds `VITE_` values in the built frontend, so they are public by design. The anon key is safe only with the project’s RLS policies enabled. Do not add privileged credentials to these variables.

## Install and offline behavior

The production build includes a web app manifest, install icons, and a service worker. After the first successful online visit, the browser can keep the app shell and built assets available for launch. Habit data still requires a connection and a signed-in Supabase session; authenticated API responses are not cached. This release does not request notification permission or schedule reminders.

## Commands

- `npm run dev` — local development server
- `npm run build` — TypeScript project build and production bundle
- `npm run lint` — Oxlint

## Phase 1 functionality

Email/password sign-up and sign-in, arc setup, habit creation/edit/archive, boolean completion, numeric/duration targets, profile and Arc editing, `/progress`, `/calendar`, and `/settings`. Progress and calendar use an authenticated arc-range completion fetch and in-memory calculations. Arc date changes warn when saved completions fall outside the new dates; the records remain stored. Sleep/weight logs, check-ins, notifications, and export are not included.
