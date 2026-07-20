// Maps Convex documents onto the existing snake_case Log/Widget shapes so the
// current helpers (lib/dashboard-utils.ts) and block components keep working
// unchanged against the new data layer.
import type { Log, LogEntity, Widget } from '@/lib/dashboard-utils';

export type ConvexLogDoc = {
  _id: string;
  userId: string;
  rawContent: string;
  type?: string | null;
  fileUrl?: string | null;
  category?: string | null;
  entities: LogEntity[];
  aiConfidence?: number | null;
  processingStatus?: Log['processing_status'];
  excludedFromReports?: boolean;
  isConflict?: boolean;
  conflictSourceId?: string | null;
  conflictReason?: string | null;
  corrections?: { field: string; from: unknown; to: unknown; at: number }[];
  timestamp: number;
};

export type ConvexBlockDoc = {
  _id: string;
  userId: string;
  type: string;
  title: string;
  queryConfig: { category?: string; w?: number; h?: number; x?: number; y?: number } & Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
  visible: boolean;
  pinned: boolean;
  includeInReports: boolean;
  createdAt: number;
  deletedAt?: number | null;
};

export function convexLogToLog(doc: ConvexLogDoc): Log {
  return {
    id: doc._id,
    user_id: doc.userId,
    raw_content: doc.rawContent,
    type: doc.type ?? '',
    file_url: doc.fileUrl ?? undefined,
    category: doc.category ?? 'Other',
    entities: doc.entities,
    ai_confidence: doc.aiConfidence ?? null,
    processing_status: doc.processingStatus,
    excluded_from_reports: doc.excludedFromReports,
    is_conflict: doc.isConflict ?? false,
    conflict_source_id: doc.conflictSourceId ?? undefined,
    conflict_reason: doc.conflictReason ?? undefined,
    timestamp: new Date(doc.timestamp).toISOString(),
  };
}

export function convexBlockToWidget(doc: ConvexBlockDoc): Widget {
  return {
    id: doc._id,
    user_id: doc.userId,
    type: doc.type,
    title: doc.title,
    config: {
      category: doc.queryConfig?.category ?? '',
      x: doc.layout.x,
      y: doc.layout.y,
      w: doc.layout.w,
      h: doc.layout.h,
    },
    created_at: new Date(doc.createdAt).toISOString(),
  };
}
