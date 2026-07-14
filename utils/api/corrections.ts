import { CATEGORIES } from '@/lib/categories';
import { ENTITY_STATUSES, ENTITY_TYPES, type LogEntity } from '@/lib/dashboard-utils';

export const CORRECTABLE_FIELDS = [
  'category', 'type', 'status', 'amount', 'date', 'client', 'project', 'task',
] as const;
export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

function invalid(field: string): never {
  throw new Error(`Invalid value for "${field}"`);
}

function validateValue(field: CorrectableField, value: unknown): LogEntity[CorrectableField] {
  switch (field) {
    case 'category':
      if (typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)) return value;
      invalid(field);
    case 'type':
      if (typeof value === 'string' && (ENTITY_TYPES as readonly string[]).includes(value)) return value as LogEntity['type'];
      invalid(field);
    case 'status':
      if (value === null || value === '') return null;
      if (typeof value === 'string' && (ENTITY_STATUSES as readonly string[]).includes(value)) return value as LogEntity['status'];
      invalid(field);
    case 'amount': {
      if (value === null || value === '') return null;
      const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (Number.isFinite(num)) return num;
      invalid(field);
    }
    case 'date':
      if (value === null || value === '') return null;
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      invalid(field);
    case 'client':
    case 'project':
    case 'task': {
      if (value === null) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim().slice(0, 200);
        return trimmed || null;
      }
      invalid(field);
    }
  }
  invalid(field); // unreachable; satisfies TS return-path analysis
}

/**
 * Immutably applies user corrections to one entity, recording a per-field
 * audit entry. `from` always keeps the ORIGINAL AI value, even across
 * repeated corrections of the same field.
 */
export function applyCorrections(
  entities: LogEntity[],
  entityIndex: number,
  changes: Record<string, unknown>,
  at: string,
): LogEntity[] {
  if (!Number.isInteger(entityIndex) || entityIndex < 0 || entityIndex >= entities.length) {
    throw new Error('Invalid entity index');
  }
  return entities.map((entity, i) => {
    if (i !== entityIndex) return entity;
    const next: LogEntity = { ...entity, corrections: { ...(entity.corrections ?? {}) } };
    for (const [field, rawValue] of Object.entries(changes)) {
      if (!(CORRECTABLE_FIELDS as readonly string[]).includes(field)) {
        throw new Error(`Field "${field}" is not correctable`);
      }
      const value = validateValue(field as CorrectableField, rawValue);
      const current = (entity[field as CorrectableField] ?? null) as unknown;
      if (current === value) continue;
      // `in` check (not ??) so an original null value survives repeated corrections
      const priorAudit = entity.corrections && field in entity.corrections ? entity.corrections[field] : null;
      const original = priorAudit ? priorAudit.from : current;
      (next as Record<string, unknown>)[field] = value;
      next.corrections![field] = { from: original, to: value, at };
    }
    if (Object.keys(next.corrections!).length === 0) delete next.corrections;
    return next;
  });
}
