import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../dist", import.meta.url));
const target = fileURLToPath(
  new URL("../fixtures/gateway-pilot-eve/vendor/eve-kit", import.meta.url),
);
const generatedPaths = [
  "../fixtures/gateway-pilot-eve/.eve",
  "../fixtures/gateway-pilot-eve/.output",
  "../fixtures/gateway-pilot-eve/.vercel/output",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

await Promise.all(
  [target, ...generatedPaths].map((path) =>
    rm(path, { force: true, recursive: true }),
  ),
);
await cp(source, target, { recursive: true });

console.log("Prepared the gateway Eve pilot with the built dist/ tree.");
