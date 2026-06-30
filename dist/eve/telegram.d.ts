import { type TelegramEventContext } from "eve/channels/telegram";
export type TelegramJsonPrimitive = boolean | number | string | null;
export type TelegramJsonValue = TelegramJsonPrimitive | readonly TelegramJsonValue[] | {
    readonly [key: string]: TelegramJsonValue;
};
export type TelegramJsonObject = {
    readonly [key: string]: TelegramJsonValue;
};
export type TelegramMessageTarget = {
    chatId: number | string;
    messageThreadId?: number | string;
};
export declare function renderTelegramMarkdownAsHtml(markdown: string): string;
export declare function createTelegramMarkdownSendMessageBody(target: TelegramMessageTarget, markdown: string): TelegramJsonObject;
export declare function sendTelegramMarkdownReply(ctx: TelegramEventContext, markdown: string): Promise<void>;
//# sourceMappingURL=telegram.d.ts.map