import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ApiError,
  conflict,
  missing,
  projectInput,
  projectPatch,
  donationInput,
  simulationInput,
} from "./shared/contracts.js";
import type { Audit, Donation, Identity, Project } from "./shared/contracts.js";
import type { Store } from "./shared/store.js";

export const operations = [
  "listProjects",
  "getProject",
  "projectStats",
  "createProject",
  "editProject",
  "publishProject",
  "createDonation",
  "simulateDonation",
  "myDonations",
  "getDonation",
] as const;
export type Operation = (typeof operations)[number];
export const permissions: Partial<
  Record<Operation, { group: string; scope: string }>
> = {
  createProject: { group: "GESTOR", scope: "api/projects.write" },
  editProject: { group: "GESTOR", scope: "api/projects.write" },
  publishProject: { group: "GESTOR", scope: "api/projects.write" },
  createDonation: { group: "DONANTE", scope: "api/donations.write" },
  simulateDonation: { group: "DONANTE", scope: "api/donations.write" },
  myDonations: { group: "DONANTE", scope: "api/donations.read" },
  getDonation: { group: "DONANTE", scope: "api/donations.read" },
};
export type Input = {
  identity?: Identity;
  body?: unknown;
  id?: string;
  key?: string;
  nextToken?: string;
  requestId: string;
  stage: string;
};
export class Service {
  constructor(private store: Store) {}
  async execute(
    op: Operation,
    input: Input,
  ): Promise<{ status: number; body: unknown }> {
    if (op === "simulateDonation" && input.stage !== "academic")
      throw missing();
    const permission = permissions[op];
    if (permission) {
      if (!input.identity?.sub)
        throw new ApiError(401, "UNAUTHORIZED", "Autenticación requerida");
      if (
        !input.identity.groups.includes(permission.group) ||
        !input.identity.scopes.includes(permission.scope)
      )
        throw new ApiError(403, "FORBIDDEN", "Acceso denegado");
    }
    const sub = input.identity?.sub ?? "";
    const now = new Date().toISOString();
    const audit = (resourceRef: string): Audit => {
      const eventId = randomUUID();
      return {
        eventType: op,
        sortKey: `${now}#${eventId}`,
        eventId,
        timestamp: now,
        requestId: input.requestId,
        actorRef: createHash("sha256").update(sub).digest("hex"),
        action: op,
        resourceRef,
        outcome: "SUCCESS",
      };
    };
    const ok = (body: unknown, status = 200) => ({ status, body });
    const id = () => {
      if (!input.id || !z.uuid().safeParse(input.id).success) throw missing();
      return input.id;
    };
    const publicProject = async () => {
      const p = await this.store.project(id());
      if (!p || p.status !== "PUBLICADO") throw missing();
      return p;
    };
    if (op === "listProjects")
      return ok(await this.store.projects(input.nextToken));
    if (op === "getProject") return ok(await publicProject());
    if (op === "projectStats") {
      const p = await publicProject();
      return ok({
        projectId: p.projectId,
        currency: p.currency,
        goalAmountCents: p.goalAmountCents,
        confirmedAmountCents: p.confirmedAmountCents,
      });
    }
    if (op === "createProject") {
      const p: Project = {
        ...projectInput.parse(input.body),
        projectId: randomUUID(),
        currency: "PEN",
        status: "BORRADOR",
        confirmedAmountCents: 0,
        createdAt: now,
        updatedAt: now,
        revision: 0,
      };
      await this.store.createProject(p, audit(p.projectId));
      return ok(p, 201);
    }
    if (op === "editProject" || op === "publishProject") {
      const patch = op === "editProject" ? projectPatch.parse(input.body) : {};
      const before = await this.store.project(id());
      if (!before) throw missing();
      if (before.status !== "BORRADOR") throw conflict();
      const after: Project = {
        ...before,
        ...patch,
        status: op === "publishProject" ? "PUBLICADO" : "BORRADOR",
        updatedAt: now,
        revision: before.revision + 1,
      };
      await this.store.updateProject(before, after, audit(before.projectId));
      return ok(after);
    }
    if (op === "createDonation") {
      const data = donationInput.parse(input.body);
      const key = z.uuid().parse(input.key).toLowerCase();
      const pk = `${sub}#createDonation#${key}`;
      const payloadHash = createHash("sha256")
        .update(
          JSON.stringify({
            projectId: data.projectId,
            amountCents: data.amountCents,
          }),
        )
        .digest("hex");
      const replay = async () => {
        const saved = await this.store.idempotency(pk);
        if (!saved) return undefined;
        if (saved.payloadHash !== payloadHash) throw conflict();
        return ok(saved.response, saved.responseStatus);
      };
      const original = await replay();
      if (original) return original;
      const p = await this.store.project(data.projectId);
      if (!p) throw missing();
      if (p.status !== "PUBLICADO") throw conflict();
      const d: Donation = {
        ...data,
        donationId: randomUUID(),
        donorSub: sub,
        currency: "PEN",
        status: "PENDIENTE_SIMULACION",
        createdAt: now,
        updatedAt: now,
      };
      try {
        await this.store.createDonation(
          d,
          {
            pk,
            payloadHash,
            donationId: d.donationId,
            responseStatus: 201,
            response: d,
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
          },
          audit(d.donationId),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const result = await replay();
          if (result) return result;
        }
        throw error;
      }
      return ok(d, 201);
    }
    if (op === "myDonations")
      return ok(await this.store.donations(sub, input.nextToken));
    const before = await this.store.donation(id());
    if (!before || before.donorSub !== sub) throw missing();
    if (op === "getDonation") return ok(before);
    const data = simulationInput.parse(input.body);
    if (before.status !== "PENDIENTE_SIMULACION") throw conflict();
    const after: Donation = { ...before, status: data.status, updatedAt: now };
    await this.store.transition(before, after, audit(before.donationId));
    return ok(after);
  }
}
