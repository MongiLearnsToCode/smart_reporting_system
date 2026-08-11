'use client';

import {
  usePaginatedQuery,
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  convexLogToLog,
  type ConvexBlockDoc,
  type ConvexLogDoc,
  type ConvexProjectDoc,
} from './adapters';
import type { Log, Project } from '@/lib/dashboard-utils';
import { normalizeTier, type Tier } from '@/lib/tiers';

// Reactive blocks feed (spec §7). Returns raw Convex block docs — the canvas
// needs layout/visible/pinned/includeInReports, not just the adapted Widget.
export function useBlocks(): { blocks: ConvexBlockDoc[]; loading: boolean } {
  const docs = useConvexQuery(api.blocks.list) as unknown as ConvexBlockDoc[] | undefined;
  return { blocks: docs ?? [], loading: docs === undefined };
}

// Reactive logs feed, adapted to the existing snake_case Log shape so all the
// current helpers/components keep working. Pass a projectId to narrow the feed
// to one project; omit it for the whole business.
export function useLogs(projectId?: string | null): { logs: Log[]; loading: boolean } {
  const docs = useConvexQuery(
    api.logs.list,
    projectId ? { projectId: projectId as never } : {},
  ) as unknown as ConvexLogDoc[] | undefined;
  return {
    logs: docs ? docs.map(convexLogToLog) : [],
    loading: docs === undefined,
  };
}

/**
 * A page-at-a-time activity feed. This deliberately does not share the canvas
 * subscription: the canvas has a bounded recent-data view while the feed can
 * grow only when the person reading it asks for more history.
 */
export function usePaginatedLogs(
  projectId?: string | null,
  category?: string | null,
): {
  logs: Log[];
  loading: boolean;
  canLoadMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
} {
  const { results, status, loadMore } = usePaginatedQuery(
    api.logs.listPage,
    {
      ...(projectId ? { projectId: projectId as never } : {}),
      ...(category ? { category } : {}),
    },
    { initialNumItems: 50 },
  );
  return {
    logs: (results as unknown as ConvexLogDoc[]).map(convexLogToLog),
    loading: status === 'LoadingFirstPage',
    canLoadMore: status === 'CanLoadMore',
    loadingMore: status === 'LoadingMore',
    loadMore: () => loadMore(50),
  };
}

/**
 * Full-text search over the user's entries, scoped the same way the feed is.
 *
 * `"skip"` when there is no query, so an idle search box costs nothing — no
 * subscription is opened until someone actually types. `loading` is false in
 * that state rather than undefined-forever, so the caller can tell "not
 * searching" apart from "searching, no answer yet".
 */
export function useLogSearch(
  query: string,
  projectId?: string | null,
  category?: string | null,
): { results: Log[]; loading: boolean; active: boolean } {
  const text = query.trim();
  const active = text.length > 0;
  const docs = useConvexQuery(
    api.logs.search,
    active
      ? {
          query: text,
          ...(projectId ? { projectId: projectId as never } : {}),
          // Pushed into the index rather than filtered after: post-filtering
          // would silently lose matches beyond the result cap.
          ...(category ? { category } : {}),
        }
      : 'skip',
  ) as unknown as ConvexLogDoc[] | undefined;

  return {
    results: docs ? docs.map(convexLogToLog) : [],
    loading: active && docs === undefined,
    active,
  };
}

/**
 * The persisted report draft for one scope and period, with its writers.
 *
 * `loading` is what stops the editor from flashing a freshly generated draft
 * over a saved one — until the query has answered, the caller doesn't know
 * whether there is a draft to restore.
 */
export function useReportDraft(projectId: string | null, range: number) {
  const draft = useConvexQuery(api.reportDrafts.get, {
    projectId: (projectId ?? null) as never,
    range,
  });
  const save = useConvexMutation(api.reportDrafts.save);
  const discard = useConvexMutation(api.reportDrafts.remove);
  return { draft: draft ?? null, loading: draft === undefined, save, discard };
}

/**
 * What the signed-in user's subscription entitles them to.
 *
 * Read-only by construction: there is no matching mutation, because the plan is
 * derived from a Polar subscription that only the signed webhook can create.
 * While the query is in flight this reports `free`, so a locked feature never
 * flashes unlocked before the answer arrives — the UI degrades toward less
 * access, never toward more.
 */
export function useEntitlement(): {
  tier: Tier;
  status: string | null;
  productKey: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
} {
  const result = useConvexQuery(api.billing.entitlement, {});
  return {
    tier: normalizeTier(result?.tier),
    status: result?.status ?? null,
    productKey: result?.productKey ?? null,
    subscriptionId: result?.subscriptionId ?? null,
    currentPeriodEnd: result?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: result?.cancelAtPeriodEnd ?? false,
    loading: result === undefined,
  };
}

// Reactive project list. `loading` matters here: the composer must not fall back
// to business-wide scope just because projects haven't arrived yet.
export function useProjects(): { projects: Project[]; loading: boolean } {
  const docs = useConvexQuery(api.projects.list) as unknown as ConvexProjectDoc[] | undefined;
  return {
    projects: docs
      ? docs.map((d) => ({
          id: d._id,
          name: d.name,
          description: d.description ?? null,
          archived: !!d.archivedAt,
          created_at: d.createdAt,
        }))
      : [],
    loading: docs === undefined,
  };
}

// The user's default entry scope (null = entire business), plus its setter.
export function useDefaultScope(): {
  defaultProjectId: string | null;
  loading: boolean;
  setDefaultScope: (projectId: string | null) => Promise<void>;
} {
  const result = useConvexQuery(api.projects.defaultScope) as
    | { defaultProjectId: string | null }
    | undefined;
  const setDefaultScope = useConvexMutation(api.projects.setDefaultScope);
  return {
    defaultProjectId: result?.defaultProjectId ?? null,
    loading: result === undefined,
    setDefaultScope: async (projectId) => {
      await setDefaultScope({ projectId: projectId as never });
    },
  };
}

export function useProjectMutations() {
  const create = useConvexMutation(api.projects.create);
  const update = useConvexMutation(api.projects.update);
  const setArchived = useConvexMutation(api.projects.setArchived);
  const remove = useConvexMutation(api.projects.remove);
  return { create, update, setArchived, remove };
}

// The full §4 behaviour contract, as callable mutations.
export function useBlockMutations() {
  const updateLayout = useConvexMutation(api.blocks.updateLayout);
  const rename = useConvexMutation(api.blocks.rename);
  const setVisible = useConvexMutation(api.blocks.setVisible);
  const setPinned = useConvexMutation(api.blocks.setPinned);
  const duplicate = useConvexMutation(api.blocks.duplicate);
  const toggleReport = useConvexMutation(api.blocks.toggleReport);
  const softDelete = useConvexMutation(api.blocks.softDelete);
  const restore = useConvexMutation(api.blocks.restore);
  const create = useConvexMutation(api.blocks.create);
  const convertType = useConvexMutation(api.blocks.convertType);
  const updateQueryConfig = useConvexMutation(api.blocks.updateQueryConfig);
  return { updateLayout, rename, setVisible, setPinned, duplicate, toggleReport, softDelete, restore, create, convertType, updateQueryConfig };
}

export function useLogMutations() {
  const applyCorrection = useConvexMutation(api.logs.applyCorrection);
  const setExcluded = useConvexMutation(api.logs.setExcluded);
  const setProject = useConvexMutation(api.logs.setProject);
  const remove = useConvexMutation(api.logs.remove);
  return { applyCorrection, setExcluded, setProject, remove };
}
