import { type DefaultBackendOptions, type SandboxDefinition } from "eve/sandbox";
export interface ImpelDefaultSandboxOptions {
    backend?: DefaultBackendOptions;
}
export declare function impelJustBashSandbox(): SandboxDefinition;
export declare function impelDefaultSandbox({ backend, }?: ImpelDefaultSandboxOptions): SandboxDefinition;
//# sourceMappingURL=sandbox.d.ts.map