import { CATEGORIES } from '@/lib/categories';
import { ENTITY_STATUSES, ENTITY_TYPES, type LogEntity } from '@/lib/dashboard-utils';

export const NEEDS_REVIEW_THRESHOLD = 0.75;
const FALLBACK_CONFIDENCE = 0.5;
const MAX_ENTITIES = 20;

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
const URGENCIES = ['low', 'medium', 'high'] as const;

function asEnum<T extends string>(value: unknown, values: readonly T[]): T | null {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;
}

function asString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function asAmount(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

function asConfidence(value: unknown): number {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return FALLBACK_CONFIDENCE;
  return Math.min(1, Math.max(0, num));
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function asStringArray(value: unknown, max = 10): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 80))
    .slice(0, max);
  return items.length > 0 ? items : undefined;
}

export function fallbackEntity(): LogEntity {
  return {
    type: 'note',
    category: 'Other',
    date: null,
    date_reference: null,
    amount: null,
    currency: null,
    client: null,
    project: null,
    task: null,
    status: null,
    issue_or_risk: null,
    deliverable: null,
    sentiment: null,
    urgency: null,
    confidence: FALLBACK_CONFIDENCE,
  };
}

export function normalizeEntity(raw: unknown): LogEntity {
  const e = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    type: asEnum(e.type, ENTITY_TYPES) ?? 'note',
    category: asEnum(e.category, CATEGORIES) ?? 'Other',
    date: asIsoDate(e.date),
    date_reference: asString(e.date_reference, 120),
    amount: asAmount(e.amount),
    currency: asString(e.currency, 8),
    client: asString(e.client, 120),
    project: asString(e.project, 120),
    task: asString(e.task, 300),
    status: asEnum(e.status, ENTITY_STATUSES),
    issue_or_risk: asString(e.issue_or_risk, 300),
    deliverable: asString(e.deliverable, 300),
    sentiment: asEnum(e.sentiment, SENTIMENTS),
    urgency: asEnum(e.urgency, URGENCIES),
    confidence: asConfidence(e.confidence),
    names: asStringArray(e.names),
    tags: asStringArray(e.tags),
  };
}

/**
 * Defensive normalization of LLM output before any DB write.
 * Accepts a bare array or a { entities: [...] } wrapper; anything else
 * (or an empty list) becomes a single low-confidence note so the log
 * is preserved and flagged for review.
 */
export function normalizeEntities(raw: unknown): LogEntity[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { entities?: unknown }).entities)
      ? ((raw as { entities: unknown[] }).entities)
      : null;
  if (!list || list.length === 0) return [fallbackEntity()];
  return list.slice(0, MAX_ENTITIES).map(normalizeEntity);
}

/** A chain is as trustworthy as its weakest extraction. */
export function overallConfidence(entities: LogEntity[]): number {
  return entities.reduce((min, e) => Math.min(min, e.confidence), 1);
}

export function primaryCategory(entities: LogEntity[]): string {
  if (entities.length === 0) return 'Other';
  return entities.reduce((best, e) => (e.confidence > best.confidence ? e : best)).category;
}

export function statusFor(confidence: number): 'processed' | 'needs_review' {
  return confidence < NEEDS_REVIEW_THRESHOLD ? 'needs_review' : 'processed';
}
