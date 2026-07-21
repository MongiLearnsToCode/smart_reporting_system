'use client';

import { MetricCard } from '@/components/metric-card';
import { ChartWidget } from '@/components/chart-widget';
import { ListWidget } from '@/components/list-widget';
import { logAmount, logSentiment, type Log } from '@/lib/dashboard-utils';
import { getCat, getCatDetail } from '@/lib/categories';
import type { ConvexBlockDoc } from '@/utils/convex/adapters';

// Resolve a block's queryConfig against the logs it draws from (spec §3 adaptive
// data path; reuses the aggregation helpers from lib/dashboard-utils).
export function logsForBlock(block: ConvexBlockDoc, logs: Log[]): Log[] {
  const category = block.queryConfig?.category;
  return logs.filter((l) => {
    if (l.excluded_from_reports) return false;
    if (category && l.category !== category) return false;
    return true;
  });
}

// Quiet uppercase section label, matching the control-room design language.
export function BlockLabel({ title, dot }: { title: string; dot?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {dot ? <div className={'h-1.5 w-1.5 shrink-0 rounded-full ' + dot} /> : null}
      <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{title}</h3>
    </div>
  );
}

export const PANEL = 'flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5';

// The visual body of a block. Shared by the live canvas and the report capture
// stage (spec §9) so an exported block looks exactly like it does on-canvas.
export function BlockBody({ block, logs }: { block: ConvexBlockDoc; logs: Log[] }) {
  const rows = logsForBlock(block, logs);
  const category = block.queryConfig?.category ?? '';
  const cat = getCat(category);
  const chartColor = getCatDetail(category).chart;
  switch (block.type) {
    case 'chart': {
      const data = rows
        .map((l) => ({ date: new Date(l.timestamp).toLocaleDateString(), value: logAmount(l)?.amount || 0 }))
        .reverse();
      return <ChartWidget title={block.title} data={data} color={chartColor} accentDot={cat.dot} />;
    }
    case 'list':
      return (
        <ListWidget
          title={block.title}
          accentDot={cat.dot}
          items={rows.map((l) => ({ text: l.raw_content, completed: false, date: new Date(l.timestamp).toLocaleDateString() }))}
        />
      );
    case 'metric': {
      const last = rows[0];
      const amount = last ? logAmount(last) : null;
      return (
        <MetricCard
          title={block.title}
          accentDot={cat.dot}
          value={amount ? amount.amount : rows.length}
          unit={amount?.currency || 'entries'}
          sentiment={last ? logSentiment(last) ?? undefined : undefined}
        />
      );
    }
    case 'timeline':
      return (
        <div className={PANEL}>
          <BlockLabel title={block.title} dot={cat.dot} />
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto border-l border-zinc-800 pl-3">
            {rows.map((l) => (
              <div key={l.id} className="relative">
                <div className={'absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full ' + cat.dot} />
                <p className="font-mono text-[10px] text-zinc-600">{new Date(l.timestamp).toLocaleString()}</p>
                <p className="line-clamp-2 text-sm text-zinc-300">{l.raw_content}</p>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-xs text-zinc-600">No activity yet.</p> : null}
          </div>
        </div>
      );
    case 'summary':
      // AI narrative, generated on demand and cached on the block (spec §4).
      return (
        <div className={PANEL}>
          <BlockLabel title={block.title} dot={cat.dot} />
          {block.summary ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{block.summary}</p>
              {block.summaryAt ? (
                <p className="mt-3 font-mono text-[10px] text-zinc-600">
                  as of {new Date(block.summaryAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500">
              {rows.length
                ? `${rows.length} recent ${category || 'log'} ${rows.length === 1 ? 'entry' : 'entries'} ready to summarize. Hover and hit ✨ to generate a narrative.`
                : 'Nothing to summarize yet.'}
            </p>
          )}
        </div>
      );
    case 'source_log':
      return (
        <div className={PANEL}>
          <BlockLabel title={block.title} dot={cat.dot} />
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {rows.map((l) => (
              <div key={l.id} className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
                <p className="line-clamp-2 text-sm text-zinc-300">{l.raw_content}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">
                  confidence {l.ai_confidence != null ? Math.round(l.ai_confidence * 100) + '%' : '—'}
                </p>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-xs text-zinc-600">No source logs yet.</p> : null}
          </div>
        </div>
      );
    default:
      return null;
  }
}
