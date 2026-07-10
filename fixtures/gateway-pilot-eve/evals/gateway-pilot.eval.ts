import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { z } from "zod";

const probeOutputSchema = z.object({ receipt: z.string().uuid() }).strict();
const outputSchema = z
  .object({
    receipt: z.string().uuid(),
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
        "Run the gateway acceptance probe.",
        "Call echo_probe exactly once with an empty object.",
        "Only after its result, call final_output exactly once with that exact receipt and toolExecuted true.",
        "The receipt is not present in this request and must not be invented.",
      ].join(" "),
      outputSchema,
    });

    turn.succeeded();
    const call = turn.requireToolCall("echo_probe", {
      input: {},
      output: (value) => probeOutputSchema.safeParse(value).success,
      status: "completed",
    });
    const probeOutput = probeOutputSchema.parse(call.output);
    turn.toolOrder(["echo_probe"]);
    turn.maxToolCalls(1);
    turn.noFailedActions();
    turn.outputMatches(outputSchema);
    t.check(
      turn.data,
      satisfies(
        (value) =>
          outputSchema.safeParse(value).success &&
          (value as { receipt: string }).receipt === probeOutput.receipt,
        "final output carries the exact tool-generated receipt",
      ),
    );

    // Eve intentionally omits its framework-owned final_output call from the
    // action lifecycle. result.completed is the observable success contract.
    turn.event("result.completed", {
      count: 1,
    });
    turn.eventOrder([
      { type: "actions.requested" },
      { type: "action.result" },
      { type: "result.completed" },
    ]);
  },
});
