export type EveKitProviderKind = "channel" | "connection" | "tool" | "sandbox" | "eval" | "model";
export interface EveKitProviderEnvVar {
    name: string;
    required: boolean;
    sensitive: boolean;
    purpose: string;
}
export interface EveKitProvider {
    /** stable slug, e.g. 'whatsapp-channel' */
    id: string;
    kind: EveKitProviderKind;
    /** e.g. '@useimpel/eve-kit/eve/whatsapp' — must match a package.json exports subpath */
    importPath: string;
    exportName: string;
    summary: string;
    envVars: EveKitProviderEnvVar[];
    setupSteps: string[];
    /** eve-kit version that introduced it, e.g. '0.2.45' */
    sinceVersion: string;
    /** for kind==='channel': the platform channel kind it backs, e.g. 'whatsapp' | 'eve' | 'telegram' */
    channelKind?: string;
}
export declare const EVE_KIT_PROVIDERS: readonly EveKitProvider[];
export declare function getEveKitProvider(id: string): EveKitProvider | undefined;
export declare function listEveKitProviders(kind?: EveKitProviderKind): EveKitProvider[];
//# sourceMappingURL=catalog.d.ts.map