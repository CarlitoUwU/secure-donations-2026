import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHandler, verifiedIdentity } from "../src/handler.js";
import type { Event } from "../src/handler.js";
import { Service } from "../src/service.js";
import { MemoryStore } from "./memory-store.js";
const event = (claims: Record<string, unknown> = {}): Event =>
  ({
    version: "2.0",
    routeKey: "POST /v1/projects",
    rawPath: "/v1/projects",
    rawQueryString: "",
    headers: {},
    isBase64Encoded: false,
    requestContext: {
      requestId: "req-test",
      stage: "academic",
      authorizer: {
        jwt: {
          claims: { client_id: "test-client", ...claims },
          scopes: [],
        },
      },
    },
  }) as unknown as Event;
describe("HTTP y límites de identidad", () => {
  beforeEach(() => vi.stubEnv("COGNITO_CLIENT_ID", "test-client"));
  afterEach(() => vi.unstubAllEnvs());
  it("T11: ID token se rechaza aunque tenga grupo", () => {
    expect(() =>
      verifiedIdentity(
        event({ sub: "A", token_use: "id", "cognito:groups": ["DONANTE"] }),
      ),
    ).toThrow();
  });
  it.each([["DONANTE"], '["DONANTE"]', "[DONANTE]", "DONANTE"])(
    "normaliza grupos del contexto verificado: %s",
    (groups) => {
      expect(
        verifiedIdentity(
          event({
            sub: "A",
            token_use: "access",
            "cognito:groups": groups,
            scope: "api/donations.read",
          }),
        ),
      ).toEqual({
        sub: "A",
        groups: ["DONANTE"],
        scopes: ["api/donations.read"],
      });
    },
  );
  it("T02: no confía en Authorization/body; logs sin tokens ni body", async () => {
    const logs: string[] = [];
    const e = event();
    e.headers.authorization = "Bearer NO-REGISTRAR";
    e.body = JSON.stringify({ sub: "A", groups: ["GESTOR"] });
    const result = await makeHandler(
      "createProject",
      new Service(new MemoryStore()),
      verifiedIdentity,
      (line) => logs.push(line),
    )(e);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body!)).toEqual({
      code: "UNAUTHORIZED",
      message: "Autenticación requerida",
      requestId: "req-test",
    });
    expect(logs.join()).not.toContain("NO-REGISTRAR");
    expect(JSON.parse(logs[0])).toMatchObject({
      requestId: "req-test",
      action: "createProject",
      httpStatus: 401,
    });
  });
  it("400 para JSON o validación inválidos sin exponer datos", async () => {
    const handler = makeHandler(
      "createProject",
      new Service(new MemoryStore()),
      () => ({ sub: "A", groups: ["GESTOR"], scopes: ["api/projects.write"] }),
      () => {},
    );
    const e = event();
    e.body = "{";
    expect((await handler(e)).statusCode).toBe(400);
    e.body = "{}";
    expect((await handler(e)).statusCode).toBe(400);
  });
  it("500 sanitizado para fallo de almacenamiento", async () => {
    const store = new MemoryStore();
    store.projects = async () => {
      throw new Error("secret-database-detail");
    };
    const result = await makeHandler(
      "listProjects",
      new Service(store),
      verifiedIdentity,
      () => {},
    )(event());
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain("secret-database-detail");
  });
});
