# DEEP RESEARCH: Product–Market Fit Audit

You are conducting a rigorous product–market fit audit on the codebase you have
access to. Work in the four phases below, in order. Do not skip to
recommendations before completing the earlier phases — each phase's output
feeds the next.

Treat this as an investigation, not a pitch. Your job is to surface the truth
about the gap between what this product does and what its market actually
needs, even where that's uncomfortable. Do not soften findings to make the
project look better than the evidence supports.

---

## Phase 1 — Understand the project (repo-only, no web yet)

Go through the repository thoroughly before touching the internet:

- README, CONTRIBUTING, and any /docs folder
- Any PRD, CONTEXT.md, CLAUDE.md, or planning docs already in the repo —
  these often state the intended target market and problem statement directly;
  quote them rather than re-deriving them
- package.json / wrangler.toml / requirements.txt etc. for stack and scope
- Source structure: what the core features actually are (not just what's
  planned/stubbed — distinguish shipped vs in-progress vs aspirational)
- Marketing copy if present (landing page, /public, email templates) — this is
  often the clearest statement of claimed value proposition
- Recent commit history / changelog for current direction and momentum
- Any tests or seed data that hint at real usage patterns

Produce a **Project Brief** with:
1. What this product is, in one paragraph
2. Core features, shipped vs planned
3. Stated or inferred target market / user persona
4. Stated or inferred core problem / pain being solved
5. Claimed value proposition (from copy, docs, or comments)
6. Anything unclear or contradictory that you had to infer rather than find
   explicitly stated — flag these as assumptions, not facts

## Phase 2 — Research the real market (web)

Now go outside the repo. Your goal is to find out what's actually true about
the target market identified in Phase 1 — not to confirm what the repo
already claims.

Research:
- Where the target users actually congregate and complain (Reddit, X,
  industry forums, HN, relevant Facebook groups, review sites) — search for
  the pain point in their own words, not the product's marketing language
- Direct competitors: what they offer, what their users praise and complain
  about (G2/Capterra/App Store/Play Store reviews are gold for this)
- Adjacent/substitute solutions — what people currently do instead of using a
  product like this (spreadsheets, manual process, a different category of
  tool entirely)
- Severity and frequency signals — is this pain a daily annoyance or a rare
  edge case? Do people express willingness to pay for a fix, or do they treat
  it as unsolvable/not worth solving?
- Any relevant trend, regulatory change, or market shift that changes the
  size or shape of this opportunity

Cite sources for every claim. If you can't find evidence for something,
say so explicitly rather than filling the gap with a plausible-sounding
assumption.

## Phase 3 — Gap analysis

Build a comparison table with these columns:
`Pain/Need (from Phase 2)` | `Addressed by product?` (Fully / Partially / Not at all) | `Evidence` | `Confidence`

Then separately call out:
- **Overbuilt**: features the product has invested in that market research
  gives no signal anyone actually needs
- **Missing**: pains with strong market evidence that the product doesn't
  address at all
- **Mis-positioned**: cases where the product solves a real pain but the
  README/marketing copy doesn't say so in the language the market actually
  uses

## Phase 4 — Recommendations

Prioritized, not exhaustive. For each recommendation, name the evidence from
Phase 2/3 it's based on — no recommendation without a cited reason.

- **Quick wins**: low effort, directly closes a validated gap
- **Strategic bets**: higher effort, justified by strong/repeated market
  signal
- **Messaging fixes**: no code change, just say what it already does in the
  market's language
- **Candidates to cut or deprioritize**: overbuilt features from Phase 3

Close with an **Open Questions** section: anything Phase 1–3 couldn't resolve
that needs a real answer from the person who owns this project before acting
on the recommendations above.

## Output

Write the full result to `/docs/market-fit-audit-<YYYY-MM-DD>.md` in this
structure: Executive Summary → Project Brief → Market Research Findings (with
sources) → Gap Analysis table → Recommendations → Open Questions.

Keep Phase 1 and Phase 2 clearly separated in the output — the reader needs to
be able to tell what came from the repo versus what came from outside
research at a glance.
