import { APICallError, type LanguageModelV4, type LanguageModelV4CallOptions, type LanguageModelV4StreamResult, type SharedV4ProviderOptions } from "@ai-sdk/provider";
export type ImpelGatewayProvider = "anthropic" | "openai";
export interface ImpelGatewayRunContext {
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
export type ImpelGatewayHeaders = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
export type ImpelGatewayRunContextProvider = ImpelGatewayRunContext | (() => ImpelGatewayRunContext | Promise<ImpelGatewayRunContext>);
export interface ImpelGatewayModelOptions {
    gatewayUrl?: string;
    authToken?: string;
    /** @deprecated Use authToken. */
    gatewayAuthToken?: string;
    /** @deprecated Use authToken. */
    gatewayPat?: string;
    headers?: ImpelGatewayHeaders;
    runContext?: ImpelGatewayRunContextProvider;
    providerOptions?: SharedV4ProviderOptions;
    fetch?: typeof globalThis.fetch;
}
export type ImpelGatewayPoolErrorCode = "model_not_entitled" | "pool_exhausted" | "pool_rate_limited";
export interface ImpelGatewayPoolErrorOptions {
    code: ImpelGatewayPoolErrorCode;
    message: string;
    retryAfter?: number;
    model?: string;
    org?: string;
    url?: string;
    requestBodyValues?: unknown;
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
}
/**
 * Typed pool-capacity error surfaced by impel-gateway.
 *
 * `retryAfter` is expressed in milliseconds. The class extends APICallError so
 * AI SDK retry machinery recognizes retryable pool errors. A
 * `model_not_entitled` error intentionally has no HTTP status and no raw cause:
 * Eve treats every visible 5xx as retryable, even when `isRetryable` is false.
 */
export declare class ImpelGatewayPoolError extends APICallError {
    readonly code: ImpelGatewayPoolErrorCode;
    readonly retryable: boolean;
    readonly retryAfter?: number;
    readonly retryAfterMs?: number;
    readonly model?: string;
    readonly org?: string;
    readonly orgId?: string;
    constructor(options: ImpelGatewayPoolErrorOptions);
}
export declare const IMPEL_GATEWAY_MODEL_ALIASES: {
    readonly fable: "claude-fable-5";
    readonly opus: "claude-opus-4-8";
    readonly sonnet: "claude-sonnet-4-6";
    readonly haiku: "claude-haiku-4-5";
};
type ResolvedGatewayModel = {
    provider: ImpelGatewayProvider;
    modelId: string;
};
type SerializedImpelGatewayModel = {
    modelId: string;
    options: ImpelGatewayModelOptions;
};
declare const WORKFLOW_SERIALIZE: unique symbol;
declare const WORKFLOW_DESERIALIZE: unique symbol;
export declare function normalizeImpelGatewayModelId(modelId: string): string;
export declare function resolveImpelGatewayModel(modelId: string): ResolvedGatewayModel;
export declare function resolveImpelGatewayUrl(explicit?: string): string | undefined;
/**
 * Creates a conventional AI SDK LanguageModelV4 backed by impel-gateway.
 * Eve remains the owner of the tool loop; the gateway performs one model turn.
 */
export declare function impelGatewayModel(modelId: string, options?: ImpelGatewayModelOptions): LanguageModelV4;
/**
 * Concrete wrapper rather than a Proxy so Workflow SDK serialization can see
 * the same constructor-level symbols exposed by official AI SDK models.
 */
export declare class ImpelGatewayLanguageModel implements LanguageModelV4 {
    readonly specificationVersion: "v4";
    readonly provider: string;
    readonly modelId: string;
    readonly supportedUrls: LanguageModelV4["supportedUrls"];
    private readonly configuredOptions;
    private readonly gatewayUrl;
    private readonly resolved;
    static [WORKFLOW_SERIALIZE](model: ImpelGatewayLanguageModel): SerializedImpelGatewayModel;
    static [WORKFLOW_DESERIALIZE](serialized: SerializedImpelGatewayModel): ImpelGatewayLanguageModel;
    constructor(modelId: string, options?: ImpelGatewayModelOptions);
    doGenerate(callOptions: LanguageModelV4CallOptions): Promise<import("@ai-sdk/provider").LanguageModelV4GenerateResult>;
    doStream(callOptions: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult>;
    private buildCall;
}
export declare function impelGatewayClaudeModel(modelId: string, options?: ImpelGatewayModelOptions): LanguageModelV4;
export declare function impelGatewayCodexModel(modelId: string, options?: ImpelGatewayModelOptions): LanguageModelV4;
export {};
//# sourceMappingURL=gateway-model.d.ts.map