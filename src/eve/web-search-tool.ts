// Shared `web_search` override for Eve agents.
//
// Eve's built-in `web_search` is a provider tool with no local executor here, so
// this override supplies a real xAI-backed search that returns resolvable result
// URLs plus a synthesis.
import { xai } from "@ai-sdk/xai";
import { generateText, isStepCount, type ToolSet } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";

const SEARCH_TIMEOUT_MS = 90_000;

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "A specific, natural-language web search query. Returns real result URLs and a source-backed synthesis; read those, never guess or construct a URL.",
    ),
  allowedDomains: z
    .array(z.string().min(1))
    .max(10)
    .optional()
    .describe("Restrict results to these domains, e.g. ['developers.hubspot.com']."),
  excludedDomains: z
    .array(z.string().min(1))
    .max(10)
    .optional()
    .describe("Exclude these domains."),
  modelId: z
    .string()
    .optional()
    .describe(
      "Override the xAI model. Defaults to XAI_SEARCH_MODEL_ID / XAI_SOCIAL_MODEL_ID / grok-4.20-non-reasoning.",
    ),
});

const outputSchema = z.object({
  modelId: z.string(),
  summary: z.string(),
  sources: z.array(z.unknown()),
  notes: z.array(z.string()),
});

const jsonSafe = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export default defineTool({
  description:
    "Search the live web and return REAL, resolvable result URLs plus a source-backed synthesis. Use this FIRST to find genuine sources; never guess, construct, or fabricate a URL. After searching, read the synthesis or web_fetch a URL that actually appears in `sources`. Backed by xAI web search; requires XAI_API_KEY.",
  inputSchema,
  outputSchema,
  async execute(input) {
    const modelId =
      input.modelId?.trim() ||
      process.env.XAI_SEARCH_MODEL_ID?.trim() ||
      process.env.XAI_SOCIAL_MODEL_ID?.trim() ||
      "grok-4.20-non-reasoning";

    try {
      const result = await generateText({
        model: xai.responses(modelId as Parameters<typeof xai.responses>[0]),
        prompt: [
          "Search the web and answer this with primary sources:",
          input.query,
          "",
          "Return:",
          "1. A concise, source-backed synthesis of what the top sources say.",
          "2. The specific source URLs you actually used - real, resolvable links - each with a one-line note on what it contains (and its date if relevant).",
          "Prefer official/primary sources (official docs, API references, standards, source repositories, changelogs). Never invent or guess a URL.",
        ].join("\n"),
        maxOutputTokens: 6000,
        stopWhen: isStepCount(6),
        abortSignal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        tools: {
          web_search: xai.tools.webSearch({
            allowedDomains: input.allowedDomains,
            excludedDomains: input.excludedDomains,
          }),
        } as unknown as ToolSet,
        providerOptions: {
          xai: {
            store: false,
          },
        },
      });

      return {
        modelId,
        summary: result.text,
        sources: jsonSafe(result.sources ?? []) as unknown[],
        notes: [
          "URLs in `sources` are real search results; fetch only those, never a constructed or guessed URL.",
          "Cross-check material claims against the primary source (official docs, API reference, source code) before final synthesis.",
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        modelId,
        summary:
          "web_search did not complete (aborted after " +
          Math.round(SEARCH_TIMEOUT_MS / 1000) +
          "s or failed: " +
          message +
          "). Do not stall or guess a URL; narrow the query and try again, or proceed with the sources you already have.",
        sources: [],
        notes: [
          "The search was aborted after a timeout to avoid stalling the run. Retry with a more specific query or move on with existing evidence.",
        ],
      };
    }
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        modelId: output.modelId,
        summary: output.summary,
        sources: output.sources,
        notes: output.notes,
      },
    };
  },
});
