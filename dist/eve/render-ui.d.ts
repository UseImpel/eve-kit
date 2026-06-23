import { z } from "zod";
export declare const RENDER_UI_COMPONENT_TYPES: readonly ["Section", "Callout", "ActionList", "ActionItem", "Stat", "StatGroup", "Badge", "KeyValue", "CodeRef", "SourceLink", "Text", "Chart"];
export declare const renderUiElementSchema: z.ZodObject<{
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
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const renderUiTreeSchema: z.ZodObject<{
    root: z.ZodString;
    elements: z.ZodRecord<z.ZodString, z.ZodObject<{
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
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const renderUiInputSchema: z.ZodObject<{
    tree: z.ZodObject<{
        root: z.ZodString;
        elements: z.ZodRecord<z.ZodString, z.ZodObject<{
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
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    title: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RenderUiElement = z.infer<typeof renderUiElementSchema>;
export type RenderUiTree = z.infer<typeof renderUiTreeSchema>;
export type RenderUiInput = z.infer<typeof renderUiInputSchema>;
export declare const RENDER_UI_TOOL_DESCRIPTION: string;
export declare const RENDER_UI_PROMPT: string;
export declare const renderUiTool: import("eve/tools").ToolDefinition<{
    tree: {
        root: string;
        elements: Record<string, {
            type: "Section" | "Callout" | "ActionList" | "ActionItem" | "Stat" | "StatGroup" | "Badge" | "KeyValue" | "CodeRef" | "SourceLink" | "Text" | "Chart";
            props?: Record<string, unknown> | undefined;
            children?: string[] | undefined;
        }>;
    };
    title?: string | undefined;
}, string>;
export default renderUiTool;
//# sourceMappingURL=render-ui.d.ts.map