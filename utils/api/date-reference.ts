const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PATTERN = WEEKDAYS.join('|');

type Ymd = { y: number; m: number; d: number };

function partsInTz(date: Date, timeZone: string): { ymd: Ymd; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    ymd: { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')) },
    weekday: WEEKDAY_SHORT.indexOf(get('weekday')),
  };
}

function shift(ymd: Ymd, days: number): Ymd {
  const dt = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function format(ymd: Ymd): string {
  return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
}

/**
 * Deterministically resolves a natural-language date reference relative to
 * the submission moment in the user's timezone. Returns 'YYYY-MM-DD', or
 * null when the reference doesn't parse (caller keeps the LLM's guess).
 */
export function resolveDateReference(
  reference: string | null | undefined,
  submittedAt: Date,
  timeZone: string,
): string | null {
  if (!reference || typeof reference !== 'string') return null;
  const ref = reference.trim().toLowerCase();
  if (!ref) return null;

  let today: Ymd;
  let weekday: number;
  try {
    ({ ymd: today, weekday } = partsInTz(submittedAt, timeZone));
  } catch {
    return null;
  }
  if (weekday === -1 || !Number.isFinite(today.y)) return null;

  if (/^(today|tonight|this (morning|afternoon|evening))$/.test(ref)) return format(today);
  if (ref === 'yesterday') return format(shift(today, -1));
  if (ref === 'tomorrow') return format(shift(today, 1));
  if (ref === 'last week' || ref === 'a week ago' || ref === 'one week ago') return format(shift(today, -7));

  const daysAgo = ref.match(/^(\d{1,2}) days? ago$/);
  if (daysAgo) return format(shift(today, -Number(daysAgo[1])));

  const last = ref.match(new RegExp(`^last (${WEEKDAY_PATTERN})$`));
  if (last) {
    const target = WEEKDAYS.indexOf(last[1]);
    let diff = weekday - target;
    if (diff <= 0) diff += 7;
    return format(shift(today, -diff));
  }

  const next = ref.match(new RegExp(`^next (${WEEKDAY_PATTERN})$`));
  if (next) {
    const target = WEEKDAYS.indexOf(next[1]);
    let diff = target - weekday;
    if (diff <= 0) diff += 7;
    return format(shift(today, diff));
  }

  const bare = ref.match(new RegExp(`^(?:on )?(${WEEKDAY_PATTERN})$`));
  if (bare) {
    const target = WEEKDAYS.indexOf(bare[1]);
    let diff = weekday - target;
    if (diff < 0) diff += 7;
    return format(shift(today, -diff));
  }

  return null;
}
