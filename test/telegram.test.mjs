import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTelegramMarkdownSendMessageBody,
  renderTelegramMarkdownAsHtml,
  sendTelegramMarkdownReply,
} from "../dist/eve/telegram.js";

test("renders limited Markdown as Telegram HTML", () => {
  assert.equal(
    renderTelegramMarkdownAsHtml(
      "# Schedule\n**Tue, Jun 30**\n**12:30 PM-1:30 PM** Lunch & learn <now>\nUse `code`.\n```js\nif (a < b) return a & b;\n```",
    ),
    [
      "<b>Schedule</b>",
      "<b>Tue, Jun 30</b>",
      "<b>12:30 PM-1:30 PM</b> Lunch &amp; learn &lt;now&gt;",
      "Use <code>code</code>.",
      "<pre>if (a &lt; b) return a &amp; b;</pre>",
    ].join("\n"),
  );
});

test("creates Telegram HTML sendMessage body", () => {
  assert.deepEqual(
    createTelegramMarkdownSendMessageBody(
      { chatId: 123, messageThreadId: 456 },
      "**Hello**",
    ),
    {
      chat_id: 123,
      message_thread_id: 456,
      parse_mode: "HTML",
      text: "<b>Hello</b>",
    },
  );
});

test("sends Telegram markdown replies via sendMessage", async () => {
  const calls = [];
  const posts = [];
  const ctx = {
    telegram: {
      chatId: "chat-1",
      messageThreadId: undefined,
      request: async (method, body) => {
        calls.push({ method, body });
        return { ok: true };
      },
      post: async (text) => {
        posts.push(text);
      },
    },
  };

  await sendTelegramMarkdownReply(ctx, "**Done**");

  assert.deepEqual(calls, [
    {
      method: "sendMessage",
      body: {
        chat_id: "chat-1",
        parse_mode: "HTML",
        text: "<b>Done</b>",
      },
    },
  ]);
  assert.deepEqual(posts, []);
});

test("falls back to native post when sendMessage fails", async () => {
  const posts = [];
  const originalError = console.error;
  console.error = () => undefined;
  const ctx = {
    telegram: {
      chatId: "chat-1",
      request: async () => ({ ok: false, status: 400, body: "bad" }),
      post: async (text) => {
        posts.push(text);
      },
    },
  };

  try {
    await sendTelegramMarkdownReply(ctx, "**Raw fallback**");
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(posts, ["**Raw fallback**"]);
});
