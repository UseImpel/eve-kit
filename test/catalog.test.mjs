import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  EVE_KIT_PROVIDERS,
  getEveKitProvider,
  listEveKitProviders,
} from "../dist/eve/catalog.js";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
);

function exportSubpath(importPath) {
  assert.ok(
    importPath === pkg.name || importPath.startsWith(`${pkg.name}/`),
    `importPath must start with ${pkg.name}: ${importPath}`,
  );
  return importPath === pkg.name ? "." : `.${importPath.slice(pkg.name.length)}`;
}

test("catalog is non-empty and exposed from the ./eve barrel", async () => {
  assert.ok(EVE_KIT_PROVIDERS.length > 0);
  const barrel = await import("../dist/eve/index.js");
  assert.equal(barrel.EVE_KIT_PROVIDERS, EVE_KIT_PROVIDERS);
  assert.equal(typeof barrel.whatsappChannel, "function");
});

test("every provider importPath maps to a package.json exports subpath", () => {
  for (const provider of EVE_KIT_PROVIDERS) {
    const subpath = exportSubpath(provider.importPath);
    assert.ok(
      Object.hasOwn(pkg.exports, subpath),
      `${provider.id}: no exports entry for ${subpath} (${provider.importPath})`,
    );
  }
});

test("provider ids are unique", () => {
  const ids = EVE_KIT_PROVIDERS.map((provider) => provider.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("channel providers declare a channelKind", () => {
  for (const provider of EVE_KIT_PROVIDERS) {
    if (provider.kind !== "channel") continue;
    assert.ok(
      typeof provider.channelKind === "string" && provider.channelKind.length > 0,
      `${provider.id}: channel provider missing channelKind`,
    );
  }
});

test("lookup helpers filter and find providers", () => {
  assert.equal(getEveKitProvider("whatsapp-channel")?.exportName, "whatsappChannel");
  assert.equal(getEveKitProvider("whatsapp-channel")?.sinceVersion, "0.2.45");
  assert.equal(getEveKitProvider("nope"), undefined);
  assert.equal(listEveKitProviders().length, EVE_KIT_PROVIDERS.length);
  const channels = listEveKitProviders("channel");
  assert.ok(channels.length > 0);
  assert.ok(channels.every((provider) => provider.kind === "channel"));
});
