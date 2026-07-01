// Canonical ingestion data contract — the RunRecord shape (and its trigger /
// connector / wiki-vault companions) exchanged between `next` (the client,
// src/lib/ingestion/eve-client.ts) and `impel-ingestion` (the server,
// agent/channels/http.ts). Kept in one place so proxy routes, server
// components, client views, and the backend channel all agree on the wire
// shape.
//
// These are plain TS types (no runtime validation) — ported verbatim from the
// hand-duplicated originals. zod schemas are intentionally NOT added here;
// neither side validates these shapes at runtime today.

export type RunStatus =
  | "running"
  | "trial_open"
  | "merged"
  | "rejected"
  | "failed"
  | "skipped_budget";

export type StageName =
  | "intake"
  | "standardize"
  | "route"
  | "size"
  | "synthesize"
  | "release"
  | "pr";

export type StageStatus = "pending" | "running" | "done" | "failed";

export type GraphNodeStatus = StageStatus | "skipped";

export interface RunGraphNodePosition {
  x: number;
  y: number;
}

export interface RunGraphNode {
  id: string;
  label?: string;
  status?: GraphNodeStatus;
  startedAt?: string;
  completedAt?: string;
  note?: string;
  error?: string;
  kind?: string;
  position?: RunGraphNodePosition;
  progress?: { current: number; total?: number; unit?: string };
  metrics?: Record<string, unknown>;
  outputRefs?: string[];
}

export interface RunGraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  status?: GraphNodeStatus;
  animated?: boolean;
}

export interface RunGraph {
  version?: number;
  nodes: RunGraphNode[];
  edges: RunGraphEdge[];
}

export interface RunSourceMetadata {
  kind?: string;
  operation?: string;
  label?: string;
  provider?: string;
  summary?: Record<string, unknown>;
  url?: string | null;
}

export interface RunOutputMetadata {
  id?: string;
  kind?: string;
  label?: string;
  path?: string | null;
  url?: string | null;
  branch?: string | null;
  status?: string | null;
  metrics?: Record<string, unknown>;
}

export interface RunWorkflowMetadata {
  kind?: string;
  id?: string;
  workflowRunId?: string | null;
  label?: string;
  status?: string | null;
  url?: string | null;
}

// The canonical 7-stage pipeline, in order. Drives the DAG node layout and gives
// the detail view a stable skeleton even before any stage has reported.
export const STAGE_ORDER: StageName[] = [
  "intake",
  "standardize",
  "route",
  "size",
  "synthesize",
  "release",
  "pr",
];

export interface Stage {
  name: StageName;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  note?: string;
}

export interface Section {
  sectionId: string;
  targetPage: string;
  canonicalId: string;
  op: "create" | "update";
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export type InferenceProvider = "claude_code" | "codex";
export type IngestionInferenceStageName = "synthesis" | "verifier";

export interface IngestionInferenceStagePlan {
  stage: IngestionInferenceStageName;
  modelId: string;
  provider: InferenceProvider;
  providerModelId: string;
  ready: boolean;
}

export interface IngestionInferencePlan {
  orgId: string;
  ready: boolean;
  claude: boolean;
  codex: boolean;
  stages: IngestionInferenceStagePlan[];
  providers?: {
    claude_code: boolean;
    codex: boolean;
    both?: boolean;
  };
}

export type ScrapeReportStatus =
  | "idle"
  | "pending"
  | "queued"
  | "preparing"
  | "analyzing"
  | "synthesizing"
  | "committing"
  | "running"
  | "done"
  | "failed";
export type ScrapeReportMode = "run" | "platform";

export interface ScrapeReportMetrics {
  posts: number;
  comments: number;
  chunks: number;
  chunksCompleted: number;
  promptChars: number;
  outputChars: number;
  model: string | null;
  phaseDurationsMs?: Record<string, number>;
}

export interface ScrapeRunSummary {
  platform: string;
  urlsRequested: number;
  postsScraped: number;
  commentsScraped: number;
  newUsers: number;
  skipped: { url: string; reason: string }[];
  campaigns: string[];
  reportStatus?: ScrapeReportStatus;
  reportPath?: string | null;
  reportError?: string | null;
  reportStartedAt?: string | null;
  reportCompletedAt?: string | null;
  reportJobId?: string | null;
  reportWorkflowRunId?: string | null;
  reportMode?: ScrapeReportMode | null;
  reportMetrics?: ScrapeReportMetrics | null;
}

// A routing/splitting decision the backend's confidence judge scored below its
// threshold. The content IS placed and committed — this is a heads-up surfaced
// in the trial PR so a human verifies the placement before merging (place +
// flag, not block). Mirrors the backend run-store `ConfidenceFlag` shape; the
// backend already returns `confidenceFlags` on the run payload and `next`
// deserializes runs with a plain cast, so the data is present at runtime.
export interface ConfidenceFlag {
  kind: "route" | "split";
  canonicalId: string;
  title: string;
  /** Where the content was actually placed. */
  targetPage: string;
  /** Judge's confidence the decision was correct (0..1; 0 if the check failed). */
  confidence: number;
  /** The threshold it fell under, recorded for context. */
  threshold: number;
  reason: string;
}

export interface RunRecord {
  runId: string;
  orgId: string;
  source: string;
  status: RunStatus;
  startedAt: string;
  updatedAt?: string;
  lastHeartbeatAt?: string | null;
  completedAt: string | null;
  attempt?: number;
  parentRunId?: string | null;
  retryable?: boolean;
  restartable?: boolean;
  staleAt?: string | null;
  staleReason?: string | null;
  graph?: RunGraph | null;
  stages: Stage[];
  sourceMetadata?: RunSourceMetadata | null;
  outputs?: RunOutputMetadata[];
  workflowRefs?: RunWorkflowMetadata[];
  sections: Section[];
  model: string | null;
  inferencePlan?: IngestionInferencePlan | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  prUrl: string | null;
  prNumber: number | null;
  branch: string | null;
  workflowRunId: string | null;
  trialPrBody: string | null;
  inputFiles: string[];
  error: string | null;
  scrape?: ScrapeRunSummary | null;
  /** Low-confidence placement flags surfaced for human verification (optional;
   * present on the backend payload but not always populated). */
  confidenceFlags?: ConfidenceFlag[];
}

// A run decorated with next-side overlay fields. NEVER sent or stored by the eve
// backend — `next` merges these onto the mirrored RunRecord at every server read
// boundary so they survive live polling:
//   - `title`: the human-readable name from the run-title overlay store.
//   - `hidden`: true when the run is in the per-org hidden set (hidden-runs
//     store) AND the caller asked to include hidden runs, so the row can render a
//     "restore" affordance. Absent on the default list (hidden runs are filtered
//     out entirely there).
export type RunWithTitle = RunRecord & { title?: string; hidden?: boolean };

export interface RunStreamEvent {
  type: string;
  orgId: string;
  runId: string;
  at: string;
  run?: RunRecord;
  error?: string;
  sectionKey?: string;
  sections?: string[];
  sectionCount?: number;
}

export interface RunsListResponse {
  orgId: string;
  total: number;
  runs: RunRecord[];
}

export interface PreparedIngestionRun {
  runId: string;
  branch: string;
  orgId: string;
  sections: string[];
}

// What the browser is allowed to send when triggering a run. Note: the orgId is
// NEVER taken from the client — the proxy route resolves it from the session.
export interface RunInputFile {
  path: string;
  bytes: string;
  mimeType?: string;
  encoding?: "utf8" | "base64";
}

export interface DriveConfig {
  fileIds?: string[];
  folderIds?: string[];
  max?: number;
}

export interface DriveListItem {
  id: string;
  name: string;
  mimeType: string;
  kind: "file" | "folder";
  supported: boolean;
  reason?: string;
  modifiedTime?: string;
}

export interface DriveListResponse {
  files: DriveListItem[];
  nextPageToken?: string;
}

// The connector kinds the UI knows about. `manual` is always available; the
// rest are gated on their connector being linked (see ConnectorStatus).
export type SourceKind =
  | "manual"
  | "github"
  | "drive"
  | "gmail"
  | "slack"
  | "teams";

export interface TriggerRunBody {
  source?: SourceKind; // was "manual" only
  inputs?: RunInputFile[]; // manual runs: uploaded files (was required)
  config?: Record<string, unknown>; // connector runs: per-source parameters
  model?: string; // optional per-run synthesis model override (UI side-by-side tests)
}

// The org's wiki target, resolved SERVER-SIDE from the per-org Sources selection
// and forwarded to the ingestion backend so it mints a per-org write token. Never
// part of the browser-supplied `TriggerRunBody` — the proxy route injects it.
// Non-secret: the token is minted from `installationId`, never carried here.
export interface WikiVaultDescriptor {
  repoFullName: string; // "owner/repo"
  installationId: string; // GitHub App installation authorizing that repo
  connectorUid?: string; // Vercel Connect GitHub connector that owns the install
  baseBranch?: string; // defaults to "main" backend-side
}

// How a connector is linked. `none` = always available (manual); `app-install`
// = a GitHub-App-style install flow (redirect to an install URL); `user-oauth`
// = Vercel Connect user consent (provisioning-gated, deferred).
export type ConnectorAuthType = "none" | "app-install" | "user-oauth";

// The status of a single connector for the active org, as surfaced to the UI.
export interface ConnectorStatus {
  kind: SourceKind;
  label: string;
  icon: string;
  description: string;
  authType: ConnectorAuthType;
  hasConfig: boolean;
  connected: boolean;
  status: "connected" | "disconnected" | "not_provisioned" | "error";
  reason?: string;
  installationId?: string;
  lastRunAt?: string | null;
}

// The UX buckets the UI renders, derived from the backend status. Labelled by a
// run's lifecycle state (not the reviewer's action) so the three review outcomes
// stay distinct: MERGED (written to the wiki) vs REJECTED (closed → nothing
// written) vs OPEN (trial_open → awaiting a decision).
export type UxState = "IN-FLIGHT" | "OPEN" | "MERGED" | "REJECTED" | "FAILED";

export function uxState(status: RunStatus): UxState {
  switch (status) {
    case "running":
      return "IN-FLIGHT";
    case "trial_open":
      return "OPEN";
    case "merged":
      return "MERGED";
    case "rejected":
      return "REJECTED";
    case "failed":
    case "skipped_budget":
    default:
      return "FAILED";
  }
}
