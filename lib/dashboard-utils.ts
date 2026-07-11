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

export type Log = {
  id: string;
  user_id: string;
  raw_content: string;
  type: string;
  file_url?: string;
  category: string;
  entities?: Entities;
  is_conflict: boolean;
  conflict_source_id?: string;
  conflict_reason?: string;
  timestamp: string;
};

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

/** Distinct client names from a set of logs, most recent first. */
export function uniqueClients(logs: Log[]): string[] {
  const seen = new Set<string>();
  for (const log of logs) {
    const client = log.entities?.client;
    if (typeof client === "string" && client.trim()) seen.add(client.trim());
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
