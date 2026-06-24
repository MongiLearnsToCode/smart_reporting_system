# Architecture: Codex — Smart Reporting System

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + shadcn/ui primitives |
| Animations | Framer Motion |
| State / Data | TanStack Query (React Query v5) |
| Database | Supabase (Postgres) |
| Auth | Supabase SSR (cookies) |
| AI | Groq Chat Completions API |
| Charts | Recharts |
| Testing | Vitest + Testing Library |
| Deployment | Vercel |

## Directory Structure

```
app/                    # Next.js App Router pages & API routes
  account/signin/       # Login page
  account/signup/       # Registration with email verification
  api/                  # 11 REST API route handlers
  auth/callback/        # Supabase email verification callback
  onboarding/           # First-time user onboarding
  widget/[category]/    # Per-category widget detail page
components/             # 7 extracted React components
lib/                    # Shared types & constants
utils/                  # Business logic, API helpers, hooks
  api/                  # Guards (CSRF, rate limit), validation, HTML sanitization, Groq client
  client-integrations/  # Re-exports for shadcn, recharts, etc.
  supabase/             # Server/client/admin Supabase clients
  useAuth.js            # Auth hooks (signup, signin, signout)
  useUser.js            # Current user query
  useUpload.js          # File upload hook
  useHandleStreamResponse.js # Groq streaming response handler
  logger.ts             # Structured JSON logger
test/                   # Vitest test files
middleware.ts           # Supabase SSR auth guard (redirects unauthenticated users)
```

## Data Flow

```
User Input (text/file) → /api/process → Groq AI (extract category + entities)
  → Validate → Write to Supabase (logs, categories)
  → Conflict detection (compare recent logs via Groq)
  → Return result

Dashboard Load → React Query fetches:
  1. /api/logs — recent log entries (paginated, cursor-based)
  2. /api/widgets — user's dashboard widgets
  3. /api/categories — user's categories
  4. /api/settings — user preferences

Export → /api/export → Query logs → Render HTML template → Return blob
```

## Auth Strategy
- **Middleware**: Server-side session check via Supabase SSR. Public: signin, signup, CSRF token, auth callback, and all `/api/*` routes.
- **API Routes**: Each route calls `supabase.auth.getUser()` to verify session.
- **CSRF**: Double-submit cookie pattern — token in `csrf-token` cookie + `x-csrf-token` header validated server-side.
- **Rate Limiting**: Hybrid Supabase DB + in-memory fallback for distributed persistence.

## Security Measures
- CSRF double-submit cookie + origin check
- Rate limiting per IP (30 req/min default)
- File upload MIME type + magic byte validation (PDF, XLSX, text)
- Password policy (min 8 chars, letter + number)
- Input validation & sanitization on all API payloads (whitelist-based)
- HTML output escaping for report generation
- Security headers via `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Permissions-Policy)

## Key Dependencies
| Package | Purpose |
|---|---|
| `@supabase/ssr` | Server-side auth session management |
| `@tanstack/react-query` | Server state caching & mutations |
| `framer-motion` | Component animations |
| `recharts` | Chart widgets (line, bar) |
| `lucide-react` | Icon library (replaced Font Awesome) |
| `groq-sdk` | AI entity extraction |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Widget drag-and-drop |
| `sonner` | Toast notifications |
| `papaparse` | CSV parsing |
