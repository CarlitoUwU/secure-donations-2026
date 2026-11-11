import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const {
  SECURITY_API_URL,
  DONOR_A_ACCESS_TOKEN,
  DONOR_B_ACCESS_TOKEN,
  MANAGER_ACCESS_TOKEN,
  DONOR_ID_TOKEN,
  DONATION_ID,
} = process.env;
if (
  !SECURITY_API_URL ||
  !DONOR_A_ACCESS_TOKEN ||
  !DONOR_B_ACCESS_TOKEN ||
  !MANAGER_ACCESS_TOKEN ||
  !DONOR_ID_TOKEN ||
  !DONATION_ID
) {
  throw new Error(
    "Faltan parámetros de prueba. Consultar docs/security-verification.md.",
  );
}

const base = new URL(SECURITY_API_URL);
if (
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.search ||
  base.hash
) {
  throw new Error(
    "SECURITY_API_URL debe ser una URL HTTPS sin credenciales, query ni fragmento.",
  );
}

async function check(caseId, path, status, token, method = "GET") {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (method === "POST") headers["Content-Type"] = "application/json";
  const response = await fetch(`${base.href.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: method === "POST" ? "{}" : undefined,
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(15000),
  });
  const requestId = response.headers.get("apigw-requestid");
  console.log(
    `${caseId}: HTTP ${response.status}${requestId ? ` (${requestId})` : ""}`,
  );
  assert.equal(response.status, status, caseId);
  return response;
}

const donationPath = `/v1/donations/${encodeURIComponent(DONATION_ID)}`;
const historyPath = "/v1/donations/me";
const jwtParts = DONOR_A_ACCESS_TOKEN.split(".");
assert.equal(jwtParts.length, 3, "El access token de A debe ser un JWT");
const signature = jwtParts[2];
assert.ok(signature, "El JWT debe incluir una firma");
jwtParts[2] = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

await check("T02 sin token", "/v1/donations", 401, undefined, "POST");
await check(
  "T03 grupo donante",
  "/v1/projects",
  403,
  DONOR_A_ACCESS_TOKEN,
  "POST",
);
await check(
  "T09 control positivo del propietario",
  donationPath,
  200,
  DONOR_A_ACCESS_TOKEN,
);
const foreign = await check(
  "T09 recurso ajeno",
  donationPath,
  404,
  DONOR_B_ACCESS_TOKEN,
);
const absent = await check(
  "T09 recurso inexistente",
  `/v1/donations/${randomUUID()}`,
  404,
  DONOR_B_ACCESS_TOKEN,
);
const foreignError = await foreign.json();
const absentError = await absent.json();
for (const error of [foreignError, absentError]) {
  assert.equal(error.code === "NOT_FOUND", true, "T09 código público");
  assert.equal(
    error.message === "Recurso no encontrado",
    true,
    "T09 mensaje público",
  );
  assert.equal(
    Object.keys(error).every((key) =>
      ["code", "message", "requestId"].includes(key),
    ),
    true,
    "T09 sin campos adicionales",
  );
}
await check("T11 ID token", historyPath, 401, DONOR_ID_TOKEN);
await check("T11 firma alterada", historyPath, 401, jwtParts.join("."));
await check("T12 grupo gestor", historyPath, 403, MANAGER_ACCESS_TOKEN);
