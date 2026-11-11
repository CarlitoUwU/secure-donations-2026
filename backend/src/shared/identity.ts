import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ApiError } from "./contracts.js";
import type { Identity } from "./contracts.js";

export type Event = APIGatewayProxyEventV2WithJWTAuthorizer;
// P2 can supply its shared authz implementation through this interface.
export type ResolveIdentity = (event: Event) => Identity;
export const verifiedIdentity: ResolveIdentity = (event) => {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (
    !claims ||
    claims.token_use !== "access" ||
    typeof claims.sub !== "string" ||
    !claims.sub
  )
    throw new ApiError(401, "UNAUTHORIZED", "Autenticación requerida");
  const raw = claims["cognito:groups"];
  let groups: string[] = [];
  if (Array.isArray(raw) && raw.every((v) => typeof v === "string"))
    groups = raw;
  else if (typeof raw === "string") {
    // API Gateway representations must be confirmed jointly with P2 in AWS.
    if (raw.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string"))
          groups = parsed;
      } catch {
        groups = raw
          .slice(1, -1)
          .split(",")
          .map((v) => v.trim())
          .filter((v) => /^[A-Z_]+$/.test(v));
      }
    } else groups = raw.split(/[ ,]+/).filter(Boolean);
  }
  return {
    sub: claims.sub,
    groups,
    scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
  };
};
