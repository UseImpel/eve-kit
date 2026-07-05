export type RunStatus = "running" | "trial_open" | "merged" | "rejected" | "failed" | "skipped_budget";
export type StageName = "intake" | "standardize" | "route" | "size" | "synthesize" | "release" | "pr";
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
    progress?: {
        current: number;
        total?: number;
        unit?: string;
    };
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
export declare const STAGE_ORDER: StageName[];
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
export type ScrapeReportStatus = "idle" | "pending" | "queued" | "preparing" | "analyzing" | "synthesizing" | "committing" | "running" | "done" | "failed";
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
    skipped: {
        url: string;
        reason: string;
    }[];
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
export interface ConfidenceFlag {
    kind: "route" | "split";
    canonicalId: string;
    title: string;
    /** Where the content was actually placed. */
    targetPage: string;
    /** The plan key (sectionKey) this flag can be re-synthesized with. */
    sectionKey: string;
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
export type RunWithTitle = RunRecord & {
    title?: string;
    hidden?: boolean;
};
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
export type SourceKind = "manual" | "github" | "drive" | "gmail" | "slack" | "teams";
export interface TriggerRunBody {
    source?: SourceKind;
    inputs?: RunInputFile[];
    config?: Record<string, unknown>;
    model?: string;
}
export interface WikiVaultDescriptor {
    repoFullName: string;
    installationId: string;
    connectorUid?: string;
    baseBranch?: string;
}
export type ConnectorAuthType = "none" | "app-install" | "user-oauth";
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
export type UxState = "IN-FLIGHT" | "OPEN" | "MERGED" | "REJECTED" | "FAILED";
export declare function uxState(status: RunStatus): UxState;
//# sourceMappingURL=ingestion.d.ts.map