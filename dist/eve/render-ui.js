import { defineTool } from "eve/tools";
import { z } from "zod";
export const RENDER_UI_COMPONENT_TYPES = [
    "Section",
    "Callout",
    "ActionList",
    "ActionItem",
    "Stat",
    "StatGroup",
    "Badge",
    "KeyValue",
    "CodeRef",
    "SourceLink",
    "Text",
    "Chart",
];
export const renderUiElementSchema = z.object({
    id: z.string().min(1),
    type: z.enum(RENDER_UI_COMPONENT_TYPES),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(z.string().min(1)).optional(),
});
export const renderUiTreeSchema = z.object({
    rootId: z.string().min(1),
    elements: z.array(renderUiElementSchema).min(1),
});
export const RENDER_UI_TOOL_DESCRIPTION = "Render structured UI for the user. Use this for plans, status, findings, " +
    "tables, metrics, citations, code references, or final summaries that benefit " +
    "from cards, callouts, lists, stats, links, or simple charts.";
export const RENDER_UI_PROMPT = "When a response benefits from structure, call render_ui with a tree of " +
    "Section, Callout, ActionList, ActionItem, Stat, StatGroup, Badge, KeyValue, " +
    "CodeRef, SourceLink, Text, and Chart nodes.";
export const renderUiTool = defineTool({
    description: RENDER_UI_TOOL_DESCRIPTION,
    inputSchema: renderUiTreeSchema,
    execute(input) {
        return input;
    },
    toModelOutput() {
        return {
            type: "text",
            value: "Structured UI was rendered for the user. Continue with concise text only if needed.",
        };
    },
});
export default renderUiTool;
//# sourceMappingURL=render-ui.js.map