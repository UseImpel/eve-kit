import { type DefaultBackendOptions, type SandboxDefinition, type SandboxSession } from "eve/sandbox";
export interface ImpelDefaultSandboxOptions {
    backend?: DefaultBackendOptions;
    installWorkspaceTools?: boolean;
}
export declare function impelJustBashSandbox(): SandboxDefinition;
export declare function impelDefaultSandbox({ backend, installWorkspaceTools, }?: ImpelDefaultSandboxOptions): SandboxDefinition;
export declare function installImpelWorkspaceTools(sandbox: Pick<SandboxSession, "run">): Promise<void>;
//# sourceMappingURL=sandbox.d.ts.map