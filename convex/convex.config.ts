import { defineApp } from 'convex/server';
import polar from '@convex-dev/polar/convex.config.js';

// The Polar component owns the billing tables (products, subscriptions) and the
// webhook that keeps them in sync. Nothing in this app writes them — see
// convex/billing.ts for why that matters.
const app = defineApp();
app.use(polar);

export default app;
