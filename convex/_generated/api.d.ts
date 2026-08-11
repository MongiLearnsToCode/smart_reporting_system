/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as blocks from "../blocks.js";
import type * as crons from "../crons.js";
import type * as fx from "../fx.js";
import type * as http from "../http.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_layout from "../lib/layout.js";
import type * as logs from "../logs.js";
import type * as migrate from "../migrate.js";
import type * as projects from "../projects.js";
import type * as reportDrafts from "../reportDrafts.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  blocks: typeof blocks;
  crons: typeof crons;
  fx: typeof fx;
  http: typeof http;
  "lib/identity": typeof lib_identity;
  "lib/layout": typeof lib_layout;
  logs: typeof logs;
  migrate: typeof migrate;
  projects: typeof projects;
  reportDrafts: typeof reportDrafts;
  reports: typeof reports;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  polar: import("@convex-dev/polar/_generated/component.js").ComponentApi<"polar">;
};
