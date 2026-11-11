import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Service } from "../src/service.js";
import type { Input, Operation } from "../src/service.js";
import type { Donation, Identity, Project } from "../src/shared/contracts.js";
import { MemoryStore } from "./memory-store.js";
const gestor: Identity = {
  sub: "gestor",
  groups: ["GESTOR"],
  scopes: ["api/projects.write", "api/donations.read"],
};
const donor: Identity = {
  sub: "donor-A",
  groups: ["DONANTE"],
  scopes: ["api/donations.write", "api/donations.read", "api/projects.write"],
};
let store: MemoryStore;
let service: Service;
let project: Project;
const run = (op: Operation, rest: Partial<Input> = {}) =>
  service.execute(op, {
    requestId: "test-request",
    stage: "academic",
    ...rest,
  });
const donate = (key = randomUUID(), amountCents = 500) =>
  run("createDonation", {
    identity: donor,
    key,
    body: { projectId: project.projectId, amountCents },
  });
beforeEach(async () => {
  store = new MemoryStore();
  service = new Service(store);
  project = (
    await run("createProject", {
      identity: gestor,
      body: {
        title: "Alimentos",
        description: "Proyecto ficticio",
        goalAmountCents: 100000,
      },
    })
  ).body as Project;
});
const publish = () =>
  run("publishProject", { identity: gestor, id: project.projectId });
describe("P3 requisitos de negocio", () => {
  it("T01 CA-01.1/2 CA-02.2: oculta borradores y publica sin datos de donantes", async () => {
    expect((await run("listProjects")).body).toEqual({ items: [] });
    await expect(
      run("getProject", { id: project.projectId }),
    ).rejects.toMatchObject({ status: 404 });
    await publish();
    expect((await run("listProjects")).body).toMatchObject({
      items: [{ status: "PUBLICADO" }],
    });
    await expect(publish()).rejects.toMatchObject({ status: 409 });
  });
  it.each([0, -1, 99, 100001, 1.5, "500"])(
    "T04 CA-05.2: rechaza monto %s",
    async (amountCents) => {
      await publish();
      await expect(
        run("createDonation", {
          identity: donor,
          key: randomUUID(),
          body: { projectId: project.projectId, amountCents },
        }),
      ).rejects.toBeDefined();
      expect(store.d.size).toBe(0);
    },
  );
  it("T05 CA-05.1/3: pendiente, identidad verificada y sin incremento", async () => {
    await expect(donate()).rejects.toMatchObject({ status: 409 });
    await publish();
    const d = (await donate()).body as Donation;
    expect(d).toMatchObject({
      donorSub: donor.sub,
      status: "PENDIENTE_SIMULACION",
    });
    expect(store.p.get(project.projectId)?.confirmedAmountCents).toBe(0);
    await expect(
      run("createDonation", {
        identity: donor,
        key: randomUUID(),
        body: {
          projectId: project.projectId,
          amountCents: 500,
          donorSub: "attacker",
        },
      }),
    ).rejects.toBeDefined();
  });
  it("T06/T07 CA-05.4: reintento atómico, conflicto y respuesta original después de confirmar", async () => {
    await publish();
    const key = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => donate(key)),
    );
    expect(store.d.size).toBe(1);
    responses.forEach((r) => expect(r).toEqual(responses[0]));
    await expect(donate(key, 600)).rejects.toMatchObject({ status: 409 });
    await run("simulateDonation", {
      identity: donor,
      id: (responses[0].body as Donation).donationId,
      body: { status: "CONFIRMADA_SIMULADA" },
    });
    expect(await donate(key)).toEqual(responses[0]);
  });
  it("T08 CA-06.2 RNF-HU-04: diez confirmaciones producen un solo incremento", async () => {
    await publish();
    const d = (await donate()).body as Donation;
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        run("simulateDonation", {
          identity: donor,
          id: d.donationId,
          body: { status: "CONFIRMADA_SIMULADA" },
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(store.p.get(project.projectId)?.confirmedAmountCents).toBe(500);
    for (const r of results)
      if (r.status === "rejected")
        expect(r.reason).toMatchObject({ status: 409 });
  });
  it("CA-06.3: rechazar no suma y no puede confirmarse después", async () => {
    await publish();
    const d = (await donate()).body as Donation;
    await run("simulateDonation", {
      identity: donor,
      id: d.donationId,
      body: { status: "RECHAZADA_SIMULADA" },
    });
    expect(store.p.get(project.projectId)?.confirmedAmountCents).toBe(0);
    await expect(
      run("simulateDonation", {
        identity: donor,
        id: d.donationId,
        body: { status: "CONFIRMADA_SIMULADA" },
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("T09 CA-07.2: propietario ajeno e inexistente son indistinguibles", async () => {
    await publish();
    const d = (await donate()).body as Donation;
    const other = { ...donor, sub: "donor-B" };
    expect(
      (await run("getDonation", { identity: donor, id: d.donationId })).status,
    ).toBe(200);
    for (const id of [d.donationId, randomUUID()])
      await expect(
        run("getDonation", { identity: other, id }),
      ).rejects.toMatchObject({
        status: 404,
        code: "NOT_FOUND",
        message: "Recurso no encontrado",
      });
    await expect(
      run("simulateDonation", {
        identity: other,
        id: d.donationId,
        body: { status: "CONFIRMADA_SIMULADA" },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await run("myDonations", { identity: other })).body).toEqual({
      items: [],
    });
    expect(store.d.get(d.donationId)?.status).toBe("PENDIENTE_SIMULACION");
  });
  it("T02/T03/T12: exige identidad, grupo y scope", async () => {
    await expect(run("createDonation")).rejects.toMatchObject({ status: 401 });
    await expect(
      run("createProject", { identity: donor }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      run("myDonations", { identity: gestor }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      run("myDonations", { identity: { ...donor, scopes: [] } }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("CA-06.1: simulación deshabilitada fuera de academic", async () => {
    await expect(
      run("simulateDonation", { stage: "production", identity: donor }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("CA-08.3: auditoría sin identidad cruda y edición limitada a borradores", async () => {
    await run("editProject", {
      identity: gestor,
      id: project.projectId,
      body: { title: "Nuevo título" },
    });
    await publish();
    await expect(
      run("editProject", {
        identity: gestor,
        id: project.projectId,
        body: { title: "Otro" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(store.audits.map((a) => a.action)).toEqual([
      "createProject",
      "editProject",
      "publishProject",
    ]);
    expect(store.audits[0].actorRef).not.toBe(gestor.sub);
  });
});
