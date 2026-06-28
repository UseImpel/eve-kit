import { test } from "node:test";
import assert from "node:assert/strict";

import { renderUiInputSchema } from "../dist/eve/render-ui.js";

test("render_ui schema accepts valid catalog trees", () => {
  const result = renderUiInputSchema.safeParse({
    title: "Summary",
    tree: {
      root: "root",
      state: { items: [{ title: "Ship" }] },
      elements: {
        root: {
          type: "Section",
          props: { title: "Summary" },
          children: ["item"],
        },
        item: {
          type: "ActionItem",
          props: { title: "Ship", status: "doing", priority: "high" },
          visible: { $state: "/items/0/title" },
        },
      },
    },
  });
  assert.equal(result.success, true);
});

test("render_ui schema rejects unknown components", () => {
  const result = renderUiInputSchema.safeParse({
    tree: {
      root: "root",
      elements: { root: { type: "MadeUp", props: {} } },
    },
  });
  assert.equal(result.success, false);
});

test("render_ui schema validates props for the selected component type", () => {
  const result = renderUiInputSchema.safeParse({
    tree: {
      root: "root",
      elements: { root: { type: "ActionItem", props: {} } },
    },
  });
  assert.equal(result.success, false);
});

test("render_ui schema rejects omitted props for components with required props", () => {
  const result = renderUiInputSchema.safeParse({
    tree: {
      root: "root",
      elements: { root: { type: "ActionItem" } },
    },
  });
  assert.equal(result.success, false);
});

test("render_ui schema rejects behavior fields inside props", () => {
  const result = renderUiInputSchema.safeParse({
    tree: {
      root: "root",
      elements: {
        root: {
          type: "Text",
          props: { content: "Hello", repeat: { statePath: "/items" } },
        },
      },
    },
  });
  assert.equal(result.success, false);
});
