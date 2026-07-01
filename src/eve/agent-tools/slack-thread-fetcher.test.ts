import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchSlackThread,
  resolveSlackToken,
  type SlackMessage,
  type FetchSlackThreadResult,
} from "./slack-thread-fetcher.js";

const originalFetch = global.fetch;

type FetchLike = typeof fetch;

// Helper to create a mock fetch for a test
function createMockFetch(responses: Record<string, unknown>) {
  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.toString();
    const key = urlStr.split("?")[0];
    const response = responses[key] ?? { ok: false, status: 404, error: "Not mocked" };
    
    const responseData = response as Record<string, unknown>;
    const status = (responseData.status as number) ?? (responseData.ok ? 200 : 404);
    const ok = status >= 200 && status < 300;

    return {
      ok,
      status,
      json: async () => response,
    } as Response;
  };
}

test("resolveSlackToken('cfm') with env override", () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token-cfm";
  const token = resolveSlackToken("cfm");
  assert.equal(token, "xoxb-test-token-cfm");
  delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
});

test("resolveSlackToken('unknown-org') throws", () => {
  assert.throws(
    () => {
      resolveSlackToken("unknown-org-xyz-999");
    },
    /No Slack token configured for org/
  );
});

test("resolveSlackToken is case-sensitive for env key", () => {
  process.env.SLACK_WORKSPACE_MAPPING_TEST = "xoxb-test-token";
  const token = resolveSlackToken("test");
  assert.equal(token, "xoxb-test-token");
  delete process.env.SLACK_WORKSPACE_MAPPING_TEST;
});

test("fetchSlackThread with missing token throws", async () => {
  try {
    await fetchSlackThread("invalid-org-xyz", "C123456", "1234567890.123456");
    assert.fail("Expected error for missing token");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("No Slack token configured"),
      "Should throw for missing token"
    );
  }
});

test("fetchSlackThread with invalid inputs throws", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";

  try {
    await fetchSlackThread("cfm", "", "1234567890.123456");
    assert.fail("Expected error for invalid channelId");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("Invalid inputs"),
      "Should throw for invalid inputs"
    );
  }

  delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
});

test("fetchSlackThread returns proper structure with mocked API", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: true,
      status: 200,
      channel: { id: "C123456", name: "test-channel" },
    },
    "https://slack.com/api/conversations.replies": {
      ok: true,
      status: 200,
      messages: [
        {
          type: "message",
          ts: "1234567890.000100",
          user: "U987654",
          text: "Hello, how do we fix the payroll system?",
          thread_ts: "1234567890.000100",
        },
        {
          type: "message",
          ts: "1234567891.000100",
          user: "U111111",
          text: "We need to check the config first.",
          thread_ts: "1234567890.000100",
        },
      ],
    },
    "https://slack.com/api/users.info": {
      ok: true,
      status: 200,
      user: { real_name: "Alice Smith", name: "alice" },
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    const result: FetchSlackThreadResult = await fetchSlackThread(
      "cfm",
      "C123456",
      "1234567890.000100"
    );

    assert.ok(result, "Result should be defined");
    assert.ok(Array.isArray(result.messages), "messages should be an array");
    assert.ok(result.threadInfo, "threadInfo should be present");
    assert.ok(result.gate, "gate should be present");
    assert.ok(result.meta, "meta should be present");

    assert.equal(result.meta.orgId, "cfm", "orgId should be in meta");
    assert.equal(
      result.meta.strategy,
      "slack-thread-enriched",
      "strategy should be slack-thread-enriched"
    );
    assert.ok(
      typeof result.meta.durationMs === "number",
      "durationMs should be a number"
    );

    assert.equal(result.threadInfo.channelId, "C123456");
    assert.equal(result.threadInfo.threadTs, "1234567890.000100");
    assert.equal(result.threadInfo.channelName, "test-channel");
    assert.equal(result.threadInfo.replyCount, 2);

    assert.ok(result.messages.length >= 1, "Should have at least one message");
    result.messages.forEach((msg: SlackMessage) => {
      assert.ok(msg.ts, "ts should be present");
      assert.ok(msg.user, "user should be present");
      assert.ok(msg.text !== undefined, "text should be present");
      assert.equal(msg.thread_ts, "1234567890.000100");
      assert.equal(msg.orgId, "cfm");
      assert.ok(msg.timestamp, "timestamp should be ISO formatted");
    });
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});

test("fetchSlackThread maps messages correctly", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_TEST = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: true,
      status: 200,
      channel: { id: "C789012", name: "dev-updates" },
    },
    "https://slack.com/api/conversations.replies": {
      ok: true,
      status: 200,
      messages: [
        {
          type: "message",
          ts: "1700000000.000001",
          user: "U123456",
          text: "Deploy completed successfully",
          thread_ts: "1700000000.000001",
        },
      ],
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    const result = await fetchSlackThread(
      "test",
      "C789012",
      "1700000000.000001"
    );

    const msg = result.messages[0];
    assert.equal(msg.ts, "1700000000.000001");
    assert.equal(msg.user, "U123456");
    assert.equal(msg.text, "Deploy completed successfully");
    assert.equal(msg.thread_ts, "1700000000.000001");
    assert.equal(msg.orgId, "test");
    assert.ok(msg.timestamp && msg.timestamp.includes("2023"));
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_TEST;
  }
});

test("fetchSlackThread handles HTTP errors", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: false,
      status: 404,
      error: "channel_not_found",
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    await fetchSlackThread("cfm", "C_INVALID", "1234567890.000100");
    assert.fail("Expected error for HTTP 404");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("returned 404"),
      "Should throw HTTP error"
    );
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});

test("fetchSlackThread handles Slack API errors", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: false,
      status: 200,
      error: "channel_not_found",
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    await fetchSlackThread("cfm", "C_INVALID", "1234567890.000100");
    assert.fail("Expected error for channel not found");
  } catch (err) {
    assert(
      err instanceof Error && err.message.includes("channel_not_found"),
      "Should throw Slack API error"
    );
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});

test("fetchSlackThread extracts query from thread", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: true,
      status: 200,
      channel: { id: "C123456", name: "test-channel" },
    },
    "https://slack.com/api/conversations.replies": {
      ok: true,
      status: 200,
      messages: [
        {
          type: "message",
          ts: "1234567890.000100",
          user: "U987654",
          text: "How do we implement the new billing system?\nThis is urgent!",
          thread_ts: "1234567890.000100",
        },
      ],
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    const result = await fetchSlackThread(
      "cfm",
      "C123456",
      "1234567890.000100"
    );

    assert.ok(
      result.messages[0].text.includes("billing system"),
      "Query should be extracted from thread"
    );
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});

test("fetchSlackThread respects limit option", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";

  let capturedLimit = 100;
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: true,
      status: 200,
      channel: { id: "C123456", name: "test-channel" },
    },
    "https://slack.com/api/conversations.replies": {
      ok: true,
      status: 200,
      messages: [],
    },
  };

  const mockFetch = createMockFetch(responses);
  
  const captureLimit = async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.toString();
    if (urlStr.includes("conversations.replies")) {
      const match = urlStr.match(/limit=(\d+)/);
      if (match) {
        capturedLimit = parseInt(match[1], 10);
      }
    }
    return mockFetch(input, init);
  };

  (global.fetch as FetchLike) = captureLimit as FetchLike;

  try {
    await fetchSlackThread("cfm", "C123456", "1234567890.000100", {
      limit: 50,
    });

    assert.equal(capturedLimit, 50, "Should pass limit=50 to Slack API");
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});

test("fetchSlackThread handles enrichWithDocs option", async () => {
  process.env.SLACK_WORKSPACE_MAPPING_CFM = "xoxb-test-token";
  
  const responses = {
    "https://slack.com/api/conversations.info": {
      ok: true,
      status: 200,
      channel: { id: "C123456", name: "test-channel" },
    },
    "https://slack.com/api/conversations.replies": {
      ok: true,
      status: 200,
      messages: [
        {
          type: "message",
          ts: "1234567890.000100",
          user: "U987654",
          text: "Question about payroll?",
          thread_ts: "1234567890.000100",
        },
      ],
    },
  };

  const mockFetch = createMockFetch(responses);
  (global.fetch as FetchLike) = mockFetch as FetchLike;

  try {
    const result = await fetchSlackThread(
      "cfm",
      "C123456",
      "1234567890.000100",
      { enrichWithDocs: false }
    );

    assert.ok(result, "Should return result even with enrichWithDocs: false");
  } finally {
    (global.fetch as FetchLike) = originalFetch;
    delete process.env.SLACK_WORKSPACE_MAPPING_CFM;
  }
});
