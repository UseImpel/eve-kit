import { type Channel } from "eve/channels";
import type { WhatsAppChannelConfig, WhatsAppChannelState, WhatsAppContext } from "./types.js";
/** Decode a WhatsApp button-reply id back into an input response, if it is ours. */
export declare function decodeHitlButtonId(id: string | undefined): {
    requestId: string;
    optionId: string;
} | null;
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
export declare function whatsappChannel(config?: WhatsAppChannelConfig): Channel<WhatsAppChannelState, Record<string, never>, {
    chatId: string | null;
}>;
/**
 * Send an agent reply as WhatsApp-formatted text from inside an event handler.
 * Exposed for parity with `sendTelegramMarkdownReply`; the default
 * `message.completed` handler already calls the equivalent, so most agents do
 * not need this directly.
 */
export declare function sendWhatsAppReply(ctx: WhatsAppContext, markdown: string): Promise<void>;
//# sourceMappingURL=whatsappChannel.d.ts.map