# Adaptive Canvas Blocks — System Overview

*Extracted and expanded from the Novos AI Reporting System PRD, for engineering and product review.*

## 1. Core Concept

Adaptive Canvas Blocks are the primary UI unit of the Novos dashboard: modular,
self-updating sections that are generated automatically from a user's structured
logs, then freely manipulated by the user like objects on a canvas.

The design principle stated in the PRD is the right lens for evaluating any
implementation decision:

> **Fluid by default, structured underneath.**

The user-facing experience should feel loose and tactile — drag, resize, rename,
delete, undo. Underneath, every block is backed by a structured, queryable data
model so that charts, summaries, and PDF exports stay accurate and traceable back
to source logs. Any implementation that sacrifices either half of that principle
(e.g. free-form blocks with no underlying schema, or a rigid schema with no fluid
manipulation) is off-spec.

## 2. Problem It Solves

Two failure modes the block system is explicitly designed to avoid:

- **Blank Canvas Problem** — a new user should never land on an empty, confusing
  dashboard. Novos auto-generates a starter canvas immediately after onboarding,
  keyed off the user's declared work type (Section 9.5 of the PRD).
- **Rigid Template Problem** — the starter canvas is a starting point, not a fixed
  layout. Every block can be moved, resized, renamed, hidden, deleted, duplicated,
  converted, or excluded from reports from the moment it appears.

## 3. Data Model

A block is a first-class Convex document, decoupled from the logs that feed it:

```json
{
  "id": "convex_id",
  "user_id": "convex_id",
  "type": "metric | chart | list | timeline | summary | source_log",
  "title": "Open Tasks",
  "query_config": {},
  "layout": { "x": 0, "y": 0, "w": 4, "h": 3 },
  "visible": true,
  "pinned": false,
  "include_in_reports": true
}
```

Key design points for implementers:

- `query_config` is where a block's data-fetch logic lives — this is what makes a
  block "adaptive" rather than static; the PRD does not fully specify its shape,
  so this is an open design question (likely category/client/date-range filters
  against the log store, possibly with an aggregation type per block type).
- `layout` is a standard grid-coordinate object (`x`, `y`, `w`, `h`), consistent
  with a library like React Grid Layout.
- `visible` and `pinned` are independent flags — hiding a block is not the same as
  deleting it, and pinning only prevents accidental drag/resize, it doesn't affect
  visibility or report inclusion.
- `include_in_reports` is the join point between the dashboard and the Reports
  system — reports reference blocks by ID (`included_block_ids` on the `report`
  document), not by copying block content, so a block's current state is always
  the source of truth at export time.

## 4. Required Block Behaviours

Every block, regardless of type, must support the same interaction contract:

| Action | Behaviour |
|---|---|
| Move | Drag to any position on the grid; ghost outline previews target location |
| Resize | Drag edge/corner handles; minimum size 2 columns × 2 rows |
| Rename | Inline-editable title, click-to-edit |
| Hide | Removed from view, data and config retained |
| Delete | Permanent removal, but with a 5-second undo toast before persistence |
| Duplicate | Creates a copy with an independent layout (not linked to the original) |
| Pin | Locks position/size against accidental drag or resize |
| Include/Exclude from report | Toggles `include_in_reports`; controls PDF export eligibility |
| View source logs | Opens the Original Log Modal listing every log contributing to the block |

Implementation note: the delete-with-undo pattern implies deletion should be a
soft, deferred mutation (e.g. a client-side pending state that only calls
`api.blocks.delete` after the 5-second window lapses, or a server-side tombstone
with a delayed hard-delete), not an immediate destructive write.

All layout mutations are persisted immediately via
`useMutation(api.blocks.updateLayout)` — there is no explicit "save" step, which
means the client needs to debounce/throttle drag and resize events to avoid
flooding Convex with writes during a single gesture.

## 5. MVP Block Types

Six block types ship in MVP. Each is a rendering strategy over the same
underlying log data, not a separate data source:

| Type | Purpose | Examples |
|---|---|---|
| **Metric** | One KPI number | Total expenses this week, revenue this month, open task count, client sentiment score |
| **Chart** | Trends/comparisons via Recharts (line, bar, pie) | Expenses by category, expenses over time, revenue by client |
| **List** | Structured list extracted from logs | Open tasks, completed tasks, risks/blockers, recent expenses |
| **Timeline** | Chronological progress view | Project milestones, weekly activity, client communication history |
| **Summary** | AI-written narrative over selected data | Weekly summary, project status summary, risk summary |
| **Source Log** | Raw log inspection, input → output mapping | Trust/verification surface — critical for user confidence in AI extraction |

Post-MVP (P1): block-to-block conversion (e.g. list → chart), AI natural-language
canvas commands ("Show only client updates", "Group by project"), and
system-suggested new blocks when a recurring data pattern is detected in logs.

## 6. Automatic Block Creation

Blocks aren't only user-created. Two automatic triggers exist:

1. **Onboarding** — on first login, the user answers "What best describes your
   work?" and Novos generates a starter canvas from a fixed mapping:

   | Work Type | Starter Blocks |
   |---|---|
   | Consultant / Freelancer | Client Updates, Open Tasks, Project Progress, Expenses, Weekly Summary |
   | Small Business Owner | Daily Operations, Expenses, Sales/Revenue, Inventory Notes, Issues/Risks, Weekly Summary |
   | Creative Professional | Active Projects, Deliverables, Client Feedback, Expenses, Risks/Blockers, Weekly Summary |
   | Marketing/Content Agency | Campaign Updates, Client Feedback, Deliverables, Content Tasks, Performance Notes, Weekly Report Summary |
   | Online Seller/E-commerce | Sales Notes, Inventory Updates, Customer Feedback, Marketing Expenses, Operational Issues, Weekly Summary |
   | Other | Tasks, Notes, Expenses, Weekly Summary |

2. **New category detection** — when a log is processed into a category the
   dashboard has no block for yet, Novos creates a new block automatically. This
   is a system-triggered write to `canvasBlock`, not a user action, and needs to
   run as part of (or immediately after) the log ingestion pipeline.

## 7. Real-Time Update Contract

Requirement #28 sets a hard SLA: blocks must reflect newly processed data within
2 seconds. Given the stated pipeline (Ingestion → Extraction → Validation →
Structuring → Presentation, run via a Groq LLM call per log), the 2-second budget
covers the full round trip from submission to a visibly updated block — this is
the tightest latency constraint in the PRD and should drive the choice of reactive
data layer. The PRD assumes Convex's reactive subscription model specifically to
meet this without manual polling or refetching.

## 8. Traceability (Trust Layer)

Every visible unit on a block — a chart point, list item, metric, or eventual
report claim — must be traceable to the log(s) that produced it. Clicking any of
these opens the **Original Log Modal**, showing:

- Original submitted text
- Submission timestamp
- Extracted entities
- Assigned category
- AI confidence score
- Any user corrections applied

This is positioned as a trust-building mechanic for an AI-extraction product, not
a debugging tool — the Source Log block type exists specifically to make this
traceability a first-class dashboard citizen rather than something buried in a
menu. Corrections and log exclusion can be actioned directly from the modal, and
must propagate back to any block or report derived from that log.

## 9. Report Integration

Blocks are the unit of selection when generating a PDF report:

- The report generation modal includes a block selector (checkboxes per block).
- Only blocks with `include_in_reports: true` are checked by default.
- Selected blocks are captured visually via `html2canvas` and assembled into the
  PDF via `react-pdf`.
- The `report` document stores `included_block_ids`, referencing blocks rather
  than duplicating their content — so report regeneration reflects each block's
  current state, not a frozen snapshot from when the report was first drafted.

This means block state and report state are only loosely coupled: deleting or
hiding a block after a report has been generated does not retroactively alter a
previously exported PDF (which is a static file in Supabase Storage/wherever
PDFs land), but would affect any *future* regeneration referencing that block ID.
Worth confirming this dangling-reference behaviour explicitly in engineering,
since the PRD doesn't specify what happens if `included_block_ids` points at a
deleted block on regeneration.

## 10. Tiering

Block *capability* — not block count — is the axis used for monetisation:

| Tier | Block Access |
|---|---|
| Free | All 6 block types |
| Starter (~$9/mo) | All 6 types + block-to-block conversion |
| Pro (~$19–29/mo) | All 6 types + AI natural-language canvas commands |

Notably, the free tier already gets the full block type set — the upsell is
around *manipulation power* (conversion, AI commands), not access to
functionality. This is a deliberate product bet that block flexibility, not
block variety, is the premium feature.

## 11. Open Questions for Engineering

Gaps in the PRD worth resolving before implementation:

1. **`query_config` schema** — undefined. Needs a design pass per block type
   (e.g. Metric needs an aggregation function + filter set; Chart needs a
   grouping dimension + metric; List needs a filter + sort).
2. **Duplicate semantics** — "independent layout" is specified, but it's unclear
   whether a duplicated block also gets an independent `query_config` (i.e. can
   diverge in what data it shows) or only diverges in position/size.
3. **Auto-created block placement** — when a new category triggers an automatic
   block, where does it land on the grid? Needs a placement algorithm (append to
   next free row, or prompt the user).
4. **Dangling block references in reports** — see Section 9 above.
5. **Debounce strategy for `updateLayout`** — drag/resize gestures firing a
   mutation on every frame vs. on gesture-end needs an explicit decision, since
   the PRD states persistence is immediate.
