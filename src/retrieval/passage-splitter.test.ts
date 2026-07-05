import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPassages } from "./passage-splitter.js";

test("splitPassages: empty content returns empty array", () => {
  assert.deepEqual(splitPassages(""), []);
  assert.deepEqual(splitPassages("   "), []);
  assert.deepEqual(splitPassages("\n\n\n"), []);
});

test("splitPassages: single paragraph", () => {
  const result = splitPassages("Hello world");
  assert.deepEqual(result, ["Hello world"]);
});

test("splitPassages: multiple paragraphs combined if under limit", () => {
  const content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
  const result = splitPassages(content, 1000);
  // All should fit under 1000 chars
  assert.equal(result.length, 1);
  assert.equal(result[0], "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
});

test("splitPassages: breaks on max length boundary", () => {
  const content = "A".repeat(300) + "\n\n" + "B".repeat(300);
  const result = splitPassages(content, 500);
  // Should split into two passages
  assert.equal(result.length, 2);
  assert.equal(result[0], "A".repeat(300));
  assert.equal(result[1], "B".repeat(300));
});

test("splitPassages: keeps long paragraphs intact", () => {
  const longPara = "Long paragraph. ".repeat(100); // > 500 chars
  const content = longPara + "\n\nShort para.";
  const result = splitPassages(content, 500);
  assert.equal(result.length, 2);
  assert.equal(result[0], longPara.trim());
  assert.equal(result[1], "Short para.");
});

test("splitPassages: normalizes whitespace between paragraphs", () => {
  const content = "Para 1.\n\n\n\nPara 2.";
  const result = splitPassages(content, 1000);
  assert.equal(result.length, 1);
  assert.equal(result[0], "Para 1.\n\nPara 2.");
});
