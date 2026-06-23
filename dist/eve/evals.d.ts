export interface ImpelEvalConfigOptions {
    defaultAgentId: string;
    defaultProjectName?: string;
    defaultExperimentSuffix?: string;
}
export interface ImpelSmokeEvalOptions {
    defaultAgentId: string;
    defaultOrgId: string;
    defaultAgentVersion?: number;
    defaultAgentDigest?: string;
    message?: string;
}
export declare function createImpelBraintrustEvalConfig({ defaultAgentId, defaultProjectName, defaultExperimentSuffix, }: ImpelEvalConfigOptions): import("eve/evals").EveEvalConfig;
export declare function createImpelSmokeEval({ defaultAgentId, defaultOrgId, defaultAgentVersion, defaultAgentDigest, message, }: ImpelSmokeEvalOptions): import("eve/evals").EveEvalDefinition;
//# sourceMappingURL=evals.d.ts.map