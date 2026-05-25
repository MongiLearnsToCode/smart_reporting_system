# Smart Reporting System

Codex is a Next.js app for logging business updates, extracting structured data with Groq, and presenting the results as a reporting dashboard.

## Stack

- Next.js App Router
- Supabase Auth, Postgres, and Storage
- Groq chat completions
- TanStack Query
- Vitest

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`

4. Apply `supabase_init.sql` to the Supabase project.

5. Create a Supabase Storage bucket named `uploads`. Keep it private; the app returns signed URLs for uploaded files.

6. Run locally:

   ```bash
   bun run dev
   ```

## Verification

```bash
bun run typecheck
bunx vitest run
bun run build
bun audit
```

## Notes

- API routes enforce Supabase authentication server-side.
- Mutating routes reject cross-origin browser requests.
- Uploads are limited to text, CSV, PDF, and XLSX files up to 10 MB.
- Report exports are HTML downloads with escaped user and AI content.
