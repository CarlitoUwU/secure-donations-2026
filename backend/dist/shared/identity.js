import { ApiError, missing } from "./contracts.js";
export const verifiedIdentity = (event) => {
    const jwt = event.requestContext.authorizer?.jwt;
    const claims = jwt?.claims;
    const expectedClient = process.env.COGNITO_CLIENT_ID;
    if (!claims ||
        claims.token_use !== "access" ||
        !expectedClient ||
        claims.client_id !== expectedClient ||
        typeof claims.sub !== "string" ||
        !claims.sub.trim())
        throw new ApiError(401, "UNAUTHORIZED", "Autenticación requerida");
    const raw = claims["cognito:groups"];
    let groups = [];
    if (Array.isArray(raw) && raw.every((v) => typeof v === "string"))
        groups = raw;
    else if (typeof raw === "string") {
        if (raw.startsWith("[") && raw.endsWith("]")) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string"))
                    groups = parsed;
            }
            catch {
                // Accept a bracketed list only if every element is an unquoted name.
                if (/^\[[A-Z_]+(?:(?:,\s*| +)[A-Z_]+)*\]$/.test(raw)) {
                    groups = raw.slice(1, -1).split(/[,\s]+/);
                }
            }
        }
        else if (/^[A-Z_]+$/.test(raw))
            groups = [raw];
    }
    return {
        sub: claims.sub,
        groups,
        scopes: typeof claims.scope === "string"
            ? claims.scope.split(/ +/).filter(Boolean)
            : [],
    };
};
export function requirePermission(identity, group, scope) {
    if (!identity.groups.includes(group) || !identity.scopes.includes(scope)) {
        throw new ApiError(403, "FORBIDDEN", "Permisos insuficientes");
    }
}
export function requireOwnDonation(identity, donation) {
    if (!donation || donation.donorSub !== identity.sub)
        throw missing();
    return donation;
}
