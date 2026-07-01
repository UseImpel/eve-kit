import { z } from "zod";
export declare const EVE_HEALTH_PATH: "/eve/v1/health";
export declare const EVE_SESSION_PATH: "/eve/v1/session";
export declare const eveStreamPathTemplate: "/eve/v1/session/{sessionId}/stream";
export declare function eveStreamPath(sessionId: string): `/eve/v1/session/${string}/stream`;
export declare const runtimeManifestAuthSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"vercel-oidc">;
}, z.core.$loose>, z.ZodObject<{
    kind: z.ZodLiteral<"basic">;
    username: z.ZodOptional<z.ZodString>;
    usernameEnv: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    passwordEnv: z.ZodOptional<z.ZodString>;
}, z.core.$loose>, z.ZodObject<{
    kind: z.ZodLiteral<"bearer">;
    token: z.ZodOptional<z.ZodString>;
    tokenEnv: z.ZodOptional<z.ZodString>;
}, z.core.$loose>], "kind">;
export declare const RuntimeManifestSchema: z.ZodObject<{
    runtimeKind: z.ZodLiteral<"eve">;
    baseUrl: z.ZodOptional<z.ZodString>;
    baseUrlEnv: z.ZodOptional<z.ZodString>;
    vercelProjectName: z.ZodOptional<z.ZodString>;
    vercelRootDirectory: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodLiteral<"/eve/v1/session">;
    streamPathTemplate: z.ZodLiteral<"/eve/v1/session/{sessionId}/stream">;
    healthPath: z.ZodLiteral<"/eve/v1/health">;
    auth: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"vercel-oidc">;
    }, z.core.$loose>, z.ZodObject<{
        kind: z.ZodLiteral<"basic">;
        username: z.ZodOptional<z.ZodString>;
        usernameEnv: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        passwordEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>, z.ZodObject<{
        kind: z.ZodLiteral<"bearer">;
        token: z.ZodOptional<z.ZodString>;
        tokenEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>], "kind">;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export declare const runtimeManifestSchema: z.ZodObject<{
    runtimeKind: z.ZodLiteral<"eve">;
    baseUrl: z.ZodOptional<z.ZodString>;
    baseUrlEnv: z.ZodOptional<z.ZodString>;
    vercelProjectName: z.ZodOptional<z.ZodString>;
    vercelRootDirectory: z.ZodOptional<z.ZodString>;
    sessionPath: z.ZodLiteral<"/eve/v1/session">;
    streamPathTemplate: z.ZodLiteral<"/eve/v1/session/{sessionId}/stream">;
    healthPath: z.ZodLiteral<"/eve/v1/health">;
    auth: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"vercel-oidc">;
    }, z.core.$loose>, z.ZodObject<{
        kind: z.ZodLiteral<"basic">;
        username: z.ZodOptional<z.ZodString>;
        usernameEnv: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        passwordEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>, z.ZodObject<{
        kind: z.ZodLiteral<"bearer">;
        token: z.ZodOptional<z.ZodString>;
        tokenEnv: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>], "kind">;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type RuntimeManifest = z.infer<typeof RuntimeManifestSchema>;
//# sourceMappingURL=eve-protocol.d.ts.map