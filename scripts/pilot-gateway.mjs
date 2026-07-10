import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { impelGatewayModel } from "../dist/index.js";

const gatewayUrl = process.env.IMPEL_GATEWAY_URL?.trim();
const gatewayToken = process.env.IMPEL_GATEWAY_TOKEN?.trim();
const modelId = process.env.IMPEL_PILOT_MODEL_ID?.trim() || "claude-haiku-4-5";

if (!gatewayUrl || !gatewayToken) {
  console.error(
    "Gateway pilot requires IMPEL_GATEWAY_URL and IMPEL_GATEWAY_TOKEN. The token is never printed.",
  );
  process.exit(2);
}

let toolResult;
const agent = new ToolLoopAgent({
  model: impelGatewayModel(modelId, { gatewayUrl }),
  tools: {
    multiply: tool({
      description: "Multiply two integers.",
      inputSchema: z.object({ left: z.number().int(), right: z.number().int() }),
      execute: async ({ left, right }) => {
        toolResult = left * right;
        return { product: toolResult };
      },
    }),
    final_output: tool({
      description: "Return the final structured pilot result.",
      inputSchema: z.object({
        product: z.number().int(),
        toolExecuted: z.literal(true),
      }),
    }),
  },
});

try {
  const result = await agent.generate({
    prompt:
      "This is a deterministic gateway pilot. First call multiply with left=6 and right=7. After receiving the tool result, call final_output with product=42 and toolExecuted=true. Do not answer in plain text.",
  });
  const finalOutput = result.toolCalls.find(
    (toolCall) => toolCall.toolName === "final_output",
  );
  if (toolResult !== 42 || !finalOutput) {
    throw new Error("The caller-owned tool loop did not produce final_output.");
  }
  const structured = finalOutput.input;
  if (structured.product !== 42 || structured.toolExecuted !== true) {
    throw new Error("The structured final_output payload was invalid.");
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      model: modelId,
      toolExecuted: true,
      structuredOutput: structured,
    })}\n`,
  );
} catch (error) {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "Gateway pilot failed";
  console.error(`${name}: ${message}`);
  process.exit(1);
}
