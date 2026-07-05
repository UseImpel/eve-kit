import {
  defineChannel,
  POST,
  type Channel,
  type RouteHandlerArgs,
} from "eve/channels";
import { renderWhatsAppMarkdown, splitWhatsAppMessage } from "./markdown.js";
import type {
  WhapiButtonsInput,
  WhapiMessage,
  WhapiSendResponse,
  WhapiWebhookBody,
  WhatsAppAttachment,
  WhatsAppChannelConfig,
  WhatsAppChannelState,
  WhatsAppContext,
  WhatsAppHandle,
  WhatsAppMessage,
} from "./types.js";

const DEFAULT_API_URL = "https://gate.whapi.cloud";
const DEFAULT_ROUTE = "/eve/v1/whatsapp";
const PLACEHOLDER = "PLACEHOLDER";
/** Prefix for HITL button ids: `eve:<requestId>:<optionId>`. */
const HITL_BUTTON_PREFIX = "eve:";

interface ResolvedConfig {
  token: string;
  channelId: string;
  apiUrl: string;
  webhookSecret: string | null;
  route: string;
  interactiveButtons: boolean;
  fetchImpl: typeof fetch;
}

function resolveConfig(config: WhatsAppChannelConfig): ResolvedConfig {
  const token = config.token ?? process.env.WHAPI_TOKEN ?? PLACEHOLDER;
  const channelId =
    config.channelId ?? process.env.WHAPI_CHANNEL_ID ?? PLACEHOLDER;
  if (token === PLACEHOLDER || channelId === PLACEHOLDER) {
    console.warn(
      "[whatsapp] WHAPI_TOKEN / WHAPI_CHANNEL_ID not set — the WhatsApp channel " +
        "is unprovisioned; inbound webhooks are rejected until it is configured.",
    );
  }
  return {
    token,
    channelId,
    apiUrl: (config.apiUrl ?? process.env.WHAPI_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, ""),
    webhookSecret: config.webhookSecret ?? process.env.WHAPI_WEBHOOK_SECRET ?? null,
    route: config.route ?? DEFAULT_ROUTE,
    interactiveButtons: config.interactiveButtons ?? true,
    fetchImpl: config.fetch ?? fetch,
  };
}

function isProvisioned(config: ResolvedConfig): boolean {
  return config.token !== PLACEHOLDER && config.channelId !== PLACEHOLDER;
}

// ---------------------------------------------------------------------------
// Whapi HTTP client
// ---------------------------------------------------------------------------

class WhapiClient {
  constructor(private readonly config: ResolvedConfig) {}

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!isProvisioned(this.config)) {
      throw new Error("WhatsApp channel is unprovisioned — set WHAPI_TOKEN and WHAPI_CHANNEL_ID.");
    }
    const response = await this.config.fetchImpl(`${this.config.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.token}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Whapi ${method} ${path} failed: ${response.status} ${detail.slice(0, 300)}`,
      );
    }
    return (await response.json().catch(() => ({}))) as T;
  }

  raw<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    return this.request<T>(method, path, body);
  }

  /** Send text, splitting over the 4096-char cap; returns the last message id. */
  async sendText(chatId: string, text: string): Promise<{ id: string | undefined }> {
    let lastId: string | undefined;
    for (const chunk of splitWhatsAppMessage(text)) {
      const response = await this.request<WhapiSendResponse>("POST", "/messages/text", {
        to: chatId,
        body: chunk,
      });
      lastId = response.message?.id;
    }
    return { id: lastId };
  }

  async sendButtons(
    chatId: string,
    input: WhapiButtonsInput,
  ): Promise<{ id: string | undefined }> {
    const response = await this.request<WhapiSendResponse>("POST", "/messages/interactive", {
      to: chatId,
      type: "button",
      ...(input.header ? { header: { text: input.header } } : {}),
      body: { text: input.body },
      ...(input.footer ? { footer: { text: input.footer } } : {}),
      action: {
        buttons: input.buttons.map((b) => ({
          type: "quick_reply" as const,
          id: b.id,
          title: b.title.slice(0, 20),
        })),
      },
    });
    return { id: response.message?.id };
  }

  async react(chatId: string, messageId: string, emoji: string): Promise<void> {
    await this.request("PUT", `/messages/${encodeURIComponent(messageId)}/reaction`, {
      emoji,
    });
    void chatId;
  }

  async typing(chatId: string, seconds = 10): Promise<void> {
    await this.request("PUT", `/presences/${encodeURIComponent(chatId)}`, {
      presence: "typing",
      delay: seconds,
    });
  }
}

// ---------------------------------------------------------------------------
// Inbound parsing + verification
// ---------------------------------------------------------------------------

/** Verify the shared webhook secret (query `?secret=` or Bearer header). */
function verifyWebhook(request: Request, secret: string | null): boolean {
  if (!secret) {
    return true;
  }
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) {
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function primaryMedia(m: WhapiMessage): {
  media: NonNullable<WhapiMessage["image"]>;
  kind: WhatsAppAttachment["kind"];
} | null {
  const candidates: Array<[WhatsAppAttachment["kind"], WhapiMessage["image"]]> = [
    ["image", m.image],
    ["video", m.video],
    ["document", m.document],
    ["voice", m.voice],
    ["audio", m.audio],
    ["sticker", m.sticker],
  ];
  for (const [kind, media] of candidates) {
    if (media) {
      return { media, kind };
    }
  }
  return null;
}

function extractText(m: WhapiMessage): string {
  if (m.type === "text") {
    return m.text?.body ?? "";
  }
  const media = primaryMedia(m);
  if (media) {
    return media.media.caption ?? "";
  }
  if (m.type === "location" && m.location) {
    const { latitude, longitude, name, address } = m.location;
    return [
      name ?? "Location",
      address,
      latitude !== undefined && longitude !== undefined
        ? `https://www.google.com/maps?q=${latitude},${longitude}`
        : null,
    ]
      .filter(Boolean)
      .join(" — ");
  }
  return "";
}

function buildAttachments(m: WhapiMessage): WhatsAppAttachment[] {
  const media = primaryMedia(m);
  if (!media) {
    return [];
  }
  return [
    {
      kind: media.kind,
      mimeType: media.media.mime_type,
      fileName: media.media.file_name,
      link: media.media.link,
      mediaId: media.media.id,
    },
  ];
}

function normalizeMessage(m: WhapiMessage): WhatsAppMessage {
  const buttonReply = m.reply?.buttons_reply ?? m.reply?.list_reply;
  return {
    id: m.id,
    text: extractText(m),
    chatId: m.chat_id,
    from: m.from ?? m.chat_id.split("@")[0],
    fromName: m.from_name,
    fromMe: m.from_me === true,
    type: m.type,
    timestamp: m.timestamp,
    isGroup: m.chat_id.endsWith("@g.us"),
    attachments: buildAttachments(m),
    buttonReply: buttonReply
      ? { id: buttonReply.id ?? "", title: buttonReply.title }
      : undefined,
    raw: m,
  };
}

// ---------------------------------------------------------------------------
// Channel state + context handle
// ---------------------------------------------------------------------------

function initialState(channelId: string): WhatsAppChannelState {
  return { channelId, chatId: null, isGroup: false, pendingFreeform: {} };
}

function stateForChat(channelId: string, chatId: string): WhatsAppChannelState {
  return {
    channelId,
    chatId,
    isGroup: chatId.endsWith("@g.us"),
    pendingFreeform: {},
  };
}

function buildHandle(client: WhapiClient, state: WhatsAppChannelState): WhatsAppHandle {
  const chatId = state.chatId ?? "";
  const requireChat = () => {
    if (!chatId) {
      throw new Error("whatsappChannel: missing chat id for outbound message.");
    }
    return chatId;
  };
  const sendMessage = (text: string) => client.sendText(requireChat(), renderWhatsAppMarkdown(text));
  return {
    channelId: state.channelId ?? "",
    chatId,
    isGroup: state.isGroup,
    sendMessage,
    post: sendMessage,
    async startTyping(seconds?: number) {
      if (!chatId) {
        return;
      }
      try {
        await client.typing(chatId, seconds);
      } catch (error) {
        console.error("whatsapp typing indicator failed — swallowed:", error);
      }
    },
    react(messageId: string, emoji: string) {
      return client.react(requireChat(), messageId, emoji);
    },
    sendButtons(input: WhapiButtonsInput) {
      return client.sendButtons(requireChat(), input);
    },
    request<T = unknown>(method: string, path: string, body?: unknown) {
      return client.raw<T>(method, path, body);
    },
  };
}

// ---------------------------------------------------------------------------
// HITL rendering (option requests → WhatsApp interactive buttons)
// ---------------------------------------------------------------------------

interface InputRequestLike {
  requestId: string;
  prompt: string;
  options?: ReadonlyArray<{ id: string; label: string }>;
}

function encodeHitlButtonId(requestId: string, optionId: string): string {
  return `${HITL_BUTTON_PREFIX}${requestId}:${optionId}`;
}

/** Decode a WhatsApp button-reply id back into an input response, if it is ours. */
export function decodeHitlButtonId(
  id: string | undefined,
): { requestId: string; optionId: string } | null {
  if (!id || !id.startsWith(HITL_BUTTON_PREFIX)) {
    return null;
  }
  const rest = id.slice(HITL_BUTTON_PREFIX.length);
  const sep = rest.lastIndexOf(":");
  if (sep <= 0) {
    return null;
  }
  return { requestId: rest.slice(0, sep), optionId: rest.slice(sep + 1) };
}

// ---------------------------------------------------------------------------
// Default event handlers (delivery, typing, HITL, error surfacing)
// ---------------------------------------------------------------------------

type EventContext = WhatsAppContext & { state: WhatsAppChannelState };

function defaultEvents(interactiveButtons: boolean): Record<string, unknown> {
  return {
    async "turn.started"(_data: unknown, channel: EventContext) {
      await channel.whatsapp.startTyping();
    },
    async "actions.requested"(_data: unknown, channel: EventContext) {
      await channel.whatsapp.startTyping();
    },
    async "message.completed"(
      data: { finishReason?: string; message?: string | null },
      channel: EventContext,
    ) {
      if (data.finishReason === "tool-calls" || !data.message) {
        return;
      }
      await channel.whatsapp.post(data.message);
    },
    async "input.requested"(
      data: { requests?: readonly InputRequestLike[] },
      channel: EventContext,
    ) {
      for (const req of data.requests ?? []) {
        const options = req.options ?? [];
        // ≤3 options with interactive buttons enabled → native quick replies.
        if (interactiveButtons && options.length > 0 && options.length <= 3) {
          try {
            await channel.whatsapp.sendButtons({
              body: req.prompt,
              buttons: options.map((o) => ({
                id: encodeHitlButtonId(req.requestId, o.id),
                title: o.label,
              })),
            });
            continue;
          } catch (error) {
            console.error("whatsapp interactive prompt failed, falling back to text:", error);
          }
        }
        // Fallback / >3 options / freeform: numbered text prompt.
        const lines = [req.prompt];
        if (options.length > 0) {
          lines.push(
            "",
            ...options.map((o, i) => `${i + 1}. ${o.label}`),
            "",
            "Reply with the number or the option text.",
          );
        }
        await channel.whatsapp.post(lines.join("\n"));
      }
    },
    async "turn.failed"(data: { message?: string }, channel: EventContext) {
      await channel.whatsapp.post(
        `I hit an error while handling your request${data.message ? ` (${data.message})` : ""}. Please try again or rephrase.`,
      );
    },
    async "session.failed"(data: { message?: string }, channel: EventContext) {
      await channel.whatsapp.post(
        `This session could not recover from an error${data.message ? ` (${data.message})` : ""}. Send a new message to continue.`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// The channel factory
// ---------------------------------------------------------------------------

/**
 * Whapi.Cloud WhatsApp channel — a native eve `defineChannel` provider, authored
 * the same way as `telegramChannel` from `eve/channels/telegram`. Drop it into an
 * agent as `agent/channels/whatsapp.ts`:
 *
 * ```ts
 * import { whatsappChannel } from "@useimpel/eve-kit/eve/whatsapp";
 * export default whatsappChannel({
 *   onMessage(ctx, message) {
 *     // return { auth } to dispatch a turn, or null to drop
 *     return { auth: null };
 *   },
 * });
 * ```
 *
 * Inbound Whapi webhooks (`POST {route}`) are secret-verified, parsed, and — for
 * each user message — handed to `onMessage`. A non-null result dispatches a
 * durable eve turn; the default `events` deliver the agent's reply back to the
 * chat (typing on turn start, markdown-rendered text on `message.completed`,
 * option HITL as interactive buttons, errors as text). Button replies resume the
 * pending HITL turn automatically.
 */
export function whatsappChannel(
  config: WhatsAppChannelConfig = {},
): Channel<WhatsAppChannelState, Record<string, never>, { chatId: string | null }> {
  const resolved = resolveConfig(config);
  const client = new WhapiClient(resolved);
  const events = { ...defaultEvents(resolved.interactiveButtons), ...config.events };

  const continuationToken = (chatId: string) => chatId;

  async function dispatchMessage(
    message: WhatsAppMessage,
    args: RouteHandlerArgs<WhatsAppChannelState>,
  ): Promise<void> {
    if (message.fromMe) {
      return;
    }
    const state = stateForChat(resolved.channelId, message.chatId);
    const ctx: WhatsAppContext = { whatsapp: buildHandle(client, state) };

    // A button reply resumes the pending HITL turn instead of a fresh message.
    const hitl = message.type === "reply" ? decodeHitlButtonId(message.buttonReply?.id) : null;
    if (hitl) {
      try {
        await args.send(
          { inputResponses: [{ requestId: hitl.requestId, optionId: hitl.optionId }] },
          { auth: null, continuationToken: continuationToken(message.chatId), state },
        );
      } catch (error) {
        console.error("whatsapp HITL delivery failed:", error);
      }
      return;
    }

    let result: Awaited<ReturnType<NonNullable<WhatsAppChannelConfig["onMessage"]>>>;
    try {
      result = config.onMessage ? await config.onMessage(ctx, message) : { auth: null };
    } catch (error) {
      console.error("whatsapp onMessage handler failed:", error);
      return;
    }
    if (!result) {
      return;
    }

    const attachmentNote =
      message.attachments.length > 0
        ? `\n\n[The user attached ${message.attachments.length} file(s): ${message.attachments
            .map((a) => a.fileName ?? a.kind)
            .join(", ")}]`
        : "";

    try {
      await args.send(
        {
          message: `${message.text}${attachmentNote}`.trim(),
          context: result.context ?? [],
        },
        { auth: result.auth, continuationToken: continuationToken(message.chatId), state },
      );
    } catch (error) {
      console.error("whatsapp message delivery failed:", error);
    }
  }

  return defineChannel<
    WhatsAppChannelState,
    WhatsAppContext,
    Record<string, never>,
    { chatId: string | null }
  >({
    kindHint: "whatsapp",
    state: initialState(resolved.channelId),
    metadata(state) {
      return { chatId: state.chatId };
    },
    context(state) {
      return { whatsapp: buildHandle(client, state) };
    },
    routes: [
      POST<WhatsAppChannelState>(resolved.route, async (request, args) => {
        if (!verifyWebhook(request, resolved.webhookSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: WhapiWebhookBody;
        try {
          body = (await request.json()) as WhapiWebhookBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        for (const raw of body.messages ?? []) {
          if (!raw.chat_id) {
            continue;
          }
          args.waitUntil(dispatchMessage(normalizeMessage(raw), args));
        }
        return new Response("ok");
      }),
    ],
    async receive(input, { send }) {
      const target = input.target as { chatId?: string; phoneNumber?: string };
      const chatId =
        target.chatId ??
        (target.phoneNumber
          ? `${target.phoneNumber.replace(/\D/g, "")}@s.whatsapp.net`
          : undefined);
      if (!chatId) {
        throw new Error("whatsappChannel().receive requires target.chatId or target.phoneNumber.");
      }
      return send(input.message, {
        auth: input.auth,
        continuationToken: continuationToken(chatId),
        state: stateForChat(resolved.channelId, chatId),
      });
    },
    events,
  });
}

/**
 * Send an agent reply as WhatsApp-formatted text from inside an event handler.
 * Exposed for parity with `sendTelegramMarkdownReply`; the default
 * `message.completed` handler already calls the equivalent, so most agents do
 * not need this directly.
 */
export async function sendWhatsAppReply(
  ctx: WhatsAppContext,
  markdown: string,
): Promise<void> {
  await ctx.whatsapp.post(markdown);
}
