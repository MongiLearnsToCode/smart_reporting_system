# Convex Setup — Adaptive Canvas Blocks migration

The blocks + logs data layer runs on **Convex** (the reactive store the spec is
built around). Supabase is retained for **auth** and **file storage**. This doc is
the provisioning checklist — a few steps require your interactive login and the
Supabase dashboard, so they can't be scripted.

## One-time provisioning

1. **Provision the Convex deployment** (opens a browser to log in):
   ```bash
   npx convex dev
   ```
   This creates the deployment, generates `convex/_generated/`, pushes the schema
   and functions, and writes `NEXT_PUBLIC_CONVEX_URL` (+ `CONVEX_DEPLOYMENT`) into
   `.env.local`. Leave it running while developing — it live-pushes function edits.

2. **Enable asymmetric JWT signing in Supabase** (required for the auth bridge):
   Supabase Dashboard → Project Settings → **JWT Keys** → switch to an asymmetric
   key (RS256/ES256) and make it the current signing key. This publishes a JWKS at
   `https://eitfdhcmdzsieudrwkhm.supabase.co/auth/v1/.well-known/jwks.json`, which
   Convex uses to verify session tokens. Without this, Convex cannot authenticate
   users and every block/log query returns empty.

3. **Verify the auth bridge**: sign in, open the app, and confirm in the Convex
   dashboard logs that queries carry an identity (no "Unauthenticated" errors).

## Data migration (once, after step 1)

Copy existing Supabase logs/widgets into Convex:

1. Set a shared secret in the Convex dashboard (Settings → Environment Variables):
   `MIGRATION_SECRET=<random string>`.
2. Export the same secret plus keys locally, then run:
   ```bash
   MIGRATION_SECRET=<same> npx tsx scripts/migrate-to-convex.ts
   ```
   It prints imported log/block counts. Idempotent (safe to re-run).
3. Once verified, delete `convex/migrate.ts` and the secret.

## What's implemented so far (data layer — Phases 0-2, 7)

- `convex/schema.ts` — `canvasBlocks`, `logs`, `reports` tables (full spec §3 model).
- `convex/auth.config.ts` + `utils/convex/useConvexAuthFromSupabase.ts` — Supabase→Convex auth bridge.
- `app/Providers.tsx` — Convex client mounted (passthrough until `NEXT_PUBLIC_CONVEX_URL` is set).
- `convex/blocks.ts` — full §4 behaviour contract (create, updateLayout, rename, hide,
  pin, duplicate, toggleReport, soft-delete + restore + undo purge via `convex/crons.ts`).
- `convex/logs.ts` — reactive `list`, `ingest` (with §6 auto-block creation),
  `applyCorrection`, `setExcluded`, plus context queries for extraction.
- `app/api/process/route.ts` — Groq extraction now reads context from and writes to
  Convex (reactive ≤2s path, spec §7).
- `utils/convex/adapters.ts` — maps Convex docs onto existing Log/Widget shapes.
- `scripts/migrate-to-convex.ts` — one-time Supabase import.

## Done — Phase 3 (canvas dashboard)

- `components/block-canvas.tsx` — `react-grid-layout` (v1) canvas driven by
  `useBlocks()`/`useLogs()`, full §4 gesture contract: drag (handle), resize (min 2×2),
  inline rename, hide + hidden tray, pin (locks), duplicate, delete-with-5s-undo toast,
  include/exclude toggle, view-source. Layout persists on gesture-end (§11 Q5).
- `app/page.tsx` — logs/blocks now come from Convex (reactive); masonry replaced by
  `<BlockCanvas>`; conflict-revert uses `api.logs.remove`; time-travel slider kept as a
  client filter. `utils/convex/hooks.ts` wraps the block/log queries + mutations.
- Verified: `npm run typecheck` clean; `npx convex dev --once` deploys all functions.

## Done — Phase 5 (onboarding + trust)

- `convex/blocks.ts` `seedStarter` + `app/onboarding/page.tsx` — spec §6 six work-type
  starter canvas (Consultant/Freelancer, Small Business, Creative, Marketing Agency,
  Online Seller, Other), laid out via `packGrid`. Replaces `/api/widgets/seed`.
- `components/log-preview-modal.tsx` — now the Original Log Modal (spec §8): raw text,
  timestamp, category, AI-confidence badge, extracted entities, corrections history, and
  inline correct-category / exclude actions (`api.logs.applyCorrection` / `setExcluded`).
  Derived blocks update reactively.

## Still to build (UI phases)

- **Phase 4** — richer block types: `summary` (AI narrative via Groq action); `timeline`
  and `source_log` have interim renderings in the canvas already.
- **Phase 6** — report block-selector + `html-to-image`/`@react-pdf/renderer` export.
- **Phase 8** — tiering + P1 (conversion, NL commands).

> Note: `app/api/widgets/*` (seed/list/patch/delete) are now orphaned dead code — the
> canvas + onboarding use Convex. Safe to delete in a cleanup pass.
