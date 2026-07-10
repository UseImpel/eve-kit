export class ImpelGatewayCliRunnerUnavailableError extends Error {
    constructor() {
        super("The opt-in Impel gateway CLI runner is not bundled in eve-kit v1. Use impelGatewayModel for the pure-Eve path; a CLI runner must explicitly bridge Eve tools, policy hooks, and structured output before it can be enabled.");
        this.name = "ImpelGatewayCliRunnerUnavailableError";
    }
}
export function impelGatewayCliRunner(_options = {}) {
    throw new ImpelGatewayCliRunnerUnavailableError();
}
//# sourceMappingURL=cli-runner.js.map