import { z } from "zod";
export declare const projectInput: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    goalAmountCents: z.ZodNumber;
}, z.core.$strict>;
export declare const projectPatch: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    goalAmountCents: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const donationInput: z.ZodObject<{
    projectId: z.ZodUUID;
    amountCents: z.ZodNumber;
}, z.core.$strict>;
export declare const simulationInput: z.ZodObject<{
    status: z.ZodEnum<{
        CONFIRMADA_SIMULADA: "CONFIRMADA_SIMULADA";
        RECHAZADA_SIMULADA: "RECHAZADA_SIMULADA";
    }>;
}, z.core.$strict>;
export type Project = z.infer<typeof projectInput> & {
    projectId: string;
    currency: "PEN";
    confirmedAmountCents: number;
    status: "BORRADOR" | "PUBLICADO";
    createdAt: string;
    updatedAt: string;
    revision: number;
};
export type Donation = {
    donationId: string;
    projectId: string;
    donorSub: string;
    amountCents: number;
    currency: "PEN";
    status: "PENDIENTE_SIMULACION" | "CONFIRMADA_SIMULADA" | "RECHAZADA_SIMULADA";
    createdAt: string;
    updatedAt: string;
};
export type Identity = {
    sub: string;
    groups: readonly string[];
    scopes: readonly string[];
};
export type Audit = {
    eventType: string;
    sortKey: string;
    eventId: string;
    timestamp: string;
    requestId: string;
    actorRef: string;
    action: string;
    resourceRef: string;
    outcome: string;
};
export type Idempotency = {
    pk: string;
    payloadHash: string;
    donationId: string;
    responseStatus: number;
    response: Donation;
    expiresAt: number;
};
export type Page<T> = {
    items: T[];
    nextToken?: string;
};
export declare class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string);
}
export declare const missing: () => ApiError;
export declare const conflict: () => ApiError;
