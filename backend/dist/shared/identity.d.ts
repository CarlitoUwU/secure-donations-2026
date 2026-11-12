import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { Identity } from "./contracts.js";
export type Event = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ResolveIdentity = (event: Event) => Identity;
export declare const verifiedIdentity: ResolveIdentity;
export declare function requirePermission(identity: Identity, group: "DONANTE" | "GESTOR" | "AUDITOR", scope: string): void;
export declare function requireOwnDonation<T extends {
    donorSub: string;
}>(identity: Identity, donation: T | null | undefined): T;
