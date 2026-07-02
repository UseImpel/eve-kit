import type { LanguageModelV3 } from "@ai-sdk/provider";
export interface ImpelInferenceRunContext {
    orgId?: string;
    repos?: string[];
    branch?: string;
    installationId?: string | number;
    githubConnectorUid?: string;
    runId?: string;
    traceId?: string;
    agent?: Record<string, unknown>;
    runToken?: string;
}
export type ImpelInferenceHeaders = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
export type ImpelInferenceRunContextProvider = ImpelInferenceRunContext | (() => ImpelInferenceRunContext | Promise<ImpelInferenceRunContext>);
export interface ImpelInferenceOptions {
    baseUrl?: string;
    apiKey?: string;
    orgId?: string;
    /**
     * Forward reasoning stream parts to the AI SDK caller. Defaults to false
     * because long provider-managed agent loops can occasionally emit reasoning
     * block lifecycles that current AI SDK beta stream accumulators reject. Raw
     * reasoning remains available in impel-inference provider traces.
     */
    streamReasoning?: boolean;
    /**
     * Provider construction options for the provider reconstructed inside
     * impel-inference, for example claudeCode permissionMode, maxTurns, agents,
     * and effort.
     */
    providerOptions?: Record<string, unknown>;
    /**
     * Additional request headers, evaluated per model call. Useful for W3C trace
     * headers. authorization, content-type, x-org-id, and x-impel-org-id are
     * always controlled by this package and cannot be overridden here.
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
//# sourceMappingURL=index.d.ts.map