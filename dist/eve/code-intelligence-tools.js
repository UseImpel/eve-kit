import { defineTool } from "eve/tools";
import { z } from "zod";
import { normalizeImpelEveRunContext, } from "./channel.js";
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
function failure(code, message, retryable = false) {
    return { ok: false, error: { code, message, retryable } };
}
function readString(value) {
    return typeof value === "string" && value.trim()
        ? value.trim()
        : undefined;
}
async function requestScope(ctx) {
    let runContext = normalizeImpelEveRunContext(ctx.channel?.metadata);
    if (!runContext?.codeIntelligence) {
        try {
            const sandbox = await ctx.getSandbox();
            const result = await sandbox.run({
                command: "cat /workspace/.impel/run-context.json",
            });
            if (result.exitCode === 0) {
                runContext = normalizeImpelEveRunContext(JSON.parse(String(result.stdout ?? "")));
            }
        }
        catch {
            // Top-level HTTP runs resolve from channel metadata. The marker fallback
            // exists only for a co-resident subagent sharing the workspace.
        }
    }
    const orgId = readString(runContext?.orgId);
    const runId = readString(runContext?.runId);
    if (!orgId || !runId || !runContext?.codeIntelligence) {
        throw new Error("No server-prepared code-intelligence workspace is attached to this Eve run.");
    }
    return { context: runContext.codeIntelligence, orgId, runId };
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
        const baseUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL?.trim();
        const runtimeKey = process.env.IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY?.trim();
        if (!baseUrl || !runtimeKey) {
            return failure("misconfigured", "The Eve runtime is missing IMPEL_CODE_INTELLIGENCE_URL or IMPEL_CODE_INTELLIGENCE_RUNTIME_API_KEY.");
        }
        const repository = options.workspaceOnly
            ? undefined
            : selectRepository(scope.context, options.repository);
        const body = {
            workspaceId: scope.context.workspaceId,
            ...(repository
                ? {
                    providerRepoId: repository.providerRepoId,
                    commitSha: repository.commitSha,
                }
                : {}),
            ...input,
        };
        const response = await fetch(new URL(path, baseUrl), {
            method: "POST",
            headers: {
                authorization: `Bearer ${runtimeKey}`,
                "content-type": "application/json",
                "x-impel-org-id": scope.orgId,
                "x-impel-run-id": scope.runId,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(270_000),
        });
        const payload = await response.json().catch(() => null);
        if (payload !== null)
            return payload;
        return failure("backend_unavailable", `Code-intelligence returned non-JSON HTTP ${response.status}.`, response.status >= 500);
    }
    catch (error) {
        return failure("invalid_request", error instanceof Error ? error.message : String(error));
    }
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