import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  donationInput,
  projectInput,
  projectPatch,
  simulationInput,
} from "../src/shared/contracts.js";
import {
  requireOwnDonation,
  requirePermission,
  verifiedIdentity,
} from "../src/shared/identity.js";
import type { Event } from "../src/shared/identity.js";

describe("Base: validación de entradas e identidad", () => {
  beforeEach(() => vi.stubEnv("COGNITO_CLIENT_ID", "test-client"));
  afterEach(() => vi.unstubAllEnvs());
  const projectId = "11111111-1111-4111-8111-111111111111";
  it.each([100, 100000])(
    "CA-05.1: acepta límite de importe %s",
    (amountCents) => {
      expect(donationInput.safeParse({ projectId, amountCents }).success).toBe(
        true,
      );
    },
  );
  it.each([0, 99, 100001, 100.5, "500"])(
    "CA-05.2: rechaza importe %s",
    (amountCents) => {
      expect(donationInput.safeParse({ projectId, amountCents }).success).toBe(
        false,
      );
    },
  );
  it("CA-05.3: rechaza identidad enviada en el cuerpo", () => {
    expect(
      donationInput.safeParse({ projectId, amountCents: 500, donorSub: "otro" })
        .success,
    ).toBe(false);
  });
  it("exige título, descripción y meta positiva; PATCH no puede estar vacío", () => {
    expect(
      projectInput.safeParse({
        title: " ",
        description: "Prueba",
        goalAmountCents: 100,
      }).success,
    ).toBe(false);
    expect(
      projectInput.safeParse({
        title: "Prueba",
        description: "Prueba",
        goalAmountCents: 0,
      }).success,
    ).toBe(false);
    expect(projectPatch.safeParse({}).success).toBe(false);
    expect(projectPatch.safeParse({ title: "Nuevo" }).success).toBe(true);
  });
  it("CA-06.1: solo admite estados terminales de simulación", () => {
    expect(
      simulationInput.safeParse({ status: "CONFIRMADA_SIMULADA" }).success,
    ).toBe(true);
    expect(
      simulationInput.safeParse({ status: "PENDIENTE_SIMULACION" }).success,
    ).toBe(false);
  });
  const event = (claims: Record<string, unknown>) =>
    ({
      requestContext: { authorizer: { jwt: { claims } } },
    }) as unknown as Event;
  it("T11: rechaza ID token y contexto sin identidad", () => {
    expect(() =>
      verifiedIdentity(event({ token_use: "id", sub: "A" })),
    ).toThrow();
    expect(() => verifiedIdentity(event({}))).toThrow();
  });
  it("extrae identidad tipada del contexto del authorizer", () => {
    expect(
      verifiedIdentity(
        event({
          token_use: "access",
          client_id: "test-client",
          sub: "A",
          "cognito:groups": '["DONANTE"]',
          scope: "api/donations.read",
        }),
      ),
    ).toEqual({
      sub: "A",
      groups: ["DONANTE"],
      scopes: ["api/donations.read"],
    });
  });
  it("CA-03.2: rechaza un access token de otro cliente aunque tenga la audiencia esperada", () => {
    expect(() =>
      verifiedIdentity(
        event({
          token_use: "access",
          sub: "A",
          client_id: "otro",
          aud: "test-client",
        }),
      ),
    ).toThrow(expect.objectContaining({ status: 401 }));
  });
  it("rechaza listas de grupos malformadas sin extraer privilegios parciales", () => {
    const identity = verifiedIdentity(
      event({
        token_use: "access",
        sub: "A",
        client_id: "test-client",
        "cognito:groups": "[GESTOR, basura!]",
        scope: "api/projects.write",
      }),
    );
    expect(() =>
      requirePermission(identity, "GESTOR", "api/projects.write"),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
  it("T03/T12: tener el scope sin el grupo no concede acceso", () => {
    const donor = {
      sub: "A",
      groups: ["DONANTE"],
      scopes: ["api/projects.write"],
    };
    const manager = {
      sub: "B",
      groups: ["GESTOR"],
      scopes: ["api/donations.read"],
    };
    expect(() =>
      requirePermission(donor, "GESTOR", "api/projects.write"),
    ).toThrow(expect.objectContaining({ status: 403 }));
    expect(() =>
      requirePermission(manager, "DONANTE", "api/donations.read"),
    ).toThrow(expect.objectContaining({ status: 403 }));
    expect(() =>
      requirePermission(donor, "DONANTE", "api/donations.read"),
    ).toThrow(expect.objectContaining({ status: 403 }));
    expect(() =>
      requirePermission(donor, "DONANTE", "api/projects.write"),
    ).not.toThrow();
  });
  it("T09: devuelve el mismo 404 para una donación ajena e inexistente", () => {
    const donor = {
      sub: "A",
      groups: ["DONANTE"],
      scopes: ["api/donations.read"],
    };
    expect(requireOwnDonation(donor, { donorSub: "A" })).toEqual({
      donorSub: "A",
    });
    for (const donation of [{ donorSub: "B" }, undefined]) {
      expect(() => requireOwnDonation(donor, donation)).toThrow(
        expect.objectContaining({
          status: 404,
          code: "NOT_FOUND",
          message: "Recurso no encontrado",
        }),
      );
    }
  });
});
