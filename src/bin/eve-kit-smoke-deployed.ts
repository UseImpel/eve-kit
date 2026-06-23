#!/usr/bin/env node
import {
  ImpelRuntimeSmokeError,
  smokeDeployedRuntime,
} from "../eve/runtime.js";

const baseUrl = (process.argv[2] ?? process.env.EVE_APP_URL ?? "").replace(
  /\/$/,
  "",
);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(
    "Usage: EVE_APP_URL=https://... eve-kit-smoke-deployed\n" +
      "Optional env: EVE_APP_BASIC_USER, EVE_APP_BASIC_PASSWORD, " +
      "EVE_SMOKE_MESSAGE, EVE_SMOKE_CLIENT_CONTEXT, EVE_SMOKE_TIMEOUT_MS, " +
      "EVE_SMOKE_SUCCESS_ON_TEXT=true",
  );
  process.exit(0);
}

if (!baseUrl) {
  console.error("[smoke] Usage: EVE_APP_URL=https://... eve-kit-smoke-deployed");
  process.exit(1);
}

let clientContext: unknown;
if (process.env.EVE_SMOKE_CLIENT_CONTEXT) {
  try {
    clientContext = JSON.parse(process.env.EVE_SMOKE_CLIENT_CONTEXT);
  } catch (error) {
    console.error(`[smoke] EVE_SMOKE_CLIENT_CONTEXT is not JSON: ${error}`);
    process.exit(1);
  }
}

try {
  const result = await smokeDeployedRuntime({
    baseUrl,
    message: process.env.EVE_SMOKE_MESSAGE ?? "Reply briefly: ready.",
    clientContext,
    timeoutMs: Number(process.env.EVE_SMOKE_TIMEOUT_MS ?? 120000),
    successOnText: process.env.EVE_SMOKE_SUCCESS_ON_TEXT === "true",
    log: console.log,
  });
  console.log(
    `[smoke] ok sessionId=${result.sessionId} events=${result.eventCount} textBytes=${result.textBytes} completed=${result.completed}`,
  );
} catch (error) {
  const message =
    error instanceof ImpelRuntimeSmokeError || error instanceof Error
      ? error.message
      : String(error);
  console.error(`[smoke] ${message}`);
  process.exit(1);
}
