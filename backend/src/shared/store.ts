import type {
  Audit,
  Donation,
  Idempotency,
  Page,
  Project,
} from "./contracts.js";

export interface Store {
  project(id: string): Promise<Project | undefined>;
  donation(id: string): Promise<Donation | undefined>;
  idempotency(pk: string): Promise<Idempotency | undefined>;
  projects(nextToken?: string): Promise<Page<Project>>;
  donations(sub: string, nextToken?: string): Promise<Page<Donation>>;
  createProject(project: Project, audit: Audit): Promise<void>;
  updateProject(before: Project, after: Project, audit: Audit): Promise<void>;
  createDonation(
    donation: Donation,
    key: Idempotency,
    audit: Audit,
  ): Promise<void>;
  transition(before: Donation, after: Donation, audit: Audit): Promise<void>;
}
