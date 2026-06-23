import { z } from "zod";
export declare const IMPEL_EVE_HEALTH_PATH = "/eve/v1/health";
export declare const IMPEL_EVE_SESSION_PATH = "/eve/v1/session";
export declare const impelRuntimeConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    agent: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>;
    eve: z.ZodOptional<z.ZodObject<{
        healthPath: z.ZodDefault<z.ZodString>;
        sessionPath: z.ZodDefault<z.ZodString>;
    }, z.core.$loose>>;
}, z.core.$loose>;
export type ImpelRuntimeConfig = z.infer<typeof impelRuntimeConfigSchema>;
export interface SmokeDeployedRuntimeOptions {
    baseUrl: string;
    message?: string;
    clientContext?: unknown;
    timeoutMs?: number;
    successOnText?: boolean;
    basicUser?: string;
    basicPassword?: string;
    bearerToken?: string;
    fetch?: typeof fetch;
    log?: (message: string) => void;
}
export interface SmokeDeployedRuntimeResult {
    sessionId: string;
    eventCount: number;
    textBytes: number;
    completed: boolean;
}
export declare class ImpelRuntimeSmokeError extends Error {
    constructor(message: string);
}
export declare function smokeDeployedRuntime({ baseUrl, message, clientContext, timeoutMs, successOnText, basicUser, basicPassword, bearerToken, fetch: fetchImpl, log, }: SmokeDeployedRuntimeOptions): Promise<SmokeDeployedRuntimeResult>;
//# sourceMappingURL=runtime.d.ts.map