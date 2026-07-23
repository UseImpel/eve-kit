import { type ToolContext, type ToolDefinition } from "eve/tools";
export declare const DEFAULT_CODE_INTELLIGENCE_URL = "https://code-intelligence.useimpel.ai";
type CodeIntelligenceFailure = {
    ok: false;
    error: {
        code: string;
        message: string;
        retryable: boolean;
    };
};
export declare function codeIntelligenceFailure(code: string, message: string, retryable?: boolean): CodeIntelligenceFailure;
export declare function identityRunToken(ctx: ToolContext): string;
export declare function isCodeIntelligenceFailure(value: unknown): value is CodeIntelligenceFailure;
export declare function signedIntelligenceRequest(baseUrl: string, token: string, path: string, body: Readonly<Record<string, unknown>>, timeoutMs: number): Promise<unknown>;
export declare const codeWorkspaceStatusTool: ToolDefinition<Record<string, never>, unknown>;
export declare const codeReadTool: ToolDefinition<{
    repository?: string | undefined;
    path: string;
    startLine?: number | undefined;
    endLine?: number | undefined;
}, unknown>;
export declare const codeSearchTool: ToolDefinition<{
    repository?: string | undefined;
    mode: "regex" | "security" | "semantic" | "structural" | "symbol" | "text";
    query: string;
    language?: string | undefined;
    path?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    limit: number;
}, unknown>;
export declare const codeContextTool: ToolDefinition;
export declare const codeImpactTool: ToolDefinition;
export declare const codeTraceTool: ToolDefinition<{
    repository?: string | undefined;
    fromSymbol: string;
    toSymbol: string;
    maxDepth: number;
    limit: number;
}, unknown>;
export declare const codeDiffImpactTool: ToolDefinition<{
    repository?: string | undefined;
    baseRef: string;
    headRef: string;
    maxDepth: number;
    limit: number;
}, unknown>;
export declare const codeIntelligenceTools: {
    readonly code_workspace_status: ToolDefinition<Record<string, never>, unknown>;
    readonly code_read: ToolDefinition<{
        repository?: string | undefined;
        path: string;
        startLine?: number | undefined;
        endLine?: number | undefined;
    }, unknown>;
    readonly code_search: ToolDefinition<{
        repository?: string | undefined;
        mode: "regex" | "security" | "semantic" | "structural" | "symbol" | "text";
        query: string;
        language?: string | undefined;
        path?: string | undefined;
        include?: string[] | undefined;
        exclude?: string[] | undefined;
        limit: number;
    }, unknown>;
    readonly code_context: ToolDefinition;
    readonly code_impact: ToolDefinition;
    readonly code_trace: ToolDefinition<{
        repository?: string | undefined;
        fromSymbol: string;
        toSymbol: string;
        maxDepth: number;
        limit: number;
    }, unknown>;
    readonly code_diff_impact: ToolDefinition<{
        repository?: string | undefined;
        baseRef: string;
        headRef: string;
        maxDepth: number;
        limit: number;
    }, unknown>;
};
export {};
//# sourceMappingURL=code-intelligence-tools.d.ts.map