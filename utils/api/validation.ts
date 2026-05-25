export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'NGN', 'KES', 'GHS'] as const;
export const TIMEZONES = ['UTC', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'] as const;
export const LANGUAGES = ['English', 'French', 'Spanish', 'Portuguese', 'German', 'Swahili', 'Zulu', 'Afrikaans', 'Arabic', 'Chinese', 'Hindi', 'Japanese'] as const;

export const DEFAULT_SETTINGS = {
  currency: 'USD',
  timezone: 'UTC',
  ai_language: 'English',
  conflict_detection: true,
  conflict_dismiss_days: 7,
  default_widget_sort: 'title',
  canvas_density: 'comfortable',
  data_retention_days: 90,
};

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function intInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseSettings(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};

  return {
    currency: isOneOf(body.currency, CURRENCIES) ? body.currency : DEFAULT_SETTINGS.currency,
    timezone: isOneOf(body.timezone, TIMEZONES) ? body.timezone : DEFAULT_SETTINGS.timezone,
    ai_language: isOneOf(body.ai_language, LANGUAGES) ? body.ai_language : DEFAULT_SETTINGS.ai_language,
    conflict_detection: typeof body.conflict_detection === 'boolean' ? body.conflict_detection : DEFAULT_SETTINGS.conflict_detection,
    conflict_dismiss_days: intInRange(body.conflict_dismiss_days, DEFAULT_SETTINGS.conflict_dismiss_days, 1, 90),
    default_widget_sort: isOneOf(body.default_widget_sort, ['title', 'created', 'recent'] as const) ? body.default_widget_sort : DEFAULT_SETTINGS.default_widget_sort,
    canvas_density: isOneOf(body.canvas_density, ['comfortable', 'compact'] as const) ? body.canvas_density : DEFAULT_SETTINGS.canvas_density,
    data_retention_days: intInRange(body.data_retention_days, DEFAULT_SETTINGS.data_retention_days, 1, 365),
  };
}

export function parseProcessPayload(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawContent = typeof body.rawContent === 'string' ? body.rawContent.trim() : '';
  if (!rawContent) throw new Error('Log content is required');
  if (rawContent.length > 12000) throw new Error('Log content is too long');

  const type = body.type === 'file' ? 'file' : 'text';
  const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.startsWith('https://')
    ? body.fileUrl
    : null;

  return { rawContent, type, fileUrl };
}

export function parseExportPayload(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const range = intInRange(body.range, 30, 1, 365);
  const template = typeof body.template === 'string' && body.template.trim()
    ? body.template.trim().slice(0, 80)
    : 'Executive Summary';

  return { range, template };
}

export function parseIndustry(input: unknown) {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return isOneOf(body.industry, ['solo', 'freelance', 'consultant', 'retail', 'creative', 'dev'] as const)
    ? body.industry
    : 'solo';
}
