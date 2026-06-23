import { eveChannel } from "eve/channels/eve";
import { httpBasic, localDev, placeholderAuth, vercelOidc, } from "eve/channels/auth";
export function defaultImpelEveChannel({ basicUser = process.env.EVE_APP_BASIC_USER ?? process.env.IMPEL_EVE_BASIC_USER, basicPassword = process.env.EVE_APP_BASIC_PASSWORD ?? process.env.IMPEL_EVE_BASIC_PASSWORD, includePlaceholderAuth = false, } = {}) {
    const basic = basicUser && basicPassword
        ? [httpBasic({ username: basicUser, password: basicPassword })]
        : [];
    return eveChannel({
        auth: [
            localDev(),
            vercelOidc(),
            ...basic,
            ...(includePlaceholderAuth ? [placeholderAuth()] : []),
        ],
    });
}
//# sourceMappingURL=channel.js.map