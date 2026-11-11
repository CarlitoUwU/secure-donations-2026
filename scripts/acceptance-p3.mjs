import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

// These values stay in process memory. Never write them to a file or print them.
const base = process.env.API_BASE_URL?.replace(/\/$/, "");
const manager = process.env.GESTOR_ACCESS_TOKEN;
const donorA = process.env.DONOR_A_ACCESS_TOKEN;
const donorB = process.env.DONOR_B_ACCESS_TOKEN;
if (!base?.startsWith("https://") || !manager || !donorA || !donorB)
  throw new Error(
    "Configure API_BASE_URL HTTPS y access tokens de prueba GESTOR_ACCESS_TOKEN, DONOR_A_ACCESS_TOKEN y DONOR_B_ACCESS_TOKEN en el entorno",
  );
const checks = [];
async function request(method, path, token, body, key) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data };
}
function status(result, expected) {
  assert.equal(result.status, expected, "Código HTTP inesperado");
}
async function check(id, action) {
  try {
    await action();
    checks.push({ id, result: "PASS" });
  } catch {
    checks.push({
      id,
      result: "FAIL",
      detail:
        "Revisar caso con P1/P2; respuesta omitida para no guardar identidades o credenciales",
    });
    throw new Error(`Fallo ${id}`);
  }
}
let projectId;
let donationId;
const createProject = async (title) => {
  const response = await request("POST", "/v1/projects", manager, {
    title,
    description: "Solo datos ficticios de prueba P3",
    goalAmountCents: 100000,
  });
  status(response, 201);
  return response.data.projectId;
};
const amount = 500;
let first;
const key = randomUUID();
const donation = (amountCents = amount, idempotencyKey = randomUUID()) =>
  request(
    "POST",
    "/v1/donations",
    donorA,
    { projectId, amountCents },
    idempotencyKey,
  );
try {
  projectId = await createProject(`Prueba P3 ${Date.now()}`);
  await check("T01/CA-01.2/CA-02.2", async () => {
    status(await request("GET", `/v1/projects/${projectId}`), 404);
    let nextToken;
    do {
      const r = await request(
        "GET",
        "/v1/projects" +
          (nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : ""),
      );
      status(r, 200);
      assert.ok(
        r.data.items.every(
          (p) =>
            p.status === "PUBLICADO" &&
            p.projectId !== projectId &&
            !("donorSub" in p),
        ),
      );
      nextToken = r.data.nextToken;
    } while (nextToken);
    status(
      await request("PATCH", `/v1/projects/${projectId}/publish`, manager),
      200,
    );
    status(await request("GET", `/v1/projects/${projectId}`), 200);
  });
  await check("T04/CA-05.2", async () => {
    for (const invalid of [0, 99, 100001, 100.5])
      status(await donation(invalid), 400);
    status(
      await request("POST", "/v1/donations", donorA, {
        projectId,
        amountCents: amount,
      }),
      400,
    );
    status(await donation(500, "not-a-uuid"), 400);
  });
  await check("T05/CA-05.1", async () => {
    first = await donation(amount, key);
    status(first, 201);
    donationId = first.data.donationId;
    assert.equal(first.data.status, "PENDIENTE_SIMULACION");
    const stats = await request("GET", `/v1/projects/${projectId}/stats`);
    status(stats, 200);
    assert.equal(stats.data.confirmedAmountCents, 0);
  });
  await check("T06/CA-05.4", async () => {
    const replay = await donation(amount, key);
    status(replay, 201);
    assert.deepEqual(replay.data, first.data);
  });
  await check("T07/CA-05.4", async () => {
    status(await donation(600, key), 409);
  });
  await check("T09/CA-07.2", async () => {
    status(await request("GET", `/v1/donations/${donationId}`, donorA), 200);
    const foreign = await request("GET", `/v1/donations/${donationId}`, donorB);
    const absent = await request(
      "GET",
      `/v1/donations/${randomUUID()}`,
      donorB,
    );
    status(foreign, 404);
    status(absent, 404);
    const { requestId: _a, ...foreignError } = foreign.data;
    const { requestId: _b, ...absentError } = absent.data;
    assert.ok(_a && _b);
    assert.deepEqual(foreignError, absentError);
    status(
      await request("POST", `/v1/donations/${donationId}/simulate`, donorB, {
        status: "CONFIRMADA_SIMULADA",
      }),
      404,
    );
    const own = await request("GET", `/v1/donations/${donationId}`, donorA);
    status(own, 200);
    assert.equal(own.data.status, "PENDIENTE_SIMULACION");
    const stats = await request("GET", `/v1/projects/${projectId}/stats`);
    assert.equal(stats.data.confirmedAmountCents, 0);
  });
  await check("T08/CA-06.2/CA-NF04.1", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request("POST", `/v1/donations/${donationId}/simulate`, donorA, {
          status: "CONFIRMADA_SIMULADA",
        }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 9);
    const stats = await request("GET", `/v1/projects/${projectId}/stats`);
    status(stats, 200);
    assert.equal(stats.data.confirmedAmountCents, amount);
  });
  await check("CA-06.3", async () => {
    const pending = await donation();
    status(pending, 201);
    status(
      await request(
        "POST",
        `/v1/donations/${pending.data.donationId}/simulate`,
        donorA,
        { status: "RECHAZADA_SIMULADA" },
      ),
      200,
    );
    const stats = await request("GET", `/v1/projects/${projectId}/stats`);
    assert.equal(stats.data.confirmedAmountCents, amount);
  });
  if (process.argv.includes("--seed-performance")) {
    // Adds 49 published projects: use only on a fresh academic dataset (one was created above).
    for (let i = 1; i < 50; i++) {
      const id = await createProject(`Carga académica ${i}`);
      status(
        await request("PATCH", `/v1/projects/${id}/publish`, manager),
        200,
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof Error && error.message.startsWith("Fallo ")
      ? error.message
      : "Falló preparación o transporte; revisar el entorno sin publicar credenciales",
  );
  process.exitCode = 1;
} finally {
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/acceptance-p3.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        revision: process.env.TEST_REVISION ?? "Indicar commit evaluado",
        environment: "academic",
        checks,
        note: "Recursos ficticios creados permanecen hasta limpieza de la pila por P1",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(checks));
}
