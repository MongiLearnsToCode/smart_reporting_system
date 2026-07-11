# Product Requirements Document: Codex — Daily Logs into Client Reports

## Positioning
Codex is a **reporting employee** for consultants and small agencies: dump raw daily
work logs, expenses, and client notes into one composer, and Codex turns them into
client-ready reports on demand. No bookkeeping knowledge required — Codex decides
what each entry means, who it's for, and where it belongs.

Explicitly **not** generic BI, and **not** an accounting system. The long-term arc
(auto ledger/journal/P&L intelligence) waits until the log corpus and user trust
justify it.

## Target Users
- Solo consultants and small agencies (2–15 people) who must report work and spend
  to clients on a weekly/monthly cadence
- The person at an agency whose job is "collect what everyone did and turn it into
  the client update"

## Core Loop
1. **Capture** — free-text or file (PDF/XLSX/CSV/TXT/image) into the composer,
   < 30 seconds per entry. AI extracts category, client, amounts, sentiment, urgency.
2. **See** — one live dashboard: widgets per category, log feed filterable by
   category **and client**. The dashboard is the consultant's private view.
3. **Deliver** — generate a **client-ready report** for any client + period
   (this week / this month / last 30 days): AI-written summary, work highlights,
   financials, next steps. Branded HTML, downloadable and shareable via link.
   The report is the deliverable; it must be forwardable to a client without
   embarrassment.

## Features

### 1. Business Logging (capture)
- Free-text input with multi-file staging, drag-drop, paste-image
- AI category assignment + entity extraction (amount, currency, date, sentiment,
  urgency, names, tags, **client**) via Groq LLM
- Client names normalized against the user's existing clients

### 2. Client Spine
- Every log is attributed to a client when one is identifiable (stored in
  `entities.client`; no schema migration required)
- Client filter chips in the log feed alongside category filters
- Client list derived from log history

### 3. Reports Center (hero)
- Generate per-client (or all-clients) report for a chosen period
- Report sections: executive summary, work highlights by category, financial
  summary (amounts logged), next steps — AI-written, professionally rendered HTML
- Stored per user in Supabase Storage; past reports listed with regeneratable
  share links (signed URLs, 7-day expiry)
- Download as HTML; share as link

### 4. Dashboard & Widgets
- Auto-created widgets per category (metric / chart / list), rename/delete, sorting
- Log feed with category + client filters, conflict badges, time-travel snapshot
- Conflict detection (AI duplicate comparison) with keep/revert

### 5. User Management
- Email/password auth with verification (Supabase), server-side session gate
- Settings: currency, timezone, AI language, conflict detection, density, retention

## Success Criteria
- Log a business update in < 30 seconds
- Generate a client-ready report in < 15 seconds from one click
- AI client attribution accuracy > 85% on entries that name a client
- Dashboard loads in < 2 seconds
- Zero security regressions (CSRF, rate limiting, magic-byte upload validation)

## Non-Goals (v1)
- Accounting outputs (ledger/journal/P&L) — later arc, not the wedge
- Scheduled/emailed report delivery (cadence is manual presets for now)
- Multi-tenant organizations, RBAC, real-time collaboration
- Mobile native apps (responsive web only)
