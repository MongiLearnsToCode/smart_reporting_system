'use client';

import { useQuery as useConvexQuery, useMutation as useConvexMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  convexLogToLog,
  type ConvexBlockDoc,
  type ConvexLogDoc,
} from './adapters';
import type { Log } from '@/lib/dashboard-utils';

// Reactive blocks feed (spec §7). Returns raw Convex block docs — the canvas
// needs layout/visible/pinned/includeInReports, not just the adapted Widget.
export function useBlocks(): { blocks: ConvexBlockDoc[]; loading: boolean } {
  const docs = useConvexQuery(api.blocks.list) as unknown as ConvexBlockDoc[] | undefined;
  return { blocks: docs ?? [], loading: docs === undefined };
}

// Reactive logs feed, adapted to the existing snake_case Log shape so all the
// current helpers/components keep working.
export function useLogs(): { logs: Log[]; loading: boolean } {
  const docs = useConvexQuery(api.logs.list, {}) as unknown as ConvexLogDoc[] | undefined;
  return {
    logs: docs ? docs.map(convexLogToLog) : [],
    loading: docs === undefined,
  };
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
  return { updateLayout, rename, setVisible, setPinned, duplicate, toggleReport, softDelete, restore, create };
}

export function useLogMutations() {
  const applyCorrection = useConvexMutation(api.logs.applyCorrection);
  const setExcluded = useConvexMutation(api.logs.setExcluded);
  const remove = useConvexMutation(api.logs.remove);
  return { applyCorrection, setExcluded, remove };
}
