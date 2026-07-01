// Canonical contract for impel-inference's /v1/admin/* API responses.
//
// These zod schemas + inferred TS types describe the wire shapes of the
// provider-account admin surface (account summaries, auth status, usage) and
// the per-org inference-readiness probe. Both `next` (the client, today in
// src/lib/inference-admin-client.ts) and `impel-inference` (the server) will
// import them from here so the two repos can never drift on the wire shape.
//
// Everything in this module is a wire contract — no fetch logic, no env
// access. Shapes are ported verbatim from the hand-duplicated originals.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Usage envelope (provider-tagged, normalized by impel-inference)
// ---------------------------------------------------------------------------

/** Claude "extra usage" (pay-per-use overflow) block, when the plan has one. */
export type ClaudeExtraUsage = {
  enabled: boolean;
  usedCreditsUsd: number | null;
  monthlyLimitUsd: number | null;
  utilizationPercent: number | null;
};

/**
 * Provider-tagged, normalized usage envelope returned by impel-inference so
 * usage stays provider-aware while the headline/UI mappers stay simple. Both
 * providers map their rolling windows into `windows` (supported:true) —
 * claude's 5h/7d/7d-sonnet and codex's primary/secondary — or set
 * supported:false when a provider truly reports none.
 */
export type NormalizedUsage = {
  supported: boolean;
  windows?: Array<{
    key: string;
    label: string;
    utilizationPercent: number;
    resetsAt: string | null;
  }>;
  extraUsage?: ClaudeExtraUsage;
  // Pay-as-you-go credit balance (codex), separate from the rolling windows.
  credits?: {
    balance: number;
    hasCredits: boolean;
    unlimited: boolean;
  };
  capturedAt: string;
};

/**
 * The usage payload is an opaque provider-tagged envelope; the contract only
 * asserts presence (the structure is typed by `NormalizedUsage`).
 */
export const normalizedUsageSchema = z.custom<NormalizedUsage>(
  (value) => value !== undefined,
  { message: "usage is required" },
);

// ---------------------------------------------------------------------------
// Provider accounts (/v1/admin/provider-accounts*)
// ---------------------------------------------------------------------------

export const inferenceProviderIdSchema = z.enum(["claude_code", "codex"]);
export type InferenceProviderId = z.infer<typeof inferenceProviderIdSchema>;

export const providerAccountIdentitySchema = z
  .object({
    displayName: z.string().nullable().optional(),
    emailAddress: z.string().nullable().optional(),
    billingType: z.string().nullable().optional(),
    organizationUuid: z.string().nullable().optional(),
    accountUuid: z.string().nullable().optional(),
  })
  .nullable();
export type ProviderAccountIdentity = z.infer<
  typeof providerAccountIdentitySchema
>;

/**
 * One entry in the GET /v1/admin/provider-accounts response. NEVER carries the
 * credential — only the glanceable summary the panel renders.
 */
export const providerAccountSummarySchema = z.object({
  accountId: z.string(),
  provider: inferenceProviderIdSchema,
  email: z.string(),
  status: z.string(),
  identity: providerAccountIdentitySchema,
  hasCredential: z.boolean(),
  credentialExpiresAt: z.number().nullable(),
  authorizeUrl: z.string().nullable(),
  lastError: z.string().nullable(),
  updatedAt: z.number(),
  usage: z
    .object({
      headlinePercent: z.number().nullable(),
      headlineWindow: z.string().nullable(),
      headlineResetsAt: z.string().nullable(),
      capturedAt: z.string().nullable(),
      windows: z
        .array(
          z.object({
            key: z.string(),
            label: z.string(),
            utilizationPercent: z.number(),
            resetsAt: z.string().nullable(),
          }),
        )
        .nullable(),
    })
    .nullable(),
});
export type ProviderAccountSummary = z.infer<
  typeof providerAccountSummarySchema
>;

/** GET /v1/admin/provider-accounts — the org-scoped account list. */
export const providerAccountsListResponseSchema = z.object({
  orgId: z.string(),
  accounts: z.array(providerAccountSummarySchema),
});
export type ProviderAccountsListResponse = z.infer<
  typeof providerAccountsListResponseSchema
>;

/**
 * GET /v1/admin/provider-accounts/status — auth status keyed by accountId.
 * The device-code (codex) fields are null/absent for the claude paste-code
 * flow.
 */
export const providerAuthStatusResponseSchema = z.object({
  accountId: z.string(),
  email: z.string().optional(),
  status: z.string(),
  authorizeUrl: z.string().nullable().optional(),
  identity: providerAccountIdentitySchema.optional(),
  hasCredential: z.boolean().optional(),
  credentialExpiresAt: z.number().nullable().optional(),
  lastError: z.string().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
  userCode: z.string().nullable().optional(),
  verificationUri: z.string().nullable().optional(),
  verificationUriComplete: z.string().nullable().optional(),
  pollIntervalSec: z.number().nullable().optional(),
});
export type ProviderAuthStatusResponse = z.infer<
  typeof providerAuthStatusResponseSchema
>;

/** POST /v1/admin/provider-accounts/start */
export const providerAccountStartAuthResponseSchema = z.object({
  accountId: z.string(),
  orgId: z.string(),
  runId: z.string(),
  email: z.string(),
});
export type ProviderAccountStartAuthResponse = z.infer<
  typeof providerAccountStartAuthResponseSchema
>;

/** POST /v1/admin/provider-accounts/callback */
export const providerAccountCallbackResponseSchema = z.object({
  ok: z.boolean(),
  runId: z.string(),
});
export type ProviderAccountCallbackResponse = z.infer<
  typeof providerAccountCallbackResponseSchema
>;

/** POST /v1/admin/provider-accounts/refresh */
export const providerAccountRefreshResponseSchema = z.object({
  accountId: z.string(),
  runId: z.string(),
});
export type ProviderAccountRefreshResponse = z.infer<
  typeof providerAccountRefreshResponseSchema
>;

/** GET /v1/admin/provider-accounts/usage */
export const providerAccountUsageResponseSchema = z.object({
  accountId: z.string(),
  usage: normalizedUsageSchema,
});
export type ProviderAccountUsageResponse = z.infer<
  typeof providerAccountUsageResponseSchema
>;

/** DELETE /v1/admin/provider-accounts/:accountId */
export const providerAccountDeleteResponseSchema = z.object({
  ok: z.boolean(),
  accountId: z.string(),
});
export type ProviderAccountDeleteResponse = z.infer<
  typeof providerAccountDeleteResponseSchema
>;

// ---------------------------------------------------------------------------
// Inference readiness (/v1/admin/orgs/:orgId/inference-readiness)
// ---------------------------------------------------------------------------

/** Per-stage readiness detail (which model/provider serves each stage). */
export type OrgInferenceStageReadiness = {
  stage: string;
  modelId: string;
  provider: "claude_code" | "codex";
  providerModelId: string;
  ready: boolean;
};

/**
 * GET /v1/admin/orgs/:orgId/inference-readiness — whether the org has both
 * subscription credentials live (the dual-credential gate) plus optional
 * per-provider and per-stage detail.
 */
export type OrgInferenceReadiness = {
  orgId: string;
  claude: boolean;
  codex: boolean;
  ready: boolean;
  providers?: {
    claude_code: boolean;
    codex: boolean;
    both?: boolean;
  };
  stages?: OrgInferenceStageReadiness[];
};

/** Validates the `OrgInferenceReadiness` wire shape. */
export const inferenceReadinessResponseSchema = z.object({
  orgId: z.string(),
  claude: z.boolean(),
  codex: z.boolean(),
  ready: z.boolean(),
  providers: z
    .object({
      claude_code: z.boolean(),
      codex: z.boolean(),
      both: z.boolean().optional(),
    })
    .optional(),
  stages: z
    .array(
      z.object({
        stage: z.string(),
        modelId: z.string(),
        provider: inferenceProviderIdSchema,
        providerModelId: z.string(),
        ready: z.boolean(),
      }),
    )
    .optional(),
});
