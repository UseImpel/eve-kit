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
const JsonRecord = z.record(z.string(), z.unknown());
const comparisonValueSchema = z.union([
    z.number(),
    z.object({ $state: z.string() }),
]);
const comparisonOps = {
    eq: z.unknown().optional(),
    neq: z.unknown().optional(),
    gt: comparisonValueSchema.optional(),
    gte: comparisonValueSchema.optional(),
    lt: comparisonValueSchema.optional(),
    lte: comparisonValueSchema.optional(),
    not: z.literal(true).optional(),
};
export const visibilityConditionSchema = z.lazy(() => z.union([
    z.boolean(),
    z.object({ $state: z.string(), ...comparisonOps }),
    z.object({ $item: z.string(), ...comparisonOps }),
    z.object({ $index: z.literal(true), ...comparisonOps }),
    z.array(visibilityConditionSchema),
    z.object({ $and: z.array(visibilityConditionSchema) }),
    z.object({ $or: z.array(visibilityConditionSchema) }),
]));
export const renderUiActionBindingSchema = z
    .object({
    action: z.string(),
    params: JsonRecord.optional(),
    preventDefault: z.boolean().optional(),
    confirm: z
        .object({
        title: z.string().optional(),
        description: z.string().optional(),
        confirmLabel: z.string().optional(),
        cancelLabel: z.string().optional(),
    })
        .optional(),
})
    .passthrough();
const actionBindingOrListSchema = z.union([
    renderUiActionBindingSchema,
    z.array(renderUiActionBindingSchema),
]);
const elementBehaviorFields = {
    children: z.array(z.string()).optional(),
    visible: visibilityConditionSchema.optional(),
    on: z.record(z.string(), actionBindingOrListSchema).optional(),
    repeat: z
        .object({
        statePath: z.string().min(1),
        key: z.string().optional(),
    })
        .optional(),
    watch: z.record(z.string(), actionBindingOrListSchema).optional(),
};
const chartScalarSchema = z.union([z.number(), z.string()]);
const chartRowsSchema = z.array(z.record(z.string(), chartScalarSchema));
const chartKindSchema = z.enum(["bar", "line", "area", "pie"]);
const chartSeriesSchema = z.object({
    key: z.string(),
    label: z.string().optional(),
    color: z.string().optional(),
}).strict();
const chartPropsSchema = z.object({
    kind: chartKindSchema,
    kinds: z.array(chartKindSchema).optional(),
    title: z.string().optional(),
    data: chartRowsSchema.optional(),
    scenarios: z
        .array(z.object({
        id: z.string(),
        label: z.string(),
        data: chartRowsSchema.min(1),
    }).strict())
        .optional(),
    params: z
        .array(z.object({
        id: z.string(),
        label: z.string(),
        target: z.string(),
        transform: z.enum(["multiplier", "delta", "compound"]),
        min: z.number(),
        max: z.number(),
        step: z.number().optional(),
        value: z.number(),
        unit: z.string().optional(),
    }).strict())
        .optional(),
    xKey: z.string().optional(),
    series: z.array(chartSeriesSchema).optional(),
    nameKey: z.string().optional(),
    valueKey: z.string().optional(),
    stacked: z.boolean().optional(),
    height: z.number().min(80).max(600).optional(),
    unit: z.string().optional(),
}).strict();
const componentPropSchemas = {
    Section: z.object({ title: z.string().optional() }).strict(),
    Callout: z.object({
        tone: z.enum(["info", "warning", "success", "danger"]).optional(),
        title: z.string().optional(),
    }).strict(),
    ActionList: z.object({ title: z.string().optional() }).strict(),
    ActionItem: z.object({
        title: z.string(),
        detail: z.string().optional(),
        status: z.enum(["todo", "doing", "done"]).optional(),
        priority: z.enum(["low", "med", "high"]).optional(),
    }).strict(),
    Stat: z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().optional(),
    }).strict(),
    StatGroup: z.object({}).strict(),
    Badge: z.object({
        label: z.string(),
        tone: z
            .enum(["neutral", "info", "success", "warning", "danger"])
            .optional(),
    }).strict(),
    KeyValue: z.object({
        pairs: z.array(z.object({ key: z.string(), value: z.string() }).strict()),
    }).strict(),
    CodeRef: z.object({
        path: z.string(),
        line: z.number().optional(),
        label: z.string().optional(),
    }).strict(),
    SourceLink: z.object({
        url: z.string(),
        title: z.string().optional(),
        snippet: z.string().optional(),
    }).strict(),
    Text: z.object({ content: z.string() }).strict(),
    Chart: chartPropsSchema,
};
function elementSchemaFor(type, props) {
    const propsSchema = props.safeParse({}).success ? props.optional() : props;
    return z
        .object({
        type: z.literal(type),
        props: propsSchema,
        ...elementBehaviorFields,
    })
        .strict();
}
export const renderUiElementSchema = z.union([
    elementSchemaFor("Section", componentPropSchemas.Section),
    elementSchemaFor("Callout", componentPropSchemas.Callout),
    elementSchemaFor("ActionList", componentPropSchemas.ActionList),
    elementSchemaFor("ActionItem", componentPropSchemas.ActionItem),
    elementSchemaFor("Stat", componentPropSchemas.Stat),
    elementSchemaFor("StatGroup", componentPropSchemas.StatGroup),
    elementSchemaFor("Badge", componentPropSchemas.Badge),
    elementSchemaFor("KeyValue", componentPropSchemas.KeyValue),
    elementSchemaFor("CodeRef", componentPropSchemas.CodeRef),
    elementSchemaFor("SourceLink", componentPropSchemas.SourceLink),
    elementSchemaFor("Text", componentPropSchemas.Text),
    elementSchemaFor("Chart", componentPropSchemas.Chart),
]);
export const renderUiTreeSchema = z
    .object({
    root: z.string().min(1),
    elements: z.record(z.string(), renderUiElementSchema),
    state: JsonRecord.optional(),
})
    .strict();
export const renderUiInputSchema = z
    .object({
    tree: renderUiTreeSchema,
    title: z.string().optional(),
})
    .strict();
export const RENDER_UI_TOOL_DESCRIPTION = "Render structured UI for the user. Use this for plans, status, findings, " +
    "tables, metrics, citations, code references, or final summaries that benefit " +
    "from cards, callouts, lists, stats, links, or simple charts.";
export const RENDER_UI_PROMPT = "When a response benefits from structure, call render_ui with " +
    "{ tree: { root, elements, state? }, title? }. Each element is keyed by id " +
    "and must use one of these types: Section, Callout, ActionList, ActionItem, " +
    "Stat, StatGroup, Badge, KeyValue, CodeRef, SourceLink, Text, Chart. Put " +
    "children, visible, on, repeat, and watch at the element level, never inside " +
    "props. Every child id must exist in elements and root must refer to an " +
    "existing id. Keep data compact and only use props documented by the catalog.";
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
            value: "Structured UI was rendered for the user. Continue with concise text only if needed.",
        };
    },
});
export default renderUiTool;
//# sourceMappingURL=render-ui.js.map