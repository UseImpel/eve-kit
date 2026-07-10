export const DEFAULT_CONTEXT_WINDOW_TOKENS = 200000;
export const IMPEL_EVE_DEFAULT_CONTEXT_WINDOW_TOKENS = DEFAULT_CONTEXT_WINDOW_TOKENS;
import { normalizeImpelGatewayModelId } from "../gateway-model.js";
export function toGatewayModelId(modelId) {
    return normalizeImpelGatewayModelId(modelId);
}
export function resolveGatewayModelId(envNames, defaultModelId) {
    for (const name of envNames) {
        const value = process.env[name]?.trim();
        if (value)
            return toGatewayModelId(value);
    }
    return defaultModelId;
}
export const toImpelGatewayModelId = toGatewayModelId;
export const resolveImpelGatewayModelId = resolveGatewayModelId;
//# sourceMappingURL=gateway.js.map