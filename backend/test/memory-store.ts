import { conflict } from "../src/shared/contracts.js";
import type {
  Audit,
  Donation,
  Idempotency,
  Project,
} from "../src/shared/contracts.js";
import type { Store } from "../src/shared/store.js";
// Test double only: synchronous commits emulate atomicity, not DynamoDB integration.
export class MemoryStore implements Store {
  p = new Map<string, Project>();
  d = new Map<string, Donation>();
  keys = new Map<string, Idempotency>();
  audits: Audit[] = [];
  async project(id: string) {
    return structuredClone(this.p.get(id));
  }
  async donation(id: string) {
    return structuredClone(this.d.get(id));
  }
  async idempotency(pk: string) {
    return structuredClone(this.keys.get(pk));
  }
  async projects() {
    return {
      items: [...this.p.values()].filter((p) => p.status === "PUBLICADO"),
    };
  }
  async donations(sub: string) {
    return { items: [...this.d.values()].filter((d) => d.donorSub === sub) };
  }
  async createProject(p: Project, a: Audit) {
    if (this.p.has(p.projectId)) throw conflict();
    this.p.set(p.projectId, structuredClone(p));
    this.audits.push(a);
  }
  async updateProject(before: Project, after: Project, a: Audit) {
    const p = this.p.get(before.projectId);
    if (!p || p.status !== "BORRADOR" || p.revision !== before.revision)
      throw conflict();
    this.p.set(after.projectId, structuredClone(after));
    this.audits.push(a);
  }
  async createDonation(d: Donation, key: Idempotency, a: Audit) {
    if (
      this.keys.has(key.pk) ||
      this.d.has(d.donationId) ||
      this.p.get(d.projectId)?.status !== "PUBLICADO"
    )
      throw conflict();
    this.keys.set(key.pk, structuredClone(key));
    this.d.set(d.donationId, structuredClone(d));
    this.audits.push(a);
  }
  async transition(before: Donation, after: Donation, a: Audit) {
    const d = this.d.get(before.donationId);
    if (
      !d ||
      d.status !== "PENDIENTE_SIMULACION" ||
      d.donorSub !== before.donorSub
    )
      throw conflict();
    this.d.set(d.donationId, structuredClone(after));
    if (after.status === "CONFIRMADA_SIMULADA")
      this.p.get(d.projectId)!.confirmedAmountCents += d.amountCents;
    this.audits.push(a);
  }
}
