import { defineTool } from "eve/tools";
import { z } from "zod";

const echoOutputSchema = z.object({ receipt: z.string().uuid() }).strict();

export default defineTool({
  description:
    "Generate a one-time acceptance receipt. The receipt exists only after this tool executes.",
  inputSchema: z.object({}).strict(),
  outputSchema: echoOutputSchema,
  execute() {
    return { receipt: crypto.randomUUID() };
  },
});
