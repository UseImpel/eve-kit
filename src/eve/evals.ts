import { defineEval, defineEvalConfig } from "eve/evals";
import { Braintrust } from "eve/evals/reporters";

export interface ImpelEvalConfigOptions {
  defaultAgentId: string;
  defaultProjectName?: string;
  defaultExperimentSuffix?: string;
}

export interface ImpelSmokeEvalOptions {
  defaultAgentId: string;
  defaultOrgId: string;
  defaultAgentVersion?: number;
  defaultAgentDigest?: string;
  message?: string;
}

export function createImpelBraintrustEvalConfig({
  defaultAgentId,
  defaultProjectName = "Impel",
  defaultExperimentSuffix = "smoke-v1",
}: ImpelEvalConfigOptions) {
  const agentId = process.env.IMPEL_AGENT_ID ?? defaultAgentId;
  const impelBraintrustReporter = Braintrust({
    projectName: process.env.BRAINTRUST_PROJECT_NAME ?? defaultProjectName,
    experimentName:
      process.env.BRAINTRUST_EXPERIMENT_NAME ??
      `${agentId}/${defaultExperimentSuffix}`,
    update: process.env.BRAINTRUST_EXPERIMENT_UPDATE === "true",
  });

  return defineEvalConfig({
    reporters: [impelBraintrustReporter],
  });
}

export function createImpelSmokeEval({
  defaultAgentId,
  defaultOrgId,
  defaultAgentVersion,
  defaultAgentDigest = "",
  message = "Reply briefly: ready.",
}: ImpelSmokeEvalOptions) {
  const agentId = process.env.IMPEL_AGENT_ID ?? defaultAgentId;
  const orgId = process.env.IMPEL_ORG_ID ?? defaultOrgId;
  const rawAgentVersion =
    process.env.IMPEL_AGENT_VERSION ??
    (defaultAgentVersion == null ? "" : String(defaultAgentVersion));
  const parsedAgentVersion = rawAgentVersion
    ? Number(rawAgentVersion)
    : Number.NaN;
  const agentDigest = process.env.IMPEL_AGENT_DIGEST ?? defaultAgentDigest;
  const metadata = {
    agentId,
    orgId,
    ...(Number.isFinite(parsedAgentVersion)
      ? { agentVersion: parsedAgentVersion }
      : {}),
    ...(agentDigest ? { agentDigest } : {}),
  };

  return defineEval({
    description:
      "Smoke test that the agent accepts a basic request and completes.",
    tags: ["smoke", `agent:${agentId}`, `org:${orgId}`],
    metadata,
    async test(t) {
      await t.send(message);
      t.didNotFail();
      t.completed();
    },
  });
}
