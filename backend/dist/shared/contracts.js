import { z } from "zod";
export const projectInput = z
    .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5000),
    goalAmountCents: z.number().int().positive().max(1_000_000_000),
})
    .strict();
export const projectPatch = projectInput
    .partial()
    .refine((v) => Object.keys(v).length > 0);
export const donationInput = z
    .object({
    projectId: z.uuid(),
    amountCents: z.number().int().min(100).max(100000),
})
    .strict();
export const simulationInput = z
    .object({ status: z.enum(["CONFIRMADA_SIMULADA", "RECHAZADA_SIMULADA"]) })
    .strict();
export class ApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
export const missing = () => new ApiError(404, "NOT_FOUND", "Recurso no encontrado");
export const conflict = () => new ApiError(409, "CONFLICT", "Conflicto de estado o idempotencia");
