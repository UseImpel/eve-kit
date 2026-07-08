import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { claudeCode, } from "ai-sdk-provider-claude-code";
const DEFAULT_CONFIG_ROOT = "/tmp/impel-gateway-claude";
/**
 * Runs the local Claude Code provider against impel-gateway's
 * Anthropic-compatible endpoint instead of the impel-inference stream proxy.
 */
export function impelGatewayClaudeModel(modelId, opts) {
    const configDir = opts.configDir ?? join(DEFAULT_CONFIG_ROOT, randomUUID());
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    return claudeCode(modelId, buildGatewayClaudeCodeSettings({
        providerOptions: opts.providerOptions,
        gatewayUrl: opts.gatewayUrl,
        pat: opts.pat,
        configDir,
    }));
}
export function buildGatewayClaudeCodeSettings(args) {
    const source = args.providerOptions ?? {};
    const scoped = [
        "claude-code",
        "claude_code",
        "claude",
        "anthropic",
    ].reduce((acc, namespace) => {
        const value = source[namespace];
        return isPlainObject(value) ? { ...acc, ...value } : acc;
    }, {});
    const merged = normalizeClaudeEffortOptions({ ...source, ...scoped });
    const env = stringRecordValue(merged.env);
    return pruneUndefined({
        permissionMode: merged.permissionMode,
        allowDangerouslySkipPermissions: booleanValue(merged.allowDangerouslySkipPermissions),
        effort: stringValue(merged.effort),
        allowedTools: stringArrayValue(merged.allowedTools),
        disallowedTools: stringArrayValue(merged.disallowedTools),
        maxTurns: numberValue(merged.maxTurns),
        agents: plainObjectValue(merged.agents),
        forwardSubagentText: booleanValue(merged.forwardSubagentText),
        agentProgressSummaries: booleanValue(merged.agentProgressSummaries),
        skills: merged.skills === "all" ? "all" : stringArrayValue(merged.skills),
        settingSources: stringArrayValue(merged.settingSources) ??
            [],
        mcpServers: plainObjectValue(merged.mcpServers),
        promptSuggestions: booleanValue(merged.promptSuggestions),
        cwd: stringValue(merged.cwd),
        sessionId: stringValue(merged.sessionId),
        resume: stringValue(merged.resume),
        continue: booleanValue(merged.continue),
        forkSession: booleanValue(merged.forkSession),
        persistSession: booleanValue(merged.persistSession),
        title: stringValue(merged.title),
        fallbackModel: stringValue(merged.fallbackModel),
        managedSettings: plainObjectValue(merged.managedSettings),
        toolAliases: plainObjectValue(merged.toolAliases),
        toolConfig: plainObjectValue(merged.toolConfig),
        stderr: typeof merged.stderr === "function"
            ? merged.stderr
            : logClaudeCodeStderr,
        env: {
            ...env,
            ANTHROPIC_BASE_URL: `${args.gatewayUrl.replace(/\/$/, "")}/anthropic`,
            ANTHROPIC_AUTH_TOKEN: args.pat,
            ANTHROPIC_API_KEY: undefined,
            CLAUDE_CODE_OAUTH_TOKEN: undefined,
            CLAUDE_CONFIG_DIR: args.configDir,
            CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: "1",
            CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "0",
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
            DISABLE_LOGIN_COMMAND: "1",
            DISABLE_LOGOUT_COMMAND: "1",
        },
    });
}
function normalizeClaudeEffortOptions(options) {
    const next = { ...options };
    if (next.effort !== undefined)
        next.effort = normalizeClaudeEffort(next.effort);
    for (const namespace of ["anthropic", "claude", "claude_code", "claude-code"]) {
        const value = next[namespace];
        if (isPlainObject(value) && value.effort !== undefined) {
            next[namespace] = { ...value, effort: normalizeClaudeEffort(value.effort) };
        }
    }
    return next;
}
function normalizeClaudeEffort(value) {
    if (typeof value !== "string")
        return value;
    return value.trim().toLowerCase() === "xhigh" ? "high" : value;
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function plainObjectValue(value) {
    return isPlainObject(value) ? value : undefined;
}
function stringRecordValue(value) {
    if (!isPlainObject(value))
        return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item === undefined || typeof item === "string"));
}
function stringValue(value) {
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
function numberValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function booleanValue(value) {
    return typeof value === "boolean" ? value : undefined;
}
function stringArrayValue(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? value
        : undefined;
}
function pruneUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
function logClaudeCodeStderr(data) {
    const text = data.trimEnd();
    if (text)
        console.error("[impel-gateway-claude:stderr]", text);
}
//# sourceMappingURL=gateway-model.js.map