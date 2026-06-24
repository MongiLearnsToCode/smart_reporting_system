# Context: Codex — Smart Reporting System

## Setup

```bash
git clone <repo>
cd smart_reporting_system
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (admin) | Supabase Dashboard → Settings → API |
| `GROQ_API_KEY` | Groq API key for AI features | console.groq.com → API Keys |

### Database Setup

Run `supabase_init.sql` in your Supabase project's SQL Editor. This creates:
- `public.rate_limits` — distributed rate limiting
- `public.categories` — user/system categories
- `public.logs` — business log entries (with conflict tracking)
- `public.widgets` — dashboard widget configurations
- `public.user_settings` — user preferences

Enable Row Level Security (included in script) and ensure email confirmation is enabled in Supabase Auth settings.

## Development

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run typecheck    # TypeScript check (tsc --noEmit)
npm test             # Run Vitest test suite
```

## Deployment

The project deploys on Vercel. Environment variables must be configured in Vercel project settings.

**Important post-deploy steps:**
1. Configure Supabase project URL and keys in Vercel environment variables
2. Enable email confirmation in Supabase Auth settings (Settings → Authentication → General → "Confirm email" ON)
3. Apply `supabase_init.sql` to the production Supabase database
4. Set `AUTH_URL` in Supabase project settings to your Vercel deployment URL

## Testing

```bash
npm test                # Run all tests (Vitest)
npx vitest --ui         # UI mode (if @vitest/ui installed)
```

Test files live in:
- `utils/api/*.test.ts` — unit tests for validation, HTML sanitization, guards
- `test/components/*.test.tsx` — component tests
- `test/` — additional integration tests

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | No | Health check |
| `/api/csrf-token` | GET | No | CSRF token generation |
| `/api/process` | POST | Yes | Process log entry (AI extraction) |
| `/api/logs` | GET | Yes | List logs (paginated, cursor-based) |
| `/api/logs/[id]` | DELETE | Yes | Delete/revert a log |
| `/api/widgets` | GET/POST | Yes | List/create dashboard widgets |
| `/api/widgets/seed` | POST | Yes | Seed default widgets |
| `/api/categories` | GET | Yes | List user categories |
| `/api/settings` | GET/PUT | Yes | Read/update user settings |
| `/api/upload` | POST | Yes | File upload (PDF, XLSX, text) |
| `/api/export` | POST | Yes | Generate report export |

## Project Conventions

- **Imports**: Use `@/` alias for absolute imports (e.g., `@/utils/api/guards`)
- **Components**: All new components in `components/`, 'use client' directive at top
- **API Routes**: Each route file exports `GET`, `POST`, `PUT`, or `DELETE` async functions
- **Types**: Shared types in `lib/dashboard-utils.ts` (Log, Widget, UserSettings, Entities, etc.)
- **CSS**: Tailwind utility classes; global styles in `app/globals.css`
- **Security**: All mutating API routes use `assertSameOrigin()` + `requireCsrf()` + `rateLimit()`
