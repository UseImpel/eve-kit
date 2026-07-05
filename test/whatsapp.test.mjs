import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderWhatsAppMarkdown,
  splitWhatsAppMessage,
  decodeHitlButtonId,
  whatsappChannel,
} from "../dist/eve/whatsapp/index.js";

test("renders Markdown as WhatsApp inline format", () => {
  assert.equal(
    renderWhatsAppMarkdown(
      "# Schedule\n**Tue, Jun 30** at *noon*\nUse `code` and ~~old~~.\n```js\nif (a<b) return a;\n```",
    ),
    [
      "*Schedule*",
      "*Tue, Jun 30* at _noon_",
      "Use `code` and ~old~.",
      "```if (a<b) return a;```",
    ].join("\n"),
  );
});

test("bold is asterisk, italic is underscore (no collision)", () => {
  assert.equal(renderWhatsAppMarkdown("**bold** and *italic*"), "*bold* and _italic_");
  assert.equal(renderWhatsAppMarkdown("__bold__ too"), "*bold* too");
});

test("splits long messages under the 4096 cap", () => {
  assert.deepEqual(splitWhatsAppMessage("short"), ["short"]);
  const long = "a".repeat(9000);
  const chunks = splitWhatsAppMessage(long);
  assert.equal(chunks.length, 3);
  for (const chunk of chunks) assert.ok(chunk.length <= 4096);
});

test("decodes HITL button ids and rejects foreign ids", () => {
  assert.deepEqual(decodeHitlButtonId("eve:req-1:approve"), {
    requestId: "req-1",
    optionId: "approve",
  });
  assert.equal(decodeHitlButtonId("chat:whatever"), null);
  assert.equal(decodeHitlButtonId(undefined), null);
});

// --- Drive the channel's webhook route end to end with a fake fetch --------

function findPostRoute(channel, path) {
  const route = channel.routes.find((r) => r.method === "POST" && r.path === path);
  assert.ok(route, `expected POST ${path}`);
  return route;
}

function webhook(body, url = "https://agent.example/eve/v1/whatsapp") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function textInbound(overrides = {}) {
  return {
    messages: [
      {
        id: "m1",
        from_me: false,
        type: "text",
        chat_id: "14155550123@s.whatsapp.net",
        timestamp: 1751700000,
        from: "14155550123",
        from_name: "Rahul",
        text: { body: "hello" },
        ...overrides,
      },
    ],
    channel_id: "CH-1",
  };
}

async function fireWebhook(channel, route, request) {
  const sends = [];
  const tasks = [];
  const response = await route.handler(request, {
    send: async (input, options) => {
      sends.push({ input, options });
      return { id: "s1", continuationToken: options.continuationToken };
    },
    getSession: async () => null,
    receive: async () => null,
    params: {},
    waitUntil: (task) => tasks.push(task),
    requestIp: null,
  });
  await Promise.allSettled(tasks);
  return { response, sends };
}

test("dispatches a user message through onMessage with the chat continuation token", async () => {
  const channel = whatsappChannel({
    token: "t",
    channelId: "CH-1",
    fetch: async () => new Response("{}", { status: 200 }),
    onMessage: (_ctx, message) => ({
      auth: { authenticator: "test", principalId: message.from, principalType: "user", attributes: {} },
    }),
  });
  const route = findPostRoute(channel, "/eve/v1/whatsapp");
  const { response, sends } = await fireWebhook(channel, route, webhook(textInbound()));

  assert.equal(response.status, 200);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].options.continuationToken, "14155550123@s.whatsapp.net");
  assert.equal(sends[0].input.message, "hello");
  assert.equal(sends[0].options.auth.principalId, "14155550123");
});

test("ignores echoes of our own sends (from_me)", async () => {
  const channel = whatsappChannel({
    token: "t",
    channelId: "CH-1",
    fetch: async () => new Response("{}", { status: 200 }),
    onMessage: () => ({ auth: null }),
  });
  const route = findPostRoute(channel, "/eve/v1/whatsapp");
  const { sends } = await fireWebhook(channel, route, webhook(textInbound({ from_me: true })));
  assert.equal(sends.length, 0);
});

test("button reply resumes the pending HITL turn via inputResponses", async () => {
  const channel = whatsappChannel({
    token: "t",
    channelId: "CH-1",
    fetch: async () => new Response("{}", { status: 200 }),
    onMessage: () => ({ auth: null }),
  });
  const route = findPostRoute(channel, "/eve/v1/whatsapp");
  const { sends } = await fireWebhook(
    channel,
    route,
    webhook(
      textInbound({
        type: "reply",
        text: undefined,
        reply: { type: "buttons_reply", buttons_reply: { id: "eve:req-9:yes", title: "Yes" } },
      }),
    ),
  );
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0].input.inputResponses, [{ requestId: "req-9", optionId: "yes" }]);
});

test("rejects webhooks with a wrong/missing secret and accepts the right one", async () => {
  const channel = whatsappChannel({
    token: "t",
    channelId: "CH-1",
    webhookSecret: "s3cret",
    fetch: async () => new Response("{}", { status: 200 }),
    onMessage: () => ({ auth: null }),
  });
  const route = findPostRoute(channel, "/eve/v1/whatsapp");

  const denied = await fireWebhook(channel, route, webhook(textInbound()));
  assert.equal(denied.response.status, 401);

  const okQuery = await fireWebhook(
    channel,
    route,
    webhook(textInbound(), "https://agent.example/eve/v1/whatsapp?secret=s3cret"),
  );
  assert.equal(okQuery.response.status, 200);
});
