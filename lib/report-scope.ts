// Canvas blocks are shared across scopes, so a report's block ids alone don't
// determine its output — the scope it was rendered from does. Regenerating a
// past report while a different scope is active would quietly produce a
// different document under the same title, so the decision is made here.

import { BUSINESS_SCOPE_LABEL } from "./dashboard-utils";

export type ReportScopeRef = {
  /** null = the business as a whole; absent on reports predating scopes. */
  projectId?: string | null;
  /** null when the project has since been deleted. */
  projectName?: string | null;
};

export type RegenerationDecision =
  | { action: "proceed" }
  /** The scope still exists but isn't active — switch to it, then retry. */
  | { action: "switch"; projectId: string | null; scopeName: string }
  | { action: "block"; reason: string };

export function resolveRegenerationScope(
  report: ReportScopeRef,
  currentScope: string | null,
  canSwitchScope: boolean,
): RegenerationDecision {
  const reportScope = report.projectId ?? null;
  if (reportScope === currentScope) return { action: "proceed" };

  // A deleted project can't be switched to, and its logs have reverted to
  // business-wide — there is no longer any scope that reproduces this report.
  if (reportScope && !report.projectName) {
    return {
      action: "block",
      reason: "This report's project was deleted, so it can't be regenerated",
    };
  }

  const scopeName = report.projectName ?? BUSINESS_SCOPE_LABEL;
  if (!canSwitchScope) {
    return {
      action: "block",
      reason: `This report covers ${scopeName} — switch scope to regenerate it`,
    };
  }
  return { action: "switch", projectId: reportScope, scopeName };
}
