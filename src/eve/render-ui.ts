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
] as const;

export const renderUiElementSchema = z.object({
  type: z.enum(RENDER_UI_COMPONENT_TYPES),
  props: z.record(z.string(), z.unknown()).optional(),
  children: z.array(z.string()).optional(),
});

export const renderUiTreeSchema = z.object({
  root: z.string().min(1),
  elements: z.record(z.string(), renderUiElementSchema),
});

export const renderUiInputSchema = z.object({
  tree: renderUiTreeSchema,
  title: z.string().optional(),
});

export type RenderUiElement = z.infer<typeof renderUiElementSchema>;
export type RenderUiTree = z.infer<typeof renderUiTreeSchema>;
export type RenderUiInput = z.infer<typeof renderUiInputSchema>;

export const RENDER_UI_TOOL_DESCRIPTION =
  "Render structured UI for the user. Use this for plans, status, findings, " +
  "tables, metrics, citations, code references, or final summaries that benefit " +
  "from cards, callouts, lists, stats, links, or simple charts.";

export const RENDER_UI_PROMPT =
  "When a response benefits from structure, call render_ui with a tree of " +
  "Section, Callout, ActionList, ActionItem, Stat, StatGroup, Badge, KeyValue, " +
  "CodeRef, SourceLink, Text, and Chart nodes. The input shape is " +
  "{ tree: { root, elements }, title? }, where elements is a record keyed by id.";

export const renderUiTool = defineTool({
  description: RENDER_UI_TOOL_DESCRIPTION,
  inputSchema: renderUiInputSchema,
  execute({ tree, title }) {
    const count = Object.keys(tree.elements).length;
    return title
      ? `Rendered UI "${title}" (${count} element${count === 1 ? "" : "s"}).`
      : `Rendered UI (${count} element${count === 1 ? "" : "s"}).`;
  },
  toModelOutput() {
    return {
      type: "text",
      value:
        "Structured UI was rendered for the user. Continue with concise text only if needed.",
    };
  },
});

export default renderUiTool;
