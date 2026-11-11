import { describe, expect, it, vi } from "vitest";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoStore } from "../src/shared/dynamo-store.js";
import type { Audit, Donation, Idempotency } from "../src/shared/contracts.js";
const tables = {
  projects: "Projects",
  donations: "Donations",
  idempotency: "Idempotency",
  audit: "AuditEvents",
};
const d: Donation = {
  donationId: "d",
  projectId: "p",
  donorSub: "A",
  amountCents: 100,
  currency: "PEN",
  status: "PENDIENTE_SIMULACION",
  createdAt: "now",
  updatedAt: "now",
};
const a: Audit = {
  eventType: "test",
  sortKey: "now#e",
  eventId: "e",
  timestamp: "now",
  requestId: "r",
  actorRef: "hash",
  action: "test",
  resourceRef: "d",
  outcome: "SUCCESS",
};
const key: Idempotency = {
  pk: "A#key",
  payloadHash: "hash",
  donationId: "d",
  responseStatus: 201,
  response: d,
  expiresAt: 123,
};
const setup = () => {
  const send = vi.fn().mockResolvedValue({});
  return {
    send,
    store: new DynamoStore(tables, {
      send,
    } as unknown as DynamoDBDocumentClient),
  };
};
describe("Plan de transacciones DynamoDB (SDK simulado)", () => {
  it("CA-05.4: clave/donación/auditoría y proyecto publicado en una sola transacción", async () => {
    const { store, send } = setup();
    await store.createDonation(d, key, a);
    expect(send).toHaveBeenCalledTimes(1);
    const items = send.mock.calls[0][0].input.TransactItems;
    expect(items).toHaveLength(4);
    expect(items[0].ConditionCheck.TableName).toBe("Projects");
    expect(items[1].Put.ConditionExpression).toBe("attribute_not_exists(pk)");
    expect(items[1].Put.Item.response).toEqual(d);
    expect(items[2].Put.TableName).toBe("Donations");
    expect(items[3].Put.TableName).toBe("AuditEvents");
  });
  it("CA-06.2: condición incluye propietario/pendiente e incremento en misma transacción", async () => {
    const { store, send } = setup();
    await store.transition(d, { ...d, status: "CONFIRMADA_SIMULADA" }, a);
    const items = send.mock.calls[0][0].input.TransactItems;
    expect(items).toHaveLength(3);
    expect(items[0].Update.ConditionExpression).toContain("donorSub = :sub");
    expect(items[0].Update.ExpressionAttributeValues[":pending"]).toBe(
      "PENDIENTE_SIMULACION",
    );
    expect(items[2].Update.UpdateExpression).toContain(
      "ADD confirmedAmountCents :amount",
    );
    expect(items[2].Update.ExpressionAttributeValues[":amount"]).toBe(100);
  });
  it("CA-06.3: rechazo no actualiza el proyecto", async () => {
    const { store, send } = setup();
    await store.transition(d, { ...d, status: "RECHAZADA_SIMULADA" }, a);
    expect(send.mock.calls[0][0].input.TransactItems).toHaveLength(2);
  });
  it("lecturas por clave consistentes y Query historial limitado al sub", async () => {
    const { store, send } = setup();
    await store.donation("d");
    expect(send.mock.calls[0][0].input.ConsistentRead).toBe(true);
    await store.donations("A");
    expect(send.mock.calls[1][0].input.ExpressionAttributeValues).toEqual({
      ":value": "A",
    });
    const cursor = Buffer.from(
      JSON.stringify({ donationId: "d", donorSub: "B", createdAt: "now" }),
    ).toString("base64url");
    await expect(store.donations("A", cursor)).rejects.toMatchObject({
      status: 400,
    });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("distingue conflicto de fallo de permisos/capacidad", async () => {
    const { store, send } = setup();
    send.mockRejectedValueOnce({
      name: "TransactionCanceledException",
      CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
    });
    await expect(store.createDonation(d, key, a)).rejects.toMatchObject({
      status: 409,
    });
    send.mockRejectedValueOnce({ name: "AccessDeniedException" });
    await expect(store.createDonation(d, key, a)).rejects.toMatchObject({
      name: "AccessDeniedException",
    });
  });
});
