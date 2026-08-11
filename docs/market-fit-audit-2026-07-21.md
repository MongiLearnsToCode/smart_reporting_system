# Product–Market Fit Audit — Novos / "Codex" Smart Reporting System

**Date:** 2026-07-21
**Auditor:** Automated PMF investigation (repo + web research)
**Method:** Phase 1 repo-only analysis → Phase 2 external market research → Phase 3 gap analysis → Phase 4 recommendations. Phase 1 and Phase 2 are kept visually separate so the reader can tell repo claims from outside evidence.

> This is an investigation, not a pitch. Findings are stated at the strength the evidence supports and no higher. Where the repo and the market disagree, the disagreement is the point.

---

## Executive Summary

**What it is.** A single-input "business logbook" web app: you paste/type messy business activity, a Groq LLM extracts structured entities (amount, client, category, task, sentiment, confidence…), a reactive Convex dashboard of "Adaptive Canvas Blocks" updates live, and you can export a PDF client/progress report. Source traceability (every number clicks back to its original log) is the stated trust differentiator. The build on the `extraction-and-trust` branch is real and substantially complete for the MVP wedge.

**The core tension surfaced by research.** The product is built around the belief that the expensive, monetizable pain is *turning messy narrative activity into a polished report*. The market evidence says otherwise on two fronts:

1. **In the segment with the strongest willingness to pay (marketing agencies), the pain is data aggregation, not writing.** 67% of agency owners name reporting as their #1 operational time sink, and the documented consensus is that "the biggest pain point is gathering and normalizing data from multiple platform sources, not the actual writing or presentation of the reports" (HubSpot 2025 via DigitalApplied; Funnel.io; Improvado). Novos explicitly excludes integrations — it addresses the *cheaper half* of the pain.
2. **In the segment Novos actually serves (solo consultants / freelancers / creatives), the "messy notes → report" job is already commoditized and mostly free.** ClearNoteLab, Reportify AI, Kuse, NextDocs, ReportMaker.ai, AI Doc Maker, Gamma and Breadcrumb all do notes-to-report today, several free and no-login — plus ChatGPT/Claude do it directly.

**The deeper risk.** Novos's only defensible moat over "just use ChatGPT" is the *daily-logging habit* and the *structured, traceable data corpus that habit builds*. But sustained daily logging is precisely the hardest behavior to create: ~87% of journaling-app users quit within a week, and "the blank page is the killer." Meanwhile AI-wrapper products churn ~65% within 90 days (≈2× the SaaS norm) and 89% of users will switch to a cheaper tool with the same function. The product's entire value compounds only if users keep logging — and the base rate for that behavior is poor.

**What the product gets right.** Its retention instincts match the evidence: sub-10-second logging, auto-generated starter canvas (no blank page), weekly-summary surfaces, and source traceability all line up with what actually drives logging-app retention (tiny habit, guided structure, progress visibility). The traceability/trust layer is genuinely differentiated versus generic report generators.

**What's missing to even test the thesis.** There is **no billing integration** (no Stripe/Polar in the codebase) and **no enforced usage caps**. The PRD's central question — "will people pay to convert messy logs into reports?" — cannot currently be answered by the product because there is no way to pay and no paywall to hit.

**Bottom line.** The build quality and trust layer are strong, but the wedge is aimed at the low-WTP half of a pain whose commoditized solutions are free, and the whole model rests on a logging habit with a poor base survival rate. The highest-leverage moves are (a) sharpen positioning around traceability/the compounding log corpus rather than "report generation," (b) validate the logging habit and willingness-to-pay before building more surface area, and (c) resolve the identity split (the app ships as "CODEX" while the PRD, brand and domain are "Novos").

---

# PHASE 1 — Project Brief (repo-only)

*Everything in this section is derived strictly from the repository: PRD, README, ARCHITECTURE, CONTEXT, PRD.md, the canvas spec, source tree, schema, and git history. No external research.*

### 1.1 What this product is (one paragraph)

Novos is an AI-powered daily business logbook that converts unstructured business activity (typed notes, pasted emails/WhatsApp, uploaded files) into a live, self-organizing dashboard and on-demand professional PDF reports. The user logs in seconds via one universal input bar; a tiered Groq LLM pipeline extracts structured entities with confidence scores; a reactive Convex layer renders "Adaptive Canvas Blocks" (metric/chart/list/timeline/summary/source-log) that the user can freely move, resize, rename, hide, delete and mark for report inclusion; and every derived number traces back to its source log for trust. The stated design principle is "**fluid by default, structured underneath**" (`0001-prd-novos-ai-reporting-system.md`, §9; `adaptive-canvas-blocks-system.md`).

### 1.2 Core features — shipped vs planned

Assessed from the `extraction-and-trust` branch source, schema, and commit history.

**Shipped / working:**
- Universal composer: text + paste + file upload (text/CSV/PDF/XLSX), drag-drop, multi-file staging (`components/composer.tsx`, `app/api/process/route.ts`, `app/api/upload/route.ts`).
- AI extraction pipeline: tiered Groq model routing, multi-entity extraction, confidence scoring, deterministic timezone-aware date-reference resolution, failure/retry, defensive normalizer (git history `c621434`, `f1ed68f`, `8f4776e`, `f0fb6be`; `utils/api/*`).
- Convex reactive data layer for logs + blocks; <2s live updates via subscriptions (`convex/schema.ts`, `convex/logs.ts`, `convex/blocks.ts`, `a7ba70c`).
- Adaptive Canvas Blocks: all 6 types, React-Grid-Layout move/resize, soft-delete with undo tombstone + purge cron, starter-canvas onboarding by work type (`convex/blocks.ts`, `convex/crons.ts`, `eed816a`).
- Source traceability: Original Log Modal, per-field corrections with immutable audit trail, exclude-from-reports, click-through from block to source (`70ca5e0`, `b43886d`, `app/page.tsx`).
- Conflict/duplicate detection with keep/revert (`app/page.tsx` conflicts drawer).
- AI narrative summary blocks via Groq (`639c512`, `app/api/blocks/summary/route.ts`).
- Block-based PDF report export via react-pdf → Convex file storage; block selection, date range, stored report docs referencing block IDs (`911091e`, `convex/reports.ts`, `components/reports-modal.tsx`, `utils/report-pdf`).
- Tier model + block-to-block conversion + NL canvas commands gated to "Pro" (`fac7830`, `47f2651`, `lib/tiers`, `app/api/canvas/command/route.ts`).
- Time-travel snapshot slider (client-side filter to a past date).
- Supabase auth (email/password + Google OAuth) with custom-JWT validation into Convex (`96180d2`, `middleware.ts`).
- Settings (currency, timezone, AI language, conflict detection, density, retention).

**Planned / stubbed / not built:**
- **Voice input / Whisper transcription** — composer renders a `Mic` button but `onMicClick` is optional and unwired; no Whisper integration. UI stub only. (PRD P1.)
- **Billing / monetization** — *no Stripe/Polar/checkout code anywhere.* Tiers gate a feature (NL commands) but there is no payment path.
- **Enforced usage caps** — the PRD's free-tier "30 logs/month, 1 PDF/month" paywall is **not enforced** in `convex/` or `app/api/process`. No monthly counting/limit found.
- File *content* parsing for PDF/XLSX is shallow (client reads text-based files ≤500KB and slices 4000 chars; binary PDFs/XLSX are logged as filename stubs, not parsed).
- Post-MVP items (client workspaces, additional templates, integrations, team, mobile) — not started, correctly deferred.

**Architectural note — mid-migration:** The repo is transitioning from an older Supabase-backed app ("Codex," per `README.md`/`ARCHITECTURE.md`/`PRD.md`) to the Convex-backed "Novos" vision (`0001-prd…`). Logs/blocks/reports now live in Convex; auth and settings still run through Supabase + Next API routes. README/ARCHITECTURE still describe the older Supabase/HTML-export design and are stale relative to the shipped Convex code.

### 1.3 Stated / inferred target market

**Stated directly** (`0001-prd…` §2, §4): "solo operators, consultants, freelancers, creative professionals, and micro-agencies." Primary personas: Consultant/Freelancer, Creative Professional, Micro-Agency Lead (1–5 people), Small Business Owner. User attributes: non-technical, time-poor, admin-averse, client-facing. Secondary: PMs in small teams, solopreneurs reporting to investors/funders.

**Inferred (assumption, not stated):** Origin/first market is likely **South Africa / ZAR**. Evidence: currency examples throughout the PRD are Rand ("Paid R850 for transport", `currency: "ZAR"`, `base_currency: "ZAR"` in the data model). The PRD also repeatedly cites WhatsApp as a primary source of messy input. This is an *inference from artifacts*, not an explicit market statement — flagged as an assumption.

### 1.4 Stated / inferred core problem

Stated (`0001-prd…` §1, §3): business owners/freelancers/consultants "waste significant time manually organising information scattered across WhatsApp threads, email inboxes, voice notes, and spreadsheets — just to produce a coherent weekly or monthly business report." The friction between capturing real activity and producing polished reporting "creates invisible admin drag" and "weakens client communication." Novos "reduces the distance between messy real-world activity and polished business reporting."

### 1.5 Claimed value proposition

- Commercial promise: *"Speak, paste, or upload messy business information, and Novos instantly turns it into a clean dashboard and professional PDF report."*
- Tagline: *"Log once. Dashboard updates automatically. Report is ready when you need it."*
- Feel: *"A living business notebook that quietly organises itself into a report."*
- Validation-plan landing promise: *"Turn daily business notes into client-ready reports automatically."*
- The trust wedge: *"Every insight must be explainable back to its original log."*

**Important:** this value proposition currently lives only in internal docs. `public/` is empty (just `.gitkeep`) — there is **no landing page or marketing surface** in the repo. The one user-facing brand string in the running app is "**CODEX**" (`app/page.tsx` header), not "Novos."

### 1.6 Unclear / contradictory — flagged as assumptions

1. **Product identity is split.** PRD/brand/domain = "Novos" (ainovos.com); shipped UI and older docs = "Codex." Unresolved in the repo.
2. **Target market is broad and unfocused.** Five personas spanning solo consultants → e-commerce sellers → small-business owners is a very wide ICP for an MVP; the PRD's own MVP wedge narrows to "AI Client Report Generator from Daily Logs," but the build (starter canvases for 6 work types, generic categories) hedges across all of them.
3. **Geography is inferred, not stated** (ZAR/WhatsApp signals → South Africa). Pricing is quoted in USD ($9/$19–29), which conflicts with a ZAR-first audience.
4. **Monetization is designed but untestable** — tiers/pricing fully specified in the PRD, zero billing implemented. The product cannot currently observe willingness to pay.
5. **"Report" ambiguity** — PRD §12 specifies a rich PDF (exec summary, metrics, charts, appendix); the shipped path is block-snapshot → react-pdf. Fidelity/quality of the actual output vs. the "forwardable to a client without embarrassment" bar (PRD.md success criteria) is not verifiable from code alone.

---

# PHASE 2 — Market Research Findings (external, with sources)

*Everything below is from outside the repo. Where evidence was thin or search could not surface first-person community quotes, that is stated rather than filled with plausible-sounding assumptions. Search tooling is US-centric, which is a material limitation given the app's likely ZAR/South-Africa origin (see §2.6).*

### 2.1 Where the real, paid pain is: data aggregation, not writing

The loudest, best-monetized "client reporting" pain is **consolidating data across platforms**, which is *not* what Novos does:

- **67% of agency owners identify reporting as their single biggest operational time sink**; average agency spends **15+ hours/week** on manual report creation; the documented consensus is that "the biggest pain point is gathering and normalizing data from multiple platform sources, **not the actual writing or presentation** of the reports themselves." [DigitalApplied — Client Reporting 2026](https://www.digitalapplied.com/blog/agency-client-reporting-automation-2026-agent-written); [Improvado](https://improvado.io/blog/what-is-client-reporting); [Funnel.io](https://funnel.io/blog/client-reporting)
- Agencies reportedly waste ~**56 hours/week** on manual reporting (Agorapulse, via HubSpot); post-automation studies claim ~**137 billable hours/month** recovered (AgencyAnalytics 2022), i.e. ~$20–30k/mo of capacity at $150–224/hr rates. [HubSpot — client reporting tools](https://blog.hubspot.com/marketing/client-reporting-tools-that-will-save-your-agency-time); [Wayfront](https://wayfront.com/blog/agency-client-reporting)
- The incumbent tools (AgencyAnalytics, Whatagraph, Improvado, Cometly) compete almost entirely on **integrations/connectors** and their top complaints are integration instability and pricing — again, a data-plumbing problem, not a writing problem. [G2 — AgencyAnalytics](https://www.g2.com/products/agencyanalytics/reviews); [Whatagraph pricing](https://whatagraph.com/blog/articles/agencyanalytics-pricing)

**Implication:** the segment most willing to pay real money for "reporting" wants a data connector Novos deliberately does not build. **Confidence: High.**

### 2.2 The job Novos does *is* real — but commoditized and largely free

For the narrative "messy notes → clean document" job, a crowded field already exists, much of it free/no-login, several explicitly aimed at Novos's exact personas:

- **ClearNoteLab** — "Transform messy notes into professional documentation," templates "for consultants, freelancers, and founders," "messy client call notes into delivery-ready documents in 30 seconds." (Near-identical positioning to Novos's report step.) [clearnotelab.com](https://clearnotelab.com/)
- **Reportify AI** — messy meeting notes/chat logs → "executive-level assets." [goreportify.com](https://goreportify.com/)
- **ReportMaker.ai** — paste messy notes → complete report, "core report generation feature is fully free." [reportmaker.ai](https://reportmaker.ai/text-to-report-ai)
- **Kuse, NextDocs, AI Doc Maker, Gamma, Breadcrumb** — variants of notes/data → structured report/deck, several free. [Kuse](https://www.kuse.ai/ai-tools/ai-report-generator); [NextDocs](https://www.nextdocs.io/ai-report-free-tool); [Gamma](https://gamma.app/solutions/consultants); [Breadcrumb](https://www.breadcrumb.ai/blog/ai-report-for-consultants)
- **Plus the substitute everyone already has:** ChatGPT/Claude do paste-notes-to-report directly; documented consultant workflow is spreadsheet → paste as plain text → ChatGPT summary. [Bricks](https://www.thebricks.com/resources/how-to-create-a-weekly-report-with-chatgpt); [thedigitalprojectmanager AI tools for consultants](https://thedigitalprojectmanager.com/tools/best-ai-tools-for-consultants/)

**Implication:** the report-generation step is not a differentiator; it is table stakes and free elsewhere. **Confidence: High.**

### 2.3 The AI-wrapper trap and "just use ChatGPT"

- AI-wrapper startups churn **~65% within 90 days** vs. a ~35% SaaS average; **78%** of 2024 AI startups are essentially API wrappers on the same foundation models. [BuildMVPFast — AI-tool fatigue](https://www.buildmvpfast.com/blog/ai-tool-fatigue-saas-positioning); [Medium/Illumination — expensive wrappers](https://medium.com/illumination/most-ai-startups-are-just-expensive-wrappers-and-users-are-starting-to-notice-e0253f74ee6e)
- **89%** would switch to a direct competitor offering the same AI function cheaper (SaaS Capital, cited via BuildMVPFast) — the "just use ChatGPT" default when value is unclear.
- What survives: tools that "solve a specific, narrow problem for a defined audience" and become **embedded in a daily workflow** — "when a tool becomes embedded in someone's daily workflow, they don't switch." [BuildMVPFast](https://www.buildmvpfast.com/blog/ai-tool-fatigue-saas-positioning); [Superframeworks](https://superframeworks.com/articles/best-micro-saas-ideas-solopreneurs)

**Implication:** Novos's survival depends on becoming a daily habit with a proprietary, compounding data asset — not on the AI output quality, which is copyable. **Confidence: High.**

### 2.4 The load-bearing assumption is the weakest: sustained daily logging

Novos only accrues value if users keep logging. The base rate for that behavior is poor:

- **~87% of journaling-app users quit within a week.** "The blank page is the killer… guided apps work better." [MyAmira — journaling app retention](https://www.myamira.com/blog/journaling-app-works)
- Broader mobile benchmark: ~**96%** of users churn by day 30. [Userpilot](https://userpilot.com/blog/mobile-app-retention/)
- Retention that *does* work in logging apps: **tiny habit (<60s), progress visibility (weekly trend summaries), guided structure, accountability** (2–3× 90-day retention with an accountability partner). [MyAmira](https://www.myamira.com/blog/journaling-app-works); [ProductGrowth — habit loops](https://productgrowth.in/insights/healthtech/health-app-retention-guide/)

**Implication (double-edged):** the retention risk to the whole thesis is severe, *but* Novos's design choices (sub-10s logging, no-blank-canvas starter dashboard, weekly summary blocks, live progress) are aligned with the known winning levers. The gap is on **accountability/nudges** (reminders, streaks, scheduled prompts) — which the PRD lists as a non-goal ("no automated alerts or push notifications"). **Confidence: High on the retention risk; Medium on how well the current build actually converts it.**

### 2.5 Where the wallet already is: bundled freelancer suites

- **Bonsai** (now Zoom-owned) $15/user/mo and **HoneyBook** $39/mo already own the freelancer-tool subscription slot, bundling proposals, contracts, invoicing, client portals, time tracking. Reporting is a feature inside them, not the hook. [InvoiceQuickly — HoneyBook vs Bonsai](https://invoicequickly.com/blog/honeybook-vs-bonsai); [NerdWallet — freelance invoice software](https://www.nerdwallet.com/business/software/best/freelance-invoice-software)
- Subscription fatigue is real and caps how many tools a solo will adopt; users pay "a few dollars a month if it saves time, embarrassment, or lost opportunities." [NPR — who pays for AI](https://www.npr.org/2026/06/04/nx-s1-5791661/chatgpt-gemini-claude-subscription-revenue-openai); [BuildMVPFast](https://www.buildmvpfast.com/blog/ai-tool-fatigue-saas-positioning)

**Implication:** a standalone reporting tool competes for a scarce subscription slot against suites where the client relationship (and money) already lives. **Confidence: Medium-High.**

### 2.6 Emerging-market / WhatsApp-native validates the *input*, threatens the *form factor*

If the true first market is South Africa/ZAR (Phase 1 inference), the closest live analogs are **WhatsApp-native**, not dashboards:

- **CashMate** — "AI-powered WhatsApp finance agent that logs transactions in natural language, extracts data from receipts and voice notes, and delivers instant report summaries… eliminates app switching by allowing you to track everything right inside WhatsApp."
- **EazyBookkeeping** — AI voice entry ("I spent $25 on coffee at Starbucks" → auto-categorized). [Search: SA WhatsApp bookkeeping — via GetApp/Gumroad/App Store listings]

**Implication:** the natural-language / voice / WhatsApp *input* behavior is validated and demanded — but the winning products live **inside WhatsApp with zero app-switching**, while Novos asks users to come to a separate web app. In this segment, WhatsApp-native (PRD's P2) may be the actual wedge, not a deferred nicety. **Confidence: Medium** (US-only search limited depth on SA sources; treat as directional, not settled).

### 2.7 A note on report consumption

Multiple agency sources report **~40% of clients don't read the full report** and skim for "up and to the right." [Wayfront](https://wayfront.com/blog/agency-client-reporting); [Madgicx](https://madgicx.com/blog/agency-client-reporting-process) — a reason to be wary of over-investing in report richness/polish relative to logging habit and trust. **Confidence: Medium.**

### 2.8 Evidence gaps (stated, not filled)

- **First-person community complaints** (Reddit/X/forums) about *narrative* report-writing pain from solo consultants were **not reliably surfaced** by search; the strong pain quotes found are agency/data-aggregation flavored (§2.1). I am not asserting the solo narrative pain is severe — I could not evidence its severity/frequency either way. **Confidence: Low on solo narrative pain severity.**
- **South-African market sizing and WTP** are under-evidenced due to US-centric search. Flagged as an open question, not a finding.

---

# PHASE 3 — Gap Analysis

### 3.1 Pain/Need vs. Product

| Pain / Need (from Phase 2) | Addressed by product? | Evidence | Confidence |
|---|---|---|---|
| Consolidate/normalize data across platforms (the #1 paid agency pain, §2.1) | **Not at all** | PRD lists integrations as P2/non-goal; no connectors in code | High |
| Turn messy narrative notes into a clean document (§2.2) | **Fully** | Extraction pipeline + summary blocks + PDF export, all shipped | High — but commoditized/free elsewhere |
| Avoid the "just use ChatGPT" default via an embedded daily habit + owned data (§2.3) | **Partially** | Habit-forming design exists; but no reminders/streaks, no billing to lock value, brand split | Medium |
| Sustain the daily-logging habit (§2.4) | **Partially** | Sub-10s logging, starter canvas, weekly summaries ✓; no accountability/nudges (PRD non-goal) ✗ | Medium |
| Trust the AI output / defend a number to a client (§2.3, PRD trust wedge) | **Fully** | Source traceability, confidence scores, correction audit trail, Original Log Modal | High — genuine differentiator |
| Voice / WhatsApp / natural-language input with no app-switching (§2.6) | **Partially / Not at all** | NL text ✓; voice is an unwired stub; no WhatsApp channel; requires separate web app | High |
| Fit within an already-paid tool stack without adding a subscription (§2.5) | **Not at all** | Standalone app; no integration into Bonsai/HoneyBook-style suites; no billing yet | Medium-High |
| Actually pay / observe willingness to pay | **Not at all** | No Stripe/Polar, no enforced caps | High |
| Charts/visuals in the report (ChatGPT's noted weakness, §2.2) | **Fully** | Recharts blocks + block-snapshot PDF | Medium |

### 3.2 Overbuilt (market gives little/no signal anyone needs it)

- **Time-travel / snapshot slider.** No external pull found; adds UI complexity to an MVP whose thesis is unproven. (PRD itself deprioritizes "time-machine.")
- **Six block types + block-to-block conversion + NL canvas commands (Pro).** Canvas *flexibility* is bet as the premium lever, but no evidence users want block-manipulation power; §2.4 says progress-visibility and tiny-habit drive retention, not manipulation surface. Conversion/NL-commands are polish on an unvalidated core.
- **Conflict/duplicate detection.** Sophisticated, but no market signal that solo loggers feel "duplicate log" pain; more relevant at data-aggregation scale (which Novos doesn't serve).
- **Rich report richness (appendix, multi-section).** §2.7: ~40% of clients skim. Over-investing in report fidelity before validating the logging habit is misallocated.

### 3.3 Missing (strong market evidence, product doesn't address)

- **Any retention/accountability mechanic** — reminders, streaks, scheduled prompts, email nudges. §2.4 says this is a top-3 retention lever and is *the* risk to the model; the PRD explicitly excludes it. Highest-severity gap.
- **A payment path + usage caps** — cannot test the core commercial question without it. High severity.
- **Voice input (functional)** and **WhatsApp-native capture** — §2.6 shows this is the demanded, validated input behavior in the likely home market; currently a stub / not built.
- **A place to meet the user where money already is** — no integration/embed into the freelancer suites (§2.5) that own the client relationship.
- **A landing page / value-prop surface** to run the PRD's own Stage-1 validation test. `public/` is empty.

### 3.4 Mis-positioned (solves a real pain, but not said in the market's language)

- **Traceability is undersold.** The product's genuinely differentiated asset — "defend any number in the report back to its source log, with confidence scores and an edit trail" — is buried as a "trust feature," while the headline ("turn messy notes into a report") points straight at the commoditized, free capability (§2.2). The market language that isn't yet claimed: *auditable/defensible reporting*, *"never get caught out by a number in a client report."*
- **"Dashboard/BI" framing risk.** The canvas-of-blocks UI reads like a generic dashboard builder — a category the PRD explicitly says Novos is *not* — inviting comparison to tools it will lose to. The compounding **log corpus / memory** is the real asset and isn't the story.
- **Brand incoherence.** Shipping as "CODEX" while marketing as "Novos" fractures whatever positioning exists (§1.5).

---

# PHASE 4 — Recommendations

*Prioritized, not exhaustive. Each item names the Phase 2/3 evidence behind it. No recommendation without a cited reason.*

### 4.1 Quick wins (low effort, closes a validated gap)

1. **Resolve the identity split to "Novos" everywhere (or decide on "Codex" deliberately).** Ship one name in-app, in docs, and on the (missing) landing page. *Because:* brand incoherence (§1.5) undermines any positioning and any wrapper trying to escape "just use ChatGPT" needs a coherent identity (§2.3).
2. **Add a lightweight retention nudge before adding any new feature:** a daily/weekly logging reminder (email is enough to start) and a visible streak/"days logged" counter. *Because:* accountability + progress visibility are documented top retention levers, and the logging habit is the model's single biggest risk (§2.4). This directly contradicts a PRD non-goal — that non-goal should be revisited.
3. **Reframe the headline from "generate reports" to traceability/defensibility.** e.g. "Every number in your client report traces back to what you actually logged." *Because:* report generation is free/commoditized (§2.2); traceability is the one thing ChatGPT/free tools don't give (§2.3, §3.4). No code change — messaging only.
4. **Stand up the landing page and run the PRD's own Stage-1 test** (100+ signups / >30% pricing clicks) *before* building more. *Because:* `public/` is empty and the PRD's validation plan was never executed; §2.8 shows solo narrative-pain severity is currently unevidenced — this is the cheapest way to get real signal.

### 4.2 Strategic bets (higher effort, justified by repeated signal)

1. **Instrument and validate the logging habit + willingness to pay: ship billing + caps, and measure D7/D30 logging retention.** *Because:* the product literally cannot answer "will they pay?" today (no Stripe/Polar, no caps, §1.2); and AI-wrapper economics live or die on retention (§2.3–2.4). This is the gating experiment for everything else.
2. **Make capture meet the user where they already are — voice first, then a WhatsApp-native capture channel** (log by sending a WhatsApp message / voice note; the dashboard/report becomes the "pull" surface). *Because:* natural-language/voice/WhatsApp input is validated and demanded, and the winning analogs (CashMate, EazyBookkeeping) are WhatsApp-native with zero app-switching (§2.6). This is also the most credible way to beat the "blank page" and reduce logging friction below the 60s threshold (§2.4). Re-rank WhatsApp from P2 toward the wedge *if* SA is the real first market.
3. **Narrow the ICP to one persona and win it before broadening.** The evidence points to solo consultants/creatives who must produce *narrative*, defensible client updates (not metric dashboards) — i.e. lean into the half of the market where Novos's traceability matters and away from the data-aggregation half it can't serve (§2.1 vs §2.2). *Because:* survivors "solve a specific, narrow problem for a defined audience" (§2.3); five personas is too diffuse for an unvalidated MVP (§1.6).

### 4.3 Messaging fixes (no code change)

- Lead with **auditable/defensible reporting** and the **compounding log/memory** asset, not "AI dashboard" or "report generator" (§3.4).
- Explicitly say what Novos is *not* competing on — it is **not** a data-connector agency reporting tool (§2.1) — to avoid losing comparisons it can't win, and to attract the narrative-reporting user it can serve.
- Speak the market's outcome language: "stop rebuilding your client update from scratch every Friday," "never get caught out by a number in a client report."

### 4.4 Candidates to cut or deprioritize (overbuilt per §3.2)

- **Time-travel/snapshot slider** — no market signal; cut or hide until the core is validated.
- **NL canvas commands + block-to-block conversion (the "Pro" flexibility bet)** — betting premium on manipulation power contradicts the evidence that retention comes from tiny-habit + progress visibility, not canvas flexibility (§2.4). Keep gated but stop investing until logging retention is proven.
- **Conflict/duplicate detection** — low relevance to the solo logger; deprioritize maintenance.
- **Report richness (multi-section, appendix polish)** — hold at "good enough to forward"; §2.7 shows clients skim. Don't gold-plate the report before the habit is proven.

---

## Open Questions (need the project owner's answer before acting)

1. **What is the real first market — South Africa/ZAR or US/global?** Pricing is in USD but every example is ZAR/WhatsApp. This determines whether WhatsApp-native capture is the wedge (§2.6) and whether US-centric competitor research even applies.
2. **Is "Novos" or "Codex" the product?** Everything downstream (domain, brand, landing page) is blocked on this (§1.5).
3. **Has anyone actually paid, or said they would, for this specific job?** No billing exists and the PRD's concierge/landing validation stages appear un-run. What real demand signal exists beyond the PRD's own assertions? (§2.8 — solo narrative-pain severity is currently unevidenced.)
4. **Will the target user log daily without a nudge?** The entire model compounds on this and the base rate is ~87% quit-in-a-week (§2.4). Is there any early retention data, even from the concierge stage?
5. **Is the intended user the narrative-reporting solo (traceability matters) or the metric-reporting agency (data connectors matter)?** The build hedges; the market splits sharply (§2.1 vs §2.2). Picking one changes the roadmap.
6. **Given free notes-to-report tools and ChatGPT, what is the one thing a user cannot get elsewhere?** The audit's answer is *traceability + the compounding owned log corpus* — does the owner agree, and is the product willing to make that the headline rather than a footnote? (§3.4)
7. **Does the PRD's "no reminders/notifications" non-goal survive contact with the retention evidence?** (§2.4, §4.1.2)

---

*Sources are cited inline in Phase 2. Confidence levels reflect evidence strength; where the market could not be evidenced (solo narrative-pain severity; South-African sizing/WTP), that is stated as a gap rather than asserted.*
