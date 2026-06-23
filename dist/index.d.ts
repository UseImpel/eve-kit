import type { LanguageModelV3 } from "@ai-sdk/provider";
export interface ImpelInferenceRunContext {
    orgId?: string;
    repos?: string[];
    branch?: string;
    installationId?: string | number;
    runId?: string;
    traceId?: string;
    agent?: Record<string, unknown>;
}
export type ImpelInferenceHeaders = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
export type ImpelInferenceRunContextProvider = ImpelInferenceRunContext | (() => ImpelInferenceRunContext | Promise<ImpelInferenceRunContext>);
export interface ImpelInferenceOptions {
    baseUrl?: string;
    apiKey?: string;
    orgId?: string;
    /**
     * Provider construction options for the provider reconstructed inside
     * impel-inference, for example claudeCode permissionMode, maxTurns, agents,
     * and effort.
     */
    providerOptions?: Record<string, unknown>;
    /**
     * Additional request headers, evaluated per model call. Useful for W3C trace
     * headers. authorization, content-type, and x-org-id are always controlled by
     * this package and cannot be overridden here.
     */
    headers?: ImpelInferenceHeaders;
    /**
     * Optional explicit run context for non-Eve callers. Eve clientContext still
     * wins when present because it is per-turn.
     */
    runContext?: ImpelInferenceRunContextProvider;
    /**
     * Diagnostic label used in rejection errors.
     */
    label?: string;
    /**
     * Forwarded for future service routing. The current impel-inference service
     * selects the concrete CLI provider from modelId.
     */
    provider?: string;
}
export declare function impelInference(modelId: string, opts?: ImpelInferenceOptions): LanguageModelV3;
export declare const impelSidecar: typeof impelInference;
//# sourceMappingURL=index.d.ts.map