# Extraction & Trust Upgrade — Design

**Date:** 2026-07-12
**Status:** Approved by user (brainstorming session)
**Sub-project 1 of 3** in adopting the Novos PRD (`0001-prd-novos-ai-reporting-system.md`) into this app. Sub-project 2 is the Adaptive Canvas Blocks system (`adaptive-canvas-blocks-system.md`); sub-project 3 is the report upgrade (block selection, editable summary, PDF). Each gets its own spec and plan.

## Goal

Bring the AI extraction pipeline and trust surfaces up to the Novos PRD Phase-1 bar: multi-entity extraction in the PRD schema, confidence scoring with a review prompt, a user-correction loop with an audit trail, and report exclusion — so that the canvas-blocks phase has rich, correctable data to build on.

## Decisions made during brainstorming

1. **Sequencing:** extraction & trust first, then canvas blocks, then reports. Monetisation (PRD Phase 4) deferred indefinitely.
2. **Migrations:** the user runs migration SQL in the Supabase dashboard SQL editor (the agent cannot run DDL). One migration file per phase.
3. **Categories:** adopt the PRD set — Finance, Projects, Clients, Tasks, Operations, Marketing, Other. One-time remap: Inventory → Operations, Team → Operations.
4. **Branding:** keep "Codex" for now; PRD copy is adapted ("Codex thinks this is…"). A rename pass to Novos happens later when the launch name is final.
5. **Entity storage:** Approach C — `logs.entities` becomes a JSONB **array** of entity objects with log-level columns for overall state. Not a separate `extracted_entities` table (heaviest rework; can be promoted later mechanically), not single-entity-in-place (forfeits multi-entity pastes).

## Data model

### Migration (user-run SQL)

```sql
alter table public.logs
  add column if not exists ai_confidence numeric,
  add column if not exists processing_status text not null default 'processed',
  add column if not exists excluded_from_reports boolean not null default false;
```

Plus a data pass in the same migration:

- Remap `Inventory`/`Team` → `Operations` in `logs.category`, inside existing `entities` JSONB, and in `widgets.config->>'category'`.
- Wrap each existing single-object `entities` value into a one-element array: infer `type` (`amount` present → `expense`, else `note`), set `confidence: 0.8`, carry existing fields through, set entity `category` from `logs.category`, and set the row's `ai_confidence` to 0.8 (existing logs stay `processed`, never `needs_review`).
- `supabase_init.sql` is updated to document the final schema for fresh installs.

### Entity object schema (each element of `logs.entities`)

```json
{
  "type": "expense|income|task|client_update|project_update|risk|note",
  "category": "Finance|Projects|Clients|Tasks|Operations|Marketing|Other",
  "date": "ISO8601 or null",
  "date_reference": "verbatim natural-language reference, or null",
  "amount": 850, "currency": "ZAR",
  "client": "string or null", "project": "string or null",
  "task": "string or null", "status": "open|in_progress|complete|blocked|null",
  "issue_or_risk": "string or null", "deliverable": "string or null",
  "sentiment": "positive|neutral|negative|null", "urgency": "low|medium|high|null",
  "confidence": 0.91,
  "corrections": { "<field>": { "from": "<old>", "to": "<new>", "at": "ISO8601" } }
}
```

### Log-level semantics

- `logs.category` stays and means **primary category** = category of the highest-confidence entity. Feed badges, filters, conflict detection, and widget derivations keep reading it.
- `ai_confidence` = minimum of entity confidences (a chain is as trustworthy as its weakest extraction).
- `processing_status`: `pending | processed | needs_review | failed`. `needs_review` when `ai_confidence < 0.75`. Corrections flip `needs_review` → `processed`.
- `excluded_from_reports`: log is preserved and visible on the dashboard but skipped by the reports API.

### Categories & colors (`lib/categories.ts`)

Finance green, Projects blue, Clients purple, Tasks orange (PRD 15.5); Operations cyan, Marketing pink, Other zinc (reusing the existing palette). Inventory and Team entries removed.

## Extraction pipeline (`/api/process`)

Route shape, CSRF/rate-limit guards, and server-side UTC timestamping are unchanged.

1. **Tiered model routing** — `callGroq(messages, model)` gains a model parameter. Router: input < ~300 chars and no file text → `llama-3.1-8b-instant`; otherwise `llama-3.3-70b-versatile`. Reports stay on the 70B. **Deliberate deviation from the PRD:** no DeepSeek R1 Distill for complex inputs — reasoning-model latency works against the 2-second budget and the 70B already handles extraction.
2. **Prompt** — asks for a JSON array of entities in the schema above, with explicit instructions to split multi-update pastes into separate entities and to normalize client names against the user's known clients (existing behavior preserved).
3. **Normalizer** — server-side validation of every entity before DB write: enum fields coerced or nulled, amounts to numbers, confidence clamped 0–1, unknown categories → `Other`, non-array/garbage output → single `note` entity fallback. Same defensive pattern as `normalizeReportSections`.
4. **Date resolution** — LLM returns `date_reference` verbatim plus best-guess ISO `date`; the server deterministically recomputes the date from the reference relative to submission time in the user's timezone (from settings), overriding the LLM guess when the reference parses. Unparseable references keep the LLM date or null.
5. **Confidence & status** — computed as above; low confidence never blocks submission (PRD 10.5).
6. **Validation stage** — existing conflict detection runs unchanged on the primary category.
7. **Failure path** — Groq errors save the log with `processing_status: 'failed'` and raw content intact; the feed shows a Retry chip that calls `POST /api/process` with `{ logId }`, which re-runs extraction on the stored raw content and updates the same row (instead of creating a new log). Today a failure only toasts and the structured data is lost.

## Correction loop & trust UX

### Feed chips (`log-feed-item.tsx`)

- `processed`: today's category badge.
- `needs_review`: grey dashed chip — *"proposed: Finance · review"* — clicking opens the Original Log Modal.
- `failed`: rose chip — *"Failed · retry"* — clicking re-runs processing.

### Original Log Modal (evolves `log-preview-modal.tsx`)

Keeps the control-room design language. Adds:

- Header: input-type icon (text/file), color-coded confidence badge (emerald > 0.85, amber 0.75–0.85, rose < 0.75).
- One card per entity (replacing the single Extracted Data grid), each with inline correction controls: category / entity-type / status as Selects; amount, date, client, project, task as inputs (date as a date input); all pre-filled. This covers the PRD Req 19 field list exactly.
- Corrected fields show a small "corrected" marker with the original value (from the `corrections` audit).
- Footer: "Exclude from reports" switch.

### Correction endpoint

`PATCH /api/logs/[id]` (new handler beside the existing DELETE): merges corrections into the target entity, records the audit entry per field, recomputes `logs.category` (primary), flips `needs_review` → `processed`, and toggles `excluded_from_reports`. `ai_confidence` is **not** recomputed — confidence describes the AI's output; corrections describe the user's. React-query invalidation propagates changes to feed, filters, and widgets immediately (Req 20) with no new real-time machinery.

## Compatibility

- New accessor layer in `lib/dashboard-utils`: `primaryEntity(log)`, `logClients(log)`, `logAmount(log)`, etc. All consumers of `log.entities.X` (feed badges, `uniqueClients`, `getWidgetData`, reports API, widget detail page) move to the accessors — one place understands the array shape.
- Reports API additionally filters `excluded_from_reports = false`.
- Chart/list/metric widgets keep working off the primary category until the canvas-blocks phase replaces them.

## Testing

- **Unit:** entity normalizer (table-driven malformed-LLM-output cases), date-reference resolver (timezone edges: "yesterday" across midnight, "last Friday" on a Friday), correction merge + audit + primary-category recompute, category remap helper.
- **Component:** review-chip states (processed / needs_review / failed), modal correction flow (edit → save → corrected marker → status flip).
- Existing 49 tests stay green (composer and report-html untouched).

## Out of scope (later sub-projects)

- Canvas blocks: grid, 6 block types, 9 behaviors, starter canvases, new-category auto-blocks (sub-project 2).
- Report upgrade: block selector, `included_block_ids`, editable executive summary, PDF export, source-log appendix (sub-project 3).
- Proposed-**new**-category flow (PRD 10.5 accept/merge/dismiss) — deferred to the blocks phase, where auto-block creation needs it.
- Voice transcription, file entity parsing beyond current file-text behavior, tier limits, GDPR export/delete.
