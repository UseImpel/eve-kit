import { z } from "zod";
export declare const RENDER_UI_COMPONENT_TYPES: readonly ["Section", "Callout", "ActionList", "ActionItem", "Stat", "StatGroup", "Badge", "KeyValue", "CodeRef", "SourceLink", "Text", "Chart"];
export declare const visibilityConditionSchema: z.ZodType<unknown>;
export declare const renderUiActionBindingSchema: z.ZodObject<{
    action: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    preventDefault: z.ZodOptional<z.ZodBoolean>;
    confirm: z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        confirmLabel: z.ZodOptional<z.ZodString>;
        cancelLabel: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$loose>;
export declare const renderUiElementSchema: z.ZodUnion<readonly [z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Section">;
    props: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Callout">;
    props: z.ZodObject<{
        tone: z.ZodOptional<z.ZodEnum<{
            danger: "danger";
            info: "info";
            success: "success";
            warning: "warning";
        }>>;
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"ActionList">;
    props: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"ActionItem">;
    props: z.ZodObject<{
        title: z.ZodString;
        detail: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<{
            doing: "doing";
            done: "done";
            todo: "todo";
        }>>;
        priority: z.ZodOptional<z.ZodEnum<{
            high: "high";
            low: "low";
            med: "med";
        }>>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Stat">;
    props: z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
        delta: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"StatGroup">;
    props: z.ZodObject<{}, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Badge">;
    props: z.ZodObject<{
        label: z.ZodString;
        tone: z.ZodOptional<z.ZodEnum<{
            danger: "danger";
            info: "info";
            neutral: "neutral";
            success: "success";
            warning: "warning";
        }>>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"KeyValue">;
    props: z.ZodObject<{
        pairs: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"CodeRef">;
    props: z.ZodObject<{
        path: z.ZodString;
        line: z.ZodOptional<z.ZodNumber>;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"SourceLink">;
    props: z.ZodObject<{
        url: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        snippet: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Text">;
    props: z.ZodObject<{
        content: z.ZodString;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    children: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
    on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    repeat: z.ZodOptional<z.ZodObject<{
        statePath: z.ZodString;
        key: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>, z.ZodArray<z.ZodObject<{
        action: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        preventDefault: z.ZodOptional<z.ZodBoolean>;
        confirm: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            confirmLabel: z.ZodOptional<z.ZodString>;
            cancelLabel: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$loose>>]>>>;
    type: z.ZodLiteral<"Chart">;
    props: z.ZodObject<{
        kind: z.ZodEnum<{
            area: "area";
            bar: "bar";
            line: "line";
            pie: "pie";
        }>;
        kinds: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            area: "area";
            bar: "bar";
            line: "line";
            pie: "pie";
        }>>>;
        title: z.ZodOptional<z.ZodString>;
        data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>>;
        scenarios: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            data: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
        }, z.core.$strict>>>;
        params: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            target: z.ZodString;
            transform: z.ZodEnum<{
                compound: "compound";
                delta: "delta";
                multiplier: "multiplier";
            }>;
            min: z.ZodNumber;
            max: z.ZodNumber;
            step: z.ZodOptional<z.ZodNumber>;
            value: z.ZodNumber;
            unit: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        xKey: z.ZodOptional<z.ZodString>;
        series: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        nameKey: z.ZodOptional<z.ZodString>;
        valueKey: z.ZodOptional<z.ZodString>;
        stacked: z.ZodOptional<z.ZodBoolean>;
        height: z.ZodOptional<z.ZodNumber>;
        unit: z.ZodOptional<z.ZodString>;
    }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
}, z.core.$strict>]>;
export declare const renderUiTreeSchema: z.ZodObject<{
    root: z.ZodString;
    elements: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Section">;
        props: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Callout">;
        props: z.ZodObject<{
            tone: z.ZodOptional<z.ZodEnum<{
                danger: "danger";
                info: "info";
                success: "success";
                warning: "warning";
            }>>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"ActionList">;
        props: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"ActionItem">;
        props: z.ZodObject<{
            title: z.ZodString;
            detail: z.ZodOptional<z.ZodString>;
            status: z.ZodOptional<z.ZodEnum<{
                doing: "doing";
                done: "done";
                todo: "todo";
            }>>;
            priority: z.ZodOptional<z.ZodEnum<{
                high: "high";
                low: "low";
                med: "med";
            }>>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Stat">;
        props: z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            delta: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"StatGroup">;
        props: z.ZodObject<{}, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Badge">;
        props: z.ZodObject<{
            label: z.ZodString;
            tone: z.ZodOptional<z.ZodEnum<{
                danger: "danger";
                info: "info";
                neutral: "neutral";
                success: "success";
                warning: "warning";
            }>>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"KeyValue">;
        props: z.ZodObject<{
            pairs: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                value: z.ZodString;
            }, z.core.$strict>>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"CodeRef">;
        props: z.ZodObject<{
            path: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            label: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"SourceLink">;
        props: z.ZodObject<{
            url: z.ZodString;
            title: z.ZodOptional<z.ZodString>;
            snippet: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Text">;
        props: z.ZodObject<{
            content: z.ZodString;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        children: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
        on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        repeat: z.ZodOptional<z.ZodObject<{
            statePath: z.ZodString;
            key: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>, z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            preventDefault: z.ZodOptional<z.ZodBoolean>;
            confirm: z.ZodOptional<z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                confirmLabel: z.ZodOptional<z.ZodString>;
                cancelLabel: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$loose>>]>>>;
        type: z.ZodLiteral<"Chart">;
        props: z.ZodObject<{
            kind: z.ZodEnum<{
                area: "area";
                bar: "bar";
                line: "line";
                pie: "pie";
            }>;
            kinds: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                area: "area";
                bar: "bar";
                line: "line";
                pie: "pie";
            }>>>;
            title: z.ZodOptional<z.ZodString>;
            data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>>;
            scenarios: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                data: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
            }, z.core.$strict>>>;
            params: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodString;
                target: z.ZodString;
                transform: z.ZodEnum<{
                    compound: "compound";
                    delta: "delta";
                    multiplier: "multiplier";
                }>;
                min: z.ZodNumber;
                max: z.ZodNumber;
                step: z.ZodOptional<z.ZodNumber>;
                value: z.ZodNumber;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
            xKey: z.ZodOptional<z.ZodString>;
            series: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
            nameKey: z.ZodOptional<z.ZodString>;
            valueKey: z.ZodOptional<z.ZodString>;
            stacked: z.ZodOptional<z.ZodBoolean>;
            height: z.ZodOptional<z.ZodNumber>;
            unit: z.ZodOptional<z.ZodString>;
        }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
    }, z.core.$strict>]>>;
    state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export declare const renderUiInputSchema: z.ZodObject<{
    tree: z.ZodObject<{
        root: z.ZodString;
        elements: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Section">;
            props: z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Callout">;
            props: z.ZodObject<{
                tone: z.ZodOptional<z.ZodEnum<{
                    danger: "danger";
                    info: "info";
                    success: "success";
                    warning: "warning";
                }>>;
                title: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"ActionList">;
            props: z.ZodObject<{
                title: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"ActionItem">;
            props: z.ZodObject<{
                title: z.ZodString;
                detail: z.ZodOptional<z.ZodString>;
                status: z.ZodOptional<z.ZodEnum<{
                    doing: "doing";
                    done: "done";
                    todo: "todo";
                }>>;
                priority: z.ZodOptional<z.ZodEnum<{
                    high: "high";
                    low: "low";
                    med: "med";
                }>>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Stat">;
            props: z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                delta: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"StatGroup">;
            props: z.ZodObject<{}, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Badge">;
            props: z.ZodObject<{
                label: z.ZodString;
                tone: z.ZodOptional<z.ZodEnum<{
                    danger: "danger";
                    info: "info";
                    neutral: "neutral";
                    success: "success";
                    warning: "warning";
                }>>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"KeyValue">;
            props: z.ZodObject<{
                pairs: z.ZodArray<z.ZodObject<{
                    key: z.ZodString;
                    value: z.ZodString;
                }, z.core.$strict>>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"CodeRef">;
            props: z.ZodObject<{
                path: z.ZodString;
                line: z.ZodOptional<z.ZodNumber>;
                label: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"SourceLink">;
            props: z.ZodObject<{
                url: z.ZodString;
                title: z.ZodOptional<z.ZodString>;
                snippet: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Text">;
            props: z.ZodObject<{
                content: z.ZodString;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            children: z.ZodOptional<z.ZodArray<z.ZodString>>;
            visible: z.ZodOptional<z.ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
            on: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            repeat: z.ZodOptional<z.ZodObject<{
                statePath: z.ZodString;
                key: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            watch: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>, z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                preventDefault: z.ZodOptional<z.ZodBoolean>;
                confirm: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    confirmLabel: z.ZodOptional<z.ZodString>;
                    cancelLabel: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$loose>>]>>>;
            type: z.ZodLiteral<"Chart">;
            props: z.ZodObject<{
                kind: z.ZodEnum<{
                    area: "area";
                    bar: "bar";
                    line: "line";
                    pie: "pie";
                }>;
                kinds: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                    area: "area";
                    bar: "bar";
                    line: "line";
                    pie: "pie";
                }>>>;
                title: z.ZodOptional<z.ZodString>;
                data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>>;
                scenarios: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    data: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>>;
                }, z.core.$strict>>>;
                params: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    label: z.ZodString;
                    target: z.ZodString;
                    transform: z.ZodEnum<{
                        compound: "compound";
                        delta: "delta";
                        multiplier: "multiplier";
                    }>;
                    min: z.ZodNumber;
                    max: z.ZodNumber;
                    step: z.ZodOptional<z.ZodNumber>;
                    value: z.ZodNumber;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>>>;
                xKey: z.ZodOptional<z.ZodString>;
                series: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    key: z.ZodString;
                    label: z.ZodOptional<z.ZodString>;
                    color: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>>>;
                nameKey: z.ZodOptional<z.ZodString>;
                valueKey: z.ZodOptional<z.ZodString>;
                stacked: z.ZodOptional<z.ZodBoolean>;
                height: z.ZodOptional<z.ZodNumber>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict> | z.ZodOptional<z.ZodObject<{}, z.core.$strict>>;
        }, z.core.$strict>]>>;
        state: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strict>;
    title: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type RenderUiElement = z.infer<typeof renderUiElementSchema>;
export type RenderUiTree = z.infer<typeof renderUiTreeSchema>;
export type RenderUiInput = z.infer<typeof renderUiInputSchema>;
export declare const RENDER_UI_TOOL_DESCRIPTION: string;
export declare const RENDER_UI_PROMPT: string;
export declare const renderUiTool: import("eve/tools").ToolDefinition<{
    tree: {
        root: string;
        elements: Record<string, {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Section";
            props: Record<string, never> | {
                title?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Callout";
            props: Record<string, never> | {
                tone?: "danger" | "info" | "success" | "warning" | undefined;
                title?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "ActionList";
            props: Record<string, never> | {
                title?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "ActionItem";
            props: Record<string, never> | {
                title: string;
                detail?: string | undefined;
                status?: "doing" | "done" | "todo" | undefined;
                priority?: "high" | "low" | "med" | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Stat";
            props: Record<string, never> | {
                label: string;
                value: string;
                delta?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "StatGroup";
            props: Record<string, never> | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Badge";
            props: Record<string, never> | {
                label: string;
                tone?: "danger" | "info" | "neutral" | "success" | "warning" | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "KeyValue";
            props: Record<string, never> | {
                pairs: {
                    key: string;
                    value: string;
                }[];
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "CodeRef";
            props: Record<string, never> | {
                path: string;
                line?: number | undefined;
                label?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "SourceLink";
            props: Record<string, never> | {
                url: string;
                title?: string | undefined;
                snippet?: string | undefined;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Text";
            props: Record<string, never> | {
                content: string;
            } | undefined;
        } | {
            children?: string[] | undefined;
            visible?: unknown;
            on?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            repeat?: {
                statePath: string;
                key?: string | undefined;
            } | undefined;
            watch?: Record<string, {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }[] | {
                [x: string]: unknown;
                action: string;
                params?: Record<string, unknown> | undefined;
                preventDefault?: boolean | undefined;
                confirm?: {
                    title?: string | undefined;
                    description?: string | undefined;
                    confirmLabel?: string | undefined;
                    cancelLabel?: string | undefined;
                } | undefined;
            }> | undefined;
            type: "Chart";
            props: Record<string, never> | {
                kind: "area" | "bar" | "line" | "pie";
                kinds?: ("area" | "bar" | "line" | "pie")[] | undefined;
                title?: string | undefined;
                data?: Record<string, string | number>[] | undefined;
                scenarios?: {
                    id: string;
                    label: string;
                    data: Record<string, string | number>[];
                }[] | undefined;
                params?: {
                    id: string;
                    label: string;
                    target: string;
                    transform: "compound" | "delta" | "multiplier";
                    min: number;
                    max: number;
                    step?: number | undefined;
                    value: number;
                    unit?: string | undefined;
                }[] | undefined;
                xKey?: string | undefined;
                series?: {
                    key: string;
                    label?: string | undefined;
                    color?: string | undefined;
                }[] | undefined;
                nameKey?: string | undefined;
                valueKey?: string | undefined;
                stacked?: boolean | undefined;
                height?: number | undefined;
                unit?: string | undefined;
            } | undefined;
        }>;
        state?: Record<string, unknown> | undefined;
    };
    title?: string | undefined;
}, string>;
export default renderUiTool;
//# sourceMappingURL=render-ui.d.ts.map