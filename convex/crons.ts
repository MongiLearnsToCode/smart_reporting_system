import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Hard-purge soft-deleted blocks whose undo window has lapsed (spec §4).
crons.interval('purge deleted blocks', { seconds: 30 }, internal.blocks.purgeExpired, {});

export default crons;
