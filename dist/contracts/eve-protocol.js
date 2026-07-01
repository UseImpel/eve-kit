import { z } from "zod";
export const EVE_HEALTH_PATH = "/eve/v1/health";
export const EVE_SESSION_PATH = "/eve/v1/session";
export const eveStreamPathTemplate = "/eve/v1/session/{sessionId}/stream";
export function eveStreamPath(sessionId) {
    return `/eve/v1/session/${sessionId}/stream`;
}
export const runtimeManifestAuthSchema = z.discriminatedUnion("kind", [
    z
        .object({
        kind: z.literal("vercel-oidc"),
    })
        .passthrough(),
    z
        .object({
        kind: z.literal("basic"),
        username: z.string().min(1).optional(),
        usernameEnv: z.string().min(1).optional(),
        password: z.string().min(1).optional(),
        passwordEnv: z.string().min(1).optional(),
    })
        .passthrough(),
    z
        .object({
        kind: z.literal("bearer"),
        token: z.string().min(1).optional(),
        tokenEnv: z.string().min(1).optional(),
    })
        .passthrough(),
]);
export const RuntimeManifestSchema = z
    .object({
    runtimeKind: z.literal("eve"),
    baseUrl: z.string().min(1).optional(),
    baseUrlEnv: z.string().min(1).optional(),
    vercelProjectName: z.string().min(1).optional(),
    vercelRootDirectory: z.string().min(1).optional(),
    sessionPath: z.literal(EVE_SESSION_PATH),
    streamPathTemplate: z.literal(eveStreamPathTemplate),
    healthPath: z.literal(EVE_HEALTH_PATH),
    auth: runtimeManifestAuthSchema,
    note: z.string().optional(),
})
    .passthrough();
export const runtimeManifestSchema = RuntimeManifestSchema;
//# sourceMappingURL=eve-protocol.js.map