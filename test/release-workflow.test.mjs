import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("publish workflow blocks tag/version mismatch and every kind of dist drift", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/publish.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /EXPECTED_TAG="v\$VERSION"/);
  assert.match(workflow, /if \[ "\$TAG" != "\$EXPECTED_TAG" \]; then/);
  assert.match(workflow, /tag\/version mismatch/);
  assert.match(
    workflow,
    /rm -rf dist[\s\S]*?npm run check[\s\S]*?chmod \+x dist\/bin\/eve-kit-smoke-deployed\.js/,
  );
  assert.match(
    workflow,
    /git status --porcelain --untracked-files=all -- dist/,
  );
  assert.match(workflow, /git diff --stat -- dist/);
  assert.match(workflow, /git diff -- dist/);
  assert.match(workflow, /dist drift[\s\S]*?exit 1/);
  assert.doesNotMatch(workflow, /git diff --quiet -- dist/);

  const metadataGuard = workflow.indexOf(
    "- name: Resolve and verify release metadata",
  );
  const distGuard = workflow.indexOf(
    "- name: Verify committed dist/ matches a fresh build",
  );
  const executableNormalization = workflow.indexOf(
    "chmod +x dist/bin/eve-kit-smoke-deployed.js",
  );
  const release = workflow.indexOf("- name: Create GitHub Release");
  assert.ok(metadataGuard >= 0 && metadataGuard < release);
  assert.ok(
    executableNormalization >= 0 && executableNormalization < distGuard,
  );
  assert.ok(distGuard >= 0 && distGuard < release);
  assert.doesNotMatch(workflow, /::warning title=dist drift/);
});
