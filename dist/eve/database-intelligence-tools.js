import { defineTool } from "eve/tools";
import { z } from "zod";
import { DEFAULT_CODE_INTELLIGENCE_URL, codeIntelligenceFailure, identityRunToken, signedIntelligenceRequest, } from "./code-intelligence-tools.js";
const objectKind = z.enum([
    "table",
    "view",
    "collection",
    "routine",
    "trigger",
    "check",
    "other",
]);
const relationKind = z.enum(["foreign-key", "trigger-parent", "depends-on"]);
const searchInput = z.object({
    query: z.string().min(1).max(2048).describe("Object, field, type, index, or constraint terms to find."),
    engine: z.string().min(1).max(128).optional(),
    environment: z.string().min(1).max(128).optional(),
    database: z.string().min(1).max(512).optional(),
    schema: z.string().min(1).max(512).optional(),
    kinds: z.array(objectKind).min(1).max(7).optional(),
    limit: z.number().int().min(1).max(100).default(25),
});
const describeInput = z.object({
    objectId: z.string().min(1).max(160).optional(),
    database: z.string().min(1).max(512).optional(),
    qualifiedName: z.string().min(1).max(2048).optional(),
}).refine((value) => Boolean(value.objectId || value.qualifiedName), {
    message: "Pass objectId or qualifiedName.",
});
const relationsInput = z.object({
    objectId: z.string().min(1).max(160).optional(),
    database: z.string().min(1).max(512).optional(),
    qualifiedName: z.string().min(1).max(2048).optional(),
    direction: z.enum(["incoming", "outgoing", "both"]).default("both"),
    kinds: z.array(relationKind).min(1).max(3).optional(),
    maxDepth: z.number().int().min(1).max(5).default(2),
    limit: z.number().int().min(1).max(200).default(100),
}).refine((value) => Boolean(value.objectId || value.qualifiedName), {
    message: "Pass objectId or qualifiedName.",
});
const compareInput = z.object({
    leftDatabase: z.string().min(1).max(512),
    rightDatabase: z.string().min(1).max(512),
    schema: z.string().min(1).max(512).optional(),
    kinds: z.array(objectKind).min(1).max(7).optional(),
    namePattern: z.string().min(1).max(512).optional(),
    limit: z.number().int().min(1).max(500).default(200),
});
async function postDatabaseIntelligence(ctx, path, input) {
    try {
        const token = identityRunToken(ctx);
        const baseUrl = process.env.IMPEL_CODE_INTELLIGENCE_URL?.trim() ?? DEFAULT_CODE_INTELLIGENCE_URL;
        return await signedIntelligenceRequest(baseUrl, token, path, input, 60_000);
    }
    catch (error) {
        return codeIntelligenceFailure("invalid_request", error instanceof Error ? error.message : String(error));
    }
}
export const databaseCatalogStatusTool = defineTool({
    description: "Show the immutable database-schema catalog snapshot attached to this run, including generation time, engines, environments, and reconciled counts. Use this first when database coverage is uncertain.",
    inputSchema: z.object({}),
    async execute(_input, ctx) {
        return postDatabaseIntelligence(ctx, "/v1/database/catalog-status", {});
    },
});
export const databaseSearchTool = defineTool({
    description: "Search the attached live-system database catalog for tables, views, collections, routines, fields, indexes, and constraints. Returns schema metadata only, never row or document values.",
    inputSchema: searchInput,
    async execute(input, ctx) {
        return postDatabaseIntelligence(ctx, "/v1/database/search", input);
    },
});
export const databaseDescribeTool = defineTool({
    description: "Describe one database object from the attached catalog, including columns or fields, data types, indexes, and constraints. Use database plus qualifiedName when names may repeat.",
    inputSchema: describeInput,
    async execute(input, ctx) {
        return postDatabaseIntelligence(ctx, "/v1/database/describe", input);
    },
});
export const databaseRelationsTool = defineTool({
    description: "Trace bounded incoming and outgoing database-schema relationships from one object, such as foreign keys, using the immutable catalog attached to this run.",
    inputSchema: relationsInput,
    async execute(input, ctx) {
        return postDatabaseIntelligence(ctx, "/v1/database/relations", input);
    },
});
export const databaseCompareTool = defineTool({
    description: "Compare structural schema metadata between two databases in the attached catalog and report objects present on one side or structurally changed. This does not compare stored data.",
    inputSchema: compareInput,
    async execute(input, ctx) {
        return postDatabaseIntelligence(ctx, "/v1/database/compare", input);
    },
});
export const databaseIntelligenceTools = {
    database_catalog_status: databaseCatalogStatusTool,
    database_search: databaseSearchTool,
    database_describe: databaseDescribeTool,
    database_relations: databaseRelationsTool,
    database_compare: databaseCompareTool,
};
//# sourceMappingURL=database-intelligence-tools.js.map