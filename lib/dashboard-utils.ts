export function formatTimeAgo(timestamp: string | number | Date) {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const CURRENCIES = ["USD","EUR","GBP","ZAR","JPY","CAD","AUD","CHF","CNY","INR","BRL","MXN","NGN","KES","GHS"];
export const TIMEZONES = ["UTC","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Sao_Paulo","Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney"];
export const LANGUAGES = ["English","French","Spanish","Portuguese","German","Swahili","Zulu","Afrikaans","Arabic","Chinese","Hindi","Japanese"];

export const ENTITY_TYPES = [
  "expense", "income", "task", "client_update", "project_update", "risk", "note",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_STATUSES = ["open", "in_progress", "complete", "blocked"] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export type ProcessingStatus = "pending" | "processed" | "needs_review" | "failed";

export type EntityCorrection = { from: unknown; to: unknown; at: string };

export type LogEntity = {
  type: EntityType;
  category: string;
  date: string | null;
  date_reference: string | null;
  amount: number | null;
  currency: string | null;
  client: string | null;
  project: string | null;
  task: string | null;
  status: EntityStatus | null;
  issue_or_risk: string | null;
  deliverable: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  urgency: "low" | "medium" | "high" | null;
  confidence: number;
  corrections?: Record<string, EntityCorrection>;
  names?: string[];
  tags?: string[];
};

/** Pre-migration single-object shape; tolerated at read time only. */
export type Entities = {
  amount?: number;
  currency?: string;
  date?: string;
  sentiment?: string;
  urgency?: string;
  client?: string | null;
  names?: string[];
  tags?: string[];
};

export type Log = {
  id: string;
  user_id: string;
  raw_content: string;
  type: string;
  file_url?: string;
  category: string;
  entities?: LogEntity[] | Entities;
  ai_confidence?: number | null;
  processing_status?: ProcessingStatus;
  excluded_from_reports?: boolean;
  is_conflict: boolean;
  conflict_source_id?: string;
  conflict_reason?: string;
  corrections?: { field: string; from: unknown; to: unknown; at: number }[];
  timestamp: string;
};

function legacyToEntity(e: Entities, category: string): LogEntity {
  return {
    type: e.amount != null ? "expense" : "note",
    category: category || "Other",
    date: e.date ?? null,
    date_reference: null,
    amount: e.amount ?? null,
    currency: e.currency ?? null,
    client: typeof e.client === "string" ? e.client : null,
    project: null,
    task: null,
    status: null,
    issue_or_risk: null,
    deliverable: null,
    sentiment: (e.sentiment as LogEntity["sentiment"]) ?? null,
    urgency: (e.urgency as LogEntity["urgency"]) ?? null,
    confidence: 0.8,
    names: e.names,
    tags: e.tags,
  };
}

/** The single place that understands both entity storage shapes. */
export function entitiesOf(log: Log): LogEntity[] {
  const e = log.entities;
  if (Array.isArray(e)) return e;
  if (e && typeof e === "object" && Object.keys(e).length > 0) {
    return [legacyToEntity(e, log.category)];
  }
  return [];
}

export function primaryEntity(log: Log): LogEntity | null {
  const list = entitiesOf(log);
  if (list.length === 0) return null;
  return list.reduce((best, e) => ((e.confidence ?? 0) > (best.confidence ?? 0) ? e : best));
}

export function logClients(log: Log): string[] {
  const seen: string[] = [];
  for (const e of entitiesOf(log)) {
    const client = typeof e.client === "string" ? e.client.trim() : "";
    if (client && !seen.includes(client)) seen.push(client);
  }
  return seen;
}

export function logAmount(log: Log): { amount: number; currency: string | null } | null {
  let total = 0;
  let currency: string | null = null;
  let found = false;
  for (const e of entitiesOf(log)) {
    if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
      total += e.amount;
      found = true;
      if (!currency && e.currency) currency = e.currency;
    }
  }
  return found ? { amount: total, currency } : null;
}

export function logSentiment(log: Log): LogEntity["sentiment"] {
  return primaryEntity(log)?.sentiment ?? null;
}

export function logUrgency(log: Log): LogEntity["urgency"] {
  return primaryEntity(log)?.urgency ?? null;
}

/** Distinct client names from a set of logs, most recent first. */
export function uniqueClients(logs: Log[]): string[] {
  const seen = new Set<string>();
  for (const log of logs) {
    for (const client of logClients(log)) seen.add(client);
  }
  return Array.from(seen);
}

export type Widget = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  config: WidgetConfig;
  created_at: string;
};

export type WidgetConfig = {
  category: string;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
};

export type UserSettings = {
  currency: string;
  timezone: string;
  ai_language: string;
  conflict_detection: boolean;
  conflict_dismiss_days: number;
  default_widget_sort: "title" | "created" | "recent";
  canvas_density: string;
  data_retention_days: number;
};
