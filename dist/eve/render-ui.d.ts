import { z } from "zod";
export declare const RENDER_UI_COMPONENT_TYPES: readonly ["Section", "Callout", "ActionList", "ActionItem", "Stat", "StatGroup", "Badge", "KeyValue", "CodeRef", "SourceLink", "Text", "Chart"];
export declare const renderUiElementSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        Section: "Section";
        Callout: "Callout";
        ActionList: "ActionList";
        ActionItem: "ActionItem";
        Stat: "Stat";
        StatGroup: "StatGroup";
        Badge: "Badge";
        KeyValue: "KeyValue";
        CodeRef: "CodeRef";
        SourceLink: "SourceLink";
        Text: "Text";
        Chart: "Chart";
    }>;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const renderUiTreeSchema: z.ZodObject<{
    rootId: z.ZodString;
    elements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            Section: "Section";
            Callout: "Callout";
            ActionList: "ActionList";
            ActionItem: "ActionItem";
            Stat: "Stat";
            StatGroup: "StatGroup";
            Badge: "Badge";
            KeyValue: "KeyValue";
            CodeRef: "CodeRef";
            SourceLink: "SourceLink";
            Text: "Text";
            Chart: "Chart";
        }>;
        props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RenderUiElement = z.infer<typeof renderUiElementSchema>;
export type RenderUiTree = z.infer<typeof renderUiTreeSchema>;
export declare const RENDER_UI_TOOL_DESCRIPTION: string;
export declare const RENDER_UI_PROMPT: string;
export declare const renderUiTool: import("eve/tools").ToolDefinition<{
    rootId: string;
    elements: {
        id: string;
        type: "Section" | "Callout" | "ActionList" | "ActionItem" | "Stat" | "StatGroup" | "Badge" | "KeyValue" | "CodeRef" | "SourceLink" | "Text" | "Chart";
        props: Record<string, unknown>;
        children?: string[] | undefined;
    }[];
}, {
    rootId: string;
    elements: {
        id: string;
        type: "Section" | "Callout" | "ActionList" | "ActionItem" | "Stat" | "StatGroup" | "Badge" | "KeyValue" | "CodeRef" | "SourceLink" | "Text" | "Chart";
        props: Record<string, unknown>;
        children?: string[] | undefined;
    }[];
}>;
export default renderUiTool;
//# sourceMappingURL=render-ui.d.ts.map