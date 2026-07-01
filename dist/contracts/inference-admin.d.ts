import { z } from "zod";
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
export declare const normalizedUsageSchema: z.ZodCustom<NormalizedUsage, NormalizedUsage>;
export declare const inferenceProviderIdSchema: z.ZodEnum<{
    claude_code: "claude_code";
    codex: "codex";
}>;
export type InferenceProviderId = z.infer<typeof inferenceProviderIdSchema>;
export declare const providerAccountIdentitySchema: z.ZodNullable<z.ZodObject<{
    displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    emailAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    billingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    organizationUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    accountUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>>;
export type ProviderAccountIdentity = z.infer<typeof providerAccountIdentitySchema>;
/**
 * One entry in the GET /v1/admin/provider-accounts response. NEVER carries the
 * credential — only the glanceable summary the panel renders.
 */
export declare const providerAccountSummarySchema: z.ZodObject<{
    accountId: z.ZodString;
    provider: z.ZodEnum<{
        claude_code: "claude_code";
        codex: "codex";
    }>;
    email: z.ZodString;
    status: z.ZodString;
    identity: z.ZodNullable<z.ZodObject<{
        displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        emailAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        organizationUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        accountUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    hasCredential: z.ZodBoolean;
    credentialExpiresAt: z.ZodNullable<z.ZodNumber>;
    authorizeUrl: z.ZodNullable<z.ZodString>;
    lastError: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodNumber;
    usage: z.ZodNullable<z.ZodObject<{
        headlinePercent: z.ZodNullable<z.ZodNumber>;
        headlineWindow: z.ZodNullable<z.ZodString>;
        headlineResetsAt: z.ZodNullable<z.ZodString>;
        capturedAt: z.ZodNullable<z.ZodString>;
        windows: z.ZodNullable<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            utilizationPercent: z.ZodNumber;
            resetsAt: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProviderAccountSummary = z.infer<typeof providerAccountSummarySchema>;
/** GET /v1/admin/provider-accounts — the org-scoped account list. */
export declare const providerAccountsListResponseSchema: z.ZodObject<{
    orgId: z.ZodString;
    accounts: z.ZodArray<z.ZodObject<{
        accountId: z.ZodString;
        provider: z.ZodEnum<{
            claude_code: "claude_code";
            codex: "codex";
        }>;
        email: z.ZodString;
        status: z.ZodString;
        identity: z.ZodNullable<z.ZodObject<{
            displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            emailAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            billingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            organizationUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            accountUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
        hasCredential: z.ZodBoolean;
        credentialExpiresAt: z.ZodNullable<z.ZodNumber>;
        authorizeUrl: z.ZodNullable<z.ZodString>;
        lastError: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodNumber;
        usage: z.ZodNullable<z.ZodObject<{
            headlinePercent: z.ZodNullable<z.ZodNumber>;
            headlineWindow: z.ZodNullable<z.ZodString>;
            headlineResetsAt: z.ZodNullable<z.ZodString>;
            capturedAt: z.ZodNullable<z.ZodString>;
            windows: z.ZodNullable<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
                utilizationPercent: z.ZodNumber;
                resetsAt: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProviderAccountsListResponse = z.infer<typeof providerAccountsListResponseSchema>;
/**
 * GET /v1/admin/provider-accounts/status — auth status keyed by accountId.
 * The device-code (codex) fields are null/absent for the claude paste-code
 * flow.
 */
export declare const providerAuthStatusResponseSchema: z.ZodObject<{
    accountId: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    status: z.ZodString;
    authorizeUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    identity: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        displayName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        emailAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        billingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        organizationUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        accountUuid: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    hasCredential: z.ZodOptional<z.ZodBoolean>;
    credentialExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    lastError: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    userCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    verificationUri: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    verificationUriComplete: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pollIntervalSec: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export type ProviderAuthStatusResponse = z.infer<typeof providerAuthStatusResponseSchema>;
/** POST /v1/admin/provider-accounts/start */
export declare const providerAccountStartAuthResponseSchema: z.ZodObject<{
    accountId: z.ZodString;
    orgId: z.ZodString;
    runId: z.ZodString;
    email: z.ZodString;
}, z.core.$strip>;
export type ProviderAccountStartAuthResponse = z.infer<typeof providerAccountStartAuthResponseSchema>;
/** POST /v1/admin/provider-accounts/callback */
export declare const providerAccountCallbackResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    runId: z.ZodString;
}, z.core.$strip>;
export type ProviderAccountCallbackResponse = z.infer<typeof providerAccountCallbackResponseSchema>;
/** POST /v1/admin/provider-accounts/refresh */
export declare const providerAccountRefreshResponseSchema: z.ZodObject<{
    accountId: z.ZodString;
    runId: z.ZodString;
}, z.core.$strip>;
export type ProviderAccountRefreshResponse = z.infer<typeof providerAccountRefreshResponseSchema>;
/** GET /v1/admin/provider-accounts/usage */
export declare const providerAccountUsageResponseSchema: z.ZodObject<{
    accountId: z.ZodString;
    usage: z.ZodCustom<NormalizedUsage, NormalizedUsage>;
}, z.core.$strip>;
export type ProviderAccountUsageResponse = z.infer<typeof providerAccountUsageResponseSchema>;
/** DELETE /v1/admin/provider-accounts/:accountId */
export declare const providerAccountDeleteResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    accountId: z.ZodString;
}, z.core.$strip>;
export type ProviderAccountDeleteResponse = z.infer<typeof providerAccountDeleteResponseSchema>;
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
export declare const inferenceReadinessResponseSchema: z.ZodObject<{
    orgId: z.ZodString;
    claude: z.ZodBoolean;
    codex: z.ZodBoolean;
    ready: z.ZodBoolean;
    providers: z.ZodOptional<z.ZodObject<{
        claude_code: z.ZodBoolean;
        codex: z.ZodBoolean;
        both: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        stage: z.ZodString;
        modelId: z.ZodString;
        provider: z.ZodEnum<{
            claude_code: "claude_code";
            codex: "codex";
        }>;
        providerModelId: z.ZodString;
        ready: z.ZodBoolean;
    }, z.core.$strip>>>;
}, z.core.$strip>;
//# sourceMappingURL=inference-admin.d.ts.map