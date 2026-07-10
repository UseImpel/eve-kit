import { defineAgent } from "eve";

import { impelGatewayModel } from "../vendor/eve-kit/index.js";

export default defineAgent({
  model: impelGatewayModel(
    process.env.IMPEL_PILOT_MODEL_ID ?? "claude-sonnet-4-6",
  ),
  modelContextWindowTokens: 200_000,
});
