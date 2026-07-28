// Demo data for a test account.
//
// Internal-only: these are `internalMutation`s, so they have no public API
// surface and can only be invoked from the Convex CLI/dashboard. Run with:
//   npx convex run seed:seedDemoUser '{"userId":"<supabase-auth-sub>"}'
//   npx convex run --prod seed:seedDemoUser '{"userId":"<supabase-auth-sub>"}'
//
// seedDemoUser is idempotent: it clears anything already seeded for that user
// first, so re-running gives a clean, identical dataset.

import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { packGrid } from './lib/layout';
import type { Id } from './_generated/dataModel';

const DAY = 86400000;

type SeedEntity = {
  type?: string;
  category?: string;
  date?: string | null;
  amount?: number | null;
  currency?: string | null;
  client?: string | null;
  project?: string | null;
  task?: string | null;
  status?: string | null;
  issue_or_risk?: string | null;
  deliverable?: string | null;
  sentiment?: string | null;
  urgency?: string | null;
  confidence?: number;
};

type SeedLog = {
  /** Days before "now". Spread so 7/30/90-day report periods differ. */
  daysAgo: number;
  /** Which project the entry is filed under; undefined = whole business. */
  project?: 'northwind' | 'warehouse';
  category: string;
  raw: string;
  entities: SeedEntity[];
  status?: 'processed' | 'needs_review' | 'failed';
  confidence?: number;
  excluded?: boolean;
  conflict?: boolean;
  conflictReason?: string;
  fileName?: string;
};

function e(over: SeedEntity): SeedEntity {
  return { type: 'note', category: 'Other', confidence: 0.92, ...over };
}

// ---------------------------------------------------------------------------
// Northwind Rebrand — the flagship project. Rich enough on its own to produce
// a full four-section brief with a multi-category financial table.
// ---------------------------------------------------------------------------
const NORTHWIND: SeedLog[] = [
  {
    daysAgo: 2, project: 'northwind', category: 'Finance',
    raw: 'Paid the illustrator 1,250.75 for the brand mark studies. Invoice NW-114.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 1250.75, currency: 'USD', client: 'Northwind', task: 'Brand mark studies' })],
  },
  {
    daysAgo: 3, project: 'northwind', category: 'Finance',
    raw: 'Northwind settled the second milestone invoice, 8,000 received this morning.',
    entities: [e({ type: 'income', category: 'Finance', amount: 8000, currency: 'USD', client: 'Northwind', sentiment: 'positive' })],
  },
  {
    daysAgo: 4, project: 'northwind', category: 'Marketing',
    raw: 'Ran the teaser campaign on LinkedIn, 430 spent for the week.',
    entities: [e({ type: 'expense', category: 'Marketing', amount: 430, currency: 'USD', client: 'Northwind', task: 'Teaser campaign' })],
  },
  {
    daysAgo: 5, project: 'northwind', category: 'Tasks',
    raw: 'Brand guidelines signed off by the Northwind board. Finally done.',
    entities: [e({ type: 'task', category: 'Tasks', status: 'complete', deliverable: 'Brand guidelines', client: 'Northwind', sentiment: 'positive' })],
  },
  {
    daysAgo: 6, project: 'northwind', category: 'Tasks',
    raw: 'Launch deck delivered to the client, 24 slides plus the appendix.',
    entities: [e({ type: 'task', category: 'Tasks', status: 'complete', deliverable: 'Launch deck', client: 'Northwind' })],
  },
  {
    daysAgo: 6, project: 'northwind', category: 'Projects',
    raw: 'Printer contract still not signed, the vendor has gone quiet for a week. This is going to hold up the physical rollout.',
    entities: [e({ type: 'risk', category: 'Projects', status: 'blocked', task: 'Printer contract', issue_or_risk: 'Vendor unresponsive on contract', urgency: 'high', sentiment: 'negative', client: 'Northwind' })],
  },
  {
    daysAgo: 8, project: 'northwind', category: 'Clients',
    raw: 'Workshop with the Northwind marketing team went well, they want a second session on tone of voice.',
    entities: [e({ type: 'client_update', category: 'Clients', client: 'Northwind', status: 'in_progress', task: 'Tone of voice workshop', sentiment: 'positive' })],
  },
  {
    daysAgo: 11, project: 'northwind', category: 'Finance',
    raw: 'Stock photography licence renewed, 320.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 320, currency: 'USD', client: 'Northwind' })],
  },
  {
    daysAgo: 14, project: 'northwind', category: 'Tasks',
    raw: 'Website copy deck is open, waiting on the founder interview before we can draft.',
    entities: [e({ type: 'task', category: 'Tasks', status: 'open', task: 'Website copy deck', client: 'Northwind', urgency: 'medium' })],
  },
  {
    daysAgo: 19, project: 'northwind', category: 'Marketing',
    raw: 'Paid for the launch event photographer deposit, ZAR 6,500.',
    entities: [e({ type: 'expense', category: 'Marketing', amount: 6500, currency: 'ZAR', client: 'Northwind', task: 'Launch event' })],
  },
  {
    daysAgo: 24, project: 'northwind', category: 'Projects',
    raw: 'Kickoff complete. Scope is brand identity, guidelines, launch deck and a one-day workshop.',
    entities: [e({ type: 'project_update', category: 'Projects', status: 'complete', deliverable: 'Project kickoff', client: 'Northwind' })],
  },
  {
    daysAgo: 41, project: 'northwind', category: 'Finance',
    raw: 'Northwind paid the deposit invoice, 6,000.',
    entities: [e({ type: 'income', category: 'Finance', amount: 6000, currency: 'USD', client: 'Northwind' })],
  },
];

// ---------------------------------------------------------------------------
// Q3 Warehouse Move — a second, smaller project so scope switching is visible.
// ---------------------------------------------------------------------------
const WAREHOUSE: SeedLog[] = [
  {
    daysAgo: 1, project: 'warehouse', category: 'Operations',
    raw: 'Racking installed on the mezzanine, two days ahead of the plan.',
    entities: [e({ type: 'task', category: 'Operations', status: 'complete', deliverable: 'Mezzanine racking', sentiment: 'positive' })],
  },
  {
    daysAgo: 3, project: 'warehouse', category: 'Finance',
    raw: 'Removals firm invoice paid, 4,200.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 4200, currency: 'USD', task: 'Removals' })],
  },
  {
    daysAgo: 5, project: 'warehouse', category: 'Operations',
    raw: 'Forklift certification for two of the floor staff is still outstanding, booked for next month.',
    entities: [e({ type: 'task', category: 'Operations', status: 'open', task: 'Forklift certification', urgency: 'medium' })],
  },
  {
    daysAgo: 9, project: 'warehouse', category: 'Operations',
    raw: 'Fire inspection flagged the sprinkler coverage over the new racking. Needs a contractor before sign-off.',
    entities: [e({ type: 'risk', category: 'Operations', status: 'blocked', task: 'Sprinkler coverage', issue_or_risk: 'Fire inspection flagged sprinkler coverage', urgency: 'high', sentiment: 'negative' })],
  },
  {
    daysAgo: 16, project: 'warehouse', category: 'Finance',
    raw: 'Deposit on the new unit, 9,500.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 9500, currency: 'USD', task: 'Unit deposit' })],
  },
  {
    daysAgo: 22, project: 'warehouse', category: 'Projects',
    raw: 'Lease signed on the Parow unit. Handover 1 September.',
    entities: [e({ type: 'project_update', category: 'Projects', status: 'complete', deliverable: 'Lease signed' })],
  },
];

// ---------------------------------------------------------------------------
// Business-wide — not attached to any project. Exercises the default scope.
// ---------------------------------------------------------------------------
const BUSINESS: SeedLog[] = [
  {
    daysAgo: 1, category: 'Finance',
    raw: 'Monthly software stack: Figma, Adobe, Notion and Slack came to 512.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 512, currency: 'USD', task: 'Software subscriptions' })],
  },
  {
    daysAgo: 2, category: 'Clients',
    raw: 'Intro call with Harbour Foods about a packaging refresh. They will come back with a budget in two weeks.',
    entities: [e({ type: 'client_update', category: 'Clients', client: 'Harbour Foods', status: 'open', task: 'Packaging refresh proposal', sentiment: 'positive' })],
  },
  {
    daysAgo: 4, category: 'Tasks',
    raw: 'Quarterly VAT return submitted.',
    entities: [e({ type: 'task', category: 'Tasks', status: 'complete', deliverable: 'VAT return' })],
  },
  {
    daysAgo: 7, category: 'Operations',
    raw: 'Studio insurance renewed for the year, 1,180.',
    entities: [e({ type: 'expense', category: 'Operations', amount: 1180, currency: 'USD', task: 'Studio insurance' })],
  },
  {
    daysAgo: 9, category: 'Clients',
    raw: 'Meridian asked for a proposal on the annual report design. Deadline is tight.',
    entities: [e({ type: 'client_update', category: 'Clients', client: 'Meridian', status: 'open', task: 'Annual report proposal', urgency: 'high' })],
  },
  {
    daysAgo: 12, category: 'Finance',
    raw: 'Retainer from Meridian landed, 3,500.',
    entities: [e({ type: 'income', category: 'Finance', amount: 3500, currency: 'USD', client: 'Meridian' })],
  },
  {
    daysAgo: 13, category: 'Marketing',
    raw: 'Refreshed the studio portfolio site with the three most recent projects.',
    entities: [e({ type: 'task', category: 'Marketing', status: 'complete', deliverable: 'Portfolio refresh' })],
  },
  {
    daysAgo: 18, category: 'Operations',
    raw: 'Hired a part-time studio assistant, starting the first of next month.',
    entities: [e({ type: 'note', category: 'Operations', status: 'complete', deliverable: 'Studio assistant hired', sentiment: 'positive' })],
  },
  {
    daysAgo: 27, category: 'Finance',
    raw: 'Accountant fees for the quarter, 900.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 900, currency: 'USD', task: 'Accountancy' })],
  },
  {
    daysAgo: 34, category: 'Clients',
    raw: 'Harbour Foods went quiet after the intro call. Worth chasing before the end of the month.',
    entities: [e({ type: 'risk', category: 'Clients', client: 'Harbour Foods', issue_or_risk: 'Harbour Foods unresponsive since intro call', urgency: 'low' })],
  },
  {
    daysAgo: 52, category: 'Finance',
    raw: 'Annual domain and hosting renewals, 240.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 240, currency: 'USD' })],
  },
  {
    daysAgo: 71, category: 'Finance',
    raw: 'Old retainer client paid their final invoice, 2,200.',
    entities: [e({ type: 'income', category: 'Finance', amount: 2200, currency: 'USD' })],
  },

  // --- Edge cases, so the trust features have something to show ---
  {
    daysAgo: 2, category: 'Finance',
    raw: 'Software subscriptions for the month, about 512 total.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 512, currency: 'USD', task: 'Software subscriptions' })],
    conflict: true,
    conflictReason: 'This repeats the software subscription expense already logged today for the same amount.',
  },
  {
    daysAgo: 5, category: 'Other',
    raw: 'Might have spent something on the thing for the client, need to check the card statement.',
    entities: [e({ type: 'note', category: 'Other', confidence: 0.34, urgency: 'low' })],
    status: 'needs_review',
    confidence: 0.34,
  },
  {
    daysAgo: 8, category: 'Finance',
    raw: 'Personal lunch, 45. Not a business expense.',
    entities: [e({ type: 'expense', category: 'Finance', amount: 45, currency: 'USD' })],
    excluded: true,
  },
  {
    // Long file-style entry — also exercises the log modal's height cap.
    daysAgo: 10, category: 'Clients', fileName: 'northwind-workshop-transcript.txt',
    raw: [
      'File: northwind-workshop-transcript.txt',
      '',
      '00:00:04:12 - 00:00:41:08',
      'Facilitator',
      'Thanks everyone for making the time. The purpose of today is to agree the tone of voice for the rebrand, and to leave with three words we can hold every piece of copy against. Before we start, a quick reminder that the brand mark work is signed off, so nothing we decide today changes the visual identity.',
      '',
      '00:00:42:00 - 00:01:30:44',
      'Head of Marketing',
      'That is useful framing. Our worry with the current copy is that it reads like a logistics company from fifteen years ago. It is accurate but it is joyless. We move perishable goods across the country overnight, and none of that urgency or care comes through in how we write.',
      '',
      '00:01:31:10 - 00:02:38:02',
      'Facilitator',
      'So if we take the three-word exercise, what we heard from the wider team was precise, warm and awake. Precise because the operational promise is exact timing. Warm because the customer relationships are long and personal. Awake because the network genuinely runs through the night and that is a differentiator nobody else is claiming.',
      '',
      '00:02:39:30 - 00:03:52:19',
      'Operations Director',
      'I would push back gently on awake. It is a good word internally but I am not sure it survives contact with a procurement team reading a tender document. Precise and warm I have no issue with. Perhaps the third word is something closer to dependable, though I accept that is a duller choice and every competitor claims it.',
      '',
      '00:03:53:00 - 00:05:10:27',
      'Head of Marketing',
      'Dependable is table stakes. If we are going to spend money on a rebrand I would rather we said something the others are not saying. Awake at least earns a second read. We can always soften it in formal documents while keeping it in the brand-facing material.',
      '',
      '00:05:11:40 - 00:06:02:15',
      'Facilitator',
      'Let us park it as a working third word and test it against the launch deck copy. Action for us is to draft three headline treatments using precise, warm and awake, and one alternative set using dependable, so the board has something concrete to compare. We will bring both back a week on Thursday.',
    ].join('\n'),
    entities: [e({ type: 'client_update', category: 'Clients', client: 'Northwind', status: 'in_progress', task: 'Tone of voice workshop', deliverable: 'Headline treatments', sentiment: 'positive' })],
  },
];

const ALL_LOGS = [...NORTHWIND, ...WAREHOUSE, ...BUSINESS];

const STARTER_BLOCKS: { type: 'metric' | 'chart' | 'list' | 'timeline' | 'summary'; title: string; category?: string }[] = [
  { type: 'chart', title: 'Expenses', category: 'Finance' },
  { type: 'list', title: 'Open Tasks', category: 'Tasks' },
  { type: 'list', title: 'Client Updates', category: 'Clients' },
  { type: 'timeline', title: 'Project Progress', category: 'Projects' },
  { type: 'metric', title: 'Operations', category: 'Operations' },
  { type: 'summary', title: 'Weekly Summary' },
];

/** Removes everything previously seeded for this user, so re-runs are clean. */
async function wipe(ctx: any, userId: string) {
  const tables = ['logs', 'canvasBlocks', 'projects'] as const;
  let removed = 0;
  for (const table of tables) {
    const index = table === 'logs' ? 'by_user_time' : 'by_user';
    const rows = await ctx.db
      .query(table)
      .withIndex(index, (q: any) => q.eq('userId', userId))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
      removed++;
    }
  }
  const prefs = await ctx.db
    .query('userPrefs')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .unique();
  if (prefs) {
    await ctx.db.delete(prefs._id);
    removed++;
  }
  return removed;
}

export const seedDemoUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await wipe(ctx, userId);
    const now = Date.now();

    const northwind = await ctx.db.insert('projects', {
      userId,
      name: 'Northwind Rebrand',
      description: 'Brand identity, guidelines and launch',
      archivedAt: null,
      createdAt: now - 45 * DAY,
    });
    const warehouse = await ctx.db.insert('projects', {
      userId,
      name: 'Q3 Warehouse Move',
      description: 'Parow unit fit-out and relocation',
      archivedAt: null,
      createdAt: now - 30 * DAY,
    });
    // An archived project, so the picker's archive handling is visible.
    await ctx.db.insert('projects', {
      userId,
      name: 'Old Retainer (2025)',
      description: null,
      archivedAt: now - 20 * DAY,
      createdAt: now - 200 * DAY,
    });

    // Default entry scope is the flagship project — the composer and canvas
    // both open there, which is the behaviour worth testing first.
    await ctx.db.insert('userPrefs', {
      userId,
      defaultProjectId: northwind,
      updatedAt: now,
    });

    const projectIds: Record<string, Id<'projects'>> = { northwind, warehouse };

    const layouts = packGrid(STARTER_BLOCKS.map((b) => b.type));
    for (let i = 0; i < STARTER_BLOCKS.length; i++) {
      const block = STARTER_BLOCKS[i];
      await ctx.db.insert('canvasBlocks', {
        userId,
        type: block.type,
        title: block.title,
        queryConfig: block.category ? { category: block.category } : {},
        layout: layouts[i],
        visible: true,
        pinned: false,
        includeInReports: true,
        createdAt: now - 45 * DAY,
        deletedAt: null,
      });
    }

    let conflictSourceId: string | null = null;
    const inserted: Id<'logs'>[] = [];

    // Oldest first, so the conflict flagged below can point at an earlier entry.
    for (const log of [...ALL_LOGS].sort((a, b) => b.daysAgo - a.daysAgo)) {
      // Annotated to break the circular inference: `id` feeds conflictSourceId,
      // which is itself an argument to this insert.
      const id: Id<'logs'> = await ctx.db.insert('logs', {
        userId,
        projectId: log.project ? projectIds[log.project] : null,
        rawContent: log.raw,
        type: log.fileName ? 'file' : 'text',
        fileUrl: null,
        category: log.category,
        entities: log.entities as any,
        aiConfidence: log.confidence ?? 0.91,
        processingStatus: log.status ?? 'processed',
        excludedFromReports: log.excluded ?? false,
        isConflict: log.conflict ?? false,
        conflictSourceId: log.conflict ? conflictSourceId : null,
        conflictReason: log.conflict ? (log.conflictReason ?? null) : null,
        timestamp: now - log.daysAgo * DAY,
      });
      inserted.push(id);
      // Remember a Finance entry so the duplicate has something to reference.
      if (log.category === 'Finance' && !log.conflict) conflictSourceId = id;
    }

    // One entry with a correction trail, so the Original Log Modal has history.
    const corrected = inserted[Math.floor(inserted.length / 2)];
    await ctx.db.patch(corrected, {
      corrections: [
        { field: 'category', from: 'Other', to: 'Finance', at: now - 3 * DAY },
      ],
    });

    return {
      projects: 3,
      blocks: STARTER_BLOCKS.length,
      logs: inserted.length,
      defaultScope: 'Northwind Rebrand',
    };
  },
});

/** Removes every seeded row for a user. Run when you're done testing. */
export const clearDemoUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const removed = await wipe(ctx, userId);
    return { removed };
  },
});
