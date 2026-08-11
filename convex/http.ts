import { httpRouter } from 'convex/server';
import { polar } from './billing';

const http = httpRouter();

// Polar posts subscription and product events to <convex site url>/polar/events.
// The component verifies the Standard Webhooks signature against
// POLAR_WEBHOOK_SECRET before writing anything, which is what makes this the
// only trustworthy writer of a user's entitlement — see convex/billing.ts.
polar.registerRoutes(http);

export default http;
