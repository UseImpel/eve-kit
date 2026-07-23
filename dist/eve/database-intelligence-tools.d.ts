export declare const databaseCatalogStatusTool: import("eve/tools").ToolDefinition<Record<string, never>, unknown>;
export declare const databaseSearchTool: import("eve/tools").ToolDefinition<{
    query: string;
    engine?: string | undefined;
    environment?: string | undefined;
    database?: string | undefined;
    schema?: string | undefined;
    kinds?: ("check" | "collection" | "other" | "routine" | "table" | "trigger" | "view")[] | undefined;
    limit: number;
}, unknown>;
export declare const databaseDescribeTool: import("eve/tools").ToolDefinition<{
    objectId?: string | undefined;
    database?: string | undefined;
    qualifiedName?: string | undefined;
}, unknown>;
export declare const databaseRelationsTool: import("eve/tools").ToolDefinition<{
    objectId?: string | undefined;
    database?: string | undefined;
    qualifiedName?: string | undefined;
    direction: "both" | "incoming" | "outgoing";
    kinds?: ("depends-on" | "foreign-key" | "trigger-parent")[] | undefined;
    maxDepth: number;
    limit: number;
}, unknown>;
export declare const databaseCompareTool: import("eve/tools").ToolDefinition<{
    leftDatabase: string;
    rightDatabase: string;
    schema?: string | undefined;
    kinds?: ("check" | "collection" | "other" | "routine" | "table" | "trigger" | "view")[] | undefined;
    namePattern?: string | undefined;
    limit: number;
}, unknown>;
export declare const databaseIntelligenceTools: {
    readonly database_catalog_status: import("eve/tools").ToolDefinition<Record<string, never>, unknown>;
    readonly database_search: import("eve/tools").ToolDefinition<{
        query: string;
        engine?: string | undefined;
        environment?: string | undefined;
        database?: string | undefined;
        schema?: string | undefined;
        kinds?: ("check" | "collection" | "other" | "routine" | "table" | "trigger" | "view")[] | undefined;
        limit: number;
    }, unknown>;
    readonly database_describe: import("eve/tools").ToolDefinition<{
        objectId?: string | undefined;
        database?: string | undefined;
        qualifiedName?: string | undefined;
    }, unknown>;
    readonly database_relations: import("eve/tools").ToolDefinition<{
        objectId?: string | undefined;
        database?: string | undefined;
        qualifiedName?: string | undefined;
        direction: "both" | "incoming" | "outgoing";
        kinds?: ("depends-on" | "foreign-key" | "trigger-parent")[] | undefined;
        maxDepth: number;
        limit: number;
    }, unknown>;
    readonly database_compare: import("eve/tools").ToolDefinition<{
        leftDatabase: string;
        rightDatabase: string;
        schema?: string | undefined;
        kinds?: ("check" | "collection" | "other" | "routine" | "table" | "trigger" | "view")[] | undefined;
        namePattern?: string | undefined;
        limit: number;
    }, unknown>;
};
//# sourceMappingURL=database-intelligence-tools.d.ts.map