import { type EveChannel } from "eve/channels/eve";
export interface DefaultImpelEveChannelOptions {
    basicUser?: string;
    basicPassword?: string;
    includePlaceholderAuth?: boolean;
}
export declare function defaultImpelEveChannel({ basicUser, basicPassword, includePlaceholderAuth, }?: DefaultImpelEveChannelOptions): EveChannel;
//# sourceMappingURL=channel.d.ts.map