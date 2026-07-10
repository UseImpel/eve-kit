import { defineEval } from "eve/evals";
import { z } from "zod";

const marker = "eve-gateway-pilot";
const expectedOutput = { echo: marker, toolExecuted: true } as const;
const outputSchema = z
  .object({
    echo: z.literal(marker),
    toolExecuted: z.literal(true),
  })
  .strict();

export default defineEval({
  description:
    "Exercises an Eve tool loop and structured final_output through the Impel gateway.",
  tags: ["gateway", "pilot"],
  async test(t) {
    const turn = await t.send({
      message: [
        `Acceptance marker: ${marker}.`,
        "Call echo_probe exactly once with that marker.",
        "After its result, call final_output exactly once with the echoed marker and toolExecuted true.",
      ].join(" "),
      outputSchema,
    });

    turn.succeeded();
    turn.calledTool("echo_probe", {
      input: { marker },
      output: { echo: marker },
      count: 1,
    });
    turn.toolOrder(["echo_probe"]);
    turn.maxToolCalls(1);
    turn.noFailedActions();
    turn.outputMatches(outputSchema);
    turn.outputEquals(expectedOutput);

    // Eve intentionally omits its framework-owned final_output call from the
    // action lifecycle. result.completed is the observable success contract.
    turn.event("result.completed", {
      data: { result: expectedOutput },
      count: 1,
    });
    turn.eventOrder([
      { type: "actions.requested" },
      { type: "action.result" },
      { type: "result.completed", data: { result: expectedOutput } },
    ]);
  },
});
