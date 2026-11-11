// Run from a client near the AWS region. Does not create projects or log tokens.
import { writeFile } from "node:fs/promises";
const base = process.env.API_BASE_URL;
if (!base?.startsWith("https://"))
  throw new Error("Configure API_BASE_URL con HTTPS");
if (!process.env.MEASUREMENT_LOCATION)
  throw new Error(
    "Configure MEASUREMENT_LOCATION (región/ubicación del cliente)",
  );
const url = `${base.replace(/\/$/, "")}/v1/projects`;
const first = await fetch(url);
if (!first.ok) throw new Error(`Catálogo HTTP ${first.status}`);
if ((await first.json()).items?.length !== 50)
  throw new Error(
    "Se requieren 50 proyectos publicados en la primera página; preparar el dataset con P1",
  );
for (let i = 0; i < 10; i++) {
  const r = await fetch(url);
  await r.text();
  if (!r.ok) throw new Error(`Calentamiento HTTP ${r.status}`);
}
const samples = [];
for (let i = 0; i < 100; i++) {
  const start = performance.now();
  const response = await fetch(url);
  await response.text();
  if (!response.ok) throw new Error(`Medición HTTP ${response.status}`);
  samples.push(performance.now() - start);
}
const sorted = [...samples].sort((a, b) => a - b);
const report = {
  timestamp: new Date().toISOString(),
  tool: "Node fetch/performance.now",
  location: process.env.MEASUREMENT_LOCATION,
  method: "GET /v1/projects",
  projects: 50,
  warmups: 10,
  sampleCount: 100,
  p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
  thresholdMs: 1500,
  coldStartExclusion:
    "PENDIENTE: correlacionar con CloudWatch; calentamiento no prueba ausencia de cold starts",
  samplesMs: samples,
};
await writeFile("evidence/performance.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    p95Ms: report.p95Ms,
    thresholdMs: 1500,
    cloudWatchReviewRequired: true,
  }),
);
