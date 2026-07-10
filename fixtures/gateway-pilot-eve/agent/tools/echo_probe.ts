import { defineTool } from "eve/tools";
import { z } from "zod";

const echoOutputSchema = z.object({ echo: z.string().min(1) }).strict();

export default defineTool({
  description: "Echo one acceptance-test marker without external side effects.",
  inputSchema: z.object({ marker: z.string().min(1) }).strict(),
  outputSchema: echoOutputSchema,
  execute({ marker }) {
    return { echo: marker };
  },
});
