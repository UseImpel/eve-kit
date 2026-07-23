import { defineTool } from "eve/tools";
import { z } from "zod";
import { IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE, } from "./channel.js";
import { RUN_TOKEN_HEADER } from "../contracts/run-token.js";
export const DEFAULT_CODE_INTELLIGENCE_URL = "https://code-intelligence.useimpel.ai";
const repositorySelector = z
    .string()
    .min(1)
    .optional()
    .describe("Attached repository as owner/repo or its provider repository id. Omit when the workspace has one repository.");
const readInput = z.object({
    repository: repositorySelector,
    path: z.string().min(1).max(4096),
    startLine: z.number().int().positive().max(1_000_000).optional(),
    endLine: z.number().int().positive().max(1_000_000).optional(),
});
const searchInput = z.object({
    repository: repositorySelector,
    mode: z.enum([
        "text",
        "regex",
        "structural",
        "symbol",
        "security",
        "semantic",
    ]),
    query: z.string().min(1).max(16_384),
    language: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[A-Za-z0-9_+.#-]+$/)
        .optional()
        .describe("Required for security mode, for example typescript, python, or go."),
    path: z.string().max(4096).optional(),
    include: z.array(z.string().max(512)).max(50).optional(),
    exclude: z.array(z.string().max(512)).max(50).optional(),
    limit: z.number().int().min(1).max(200).default(50),
});
const symbolInput = z.object({
    repository: repositorySelector,
    symbol: z.string().min(1).max(2048),
    maxDepth: z.number().int().min(1).max(10).default(3),
    limit: z.number().int().min(1).max(200).default(50),
});
const traceInput = z.object({
    repository: repositorySelector,
    fromSymbol: z.string().min(1).max(2048),
    toSymbol: z.string().min(1).max(2048),
    maxDepth: z.number().int().min(1).max(10).default(3),
    limit: z.number().int().min(1).max(200).default(50),
});
const diffImpactInput = z.object({
    repository: repositorySelector,
    baseRef: z.string().min(1).max(512),
    headRef: z.string().min(1).max(512),
    maxDepth: z.number().int().min(1).max(10).default(3),
    limit: z.number().int().min(1).max(200).default(50),
});
export function codeIntelligenceFailure(code, message, retryable = false) {
    return { ok: false, error: { code, message, retryable } };
}
function readString(value) {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : undefined;
}
const runtimeWorkspaceResponseSchema = z.object({
    workspace: z.object({
        workspaceId: z.string().min(1),
        repositories: z
            .array(z.object({
            provider: z.literal("github"),
            providerRepoId: z.string().min(1),
            repoFullName: z.string().min(3),
            commitSha: z.string().regex(/^[a-f0-9]{40,64}$/),
            requestedRef: z.string().min(1),
        }))
            .min(1),
    }),
});
export function identityRunToken(ctx) {
    for (const principal of [
        ctx.session.auth.current,
        ctx.session.auth.initiator,
    ]) {
        const token = readString(principal?.attributes[IMPEL_IDENTITY_RUN_TOKEN_ATTRIBUTE]);
        if (token && /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
            return token;
        }
    }
    throw new Error("This Eve session has no server-authenticated code-intelligence run token.");
}
async function requestScope(ctx) {
    const token = identityRunToken(ctx);
    const baseUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL?.trim() ??
        DEFAULT_CODE_INTELLIGENCE_URL;
    const payload = await signedIntelligenceRequest(baseUrl, token, "/v1/runtime/workspace", {}, 30_000);
    if (isCodeIntelligenceFailure(payload))
        return payload;
    const parsed = runtimeWorkspaceResponseSchema.safeParse(payload);
    if (!parsed.success) {
        return codeIntelligenceFailure("backend_unavailable", "Code-intelligence returned an invalid runtime workspace.", true);
    }
    return {
        baseUrl,
        token,
        workspace: parsed.data.workspace,
    };
}
function selectRepository(context, selector) {
    if (!selector && context.repositories.length === 1) {
        return context.repositories[0];
    }
    if (!selector) {
        throw new Error("This workspace has multiple repositories; pass an attached owner/repo name.");
    }
    const normalized = selector.toLowerCase();
    const repository = context.repositories.find((candidate) => candidate.providerRepoId === selector ||
        candidate.repoFullName.toLowerCase() === normalized);
    if (!repository) {
        throw new Error("The requested repository is outside this exact workspace.");
    }
    return repository;
}
async function postCodeIntelligence(ctx, path, input, options = {}) {
    try {
        const scope = await requestScope(ctx);
        if (isCodeIntelligenceFailure(scope))
            return scope;
        const repository = options.workspaceOnly
            ? undefined
            : selectRepository(scope.workspace, options.repository);
        const body = {
            workspaceId: scope.workspace.workspaceId,
            ...(repository
                ? {
                    providerRepoId: repository.providerRepoId,
                    commitSha: repository.commitSha,
                }
                : {}),
            ...input,
        };
        return signedIntelligenceRequest(scope.baseUrl, scope.token, path, body, 270_000);
    }
    catch (error) {
        return codeIntelligenceFailure("invalid_request", error instanceof Error ? error.message : String(error));
    }
}
export function isCodeIntelligenceFailure(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "ok" in value &&
        value.ok === false);
}
export async function signedIntelligenceRequest(baseUrl, token, path, body, timeoutMs) {
    const response = await fetch(new URL(path, baseUrl), {
        method: "POST",
        headers: {
            "content-type": "application/json",
            [RUN_TOKEN_HEADER]: token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => null);
    if (payload !== null)
        return payload;
    return codeIntelligenceFailure("backend_unavailable", `Code-intelligence returned non-JSON HTTP ${response.status}.`, response.status >= 500);
}
export const codeWorkspaceStatusTool = defineTool({
    description: "Show the exact commits and available code-intelligence indexes attached to this run. Use this first when a code query reports that an index is still being built.",
    inputSchema: z.object({}),
    async execute(_input, ctx) {
        return postCodeIntelligence(ctx, "/v1/code/workspace-status", {}, { workspaceOnly: true });
    },
});
export const codeReadTool = defineTool({
    description: "Read a file from an attached repository at the run's exact commit, optionally limited to a 1-based line range.",
    inputSchema: readInput,
    async execute({ repository, ...input }, ctx) {
        return postCodeIntelligence(ctx, "/v1/code/read", input, {
            repository,
        });
    },
});
export const codeSearchTool = defineTool({
    description: "Search an attached repository at the exact run commit. Use text/regex for literals, structural for AST patterns, symbol for graph-backed definitions/references, and security plus a language for an OpenGrep pattern. Semantic mode may be disabled.",
    inputSchema: searchInput,
    async execute({ repository, ...input }, ctx) {
        return postCodeIntelligence(ctx, "/v1/code/search", input, {
            repository,
        });
    },
});
function symbolTool(operation, description) {
    return defineTool({
        description,
        inputSchema: symbolInput,
        async execute({ repository, ...input }, ctx) {
            return postCodeIntelligence(ctx, `/v1/code/${operation}`, input, { repository });
        },
    });
}
export const codeContextTool = symbolTool("context", "Get definition, callers, callees, imports, and related code context for a symbol at the exact attached commit.");
export const codeImpactTool = symbolTool("impact", "Estimate the transitive code impact of changing a symbol at the exact attached commit, with evidence and bounded depth.");
export const codeTraceTool = defineTool({
    description: "Trace dependency or call paths between two symbols in an attached repository at the exact run commit.",
    inputSchema: traceInput,
    async execute({ repository, ...input }, ctx) {
        return postCodeIntelligence(ctx, "/v1/code/trace", input, {
            repository,
        });
    },
});
export const codeDiffImpactTool = defineTool({
    description: "Analyze the graph impact between two refs in an attached repository. Both refs must be resolvable by the exact indexed GitNexus artifact.",
    inputSchema: diffImpactInput,
    async execute({ repository, ...input }, ctx) {
        return postCodeIntelligence(ctx, "/v1/code/diff-impact", input, { repository });
    },
});
export const codeIntelligenceTools = {
    code_workspace_status: codeWorkspaceStatusTool,
    code_read: codeReadTool,
    code_search: codeSearchTool,
    code_context: codeContextTool,
    code_impact: codeImpactTool,
    code_trace: codeTraceTool,
    code_diff_impact: codeDiffImpactTool,
};
//# sourceMappingURL=code-intelligence-tools.js.map