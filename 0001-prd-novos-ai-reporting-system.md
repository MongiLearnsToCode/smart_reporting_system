# Product Requirements Document: Novos — AI Business Logbook & Reporting System

**Version:** 2.0
**Last Updated:** May 2026
**Filename:** `0001-prd-novos-ai-reporting-system.md`
**Target Directory:** `/tasks/`

---

## 1. Introduction / Overview

**Novos** is an AI-powered daily business logbook that converts messy business activity into a live dashboard and professional client-ready reports.

**Core commercial promise:**
> Speak, paste, or upload messy business information, and Novos instantly turns it into a clean dashboard and professional PDF report.

**User-facing tagline:**
> Log once. Dashboard updates automatically. Report is ready when you need it.

**Problem Statement:**
Business owners, freelancers, and consultants waste significant time manually organising information scattered across WhatsApp threads, email inboxes, voice notes, and spreadsheets — just to produce a coherent weekly or monthly business report. The friction between capturing real-world business activity and producing polished reporting slows decision-making, weakens client communication, and creates invisible admin drag.

**Solution:**
Novos provides a single universal input bar where users log messy business activity in any format they naturally use. AI automatically structures and categorises each log into an **Adaptive Canvas Dashboard** — a fluid, live view of the user's business — and generates professional PDF reports on demand, ready to send to a client, partner, manager, or funder.

**The product should feel like:**
> A living business notebook that quietly organises itself into a report.

---

## 2. Product Positioning

### What Novos Is

Novos competes initially as an **AI business logging and reporting assistant** for solo operators, consultants, freelancers, creative professionals, and micro-agencies.

**Sharper positioning:**
- An AI daily business logbook
- An automated client report generator
- A living dashboard built from your own words
- A professional reporting shortcut for people who hate admin

### What Novos Is Not

Do not position Novos as:
- An AI business intelligence platform
- A Power BI replacement
- Accounting software
- A CRM replacement
- A Notion replacement
- A generic dashboard builder
- An enterprise analytics tool

### Naming Note

The product name is **Novos** and the domain is ainovos.com. The name should reinforce the core idea of logging and reporting.

---

## 3. Economic Value and Commercial Rationale

### The Pain Novos Solves

Business owners waste time manually entering data into spreadsheets. Freelancers and consultants lose important updates across WhatsApp, email, voice notes, notebooks, and multiple apps. Small teams struggle to turn daily work activity into useful business reports. Client reports are often created manually at the end of the week or month, eating hours that could be billable. Reporting friction creates admin drag and weakens client communication.

**Novos creates value by reducing the distance between messy real-world activity and polished business reporting.**

### Strongest Monetisable Use Cases

1. **Consultant / Freelancer Reporting** — Daily notes become weekly client reports. Expenses, tasks, risks, updates, and deliverables are automatically structured and exported.

2. **Micro-Agency Client Reporting** — Agency teams log campaign updates, client feedback, deliverables, problems, and wins. Novos turns those logs into recurring progress reports.

3. **Creative Project Tracking** — Production companies, content studios, designers, filmmakers, and creative professionals track project progress, client feedback, costs, deliverables, and issues.

4. **Small-Business Operations Logging** — Owners quickly log sales, expenses, inventory notes, staff issues, customer feedback, and daily incidents.

5. **Progress Reporting for Partners, Funders, and Stakeholders** — Novos produces clean summaries from operational data, ready for external audiences.

### Commercial Validation Principle

> Novos should first prove that users will pay to convert messy daily business logs into structured dashboards and professional reports. Once that behaviour is validated, broader analytics, integrations, team workspaces, white-labelling, and advanced historical features can be added.

---

## 4. Target Users

### Primary Users

| Persona | Description | Core Need |
|---|---|---|
| Consultant / Freelancer | Solo service provider managing multiple clients | Turn daily notes into weekly client progress reports |
| Creative Professional | Designer, filmmaker, content studio owner | Track project updates, client feedback, deliverables, and costs |
| Micro-Agency Lead | 1–5 person agency managing client campaigns | Generate campaign reports from team logs without manual formatting |
| Small Business Owner | Sole operator or small team | Track daily operations, expenses, and incidents in one place |

### Secondary Users

- Project managers in small teams who need progress reports for stakeholders
- Solopreneurs reporting to investors or funders

### User Attributes

- Non-technical: users should not need to configure the system before it becomes useful
- Time-poor: users need fast input and fast output
- Admin-averse: users dislike manual data entry and formatting
- Client-facing: users need to present professional-looking outputs to external parties

---

## 5. MVP Strategy

### The MVP Wedge

> **AI Client Report Generator from Daily Logs**

The first version of Novos must answer one commercial question:

> **Will people pay to turn unstructured daily business logs into structured dashboards and polished reports?**

### MVP Priorities (in order)

1. Fast logging — users can submit a log in under 10 seconds
2. Trustworthy extraction — AI structures the log reliably and shows its work
3. Fluid dashboard manipulation — users can shape the canvas without technical setup
4. Report generation — a single excellent PDF template, ready to send
5. Source traceability — every dashboard item traces back to its original log

### MVP Deprioritises

- Advanced business intelligence
- Full workflow management
- Deep accounting features
- Complex enterprise functionality
- Time-machine historical reconstruction
- Team workspaces
- Native mobile apps

---

## 6. Goals

1. Enable users to log messy business information in under 10 seconds.
2. Convert common business logs into structured data with minimal user correction required.
3. Generate a useful starter dashboard automatically from user activity, without requiring manual setup.
4. Allow users to fluidly manipulate Adaptive Canvas Blocks without technical knowledge.
5. Preserve source traceability for every dashboard insight, chart, and report claim.
6. Generate a professional PDF report from selected blocks and logs, ready to send to a client or stakeholder.
7. Validate willingness to pay for AI-assisted business logging and reporting before expanding scope.

---

## 7. User Stories

### Logging

- **As a consultant**, I want to paste an unformatted client email into Novos and have it automatically extract the key updates, tasks, and sentiment, so that I do not need to reformat or re-enter the information.
- **As a freelancer**, I want to type a quick expense note like "Paid R850 for transport to the client shoot yesterday" and have Novos categorise it correctly, so that my expenses are tracked without manual entry.
- **As a small business owner**, I want to paste a day's worth of WhatsApp-style updates and have Novos structure them into tasks, expenses, and project notes, so that nothing gets lost.
- **As a creative professional**, I want to log a project risk in plain language and have it appear automatically on my dashboard as a risk item, so that I can track blockers without setting up a separate system.

### Dashboard

- **As a user**, I want my dashboard to update in real time when I submit a log, so that I always see my current business state without refreshing.
- **As a consultant**, I want to drag, resize, rename, and hide blocks on my dashboard, so that I can shape the view to match what I care about most this week.
- **As a user**, I want Novos to create a useful starter dashboard for me after onboarding, so that I am never faced with a blank canvas I do not know how to fill.
- **As a user**, I want to click any chart point, task, or metric and see the original log that created it, so that I can verify the AI's interpretation and trust what I am seeing.

### Reporting

- **As a consultant**, I want to generate a professional PDF report with one click, so that I can send a weekly progress update to my client without additional formatting work.
- **As an agency lead**, I want to choose which dashboard blocks to include in the PDF, so that the report only shows what is relevant to that client.
- **As a freelancer**, I want to edit the AI-written executive summary before exporting, so that I can personalise the tone before sending.
- **As a user**, I want to select a date range for the report, so that I can produce a weekly, fortnightly, or monthly snapshot as needed.

### Correction and Trust

- **As a user**, I want to see an AI confidence score on each log extraction, so that I know which items I should double-check.
- **As a user**, I want to correct the category, amount, or project assigned to a log, so that the dashboard and reports reflect accurate data.
- **As a user**, I want every report claim to trace back to the original log, so that I can defend any number or statement in the report if a client questions it.

---

## 8. Functional Requirements

Requirements are labelled **P0** (required for MVP), **P1** (important after MVP), or **P2** (future enhancement).

---

### 8.1 Universal Input Bar

| Req | Priority | Requirement |
|---|---|---|
| 1 | P0 | The system must provide a single universal input bar that accepts typed text, pasted text, and pasted unformatted content from any source (emails, WhatsApp, notes). |
| 2 | P0 | The input bar must feel familiar, similar to a messaging app input field (min height 60px, expands to 200px for multi-line content). |
| 3 | P0 | The system must display a "Processing…" indicator immediately upon log submission. |
| 4 | P0 | The system must show a categorised tag (e.g. `#finance`, `#tasks`) within 2 seconds of processing completion. |
| 5 | P0 | The input bar must clear immediately upon submission so the user can log again without friction. |
| 6 | P1 | The system should support voice input via a microphone button with real-time transcription display. |
| 7 | P1 | The system should support basic file upload (CSV, PDF, XLSX) via drag-and-drop and click-to-browse. |

---

### 8.2 AI Extraction and Structuring

| Req | Priority | Requirement |
|---|---|---|
| 8 | P0 | The AI must parse text input and extract business entities: date, amount, currency, client, project, category, task, status, issue/risk, deliverable, sentiment (simple level), urgency (simple level), and source text. |
| 9 | P0 | The AI must automatically assign each log entry to one or more categories from the starter set: Finance, Projects, Clients, Tasks, Operations, Marketing, Other. |
| 10 | P0 | The AI must return a structured JSON object for every processed log, stored in the database. |
| 11 | P0 | Every extracted entity must include a confidence score (0.0–1.0). |
| 12 | P0 | When confidence is below 0.75, the system must display a gentle review prompt to the user (e.g. "Novos thinks this is a project update. Review?"). |
| 13 | P0 | The AI must detect natural conversational language and extract structured data (e.g. "spent R850 on transport yesterday" → Expense: R850, Category: Transport, Date: yesterday). |
| 14 | P0 | The system must implement tiered model routing: lightweight models for simple text categorisation; stronger models for complex inputs, long pasted content, and report generation. |
| 15 | P1 | The AI should support voice transcription using Whisper and extract entities from transcribed text. |
| 16 | P1 | The AI should parse CSV, PDF, and XLSX file content and extract relevant business entities. |
| 17 | P2 | The AI may detect simple sentiment (positive, neutral, negative) from text tone. |
| 18 | P2 | The AI may detect urgency from text language (e.g. "urgent", "ASAP", "by tomorrow"). |

---

### 8.3 User Correction Loop

| Req | Priority | Requirement |
|---|---|---|
| 19 | P0 | Users must be able to correct AI-extracted fields after processing: category, amount, date, client, project, task status. |
| 20 | P0 | Corrections must be stored and applied to the dashboard and reports immediately. |
| 21 | P0 | Users must be able to exclude a specific log from reports without deleting it. |
| 22 | P1 | User corrections should be used to improve future extraction accuracy for that user where feasible. |

---

### 8.4 Adaptive Canvas Blocks (Dashboard)

| Req | Priority | Requirement |
|---|---|---|
| 23 | P0 | The dashboard must display Adaptive Canvas Blocks that automatically appear and update based on logged data categories. |
| 24 | P0 | Novos must generate a starter dashboard automatically after onboarding, based on the user's selected work type. Users must never face a blank canvas. |
| 25 | P0 | Users must be able to move, resize, rename, hide, delete, and duplicate any block. |
| 26 | P0 | Users must be able to mark blocks as included or excluded from PDF reports. |
| 27 | P0 | Block layout (position, size, visibility, included-in-report flag) must be persisted to the user's account. |
| 28 | P0 | Blocks must update in real time (within 2 seconds) when new data is processed. |
| 29 | P0 | Novos must automatically create a new block when a new data category first appears in the user's logs. |
| 30 | P0 | The MVP dashboard must support six block types: Metric, Chart, List, Timeline, Summary, Source Log (see Section 9). |
| 31 | P1 | Users should be able to convert blocks between compatible types (e.g. list → chart, chart → summary). |
| 32 | P1 | Users should be able to issue AI canvas commands in natural language (e.g. "Show only client updates", "Group by project"). |
| 33 | P1 | Novos should suggest new blocks when user log patterns indicate a recurring data type. |

---

### 8.5 Source Traceability

| Req | Priority | Requirement |
|---|---|---|
| 34 | P0 | Every dashboard block, chart point, list item, metric, and report claim must be traceable to its original source log. |
| 35 | P0 | Clicking any meaningful item on the dashboard or report must open the Original Log Modal. |
| 36 | P0 | The Original Log Modal must show: original text, submission timestamp, extracted entities, category, AI confidence score, and any user corrections. |
| 37 | P0 | Users must be able to correct or exclude a log from within the Original Log Modal. |

---

### 8.6 PDF Report Generation

| Req | Priority | Requirement |
|---|---|---|
| 38 | P0 | The system must provide a "Generate Report" button accessible from the main dashboard. |
| 39 | P0 | The MVP must offer one high-quality report template: the Business / Client Progress Report. |
| 40 | P0 | The report must include: report title, date range, generated timestamp, AI-written executive summary, key metrics, progress updates, completed tasks, open tasks, expenses/financial notes, risks/blockers, and client feedback/sentiment where available. |
| 41 | P0 | Users must be able to select a date range before generating the report (Last 7 days / Last 30 days / Last 90 days / Custom). |
| 42 | P0 | Users must be able to choose which blocks to include in the report. |
| 43 | P0 | Users must be able to edit the AI-written executive summary before exporting. |
| 44 | P0 | Users must be able to rename the report title before exporting. |
| 45 | P0 | The exported PDF file must be named `novos-report-[YYYY-MM-DD].pdf`. |
| 46 | P0 | PDF generation must complete within 10 seconds for reports covering up to 100 log entries. |
| 47 | P1 | Users should be able to include an optional source log appendix in the PDF. |
| 48 | P1 | Additional report templates (Executive Summary, Financial Report, Project Status Report) may be added post-MVP. |
| 49 | P2 | Branded PDF reports with custom logo and colours may be offered as an agency tier feature. |

---

### 8.7 Authentication and Account

| Req | Priority | Requirement |
|---|---|---|
| 50 | P0 | The system must require user authentication (email/password or Google OAuth). |
| 51 | P0 | All user data must be encrypted in transit (TLS) and at rest. |
| 52 | P0 | The system must support multi-device access from any browser. |
| 53 | P0 | Users must be able to export all their data as a JSON file (GDPR compliance). |
| 54 | P0 | Users must be able to permanently delete their account and all associated data. |
| 55 | P0 | The system must enforce tier-based usage limits at the mutation layer, not only in the UI. |

---

### 8.8 Temporal Accuracy

| Req | Priority | Requirement |
|---|---|---|
| 56 | P0 | Every log entry must be timestamped server-side in UTC upon submission. |
| 57 | P0 | Timestamps must be displayed in the user's local timezone. |
| 58 | P0 | The AI must resolve natural language date references (e.g. "yesterday", "last Friday") to actual UTC dates. |

---

### 8.9 Post-MVP Requirements (for reference)

The following are P1 or P2 and should not be built in the MVP:

- **P1:** Voice transcription, file uploads, additional report templates, more block types, AI canvas commands, usage-based pricing limits, branded reports, client workspaces.
- **P2:** Time-machine historical views, multi-speaker voice detection, advanced conflict detection, third-party integrations (Gmail, Slack, WhatsApp), team workspaces, public API, white-labelling, advanced analytics, forecasting, native mobile apps.

---

## 9. Adaptive Canvas Blocks

### 9.1 Definition

> Adaptive Canvas Blocks are modular dashboard sections generated from structured user logs. Novos automatically creates and updates blocks based on the user's data, but users can freely move, resize, rename, hide, delete, duplicate, convert, and export them.

The correct design principle is:
> **Fluid by default, structured underneath.**

Users should feel like they are shaping a living canvas. Behind the scenes, Novos maintains structured data so that reports, charts, summaries, and exports remain reliable and traceable.

### 9.2 Required Block Behaviours

Every block must support all of the following actions:

- **Move** — drag to any position on the canvas grid
- **Resize** — expand or shrink (minimum 2 columns × 2 rows)
- **Rename** — editable block title inline
- **Hide** — remove from view without deleting the data
- **Delete** — remove permanently (with 5-second undo window)
- **Duplicate** — create a copy with independent layout
- **Pin** — lock in place to prevent accidental moves
- **Include / Exclude from report** — controls whether block appears in PDF exports
- **View source logs** — opens a list of all logs contributing to this block

### 9.3 MVP Block Types

#### Metric Block
Shows one important number or KPI.

Examples: Total expenses this week · Revenue logged this month · Number of open tasks · Number of completed deliverables · Client sentiment score

#### Chart Block
Visualises trends, categories, comparisons, or distributions using Recharts (line, bar, pie).

Examples: Expenses by category · Expenses over time · Tasks completed per week · Revenue by client · Client feedback trend

#### List Block
Shows structured lists extracted from logs.

Examples: Open tasks · Completed tasks · Client requests · Risks / blockers · Recent expenses · Recent updates

#### Timeline Block
Shows chronological progress.

Examples: Project milestones · Weekly activity · Client communication history · Deliverable timeline

#### Summary Block
Shows an AI-written summary of selected data.

Examples: Weekly summary · Project status summary · Client account summary · Financial summary · Risk summary

#### Source Log Block
Shows recent raw logs and allows users to inspect the connection between original inputs and structured outputs. Critical for trust-building.

### 9.4 Canvas UX Principles

**No Blank Canvas Problem:** The user must never land on an empty, confusing dashboard. After onboarding, Novos generates a starter canvas based on the user's work type.

**No Rigid Template Problem:** The starter canvas is only a starting point. Users can manipulate it immediately.

**Fluid Interaction:** The dashboard must feel tactile and flexible. Users can drag blocks, resize blocks, rename sections, hide irrelevant blocks, add new blocks, and convert one block type into another.

### 9.5 Starter Canvases by Work Type

After onboarding, Novos generates a starter canvas based on the user's answer to: **"What best describes your work?"**

| Work Type | Suggested Starter Blocks |
|---|---|
| Consultant / Freelancer | Client Updates, Open Tasks, Project Progress, Expenses, Weekly Summary |
| Small Business Owner | Daily Operations, Expenses, Sales / Revenue, Inventory Notes, Issues / Risks, Weekly Summary |
| Creative Professional | Active Projects, Deliverables, Client Feedback, Expenses, Risks / Blockers, Weekly Summary |
| Marketing / Content Agency | Campaign Updates, Client Feedback, Deliverables, Content Tasks, Performance Notes, Weekly Report Summary |
| Online Seller / E-commerce | Sales Notes, Inventory Updates, Customer Feedback, Marketing Expenses, Operational Issues, Weekly Summary |
| Other | Generic starter: Tasks, Notes, Expenses, Weekly Summary |

The user must be able to edit or replace the starter canvas immediately.

---

## 10. AI Processing and Data Structuring

### 10.1 Tiered Processing Model

Novos uses tiered model routing to balance extraction quality with API cost:

| Input Type | Model Selection |
|---|---|
| Simple text (expenses, tasks, status updates) | Lightweight model — Llama 3.1 8B via Groq |
| Complex text (long pasted emails, ambiguous updates) | Heavy model — DeepSeek R1 Distill Llama 70B via Groq |
| File content (CSV, PDF, XLSX) | Heavy model |
| Voice transcription | Whisper Large v3 via Groq → then tiered LLM |
| Report summary generation | Heavy model — Llama 3.3 70B via Groq |

All AI calls must route through `convex/actions/groqClient.ts`. Never call AI APIs directly from frontend components.

### 10.2 AI Processing Pipeline (5 Stages)

1. **Ingestion** — receive raw input (text / transcription / file content)
2. **Extraction** — LLM extracts entities using structured prompts; returns JSON only
3. **Validation** — compare against existing data; flag contradictions for user review
4. **Structuring** — map entities to the data schema; assign confidence scores
5. **Presentation** — Convex reactive subscriptions push updates to the dashboard within 2 seconds

### 10.3 Extracted Entity Schema

```json
{
  "type": "expense|task|client_update|project_update|risk|income|note",
  "date": "ISO8601",
  "date_reference": "yesterday|last Friday|etc",
  "amount": 850,
  "currency": "ZAR",
  "category": "finance|projects|clients|tasks|operations|marketing|other",
  "client": "string or null",
  "project": "string or null",
  "task": "string or null",
  "status": "open|in_progress|complete|blocked",
  "issue_or_risk": "string or null",
  "deliverable": "string or null",
  "sentiment": "positive|neutral|negative|null",
  "urgency": "low|medium|high|null",
  "confidence": 0.91,
  "source_log": "original raw text"
}
```

### 10.4 Confidence Scoring

- Every extracted entity must include a `confidence` score (0.0–1.0).
- If overall confidence for a log is below 0.75, display a gentle review prompt: _"Novos thinks this is a [category]. Review?"_
- The user can correct the category, amount, date, client, project, or task status from the review prompt or the Original Log Modal.
- AI does not need to be perfect. Users must always be able to verify and correct outputs.

### 10.5 Category Management

**Starter category set:** Finance · Projects · Clients · Tasks · Operations · Marketing · Other

When a log does not confidently match an existing category, the AI creates a **Proposed Category** tag. The user can:
- Accept the proposed category (renames it)
- Merge it into an existing category
- Dismiss the suggestion

The system must never block a log submission in order to force category configuration.

---

## 11. Source Traceability and Trust

### 11.1 Core Product Principle

> Every insight must be explainable back to its original log.

For every chart, metric, list item, timeline event, or report claim, Novos must be able to expose the underlying source log.

### 11.2 Original Log Modal

Every meaningful item on the dashboard and in reports must be clickable. Clicking opens the Original Log Modal, which shows:

- Original text or transcription (full)
- Submission timestamp (user's local timezone)
- Input type (text / voice / file)
- Extracted entities (all fields)
- Category assigned
- AI confidence score
- Any corrections the user has made
- Option to correct or exclude this log

### 11.3 Trust Features (MVP)

- Original Log Modal on every block item
- AI confidence indicator on log chips after processing
- User correction history (visible in the modal)
- Last-updated timestamp on each block
- Ability to exclude specific logs from reports without deleting them
- Source log references in PDF exports (optional appendix)

---

## 12. Report Generation

### 12.1 MVP Report Template

Start with one high-quality report template:

> **Business / Client Progress Report**

This template must be flexible enough to serve consultants, freelancers, small businesses, creatives, and agencies.

### 12.2 Report Sections

The PDF must include:

1. Report title (user-editable)
2. Date range covered
3. Report generated timestamp
4. AI-written executive summary (user-editable before export)
5. Key metrics (sourced from Metric blocks)
6. Progress updates (sourced from List and Timeline blocks)
7. Completed tasks
8. Open tasks
9. Expenses / financial notes (where applicable)
10. Risks / blockers (where applicable)
11. Client feedback / sentiment (where applicable and logged)
12. Selected dashboard block visuals (chart images)
13. Source log appendix (optional, toggled by user)

### 12.3 User Control Before Export

Before generating the PDF, the user must be able to:

- Select the date range (Last 7 days / Last 30 days / Last 90 days / Custom)
- Choose which blocks to include
- Rename the report title
- Edit the AI-written executive summary
- Toggle the source log appendix on or off

### 12.4 PDF SLA

- Generation must complete within 10 seconds for reports covering up to 100 log entries.
- On timeout: show "Report generation is taking longer than expected. Try a shorter date range or try again." with a Retry button.
- PDF filename: `novos-report-[YYYY-MM-DD].pdf`

### 12.5 Post-MVP Report Templates

After the MVP proves commercial demand, additional templates can be considered:

- Executive Summary (AI overview + key metrics only)
- Financial Report (budget, expenses, revenue focused)
- Project Status Report (timeline, tasks, client feedback focused)
- Client Report (customised per client workspace)
- Investor Update
- Agency Campaign Report

---

## 13. User Flows

---

### Flow 1: First-Time User Onboarding

1. User signs up (email/password or Google OAuth).
2. User is redirected to the main dashboard.
3. **Onboarding Modal** appears immediately (runs once only, checked via `userProfiles.onboardingComplete`).
4. Modal asks: _"What best describes your work?"_ — six options (see Section 9.5).
5. On selection, Novos generates the starter canvas and marks onboarding complete.
6. Modal closes. A 5-second tooltip appears on the input bar: _"Start by typing or pasting a business update below."_
7. The user sees their personalised starter canvas with placeholder blocks.

**Edge case — Onboarding already completed:** Skip the modal entirely. Go straight to the live dashboard.

---

### Flow 2: Daily Logging (Text / Paste)

1. User types or pastes messy business information into the universal input bar.
   - Examples: an expense note, a client update, a task completion, a risk, a pasted email snippet.
2. User clicks Submit (or presses Enter).
3. The input bar clears immediately.
4. A **Processing chip** animates in the log history area.
5. The AI pipeline runs (Ingestion → Extraction → Validation → Structuring → Presentation).
6. Within 2 seconds, the chip resolves to a coloured category badge (e.g. `#finance`).
7. The relevant Adaptive Canvas Block updates in real time.
8. **Low confidence case:** The chip shows a grey "proposed: [category]" badge with a click-to-assign prompt.
9. **Processing failure:** The chip shows a red "Failed" badge with a Retry button.

---

### Flow 3: Dashboard Block Manipulation

1. User views the canvas with one or more Adaptive Canvas Blocks.
2. User **drags** a block to a new position — ghost outline shows target location during drag.
3. User **resizes** a block by dragging edge/corner handles.
4. User **renames** a block by clicking the title and typing.
5. User **hides** a block via the block menu (three-dot icon).
6. User **deletes** a block — a 5-second toast appears ("Block removed. [Undo]"). Deletion is only persisted if not undone within 5 seconds.
7. User toggles a block's **Include in Report** flag.
8. All layout changes are persisted to Convex immediately via `useMutation(api.blocks.updateLayout)`.

---

### Flow 4: Report Generation and PDF Export

1. User clicks **"Generate Report"** in the top toolbar.
2. A modal opens with:
   - Date range selector (Last 7 days / Last 30 days / Last 90 days / Custom)
   - Block selector (checkboxes for each canvas block)
   - Report title input (pre-filled with "Business Progress Report — [date]")
   - Source log appendix toggle (off by default)
3. User adjusts selections and clicks **"Generate Draft"**.
4. The modal transitions to a loading state (animated skeleton): "Drafting your report…"
5. The Convex action fetches all relevant log entries for the date range.
6. Groq (Llama 3.3 70B) generates a 3–5 sentence executive summary.
7. The draft summary appears in an editable text area for the user to review and modify.
8. User clicks **"Export PDF"**.
9. `html2canvas` captures visual snapshots of selected blocks.
10. The PDF is assembled using react-pdf and returned as a download URL.
11. The browser triggers automatic file download: `novos-report-[YYYY-MM-DD].pdf`
12. The modal closes automatically after download begins.

**Error case — timeout (>10s):** Show "Report generation is taking longer than expected. Try a shorter date range or try again." with a Retry button.

---

### Flow 5: Source Verification (Original Log Modal)

1. User sees a chart point, metric value, list item, or summary claim on the dashboard.
2. User clicks the item.
3. The **Original Log Modal** opens (shadcn/ui Dialog) showing:
   - Input type icon (text / voice / file)
   - Full original text / transcription
   - Submission timestamp (local timezone)
   - All extracted entities (formatted clearly)
   - Category assigned
   - AI confidence score (with colour coding: green > 0.85, yellow 0.75–0.85, red < 0.75)
   - Any corrections already applied by the user
4. User can **correct** a field (category, amount, date, client, project, task status) inline.
5. User can **exclude this log from reports** (log is preserved in the database; excluded flag is set).
6. User closes the modal by clicking outside or pressing Escape.

---

### Flow 6: Authentication

**New User (Email/Password):**
1. User navigates to `/auth` — Sign In tab is active by default.
2. User clicks **Sign Up** tab.
3. User enters email and password (minimum 8 characters).
4. Validation errors shown inline: "Please enter a valid email address" / "Password must be at least 8 characters" / "An account with this email already exists. Sign in instead?"
5. On success → redirected to `/` → Onboarding Modal appears (Flow 1).

**Returning User:**
1. User enters email and password on Sign In tab.
2. Generic error on failure: "Incorrect email or password." (Do not distinguish between wrong password and unrecognised email to prevent enumeration.)
3. On success → redirected to `/`.

**Google OAuth:**
1. User clicks "Continue with Google".
2. Google OAuth flow completes.
3. On cancel/error → user returned to `/auth` with dismissible banner: "Google sign-in was cancelled. Please try again."

---

### Flow 7: Free Tier Limit

1. Free-tier user submits their 31st log for the month.
2. The `submitLog` Convex mutation checks monthly log count against the Free tier limit (30 logs/month).
3. Count exceeded — mutation returns an error.
4. A modal appears: "You've reached your 30 log limit for this month on the Free plan."
   - Option A: "Upgrade to Starter — $9/month"
   - Option B: "Remind me next month" (dismisses modal; input bar shows a lock icon until the next calendar month)

---

### Flow 8: Account Data Management

**Export Data (GDPR):**
1. User navigates to **Settings → Data → Export My Data**.
2. Confirmation dialog: "This will download all your logs, block layouts, and reports as a JSON file."
3. On confirm → JSON download: `novos-export-[YYYY-MM-DD].json`

**Delete Account (GDPR):**
1. User navigates to **Settings → Danger Zone → Delete My Account**.
2. Warning dialog with permanent deletion notice.
3. User must type **"DELETE"** in a confirmation input before the button enables.
4. On confirm → all log entries, block layouts, reports, and files purged in sequence → session invalidated → redirected to `/auth` with message: "Your account has been permanently deleted."

---

## 14. Non-Goals

### MVP Will Not Be

- A full accounting platform
- A full CRM
- A full BI platform or Power BI replacement
- A project management suite (Jira, Asana, Notion)
- A team collaboration platform
- A data warehouse
- A custom dashboard development tool
- A replacement for QuickBooks, Xero, or FreshBooks

### MVP Will Not Include

- Team workspaces or multi-user collaboration
- Role-based access control
- Native mobile apps (iOS / Android)
- Third-party integrations (Gmail, Slack, WhatsApp, accounting software)
- Public API
- Time-machine / full historical dashboard reconstruction
- Multi-speaker voice detection
- Deep voice emotion or tone analysis
- White-labelling
- Revenue forecasting or predictive analytics
- Custom schema builders
- Automated alerts or push notifications
- Multi-language support (English only for MVP)

---

## 15. Design Considerations

### 15.1 Layout

- **Two-zone design:** Universal Input Bar (bottom, fixed) + Adaptive Canvas (main area)
- Desktop-first (1280px+ primary viewport); tablet support at 768px+

### 15.2 Input Bar Design

- Resembles a messaging app (WhatsApp, iMessage) for instant familiarity
- Minimum height: 60px; expands to 200px for multi-line text
- Icons: microphone (voice, P1), paperclip (file, P1), send arrow (submit)
- Lock icon shown when monthly log limit is reached

### 15.3 Processing Feedback

- Animated "Processing…" chip appears immediately upon submission
- Transforms into a coloured category badge on success
- Grey "proposed: [category]" badge with click-to-assign for low-confidence extractions
- Red "Failed" badge with Retry button on error

### 15.4 Canvas Design

- Fluid grid layout with movable, resizable Adaptive Canvas Blocks
- Ghost outline shown at target position during block drag
- Smooth animations on block updates (max 300ms transitions)
- Blocks update in real time via Convex reactive subscriptions

### 15.5 Colour System

| Use | Colour |
|---|---|
| Finance | Green |
| Projects | Blue |
| Clients | Purple |
| Tasks | Orange |
| Status: Positive / Complete | Green |
| Status: Warning | Yellow |
| Status: Negative / Urgent | Red |

### 15.6 Typography and Accessibility

- Clean, readable sans-serif font (minimum 14px body text)
- WCAG 2.1 AA compliance minimum
- All interactive elements keyboard-navigable

### 15.7 Product Personality

The product must feel: calm · intelligent · fast · trustworthy · fluid · professional

The product must not feel like: a complicated analytics platform · a spreadsheet replacement · a rigid reporting template · a blank whiteboard requiring setup · a chatbot with a dashboard attached

---

## 16. Technical Architecture

### 16.1 Stack

#### Frontend
- **Framework:** Next.js (App Router, latest)
- **Language:** TypeScript — strict mode, no `any` types
- **UI Library:** shadcn/ui — all UI elements; styled with Tailwind CSS
- **Charts:** Recharts — all data visualisations
- **Grid Layout:** React Grid Layout (or equivalent) for movable canvas blocks
- **PDF Capture:** html2canvas for block image capture
- **Real-time:** Convex reactive subscriptions (no separate WebSocket server)

#### Backend
- **Backend:** Convex — mutations (writes), queries (reads), actions (external API calls)
- **Database:** Convex built-in database — document-based, real-time reactive, automatic indexing
- **Auth:** Convex Auth (`@convex-dev/auth`) — email/password + Google OAuth
- **File Storage:** Convex File Storage — uploaded files and audio recordings

#### AI and External APIs
- **Lightweight LLM:** Llama 3.1 8B via Groq (simple text)
- **Heavy LLM:** DeepSeek R1 Distill Llama 70B via Groq (complex inputs)
- **Report Summary LLM:** Llama 3.3 70B via Groq (PDF executive summaries)
- **Speech-to-Text (P1):** Whisper Large v3 via Groq
- **PDF Generation:** react-pdf (server-side assembly via Convex action)
- All AI calls route through `convex/actions/groqClient.ts`

### 16.2 AI Processing Pipeline

```
User input → submitLog (Convex mutation)
  → aiPipeline (Convex action)
    → Stage 1: Ingestion (raw content received)
    → Stage 2: Extraction (LLM extracts entities → JSON)
    → Stage 3: Validation (check for contradictions, confidence score)
    → Stage 4: Structuring (map to data schema, write logEntry)
    → Stage 5: Presentation (Convex reactivity pushes update to canvas)
```

### 16.3 Performance Requirements

- Page load: <3 seconds on average connection
- Log-to-visual-update: <2 seconds from submission
- Voice transcription (P1): real-time with <1 second lag
- PDF generation: <10 seconds for up to 100 log entries
- File processing (P1): <30 seconds for files up to 5MB

### 16.4 Security and Privacy

- All data encrypted in transit (TLS 1.3) and at rest (AES-256 via Convex)
- Authentication required for all operations
- No sharing of user data with third parties
- GDPR: full data export and account deletion
- Rate limiting on all mutations via `@convex-dev/ratelimiter`

---

## 17. Data Model

### logEntry

```json
{
  "id": "convex_id",
  "user_id": "convex_id",
  "created_at": "ISO8601 UTC",
  "input_type": "text | voice | file",
  "raw_content": "string",
  "source_file_id": "convex_file_id (optional)",
  "processing_status": "pending | processed | needs_review | failed",
  "ai_confidence": 0.91,
  "excluded_from_reports": false
}
```

### extractedEntity

```json
{
  "id": "convex_id",
  "log_entry_id": "convex_id",
  "entity_type": "expense | task | client_update | project_update | risk | income | note",
  "structured_data": {
    "amount": 850,
    "currency": "ZAR",
    "date": "ISO8601",
    "client": "string or null",
    "project": "string or null",
    "task": "string or null",
    "status": "open | in_progress | complete | blocked",
    "issue_or_risk": "string or null",
    "deliverable": "string or null",
    "sentiment": "positive | neutral | negative | null",
    "urgency": "low | medium | high | null"
  },
  "category": "finance | projects | clients | tasks | operations | marketing | other",
  "confidence": 0.88,
  "user_corrected": false,
  "user_corrections": {}
}
```

### canvasBlock

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

### report

```json
{
  "id": "convex_id",
  "user_id": "convex_id",
  "title": "Weekly Client Progress Report",
  "date_range": { "start": "ISO8601", "end": "ISO8601" },
  "included_block_ids": ["convex_id"],
  "ai_summary": "string",
  "user_edited_summary": "string",
  "include_source_appendix": false,
  "pdf_url": "string",
  "created_at": "ISO8601"
}
```

### userProfile

```json
{
  "id": "convex_id",
  "user_id": "convex_id",
  "work_type": "consultant | small_business | creative | agency | ecommerce | other",
  "base_currency": "ZAR",
  "tier": "free | starter | pro | agency",
  "onboarding_complete": true,
  "monthly_log_count": 12,
  "monthly_report_count": 1
}
```

---

## 18. Pricing and Packaging

### Pricing Principles

- Do not price only on log volume.
- Price on value drivers: number of reports generated, PDF exports, voice minutes (P1), file uploads (P1), storage, AI summary depth, and future: client workspaces, branding, historical access.
- Free tier must create genuine perceived value without generating unsustainable AI costs.
- Pricing must protect AI processing margins.

### Free Tier

| Limit | Value |
|---|---|
| Logs / month | 30 |
| PDF exports / month | 1 |
| Input types | Text and paste only |
| AI summaries | Basic (limited depth) |
| Canvas blocks | All 6 block types |
| Storage | 500MB |
| Voice logging | Not included |
| File uploads | Not included |
| Time-machine | Not included |

### Starter Tier — ~$9/month

| Limit | Value |
|---|---|
| Logs / month | 300 |
| PDF exports / month | 5 |
| Input types | Text, paste; basic voice if cost allows |
| AI summaries | Standard |
| Canvas blocks | All + block conversion |
| Storage | 2GB |
| Voice logging | Limited minutes |
| File uploads | Up to 10MB/file |
| Time-machine | Not included |

### Pro Tier — ~$19–$29/month

| Limit | Value |
|---|---|
| Logs / month | Higher or unlimited (subject to fair use) |
| PDF exports / month | Unlimited |
| Input types | Text, voice, files |
| AI summaries | Advanced (longer, more detail) |
| Canvas blocks | All + AI canvas commands |
| Storage | 5GB |
| Voice logging | Full |
| File uploads | Up to 50MB/file |
| Time-machine | Included (post-MVP) |
| Priority processing | Yes |

### Agency Tier — ~$49–$99/month

Post-MVP. Adds multiple client workspaces, branded PDF reports, higher storage, more reports, and team features.

---

## 19. Cost Risk Management

### Primary AI Cost Risks

| Risk | Impact |
|---|---|
| High-volume free users generating many logs | AI extraction costs exceed subscription revenue |
| Free tier users abusing PDF generation | AI summary generation costs on the free tier |
| Voice transcription at scale (P1) | Whisper API costs can be significant |
| File parsing on free tier (P1) | Large file processing on Groq is expensive |
| PDF generation with long date ranges | Heavy log fetching + AI summary generation |

### Mitigations

- **Tiered model routing:** Use lightweight models for simple text logs; reserve heavy models for complex inputs and reports only.
- **Monthly usage caps:** Enforce log limits, report limits, and voice minute limits per tier at the mutation layer.
- **Fair-use rate limiting:** Use `@convex-dev/ratelimiter` to protect against burst abuse.
- **Cache processed outputs:** Store extracted entity JSON; do not re-process a log unless the user requests correction.
- **Queue heavy jobs:** Non-critical heavy jobs (e.g. batch file parsing P1) can be dequeued without blocking the UI.
- **Compress and expire audio (P1):** Move voice recordings to cold storage after 30 days; surface retrieval notice in the UI.
- **Limit free PDF depth:** Cap AI summary length and source log appendix on the free tier.
- **Monitor per-user AI spend:** Track estimated AI cost per user and flag high-cost free accounts for manual review.

---

## 20. Success Metrics

### Activation

- User submits first log within 2 minutes of signing up.
- User creates or accepts first dashboard within first session.
- User understands what Novos does without a tutorial.

### Engagement

- Active users submit at least 5 logs per week.
- At least 30% of active users generate a report in the first 7 days.
- At least 40% of users click into source logs to verify AI outputs.

### Value

- Users report that Novos saves time compared with manual reporting.
- Users generate reports they are willing to send to a client or partner.
- Users return to update logs before the next reporting cycle.

### Monetisation

- Free-to-paid conversion rate (target: >5% within 30 days).
- Percentage of users who hit report export limits on the free tier.
- Percentage of users who upgrade for more reports, voice, or client workspaces.
- Willingness to pay for branded reports or client workspaces.

### AI Quality

- AI extraction correction rate (target: <15% of logs corrected by user).
- Categorisation accuracy (target: >90%).
- Percentage of report summaries edited before export.
- User trust rating after viewing source logs (survey-based).

### Technical Performance

- Log-to-dashboard update: <2 seconds (P99).
- PDF generation: <10 seconds for up to 100 entries.
- System uptime: 99.5% during business hours.

---

## 21. Validation Plan

Before investing in full build, validate demand through three stages:

### Stage 1: Landing Page Test

Create a landing page with the promise:
> **Turn daily business notes into client-ready reports automatically.**

Measure:
- Email signups and waitlist conversions
- Clicks on pricing section
- Which audience segment responds best (consultant vs. agency vs. small business)
- Qualitative responses to the core value proposition

**Go signal:** 100+ signups within 4 weeks of launch with >30% clicking on pricing.

### Stage 2: Concierge MVP

Manually simulate Novos for 5–10 early users.

Ask participants to send daily logs through WhatsApp, email, or a form. Generate reports manually or semi-automatically with AI assistance.

Measure:
- Do they keep sending logs after the first week?
- Do they actually use the generated reports?
- Would they pay, and at what price point?
- What information do they actually log? (Informs extraction priorities)
- What report format do they need? (Informs template design)

**Go signal:** >60% of concierge users report they would pay for the automated version.

### Stage 3: Prototype Test

Build a clickable or functional prototype with:
- Universal input bar
- Auto-generated Adaptive Canvas Blocks
- One PDF export

Measure:
- Can users understand the core workflow without instruction?
- Do they prefer fluid block manipulation over fixed templates?
- Do they trust AI-generated summaries?
- Do they verify source logs?

**Go signal:** >70% of prototype testers can complete the core flow (log → dashboard → export) unassisted.

---

## 22. Build Phases

### Phase 1: Core Logging and Extraction

- User authentication (Convex Auth)
- Universal text input bar
- Log storage (Convex database)
- AI extraction pipeline (tiered model routing)
- Category assignment and confidence scoring
- User correction interface
- Original Log Modal (source traceability)

### Phase 2: Adaptive Canvas MVP

- Onboarding work type selection
- Starter dashboard generation
- All 6 block types (Metric, Chart, List, Timeline, Summary, Source Log)
- Move and resize blocks (React Grid Layout)
- Block layout persistence (Convex)
- Source traceability: click any block item → Original Log Modal

### Phase 3: Report Generation

- Date range selector
- Block selector for report inclusion
- AI executive summary generation (Groq Llama 3.3 70B)
- User-editable summary
- PDF export via react-pdf
- Source log appendix (optional)

### Phase 4: Monetisation and Limits

- Free tier limits (30 logs/month, 1 PDF/month)
- Starter and Pro tier limits
- Usage tracking per user per month
- Billing integration (Polar.sh or Stripe)
- Upgrade flow and paywalls

### Phase 5: Expansion (Post-MVP)

- Voice input and Whisper transcription
- File uploads (CSV, PDF, XLSX)
- Client workspaces
- Additional report templates
- AI canvas commands
- Historical dashboard views (time-machine)
- Third-party integrations
- Team workspaces and permissions
- Advanced analytics

---

## 23. Post-MVP Roadmap

The following features are explicitly deferred from the MVP. They should be designed with these possibilities in mind but must not delay the first launch:

| Feature | Priority | Notes |
|---|---|---|
| Voice transcription (Whisper) | P1 | High value but adds cost complexity |
| File uploads (CSV, PDF, XLSX) | P1 | Adds significant processing cost |
| Additional PDF templates | P1 | Easy to add once first template is validated |
| More block types | P1 | Expand as logging patterns emerge |
| AI canvas commands | P1 | NLP commands to reshape the dashboard |
| Client workspaces | P1 | High-value agency feature |
| Branded PDF reports | P1 | Agency monetisation lever |
| Time-machine / historical views | P2 | Complex; validate after core product |
| Multi-speaker voice detection | P2 | Expensive; validate use case first |
| Advanced conflict detection | P2 | Build after log volume data available |
| Gmail integration | P2 | Reduces friction for email-heavy users |
| Slack integration | P2 | Reduces friction for team-based users |
| WhatsApp integration | P2 | High demand in emerging markets |
| Accounting software integrations | P2 | QuickBooks, Xero, Sage |
| Team workspaces + permissions | P2 | Requires significant auth/data model work |
| White-labelling | P2 | Enterprise/agency upsell |
| Advanced analytics and forecasting | P2 | Post product-market fit |
| Public API | P2 | After core value is validated |
| Native mobile apps | P2 | After web product is validated |
| Custom schema builders | P2 | Enterprise only |
| Multi-language support | P2 | After English-market validation |

---

**Document Version:** 2.0
**Previous Version:** 1.1 (March 2026)
**Last Updated:** May 2026
**Filename:** `0001-prd-novos-ai-reporting-system.md`
**Target Directory:** `/tasks/`
