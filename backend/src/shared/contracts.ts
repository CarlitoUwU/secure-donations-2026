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
export type Page<T> = { items: T[]; nextToken?: string };
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const missing = () =>
  new ApiError(404, "NOT_FOUND", "Recurso no encontrado");
export const conflict = () =>
  new ApiError(409, "CONFLICT", "Conflicto de estado o idempotencia");
