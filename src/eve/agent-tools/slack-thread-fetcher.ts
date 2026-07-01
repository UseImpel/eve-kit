import { queryWiki, type QueryWikiChunk } from "./query-wiki.js";

/**
 * A Slack message retrieved from a thread, tagged with orgId for observability.
 */
export interface SlackMessage {
  ts: string;
  user: string;
  text: string;
  thread_ts: string;
  orgId: string;
  username?: string;
  timestamp?: string; // ISO format
}

/**
 * Options for fetchSlackThread.
 */
export interface FetchSlackThreadOptions {
  /** Enrich the result with wiki docs via queryWiki. Default: true */
  enrichWithDocs?: boolean;
  /** Include message edits. Default: false */
  includeEdits?: boolean;
  /** Max replies to return. Default: 100 */
  limit?: number;
}

/**
 * Result from fetchSlackThread: messages, thread info, gate decision, and metadata.
 */
export interface FetchSlackThreadResult {
  messages: SlackMessage[];
  threadInfo: {
    channelId: string;
    threadTs: string;
    channelName?: string;
    replyCount: number;
  };
  wikiDocs?: QueryWikiChunk[];
  gate: {
    gated: boolean;
    reason?: string;
  };
  meta: {
    orgId: string;
    strategy: string;
    durationMs: number;
  };
}

/**
 * Resolve an orgId to its Slack API token.
 *
 * Supports environment overrides via SLACK_WORKSPACE_MAPPING_<orgId>.
 * Example: SLACK_WORKSPACE_MAPPING_cfm=xoxb-12345...
 *
 * @param orgId Organization ID (e.g., 'cfm')
 * @returns The Slack API token (xoxb-...)
 * @throws Error if no token is configured for the org
 */
export function resolveSlackToken(orgId: string): string {
  // Try org-specific environment variable first.
  const envKey = `SLACK_WORKSPACE_MAPPING_${orgId}`.toUpperCase();
  const token = process.env[envKey];

  if (token) {
    return token;
  }

  // If no token is found, throw descriptive error.
  throw new Error(
    `No Slack token configured for org ${orgId}. ` +
    `Set environment variable ${envKey} or SLACK_WORKSPACE_TOKEN.`
  );
}

/**
 * Convert a Slack timestamp (unix seconds as string) to ISO 8601 format.
 *
 * @param ts Slack timestamp (e.g., "1234567890.123456")
 * @returns ISO 8601 string, or empty string if invalid
 */
function slackTsToIso(ts: string | undefined): string {
  if (!ts) return "";
  const ms = Number(ts) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

/**
 * Best-effort Slack user ID → display name resolution.
 * Failures degrade gracefully (username stays undefined).
 *
 * @param token Slack API token
 * @param userIds List of user IDs to resolve
 * @returns Map of user ID → display name
 */
async function resolveSlackUserNames(
  token: string,
  userIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();

  // Deduplicate and iterate.
  for (const id of Array.from(new Set(userIds))) {
    try {
      const res = await fetch(
        `https://slack.com/api/users.info?user=${encodeURIComponent(id)}`,
        { headers: { authorization: `Bearer ${token}` } }
      );
      if (!res.ok) continue;

      const j = (await res.json()) as {
        ok: boolean;
        user?: { real_name?: string; name?: string };
      };
      if (j.ok && j.user) {
        names.set(id, j.user.real_name || j.user.name || id);
      }
    } catch {
      // Ignore — fall back to the raw id
    }
  }

  return names;
}

/**
 * Fetch a Slack thread (channel + replies) and enrich with wiki context.
 *
 * Calls the Slack API to fetch thread metadata and all replies. Resolves user
 * IDs to display names (best-effort). Extracts a query from the thread and
 * enriches the result with relevant wiki docs via queryWiki().
 *
 * All results are tagged with orgId for observability. All calls are logged
 * to console (Eve Span context in Phase 2).
 *
 * @param orgId Organization ID (e.g., 'cfm'). Must be a known org.
 * @param channelId Slack channel ID (e.g., 'C123456')
 * @param threadTs Slack thread timestamp (e.g., '1234567890.123456')
 * @param options Optional: { enrichWithDocs, includeEdits, limit }
 * @returns Promise<FetchSlackThreadResult> with messages, threadInfo, wikiDocs, gate, meta
 * @throws Error if orgId is invalid or token resolution fails
 */
export async function fetchSlackThread(
  orgId: string,
  channelId: string,
  threadTs: string,
  options?: FetchSlackThreadOptions
): Promise<FetchSlackThreadResult> {
  const startMs = Date.now();
  const limit = options?.limit ?? 100;
  const enrichWithDocs = options?.enrichWithDocs ?? true;

  try {
    // Validate inputs.
    if (!orgId || !channelId || !threadTs) {
      throw new Error(
        `Invalid inputs: orgId=${orgId}, channelId=${channelId}, threadTs=${threadTs}`
      );
    }

    // Resolve the org's Slack token.
    let token: string;
    try {
      token = resolveSlackToken(orgId);
    } catch (err) {
      const durationMs = Date.now() - startMs;
      console.error(
        `[fetchSlackThread] orgId=${orgId} channelId=${channelId} threadTs=${threadTs} durationMs=${durationMs} error=${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }

    // Call Slack conversations.info to get thread metadata (channel name, etc).
    const infoRes = await fetch(
      `https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!infoRes.ok) {
      throw new Error(
        `Slack API conversations.info returned ${infoRes.status}`
      );
    }

    const infoData = (await infoRes.json()) as {
      ok: boolean;
      error?: string;
      channel?: { id: string; name: string };
    };
    if (!infoData.ok) {
      throw new Error(`Slack API error: ${infoData.error}`);
    }

    const channelName = infoData.channel?.name ?? channelId;

    // Call Slack conversations.replies to fetch all replies.
    const repliesRes = await fetch(
      `https://slack.com/api/conversations.replies?channel=${encodeURIComponent(channelId)}&thread_ts=${encodeURIComponent(threadTs)}&limit=${limit}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!repliesRes.ok) {
      throw new Error(
        `Slack API conversations.replies returned ${repliesRes.status}`
      );
    }

    const repliesData = (await repliesRes.json()) as {
      ok: boolean;
      error?: string;
      messages?: Array<{
        type?: string;
        ts: string;
        user?: string;
        bot_id?: string;
        text?: string;
        thread_ts?: string;
      }>;
    };
    if (!repliesData.ok) {
      throw new Error(`Slack API error: ${repliesData.error}`);
    }

    const replies = repliesData.messages ?? [];

    // Resolve user IDs to display names (best-effort).
    const userIds = replies
      .map((m) => m.user)
      .filter(Boolean) as string[];
    const userNames = await resolveSlackUserNames(token, userIds);

    // Map API responses to SlackMessage[].
    const messages: SlackMessage[] = replies.map((m) => ({
      ts: m.ts,
      user: m.user || m.bot_id || "unknown",
      text: m.text ?? "",
      thread_ts: m.thread_ts ?? threadTs,
      orgId,
      username: m.user ? userNames.get(m.user) : undefined,
      timestamp: slackTsToIso(m.ts),
    }));

    // Extract a query from the thread (first message text, up to 200 chars).
    let query = "";
    if (messages.length > 0) {
      const firstText = messages[0].text ?? "";
      query = firstText
        .replace(/^\s+|\s+$/g, "") // trim
        .replace(/\n/g, " ") // convert newlines to spaces
        .slice(0, 200);
    }

    // Enrich with wiki docs if enabled.
    let wikiDocs: QueryWikiChunk[] | undefined;
    let wikiGateReason: string | undefined;

    if (enrichWithDocs && query) {
      try {
        const wikiResult = await queryWiki(orgId, query, { k: 5 });
        wikiDocs = wikiResult.chunks;
        if (wikiResult.gate.gated) {
          wikiGateReason = wikiResult.gate.reason;
        }
      } catch (err) {
        // queryWiki failures are not fatal; continue with gate decision.
        console.warn(
          `[fetchSlackThread] wiki enrichment failed for orgId=${orgId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Apply gate logic.
    const gated =
      wikiGateReason !== undefined || !wikiDocs || wikiDocs.length === 0;
    const gate = {
      gated,
      reason: gated ? (wikiGateReason ?? "insufficient_wiki_context") : undefined,
    };

    const durationMs = Date.now() - startMs;
    const result: FetchSlackThreadResult = {
      messages,
      threadInfo: {
        channelId,
        threadTs,
        channelName,
        replyCount: replies.length,
      },
      wikiDocs,
      gate,
      meta: {
        orgId,
        strategy: "slack-thread-enriched",
        durationMs,
      },
    };

    // Log for observability.
    console.log(
      `[fetchSlackThread] orgId=${orgId} channelId=${channelId} threadTs=${threadTs} durationMs=${durationMs} gated=${gate.gated} messages=${messages.length}`
    );

    return result;
  } catch (err) {
    // Re-throw critical errors (invalid orgId, severe API failures).
    const durationMs = Date.now() - startMs;
    console.error(
      `[fetchSlackThread] orgId=${orgId} channelId=${channelId} threadTs=${threadTs} durationMs=${durationMs} error=${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  }
}
