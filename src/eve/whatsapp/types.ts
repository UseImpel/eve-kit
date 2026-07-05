/**
 * Types for the Whapi.Cloud WhatsApp channel provider.
 *
 * Whapi.Cloud (https://whapi.cloud) is a MANAGED WhatsApp provider: it runs a
 * WhatsApp-Web-protocol session in its cloud after a one-time QR/pairing link,
 * so there is no Meta Business verification / WhatsApp Business (Cloud) API
 * onboarding. One paid Whapi "channel" = one connected phone number,
 * authenticated by a per-channel bearer token.
 */

/** Normalized inbound message handed to `whatsappChannel({ onMessage })`. */
export interface WhatsAppMessage {
  /** Provider message id. */
  readonly id: string;
  /** Message text (body, or a media caption / location description). */
  readonly text: string;
  /** WhatsApp chat JID: `<phone>@s.whatsapp.net` (DM) or `<id>@g.us` (group). */
  readonly chatId: string;
  /** Sender's phone number (digits, no `@…` suffix), when present. */
  readonly from: string | undefined;
  /** Sender's WhatsApp display name, when present. */
  readonly fromName: string | undefined;
  /** True when this is an echo of the connected number's own outbound send. */
  readonly fromMe: boolean;
  /** Whapi message type: text | image | video | document | voice | reply | action | … */
  readonly type: string;
  /** Unix seconds. */
  readonly timestamp: number;
  /** True when `chatId` is a group JID (`@g.us`). */
  readonly isGroup: boolean;
  /** Attachment descriptors (media is not downloaded eagerly). */
  readonly attachments: readonly WhatsAppAttachment[];
  /** A button/list reply payload, when `type === "reply"`. */
  readonly buttonReply: { id: string; title: string | undefined } | undefined;
  /** The raw Whapi message object. */
  readonly raw: WhapiMessage;
}

export interface WhatsAppAttachment {
  readonly kind: "image" | "video" | "document" | "audio" | "voice" | "sticker";
  readonly mimeType: string | undefined;
  readonly fileName: string | undefined;
  /** Direct download URL, present when the channel has auto-download enabled. */
  readonly link: string | undefined;
  readonly mediaId: string | undefined;
}

/** Result an `onMessage` handler returns to control dispatch (mirrors Telegram). */
export type WhatsAppInboundResult =
  | {
      /** Session auth for the dispatched turn (or `null` for anonymous). */
      readonly auth: WhatsAppAuthContext | null;
      /** Extra context strings appended to the turn as system/user notes. */
      readonly context?: readonly string[];
    }
  | null;

export type WhatsAppInboundResultOrPromise =
  | WhatsAppInboundResult
  | Promise<WhatsAppInboundResult>;

/** Session auth context (structurally identical to eve's SessionAuthContext). */
export interface WhatsAppAuthContext {
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly authenticator: string;
  readonly issuer?: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly subject?: string;
}

/** Config for {@link whatsappChannel}. Every credential falls back to an env var. */
export interface WhatsAppChannelConfig {
  /** Per-channel Whapi API token. Env: `WHAPI_TOKEN`. */
  readonly token?: string;
  /** Whapi channel id (e.g. `VOLIGO-XXXXX`). Env: `WHAPI_CHANNEL_ID`. */
  readonly channelId?: string;
  /** API base. Env: `WHAPI_API_URL`. Default `https://gate.whapi.cloud`. */
  readonly apiUrl?: string;
  /**
   * Shared secret required on inbound webhooks (Whapi does not sign them).
   * Accepted in the `?secret=` query param or an `Authorization: Bearer …`
   * header — both configurable on the Whapi webhook settings screen. Env:
   * `WHAPI_WEBHOOK_SECRET`. Unset = accept unverified (dev only).
   */
  readonly webhookSecret?: string;
  /** Route the webhook mounts at. Default `/eve/v1/whatsapp`. */
  readonly route?: string;
  /** Send option-based HITL prompts as WhatsApp interactive buttons. Default true. */
  readonly interactiveButtons?: boolean;
  /** Inbound-message hook. Return `{ auth }` to dispatch, `null` to drop. */
  readonly onMessage?: (
    ctx: WhatsAppContext,
    message: WhatsAppMessage,
  ) => WhatsAppInboundResultOrPromise;
  /** Session lifecycle event handlers; supplied handlers replace the defaults. */
  readonly events?: WhatsAppChannelEvents;
  /** Override fetch (tests). */
  readonly fetch?: typeof fetch;
}

/**
 * Minimal context passed to `onMessage` before a session exists. Event handlers
 * get the richer {@link WhatsAppEventContext}.
 */
export interface WhatsAppContext {
  readonly whatsapp: WhatsAppHandle;
}

/** Low-level Whapi handle exposed as `ctx.whatsapp` on every channel context. */
export interface WhatsAppHandle {
  /** The connected channel id. */
  readonly channelId: string;
  /** The chat JID this context is bound to (empty on a bare context). */
  readonly chatId: string;
  /** True when this chat is a group. */
  readonly isGroup: boolean;
  /** Send a plain-text message (splits over the 4096-char cap). */
  sendMessage(text: string): Promise<{ id: string | undefined }>;
  /** Alias of {@link sendMessage}. */
  post(text: string): Promise<{ id: string | undefined }>;
  /** Simulate a typing indicator; never throws. */
  startTyping(seconds?: number): Promise<void>;
  /** React to a message with an emoji (blank removes). */
  react(messageId: string, emoji: string): Promise<void>;
  /** Send interactive quick-reply buttons; throws on provider error. */
  sendButtons(input: WhapiButtonsInput): Promise<{ id: string | undefined }>;
  /** Raw Whapi request escape hatch. */
  request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T>;
}

export interface WhatsAppChannelContext extends WhatsAppContext {
  readonly state: WhatsAppChannelState;
}

/** Durable per-conversation channel state. */
export interface WhatsAppChannelState extends Record<string, unknown> {
  channelId: string | null;
  chatId: string | null;
  isGroup: boolean;
  /** Requests awaiting a freeform text reply, keyed by prompt message id. */
  pendingFreeform: Record<string, string>;
}

export interface WhapiButtonsInput {
  readonly header?: string;
  readonly body: string;
  readonly footer?: string;
  readonly buttons: ReadonlyArray<{ id: string; title: string }>;
}

// ---------------------------------------------------------------------------
// Whapi wire payloads
// ---------------------------------------------------------------------------

export interface WhapiMessage {
  id: string;
  from_me: boolean;
  type: string;
  chat_id: string;
  timestamp: number;
  source?: string;
  from?: string;
  from_name?: string;
  status?: string;
  text?: { body?: string };
  image?: WhapiMedia;
  video?: WhapiMedia;
  document?: WhapiMedia;
  voice?: WhapiMedia;
  audio?: WhapiMedia;
  sticker?: WhapiMedia;
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  reply?: {
    type?: string;
    buttons_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  context?: { quoted_id?: string; quoted_author?: string };
  action?: { type?: string; emoji?: string; target?: string };
}

export interface WhapiMedia {
  id?: string;
  mime_type?: string;
  file_size?: number;
  file_name?: string;
  link?: string;
  caption?: string;
  seconds?: number;
}

export interface WhapiWebhookBody {
  messages?: WhapiMessage[];
  statuses?: unknown[];
  event?: { type?: string; event?: string };
  channel_id?: string;
}

export interface WhapiSendResponse {
  sent?: boolean;
  message?: { id?: string } & Record<string, unknown>;
  [key: string]: unknown;
}

// Event-handler context is the same object with eve's ChannelSessionOps mixed in
// by the framework; declared loosely to avoid importing internal types here.
export type WhatsAppEventContext = WhatsAppChannelContext & {
  setContinuationToken?(token: string): void;
};

export type WhatsAppChannelEvents = Record<string, unknown>;
