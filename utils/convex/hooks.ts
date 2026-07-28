'use client';

import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  convexLogToLog,
  type ConvexBlockDoc,
  type ConvexLogDoc,
  type ConvexProjectDoc,
} from './adapters';
import type { Log, Project } from '@/lib/dashboard-utils';

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
