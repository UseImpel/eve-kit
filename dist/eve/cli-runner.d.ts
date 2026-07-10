/**
 * Explicit opt-in boundary for a future genuine CLI/Agent-SDK harness.
 *
 * v1 deliberately ships this fail-closed stub rather than silently replacing
 * Eve's tool loop. The default package and `./eve` barrel do not import this
 * module, so a future heavy CLI SDK cannot become an eager runtime dependency.
 */
export interface ImpelGatewayCliRunnerOptions {
    gatewayUrl?: string;
    authToken?: string;
    modelId?: string;
    tools?: Record<string, unknown>;
    hooks?: Record<string, unknown>;
    outputSchema?: unknown;
}
export declare class ImpelGatewayCliRunnerUnavailableError extends Error {
    constructor();
}
export declare function impelGatewayCliRunner(_options?: ImpelGatewayCliRunnerOptions): never;
//# sourceMappingURL=cli-runner.d.ts.map