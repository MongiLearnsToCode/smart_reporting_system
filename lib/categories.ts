export const CATEGORIES = [
  "Finance", "Projects", "Clients", "Tasks", "Operations", "Marketing", "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_COLORS: Record<string, {
  bg: string;
  text: string;
  dot: string;
  border: string;
  chart?: string;
}> = {
  Finance: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/30" },
  Projects: { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/30" },
  Clients: { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400", border: "border-purple-500/30" },
  Tasks: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-500/30" },
  Operations: { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400", border: "border-cyan-500/30" },
  Marketing: { bg: "bg-pink-500/15", text: "text-pink-400", dot: "bg-pink-400", border: "border-pink-500/30" },
  Other: { bg: "bg-zinc-500/15", text: "text-zinc-400", dot: "bg-zinc-400", border: "border-zinc-500/30" },
};

export const CATEGORY_COLORS_DETAIL: Record<string, {
  bg: string;
  text: string;
  dot: string;
  border: string;
  chart: string;
}> = {
  Finance: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", border: "border-emerald-500/30", chart: "#34d399" },
  Projects: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400", border: "border-blue-500/30", chart: "#60a5fa" },
  Clients: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400", border: "border-purple-500/30", chart: "#a78bfa" },
  Tasks: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-500/30", chart: "#fb923c" },
  Operations: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400", border: "border-cyan-500/30", chart: "#22d3ee" },
  Marketing: { bg: "bg-pink-500/10", text: "text-pink-400", dot: "bg-pink-400", border: "border-pink-500/30", chart: "#f472b6" },
  Other: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400", border: "border-zinc-500/30", chart: "#a1a1aa" },
};

export function getCat(cat: string) {
  return (
    CATEGORY_COLORS[cat] || {
      bg: "bg-zinc-500/15",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
    }
  );
}

export function getCatDetail(cat: string) {
  return (
    CATEGORY_COLORS_DETAIL[cat] || {
      bg: "bg-zinc-500/10",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
      border: "border-zinc-500/30",
      chart: "#a1a1aa",
    }
  );
}
