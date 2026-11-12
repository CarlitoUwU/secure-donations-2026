import { ZodError } from "zod";
import { ApiError } from "./shared/contracts.js";
import { Service, permissions } from "./service.js";
import { DynamoStore } from "./shared/dynamo-store.js";
import { verifiedIdentity } from "./shared/identity.js";
export { verifiedIdentity } from "./shared/identity.js";
export function makeHandler(op, service, identity = verifiedIdentity, log = console.log) {
    return async (event) => {
        const started = Date.now();
        const requestId = event.requestContext.requestId;
        let statusCode = 500;
        let body;
        try {
            const user = permissions[op] ? identity(event) : undefined;
            let parsed;
            if (event.body) {
                try {
                    parsed = JSON.parse(event.isBase64Encoded
                        ? Buffer.from(event.body, "base64").toString("utf8")
                        : event.body);
                }
                catch {
                    throw new ApiError(400, "INVALID_BODY", "JSON inválido");
                }
            }
            const key = Object.entries(event.headers).find(([k]) => k.toLowerCase() === "idempotency-key")?.[1];
            const result = await service.execute(op, {
                identity: user,
                body: parsed,
                id: event.pathParameters?.projectId ?? event.pathParameters?.donationId,
                key,
                nextToken: event.queryStringParameters?.nextToken,
                requestId,
                stage: event.requestContext.stage,
            });
            statusCode = result.status;
            body = result.body;
        }
        catch (error) {
            if (error instanceof ApiError) {
                statusCode = error.status;
                body = { code: error.code, message: error.message, requestId };
            }
            else if (error instanceof ZodError) {
                statusCode = 400;
                body = {
                    code: "INVALID_INPUT",
                    message: "Solicitud inválida",
                    requestId,
                };
            }
            else {
                body = { code: "INTERNAL_ERROR", message: "Error interno", requestId };
            }
        }
        log(JSON.stringify({
            requestId,
            action: op,
            outcome: statusCode < 400 ? "SUCCESS" : "REJECTED",
            httpStatus: statusCode,
            durationMs: Date.now() - started,
        }));
        return {
            statusCode,
            headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
            },
            body: JSON.stringify(body),
        };
    };
}
let service;
function runtime(op) {
    return async (event) => {
        if (!service) {
            const required = (name) => {
                const value = process.env[name];
                if (!value)
                    throw new Error(`Missing configuration: ${name}`);
                return value;
            };
            service = new Service(new DynamoStore({
                projects: required("PROJECTS_TABLE"),
                donations: required("DONATIONS_TABLE"),
                idempotency: required("IDEMPOTENCY_TABLE"),
                audit: required("AUDIT_EVENTS_TABLE"),
            }));
        }
        return makeHandler(op, service)(event);
    };
}
// Separate Lambda functions/roles must select one export each; no public catch-all router.
export const listProjects = runtime("listProjects");
export const getProject = runtime("getProject");
export const projectStats = runtime("projectStats");
export const createProject = runtime("createProject");
export const editProject = runtime("editProject");
export const publishProject = runtime("publishProject");
export const createDonation = runtime("createDonation");
export const simulateDonation = runtime("simulateDonation");
export const myDonations = runtime("myDonations");
export const getDonation = runtime("getDonation");
