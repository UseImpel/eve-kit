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

export class ImpelGatewayCliRunnerUnavailableError extends Error {
  constructor() {
    super(
      "The opt-in Impel gateway CLI runner is not bundled in eve-kit v1. Use impelGatewayModel for the pure-Eve path; a CLI runner must explicitly bridge Eve tools, policy hooks, and structured output before it can be enabled.",
    );
    this.name = "ImpelGatewayCliRunnerUnavailableError";
  }
}

export function impelGatewayCliRunner(
  _options: ImpelGatewayCliRunnerOptions = {},
): never {
  throw new ImpelGatewayCliRunnerUnavailableError();
}
